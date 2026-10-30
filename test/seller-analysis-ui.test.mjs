import {certificateSelection,certificateQuote,serviceCertificateSelection} from '../certificate-selection.js';
import {processNumbers} from '../judicial-processes.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");

test('certificate stage offers general or individual analysis, sends the selected scope and opens saved reports without AI', async () => {
  const sent=[],opened=[],stored=new Map();
  const submit={disabled:false},error={textContent:''},back={};
  const form={elements:{purpose:{value:''},consent:{checked:true}},reportValidity:()=>true,querySelector:selector=>selector==='[type="submit"]'?submit:error};
  const mode={value:'document'},source={value:'seller_documents:1'},saved={dataset:{certificateSaved:'all'}};
  const target={innerHTML:'',querySelector:selector=>selector==='[data-certificate-back]'?back:selector==='[data-certificate-analysis-form]'?form:null,querySelectorAll:selector=>selector.includes('analysis-mode')?[mode]:selector.includes('analysis-source')?[source]:selector==='[data-certificate-saved]'?[saved]:[]};
  const context=vm.createContext({escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),isCertificateOnly:()=>true,
    sessionStorage:{setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},loadSellerReview:async(id,key)=>opened.push([id,key]),fetch:async(url,options)=>{sent.push(JSON.parse(options.body));return {ok:true,json:async()=>({})};},sellerReviewRun:0,setSellerStep:step=>opened.push(step)});
  vm.runInContext(appJs.slice(appJs.indexOf('function renderSellerReview('),appJs.indexOf('function validateCnibDocument(')),context);
  const state={analysisKey:'seller_documents:0',status:'completed',aiReady:true,canAnalyze:true,customPurpose:false,documents:[{id:'seller_documents:0',status:'success',title:'Certidão <fictícia>',hasPdf:true,scope:'Brasil'},{id:'seller_documents:1',status:'success',title:'Consulta fictícia',hasPdf:false,scope:'Brasil'},{id:'seller_documents:2',status:'failed',title:'Falha',scope:'DF'}],savedAnalyses:[{key:'all',title:'Análise geral'}],report:{analyzed:1,total:1,executiveSummary:'Resumo <seguro>\n\nSegundo parágrafo.',findings:[],sources:[]}};
  context.renderSellerReview(target,'test-id',state);
  assert.match(target.innerHTML,/Análise IA/);assert.match(target.innerHTML,/Resultado em texto/);assert.match(target.innerHTML,/Indisponível para análise/);
  assert.match(target.innerHTML,/Opcional/);assert.match(target.innerHTML,/id="certificateAnalysisPurpose"/);
  assert.match(target.innerHTML,/report\.pdf\?analysis=seller_documents%3A0/);
  assert.match(target.innerHTML,/<p>Resumo &lt;seguro&gt;<\/p><p>Segundo parágrafo\.<\/p>/);
  saved.onclick();source.onchange();
  assert.equal(sent.length,0,'changing scope or opening saved results only fetches the saved review');
  assert.deepEqual(opened.slice(0,2),[['test-id','all'],['test-id','seller_documents:1']]);
  await form.onsubmit({preventDefault(){}});
  assert.deepEqual(sent[0],{consent:true,purpose:'',analysisMode:'document',sourceId:'seller_documents:0'});
  context.renderSellerReview(target,'test-id',{...state,analysisKey:'all',report:null});
  await form.onsubmit({preventDefault(){}});
  assert.deepEqual(sent[1],{consent:true,purpose:'',analysisMode:'general'});
  back.onclick();assert.equal(opened.at(-1),2);assert.equal(stored.size,0);
});

test('completed seller reports show numeric score, all three bands and the private PDF link; unfinished reviews do not show a score', () => {
  const code=appJs.slice(appJs.indexOf('function renderSellerReview('),appJs.indexOf('function validateCnibDocument('));
  const context=vm.createContext({escapeHtml:value=>String(value),isCertificateOnly:()=>false,sellerAvailableProcessNumbers:[]});
  vm.runInContext(code,context);
  for(const [value,band] of [[100,'green'],[70,'yellow'],[40,'red'],[null,'yellow']]) {
    const target={innerHTML:'',querySelector:()=>null};
    context.renderSellerReview(target,'test-id',{status:'completed',report:{conclusion:'Análise fictícia',analyzed:1,findings:[],sources:[],safetyScore:{value,band,label:'Teste',limited:value===null}}});
    assert.match(target.innerHTML,new RegExp(`seller-safety-score--${band}`));
    assert.ok(target.innerHTML.includes(value===null?'—':String(value)));
    assert.match(target.innerHTML,/Baixar relatório completo em PDF/);
    assert.match(target.innerHTML,/não é score de crédito nem garantia/);
    assert.match(target.innerHTML,/Como calculamos o score/);
  }
  const target={innerHTML:'',querySelector:()=>null};
  context.renderSellerReview(target,'test-id',{status:'running',progress:50});
  assert.doesNotMatch(target.innerHTML,/seller-safety-score/);
});

test("seller analysis is available in the property category of the service catalog", () => {
  assert.match(indexHtml, /data-service-card data-categories="imoveis"[^>]*>\s*<a class="service-card-entry" href="#analise-vendedor"/);
  assert.match(indexHtml, /<strong>Análise de Vendedor<\/strong>/);
});

test("seller analysis route opens its introductory screen", () => {
  assert.match(indexHtml, /id="analise-vendedor" data-page="analise-vendedor emissao-certidoes"/);
  assert.match(indexHtml, /certidões e consultas do vendedor pessoa física ou empresa nas fontes habilitadas/);
  assert.match(indexHtml, /Coleta de dados/);
  assert.match(indexHtml, /relatório em PDF com evidências e próximos passos/);
  assert.match(indexHtml, /id="sellerAnalysisState"/);
  assert.match(appJs, /"analise-vendedor":\s*\{/);
});

test("seller analysis selects validated states with cost and legal consent", () => {
  assert.match(indexHtml, /id="sellerAnalysisForm"/);
  assert.match(indexHtml, /id="sellerAnalysisCpf"/);
  assert.match(indexHtml, /id="sellerAnalysisFullName"/);
  assert.match(indexHtml, /id="sellerAnalysisMotherField"/);
  assert.doesNotMatch(indexHtml, /id="sellerAnalysisFatherName"/);
  assert.match(indexHtml, /id="sellerAnalysisAuthorization"/);
  assert.match(indexHtml, /Fal&ecirc;ncia e Recupera&ccedil;&atilde;o Judicial/);
  assert.match(indexHtml, /id="sellerAnalysisUfs"/);
  assert.match(indexHtml, /id="sellerAnalysisQueries"/);
  assert.match(indexHtml, /id="sellerAnalysisCompanyCnpjs"/);
  assert.doesNotMatch(indexHtml, /id="sellerAnalysisPaid"/);
  assert.match(indexHtml, /id="sellerAnalysisAiConsent"/);
  assert.match(appJs, /\/api\/seller-analysis\/coverage/);
  assert.match(appJs, /motherNameRequired/);
  assert.match(appJs, /role="progressbar"/);
  assert.match(appJs, /uma falha não interrompe as demais consultas/);
  assert.match(appJs, /Sem avanço há/);
  assert.match(appJs, /renderSellerAnalysisFailure/);
});

test("certificate groups show applicable sources, 30x prices and only required identity", async () => {
  const elements=new Map(["#sellerAnalysisCoverage","#sellerAnalysisUfs","#sellerAnalysisQueries","#sellerAnalysisCost","#sellerAnalysisBirthDate","#sellerAnalysisRg","#sellerAnalysisGender","#sellerAnalysisDocumentType","#sellerBirthDateField","#sellerRgField","#sellerGenderField","#sellerFullNameField","#sellerAnalysisMotherField"].map(s=>[s,{innerHTML:'',value:'',required:false}]));
  elements.get('#sellerAnalysisDocumentType').value='cpf';
  const selected={ufs:[],queries:[],courts:[]};
  const context=vm.createContext({certificateSelection,certificateQuote,serviceCertificateSelection,isNationalProcessPage:()=>false,isCertificateOnly:()=>true,updateSellerMunicipalities:()=>{},
    document:{querySelector:s=>elements.get(s),querySelectorAll:s=>(s.includes('sellerAnalysisUfs')?selected.ufs:s.includes('data-certificate-court')?selected.courts:selected.queries).map(value=>({value}))},
    sellerAnalysisMotherName:{required:false,value:''},sellerAnalysisFullName:{required:false,value:''},sellerAnalysisCpf:{value:'04252011000110'},sellerAnalysisError:null,sellerAnalysisSubmit:{disabled:false,textContent:''},
    location:{search:''},sessionStorage:{getItem:()=>null},escapeHtml:v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),
    fetch:async()=>({ok:true,json:async()=>({certificatePriceMultiplier:30,officialPortals:[{uf:'AP',stateName:'Amapá',url:'https://www.tjap.jus.br/'}],states:[{uf:'AP',name:'Amapá',queryIds:['fiscal','ccd','protestos','cadin']}],companyStates:[{uf:'AP',name:'Amapá',queryIds:['fgts']}],certificates:[{uf:'AP',type:'Cível',provider:'direct_data',documentTypes:['cpf','cnpj'],requiredIdentityFields:['birthDate','rg']},{uf:'AP',type:'Criminal',provider:'direct_data',requiredIdentityFields:['gender']}],sellerSources:{configured:true,queries:[
      {id:'protestos',kind:'data',category:'Protestos',label:'Protestos',costBrl:3.5,documentTypes:['cpf'],scope:'Brasil',params:{}},
      {id:'cadin',kind:'data',includePdf:true,category:'CADIN',label:'CADIN',costBrl:.54,documentTypes:['cpf'],scope:'AP',params:{}},
      {id:'fiscal',kind:'certificate',category:'Fiscal',label:'Fiscal',costBrl:.54,documentTypes:['cpf'],scope:'AP',params:{},limitation:'Não inclui <dívida ativa>'},
      {id:'ccd',kind:'certificate',category:'Fiscal',label:'CND conjunta',endpoint:'CertidaoConjuntaDebitosPessoaFisica',costBrl:.54,documentTypes:['cpf'],scope:'Brasil',params:{}},
      {id:'fgts',kind:'certificate',category:'Empresa',label:'FGTS',costBrl:.54,documentTypes:['cnpj'],scope:'Brasil',params:{}}
    ]}})})});
  const start=appJs.indexOf('let sellerCoverage = null;'),end=appJs.indexOf('document.querySelector("#sellerAnalysisUfs")?.addEventListener',start);
  vm.runInContext(appJs.slice(start,end),context);await context.loadSellerCoverage();
  assert.match(elements.get('#sellerAnalysisQueries').innerHTML,/Escolha os estados/);
  selected.ufs=['AP'];selected.courts=['AP:Cível'];selected.queries=['fiscal','ccd'];context.renderCertificateChoices();context.updateSellerEstimate();
  assert.match(elements.get('#sellerAnalysisQueries').innerHTML,/<details open>/);assert.match(elements.get('#sellerAnalysisQueries').innerHTML,/Não inclui &lt;dívida ativa&gt;/);
  assert.match(elements.get('#sellerAnalysisQueries').innerHTML,/Complementar certidões nos portais oficiais/);
  assert.match(elements.get('#sellerAnalysisQueries').innerHTML,/href="https:\/\/www.tjap.jus.br\/" target="_blank" rel="noopener noreferrer"/);
  assert.match(elements.get('#sellerAnalysisCost').innerHTML,/R\$ 48,60/);
  assert.doesNotMatch(elements.get('#sellerAnalysisCost').innerHTML,/custo do provedor|carteira existente|bypass|continuar sem pagar/i);
  for(const selector of ['#sellerAnalysisBirthDate','#sellerAnalysisRg','#sellerAnalysisGender'])assert.equal(elements.get(selector).required,false,'identity is enriched before requesting manual input');
  for(const selector of ['#sellerBirthDateField','#sellerRgField','#sellerGenderField','#sellerFullNameField','#sellerAnalysisMotherField'])assert.equal(elements.get(selector).hidden,true);
  vm.runInContext("sellerMissingIdentityFields=new Set(['rg'])",context);context.updateSellerEstimate();
  assert.equal(elements.get('#sellerAnalysisRg').required,true);assert.equal(elements.get('#sellerRgField').hidden,false);
  assert.equal(elements.get('#sellerBirthDateField').hidden,true);assert.equal(elements.get('#sellerAnalysisMotherField').hidden,true);
  vm.runInContext('sellerMissingIdentityFields.clear()',context);
  assert.equal(elements.get('#sellerAnalysisGender').required,false);
  assert.match(elements.get('#sellerAnalysisQueries').innerHTML,/Consulta de dados — sem PDF oficial/);
  assert.match(elements.get('#sellerAnalysisQueries').innerHTML,/Comprovante de consulta em PDF/);
  assert.doesNotMatch(elements.get('#sellerAnalysisQueries').innerHTML,/value="(?:protestos|cadin)" checked/);
  selected.queries=['protestos','cadin'];selected.courts=[];context.updateSellerEstimate();
  assert.match(elements.get('#sellerAnalysisCost').innerHTML,/R\$ 51,20/);
  vm.runInContext('sellerCoverage.certificateSubscriber=true',context);context.updateSellerEstimate();
  assert.match(elements.get('#sellerAnalysisCost').innerHTML,/R\$ 35,84/);assert.match(elements.get('#sellerAnalysisCost').innerHTML,/30% de desconto/);
  vm.runInContext('sellerCoverage.certificateComplimentary=true;sellerCoverage.certificateCheckoutReady=false',context);context.updateSellerEstimate();
  assert.match(elements.get('#sellerAnalysisCost').innerHTML,/<strong>R\$ 35,84<\/strong>/,'individual release must preserve the subscriber quote');
  assert.match(elements.get('#sellerAnalysisCost').innerHTML,/pagamento dispensado/);
  assert.equal(context.sellerAnalysisSubmit.textContent,'Continuar');
  assert.doesNotMatch(elements.get('#sellerAnalysisCost').innerHTML,/Pagamento indisponível/,'individual release does not require checkout');
  vm.runInContext('sellerCoverage.certificateSubscriber=false',context);context.updateSellerEstimate();
  assert.match(elements.get('#sellerAnalysisCost').innerHTML,/<strong>R\$ 51,20<\/strong>/,'individual release must preserve the regular quote');
  selected.queries=['cadin'];context.updateSellerEstimate();
  assert.match(elements.get('#sellerAnalysisCost').innerHTML,/<strong>R\$ 16,20<\/strong>/,'changing the selection must update the released quote');
  selected.queries=['protestos','cadin'];
  vm.runInContext('sellerCoverage.certificateComplimentary=false;sellerCoverage.certificateTestBypassEnabled=true',context);context.updateSellerEstimate();
  assert.match(elements.get('#sellerAnalysisCost').innerHTML,/<strong>R\$ 51,20<\/strong>/,'test bypass must preserve the regular quote');
  assert.equal(context.sellerAnalysisSubmit.textContent,'Continuar para pagamento');
  assert.doesNotMatch(elements.get('#sellerAnalysisCost').innerHTML,/bypass|teste/i);
  assert.match(elements.get('#sellerAnalysisCost').innerHTML,/Pagamento temporariamente indisponível/);
  vm.runInContext('sellerCoverage.certificateCheckoutReady=true;sellerCoverage.certificateTestBypassEnabled=false',context);
  vm.runInContext('sellerCoverage.certificateSubscriber=false',context);
  assert.equal(elements.get('#sellerAnalysisBirthDate').required,false);
  selected.courts=['AP:Cível'];
  assert.equal(JSON.stringify(context.selectedSellerCertificates().map(c=>c.uf+':'+c.type)),JSON.stringify(['AP:Cível']));
  selected.queries=[];context.updateSellerEstimate();assert.match(elements.get('#sellerAnalysisCost').innerHTML,/1 fontes selecionadas/);assert.match(elements.get('#sellerAnalysisCost').innerHTML,/R\$ 16,20/);
  selected.courts=[];context.updateSellerEstimate();assert.match(elements.get('#sellerAnalysisCost').innerHTML,/R\$ 0,00/);assert.equal(elements.get('#sellerAnalysisRg').required,false);
  elements.get('#sellerAnalysisDocumentType').value='cnpj';selected.queries=['fgts'];context.renderCertificateChoices();context.updateSellerEstimate();
  assert.match(elements.get('#sellerAnalysisCost').innerHTML,/R\$ 16,20/);assert.doesNotMatch(elements.get('#sellerAnalysisQueries').innerHTML,/value="fiscal"/);
  assert.equal(elements.get('#sellerAnalysisBirthDate').required,false);assert.equal(elements.get('#sellerAnalysisRg').required,false);
  selected.courts=['AP:Cível'];context.updateSellerEstimate();
  assert.equal(context.selectedSellerCertificates().length,1,'company court selection reaches the quote');
  assert.match(elements.get('#sellerAnalysisCost').innerHTML,/R\$ 32,40/);
  assert.doesNotMatch(elements.get('#sellerAnalysisQueries').innerHTML,/value="AP:Criminal"/,'PF-only certificates do not appear for CNPJ');
  assert.equal(elements.get('#sellerAnalysisBirthDate').required,false);
  elements.get('#sellerAnalysisDocumentType').value='cpf';selected.ufs=[];selected.queries=[];selected.courts=[];context.updateSellerEstimate();
  assert.equal(elements.get('#sellerAnalysisBirthDate').required,false);assert.equal(elements.get('#sellerAnalysisRg').required,false);
});

test('Brazil package explicitly selects all displayed data queries; clear removes every selection',()=>{
  const handlers={},ufs=[{checked:false}],queries=[{checked:true},{checked:false}];
  const context=vm.createContext({document:{getElementById:id=>({addEventListener:(_,fn)=>handlers[id]=fn}),querySelectorAll:s=>s.includes('Ufs')?ufs:queries},isCertificateOnly:()=>true,renderCertificateChoices:()=>{queries[0].checked=true;queries[1].checked=false;},updateSellerEstimate:()=>{}});
  const start=appJs.indexOf('for (const [id, checked] of [["sellerAnalysisSelectAll"'),end=appJs.indexOf('loadSellerCoverage();',start);
  vm.runInContext(appJs.slice(start,end),context);handlers.sellerAnalysisSelectAll();
  assert.equal(ufs[0].checked,true);assert.deepEqual(queries.map(q=>q.checked),[true,true]);
  handlers.sellerAnalysisClearAll();assert.equal(ufs[0].checked,false);assert(queries.every(q=>!q.checked));
});

test("seller results preserve every source, private PDF indices and pending queries", () => {
  const result = { innerHTML: "" };
  const context = vm.createContext({
    sellerAnalysisResult: result, Date, Number, encodeURIComponent, isCertificateOnly:()=>false,processNumbers,sellerAvailableProcessNumbers:[],
    document:{querySelector:()=>null},
    escapeHtml: (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"),
    selectedSellerCertificates: () => [], selectedSellerQueries: () => [], sellerCompanyCnpjs: () => [],
  });
  const start = appJs.indexOf("function getSellerCertificateStatus(");
  const end = appJs.indexOf("async function loadSellerAnalysisResult(", start);
  vm.runInContext(appJs.slice(start, end), context);
  const audit = {
    consultaId: "12345678-1234-1234-1234-123456789012", status: "partial", documento: "529********25",
    resultados: [
      { fonte: "tjdft", status: "success", dados: { progress: { stage: "completed" }, certidoes: [{ tipo: "Estadual", status: "success", pdfPath: "private-state.pdf" }] } },
      { fonte: "seller_sources", status: "running", dados: { certidoes: [
        { tipo: "Fiscal indisponível", status: "failed" },
        { tipo: "Cadastro CNPJ", kind: "data", status: "success", resultado: "nada_consta", details: { Razão: "<script>test</script>" } },
        { tipo: "Certidão nacional", status: "pending" },
      ] } },
    ],
  };
  context.renderSellerAnalysisResult(audit);
  assert.equal(context.sellerAnalysisFinished(audit), false, "one completed source must not stop polling");
  assert.match(result.innerHTML, /Consultando/);
  assert.match(result.innerHTML, /Consulta concluída/);
  assert.match(result.innerHTML, /Na fila/);
  assert.doesNotMatch(result.innerHTML, /Não extraída/);
  assert.match(result.innerHTML, /2\/4 resultados · 1 PDFs/);
  assert.match(result.innerHTML, /documents\/tjdft\/0/);
  assert.doesNotMatch(result.innerHTML, /storage\/pdfs|private-state.pdf|<script>|Nada consta/);
  assert.match(result.innerHTML, /&lt;script&gt;/);
  audit.resultados[1].status = "success";
  audit.resultados[1].dados.certidoes[2] = { tipo: "Certidão nacional", status: "success", pdfPath: "private-national.pdf", kind: "certificate" };
  context.renderSellerAnalysisResult(audit);
  assert.equal(context.sellerAnalysisFinished(audit), true);
  assert.match(result.innerHTML, /Concluído parcialmente/);
  assert.match(result.innerHTML, /documents\/seller_sources\/2/);
  assert.match(result.innerHTML, /3\/4 resultados · 2 PDFs/);
  context.isCertificateOnly=()=>true;
  context.renderSellerAnalysisResult(audit);
  assert.match(result.innerHTML,/sellerReviewPanel/,'certificate results provide the optional analysis panel without starting AI');
  assert.match(result.innerHTML,/documents\/tjdft\/0/);
  assert.match(result.innerHTML,/documents\/seller_sources\/2/);
});

test('text results preserve zero, false, safe text and an open panel during collection without new requests', () => {
  const id='seller-query-audit-test-seller_documents-0';
  const panel={id,hidden:true,querySelector:()=>null};
  let focusCalls=0,fetchCalls=0;
  const button={dataset:{sellerResultToggle:id},textContent:'Ver resultado',attributes:{},setAttribute(name,value){this.attributes[name]=value;},focus(){focusCalls++;}};
  const result={innerHTML:'',querySelectorAll:()=>panel.hidden?[]:[panel]};
  const context=vm.createContext({
    sellerAnalysisResult:result,Date,Number,encodeURIComponent,isCertificateOnly:()=>true,processNumbers,sellerAvailableProcessNumbers:[],
    document:{activeElement:button,querySelector:()=>null,getElementById:key=>key===id?panel:key===id+'-toggle'?button:null},
    escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),
    selectedSellerCertificates:()=>[],selectedSellerQueries:()=>[],sellerCompanyCnpjs:()=>[],fetch:()=>{fetchCalls++;throw new Error('Must use saved results');},
  });
  const start=appJs.indexOf('function getSellerCertificateStatus('),end=appJs.indexOf('async function loadSellerAnalysisResult(',start);
  vm.runInContext(appJs.slice(start,end),context);
  const audit={consultaId:'audit-test',status:'running',resultados:[{fonte:'seller_documents',status:'running',dados:{certidoes:[
    {tipo:'Processos',kind:'data',status:'success',details:{'Total de processos':0,'Possui apontamentos':false,Observação:'<script>unsafe</script>'}},
    {tipo:'Resumo sem detalhes',kind:'data',status:'success',summary:'Retorno textual <obtido>.'},
    {tipo:'Sem detalhes',kind:'data',status:'success'},
    {tipo:'Falhou',kind:'data',status:'failed'},
    {tipo:'Pendente',kind:'data',status:'pending'},
  ]}}]};
  context.renderSellerAnalysisResult(audit);
  assert.equal((result.innerHTML.match(/data-seller-result-toggle=/g)||[]).length,3);
  assert.match(result.innerHTML,/<dt>Total de processos<\/dt><dd>0<\/dd>/);
  assert.match(result.innerHTML,/<dd>false<\/dd>/);
  assert.match(result.innerHTML,/&lt;script&gt;unsafe&lt;\/script&gt;/);
  assert.match(result.innerHTML,/Retorno textual &lt;obtido&gt;/);
  assert.match(result.innerHTML,/não enviou dados adicionais/);
  assert.doesNotMatch(result.innerHTML,/<script>|Nenhum processo|Nada consta/);
  context.toggleSellerQueryResult(button);
  assert.equal(panel.hidden,false);assert.equal(button.attributes['aria-expanded'],'true');assert.equal(button.textContent,'Ocultar resultado');
  context.renderSellerAnalysisResult(audit);
  assert.match(result.innerHTML,/aria-expanded="true"[^>]*>Ocultar resultado/);
  assert.match(result.innerHTML,new RegExp('id="'+id+'" role="region"[^>]* ><h4>'));
  assert.equal(focusCalls,2);
  context.toggleSellerQueryResult(button);
  assert.equal(panel.hidden,true);assert.equal(button.attributes['aria-expanded'],'false');assert.equal(button.textContent,'Ver resultado');
  assert.equal(fetchCalls,0);
  audit.resultados[0].dados.certidoes[0].processNumbers=['07013791820258010013'];
  context.renderSellerAnalysisResult(audit);
  assert.match(result.innerHTML,/data-process-copy="07013791820258010013"/);
  assert.match(result.innerHTML,/Selecionar autos completos/);
  audit.resultados[0].dados.certidoes[0].processNumbers=['07013791920258010013'];
  context.renderSellerAnalysisResult(audit);
  assert.doesNotMatch(result.innerHTML,/data-process-copy=/);
  assert.equal(fetchCalls,0,'offers never repeat a source query');
  Object.assign(audit.resultados[0].dados.certidoes[0],{pdfPath:'private.pdf',evidenceData:{extra:{quantidade:0,apontamento:false,texto:'<script>not-html</script>'},TOKEN:'hidden-secret',processos:[{segredoJustica:true,partes:['confidential-name']}]}});
  audit.resultados[0].dados.certidoes[3].errorDetail='A fonte <recusou> a emissão.';
  context.renderSellerAnalysisResult(audit);
  assert.match(result.innerHTML,/Todos os dados recebidos/);
  assert.match(result.innerHTML,/&quot;quantidade&quot;: 0/);
  assert.match(result.innerHTML,/&quot;apontamento&quot;: false/);
  assert.match(result.innerHTML,/&lt;script&gt;not-html&lt;\/script&gt;/);
  assert.match(result.innerHTML,/A fonte &lt;recusou&gt; a emissão/);
  assert.doesNotMatch(result.innerHTML,/hidden-secret|confidential-name/);
  assert.equal((result.innerHTML.match(/data-seller-result-toggle=/g)||[]).length,3,'PDF results also expose saved data without another request');
  assert.equal(fetchCalls,0);
});
