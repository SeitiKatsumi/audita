import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createProcessOnlineRouter } from '../services/process-online-routes.mjs';

test('ProcessOnline HTTP preserves auth, origin, raw signatures and private responses', async t => {
  const calls = [];
  const workflow = {
    getStatus: () => ({ ready: false, mode: null }), list: async () => [],
    verify: async (auth, input) => { calls.push(['verify', auth.user.id, input]); return { exists: true }; },
    recover:async(auth,id,input)=>{calls.push(['recover',id,input]);return{id};},
    search: async () => { calls.push(['paid']); return { id: 'safe' }; },
    webhook: async (buffer, signature) => { calls.push(['hook', buffer.toString(), signature]); return { accepted: true }; },
  };
  const route = createProcessOnlineRouter({ workflow, payments: { config:async()=>({amountCents:4990,checkoutReady:false,copyPayment:{unitAmountCents:6990,amountCents:6990,maxQuantity:20,checkoutReady:true}}), checkout:async(auth,input,kind)=>({id:input.operationId,kind,amountCents:4990,cnjs:input.cnjs}), get:async(auth,id)=>({id,status:'pending'}), active:async()=>({orders:[]}) }, analysis: { ready: () => false },
    getAuth: async req => req.headers.authorization === 'test' ? { tenantId: 7, user: { id: 8 } } : { unauthorized: true },
    sendJson: (res, status, data) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); },
  });
  const server = createServer((req, res) => { route(req, res).then(handled => { if (!handled) { res.writeHead(404); res.end(); } }); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base + '/api/process-online/requests')).status, 401);
  const headers = { authorization: 'test', 'content-type': 'application/json' };
  assert.equal((await fetch(base + '/api/process-online/search', { method: 'POST', headers: { ...headers, origin: 'https://foreign.invalid' }, body: '{}' })).status, 403);
  assert.equal((await fetch(base + '/api/process-online/search', { method: 'POST', headers, body: 'null' })).status, 400);
  assert.equal((await fetch(base + '/api/process-online/search', { method: 'POST', headers, body: JSON.stringify({ padding: 'x'.repeat(9000) }) })).status, 413);
  assert.equal((await fetch(base + '/api/process-online/search', {method:'POST',headers,body:'{}'})).status,402);
  const checkout = await fetch(base + '/api/process-online/search/checkout',{method:'POST',headers,body:'{"operationId":"test"}'});
  assert.equal(checkout.status,201); assert.equal((await checkout.json()).amountCents,4990);
  assert.equal((await fetch(base + '/api/process-online/search/checkout',{method:'POST',headers:{...headers,origin:'https://foreign.invalid'},body:'{}'})).status,403);
  const copyCheckout=await fetch(base+'/api/process-online/requests/checkout',{method:'POST',headers,body:'{}'});
  assert.equal(copyCheckout.status,201);assert.equal((await copyCheckout.json()).kind,'copy');
  const selected=await fetch(base+'/api/process-online/requests/checkout',{method:'POST',headers,body:JSON.stringify({cnjs:['first','second']})});
  assert.equal(selected.status,201);assert.deepEqual((await selected.json()).cnjs,['first','second']);
  assert.equal((await fetch(base+'/api/process-online/requests',{method:'POST',headers,body:'{}'})).status,402);
  const config = await fetch(base + '/api/process-online/config', { headers });
  assert.equal(config.headers.get('cache-control'), 'private, no-store');
  const configBody=await config.json();assert.equal(configBody.ready, false);assert.equal(configBody.copyPayment.unitAmountCents,6990);assert.equal(configBody.copyPayment.maxQuantity,20);assert.equal(configBody.searchPayment.checkoutReady,false);
  assert.equal((await fetch(base + '/api/process-online/verify', { method: 'POST', headers, body: '{"cnj":"test"}' })).status, 200);
  const raw = '{ "event": "webhook.test" }';
  assert.equal((await fetch(base + '/api/process-online/webhook', { method: 'POST', headers: { 'x-po-signature': 'signature' }, body: raw })).status, 200);
  const uppercaseId='ABCDEFAB-1234-1234-1234-123456789ABC';
  assert.equal((await fetch(base + '/api/process-online/requests/'+uppercaseId+'/recover',{method:'POST',headers,body:'{"consent":true,"approvedCredits":1}'})).status,200);
  assert.deepEqual(calls, [['verify', 8, { cnj: 'test' }], ['hook', raw, 'signature'],['recover',uppercaseId.toLowerCase(),{consent:true,approvedCredits:1}]]);
});

test('app auth hook clears ownership and reactivates the same user after session expiry', async () => {
  const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const hook = source.slice(source.indexOf('let processOnlineContext = {};'), source.indexOf('const isGuest ='));
  const calls = [], handlers = {};
  let onAuthRequired;
  const ui = { reset: () => calls.push('reset'), activate: () => calls.push('activate'), deactivate: () => calls.push('deactivate') };
  const location = { hash: '#processos-judiciais' };
  const context = vm.createContext({
    document: { querySelector: () => ({}), addEventListener: (name, handler) => { handlers[name] = handler; } },
    window: { location, addEventListener: (name, handler) => { handlers[name] = handler; } },
    initProcessOnline: options => { onAuthRequired = options.onAuthRequired; return ui; },
    showLogin: () => calls.push('login'),
  });
  vm.runInContext(hook, context);
  const ownerA = { user: { id: 81, tenant: { id: 1 } } };
  const ownerB = { user: { id: 82, tenant: { id: 2 } } };
  const auth = value => handlers['audita:auth-changed']({ detail: value });
  auth(ownerA);
  assert.deepEqual(calls, ['reset', 'activate']);
  auth(ownerA);
  assert.deepEqual(calls, ['reset', 'activate'], 'a repeated unchanged auth event preserves an active analysis');
  vm.runInContext("processOnlineContext={parentAuditId:'owner-a-private-audit'}", context);
  ui.reset(); // The UI clears its private state before notifying the host of a 401.
  onAuthRequired();
  assert.equal(vm.runInContext('processOnlineOwner', context), null);
  assert.equal(vm.runInContext('JSON.stringify(processOnlineContext)', context), '{}');
  auth(ownerA);
  assert.deepEqual(calls.slice(-2), ['reset', 'activate'], 'logging back into the same account reactivates the cleared module');
  vm.runInContext("processOnlineContext={parentAuditId:'owner-a-private-audit'}", context);
  auth(ownerB);
  assert.deepEqual(calls.slice(-2), ['reset', 'activate']);
  assert.equal(vm.runInContext('processOnlineOwner', context), '2:82');
  assert.equal(vm.runInContext('JSON.stringify(processOnlineContext)', context), '{}');
  auth({ user: null });
  assert.equal(calls.at(-1), 'reset', 'logout clears state without reactivating private requests');
  const before = calls.length;
  location.hash = '#home'; auth(ownerA);
  assert.deepEqual(calls.slice(before), ['reset'], 'login outside the module does not activate process requests');
});
