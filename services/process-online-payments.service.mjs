import { cnj as validateCnj } from './process-online-workflow.service.mjs';
import { randomUUID, createHash } from 'node:crypto';
import { validateCpf, validateCnpj } from './audit.service.mjs';
import { sealIr, openIr, irKey } from './ir-exemption-domain.mjs';
import { processServiceQuote } from '../certificate-selection.js';

// Existing paid searches retain their original provider and amount. New document searches use certificate orders.
export const PROCESS_SEARCH_PRICE = 4990;
const MAX_COPIES = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (code, status = 400) => { throw Object.assign(new Error(code), { code: `process_online_${code}`, status }); };
function copyOperation(orderId, number) {
  const hash = createHash('sha256').update(`process-copy:${orderId}:${number}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export function createProcessOnlinePayments({ getDb, workflow, createCheckout, getPricing = async () => undefined,
  checkoutReady = () => false, allowLegacySearchCheckout = false, env = process.env, now = () => Date.now() }) {
  const key = () => irKey(env.AUDITA_PROFILE_ENCRYPTION_KEY || '');
  const db = () => { const value = getDb(); if (!value?.dbReady || !value.pool || !key()) fail('payment_storage_unavailable', 503); return value.pool; };
  const authCheck = auth => { if (!auth?.tenantId || !auth?.user?.id || auth.unauthorized) fail('authentication_required', 401); };
  const decode = row => openIr(row.encrypted_input, key(), `process-search:${row.id}`);
  const requestIds = row => row.request_ids?.length ? row.request_ids : row.request_id ? [row.request_id] : [];
  const publicOrder = row => {
    const input = decode(row), quantity = input.cnjs?.length || 1;
    return { id: row.id, kind: row.kind, status: row.status, amountCents: row.amount_cents,
      unitAmountCents: input.quote?.unitAmountCents ?? row.amount_cents / quantity, quantity,
      requestId: row.request_id || null, requestIds: requestIds(row), checkoutUrl: row.status === 'pending' ? row.checkout_url : null };
  };
  async function owned(auth, id) {
    authCheck(auth); if (!UUID.test(id || '')) fail('order_not_found', 404);
    const row = (await db().query('SELECT * FROM audita_process_search_orders WHERE id=$1 AND tenant_id=$2 AND user_id=$3', [id, auth.tenantId, auth.user.id])).rows[0];
    if (!row) fail('order_not_found', 404); return row;
  }
  async function config() {
    const pricing = await getPricing(), quote = processServiceQuote('processOnlineCopy', pricing?.pricing || pricing, 1);
    const ready = checkoutReady() && Boolean(getDb()?.dbReady && key()) && workflow.getStatus().ready;
    return { amountCents: PROCESS_SEARCH_PRICE, currency: 'brl', checkoutReady: ready && allowLegacySearchCheckout && workflow.getStatus().searchReady !== false,
      copyPayment: { unitAmountCents: quote.unitAmountCents, amountCents: quote.amountCents, quantity: 1, currency: 'brl', checkoutReady: ready, maxQuantity: MAX_COPIES } };
  }
  async function checkout(auth, body = {}, kind = 'search') {
    if (!['search', 'copy'].includes(kind)) fail('invalid_checkout');
    authCheck(auth);
    if (kind === 'search' && !allowLegacySearchCheckout) fail('document_search_moved', 410);
    if (!checkoutReady() || !getDb()?.dbReady || !key() || !workflow.getStatus().ready || kind === 'search' && workflow.getStatus().searchReady === false) fail('checkout_unavailable', 503);
    if (body.consent !== true || !UUID.test(body.operationId || '')) fail('invalid_checkout');
    const input = { consent: true, approvedCredits: 0, operationId: body.operationId.toLowerCase() };
    if (kind === 'copy') {
      if (body.cnjs !== undefined) {
        if (body.cnj != null || !Array.isArray(body.cnjs) || !body.cnjs.length || body.cnjs.length > MAX_COPIES) fail('invalid_selection');
        const numbers = body.cnjs.map(validateCnj);
        if (new Set(numbers).size !== numbers.length) fail('duplicate_selection');
        input.cnjs = numbers.sort();
      } else input.cnj = validateCnj(body.cnj);
      input.interesse = 'outro'; input.interesseDetalhe = '';
    } else {
      const documento = String(body.documento || '').replace(/\D/g, '');
      if (!(documento.length === 11 ? validateCpf(documento) : documento.length === 14 && validateCnpj(documento))) fail('invalid_document');
      input.documento = documento;
    }
    if (body.parentAuditId != null) {
      if (!UUID.test(body.parentAuditId)) fail('invalid_parent');
      const parent = await db().query('SELECT id FROM audita_audits WHERE public_id=$1 AND tenant_id=$2 AND requested_by_user_id=$3', [body.parentAuditId, auth.tenantId, auth.user.id]);
      if (!parent.rows.length) fail('parent_not_found', 404); input.parentAuditId = body.parentAuditId;
    }
    const fingerprint = createHash('sha256').update(JSON.stringify(kind === 'search'
      ? { documento: input.documento, consent: input.consent, approvedCredits: input.approvedCredits, operationId: input.operationId, ...(input.parentAuditId ? { parentAuditId: input.parentAuditId } : {}) } : input)).digest('hex');
    let row = (await db().query('SELECT * FROM audita_process_search_orders WHERE tenant_id=$1 AND user_id=$2 AND operation_id=$3', [auth.tenantId, auth.user.id, input.operationId])).rows[0];
    if (!row) {
      const pricing = kind === 'copy' ? await getPricing() : undefined;
      const quote = kind === 'copy' ? processServiceQuote('processOnlineCopy', pricing?.pricing || pricing, input.cnjs?.length || 1)
        : { amountCents: PROCESS_SEARCH_PRICE, unitAmountCents: PROCESS_SEARCH_PRICE, quantity: 1, currency: 'brl' };
      if (!Number.isSafeInteger(quote.amountCents) || quote.amountCents <= 0 || quote.amountCents > 2147483647) fail('invalid_price');
      if (body.approvedAmountCents !== undefined && body.approvedAmountCents !== quote.amountCents) fail('price_changed', 409);
      const id = randomUUID();
      await db().query(`INSERT INTO audita_process_search_orders(id,tenant_id,user_id,operation_id,fingerprint,encrypted_input,amount_cents,provider_mode,kind)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(tenant_id,user_id,operation_id) DO NOTHING`,
      [id, auth.tenantId, auth.user.id, input.operationId, fingerprint, sealIr({ ...input, quote }, key(), `process-search:${id}`), quote.amountCents, workflow.getStatus().mode, kind]);
      row = (await db().query('SELECT * FROM audita_process_search_orders WHERE tenant_id=$1 AND user_id=$2 AND operation_id=$3', [auth.tenantId, auth.user.id, input.operationId])).rows[0];
    }
    if (row.fingerprint !== fingerprint || row.kind !== kind) fail('operation_conflict', 409);
    if (body.approvedAmountCents !== undefined && body.approvedAmountCents !== row.amount_cents) fail('price_changed', 409);
    if (row.status !== 'pending' || row.checkout_url) return publicOrder(row);
    // Do not recreate an uncertain Checkout after Stripe's idempotency retention window.
    if (now() - new Date(row.created_at).getTime() > 22 * 3600000) fail('checkout_needs_review', 409);
    const quantity = decode(row).cnjs?.length || 1;
    const session = await createCheckout(auth, { id: row.id, amountCents: row.amount_cents, quantity, createdAt: row.created_at, mode: row.provider_mode, kind: row.kind });
    if (!session?.id || !session.url || new URL(session.url).origin !== 'https://checkout.stripe.com') fail('invalid_checkout_response', 502);
    row = (await db().query('UPDATE audita_process_search_orders SET checkout_session=$2,checkout_url=$3 WHERE id=$1 AND (checkout_session IS NULL OR checkout_session=$2) RETURNING *', [row.id, session.id, session.url])).rows[0];
    if (!row) fail('checkout_conflict', 409); return publicOrder(row);
  }
  async function active(auth) {
    authCheck(auth);
    const rows = (await db().query("SELECT * FROM audita_process_search_orders WHERE tenant_id=$1 AND user_id=$2 AND status IN ('pending','paid') ORDER BY created_at DESC LIMIT 20", [auth.tenantId, auth.user.id])).rows;
    return { orders: rows.map(publicOrder) };
  }
  async function get(auth, id) {
    const row = await owned(auth, id), requests = await Promise.all(requestIds(row).map(requestId => workflow.get(auth, requestId)));
    return { ...publicOrder(row), ...(requests.length ? { request: requests[0], requests } : {}) };
  }
  async function paymentEvent(event) {
    const object = event?.data?.object || {}, meta = object.metadata || {};
    const types = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired'];
    if (meta.purchase_kind !== 'process_search' || !types.includes(event.type)) return { ignored: true };
    if (!UUID.test(meta.process_search_order_id || '')) fail('invalid_payment', 400);
    let row = (await db().query('SELECT * FROM audita_process_search_orders WHERE id=$1', [meta.process_search_order_id])).rows[0];
    if (!row || String(row.tenant_id) !== meta.audita_tenant_id || String(row.user_id) !== meta.audita_user_id || object.mode !== 'payment' || object.currency !== 'brl' || object.amount_total !== row.amount_cents
      || !object.id || row.checkout_session && row.checkout_session !== object.id) fail('payment_mismatch', 400);
    if (event.livemode !== (row.provider_mode === 'live')) fail('payment_mode_mismatch', 400);
    if (['checkout.session.expired', 'checkout.session.async_payment_failed'].includes(event.type)) {
      await db().query("UPDATE audita_process_search_orders SET status=$2 WHERE id=$1 AND status='pending'", [row.id, event.type.endsWith('expired') ? 'expired' : 'failed']); return { tenantId: row.tenant_id };
    }
    if (object.payment_status !== 'paid') return { ignored: true, reason: 'payment_pending' };
    row = (await db().query("UPDATE audita_process_search_orders SET status=CASE WHEN status='fulfilled' THEN status ELSE 'paid' END,paid_at=COALESCE(paid_at,NOW()),checkout_session=COALESCE(checkout_session,$2) WHERE id=$1 RETURNING *", [row.id, object.id])).rows[0];
    if (row.status === 'fulfilled') return { tenantId: row.tenant_id };
    if (workflow.getStatus().mode !== row.provider_mode) fail('provider_mode_changed', 503);
    const auth = { tenantId: row.tenant_id, user: { id: row.user_id } }, input = decode(row), ids = [];
    // Each selected copy has a durable operation, so a webhook retry never reorders successful siblings.
    for (const number of input.cnjs || [input.cnj || null]) {
      const { quote, cnjs, ...operation } = input;
      const request = await (row.kind === 'copy' ? workflow.requestCopy(auth, { ...operation, ...(cnjs ? { cnj: number, operationId: copyOperation(row.id, number) } : {}) }) : workflow.search(auth, operation));
      if (!request?.id) fail('search_unavailable', 503);
      ids.push(request.id);
    }
    await db().query("UPDATE audita_process_search_orders SET status='fulfilled',request_id=$2,request_ids=$3::uuid[] WHERE id=$1", [row.id, ids[0], ids]);
    return { tenantId: row.tenant_id };
  }
  return { config, checkout, get, active, paymentEvent };
}
