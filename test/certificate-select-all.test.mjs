import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('Brazil package selects CADIN and other data sources after rendering; clear removes every selection',async()=>{
 const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
 const start=source.indexOf('for (const [id, checked] of [["sellerAnalysisSelectAll"');
 const end=source.indexOf('loadSellerCoverage();',start);
 assert.ok(start>0&&end>start);
 const handlers={},states=Array.from({length:27},()=>({checked:false}));
 let queries=[],quotes=[];
 const context={document:{
   getElementById:id=>({addEventListener:(_,fn)=>{handlers[id]=fn;}}),
   querySelectorAll:selector=>selector==='#sellerAnalysisUfs input'?states:queries,
 },isCertificateOnly:()=>true,
 renderCertificateChoices:()=>{queries=states.some(s=>s.checked)?[
   {id:'to-debt',checked:true},{id:'go-cadin',checked:false},
   {id:'rs-cadin',checked:false},{id:'sp-cadin',checked:false},
 ]:[];},
 updateSellerEstimate:()=>quotes.push(queries.filter(q=>q.checked).map(q=>q.id))};
 vm.runInNewContext(source.slice(start,end),context);
 handlers.sellerAnalysisSelectAll();
 assert.ok(states.every(s=>s.checked));
 assert.deepEqual(quotes.at(-1),['to-debt','go-cadin','rs-cadin','sp-cadin']);
 queries[2].checked=false;
 handlers.sellerAnalysisSelectAll();
 assert.ok(queries.every(q=>q.checked));
 handlers.sellerAnalysisClearAll();
 assert.ok(states.every(s=>!s.checked));assert.deepEqual(quotes.at(-1),[]);
});
