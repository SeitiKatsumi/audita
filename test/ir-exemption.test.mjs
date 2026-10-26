import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import {PDFDocument} from 'pdf-lib';
import {createIrExemptionService,queryDatajud} from '../services/ir-exemption.service.mjs';
import {analyzeIr,validateAnswer,irSteps,irKey,sealIr,openIr} from '../services/ir-exemption-domain.mjs';
import {createStripeBillingService} from '../services/stripe-billing.service.mjs';

let dir,pg,pool,service,env;
const owner={tenantId:1,user:{id:1,role:'owner',name:'Cliente fictício',email:'cliente@example.test'}};
const stranger={tenantId:2,user:{id:2,role:'owner',name:'Outra conta',email:'outro@example.test'}};
const admin={tenantId:1,user:{id:3,role:'super_admin',name:'Equipe',email:'equipe@example.test'}};
const lawyer={tenantId:2,user:{id:4,role:'member',name:'Advogada fictícia',email:'advogada@example.test'}};
const manager={tenantId:2,user:{id:5,role:'member',name:'Gestor',email:'gestor@example.test'}};
const sample={role:'self',consent:{analysis:true,representation:true},identity:{name:'Cliente fictício',cpf:'52998224725',phone:'11999999999',email:'cliente@example.test'},benefits:[{type:'retirement',payer:'INSS',start:'2018-01-01'}],conditions:['cancer'],diagnosis:{date:'2020-02-01',year:null,remission:'yes'},medical:'official',taxes:{withheld:'yes',periods:[{benefitIndex:0,month:'2025-02',paidCents:20000,refundedCents:5000}]},prior:'none',documents:'later'};
const checkoutCalls=[];
function makeService(){return createIrExemptionService({getDb:()=>({pool,dbReady:true}),env,checkout:async(auth,p)=>{checkoutCalls.push(p);return {id:`cs_test_${p.id}_${p.attempt}`,url:'https://checkout.stripe.com/test',expiresAt:Math.floor(Date.now()/1000)+1800};},extractor:async()=>({candidates:[{key:'diagnosis',value:{date:'2020-03-01',year:null,remission:'unknown'}},{key:'role',value:'heir'}]}),now:()=>new Date('2026-09-10T10:00:00Z')});}
async function openDatabase(){pg=new PGlite(join(dir,'db'));await pg.waitReady;pool={query:(...args)=>pg.query(...args),connect:async()=>({query:(...args)=>pg.query(...args),release(){}})};}
before(async()=>{dir=await mkdtemp(join(tmpdir(),'audita-ir-'));await openDatabase();await pg.exec((await readFile(new URL('../db/schema.sql',import.meta.url),'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));await pg.exec(await readFile(new URL('../db/ir-exemption.sql',import.meta.url),'utf8'));await pg.exec("INSERT INTO audita_tenants(id,name,slug) VALUES(2,'Outra organização','outra'); INSERT INTO audita_users(id,tenant_id,name,email,password_hash,role) VALUES(1,1,'Cliente fictício','cliente@example.test','unused','owner'),(2,2,'Outro','outro@example.test','unused','owner'),(3,1,'Equipe','equipe@example.test','unused','super_admin'),(4,2,'Advogada','advogada@example.test','unused','member'),(5,2,'Gestor','gestor@example.test','unused','member');");env={AUDITA_IR_ENABLED:'true',AUDITA_IR_ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex'),AUDITA_IR_STORAGE_PATH:join(dir,'files'),AUDITA_IR_AI_ENABLED:'true',DATAJUD_API_KEY:'public-test'};service=makeService();});
after(async()=>{await pg?.close();await rm(dir,{recursive:true,force:true});});
async function action(c,auth,action,extra={}){return service.command(auth,c.id,{revision:c.revision,action,...extra});}
async function intake(answers=sample){let c=await service.create(owner);while(c.question){const key=c.question.key;c=await action(c,owner,'answer',{key,value:answers[key]});}return c;}
async function evidence(c,type='medical'){const pdf=await PDFDocument.create();pdf.addPage();return service.upload(owner,c.id,{buffer:Buffer.from(await pdf.save()),name:`${type}.pdf`,type});}
async function reviewed(){let c=await intake();c=await evidence(c);c=await action(c,owner,'analyze');c=await action(c,admin,'review',{note:'Datas e documentos fictícios conferidos para teste.',confirmed:true,reviewedCents:15000});return c;}
function stripeEvent(c,proposal,type='checkout.session.completed',overrides={}){return {id:`evt_${crypto.randomUUID()}`,type,data:{object:{id:`cs_test_${proposal.id}_1`,payment_status:'paid',currency:'brl',amount_total:proposal.amountCents,metadata:{purchase_kind:'ir_proposal',ir_case_id:c.id,ir_proposal_id:proposal.id,ir_proposal_version:String(proposal.version),audita_tenant_id:'1',audita_user_id:'1'},...overrides}}};}

test('validação de dados, meses, duplicatas e criptografia vinculada ao registro',()=>{
 assert.throws(()=>validateAnswer('identity',{...sample.identity,cpf:'11111111111'}));
 assert.throws(()=>validateAnswer('diagnosis',{date:'2025-02-30',year:null,remission:'yes'}));
 assert.throws(()=>validateAnswer('taxes',{withheld:'yes',periods:[...sample.taxes.periods,...sample.taxes.periods]},sample));
 assert.throws(()=>validateAnswer('taxes',{withheld:'yes',periods:[{...sample.taxes.periods[0],benefitIndex:8}]},sample));
 const key=irKey(env.AUDITA_IR_ENCRYPTION_KEY),cipher=sealIr({diagnosis:'privado'},key,'case:1');
 assert.equal(openIr(cipher,key,'case:1').diagnosis,'privado');assert.throws(()=>openIr(cipher,key,'case:2'));
});
test('estimativa não extrapola meses, exclui salário, anterior ao direito e já restituído',()=>{
 const a=structuredClone(sample);a.benefits.push({type:'salary',payer:'Empregador',start:'2010-01-01'});a.taxes.periods.push({benefitIndex:1,month:'2025-02',paidCents:50000,refundedCents:0},{benefitIndex:0,month:'2019-02',paidCents:30000,refundedCents:0});
 const result=analyzeIr(a,[],new Date('2026-09-10'));assert.equal(result.estimate.documentedCents,15000);assert.equal(result.estimate.futureSavingsCents,null);assert.ok(result.estimate.rows[1].reason);assert.equal(result.state,'preliminary_indications');
 a.diagnosis.date=null;a.diagnosis.year=2020;assert.equal(analyzeIr(a).estimate.documentedCents,0);
});
test('triagem curta prioriza perguntas simples, preserva legado e nao inventa dados',async()=>{
 assert.deepEqual(irSteps({role:'self'},2).filter(s=>!s.optional).map(s=>s.key),['role','consent','benefits','taxes','conditions','medical','identity']);
 assert.equal(irSteps({role:'self'})[2].key,'identity');
 assert.equal(irSteps({role:'self'}).find(s=>s.key==='diagnosis').optional,undefined);
 const short={...sample,benefits:[{type:'retirement',payer:null,start:null}],medical:'available',taxes:{withheld:'no',periods:[]}};
 delete short.diagnosis;delete short.prior;delete short.documents;
 let c=await intake(short);
 assert.equal(c.intakeVersion,2);assert.equal(c.question,null);
 c=await action(c,owner,'analyze');
 assert.equal(c.analysis.state,'preliminary_indications');assert.equal(c.analysis.estimate.documentedCents,0);
 assert.equal(c.answers.benefits[0].payer,null);assert.equal(c.answers.diagnosis,undefined);
 assert.equal((await service.get(owner,c.id)).question,null);
 c=await action(c,owner,'answer',{key:'benefits',value:[{type:'pension',payer:null,start:null}]});
 assert.equal(c.question.key,'taxes');assert.equal(c.analysis,null);
});

test('voltar ao laudo reinicia documentos e contato sem pular respostas',async()=>{
 let c=await intake();
 c=await action(c,owner,'answer',{key:'medical',value:'obtain',restartFollowing:true});
 assert.equal(c.answers.identity,undefined);
 assert.equal(c.answers.documents,undefined);
 assert.equal(c.question.key,'identity');
 assert.ok(c.answers.conditions);
 c=await service.get(owner,c.id);
 assert.equal(c.question.key,'identity');
 c=await action(c,owner,'answer',{key:'medical',value:'available',restartFollowing:true});
 c=await action(c,owner,'answer',{key:'documents',value:'ready'});
 assert.equal(c.question.key,'identity');
});

test('cadastro exige usuário mesmo sem autenticação global e segue ordem do servidor',async()=>{
 await assert.rejects(()=>service.create({tenantId:1}),{code:'authentication_required'});
 const c=await service.create(owner);await assert.rejects(()=>action(c,owner,'answer',{key:'identity',value:sample.identity}),{code:'invalid_step'});
 await assert.rejects(()=>action(c,owner,'analyze'),{code:'consent_required'});
 await assert.rejects(()=>service.get(stranger,c.id),{code:'case_not_found'});
 await assert.rejects(()=>service.command(owner,c.id,{action:'answer',key:'role',value:'self',revision:0}),{code:'case_conflict'});
});
test('isolamento por organização e atribuição explícita à Inventarium',async()=>{
 const c=await intake();await service.grantStaff(admin,{email:lawyer.user.email,role:'lawyer'});await service.grantStaff(admin,{email:manager.user.email,role:'manager'});
 await assert.rejects(()=>service.get(lawyer,c.id),{code:'case_not_found'});await assert.rejects(()=>service.get(manager,c.id),{code:'case_not_found'});
 let assigned=await action(c,admin,'assign',{userId:4});assert.equal((await service.get(lawyer,c.id)).permissions.operator,true);
 await assert.rejects(()=>action(assigned,lawyer,'answer',{key:'role',value:'self'}),{code:'owner_required'});
 assigned=await action(assigned,lawyer,'note',{text:'Anotação restrita.',internal:true});assert.ok(assigned.events.some(e=>e.message==='Anotação restrita.'));
 assert.ok(!(await service.get(owner,c.id)).events.some(e=>e.message==='Anotação restrita.'));
 assert.ok(!(await service.list(stranger)).some(x=>x.id===c.id));
});
test('herdeiro, representante, complementação, desconhecidos e ausência de laudo',async()=>{
 const heir={...sample,role:'heir',subject:{name:'Titular fictício',cpf:'11144477735'},benefits:[{type:'private',payer:'Previdência complementar',start:'2018-01-01'}],medical:'obtain',heir:{deathDate:'2024-05-01',relationship:'Filha',estate:'open',representative:'yes'}};
 let c=await intake(heir);c=await action(c,owner,'analyze');assert.equal(c.analysis.specialistReview,true);assert.equal(c.analysis.estimate.documentedCents,0);assert.ok(c.checklist.some(d=>d.type==='death'));
 const rep=await intake({...sample,role:'representative',subject:heir.subject});assert.ok(rep.steps.some(s=>s.key==='subject'));assert.ok(!rep.steps.some(s=>s.key==='heir'));
 const unknown=analyzeIr({...sample,conditions:['unknown'],benefits:[{type:'unknown',payer:'Não sei',start:null}]});assert.equal(unknown.state,'specialist_review');
});
test('arquivos criptografados e sugestões nunca alteram respostas automaticamente',async()=>{
 let c=await intake();c=await evidence(c);const id=c.documents[0].id;
 const disk=await readFile(join(dir,'files',`${id}.bin`));assert.notEqual(disk.subarray(0,5).toString(),'%PDF-');
 await assert.rejects(()=>service.download(stranger,c.id,id),{code:'case_not_found'});
 const file=await service.download(owner,c.id,id);assert.equal(file.buffer.subarray(0,5).toString(),'%PDF-');
 const savedDiagnosis=c.answers.diagnosis;c=await service.extract(owner,c.id,id);assert.deepEqual(c.answers.diagnosis,savedDiagnosis);assert.equal(c.extractions[0].candidates.length,1);
 const before=c.answers.diagnosis;c=await action(c,owner,'answer',{key:'diagnosis',value:c.extractions[0].candidates[0].value});assert.notDeepEqual(before,c.answers.diagnosis);
 await assert.rejects(()=>service.upload(owner,c.id,{buffer:Buffer.from('<script>bad</script>'),name:'fake.pdf',type:'medical'}),{code:'invalid_file'});
});
test('jornada completa, pagamento idempotente, minuta, protocolo e acompanhamento',async()=>{
 let c=await reviewed();c=await service.publishProposal(admin,c.id,{revision:c.revision,kind:'adm',amountCents:19900,scope:'Preparar requerimento e acompanhar.',terms:'Contrato por caso, revisão incluída.'});let p=c.proposals[0];
 await assert.rejects(()=>service.createCheckout(owner,c.id,p.id),{code:'proposal_conflict'});
 c=await service.acceptProposal(owner,c.id,p.id,{accepted:true,version:p.version});await service.createCheckout(owner,c.id,p.id);
 await assert.rejects(()=>service.paymentEvent(stripeEvent(c,p,'checkout.session.completed',{amount_total:1})),{code:'invalid_payment_amount'});
 const event=stripeEvent(c,p);await service.paymentEvent(event);await service.paymentEvent(event);c=await service.get(owner,c.id);assert.equal(c.proposals[0].state,'paid');assert.equal(c.events.filter(e=>e.kind==='payment_confirmed').length,1);
 c=await action(c,admin,'status',{status:'preparation'});
 const pdf=await service.generate(admin,c.id,'request');assert.ok(pdf.buffer.length>500);
 c=await evidence(c,'protocol');c=await action(c,admin,'protocol',{protocol:{kind:'judicial',number:'00000000020264010000',authority:'TRF1',tribunal:'trf1',date:'2026-09-01',documentId:c.documents.find(d=>d.type==='protocol').id}});assert.equal(c.status,'filed');
 const fetch=async()=>({ok:true,json:async()=>({hits:{hits:[{_source:{numeroProcesso:'00000000020264010000',movimentos:[{codigo:1,nome:'Distribuído',dataHora:'2026-09-01T10:00:00'}]}}]}})});
 await service.runJobs(fetch);await pg.query('UPDATE audita_ir_jobs SET run_at=NOW()');await service.runJobs(fetch);c=await service.get(owner,c.id);assert.equal(c.events.filter(e=>e.kind==='court_movement').length,1);assert.equal(c.protocols[0].monitoring.state,'ok');
 c=await evidence(c,'decision');c=await action(c,admin,'outcome',{outcome:{kind:'exemption',note:'Concessão fictícia para teste.',documentId:c.documents.find(d=>d.type==='decision').id,granted:true}});assert.ok(c.outcomes.exemption);assert.ok(!c.outcomes.refund);
 c=await evidence(c,'refund');c=await action(c,admin,'outcome',{outcome:{kind:'refund',note:'Recebimento fictício.',amountCents:15000,documentId:c.documents.find(d=>d.type==='refund').id}});assert.equal(c.outcomes.refund.amountCents,15000);
 // An additional Ouro proposal does not reuse or silently charge the paid ADM session.
 c=await service.publishProposal(admin,c.id,{revision:c.revision,kind:'ouro',amountCents:29900,scope:'Atuação judicial adicional.',terms:'Novo aceite obrigatório.',additional:true});assert.equal(c.proposals[0].state,'published');assert.equal(c.proposals[0].additional,true);
 await assert.rejects(()=>service.createCheckout(owner,c.id,c.proposals[0].id),{code:'proposal_conflict'});
});
test('versão substituída não pode ser aceita; recibo operacional preserva revisão',async()=>{
 let c=await reviewed();c=await service.publishProposal(admin,c.id,{revision:c.revision,kind:'adm',amountCents:10000,scope:'Versão 1',terms:'Condições 1'});const old=c.proposals[0];
 c=await service.publishProposal(admin,c.id,{revision:c.revision,kind:'adm',amountCents:12000,scope:'Versão 2',terms:'Condições 2'});
 await assert.rejects(()=>service.acceptProposal(owner,c.id,old.id,{accepted:true,version:old.version}),{code:'proposal_conflict'});
 c=await evidence(c,'contract');assert.ok(c.review);c=await evidence(c,'medical');assert.equal(c.review,null);assert.equal(c.analysis,null);assert.equal(c.proposals[0].state,'superseded');
});
test('pagamento assíncrono, falha e nova tentativa sem concessão prematura',async()=>{
 let c=await reviewed();c=await service.publishProposal(admin,c.id,{revision:c.revision,kind:'adm',amountCents:10000,scope:'Pedido',terms:'Condições'});const p=c.proposals[0];c=await service.acceptProposal(owner,c.id,p.id,{version:p.version,accepted:true});await service.createCheckout(owner,c.id,p.id);
 await service.paymentEvent(stripeEvent(c,p,'checkout.session.completed',{payment_status:'unpaid'}));assert.equal((await service.get(owner,c.id)).proposals[0].state,'payment_pending');
 await service.paymentEvent(stripeEvent(c,p,'checkout.session.async_payment_failed',{payment_status:'unpaid'}));assert.equal((await service.get(owner,c.id)).proposals[0].state,'accepted');await service.createCheckout(owner,c.id,p.id);assert.equal(checkoutCalls.at(-1).attempt,2);
});
test('titular admin e super_admin aceita sem Stripe; mantém revisão, permissões e aceite de upgrade',async()=>{
 for(const role of ['admin','super_admin']){
  const complimentary={...owner,user:{...owner.user,role}},calls=checkoutCalls.length;
  let c=await reviewed();c=await service.publishProposal(admin,c.id,{revision:c.revision,kind:'adm',amountCents:10000,scope:'Requerimento fictício',terms:'Revisão profissional obrigatória'});const offer=c.proposals[0];
  await assert.rejects(()=>service.createCheckout(complimentary,c.id,offer.id),{code:'proposal_conflict'});
  await assert.rejects(()=>service.acceptProposal(complimentary,c.id,offer.id,{version:offer.version,accepted:false}),{code:'acceptance_required'});
  await assert.rejects(()=>service.acceptProposal(admin,c.id,offer.id,{version:offer.version,accepted:true}),{code:'owner_required'});
  c=await service.acceptProposal(complimentary,c.id,offer.id,{version:offer.version,accepted:true});
  assert.equal(c.proposals[0].paymentWaived,true);assert.equal(c.proposals[0].state,'accepted');assert.equal(c.proposals[0].paidAt,null);assert.equal(c.proposals[0].paymentWaiver.by,owner.user.id);assert.equal(c.permissions.operator,role==='super_admin');
  const waived=await service.createCheckout(complimentary,c.id,offer.id);assert.equal(waived.paymentWaived,true);assert.equal(waived.url,undefined);assert.equal(checkoutCalls.length,calls);
  c=await action(waived.case,admin,'status',{status:'preparation'});
  c=await evidence(c,'protocol');c=await action(c,admin,'protocol',{protocol:{kind:'administrative',number:'PROTOCOLO-FICTICIO',authority:'Órgão fictício',date:'2026-09-01',documentId:c.documents.find(d=>d.type==='protocol').id}});assert.equal(c.status,'filed');
  await assert.rejects(()=>service.publishProposal(admin,c.id,{revision:c.revision,kind:'ouro',amountCents:20000,scope:'Upgrade fictício',terms:'Novo aceite'}),{code:'invalid_upgrade'});
  c=await service.publishProposal(admin,c.id,{revision:c.revision,kind:'ouro',amountCents:20000,scope:'Upgrade fictício',terms:'Novo aceite',additional:true});const upgrade=c.proposals[0];
  assert.equal(upgrade.additional,true);assert.equal(upgrade.paymentWaived,undefined);await assert.rejects(()=>service.createCheckout(complimentary,c.id,upgrade.id),{code:'proposal_conflict'});
  c=await service.acceptProposal(complimentary,c.id,upgrade.id,{version:upgrade.version,accepted:true});assert.equal(c.proposals[0].paymentWaived,true);assert.equal(checkoutCalls.length,calls);
 }
});
test('promoção do titular dispensa proposta aceita, preserva checkout anterior e expiração sem cobrança nova',async()=>{
 let c=await reviewed();c=await service.publishProposal(admin,c.id,{revision:c.revision,kind:'adm',amountCents:10000,scope:'Pedido fictício',terms:'Condições'});const offer=c.proposals[0];c=await service.acceptProposal(owner,c.id,offer.id,{version:offer.version,accepted:true});await service.createCheckout(owner,c.id,offer.id);
 const calls=checkoutCalls.length,complimentary={...owner,user:{...owner.user,role:'admin'}};
 let resumed=await service.createCheckout(complimentary,c.id,offer.id);assert.equal(resumed.paymentWaived,true);assert.equal(resumed.case.proposals[0].paidAt,null);
 resumed=await service.createCheckout(complimentary,c.id,offer.id);assert.equal(checkoutCalls.length,calls);assert.equal(resumed.case.events.filter(e=>e.kind==='proposal_payment_waived').length,1);
 let stored=(await pg.query('SELECT * FROM audita_ir_proposals WHERE id=$1',[offer.id])).rows[0];assert.equal(stored.checkout_id,`cs_test_${offer.id}_1`);
 await service.paymentEvent(stripeEvent(c,offer,'checkout.session.expired',{payment_status:'unpaid'}));c=await service.get(owner,c.id);assert.equal(c.proposals[0].paymentWaived,true);assert.equal(c.proposals[0].paidAt,null);assert.ok(c.events.some(e=>e.kind==='payment_checkout_closed'));assert.equal(c.events.some(e=>e.kind==='payment_retry'),false);
 stored=(await pg.query('SELECT * FROM audita_ir_proposals WHERE id=$1',[offer.id])).rows[0];assert.equal(stored.checkout_id,null);
 assert.equal((await service.createCheckout(owner,c.id,offer.id)).paymentWaived,true);assert.equal(checkoutCalls.length,calls);
 c=await action(await service.get(owner,c.id),owner,'answer',{key:'medical',value:'available'});assert.equal(c.review,null);c=await action(c,admin,'status',{status:'review'});await assert.rejects(()=>action(c,admin,'status',{status:'preparation'}),{code:'payment_required'});
 c=await reviewed();c=await service.publishProposal(admin,c.id,{revision:c.revision,kind:'adm',amountCents:12000,scope:'Segundo pedido fictício',terms:'Condições'});const other=c.proposals[0];c=await service.acceptProposal(owner,c.id,other.id,{version:other.version,accepted:true});assert.equal((await service.createCheckout(complimentary,c.id,other.id)).paymentWaived,true);assert.equal(checkoutCalls.length,calls);
 c=await reviewed();c=await service.publishProposal(admin,c.id,{revision:c.revision,kind:'adm',amountCents:12000,scope:'Pagamento anterior fictício',terms:'Condições'});const pending=c.proposals[0];c=await service.acceptProposal(owner,c.id,pending.id,{version:pending.version,accepted:true});await service.createCheckout(owner,c.id,pending.id);await service.createCheckout(complimentary,c.id,pending.id);await service.paymentEvent(stripeEvent(c,pending));c=await service.get(owner,c.id);assert.equal(c.proposals[0].state,'paid');assert.ok(c.proposals[0].paidAt);assert.equal(c.proposals[0].paymentWaived,true);assert.equal(c.events.filter(e=>e.kind==='payment_confirmed').length,1);
});
test('proposta dispensada exibe acesso gratuito sem link de checkout; aceite antigo oferece retomada',async()=>{
 const source=await readFile(new URL('../ir-exemption.js',import.meta.url),'utf8');const render=source.slice(source.indexOf('function proposalsView()'),source.indexOf('function timelineView()'));
 const proposal={id:'fixture',state:'accepted',kind:'adm',version:1,amountCents:10000,scope:'Teste',terms:'Condições',paymentWaived:true,paymentWaiver:{at:'2026-09-10T10:00:00Z'}},state={case:{permissions:{owner:true,paymentWaiverAllowed:true},proposals:[proposal]}};
 const context={state,esc:String,money:String,fmtDate:String,financialLabels:{accepted:'Aceita · aguardando pagamento'},form:()=>'',check:()=>''};
 let html=runInNewContext(`${render};proposalsView()`,context);assert.match(html,/Aceita · pagamento dispensado/);assert.doesNotMatch(html,/data-checkout=/);assert.doesNotMatch(html,/Pagamento confirmado/);
 delete proposal.paymentWaived;html=runInNewContext(`${render};proposalsView()`,context);assert.match(html,/Continuar com acesso gratuito/);assert.match(html,/data-checkout="fixture"/);
});
test('DataJud valida tribunal, falta de configuração, erro e processo ausente',async()=>{
 const p={number:'00000000020264010000',tribunal:'trf1'};
 await assert.rejects(()=>queryDatajud(p,''),{code:'datajud_not_configured'});
 await assert.rejects(()=>queryDatajud({...p,tribunal:'../../evil'},'key'),{code:'invalid_process'});
 await assert.rejects(()=>queryDatajud(p,'key',async()=>({ok:false})),{code:'datajud_unavailable'});
 assert.equal((await queryDatajud(p,'key',async()=>({ok:true,json:async()=>({hits:{hits:[]}})}))).state,'not_found');
 await pg.query('UPDATE audita_ir_jobs SET run_at=NOW()');await service.runJobs(async()=>{throw Error('network');});
 const jobs=(await pg.query('SELECT * FROM audita_ir_jobs')).rows;assert.equal(jobs[0].last_error,'datajud_unavailable');assert.equal(jobs[0].attempts,1);assert.equal(jobs[0].lease_until,null);
});
test('retomada real após fechar e reabrir PostgreSQL embarcado',async()=>{
 const c=await intake();const rows=(await pg.query('SELECT encrypted_payload FROM audita_ir_cases WHERE id=$1',[c.id])).rows;assert.ok(!rows[0].encrypted_payload.includes(sample.identity.name));
 await pg.close();await openDatabase();service=makeService();const restored=await service.get(owner,c.id);assert.deepEqual(restored.answers,c.answers);assert.equal(restored.id,c.id);
});

test('Stripe Checkout usa preço do servidor e webhook assinado confirma apenas a proposta comprada',async()=>{
 const billingEnv={...env,AUDITA_BILLING_ENABLED:'true',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',APP_URL:'https://audita.example.test'};
 let sentParams;
 const billing=createStripeBillingService({getDb:()=>({pool,dbReady:true}),env:billingEnv,onIrPaymentEvent:event=>integrated.paymentEvent(event),fetchImpl:async(url,options)=>{sentParams=new URLSearchParams(options.body);return {ok:true,json:async()=>({id:'cs_test_integrated',url:'https://checkout.stripe.com/integrated',expires_at:Math.floor(Date.now()/1000)+1800})};}});
 const integrated=createIrExemptionService({getDb:()=>({pool,dbReady:true}),env,checkout:(a,p)=>billing.createIrCheckoutSession(a,p)});
 let c=await reviewed();c=await integrated.publishProposal(admin,c.id,{revision:c.revision,kind:'adm',amountCents:45600,scope:'Requerimento',terms:'Teste de contratação'});const p=c.proposals[0];c=await integrated.acceptProposal(owner,c.id,p.id,{accepted:true,version:p.version});await integrated.createCheckout(owner,c.id,p.id);
 assert.equal(sentParams.get('line_items[0][price_data][unit_amount]'),'45600');assert.equal(sentParams.get('metadata[ir_case_id]'),c.id);assert.equal(sentParams.has('payment_method_types[0]'),false);
 const event=stripeEvent(c,p,'checkout.session.completed',{id:'cs_test_integrated'}),raw=Buffer.from(JSON.stringify(event)),timestamp=Math.floor(Date.now()/1000);
 const signature=`t=${timestamp},v1=${crypto.createHmac('sha256',billingEnv.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.`).update(raw).digest('hex')}`;
 await assert.rejects(()=>billing.handleWebhook(raw,`t=${timestamp},v1=bad`));
 await billing.handleWebhook(raw,signature);const duplicate=await billing.handleWebhook(raw,signature);assert.equal(duplicate.duplicate,true);assert.equal((await integrated.get(owner,c.id)).proposals[0].state,'paid');
 const subscribed=(await pg.query('SELECT * FROM audita_subscriptions')).rows;assert.equal(subscribed.length,0);
});

test('API exige sessão, valida origem e usa revisão do servidor',async()=>{
 const {createIrExemptionHandler}=await import('../services/ir-exemption-api.mjs');
 async function request(path,method='GET',auth=owner,body={},headers={}){
   let result;const handler=createIrExemptionHandler({service,getAuth:async()=>auth,readJson:async()=>body,readBuffer:async()=>Buffer.alloc(0),sendJson:(_response,status,data)=>{result={status,data};}});
   await handler({method,headers:{host:'localhost:3000',...headers}},{setHeader(){}},new URL(`http://localhost:3000/api/ir-exemption${path}`));return result;
 }
 assert.equal((await request('/config','GET',{})).status,200);
 assert.equal((await request('/cases','POST',{})).status,401);
 assert.equal((await request('/cases','POST',owner,{}, {origin:'https://evil.example'})).status,403);
 const created=await request('/cases','POST');assert.equal(created.status,201);
 const c=created.data.case;
 assert.equal((await request(`/cases/${c.id}`,'GET',stranger)).status,404);
 assert.equal((await request(`/cases/${c.id}/actions`,'POST',owner,{action:'answer',key:'role',value:'self',revision:0})).status,409);
});
