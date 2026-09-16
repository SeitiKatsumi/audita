import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeStatements,debtPlan} from '../services/bank-debt-analysis.mjs';
const data={bank:'Banco Teste',person:'pf',modality:'overdraft',accountKey:'test-account',pages:1,opening:{date:'2024-01-01',balanceCents:-100000,evidence:'Saldo anterior'},entries:[{date:'2024-01-31',page:1,description:'Juros',amountCents:-20000,kind:'interest',ratePercent:20,balanceCents:-120000}],closing:{date:'2024-01-31',balanceCents:-120000,evidence:'Saldo final'},issues:[]};
const rateProvider=async(_,month)=>({code:25463,month,monthlyPercent:2,url:'https://api.bcb.gov.br/test'});
test('extratos: calcula faixa, preserva tarifas e bloqueia lacunas, ambiguidades e outra conta',async()=>{
 const run=d=>analyzeStatements([{id:'doc',data:d}],{rateProvider});
 const valid=await run(data);assert.equal(valid.issues.length,0);assert.ok(valid.range.minCents>=101900&&valid.range.maxCents<=102100);assert.ok(valid.range.minReductionPercent>14);assert.equal(valid.totals.interestCents,20000);assert.equal(debtPlan(5000000).price.cents,59900);
 const withFee=structuredClone(data);withFee.entries.unshift({date:'2024-01-15',page:1,description:'Tarifa',amountCents:-1000,kind:'fee',ratePercent:null,balanceCents:-101000});withFee.entries[1].balanceCents=-121000;withFee.closing.balanceCents=-121000;assert.ok((await run(withFee)).range.minCents>valid.range.minCents);
 for(const mutate of [d=>d.opening=null,d=>d.entries[0].kind='transfer',d=>d.entries[0].amountCents=-100,d=>d.person='unknown',d=>d.modality='loan',d=>d.issues.push('Página ilegível')]){const d=structuredClone(data);mutate(d);const r=await run(d);assert.equal(r.range,null);assert.ok(r.issues.length);}
 const duplicate=await analyzeStatements([{id:'a',data},{id:'b',data}],{rateProvider});assert.equal(duplicate.range,null);
 await assert.rejects(()=>run({...data,opening:{...data.opening,date:'2024-02-31'}}));
});
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {PDFDocument} from 'pdf-lib';
import {createBankDebtService} from '../services/bank-debt.service.mjs';

test('falha BACEN usa referência provisória auditável sem ignorar dados inválidos',async()=>{
 let calls=0;const offline=async()=>{calls++;throw Error('timeout');};
 const extended=structuredClone(data);extended.closing.date='2024-03-31';extended.entries[0].amountCents=-50000;extended.entries[0].balanceCents=-150000;extended.closing.balanceCents=-150000;
 const result=await analyzeStatements([{id:'doc',data:extended}],{rateProvider:offline});
 assert.ok(result.range);assert.equal(calls,1);assert.equal(result.rates.length,3);
 assert.ok(result.rates.every(r=>r.fallback&&r.monthlyPercent===7.4&&r.sourceMonth==='2025-01'));
 assert.match(result.rateFallbackNotice,/7,4%/);assert.ok(result.assumptions.includes(result.rateFallbackNotice));
 const recovered=await analyzeStatements([{id:'doc',data:extended}],{rateProvider});
 assert.equal(recovered.rateFallbackNotice,undefined);assert.ok(recovered.rates.every(r=>!r.fallback));
 const partial=await analyzeStatements([{id:'doc',data:extended}],{rateProvider:async(s,m)=>m==='2024-01'?rateProvider(s,m):offline()});
 assert.equal(partial.rates[1].monthlyPercent,2);assert.equal(partial.rates[1].sourceMonth,'2024-01');
 const pj=await analyzeStatements([{id:'doc',data:{...data,person:'pj'}}],{rateProvider:offline});
 assert.equal(pj.range,null); // Não emprestar taxa PF para PJ sem referência da modalidade.
 const invalid=await analyzeStatements([{id:'doc',data:{...data,opening:null}}],{rateProvider:offline});
 assert.equal(invalid.range,null);
 const wrong=await analyzeStatements([{id:'doc',data}],{rateProvider:async()=>({code:25446,month:'2024-01',monthlyPercent:2})});
 assert.equal(wrong.range,null);
});

test('concilia saldo comprovado entre extratos sem inventar principal nem ignorar outras divergências',async()=>{
 const next={...structuredClone(data),opening:{date:'2024-01-31',balanceCents:0,evidence:'0,00-'},entries:[{...data.entries[0],date:'2024-02-29',balanceCents:-140000}],closing:{date:'2024-02-29',balanceCents:-140000,evidence:'Saldo final'},issues:['Página 1, linha 3: os movimentos não fecham com o saldo impresso.'],checkpoints:[{page:1,line:3,expectedCents:-20000,printedCents:-140000}]};
 const run=d=>analyzeStatements([{id:'first',data},{id:'next',data:d}],{rateProvider});
 const result=await run(next);assert.ok(result.range);assert.equal(result.reconciliations.length,1);assert.equal(result.reconciliations[0].openingBalanceCents,-120000);assert.equal(next.opening.balanceCents,0);
 for(const mutate of [d=>d.accountKey='other',d=>d.opening.date='2024-01-30',d=>d.entries[0].balanceCents=-1400010,d=>d.closing.balanceCents=-150000]){const changed=structuredClone(next);mutate(changed);const r=await run(changed);assert.equal(r.reconciliations.length,0);assert.equal(r.range,null);}
 const unreadable=structuredClone(next);unreadable.issues.push('Taxa ilegível');assert.equal((await run(unreadable)).range,null);
 const missingStart=structuredClone(data);missingStart.opening.balanceCents=0;const gap=await analyzeStatements([{id:'first',data:missingStart}],{rateProvider});assert.equal(gap.range,null);assert.equal(gap.issues.find(i=>i.differenceCents)?.differenceCents,100000);
 const investment=structuredClone(data);investment.entries.unshift({date:'2024-01-05',page:1,description:'RESGATE INV FAC',amountCents:1000,kind:'transfer',ratePercent:null,balanceCents:-99000});investment.entries[1].balanceCents=-119000;investment.closing.balanceCents=-119000;assert.ok((await analyzeStatements([{id:'investment',data:investment}],{rateProvider})).range);
 investment.entries[0].description='ENC LIM CREDITO';assert.equal((await analyzeStatements([{id:'ambiguous',data:investment}],{rateProvider})).range,null);
});
test('documentos até contratação e negociação: autenticação, revisão e webhook',async()=>{
 const pg=new PGlite();try{
 await pg.exec((await readFile(new URL('../db/schema.sql',import.meta.url),'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));await pg.exec(await readFile(new URL('../db/bank-debt.sql',import.meta.url),'utf8'));
 await pg.exec("INSERT INTO audita_users(id,tenant_id,email,name,role,password_hash) VALUES(801,1,'example@example.test','Teste','member','test')");
 const auth={tenantId:1,user:{id:801}},pool={query:(...a)=>pg.query(...a),connect:async()=>({query:(...a)=>pg.query(...a),release(){}})};
 let calls=0,release,started,extracted=data;const hold=new Promise(r=>release=r),reading=new Promise(r=>started=r);
 const service=createBankDebtService({getDb:()=>({pool,dbReady:true}),extractor:async(doc,auth,hooks)=>{calls++;assert.equal(hooks.cache,null);await hooks.saveCache({fixtureCache:'private'});await hooks.onProgress({completed:1,total:1,stage:'checking'});started();await hold;return extracted;},rateProvider:async()=>{throw Error('BACEN offline');},checkout:async()=>({id:'cs_test_docs',url:'https://checkout.stripe.com/test',expiresAt:9999999999})});
 let c=await service.create(auth);const doc=await PDFDocument.create();doc.addPage();const bytes=Buffer.from(await doc.save());
 c=await service.upload(auth,c.id,{bytes,kind:'evidence',name:'ficticio.pdf'});assert.equal(c.status,'calculation_pending');
 const duplicate=await service.upload(auth,c.id,{bytes,kind:'evidence',name:'ficticio (1).pdf'});assert.equal(duplicate.documents.length,1);assert.equal(duplicate.revision,c.revision);
 await pg.query("INSERT INTO audita_debt_documents(id,case_id,kind,name,mime,bytes,sha256) SELECT '00000000-0000-4000-8000-000000000001',case_id,kind,'copia-antiga.pdf',mime,bytes,sha256 FROM audita_debt_documents WHERE case_id=$1",[c.id]);
 assert.equal((await service.get(auth,c.id)).documents.length,1);
 await assert.rejects(service.command(auth,c.id,{action:'analyze',revision:c.revision,consent:false}));
 c=await service.startAnalysis(auth,c.id,{action:'analyze',revision:c.revision,consent:true});await reading;assert.ok(c.analysisPending);assert.ok(c.documentConsent);
 const fresh=await service.get(auth,c.id);assert.equal(fresh.revision,c.revision);assert.equal(fresh.analysisProgress.percent,90);assert.equal(fresh.analysisProgress.completed,1);assert.doesNotMatch(JSON.stringify(fresh),/fixtureCache/);
 assert.equal((await pg.query('SELECT extraction_cache FROM audita_debt_documents WHERE case_id=$1 AND extraction_cache IS NOT NULL',[c.id])).rows[0].extraction_cache.fixtureCache,'private');
 await assert.rejects(service.get({tenantId:2,user:{id:802}},c.id),{status:404});
 const unchanged=await service.upload(auth,c.id,{bytes,kind:'evidence',name:'novamente.pdf'});assert.equal(unchanged.revision,c.revision);assert.equal(unchanged.analysisPending,c.analysisPending);
 await assert.rejects(service.upload(auth,c.id,{bytes:Buffer.concat([bytes,Buffer.from('\n')]),kind:'evidence',name:'outro.pdf'}),{status:409});
 release();for(let i=0;i<100&&c.analysisPending;i++){await new Promise(resolve=>setTimeout(resolve,10));c=await service.get(auth,c.id);}assert.equal(c.analysisPending,null);assert.equal(c.status,'offer');assert.equal(c.docOffer.priceCents,19900);assert.equal(c.review,null);assert.equal(calls,1);assert.equal(c.analysis.documentHashes.length,1);assert.equal(c.analysisProgress.percent,100);
 assert.match(c.analysis.rateFallbackNotice,/7,4%/);assert.equal(c.analysis.rates[0].fallback,true);
 await assert.rejects(service.download(auth,c.id,'negotiation'),{status:403});
 const freeService=createBankDebtService({getDb:()=>({pool,dbReady:true}),paymentRequired:false,extractor:async()=>data,rateProvider:async()=>{throw Error('offline');},checkout:async()=>{throw Error('Stripe não deve ser chamada');}});
 let free=await freeService.create(auth);free=await freeService.upload(auth,free.id,{bytes,kind:'evidence',name:'gratuito.pdf'});free=await freeService.command(auth,free.id,{action:'analyze',revision:free.revision,consent:true});
 await assert.rejects(freeService.createCheckout(auth,free.id,{accepted:false,reviewId:free.docOffer.id}));
 const unlocked=await freeService.createCheckout(auth,free.id,{accepted:true,reviewId:free.docOffer.id});assert.equal(unlocked.case.status,'paid');assert.equal(unlocked.case.paid.amountCents,0);assert.equal(unlocked.case.paid.method,'waived');assert.ok((await freeService.download(auth,free.id,'negotiation')).bytes.length);
 await service.createCheckout(auth,c.id,{accepted:true,reviewId:c.docOffer.id});
 await assert.rejects(service.upload(auth,c.id,{bytes,kind:'evidence',name:'durante-pagamento.pdf'}),{status:409});
 let extra=await service.create(auth);
 extra=await service.upload(auth,extra.id,{bytes,kind:'evidence',name:'original.pdf'});
 extra=await service.command(auth,extra.id,{action:'analyze',revision:extra.revision,consent:true});
 assert.equal(extra.status,'offer');const oldOffer=extra.docOffer.id;
 const repeated=await service.upload(auth,extra.id,{bytes,kind:'evidence',name:'repetido.pdf'});
 assert.equal(repeated.docOffer.id,oldOffer);assert.equal(repeated.documents.length,1);
 await assert.rejects(service.upload({tenantId:2,user:{id:802}},extra.id,{bytes,kind:'evidence',name:'outro.pdf'}),{status:404});
 extra=await service.upload(auth,extra.id,{bytes:Buffer.concat([bytes,Buffer.from('\n')]),kind:'evidence',name:'complemento.pdf'});
 assert.equal(extra.status,'calculation_pending');assert.equal(extra.documents.length,2);assert.equal(extra.docOffer,null);assert.ok(extra.documentConsent);
 await assert.rejects(service.createCheckout(auth,extra.id,{accepted:true,reviewId:oldOffer}),{status:409});
 const event={id:'evt_test_docs',type:'checkout.session.completed',data:{object:{id:'cs_test_docs',payment_status:'paid',currency:'brl',amount_total:19900,metadata:{debt_case_id:c.id,debt_review_id:c.docOffer.id,audita_user_id:'801',audita_tenant_id:'1'}}}};
 await service.paymentEvent(event);assert.equal((await service.paymentEvent(event)).duplicate,true);
 c=await service.get(auth,c.id);assert.equal(c.status,'paid');const report=await service.download(auth,c.id,'negotiation');assert.ok((await PDFDocument.load(report.bytes)).getPageCount()>0);
 await assert.rejects(service.download({tenantId:2,user:{id:802}},c.id,'negotiation'),{status:404});
 c=await service.command(auth,c.id,{action:'judicial',revision:c.revision});assert.equal(c.judicialRequested,true);assert.equal(c.job,null);
 c=await service.upload(auth,c.id,{bytes,kind:'identity',name:'identificacao-ficticia.pdf'});assert.equal(c.documents.length,2);
 extracted={...structuredClone(data),issues:['Conferir saldo anterior']};let pending=await service.create(auth);
 pending=await service.upload(auth,pending.id,{bytes,kind:'evidence',name:'pendente.pdf'});
 await assert.rejects(service.command(auth,pending.id,{action:'request-review',revision:pending.revision}),{status:409});
 pending=await service.command(auth,pending.id,{action:'analyze',consent:true,revision:pending.revision});
 await assert.rejects(service.command({tenantId:2,user:{id:802}},pending.id,{action:'request-review',revision:pending.revision}),{status:404});
 pending=await service.command(auth,pending.id,{action:'request-review',revision:pending.revision});assert.ok(pending.manualReview);assert.equal(pending.docOffer,null);
 const again=await service.command(auth,pending.id,{action:'request-review',revision:pending.revision});assert.equal(again.revision,pending.revision);
 const admin={tenantId:1,user:{id:801,role:'super_admin'}};const queue=await service.list(admin);assert.equal(queue[0].id,pending.id);assert.ok(queue[0].manual_review_requested);
 await assert.rejects(service.createCheckout(auth,pending.id,{accepted:true}),{status:409});
 pending=await service.command(admin,pending.id,{action:'details',revision:pending.revision,details:{creditor:'Banco Teste',kind:'overdraft',since:'2024-01-01',originalCents:100000,chargedCents:120000,description:"",consent:true}});assert.ok(pending.analysis);assert.ok(pending.manualReview);
 await pg.exec("INSERT INTO audita_users(id,tenant_id,email,name,role,password_hash) VALUES(803,1,'lawyer@example.test','Advogado Teste','lawyer','test')");
 pending=await service.command(admin,pending.id,{action:'review',revision:pending.revision,review:{reviewedCents:105000,priceCents:19900,methodology:'Conferência manual fictícia do saldo e encargos para teste.',legalBasis:'Fundamentação fictícia registrada apenas para validar o fluxo técnico.',creditorLegalName:'Banco Teste',creditorDocument:'00000000000000',creditorAddress:'Endereço de teste',lawyerUserId:803,lawyerName:'Advogado Teste',lawyerOab:'SP 000000',confirmed:true}});assert.equal(pending.status,'offer');assert.ok(pending.review);assert.ok(pending.analysis);
 await service.createCheckout(auth,pending.id,{accepted:true,reviewId:pending.review.id});
 }finally{await pg.close();}
});
