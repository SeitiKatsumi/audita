import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {PDFDocument} from 'pdf-lib';
import {createChatDocumentsService} from '../services/chat-documents.service.mjs';
import {createChatAccessService} from '../services/chat-access.service.mjs';

const auth = {tenantId:1,user:{id:1}};
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64');
async function pdf(pages = 1) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage().drawText(`Fictional page ${i + 1}`);
  return {buffer:Buffer.from(await doc.save()),fileName:'fictional.pdf',mimeType:'application/pdf'};
}
const output = pages => ({status:'completed',output_text:JSON.stringify({summary:'Fictional summary [p. 1]',pages:Array.from({length:pages},(_,i) => ({page:i+1,text:`Fictional text ${i+1}`,uncertain:i === 1}))})});
async function fixture(t) {
  const pg = new PGlite();
  await pg.exec('CREATE TABLE audita_tenants(id BIGINT PRIMARY KEY); CREATE TABLE audita_users(id BIGINT PRIMARY KEY); INSERT INTO audita_tenants VALUES(1),(2); INSERT INTO audita_users VALUES(1),(2),(3);');
  await pg.exec(await readFile(new URL('../db/migrations/20260922-chat-documents.sql',import.meta.url),'utf8'));
  t.after(() => pg.close());
  let tail = Promise.resolve();
  const state = {pages:1,calls:[],usage:0,balance:20,reservations:new Map(),failure:null,completionFailure:false,writeFailure:false};
  const query = (...args) => {
    if (state.writeFailure && state.calls.length > state.failAfterCalls && args[0].startsWith('UPDATE audita_chat_documents')) {
      state.writeFailure = false;
      throw Error('private SQL error');
    }
    return pg.query(...args);
  };
  const pool = {query,connect:async () => {
    const previous = tail; let unlock;
    tail = new Promise(resolve => { unlock = resolve; });
    await previous;
    return {query,release:unlock};
  }};
  const accessService = {
    getAccess:async () => ({allowed:true,remaining:{pages:state.balance,messages:20}}),
    reserve:async (_auth,input) => {
      assert.equal(input.kind,'pages');
      const old = state.reservations.get(input.requestId);
      if (old) return {...old,duplicate:true};
      if (input.quantity > state.balance) throw Object.assign(Error('quota'), {code:'chat_quota_exceeded',statusCode:429});
      state.balance -= input.quantity;
      const r = {...input,status:'reserved',duplicate:false};
      state.reservations.set(input.requestId,r);
      return {...r};
    },
    complete:async (_auth,{requestId,result}) => {
      if (state.completionFailure) throw Error('private quota failure');
      const r = state.reservations.get(requestId);
      assert.ok(r && r.status !== 'released');
      assert.deepEqual(Object.keys(result),['documentId']);
      r.status = 'completed';r.result = result;
      return {...r};
    },
    release:async (_auth,{requestId}) => {
      const r = state.reservations.get(requestId);
      assert.equal(r.status,'reserved');
      r.status = 'released';state.balance += r.quantity;
    },
  };
  const client = {responses:{create:async request => {
    state.calls.push(request);
    if (state.failure) throw Error('provider secret');
    return state.response || output(state.pages);
  }}};
  const options = {getDb:() => ({pool,dbReady:true}),env:{AUDITA_IR_ENCRYPTION_KEY:randomBytes(32).toString('hex')},accessService,client,recordUsage:async () => { state.usage++; }};
  return {pg,pool,state,options,service:createChatDocumentsService(options)};
}

test('prepare counts the entire PDF without AI or quota consumption; encrypts private metadata and bytes',async t => {
  const {service,pg,state} = await fixture(t);
  const input = await pdf(20);
  const prepared = await service.prepare(auth,{...input,pages:1});
  assert.equal(prepared.pages,20);
  assert.equal(prepared.pagesAvailable,20);
  assert.equal(state.calls.length,0);assert.equal(state.reservations.size,0);
  const row = (await pg.query('SELECT * FROM audita_chat_documents')).rows[0];
  assert.equal(row.pages,20);
  assert.ok(!row.encrypted_payload.includes('fictional'));
  assert.ok(!row.encrypted_file.includes(input.buffer.toString('base64')));
  assert.deepEqual(Object.keys(prepared).sort(),['id','pages','pagesAvailable','status']);
  await assert.rejects(service.getContext(auth,prepared.id),{code:'analysis_required'});
  await assert.rejects(service.analyze(auth,prepared.id,{confirmed:'true'}),{code:'confirmation_required'});
  assert.equal(state.calls.length,0);
});

test('unpaid and exhausted accounts cannot parse or store uploads; insufficient positive quota allows preparation only',async t => {
  const {service,options,state,pg} = await fixture(t);
  for (const [quota,code] of [
    [{allowed:false,source:'none',remaining:null},'chat_access_required'],
    [{allowed:true,source:'entitlement',remaining:{pages:0}},'chat_quota_exceeded'],
  ]) {
    const blocked = createChatDocumentsService({...options,accessService:{...options.accessService,getAccess:async () => quota}});
    await assert.rejects(blocked.prepare(auth,{buffer:Buffer.from('not even a PDF'),fileName:'bad.pdf',mimeType:'application/pdf'}),{code});
  }
  assert.equal((await pg.query('SELECT COUNT(*) AS n FROM audita_chat_documents')).rows[0].n,0);
  state.balance = 1;
  const prepared = await service.prepare(auth,await pdf(2));
  assert.equal(prepared.pages,2);assert.equal(prepared.pagesAvailable,1);
  await assert.rejects(service.analyze(auth,prepared.id,{confirmed:true}),{code:'chat_quota_exceeded'});
  assert.equal(state.calls.length,0);
});

test('confirmation reserves pages only, sends whole PDF, persists bounded citations and replays after restart',async t => {
  const {service,options,state,pg} = await fixture(t);
  const input = await pdf(2);state.pages = 2;
  const {id} = await service.prepare(auth,input);
  const result = await service.analyze(auth,id,{confirmed:true});
  assert.equal(result.pages,2);assert.equal(result.extractedPages.length,2);
  assert.equal(state.balance,18);assert.equal(state.usage,1);
  const request = state.calls[0];
  assert.equal(request.store,false);assert.equal(request.max_output_tokens,12000);
  assert.equal(request.tools,undefined);
  const attachment = request.input[1].content[0];
  assert.equal(attachment.file_data,`data:application/pdf;base64,${input.buffer.toString('base64')}`);
  const restarted = createChatDocumentsService(options);
  assert.deepEqual(await restarted.analyze(auth,id,{confirmed:true}),result);
  assert.equal(state.calls.length,1);assert.equal(state.balance,18);
  const context = await restarted.getContext(auth,id);
  assert.match(context.text,/\[p\. 2; leitura incerta\]/);
  assert.ok(context.text.length <= 24000);
  assert.equal(context.buffer,undefined);assert.equal(context.path,undefined);
  assert.ok(!(await pg.query('SELECT encrypted_payload FROM audita_chat_documents')).rows[0].encrypted_payload.includes('Fictional'));
});

test('owner isolation includes same-tenant peers and administrators; missing DB/key fails closed',async t => {
  const {service,options,state} = await fixture(t);
  const {id} = await service.prepare(auth,await pdf());
  for (const other of [{tenantId:2,user:{id:1}},{tenantId:1,user:{id:2}},{tenantId:2,user:{id:3,role:'super_admin'}}]) {
    await assert.rejects(service.getContext(other,id),{statusCode:404});
    await assert.rejects(service.analyze(other,id,{confirmed:true}),{statusCode:404});
  }
  await assert.rejects(service.prepare({},await pdf()),{statusCode:401});
  await assert.rejects(service.getContext(auth,'../../private'),{statusCode:404});
  for (const override of [{env:{}},{getDb:() => ({dbReady:false})},{accessService:{}}]) {
    await assert.rejects(createChatDocumentsService({...options,...override}).prepare(auth,await pdf()),{statusCode:503});
  }
  assert.equal(state.calls.length,0);
});

test('file boundaries, MIME mismatch, malformed PDFs, page limit and image dimensions are server validated',async t => {
  const {service,state} = await fixture(t);
  const valid = await pdf();
  const bad = [
    {...valid,buffer:Buffer.alloc(0)}, {...valid,buffer:Buffer.alloc(12*1024*1024+1)},
    {...valid,mimeType:'image/png'}, {...valid,buffer:Buffer.from('%PDF-1.7\nnot a document')},
    {...valid,fileName:'../../secret.pdf'}, {...valid,fileName:'bad\nname.pdf'},
    {buffer:Buffer.from([255,216,255,217]),fileName:'bad.jpg',mimeType:'image/jpeg'},
  ];
  for (const input of bad) await assert.rejects(service.prepare(auth,input),{code:'invalid_file'});
  await assert.rejects(service.prepare(auth,await pdf(21)),{code:'page_limit'});
  const image = {buffer:png,fileName:'pixel.png',mimeType:'image/png'};
  assert.equal((await service.prepare(auth,image)).pages,1);
  const bomb = Buffer.from(png);bomb.writeUInt32BE(10001,16);
  await assert.rejects(service.prepare(auth,{...image,buffer:bomb}),{code:'invalid_file'});
  const pixels = Buffer.from(png);pixels.writeUInt32BE(6000,16);pixels.writeUInt32BE(6000,20);
  await assert.rejects(service.prepare(auth,{...image,buffer:pixels}),{code:'invalid_file'});
  assert.equal(state.calls.length,0);
});

test('provider, malformed/partial output and write failures release pages; explicit retry gets a new reservation',async t => {
  const {service,state} = await fixture(t);
  const {id} = await service.prepare(auth,await pdf(2));state.pages = 2;
  const failures = [
    {failure:true}, {response:{status:'incomplete',output_text:'{}'}},
    {response:{status:'completed',output_text:'not JSON'}}, {response:output(1)},
    {response:{status:'completed',output_text:JSON.stringify({summary:'s',pages:[{page:1,text:'x'.repeat(801),uncertain:false},{page:2,text:'x',uncertain:false}]})}},
    {writeFailure:true},
  ];
  for (const failure of failures) {
    Object.assign(state,{failure:false,response:null,writeFailure:false,failAfterCalls:state.calls.length},failure);
    await assert.rejects(service.analyze(auth,id,{confirmed:true}),error => error.statusCode === 503 && !/secret|private/.test(error.message));
    assert.equal(state.balance,20);
  }
  Object.assign(state,{failure:false,response:null,writeFailure:false});
  assert.equal((await service.analyze(auth,id,{confirmed:true})).status,'completed');
  assert.equal(state.balance,18);
});

test('quota exhaustion prevents AI; image request is multimodal, not a file path',async t => {
  const {service,state} = await fixture(t);
  const {id} = await service.prepare(auth,{buffer:png,fileName:'pixel.png',mimeType:'image/png'});
  state.balance = 0;
  await assert.rejects(service.analyze(auth,id,{confirmed:true}),{code:'chat_quota_exceeded',statusCode:429});
  assert.equal(state.calls.length,0);
  state.balance = 1;
  await service.analyze(auth,id,{confirmed:true});
  assert.equal(state.calls[0].input[1].content[0].type,'input_image');
  assert.match(state.calls[0].input[1].content[0].image_url,/^data:image\/png;base64,/);
});

test('simultaneous requests and failed quota completion do not repeat AI or refund saved results',async t => {
  const {service,options,state} = await fixture(t);
  const {id} = await service.prepare(auth,await pdf());
  state.completionFailure = true;
  await assert.rejects(service.analyze(auth,id,{confirmed:true}),{statusCode:503});
  assert.equal(state.balance,19);assert.equal(state.calls.length,1);
  state.completionFailure = false;
  const another = createChatDocumentsService(options);
  const results = await Promise.all([service.analyze(auth,id,{confirmed:true}),another.analyze(auth,id,{confirmed:true})]);
  assert.deepEqual(results[0],results[1]);assert.equal(state.calls.length,1);
  const fresh = await service.prepare(auth,await pdf());
  const concurrent = await Promise.allSettled([service.analyze(auth,fresh.id,{confirmed:true}),another.analyze(auth,fresh.id,{confirmed:true})]);
  assert.equal(concurrent.filter(r => r.status === 'fulfilled').length,1);
  assert.equal(concurrent.find(r => r.status === 'rejected').reason.code,'document_busy');
  assert.equal(state.calls.length,2);assert.equal(state.balance,18);
});

test('real quota service works with a single-connection pool and never charges a message',async t => {
  const {pg,options,state} = await fixture(t);
  await pg.exec('ALTER TABLE audita_users ADD COLUMN tenant_id BIGINT DEFAULT 1;');
  await pg.exec(await readFile(new URL('../db/migrations/20260922-chat-access.sql',import.meta.url),'utf8'));
  const accessService = createChatAccessService({getDb:options.getDb,getLegacyAccess:async () => true});
  const service = createChatDocumentsService({...options,accessService});
  const {id} = await service.prepare(auth,await pdf(20));state.pages = 20;
  const result = await service.analyze(auth,id,{confirmed:true});
  assert.equal(result.extractedPages.length,20);
  assert.deepEqual(await service.analyze(auth,id,{confirmed:true}),result);
  const reservations = (await pg.query('SELECT kind,quantity,status,result FROM audita_chat_reservations')).rows;
  assert.deepEqual(reservations,[{kind:'pages',quantity:20,status:'completed',result:{documentId:id}}]);
  const next = await service.prepare(auth,await pdf());state.pages = 1;state.failure = true;
  await assert.rejects(service.analyze(auth,next.id,{confirmed:true}));
  state.failure = false;
  await service.analyze(auth,next.id,{confirmed:true});
  const statuses = (await pg.query('SELECT status FROM audita_chat_reservations ORDER BY created_at')).rows.map(r => r.status);
  assert.deepEqual(statuses,['completed','released','completed']);
});

test('uncertain reservation and failed refund stay blocked rather than running OCR twice',async t => {
  const {options,state,service} = await fixture(t);
  const {id} = await service.prepare(auth,await pdf());
  const uncertain = createChatDocumentsService({...options,accessService:{...options.accessService,reserve:async () => { throw Error('connection lost after possible commit'); }}});
  await assert.rejects(uncertain.analyze(auth,id,{confirmed:true}),{code:'quota_recovery_required'});
  await assert.rejects(service.analyze(auth,id,{confirmed:true}),{code:'document_busy'});
  assert.equal(state.calls.length,0);
  const next = await service.prepare(auth,await pdf());state.failure = true;
  const failedRefund = createChatDocumentsService({...options,accessService:{...options.accessService,release:async () => { throw Error('refund unavailable'); }}});
  await assert.rejects(failedRefund.analyze(auth,next.id,{confirmed:true}),{code:'quota_recovery_required'});
  assert.equal(state.balance,19);
  await assert.rejects(service.analyze(auth,next.id,{confirmed:true}),{code:'document_busy'});
  assert.equal(state.calls.length,1);
});
