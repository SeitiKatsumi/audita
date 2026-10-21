import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { createProcessOnlineService } from '../services/process-online.service.mjs';

// ponytail: manual sandbox check; no live key, customer document, AI or purchase.
const canary = '07013791820258010013';
function sandboxKey(key) {
  if (typeof key !== 'string' || !/^po_test_[A-Za-z0-9_-]+$/.test(key)) {
    throw new Error('Configure only a ProcessOnline TEST key in the private environment.');
  }
  return key;
}

async function run() {
  if (process.argv.includes('--self-check')) {
    assert.equal(sandboxKey('po_test_fixture'), 'po_test_fixture');
    for (const value of [undefined, '', 'po_live_fixture', 'po_test_']) assert.throws(() => sandboxKey(value));
    assert.throws(() => sandboxKey('po_live_private_value'), error => !error.message.includes('po_live_private_value'));
    console.log('Sandbox-only guard passed; no network calls.');
    return;
  }
  assert(process.argv.includes('--execute'), 'Use --self-check or --execute.');
  let reportedSearch;
  const provider = createProcessOnlineService({ enabled: true, apiKey: sandboxKey(process.env.PROCESS_ONLINE_API_KEY),
    fetchImpl: async (url, options) => {
      const response = await fetch(url, options);
      if (url.endsWith('/api-search-documento') && response.ok) {
        const data = await response.clone().json();
        reportedSearch = { returned: data.results?.length, total: data.total, chargedCredits: data.credits_charged };
        assert.equal(data.credits_charged, 0, 'Sandbox must not report a charged credit.');
      }
      return response;
    },
  });
  const approval = () => ({ tenantId: 'sandbox', userId: 'sandbox', operationId: randomUUID(), credits: 0 });
  const searches = [];
  for (const documento of ['11144477735', '47968189000174']) {
    reportedSearch = null;
    const type = documento.length === 11 ? 'cpf' : 'cnpj';
    try {
      const result = await provider.searchDocumento({ documento, approval: approval() });
      searches.push({ type, validated: true, returned: result.results.length, total: result.total });
    } catch (error) {
      // The official sandbox currently returns an illustrative CNJ with invalid check digits.
      // Keep the production validator strict and continue testing the independent copy canary.
      if (error.code !== 'process_online_invalid_cnj' || !reportedSearch) throw error;
      searches.push({ type, validated: false, error: error.code, ...reportedSearch });
    }
  }
  const verification = await provider.verifyCNJ({ cnj: canary });
  assert.equal(verification.exists, true);
  const copy = await provider.requestCopy({ cnj: canary, interesse: 'outro', approval: approval() });
  assert.equal(copy.credits_charged, 0, 'Sandbox must not report a charged credit.');
  const state = await provider.getRequest({ requestId: copy.request_id });
  assert.equal(state.credits_charged, 0);
  assert.equal(state.status, 'completed', 'Sandbox PDF is not ready; inspect the partner panel before another run.');
  const download = await provider.getDownload({ requestId: copy.request_id });
  assert(download.parts.length <= 20);
  assert(download.parts.reduce((sum, part) => sum + part.bytes, 0) <= 20 * 1024 * 1024, 'Unexpectedly large sandbox sample.');
  const parts = [];
  for (const part of download.parts) {
    const response = Buffer.isBuffer(part.testPdf) ? new Response(part.testPdf)
      : await fetch(part.url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200);
    const chunks = []; let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      assert(bytes <= part.bytes, 'Sample exceeds declared size.');
      chunks.push(chunk);
    }
    const pdf = Buffer.concat(chunks);
    assert.equal(bytes, part.bytes);
    assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-');
    const pages = (await PDFDocument.load(pdf)).getPageCount();
    assert(pages > 0);
    parts.push({ index: part.idx, bytes, pages, sha256: createHash('sha256').update(pdf).digest('hex') });
  }
  const complete = searches.every(result => result.validated);
  console.log(JSON.stringify({ sandbox: true, complete, searches, verification: true, copy: state.status, chargedCredits: 0, parts }, null, 2));
  if (!complete) process.exitCode = 1;
}

run().catch(error => { console.error(error.code?.startsWith('process_online_') ? error.code : error.message); process.exitCode = 1; });
