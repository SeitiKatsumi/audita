import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('extratos preservam atendimento ao complementar e permitem voltar da oferta',async()=>{
 const elements=new Map(),listeners={};
 const element=s=>{if(!elements.has(s))elements.set(s,{innerHTML:'',setAttribute(){},insertAdjacentHTML(){}});return elements.get(s);};
 const root={querySelector:s=>s.includes('form[')?null:element(s),querySelectorAll:()=>[],setAttribute(){},addEventListener:(name,fn)=>listeners[name]=fn};
 const context=vm.createContext({document:{querySelector:()=>root,body:{dataset:{activePage:'home'}},addEventListener(){}},window:{addEventListener(){}},clearTimeout(){},setTimeout(){},location:{href:"http://localhost:3000/?debt_case=qa"},history:{replaceState(){}},URL,URLSearchParams,Intl,Date});
 vm.runInContext(await readFile(new URL('../bank-debt.js',import.meta.url),'utf8'),context);
 const html=()=>element('#debtStage').innerHTML;
 assert.match(html(),/Anexe abaixo os extratos bancários desde o início do saldo devedor até a presente data/);
 assert.equal((html().match(/type="file"/g)||[]).length,1);assert.match(html(),/Enviar extratos e analisar/);assert.doesNotMatch(html(),/Que documento você vai enviar/);
 vm.runInContext(`current={id:'qa',status:'calculation_pending',owner:true,documents:[{id:'a',kind:'evidence',name:'extrato.pdf',sha256:'same'},{id:'b',kind:'evidence',name:'copia.pdf',sha256:'same'}],documentConsent:{at:'2024-01-01'},analysisPending:new Date().toISOString()};render();`,context);
 assert.match(html(),/Seus extratos estão em análise/);assert.match(html(),/charge-analysis-loader debt-analysis-loader/);assert.doesNotMatch(html(),/type="file"|name="consent"|Anexar documento/);assert.equal((html().match(/<li>/g)||[]).length,1);
 vm.runInContext(`current.analysisProgress={percent:45,completed:5,total:10,stage:'reading'};render();`,context);
 assert.match(html(),/5 de 10 páginas lidas/);assert.match(html(),/<strong>45%<\/strong>/);assert.match(html(),/<progress max="100" value="45"/);
 vm.runInContext(`current.analysisProgress={percent:95,completed:10,total:10,stage:'calculating'};render();`,context);
 assert.match(html(),/Conferindo saldos e preparando o resultado/);assert.doesNotMatch(html(),/>100%</);
 const pending=vm.runInContext('JSON.stringify(current)',context);
 for(const state of ["analysis={bank:'Banco teste',totals:{interestCents:10000,lateCents:0},issues:[],rows:[]}","manualReview={requestedAt:'2024-01-01'}","analysisError='Falha temporária'"]){
  vm.runInContext(`current=JSON.parse(${JSON.stringify(pending)});current.analysisPending=null;current.${state};render();`,context);
  assert.equal(vm.runInContext('current.id',context),'qa');
  assert.match(html(),/role="alert"/);assert.match(html(),/arquivos estão salvos/);
  assert.match(html(),/Envie seus extratos bancários/);assert.match(html(),/type="file"/);
 }
 vm.runInContext(`current=JSON.parse(${JSON.stringify(pending)});current.analysisPending=new Date(Date.now()-16*60*1000).toISOString();delete current.documentConsent;render();`,context);
 assert.match(html(),/Tentar novamente/);assert.match(html(),/name="consent"/);assert.doesNotMatch(html(),/type="file"/);
 vm.runInContext("current.analysis={totals:{interestCents:10000},assumptions:[],issues:[],rows:[]}",context);
 vm.runInContext(`viewDocuments=false;current.analysisPending=null;current.status='offer';current.analysis.assumptions=[];current.docOffer={id:'offer',priceCents:19900,planName:'Plano de teste',range:{asOf:'2024-01-31',minCents:100000,maxCents:102000,chargedCents:120000,minReductionPercent:15,maxReductionPercent:16}};render();`,context);
 assert.doesNotMatch(html(),/debt-analysis-loader/);assert.match(html(),/Plano de teste/);assert.match(html(),/Juros identificados nos extratos/);assert.match(html(),/100,00/);assert.match(html(),/Contratar e continuar/);assert.doesNotMatch(html(),/type="file"|Enviar complemento/);
 assert.match(html(),/Voltar aos documentos/);
 listeners.click({target:{closest:()=>({dataset:{debt:'back-documents'}})}});
 assert.equal(vm.runInContext('current.id',context),'qa');assert.match(html(),/type="file"/);assert.match(html(),/Voltar à etapa anterior/);
 listeners.click({target:{closest:()=>({dataset:{debt:'return-stage'}})}});
 assert.match(html(),/Contratar e continuar/);assert.doesNotMatch(html(),/type="file"/);
 vm.runInContext("current.status='payment_pending';viewDocuments=true;render()",context);
 assert.match(html(),/pagamento pendente/);assert.doesNotMatch(html(),/type="file"/);
});
