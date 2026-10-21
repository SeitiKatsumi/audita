import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { validateCpf, validateCnpj } from './audit.service.mjs';

const BASE = 'https://api.processonline.com.br/functions/v1';
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ['processing', 'completed', 'failed', 'secret', 'expired'];

function fail(code) {
  const error = new Error('A consulta ao parceiro ProcessOnline não pôde ser concluída.');
  error.code = `process_online_${code}`;
  return error;
}

function cnjNumber(value) {
  if (typeof value !== 'string' || !/^[\d.\-\s]+$/.test(value)) throw fail('invalid_cnj');
  const cnj = value.replace(/\D/g, '');
  if (cnj.length !== 20 || /^(\d)\1+$/.test(cnj)
    || Number(cnj.slice(9, 13)) < 1900 || Number(cnj.slice(9, 13)) > new Date().getFullYear() + 1
    || BigInt(cnj.slice(0, 7) + cnj.slice(9) + cnj.slice(7, 9)) % 97n !== 1n) throw fail('invalid_cnj');
  return cnj;
}

function requestId(value) {
  if (typeof value !== 'string' || !REQUEST_ID.test(value)) throw fail('invalid_request_id');
  return value;
}

function signedUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw fail('invalid_download'); }
  if (typeof value !== 'string' || value.length > 8192 || url.origin !== 'https://api.processonline.com.br'
    || url.username || url.password || url.hash || !url.pathname.startsWith('/storage/v1/object/sign/')) {
    throw fail('invalid_download');
  }
  return url.href;
}

/** Validate the exact raw HTTP body before JSON parsing; the caller persists event/request deduplication. */
export function verifyProcessOnlineWebhook(rawBody, signature, secret, nowMs = Date.now()) {
  if ((!Buffer.isBuffer(rawBody) && typeof rawBody !== 'string') || Buffer.byteLength(rawBody) > 256 * 1024
    || typeof signature !== 'string' || signature.length > 200 || typeof secret !== 'string' || !secret) return false;
  const fields = signature.split(',').map((field) => field.trim());
  const timestamp = fields.find((field) => /^t=\d{10}$/.test(field))?.slice(2);
  const digest = fields.find((field) => /^v1=[0-9a-f]{64}$/.test(field))?.slice(3);
  if (fields.length !== 2 || !timestamp || !digest || !Number.isFinite(nowMs)
    || Math.abs(nowMs / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(digest, 'hex'));
}

// ponytail: transport only; durable ownership/billing belongs to the caller before any route is enabled.
export function createProcessOnlineService({
  apiKey = process.env.PROCESS_ONLINE_API_KEY || '',
  enabled = process.env.PROCESS_ONLINE_ENABLED === 'true',
  fetchImpl = globalThis.fetch,
  timeoutMs = 20_000,
} = {}) {
  const validKey = typeof apiKey === 'string' && /^po_(test|live)_[A-Za-z0-9_-]+$/.test(apiKey);
  const mode = validKey ? (apiKey.startsWith('po_test_') ? 'test' : 'live') : null;
  const ready = enabled === true && validKey;
  const duration = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, 120_000) : 20_000;

  function paidKey(approval, operation, subject) {
    // The caller supplies its authenticated owner and persisted operation, never browser-provided ownership.
    if (!approval || ![approval.tenantId, approval.userId, approval.operationId]
      .every((value) => typeof value === 'string' && /^[\w-]{1,128}$/.test(value))
      || (mode === 'live' && (!Number.isSafeInteger(approval.credits) || approval.credits < 1))) {
      throw fail('cost_approval_required');
    }
    return createHash('sha256').update(JSON.stringify([
      approval.tenantId, approval.userId, approval.operationId, operation, subject,
    ])).digest('hex');
  }

  async function call(endpoint, { body, id, idempotencyKey } = {}) {
    if (!ready) throw fail('not_configured');
    const url = new URL(`${BASE}/${endpoint}`);
    if (id) url.searchParams.set('id', requestId(id));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), duration);
    try {
      const response = await fetchImpl(url.href, {
        method: body ? 'POST' : 'GET', redirect: 'error', signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`, Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw fail(({ 401: 'unauthorized', 402: 'insufficient_credits', 403: 'forbidden', 404: 'not_found',
          409: 'not_ready', 410: 'expired', 422: 'invalid_request', 429: 'rate_limited' })[response.status] || 'unavailable');
      }
      const sandboxPdf = mode === 'test' && endpoint === 'api-download'
        && /^application\/pdf\b/i.test(response.headers.get('content-type') || '');
      if ((!sandboxPdf && !/^application\/json\b/i.test(response.headers.get('content-type') || ''))
        || Number(response.headers.get('content-length')) > MAX_JSON_BYTES) {
        await response.body?.cancel(); throw fail('invalid_response');
      }
      let size = 0;
      const chunks = [];
      for await (const chunk of response.body || []) {
        size += chunk.length;
        if (size > MAX_JSON_BYTES) throw fail('response_too_large');
        chunks.push(chunk);
      }
      if (sandboxPdf) {
        const pdf = Buffer.concat(chunks);
        if (pdf.subarray(0, 5).toString('ascii') !== '%PDF-') throw fail('invalid_pdf');
        return { sandboxPdf: pdf };
      }
      let result;
      try { result = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw fail('invalid_response'); }
      if (!result || typeof result !== 'object' || Array.isArray(result) || result.error) throw fail('invalid_response');
      return result;
    } catch (error) {
      if (error?.code?.startsWith('process_online_')) throw error;
      throw fail(controller.signal.aborted ? 'timeout' : 'unavailable');
    } finally { clearTimeout(timer); }
  }

  return {
    getStatus: () => ({ enabled: enabled === true, ready, mode }),
    async searchDocumento({ documento, approval } = {}) {
      if (typeof documento !== 'string' || !/^[\d.\/\-\s]+$/.test(documento)
        || !(validateCpf(documento) || validateCnpj(documento))) throw fail('invalid_document');
      const digits = documento.replace(/\D/g, '');
      const result = await call('api-search-documento', {
        body: { documento: digits }, idempotencyKey: paidKey(approval, 'search', digits),
      });
      if (!Array.isArray(result.results) || !Number.isSafeInteger(result.total) || result.total < result.results.length
        || !Number.isSafeInteger(result.credits_charged) || ![0, 1].includes(result.credits_charged)) throw fail('invalid_response');
      for (const process of result.results) cnjNumber(process?.numero_cnj);
      return result;
    },
    async verifyCNJ({ cnj } = {}) {
      const number = cnjNumber(cnj);
      const result = await call('api-verify', { body: { cnj: number } });
      if (typeof result.exists !== 'boolean' || (result.cnj && cnjNumber(result.cnj) !== number)) throw fail('invalid_response');
      return result;
    },
    async requestCopy({ cnj, interesse, interesseDetalhe = '', approval } = {}) {
      const number = cnjNumber(cnj);
      if (!['parte', 'advogado', 'arrematante', 'sucessor', 'credor', 'outro'].includes(interesse)
        || typeof interesseDetalhe !== 'string' || interesseDetalhe.length > 500 || /[\u0000-\u001f\u007f]/.test(interesseDetalhe)
        || (interesse === 'advogado' && !/^[A-Z]{2}\s+\d{1,10}[A-Z]?$/i.test(interesseDetalhe.trim()))) throw fail('invalid_interesse');
      const body = { cnj: number, interesse, ...(interesseDetalhe.trim() ? { interesse_detalhe: interesseDetalhe.trim() } : {}) };
      const result = await call('api-create-request', { body, idempotencyKey: paidKey(approval, 'copy', JSON.stringify(body)) });
      requestId(result.request_id);
      if (!STATUSES.includes(result.status) || ![0, 1].includes(result.credits_charged)) throw fail('invalid_response');
      return result;
    },
    async getRequest({ requestId: id } = {}) {
      const result = await call('api-get-request', { id: requestId(id) });
      if (result.request_id !== id || !STATUSES.includes(result.status)
        || ![0, 1].includes(result.credits_charged) || typeof result.refunded !== 'boolean') throw fail('invalid_response');
      if (result.cnj) cnjNumber(result.cnj);
      return result;
    },
    async getDownload({ requestId: id } = {}) {
      const result = await call('api-download', { id: requestId(id) });
      // The approved sandbox returns its sample PDF directly, without a signed manifest.
      if (mode === 'test' && Buffer.isBuffer(result.sandboxPdf)) {
        return { request_id: id, parts_count: 1,
          parts: [{ idx: 1, bytes: result.sandboxPdf.length, testPdf: result.sandboxPdf }] };
      }
      if (result.request_id !== id || !Number.isSafeInteger(result.parts_count) || result.parts_count < 1
        || !Array.isArray(result.parts) || result.parts.length !== result.parts_count) throw fail('invalid_download');
      const parts = [...result.parts].sort((a, b) => a.idx - b.idx);
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].idx !== i + 1 || !Number.isSafeInteger(parts[i].bytes) || parts[i].bytes < 1
          || parts[i].bytes > 200 * 1024 * 1024) throw fail('invalid_download');
        signedUrl(parts[i].url);
      }
      if (signedUrl(result.download_url) !== signedUrl(parts[0].url)
        || !Number.isSafeInteger(result.expires_in) || result.expires_in < 1 || result.expires_in > 3600
        || !Number.isFinite(Date.parse(result.file_expires_at))) throw fail('invalid_download');
      return { ...result, parts };
    },
  };
}
