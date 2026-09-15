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
test('documentos até contratação e negociação: autenticação, revisão e webhook',async()=>{
 const pg=new PGlite();try{
 await pg.exec((await readFile(new URL('../db/schema.sql',import.meta.url),'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));await pg.exec(await readFile(new URL('../db/bank-debt.sql',import.meta.url),'utf8'));
 await pg.exec("INSERT INTO audita_users(id,tenant_id,email,name,role,password_hash) VALUES(801,1,'example@example.test','Teste','member','test')");
 const auth={tenantId:1,user:{id:801}},pool={query:(...a)=>pg.query(...a),connect:async()=>({query:(...a)=>pg.query(...a),release(){}})};
 const service=createBankDebtService({getDb:()=>({pool,dbReady:true}),extractor:async()=>data,rateProvider,checkout:async()=>({id:'cs_test_docs',url:'https://checkout.stripe.com/test',expiresAt:9999999999})});
 let c=await service.create(auth);const doc=await PDFDocument.create();doc.addPage();const bytes=Buffer.from(await doc.save());
 c=await service.upload(auth,c.id,{bytes,kind:'evidence',name:'ficticio.pdf'});assert.equal(c.status,'calculation_pending');
 await assert.rejects(service.command(auth,c.id,{action:'analyze',revision:c.revision,consent:false}));
 c=await service.startAnalysis(auth,c.id,{action:'analyze',revision:c.revision,consent:true});assert.ok(c.analysisPending);for(let i=0;i<100&&c.analysisPending;i++){await new Promise(resolve=>setTimeout(resolve,10));c=await service.get(auth,c.id);}assert.equal(c.analysisPending,null);assert.equal(c.status,'offer');assert.equal(c.docOffer.priceCents,19900);assert.equal(c.review,null);
 await assert.rejects(service.download(auth,c.id,'negotiation'),{status:403});
 await service.createCheckout(auth,c.id,{accepted:true,reviewId:c.docOffer.id});
 const event={id:'evt_test_docs',type:'checkout.session.completed',data:{object:{id:'cs_test_docs',payment_status:'paid',currency:'brl',amount_total:19900,metadata:{debt_case_id:c.id,debt_review_id:c.docOffer.id,audita_user_id:'801',audita_tenant_id:'1'}}}};
 await service.paymentEvent(event);assert.equal((await service.paymentEvent(event)).duplicate,true);
 c=await service.get(auth,c.id);assert.equal(c.status,'paid');const report=await service.download(auth,c.id,'negotiation');assert.ok((await PDFDocument.load(report.bytes)).getPageCount()>0);
 await assert.rejects(service.download({tenantId:2,user:{id:802}},c.id,'negotiation'),{status:404});
 c=await service.command(auth,c.id,{action:'judicial',revision:c.revision});assert.equal(c.judicialRequested,true);assert.equal(c.job,null);
 }finally{await pg.close();}
});
