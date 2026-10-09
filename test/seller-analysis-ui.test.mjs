import {certificateSelection,certificateQuote} from '../certificate-selection.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");

test('completed seller reports show numeric score, all three bands and the private PDF link; unfinished reviews do not show a score', () => {
  const code=appJs.slice(appJs.indexOf('function renderSellerReview('),appJs.indexOf('function validateCnibDocument('));
  const context=vm.createContext({escapeHtml:value=>String(value),isCertificateOnly:()=>false});
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
  assert.match(indexHtml, /id="sellerAnalysisPaid"/);
  assert.match(indexHtml, /id="sellerAnalysisAiConsent"/);
  assert.match(appJs, /\/api\/seller-analysis\/coverage/);
  assert.match(appJs, /motherNameRequired/);
  assert.match(appJs, /role="progressbar"/);
  assert.match(appJs, /uma falha não interrompe as demais consultas/);
  assert.match(appJs, /Sem avanço há/);
  assert.match(appJs, /renderSellerAnalysisFailure/);
});

test("certificate groups show applicable sources, 30x prices and only required identity", async () => {
  const elements=new Map(["#sellerAnalysisCoverage","#sellerAnalysisUfs","#sellerAnalysisQueries","#sellerAnalysisCost","#sellerAnalysisBirthDate","#sellerAnalysisRg","#sellerAnalysisGender","#sellerAnalysisDocumentType"].map(s=>[s,{innerHTML:'',value:'',required:false}]));
  elements.get('#sellerAnalysisDocumentType').value='cpf';
  const selected={ufs:[],queries:[],courts:[]};
  const context=vm.createContext({certificateSelection,certificateQuote,isCertificateOnly:()=>true,updateSellerMunicipalities:()=>{},
    document:{querySelector:s=>elements.get(s),querySelectorAll:s=>(s.includes('sellerAnalysisUfs')?selected.ufs:s.includes('data-certificate-court')?selected.courts:selected.queries).map(value=>({value}))},
    sellerAnalysisMotherName:{required:false},sellerAnalysisFullName:{required:false,value:''},sellerAnalysisCpf:{value:'04252011000110'},sellerAnalysisError:null,
    location:{search:''},sessionStorage:{getItem:()=>null},escapeHtml:v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),
    fetch:async()=>({ok:true,json:async()=>({certificatePriceMultiplier:30,states:[{uf:'AP',name:'Amapá',queryIds:['fiscal','ccd','protestos','cadin']}],companyStates:[{uf:'AP',name:'Amapá',queryIds:['fgts']}],certificates:[{uf:'AP',type:'Cível',provider:'direct_data',requiredIdentityFields:['birthDate','rg']},{uf:'AP',type:'Criminal',provider:'direct_data',requiredIdentityFields:['gender']}],sellerSources:{configured:true,queries:[
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
  assert.match(elements.get('#sellerAnalysisCost').innerHTML,/R\$ 48,60/);assert.equal(elements.get('#sellerAnalysisBirthDate').required,true);assert.equal(elements.get('#sellerAnalysisRg').required,true);
  assert.equal(elements.get('#sellerAnalysisGender').required,false);
  assert.match(elements.get('#sellerAnalysisQueries').innerHTML,/Consulta de dados — sem PDF oficial/);
  assert.match(elements.get('#sellerAnalysisQueries').innerHTML,/Comprovante de consulta em PDF/);
  assert.doesNotMatch(elements.get('#sellerAnalysisQueries').innerHTML,/value="(?:protestos|cadin)" checked/);
  selected.queries=['protestos','cadin'];selected.courts=[];context.updateSellerEstimate();
  assert.match(elements.get('#sellerAnalysisCost').innerHTML,/R\$ 51,20/);
  vm.runInContext('sellerCoverage.certificateSubscriber=true',context);context.updateSellerEstimate();
  assert.match(elements.get('#sellerAnalysisCost').innerHTML,/R\$ 35,84/);assert.match(elements.get('#sellerAnalysisCost').innerHTML,/30% de desconto/);
  vm.runInContext('sellerCoverage.certificateSubscriber=false',context);
  assert.equal(elements.get('#sellerAnalysisBirthDate').required,false);
  selected.courts=['AP:Cível'];
  assert.equal(JSON.stringify(context.selectedSellerCertificates().map(c=>c.uf+':'+c.type)),JSON.stringify(['AP:Cível']));
  selected.queries=[];context.updateSellerEstimate();assert.match(elements.get('#sellerAnalysisCost').innerHTML,/1 fontes selecionadas/);assert.match(elements.get('#sellerAnalysisCost').innerHTML,/R\$ 16,20/);
  selected.courts=[];context.updateSellerEstimate();assert.match(elements.get('#sellerAnalysisCost').innerHTML,/R\$ 0,00/);assert.equal(elements.get('#sellerAnalysisRg').required,false);
  elements.get('#sellerAnalysisDocumentType').value='cnpj';selected.queries=['fgts'];context.renderCertificateChoices();context.updateSellerEstimate();
  assert.match(elements.get('#sellerAnalysisCost').innerHTML,/R\$ 16,20/);assert.doesNotMatch(elements.get('#sellerAnalysisQueries').innerHTML,/value="fiscal"/);
  assert.equal(elements.get('#sellerAnalysisBirthDate').required,false);assert.equal(elements.get('#sellerAnalysisRg').required,false);
  elements.get('#sellerAnalysisDocumentType').value='cpf';selected.ufs=[];selected.queries=[];selected.courts=[];context.updateSellerEstimate();
  assert.equal(elements.get('#sellerAnalysisBirthDate').required,false);assert.equal(elements.get('#sellerAnalysisRg').required,false);
});

test('Brazil package preserves optional data queries unchecked',()=>{
  const handlers={},ufs=[{checked:false}],queries=[{checked:true},{checked:false}];
  const context=vm.createContext({document:{getElementById:id=>({addEventListener:(_,fn)=>handlers[id]=fn}),querySelectorAll:s=>s.includes('Ufs')?ufs:queries},isCertificateOnly:()=>true,renderCertificateChoices:()=>{queries[0].checked=true;queries[1].checked=false;},updateSellerEstimate:()=>{}});
  const start=appJs.indexOf('for (const [id, checked] of [["sellerAnalysisSelectAll"'),end=appJs.indexOf('loadSellerCoverage();',start);
  vm.runInContext(appJs.slice(start,end),context);handlers.sellerAnalysisSelectAll();
  assert.equal(ufs[0].checked,true);assert.deepEqual(queries.map(q=>q.checked),[true,false]);
  handlers.sellerAnalysisClearAll();assert.equal(ufs[0].checked,false);assert(queries.every(q=>!q.checked));
});

test("seller results preserve every source, private PDF indices and pending queries", () => {
  const result = { innerHTML: "" };
  const context = vm.createContext({
    sellerAnalysisResult: result, Date, Number, encodeURIComponent, isCertificateOnly:()=>false,
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
  assert.match(result.innerHTML, /Consulta disponível/);
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
