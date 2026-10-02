// Local UI fixture: fictional documents/access, no database, Stripe or Directus calls.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const index = await readFile(new URL('index.html', root), 'utf8');
const content = index.slice(index.indexOf('<section class="services-page'), index.indexOf('<dialog class="charge-faq-dialog ir-diseases-dialog" id="irDiseasesDialog"')).replace('services-page page-hidden', 'services-page');
const allowed = new Set(['styles.css', 'chat-subscription.css', 'services-catalog.js', 'chat-subscription.js']);
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const mode = new URL(req.headers.referer || 'http://127.0.0.1').searchParams.get('mode') || 'guest';
  const json = (status, data) => { res.writeHead(status, {'content-type':'application/json'}); res.end(JSON.stringify(data)); };
  if (url.pathname === '/api/jurisprudence') {
    if (mode === 'guest') return json(401, {});
    if (mode === 'unpaid' || (mode === 'revoked' && url.searchParams.has('view'))) return json(403, {});
    if (mode === 'unavailable' && url.searchParams.has('uf')) return json(503, {});
    if (url.searchParams.get('view') === 'read') return json(200, {uf: url.searchParams.get('uf'), reportSource:'Relatório fictício', records: [{row:2, tribunal:'TJSP — Fictício', process:'FICTICIO-001', decision:'Seguro fictício <script>alert(1)</script>', outcome:'Não validado', notes:'', amount:'Não informado'}], report:[{type:'paragraph',text:'Texto original fictício.'},{type:'table',rows:[['Processo','Resultado'],['FICTICIO-001','Não validado']]}]});
    if (url.searchParams.has('order')) { res.writeHead(200, {'content-type':'application/pdf'}); return res.end('%PDF-1.7\nfictional fixture only'); }
    return json(200, url.searchParams.has('uf') ? { uf:'SP', files:[1,2].map(order => ({title:`Decisão fictícia ${order}`,downloadUrl:`/api/jurisprudence?uf=SP&order=${order}`})) } : { states:['SP','RJ'] });
  }
  if (url.pathname === '/api/billing/plans') return json(200, { chatPlans: [], billing: {} });
  if (url.pathname === '/api/chat/access') return json(200, {access:{active:false}});
  if (url.pathname === '/api/billing/subscription') return json(200, {});
  if (url.pathname.startsWith('/api/')) return json(405, {error:'fixture_read_only'});
  if (url.pathname === '/') {
    res.writeHead(200, {'content-type':'text/html; charset=utf-8'});
    return res.end(`<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="chat-subscription.css"><body style="padding:24px"><p>PRÉVIA FICTÍCIA — sem pagamentos ou documentos reais</p><nav>${['guest','unpaid','paid','revoked','unavailable'].map(m=>`<a href="?mode=${m}">${m}</a>`).join(' · ')}</nav>${content}<form id="chatForm" hidden><input id="chatInput"></form><script type="module">import {initServicesCatalog} from './services-catalog.js'; import {initChatSubscription} from './chat-subscription.js'; const mode=new URL(location.href).searchParams.get('mode')||'guest'; const subscription=initChatSubscription({getAuthState:()=>mode==='guest'?{}:{user:{id:'fixture',tenant:{id:'fixture'}}},requestLogin:()=>{}}); initServicesCatalog(undefined,{openPlans:()=>subscription.open()});</script></body></html>`);
  }
  const name = url.pathname.slice(1);
  if (!allowed.has(name) && !/^assets\/[a-zA-Z0-9_./-]+\.(svg|png)$/.test(name)) { res.writeHead(404); return res.end(); }
  if (name.includes('..')) { res.writeHead(404); return res.end(); }
  try {
    const body = await readFile(new URL(name, root));
    res.writeHead(200, {'content-type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.svg')?'image/svg+xml':'image/png'});
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(3091, '127.0.0.1', () => console.log('Fictional jurisprudence fixture: http://127.0.0.1:3091'));
