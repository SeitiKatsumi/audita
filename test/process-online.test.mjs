import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createProcessOnlineService, verifyProcessOnlineWebhook } from '../services/process-online.service.mjs';

const CNJ = '5062404-56.2024.8.13.0702';
const DIGITS = CNJ.replace(/\D/g, '');
const ID = 'f0995809-0bee-4e8c-bc52-fb14ec3d80f5';
const approval = { tenantId: 'tenant-test', userId: 'user-test', operationId: 'operation-test', credits: 1 };
const url = (part) => `https://api.processonline.com.br/storage/v1/object/sign/private/part-${part}.pdf?token=fictitious`;
const download = () => ({ request_id: ID, download_url: url(1), parts_count: 2,
  parts: [{ idx: 2, url: url(2), bytes: 10 }, { idx: 1, url: url(1), bytes: 209715200 }],
  expires_in: 3600, file_expires_at: '2027-01-01T00:00:00Z' });
function fixture(result, options = {}) {
  const calls = [];
  const service = createProcessOnlineService({ enabled: true, apiKey: 'po_live_fictitious',
    fetchImpl: async (target, request) => {
      calls.push({ url: target, ...request });
      return result instanceof Response ? result : Response.json(typeof result === 'function' ? result() : result);
    }, ...options });
  return { service, calls };
}

test('ProcessOnline stays disabled and does not expose its key', async () => {
  const service = createProcessOnlineService({ enabled: false, apiKey: 'po_test_fictitious',
    fetchImpl: () => assert.fail('no network') });
  assert.deepEqual(service.getStatus(), { enabled: false, ready: false, mode: 'test' });
  await assert.rejects(service.verifyCNJ({ cnj: CNJ }), { code: 'process_online_not_configured' });
  assert.equal(createProcessOnlineService({ enabled: true, apiKey: 'po_live_x\r\nInjected: secret' }).getStatus().ready, false);
});

test('only test downloads accept the bounded direct PDF actually returned by the sandbox', async () => {
  const pdf = Buffer.from('%PDF-1.7\nSample\n%%EOF');
  const response = () => new Response(pdf, { headers: { 'Content-Type': 'application/pdf' } });
  const sample = fixture(response(), { apiKey: 'po_test_fictitious' });
  const manifest = await sample.service.getDownload({ requestId: ID });
  assert.equal(manifest.parts_count, 1);
  assert.deepEqual(manifest.parts[0].testPdf, pdf);
  assert.equal(manifest.parts[0].bytes, pdf.length);
  await assert.rejects(fixture(response()).service.getDownload({ requestId: ID }), { code: 'process_online_invalid_response' });
  await assert.rejects(fixture(response(), { apiKey: 'po_test_fictitious' }).service.verifyCNJ({ cnj: CNJ }), { code: 'process_online_invalid_response' });
  for (const invalid of [new Response('not a PDF', { headers: { 'Content-Type': 'application/pdf' } }),
    new Response(pdf, { headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(2 * 1024 * 1024 + 1) } })]) {
    await assert.rejects(fixture(invalid, { apiKey: 'po_test_fictitious' }).service.getDownload({ requestId: ID }));
  }
});

test('ProcessOnline rejects malformed document, CNJ, request id and unapproved costs before sending', async () => {
  const { service, calls } = fixture({});
  for (const documento of ['11111111111', '04.252.011/0001-11', 'text52998224725']) {
    await assert.rejects(service.searchDocumento({ documento, approval }), { code: 'process_online_invalid_document' });
  }
  for (const cnj of ['5062404-55.2024.8.13.0702', '123', 'https://example.test/' + DIGITS]) {
    await assert.rejects(service.verifyCNJ({ cnj }), { code: 'process_online_invalid_cnj' });
  }
  await assert.rejects(service.getRequest({ requestId: '../private' }), { code: 'process_online_invalid_request_id' });
  for (const candidate of [undefined, { ...approval, credits: 0 }, { ...approval, tenantId: '' }]) {
    await assert.rejects(service.requestCopy({ cnj: CNJ, interesse: 'outro', approval: candidate }), { code: 'process_online_cost_approval_required' });
  }
  await assert.rejects(service.requestCopy({ cnj: CNJ, interesse: 'advogado', approval }), { code: 'process_online_invalid_interesse' });
  assert.equal(calls.length, 0);
});

test('ProcessOnline searches CPF/CNPJ using the documented contract, bounded cost and scoped idempotency', async () => {
  const { service, calls } = fixture({ total: 1, results: [{ numero_cnj: CNJ }], credits_charged: 1 });
  for (const documento of ['529.982.247-25', '04.252.011/0001-10']) {
    await service.searchDocumento({ documento, approval });
    assert.equal(JSON.parse(calls.at(-1).body).documento, documento.replace(/\D/g, ''));
  }
  await service.searchDocumento({ documento: '52998224725', approval });
  assert.equal(calls[0].headers['Idempotency-Key'], calls[2].headers['Idempotency-Key']);
  await service.searchDocumento({ documento: '52998224725', approval: { ...approval, tenantId: 'other-tenant' } });
  assert.notEqual(calls[0].headers['Idempotency-Key'], calls[3].headers['Idempotency-Key']);
  assert.ok(calls.every((call) => call.url.endsWith('/api-search-documento') && call.method === 'POST'
    && call.redirect === 'error' && call.headers.Authorization === 'Bearer po_live_fictitious'
    && /^[a-f0-9]{64}$/.test(call.headers['Idempotency-Key'])));
});

test('ProcessOnline verifies freely and preserves the copy request idempotency across retries', async () => {
  const check = fixture({ exists: true, cnj: DIGITS });
  await check.service.verifyCNJ({ cnj: CNJ });
  assert.equal(check.calls[0].url, 'https://api.processonline.com.br/functions/v1/api-verify');
  assert.equal(check.calls[0].headers['Idempotency-Key'], undefined);
  const { service, calls } = fixture({ request_id: ID, status: 'processing', credits_charged: 1 });
  const input = { cnj: CNJ, interesse: 'advogado', interesseDetalhe: 'MG 123456', approval };
  await service.requestCopy(input);
  await service.requestCopy(input);
  assert.deepEqual(JSON.parse(calls[0].body), { cnj: DIGITS, interesse: 'advogado', interesse_detalhe: 'MG 123456' });
  assert.equal(calls[0].headers['Idempotency-Key'], calls[1].headers['Idempotency-Key']);
  await service.requestCopy({ ...input, approval: { ...approval, userId: 'other-user' } });
  assert.notEqual(calls[0].headers['Idempotency-Key'], calls[2].headers['Idempotency-Key']);
});

test('ProcessOnline reads each request and all ordered parts without fetching private PDF URLs', async () => {
  const request = fixture({ request_id: ID, cnj: DIGITS, status: 'secret', credits_charged: 1, refunded: true });
  assert.equal((await request.service.getRequest({ requestId: ID })).refunded, true);
  assert.equal(new URL(request.calls[0].url).searchParams.get('id'), ID);
  const { service, calls } = fixture(download());
  const result = await service.getDownload({ requestId: ID });
  assert.deepEqual(result.parts.map((part) => part.idx), [1, 2]);
  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).pathname, '/functions/v1/api-download');
  assert.equal(calls[0].method, 'GET');
});

test('ProcessOnline fails closed for incomplete, oversized, duplicate, untrusted or mismatched downloads', async () => {
  for (const change of [
    (data) => { data.parts.pop(); },
    (data) => { data.parts[0].idx = 1; },
    (data) => { data.parts[0].url = 'https://127.0.0.1/private'; },
    (data) => { data.parts[0].url = 'https://api.processonline.com.br.evil.test/storage/v1/object/sign/x'; },
    (data) => { data.parts[0].url = 'https://user:secret@api.processonline.com.br/storage/v1/object/sign/x'; },
    (data) => { data.parts[0].bytes = 209715201; },
    (data) => { data.request_id = '11111111-1111-1111-1111-111111111111'; },
    (data) => { data.expires_in = 3601; },
  ]) {
    const data = download(); change(data);
    await assert.rejects(fixture(data).service.getDownload({ requestId: ID }), { code: 'process_online_invalid_download' });
  }
});

test('ProcessOnline sanitizes errors, bounds JSON/time and never retries a paid operation automatically', async () => {
  for (const status of [401, 402, 403, 404, 409, 410, 422, 429, 502]) {
    const { service, calls } = fixture(new Response('private provider error', { status }));
    await assert.rejects(service.searchDocumento({ documento: '52998224725', approval }), (error) => {
      assert.match(error.code, /^process_online_/);
      assert.ok(!error.message.includes('private'));
      return true;
    });
    assert.equal(calls.length, 1);
  }
  await assert.rejects(fixture(new Response('<html>not JSON</html>')).service.verifyCNJ({ cnj: CNJ }), { code: 'process_online_invalid_response' });
  await assert.rejects(fixture(new Response('x'.repeat(2 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'application/json' } }))
    .service.verifyCNJ({ cnj: CNJ }), { code: 'process_online_response_too_large' });
  const stub = fixture({}, { timeoutMs: 5, fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) =>
    signal.addEventListener('abort', () => reject(new Error('secret')), { once: true })) });
  await assert.rejects(stub.service.verifyCNJ({ cnj: CNJ }), { code: 'process_online_timeout' });
});

test('ProcessOnline webhook authenticates exact bytes, checks replay window and rejects malformed signatures safely', () => {
  const raw = Buffer.from(JSON.stringify({ event: 'request.completed', request_id: ID }));
  const secret = 'fictitious-webhook-secret';
  const timestamp = 1_700_000_000;
  const digest = createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest('hex');
  const signature = `t=${timestamp},v1=${digest}`;
  assert.equal(verifyProcessOnlineWebhook(raw, signature, secret, timestamp * 1000), true);
  assert.equal(verifyProcessOnlineWebhook(raw, signature, secret, (timestamp + 301) * 1000), false);
  assert.equal(verifyProcessOnlineWebhook(Buffer.concat([raw, Buffer.from(' ')]), signature, secret, timestamp * 1000), false);
  for (const bad of ['', 't=x,v1=x', `t=${timestamp},v1=00`, `${signature},t=${timestamp}`]) {
    assert.equal(verifyProcessOnlineWebhook(raw, bad, secret, timestamp * 1000), false);
  }
  assert.equal(verifyProcessOnlineWebhook(raw, signature, '', timestamp * 1000), false);
  assert.equal(verifyProcessOnlineWebhook({}, signature, secret, timestamp * 1000), false);
});
