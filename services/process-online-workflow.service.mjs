import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, lstat, realpath, open, unlink } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { sealIr, openIr, irKey } from './ir-exemption-domain.mjs';
import { validateCpf, validateCnpj } from './audit.service.mjs';
import { getPdfRoot } from './storage.service.mjs';
import { verifyProcessOnlineWebhook } from './process-online.service.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PART_BYTES = 200 * 1024 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024;
const MAX_PARTS = 20;
const TERMINAL_FAILURES = ['failed', 'secret', 'expired'];
const EVENTS = ['request.completed', 'request.failed', 'request.secret'];
const PROVEN_REJECTIONS = ['process_online_unauthorized', 'process_online_insufficient_credits', 'process_online_forbidden', 'process_online_invalid_request'];

function problem(code, message = 'Não foi possível concluir a operação ProcessOnline.', status = 400) {
  const error = new Error(message);
  error.code = code.startsWith('process_online_') ? code : `process_online_${code}`;
  error.status = status;
  error.statusCode = status;
  return error;
}
function requireValue(condition, code, message, status) {
  if (!condition) throw problem(code, message, status);
}
function cnj(value) {
  requireValue(typeof value === 'string' && /^[\d.\-\s]+$/.test(value), 'invalid_cnj', 'Informe um número CNJ válido.');
  const number = value.replace(/\D/g, '');
  requireValue(number.length === 20 && !/^(\d)\1+$/.test(number)
    && Number(number.slice(9, 13)) >= 1900 && Number(number.slice(9, 13)) <= new Date().getFullYear() + 1
    && BigInt(number.slice(0, 7) + number.slice(9) + number.slice(7, 9)) % 97n === 1n,
  'invalid_cnj', 'Informe um número CNJ válido.');
  return number;
}
function documentNumber(value) {
  requireValue(typeof value === 'string' && /^[\d.\/\-\s]+$/.test(value) && (validateCpf(value) || validateCnpj(value)),
    'invalid_document', 'Informe um CPF ou CNPJ válido.');
  return value.replace(/\D/g, '');
}
function downloadUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw problem('invalid_download'); }
  requireValue(typeof value === 'string' && value.length <= 8192 && url.origin === 'https://api.processonline.com.br'
    && !url.username && !url.password && !url.hash && url.pathname.startsWith('/storage/v1/object/sign/'), 'invalid_download');
  return url.href;
}
function limitedText(value, limit = 300) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, limit) : undefined;
}
function publicResults(results) {
  requireValue(Array.isArray(results) && results.length <= 5000, 'invalid_response');
  return results.map(result => {
    const item = { numero_cnj: cnj(result?.numero_cnj) };
    for (const field of ['tribunal', 'classe', 'assunto', 'status', 'orgao_julgador', 'data_distribuicao']) {
      const value = limitedText(result[field]);
      // Do not forward arbitrary provider objects, URLs, tokens or document identifiers.
      if (value && !/https?:\/\/|(?:token|bearer)[=: ]/i.test(value)) item[field] = value;
    }
    return item;
  });
}
function resultData(value) {
  requireValue(Buffer.byteLength(JSON.stringify(value)) <= 2 * 1024 * 1024, 'response_too_large');
  let nodes = 0;
  function sanitize(item, depth = 0) {
    requireValue(++nodes <= 100000 && depth <= 30, 'invalid_response');
    if (item == null || typeof item === 'boolean' || typeof item === 'number') return item;
    if (typeof item === 'string') return /po_(?:live|test)_[A-Za-z0-9_-]+|https:\/\/api\.processonline\.com\.br\/storage\/v1\/object\/sign\//i.test(item) ? undefined : item;
    if (Array.isArray(item)) return item.map(value => sanitize(value, depth + 1) ?? null);
    requireValue(typeof item === 'object', 'invalid_response');
    const output = Object.create(null);
    for (const [name, data] of Object.entries(item)) {
      if (/token|secret|authorization|api[_-]?key|password|download[_-]?url|signed[_-]?url|^__proto__$|^constructor$|^prototype$/i.test(name)) continue;
      const sanitized = sanitize(data, depth + 1);
      if (sanitized !== undefined) output[name] = sanitized;
    }
    return output;
  }
  return sanitize(value);
}

/** Durable owner-scoped workflows; the transport never serves as billing authorization. */
export function createProcessOnlineWorkflowService({ getDb, provider, env = process.env, credits, now = () => Date.now(), fetchImpl = globalThis.fetch } = {}) {
  const key = () => irKey(env.AUDITA_PROFILE_ENCRYPTION_KEY);
  const providerStatus = () => provider?.getStatus?.() || { enabled: false, ready: false, mode: null };
  const seal = (id, payload) => sealIr(payload, key(), `process-online:${id}`);
  const decrypt = row => openIr(row.encrypted_payload, key(), `process-online:${row.id}`);
  const stamp = () => new Date(now()).toISOString();
  const root = () => resolve(getPdfRoot());

  function db() {
    const value = getDb?.();
    requireValue(value?.dbReady && value.pool && key(), 'storage_unavailable', 'O armazenamento seguro está indisponível.', 503);
    return value.pool;
  }
  function authenticated(auth) {
    requireValue(auth?.tenantId && auth?.user?.id && !auth.unauthorized, 'authentication_required', 'Entre para continuar.', 401);
    return auth;
  }
  function configured() {
    const status = providerStatus();
    requireValue(status.ready && ['test', 'live'].includes(status.mode), 'not_configured', 'A integração ProcessOnline ainda não está disponível.', 503);
    db();
    return status;
  }
  function getStatus() {
    const status = providerStatus(), storageReady = Boolean(getDb?.()?.dbReady && getDb?.()?.pool && key());
    const billingReady = true;
    return { enabled: status.enabled === true, ready: status.ready === true && storageReady && billingReady, mode: status.mode,
      searchReady: status.mode === 'live',
      storageReady, billingReady, auditaCredits: 0, providerCredits: status.mode === 'live' ? 1 : 0,
      verificationCredits: 0, pollAfterMs: 30000, maxPartBytes: MAX_PART_BYTES, maxTotalBytes: MAX_TOTAL_BYTES, maxParts: MAX_PARTS };
  }
  async function owned(auth, id) {
    authenticated(auth);
    requireValue(typeof id === 'string' && UUID.test(id), 'not_found', 'Pedido não encontrado.', 404);
    const row = (await db().query('SELECT * FROM audita_process_online_requests WHERE id=$1 AND tenant_id=$2 AND user_id=$3', [id, auth.tenantId, auth.user.id])).rows[0];
    requireValue(row, 'not_found', 'Pedido não encontrado.', 404);
    return settleInterrupted(row);
  }
  async function settleInterrupted(row) {
    if (row.status !== 'submitting' || now() - Date.parse(row.updated_at) < 300000) return row;
    const result = await db().query(`UPDATE audita_process_online_requests SET status='review_required',error_code='process_online_interrupted',updated_at=$4
      WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND status='submitting' AND updated_at<=$5 RETURNING *`,
    [row.id, row.tenant_id, row.user_id, stamp(), new Date(now() - 300000).toISOString()]);
    return result.rows[0] || (await db().query('SELECT * FROM audita_process_online_requests WHERE id=$1 AND tenant_id=$2 AND user_id=$3', [row.id, row.tenant_id, row.user_id])).rows[0];
  }
  function publicRequest(row) {
    const payload = decrypt(row), parts = row.status === 'ready' ? payload.parts || [] : [];
    return { id: row.id, operationId: row.operation_id, kind: row.kind, status: row.status, mode: row.mode,
      cnj: payload.input.cnj || null, parentAuditId: payload.input.parentAuditId || null,
      createdAt: row.created_at, updatedAt: row.updated_at, pollAfterMs: 30000,
      billing: { auditaCredits: row.mode === 'live' && payload.input.approvedCredits !== 0 ? 1 : 0, providerCredits: row.mode === 'live' ? 1 : 0,
        state: row.billing_state, refunded: row.billing_state === 'refunded' },
      ...(payload.verification ? { verification: payload.verification } : {}),
      ...(payload.results ? { results: payload.results, total: payload.total, resultData: resultData(payload.resultData || {}), partialResults: payload.total > payload.results.length } : {}),
      ...(row.error_code ? { errorCode: row.error_code } : {}),
      ...(row.kind === 'copy' ? { providerStatus: payload.providerStatus || null,
        downloadStatus: row.status === 'ready' ? 'ready' : row.status === 'review_required' ? 'review_required' : 'pending',
        message: row.status === 'ready' ? 'Todas as partes da cópia foram recebidas e verificadas.'
          : payload.providerStatus === 'completed' ? 'O provedor concluiu a cópia; a recepção integral dos arquivos ainda precisa ser concluída.'
            : row.status === 'review_required' ? 'O pedido precisa de conferência. A operação paga não será repetida automaticamente.'
              : row.status === 'processing' ? 'Aguardando a cópia do provedor.' : null } : {}),
      parts: parts.map(part => ({ index: part.index, bytes: part.bytes,
        url: `/api/process-online/requests/${row.id}/files/${part.index}` })),
      canRecover: row.kind === 'copy' && row.status === 'review_required' && !row.provider_request_id && (row.mode === 'test' || row.billing_state === 'charged' || (row.billing_state === 'none' && decrypt(row).input.approvedCredits === 0)) };
  }
  async function update(row, values = {}, payload) {
    const columns = Object.keys(values);
    requireValue(columns.every(name => ['status', 'provider_request_id', 'billing_state', 'error_code'].includes(name)), 'invalid_state');
    const params = [row.id, row.tenant_id, row.user_id];
    const assignments = columns.map(name => { params.push(values[name]); return `${name}=$${params.length}`; });
    if (payload) { params.push(seal(row.id, payload)); assignments.push(`encrypted_payload=$${params.length}`); }
    params.push(stamp()); assignments.push(`updated_at=$${params.length}`);
    const result = await db().query(`UPDATE audita_process_online_requests SET ${assignments.join(',')} WHERE id=$1 AND tenant_id=$2 AND user_id=$3 RETURNING *`, params);
    requireValue(result.rows[0], 'not_found', 'Pedido não encontrado.', 404);
    return result.rows[0];
  }
  async function validateInput(auth, kind, body) {
    authenticated(auth);
    requireValue(body && typeof body === 'object' && !Array.isArray(body), 'invalid_request');
    requireValue(typeof body.operationId === 'string' && UUID.test(body.operationId), 'invalid_operation', 'Reabra esta etapa para gerar uma operação válida.');
    requireValue(body.consent === true && [0, 1].includes(body.approvedCredits), 'cost_approval_required', 'Confirme a finalidade e a autorização antes de continuar.');
    const input = { operationId: body.operationId.toLowerCase(), consent: true, approvedCredits: body.approvedCredits };
    if (kind === 'search') input.documento = documentNumber(body.documento);
    else {
      input.cnj = cnj(body.cnj);
      requireValue(['parte', 'advogado', 'arrematante', 'sucessor', 'credor', 'outro'].includes(body.interesse), 'invalid_interesse', 'Informe seu interesse no processo.');
      const detail = body.interesseDetalhe ?? '';
      requireValue(typeof detail === 'string' && detail.length <= 500 && !/[\u0000-\u001f\u007f]/.test(detail)
        && (body.interesse !== 'advogado' || /^[A-Z]{2}\s+\d{1,10}[A-Z]?$/i.test(detail.trim())), 'invalid_interesse', 'Informe um interesse válido e, para advogado, UF e número da OAB.');
      input.interesse = body.interesse;
      input.interesseDetalhe = detail.trim();
    }
    if (body.parentAuditId != null && body.parentAuditId !== '') {
      requireValue(typeof body.parentAuditId === 'string' && UUID.test(body.parentAuditId), 'parent_not_found', 'Análise vinculada não encontrada.', 404);
      const parent = await db().query('SELECT id FROM audita_audits WHERE public_id=$1 AND tenant_id=$2 AND requested_by_user_id=$3', [body.parentAuditId, auth.tenantId, auth.user.id]);
      requireValue(parent.rows[0], 'parent_not_found', 'Análise vinculada não encontrada.', 404);
      input.parentAuditId = body.parentAuditId.toLowerCase();
    }
    return input;
  }
  const approval = row => ({ tenantId: String(row.tenant_id), userId: String(row.user_id), operationId: row.operation_id, credits: 1 });
  const authFor = row => ({ tenantId: row.tenant_id, user: { id: row.user_id } });
  const billingReference = row => `process-online:${row.id}`;

  async function charge(auth, row) {
    if (decrypt(row).input.approvedCredits === 0 || row.mode !== 'live' || row.billing_state === 'charged') return row;
    requireValue(env.AUDITA_CREDITS_ENABLED === 'true' && credits?.getWallet && credits?.consume && credits?.grant,
      'billing_unavailable', 'A carteira de créditos precisa estar habilitada para esta integração.', 503);
    const wallet = await credits.getWallet(auth);
    requireValue(wallet?.enabled === true && !wallet.unlimited, 'billing_unavailable', 'A carteira de créditos precisa estar habilitada para esta integração.', 503);
    row = await update(row, { billing_state: 'debit_pending' });
    const debit = await credits.consume(auth, { amount: 1, referenceId: billingReference(row), operation: `process_online_${row.kind}`, metadata: { requestId: row.id } });
    requireValue(debit?.ok === true && debit.state === 'consumed' && debit.amount === 1,
      debit?.state === 'insufficient' ? 'insufficient_credits' : 'billing_unavailable',
      debit?.state === 'insufficient' ? 'Saldo de créditos Audita insuficiente.' : 'Não foi possível confirmar o débito do crédito.', debit?.state === 'insufficient' ? 402 : 503);
    return update(row, { billing_state: 'charged' });
  }
  async function refund(row) {
    if (row.mode !== 'live' || !['charged', 'refund_pending'].includes(row.billing_state)) return row;
    const claimId = randomUUID();
    const claim = await db().query(`UPDATE audita_process_online_requests SET billing_state='refund_pending',refund_claim=$4,refund_claim_until=$5
      WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND billing_state IN ('charged','refund_pending')
      AND (refund_claim IS NULL OR refund_claim_until<$6) RETURNING *`, [row.id, row.tenant_id, row.user_id, claimId, new Date(now() + 300000).toISOString(), stamp()]);
    if (!claim.rows[0]) return (await db().query('SELECT * FROM audita_process_online_requests WHERE id=$1 AND tenant_id=$2 AND user_id=$3', [row.id, row.tenant_id, row.user_id])).rows[0];
    row = claim.rows[0];
    try {
      const result = await credits?.grant?.(authFor(row), { amount: 1, referenceId: `${billingReference(row)}:refund`, operation: 'process_online_refund', metadata: { requestId: row.id } });
      if (result?.ok === true && result.state === 'granted' && result.amount === 1) row = await update(row, { billing_state: 'refunded' });
      return row; // A pending refund uses the same ledger reference after a later reconciliation.
    } finally {
      await db().query('UPDATE audita_process_online_requests SET refund_claim=NULL,refund_claim_until=NULL WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND refund_claim=$4', [row.id, row.tenant_id, row.user_id, claimId]);
    }
  }
  async function verify(auth, body = {}) {
    authenticated(auth); configured();
    const number = cnj(body.cnj), result = await provider.verifyCNJ({ cnj: number });
    requireValue(typeof result?.exists === 'boolean' && (!result.cnj || cnj(result.cnj) === number), 'invalid_response');
    return { cnj: number, exists: result.exists, resultData: resultData(result), mode: providerStatus().mode, auditaCredits: 0, providerCredits: 0 };
  }
  async function perform(auth, kind, body) {
    authenticated(auth);
    const status = configured(), input = await validateInput(auth, kind, body);
    const fingerprint = createHash('sha256').update(JSON.stringify({ kind, input })).digest('hex');
    const id = randomUUID();
    let row = (await db().query(`INSERT INTO audita_process_online_requests
      (id,tenant_id,user_id,operation_id,kind,mode,status,request_hash,encrypted_payload)
      VALUES ($1,$2,$3,$4,$5,$6,'submitting',$7,$8)
      ON CONFLICT (tenant_id,user_id,operation_id) DO NOTHING RETURNING *`,
    [id, auth.tenantId, auth.user.id, input.operationId, kind, status.mode, fingerprint, seal(id, { input })])).rows[0];
    if (!row) {
      row = (await db().query('SELECT * FROM audita_process_online_requests WHERE tenant_id=$1 AND user_id=$2 AND operation_id=$3', [auth.tenantId, auth.user.id, input.operationId])).rows[0];
      requireValue(row && row.request_hash === fingerprint && row.kind === kind, 'operation_conflict', 'Esta operação já foi usada para outro pedido.', 409);
      row = await settleInterrupted(row);
      if (!(body.recover === true && kind === 'copy' && row.status === 'review_required' && !row.provider_request_id && (row.mode === 'test' || row.billing_state === 'charged' || (row.billing_state === 'none' && decrypt(row).input.approvedCredits === 0)))) return publicRequest(row);
      requireValue(row.mode === status.mode, 'mode_mismatch', 'Este pedido pertence a outro ambiente do provedor.', 409);
      // Recovery is explicit and uses precisely the provider idempotency key originally persisted.
      const claim = await db().query(`UPDATE audita_process_online_requests SET status='submitting',error_code=NULL,updated_at=$4
        WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND status='review_required' AND provider_request_id IS NULL AND (mode='test' OR billing_state IN ('charged','none')) RETURNING *`, [row.id, auth.tenantId, auth.user.id, stamp()]);
      if (!claim.rows[0]) return get(auth, row.id);
      row = claim.rows[0];
    }
    try {
      row = await charge(auth, row);
      if (kind === 'search') {
        const result = await provider.searchDocumento({ documento: input.documento, approval: approval(row) });
        requireValue(Number.isSafeInteger(result?.total) && result.total >= result.results?.length && [0, 1].includes(result.credits_charged), 'invalid_response');
        const results = publicResults(result.results);
        resultData(result);
        row = await update(row, { status: 'completed', error_code: null }, { input, results, total: result.total, resultData: result, providerCreditsCharged: result.credits_charged });
        if (result.total === 0) row = await refund(row);
      } else {
        const result = await provider.requestCopy({ cnj: input.cnj, interesse: input.interesse, interesseDetalhe: input.interesseDetalhe, approval: approval(row) });
        requireValue(typeof result?.request_id === 'string' && UUID.test(result.request_id) && ['processing', 'completed', ...TERMINAL_FAILURES].includes(result.status)
          && [0, 1].includes(result.credits_charged), 'invalid_response');
        // completed means provider-ready; private files are not ready until every part is checked.
        row = await update(row, { status: result.status === 'completed' ? 'processing' : result.status, provider_request_id: result.request_id, error_code: null },
          { input, providerStatus: result.status, providerCreditsCharged: result.credits_charged });
        if (result.refunded === true || (TERMINAL_FAILURES.includes(result.status) && result.credits_charged === 0)) row = await refund(row);
        if (result.status === 'completed') return reconcile(row, { force: true });
      }
      return publicRequest(row);
    } catch (error) {
      const knownRejection = PROVEN_REJECTIONS.includes(error?.code);
      const billingFailure = ['process_online_billing_unavailable', 'process_online_insufficient_credits'].includes(error?.code) && !['charged', 'refund_pending'].includes(row.billing_state);
      row = await update(row, { status: knownRejection || billingFailure ? 'failed' : 'review_required', error_code: safeError(error) });
      if (knownRejection) row = await refund(row);
      return publicRequest(row);
    }
  }
  function safeError(error) {
    return /^process_online_[a-z_]{1,60}$/.test(error?.code || '') ? error.code : 'process_online_unavailable';
  }

  async function privateRoot() {
    await mkdir(root(), { recursive: true, mode: 0o700 });
    const info = await lstat(root());
    requireValue(info.isDirectory() && !info.isSymbolicLink() && resolve(await realpath(root())) === root(), 'storage_unavailable', 'O armazenamento privado está indisponível.', 503);
    return root();
  }
  async function downloadParts(row) {
    const manifest = await provider.getDownload({ requestId: row.provider_request_id });
    requireValue(manifest?.request_id === row.provider_request_id && Number.isSafeInteger(manifest.parts_count)
      && manifest.parts_count >= 1 && manifest.parts_count <= MAX_PARTS && Array.isArray(manifest.parts) && manifest.parts.length === manifest.parts_count, 'invalid_download');
    const parts = [...manifest.parts].sort((a, b) => a.idx - b.idx);
    let declared = 0;
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index];
      requireValue(part.idx === index + 1 && Number.isSafeInteger(part.bytes) && part.bytes >= 5 && part.bytes <= MAX_PART_BYTES, 'invalid_download');
      if (!(row.mode === 'test' && Buffer.isBuffer(part.testPdf))) downloadUrl(part.url);
      declared += part.bytes;
    }
    requireValue(declared <= MAX_TOTAL_BYTES, 'download_too_large');
    const location = await privateRoot(), files = [], written = [];
    try {
      for (const part of parts) {
        const storageName = `${randomUUID()}.pdf`, target = join(location, storageName);
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 120000);
        let handle, response;
        try {
          response = row.mode === 'test' && Buffer.isBuffer(part.testPdf)
            ? new Response(part.testPdf, { headers: { 'Content-Length': String(part.bytes) } })
            : await fetchImpl(downloadUrl(part.url), { method: 'GET', redirect: 'error', signal: controller.signal, headers: { Accept: 'application/pdf' } });
          requireValue(response?.ok && !response.redirected && (!response.url || downloadUrl(response.url) === downloadUrl(part.url)), 'invalid_download');
          const length = response.headers.get('content-length');
          requireValue(length == null || (/^\d+$/.test(length) && Number(length) === part.bytes), 'invalid_download');
          handle = await open(target, 'wx', 0o600); written.push(target);
          let bytes = 0, prefix = Buffer.alloc(0);
          const digest = createHash('sha256');
          for await (const raw of response.body || []) {
            const chunk = Buffer.from(raw); bytes += chunk.length;
            requireValue(bytes <= part.bytes && bytes <= MAX_PART_BYTES, 'download_too_large');
            if (prefix.length < 5) prefix = Buffer.concat([prefix, chunk.subarray(0, 5 - prefix.length)]);
            if (prefix.length === 5) requireValue(prefix.toString('ascii') === '%PDF-', 'invalid_pdf');
            digest.update(chunk); await handle.writeFile(chunk);
          }
          requireValue(bytes === part.bytes && prefix.toString('ascii') === '%PDF-', 'invalid_pdf');
          await handle.sync();
          files.push({ index: part.idx, bytes, storageName, sha256: digest.digest('hex') });
        } catch (error) {
          await response?.body?.cancel().catch(() => {});
          throw error;
        } finally {
          clearTimeout(timer); await handle?.close();
        }
      }
      return files;
    } catch (error) {
      await Promise.all(written.map(path => unlink(path).catch(() => {})));
      throw error;
    }
  }
  async function discardParts(parts, keep = []) {
    const retained = new Set(keep.map(part => part.storageName));
    for (const part of parts || []) {
      if (typeof part.storageName !== 'string' || !UUID.test(part.storageName.slice(0, -4)) || !part.storageName.endsWith('.pdf')
        || basename(part.storageName) !== part.storageName || retained.has(part.storageName)) continue;
      await unlink(join(root(), part.storageName)).catch(() => {});
    }
  }
  async function reconcile(row, { force = false } = {}) {
    if (row.kind !== 'copy' || !row.provider_request_id) return publicRequest(row);
    const claimId = randomUUID();
    const claim = await db().query(`UPDATE audita_process_online_requests SET refresh_claim=$4,claim_until=$5,next_refresh_at=$6
      WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND (refresh_claim IS NULL OR claim_until<$7)
      AND ($8::boolean OR next_refresh_at IS NULL OR next_refresh_at<=$7) RETURNING *`,
    [row.id, row.tenant_id, row.user_id, claimId, new Date(now() + 60 * 60 * 1000).toISOString(), new Date(now() + 15000).toISOString(), stamp(), force]);
    if (!claim.rows[0]) return publicRequest((await db().query('SELECT * FROM audita_process_online_requests WHERE id=$1 AND tenant_id=$2 AND user_id=$3', [row.id, row.tenant_id, row.user_id])).rows[0]);
    row = claim.rows[0];
    let files;
    try {
      const result = await provider.getRequest({ requestId: row.provider_request_id });
      requireValue(result?.request_id === row.provider_request_id && ['processing', 'completed', ...TERMINAL_FAILURES].includes(result.status)
        && typeof result.refunded === 'boolean' && [0, 1].includes(result.credits_charged), 'invalid_response');
      const payload = decrypt(row);
      requireValue(!result.cnj || cnj(result.cnj) === payload.input.cnj, 'invalid_response');
      payload.providerCreditsCharged = result.credits_charged;
      payload.providerStatus = result.status;
      if (result.status === 'completed') {
        const previousParts = payload.parts || [];
        if (row.status !== 'ready' || !payload.parts?.length) {
          files = await downloadParts(row);
          payload.parts = files;
        }
        row = await update(row, { status: 'ready', error_code: null }, payload);
        files = null;
        await discardParts(previousParts, payload.parts);
      } else if (result.status === 'expired' && row.status === 'ready' && await intactParts(row, payload)) {
        // Remote retention expiring does not revoke an already received, verified private copy.
        row = await update(row, { status: 'ready', error_code: null }, payload);
      } else row = await update(row, { status: result.status, error_code: null }, payload);
      if (result.refunded || (TERMINAL_FAILURES.includes(result.status) && result.credits_charged === 0) || row.billing_state === 'refund_pending') row = await refund(row);
    } catch (error) {
      if (files) await Promise.all(files.map(file => unlink(join(root(), file.storageName)).catch(() => {})));
      if (error?.code === 'process_online_expired' && row.status === 'ready') {
        const payload = decrypt(row), intact = await intactParts(row, payload);
        payload.providerStatus = 'expired';
        row = await update(row, { status: intact ? 'ready' : 'expired', error_code: intact ? null : 'process_online_expired' }, payload);
      } else row = await update(row, { status: 'review_required', error_code: safeError(error) });
    } finally {
      await db().query('UPDATE audita_process_online_requests SET refresh_claim=NULL,claim_until=NULL WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND refresh_claim=$4', [row.id, row.tenant_id, row.user_id, claimId]);
    }
    return publicRequest(row);
  }
  async function intactParts(row, payload) {
    if (!Array.isArray(payload.parts) || !payload.parts.length || payload.parts.length > MAX_PARTS) return false;
    try {
      for (const part of payload.parts) {
        if (!/^[a-f0-9]{64}$/.test(part.sha256 || '')) return false;
        const stored = await file(authFor(row), row.id, part.index), digest = createHash('sha256');
        for await (const chunk of createReadStream(stored.path)) digest.update(chunk);
        if (digest.digest('hex') !== part.sha256) return false;
      }
      return true;
    } catch { return false; }
  }
  async function get(auth, id) { return publicRequest(await owned(auth, id)); }
  async function list(auth) {
    authenticated(auth);
    const rows = (await db().query('SELECT * FROM audita_process_online_requests WHERE tenant_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 100', [auth.tenantId, auth.user.id])).rows;
    return { requests: rows.map(publicRequest) };
  }
  async function refresh(auth, id) {
    let row = await owned(auth, id);
    configured();
    requireValue(row.mode === providerStatus().mode, 'mode_mismatch', 'Este pedido pertence a outro ambiente do provedor.', 409);
    if (row.billing_state === 'refund_pending') {
      row = await refund(row);
      if (row.kind === 'search' || !row.provider_request_id) return publicRequest(row);
    }
    return reconcile(row);
  }
  async function recover(auth, id, body = {}) {
    const row = await owned(auth, id);
    requireValue(body && typeof body === 'object' && !Array.isArray(body) && body.consent === true && [0, 1].includes(body.approvedCredits),
      'cost_approval_required', 'Confirme a finalidade e a autorização antes de continuar.');
    requireValue(publicRequest(row).canRecover, 'recovery_unavailable', 'Este pedido não permite recuperação da operação paga.', 409);
    // Browser input cannot change the persisted subject, purpose, parent or operation id.
    return perform(auth, 'copy', { ...decrypt(row).input, recover: true });
  }
  async function file(auth, id, partIndex) {
    const row = await owned(auth, id);
    requireValue(row.status === 'ready', 'not_ready', 'A cópia completa ainda não está disponível.', 409);
    const index = typeof partIndex === 'number' ? partIndex : /^[1-9]\d{0,2}$/.test(String(partIndex)) ? Number(partIndex) : NaN;
    requireValue(Number.isInteger(index) && index >= 1 && index <= MAX_PARTS, 'file_not_found', 'Arquivo não encontrado.', 404);
    const payload = decrypt(row), part = payload.parts?.find(candidate => candidate.index === index);
    requireValue(part && /^[0-9a-f-]{36}\.pdf$/.test(part.storageName) && UUID.test(part.storageName.slice(0, -4)) && basename(part.storageName) === part.storageName,
      'file_not_found', 'Arquivo não encontrado.', 404);
    const location = await privateRoot(), path = join(location, part.storageName);
    let info, actual;
    try { info = await lstat(path); actual = await realpath(path); } catch { throw problem('file_not_found', 'Arquivo não encontrado.', 404); }
    requireValue(info.isFile() && !info.isSymbolicLink() && info.size === part.bytes && dirname(resolve(actual)) === location && resolve(actual) === path,
      'file_not_found', 'Arquivo não encontrado.', 404);
    return { path, fileName: `processo-${payload.input.cnj}-parte-${index}.pdf`, bytes: part.bytes };
  }
  async function filesForAnalysis(auth, id) {
    const row = await owned(auth, id), payload = decrypt(row);
    requireValue(row.kind === 'copy' && row.status === 'ready' && payload.parts?.length, 'not_ready', 'Aguarde a cópia completa antes da análise.', 409);
    const files = [];
    for (const part of payload.parts) files.push(await file(auth, id, part.index));
    return { files, context: { provider: 'ProcessOnline', requestId: id, cnj: payload.input.cnj, sourceKind: 'court_case_copy' } };
  }
  async function webhook(rawBody, signature) {
    requireValue(verifyProcessOnlineWebhook(rawBody, signature, env.PROCESS_ONLINE_WEBHOOK_SECRET, now()), 'invalid_webhook_signature', 'Assinatura do evento inválida.', 400);
    let event;
    try { event = JSON.parse(rawBody.toString()); } catch { throw problem('invalid_webhook'); }
    requireValue(event && typeof event === 'object' && !Array.isArray(event) && typeof event.event === 'string' && event.event.length <= 80, 'invalid_webhook');
    if (event.event === 'webhook.test') return { accepted: true, test: true };
    if (!EVENTS.includes(event.event)) return { accepted: true, ignored: true };
    requireValue(typeof event.request_id === 'string' && UUID.test(event.request_id), 'invalid_webhook');
    configured();
    const row = (await db().query('SELECT * FROM audita_process_online_requests WHERE provider_request_id=$1', [event.request_id])).rows[0];
    if (!row) return { accepted: true, ignored: true };
    requireValue(row.mode === providerStatus().mode, 'mode_mismatch', 'O evento pertence a outro ambiente.', 409);
    const inserted = await db().query('INSERT INTO audita_process_online_events(request_id,event) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING request_id', [row.id, event.event]);
    if (!inserted.rows.length) {
      const saved = (await db().query('SELECT completed_at FROM audita_process_online_events WHERE request_id=$1 AND event=$2', [row.id, event.event])).rows[0];
      if (saved?.completed_at && row.status !== 'review_required') return { accepted: true, duplicate: true };
    }
    const result = await reconcile(row, { force: true });
    if (!['review_required', 'submitting'].includes(result.status)) await db().query(`UPDATE audita_process_online_events SET completed_at=$3 WHERE request_id=$1 AND event=$2
      AND NOT EXISTS(SELECT 1 FROM audita_process_online_requests WHERE id=$1 AND refresh_claim IS NOT NULL)`, [row.id, event.event, stamp()]);
    return { accepted: true, duplicate: !inserted.rows.length };
  }
  return { getStatus, verify, search: (auth, body) => perform(auth, 'search', body), requestCopy: (auth, body) => perform(auth, 'copy', body), list, get, refresh, recover, file, filesForAnalysis, webhook };
}
