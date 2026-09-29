import { randomUUID, createHash } from 'node:crypto';
import { readFile, lstat, realpath } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { createRequire } from 'node:module';
import { getPdfRoot } from './storage.service.mjs';
import { sellerReadingSchema } from './seller-review-ai.mjs';
import { sellerReportPdf } from './seller-review-pdf.mjs';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const plain = text => String(text || '').replace(/\s+/g, ' ').trim();
const fail = (code, status = 400) => { throw Object.assign(new Error(code), { code, status }); };
const scopeNotice = 'Análise limitada às fontes selecionadas e à data da coleta. Não substitui conferência jurídica, matrícula atualizada do imóvel, ônus, situação conjugal, poderes de representação ou débitos próprios do imóvel. Ausência de ocorrência em uma fonte não comprova ausência geral de dívidas.';

export async function extractSellerText(buffer) {
  const parser = createRequire(import.meta.url)('pdf-parse/lib/pdf-parse.js');
  let needsVision = false;
  const parsed = await parser(new Uint8Array(buffer), { pagerender: async page => {
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join(' ');
    if (plain(text).length < 80) needsVision = true;
    return text;
  } });
  return { text: parsed.text || '', needsVision };
}

export function sellerSources(audit) {
  return (audit.resultados || []).flatMap(execution => {
    const rows = execution.dados?.certidoes;
    return (rows?.length ? rows : [{ tipo: execution.fonte, status: execution.status, rawText: execution.rawText, details: execution.dados, pdfPath: execution.pdfUrl }])
      .map((row, index) => ({
        id: `${execution.fonte}:${index}`, title: row.tipo || execution.fonte,
        status: row.status, kind: row.kind || 'certificate', scope: row.scope || row.uf || 'Conforme documento',
        checkedAt: row.checkedAt || execution.finishedAt || audit.updatedAt,
        identityVerified: row.evidenceIdentityVerified === true,
        details: row.evidenceData && Object.keys(row.evidenceData).length ? row.evidenceData : row.details || {}, dataLimited: row.evidenceDataLimited === true,
        summary: row.summary || '', limitation: row.limitation || '', pdfPath: row.pdfPath || '',
        text: row.rawText || '', provider: row.provider || execution.fonte,
        url: row.pdfPath ? `/audit/${audit.consultaId}/documents/${encodeURIComponent(execution.fonte)}/${index}` : '',
      }));
  });
}

export async function readSellerPdf(path, root = getPdfRoot()) {
  if (dirname(resolve(path)) !== resolve(root)) fail('invalid_evidence_path', 422);
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 20 * 1024 * 1024 || dirname(await realpath(path)) !== await realpath(root)) fail('invalid_evidence_path', 422);
  const buffer = await readFile(path);
  if (buffer.subarray(0, 5).toString() !== '%PDF-') fail('invalid_evidence_pdf', 422);
  return buffer;
}

export function validateSellerReading(value, source, text, scanned = false) {
  const reading = sellerReadingSchema.parse(value);
  const evidence = plain(`${text} ${JSON.stringify(source.details)}`);
  if (!scanned && reading.findings.some(f => !evidence.includes(plain(f.quote)))) fail('ungrounded_finding', 422);
  if (!scanned && [reading.issuedAt, reading.validUntil, ...reading.findings.flatMap(f => [f.amount, f.date])].filter(Boolean).some(value => !evidence.includes(plain(value)))) fail('ungrounded_value', 422);
  if (reading.outcome === 'occurrences' && !reading.findings.length) fail('missing_finding', 422);
  if (reading.identity !== 'compatible') {
    reading.outcome = 'inconclusive';
    reading.limitations.push(reading.identity === 'mismatch' ? 'Identidade divergente: não atribuir os apontamentos ao vendedor sem conferência.' : 'Identidade não confirmada nesta leitura; conferir documento e sujeito.');
  }
  if (source.dataLimited) {
    reading.outcome = 'inconclusive';
    reading.limitations.push('O retorno da fonte excedeu o limite de dados. A leitura não abrange todo o retorno.');
  }
  return reading;
}

export function createSellerReviewService({ getDb, auditService, ai, readPdf, extractText = extractSellerText, now = () => new Date() }) {
  const active = new Map();
  function pool() { const db = getDb(); if (!db?.dbReady || !db.pool) fail('seller_storage_unavailable', 503); return db.pool; }
  async function access(id, auth) {
    if (!auth?.user?.id || auth.unauthorized) fail('authentication_required', 401);
    const row = (await pool().query('SELECT request_payload, document_masked FROM audita_audits WHERE public_id=$1 AND tenant_id=$2 AND requested_by_user_id=$3', [id, auth.tenantId, auth.user.id])).rows[0];
    if (!row) fail('seller_analysis_not_found', 404);
    return row;
  }
  const loadPdf = readPdf || (async (path, auth) => {
    const originId = basename(path).match(/^([0-9a-fA-F-]{36})-/)?.[1];
    if (!originId) fail('invalid_evidence_path', 422);
    // Cached documents may belong to an older audit, but must still belong to this exact user and tenant.
    await access(originId, auth);
    return readSellerPdf(path);
  });
  function view(stored) {
    if (!stored) return { status: 'not_started', progress: 0, aiReady: ai.ready() };
    const { token, fingerprint, checkpoints, ...publicState } = stored;
    if (stored.status === 'running' && now() - new Date(stored.updatedAt) > 180000) return { ...publicState, status: 'interrupted', message: 'A análise foi interrompida. Retome sem refazer as consultas.', aiReady: ai.ready() };
    return { ...publicState, aiReady: ai.ready() };
  }
  async function get(id, auth) { return view((await access(id, auth)).request_payload.sellerReview); }
  async function save(id, token, state) {
    state.updatedAt = now().toISOString();
    const result = await pool().query("UPDATE audita_audits SET request_payload=jsonb_set(request_payload,'{sellerReview}',$3::jsonb) WHERE public_id=$1 AND request_payload->'sellerReview'->>'token'=$2 RETURNING id", [id, token, JSON.stringify(state)]);
    if (!result.rows.length) fail('seller_review_replaced', 409);
  }
  async function start(id, auth, request, consent) {
    const row = await access(id, auth);
    if (consent !== true && row.request_payload.sellerAiConsent !== true) fail('seller_ai_consent_required');
    const audit = await auditService.findAudit(id, request);
    if (!audit || audit.unauthorized) fail('seller_analysis_not_found', 404);
    if (!audit.resultados?.length || audit.resultados.some(r => ['pending', 'running', 'queued'].includes(r.status))) fail('seller_collection_pending', 409);
    if (audit.resultados.some(r => !['tjdft', 'seller_documents'].includes(r.fonte))) fail('not_seller_analysis', 422);
    const sources = sellerSources(audit);
    const fingerprint = digest(sources);
    const previous = row.request_payload.sellerReview;
    if (previous?.status === 'completed' && previous.fingerprint === fingerprint && !previous.report.sources.some(s => s.status === 'unread')) return view(previous);
    if (active.has(id)) return get(id, auth);
    if (!ai.ready()) fail('seller_ai_unavailable', 503);
    if (sources.length > 300) fail('seller_too_many_sources', 422);
    const state = { token: randomUUID(), fingerprint, status: 'running', progress: 0, completed: 0, total: sources.length, current: 'Preparando documentos', startedAt: now().toISOString(), updatedAt: now().toISOString(), checkpoints: previous?.fingerprint === fingerprint ? previous.checkpoints || {} : {}, report: null };
    const claimed = await pool().query(`UPDATE audita_audits SET request_payload=jsonb_set(jsonb_set(request_payload,'{sellerAiConsent}','true'::jsonb),'{sellerReview}',$4::jsonb)
      WHERE public_id=$1 AND tenant_id=$2 AND requested_by_user_id=$3
      AND (request_payload->'sellerReview'->>'status' IS DISTINCT FROM 'running' OR (request_payload->'sellerReview'->>'updatedAt')::timestamptz < $5::timestamptz)
      RETURNING id`, [id, auth.tenantId, auth.user.id, JSON.stringify(state), new Date(now() - 180000).toISOString()]);
    if (!claimed.rows.length) return get(id, auth);
    // ponytail: two readers per report; database lease prevents duplicate work for the same audit across processes.
    const job = run(id, auth, audit, sources, state).finally(() => active.delete(id));
    active.set(id, job);
    return view(state);
  }
  async function run(id, auth, audit, sources, state) {
    let write = Promise.resolve(), stopped = false;
    const persist = () => { write = write.then(() => save(id, state.token, state)); return write; };
    const heartbeat = setInterval(() => { if (!stopped) persist().catch(() => { stopped = true; }); }, 30000);
    heartbeat.unref?.();
    try {
      let cursor = 0;
      const results = new Array(sources.length);
      async function worker() {
        while (cursor < sources.length && !stopped) {
          const index = cursor++, source = sources[index];
          state.current = source.title;
          const { pdfPath, details, text: originalText, ...meta } = source;
          const prior = state.checkpoints[source.id];
          if (prior?.status === 'analyzed') results[index] = prior;
          else if (source.status !== 'success') results[index] = { ...meta, status: 'unavailable', message: 'Fonte sem resultado válido. Não permite concluir sobre regularidade.' };
          else {
            try {
              let text = originalText, buffer, needsVision = false;
              if (pdfPath) {
                buffer = await loadPdf(pdfPath, auth);
                const extraction = await extractText(buffer);
                text = typeof extraction === 'string' ? extraction : extraction.text;
                needsVision = extraction.needsVision === true;
              }
              const scanned = Boolean(buffer && (needsVision || plain(text).length < 80));
              if (!buffer && !plain(text) && !Object.keys(details).length) fail('empty_evidence', 422);
              if (plain(text).length + JSON.stringify(details).length > 180000) fail('source_too_large', 422);
              const reading = validateSellerReading(await ai.read({ id: source.id, title: source.title, scope: source.scope, subject: rowSubject(audit), identityVerified: source.identityVerified, checkedAt: source.checkedAt, analysisDate: now().toISOString(), details, text, ...(scanned ? { buffer } : {}) }, auth), source, text, scanned);
              results[index] = { ...meta, status: 'analyzed', method: scanned ? 'Leitura visual por IA; confira a transcrição no original' : 'Texto e dados da fonte', ...reading };
            } catch {
              results[index] = { ...meta, status: 'unread', message: 'Não foi possível concluir a leitura desta fonte. Confira o original ou tente novamente.', outcome: 'inconclusive' };
            }
          }
          state.checkpoints[source.id] = results[index];
          state.completed++;
          state.progress = Math.round(state.completed / Math.max(1, state.total) * 95);
          await persist();
        }
      }
      await Promise.all([worker(), worker()]);
      if (stopped) throw new Error('review_interrupted');
      const findings = results.flatMap(source => (source.findings || []).map(f => ({ ...f, sourceId: source.id, sourceTitle: source.title, identity: source.identity })));
      const analyzed = results.filter(r => r.status === 'analyzed').length;
      const gaps = results.filter(r => r.status !== 'analyzed' || r.outcome === 'inconclusive');
      const report = { id, generatedAt: now().toISOString(), subject: rowSubject(audit), scopeNotice, sources: results, findings, analyzed, total: results.length, gaps: gaps.length,
        conclusion: !analyzed ? 'Não foi possível concluir a análise documental.' : gaps.length ? 'Análise com lacunas: há fontes que precisam de complementação ou conferência.' : findings.some(f => f.priority !== 'information') ? 'Foram identificados pontos que exigem conferência antes da negociação.' : 'Não foram identificados apontamentos restritivos no material analisado. Observe o alcance das fontes.',
      };
      state.report = report;
      state.status = analyzed ? 'completed' : 'failed';
      state.progress = analyzed ? 100 : 0;
      state.current = analyzed ? 'Relatório disponível' : 'Leitura não concluída';
      await persist();
    } catch {
      stopped = true;
      state.status = 'failed';
      state.current = 'Análise interrompida. Retome sem refazer as consultas.';
      await save(id, state.token, state).catch(() => {});
    } finally { stopped = true; clearInterval(heartbeat); }
  }
  async function pdf(id, auth) {
    const row = await access(id, auth);
    const state = row.request_payload.sellerReview;
    if (state?.status !== 'completed' || !state.report) fail('seller_report_not_ready', 409);
    return sellerReportPdf(state.report);
  }
  return { get, start, pdf, ready: () => ai.ready() && Boolean(getDb()?.dbReady), wait: id => active.get(id) };
}

function rowSubject(audit) { return { name: audit.subjectName || 'Vendedor da consulta', document: audit.documento }; }
