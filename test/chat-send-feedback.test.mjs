import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {EXAM_ANALYSIS_PROMPT,examChatEntry} from '../general-chat.js';
const source=await readFile(new URL('../general-chat.js',import.meta.url),'utf8');
function fixture(analyzeDocument){
 const frames=[];let counter=0, calls=0;
 const c={exams:false,EXAM_ANALYSIS_PROMPT,historyKey:id=>'history:'+id,examConsent:{checked:false,focus(){}},attach:{focus(){}},input:{value:'Leia o documento',dispatchEvent(){}},fileInput:{value:'attachment'},files:[{name:'example.pdf'}],thread:{id:'thread',messages:[]},threads:[],active:null,version:1,
 current:()=>true,account:()=> 'owner',uuid:()=>`id-${++counter}`,AbortController,Event,
 subscription:{ensureAccess:async()=>true,analyzeDocument,refresh:async()=>{},handleAccessError:()=>false},
 showError(message){c.error=message},render(){frames.push({input:c.input.value,messages:c.thread.messages.map(m=>({...m})),status:c.active?.status})},remember(){},
 fetch:async()=>{calls++;return new Response('data: '+JSON.stringify({type:'completed',result:{answer:'Done'}})+'\n\n')},TextDecoder, messages:{querySelector:()=>null},Date,JSON};
 runInNewContext(source.slice(source.indexOf(' async function sendMessage('),source.indexOf(" form.addEventListener('submit'",source.indexOf(' async function sendMessage(')))+';this.send=sendMessage;',c);
 return {c,frames,calls:()=>calls};
}
test('message and filenames appear and composer clears before document reading finishes',async()=>{
 let release;const waiting=new Promise(r=>release=r);const {c,frames,calls}=fixture(()=>waiting);
 const sent=c.send();await new Promise(r=>setImmediate(r));
 assert.equal(c.input.value,'');assert.equal(c.thread.messages.length,1);assert.equal(c.thread.messages[0].content,'Leia o documento');assert.equal(c.thread.messages[0].fileNames[0],'example.pdf');assert.equal(calls(),0);
 await c.send('duplicate');assert.equal(c.thread.messages.length,1);
 release({id:'doc'});await sent;assert.equal(calls(),1);assert.equal(c.thread.messages.length,2);assert.equal(c.thread.messages[0].documentIds[0],'doc');assert.ok(frames.some(f=>f.status==='Lendo example.pdf'&&f.messages.length===1));
});
test('exam entry requires an attachment and explicit consent before any analysis',async()=>{
 const {c,calls}=fixture(async()=>{throw Error('should not run')});c.exams=true;c.files=[];
 await c.send();assert.match(c.error,/Anexe pelo menos/);assert.equal(calls(),0);
 c.files=[{name:'exame.pdf'}];await c.send();assert.match(c.error,/autorização/);assert.equal(calls(),0);
 assert.equal(c.thread.messages.length,0);
});
test('exam chat analyzes multiple files with medical limits and allows follow-up',async()=>{
 const {c,calls}=fixture(async f=>({id:f.name}));c.exams=true;c.examConsent.checked=true;c.files=[{name:'exame.pdf'},{name:'foto.jpg'}];
 await c.send('');assert.equal(calls(),1);assert.equal(c.thread.documentIds.length,2);
 assert.match(c.thread.messages[0].content,/não um laudo médico/);
 assert.match(c.thread.messages[0].content,/Não prescreva/);
 await c.send('Explique o primeiro resultado');assert.equal(calls(),2);
 assert.equal(examChatEntry('?service=exames'),true);assert.equal(examChatEntry('?service=other'),false);
});
test('failed reading restores pending attachment and original text for retry',async()=>{
 const {c,calls}=fixture(async()=>{throw Error('Reading failed')});await c.send();
 assert.equal(c.input.value,'Leia o documento');assert.equal(c.files[0].name,'example.pdf');assert.equal(c.thread.messages.length,0);assert.equal(calls(),0);assert.equal(c.error,'Reading failed');
});
test('failure preserves a new draft and does not requeue previously read files',async()=>{
 const {c}=fixture(async file=>{if(file.name==='first.pdf')return {id:'first'};c.input.value='Meu próximo texto';throw Error('failed')});
 c.files.unshift({name:'first.pdf'});await c.send();assert.equal(c.input.value,'Meu próximo texto');assert.equal(c.files.length,1);assert.equal(c.files[0].name,'example.pdf');assert.equal(c.thread.documentIds[0],'first');
});
const subscription=await readFile(new URL('../chat-subscription.js',import.meta.url),'utf8');
test('document failure exposes safe reason and code, never raw server text',async()=>{
 const c={fetch:async()=>({ok:false,status:503,json:async()=>({error:'unavailable',message:'private server details'})})};
 runInNewContext(subscription.slice(subscription.indexOf('  async function request('),subscription.indexOf('  function catalogPlan('))+';this.request=request;',c);
 await assert.rejects(c.request('/api/chat/documents/prepare',{}),e=>e.code==='unavailable'&&e.message.includes('armazenamento seguro')&&!e.message.includes('private'));
});
