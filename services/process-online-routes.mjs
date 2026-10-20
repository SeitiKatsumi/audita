import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

const prefix = '/api/process-online';
const idPattern = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const requestPath = new RegExp(`^${prefix}/requests/(${idPattern})(?:/(recover|refresh|analysis|analysis\\.pdf|files/([1-9][0-9]?)))?$`);

function sameOrigin(request) {
  if (request.headers['sec-fetch-site'] === 'cross-site') return false;
  if (!request.headers.origin) return true;
  try { return new URL(request.headers.origin).host === request.headers.host; } catch { return false; }
}

async function body(request, limit, raw = false) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('body_too_large'), { code: 'process_online_body_too_large', status: 413 });
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  if (raw) return buffer;
  try {
    const value = buffer.length ? JSON.parse(buffer.toString('utf8')) : {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw Object.assign(new Error('invalid_json'), { code: 'process_online_invalid_json', status: 400 }); }
}

export function createProcessOnlineRouter({ workflow, analysis, getAuth, sendJson }) {
  return async function route(request, response) {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (path !== prefix && !path.startsWith(prefix + '/')) return false;
    response.setHeader('cache-control', 'private, no-store');
    response.setHeader('x-content-type-options', 'nosniff');
    try {
      if (path === prefix + '/webhook' && request.method === 'POST') {
        const result = await workflow.webhook(await body(request, 256 * 1024, true), request.headers['x-po-signature']);
        sendJson(response, 200, result);
        return true;
      }
      const auth = await getAuth(request);
      if (auth?.unauthorized || !auth?.user?.id || !auth?.tenantId) {
        sendJson(response, 401, { error: 'authentication_required' });
        return true;
      }
      if (request.method === 'POST' && (!sameOrigin(request) || !/^application\/json\b/i.test(request.headers['content-type'] || ''))) {
        sendJson(response, 403, { error: 'same_origin_required' });
        return true;
      }
      const match = path.match(requestPath);
      if (match) match[1] = match[1].toLowerCase();
      if (path === prefix + '/config' && request.method === 'GET') {
        const status = workflow.getStatus();
        sendJson(response, 200, { ...status, cost: { auditaCredits: status.auditaCredits, providerCredits: status.providerCredits }, analysisReady: analysis.ready(), partnerUrl: 'https://processonline.com.br/seja-parceiro' });
      } else if (path === prefix + '/verify' && request.method === 'POST') {
        sendJson(response, 200, await workflow.verify(auth, await body(request, 4096)));
      } else if (path === prefix + '/search' && request.method === 'POST') {
        sendJson(response, 201, await workflow.search(auth, await body(request, 8192)));
      } else if (path === prefix + '/requests' && request.method === 'POST') {
        sendJson(response, 201, await workflow.requestCopy(auth, await body(request, 8192)));
      } else if (path === prefix + '/requests' && request.method === 'GET') {
        const result = await workflow.list(auth);
        sendJson(response, 200, Array.isArray(result) ? { requests: result } : result);
      } else if (match && request.method === 'GET' && !match[2]) {
        sendJson(response, 200, await workflow.get(auth, match[1]));
      } else if (match?.[2] === 'recover' && request.method === 'POST') {
        sendJson(response, 200, await workflow.recover(auth, match[1], await body(request, 1024)));
      } else if (match?.[2] === 'refresh' && request.method === 'POST') {
        await body(request, 1024);
        sendJson(response, 200, await workflow.refresh(auth, match[1]));
      } else if (match?.[2] === 'analysis' && request.method === 'GET') {
        sendJson(response, 200, await analysis.get(auth, match[1]));
      } else if (match?.[2] === 'analysis' && request.method === 'POST') {
        sendJson(response, 202, await analysis.start(auth, match[1], await body(request, 8192)));
      } else if (match?.[2] === 'analysis.pdf' && request.method === 'GET') {
        const pdf = await analysis.pdf(auth, match[1]);
        response.writeHead(200, { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="analise-processo-audita.pdf"', 'content-length': pdf.length });
        response.end(pdf);
      } else if (match?.[3] && request.method === 'GET') {
        const file = await workflow.file(auth, match[1], Number(match[3]));
        response.writeHead(200, { 'content-type': 'application/pdf', 'content-length': file.bytes, 'content-disposition': `attachment; filename="processo-parte-${Number(match[3])}.pdf"` });
        await pipeline(createReadStream(file.path), response);
      } else {
        sendJson(response, 404, { error: 'process_online_route_not_found' });
      }
    } catch (error) {
      if (response.headersSent) { response.destroy(); return true; }
      const code = typeof error.code === 'string' && /^[a-z][a-z0-9_]{2,100}$/.test(error.code) ? error.code : 'process_online_unavailable';
      const status = error.statusCode || error.status || 503;
      sendJson(response, Number.isInteger(status) && status >= 400 && status <= 599 ? status : 503, { error: code });
    }
    return true;
  };
}
