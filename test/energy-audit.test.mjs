import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {createEnergyHandler} from '../services/energy-audit-api.mjs';
import {createEnergyService} from '../services/energy-audit.service.mjs';
import {auditBills,validateBill} from '../services/energy-audit-domain.mjs';
import {normalizeTariffs,normalizeFlags,refreshReferences} from '../services/energy-audit-references.mjs';
let pg,pool,dir,env,service,readMode='ok';
const owner={tenantId:1,user:{id:1,role:'owner'}},other={tenantId:2,user:{id:2,role:'owner'}},lawyer={tenantId:2,user:{id:3,role:'lawyer'}},unassigned={tenantId:1,user:{id:4,role:'lawyer'}},sameTenant={tenantId:1,user:{id:5,role:'member'}};
const bill=()=>validateBill({distributor:'Energia Teste',unit:'001',holder:'Pessoa Fictícia',month:'2026-08',start:'2026-08-01',end:'2026-08-31',modality:'residential',totalCents:10000,itemsComplete:true,items:[{label:'Energia',quantity:100,rate:0.8,amountCents:8000,page:1}]});
const extractor=Object.assign(async d=>{if(readMode==='transient')throw Object.assign(Error('test'),{code:'ai_unavailable'});if(readMode==='bad')throw Object.assign(Error('test'),{code:'invalid_bill'});return d.type==='response'?{summary:'Resposta fictícia de deferimento. Conferir original.',suggestedStatus:'approved'}:bill();},{available:()=>true});
const make=()=>createEnergyService({getDb:()=>({pool,dbReady:true}),env,extractor,now:()=>new Date('2026-09-14T10:00:00Z')});
async function open(){pg=new PGlite(join(dir,'db'));await pg.waitReady;pool={query:(...args)=>pg.query(...args),connect:async()=>({query:(...args)=>pg.query(...args),release(){}})};}
before(async()=>{dir=await mkdtemp(join(tmpdir(),'audita-energy-'));await open();await pg.exec((await readFile(new URL('../db/schema.sql',import.meta.url),'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));await pg.exec(await readFile(new URL('../db/energy-audit.sql',import.meta.url),'utf8'));await pg.exec("INSERT INTO audita_tenants(id,name,slug) VALUES(2,'Outra','outra'); INSERT INTO audita_users(id,tenant_id,name,email,password_hash,role) VALUES(1,1,'Cliente','energycliente@example.test','x','owner'),(2,2,'Outro','energyoutro@example.test','x','owner'),(3,2,'Advogado','energyadv@example.test','x','lawyer'),(4,1,'Advogada','energyadv2@example.test','x','lawyer'),(5,1,'Colega','energycolega@example.test','x','member');");env={AUDITA_ENERGY_ENABLED:'true',AUDITA_ENERGY_ENCRYPTION_KEY:randomBytes(32).toString('hex'),AUDITA_ENERGY_STORAGE_PATH:join(dir,'documents')};service=make();});
after(async()=>{await pg?.close();await rm(dir,{recursive:true,force:true});});
const action=(c,who,action,values={})=>service.command(who,c.id,{revision:c.revision,action,...values});
const create=(role='self')=>service.create(owner,{consent:true,role});
async function upload(c,type='invoice',tag=''){return service.upload(owner,c.id,{buffer:Buffer.from('%PDF-1.7\nFictitious '+type+tag),name:type+'.pdf',type});}
async function intake(role){let c=await create(role);c=await upload(c);await service.runJobs();return service.get(owner,c.id);}
const confirm=c=>action(c,owner,'confirm',{confirmed:true,holder:'Pessoa Fictícia',channel:'Canal fictício conferido na fatura'});
test('all modalities, missing information, arithmetic, solar, contract and tax boundaries',()=>{
 for(const modality of ['residential','commercial','large','solar','free']){const b={...bill(),modality};const a=auditBills([{id:'a',type:'invoice',bill:b}]);assert.equal(a.findings[0].delta,2000);assert.ok(a.checks.some(x=>x.rule==='tax_law'&&x.state==='not_checked'));assert.equal(a.recoveryTotal,undefined);}
 const solar={...bill(),modality:'solar',solar:{opening:30,incoming:50,used:40,expired:5,transferredIn:10,transferredOut:5,closing:40}};let a=auditBills([{id:'a',type:'invoice',bill:solar}]);assert.equal(a.checks.find(x=>x.rule==='solar').state,'checked');solar.solar.expired=null;a=auditBills([{id:'a',type:'invoice',bill:solar}]);assert.equal(a.checks.find(x=>x.rule==='solar').state,'not_checked');
 const free={...bill(),modality:'free',taxIncluded:false,contract:{confirmed:true,start:'2026-01-01',end:'2026-12-31',rates:[{label:'Energia',rate:0.7,taxIncluded:false}]}};a=auditBills([{id:'a',type:'invoice',bill:free}]);assert.equal(a.checks.find(x=>x.rule==='contract').delta,1000);free.contract.confirmed=false;assert.equal(auditBills([{id:'a',type:'invoice',bill:free}]).checks.find(x=>x.rule==='contract').state,'not_checked');
 assert.equal(auditBills([{id:'a',type:'invoice',bill:validateBill({})}]).state,'insufficient');assert.throws(()=>validateBill({start:'2026-02-30'}));assert.throws(()=>validateBill({totalCents:-1}));
 const b=bill();b.taxes=[{label:'ICMS',baseCents:10000,percent:18,amountCents:1801,page:1}];assert.equal(auditBills([{id:'a',type:'invoice',bill:b}]).checks.find(x=>x.rule==='tax').state,'checked');
});
test('tariffs require every dimension, period, unit and matching taxes; ANEEL parsers reject missing units',()=>{
 const rows=normalizeTariffs([{DatInicioVigencia:'2026-01-01',DatFimVigencia:'2026-12-31',DscBaseTarifaria:'Tarifa de Aplicação',DscUnidadeTerciaria:'R$/MWh',SigAgente:'TESTE',DscClasse:'Residencial',DscSubClasse:'Não se aplica',DscDetalhe:'Não se aplica',NomPostoTarifario:'Não se aplica',DscSubGrupo:'B1',DscModalidadeTarifaria:'Convencional',SigAgenteAcessante:null,VlrTE:'500,00',VlrTUSD:'300,00',DscREH:'Referência fictícia'}]);assert.equal(rows[0].rate,0.5);assert.equal(normalizeTariffs([{}]).length,0);
 const b={...bill(),distributor:'TESTE',subgroup:'B1',tariffMode:'Convencional',tariffClass:'Residencial',tariffSubclass:'Não se aplica',detail:'Não se aplica',taxIncluded:false};b.items[0]={...b.items[0],component:'TE',post:'Não se aplica',unit:'kWh'};
 const analyze=()=>auditBills([{id:'a',type:'invoice',bill:b}],rows).checks.find(x=>x.rule==='tariff');assert.equal(analyze().expected,5000);b.taxIncluded=true;assert.equal(analyze().state,'not_checked');b.taxIncluded=false;b.end='2027-01-01';assert.equal(analyze().state,'not_checked');
 const flags=normalizeFlags([{DatCompetencia:'2026-08-01',NomBandeiraAcionada:'Amarela'}],[{DatVigencia:'2026-07-01',NomBandeiraAcionada:'Amarela',VlrAdicionalBandeiraRSMWh:'20,00',DscResolucao:'Teste'}]);assert.equal(flags[0].rate,0.02);assert.equal(normalizeFlags([{DatCompetencia:'2026-06-01',NomBandeiraAcionada:'Amarela'}],[]).length,0);
});
test('encrypted persistence, deduplication, replacement, multiple units and conflict protection',async()=>{
 let c=await intake();assert.equal(c.documents[0].state,'ready');assert.equal(c.analysis.findings[0].delta,2000);c=await upload(c);assert.equal(c.documents.length,1);c=await confirm(c);c=await action(c,owner,'prepare');const old=c;
 c=await action(c,owner,'correct',{documentId:c.documents[0].id,bill:{...bill(),totalCents:8000}});assert.equal(c.confirmation,null);assert.equal(c.request,null);assert.equal(c.analysis.findings.length,0);await assert.rejects(()=>action(old,owner,'refer'),{code:'conflict'});
 assert.ok((await pg.query('SELECT COUNT(*) AS n FROM audita_energy_versions WHERE case_id=$1',[c.id])).rows[0].n>0);
 c=await upload(c,'invoice','replacement');await service.runJobs();c=await service.get(owner,c.id);assert.ok(c.analysis.pending.some(p=>p.message.includes('sobrepostos')));c=await action(c,owner,'supersede',{documentId:c.documents[0].id,replacementId:c.documents[1].id});assert.equal(c.analysis.pending.length,0);
 c=await upload(c,'invoice','unit2');await service.runJobs();c=await service.get(owner,c.id);const did=c.documents.find(d=>d.id!==c.documents[0].id&&d.id!==c.documents[1].id).id;c=await action(c,owner,'correct',{documentId:did,bill:{...bill(),unit:'002'}});assert.equal(c.analysis.pending.length,0);assert.equal(new Set(c.analysis.findings.map(f=>f.unit)).size,2);
 assert.ok(!(await readFile(join(dir,'documents',did),'utf8')).includes('%PDF'));assert.ok(!(await pg.query('SELECT encrypted_payload FROM audita_energy_cases WHERE id=$1',[c.id])).rows[0].encrypted_payload.includes('Pessoa Fictícia'));
});
test('permissions: owner, same-tenant, assigned lawyer, consent and private notes/downloads',async()=>{
 await assert.rejects(()=>service.create(owner,{role:'self',consent:false}),{code:'consent_required'});let c=await intake('representative');await assert.rejects(()=>confirm(c),{code:'representation_required'});c=await upload(c,'representation');c=await confirm(c);
 for(const who of [other,sameTenant,lawyer])await assert.rejects(()=>service.get(who,c.id),{code:'not_found'});await assert.rejects(()=>service.list(owner,true),{code:'forbidden'});
 c=await action(c,owner,'refer');assert.ok((await service.list(lawyer,true)).some(x=>x.id===c.id));c=await service.claim(lawyer,c.id);await assert.rejects(()=>service.claim(unassigned,c.id),{code:'conflict'});await assert.rejects(()=>service.download(other,c.id,c.documents[0].id),{code:'not_found'});
 c=await action(c,lawyer,'note',{text:'Nota interna fictícia',internal:true});assert.ok(c.events.some(e=>e.message==='Nota interna fictícia'));assert.ok(!(await service.get(owner,c.id)).events.some(e=>e.message==='Nota interna fictícia'));
 await assert.rejects(()=>action(c,owner,'note',{text:'Teste',internal:true}),{code:'invalid_note'});await assert.rejects(()=>action(c,lawyer,'correct',{documentId:c.documents[0].id,bill:bill()}),{code:'forbidden'});
 assert.match((await service.download(lawyer,c.id,c.documents[0].id)).buffer.toString(),/^%PDF/);
});
test('full company journey with payment evidence, PDF, protocol, confirmed response, receipt and restart',async()=>{
 let c=await intake('company');c=await upload(c,'representation');c=await upload(c,'payment');const payment=c.documents.find(d=>d.type==='payment');c=await action(c,owner,'correct',{documentId:c.documents.find(d=>d.type==='invoice').id,bill:{...bill(),paid:true,paymentDocumentId:payment.id}});c=await confirm(c);c=await action(c,owner,'prepare');const pdf=await service.generate(owner,c.id);assert.equal(pdf.buffer.subarray(0,5).toString(),'%PDF-');
 await assert.rejects(()=>action(c,owner,'protocol',{number:'TESTE',date:'2026-02-30'}),{code:'invalid_protocol'});c=await action(c,owner,'protocol',{number:'TESTE-123',date:'2026-09-10'});c=await action(c,owner,'status',{status:'pending',confirmed:true,note:'Protocolo em análise.'});
 c=await upload(c,'response');assert.equal(c.status,'pending');await service.runJobs();c=await service.get(owner,c.id);assert.ok(c.request);const response=c.documents.find(d=>d.type==='response');assert.equal(c.status,'pending');c=await action(c,owner,'status',{status:'response',documentId:response.id,confirmed:true,note:'Resposta conferida.'});c=await action(c,owner,'status',{status:'approved',documentId:response.id,confirmed:true,note:'Aprovação conferida.'});c=await upload(c,'receipt');c=await action(c,owner,'status',{status:'received',documentId:c.documents.find(d=>d.type==='receipt').id,method:'credit',amountCents:2000,confirmed:true,note:'Crédito de teste recebido.'});assert.equal(c.outcome.method,'credit');
 await pg.close();await open();service=make();c=await service.get(owner,c.id);assert.equal(c.status,'received');assert.equal(c.outcome.amountCents,2000);assert.ok(c.events.length);assert.equal((await service.generate(owner,c.id)).buffer.subarray(0,5).toString(),'%PDF-');
});
test('three bounded retries, failed document correction and crash lease recovery',async()=>{
 let c=await create();c=await upload(c);readMode='transient';for(let i=0;i<3;i++){await pg.query("UPDATE audita_energy_jobs SET run_at=NOW() WHERE document_id=$1",[c.documents[0].id]);await service.runJobs();}c=await service.get(owner,c.id);assert.equal(c.documents[0].state,'needs_correction');assert.equal((await pg.query('SELECT attempts FROM audita_energy_jobs WHERE document_id=$1',[c.documents[0].id])).rows[0].attempts,3);
 c=await action(c,owner,'correct',{documentId:c.documents[0].id,bill:bill()});assert.equal(c.documents[0].state,'ready');readMode='ok';
 let interrupted=await create();interrupted=await upload(interrupted);await pg.query("UPDATE audita_energy_jobs SET attempts=3,state='running',lease_until=NOW()-INTERVAL '1 minute' WHERE document_id=$1",[interrupted.documents[0].id]);await service.runJobs();interrupted=await service.get(owner,interrupted.id);assert.equal(interrupted.documents[0].state,'needs_correction');
 let bad=await create();bad=await upload(bad);readMode='bad';await service.runJobs();readMode='ok';bad=await upload(bad,'invoice','good');await service.runJobs();bad=await service.get(owner,bad.id);assert.ok(bad.documents.some(d=>d.state==='ready'));assert.ok(bad.analysis.pending.length);
});
test('reference failures visible and daily schedule durable; never replaces cached valid data',async()=>{
 const row={kind:'flag',month:'2026-08',rate:0.02,source:'Controlled reference'};await pg.query("INSERT INTO audita_energy_references(kind,payload) VALUES('flag',$1)",[{rows:[row]}]);let calls=0;const fetcher=async()=>{calls++;throw Error('offline');};await refreshReferences(pool,{fetcher});const r=(await pg.query("SELECT * FROM audita_energy_references WHERE kind='flag'")).rows[0];assert.deepEqual(r.payload.rows,[row]);assert.match(r.error,/Falha/);const count=calls;await refreshReferences(pool,{fetcher});assert.equal(calls,count);
});

test('API authentication, cross-origin mutation and malformed JSON are blocked',async()=>{
 let auth=null,status,body;
 const handler=createEnergyHandler({service,getAuth:async()=>auth,readJson:async()=>{throw new SyntaxError('invalid JSON');},sendJson:(_r,s,b)=>{status=s;body=b;}});
 const res={setHeader(){}};
 await handler({method:'GET',headers:{}},res,new URL('http://localhost/api/energy-audit/config'));assert.equal(status,200);assert.equal(body.ready,true);
 await handler({method:'GET',headers:{}},res,new URL('http://localhost/api/energy-audit/cases'));assert.equal(status,401);
 auth=owner;await handler({method:'POST',headers:{host:'localhost',origin:'https://other.test'}},res,new URL('http://localhost/api/energy-audit/cases'));assert.equal(status,403);
 await handler({method:'POST',headers:{host:'localhost',origin:'http://localhost'}},res,new URL('http://localhost/api/energy-audit/cases'));assert.equal(status,400);
});

test('a stale extraction cannot overwrite a newer job attempt',async()=>{
 let release,started;const startedPromise=new Promise(r=>started=r),releasePromise=new Promise(r=>release=r);
 const held=createEnergyService({getDb:()=>({pool,dbReady:true}),env,extractor:Object.assign(async()=>{started();await releasePromise;return bill();},{available:()=>true})});
 let c=await create();c=await upload(c);const work=held.runJobs();await startedPromise;
 await pg.query("UPDATE audita_energy_jobs SET attempts=2,lease_until=NOW()+INTERVAL '3 minutes' WHERE document_id=$1",[c.documents[0].id]);release();await work;
 assert.equal((await pg.query('SELECT state FROM audita_energy_jobs WHERE document_id=$1',[c.documents[0].id])).rows[0].state,'running');
 assert.equal((await service.get(owner,c.id)).documents[0].bill,null);
 await pg.query("UPDATE audita_energy_jobs SET lease_until=NOW()-INTERVAL '1 minute' WHERE document_id=$1",[c.documents[0].id]);await service.runJobs();assert.equal((await service.get(owner,c.id)).documents[0].state,'ready');
});
