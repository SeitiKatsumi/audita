import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");

test("seller analysis is available in the property category of the service catalog", () => {
  assert.match(indexHtml, /data-service-card data-categories="imoveis"[^>]*>\s*<a class="service-card-entry" href="#analise-vendedor"/);
  assert.match(indexHtml, /<strong>Análise de Vendedor<\/strong>/);
});

test("seller analysis route opens its introductory screen", () => {
  assert.match(indexHtml, /id="analise-vendedor" data-page="analise-vendedor emissao-certidoes"/);
  assert.match(indexHtml, /certidões e consultas do vendedor pessoa física nas fontes habilitadas/);
  assert.match(indexHtml, /Certidões em PDF e dados complementares/);
  assert.match(indexHtml, /relatório em PDF com evidências e próximos passos/);
  assert.match(indexHtml, /Emissão autônoma/);
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

test("seller query groups start collapsed and birth date follows the selected sources", async () => {
  const elements = new Map(["#sellerAnalysisCoverage", "#sellerAnalysisUfs", "#sellerAnalysisQueries", "#sellerAnalysisCost", "#sellerAnalysisBirthDate", "#sellerAnalysisRg", "#sellerAnalysisGender", "#sellerAnalysisCompanyCnpjs"].map((selector) => [selector, { innerHTML: "", textContent: "", value: "", required: false }]));
  const selected = { ufs: [], queries: [] };
  const context = vm.createContext({
    isCertificateOnly:()=>false,
    document: {
      querySelector: (selector) => elements.get(selector),
      querySelectorAll: (selector) => (selector.includes("sellerAnalysisUfs") ? selected.ufs : selected.queries).map((value) => ({ value })),
    },
    sellerAnalysisMotherName: { required: false },
    escapeHtml: (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"),
    fetch: async () => ({ ok: true, json: async () => ({ ufs: ["AP"], certificates: [{ uf: "AP", type: "Cível", provider: "direct_data" }], sellerSources: { configured: true, queries: [
      { id: "fiscal", category: "Fiscal", label: "Fiscal", costBrl: 0.54, documentTypes: ["cpf"], limitation: "Não inclui <dívida ativa>" },
      { id: "ccd", category: "Fiscal", label: "CND conjunta", endpoint: "CertidaoConjuntaDebitosPessoaFisica", documentTypes: ["cpf"] },
      { id: "fgts", category: "Empresa", label: "FGTS", costBrl: 0.54, documentTypes: ["cnpj"] },
    ] } }) }),
  });
  const start = appJs.indexOf("let sellerCoverage = null;");
  const end = appJs.indexOf('document.querySelector("#sellerAnalysisUfs")?.addEventListener', start);
  vm.runInContext(appJs.slice(start, end), context);
  await context.loadSellerCoverage();
  assert.match(elements.get("#sellerAnalysisQueries").innerHTML, /<details><summary>Fiscal \(2\)<\/summary>\s*<fieldset>/);
  assert.doesNotMatch(elements.get("#sellerAnalysisQueries").innerHTML, /<details[^>]+open/);
  assert.match(elements.get("#sellerAnalysisQueries").innerHTML, /Não inclui &lt;dívida ativa&gt;/);
  assert.equal(elements.get("#sellerAnalysisBirthDate").required, false);
  selected.queries = ["ccd"];
  context.updateSellerEstimate();
  assert.equal(elements.get("#sellerAnalysisBirthDate").required, true);
  assert.equal(elements.get("#sellerAnalysisRg").required, false);
  selected.queries = ["fgts"];
  elements.get("#sellerAnalysisCompanyCnpjs").value = "04252011000110, 11444777000161, 04252011000110";
  context.updateSellerEstimate();
  assert.match(elements.get("#sellerAnalysisCost").textContent, /R\$ 1,08/);
  assert.match(elements.get("#sellerAnalysisQueries").innerHTML, /por CNPJ informado/);
  assert.equal(elements.get("#sellerAnalysisBirthDate").required, false);
  selected.queries = ["ccd"];
  selected.queries = ["fiscal"];
  context.updateSellerEstimate();
  assert.equal(elements.get("#sellerAnalysisBirthDate").required, false);
  selected.ufs = ["AP"];
  context.updateSellerEstimate();
  assert.equal(elements.get("#sellerAnalysisBirthDate").required, true);
  assert.equal(elements.get("#sellerAnalysisRg").required, true);
  selected.ufs = [];
  selected.queries = [];
  elements.get("#sellerAnalysisCompanyCnpjs").value = "04252011000110";
  context.updateSellerEstimate();
  assert.equal(elements.get("#sellerAnalysisBirthDate").required, false);
  assert.equal(elements.get("#sellerAnalysisRg").required, false);
});

test("seller results preserve every source, private PDF indices and pending queries", () => {
  const result = { innerHTML: "" };
  const context = vm.createContext({
    sellerAnalysisResult: result, Date, Number, encodeURIComponent, isCertificateOnly:()=>false,
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
  assert.doesNotMatch(result.innerHTML,/sellerReviewPanel/);
  assert.match(result.innerHTML,/documents\/tjdft\/0/);
  assert.match(result.innerHTML,/documents\/seller_sources\/2/);
});
