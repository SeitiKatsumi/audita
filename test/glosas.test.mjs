import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {caseSchema,summarize,reportText} from '../services/glosas-domain.mjs';
import {createGlosasService} from '../services/glosas.service.mjs';
import {createGlosasHandler} from '../services/glosas-api.mjs';
const item={guide:'FICTICIA-1',sequence:'1',code:'',reason:'Motivo fictício',category:'clinical',billed:10000,paid:6000,denied:3000,evidence:''};
const data={operator:'Operadora fictícia',lot:'Teste',consent:true,items:[item]};
test('integer totals distinguish glosas from unallocated balance; no clinical verdict',()=>{
 const s=summarize(data);assert.deepEqual(s.totals,{billed:10000,paid:6000,denied:3000,unreconciled:1000});assert.equal(s.denialPercent,30);assert.equal(s.items[0].pending.length,3);
 assert.equal(summarize({...data,items:[]}).denialPercent,null);
 assert.match(reportText(data),/PRELIMINAR/);assert.match(reportText(data),/profissional de saúde/);assert.doesNotMatch(reportText(data),/glosa indevida|30 dias/i);
});
test('strict input, consent, duplication, monetary caps and precision',()=>{
 for(const change of [{paid:10001},{denied:-1},{billed:1.1},{billed:Infinity},{billed:1000000001},{category:'approved'}])assert.equal(caseSchema.safeParse({...data,items:[{...item,...change}]}).success,false);
 for(const change of [{consent:false},{items:[item,item]},{operator:''},{items:Array(101).fill(item)},{patient:'private'}])assert.equal(caseSchema.safeParse({...data,...change}).success,false);
 assert.equal(caseSchema.safeParse({...data,items:[item,{...item,sequence:'2'}]}).success,true);
});
test('encrypted persistence, ownership, revisions, export, deletion and unavailable config',async()=>{
 const db=new PGlite();try{
 await db.exec('CREATE TABLE audita_tenants(id BIGINT PRIMARY KEY); CREATE TABLE audita_users(id BIGINT PRIMARY KEY); INSERT INTO audita_tenants VALUES(1),(2); INSERT INTO audita_users VALUES(1),(2);');
 await db.exec(await readFile(new URL('../db/glosas.sql',import.meta.url),'utf8'));
 const env={AUDITA_GLOSAS_ENCRYPTION_KEY:randomBytes(32).toString('hex')};
 const service=createGlosasService({getDb:()=>({pool:db,dbReady:true}),env});
 const a={tenantId:1,user:{id:1}},other={tenantId:2,user:{id:2}};
 assert.equal((await service.configuration()).storageReady,true);
 await assert.rejects(service.save(null,{data}),{code:'authentication_required'});
 let saved=await service.save(a,{data});assert.equal(saved.revision,1);
 assert.ok(!(await db.query('SELECT encrypted_payload FROM audita_glosas')).rows[0].encrypted_payload.includes('Operadora'));
 assert.equal((await service.list(a)).length,1);assert.deepEqual(await service.list(other),[]);
 for(const auth of [other,{tenantId:1,user:{id:2}},{tenantId:2,user:{id:1}}]){
  await assert.rejects(service.get(auth,saved.id),{code:'not_found'});
  await assert.rejects(service.save(auth,{data,revision:1},saved.id),{code:'not_found'});
  await assert.rejects(service.report(auth,saved.id),{code:'not_found'});
  await assert.rejects(service.remove(auth,saved.id,1),{code:'not_found'});
 }
 const results=await Promise.allSettled([service.save(a,{data,revision:1},saved.id),service.save(a,{data,revision:1},saved.id)]);
 assert.equal(results.filter(v=>v.status==='fulfilled').length,1);assert.equal(results.find(v=>v.status==='rejected').reason.code,'conflict');
 assert.match((await service.report(a,saved.id)).toString(),/Revisão 2/);
 await assert.rejects(service.remove(a,saved.id,1),{code:'conflict'});
 await service.remove(a,saved.id,2);assert.deepEqual(await service.list(a),[]);
 const unavailable=createGlosasService({getDb:()=>({pool:db,dbReady:true}),env:{}});
 assert.equal((await unavailable.configuration()).storageReady,false);await assert.rejects(unavailable.save(a,{data}),{code:'unavailable'});
 }finally{await db.close();}
});
test('HTTP authentication, cross-site protection, routes and sanitized errors',async()=>{
 let auth={tenantId:1,user:{id:1}},status,payload,last,failure;
 const service=Object.fromEntries(['configuration','list','get','save','remove','report'].map(name=>[name,async()=>{last=name;if(failure)throw failure;return name==='report'?Buffer.from('fixture'):{};}]));
 const h=createGlosasHandler({service,getAuth:async()=>auth,readJson:async()=>({data,revision:1}),sendJson:(_,s,p)=>{status=s;payload=p;}});
 const res={setHeader(){},writeHead(s){status=s;},end(p){payload=p;}};
 const call=(m,p,headers={})=>h({method:m,headers:{host:'localhost',origin:'http://localhost',...headers}},res,new URL('http://localhost/api/glosas'+p));
 const id=randomUUID(),routes=[['GET','/config','configuration'],['GET','/cases','list'],['POST','/cases','save'],['GET',`/cases/${id}`,'get'],['PUT',`/cases/${id}`,'save'],['DELETE',`/cases/${id}`,'remove'],['GET',`/cases/${id}/report`,'report']];
 for(const [m,p,name] of routes){await call(m,p);assert.equal(status,200);assert.equal(last,name);}
 await call('POST','/cases',{'sec-fetch-site':'cross-site'});assert.equal(status,403);
 await call('PUT',`/cases/${id}`,{origin:'https://evil.test'});assert.equal(status,403);
 await call('POST',`/cases/${id}/report`);assert.equal(status,404);
 failure=Error('PRIVATE');await call('GET','/cases');assert.equal(status,503);assert.ok(!JSON.stringify(payload).includes('PRIVATE'));failure=null;
 auth=null;for(const [m,p] of routes.slice(1)){await call(m,p);assert.equal(status,401);}
});
