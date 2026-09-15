import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('envio único, leitura sem anexos e complemento sem repetir autorização',async()=>{
 const elements=new Map(),listeners={};
 const element=s=>{if(!elements.has(s))elements.set(s,{innerHTML:'',setAttribute(){},insertAdjacentHTML(){}});return elements.get(s);};
 const root={querySelector:s=>s.includes('form[')?null:element(s),querySelectorAll:()=>[],setAttribute(){},addEventListener:(name,fn)=>listeners[name]=fn};
 const context=vm.createContext({document:{querySelector:()=>root,body:{dataset:{activePage:'home'}},addEventListener(){}},window:{addEventListener(){}},clearTimeout(){},setTimeout(){},URL,URLSearchParams,Intl,Date});
 vm.runInContext(await readFile(new URL('../bank-debt.js',import.meta.url),'utf8'),context);
 const html=()=>element('#debtStage').innerHTML;
 assert.match(html(),/Anexe abaixo os extratos bancários desde o início do saldo devedor até a presente data/);
 assert.equal((html().match(/type="file"/g)||[]).length,1);assert.match(html(),/Enviar extratos e analisar/);assert.doesNotMatch(html(),/Que documento você vai enviar/);
 vm.runInContext(`current={id:'qa',status:'calculation_pending',owner:true,documents:[{id:'a',kind:'evidence',name:'extrato.pdf',sha256:'same'},{id:'b',kind:'evidence',name:'copia.pdf',sha256:'same'}],documentConsent:{at:'2024-01-01'},analysisPending:new Date().toISOString()};render();`,context);
 assert.match(html(),/Seus extratos estão em análise/);assert.match(html(),/charge-analysis-loader debt-analysis-loader/);assert.doesNotMatch(html(),/type="file"|name="consent"|Anexar documento/);assert.equal((html().match(/<li>/g)||[]).length,1);
 vm.runInContext(`current.analysisPending=null;current.analysis={bank:'Banco teste',totals:{interestCents:10000,lateCents:0},issues:[{documentId:'a',message:'Página 1: saldo a conferir.'}],rows:[]};render();`,context);
 assert.equal((html().match(/type="file"/g)||[]).length,1);assert.doesNotMatch(html(),/name="consent"/);assert.match(html(),/Enviar complemento e atualizar análise/);assert.match(html(),/Ainda não representam juros abusivos confirmados/);assert.match(html(),/extrato.pdf:<\/strong> Página 1/);
 assert.match(html(),/Avançar para revisão da Audita/);assert.match(html(),/<details><summary>Adicionar documentos complementares \(opcional\)/);
 vm.runInContext(`current.manualReview={requestedAt:new Date().toISOString()};render();`,context);
 assert.match(html(),/Revisão solicitada à Audita/);assert.match(html(),/Consultar revisão/);assert.doesNotMatch(html(),/data-debt="request-review"/);
 vm.runInContext(`delete current.manualReview;`,context);
 vm.runInContext(`current.analysisError='Falha temporária';render();`,context);
 assert.match(html(),/Tentar leitura novamente/);assert.match(html(),/Avançar para revisão da Audita/);
 vm.runInContext(`current.analysisPending=new Date(Date.now()-16*60*1000).toISOString();delete current.documentConsent;render();`,context);
 assert.match(html(),/Tentar novamente/);assert.match(html(),/name="consent"/);assert.doesNotMatch(html(),/type="file"/);
 vm.runInContext(`current.analysisPending=null;current.status='offer';current.analysis.assumptions=[];current.docOffer={id:'offer',priceCents:19900,planName:'Plano de teste',range:{asOf:'2024-01-31',minCents:100000,maxCents:102000,chargedCents:120000,minReductionPercent:15,maxReductionPercent:16}};render();`,context);
 assert.doesNotMatch(html(),/debt-analysis-loader/);assert.match(html(),/Plano de teste/);assert.match(html(),/Contratar e continuar/);assert.doesNotMatch(html(),/type="file"|Enviar complemento/);
});
