import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { readFile, unlink, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createProcessOnlineService } from '../services/process-online.service.mjs';
import { createProcessOnlineWorkflowService } from '../services/process-online-workflow.service.mjs';
import { getPdfRoot } from '../services/storage.service.mjs';
import { openIr, irKey } from '../services/ir-exemption-domain.mjs';

const CNJ = '50624045620248130702', DOCUMENT = '52998224725';
const AUTH = { tenantId: 1, user: { id: 11 } };
const KEY = 'fictitious-process-online-profile-key-with-thirty-two-characters';
const PDF = Buffer.from('%PDF-1.7\nFictitious process document\n%%EOF\n');
const SECRET = 'fictitious-webhook-secret';
const input = (changes = {}) => ({ operationId: randomUUID(), cnj: CNJ, documento: DOCUMENT, consent: true, approvedCredits: 1, interesse: 'outro', ...changes });
const error = code => Object.assign(new Error('private provider data must never leak'), { code });

async function fixture(options = {}) {
  const pg = new PGlite();
  await pg.exec(`CREATE TABLE audita_tenants(id BIGINT PRIMARY KEY);
    CREATE TABLE audita_users(id BIGINT PRIMARY KEY,tenant_id BIGINT REFERENCES audita_tenants(id));
    CREATE TABLE audita_audits(id BIGINT PRIMARY KEY,public_id UUID,tenant_id BIGINT,requested_by_user_id BIGINT);
    INSERT INTO audita_tenants VALUES(1),(2);
    INSERT INTO audita_users VALUES(11,1),(12,1),(21,2);`);
  await pg.exec(await readFile(new URL('../db/process-online.sql', import.meta.url), 'utf8'));
  const state = { mode: options.mode || 'test', enabled: true, walletEnabled: true, balance: 10, debit: 0, refund: 0,
    calls: [], downloads: [], providerId: randomUUID(), resultStatus: 'processing', resultRefunded: false, charged: 1,
    resultSearch: { results: [{ numero_cnj: CNJ, tribunal: 'TJ Fictício', envolvidos: [{ nome: 'Pessoa Fictícia', polo: 'ativo' }] }], total: 1, credits_charged: 1 },
    parts: [PDF, PDF], ...options };
  const env = { AUDITA_PROFILE_ENCRYPTION_KEY: KEY, AUDITA_CREDITS_ENABLED: 'true', PROCESS_ONLINE_WEBHOOK_SECRET: SECRET };
  const consumed = new Set(), granted = new Set();
  const credits = {
    getWallet: async () => ({ enabled: state.walletEnabled, balance: state.balance, unlimited: state.unlimited || false }),
    consume: async (_auth, request) => {
      if (state.debitError) throw state.debitError;
      if (state.balance < 1) return { ok: false, state: 'insufficient', amount: 1 };
      if (!consumed.has(request.referenceId)) { state.debit++; state.balance--; consumed.add(request.referenceId); }
      return { ok: true, state: state.consumeState || 'consumed', amount: 1 };
    },
    grant: async (_auth, request) => {
      if (state.refundError) throw state.refundError;
      if (!granted.has(request.referenceId)) { state.refund++; state.balance++; granted.add(request.referenceId); }
      return { ok: true, state: 'granted', amount: 1 };
    },
  };
  const transportFetch = async (target, request) => {
    state.calls.push({ target, request });
    const endpoint = new URL(target).pathname.split('/').pop();
    if (state.delay && ['api-search-documento', 'api-create-request'].includes(endpoint)) await new Promise(resolve => setTimeout(resolve, state.delay));
    if (state.transportError && ['api-search-documento', 'api-create-request'].includes(endpoint)) throw state.transportError;
    if (state.rejectStatus && ['api-search-documento', 'api-create-request'].includes(endpoint)) return new Response('private', { status: state.rejectStatus });
    if (endpoint === 'api-verify') return Response.json({ cnj: CNJ, exists: true });
    if (endpoint === 'api-search-documento') return Response.json(state.resultSearch);
    if (endpoint === 'api-create-request') return Response.json({ request_id: state.providerId, status: state.copyStatus || 'processing', credits_charged: state.charged });
    const id = new URL(target).searchParams.get('id');
    if (endpoint === 'api-get-request') {
      if (state.getError) throw state.getError;
      if (state.requestHttpStatus) return new Response('private provider detail', { status: state.requestHttpStatus });
      return Response.json({ request_id: id, cnj: state.resultCnj || CNJ, status: state.resultStatus, credits_charged: state.charged, refunded: state.resultRefunded });
    }
    if (endpoint === 'api-download') {
      const parts = state.parts.map((bytes, index) => ({ idx: index + 1, bytes: bytes.length,
        url: `https://api.processonline.com.br/storage/v1/object/sign/private/${index + 1}.pdf?token=fictitious` }));
      return Response.json({ request_id: id, parts, parts_count: parts.length, download_url: parts[0]?.url,
        expires_in: 300, file_expires_at: '2027-01-01T00:00:00Z', ...state.manifestChanges });
    }
    assert.fail('Unexpected fake provider call');
  };
  const provider = createProcessOnlineService({ enabled: true, apiKey: `po_${state.mode}_fictitious`, fetchImpl: transportFetch });
  let tick = Date.parse('2026-10-19T12:00:00Z');
  const make = () => createProcessOnlineWorkflowService({ getDb: () => ({ pool: pg, dbReady: true }), provider, env, credits,
    now: () => tick, fetchImpl: async (target, request) => {
      state.downloads.push({ target, request });
      if (state.downloadError) throw state.downloadError;
      const index = Number(new URL(target).pathname.split('/').pop().split('.')[0]) - 1;
      const bytes = state.downloadParts?.[index] || state.parts[index];
      return state.downloadResponse || new Response(bytes, { headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(state.parts[index].length) } });
    } });
  const service = make();
  return { pg, state, service, make, env, advance: ms => { tick += ms; },
    signed: event => { const raw = Buffer.from(JSON.stringify(event)), time = Math.floor(tick / 1000);
      return [raw, `t=${time},v1=${createHmac('sha256', SECRET).update(`${time}.`).update(raw).digest('hex')}`]; },
    close: async () => {
      const rows = (await pg.query('SELECT * FROM audita_process_online_requests')).rows;
      for (const row of rows) {
        const payload = openIr(row.encrypted_payload, irKey(KEY), `process-online:${row.id}`);
        for (const part of payload.parts || []) await unlink(join(getPdfRoot(), part.storageName)).catch(() => {});
      }
      await pg.close();
    } };
}

test('workflow validates authentication, consent, identifiers and parent ownership before persistence or provider calls', async () => {
  const f = await fixture();
  try {
    for (const body of [input({ operationId: 'invalid' }), input({ consent: false }), input({ approvedCredits: -1 }), input({ documento: '11111111111' })]) {
      await assert.rejects(f.service.search(AUTH, body));
    }
    for (const body of [input({ cnj: '50624045520248130702' }), input({ interesse: 'unknown' }), input({ interesse: 'advogado', interesseDetalhe: 'invalid' }), input({ interesseDetalhe: '\n' })]) {
      await assert.rejects(f.service.requestCopy(AUTH, body));
    }
    await assert.rejects(f.service.requestCopy(null, input()), { status: 401 });
    const parent = randomUUID();
    await f.pg.query('INSERT INTO audita_audits VALUES(1,$1,1,12)', [parent]);
    await assert.rejects(f.service.requestCopy(AUTH, input({ parentAuditId: parent })), { status: 404 });
    assert.equal((await f.pg.query('SELECT count(*) AS n FROM audita_process_online_requests')).rows[0].n, 0);
    assert.equal(f.state.calls.length, 0);
    const verified = await f.service.verify(AUTH, { cnj: CNJ });
    assert.equal(verified.cnj, CNJ); assert.equal(verified.exists, true); assert.equal(verified.mode, 'test');
    assert.equal(verified.auditaCredits, 0); assert.equal(verified.providerCredits, 0); assert.equal(verified.resultData.cnj, CNJ);
    assert.equal(f.state.calls.length, 1);
    assert.equal(f.service.getStatus().ready, true);
  } finally { await f.close(); }
});

test('search is durably idempotent, encrypted, tenant/user isolated and preserves useful bounded pagination data', async () => {
  const f = await fixture({ delay: 25 });
  try {
    f.state.resultSearch = { ...f.state.resultSearch, total: 15, paginator: { page: 1, per_page: 1 }, involved: ['Pessoa Fictícia'], secret: 'omit',
      download_url: 'https://api.processonline.com.br/storage/v1/object/sign/x?token=private' };
    const body = input();
    const results = await Promise.all([f.service.search(AUTH, body), f.make().search(AUTH, body)]);
    assert.equal(f.state.calls.length, 1);
    const done = await f.make().get(AUTH, results[0].id);
    assert.equal(done.status, 'completed'); assert.equal(done.results.length, 1); assert.equal(done.total, 15); assert.equal(done.partialResults, true);
    assert.deepEqual(done.resultData.paginator, Object.assign(Object.create(null), { page: 1, per_page: 1 }));
    assert.equal(done.resultData.results[0].envolvidos[0].nome, 'Pessoa Fictícia');
    assert.equal(done.resultData.secret, undefined); assert.equal(done.resultData.download_url, undefined);
    assert.equal(f.state.debit, 0);
    for (const auth of [{ tenantId: 2, user: { id: 21 } }, { tenantId: 1, user: { id: 12 } }]) {
      await assert.rejects(f.service.get(auth, done.id), { status: 404 });
      assert.deepEqual(await f.service.list(auth), { requests: [] });
    }
    await assert.rejects(f.service.search(AUTH, { ...body, documento: '04252011000110' }), { status: 409 });
    const saved = (await f.pg.query('SELECT * FROM audita_process_online_requests')).rows[0];
    assert.equal(saved.encrypted_payload.includes(DOCUMENT), false);
    assert.equal(JSON.stringify(saved).includes(CNJ), false);
    assert.equal((await f.service.list(AUTH)).requests.length, 1);
    assert.equal(f.state.calls.length, 1);
  } finally { await f.close(); }
});

test('live wallet must be enabled; only a confirmed debit authorizes the external cost and empty results refund once', async () => {
  for (const invalid of [{ walletEnabled: false }, { unlimited: true }, { balance: 0 }, { consumeState: 'not_charged' }]) {
    const f = await fixture({ mode: 'live', ...invalid });
    try {
      const result = await f.service.search(AUTH, input());
      assert.equal(result.status, 'failed'); assert.equal(f.state.calls.length, 0);
    } finally { await f.close(); }
  }
  const f = await fixture({ mode: 'live', resultSearch: { results: [], total: 0, credits_charged: 0 } });
  try {
    const body = input(), first = await f.service.search(AUTH, body);
    assert.equal(first.status, 'completed'); assert.equal(first.billing.state, 'refunded');
    await f.make().search(AUTH, body); await f.make().refresh(AUTH, first.id);
    assert.equal(f.state.debit, 1); assert.equal(f.state.refund, 1); assert.equal(f.state.balance, 10); assert.equal(f.state.calls.length, 1);
  } finally { await f.close(); }
});

test('ambiguous paid search is never retried; explicit copy recovery reuses the original persisted idempotency key', async () => {
  const f = await fixture({ mode: 'live', transportError: error('ECONNRESET') });
  try {
    const searchBody = input(), search = await f.service.search(AUTH, searchBody);
    assert.equal(search.status, 'review_required'); assert.equal(f.state.debit, 1); assert.equal(f.state.refund, 0);
    await f.make().search(AUTH, { ...searchBody, recover: true }); await f.service.refresh(AUTH, search.id);
    assert.equal(f.state.calls.length, 1);
    const copyBody = input(), copy = await f.service.requestCopy(AUTH, copyBody);
    assert.equal(copy.canRecover, true); assert.equal(f.state.calls.length, 2);
    await f.make().requestCopy(AUTH, copyBody); assert.equal(f.state.calls.length, 2);
    f.state.transportError = null;
    const recovered = await f.make().requestCopy(AUTH, { ...copyBody, recover: true });
    assert.equal(recovered.status, 'processing'); assert.equal(f.state.calls.length, 3); assert.equal(f.state.debit, 2);
    assert.equal(f.state.calls[1].request.headers['Idempotency-Key'], f.state.calls[2].request.headers['Idempotency-Key']);
    assert.equal(JSON.stringify(recovered).includes('private provider'), false);
  } finally { await f.close(); }
});

test('known provider rejection refunds once, and pending refunds survive restart without another paid provider request', async () => {
  const f = await fixture({ mode: 'live', rejectStatus: 402 });
  try {
    const result = await f.service.requestCopy(AUTH, input());
    assert.equal(result.status, 'failed'); assert.equal(result.billing.refunded, true); assert.equal(f.state.debit, 1); assert.equal(f.state.refund, 1);
  } finally { await f.close(); }
  const pending = await fixture({ mode: 'live', resultSearch: { results: [], total: 0, credits_charged: 0 }, refundError: error('ECONNRESET') });
  try {
    const result = await pending.service.search(AUTH, input());
    assert.equal(result.billing.state, 'refund_pending');
    pending.state.refundError = null;
    const done = await pending.make().refresh(AUTH, result.id);
    assert.equal(done.billing.refunded, true); assert.equal(pending.state.debit, 1); assert.equal(pending.state.refund, 1); assert.equal(pending.state.calls.length, 1);
  } finally { await pending.close(); }
});

test('copy becomes ready only after all parts pass private streamed PDF checks; refresh is throttled and download is owner-only', async () => {
  const f = await fixture();
  try {
    const created = await f.service.requestCopy(AUTH, input());
    assert.equal(created.status, 'processing'); assert.equal(created.parts.length, 0);
    await f.service.refresh(AUTH, created.id);
    const count = f.state.calls.length;
    await f.make().refresh(AUTH, created.id); assert.equal(f.state.calls.length, count);
    f.advance(16000); f.state.resultStatus = 'completed';
    const [one, two] = await Promise.all([f.service.refresh(AUTH, created.id), f.make().refresh(AUTH, created.id)]);
    assert.ok([one.status, two.status].includes('ready'));
    const ready = await f.service.get(AUTH, created.id);
    assert.equal(ready.status, 'ready'); assert.equal(ready.parts.length, 2); assert.equal(f.state.downloads.length, 2);
    assert.equal(JSON.stringify(ready).includes('token='), false); assert.equal(JSON.stringify(ready).includes('storageName'), false);
    for (const part of ready.parts) {
      assert.equal(part.url, `/api/process-online/requests/${ready.id}/files/${part.index}`);
      const file = await f.service.file(AUTH, ready.id, part.index);
      assert.deepEqual(await readFile(file.path), PDF); assert.equal(file.bytes, PDF.length);
      assert.equal((await f.service.filesForAnalysis(AUTH, ready.id)).files.length, 2);
    }
    for (const index of ['../1', '01', -1, 0, 3, 1.2]) await assert.rejects(f.service.file(AUTH, ready.id, index), { status: 404 });
    await assert.rejects(f.service.file({ tenantId: 1, user: { id: 12 } }, ready.id, 1), { status: 404 });
    assert.ok(f.state.downloads.every(call => call.request.redirect === 'error'));
  } finally { await f.close(); }
});

test('invalid or incomplete multipart PDFs never expose any part and a later GET can recover without a paid retry', async () => {
  const f = await fixture({ parts: [PDF, Buffer.alloc(PDF.length, 65)], resultStatus: 'completed' });
  try {
    const created = await f.service.requestCopy(AUTH, input());
    const failed = await f.service.refresh(AUTH, created.id);
    assert.equal(failed.status, 'review_required'); assert.equal(failed.parts.length, 0);
    await assert.rejects(f.service.filesForAnalysis(AUTH, created.id), { status: 409 });
    const saved = (await f.pg.query('SELECT * FROM audita_process_online_requests')).rows[0];
    assert.equal(openIr(saved.encrypted_payload, irKey(KEY), `process-online:${saved.id}`).parts, undefined);
    f.state.parts = [PDF, PDF]; f.advance(16000);
    const recovered = await f.make().refresh(AUTH, created.id);
    assert.equal(recovered.status, 'ready'); assert.equal(recovered.parts.length, 2);
    assert.equal(f.state.calls.filter(call => call.target.includes('api-create-request')).length, 1);
  } finally { await f.close(); }
});

test('webhook validates raw HMAC, ignores unknown/test events, reconciles trusted GET, deduplicates and never follows payload URLs', async () => {
  const f = await fixture({ mode: 'live' });
  try {
    await assert.rejects(f.service.webhook(Buffer.from('{}'), 'invalid'), { code: 'process_online_invalid_webhook_signature' });
    assert.deepEqual(await f.service.webhook(...f.signed({ event: 'webhook.test' })), { accepted: true, test: true });
    assert.deepEqual(await f.service.webhook(...f.signed({ event: 'request.refunded' })), { accepted: true, ignored: true });
    const created = await f.service.requestCopy(AUTH, input());
    const event = { event: 'request.completed', request_id: f.state.providerId, status: 'completed', download_url: 'http://127.0.0.1/private' };
    f.state.resultStatus = 'secret'; f.state.resultRefunded = true;
    const results = await Promise.all([f.service.webhook(...f.signed(event)), f.make().webhook(...f.signed(event))]);
    assert.ok(results.every(value => value.accepted));
    const result = await f.service.get(AUTH, created.id);
    assert.equal(result.status, 'secret'); assert.equal(result.billing.refunded, true); assert.equal(f.state.refund, 1); assert.equal(f.state.downloads.length, 0);
    const count = f.state.calls.length;
    assert.equal((await f.make().webhook(...f.signed(event))).duplicate, true); assert.equal(f.state.calls.length, count);
    assert.equal((await f.pg.query('SELECT count(*) AS n FROM audita_process_online_events')).rows[0].n, 1);
  } finally { await f.close(); }
});

test('private files reject replacement by symlink or incorrect size', async t => {
  const f = await fixture({ resultStatus: 'completed' });
  try {
    const created = await f.service.requestCopy(AUTH, input());
    const ready = await f.service.refresh(AUTH, created.id), file = await f.service.file(AUTH, ready.id, 1);
    await writeFile(file.path, Buffer.from('altered'));
    await assert.rejects(f.service.file(AUTH, ready.id, 1), { status: 404 });
    await unlink(file.path);
    const other = await f.service.file(AUTH, ready.id, 2);
    try { await symlink(other.path, file.path); }
    catch (error) { if (error.code === 'EPERM') { t.diagnostic('Windows account cannot create symlinks; size and realpath guards still exercised.'); return; } throw error; }
    await assert.rejects(f.service.file(AUTH, ready.id, 1), { status: 404 });
  } finally { await f.close(); }
});

test('concurrent live copy submissions across service instances debit and send only once', async () => {
  const f = await fixture({ mode: 'live', delay: 40 });
  try {
    const body = input();
    const values = await Promise.all([f.service.requestCopy(AUTH, body), f.make().requestCopy(AUTH, body), f.make().requestCopy(AUTH, body)]);
    assert.ok(values.every(value => value.id === values[0].id));
    assert.equal(f.state.debit, 1); assert.equal(f.state.calls.length, 1);
    assert.equal((await f.service.get(AUTH, values[0].id)).status, 'processing');
  } finally { await f.close(); }
});

test('interrupted durable submission is never retried by reads and exposes only explicit copy recovery', async () => {
  const f = await fixture({ mode: 'live', transportError: error('ECONNRESET') });
  try {
    const body = input(), first = await f.service.requestCopy(AUTH, body);
    await f.pg.query("UPDATE audita_process_online_requests SET status='submitting',updated_at=$2 WHERE id=$1", [first.id, '2026-10-19T11:50:00Z']);
    const restored = await f.make().get(AUTH, first.id);
    assert.equal(restored.status, 'review_required'); assert.equal(restored.canRecover, true); assert.equal(f.state.calls.length, 1);
    await f.make().refresh(AUTH, first.id); assert.equal(f.state.calls.length, 1);
    f.state.transportError = null;
    assert.equal((await f.make().requestCopy(AUTH, { ...body, recover: true })).status, 'processing');
    assert.equal(f.state.calls.length, 2); assert.equal(f.state.debit, 1);
    assert.equal(f.state.calls[0].request.headers['Idempotency-Key'], f.state.calls[1].request.headers['Idempotency-Key']);
  } finally { await f.close(); }
});

test('download rejects unsafe hosts, excess aggregate bytes, truncated bodies, byte overruns and HTTP redirects', async () => {
  const unsafe = 'https://127.0.0.1/storage/v1/object/sign/1.pdf';
  const huge = Array.from({ length: 6 }, (_, index) => ({ idx: index + 1, bytes: 200 * 1024 * 1024,
    url: `https://api.processonline.com.br/storage/v1/object/sign/private/${index + 1}.pdf?token=fictitious` }));
  for (const candidate of [
    { manifestChanges: { parts: [{ idx: 1, bytes: PDF.length, url: unsafe }], parts_count: 1, download_url: unsafe }, code: 'process_online_invalid_download', fetches: 0 },
    { manifestChanges: { parts: huge, parts_count: huge.length, download_url: huge[0].url }, code: 'process_online_download_too_large', fetches: 0 },
    { downloadParts: [PDF.subarray(0, -1), PDF], code: 'process_online_invalid_pdf', fetches: 1 },
    { downloadParts: [Buffer.concat([PDF, Buffer.from('extra')]), PDF], code: 'process_online_download_too_large', fetches: 1 },
    { downloadResponse: new Response('redirect', { status: 302, headers: { Location: 'http://127.0.0.1/private' } }), code: 'process_online_invalid_download', fetches: 1 },
  ]) {
    const f = await fixture({ resultStatus: 'completed', ...candidate });
    try {
      const created = await f.service.requestCopy(AUTH, input()), result = await f.service.refresh(AUTH, created.id);
      assert.equal(result.status, 'review_required'); assert.equal(result.parts.length, 0); assert.equal(result.errorCode, candidate.code);
      assert.equal(f.state.downloads.length, candidate.fetches); assert.equal(f.service.getStatus().maxTotalBytes, 1024 * 1024 * 1024);
    } finally { await f.close(); }
  }
});

test('a later authenticated GET can revoke a ready copy and refund without redownloading or trusting the callback status', async () => {
  const f = await fixture({ mode: 'live', resultStatus: 'completed' });
  try {
    const created = await f.service.requestCopy(AUTH, input()), ready = await f.service.refresh(AUTH, created.id);
    assert.equal(ready.status, 'ready'); assert.equal(f.state.downloads.length, 2);
    const count = f.state.calls.length;
    f.advance(16000);
    const unchanged = await f.make().refresh(AUTH, ready.id);
    assert.equal(unchanged.status, 'ready'); assert.equal(f.state.calls.length, count + 1); assert.equal(f.state.downloads.length, 2);
    f.state.resultStatus = 'secret'; f.state.resultRefunded = true;
    await f.service.webhook(...f.signed({ event: 'request.secret', request_id: f.state.providerId, status: 'completed' }));
    const revoked = await f.service.get(AUTH, ready.id);
    assert.equal(revoked.status, 'secret'); assert.equal(revoked.parts.length, 0); assert.equal(f.state.refund, 1);
    await assert.rejects(f.service.file(AUTH, ready.id, 1), { status: 409 });
  } finally { await f.close(); }
});

test('webhook delivery can resume a durable pending refund after a failed grant and process restart', async () => {
  const f = await fixture({ mode: 'live', resultStatus: 'secret', resultRefunded: true, refundError: error('ECONNRESET') });
  try {
    const created = await f.service.requestCopy(AUTH, input()), event = { event: 'request.secret', request_id: f.state.providerId };
    await f.service.webhook(...f.signed(event));
    let current = await f.service.get(AUTH, created.id);
    assert.equal(current.status, 'review_required'); assert.equal(current.billing.state, 'refund_pending');
    assert.equal((await f.pg.query('SELECT completed_at FROM audita_process_online_events')).rows[0].completed_at, null);
    f.state.refundError = null;
    await f.make().webhook(...f.signed(event));
    current = await f.service.get(AUTH, created.id);
    assert.equal(current.status, 'secret'); assert.equal(current.billing.state, 'refunded'); assert.equal(f.state.refund, 1);
    await f.make().webhook(...f.signed(event)); assert.equal(f.state.refund, 1); assert.equal(f.state.debit, 1);
  } finally { await f.close(); }
});

test('pending refund can resume after provider rejection without a provider request id', async () => {
  const f = await fixture({ mode: 'live', rejectStatus: 402, refundError: error('ECONNRESET') });
  try {
    await assert.rejects(f.service.requestCopy(AUTH, input()));
    const pending = (await f.service.list(AUTH)).requests[0];
    assert.equal(pending.status, 'failed'); assert.equal(pending.billing.state, 'refund_pending');
    f.state.refundError = null;
    const done = await f.make().refresh(AUTH, pending.id);
    assert.equal(done.status, 'failed'); assert.equal(done.billing.refunded, true);
    assert.equal(f.state.debit, 1); assert.equal(f.state.refund, 1); assert.equal(f.state.calls.length, 1);
  } finally { await f.close(); }
});

test('successful replacement of a previously ready copy removes only its old private parts', async () => {
  const f = await fixture({ resultStatus: 'completed' });
  try {
    const created = await f.service.requestCopy(AUTH, input()), ready = await f.service.refresh(AUTH, created.id);
    const old = await f.service.file(AUTH, ready.id, 1);
    f.state.getError = error('ECONNRESET'); f.advance(16000);
    assert.equal((await f.make().refresh(AUTH, ready.id)).status, 'review_required');
    f.state.getError = null; f.advance(16000);
    const recovered = await f.make().refresh(AUTH, ready.id);
    assert.equal(recovered.status, 'ready');
    await assert.rejects(readFile(old.path), { code: 'ENOENT' });
    const replacement = await f.service.file(AUTH, ready.id, 1);
    assert.notEqual(replacement.path, old.path); assert.deepEqual(await readFile(replacement.path), PDF);
    assert.equal(f.state.calls.filter(call => call.target.includes('api-create-request')).length, 1);
  } finally { await f.close(); }
});

test('owner can recover by request id after reload using only the encrypted original operation and approval', async () => {
  const f = await fixture({ mode: 'live', transportError: error('ECONNRESET') });
  try {
    const body = input(), first = await f.service.requestCopy(AUTH, body);
    await assert.rejects(f.make().recover({ tenantId: 1, user: { id: 12 } }, first.id, { consent: true, approvedCredits: 1 }), { status: 404 });
    await assert.rejects(f.make().recover(AUTH, first.id, { consent: true, approvedCredits: -1 }), { code: 'process_online_cost_approval_required' });
    assert.equal(f.state.calls.length, 1);
    f.state.transportError = null;
    const recovered = await f.make().recover(AUTH, first.id, { consent: true, approvedCredits: 1, operationId: randomUUID(), cnj: 'invalid', interesse: 'invalid' });
    assert.equal(recovered.id, first.id); assert.equal(recovered.operationId, body.operationId); assert.equal(recovered.status, 'processing');
    assert.equal(f.state.debit, 1); assert.equal(f.state.calls.length, 2);
    assert.equal(f.state.calls[0].request.headers['Idempotency-Key'], f.state.calls[1].request.headers['Idempotency-Key']);
    assert.equal(f.state.calls[0].request.body, f.state.calls[1].request.body);
    assert.equal((await f.pg.query('SELECT count(*) AS n FROM audita_process_online_requests')).rows[0].n, 1);
    await assert.rejects(f.make().recover(AUTH, first.id, { consent: true, approvedCredits: 1 }), { status: 409 });
  } finally { await f.close(); }
});

test('remote expiry preserves ready private copies only while every local part matches its saved hash', async () => {
  const f = await fixture({ resultStatus: 'completed' });
  try {
    const created = await f.service.requestCopy(AUTH, input()), ready = await f.service.refresh(AUTH, created.id);
    f.state.resultStatus = 'expired'; f.advance(16000);
    const retained = await f.make().refresh(AUTH, ready.id);
    assert.equal(retained.status, 'ready'); assert.equal(retained.providerStatus, 'expired'); assert.equal(retained.parts.length, 2);
    assert.equal((await f.service.filesForAnalysis(AUTH, ready.id)).files.length, 2);
    const part = await f.service.file(AUTH, ready.id, 1), corrupt = Buffer.from(PDF);
    corrupt[10] ^= 1;
    await writeFile(part.path, corrupt); f.advance(16000);
    const rejected = await f.make().refresh(AUTH, ready.id);
    assert.equal(rejected.status, 'expired'); assert.equal(rejected.providerStatus, 'expired'); assert.equal(rejected.parts.length, 0);
    await assert.rejects(f.service.filesForAnalysis(AUTH, ready.id), { status: 409 });
    assert.equal(f.state.downloads.length, 2); assert.equal(f.state.calls.filter(call => call.target.includes('api-create-request')).length, 1);
  } finally { await f.close(); }
});

test('documented HTTP410 expiry also preserves intact local files and denies a damaged copy', async () => {
  const f = await fixture({ resultStatus: 'completed' });
  try {
    const created = await f.service.requestCopy(AUTH, input()), ready = await f.service.refresh(AUTH, created.id);
    f.state.requestHttpStatus = 410; f.advance(16000);
    const retained = await f.make().refresh(AUTH, ready.id);
    assert.equal(retained.status, 'ready'); assert.equal(retained.providerStatus, 'expired');
    const part = await f.service.file(AUTH, ready.id, 1);
    assert.equal((await f.service.filesForAnalysis(AUTH, ready.id)).files.length, 2);
    await writeFile(part.path, Buffer.from('damaged')); f.advance(16000);
    const rejected = await f.make().refresh(AUTH, ready.id);
    assert.equal(rejected.status, 'expired'); assert.equal(rejected.parts.length, 0);
    assert.equal(f.state.calls.filter(call => call.target.includes('api-create-request')).length, 1);
  } finally { await f.close(); }
});

test('new credit-free searches and copies work without a wallet and retain safe recovery', async()=>{
 const f=await fixture({mode:'live',walletEnabled:false,balance:0});
 try {
 f.env.AUDITA_CREDITS_ENABLED='false';
 assert.equal(f.service.getStatus().ready,true);
 const search=await f.service.search(AUTH,input({approvedCredits:0}));
 assert.equal(search.billing.auditaCredits,0);assert.equal(f.state.debit,0);
 f.state.transportError=new Error('timeout');
 const copy=await f.service.requestCopy(AUTH,input({approvedCredits:0}));
 assert.equal(copy.canRecover,true);assert.equal(copy.billing.auditaCredits,0);
 f.state.transportError=null;
 const recovered=await f.service.recover(AUTH,copy.id,{consent:true,approvedCredits:0});
 assert.equal(recovered.status,'processing');assert.equal(f.state.debit,0);assert.equal(f.state.refund,0);
 } finally {await f.close();}
});
