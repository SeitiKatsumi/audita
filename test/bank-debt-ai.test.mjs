import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {createDebtExtractor} from '../services/bank-debt-ai.mjs';

const env={OPENAI_API_KEY:'fictitious-key'};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const amount=n=>(n/100).toFixed(2).replace('.',',')+'-';
function page(i){
 const date=`2024-01-${String(i+1).padStart(2,'0')}`;
 return {bank:'Banco fictício',accountKey:'conta-teste',person:'pf',modality:'overdraft',unreadable:[],rows:[
  {date,type:'opening',description:'SALDO ANTERIOR',amountText:amount(1000+i*100),rateText:null},
  {date,type:'transaction',description:'ENC LIM CREDITO',amountText:'1,00-',rateText:null},
  {date,type:'balance',description:'SALDO EM',amountText:amount(1100+i*100),rateText:null},
 ]};
}
async function document(count){const pdf=await PDFDocument.create();for(let i=0;i<count;i++)pdf.addPage();return {mime:'application/pdf',bytes:Buffer.from(await pdf.save()),sha256:`fictitious-${count}`};}
const response=data=>({status:'completed',output_text:JSON.stringify(data)});
const pageIndex=input=>Number(input.input[1].content[0].text.match(/Página física (\d+)/)[1])-1;

test('parallel reads stay ordered, cap API concurrency across cases, and reuse cached pages without tokens',async()=>{
 let active=0,maximum=0,calls=0,cache;const progress=[];
 const extract=createDebtExtractor({env,client:{responses:{create:async input=>{
  calls++;active++;maximum=Math.max(maximum,active);const i=pageIndex(input);
  try{await pause(i%2?5:20);return response(page(i));}finally{active--;}
 }}}});
 const doc=await document(6);
 const [result]=await Promise.all([
  extract(doc,null,{saveCache:async value=>{cache=structuredClone(value);},onProgress:async value=>{progress.push(value.completed);}}),
  extract({...doc,sha256:'other-case'},null),
 ]);
 assert.equal(maximum,3);assert.equal(calls,12);assert.equal(active,0);
 assert.deepEqual(result.entries.map(r=>r.page),[1,2,3,4,5,6]);assert.equal(result.closing.balanceCents,-1600);
 assert.deepEqual(progress,[0,1,2,3,4,5,6,6]);
 const reused=await extract(doc,null,{cache});assert.deepEqual(reused,result);assert.equal(calls,12);
 await extract({...doc,sha256:'changed-file'},null,{cache});assert.equal(calls,18);
 const differentModel=createDebtExtractor({env:{...env,AUDITA_DEBT_MODEL:'test-model'},client:{responses:{create:async input=>{calls++;return response(page(pageIndex(input)));}}}});
 await differentModel(doc,null,{cache});assert.equal(calls,24);
});

test('a failed page preserves other completed pages and drains requests before retry',async()=>{
 let fail=true,cache,calls=0,active=0;
 const extract=createDebtExtractor({env,client:{responses:{create:async input=>{
  const i=pageIndex(input);calls++;active++;
  try{await pause(i===1?5:15);if(fail&&i===1)throw new Error('simulated outage');return response(page(i));}finally{active--;}
 }}}});
 const doc=await document(3),saveCache=async value=>{cache=structuredClone(value);};
 await assert.rejects(extract(doc,null,{saveCache}),{status:503});
 assert.equal(active,0);assert.equal(Object.keys(cache.pages).length,2);assert.equal(calls,3);
 fail=false;const result=await extract(doc,null,{cache,saveCache});assert.equal(calls,4);assert.equal(result.entries.length,3);
});

test('only missing dates are reread with prior-page context, preserving financial rows',async()=>{
 let calls=0;
 const extract=createDebtExtractor({env,client:{responses:{create:async input=>{
  calls++;const i=pageIndex(input),result=page(i),prompt=input.input[1].content[0].text;
  if(i===1&&!prompt.includes('Data anterior: 2024-01-01'))result.rows.forEach(r=>{r.date=null;});
  return response(result);
 }}}});
 const result=await extract(await document(2),null);
 assert.equal(calls,3);assert.equal(result.entries.length,2);assert.equal(result.entries[1].date,'2024-01-02');
 assert.equal(result.extractionAudit[0].accepted,true);assert.equal(result.checkpoints.length,0);
});
