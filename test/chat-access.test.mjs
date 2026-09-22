import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createChatAccessService } from '../services/chat-access.service.mjs';
import { CHAT_PLANS } from '../services/billing-catalog.service.mjs';

const auth = { tenantId: '1', user: { id: '1' } };
const other = { tenantId: '2', user: { id: '2' } };
const migration = await readFile(new URL('../db/migrations/20260922-chat-access.sql', import.meta.url), 'utf8');
const invoice = (extra = {}) => ({ tenantId: '1', userId: '1', planId: 'chat-essential',
  periodStart: '2026-09-01T00:00:00Z', periodEnd: '2026-10-01T00:00:00Z',
  paymentId: 'invoice-1', subscriptionId: 'subscription-1', ...extra });

async function fixture(t, options = {}) {
  const pg = new PGlite();
  t.after(() => pg.close());
  await pg.exec(`CREATE TABLE audita_tenants(id BIGINT PRIMARY KEY);
    CREATE TABLE audita_users(id BIGINT PRIMARY KEY,tenant_id BIGINT);
    INSERT INTO audita_tenants VALUES(1),(2);
    INSERT INTO audita_users VALUES(1,1),(2,2),(3,1);`);
  await pg.exec(migration);
  await pg.exec(migration);
  // PGlite has one connection: lease it for the whole transaction, like pg.Pool.
  let tail = Promise.resolve();
  const pool = { connect: async () => {
    const previous = tail;
    let release;
    tail = new Promise(resolve => { release = resolve; });
    await previous;
    return { query: (...args) => pg.query(...args), release };
  } };
  let clock = '2026-09-10T00:00:00Z';
  const config = { getDb: () => ({ pool, dbReady: true }), now: () => new Date(clock), ...options };
  return { pg, service: createChatAccessService(config), make: () => createChatAccessService(config),
    setTime: value => { clock = value; } };
}

test('paid plans, invoice idempotency, nonoverlap and current half-open period', async t => {
  const { service: s, setTime } = await fixture(t);
  assert.deepEqual(Object.fromEntries(CHAT_PLANS.map(({ id, messages, pages }) => [id, { messages, pages }])), {
    'chat-experiment': { messages: 20, pages: 5 }, 'chat-essential': { messages: 100, pages: 20 },
    'chat-professional': { messages: 300, pages: 80 }, 'chat-premium': { messages: 700, pages: 200 },
  });
  assert.equal((await s.getAccess(auth)).allowed, false);
  const first = await s.grantPaidAccess(invoice());
  assert.equal((await s.grantPaidAccess(invoice())).id, first.id);
  assert.equal((await s.grantPaidAccess(invoice())).duplicate, true);
  await assert.rejects(s.grantPaidAccess(invoice({ planId: 'chat-premium' })), { code: 'chat_payment_conflict' });
  await assert.rejects(s.grantPaidAccess(invoice({ paymentId: 'overlap' })), { code: 'chat_period_overlap' });
  await s.grantPaidAccess(invoice({ paymentId: 'next', planId: 'chat-premium', periodStart: '2026-10-01', periodEnd: '2026-11-01' }));
  assert.equal((await s.getAccess(auth)).planId, 'chat-essential');
  assert.deepEqual((await s.getAccess(auth)).limits, { messages: CHAT_PLANS[1].messages, pages: CHAT_PLANS[1].pages });
  assert.equal((await s.getAccess(auth)).active, true);
  setTime('2026-10-01');
  assert.equal((await s.getAccess(auth)).planId, 'chat-premium');
  setTime('2026-11-01');
  assert.equal((await s.getAccess(auth)).allowed, false);
  setTime('2026-08-31');
  assert.equal((await s.getAccess(auth)).allowed, false);
});

test('concurrent quota and retry accounting persist across service instances', async t => {
  const { service: s, make, pg } = await fixture(t);
  await s.grantPaidAccess(invoice());
  const attempts = await Promise.allSettled(Array.from({ length: 25 }, (_, n) =>
    (n % 2 ? s : make()).reserve(auth, { requestId: `page-${n}`, kind: 'pages', quantity: 1 })));
  assert.equal(attempts.filter(r => r.status === 'fulfilled').length, 20);
  assert.equal(attempts.filter(r => r.reason?.code === 'chat_quota_exceeded').length, 5);
  assert.equal((await s.getAccess(auth)).remaining.pages, 0);
  const original = await s.reserve(auth, { requestId: 'message', kind: 'messages' });
  assert.equal(original.duplicate, false);
  const retries = await Promise.all(Array.from({ length: 8 }, () => make().reserve(auth, { requestId: 'message', kind: 'messages' })));
  assert.ok(retries.every(r => r.duplicate && r.status === 'reserved'));
  await assert.rejects(s.reserve(auth, { requestId: 'message', kind: 'pages' }), { code: 'chat_request_conflict' });
  const result = { answer: 'Synthetic test result', nested: [1, true] };
  await s.complete(auth, { requestId: 'message', result });
  assert.deepEqual((await make().reserve(auth, { requestId: 'message', kind: 'messages' })).result, result);
  assert.deepEqual((await s.complete(auth, { requestId: 'message', result: 'replacement' })).result, result);
  await assert.rejects(s.release(auth, { requestId: 'message' }), { code: 'chat_reservation_finalized' });
  await s.release(auth, { requestId: 'page-0' });
  assert.equal((await s.release(auth, { requestId: 'page-0' })).duplicate, true);
  assert.equal((await s.getAccess(auth)).remaining.pages, 1);
  await assert.rejects(s.reserve(auth, { requestId: 'page-0', kind: 'pages' }), { code: 'chat_reservation_finalized', statusCode: 409 });
  assert.equal((await s.getAccess(auth)).remaining.pages, 1);
  await assert.rejects(s.complete(auth, { requestId: 'page-0', result: {} }), { code: 'chat_reservation_finalized' });
  assert.equal((await s.getAccess(auth)).used.messages, 1);
  const saved = await pg.dumpDataDir();
  const reopened = new PGlite({ loadDataDir: saved });
  try {
    const restored = createChatAccessService({ getDb: () => ({ dbReady: true,
      pool: { connect: async () => ({ query: (...a) => reopened.query(...a), release() {} }) } }) });
    assert.deepEqual((await restored.reserve(auth, { requestId: 'message', kind: 'messages' })).result, result);
  } finally { await reopened.close(); }
});

test('experiment is once per customer for 30 days, including paid invoice retries', async t => {
  const { service: s, setTime } = await fixture(t);
  assert.equal((await s.getAccess(auth)).trialAvailable, true);
  const start = '2026-09-01', end = '2026-10-01';
  const input = invoice({ planId: 'chat-experiment', periodStart: start, periodEnd: end });
  await assert.rejects(s.grantPaidAccess({ ...input, periodEnd: '2026-10-02' }), { code: 'chat_trial_requires_30_days' });
  const grants = await Promise.all([s.grantPaidAccess(input), s.grantPaidAccess(input)]);
  assert.equal(grants[0].id, grants[1].id);
  assert.equal(grants[1].duplicate, true);
  assert.equal((await s.getAccess(auth)).trialUsed, true);
  assert.equal((await s.getAccess(auth)).trialAvailable, false);
  assert.equal((await s.getAccess(auth)).remaining.messages, 20);
  await s.revokePayment({ tenantId: '1', userId: '1', paymentId: 'invoice-1' });
  await assert.rejects(s.grantPaidAccess({ ...input, paymentId: 'second-trial' }), { code: 'chat_trial_already_used' });
  assert.equal(s.grantTrial, undefined);
  await assert.rejects(s.grantPaidAccess({ ...input, paymentId: null }), { code: 'chat_invalid_identifier' });
  const otherInput = { ...input, tenantId: '2', userId: '2', paymentId: 'other-experiment' };
  const trial = await s.grantPaidAccess(otherInput);
  setTime('2026-10-11');
  assert.equal((await s.grantPaidAccess(otherInput)).id, trial.id);
  assert.equal((await s.getAccess(other)).allowed, false);
  assert.equal((await s.getAccess(other)).trialAvailable, false);
});

test('revocations survive event reordering and cannot resurrect grants or cached work', async t => {
  const { service: s } = await fixture(t);
  await s.grantPaidAccess(invoice());
  await s.reserve(auth, { requestId: 'done', kind: 'messages' });
  await s.complete(auth, { requestId: 'done', result: 'cached' });
  await s.revokeSubscription({ tenantId: '1', userId: '1', subscriptionId: 'subscription-1' });
  assert.equal((await s.getAccess(auth)).allowed, false);
  assert.equal((await s.grantPaidAccess(invoice())).revoked, true);
  assert.equal((await s.reserve(auth, { requestId: 'done', kind: 'messages' })).result, 'cached');
  await assert.rejects(s.reserve(auth, { requestId: 'new', kind: 'messages' }), { code: 'chat_access_required' });
  await assert.rejects(s.grantPaidAccess(invoice({ paymentId: 'late-invoice' })), { code: 'chat_access_revoked' });
  await s.revokePayment({ tenantId: '2', userId: '2', paymentId: 'refund-first' });
  await assert.rejects(s.grantPaidAccess(invoice({ tenantId: '2', userId: '2', paymentId: 'refund-first' })), { code: 'chat_access_revoked' });
});

test('legacy is explicit, bounded and recorded; owner isolation and validation fail closed', async t => {
  const { service: s, pg } = await fixture(t, { getLegacyAccess: async a => a.user.id === '1' });
  const access = await s.getAccess(auth);
  assert.equal(access.source, 'legacy');
  assert.equal(access.active, false);
  assert.equal(access.limits, null);
  await s.reserve(auth, { requestId: 'legacy', kind: 'pages', quantity: 200 });
  assert.equal((await pg.query('SELECT COUNT(*) AS n FROM audita_chat_reservations')).rows[0].n, 1);
  await assert.rejects(s.reserve(auth, { requestId: 'too-big', kind: 'pages', quantity: 201 }), { code: 'chat_invalid_quantity' });
  for (const quantity of [0, -1, 1.5, NaN, '1']) await assert.rejects(s.reserve(auth, { requestId: 'bad', kind: 'messages', quantity }), { code: 'chat_invalid_quantity' });
  await assert.rejects(s.reserve(auth, { requestId: '', kind: 'messages' }), { code: 'chat_invalid_identifier' });
  await assert.rejects(s.reserve(auth, { requestId: 'bad', kind: 'tokens' }), { code: 'chat_invalid_kind' });
  await assert.rejects(s.complete(other, { requestId: 'legacy' }), { code: 'chat_reservation_not_found' });
  await assert.rejects(s.getAccess({ tenantId: '2', user: { id: '1' } }), { code: 'chat_unauthorized' });
  await assert.rejects(s.getAccess({}), { code: 'chat_unauthorized' });
  await assert.rejects(s.reserve(other, { requestId: 'legacy', kind: 'messages' }), { code: 'chat_access_required' });
  await s.complete(auth, { requestId: 'legacy', result: null });
  const unavailable = createChatAccessService({ getLegacyAccess: async () => true });
  await assert.rejects(unavailable.getAccess(auth), { code: 'chat_database_unavailable', statusCode: 503 });
  await assert.rejects(unavailable.reserve(auth, { requestId: 'no-db', kind: 'messages' }), { code: 'chat_database_unavailable' });
});

test('legacy callback queries the held transaction connection with a single-connection pool', { timeout: 10000 }, async t => {
  let callbacks = 0;
  const { service: s } = await fixture(t, { getLegacyAccess: async (a, db) => {
    assert.equal(a, auth);
    assert.equal(typeof db?.query, 'function');
    assert.equal(typeof db?.release, 'function');
    const { rows } = await db.query('SELECT trial_used FROM audita_chat_accounts WHERE tenant_id=$1 AND user_id=$2',
      [a.tenantId, a.user.id]);
    assert.equal(rows.length, 1);
    callbacks++;
    return true;
  } });
  const [access, held] = await Promise.all([
    s.getAccess(auth), s.reserve(auth, { requestId: 'legacy-single-connection', kind: 'messages' }),
  ]);
  assert.equal(access.source, 'legacy');
  assert.equal(held.status, 'reserved');
  assert.equal(callbacks, 2);
});

test('billing races, rollback, isolated invoice ownership and terminal reservation races', async t => {
  const { service: s, pg, make } = await fixture(t);
  const grants = await Promise.allSettled([
    s.grantPaidAccess(invoice()), make().grantPaidAccess(invoice({ paymentId: 'racing-invoice' })),
  ]);
  assert.equal(grants.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(grants.find(r => r.status === 'rejected').reason.code, 'chat_period_overlap');
  assert.equal((await pg.query('SELECT COUNT(*) AS n FROM audita_chat_entitlements')).rows[0].n, 1);
  await assert.rejects(s.grantPaidAccess(invoice({ tenantId: '2', userId: '2' })), { code: 'chat_payment_conflict' });
  await s.reserve(auth, { requestId: 'race', kind: 'messages' });
  const outcomes = await Promise.allSettled([
    s.complete(auth, { requestId: 'race', result: 'done' }), make().release(auth, { requestId: 'race' }),
  ]);
  assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find(r => r.status === 'rejected').reason.code, 'chat_reservation_finalized');
  await s.reserve(auth, { requestId: 'serialization', kind: 'messages' });
  const circular = {}; circular.self = circular;
  await assert.rejects(s.complete(auth, { requestId: 'serialization', result: circular }), { code: 'chat_invalid_result' });
  await assert.rejects(s.complete(auth, { requestId: 'serialization', result: 'x'.repeat(1024 * 1024) }), { code: 'chat_invalid_result' });
  assert.equal((await s.reserve(auth, { requestId: 'serialization', kind: 'messages' })).status, 'reserved');
  await s.release(auth, { requestId: 'serialization' });
  assert.equal((await s.getAccess(auth)).used.messages, 1);
  await assert.rejects(s.getAccess({ tenantId: 1, user: { id: Number.MAX_SAFE_INTEGER + 1 } }), { code: 'chat_unauthorized' });
});

test('stale reservations survive restart and age until explicit reconciliation', async t => {
  const { service: s, make, setTime } = await fixture(t);
  await s.grantPaidAccess(invoice());
  await s.reserve(auth, { requestId: 'crashed-worker', kind: 'messages' });
  setTime('2027-01-01');
  const retried = await make().reserve(auth, { requestId: 'crashed-worker', kind: 'messages' });
  assert.equal(retried.status, 'reserved');
  assert.equal(retried.duplicate, true);
  await make().complete(auth, { requestId: 'crashed-worker', result: 'Recovered durable result' });
  assert.equal((await s.reserve(auth, { requestId: 'crashed-worker', kind: 'messages' })).result, 'Recovered durable result');
});
