import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { createProcessOnlineAnalysisService } from '../services/process-online-analysis.service.mjs';
import { openIr, irKey } from '../services/ir-exemption-domain.mjs';

const owner = { tenantId: 1, user: { id: 81 } };
const evidence = 'Registro dos autos ficticios: R$ 1.250,00 em 01/10/2026. Conferir o documento original. ';
const key = 'process-online-analysis-fixture-key-0000000';
const reading = () => ({ summary: 'Os autos registram R$ 1.250,00. Conferir a natureza do valor no original.', identity: 'compatible', outcome: 'occurrences', issuedAt: null, validUntil: null,
  limitations: [], findings: [{ category: 'judicial', priority: 'medium', title: 'Valor informado no processo', description: 'Valor registrado nos autos; a existência do processo não comprova dívida pessoal.', quote: 'R$ 1.250,00', amount: 'R$ 1.250,00', date: '01/10/2026', recommendation: 'Conferir decisão e posição das partes no original.' }] });

async function makePdf(pages, text = evidence) {
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let page = 0; page < pages; page++) {
    const target = pdf.addPage();
    if (text) target.drawText(text + (text.length < 200 ? ` Pagina ${page + 1}.` : ''), { x: 20, y: 700, font, size: 1 });
  }
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

async function fixture(spec = [1]) {
  const db = new PGlite(), root = await mkdtemp(join(tmpdir(), 'audita-process-analysis-')), id = randomUUID();
  await db.exec('CREATE TABLE audita_tenants(id BIGINT PRIMARY KEY); CREATE TABLE audita_users(id BIGINT PRIMARY KEY); INSERT INTO audita_tenants VALUES(1); INSERT INTO audita_users VALUES(81);');
  await db.exec(await readFile(new URL('../db/process-online.sql', import.meta.url), 'utf8'));
  await db.query("INSERT INTO audita_process_online_requests(id,tenant_id,user_id,operation_id,kind,mode,status,request_hash,encrypted_payload) VALUES($1,1,81,$2,'copy','test','ready',$3,'private-collector-state')", [id, randomUUID(), 'f'.repeat(64)]);
  const files = [];
  for (let index = 0; index < spec.length; index++) {
    const config = typeof spec[index] === 'number' ? { pages: spec[index] } : spec[index];
    const buffer = await makePdf(config.pages, config.text === undefined ? evidence : config.text);
    const path = join(root, `part-${index + 1}.pdf`);
    await writeFile(path, buffer);
    files.push({ path, fileName: `autos-parte-${index + 1}.pdf`, bytes: buffer.length });
  }
  const calls = [], summaries = [], accesses = [];
  let allowed = true, clock = new Date('2026-10-19T12:00:00Z');
  const ai = { ready: () => true, read: async source => { calls.push(source); return reading(); }, summarize: async report => {
    summaries.push(report);
    return [{ text: 'Os autos registram R$ 1.250,00. Confira o documento original.', sourceIds: [report.sources[0].id], quotes: ['R$ 1.250,00'] }];
  } };
  const options = { getDb: () => ({ dbReady: true, pool: db }), workflow: { filesForAnalysis: async (auth, requestId) => {
    assert.equal(auth, owner); assert.equal(requestId, id);
    return { files, context: { provider: 'ProcessOnline', requestId: id, cnj: '00000000020268000000', sourceKind: 'court_case_copy' } };
  } }, ai, env: { AUDITA_PROFILE_ENCRYPTION_KEY: key }, authorize: async auth => {
    accesses.push(auth);
    if (!allowed) throw Object.assign(new Error('blocked private detail'), { code: 'analysis_subscription_required', status: 402 });
  }, now: () => clock };
  const service = createProcessOnlineAnalysisService(options);
  return { db, id, files, calls, summaries, accesses, ai, options, service, setAllowed: value => { allowed = value; }, setClock: value => { clock = value; },
    stored: async () => {
      const row = (await db.query('SELECT * FROM audita_process_online_requests WHERE id=$1', [id])).rows[0];
      return { row, state: row.analysis_payload ? openIr(row.analysis_payload.encrypted, irKey(key), `process-online-analysis:${id}`) : null };
    }, close: async () => { await db.close(); await rm(root, { recursive: true, force: true }); } };
}

test('all parts and pages are read in bounded chunks; private grounded report persists encrypted without collector mutations', async () => {
  const f = await fixture([21, 2]);
  try {
    assert.equal(f.service.ready(), true);
    assert.equal((await f.service.get(owner, f.id)).status, 'not_started');
    assert.equal(f.calls.length, 0);
    await assert.rejects(f.service.start(owner, f.id, {}), { code: 'process_online_analysis_consent_required' });
    await assert.rejects(f.service.start(owner, f.id, { consent: true, purpose: 'x' }), { code: 'process_online_analysis_invalid_purpose' });
    assert.equal((await f.service.start(owner, f.id, { consent: true })).status, 'running');
    await f.service.wait(f.id);
    const result = await f.service.get(owner, f.id);
    assert.equal(result.status, 'completed', JSON.stringify({ result, text: f.calls[0]?.text.slice(0, 300) }));
    assert.equal(result.progress, 100);
    assert.equal(result.coverage.totalParts, 2);
    assert.equal(result.coverage.totalPages, 23);
    assert.equal(result.coverage.analyzedPages, 23);
    assert.equal(result.coverage.totalChunks, 4);
    assert.equal(result.coverage.analyzedChunks, 4);
    assert.equal(result.report.complete, true);
    assert.equal(f.calls.length, 4);
    assert.ok(f.calls.every(source => source.details.pages.length <= 10 && !source.buffer && source.text.length <= 120000));
    assert.equal(f.accesses.length, f.calls.length + f.summaries.length + 1, 'authorization precedes each read and summary');
    assert.ok(result.report.findings.every(finding => finding.quoteVerified && finding.pages.length && finding.part));
    assert.ok(!('safetyScore' in result.report));
    const publicData = JSON.stringify(result);
    assert.ok(!publicData.includes(f.files[0].path));
    assert.ok(!publicData.includes('encrypted'));
    const { row, state } = await f.stored();
    assert.equal(row.encrypted_payload, 'private-collector-state');
    assert.ok(row.analysis_payload.encrypted);
    assert.ok(!JSON.stringify(row.analysis_payload).includes('1.250'));
    assert.equal(state.report.cnj, result.report.cnj);
    const pdf = await PDFDocument.load(await f.service.pdf(owner, f.id));
    assert.equal(pdf.getAuthor(), 'Audita');
    assert.equal(pdf.getTitle(), 'Análise dos autos do processo');
    const restarted = createProcessOnlineAnalysisService(f.options);
    assert.deepEqual((await restarted.get(owner, f.id)).report, result.report);
    await restarted.start(owner, f.id, { consent: true });
    assert.equal(f.calls.length, 4, 'saved report does not start AI again');
    for (const auth of [{ tenantId: 2, user: { id: 81 } }, { tenantId: 1, user: { id: 82 } }]) {
      await assert.rejects(restarted.get(auth, f.id), { code: 'process_online_analysis_not_found' });
      await assert.rejects(restarted.pdf(auth, f.id), { code: 'process_online_analysis_not_found' });
    }
    await assert.rejects(restarted.get(null, f.id), { code: 'process_online_analysis_authentication_required' });
  } finally { await f.close(); }
});

test('long page is split without truncation and only counts as analyzed after every chunk completes; restart resumes checkpoints', async () => {
  const f = await fixture([{ pages: 1, text: evidence.repeat(2400) }]);
  try {
    const purpose = 'Confira os valores e as decisões registrados nos autos.';
    const original = f.ai.read;
    let failed = false;
    f.ai.read = async source => {
      if (source.id === 'part-1-chunk-2' && !failed) { failed = true; throw new Error('private /root/path https://signed.example/?secret=hidden'); }
      return original(source);
    };
    await f.service.start(owner, f.id, { consent: true, purpose }); await f.service.wait(f.id);
    const partial = await f.service.get(owner, f.id);
    assert.equal(partial.purpose, purpose, 'saved objective is available after reload for a matching resume');
    assert.equal(partial.status, 'partial');
    assert.equal(partial.coverage.analyzedChunks, 1);
    assert.equal(partial.coverage.analyzedPages, 0);
    assert.ok(partial.coverage.totalChunks > 1);
    assert.ok(!partial.report);
    assert.ok(!JSON.stringify(partial).includes('signed.example'));
    await assert.rejects(f.service.pdf(owner, f.id), { code: 'process_online_analysis_report_not_ready' });
    const restarted = createProcessOnlineAnalysisService(f.options);
    await restarted.start(owner, f.id, { consent: true, purpose: partial.purpose }); await restarted.wait(f.id);
    const result = await restarted.get(owner, f.id);
    assert.equal(result.status, 'completed');
    assert.equal(result.coverage.analyzedPages, 1);
    assert.equal(f.calls.length, result.coverage.totalChunks);
    assert.equal(f.calls.filter(call => call.id === 'part-1-chunk-1').length, 1);
    assert.ok(f.calls.every(call => call.text.length <= 120000));
    const totalRead = f.calls.reduce((sum, call) => sum + call.text.length, 0);
    assert.ok(totalRead >= evidence.length * 2400, 'every character remains in a chunk');
  } finally { await f.close(); }
});

test('database CAS lease prevents duplicate AI across service instances and expired leases are visible as interrupted', async () => {
  const f = await fixture();
  let release;
  try {
    const gate = new Promise(resolve => { release = resolve; }), original = f.ai.read;
    f.ai.read = async source => { await gate; return original(source); };
    const second = createProcessOnlineAnalysisService(f.options);
    await Promise.all([f.service.start(owner, f.id, { consent: true }), second.start(owner, f.id, { consent: true })]);
    release();
    await Promise.all([f.service.wait(f.id), second.wait(f.id)]);
    assert.equal(f.calls.length, 1);
    assert.equal((await f.service.get(owner, f.id)).status, 'completed');
    await f.db.query("UPDATE audita_process_online_requests SET analysis_status='running',analysis_updated_at='2026-10-19T11:49:59Z' WHERE id=$1", [f.id]);
    assert.equal((await second.get(owner, f.id)).status, 'interrupted');
    await second.start(owner, f.id, { consent: true }); await second.wait(f.id);
    assert.equal(f.calls.length, 1, 'expired lease resumes completed reads');
    assert.equal((await second.get(owner, f.id)).status, 'completed');
  } finally { release?.(); await f.close(); }
});

test('invented quotes and numeric claims fail without a report; consent and access block all AI work', async () => {
  const f = await fixture();
  try {
    f.setAllowed(false);
    await assert.rejects(f.service.start(owner, f.id, { consent: true }), { code: 'analysis_subscription_required' });
    assert.equal(f.calls.length, 0);
    f.setAllowed(true);
    f.ai.read = async () => ({ ...reading(), findings: [{ ...reading().findings[0], quote: 'Texto que não existe nos autos' }] });
    await f.service.start(owner, f.id, { consent: true }); await f.service.wait(f.id);
    assert.equal((await f.service.get(owner, f.id)).status, 'failed');
    assert.equal((await f.service.get(owner, f.id)).report, undefined);
    f.ai.read = async () => ({ ...reading(), summary: 'Os autos informam R$ 9.999,99.' });
    await f.service.start(owner, f.id, { consent: true }); await f.service.wait(f.id);
    assert.equal((await f.service.get(owner, f.id)).errorCode, 'process_online_analysis_ungrounded_value');
    f.ai.read = async () => reading();
    f.ai.summarize = async report => [{ text: 'Os autos informam R$ 9.999,99.', sourceIds: [report.sources[0].id], quotes: ['R$ 1.250,00'] }];
    await f.service.start(owner, f.id, { consent: true }); await f.service.wait(f.id);
    const result = await f.service.get(owner, f.id);
    assert.equal(result.status, 'partial');
    assert.equal(result.errorCode, 'process_online_analysis_ungrounded_summary');
  } finally { await f.close(); }
});

test('scanned pages use a bounded private PDF subset and remain explicitly partial without textual quote validation', async () => {
  const f = await fixture([{ pages: 2, text: '' }]);
  try {
    await f.service.start(owner, f.id, { consent: true }); await f.service.wait(f.id);
    const result = await f.service.get(owner, f.id);
    assert.equal(result.status, 'partial');
    assert.equal(result.coverage.totalPages, 2);
    assert.equal(result.coverage.visualChunks, 2);
    assert.equal(result.coverage.analyzedPages, 0);
    assert.equal(result.report, undefined);
    assert.ok(result.limitations.some(value => value.includes('transcrição')));
    for (const call of f.calls) {
      assert.ok(Buffer.isBuffer(call.buffer) && call.buffer.length <= 20 * 1024 * 1024);
      assert.equal((await PDFDocument.load(call.buffer)).getPageCount(), 1);
    }
    assert.equal(f.summaries.length, 0);
    await assert.rejects(f.service.pdf(owner, f.id), { code: 'process_online_analysis_report_not_ready' });
    const restarted = createProcessOnlineAnalysisService(f.options);
    await restarted.start(owner, f.id, { consent: true }); await restarted.wait(f.id);
    assert.equal(f.calls.length, 2, 'visual checkpoints are not charged repeatedly by retry');
  } finally { await f.close(); }
});

test('invalid or changed parts never yield a complete report and readiness includes secure storage', async () => {
  const f = await fixture();
  try {
    assert.equal(createProcessOnlineAnalysisService({ ...f.options, env: {} }).ready(), false);
    assert.equal(createProcessOnlineAnalysisService({ ...f.options, getDb: () => ({ dbReady: false }) }).ready(), false);
    f.files[0].bytes = 201 * 1024 * 1024;
    await assert.rejects(f.service.start(owner, f.id, { consent: true }), { code: 'process_online_analysis_file_too_large' });
    f.files[0].bytes = 100;
    await f.service.start(owner, f.id, { consent: true }); await f.service.wait(f.id);
    assert.equal((await f.service.get(owner, f.id)).status, 'failed');
    assert.equal((await f.service.get(owner, f.id)).errorCode, 'process_online_analysis_invalid_file');
    assert.equal(f.calls.length, 0);
  } finally { await f.close(); }
});

test('losing the database token prevents further AI and stale worker cannot overwrite the newer owner', async () => {
  const f = await fixture([11]);
  let release;
  try {
    const gate = new Promise(resolve => { release = resolve; });
    let entered;
    const started = new Promise(resolve => { entered = resolve; });
    const original = f.ai.read;
    f.ai.read = async source => { entered(); await gate; return original(source); };
    await f.service.start(owner, f.id, { consent: true }); await started;
    const nextToken = randomUUID();
    await f.db.query('UPDATE audita_process_online_requests SET analysis_token=$2 WHERE id=$1', [f.id, nextToken]);
    release(); await f.service.wait(f.id);
    assert.equal(f.calls.length, 1);
    assert.equal(f.summaries.length, 0);
    assert.equal((await f.stored()).row.analysis_token, nextToken);
    assert.equal((await f.stored()).state.report, null);
    assert.equal((await f.stored()).state.coverage.analyzedChunks, 0, 'lost worker cannot persist its result');
  } finally { release?.(); await f.close(); }
});

test('access is rechecked before the next chunk and a changed completed part is rejected during resume', async () => {
  const f = await fixture([11]);
  try {
    const original = f.ai.read;
    f.ai.read = async source => { const value = await original(source); f.setAllowed(false); return value; };
    await f.service.start(owner, f.id, { consent: true }); await f.service.wait(f.id);
    assert.equal(f.calls.length, 1);
    assert.equal(f.summaries.length, 0);
    assert.equal((await f.service.get(owner, f.id)).status, 'partial');
    const originalBytes = await readFile(f.files[0].path);
    // Keep the exact length and valid PDF signature, changing only a private document byte.
    const modified = Buffer.from(originalBytes);
    modified[modified.length - 10] ^= 1;
    await writeFile(f.files[0].path, modified);
    f.setAllowed(true);
    const restarted = createProcessOnlineAnalysisService(f.options);
    await restarted.start(owner, f.id, { consent: true }); await restarted.wait(f.id);
    const result = await restarted.get(owner, f.id);
    assert.equal(result.errorCode, 'process_online_analysis_source_changed');
    assert.equal(result.report, undefined);
    assert.equal(f.calls.length, 1);
  } finally { await f.close(); }
});
