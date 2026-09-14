import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {createPisPasepService} from '../services/pis-pasep.service.mjs';
import {createPisPasepHandler} from '../services/pis-pasep-api.mjs';
import {pisQuestions,pisAnswer,pisDate,pisSummary} from '../services/pis-pasep-domain.mjs';
let pg,pool,dir,env,service;
const owner={tenantId:1,user:{id:1,role:'owner'}},other={tenantId:2,user:{id:2,role:'owner'}},lawyer={tenantId:2,user:{id:3,role:'lawyer'}},unassigned={tenantId:1,user:{id:4,role:'lawyer'}},sameTenant={tenantId:1,user:{id:5,role:'member'}};
const sample={role:'self',consent:true,requester:'Pessoa fictícia',work:'yes',withdrawal:'no',hasNumber:'yes',number:'12044566789',consultation:'found',documents:'later',referral:'yes'};
const make=()=>createPisPasepService({getDb:()=>({pool,dbReady:true}),env,now:()=>new Date('2026-09-11T10:00:00Z')});
async function open(){pg=new PGlite(join(dir,'db'));await pg.waitReady;pool={query:(...args)=>pg.query(...args),connect:async()=>({query:(...args)=>pg.query(...args),release(){}})};}
before(async()=>{dir=await mkdtemp(join(tmpdir(),'audita-pis-'));await open();await pg.exec((await readFile(new URL('../db/schema.sql',import.meta.url),'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));await pg.exec(await readFile(new URL('../db/pis-pasep.sql',import.meta.url),'utf8'));await pg.exec("INSERT INTO audita_tenants(id,name,slug) VALUES(2,'Outra','outra'); INSERT INTO audita_users(id,tenant_id,name,email,password_hash,role) VALUES(1,1,'Cliente','piscliente@example.test','x','owner'),(2,2,'Outro','pisoutro@example.test','x','owner'),(3,2,'Advogado','pisadv@example.test','x','lawyer'),(4,1,'Advogada','pisadv2@example.test','x','lawyer'),(5,1,'Colega','piscolega@example.test','x','member');");env={AUDITA_PIS_ENABLED:'true',AUDITA_PIS_ENCRYPTION_KEY:randomBytes(32).toString('hex'),AUDITA_PIS_STORAGE_PATH:join(dir,'documents')};service=make();});
after(async()=>{await pg?.close();await rm(dir,{recursive:true,force:true});});
const action=(c,who,action,values={})=>service.command(who,c.id,{revision:c.revision,action,...values});
async function intake(answers=sample){let c=await service.create(owner);while(c.question)c=await action(c,owner,'answer',{key:c.question.key,value:answers[c.question.key]});return c;}
async function upload(c,type,who=owner){return service.upload(who,c.id,{buffer:Buffer.from('%PDF-1.7\nFictitious test evidence'),name:`${type}.pdf`,type});}
async function reviewed(){let c=await intake();c=await service.claim(lawyer,c.id);for(const type of ['identity','consultation'])c=await upload(c,type);return action(c,lawyer,'review',{confirmed:true,result:'verified',note:'Conferência fictícia.',documentId:c.documents.find(d=>d.type==='consultation').id});}
const contract={percent:20,basis:'Valor efetivamente recebido pelo cliente.',scope:'Atendimento administrativo.',terms:'Honorários de êxito após recebimento. Sem cobrança inicial.'};
async function record(c,kind,who=lawyer,extra={}){c=await upload(c,kind,who);return action(c,who,'record',{kind,date:'2026-09-10',documentId:c.documents.at(-1).id,note:'Registro fictício.',...extra});}

test('jornadas de titular, representante e herdeiro; desconhecidos e consulta sem resultado',async()=>{
 for(const role of ['self','representative','heir']){
  const c=await intake({...sample,role,subject:'Titular fictício',relationship:'Filha',hasNumber:'unknown',consultation:'difficulty'});
  assert.equal(c.status,'queued');assert.equal(c.answers.number,undefined);assert.equal(c.questions.some(q=>q.key==='subject'),role!=='self');assert.equal(c.checklist.some(d=>d.type==='death'),role==='heir');assert.ok(c.summary.pending.length);
 }
 const no=await intake({...sample,consultation:'not_found',referral:'no'});assert.match(no.summary.message,/não é uma conclusão definitiva/);assert.equal(no.status,'ready');
 const missing=await intake({...sample,work:'unknown',withdrawal:'unknown',hasNumber:'unknown',consultation:'difficulty',referral:'no'});assert.equal(missing.status,'assistance');assert.equal(missing.summary.pending.length,4);
 assert.equal(pisQuestions({role:'self',hasNumber:'unknown'}).some(q=>q.key==='number'),false);
});
test('valida perguntas no servidor, consentimento, PIS e datas reais',async()=>{
 await assert.rejects(()=>service.create({tenantId:1}),{code:'authentication_required'});
 let c=await service.create(owner);await assert.rejects(()=>action(c,owner,'answer',{key:'requester',value:'Não autorizado'}),{code:'invalid_question'});
 c=await action(c,owner,'answer',{key:'role',value:'self'});await assert.rejects(()=>action(c,owner,'answer',{key:'consent',value:false}),{code:'consent_required'});
 await assert.rejects(()=>upload(c,'identity'),{code:'consent_required'});
 assert.throws(()=>pisAnswer('number','11111111111',{hasNumber:'yes'}));assert.throws(()=>pisAnswer('consultation','approved',{}));assert.throws(()=>pisDate('2026-02-30'));assert.throws(()=>pisDate('2099-01-01'));
 assert.match(pisSummary({...sample,work:'no'}).pending[0],/não do abono anual/);
});
test('Voltar invalida respostas posteriores e condições; revisão concorrente exige recarga',async()=>{
 let c=await reviewed();c=await action(c,lawyer,'contract',contract);const old=c;
 c=await action(c,owner,'answer',{key:'hasNumber',value:'unknown'});
 assert.equal(c.question.key,'consultation');assert.equal(c.answers.consultation,undefined);assert.equal(c.answers.number,undefined);assert.equal(c.review,null);assert.equal(c.contracts[0].state,'superseded');
 await assert.rejects(()=>action(old,owner,'answer',{key:'work',value:'yes'}),{code:'case_conflict'});
});
test('fila sem dados pessoais, atribuição exclusiva e isolamento de clientes e advogados',async()=>{
 let c=await intake();const queue=await service.queue(lawyer);assert.ok(queue.some(q=>q.id===c.id));assert.ok(!JSON.stringify(queue).includes(sample.requester));assert.ok(!JSON.stringify(queue).includes(sample.number));
 for(const who of [other,sameTenant,lawyer])await assert.rejects(()=>service.get(who,c.id),{code:'case_not_found'});
 await assert.rejects(()=>service.queue(owner),{code:'operator_required'});
 c=await service.claim(lawyer,c.id);await assert.rejects(()=>service.claim(unassigned,c.id),{code:'case_conflict'});await assert.rejects(()=>service.get(unassigned,c.id),{code:'case_not_found'});
 await assert.rejects(()=>action(c,owner,'review',{confirmed:true}),{code:'operator_required'});
 c=await action(c,lawyer,'note',{note:'Segredo interno fictício',internal:true});assert.ok(c.events.some(e=>e.message==='Segredo interno fictício'));assert.ok(!(await service.get(owner,c.id)).events.some(e=>e.message==='Segredo interno fictício'));
 c=await upload(c,'identity');const file=c.documents.at(-1);
 await assert.rejects(()=>service.download(unassigned,c.id,file.id),{code:'case_not_found'});
 const downloaded=await service.download(lawyer,c.id,file.id);assert.match(downloaded.buffer.toString(),/^%PDF/);
 assert.ok((await service.get(lawyer,c.id)).events.some(e=>e.kind==='download'));
 assert.ok(!(await readFile(join(dir,'documents',file.id+'.bin'),'utf8')).includes('%PDF'));
 const raw=await pool.query('SELECT encrypted_payload FROM audita_pis_cases WHERE id=$1',[c.id]);assert.ok(!raw.rows[0].encrypted_payload.includes(sample.number));
 await assert.rejects(()=>service.upload(owner,c.id,{type:'identity',name:'bad.pdf',buffer:Buffer.from('<script>bad</script>')}),{code:'invalid_file'});
});
test('contratação versionada, aceite explícito e êxito sem cobrança inicial',async()=>{
 let c=await reviewed();await assert.rejects(()=>action(c,lawyer,'contract',{...contract,percent:0}),{code:'invalid_percent'});
 c=await action(c,lawyer,'contract',contract);const first=c.contracts[0];c=await action(c,lawyer,'contract',{...contract,percent:15});const latest=c.contracts.at(-1);
 await assert.rejects(()=>action(c,owner,'accept',{contractId:first.id,version:first.version,accepted:true}),{code:'contract_conflict'});
 await assert.rejects(()=>action(c,owner,'accept',{contractId:latest.id,version:latest.version,accepted:false}),{code:'acceptance_required'});
 c=await action(c,owner,'accept',{contractId:latest.id,version:latest.version,accepted:true});assert.equal(c.contracts.at(-1).initialCents,0);assert.equal(c.contracts.at(-1).state,'accepted');
 await assert.rejects(()=>action(c,owner,'answer',{key:'work',value:'no'}),{code:'intake_locked'});
 await assert.rejects(()=>action(c,lawyer,'activate',{documentId:'missing'}),{code:'evidence_required'});
 c=await upload(c,'contract');c=await action(c,lawyer,'activate',{documentId:c.documents.at(-1).id});assert.equal(c.status,'preparation');
 await assert.rejects(()=>action(c,lawyer,'contract',contract),{code:'contract_locked'});
 c=await upload(c,'fee');await assert.rejects(()=>action(c,lawyer,'record',{kind:'fee',date:'2026-09-10',documentId:c.documents.at(-1).id,note:'Honorários',amountCents:1000}),{code:'receipt_required'});
});
test('consulta → revisão → contrato → protocolo → recebimento → honorários → retomada persistente',async()=>{
 let c=await reviewed();c=await action(c,lawyer,'contract',contract);const offer=c.contracts.at(-1);c=await action(c,owner,'accept',{contractId:offer.id,version:offer.version,accepted:true});c=await upload(c,'contract');c=await action(c,lawyer,'activate',{documentId:c.documents.at(-1).id});
 c=await action(c,lawyer,'task',{title:'Apresentar documentos na CAIXA',dueDate:'2026-09-20'});
 c=await record(c,'protocol',owner,{number:'TESTE-123',authority:'CAIXA'});assert.equal(c.status,'preparation');assert.equal(c.records.at(-1).confirmed,false);
 c=await action(c,lawyer,'confirm_record',{recordId:c.records.at(-1).id});assert.equal(c.status,'filed');
 await assert.rejects(()=>action(c,owner,'record',{kind:'protocol',date:'2026-09-10',documentId:c.records.at(-1).documentId,note:'Repetido',number:'TESTE-123',authority:'CAIXA'}),{code:'duplicate_record'});
 c=await record(c,'requirement');assert.equal(c.status,'requirement');c=await record(c,'decision',lawyer,{result:'granted'});assert.equal(c.status,'decision');
 c=await record(c,'receipt',owner,{amountCents:100000});assert.equal(c.status,'decision');c=await action(c,lawyer,'confirm_record',{recordId:c.records.at(-1).id});assert.equal(c.status,'received');
 c=await record(c,'fee',lawyer,{amountCents:20000});assert.equal(c.status,'received');c=await action(c,lawyer,'close',{note:'Recebimento e honorários conferidos.'});assert.equal(c.status,'closed');
 const id=c.id;await pg.close();await open();service=make();const resumed=await service.get(owner,id);assert.equal(resumed.status,'closed');assert.equal(resumed.records.length,5);assert.equal(resumed.contracts[0].percent,20);assert.equal(resumed.answers.number,sample.number);assert.ok(resumed.events.some(e=>e.kind==='accept'));assert.equal(resumed.tasks[0].title,'Apresentar documentos na CAIXA');
 await pg.exec(await readFile(new URL('../db/pis-pasep.sql',import.meta.url),'utf8'));assert.equal((await service.get(owner,id)).records.length,5);
});
test('roteamento bloqueia origem externa, acesso anônimo, módulo desabilitado e download sem permissão',async()=>{
 async function request(auth,path,method='GET',headers={}){let status,payload;const handler=createPisPasepHandler({service,getAuth:async()=>auth,readJson:async()=>({}),readBuffer:async()=>Buffer.alloc(0),sendJson:(_r,s,p)=>{status=s;payload=p;}});const response={setHeader(){},writeHead(s){status=s;},end(){}};assert.equal(await handler({method,headers:{host:'localhost:3000',...headers}},response,new URL(path,'http://localhost:3000')),true);return {status,payload};}
 assert.equal((await request(null,'/api/pis-pasep/cases')).status,401);
 assert.equal((await request(owner,'/api/pis-pasep/cases','POST',{origin:'https://other.example'})).status,403);
 const c=await intake();assert.equal((await request(other,`/api/pis-pasep/cases/${c.id}/documents/00000000-0000-0000-0000-000000000000`)).status,404);
 env.AUDITA_PIS_ENABLED='false';assert.equal((await request(owner,'/api/pis-pasep/cases')).status,503);assert.equal((await request(null,'/api/pis-pasep/config')).payload.enabled,false);env.AUDITA_PIS_ENABLED='true';
});
