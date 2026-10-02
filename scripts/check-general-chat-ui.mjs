// Real UI, HTTP handlers, quota/document services and encrypted storage; fictional SDK/isolated DB only.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,extname} from 'node:path';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import {chromium} from 'playwright';
import {PDFDocument} from 'pdf-lib';
import {createChatAccessService} from '../services/chat-access.service.mjs';
import {createChatRequestService} from '../services/chat-request.service.mjs';
import {createChatDocumentsService} from '../services/chat-documents.service.mjs';
import {createGeneralChatStorage} from '../services/general-chat-storage.service.mjs';
import {createGeneralChatService} from '../services/general-chat.service.mjs';
import {CHAT_PLANS} from '../services/billing-catalog.service.mjs';

const root=resolve(process.env.AUDITA_UI_ASSET_ROOT||new URL('../',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const privateRoot=await mkdtemp(join(tmpdir(),'audita-chat-ui-')),pg=new PGlite();
const auth={tenantId:1,user:{id:811,tenant:{id:1},name:'Pessoa Fictícia',role:'member'}};
const env={AUDITA_CHAT_DOCUMENTS_ENCRYPTION_KEY:'fictional-test-key'.repeat(4)};
const captures=[],httpCalls=[],errors=[];
let browser,server,slowStarted,slowReady;
const pdf=await PDFDocument.create();pdf.addPage().drawText('RELATORIO FICTICIO - 30% de economia');const pdfBytes=Buffer.from(await pdf.save());
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64');
const artifactBytes={pdf:pdfBytes,html:Buffer.from('<!doctype html><html><h1>Prévia fictícia</h1><script>parent.window.previewEscaped=true</script></html>'),csv:Buffer.from('item,valor\nEconomia,30\n')};
const sdk={responses:{create:async(payload,options={})=>{
 captures.push(payload);
 if(!payload.stream)return {status:'completed',output_text:JSON.stringify({summary:'Documento fictício [p. 1]',pages:[{page:1,text:'Dados de teste',uncertain:false}]})};
 const text=payload.input.at(-1).content.find(p=>p.type==='input_text').text;
 return (async function*(){
   if(/web/.test(text))yield {type:'response.web_search_call.searching'};
   if(text.includes('demorada')){slowReady?.();await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,process.argv.includes('--serve')?20000:5000);options.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(Object.assign(new Error('cancelled'),{name:'AbortError'}));},{once:true});});}
   const output=[];let answer='Resposta fictícia com contexto.';
   if(/PDF|arquivos/.test(text)){
     answer='Arquivos concluídos.\n```html\n'+('x'.repeat(220))+'\n```';
     output.push({type:'message',content:[{type:'output_text',annotations:Object.keys(artifactBytes).map(id=>({type:'container_file_citation',container_id:'container_fixture',file_id:id,filename:'resultado.'+id}))}]});
   }else if(/imagem/.test(text)){answer='Imagem pronta.';output.push({type:'image_generation_call',result:png.toString('base64')});}
   else if(/web/.test(text)){answer='Resultado da pesquisa.';output.push({type:'web_search_call',action:{sources:[{title:'Fonte fictícia',url:'https://example.test/source'}]}});}
   else if(/Itaú/.test(text))answer='Acesse [Cobranças indevidas Itaú](/#analise-cobrancas).';
   yield {type:'response.output_text.delta',delta:answer.slice(0,12)};await new Promise(r=>setTimeout(r,100));
   yield {type:'response.output_text.delta',delta:answer.slice(12)};
   yield {type:'response.completed',response:{status:'completed',output_text:answer,output,usage:{input_tokens:20,output_tokens:10}}};
 })();
}},containers:{files:{content:{retrieve:async id=>new Response(artifactBytes[id])}}}};
try{
 await pg.exec('CREATE TABLE audita_tenants(id BIGINT PRIMARY KEY); CREATE TABLE audita_users(id BIGINT PRIMARY KEY,tenant_id BIGINT); INSERT INTO audita_tenants VALUES(1),(2); INSERT INTO audita_users VALUES(811,1),(812,1);');
 for(const name of ['20260922-chat-access.sql','20260922-chat-documents.sql'])await pg.exec(await readFile(new URL('../db/migrations/'+name,import.meta.url),'utf8'));
 let tail=Promise.resolve();const query=(...args)=>pg.query(...args);
 const pool={query,connect:async()=>{const previous=tail;let release;tail=new Promise(r=>release=r);await previous;return {query,release};}};
 const access=createChatAccessService({getDb:()=>({pool,dbReady:true}),testBypassEnabled:true});
 const storage=createGeneralChatStorage({root:privateRoot,env});
 const docs=createChatDocumentsService({getDb:()=>({pool,dbReady:true}),accessService:access,env,client:sdk});
 const general=createGeneralChatService({storage,documents:docs,env,client:sdk});
 const source=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
 // Use the actual production construction, including encryption of idempotent reservation results.
 const construction=source.slice(source.indexOf('const chatRequestService ='),source.indexOf('const bankDebtService ='));
 const routes=source.slice(source.indexOf("  if (pathname === '/api/chat/cancel'"),source.indexOf('  if (pathname.startsWith("/api/advogados/"))'))+
   source.slice(source.indexOf("  if ((pathname === '/api/chat'"),source.indexOf('  if (pathname === "/api/admin/api-usage"'));
 const sandbox=vm.createContext({crypto:{randomUUID},Buffer,URL,AbortController,setInterval,clearInterval,createChatRequestService,
   chatAccessService:access,chatDocumentsService:docs,generalChatStorage:storage,generalChatService:general,
   getTenantIdForRequest:async req=>req.headers['x-test-owner']==='812'?{tenantId:1,user:{id:812}}:req.headers['x-test-owner']==='anonymous'?{unauthorized:true}:auth,
   readJsonBody:async req=>JSON.parse(req.body||'{}'),readBufferBody:async req=>Buffer.from(req.body||''),
   sendJson:(res,status,body)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body));},
   runChatConversation:(_req,body,a,options)=>general.run(a,body,options),
 });
 vm.runInContext(construction+`\nasync function handle(pathname,request,response){${routes}}`,sandbox);
 server=createServer(async(req,res)=>{
   try{
     const path=new URL(req.url,'http://localhost').pathname;httpCalls.push(path);
     if(path.startsWith('/api/chat')){let body='';for await(const part of req)body+=part;req.body=body;await sandbox.handle(path,req,res);return;}
     if(path.startsWith('/api/')||path==='/audit'){
       const data=path==='/api/auth/me'?{authRequired:true,user:auth.user}:path==='/api/billing/plans'?{plans:[],chatPlans:CHAT_PLANS,chatTestBypassAvailable:true}:
         path==='/api/billing/subscription'?{subscription:{planId:'standard',status:'active'}}:path.endsWith('/cases')?{cases:[]}:{};
       res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(data));return;
     }
     const file=resolve(root,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(root+'\\')&&!file.startsWith(root+'/'))throw Error('unsafe path');
     const bytes=await readFile(file);res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'})[extname(file)]||'application/octet-stream'});res.end(bytes);
   }catch(e){errors.push(e.message);if(!res.headersSent)res.writeHead(500);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 if(process.argv.includes('--serve')){
   await fetch(base+'/api/chat/test-access',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
   console.log('Fictional chat fixture for browser validation: '+base+'/#chat');
   await new Promise(()=>{});
 }
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 await mkdir('output/playwright',{recursive:true});await page.goto(base+'/#chat');
 const input=page.locator('#chatInput'),send=page.locator('#chatSendButton');
 await input.waitFor();await page.waitForFunction(()=>document.querySelector('#chatSubscriptionDialog [data-access]')?.textContent.includes('Nenhum plano'));
 assert.equal((await fetch(base+'/api/chat/test-access',{method:'POST',headers:{'content-type':'application/json','x-test-owner':'anonymous'},body:'{}'})).status,401);
 assert.equal((await fetch(base+'/api/chat/test-access',{method:'POST',headers:{'content-type':'application/json',origin:'https://other.test'},body:'{}'})).status,403);
 assert.equal((await fetch(base+'/api/chat/test-access',{method:'POST',headers:{'content-type':'text/plain'},body:'{}'})).status,415);
 const denied=await fetch(base+'/api/chat/stream',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestId:randomUUID(),messages:[{role:'user',content:'Olá'}],mode:'auto'})});
 assert.equal(denied.status,403);assert.equal(captures.length,0);
 await input.evaluate(node=>{node.value='Rascunho preservado';node.dispatchEvent(new Event('input',{bubbles:true}));});await send.click();
 await page.locator('#chatSubscriptionDialog[open] [data-test-access]').click();
 await page.locator('#chatSubscriptionDialog').waitFor({state:'hidden'});
 assert.equal(await input.inputValue(),'Rascunho preservado');assert.equal(captures.length,0,'bypass does not send the draft');
 assert.equal((await(await fetch(base+'/api/chat/access')).json()).access.test,true);
 assert.equal((await(await fetch(base+'/api/chat/access',{headers:{'x-test-owner':'812'}})).json()).access.active,false);
 assert.equal((await pg.query('SELECT count(*)::int AS n FROM audita_chat_entitlements')).rows[0].n,0);
 assert.equal((await pg.query('SELECT trial_used FROM audita_chat_accounts WHERE user_id=811')).rows[0].trial_used,false);
 assert.ok(!httpCalls.some(p=>p==='/api/billing/checkout'||p==='/api/billing/portal'),'no Stripe call for test access');
 assert.equal(await page.locator('#chatModelMode').count(),0,'model selection stays automatic without a selector');
 const ask=async text=>{await input.fill(text);await send.click();await page.locator('#chatStopButton').waitFor({state:'visible'});assert.equal(await send.isVisible(),false);await page.waitForFunction(()=>document.querySelector('#chatStopButton').hidden);assert.equal(await send.isVisible(),true);};
 await ask('Olá');assert.equal(captures.at(-1).model,'gpt-6-luna');assert.deepEqual(captures.at(-1).tools,[],'simple text needs no tools');
 assert.equal(await page.locator('#chatMessages [data-edit],.general-chat-controls').count(),0,'editing and the old toolbar are removed');
 assert.equal(await page.locator('#chatMessages [data-copy] svg,#chatMessages [data-retry] svg').count(),2,'copy and retry use icons');
 await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:base});
 await page.getByRole('button',{name:'Copiar resposta',exact:true}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'Resposta fictícia com contexto.');await page.getByRole('button',{name:'Resposta copiada',exact:true}).waitFor();
 const beforeRetry=captures.length;await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();await page.locator('#chatStopButton').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#chatSendButton').hidden);assert.equal(captures.length,beforeRetry+1,'retry sends the preceding user message');
 assert.ok(!/gpt-6/.test(await page.locator('#chatMessages').innerText()),'model names are not displayed');
 await ask('Crie PDF, HTML e CSV com estes dados');await page.locator('.general-chat-artifact').first().waitFor();
 assert.equal(captures.at(-1).model,'gpt-6.1-sol');assert.equal(await page.locator('.general-chat-artifact').count(),3);
 assert.ok(await page.locator('.chat-message-row.assistant .chat-message-content').first().evaluate(n=>n.getBoundingClientRect().width>300),'assistant content uses the full column');
 const downloaded=page.waitForEvent('download');await page.locator('.general-chat-artifact a').first().click();await(await downloaded).saveAs('output/playwright/general-chat-ui.pdf');
 assert.equal((await readFile('output/playwright/general-chat-ui.pdf')).toString('ascii',0,5),'%PDF-');
 await page.locator('.general-chat-artifact').filter({hasText:'resultado.html'}).getByRole('button',{name:'Visualizar'}).click();
 await page.locator('.general-chat-preview[open]').waitFor();assert.equal(await page.locator('.general-chat-preview iframe').getAttribute('sandbox'),'');
 assert.equal(await page.evaluate(()=>window.previewEscaped===true),false);await page.getByRole('button',{name:'Fechar prévia'}).click();
 await page.screenshot({path:'output/playwright/general-chat-desktop.png',fullPage:true});
 const callsBefore=captures.length;await page.reload();await page.locator('.general-chat-artifact').first().waitFor();assert.equal(captures.length,callsBefore);
 await ask('Use a web para pesquisar');await page.getByText('Fontes consultadas',{exact:true}).waitFor();
 await ask('Crie uma imagem');await page.locator('.general-chat-artifact img').waitFor();
 await ask('Quero o serviço do Itaú');const moduleLink=page.locator('.chat-message-body a[href$="#analise-cobrancas"]');await moduleLink.waitFor();
 assert.equal(await page.locator('#chatMessages form').count(),0);assert.ok(!httpCalls.some(p=>p.startsWith('/api/itau')||p.startsWith('/api/seller-analysis/df')));
 await page.locator('#chatAttachment').setInputFiles([{name:'documento.pdf',mimeType:'application/pdf',buffer:pdfBytes},{name:'dados.csv',mimeType:'text/csv',buffer:Buffer.from('item,valor\nTeste,100')}]);
 await input.fill('Compare os dois arquivos');await send.click();
 for(const name of ['documento.pdf','dados.csv']){await page.locator('#chatDocumentDialog[open] [data-document-name]').filter({hasText:name}).waitFor();assert.ok((await page.locator('#chatDocumentDialog [data-document-pages]').innerText()).includes('sem desconto de saldo'));await page.locator('#chatDocumentDialog [data-analyze]').click();}
 await page.locator('#chatDocumentDialog').waitFor({state:'hidden'});
 await page.waitForFunction(()=>document.querySelector('#chatStopButton').hidden);
 const payload=captures.at(-1);assert.equal(payload.input.at(-1).content.filter(p=>p.type==='input_file').length,1);assert.ok(payload.input.at(-1).content.some(p=>p.text?.includes('item,valor')));
 slowStarted=new Promise(r=>slowReady=r);await input.fill('Faça uma tarefa demorada');await send.click();await slowStarted;await page.locator('#chatStopButton').click();await page.waitForFunction(()=>document.querySelector('#chatStopButton').hidden);
 slowStarted=new Promise(r=>slowReady=r);await input.fill('Faça outra tarefa demorada');await send.click();await slowStarted;const beforeBackground=captures.length;
 await page.reload();await page.getByText('Resposta fictícia com contexto.',{exact:true}).last().waitFor();
 await page.waitForFunction(()=>!document.querySelector('#chatSendButton').disabled);assert.equal(captures.length,beforeBackground,'reload resumes without duplicating the provider');
 slowStarted=new Promise(r=>slowReady=r);await input.fill('Use a web em uma tarefa demorada');await send.click();await slowStarted;
 assert.equal(await page.locator('.general-chat-thinking').innerText(),'Pesquisando fontes na web');assert.equal(await page.locator('.general-chat-thinking').evaluate(n=>getComputedStyle(n).animationName),'none','reduced motion disables shimmer');
 await page.reload();await page.locator('#chatStopButton').waitFor({state:'visible'});assert.equal(await send.isVisible(),false);await page.locator('#chatStopButton').click();await page.waitForFunction(()=>document.querySelector('#chatStopButton').hidden);
 const threadId=(await(await fetch(base+'/api/chat/threads')).json()).threads[0].id;
 assert.equal((await fetch(base+'/api/chat/threads/'+threadId,{headers:{'x-test-owner':'812'}})).status,404);
 assert.equal((await fetch(base+'/api/chat/threads',{headers:{'x-test-owner':'anonymous'}})).status,401);
 const rows=(await pg.query("SELECT result FROM audita_chat_reservations WHERE kind='messages' AND status='completed'")).rows;
 assert.ok(rows.length>0&&rows.every(r=>r.result.encrypted),'reservation results encrypted');
 await page.setViewportSize({width:390,height:844});await page.reload();await input.waitFor();await page.waitForFunction(()=>!document.querySelector('#chatSendButton').disabled);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no mobile overflow');await page.screenshot({path:'output/playwright/general-chat-mobile.png',fullPage:true});
 assert.equal(await page.locator('#chatMessages [data-edit],.general-chat-controls').count(),0);
 assert.ok(await page.locator('#chatMessages [data-copy] svg,#chatMessages [data-retry] svg').count()>0);
 assert.ok(!/gpt-6/.test(await page.locator('#chatMessages').innerText()));
 await page.getByRole('button',{name:'Abrir conversas',exact:true}).click();await page.locator('#chatThreads.general-history-open').waitFor();
 await page.locator('[data-general-thread]').first().click();await page.waitForFunction(()=>document.querySelector('#chatHistoryButton').getAttribute('aria-expanded')==='false');
 assert.deepEqual(errors,[]);console.log('PASS: authenticated test bypass, no Stripe/grants/trial purchase; real UI/HTTP/quota/encryption; streaming, modes, documents, downloads/previews, web, image, service links, cancel, reload/background, private history; desktop/mobile.');
}catch(error){console.error('UI errors:',errors);console.error('HTTP calls:',httpCalls.slice(-30));if(browser){const page=browser.contexts()[0]?.pages()[0];if(page)console.error((await page.locator('body').innerText()).slice(-3000));}throw error;
}finally{await browser?.close();if(server)await new Promise(r=>server.close(r));await pg.close();await rm(privateRoot,{recursive:true,force:true});}
