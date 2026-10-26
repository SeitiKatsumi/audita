import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHmac} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createCertificateOrderService,certificatePriceCents,certificateQuote} from '../services/certificate-order.service.mjs';
import {createStripeBillingService} from '../services/stripe-billing.service.mjs';
import {createAuditService} from '../services/audit.service.mjs';
import {certificateSelection} from '../certificate-selection.js';
import {getSellerDocumentCoverage} from '../services/seller-documents.service.mjs';
import {sellerStatePlans} from '../services/seller-state-plan.mjs';
import vm from 'node:vm';

test('test bypass requires server opt-in, same-origin owner access and collects once without recording a payment',async()=>{
  const pg=new PGlite(),collected=[];let checkouts=0,checkoutConfigured=true;
  try{
    await pg.exec((await readFile(new URL('../db/schema.sql',import.meta.url),'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
    await pg.exec("INSERT INTO audita_users(id,tenant_id,email,name,password_hash) VALUES(811,1,'fixture@example.test','Pessoa Ficticia','disabled')");
    const a={tenantId:1,user:{id:811}},env={AUDITA_PROFILE_ENCRYPTION_KEY:'fixture-key-that-is-at-least-thirty-two-characters'};
    const make=()=>createCertificateOrderService({getDb:()=>({pool:pg,dbReady:true}),env,checkoutReady:()=>checkoutConfigured,
      checkout:async()=>{checkouts++;return {id:'cs_fixture_'+checkouts,url:'https://checkout.stripe.com/c/pay/fixture'};},
      startAudit:async(request,options)=>{collected.push(request.body);await new Promise(resolve=>setTimeout(resolve,10));return {consultaId:options.consultaId};},
    });
    const orders=make(),body={tipoDocumento:'cpf',documento:'52998224725',fontes:['tjdft'],extraFields:{sellerFlow:'certificates',sellerAiConsent:false,stateCourtFields:{fullName:'Pessoa Ficticia'},authorizationConfirmed:true}};
    const pending=await orders.create(a,body,{costs:[.54],documentCount:1});
    assert.equal(pending.testBypassAvailable,false);assert.equal(pending.amountCents,1620);assert.equal(collected.length,0);
    const source=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
    const context=vm.createContext({URL,certificateOrderService:orders,getTenantIdForRequest:async request=>request.auth||{unauthorized:true},sendJson:(response,status,body)=>Object.assign(response,{status,body})});
    vm.runInContext(`async function handle(pathname,request,response){${source.slice(source.indexOf('  const certificateTestBypassMatch='),source.indexOf('  const sellerReviewMatch ='))}}`,context);
    const headers={'content-type':'application/json',host:'fixture.test',origin:'https://fixture.test'};
    const post=async(id=pending.orderId,auth=a,extraHeaders={})=>{const response={};await context.handle('/api/certificate-orders/'+id+'/test-bypass',{method:'POST',auth,headers:{...headers,...extraHeaders}},response);return response;};
    assert.equal((await post(pending.orderId,null)).status,401);
    assert.equal((await post()).status,403);assert.equal(collected.length,0);
    env.AUDITA_CERTIFICATE_TEST_BYPASS_ENABLED='true';
    assert.equal((await orders.get(a,pending.orderId)).testBypassAvailable,true,'existing pending orders receive the option when enabled');
    for(const extra of [{'sec-fetch-site':'cross-site'},{origin:'https://another.test'},{'content-type':'text/plain'}])assert.equal((await post(pending.orderId,a,extra)).status,403);
    for(const foreign of [{tenantId:2,user:{id:811}},{tenantId:1,user:{id:812}}])assert.equal((await post(pending.orderId,foreign)).status,404);
    const analysis=await orders.create(a,{...body,extraFields:{...body.extraFields,sellerFlow:'seller'}},{costs:[.54],documentCount:1});
    assert.equal(analysis.testBypassAvailable,false);assert.equal((await post(analysis.orderId)).status,409);assert.equal(collected.length,0);
    const responses=await Promise.all([post(),post()]);assert(responses.every(r=>r.status===202));
    assert.equal(collected.length,1);assert.deepEqual(collected[0],body);
    const completed=await make().get(a,pending.orderId);assert.equal(completed.status,'started');assert.equal(completed.testBypassed,true);assert.equal(completed.amountCents,1620);assert.equal(completed.testBypassAvailable,false);
    assert.equal((await post()).status,202);assert.equal(collected.length,1,'repeated requests and restart do not recollect');
    const saved=(await pg.query('SELECT request_payload FROM audita_audits WHERE public_id=$1',[pending.orderId])).rows[0].request_payload.certificateOrder;
    assert.equal(saved.testBypassed,true);assert.equal(saved.testBypassedBy,811);assert.equal(typeof saved.testBypassedAt,'number');assert.equal(saved.paidAt,undefined);assert.equal(saved.amountCents,1620);
    assert.equal(JSON.stringify(completed).includes(body.documento),false);assert.equal(completed.encryptedBody,undefined);
    checkoutConfigured=false;
    const before=checkouts,noStripe=await orders.create(a,body,{costs:[.54],documentCount:1});
    assert.equal(noStripe.status,'pending');assert.equal(noStripe.checkoutUrl,undefined);assert.equal(noStripe.testBypassAvailable,true);assert.equal(checkouts,before);
    assert.equal((await post(noStripe.orderId)).status,202);assert.equal(collected.length,2);
    for(const status of ['expired','review_required']){
      const closed=await orders.create(a,body,{costs:[.54],documentCount:1});
      await pg.query("UPDATE audita_audits SET request_payload=jsonb_set(request_payload,'{certificateOrder,status}',$2::jsonb) WHERE public_id=$1",[closed.orderId,JSON.stringify(status)]);
      assert.equal((await post(closed.orderId)).status,409);
    }
    env.AUDITA_CERTIFICATE_TEST_BYPASS_ENABLED='false';assert.equal((await post()).status,403);assert.equal(collected.length,2);
  }finally{await pg.close();}
});

test('promoted admin can waive an existing seller order once; ownership, origin and later demotion remain enforced',async()=>{
  const pg=new PGlite(),collected=[];let checkouts=0;
  try{
    await pg.exec((await readFile(new URL('../db/schema.sql',import.meta.url),'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
    await pg.exec("INSERT INTO audita_users(id,tenant_id,email,name,password_hash,role) VALUES(811,1,'waiver@example.test','Pessoa Fictícia','disabled','member')");
    const owner={tenantId:1,user:{id:811,role:'member',status:'active'}},admin={...owner,user:{...owner.user,role:'admin'}},env={AUDITA_PROFILE_ENCRYPTION_KEY:'fixture-key-that-is-at-least-thirty-two-characters'};
    const orders=createCertificateOrderService({getDb:()=>({pool:pg,dbReady:true}),env,checkout:async()=>{checkouts++;return {id:'cs_promotion_fixture',url:'https://checkout.stripe.com/c/pay/promotion_fixture'};},startAudit:async(request,options)=>{collected.push(request.body);assert.equal(options.authContext.user.role,'admin');await new Promise(resolve=>setTimeout(resolve,10));return {consultaId:options.consultaId};}});
    const body={tipoDocumento:'cpf',documento:'52998224725',fontes:['tjdft'],extraFields:{sellerFlow:'seller',sellerAiConsent:true,stateCourtFields:{fullName:'Pessoa Fictícia'},authorizationConfirmed:true}};
    const pending=await orders.create(owner,body,{costs:[.54],documentCount:1});assert.equal(pending.status,'pending');assert.equal(pending.complimentaryAvailable,false);assert.equal(pending.amountCents,1620);assert.equal(checkouts,1);assert.equal(collected.length,0);
    const source=await readFile(new URL('../server.mjs',import.meta.url),'utf8'),context=vm.createContext({URL,certificateOrderService:orders,getTenantIdForRequest:async request=>request.auth||{unauthorized:true},sendJson:(response,status,body)=>Object.assign(response,{status,body})});
    vm.runInContext(`async function handle(pathname,request,response){${source.slice(source.indexOf('  const certificateTestBypassMatch='),source.indexOf('  const sellerReviewMatch ='))}}`,context);
    const headers={'content-type':'application/json',host:'fixture.test',origin:'https://fixture.test'},path='/api/certificate-orders/'+pending.orderId;
    const request=async(method='POST',auth=admin,extraHeaders={})=>{const response={};await context.handle(path+(method==='POST'?'/waive':''),{method,auth,headers:{...headers,...extraHeaders},body:{role:'admin'}},response);return response;};
    assert.equal((await request('POST',null)).status,401);assert.equal((await request('POST',owner)).status,403);
    await pg.query("UPDATE audita_users SET role='admin' WHERE id=811");
    const available=await request('GET');assert.equal(available.status,200);assert.equal(available.body.complimentaryAvailable,true);assert.equal(available.body.status,'pending');assert.equal(collected.length,0,'viewing a promoted account does not collect or waive implicitly');
    for(const extra of [{'sec-fetch-site':'cross-site'},{origin:'https://another.test'},{'content-type':'text/plain'}])assert.equal((await request('POST',admin,extra)).status,403);
    for(const foreign of [{tenantId:2,user:{...admin.user}},{tenantId:1,user:{...admin.user,id:812}}])assert.equal((await request('POST',foreign)).status,404);
    assert.equal(collected.length,0);assert.equal((await orders.get(admin,pending.orderId)).status,'pending');
    const responses=await Promise.all([request(),request()]);assert(responses.every(r=>r.status===202));assert.equal(collected.length,1);assert.deepEqual(collected[0],body);assert.equal(checkouts,1);
    assert.equal((await request()).status,202);assert.equal(collected.length,1,'authorized replay is idempotent');
    const complete=(await request('GET')).body;assert.equal(complete.status,'started');assert.equal(complete.complimentary,true);assert.equal(complete.complimentaryAvailable,false);assert.equal(complete.testBypassed,false);assert.equal(complete.amountCents,pending.amountCents);assert.equal(complete.checkoutUrl,undefined);
    const saved=async()=>(await pg.query('SELECT request_payload FROM audita_audits WHERE public_id=$1',[pending.orderId])).rows[0].request_payload.certificateOrder;
    const waived=await saved();assert.equal(waived.paidAt,undefined);assert.equal(waived.testBypassed,undefined);assert.equal(waived.waivedBy,811);assert.equal(typeof waived.waivedAt,'number');assert.equal(waived.amountCents,1620);assert.deepEqual(waived.checkout,{id:'cs_promotion_fixture',url:pending.checkoutUrl});
    await pg.query("UPDATE audita_users SET role='member' WHERE id=811");assert.equal((await request('POST',owner)).status,403,'replaying after demotion cannot dispense payment');assert.equal(collected.length,1);
    const late={id:'evt_promotion_late',type:'checkout.session.completed',data:{object:{id:'cs_promotion_fixture',mode:'payment',currency:'brl',amount_total:1620,payment_status:'paid',metadata:{purchase_kind:'certificate_order',audita_tenant_id:'1',audita_user_id:'811',certificate_order_id:pending.orderId}}}};
    await orders.paymentEvent(late);await orders.paymentEvent({...late,id:'evt_promotion_late_replay'});await orders.paymentEvent({...late,id:'evt_promotion_expiry',type:'checkout.session.expired'});
    assert.equal(collected.length,1);assert.equal(checkouts,1);assert.equal((await orders.get(owner,pending.orderId)).status,'started');assert.deepEqual((await saved()).checkout,waived.checkout);assert.equal((await saved()).amountCents,1620);
  }finally{await pg.close();}
});

test('UF/Brasil scope, national deduplication and prices use the validated coverage',()=>{
  const c={certificates:[],sellerSources:getSellerDocumentCoverage({configured:true})};
  c.states=sellerStatePlans(c);c.companyStates=sellerStatePlans(c,'cnpj');
  const df=certificateSelection(c,['DF']),all=certificateSelection(c,c.states.map(s=>s.uf));
  assert(df.queries.some(q=>q.id==='cndt'));assert(all.queries.filter(q=>q.id==='cndt').length===1);
  assert(df.queries.filter(q=>q.endpoint==='TribunalRegionalTrabalho').every(q=>q.params.REGIAO===10||q.params.REGIAO==='10'));
  assert(df.queries.find(q=>q.endpoint==='TribunalRegionalTrabalho').region.includes('Distrito Federal'));
  assert(certificateSelection(c,['SP'],'cnpj').queries.every(q=>q.documentTypes.includes('cnpj')));
  assert(df.queries.some(q=>q.id==='protestos'));assert(all.queries.filter(q=>q.kind==='data').length===12);assert(!all.queries.some(q=>q.id==='protestos-basica'));assert(all.queries.filter(q=>q.kind==='data'&&q.includePdf).length===4);assert.equal(certificatePriceCents(.54),1620);
  assert.throws(()=>certificatePriceCents(-1));assert.throws(()=>certificatePriceCents(NaN));
});

test('quotes apply the threshold per source, subscriber benefits and cents rounding',()=>{
  assert.equal(certificatePriceCents(2),6000);
  assert.equal(certificatePriceCents(2.01),2010);
  assert.equal(certificateQuote([1.5,1.5]).amountCents,9000,'separate low-cost sources each use 30x');
  assert.equal(certificateQuote([3]).amountCents,3000,'one higher-cost source uses 10x');
  assert.deepEqual(certificateQuote([0,.54,3.5]),{baseCents:6120,discountCents:0,amountCents:6120,subscriber:false});
  assert.deepEqual(certificateQuote([0,.54,3.5],true),{baseCents:5120,discountCents:1536,amountCents:3584,subscriber:true});
  assert.equal(certificateQuote([0,0],true).amountCents,0);
  assert.equal(certificateQuote([0,0]).amountCents,2000);
  const rounded=certificateQuote([2.014,.544],true);
  assert.equal(rounded.baseCents,2010+1620);
  assert.equal(rounded.discountCents,Math.round(rounded.baseCents*.3));
  assert.equal(rounded.amountCents,2541);
});

test('free orders collect once without Stripe; paid analyses preserve routing and AI consent; old amounts stay fixed',async()=>{
  const pg=new PGlite(),collected=[],forms=[];let orders;
  try{
    await pg.exec((await readFile(new URL('../db/schema.sql',import.meta.url),'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
    await pg.exec("INSERT INTO audita_users(id,tenant_id,email,name,password_hash) VALUES(811,1,'fixture@example.test','Pessoa Fictícia','disabled')");
    const auth={tenantId:1,user:{id:811,email:'fixture@example.test'}},getDb=()=>({pool:pg,dbReady:true});
    const env={AUDITA_PROFILE_ENCRYPTION_KEY:'fixture-key-that-is-at-least-thirty-two-characters',AUDITA_BILLING_ENABLED:'true',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',APP_URL:'https://fixture.example.test'};
    const stripe=createStripeBillingService({env,getDb,onCertificatePaymentEvent:event=>orders.paymentEvent(event),fetchImpl:async(_,options)=>{
      forms.push(new URLSearchParams(options.body));return new Response(JSON.stringify({id:'cs_fixture_'+forms.length,url:'https://checkout.stripe.com/c/pay/fixture_'+forms.length}),{status:200});
    }});
    const make=()=>createCertificateOrderService({getDb,env,checkout:(a,o)=>stripe.createCertificateCheckoutSession(a,o),startAudit:async(request,options)=>{
      assert.equal(options.paidCertificateOrder,true);assert.equal(options.authContext.tenantId,auth.tenantId);assert.equal(options.authContext.user.id,auth.user.id);collected.push(request.body);return {consultaId:options.consultaId};
    }});
    orders=make();
    const body={tipoDocumento:'cpf',documento:'52998224725',fontes:['tjdft'],extraFields:{sellerFlow:'certificates',sellerAiConsent:false,stateCourtFields:{fullName:'Pessoa Fictícia'},authorizationConfirmed:true}};
    const free=await orders.create(auth,body,{costs:[0],subscriber:true,documentCount:1});
    assert.equal(free.amountCents,0);assert.equal(free.status,'started');assert.equal(free.consultaId,free.orderId);assert.equal(forms.length,0);
    await Promise.all([orders.collect(auth,free.orderId,{}),orders.collect(auth,free.orderId,{})]);
    orders=make();await orders.collect(auth,free.orderId,{});assert.equal(collected.length,1);
    const regular=await orders.create(auth,body,{costs:[0],documentCount:1});
    assert.equal(regular.amountCents,1000);assert.equal(regular.status,'pending');assert.equal(collected.length,1);
    const analysisBody={...body,extraFields:{...body.extraFields,sellerFlow:'seller',sellerSegment:'analise-de-fornecedores',sellerAiConsent:true}};
    const analysis=await orders.create(auth,analysisBody,{costs:[0,.54,3.5],subscriber:true,documentCount:3});
    assert.equal(analysis.amountCents,3584);assert.equal(analysis.baseCents,5120);assert.equal(analysis.discountCents,1536);assert.equal(analysis.flow,'seller');assert.equal(analysis.segment,'analise-de-fornecedores');
    const form=forms.at(-1);
    for(const key of ['success_url','cancel_url'])assert.equal(new URL(form.get(key)).hash,'#analise-de-fornecedores');
    assert.equal(form.get('line_items[0][price_data][unit_amount]'),'3584');assert.equal(collected.length,1);
    async function paid(id,order,session,amount){
      const event={id,type:'checkout.session.completed',data:{object:{id:session,mode:'payment',currency:'brl',amount_total:amount,payment_status:'paid',metadata:{purchase_kind:'certificate_order',audita_tenant_id:'1',audita_user_id:'811',certificate_order_id:order.orderId}}}};
      const raw=Buffer.from(JSON.stringify(event)),time=Math.floor(Date.now()/1000),signature=createHmac('sha256',env.STRIPE_WEBHOOK_SECRET).update(`${time}.`).update(raw).digest('hex');
      return stripe.handleWebhook(raw,`t=${time},v1=${signature}`);
    }
    await assert.rejects(paid('evt_analysis_wrong',analysis,'cs_fixture_2',5120));assert.equal(collected.length,1);
    await paid('evt_analysis_paid',analysis,'cs_fixture_2',3584);
    assert.equal(collected.length,2);assert.deepEqual(collected.at(-1),analysisBody);
    assert.equal((await orders.get(auth,analysis.orderId)).status,'started');
    const saved=(await pg.query('SELECT request_payload FROM audita_audits WHERE public_id=$1',[analysis.orderId])).rows[0].request_payload;
    assert.equal(saved.sellerFlow,'seller');assert.equal(saved.sellerSegment,'analise-de-fornecedores');
    const gifted=await orders.create(auth,analysisBody,{costs:[.54,3.5],complimentary:true,documentCount:2});
    assert.equal(gifted.amountCents,0);assert.equal(gifted.status,'started');assert.equal(forms.length,2);assert.deepEqual(collected.at(-1),analysisBody);
    const old=await orders.create(auth,body,{costs:[.54],documentCount:1});
    await pg.query("UPDATE audita_audits SET request_payload=jsonb_set(request_payload,'{certificateOrder,amountCents}','1080'::jsonb) WHERE public_id=$1",[old.orderId]);
    orders=make();assert.equal((await orders.get(auth,old.orderId)).amountCents,1080,'stored agreed amounts are not recalculated');
    await paid('evt_old_amount',old,'cs_fixture_3',1080);assert.equal((await orders.get(auth,old.orderId)).status,'started');
    for(const costs of [[],[NaN],[-1],Array(301).fill(.54)])await assert.rejects(orders.create(auth,body,{costs,documentCount:1}));
  }finally{await pg.close();}
});

test('signed payment owns the exact price; no collection before payment, no duplicate or cross-account delivery',async()=>{
  const pg=new PGlite();let calls=0,orderService;
  try{
    await pg.exec((await readFile(new URL('../db/schema.sql',import.meta.url),'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
    await pg.exec("INSERT INTO audita_users(id,tenant_id,email,name,password_hash) VALUES(811,1,'fixture@example.test','Pessoa Fictícia','disabled')");
    const a={tenantId:1,user:{id:811,email:'fixture@example.test'}},getDb=()=>({pool:pg,dbReady:true});
    const audit=createAuditService({getDb,getAuthContext:async req=>req.auth||a,logError:()=>{},customCollectors:{tjdft:{collect:async input=>{calls++;assert.equal(input.usageContext.paidCertificateOrder,true);return {status:'success',resultado:'nada_consta',dados:{certidoes:[{tipo:'CNDT fictícia',pdfPath:'fixture.pdf',status:'success',resultado:'nada_consta'}]}};}}}});
    const env={AUDITA_PROFILE_ENCRYPTION_KEY:'fixture-key-that-is-at-least-thirty-two-characters',AUDITA_BILLING_ENABLED:'true',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',APP_URL:'https://fixture.example.test'};
    let form;
    const stripe=createStripeBillingService({env,getDb,onCertificatePaymentEvent:e=>orderService.paymentEvent(e),fetchImpl:async(url,options)=>{form=new URLSearchParams(options.body);return new Response(JSON.stringify({id:'cs_fixture',url:'https://checkout.stripe.com/c/pay/cs_fixture',expires_at:Math.floor(Date.now()/1000)+3600}),{status:200});}});
    const make=()=>createCertificateOrderService({getDb,env,checkout:(auth,o)=>stripe.createCertificateCheckoutSession(auth,o),startAudit:(r,o)=>audit.startAudit(r,o)});
    orderService=make();
    const body={tipoDocumento:'cpf',documento:'52998224725',fontes:['tjdft'],extraFields:{sellerFlow:'certificates',sellerAiConsent:false,stateCourtFields:{fullName:'Pessoa Fictícia'},authorizationConfirmed:true}};
    const o=await orderService.create(a,body,{providerCostBrl:.54,documentCount:1});
    assert.equal(o.amountCents,1620);assert.equal(calls,0);assert.equal(form.get('line_items[0][price_data][unit_amount]'),'1620');
    assert(![...form.values()].some(v=>v.includes(body.documento)));
    const stored=(await pg.query('SELECT request_payload FROM audita_audits WHERE public_id=$1',[o.orderId])).rows[0].request_payload;
    assert(!JSON.stringify(stored).includes(body.documento));
    await assert.rejects(orderService.collect(a,o.orderId,{}),e=>e.statusCode===409);
    for(const foreign of [{tenantId:2,user:{id:811}},{tenantId:1,user:{id:812}}])await assert.rejects(orderService.get(foreign,o.orderId),e=>e.statusCode===404);
    await assert.rejects(orderService.get({},o.orderId),e=>e.statusCode===401);
    const metadata=Object.fromEntries([...form.entries()].filter(([k])=>k.startsWith('metadata[')).map(([k,v])=>[k.slice(9,-1),v]));
    const session={id:'cs_fixture',mode:'payment',currency:'brl',amount_total:1620,payment_status:'paid',metadata};
    async function event(id,changes={},type='checkout.session.completed'){const event={id,type,data:{object:{...session,...changes}}};const raw=Buffer.from(JSON.stringify(event)),time=Math.floor(Date.now()/1000),signature=createHmac('sha256',env.STRIPE_WEBHOOK_SECRET).update(`${time}.`).update(raw).digest('hex');return stripe.handleWebhook(raw,`t=${time},v1=${signature}`);}
    await assert.rejects(event('evt_wrong',{amount_total:1}));assert.equal(calls,0);
    await event('evt_unpaid',{payment_status:'unpaid'});assert.equal(calls,0);
    await Promise.all([event('evt_paid'),event('evt_parallel')]);
    for(let i=0;i<80&&!calls;i++)await new Promise(r=>setTimeout(r,10));
    assert.equal(calls,1);assert.equal((await orderService.get(a,o.orderId)).consultaId,o.orderId);
    assert.equal((await event('evt_paid')).duplicate,true);await event('evt_same_purchase');
    orderService=make();assert.equal((await orderService.get(a,o.orderId)).status,'started');
    await orderService.collect(a,o.orderId,{});assert.equal(calls,1);
    const cancelled=await orderService.create(a,body,{providerCostBrl:.54,documentCount:1});
    const cancelledMetadata={...metadata,certificate_order_id:cancelled.orderId};
    await event('evt_expired',{metadata:cancelledMetadata,payment_status:'unpaid'},'checkout.session.expired');
    assert.equal((await orderService.get(a,cancelled.orderId)).status,'expired');assert.equal(calls,1);
    assert.equal((await orderService.get(a,cancelled.orderId)).checkoutUrl,undefined);
    await event('evt_late_success',{metadata:cancelledMetadata},'checkout.session.async_payment_succeeded');
    assert.equal((await orderService.get(a,cancelled.orderId)).status,'started');
    let result;for(let i=0;i<80;i++){result=await audit.findAudit(o.orderId,{auth:a});if(result?.resultados.some(r=>r.dados.certidoes?.[0]?.pdfPath==='fixture.pdf'))break;await new Promise(r=>setTimeout(r,10));}assert(result.resultados.some(r=>r.dados.certidoes?.[0]?.pdfPath==='fixture.pdf'));
  }finally{await pg.close();}
});
