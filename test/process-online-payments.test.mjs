import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createProcessOnlinePayments} from '../services/process-online-payments.service.mjs';
import {createProcessOnlineWorkflowService} from '../services/process-online-workflow.service.mjs';
const AUTH={tenantId:1,user:{id:11}};
async function fixture(t){
 const pg=new PGlite();t.after(()=>pg.close());
 await pg.exec(`CREATE TABLE audita_tenants(id BIGINT PRIMARY KEY); CREATE TABLE audita_users(id BIGINT PRIMARY KEY); CREATE TABLE audita_audits(id BIGINT PRIMARY KEY,public_id UUID,tenant_id BIGINT,requested_by_user_id BIGINT); INSERT INTO audita_tenants VALUES(1),(2); INSERT INTO audita_users VALUES(11),(12);`);
 for(const name of ['process-online','process-online-payments'])await pg.exec(await readFile(new URL(`../db/${name}.sql`,import.meta.url),'utf8'));
 const env={AUDITA_PROFILE_ENCRYPTION_KEY:'fictitious-test-encryption-key-at-least-thirty-two-characters'};
 const state={sessions:0,copies:0,searches:0,ready:true,mode:'live'};
 const getDb=()=>({pool:pg,dbReady:true});
 const workflow=createProcessOnlineWorkflowService({getDb,env,provider:{getStatus:()=>({enabled:true,ready:state.ready,mode:state.mode}),requestCopy:async input=>{state.copies++;assert.equal(input.cnj,'50624045620248130702');return {request_id:randomUUID(),status:'processing',credits_charged:1};},searchDocumento:async input=>{state.searches++;assert.equal(input.documento,'52998224725');return {total:0,results:[],credits_charged:1};}}});
 const service=createProcessOnlinePayments({getDb,workflow,env,checkoutReady:()=>true,createCheckout:async(auth,order)=>{state.sessions++;assert.equal(order.amountCents,4990);return {id:`cs_${order.id}`,url:`https://checkout.stripe.com/c/pay/cs_${order.id}`};}});
 const input={documento:'52998224725',consent:true,operationId:randomUUID(),amountCents:1};
 const event=(order,changes={})=>({type:'checkout.session.completed',livemode:true,data:{object:{id:`cs_${order.id}`,mode:'payment',currency:'brl',amount_total:4990,payment_status:'paid',metadata:{purchase_kind:'process_search',process_search_order_id:order.id,audita_tenant_id:'1',audita_user_id:'11'},...changes}}});
 return {pg,state,service,input,event};
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
