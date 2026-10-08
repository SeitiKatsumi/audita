import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {createGeneralChatStorage} from '../services/general-chat-storage.service.mjs';
import {createGeneralChatService,selectChatModel,GENERAL_CHAT_MODULES} from '../services/general-chat.service.mjs';
const auth={tenantId:1,user:{id:5}},other={tenantId:1,user:{id:6}},env={AUDITA_CHAT_DOCUMENTS_ENCRYPTION_KEY:'fictitious-key-'.repeat(4)};
test('large PDFs and all eight originals reach the Python container and temporary uploads are deleted',async()=>{
 const root=await mkdtemp(join(tmpdir(),'audita-general-')),storage=createGeneralChatStorage({root,env});
 try{
  const documentIds=Array.from({length:8},(_,i)=>`doc-${i}`),uploaded=[],deleted=[];let payload;
  const sdk={files:{create:async({file,purpose})=>{assert.equal(purpose,'user_data');uploaded.push(file.name);return {id:`file-${uploaded.length}`};},delete:async id=>deleted.push(id)},responses:{create:async p=>{payload=p;return (async function*(){yield {type:'response.completed',response:{status:'completed',output_text:'Dados conferidos.',output:[]}};})();}}};
  const service=createGeneralChatService({storage,env,client:sdk,documents:{getInput:async(a,id)=>{assert.equal(a,auth);return {fileName:id+'.pdf',mime:'application/pdf',pages:id==='doc-0'?241:1,buffer:Buffer.from('fictional original'),summary:'Reference only'};}}});
  const body={threadId:randomUUID(),requestId:randomUUID(),messages:[{role:'user',content:'Compare todos os documentos'}],documentIds};
  await service.run(auth,body);
  assert.equal(uploaded.length,8);assert.equal(payload.input.at(-1).content.filter(p=>p.type==='input_file').length,0);
  assert.deepEqual(payload.tools.find(t=>t.type==='code_interpreter').container.file_ids,deleted);
  assert.equal(deleted.length,8);assert.deepEqual((await storage.getThread(auth,body.threadId)).messages[0].documentIds,documentIds);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('general chat streams hosted tools, preserves files/history privately and only links services',async()=>{
 const root=await mkdtemp(join(tmpdir(),'audita-general-'));const storage=createGeneralChatStorage({root,env});
 try{
 const pdf=await PDFDocument.create();pdf.addPage();const bytes=Buffer.from(await pdf.save());
 const captures=[];let calls=0;
 const sdk={responses:{create:async(payload)=>{captures.push(payload);calls++;return (async function*(){
   yield {type:'response.web_search_call.searching'};yield {type:'response.output_text.delta',delta:'Relatório concluído.'};
   yield {type:'response.completed',response:{status:'completed',usage:{input_tokens:15,output_tokens:5},output:[{type:'message',content:[{type:'output_text',text:'Relatório concluído.',annotations:[
     {type:'url_citation',title:'Fonte',url:'https://example.test/source'},
     {type:'container_file_citation',container_id:'cntr_fake',file_id:'file_fake',filename:'relatorio.pdf'}]}]}]}};
 })();}},containers:{files:{content:{retrieve:async()=>new Response(bytes)}}}};
 const service=createGeneralChatService({storage,documents:{getInput:()=>{throw Error('No document expected');}},client:sdk,env});
 const body={threadId:randomUUID(),requestId:randomUUID(),messages:[{role:'user',content:'Crie um relatório PDF.'}],documentIds:[],mode:'auto'};
 const events=[];const result=await service.run(auth,body,{onEvent:e=>events.push(e)});
 assert.equal(result.model,'gpt-6.1-sol');assert.equal(events.find(e=>e.type==='delta').text,'Relatório concluído.');
 assert.deepEqual(captures[0].tools.map(t=>t.type),['web_search','code_interpreter','image_generation']);
 assert.ok(GENERAL_CHAT_MODULES.every(m=>m.url.startsWith('/#')));assert.deepEqual(result.actions,[]);
 assert.equal(result.artifacts.length,1);assert.equal((await storage.getArtifact(auth,result.artifacts[0].id)).buffer.toString('ascii',0,5),'%PDF-');
 await assert.rejects(storage.getArtifact(other,result.artifacts[0].id),{code:'not_found'});
 await assert.rejects(storage.getThread(other,body.threadId),{code:'not_found'});
 const encoded=await readFile(join(root,'1-5','threads',body.threadId+'.enc'),'utf8');assert.ok(!encoded.includes('Relatório'));
 const sealed=storage.sealResult(auth,body.requestId,result);assert.ok(!JSON.stringify(sealed).includes('Relatório'));
 assert.equal(storage.openResult(auth,body.requestId,sealed).answer,result.answer);
 assert.throws(()=>storage.openResult(other,body.requestId,sealed));
 assert.equal((await service.getThread(auth,body.threadId)).messages.length,2);
 await service.run(auth,body);assert.equal(calls,1,'Saved request never runs a second provider call');
 const next={...body,requestId:randomUUID(),messages:[{role:'user',content:'Qual era o resultado?'}]};
 await service.run(auth,next);assert.equal(captures[1].input[0].content,body.messages[0].content);
 await storage.deleteThread(auth,body.threadId);assert.deepEqual(await storage.listThreads(auth),[]);
 await assert.rejects(storage.getArtifact(auth,result.artifacts[0].id),{code:'not_found'});
 }finally{await rm(root,{recursive:true,force:true});}
});

test('owner scoped cancel, background resume and failure do not pretend completion',async()=>{
 const root=await mkdtemp(join(tmpdir(),'audita-general-'));const storage=createGeneralChatStorage({root,env});
 try{
 let ready;const started=new Promise(r=>ready=r);
 const sdk={responses:{create:async(_,options)=>{ready();return (async function*(){await new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Object.assign(new Error('Cancelled'),{name:'AbortError'})),{once:true}));})();}}};
 const service=createGeneralChatService({storage,documents:{},client:sdk,env});
 const body={threadId:randomUUID(),requestId:randomUUID(),messages:[{role:'user',content:'Olá'}],documentIds:[],mode:'quick'};
 const running=service.run(auth,body);await started;
 assert.equal((await service.getThread(auth,body.threadId)).processing.status,'running');
 assert.equal(service.cancel(other,body).cancelled,false);assert.equal(service.cancel(auth,body).cancelled,true);
 await assert.rejects(running,{name:'AbortError'});
 const saved=await service.getThread(auth,body.threadId);assert.equal(saved.processing.status,'cancelled');assert.equal(saved.messages.length,0);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('quick mode is economical and documents/deep work use Sol automatically',()=>{
 assert.equal(selectChatModel({message:'Olá'}),'gpt-6-luna');
 assert.equal(selectChatModel({message:'Compare estes contratos'}),'gpt-6.1-sol');
 assert.equal(selectChatModel({message:'Oi',documents:1}),'gpt-6.1-sol');
 assert.equal(selectChatModel({mode:'deep'}),'gpt-6.1-sol');
 assert.equal(selectChatModel({mode:'quick',message:'Analise'}),'gpt-6-luna');
});
