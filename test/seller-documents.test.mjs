import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { collectSellerDocuments, getSellerDocumentCoverage, planSellerDocuments, summarizeSellerData } from "../services/seller-documents.service.mjs";
import { sellerStatePlans, sellerQueriesForState } from '../services/seller-state-plan.mjs';

test('automatic state plans include federal jurisdictions and only matching municipal sources', () => {
  const coverage={certificates:[],sellerSources:getSellerDocumentCoverage({configured:true})};
  const states=sellerStatePlans(coverage);
  assert.equal(states.length,27);
  const sp=states.find(s=>s.uf==='SP');
  assert.equal(sp.queryIds.length,13);
  assert.equal(sp.baseCostBrl,16.44);
  assert.ok(sp.queryIds.includes('vinculos'));
  const queries=coverage.sellerSources.queries;
  for(const state of states) {
    assert.equal(sellerQueriesForState(queries,state.uf).filter(q=>q.endpoint==='TribunalRegionalFederal').length,2);
    assert.ok(!sellerQueriesForState(queries,state.uf).some(q=>q.endpoint==='CertidaoNegativaDebitosMunicipal'));
  }
  assert.deepEqual(sellerQueriesForState(queries,'RJ').filter(q=>q.endpoint==='TribunalRegionalTrabalho').map(q=>q.params.REGIAO),['1']);
  assert.ok(sellerQueriesForState(queries,'SP').filter(q=>q.endpoint==='TribunalRegionalTrabalho').every(q=>['2','15'].includes(q.params.REGIAO)));
  const municipal=queries.find(q=>q.endpoint==='CertidaoNegativaDebitosMunicipal'&&q.documentTypes.includes('cpf'));
  const city=municipal.params.MUNICIPIO.slice(0,-3),uf=municipal.params.MUNICIPIO.slice(-2);
  assert.ok(sellerQueriesForState(queries,uf,'cpf',city).includes(municipal));
  assert.ok(!sellerQueriesForState(queries,uf,'cpf','Outra cidade').includes(municipal));
  assert.throws(()=>sellerQueriesForState(queries,'XX'),/invalid_seller_state/);
});

const CPF = "52998224725";
const CNPJ = "04252011000110";
const configuration = { configured: true };
const input = (extra = {}) => ({ consultaId: "test-seller", documento: CPF, tipoDocumento: "cpf", usageContext: { tenantId: "test-tenant", user: { id: "test-user" } }, extraFields: { sellerQueries: ["cndt"], authorizationConfirmed: true, paidQueryConfirmed: true, stateCourtFields: { fullName: "Pessoa Teste", birthDate: "01/01/2000" }, ...extra } });
const result = (data, metadata = {}) => ({ result: { status: "success", payload: { metaDados: { urlComprovante: "https://apiv3.directd.com.br/evidence/test.pdf", ...metadata }, retorno: data }, providerReference: "test-ref", queriedAt: "2026-09-28T15:00:00Z" } });
const PDF = Buffer.from("%PDF-test");
const PDF_TEXT = "CERTIDÃO DE DÉBITOS TRABALHISTAS BANCO NACIONAL DE DEVEDORES TRABALHISTAS 529.982.247-25";
const dependencies = (overrides = {}) => ({ configuration, query: async () => result({ documentoConsultado: CPF, possuiProcesso: false }), download: async () => PDF, readPdf: async () => PDF_TEXT, savePdf: async () => ({ pdfPath: "private-test.pdf", rawText: "never-copy-this" }), ...overrides });

test('CPF discovery deduplicates and caps companies, then uses each company UF without attributing failures as clearance',async()=>{
  const companies=Array.from({length:6},(_,index)=>{
    let value=String(index+1).padStart(12,'0');
    for(const weights of [[5,4,3,2,9,8,7,6,5,4,3,2],[6,5,4,3,2,9,8,7,6,5,4,3,2]]) {
      const remainder=[...value].reduce((sum,digit,i)=>sum+Number(digit)*weights[i],0)%11;
      value+=remainder<2?'0':String(11-remainder);
    }
    return value;
  });
  const requested=[],lookedUp=[],updates=[];
  const batch=input({sellerQueries:['vinculos'],sellerState:'SP',discoverCompanies:true});
  batch.onProgress=async p=>updates.push(p);
  const output=await collectSellerDocuments(batch,dependencies({
    query:async request=>{
      requested.push(request);
      if(request.endpoint==='VinculosSocietarios') return result({documentoConsultado:CPF,relacionamentos:[...companies,companies[0],'invalid'].map(documento=>({documento}))});
      return {reason:'fixture_unavailable'};
    },
    collectCompany:async ({documento})=>{lookedUp.push(documento);return {status:'success',dados:{cnpj:documento,razaoSocial:'Empresa Fictícia',uf:'RJ'}};},
    delay:async()=>{},
  }));
  assert.equal(lookedUp.length,5);
  assert.deepEqual(lookedUp,companies.slice(0,5));
  const rows=output.dados.certidoes;
  assert.equal(rows[0].details['Empresas consultadas automaticamente'],'5');
  assert.match(rows[0].details['Empresas adicionais'],/1 vínculos/);
  assert.equal(rows.filter(r=>r.id.startsWith('cnd-rj-company')).length,5);
  assert.ok(!rows.some(r=>r.id.startsWith('cnd-sp-company')||r.id.startsWith('trf3-')));
  assert.ok(requested.slice(1).every(r=>companies.slice(0,5).includes(r.parameters.CNPJ)));
  assert.ok(rows.filter(r=>r.status==='failed').every(r=>r.resultado==='indisponivel'&&r.subjectDocument));
  assert.equal(updates.at(-1).completed,updates.at(-1).total);
  assert.equal(updates.at(-1).stage,'completed');
});

test("seller plans contain only explicitly selected, available entries and deduplicate their cost", () => {
  assert.deepEqual(getSellerDocumentCoverage({}).queries.map(item => item.id), ["cnd-pe-portal"]);
  assert.equal(getSellerDocumentCoverage({}).directDataConfigured, false);
  const catalog = getSellerDocumentCoverage(configuration);
  assert.equal(catalog.configured, true);
  catalog.queries[0].id = "modified";
  assert.notEqual(getSellerDocumentCoverage(configuration).queries[0].id, "modified");
  assert.equal(planSellerDocuments(["cndt", "cndt", "protestos"], configuration).queries.length, 2);
  assert.equal(planSellerDocuments(["cndt", "cndt", "protestos"], configuration).maxProviderCostBrl, 4.04);
  assert.deepEqual(planSellerDocuments([], {}), { queries: [], maxProviderCostBrl: 0 });
  assert.throws(() => planSellerDocuments(["unvalidated"], configuration), /unsupported_seller_query/);
  assert.throws(() => planSellerDocuments(["cndt"], {}), /unsupported_seller_query/);
  assert.throws(() => planSellerDocuments(undefined, configuration), /invalid_seller_queries/);
  assert.throws(() => planSellerDocuments(Array(161).fill("cndt"), configuration), /invalid_seller_queries/);
});

test("seller collection validates authorization, selections and companies before any provider call", async () => {
  let calls = 0;
  const options = dependencies({ query: async () => { calls++; return result({}); }, collectCompany: async () => { calls++; } });
  for (const [extra, reason] of [
    [{ authorizationConfirmed: false }, /authorization_required/],
    [{ paidQueryConfirmed: false }, /paid_query_confirmation_required/],
    [{ sellerQueries: ["unvalidated"] }, /unsupported_seller_query/],
    [{ companyCnpjs: Array(6).fill(CNPJ) }, /invalid_company_cnpjs/],
    [{ companyCnpjs: ["11111111111111"] }, /invalid_company_cnpjs/],
  ]) await assert.rejects(() => collectSellerDocuments(input(extra), options), reason);
  const empty = await collectSellerDocuments(input({ sellerQueries: [], paidQueryConfirmed: false }), options);
  assert.equal(empty.status, "unavailable");
  assert.equal(empty.resultado, "indisponivel");
  assert.equal(calls, 0);
});

test("seller batch preserves good certificates and data when another query fails; progress reaches completion", async () => {
  const updates = [];
  const calls = [];
  const batch = input({ sellerQueries: ["cndt", "protestos", "cnd-sp"] });
  batch.onProgress = async (value) => updates.push(value);
  const output = await collectSellerDocuments(batch, dependencies({ query: async (request, context) => {
    calls.push(request);
    assert.deepEqual(context, batch.usageContext);
    assert.equal(request.authorizationConfirmed, true);
    assert.equal(request.paidQueryConfirmed, true);
    if (request.endpoint === "CertidaoNegativaDebitos") return { failed: true, reason: "provider_timeout" };
    if (request.endpoint === "ProtestosOnline") return result({ documentoConsultado: CPF, constamProtestos: true, numeroTotalProtestos: 2, valorTotalProtestos: "125,00" });
    return result({ documentoConsultado: CPF, possuiProcesso: false, nome: "Pessoa Teste" });
  } }));
  assert.equal(output.status, "success");
  assert.equal(output.resultado, "consta");
  assert.equal(output.dados.consultasObtidas, 2);
  assert.equal(output.dados.certidoesBaixadas, 1);
  assert.equal(output.dados.certidoesComFalha.length, 1);
  assert.equal(output.dados.certidoes[1].kind, "data");
  assert.equal(output.dados.certidoes[1].pdfPath, undefined);
  assert.equal(output.dados.certidoes[1].details["Total de protestos"], "2");
  assert.equal(calls[0].requestId, "test-seller:cndt");
  assert.equal(calls[0].parameters.GERARCOMPROVANTE, "Habilitar");
  assert.equal(calls[1].parameters.GERARCOMPROVANTE, undefined);
  assert.equal(calls[2].parameters.UF, "SP");
  assert.deepEqual(updates.map((update) => update.completed), [0, 1, 2, 3]);
  assert.equal(updates.at(-1).stage, "completed");
  assert.doesNotMatch(JSON.stringify(output), /never-copy-this|documentoConsultado|urlComprovante/);
});

test("seller certificate identity and all expected scope phrases are required before saving", async () => {
  let saved = 0;
  for (const overrides of [
    { download: async () => Buffer.from("<html>not a PDF</html>") },
    { readPdf: async () => PDF_TEXT.replace("529.982.247-25", "111.111.111-11") },
    { readPdf: async () => PDF_TEXT.replace("529.982.247-25", "1529.982.247-250") },
    { readPdf: async () => PDF_TEXT.replace("BANCO NACIONAL DE DEVEDORES TRABALHISTAS", "") },
    { query: async () => result({ documentoConsultado: "11111111111", possuiProcesso: false }) },
    { query: async () => result({ documentoConsultado: CPF, nome: "Outra Pessoa", possuiProcesso: false }) },
  ]) {
    const output = await collectSellerDocuments(input(), dependencies({ savePdf: async () => { saved++; return { pdfPath: "bad.pdf" }; }, ...overrides }));
    assert.equal(output.status, "failed");
    assert.equal(output.resultado, "indisponivel");
  }
  assert.equal(saved, 0);
  const sp = await collectSellerDocuments(input({ sellerQueries: ["cnd-sp"] }), dependencies({ query: async () => result({ documentoConsultado: CPF, possuiDebito: false }), readPdf: async () => `DÉBITOS TRIBUTÁRIOS NÃO INSCRITOS ESTADO DE SÃO PAULO CPF ${CPF}` }));
  assert.equal(sp.dados.certidoes[0].status, "success");
  assert.equal(sp.resultado, "nada_consta");
  const suppressedName = await collectSellerDocuments(input(), dependencies({ query: async () => result({ documentoConsultado: CPF, nomeEntidade: "X".repeat(50), possuiProcesso: false }) }));
  assert.equal(suppressedName.status, "success");
  const suppressedNameWrongCpf = await collectSellerDocuments(input(), dependencies({ query: async () => result({ documentoConsultado: "11111111111", nomeEntidade: "X".repeat(50), possuiProcesso: false }) }));
  assert.equal(suppressedNameWrongCpf.status, "failed");
});

test("seller data needs a matching document and boolean flags; string false is inconclusive", async () => {
  for (const data of [{ constamProtestos: false }, { documentoConsultado: "11111111111", constamProtestos: false }]) {
    const output = await collectSellerDocuments(input({ sellerQueries: ["protestos"] }), dependencies({ query: async () => result(data) }));
    assert.equal(output.status, "failed");
  }
  const output = await collectSellerDocuments(input({ sellerQueries: ["protestos"] }), dependencies({ query: async () => result({ documentoConsultado: CPF, constamProtestos: "false", numeroTotalProtestos: 0 }) }));
  assert.equal(output.status, "success");
  assert.equal(output.resultado, "indisponivel");
  assert.equal(output.dados.certidoes[0].details["Total de protestos"], "0");
});

test("seller data receipts retain their data label and require the requested PDF identity and scope", async () => {
  let saved = 0;
  const options = dependencies({ query: async (request) => {
    assert.equal(request.endpoint, "CADINSecretariaFazendaSP");
    assert.equal(request.parameters.GERARCOMPROVANTE, "Habilitar");
    return result({ documentoConsultado: CPF, possuiPendencias: false });
  }, readPdf: async () => `CADIN SÃO PAULO ${CPF}`, savePdf: async () => { saved++; return { pdfPath: "private-receipt.pdf" }; } });
  const output = await collectSellerDocuments(input({ sellerQueries: ["cadin-sp"] }), options);
  assert.equal(output.dados.certidoes[0].kind, "data");
  assert.equal(output.dados.certidoes[0].pdfPath, "private-receipt.pdf");
  assert.equal(output.dados.certidoes[0].resultado, "nada_consta");
  assert.equal(saved, 1);
  for (const pdfText of ["CADIN SÃO PAULO 11111111111", `CADIN MINAS GERAIS ${CPF}`]) {
    const failed = await collectSellerDocuments(input({ sellerQueries: ["cadin-sp"] }), { ...options, readPdf: async () => pdfText });
    assert.equal(failed.status, "failed");
    assert.equal(failed.dados.certidoes[0].pdfPath, undefined);
  }
  assert.equal(saved, 1);
});

test("seller normalization retains company/QSA facts and aggregate credit/process data without unrelated personal data", () => {
  const links = summarizeSellerData("VinculosSocietarios", { documentoConsultado: CPF, detalhesPessoaFisica: { endereco: { logradouro: "private street" }, dataNascimento: "private birthday" }, relacionamentos: [{ documento: "12345678900", nomeEntidade: "private relative", grau: "Filho" }, { documento: CNPJ, nomeEntidade: "Empresa Teste", detalhesPessoaJuridica: { endereco: "private address" } }] });
  assert.equal(links.resultado, "indisponivel");
  assert.match(links.details["Empresas vinculadas"], /Empresa Teste/);
  assert.doesNotMatch(JSON.stringify(links), /private|Filho|12345678900/);
  const qsa = summarizeSellerData("ReceitaFederalPessoaJuridica", { numeroInscricao: CNPJ, nomeEmpresarial: "Empresa Teste", socios: [{ nomeNomeEmpresarial: "Pessoa Sócia", qualificacao: "Administradora", documentoSocio: CPF }], telefone: "private phone", logradouro: "private street" });
  assert.match(qsa.details["Sócios e administradores"], /Pessoa Sócia — Administradora/);
  assert.doesNotMatch(JSON.stringify(qsa), new RegExp(`${CPF}|private`));
  assert.equal(qsa.resultado, "indisponivel");
  const credit = summarizeSellerData("DetalhamentoNegativo", { pessoaFisica: { pendenciaFinanceira: { status: "Registros retornados", totalPendencia: 2, protestos: [{ credor: "private creditor" }], acoesJudiciais: [] } } });
  assert.equal(credit.details["Registros de protesto"], "1");
  assert.equal(credit.resultado, "indisponivel");
  assert.doesNotMatch(JSON.stringify(credit), /private creditor/);
  const cases = summarizeSellerData("ProcessosJudiciaisCompleta", { documentoConsultado: CPF, totalProcessos: 2, processos: [{ numeroProcesso: "0000000-00.2026.0.00.0000", orgaoJulgador: { tribunal: "Tribunal Teste" }, classificacao: { descricao: "Classe Teste" }, detalhesStatusProcesso: { statusDetalhes: "Em andamento" }, partes: [{ documento: CPF, nomeCompleto: "private seller name", polo: "Passivo", posicaoProcessual: "Réu" }, { documento: "11111111111", nomeCompleto: "private other party" }] }, { numeroProcesso: "private case number", partes: [{ nomeCompleto: "private party" }], segredoJustica: true }] });
  assert.equal(cases.details["Total de processos"], "2");
  assert.equal(cases.resultado, "indisponivel");
  assert.match(cases.details["Processo 1"], /Número: 0000000-00\.2026\.0\.00\.0000; Tribunal: Tribunal Teste; Classe: Classe Teste; Situação: Em andamento; Papel do consultado: Passivo \/ Réu/);
  assert.match(cases.details["Processo 2"], /segredo de justiça/);
  assert.doesNotMatch(JSON.stringify(cases), /private|11111111111/);
});

test("seller public CNPJ collection deduplicates, spaces calls and preserves successful companies", async () => {
  const calls = [], waits = [];
  const secondCnpj = "11222333000181";
  const output = await collectSellerDocuments(input({ sellerQueries: [], paidQueryConfirmed: false, companyCnpjs: [CNPJ, CNPJ, secondCnpj] }), dependencies({ configuration: {}, delay: async (ms) => waits.push(ms), query: async () => { throw new Error("paid request must not run"); }, collectCompany: async (company) => {
    calls.push(company);
    if (company.documento === secondCnpj) return { status: "failed" };
    return { status: "success", dados: { cnpj: CNPJ, razaoSocial: "Empresa Teste", situacao: "ATIVA", endereco: "private street", qsa: [{ nome: "Pessoa Sócia", qualificacao: "Administradora", documento: CPF }] } };
  } }));
  assert.equal(calls.length, 2);
  assert.equal(calls[0].tipoDocumento, "cnpj");
  assert.equal(calls[0].retries, 0);
  assert.deepEqual(waits, [12000]);
  assert.equal(output.status, "success");
  assert.equal(output.resultado, "indisponivel");
  assert.equal(output.dados.certidoesBaixadas, 0);
  assert.equal(output.dados.consultasObtidas, 1);
  assert.doesNotMatch(JSON.stringify(output), new RegExp(`private street|${CPF}`));
});

test("company queries require selected valid CNPJs, multiply cost and isolate every company identity and file", async () => {
  const secondCnpj = "11222333000181";
  const selection = [CNPJ, CNPJ, secondCnpj];
  assert.throws(() => planSellerDocuments(["fgts-company"], configuration), /company_cnpj_required/);
  const plan = planSellerDocuments(["fgts-company", "cndt"], configuration, selection);
  assert.equal(plan.queries.length, 2);
  assert.equal(plan.maxProviderCostBrl, 1.62);
  const requests = [], saved = [];
  let target;
  const options = dependencies({ delay: async () => {}, query: async request => {
    requests.push(request);
    target = request.parameters.CNPJ;
    assert.equal(request.parameters.CPF, undefined);
    return result({ inscricao: target, nome: "Empresa diferente do nome do vendedor", possuiIrregularidade: false });
  }, readPdf: async () => `CERTIFICADO DE REGULARIDADE DO FGTS CAIXA ECONOMICA FEDERAL ${target}`, savePdf: async ({ fileName }) => { saved.push(fileName); return { pdfPath: fileName }; }, collectCompany: async request => ({ status: "success", dados: { cnpj: request.documento, razaoSocial: "Empresa Teste" } }) });
  const output = await collectSellerDocuments(input({ sellerQueries: ["fgts-company"], companyCnpjs: selection }), options);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests.map(request => request.requestId), ["test-seller:fgts-company-empresa1", "test-seller:fgts-company-empresa2"]);
  assert.deepEqual(saved, ["fgts-company-empresa1.pdf", "fgts-company-empresa2.pdf"]);
  assert.deepEqual(output.dados.certidoes.slice(0, 2).map(row => row.details["CNPJ consultado"]), [CNPJ, secondCnpj]);
  assert.ok(output.dados.certidoes.every(row => row.status === "success"));
  assert.equal(output.dados.progress.completed, 4);
  const wrongPdf = await collectSellerDocuments(input({ sellerQueries: ["fgts-company"], companyCnpjs: [CNPJ] }), { ...options, readPdf: async () => `CERTIFICADO DE REGULARIDADE DO FGTS CAIXA ECONOMICA FEDERAL ${secondCnpj}` });
  assert.equal(wrongPdf.dados.certidoes[0].errorMessage, "evidence_identity_unverified");
});

test("free PE portal stays available without Direct Data and validates its PDF without a paid request", async () => {
  let paidCalls = 0, portalCalls = 0;
  const options = dependencies({ configuration: {}, query: async () => { paidCalls++; throw Error("unexpected_paid_call"); }, portalQuery: async request => {
    portalCalls++;
    assert.deepEqual(request, { documento: CPF });
    return { buffer: PDF, provider: "SEFAZ-PE", queriedAt: "2026-09-28T15:00:00Z" };
  }, readPdf: async () => `CERTIDÃO DE REGULARIDADE FISCAL PERNAMBUCO ${CPF}` });
  const selection = input({ sellerQueries: ["cnd-pe-portal"], paidQueryConfirmed: false });
  assert.equal(planSellerDocuments(["cnd-pe-portal"], {}).maxProviderCostBrl, 0);
  const output = await collectSellerDocuments(selection, options);
  assert.equal(output.status, "success");
  assert.equal(output.dados.certidoes[0].provider, "SEFAZ-PE");
  assert.equal(output.resultado, "indisponivel");
  for (const text of [`CERTIDÃO DE REGULARIDADE FISCAL PARAIBA ${CPF}`, "CERTIDÃO DE REGULARIDADE FISCAL PERNAMBUCO 11111111111"]) {
    const failed = await collectSellerDocuments(selection, { ...options, readPdf: async () => text });
    assert.equal(failed.status, "failed");
  }
  assert.equal(portalCalls, 3);
  assert.equal(paidCalls, 0);
  let parseCalls = 0;
  const unreadable = await collectSellerDocuments(selection, { ...options, readPdf: async () => { parseCalls++; return ""; } });
  assert.equal(unreadable.status, "failed");
  assert.equal(parseCalls, 1);
  const portalError = await collectSellerDocuments(selection, { ...options, portalQuery: async () => { throw Object.assign(Error("Mensagem humana do portal"), { code: "pe_fiscal_captcha_required" }); } });
  assert.equal(portalError.dados.certidoes[0].errorMessage, "pe_fiscal_captcha_required");
});

test("municipal scope accepts the same UF suffix and known unnamed taxpayer placeholder, rejecting contradictions", async () => {
  const item = getSellerDocumentCoverage(configuration).queries.find(item => item.id === "municipal-lajes-rn");
  const options = dependencies({ query: async () => result({ documentoConsultado: CPF, nomeEntidade: "CONTRIBUINTE NAO CADASTRADO NESTE MUNICIPIO", cidade: "Lajes-RN", uf: "RN", possuiDebito: false }), readPdf: async () => `${item.expectedText.join(" ")} ${CPF}` });
  const selection = input({ sellerQueries: [item.id] });
  assert.equal((await collectSellerDocuments(selection, options)).dados.certidoes[0].status, "success");
  for (const scope of [{ cidade: "Lajes-SP", uf: "RN" }, { cidade: "Lajes", uf: "SP" }]) {
    const failed = await collectSellerDocuments(selection, { ...options, query: async () => result({ documentoConsultado: CPF, ...scope }) });
    assert.equal(failed.dados.certidoes[0].errorMessage, "evidence_scope_mismatch");
  }
});

test("reviewed root-scope certificates require a labelled PDF root plus the complete company identity in JSON", async () => {
  const item = getSellerDocumentCoverage(configuration).queries.find(item => item.id === "municipal-company-sao-paulo");
  async function evidence(root, label = true) {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const page = pdf.addPage([700, 800]);
    if (label) page.drawText("CPF/CNPJ Raiz:", { x: 30, y: 700, size: 10, font });
    page.drawText(root, { x: 130, y: 700, size: 10, font });
    return Buffer.from(await pdf.save());
  }
  const selected = input({ sellerQueries: [item.id], companyCnpjs: [CNPJ] });
  const options = dependencies({ query: async () => result({ documentoConsultado: CNPJ, nomeEntidade: "Empresa Teste", cidade: "São Paulo", uf: "SP", possuiDebito: false }), download: async () => evidence("04.252.011/"), readPdf: async () => item.expectedText.join(" "), collectCompany: async () => ({ status: "success", dados: { cnpj: CNPJ, razaoSocial: "Empresa Teste" } }) });
  const good = await collectSellerDocuments(selected, options);
  assert.equal(good.dados.certidoes[0].status, "success");
  assert.equal(good.dados.certidoes[0].details["CNPJ consultado"], CNPJ);
  assert.match(good.dados.certidoes[0].details["Identificação no PDF"], /CNPJ raiz/);
  for (const override of [
    { download: async () => evidence("11.222.333/") },
    { download: async () => evidence("04.252.011/", false) },
    { query: async () => result({ possuiDebito: false }) },
    { query: async () => result({ documentoConsultado: "11222333000181", possuiDebito: false }) },
  ]) {
    const rejected = await collectSellerDocuments(selected, { ...options, ...override });
    assert.equal(rejected.dados.certidoes[0].status, "failed");
    assert.equal(rejected.dados.certidoes[0].pdfPath, undefined);
  }
});
