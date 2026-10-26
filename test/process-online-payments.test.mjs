import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createProcessOnlinePayments} from '../services/process-online-payments.service.mjs';
import {createProcessOnlineWorkflowService} from '../services/process-online-workflow.service.mjs';
import {DEFAULT_CERTIFICATE_PRICING} from '../certificate-selection.js';
const AUTH={tenantId:1,user:{id:11}};
async function fixture(t,options={}){
 const pg=new PGlite();t.after(()=>pg.close());
 await pg.exec(`CREATE TABLE audita_tenants(id BIGINT PRIMARY KEY); CREATE TABLE audita_users(id BIGINT PRIMARY KEY); CREATE TABLE audita_audits(id BIGINT PRIMARY KEY,public_id UUID,tenant_id BIGINT,requested_by_user_id BIGINT); INSERT INTO audita_tenants VALUES(1),(2); INSERT INTO audita_users VALUES(11),(12);`);
 for(const name of ['process-online','process-online-payments'])await pg.exec(await readFile(new URL(`../db/${name}.sql`,import.meta.url),'utf8'));
 const env={AUDITA_PROFILE_ENCRYPTION_KEY:'fictitious-test-encryption-key-at-least-thirty-two-characters'};
 const state={sessions:0,copies:0,searches:0,ready:true,stripeReady:true,mode:'live',pricing:structuredClone(DEFAULT_CERTIFICATE_PRICING)};
 const getDb=()=>({pool:pg,dbReady:true});
 const workflow=createProcessOnlineWorkflowService({getDb,env,provider:{getStatus:()=>({enabled:true,ready:state.ready,mode:state.mode}),requestCopy:async()=>{state.copies++;state.onCopy?.();return {request_id:randomUUID(),status:'processing',credits_charged:1};},searchDocumento:async input=>{state.searches++;assert.equal(input.documento,'52998224725');return {total:0,results:[],credits_charged:1};}}});
 const service=createProcessOnlinePayments({getDb,workflow,env,getPricing:async()=>state.pricing,allowLegacySearchCheckout:true,...options,checkoutReady:()=>state.stripeReady,createCheckout:async(auth,order)=>{state.sessions++;state.lastCheckout=order;return {id:`cs_${order.id}`,url:`https://checkout.stripe.com/c/pay/cs_${order.id}`};}});
 const input={documento:'52998224725',consent:true,operationId:randomUUID(),amountCents:1};
 const event=(order,changes={})=>({type:'checkout.session.completed',livemode:state.mode==='live',data:{object:{id:`cs_${order.id}`,mode:'payment',currency:'brl',amount_total:order.amountCents,payment_status:'paid',metadata:{purchase_kind:'process_search',process_search_order_id:order.id,audita_tenant_id:'1',audita_user_id:'11'},...changes}}});
 return {pg,state,service,input,event,workflow,env,getDb};
}
test('fixed price checkout persists encrypted input and resumes without a supplier search',async t=>{
 const f=await fixture(t),order=await f.service.checkout(AUTH,f.input);
 assert.equal(order.amountCents,4990);assert.equal(f.state.searches,0);
 assert.deepEqual(await f.service.checkout(AUTH,f.input),order);assert.equal(f.state.sessions,1);
 const row=(await f.pg.query('SELECT * FROM audita_process_search_orders')).rows[0];assert.ok(!row.encrypted_input.includes(f.input.documento));
 await assert.rejects(f.service.checkout(AUTH,{...f.input,documento:'11111111111'}),{code:'process_online_invalid_document'});
 await assert.rejects(f.service.checkout(AUTH,{...f.input,documento:'11222333000181'}),{code:'process_online_operation_conflict'});
 await assert.rejects(f.service.get({tenantId:2,user:{id:12}},order.id),{status:404});
});
test('unpaid, wrong amount/session/owner never fulfill; paid async notification fulfills once',async t=>{
 const f=await fixture(t),order=await f.service.checkout(AUTH,f.input);
 await f.service.paymentEvent(f.event(order,{payment_status:'unpaid'}));assert.equal(f.state.searches,0);
 for(const changes of [{amount_total:1},{currency:'usd'},{id:'cs_foreign'},{metadata:{purchase_kind:'process_search',process_search_order_id:order.id,audita_tenant_id:'2',audita_user_id:'11'}}])await assert.rejects(f.service.paymentEvent(f.event(order,changes)),{code:'process_online_payment_mismatch'});
 const event=f.event(order);event.type='checkout.session.async_payment_succeeded';
 await Promise.all([f.service.paymentEvent(event),f.service.paymentEvent(event)]);
 await f.service.paymentEvent(f.event(order));assert.equal(f.state.searches,1);
 const result=await f.service.get(AUTH,order.id);assert.equal(result.status,'fulfilled');assert.equal(result.request.kind,'search');assert.equal(result.request.billing.auditaCredits,0);
});
test('expired or failed checkout never searches, and an unhomologated sandbox cannot sell searches',async t=>{
 const f=await fixture(t),order=await f.service.checkout(AUTH,f.input),event=f.event(order,{payment_status:'unpaid'});
 event.type='checkout.session.expired';await f.service.paymentEvent(event);
 assert.equal((await f.service.get(AUTH,order.id)).status,'expired');assert.equal(f.state.searches,0);
 f.state.mode='test';await assert.rejects(f.service.checkout(AUTH,{...f.input,operationId:randomUUID()}),{code:'process_online_checkout_unavailable'});
});

test('copy checkout validates CNJ, binds the kind and executes a copy once only after payment',async t=>{
 const f=await fixture(t),input={...f.input,cnj:'50624045620248130702'};
 await assert.rejects(f.service.checkout(AUTH,{...input,cnj:'123'},'copy'),{code:'process_online_invalid_cnj'});
 const order=await f.service.checkout(AUTH,input,'copy');assert.equal(order.kind,'copy');assert.equal(order.amountCents,4990);
 assert.equal(f.state.copies,0);assert.equal(f.state.searches,0);
 await assert.rejects(f.service.checkout(AUTH,input,'search'),{code:'process_online_operation_conflict'});
 await f.service.paymentEvent(f.event(order,{payment_status:'unpaid'}));assert.equal(f.state.copies,0);
 await f.service.paymentEvent(f.event(order));await f.service.paymentEvent(f.event(order));
 assert.equal(f.state.copies,1);assert.equal(f.state.searches,0);
 const row=(await f.pg.query('SELECT * FROM audita_process_search_orders WHERE id=$1',[order.id])).rows[0];assert.equal(row.status,'fulfilled');
});

const firstCnj='50624045620248130702';
const secondBase='506240520248130702';
const secondCnj=secondBase.slice(0,7)+String(98n-BigInt(secondBase+'00')%97n).padStart(2,'0')+secondBase.slice(7);

test('selected copies freeze configurable price and cost, authorize the total and fulfill each CNJ once',async t=>{
 const f=await fixture(t),input={operationId:randomUUID(),consent:true,cnjs:[secondCnj,firstCnj],approvedAmountCents:13980};
 f.state.pricing.processServices.processOnlineCopy={costCents:3200,mode:'fixed',value:6990};
 const config=await f.service.config();assert.equal(config.copyPayment.unitAmountCents,6990);assert.equal(config.copyPayment.maxQuantity,20);
 assert.equal(config.copyPayment.costCents,undefined,'provider cost is restricted to the admin pricing page');
 await assert.rejects(f.service.checkout(AUTH,{...input,approvedAmountCents:1},'copy'),{code:'process_online_price_changed'});
 const order=await f.service.checkout(AUTH,input,'copy');
 assert.equal(order.amountCents,13980);assert.equal(order.unitAmountCents,6990);assert.equal(order.quantity,2);
 assert.equal(f.state.lastCheckout.amountCents,13980);assert.equal(f.state.lastCheckout.quantity,2);assert.equal(f.state.copies,0);
 f.state.pricing.processServices.processOnlineCopy.value=8990;
 assert.deepEqual(await f.service.checkout(AUTH,{...input,cnjs:[firstCnj,secondCnj]},'copy'),order,'selection ordering and later admin changes do not create another charge');
 await assert.rejects(f.service.paymentEvent(f.event(order,{amount_total:4990})),{code:'process_online_payment_mismatch'});
 const wrongMode=f.event(order);wrongMode.livemode=false;
 await assert.rejects(f.service.paymentEvent(wrongMode),{code:'process_online_payment_mode_mismatch'});
 assert.equal(f.state.copies,0);
 await Promise.all([f.service.paymentEvent(f.event(order)),f.service.paymentEvent(f.event(order))]);
 await f.service.paymentEvent(f.event(order));assert.equal(f.state.copies,2);
 const result=await f.service.get(AUTH,order.id);assert.equal(result.status,'fulfilled');assert.equal(result.requestIds.length,2);assert.equal(new Set(result.requestIds).size,2);
 assert.deepEqual(result.requests.map(r=>r.cnj).sort(),[firstCnj,secondCnj].sort());
 assert.ok(result.requests.every(r=>r.billing.auditaCredits===0),'Stripe-paid copies are never also debited from the wallet');
 await assert.rejects(f.service.get({tenantId:2,user:{id:12}},order.id),{status:404});
 await f.pg.exec(await readFile(new URL('../db/process-online-payments.sql',import.meta.url),'utf8'));
 assert.equal((await f.service.get(AUTH,order.id)).amountCents,13980,'the additive migration preserves stored totals and requests');
 const fresh=await f.service.checkout(AUTH,{...input,operationId:randomUUID(),approvedAmountCents:17980},'copy');assert.equal(fresh.amountCents,17980);
});

test('copy selection rejects duplicates, oversized selections, invalid CNJ, foreign audits and changed operations before charging',async t=>{
 const f=await fixture(t),input={operationId:randomUUID(),consent:true,cnjs:[firstCnj]};
 for(const cnjs of [[],Array(21).fill(firstCnj)])await assert.rejects(f.service.checkout(AUTH,{...input,cnjs},'copy'),{code:'process_online_invalid_selection'});
 await assert.rejects(f.service.checkout(AUTH,{...input,cnj:firstCnj},'copy'),{code:'process_online_invalid_selection'});
 await assert.rejects(f.service.checkout(AUTH,{...input,cnjs:[firstCnj,firstCnj]},'copy'),{code:'process_online_duplicate_selection'});
 await assert.rejects(f.service.checkout(AUTH,{...input,cnjs:['123']},'copy'),{code:'process_online_invalid_cnj'});
 await assert.rejects(f.service.checkout(AUTH,{...input,parentAuditId:randomUUID()},'copy'),{code:'process_online_parent_not_found'});
 await f.service.checkout(AUTH,input,'copy');
 await assert.rejects(f.service.checkout(AUTH,{...input,cnjs:[secondCnj]},'copy'),{code:'process_online_operation_conflict'});
 assert.equal(f.state.sessions,1);assert.equal(f.state.copies,0);
});

test('new CPF/CNPJ searches move to Direct Data certificate checkout without stranding paid legacy searches',async t=>{
 const f=await fixture(t),legacy=await f.service.checkout(AUTH,f.input);
 const service=createProcessOnlinePayments({getDb:f.getDb,workflow:f.workflow,env:f.env,checkoutReady:()=>true});
 assert.equal((await service.config()).checkoutReady,false);
 await assert.rejects(service.checkout(AUTH,{...f.input,operationId:randomUUID()}),{code:'process_online_document_search_moved'});
 await service.paymentEvent(f.event(legacy));assert.equal(f.state.searches,1);
 assert.equal((await service.get(AUTH,legacy.id)).status,'fulfilled');
});

test('admin copies bypass Stripe and wallet with an explicit persisted waiver, provider cost and owner scope',async t=>{
 const f=await fixture(t),admin={...AUTH,user:{...AUTH.user,role:'admin',status:'active'}};
 f.state.stripeReady=false;
 const config=await f.service.config(admin);
 assert.equal(config.copyPayment.complimentary,true);assert.equal(config.copyPayment.amountCents,0);assert.equal(config.copyPayment.checkoutReady,true);
 assert.equal(config.copyPayment.baseCents,4990);assert.equal(config.copyPayment.costCents,undefined);
 const input={operationId:randomUUID(),consent:true,cnjs:[firstCnj,secondCnj],approvedAmountCents:0};
 const orders=await Promise.all([f.service.checkout(admin,input,'copy'),f.service.checkout(admin,input,'copy')]);
 assert(orders.every(o=>o.status==='fulfilled'&&o.paymentStatus==='complimentary'&&o.complimentary&&o.amountCents===0));
 assert.equal(f.state.sessions,0);assert.equal(f.state.copies,2);
 const row=(await f.pg.query('SELECT * FROM audita_process_search_orders WHERE id=$1',[orders[0].id])).rows[0];
 assert.equal(row.paid_at,null);assert.equal(row.checkout_session,null);assert.equal(row.amount_cents,9980);
 const saved=await f.service.get(admin,row.id);
 assert(saved.requests.every(r=>r.billing.state==='complimentary'&&r.billing.auditaCredits===0&&r.billing.providerCredits===1));
 await assert.rejects(f.service.paymentEvent(f.event({...orders[0],amountCents:row.amount_cents})),{code:'process_online_payment_mismatch'});
 await assert.rejects(f.service.get({tenantId:2,user:{id:12,role:'admin'}},row.id),{status:404});
 await assert.rejects(f.service.checkout(AUTH,{...input,operationId:randomUUID(),complimentary:true},'copy'),{code:'process_online_checkout_unavailable'});
 f.state.ready=false;
 assert.equal((await f.service.config(admin)).copyPayment.checkoutReady,false);
 await assert.rejects(f.service.checkout(admin,{...input,operationId:randomUUID()},'copy'),{code:'process_online_checkout_unavailable'});
 assert.equal(f.state.sessions,0);assert.equal(f.state.copies,2);
});

test('revoking admin stops unfinished complimentary copies; regrant resumes each persisted operation without a second order',async t=>{
 const f=await fixture(t),admin={...AUTH,user:{...AUTH.user,role:'admin'}};
 const input={operationId:randomUUID(),consent:true,cnjs:[firstCnj,secondCnj],approvedAmountCents:0};
 f.state.onCopy=()=>{admin.user.role='member';};
 await assert.rejects(f.service.checkout(admin,input,'copy'),{code:'process_online_complimentary_access_required'});
 assert.equal(f.state.copies,1);assert.equal(f.state.sessions,0);
 await assert.rejects(f.service.checkout(admin,input,'copy'),{code:'process_online_complimentary_access_required'});
 assert.equal(f.state.copies,1);
 admin.user.role='admin';f.state.onCopy=null;
 const resumed=await f.service.checkout(admin,input,'copy');
 assert.equal(resumed.status,'fulfilled');assert.equal(f.state.copies,2);assert.equal(f.state.sessions,0);
 assert.equal((await f.pg.query('SELECT count(*) AS n FROM audita_process_search_orders')).rows[0].n,1);
 admin.user.role='member';
 assert.deepEqual(await f.service.checkout(admin,input,'copy'),resumed,'completed history remains readable after the role is removed');
});

test('promoting an owner explicitly waives the same pending order and preserves a late real payment for reconciliation only',async t=>{
 const f=await fixture(t),input={operationId:randomUUID(),consent:true,cnjs:[firstCnj,secondCnj],approvedAmountCents:9980};
 const original=await f.service.checkout(AUTH,input,'copy');
 const admin={...AUTH,user:{...AUTH.user,role:'admin'}};
 const available=await f.service.get(admin,original.id);
 assert.equal(available.complimentaryAvailable,true);assert.equal(available.status,'pending');assert.equal(f.state.copies,0,'GET never starts the supplier');
 assert.equal((await f.service.active(admin)).orders[0].complimentaryAvailable,true);
 assert.equal((await f.service.get(AUTH,original.id)).complimentaryAvailable,undefined);
 await assert.rejects(f.service.checkout(AUTH,{orderId:original.id,consent:true},'copy'),{code:'process_online_complimentary_access_required'});
 await assert.rejects(f.service.checkout(admin,{orderId:original.id,consent:false},'copy'),{code:'process_online_invalid_checkout'});
 await assert.rejects(f.service.checkout({tenantId:2,user:{id:12,role:'admin'}},{orderId:original.id,consent:true},'copy'),{status:404});
 f.state.stripeReady=false;
 const resumed=await f.service.checkout(admin,{orderId:original.id,consent:true},'copy');
 assert.equal(resumed.id,original.id);assert.equal(resumed.status,'fulfilled');assert.equal(resumed.amountCents,0);assert.equal(resumed.paymentStatus,'complimentary');assert.equal(resumed.checkoutUrl,null);
 const row=(await f.pg.query('SELECT * FROM audita_process_search_orders WHERE id=$1',[original.id])).rows[0];
 assert.equal(row.checkout_session,`cs_${original.id}`);assert.equal(row.checkout_url,original.checkoutUrl);assert.equal(row.amount_cents,9980);assert.equal(row.paid_at,null);
 assert.equal(f.state.sessions,1);assert.equal(f.state.copies,2);
 const late=await f.service.paymentEvent(f.event(original));
 assert.equal(late.purchase.requiresPaymentReconciliation,true);assert.equal(late.purchase.amountCents,9980);assert.equal(late.purchase.purchaseKind,'process_search_payment_after_waiver');
 await f.service.paymentEvent(f.event(original));
 const expired=f.event(original,{payment_status:'unpaid'});expired.type='checkout.session.expired';await f.service.paymentEvent(expired);
 assert.equal(f.state.copies,2);assert.equal((await f.service.get(admin,original.id)).status,'fulfilled');
 assert.equal((await f.pg.query('SELECT paid_at FROM audita_process_search_orders WHERE id=$1',[original.id])).rows[0].paid_at,null);
});

test('a fulfilled paid order never has its real payment replaced by a later admin waiver',async t=>{
 const f=await fixture(t),input={operationId:randomUUID(),consent:true,cnjs:[firstCnj]};
 const original=await f.service.checkout(AUTH,input,'copy');
 await f.service.paymentEvent(f.event(original));
 const admin={...AUTH,user:{...AUTH.user,role:'admin'}};
 const result=await f.service.checkout(admin,{orderId:original.id,consent:true},'copy');
 assert.equal(result.status,'fulfilled');assert.equal(result.amountCents,4990);assert.equal(result.complimentary,undefined);assert.equal(f.state.copies,1);
});

test('an atomic waiver racing a real payment fulfills each saved copy once',async t=>{
 const f=await fixture(t),input={operationId:randomUUID(),consent:true,cnjs:[firstCnj]};
 const original=await f.service.checkout(AUTH,input,'copy'),admin={...AUTH,user:{...AUTH.user,role:'admin'}};
 await Promise.all([f.service.checkout(admin,{orderId:original.id,consent:true},'copy'),f.service.paymentEvent(f.event(original))]);
 const result=await f.service.get(admin,original.id),row=(await f.pg.query('SELECT * FROM audita_process_search_orders WHERE id=$1',[original.id])).rows[0];
 assert.equal(result.status,'fulfilled');assert.equal(f.state.copies,1);assert.equal(f.state.sessions,1);
 assert.equal(result.complimentary===true,row.paid_at===null);
});
