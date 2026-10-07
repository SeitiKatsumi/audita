// Local UI + real collection/review services and PostgreSQL engine; fictitious providers only.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { randomUUID, createHmac } from 'node:crypto';
import vm from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { createAuditService, validateCnpj } from '../services/audit.service.mjs';
import { normalizeDfSellerInput, normalizeSellerInput, buildDfSellerAuditRequest } from '../services/seller-analysis.service.mjs';
import { normalizePersonBirthDate,personNamesMatch } from '../services/direct-data-person.service.mjs';
import { planSellerDocuments, getSellerDocumentCoverage } from '../services/seller-documents.service.mjs';
import { planAutonomousCertificates } from '../services/state-court-autonomous.service.mjs';
import { createSellerReviewService } from '../services/seller-review.service.mjs';
import { extractPdfText } from '../services/pdf.service.mjs';
import {createCertificateOrderService,CERTIFICATE_PRICE_MULTIPLIER} from '../services/certificate-order.service.mjs';
import {createStripeBillingService} from '../services/stripe-billing.service.mjs';
import { sellerStatePlans,sellerQueriesForState } from '../services/seller-state-plan.mjs';

const serveOnly=process.argv.includes('--serve');
const sourceCoverage=getSellerDocumentCoverage({configured:true});sourceCoverage.queries=sourceCoverage.queries.filter(q=>['protestos','cndt','vinculos','cndt-company','fgts-company'].includes(q.id));
const courtCoverage={ufs:['ES','AP'],certificates:[{uf:'ES',type:'Cível',provider:'portal'},{id:'AP:Cível',uf:'AP',type:'Cível',provider:'direct_data',requiredIdentityFields:['birthDate','motherName','rg','gender']}]};
const fixtureCoverage={aiReady:true,certificatePriceMultiplier:20,certificateCheckoutReady:true,...courtCoverage,sellerSources:sourceCoverage};fixtureCoverage.states=sellerStatePlans(fixtureCoverage);fixtureCoverage.companyStates=sellerStatePlans(fixtureCoverage,'cnpj');
const companyFixture=async input=>({status:'success',dados:{cnpj:input.documento,razaoSocial:'Empresa Fictícia Ltda',uf:'AP',qsa:[{nome:'Sócio Fictício',qualificacao:'Administrador'}]}});

let base=process.env.AUDITA_BASE_URL||'http://localhost:3012';
const appBase=base; let httpServer;
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const pg=new PGlite(); let browser;
const auth={tenantId:1,user:{id:811,name:'Pessoa Fictícia',role:'member'}};
let providerCalls=0,aiCalls=0,identityCalls=0,lastId;
const issuedPdf=await PDFDocument.create();issuedPdf.addPage().drawText('CERTIDAO FICTICIA - TESTE DE EMISSAO');const issuedBytes=Buffer.from(await issuedPdf.save());
const source=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
const paths=['/api/seller-analysis','/api/seller-analysis/coverage'];
try {
 await pg.exec((await readFile(new URL('../db/schema.sql',import.meta.url),'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
 await pg.exec("INSERT INTO audita_users(id,tenant_id,email,name,password_hash) VALUES(811,1,'ui-seller@example.test','Pessoa Fictícia','disabled')");
 let review;
 const audit=createAuditService({getDb:()=>({pool:pg,dbReady:true}),getAuthContext:async()=>auth,customCollectors:{seller_documents:{collectCompany:companyFixture},tjdft:{collect:async input=>{providerCalls++;return {fonte:'tjdft',status:'success',resultado:'nada_consta',dados:{certidoes:[{tipo:(input.extraFields.autonomousCertificates?.[0]||'ES:Cível').replace(':',' · '),status:'success',resultado:'nada_consta',pdfPath:'/private/ficticio.pdf'}]},rawText:''};}}},
   getSellerDocumentConfiguration:()=>({configured:true}),
   querySellerDocument:async input=>{providerCalls++;await new Promise(r=>setTimeout(r,600));if(input.endpoint==='VinculosSocietarios')return {result:{status:'success',payload:{retorno:{documentoConsultado:'52998224725',relacionamentos:[]}}}};if(input.endpoint!=='ProtestosOnline')return {reason:'provider_timeout'};return {result:{status:'success',queriedAt:new Date().toISOString(),providerReference:'fixture',payload:{retorno:{documentoConsultado:'52998224725',constamProtestos:true,numeroTotalProtestos:1,valorTotalProtestos:'R$ 1.250,00'}}}};},
   onSellerCollected:(id,a,request)=>review.start(id,a,request,true),logError:()=>{},
 });
 review=createSellerReviewService({getDb:()=>({pool:pg,dbReady:true}),auditService:audit,ai:{ready:()=>true,read:async source=>{aiCalls++;await new Promise(r=>setTimeout(r,2500));const company=source.title.includes('cadastro e QSA'),links=source.title.includes('Vínculos');return {summary:company?'Cadastro empresarial e QSA obtidos.':links?'Não foram identificadas empresas vinculadas no retorno.':'Há um protesto informado pela fonte.',identity:'compatible',outcome:company||links?'informational':'occurrences',issuedAt:null,validUntil:null,limitations:[],findings:company||links?[]:[{category:'credit',priority:'high',title:'Protesto informado',description:'Conferir valor e eventual baixa com o cartório.',quote:'R$ 1.250,00',amount:'R$ 1.250,00',date:null,recommendation:'Solicitar a certidão atualizada e o comprovante de baixa.'}]};}}});
 const paymentEnv={AUDITA_PROFILE_ENCRYPTION_KEY:'fictional-ui-certificate-key-at-least-32-characters',AUDITA_BILLING_ENABLED:'true',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',APP_URL:base};
 let orderService;
 const stripe=createStripeBillingService({env:paymentEnv,getDb:()=>({pool:pg,dbReady:true}),onCertificatePaymentEvent:event=>orderService.paymentEvent(event),fetchImpl:async()=>new Response(JSON.stringify({id:'cs_ui_fixture',url:'https://checkout.stripe.com/c/pay/fictional-ui-fixture'}),{status:200})});
 orderService=createCertificateOrderService({getDb:()=>({pool:pg,dbReady:true}),env:paymentEnv,checkout:(a,o)=>stripe.createCertificateCheckoutSession(a,o),startAudit:(r,o)=>audit.startAudit(r,o)});
 const sandbox=vm.createContext({certificateOrderService:orderService,CERTIFICATE_PRICE_MULTIPLIER,billingConfiguration:()=>({checkoutReady:true,webhookReady:true}),URL,crypto:{randomUUID},sellerReviewService:review,auditService:audit,normalizeDfSellerInput,normalizeSellerInput,normalizePersonBirthDate,personNamesMatch,collectSellerCompany:companyFixture,buildDfSellerAuditRequest,planSellerDocuments,planAutonomousCertificates,validateCnpj,
   getSellerDocumentCoverage:()=>sourceCoverage,getAutonomousCertificateCoverage:()=>courtCoverage,sellerStatePlans,sellerQueriesForState,
   directDataPersonService:{lookup:async input=>{identityCalls++;return {result:{document:input.cpf,fullName:'Vendedor Fictício',motherName:'Mãe Fictícia',birthDate:'1980-01-01',gender:'Masculino',rg:''}};}},directDataCertificatesService:{getStatus:()=>({configured:true,allowedUfs:['AP']})},directDataSellerService:{getStatus:()=>({configured:true})},getTenantIdForRequest:async()=>auth,
   readJsonBody:async req=>req.body,sendJson:(res,status,body)=>Object.assign(res,{status,body}),
 });
 const start=source.slice(source.indexOf('  if (["/api/seller-analysis/df"'),source.indexOf('  const publicAuditEvidenceMatch ='));
 vm.runInContext(`async function handle(pathname,request,response){${start}}`,sandbox);
 async function confirmCertificateOrder(id){
   const order=await orderService.get(auth,id),event={id:'evt-ui-'+id,type:'checkout.session.completed',data:{object:{id:'cs_ui_fixture',mode:'payment',currency:'brl',amount_total:order.amountCents,payment_status:'paid',metadata:{purchase_kind:'certificate_order',audita_tenant_id:'1',audita_user_id:'811',certificate_order_id:id}}}};
   const raw=Buffer.from(JSON.stringify(event)),time=Math.floor(Date.now()/1000),signature=createHmac('sha256',paymentEnv.STRIPE_WEBHOOK_SECRET).update(time+'.').update(raw).digest('hex');
   await stripe.handleWebhook(raw,'t='+time+',v1='+signature);lastId=id;
 }
 const routeHandler=async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname;
   if(url.origin!==new URL(base).origin)return route.abort();
   if(path==='/api/auth/me')return route.fulfill({json:{authRequired:true,user:auth.user}});
   if(serveOnly&&path==='/api/test/seller-metrics')return route.fulfill({json:{providerCalls,identityCalls,aiCalls,lastId}});
   if(serveOnly&&path==='/api/test/certificate-payment'&&req.method()==='POST') {await confirmCertificateOrder(req.postDataJSON().orderId);return route.fulfill({json:{ok:true}});}
   if(path==='/api/seller-analysis/coverage')return route.fulfill({json:fixtureCoverage});
   if(path.startsWith('/api/seller-analysis')||path.startsWith('/api/certificate-orders')){
     const res={setHeader(){},writeHead(status,headers){Object.assign(this,{status,headers});},end(buffer){this.buffer=buffer;}};
     await sandbox.handle(path,{method:req.method(),body:req.method()==='POST'?req.postDataJSON():{},headers:{'content-type':'application/json',host:new URL(base).host,origin:base}},res);
     if(res.body?.consultaId||res.body?.orderId)lastId=res.body.consultaId||res.body.orderId;
     if(res.buffer)return route.fulfill({status:res.status,headers:Object.fromEntries(Object.entries(res.headers).map(([k,v])=>[k,String(v)])),body:res.buffer});
     return route.fulfill({status:res.status||500,json:res.body||{}});
   }
   if(path==='/audit')return route.fulfill({json:await audit.listAuditHistory({})});
   if(path.includes('/documents/tjdft/'))return route.fulfill({status:200,headers:{'content-type':'application/pdf'},body:issuedBytes});
   if(path.startsWith('/audit/'))return route.fulfill({json:await audit.findAudit(path.split('/')[2],{})});
   if(path.startsWith('/api/'))return route.fulfill({json:path.endsWith('/cases')?{cases:[]}:{}});
   return route.continue();
 };
 httpServer=createServer(async(req,res)=>{
  let data='';for await(const chunk of req)data+=chunk;
  const adapter={request:()=>({url:()=>base+req.url,method:()=>req.method,postDataJSON:()=>JSON.parse(data||'{}')}),abort:()=>{res.writeHead(403);res.end();},fulfill:async options=>{const headers={...(options.headers||{})};let body=options.body;if(options.json!==undefined){headers['content-type']='application/json';body=JSON.stringify(options.json);}res.writeHead(options.status||200,headers);res.end(body);},continue:async()=>{const r=await fetch(appBase+req.url);res.writeHead(r.status,{'content-type':r.headers.get('content-type')||'text/plain'});res.end(Buffer.from(await r.arrayBuffer()));}};
  try{await routeHandler(adapter);}catch(e){res.writeHead(500);res.end('Test fixture failed');console.error(e.message);}
 });
 await new Promise(resolve=>httpServer.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+httpServer.address().port;
 if(serveOnly){console.log(JSON.stringify({fixtureUrl:base,fictionalProviders:true}));await new Promise(()=>{});}
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await mkdir('output/playwright',{recursive:true});
 await page.goto(base+'/#analise-vendedor');
 await page.locator('#sellerAnalysisCpf').fill('52998224725');
 await page.locator('#sellerAnalysisState').selectOption('SP');
 await page.locator('#sellerAnalysisAuthorization').check();
 await page.screenshot({path:'output/playwright/seller-input-desktop.png',fullPage:true});
 await page.locator('#sellerAnalysisSubmit').click();
 await page.getByRole('heading',{name:'3. Analisando documentos e dados'}).waitFor();
 await page.screenshot({path:'output/playwright/seller-progress-desktop.png',fullPage:true});
 const download=page.getByRole('link',{name:'Baixar relatório completo em PDF'});
 await download.waitFor();
 assert.equal(providerCalls,3);assert.equal(aiCalls,2);
 await page.getByText('Ver pendências e próximos passos',{exact:true}).click();
 await page.screenshot({path:'output/playwright/seller-report-desktop.png',fullPage:true});
 const downloadEvent=page.waitForEvent('download');await download.click();const file=await downloadEvent;
 await file.saveAs('output/playwright/seller-ui-report.pdf');
 assert.match(await extractPdfText(await readFile('output/playwright/seller-ui-report.pdf')),/R\$ 1\.250,00/);
 await page.reload();await download.waitFor();assert.equal(aiCalls,2,'reload must not rerun AI');
 await page.setViewportSize({width:390,height:844}); await page.reload(); await download.waitFor(); await page.waitForFunction(()=>{const r=document.querySelector('#sellerAnalysisResult').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;});
 await page.screenshot({path:'output/playwright/seller-report-mobile.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile overflow');
 await page.evaluate(()=>sessionStorage.removeItem('audita:lastSellerAnalysisDfAuditId')); await page.reload(); await page.locator('#sellerReviewHistory > summary').click(); await page.locator('[data-seller-history]').first().click(); await download.waitFor(); assert.equal(providerCalls,3); assert.equal(aiCalls,2);
 await page.locator('#sellerChangeData').click();await page.locator('#sellerAnalysisCpf').waitFor({state:'visible'});
 await page.screenshot({path:'output/playwright/seller-return-mobile.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'form mobile overflow');
 await page.goto(base+'/#central-servicos');
 await page.getByRole('button',{name:'Emissão de certidões',exact:true}).click();
 await page.locator('.service-card-entry[href="#emissao-certidoes"]').click();
 await page.getByRole('heading',{name:'Emissão de certidões diversas',exact:true}).first().waitFor();
 await page.locator('#sellerAnalysisUfs input[value="AP"]').waitFor();
 assert.equal(await page.locator('#sellerAiConsentLabel').isVisible(),false);
 assert.equal(await page.locator('#sellerAnalysisAiConsent').isDisabled(),true);
 assert.equal(await page.locator('#sellerAnalysisQueries input[value="protestos"]').count(),0);
 await page.locator('#sellerAnalysisCpf').fill('52998224725');
 await page.locator('#sellerAnalysisFullName').fill('Titular Fictício');
 await page.locator('#sellerAnalysisUfs input[value="ES"]').check();
 await page.locator('#sellerAnalysisBirthDate').fill('1980-01-01');
 await page.locator('#sellerAnalysisMotherName').fill('Mãe Fictícia');
 await page.locator('#sellerAnalysisRg').fill('123456789');
 await page.locator('#sellerAnalysisGender').selectOption('Masculino');
 for(const id of ['sellerAnalysisPaid','sellerAnalysisAuthorization'])await page.locator('#'+id).check();
 for(const input of await page.locator('#sellerAnalysisQueries input:not([data-certificate-court])').all())await input.uncheck();
 await page.getByRole('button',{name:'Continuar para pagamento',exact:true}).click();
 await page.getByRole('heading',{name:'Pagamento da emissão',exact:true}).waitFor();assert.equal(providerCalls,3);await confirmCertificateOrder(lastId);
 await page.locator('#sellerCollectionDetails > summary').click();
 await page.getByRole('link',{name:'Abrir PDF',exact:true}).waitFor();
 assert.equal(await page.locator('#sellerReviewPanel').count(),0);
 assert.equal(aiCalls,2,'issuance does not call AI');assert.equal(providerCalls,4);
 const pdfLink=await page.getByRole('link',{name:'Abrir PDF',exact:true}).getAttribute('href');
 assert.match(await extractPdfText(Buffer.from(await (await fetch(base+pdfLink)).arrayBuffer())),/CERTIDAO FICTICIA/);
 const state=await review.get(lastId,auth);assert.equal(state.status,'not_started');
 const refusal={};await sandbox.handle(`/api/seller-analysis/${lastId}/review`,{method:'POST',body:{consent:true},headers:{'content-type':'application/json',host:new URL(base).host,origin:base}},refusal);assert.equal(refusal.status,409);
 await page.screenshot({path:'output/playwright/certificates-mobile.png',fullPage:true});
 await page.reload();await page.locator('#sellerCollectionDetails > summary').click();await page.getByRole('link',{name:'Abrir PDF',exact:true}).waitFor();assert.equal(providerCalls,4);assert.equal(aiCalls,2);
 await page.locator('#sellerReviewHistory > summary').click();await page.locator('[data-seller-history]').first().waitFor();assert.equal(await page.locator('[data-seller-history]').count(),1);
 await page.goto(base+'/#analise-vendedor');await download.waitFor();
 await page.locator('#sellerReviewHistory > summary').click();await page.locator('[data-seller-history]').first().waitFor();assert.equal(await page.locator('[data-seller-history]').count(),1);
 assert.equal(aiCalls,2);assert.equal(providerCalls,4);
 assert.deepEqual(errors,[]);
 console.log('PASS: desktop/mobile, inputs, collection, automatic AI, progress, partial results, PDF download, reload without queries, return to form; PGlite and fictitious providers.');
}finally{await browser?.close();await new Promise(resolve=>httpServer?httpServer.close(resolve):resolve());await pg.close();}
