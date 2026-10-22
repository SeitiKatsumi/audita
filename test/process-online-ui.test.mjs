import test from 'node:test';
import assert from 'node:assert/strict';
import { initProcessOnline } from '../process-online.js';

// A deliberately small DOM: assigning innerHTML is an error, including in future edits.
class Element {
  constructor(tag, ownerDocument) {
    this.tagName = tag.toUpperCase(); this.ownerDocument = ownerDocument;
    this.childNodes = []; this.listeners = {}; this.attributes = {}; this.value = '';
    this.checked = false; this.disabled = false; this.hidden = false; this._text = '';
    this.classList = { toggle: (name, enabled) => {
      const names = new Set((this.className || '').split(/\s+/).filter(Boolean));
      if (enabled) names.add(name); else names.delete(name); this.className = [...names].join(' ');
    } };
  }
  set innerHTML(_) { throw new Error('Untrusted HTML is forbidden'); }
  get textContent() { return this._text + this.childNodes.map(child => child.textContent).join(''); }
  set textContent(value) { this._text = String(value); this.childNodes = []; }
  get lastChild() { return this.childNodes.at(-1); }
  append(...nodes) { this.childNodes.push(...nodes); }
  replaceChildren(...nodes) { this._text = ''; this.childNodes = nodes; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); }
  dispatch(name) { for (const handler of this.listeners[name] || []) handler({ preventDefault() {} }); }
  focus() { this.ownerDocument.activeElement = this; }
  scrollIntoView() {}
}
class Document {
  hidden = false;
  listeners = {};
  createElement(tag) { return new Element(tag, this); }
  addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); }
  visibility(hidden) { this.hidden = hidden; for (const handler of this.listeners.visibilitychange || []) handler(); }
}
const descendants = node => [node, ...node.childNodes.flatMap(descendants)];
const find = (node, predicate) => descendants(node).find(predicate);
const named = (node, name) => find(node, item => item.name === name);
const byText = (node, text) => find(node, item => item.tagName === 'BUTTON' && item.textContent === text);
const forms = node => descendants(node).filter(item => item.tagName === 'FORM');
const settle = async () => { for (let n = 0; n < 6; n++) await new Promise(resolve => setImmediate(resolve)); };
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const LIVE = { copyPayment: { checkoutReady: true, unitAmountCents: 4990, maxQuantity: 20 }, enabled: true, ready: true, storageReady: true, mode: 'live', cost: { auditaCredits: 1, providerCredits: 1 } };
const CNJ = '0701379-18.2025.8.01.0013';
function fixture(handler = () => response({}), config = LIVE, requests = [], location = undefined, activeOrders = []) {
  const document = new Document(); const container = document.createElement('div'); const calls = [];
  let authCalls = 0; const navigations = [], documentSearches = [];
  const module = initProcessOnline({ container, location, onDocumentSearch: value => documentSearches.push(value), navigate: url => navigations.push(url), onAuthRequired: () => { authCalls++; }, fetchImpl: async (url, options) => {
    const call = { url, options, body: options.body ? JSON.parse(options.body) : undefined }; calls.push(call);
    if (url.endsWith('/config')) return response(config);
    if (url.endsWith('/search/orders')) return response({orders:activeOrders});
    if (url === '/api/process-online/requests' && !options.method) return response({ requests });
    return handler(call);
  } });
  return { module, container, document, calls, navigations, documentSearches, authCalls: () => authCalls };
}
function approve(container, name) { const check = named(container, name); check.checked = true; check.dispatch('change'); }
function testCnj(sequence) {
  const base = `${String(sequence).padStart(7, '0')}20258260001`;
  const check = String(98n - BigInt(`${base}00`) % 97n).padStart(2, '0');
  return `${base.slice(0,7)}${check}${base.slice(7)}`;
}

test('activation shows simplified forms without a verification or interest form', async () => {
 const f=fixture(()=>response({}));
 await f.module.activate({cnj:CNJ});
 assert.equal(f.calls.filter(call=>call.options.method==='POST').length,0);
 assert.equal(byText(f.container,'Verificar gratuitamente'),undefined);
 assert.equal(named(f.container,'interesse'),undefined);
 assert.equal(named(f.container,'interesseDetalhe'),undefined);
 assert.doesNotMatch(f.container.textContent,/Cada cópia|Cada busca|minha carteira/);
 assert.equal(byText(f.container,'Pagar R$ 49,90 e solicitar cópia').disabled,true);
 f.module.deactivate();
});

test('sandbox example fills CNJ without sending and CPF search delegates to Direct Data', async () => {
  const f = fixture(undefined, { ...LIVE, mode: 'test', searchReady: false });
  await f.module.activate();
  approve(f.container, 'searchConsent');
  named(f.container, 'documento').value = '52998224725';
  assert.equal(byText(f.container, 'Localizar processos').disabled, false);
  forms(f.container)[1].dispatch('submit'); await settle();
  assert.deepEqual(f.documentSearches, [{ documento: '52998224725' }]);
  approve(f.container, 'copyConsent');
  byText(f.container, 'Usar processo de exemplo').dispatch('click');
  assert.equal(named(f.container, 'cnj').value, '0701379-18.2025.8.01.0013');
  assert.equal(named(f.container, 'copyConsent').checked, false);
  assert.equal(f.calls.some(call => call.options.method === 'POST'), false);
  assert.match(f.container.textContent, /Direct Data/);
  f.module.deactivate();
});

test('document lookup requires consent and delegates without a ProcessOnline charge or supplier call', async () => {
  const f = fixture(call => response({id:'order-safe',status:'pending',checkoutUrl:'https://checkout.stripe.com/c/pay/cs_safe'}));
  await f.module.activate({ documento: '529.982.247-25', parentAuditId: 'audit-safe' });
  forms(f.container)[1].dispatch('submit'); await settle();
  assert.equal(f.calls.some(call => call.options.method === 'POST'), false);
  approve(f.container, 'searchConsent'); forms(f.container)[1].dispatch('submit'); await settle();
  assert.deepEqual(f.documentSearches, [{ documento: '52998224725' }]);
  assert.deepEqual(f.navigations, []);
  assert.equal(f.calls.some(call => call.options.method === 'POST'), false);
  assert.equal(f.calls.some(call=>call.url.endsWith('/search')),false);
  assert.match(f.container.textContent,/valor será apresentado antes da contratação/);
  f.module.deactivate();
});

test('a lost paid response retains its operation id for manual retry and prevents a second new paid operation', async () => {
  let attempts = 0;
  const f = fixture(call => {
    if (call.url.endsWith('/requests/checkout')) {
      attempts++;
      if (attempts === 1) throw new Error('connection lost after commit');
      return response({ id: 'order-existing', status: 'pending', checkoutUrl:'https://checkout.stripe.com/c/pay/cs_existing' });
    }
    return response({});
  });
  await f.module.activate({ cnj: CNJ });
  approve(f.container, 'copyConsent'); forms(f.container)[0].dispatch('submit'); await settle();
  assert.equal(attempts, 1);
  assert.equal(byText(f.container, 'Pagar R$ 49,90 e solicitar cópia').disabled, true);
  assert.match(f.container.textContent, /Confira o histórico/);
  forms(f.container)[0].dispatch('submit'); await settle();
  assert.equal(attempts, 1);
  byText(f.container, 'Retomar a mesma operação').dispatch('click'); await settle();
  assert.equal(attempts, 2);
  const calls = f.calls.filter(item => item.url.endsWith('/requests/checkout'));
  assert.deepEqual(calls[0].body, calls[1].body);
  assert.equal(named(f.container, 'copyConsent').checked, false);
  assert.equal(find(f.container, item => item.className === 'process-online-pending').hidden, true);
  f.module.deactivate();
});

test('CNJ copy requires consent and uses its own paid checkout, never the direct copy endpoint', async () => {
 const f=fixture(()=>response({id:'copy-order',kind:'copy',status:'pending',checkoutUrl:'https://checkout.stripe.com/c/pay/cs_copy'}));
 await f.module.activate({cnj:CNJ});
 forms(f.container)[0].dispatch('submit');await settle();assert.equal(f.calls.some(c=>c.options.method==='POST'),false);
 approve(f.container,'copyConsent');forms(f.container)[0].dispatch('submit');await settle();
 const posts=f.calls.filter(c=>c.options.method==='POST');assert.equal(posts.length,1);
 assert.equal(posts[0].url,'/api/process-online/requests/checkout');assert.equal(posts[0].body.cnj,CNJ);
 assert.equal(posts[0].body.approvedAmountCents,4990);
 assert.deepEqual(f.navigations,['https://checkout.stripe.com/c/pay/cs_copy']);
 assert.equal(byText(f.container,'Pagar R$ 49,90 e solicitar cópia').disabled,true);
 assert.equal(byText(f.container,'Localizar processos').disabled,true);
 f.module.deactivate();
});

test('a recoverable copy restored from history uses only its saved ID and requires fresh explicit consent', async () => {
  const request = { id: 'saved-copy', operationId: 'saved-operation', kind: 'copy', cnj: CNJ,
    status: 'review_required', canRecover: true, billing: { state: 'charged', auditaCredits: 1 } };
  const f = fixture(call => response(call.url.endsWith('/recover') ? { ...request, status: 'processing', canRecover: false } : request), LIVE, [request]);
  await f.module.activate(); byText(f.container, 'Abrir').dispatch('click'); await settle();
  assert.equal(f.calls.filter(call => call.options.method === 'POST').length, 0);
  assert.match(f.container.textContent, /não inicia outro pedido/);
  assert.equal(byText(f.container, 'Retomar cópia salva').disabled, true);
  approve(f.container, 'recoveryConsent'); forms(f.container)[2].dispatch('submit'); await settle();
  const posts = f.calls.filter(call => call.options.method === 'POST');
  assert.equal(posts.length, 1); assert.equal(posts[0].url, '/api/process-online/requests/saved-copy/recover');
  assert.deepEqual(posts[0].body, { consent: true, approvedCredits: 0 });
  f.module.deactivate();
});

test('partial analyses display actual coverage and limits, preserve the saved purpose and never offer a complete PDF', async () => {
  const request = { id: 'partial-copy', kind: 'copy', status: 'ready', cnj: CNJ, parts: [] };
  const purpose = 'Revisar os riscos e obrigações do processo.';
  const f = fixture(call => response(call.url.endsWith('/analysis') ? { status: 'partial', purpose,
    coverage: { totalParts: 2, inspectedParts: 1, totalPages: 20, analyzedPages: 12, totalChunks: 4, analyzedChunks: 2, visualChunks: 1, inventoryComplete: false },
    limitations: ['Página visual exige conferência. <script>falha</script>'], report: { complete: true } } : request), { ...LIVE, analysisReady: true }, [request]);
  await f.module.activate(); byText(f.container, 'Abrir').dispatch('click'); await settle();
  assert.match(f.container.textContent, /Análise parcial/);
  assert.match(f.container.textContent, /12 de 20 identificadas/);
  assert.match(f.container.textContent, /contagem de páginas e blocos ainda está sendo identificada/);
  assert.match(f.container.textContent, /Página visual exige conferência/);
  assert.equal(descendants(f.container).some(item => item.tagName === 'SCRIPT'), false);
  assert.equal(descendants(f.container).some(item => item.tagName === 'A' && item.href.endsWith('/analysis.pdf')), false);
  assert.equal(named(f.container, 'purpose').value, purpose);
  assert.equal(byText(f.container, 'Retomar análise dos autos').disabled, true);
  assert.equal(f.calls.filter(call => call.options.method === 'POST').length, 0);
  f.module.deactivate();
});

test('running analysis has an indeterminate status and polls only its saved analysis every 30 seconds', async () => {
  const timers = new Map(); let timerId = 0;
  const realSetTimeout = globalThis.setTimeout; const realClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = (handler, delay) => { const id = ++timerId; timers.set(id, { handler, delay }); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  try {
    const request = { id: 'running-copy', kind: 'copy', status: 'ready', cnj: CNJ, parts: [] };
    const f = fixture(call => response(call.url.endsWith('/analysis') ? { status: 'running', current: 'Lendo parte 1', progress: 19 } : request), { ...LIVE, analysisReady: true }, [request]);
    await f.module.activate(); byText(f.container, 'Abrir').dispatch('click'); await settle();
    assert.match(f.container.textContent, /Lendo parte 1/);
    assert.equal(byText(f.container, 'Analisar cópia com IA'), undefined);
    assert.equal(f.container.textContent.includes('19%'), false);
    assert.equal(timers.size, 1);
    const [scheduledId, tick] = [...timers.entries()][0]; assert.equal(tick.delay, 30000);
    timers.delete(scheduledId); tick.handler(); await settle();
    assert.equal(f.calls.filter(call => call.url.endsWith('/analysis')).length, 2);
    assert.equal(f.calls.filter(call => call.options.method === 'POST').length, 0);
    f.document.visibility(true); assert.equal(timers.size, 0);
    f.module.deactivate();
  } finally { globalThis.setTimeout = realSetTimeout; globalThis.clearTimeout = realClearTimeout; }
});

test('ready multipart copies expose only their exact private API links and AI still requires separate consent', async () => {
  const request = { id: 'copy-safe', kind: 'copy', status: 'ready', cnj: CNJ, parts: [
    { index: 1, url: '/api/process-online/requests/copy-safe/files/1' },
    { index: 2, url: '/api/process-online/requests/copy-safe/files/2' },
    { index: 3, url: 'https://attacker.invalid/steal' },
    { index: 4, url: '/api/process-online/requests/copy-safe/files/4?token=private' },
  ] };
  const f = fixture(call => call.url.endsWith('/copy-safe') ? response(request) : response({ status: 'not_started' }), { ...LIVE, analysisReady: true }, [request]);
  await f.module.activate();
  byText(f.container,'Abrir').dispatch('click'); await settle();
  const links = descendants(f.container).filter(item => item.tagName === 'A' && item.textContent.startsWith('Baixar PDF'));
  assert.equal(links.length, 2);
  assert.deepEqual(links.map(item => item.href), ['/api/process-online/requests/copy-safe/files/1', '/api/process-online/requests/copy-safe/files/2']);
  assert.ok(links.every(item => item.rel.includes('noopener')));
  assert.equal(f.calls.some(call => call.url.endsWith('/analysis') && call.options.method==='POST'), false);
  assert.equal(byText(f.container, 'Analisar cópia com IA').disabled, true);
  const approval = named(f.container, 'analysisConsent'); approval.checked = true; approval.dispatch('change');
  forms(f.container)[2].dispatch('submit'); await settle();
  assert.equal(f.calls.filter(call => call.url.endsWith('/analysis') && call.options.method === 'POST').length, 1);
  f.module.deactivate();
});

test('disabled provider retains forms and partner activation route while sandbox explains zero real payments', async () => {
  const off = fixture(undefined, { enabled: false, ready: false, storageReady: true, mode: null });
  await off.module.activate();
  assert.match(off.container.textContent, /Integração em ativação/);
  const partner = descendants(off.container).find(item => item.tagName === 'A');
  assert.equal(partner.href, 'https://processonline.com.br/seja-parceiro/');
  approve(off.container, 'copyConsent');
  assert.equal(named(off.container, 'copyCheckout').disabled, true);
  assert.equal(forms(off.container).length, 2);
  off.module.deactivate();
  const sandbox = fixture(undefined, { ...LIVE, mode: 'test', cost: { auditaCredits: 0, providerCredits: 1 } });
  await sandbox.module.activate();
  assert.match(sandbox.container.textContent, /sem pagamento real/);
  assert.match(sandbox.container.textContent, /canários/);
  sandbox.module.deactivate();
});

test('refreshing a known copy is throttled and visibility/deactivation stop polling', async () => {
  const timers = new Map(); let timerId = 0;
  const realSetTimeout = globalThis.setTimeout; const realClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = (handler, delay) => { const id = ++timerId; timers.set(id, { handler, delay }); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  try {
    const request = { id: 'copy-pending', kind: 'copy', status: 'processing', cnj: CNJ };
    const f = fixture(() => response(request),LIVE,[request]);
    await f.module.activate(); byText(f.container,'Abrir').dispatch('click'); await settle();
    assert.equal(timers.size, 1); assert.equal([...timers.values()][0].delay, 30000);
    byText(f.container, 'Conferir andamento').dispatch('click'); await settle();
    byText(f.container, 'Conferir andamento').dispatch('click'); await settle();
    assert.equal(f.calls.filter(call => call.url.endsWith('/refresh')).length, 1);
    assert.deepEqual(f.calls.find(call => call.url.endsWith('/refresh')).body, {});
    f.document.visibility(true); assert.equal(timers.size, 0);
    f.document.visibility(false); assert.equal(timers.size, 1);
    f.module.deactivate(); assert.equal(timers.size, 0);
  } finally { globalThis.setTimeout = realSetTimeout; globalThis.clearTimeout = realClearTimeout; }
});

test('reset clears private details, inputs, pending operations and context without making requests', async () => {
  const request = { id: 'owner-a-request', kind: 'search', status: 'completed', results: [],
    resultData: { private: 'PRIVATE-OWNER-A-FIXTURE' } };
  const f = fixture(() => response(request), LIVE, [request]);
  await f.module.activate({ cnj: CNJ, documento: '52998224725', parentAuditId: 'audit-owner-a' });
  byText(f.container, 'Abrir').dispatch('click'); await settle();
  assert.match(f.container.textContent, /PRIVATE-OWNER-A-FIXTURE/);
  const before = f.calls.length; f.module.reset();
  assert.equal(f.calls.length, before);
  assert.equal(f.container.textContent.includes('PRIVATE-OWNER-A-FIXTURE'), false);
  assert.equal(named(f.container, 'cnj').value, '');
  assert.equal(named(f.container, 'documento').value, '');
  assert.equal(find(f.container, item => item.className === 'process-online-details').hidden, true);
  assert.equal(find(f.container, item => item.className === 'process-online-pending').hidden, true);
  assert.equal(byText(f.container, 'Localizar processos').disabled, true);
  f.module.deactivate();
});

test('refreshing a history that no longer contains the selection removes its private details', async () => {
  const request = { id: 'removed-request', kind: 'search', status: 'completed', results: [], resultData: { private: 'PRIVATE-REMOVED-FIXTURE' } };
  const requests = [request]; const f = fixture(() => response(request), LIVE, requests);
  await f.module.activate(); byText(f.container, 'Abrir').dispatch('click'); await settle();
  assert.match(f.container.textContent, /PRIVATE-REMOVED-FIXTURE/);
  requests.length = 0; byText(f.container, 'Atualizar histórico').dispatch('click'); await settle();
  assert.equal(f.container.textContent.includes('PRIVATE-REMOVED-FIXTURE'), false);
  assert.equal(find(f.container, item => item.className === 'process-online-details').hidden, true);
  f.module.deactivate();
});

test('a current 401 clears all owner data before requesting authentication', async () => {
  const request = { id: 'expired-request', kind: 'search', status: 'completed', results: [], resultData: { private: 'PRIVATE-EXPIRED-FIXTURE' } };
  let expired = false;
  const f = fixture(() => expired ? response({ error: 'authentication_required' }, 401) : response(request), LIVE, [request]);
  await f.module.activate({ documento: '52998224725' }); byText(f.container, 'Abrir').dispatch('click'); await settle();
  expired = true; byText(f.container, 'Conferir andamento').dispatch('click'); await settle();
  assert.equal(f.authCalls(), 1);
  assert.equal(f.container.textContent.includes('PRIVATE-EXPIRED-FIXTURE'), false);
  assert.equal(named(f.container, 'documento').value, '');
  assert.equal(find(f.container, item => item.className === 'process-online-details').hidden, true);
  f.module.deactivate();
});

test('late old-owner success and 401 cannot repopulate or clear a new owner after reset', async () => {
  for (const oldStatus of [200, 401]) {
    const ownerA = { id: 'owner-a-pending', kind: 'search', status: 'completed', results: [], resultData: { private: 'PRIVATE-LATE-A-FIXTURE' } };
    const ownerB = { id: 'owner-b-current', kind: 'search', status: 'completed', results: [], resultData: { private: 'PRIVATE-CURRENT-B-FIXTURE' } };
    const requests = [ownerA]; let resolveOld;
    const f = fixture(call => call.url.endsWith('/owner-a-pending')
      ? new Promise(resolve => { resolveOld = resolve; }) : response(ownerB), LIVE, requests);
    await f.module.activate(); byText(f.container, 'Abrir').dispatch('click'); await settle();
    f.module.reset(); requests.splice(0, requests.length, ownerB);
    await f.module.activate(); byText(f.container, 'Abrir').dispatch('click'); await settle();
    assert.match(f.container.textContent, /PRIVATE-CURRENT-B-FIXTURE/);
    resolveOld(response(oldStatus === 200 ? ownerA : { error: 'authentication_required' }, oldStatus)); await settle();
    assert.equal(f.container.textContent.includes('PRIVATE-LATE-A-FIXTURE'), false);
    assert.match(f.container.textContent, /PRIVATE-CURRENT-B-FIXTURE/);
    assert.equal(f.authCalls(), 0);
    f.module.deactivate();
  }
});

test('checkout return only reads the owner order and renders confirmed search results safely', async () => {
 const id='11111111-1111-4111-8111-111111111111';
 const payload='<img src=x onerror=globalThis.compromised=true>';
 const f=fixture(call=>call.url.endsWith('/'+id)?response({id,status:'fulfilled',request:{id:'search-safe',kind:'search',status:'completed',total:1,results:[{numero_cnj:CNJ,classe:payload}]}}):response({orders:[]}),LIVE,[],{search:'?process_search_order='+id});
 await f.module.activate();
 assert.equal(f.calls.some(call=>call.options.method==='POST'),false);
 assert.match(f.container.textContent,/<img src=x onerror=/);
 assert.equal(descendants(f.container).some(item=>item.tagName==='IMG'),false);
 byText(f.container,'Preparar solicitação de cópia').dispatch('click');
 assert.equal(named(f.container,'cnj').value,CNJ);
 assert.equal(named(f.container,'copyConsent').checked,false);
 f.module.deactivate();
});
test('reopening resumes an unfinished payment without creating another checkout', async () => {
 const order={id:'11111111-1111-4111-8111-111111111111',status:'pending',checkoutUrl:'https://checkout.stripe.com/c/pay/cs_resume'};
 const f=fixture(()=>response({}),LIVE,[],undefined,[order]);await f.module.activate({cnj:CNJ});
 approve(f.container,'copyConsent');assert.equal(named(f.container,'copyCheckout').disabled,true);
 assert.ok(find(f.container,item=>item.tagName==='A'&&item.href===order.checkoutUrl));
 assert.equal(f.calls.some(call=>call.options.method==='POST'),false);
 f.module.reset();assert.doesNotMatch(f.container.textContent,/11111111-1111/);f.module.deactivate();
});

test('several valid CNJs require explicit selection and consent, charging only the selected copies at configured unit price', async () => {
  const first = testCnj(1), second = testCnj(2);
  const f = fixture(() => response({ id: 'batch-order', status: 'pending', checkoutUrl: 'https://checkout.stripe.com/c/pay/batch' }),
    { ...LIVE, copyPayment: { checkoutReady: true, unitAmountCents: 6250, maxQuantity: 20 } });
  await f.module.activate({ cnjs: [first, second, first, '123', '0000001-91.2020.8.26.0100'], parentAuditId: 'origin-audit' });
  assert.equal(descendants(f.container).filter(item => item.name?.startsWith('process-')).length, 2);
  assert.equal(named(f.container, 'cnj').value, '');
  assert.equal(named(f.container, 'copyCheckout').disabled, true);
  assert.equal(f.calls.some(call => call.options.method === 'POST'), false);
  approve(f.container, `process-${first}`); approve(f.container, 'copyConsent');
  approve(f.container, `process-${second}`);
  assert.equal(named(f.container, 'cnj').required, false);
  assert.equal(named(f.container, 'copyConsent').checked, false);
  assert.equal(named(f.container, 'copyCheckout').disabled, true);
  assert.match(f.container.textContent, /R\$ 62,50 por cópia.*2 selecionada\(s\).*Total: R\$ 125,00/);
  approve(f.container, 'copyConsent'); forms(f.container)[0].dispatch('submit'); await settle();
  const post = f.calls.find(call => call.options.method === 'POST');
  assert.equal(post.url, '/api/process-online/requests/checkout');
  assert.deepEqual(post.body.cnjs.map(value => value.replace(/\D/g, '')), [first, second]);
  assert.equal(post.body.cnj, undefined); assert.equal(post.body.approvedAmountCents, 12500);
  assert.equal(post.body.parentAuditId, 'origin-audit'); assert.equal(post.body.consent, true);
  assert.deepEqual(f.navigations, ['https://checkout.stripe.com/c/pay/batch']);
  f.module.deactivate();
});

test('the batch limit prevents a 21st selection and route changes clear choices and authorization', async () => {
  const numbers = Array.from({ length: 21 }, (_, index) => testCnj(index + 1));
  const f = fixture(); await f.module.activate({ cnjs: numbers, parentAuditId: 'previous-audit' });
  for (const number of numbers) approve(f.container, `process-${number}`);
  assert.equal(named(f.container, `process-${numbers[20]}`).checked, false);
  assert.match(f.container.textContent, /Selecione até 20 processos por pagamento/);
  assert.match(f.container.textContent, /20 selecionada\(s\).*Total: R\$ 998,00/);
  approve(f.container, 'copyConsent');
  f.module.deactivate(); await f.module.activate({ cnjs: numbers });
  assert.equal(descendants(f.container).filter(item => item.name?.startsWith('process-') && item.checked).length, 0);
  assert.equal(named(f.container, 'copyConsent').checked, false);
  assert.equal(named(f.container, 'copyCheckout').disabled, true);
  f.module.reset(); assert.equal(descendants(f.container).some(item => item.name?.startsWith('process-')), false);
  assert.equal(f.calls.some(call => call.options.method === 'POST'), false); f.module.deactivate();
});

test('the direct CNJ clears batch selection and missing pricing never falls back to a hardcoded price', async () => {
  const first = testCnj(1), f = fixture(undefined, { ...LIVE, copyPayment: { checkoutReady: true } });
  await f.module.activate({ cnjs: [first] }); approve(f.container, `process-${first}`);
  named(f.container, 'cnj').value = CNJ; named(f.container, 'cnj').dispatch('input');
  assert.equal(named(f.container, 'cnj').required, true);
  assert.equal(named(f.container, `process-${first}`).checked, false);
  approve(f.container, 'copyConsent'); forms(f.container)[0].dispatch('submit'); await settle();
  assert.equal(named(f.container, 'copyCheckout').disabled, true);
  assert.doesNotMatch(f.container.textContent, /49,90/);
  assert.match(f.container.textContent, /valor das cópias ainda não está disponível/);
  assert.equal(f.calls.some(call => call.options.method === 'POST'), false); f.module.deactivate();
});

test('a fulfilled batch payment restores all saved requests without another checkout or supplier request', async () => {
  const id = '22222222-2222-4222-8222-222222222222';
  const requests = [
    { id: 'copy-one', kind: 'copy', cnj: CNJ, status: 'processing' },
    { id: 'copy-two', kind: 'copy', cnj: testCnj(2), status: 'processing' },
  ];
  const f = fixture(() => response({ id, status: 'fulfilled', requests }), LIVE, [], { search: `?process_search_order=${id}` });
  await f.module.activate();
  assert.equal(descendants(f.container).filter(item => item.className === 'process-online-history-item').length, 2);
  assert.equal(f.calls.some(call => call.options.method === 'POST'), false);
  assert.match(f.container.textContent, /Pagamento confirmado/); f.module.deactivate();
});
