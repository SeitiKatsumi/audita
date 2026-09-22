import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {chromium} from 'playwright';
import {createImportService} from '../services/import-audit.service.mjs';

const base=process.env.AUDITA_BASE_URL||'http://localhost:3000';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const pg=new PGlite();await pg.waitReady;
await pg.exec((await readFile(new URL('../db/schema.sql',import.meta.url),'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
await pg.exec(await readFile(new URL('../db/import-audit.sql',import.meta.url),'utf8'));
await pg.exec("INSERT INTO audita_users(id,tenant_id,name,email,password_hash,role) VALUES(1,1,'Teste','import-ui@example.test','x','member'),(2,1,'Revisor','review-ui@example.test','x','super_admin')");
const pool={query:(...args)=>pg.query(...args),connect:async()=>({query:(...args)=>pg.query(...args),release(){}})};
const source='https://www.gov.br/receitafederal/pt-br/teste';
const service=createImportService({getDb:()=>({pool,dbReady:true}),env:{AUDITA_IR_ENCRYPTION_KEY:randomBytes(32).toString('hex')},ai:{available:()=>true,
 extract:async()=>({products:[1,2,3].map(i=>({description:'Máquina fictícia '+i,original:'Fictional machine '+i,specifications:'Produto para teste, sem enquadramento real.',quantity:'1',value:'100',currency:'USD',page:1})),warnings:[]}),
 suggest:async products=>({items:products.map((_,index)=>({index,candidates:[{code:'85437099',reason:'Justificativa fictícia'}],missing:[]}))}),
 research:async()=>({text:'Pesquisa sintética, não é referência tributária.',sources:[{title:'Fonte de teste',url:source}],notice:'Revisão obrigatória.',fetchedAt:'2026-09-22'}),
},ncm:async()=>({rows:new Map([['85437099',{description:'Código de teste',act:'Fixture'}]]),source,fetchedAt:'2026-09-22',notice:'Tabela de teste'})});
const browser=await chromium.launch();
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});let user=null;const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname,a={tenantId:1,user};
  const send=(json,status=200)=>route.fulfill({json,status});
  if(path==='/api/auth/me')return send({authRequired:true,user});
  if(path==='/api/auth/login'){user={id:1,name:'Teste',role:'member'};return send({ok:true});}
  if(path.startsWith('/api/import-audit/'))try{
   const p=path.slice('/api/import-audit'.length),m=req.method();
   if(p==='/config')return send(await service.configuration(a));
   assert.ok(user,'private action without session');
   if(p==='/cases')return send(m==='GET'?{cases:await service.list(a)}:{case:await service.create(a,req.postDataJSON())});
   if(p==='/queue')return send({cases:await service.list(a,true)});
   const[,id,action='']=p.match(/^\/cases\/([^/]+)(?:\/(.*))?$/);
   if(action==='report'){const f=await service.report(a,id);return route.fulfill({body:f.buffer,contentType:f.mime,headers:{'content-disposition':'attachment; filename="test.pdf"'}});}
   if(action==='documents')return send({case:await service.upload(a,id,{buffer:req.postDataBuffer(),name:url.searchParams.get('name'),type:url.searchParams.get('type'),revision:Number(url.searchParams.get('revision'))})});
   return send({case:action==='actions'?await service.command(a,id,req.postDataJSON()):await service.get(a,id)});
  }catch(e){return send({message:e.message},e.statusCode||500);}
  if(req.method()==='GET'&&(path.endsWith('/config')||['/api/health','/api/modules','/api/state-courts'].includes(path)))return route.continue();
  return send({},404);
 });
 await page.goto(base+'/#central-servicos');
 await page.locator('[data-service-category=beneficios]').click();
 await page.locator('.service-card-entry[href="#auditoria-importacao"]').click();
 const root=page.locator('#importApp');
 await root.getByRole('heading',{name:'Entenda a classificação e os tributos da sua importação'}).waitFor();
 assert.equal(await root.locator('.charge-analysis-message.assistant').count(),1);
 assert.equal(await root.locator('form').count(),1);
 if(width>960)assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),'entry must fit viewport');
 await page.screenshot({path:join(tmpdir(),`audita-import-chat-entry-${width}.png`),fullPage:true});
 assert.equal(await page.locator('#loginScreen').evaluate(el=>el.open),false);
 await root.locator('[name=consent]').click();
 assert.ok(await page.locator('#loginScreen').evaluate(el=>el.open));
 await page.locator('#loginEmail').fill('import-ui@example.test');await page.locator('#loginPassword').fill('synthetic-password');await page.locator('#loginSubmitButton').click();
 await page.waitForFunction(()=>!document.querySelector('#loginScreen').open);
 await root.locator('[name=consent]').check();
 await root.getByRole('button',{name:'Sim, vamos começar',exact:true}).click();
 await root.getByRole('heading',{name:'Documentos da importação'}).waitFor();
 const caseUrl=page.url();
 await root.locator('input[type=file]').setInputFiles({name:'ficticio.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nSynthetic only')});
 await root.getByRole('button',{name:'Enviar documento',exact:true}).click();
 await root.getByRole('heading',{name:'Recebi os documentos. Posso fazer a leitura?'}).waitFor();
 assert.equal(await root.locator('.charge-analysis-conversation > .charge-analysis-message').count(),1);
 if(width>960)assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),'documents step must fit viewport');
 assert.equal(await root.locator('.charge-analysis-message.user').count(),2);
 assert.equal(await root.locator('input[type=file]').count(),0);
 await root.getByRole('button',{name:'Ler documentos com IA',exact:true}).click();
 await root.getByRole('heading',{name:'Vamos conferir o produto 1 de 3?'}).waitFor();
 assert.equal(await root.locator('[data-product]').count(),1);
 if(width>960)assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),'product step must fit viewport');
 await page.screenshot({path:join(tmpdir(),`audita-import-chat-product-${width}.png`),fullPage:true});
 await root.locator('[name=description]').fill('Máquina conferida <script>não executar</script>');
 await root.getByRole('button',{name:'Próximo produto',exact:true}).click();
 await root.getByRole('button',{name:'Remover item duplicado ou não pertinente',exact:true}).click();
 await root.getByRole('heading',{name:'Vamos conferir o produto 2 de 2?'}).waitFor();
 assert.equal(await root.locator('[name=description]').inputValue(),'Máquina fictícia 3');
 await root.getByRole('button',{name:'Produto anterior',exact:true}).click();
 assert.equal(await root.locator('[name=description]').inputValue(),'Máquina conferida <script>não executar</script>');
 await root.getByRole('button',{name:'Próximo produto',exact:true}).click();
 await root.locator('[data-import-form=products] [name=confirmed]').check();
 await root.getByRole('button',{name:'Salvar e confirmar produtos',exact:true}).click();
 await root.getByRole('heading',{name:'Vamos pesquisar o enquadramento dos produtos?'}).waitFor();
 assert.equal(await root.locator('[data-import-form=products]').count(),0);
 assert.equal(await root.locator('.import-new-message').evaluate(el=>getComputedStyle(el).animationName),'none');
 await root.getByRole('button',{name:'Complementar documentos',exact:true}).click();
 await root.getByRole('heading',{name:'Quer complementar os documentos?'}).waitFor();
 assert.equal(await root.locator('input[type=file]').count(),1);
 await root.getByRole('button',{name:'Voltar à conversa',exact:true}).click();
 await root.getByRole('heading',{name:'Vamos pesquisar o enquadramento dos produtos?'}).waitFor();
 await root.getByRole('button',{name:'Corrigir produtos',exact:true}).click();
 await root.getByRole('heading',{name:'Vamos conferir o produto 1 de 2?'}).waitFor();
 await root.getByRole('button',{name:'Próximo produto',exact:true}).click();
 await root.locator('[data-import-form=products] [name=confirmed]').check();
 await root.getByRole('button',{name:'Salvar e confirmar produtos',exact:true}).click();
 await root.getByRole('button',{name:'Pesquisar NCMs e possíveis benefícios',exact:true}).click();
 await root.getByRole('heading',{name:'Agora, a equipe precisa revisar'}).waitFor();
 if(width>960)assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),'research step must fit viewport');
 await root.getByRole('button',{name:'Ver conversa anterior',exact:true}).click();
 assert.equal(await root.locator('#importPrevious').evaluate(el=>el.open),true);
 await root.locator('.import-findings summary').click();
 await root.getByRole('heading',{name:'NCMs candidatas · revisão obrigatória'}).waitFor();
 await page.keyboard.press('Escape');
 assert.equal(await root.locator('#importPrevious').evaluate(el=>el.open),false);
 assert.equal(await root.getByRole('button',{name:'Ver conversa anterior',exact:true}).evaluate(el=>el===document.activeElement),true);
 assert.equal(await root.locator('[data-import-form=review]').count(),0);
 assert.equal(await root.locator('script').count(),0);
 const download=page.waitForEvent('download');await root.getByRole('link',{name:'Baixar relatório preliminar'}).click();await download;
 await page.screenshot({path:join(tmpdir(),`audita-import-owner-${width}.png`),fullPage:true});
 await root.getByRole('button',{name:'Meus atendimentos',exact:true}).click();
 await root.getByText('Retomar meus atendimentos',{exact:true}).click();
 await root.locator(`[data-import=open][data-id="${new URL(caseUrl).searchParams.get('importCase')}"]`).click();
 await root.getByRole('heading',{name:'Agora, a equipe precisa revisar'}).waitFor();
 user={id:2,name:'Revisor Teste',role:'super_admin'};await page.goto('about:blank');await page.goto(caseUrl);
 const review=root.locator('[data-import-form=review]');await review.waitFor();
 await review.locator('[name=operationDate]').fill('2026-09-22');await review.locator('[name=note]').fill('Revisão fictícia para teste de interface.');
 assert.equal(await review.locator('[data-review]').count(),2);
 for(const fields of await review.locator('[data-review]').all()){
  await fields.locator('[name=ncm]').selectOption('85437099');
  for(const [key,value]of Object.entries({customsValueCents:'1000',otherIpiBaseCents:'0',iiBps:'10',ipiBps:'5',scenarioIiBps:'0',scenarioIpiBps:'5'}))await fields.locator(`[name=${key}]`).fill(value);
  await fields.locator('[name=iiSource]').fill(source);await fields.locator('[name=ipiSource]').fill(source);await fields.locator('[name=basis]').fill('Ato e condições fictícios, somente fixture.');
 }
 await review.locator('[name=standardAdValorem]').check();await review.locator('[name=confirmed]').check();await review.getByRole('button',{name:'Registrar revisão e calcular II/IPI'}).click();
 await root.getByRole('heading',{name:'Simulação de II/IPI · premissas revisadas'}).waitFor();
 assert.ok((await root.innerText()).includes('105,00'));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:join(tmpdir(),`audita-import-reviewed-${width}.png`),fullPage:true});
 await page.reload();await root.getByRole('link',{name:'Baixar relatório revisado'}).waitFor();
 assert.deepEqual(errors,[]);await page.close();console.log(`${width}: guest/login, upload, extraction, confirmation, suggestions, owner/reviewer permissions, calculation, PDF, resume and layout OK`);
}}finally{await browser.close();await pg.close();}
