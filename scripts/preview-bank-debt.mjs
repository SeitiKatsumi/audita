// Local, isolated UI preview. No real accounts, external calls, payments or filings.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {PDFDocument} from 'pdf-lib';
import {createBankDebtService} from '../services/bank-debt.service.mjs';
import {createBankDebtHandler} from '../services/bank-debt-api.mjs';
import {debtHash} from '../services/bank-debt-pdf.mjs';
const pg=new PGlite();
await pg.exec((await readFile(new URL('../db/schema.sql',import.meta.url),'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
await pg.exec(await readFile(new URL('../db/bank-debt.sql',import.meta.url),'utf8'));
await pg.exec("INSERT INTO audita_users(id,tenant_id,email,name,role,password_hash) VALUES(901,1,'preview@example.test','Cliente demonstração','member','disabled'),(902,1,'review@example.test','Equipe demonstração','super_admin','disabled')");
const auth={tenantId:1,user:{id:901,tenant_id:1,role:'member',email:'preview@example.test'}},admin={tenantId:1,user:{id:902,role:'super_admin'}};
await pg.exec("INSERT INTO audita_users(id,tenant_id,email,name,role,password_hash) VALUES(903,1,'lawyer@example.test','Advogado Fictício','lawyer','disabled')");
const pool={query:(...a)=>pg.query(...a),connect:async()=>({query:(...a)=>pg.query(...a),release(){}})};
const service=createBankDebtService({getDb:()=>({pool,dbReady:true}),checkout:async(a,p)=>({id:`cs_preview_${p.caseId}`,url:'https://checkout.stripe.com/preview-unavailable',expiresAt:Math.floor(Date.now()/1000)+1800})});
const sample=await PDFDocument.create();sample.addPage();const bytes=Buffer.from(await sample.save());
const stages=['calculation_pending','offer','paid','signature','submitted'];
for(const stage of stages){let c=await service.create(auth);const cmd=async(action,extra={},who=auth)=>c=await service.command(who,c.id,{revision:c.revision,action,...extra},{ip:'127.0.0.1',userAgent:'Demonstração isolada'});
  for(const key of ['open','notified','excessive'])await cmd('answer',{key,value:true});
  await cmd('details',{details:{creditor:'Banco Exemplo · '+stage,kind:'overdraft',since:'2025-03-01',originalCents:1000000,chargedCents:4000000,offeredCents:1200000,description:'CASO FICTÍCIO. Demonstração local. NÃO PROTOCOLAR.',consent:true}});
  c=await service.upload(auth,c.id,{bytes,name:'cobranca-ficticia.pdf',kind:'evidence'});
  if(stage==='calculation_pending')continue;
  await cmd('review',{review:{reviewedCents:1500000,priceCents:19900,methodology:'EXEMPLO FICTÍCIO — NÃO É CÁLCULO AUDITA. Principal de R$ 10.000 e encargos ilustrativos de R$ 5.000, apenas para conferir as telas.',legalBasis:'EXEMPLO FICTÍCIO — NÃO PROTOCOLAR. A fundamentação real deverá ser revisada pelo advogado com base no contrato e nos documentos.',creditorLegalName:'Banco Exemplo SA',creditorDocument:'00000000000000',creditorAddress:'Endereço fictício, SP',lawyerUserId:903,lawyerName:'Advogado Fictício',lawyerOab:'SP 000000',confirmed:true}},admin);
  if(stage==='offer')continue;
  const session=await service.createCheckout(auth,c.id,{accepted:true,reviewId:c.review.id});
  await service.paymentEvent({id:'evt_preview_'+c.id,type:'checkout.session.completed',data:{object:{id:session.id,payment_status:'paid',currency:'brl',amount_total:19900,metadata:{debt_case_id:c.id,debt_review_id:c.review.id,audita_user_id:'901',audita_tenant_id:'1'}}}});
  c=await service.get(auth,c.id);if(stage==='paid')continue;
  await cmd('claimant',{claimant:{fullName:'Maria de Exemplo',document:'52998224725',email:'preview@example.test',phone:'11999999999',nationality:'Brasileira',maritalStatus:'Solteira',profession:'Professora',street:'Rua Exemplo',number:'100',complement:'',neighborhood:'Centro',city:'Jundiaí',uf:'SP',postalCode:'13201000'},conciliation:true});
  for(const kind of ['identity','address'])c=await service.upload(auth,c.id,{bytes,name:kind+'-ficticio.pdf',kind});
  if(stage==='signature')continue;
  await cmd('sign',{name:c.claimant.fullName,accepted:true,version:c.version,termsHash:debtHash(JSON.stringify(c.legalTexts))});await cmd('submit');
}
const sendJson=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data));};
const readBuffer=async(req,limit=1024*1024)=>{let size=0;const parts=[];for await(const b of req){size+=b.length;if(size>limit)throw Object.assign(Error('Limite excedido'),{status:413});parts.push(b);}return Buffer.concat(parts);};
const handler=createBankDebtHandler({service,getAuth:async()=>auth,readBuffer,readJson:async req=>JSON.parse((await readBuffer(req)).toString()||'{}'),sendJson});
const index=await readFile(new URL('../index.html',import.meta.url),'utf8'),section=index.slice(index.indexOf('        <section class="charge-analysis-page page-hidden" id="dividas-bancarias"'),index.indexOf('        <section class="charge-analysis-page" id="isencao-ir"')).replace(' page-hidden','');
const shell=index.slice(index.indexOf('    <div class="shell">'),index.indexOf('      <main class="workspace">')).replace('class="active" href="#home"','href="#home"').replace('href="#dividas-bancarias"','class="active" href="#dividas-bancarias" aria-current="page"').replace('Ambiente IA AUDITA','Prévia · dados fictícios');
const root=resolve('.');
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1:3087');
  if(url.pathname.endsWith('/checkout')){sendJson(res,422,{message:'Demonstração: nenhum pagamento real é criado. Abra um atendimento em Cadastro ou Assinatura na lista para conferir as próximas etapas.'});return;}
  if(await handler(req,res,url))return;
  if(url.pathname==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Audita · demonstração de dívidas</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/bank-debt.css"><body data-active-page="dividas-bancarias">${shell}<main class="workspace">${section}</main></div><script>document.querySelector("#sidebarToggle").onclick=()=>document.body.classList.toggle("sidebar-collapsed");document.querySelector("#mobileMenuButton").onclick=()=>{const open=document.body.classList.toggle("menu-open");document.querySelector("#mobileMenuButton").setAttribute("aria-expanded",String(open));};document.querySelector("#sidebarScrim").onclick=()=>document.body.classList.remove("menu-open");</script><script type="module" src="/bank-debt.js"></script></body></html>`);return;}
  const path=resolve(root,'.'+decodeURIComponent(url.pathname));if(!path.startsWith(root+'\\')&&!path.startsWith(root+'/'))throw Error('path');
  if(!['/styles.css','/bank-debt.css','/bank-debt.js'].includes(url.pathname)&&!url.pathname.startsWith('/assets/')){res.writeHead(404);res.end();return;}
  const types={'.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream'});res.end(await readFile(path));
}catch{if(!res.headersSent)res.writeHead(500);res.end();}}).listen(3087,'127.0.0.1',()=>console.log('Prévia isolada: http://127.0.0.1:3087 — dados fictícios, sem pagamentos ou protocolos reais.'));
