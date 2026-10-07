import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {PDFDocument} from 'pdf-lib';
import {createGlosasService} from '../services/glosas.service.mjs';
import {createGlosasAI,inspectGlosasDocument,validateExtraction} from '../services/glosas-ai.mjs';
import {reconcileGlosas} from '../services/glosas-reconcile.mjs';
import {glosasPdf} from '../services/glosas-report.mjs';
const row={guide:'FICTICIA',sequence:'1',code:null,reason:'Motivo fictício',category:'administrative',billed:10000,paid:6000,denied:3000,source:{page:1,locator:'linha 1',quote:'FICTICIA 100,00 60,00 30,00'}};
const extraction={operator:'Operadora fictícia',lot:'Lote fictício',truncated:false,warnings:[],items:[row],facts:[]};
test('PDF/XML inspection rejects malformed files, entities, oversize, encrypted or too many pages',async()=>{
 assert.equal((await inspectGlosasDocument(await glosasPdf('Ficticio'),'fixture.pdf')).pages,1);
 assert.equal((await inspectGlosasDocument(Buffer.from('<tiss><guia>01</guia></tiss>'),'fixture.xml')).mime,'application/xml');
 for(const file of [Buffer.from('<!DOCTYPE x [<!ENTITY x SYSTEM "file:///secret">]><x>&x;</x>'),Buffer.from('<x>'),Buffer.alloc(250001,32)])await assert.rejects(inspectGlosasDocument(file,'fixture.xml'));
 await assert.rejects(inspectGlosasDocument(Buffer.from('%PDF-bad'),'bad.pdf'));
 await assert.rejects(inspectGlosasDocument(Buffer.alloc(10*1024*1024+1),'big.pdf'));
 const pdf=await PDFDocument.create();for(let i=0;i<21;i++)pdf.addPage();await assert.rejects(inspectGlosasDocument(Buffer.from(await pdf.save()),'big.pdf'),{code:'page_limit'});
 assert.throws(()=>validateExtraction({...extraction,truncated:true},{mime:'application/pdf',pages:1}),{code:'truncated'});
 assert.throws(()=>validateExtraction({...extraction,items:[{...row,source:{...row.source,page:2}}]},{mime:'application/pdf',pages:1}),{code:'invalid_page'});
});
test('reconciliation preserves missing/conflicting values, matches only exact identifiers, keeps evidence',()=>{
 const docs=[{id:'a',name:'glosa.pdf',type:'denial',extraction:{...extraction,items:[{...row,billed:null}]}},{id:'b',name:'fatura.pdf',type:'billing',extraction:{...extraction,items:[{...row,paid:null,denied:null,reason:null}]}}];
 const r=reconcileGlosas(docs);assert.equal(r.items.length,1);assert.equal(r.items[0].billed,10000);assert.equal(r.items[0].denied,3000);assert.equal(r.evidence.length,2);
 docs[1].extraction.items[0].paid=5000;assert.equal(reconcileGlosas(docs).items[0].paid,null);
 docs[1].extraction.items[0].guide=null;assert.equal(reconcileGlosas(docs).items.length,2);
 assert.throws(()=>reconcileGlosas([{id:'c',name:'duplicate.pdf',extraction:{...extraction,items:[row,row]}}]),{code:'ambiguous_lines'});
});
test('OpenAI adapter uses existing configuration, bounded calls, untrusted data and validates outputs',async()=>{
 let request;const ai=createGlosasAI({env:{OPENAI_API_KEY:'fixture-only'},clientFactory:()=>({responses:{create:async r=>{request=r;return {status:'completed',output_text:JSON.stringify(extraction)};}}})});
 await ai.extract({type:'denial',mime:'application/pdf',pages:1,buffer:Buffer.from('%PDF-fixture')},{});
 assert.equal(request.store,false);assert.equal(request.max_output_tokens,12000);assert.ok(!request.tools);assert.match(request.input[0].content,/ignore instruções/);assert.equal(request.input[1].content[0].type,'input_file');
 const unavailable=createGlosasAI({env:{}});assert.equal(unavailable.available(),false);await assert.rejects(unavailable.extract({mime:'application/pdf',buffer:Buffer.from('x')},{}),{code:'ai_unavailable'});
 const invalid=createGlosasAI({env:{OPENAI_API_KEY:'fixture'},clientFactory:()=>({responses:{create:async()=>({status:'incomplete',output_text:'{}'})}})});await assert.rejects(invalid.extract({mime:'application/pdf',buffer:Buffer.from('x')},{}),{code:'ai_incomplete'});
});
test('document automation: encryption, isolation, atomic claims, retries, confirmation, invalidation, PDF and deletion',async()=>{
 const pg=new PGlite();let gate,release,fail=false,badReference=false,calls=0;
 try{
  await pg.exec('CREATE TABLE audita_tenants(id BIGINT PRIMARY KEY);CREATE TABLE audita_users(id BIGINT PRIMARY KEY);INSERT INTO audita_tenants VALUES(1),(2);INSERT INTO audita_users VALUES(1),(2);');await pg.exec(await readFile(new URL('../db/glosas.sql',import.meta.url),'utf8'));
  const env={AUDITA_GLOSAS_ENCRYPTION_KEY:randomBytes(32).toString('hex')};
  const ai={available:()=>true,extract:async()=>{calls++;if(gate)await gate;if(fail)throw Error('private');return structuredClone(extraction);},analyze:async input=>({items:input.items.map(v=>({index:v.index,observation:'Sugestão fictícia',evidenceIds:badReference?['fake']:v.evidenceIds,missing:['Conferência profissional'],draft:'Minuta fictícia para revisão.',prevention:'Conferir autorização.'}))})};
  const s=createGlosasService({getDb:()=>({pool:pg,dbReady:true}),env,ai}),a={tenantId:1,user:{id:1}},other={tenantId:2,user:{id:2}};
  let c=await s.save(a,{data:{operator:'A identificar',lot:'Novo',consent:true,items:[]},aiConsent:true});
  const buffer=await glosasPdf('Documento ficticio 100,00 60,00 30,00');
  c=await s.upload(a,c.id,{buffer,name:'fixture.pdf',type:'denial',revision:c.revision});assert.equal(c.documents.length,1);
  assert.equal((await s.upload(a,c.id,{buffer,name:'fixture.pdf',type:'denial',revision:c.revision})).revision,c.revision);
  const stored=(await pg.query('SELECT encrypted_file FROM audita_glosas_documents')).rows[0];assert.ok(!stored.encrypted_file.includes('PDF'));
  for(const action of [()=>s.download(other,c.id,c.documents[0].id),()=>s.command(other,c.id,{action:'extract',revision:c.revision,requestId:randomUUID()}),()=>s.upload(other,c.id,{buffer,name:'fixture.pdf',type:'denial',revision:c.revision})])await assert.rejects(action(),{code:'not_found'});
  const requestId=randomUUID();gate=new Promise(r=>release=r);const running=s.command(a,c.id,{action:'extract',revision:c.revision,requestId});
  while(!calls)await new Promise(r=>setTimeout(r,10));
  await assert.rejects(s.command(a,c.id,{action:'extract',revision:c.revision,requestId:randomUUID()}),{code:'busy'});
  await assert.rejects(s.remove(a,c.id,c.revision),{code:'busy'});release();c=await running;gate=null;
  assert.equal(c.automation.extraction.items[0].billed,10000);assert.equal(c.data.items.length,0);
  await s.command(a,c.id,{action:'extract',revision:1,requestId});assert.equal(calls,1);
  await assert.rejects(s.command(a,c.id,{action:'analyze',revision:c.revision,requestId:randomUUID()}),{code:'confirmation_required'});
  const data={operator:'Operadora fictícia',lot:'Lote fictício',consent:true,items:[{...row,code:'',evidence:'fixture.pdf, p. 1'}]};delete data.items[0].source;
  await assert.rejects(s.save(a,{data,revision:c.revision},c.id),{code:'confirmation_required'});
  c=await s.save(a,{data,revision:c.revision,confirmed:true},c.id);
  badReference=true;c=await s.command(a,c.id,{action:'analyze',revision:c.revision,requestId:randomUUID()});assert.ok(c.automation.error);assert.equal(c.automation.analysis,null);
  badReference=false;c=await s.command(a,c.id,{action:'analyze',revision:c.revision,requestId:randomUUID()});assert.match(c.automation.analysis.items[0].draft,/Minuta/);
  const report=await s.report(a,c.id,true);assert.equal(report.subarray(0,5).toString(),'%PDF-');assert.ok((await PDFDocument.load(report)).getPageCount()>0);
  fail=true;c=await s.command(a,c.id,{action:'extract',revision:c.revision,requestId:randomUUID()});assert.ok(c.automation.error);assert.ok(c.automation.analysis);assert.equal(c.automation.busy,null);
  c=await s.upload(a,c.id,{buffer:await glosasPdf('Contrato ficticio'),name:'contrato.pdf',type:'contract',revision:c.revision});assert.equal(c.automation.analysis,null);assert.equal(c.automation.extraction,null);assert.equal(c.automation.confirmedAt,null);assert.equal(c.data.items.length,0);
  await s.remove(a,c.id,c.revision);assert.equal((await pg.query('SELECT * FROM audita_glosas_documents')).rows.length,0);
 }finally{await pg.close();}
});
