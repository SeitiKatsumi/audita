import { CHAT_PLANS } from './billing-catalog.service.mjs';

const LIMITS = Object.freeze(Object.fromEntries(CHAT_PLANS.map(({ id, messages, pages }) =>
  [id, Object.freeze({ messages, pages })])));

const DAY = 86400000;
function check(ok, code, statusCode = 400) {
  if (!ok) throw Object.assign(new Error(code), { code, statusCode, status: statusCode });
}
function identifier(value) {
  check(typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 255 && !value.includes('\0'), 'chat_invalid_identifier');
  return value;
}
function owner(tenantId, userId) {
  check([tenantId, userId].every(v => typeof v !== 'number' || Number.isSafeInteger(v)), 'chat_unauthorized', 401);
  const ids = [tenantId, userId].map(v => String(v ?? ''));
  check(ids.every(v => /^[1-9]\d{0,18}$/.test(v) && BigInt(v) <= 9223372036854775807n), 'chat_unauthorized', 401);
  return ids;
}
function signed(auth) { return owner(auth?.tenantId, auth?.user?.id); }
function instant(value) {
  check(value !== null && value !== undefined && value !== '', 'chat_invalid_period');
  const date = new Date(value);
  check(Number.isFinite(date.getTime()), 'chat_invalid_period');
  return date;
}
function entitlement(row) {
  return { id: String(row.id), planId: row.plan_id, periodStart: new Date(row.period_start).toISOString(),
    periodEnd: new Date(row.period_end).toISOString(), paymentId: row.payment_id,
    subscriptionId: row.subscription_id, revoked: Boolean(row.revoked_at) };
}
function reservation(row, duplicate = false) {
  return { requestId: row.request_id, status: row.status, kind: row.kind, quantity: row.quantity,
    entitlementId: row.entitlement_id == null ? null : String(row.entitlement_id), duplicate, result: row.result };
}

// Grant/revoke methods are trusted billing primitives, not public HTTP handlers.
export function createChatAccessService({ getDb, now = () => new Date(), getLegacyAccess = async () => false,
  maxReservationQuantity = { messages: 1, pages: 200 } } = {}) {
  const bounds = { ...maxReservationQuantity };
  for (const kind of ['messages', 'pages']) check(Number.isSafeInteger(bounds[kind]) && bounds[kind] > 0 && bounds[kind] <= 2147483647, 'chat_invalid_bounds');

  async function transaction(ids, fn) {
    const state = await getDb?.();
    check(state?.dbReady && state.pool?.connect, 'chat_database_unavailable', 503);
    const db = await state.pool.connect();
    try {
      await db.query('BEGIN');
      check((await db.query('SELECT id FROM audita_users WHERE tenant_id=$1 AND id=$2', ids)).rows.length, 'chat_unauthorized', 401);
      await db.query('INSERT INTO audita_chat_accounts(tenant_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', ids);
      // One database row lock serializes all quota and billing changes for this customer.
      const account = (await db.query('SELECT * FROM audita_chat_accounts WHERE tenant_id=$1 AND user_id=$2 FOR UPDATE', ids)).rows[0];
      const value = await fn(db, account);
      await db.query('COMMIT');
      return value;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally { db.release(); }
  }

  async function current(db, ids) {
    return (await db.query(`SELECT * FROM audita_chat_entitlements WHERE tenant_id=$1 AND user_id=$2
      AND revoked_at IS NULL AND period_start <= $3 AND period_end > $3 ORDER BY period_start DESC LIMIT 1`, [...ids, instant(now())])).rows[0];
  }
  async function usage(db, ids, id) {
    const used = { messages: 0, pages: 0 };
    const rows = (await db.query(`SELECT kind, SUM(quantity) AS total FROM audita_chat_reservations
      WHERE tenant_id=$1 AND user_id=$2 AND entitlement_id=$3 AND status <> 'released' GROUP BY kind`, [...ids, id])).rows;
    for (const row of rows) used[row.kind] = Number(row.total);
    return used;
  }
  async function access(db, ids, auth) {
    const row = await current(db, ids);
    if (row) {
      const used = await usage(db, ids, row.id), limits = LIMITS[row.plan_id];
      return { allowed: true, active: true, source: 'entitlement', ...entitlement(row), limits, used,
        remaining: { messages: limits.messages - used.messages, pages: limits.pages - used.pages } };
    }
    const legacy = await getLegacyAccess(auth, db) === true;
    return { allowed: legacy, active: false, source: legacy ? 'legacy' : 'none', planId: legacy ? 'standard' : null,
      limits: null, used: null, remaining: null };
  }

  async function insertGrant(db, ids, account, input) {
    const { planId, paymentId = null, subscriptionId = null } = input;
    check(Object.hasOwn(LIMITS, planId), 'chat_invalid_plan');
    const start = instant(input.periodStart), end = instant(input.periodEnd);
    check(end > start, 'chat_invalid_period');
    if (planId === 'chat-experiment') check(end - start === 30 * DAY, 'chat_trial_requires_30_days');
    if (paymentId !== null) identifier(paymentId);
    if (subscriptionId !== null) identifier(subscriptionId);
    if (paymentId) {
      const existing = (await db.query('SELECT * FROM audita_chat_entitlements WHERE payment_id=$1', [paymentId])).rows[0];
      if (existing) {
        check(String(existing.tenant_id) === ids[0] && String(existing.user_id) === ids[1]
          && existing.plan_id === planId && +new Date(existing.period_start) === +start
          && +new Date(existing.period_end) === +end && existing.subscription_id === subscriptionId, 'chat_payment_conflict', 409);
        return { ...entitlement(existing), duplicate: true };
      }
    }
    const revoked = await db.query(`SELECT 1 FROM audita_chat_revocations WHERE tenant_id=$1 AND user_id=$2
      AND ((kind='payment' AND reference_id=$3) OR (kind='subscription' AND reference_id=$4))`, [...ids, paymentId, subscriptionId]);
    check(!revoked.rows.length, 'chat_access_revoked', 403);
    if (planId === 'chat-experiment') check(!account.trial_used, 'chat_trial_already_used', 409);
    const overlap = await db.query(`SELECT 1 FROM audita_chat_entitlements WHERE tenant_id=$1 AND user_id=$2
      AND revoked_at IS NULL AND period_start < $4 AND period_end > $3`, [...ids, start, end]);
    check(!overlap.rows.length, 'chat_period_overlap', 409);
    const row = (await db.query(`INSERT INTO audita_chat_entitlements
      (tenant_id,user_id,plan_id,period_start,period_end,payment_id,subscription_id)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [...ids, planId, start, end, paymentId, subscriptionId])).rows[0];
    if (planId === 'chat-experiment') await db.query('UPDATE audita_chat_accounts SET trial_used=true WHERE tenant_id=$1 AND user_id=$2', ids);
    return { ...entitlement(row), duplicate: false };
  }

  async function grantPaidAccess(input) {
    const ids = owner(input?.tenantId, input?.userId);
    identifier(input.paymentId);
    return transaction(ids, (db, account) => insertGrant(db, ids, account, input));
  }
  async function getAccess(auth) {
    const ids = signed(auth);
    return transaction(ids, async (db, account) => ({ ...await access(db, ids, auth),
      trialUsed: account.trial_used, trialAvailable: !account.trial_used }));
  }
  async function reserve(auth, { requestId, kind, quantity = 1 } = {}) {
    const ids = signed(auth);
    identifier(requestId);
    check(['messages', 'pages'].includes(kind), 'chat_invalid_kind');
    check(Number.isSafeInteger(quantity) && quantity > 0 && quantity <= bounds[kind], 'chat_invalid_quantity');
    return transaction(ids, async db => {
      const previous = (await db.query('SELECT * FROM audita_chat_reservations WHERE tenant_id=$1 AND user_id=$2 AND request_id=$3', [...ids, requestId])).rows[0];
      if (previous) {
        check(previous.kind === kind && previous.quantity === quantity, 'chat_request_conflict', 409);
        check(previous.status !== 'released', 'chat_reservation_finalized', 409);
        return reservation(previous, true);
      }
      const allowed = await access(db, ids, auth);
      check(allowed.allowed, 'chat_access_required', 403);
      check(!allowed.remaining || quantity <= allowed.remaining[kind], 'chat_quota_exceeded', 429);
      const row = (await db.query(`INSERT INTO audita_chat_reservations
        (tenant_id,user_id,request_id,entitlement_id,kind,quantity) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [...ids, requestId, allowed.id ?? null, kind, quantity])).rows[0];
      return reservation(row);
    });
  }
  // ponytail: no automatic reservation expiry; age cannot prove provider work stopped.
  // After a crash, reconcile by tenant/user/requestId with durable job/provider evidence:
  // complete with the recovered result, or release only after confirming no work remains
  // in flight and no successful result exists. Ambiguous outcomes stay reserved; never
  // blindly rerun them. Released IDs remain terminal; a new operation needs a new ID.
  async function finish(auth, { requestId, result = null } = {}, status) {
    const ids = signed(auth);
    identifier(requestId);
    let encoded;
    try { encoded = JSON.stringify(result); } catch { check(false, 'chat_invalid_result'); }
    check(encoded !== undefined && Buffer.byteLength(encoded) <= 1024 * 1024, 'chat_invalid_result');
    return transaction(ids, async db => {
      const row = (await db.query('SELECT * FROM audita_chat_reservations WHERE tenant_id=$1 AND user_id=$2 AND request_id=$3', [...ids, requestId])).rows[0];
      check(row, 'chat_reservation_not_found', 404);
      if (row.status === status) return reservation(row, true);
      check(row.status === 'reserved', 'chat_reservation_finalized', 409);
      return reservation((await db.query(`UPDATE audita_chat_reservations SET status=$4,result=$5::jsonb,updated_at=NOW()
        WHERE tenant_id=$1 AND user_id=$2 AND request_id=$3 RETURNING *`, [...ids, requestId, status, status === 'completed' ? encoded : null])).rows[0]);
    });
  }
  async function revoke(input, kind) {
    const ids = owner(input?.tenantId, input?.userId);
    const reference = identifier(kind === 'subscription' ? input.subscriptionId : input.paymentId);
    return transaction(ids, async db => {
      await db.query(`INSERT INTO audita_chat_revocations(tenant_id,user_id,kind,reference_id)
        VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [...ids, kind, reference]);
      const result = await db.query(`UPDATE audita_chat_entitlements SET revoked_at=COALESCE(revoked_at,$4)
        WHERE tenant_id=$1 AND user_id=$2 AND ${kind === 'subscription' ? 'subscription_id' : 'payment_id'}=$3 RETURNING id`, [...ids, reference, instant(now())]);
      return { revoked: result.rows.length };
    });
  }
  return { grantPaidAccess, getAccess, reserve,
    complete: (auth, input) => finish(auth, input, 'completed'),
    release: (auth, input) => finish(auth, input, 'released'),
    revokeSubscription: input => revoke(input, 'subscription'), revokePayment: input => revoke(input, 'payment') };
}
