import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import {DEFAULT_CERTIFICATE_PRICING,certificateQuote,certificateSelection} from '../certificate-selection.js';
import {createCertificatePricingService,validateCertificatePricing} from '../services/certificate-pricing.service.mjs';
import {createCertificateOrderService} from '../services/certificate-order.service.mjs';

const catalog=()=>[{key:'processos-agrupados',label:'Agrupada',costBrl:1.1},{key:'processos-completos',label:'Completa',costBrl:3.3},{key:'pgfn-lista-devedores',label:'PGFN',costBrl:.54}];
test('fixed R$199 per source, percent overrides, removed exceptions and subscriber discount stay consistent',()=>{
  const sources=catalog().slice(0,2).map(q=>({...q}));
  for(const subscriber of [false,true])assert.equal(certificateQuote(sources,subscriber).amountCents,39800);
  const pricing=structuredClone(DEFAULT_CERTIFICATE_PRICING);pricing.subscriberDiscountPercent=20;pricing.standardMarkupPercent=100;pricing.exceptions['pgfn-lista-devedores']={mode:'markup',value:200};
  assert.equal(certificateQuote([{key:'pgfn-lista-devedores',costBrl:.54}],false,pricing).amountCents,162);
  assert.equal(certificateQuote([{key:'processos-completos',costBrl:3.3},.54],true,pricing).amountCents,19986);
  delete pricing.exceptions['processos-agrupados'];assert.equal(certificateQuote([sources[0]],false,pricing).amountCents,220);
  const coverage={certificatePricing:pricing,states:[{uf:'SP',queryIds:catalog().map(q=>q.key)}],sellerSources:{configured:true,queries:catalog().map(q=>({...q,id:q.key,kind:'data',documentTypes:['cpf'],scope:'Brasil'}))}};
  assert.deepEqual(certificateSelection(coverage,['SP']).queries.map(q=>q.priceCents),[220,19900,162]);
  const keys=new Set(catalog().map(q=>q.key));validateCertificatePricing(pricing,keys);
  for(const patch of [{standardMarkupPercent:-1},{subscriberDiscountPercent:101},{freeSourceCents:1.1},{standardMarkupPercent:'30'},{exceptions:{unknown:{mode:'fixed',value:19900}}},{exceptions:{'processos-completos':{mode:'fixed',value:1.5}}},{exceptions:{'processos-completos':{mode:'bad',value:1}}}])assert.throws(()=>validateCertificatePricing({...pricing,...patch},keys));
});
test('global price editor persists across service instances, checks role/revision and freezes existing checkout',async()=>{
  const pg=new PGlite();try{
    await pg.exec((await readFile(new URL('../db/schema.sql',import.meta.url),'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
    await pg.exec("INSERT INTO audita_users(id,tenant_id,email,name,password_hash) VALUES(811,1,'fixture@example.test','Pessoa Ficticia','disabled')");
    const actor={tenantId:1,user:{id:811,role:'super_admin'}},make=()=>createCertificatePricingService({getDb:()=>({pool:pg,dbReady:true}),catalog});
    const service=make(),initial=await service.get(),pricing=structuredClone(initial.pricing);
    await assert.rejects(service.save({user:{id:811,role:'admin'}},{pricing,revision:0}),{status:403});
    const saved=await service.save(actor,{pricing,revision:0});assert.equal(saved.revision,1);
    const checkouts=[],orders=createCertificateOrderService({getDb:()=>({pool:pg,dbReady:true}),getPricing:async()=>(await make().get()).pricing,env:{AUDITA_PROFILE_ENCRYPTION_KEY:'fixture-key-that-is-at-least-thirty-two-characters'},checkout:async(_,o)=>{checkouts.push(o);return{id:'cs_fixture',url:'https://checkout.stripe.com/c/pay/fixture'}},startAudit:async()=>{throw Error('no provider calls')}});
    const body={tipoDocumento:'cpf',documento:'52998224725',fontes:['seller_documents'],extraFields:{sellerFlow:'certificates',stateCourtFields:{fullName:'Pessoa Ficticia'}}};
    const old=await orders.create(actor,body,{costs:[{key:'processos-completos',costBrl:3.3}],subscriber:true,documentCount:1});assert.equal(old.amountCents,19900);assert.equal(checkouts[0].amountCents,19900);
    pricing.exceptions['processos-completos'].value=25000;
    await service.save(actor,{pricing,revision:saved.revision});
    assert.equal((await make().get()).pricing.exceptions['processos-completos'].value,25000);
    await assert.rejects(service.save(actor,{pricing,revision:1}),{status:409});
    assert.equal((await orders.get(actor,old.orderId)).amountCents,19900);
    const next=await orders.create(actor,body,{costs:[{key:'processos-completos',costBrl:3.3}],documentCount:1});assert.equal(next.amountCents,25000);
    const unavailable=createCertificatePricingService({getDb:()=>({dbReady:false}),catalog});
    await assert.rejects(unavailable.save(actor,{pricing,revision:0}),{status:503});await assert.rejects(unavailable.get({required:true}),{status:503});
  }finally{await pg.close()}
});
test('pricing route rejects unauthenticated, non-super-admin and cross-site updates before persistence',async()=>{
  const source=await readFile(new URL('../server.mjs',import.meta.url),'utf8');let calls=0;
  const context=vm.createContext({URL,getTenantIdForRequest:async r=>r.actor,readJsonBody:async r=>r.body,certificatePricingService:{get:async()=>({pricing:{},revision:1}),save:async()=>{calls++;return{revision:2}},catalog},sendJson:(r,status,body)=>Object.assign(r,{status,body})});
  const start=source.indexOf("  if(pathname==='/api/super-admin/certificate-pricing'"),end=source.indexOf('  if (pathname === "/api/super-admin/dashboard"',start);
  vm.runInContext('async function run(request,response){const pathname="/api/super-admin/certificate-pricing";'+source.slice(start,end)+'}',context);
  const run=async(actor,headers={},method='PUT')=>{const r={setHeader(){}};await context.run({actor,method,headers},r);return r.status};
  assert.equal(await run({unauthorized:true}),401);assert.equal(await run({user:{role:'admin'}}),403);
  assert.equal(await run({user:{role:'super_admin'}},{'content-type':'application/json','sec-fetch-site':'cross-site'}),403);assert.equal(calls,0);
  assert.equal(await run({user:{role:'super_admin'}},{'content-type':'application/json',host:'localhost',origin:'http://localhost'}),200);assert.equal(calls,1);
});
