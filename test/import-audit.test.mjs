import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createImportService} from '../services/import-audit.service.mjs';
import {createImportAI} from '../services/import-audit-ai.mjs';
import {createImportHandler} from '../services/import-audit-api.mjs';
import {simulate,reviewSchema,normalizeNcm,officialUrl} from '../services/import-audit-domain.mjs';

const source='https://www.gov.br/receitafederal/pt-br/teste';
const product={description:'Equipamento fictício',original:'Fictional equipment',quantity:'1',value:'100',currency:'USD',specifications:'Apenas fixture, sem enquadramento real.',page:1};
const row={index:0,ncm:'85437099',customsValueCents:100000,otherIpiBaseCents:0,iiBps:1000,ipiBps:500,scenarioIiBps:0,scenarioIpiBps:500,iiSource:source,ipiSource:source,basis:'Ato fictício, datas e condições conferidas apenas para teste.'};
test('II and IPI have separate rates/bases, integer rounding, input boundaries and official URLs',()=>{
 assert.deepEqual(simulate(row),{reference:{iiCents:10000,ipiBaseCents:110000,ipiCents:5500,totalCents:15500},proposed:{iiCents:0,ipiBaseCents:100000,ipiCents:5000,totalCents:5000},differenceCents:10500});
 assert.equal(simulate({...row,customsValueCents:1,iiBps:5000}).reference.iiCents,1);
 assert.equal(simulate({...row,scenarioIiBps:2000}).differenceCents,-10500);
 assert.ok(officialUrl(source));for(const bad of ['http://www.gov.br','https://gov.br.evil.test','javascript:alert(1)','https://x@gov.br'])assert.equal(officialUrl(bad),false);
 const review={confirmed:true,standardAdValorem:true,operationDate:'2026-09-22',note:'Teste de revisão',rows:[row]};
 for(const change of [{operationDate:'2026-02-30'},{confirmed:false},{rows:[{...row,iiBps:-1}]},{rows:[{...row,customsValueCents:1.1}]},{rows:[{...row,iiSource:'https://evil.test'}]}])assert.equal(reviewSchema.safeParse({...review,...change}).success,false);
 const codes=normalizeNcm({Nomenclaturas:[{Codigo:'85',Descricao:'Capítulo'},{Codigo:'8543.70.99',Descricao:'<b>Outros</b>',Tipo_Ato_Ini:'Resolução',Numero_Ato_Ini:'1'}]});assert.equal(codes.size,1);assert.equal(codes.get('85437099').description,'Capítulo > Outros');
});

test('encrypted persistent case workflow, owner isolation, review permission, invalidation and retries',async()=>{
 const pg=new PGlite();await pg.waitReady;
 const pool={query:(...a)=>pg.query(...a),connect:async()=>({query:(...a)=>pg.query(...a),release(){}})};
 try{
  await pg.exec((await readFile(new URL('../db/schema.sql',import.meta.url),'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
  await pg.exec(await readFile(new URL('../db/import-audit.sql',import.meta.url),'utf8'));
  await pg.exec("INSERT INTO audita_tenants(id,name,slug) VALUES(2,'Outra','outra'); INSERT INTO audita_users(id,tenant_id,name,email,password_hash,role) VALUES(1,1,'Cliente','import1@example.test','x','owner'),(2,2,'Outro','import2@example.test','x','owner'),(3,1,'Colega','import3@example.test','x','member'),(4,2,'Equipe','import4@example.test','x','super_admin');");
  const owner={tenantId:1,user:{id:1,role:'owner'}},other={tenantId:2,user:{id:2,role:'owner'}},colleague={tenantId:1,user:{id:3,role:'member'}},admin={tenantId:2,user:{id:4,role:'super_admin'}};
  const env={AUDITA_IR_ENCRYPTION_KEY:randomBytes(32).toString('hex')};let fail=false,researchFail=false,clock=Date.now();
  const ai={available:()=>true,extract:async()=>{if(fail)throw Error('secret must not leak');return {products:[product],warnings:[]};},suggest:async()=>({items:[{index:0,candidates:[{code:row.ncm,reason:'Justificativa de teste'},{code:'00000000',reason:'Inválida'}],missing:[]}]}),research:async()=>{if(researchFail)throw Error('external_unavailable');return {text:'Pesquisa de teste',sources:[{title:'Referência de teste',url:source}],notice:'Conferir',fetchedAt:'2026-09-22'};}};
  const make=()=>createImportService({getDb:()=>({pool,dbReady:true}),env,ai,now:()=>new Date(clock),ncm:async()=>({rows:new Map([[row.ncm,{code:row.ncm,description:'Código fictício do teste',act:'teste'}]]),source,fetchedAt:'2026-09-22',notice:'Somente vigente'})});
  let service=make(),c=await service.create(owner,{consent:true});
  const command=(action,data={},who=owner)=>service.command(who,c.id,{revision:c.revision,action,...data});
  assert.equal((await service.configuration(owner)).ready,true);
  for(const who of [other,colleague])await assert.rejects(service.get(who,c.id),e=>e.statusCode===404);
  await assert.rejects(service.create(owner,{consent:false}));await assert.rejects(service.list(owner,true),e=>e.statusCode===403);
  const file={buffer:Buffer.from('%PDF-1.4\nFictitious'),name:'teste.pdf',type:'invoice'};
  c=await service.upload(owner,c.id,{...file,revision:c.revision});const did=c.documents[0].id;
  c=await service.upload(owner,c.id,{...file,revision:c.revision});assert.equal(c.documents.length,1);
  const stored=(await pg.query('SELECT encrypted_file,encrypted_payload FROM audita_import_documents')).rows[0];assert.ok(!stored.encrypted_file.includes('Fictitious'));assert.ok(!stored.encrypted_payload.includes('teste.pdf'));
  await assert.rejects(service.download(other,c.id,did),e=>e.statusCode===404);
  assert.deepEqual((await service.download(owner,c.id,did)).buffer,file.buffer);
  await assert.rejects(service.upload(owner,c.id,{...file,buffer:Buffer.from('bad'),revision:c.revision}));
  await assert.rejects(service.upload(owner,c.id,{...file,name:'evil.xml',buffer:Buffer.from('<!DOCTYPE foo><foo/>'),revision:c.revision}));
  await assert.rejects(service.command(owner,c.id,{action:'extract',revision:0}),e=>e.statusCode===409);
  c=await command('extract');assert.equal(c.products[0].documentId,did);
  await assert.rejects(command('suggest'),e=>e.code==='confirmation_required');
  c=await command('products',{confirmed:true,products:c.products});c=await command('suggest');assert.equal(c.suggestions.items[0].candidates.length,1);
  const review={confirmed:true,standardAdValorem:true,operationDate:'2026-09-22',note:'Revisão fictícia',rows:[row]};
  await assert.rejects(command('review',{review}),e=>e.statusCode===403);
  c=await command('review',{review},admin);assert.equal(c.review.rows[0].calculation.differenceCents,10500);
  const pdf=await service.report(owner,c.id);assert.equal(pdf.buffer.subarray(0,5).toString(),'%PDF-');
  service=make();assert.equal((await service.get(owner,c.id)).review.by,'4');
  c=await command('products',{confirmed:true,products:c.products});assert.equal(c.review,null);assert.equal(c.previousReviews.length,1);
  researchFail=true;c=await command('suggest');assert.equal(c.research,null);assert.ok(c.researchError);assert.ok(c.suggestions);
  fail=true;const before=c.products;c=await command('extract');assert.deepEqual(c.products,before);assert.ok(c.error);assert.ok(!c.error.includes('secret'));assert.equal(c.busy,null);
  assert.equal((await service.list(other)).length,0);assert.equal((await service.list(admin,true)).length,1);
  c=await service.upload(owner,c.id,{...file,buffer:Buffer.from('%PDF-1.4\nComplemento'),revision:c.revision});assert.equal(c.confirmed,false);assert.equal(c.suggestions,null);assert.deepEqual(c.products,[]);
  let release,entered;const started=new Promise(resolve=>{entered=resolve;});
  ai.extract=async()=>{entered();return new Promise(resolve=>{release=()=>resolve({products:[product],warnings:[]});});};
  // Reserve a read, expire it, then prove its late result cannot replace confirmed data.
  const pending=command('extract');await started;c=await service.get(owner,c.id);
  await assert.rejects(command('extract'),e=>e.code==='busy');
  clock+=16*60*1000;c=await command('products',{confirmed:true,products:[{...product,documentId:did}]});
  ai.extract=async()=>({products:[product],warnings:[]});release();
  await assert.rejects(pending,e=>e.code==='conflict');assert.equal((await service.get(owner,c.id)).confirmed,true);
 }finally{await pg.close();}
});

test('existing OpenAI key, XML protections, incomplete outputs and web source filtering',async()=>{
 let request,mode='extract';
 const ai=createImportAI({env:{AUDITA_OPENAI_API_KEY:'test-only-not-a-real-key'},clientFactory:()=>({responses:{create:async v=>{request=v;return mode==='incomplete'?{status:'incomplete'}:mode==='research'?{status:'completed',output_text:'Conferir referências',output:[{type:'message',content:[{annotations:[{type:'url_citation',url:source,title:'Oficial'},{type:'url_citation',url:'https://evil.test',title:'Não oficial'}]}]}]}:{status:'completed',output_text:JSON.stringify({products:[product],warnings:[]})};}}})});
 await ai.extract({mime:'application/xml',buffer:Buffer.from('<invoice><product>Teste</product></invoice>')},{});assert.equal(request.store,false);
 await assert.rejects(ai.extract({mime:'application/xml',buffer:Buffer.from('<!DOCTYPE foo><foo/>')},{}));
 mode='incomplete';await assert.rejects(ai.extract({mime:'image/png',buffer:Buffer.from('fake')},{}),e=>e.code==='ai_incomplete');
 mode='research';const research=await ai.research(['85437099'],{});assert.equal(research.sources.length,1);assert.equal(request.tool_choice,'required');assert.equal(request.input[1].content,'Códigos NCM: 85437099');
});

test('API requires session and same origin before reading bodies',async()=>{
 let auth={},read=false,code;
 const handler=createImportHandler({service:{configuration:async()=>({ready:false})},getAuth:async()=>auth,readJson:async()=>{read=true;},readBuffer:async()=>{read=true;},sendJson:(_,s)=>{code=s;}});
 const res={setHeader(){}};
 assert.equal(await handler({method:'GET',headers:{}},res,new URL('http://localhost/api/import-audit/config')),true);assert.equal(code,200);
 await handler({method:'POST',headers:{}},res,new URL('http://localhost/api/import-audit/cases'));assert.equal(code,401);assert.equal(read,false);
 auth={user:{id:1},tenantId:1};await handler({method:'POST',headers:{host:'localhost',origin:'https://evil.test'}},res,new URL('http://localhost/api/import-audit/cases'));assert.equal(code,403);assert.equal(read,false);
});
