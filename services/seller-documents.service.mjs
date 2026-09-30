import { readFileSync } from "node:fs";
import { isValidDocument, normalizeDocument } from "./audit.service.mjs";
import { downloadCertificateEvidence } from "./state-court-autonomous.service.mjs";
import { extractPdfText, saveAndExtractPdfBuffer } from "./pdf.service.mjs";
import { collect as collectPublicCompany } from "../collectors/receita-federal.collector.mjs";
import { pdfHasCnpjRoot } from "./pdf-cnpj-root.service.mjs";
import { SELLER_STATES, sellerQueriesForState } from './seller-state-plan.mjs';

const catalog = JSON.parse(readFileSync(new URL("../data/seller-document-coverage.json", import.meta.url), "utf8"));
const clean = (value, limit = 250) => typeof value === "string" || typeof value === "number" ? String(value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit) : "";
const compact = (value) => clean(value, 1000000).normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const list = (value) => Array.isArray(value) ? value : [];
const field = (value, name) => value && typeof value === "object" ? value[Object.keys(value).find((key) => key.toLowerCase() === name.toLowerCase())] : undefined;
const rootTemplates = { "municipal-company-sao-paulo": "sp_municipal", "cnd-rj-company": "rj_fiscal", "cnd-rs-company": "rs_fiscal" };

export function getSellerDocumentCoverage(configuration = {}) {
  const directDataConfigured = configuration.configured === true;
  const queries = catalog.queries.filter((item) => item.provider === "portal" || directDataConfigured);
  return { configured: queries.length > 0, directDataConfigured, queries: structuredClone(queries), validatedAt: catalog.validatedAt };
}

function normalizeCompanies(values = []) {
  if (!Array.isArray(values) || values.length > 5 || values.some((cnpj) => typeof cnpj !== "string" || !/^[\d.\-/\s]+$/.test(cnpj) || !isValidDocument("cnpj", normalizeDocument(cnpj)))) throw new Error("invalid_company_cnpjs");
  return [...new Set(values.map(normalizeDocument))];
}

const isCompanyQuery = (item) => item.documentTypes.includes("cnpj") && !item.documentTypes.includes("cpf");

export function planSellerDocuments(ids, configuration = {}, companyCnpjs = []) {
  if (!Array.isArray(ids) || ids.length > 160 || ids.some((id) => typeof id !== "string")) throw new Error("invalid_seller_queries");
  const companies = normalizeCompanies(companyCnpjs);
  const available = getSellerDocumentCoverage(configuration).queries;
  const queries = [...new Set(ids)].map((id) => available.find((item) => item.id === id));
  if (queries.some((item) => !item)) throw new Error("unsupported_seller_query");
  if (queries.some(isCompanyQuery) && !companies.length) throw new Error("company_cnpj_required");
  return { queries, maxProviderCostBrl: queries.reduce((total, item) => total + Math.round(item.costBrl * 100) * (isCompanyQuery(item) ? companies.length : 1), 0) / 100 };
}

function hasExactDocument(value, document) {
  return new RegExp(`(?<!\\d)${document.split("").join("[.\\-/\\s]*")}(?!\\d)`).test(value);
}

function sameCity(value, expected, uf) {
  const actual = compact(value);
  return actual === compact(expected) || actual === compact(`${expected}-${uf}`);
}

function verifyIdentity(data, document, fullName) {
  const values = ["documentoConsultado", "cpf", "cnpj", "documento", "numeroInscricao", "inscricao"]
    .map((key) => clean(field(data, key))).filter(Boolean);
  const complete = values.filter((value) => /^[\d.\-/\s]+$/.test(value) && [11, 14].includes(normalizeDocument(value).length));
  if (complete.some((value) => normalizeDocument(value) !== document)) throw new Error("evidence_identity_mismatch");
  const nameValue = clean(field(data, "nome") || field(data, "nomeEntidade"));
  // Some official certificates suppress the name with repeated X/* characters.
  const returnedName = /^[Xx*_-]{3,}$/.test(nameValue) || /^CONTRIBUINTENAOCADASTRADO(NESTEMUNICIPIO)?$/.test(compact(nameValue)) ? "" : nameValue;
  if (fullName && returnedName && compact(fullName) !== compact(returnedName)) throw new Error("evidence_name_mismatch");
  return complete.some((value) => normalizeDocument(value) === document);
}

function booleanResult(value) {
  return value === true ? "consta" : value === false ? "nada_consta" : "indisponivel";
}

function companyDetails(data) {
  const details = {};
  for (const [label, key] of [["CNPJ", "cnpj"], ["Razão social", "razaoSocial"], ["Situação cadastral", "situacao"], ["Abertura", "dataAbertura"], ["Atualização cadastral", "atualizadoEm"], ["UF", "uf"], ["Atividade principal", "cnaePrincipal"]]) {
    const value = clean(field(data, key));
    if (value) details[label] = value;
  }
  const partners = list(field(data, "qsa")).slice(0, 50).map((partner) => [clean(field(partner, "nome"), 150), clean(field(partner, "qualificacao"), 100)].filter(Boolean).join(" — ")).filter(Boolean);
  if (partners.length) details["Sócios e administradores"] = partners.join("; ");
  return details;
}

export function summarizeSellerData(endpoint, data) {
  const details = {};
  for (const [label, keys] of [
    ["Situação informada", ["status", "situacaoCadastral"]],
    ["Emissão", ["dataEmissao", "dataExpedicao", "emitidaAs"]],
    ["Validade", ["dataValidade", "validaAte"]],
    ["Data da consulta", ["dataConsulta"]],
    ["Número do documento", ["numeroCertidao", "numeroCertificado", "codigoDeclaracao"]],
    ["Código de validação", ["codigoValidacao", "codigoAutenticidade", "codigoControleCertidao"]],
    ["Total de processos", ["totalProcessos"]],
    ["Total de pendências", ["totalPendencias"]],
  ]) {
    const value = keys.map((key) => field(data, key)).find((entry) => clean(entry) !== "");
    if (value !== undefined) details[label] = clean(value);
  }
  let outcome;
  let summary = "Documento obtido. O retorno não permite concluir sobre a existência de pendências.";
  if (endpoint === "ProtestosOnline") {
    outcome = field(data, "constamProtestos");
    for (const [label, key] of [["Total de protestos", "numeroTotalProtestos"], ["Valor total informado", "valorTotalProtestos"]]) {
      if (clean(field(data, key))) details[label] = clean(field(data, key));
    }
    const states = list(field(data, "protestos")).slice(0, 27).map((entry) => `${clean(field(entry, "estado"), 30)}: ${clean(field(entry, "numeroTotalProtestosUF"), 15)}`).join("; ");
    if (states) details["Protestos por UF"] = states;
  } else if (["TSTCertidaoNegativaDebitosTrabalhistas", "TribunalRegionalFederal", "TribunalRegionalTrabalho"].includes(endpoint)) outcome = field(data, "possuiProcesso");
  else if (endpoint.startsWith("CADIN")) outcome = field(data, "possuiPendencias");
  else if (endpoint === "CaixaRegularidadeEmpregadorFGTS") outcome = field(data, "possuiIrregularidade");
  else if (endpoint.startsWith("CertidaoConjuntaDebitos")) outcome = field(data, "possuiDividas");
  else if (["CertidaoNegativaDebitos", "CertidaoNegativaDebitosMunicipal"].includes(endpoint)) outcome = field(data, "possuiDebito");

  if (["VinculosSocietarios", "ReceitaFederalPessoaJuridica", "ReceitaPJParticipacaoSocietaria"].includes(endpoint)) {
    summary = "Dados cadastrais e vínculos empresariais obtidos. Não comprovam regularidade fiscal nem existência de dívidas.";
    for (const [label, key] of [["Empresa", "nomeEmpresarial"], ["CNPJ", "numeroInscricao"], ["Abertura", "dataAbertura"]]) {
      if (clean(field(data, key))) details[label] = clean(field(data, key));
    }
    const companies = list(field(data, "relacionamentos")).filter((entry) => isValidDocument("cnpj", normalizeDocument(field(entry, "documento")))).slice(0, 50);
    if (companies.length) details["Empresas vinculadas"] = companies.map((entry) => `${clean(field(entry, "nomeEntidade"), 150)} — ${normalizeDocument(field(entry, "documento"))}`).join("; ");
    else if (Array.isArray(field(data, "relacionamentos"))) details["Empresas vinculadas"] = "Nenhuma empresa com CNPJ identificada no retorno.";
    const partners = list(field(data, "socios")).slice(0, 50).map((entry) => [clean(field(entry, "nomeNomeEmpresarial") || field(entry, "nomeEntidade"), 150), clean(field(entry, "qualificacao"), 100)].filter(Boolean).join(" — ")).filter(Boolean);
    if (partners.length) details["Sócios e administradores"] = partners.join("; ");
  } else if (endpoint === "DetalhamentoNegativo") {
    const debt = field(field(data, "pessoaFisica") || field(data, "pessoaJuridica"), "pendenciaFinanceira");
    if (clean(field(debt, "status"))) details["Situação informada"] = clean(field(debt, "status"));
    if (clean(field(debt, "totalPendencia"))) details["Total de pendências financeiras informado"] = clean(field(debt, "totalPendencia"));
    for (const [label, key] of [["Registros de protesto", "protestos"], ["Registros de ações judiciais", "acoesJudiciais"], ["Registros de recuperação/falência", "recuperacoesJudiciaisFalencia"], ["Registros de cheques sem fundo", "chequesSemFundo"]]) {
      if (Array.isArray(field(debt, key))) details[label] = String(field(debt, key).length);
    }
    summary = "Consulta de crédito QUOD obtida. Os registros retornados precisam de análise; não substitui certidão oficial.";
  } else if (endpoint.startsWith("ProcessosJudiciais")) {
    const tribunals = list(field(data, "tribunais")).slice(0, 50).map((entry) => `${clean(field(entry, "tribunal"), 80)}: ${clean(field(entry, "totalPorTribunal"), 15)}`).join("; ");
    if (tribunals) details["Processos por tribunal"] = tribunals;
    const segments = list(field(data, "segmentos")).slice(0, 20).map((entry) => `${clean(field(entry, "segmento"), 80)}: ${clean(field(entry, "totalPorSegmento"), 15)}`).join("; ");
    if (segments) details["Processos por segmento"] = segments;
    const processes = list(field(data, "processos"));
    for (const [index, process] of processes.slice(0, 20).entries()) {
      if (field(process, "segredoJustica") === true) {
        details[`Processo ${index + 1}`] = "Registro em segredo de justiça; detalhes omitidos.";
        continue;
      }
      const parts = [
        ["Número", field(process, "numeroProcesso")],
        ["Tribunal", field(field(process, "orgaoJulgador"), "tribunal") || field(process, "tribunal")],
        ["Classe", field(field(process, "classificacao"), "descricao") || field(process, "classe")],
        ["Situação", field(field(process, "detalhesStatusProcesso"), "statusDetalhes") || field(process, "status")],
        ["Distribuição", field(process, "dataDistribuicao") || field(process, "dataAjuizamento")],
      ].filter(([, value]) => clean(value)).map(([label, value]) => `${label}: ${clean(value, 120)}`);
      const consultedDocument = normalizeDocument(field(data, "documentoConsultado"));
      const subject = consultedDocument && list(field(process, "partes")).find((party) => normalizeDocument(field(party, "documento")) === consultedDocument);
      const role = [field(subject, "polo"), field(subject, "posicaoProcessual")].map((value) => clean(value, 80)).filter(Boolean).join(" / ");
      if (role) parts.push(`Papel do consultado: ${role}`);
      if (parts.length) details[`Processo ${index + 1}`] = parts.join("; ");
    }
    if (processes.length > 20) details["Limite dos detalhes"] = `Exibidos 20 dos ${processes.length} registros retornados.`;
    summary = "Consulta de processos obtida. A posição do vendedor e o conteúdo dos processos precisam de análise; não substitui certidão judicial.";
  } else if (outcome === true) summary = "O provedor informou apontamentos no escopo desta consulta. Consulte o documento e os detalhes.";
  else if (outcome === false) summary = "O provedor não informou apontamentos no escopo e na data desta consulta.";
  return { resultado: booleanResult(outcome), summary, details };
}

export async function collectSellerDocuments(input, {
  query,
  configuration = {},
  download = downloadCertificateEvidence,
  readPdf = extractPdfText,
  savePdf = saveAndExtractPdfBuffer,
  collectCompany = collectPublicCompany,
  portalQuery = async (request) => (await import("./pe-fiscal-certificate.service.mjs")).collectPeFiscalCertificate(request),
  delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  const extra = input.extraFields || {};
  if (extra.authorizationConfirmed !== true) throw new Error("authorization_required");
  const document = normalizeDocument(input.documento);
  if (!/^[\d.\-/\s]+$/.test(String(input.documento || "")) || !["cpf", "cnpj"].includes(input.tipoDocumento) || !isValidDocument(input.tipoDocumento, document)) throw new Error("invalid_seller_document");
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(input.consultaId || "")) throw new Error("invalid_consulta_id");
  const companies = normalizeCompanies(extra.companyCnpjs ?? []);
  const automaticCompanies = extra.discoverCompanies === true;
  if (automaticCompanies && (companies.length || !Object.hasOwn(SELLER_STATES,extra.sellerState) || !extra.sellerQueries?.includes('vinculos') || extra.paidQueryConfirmed !== true)) throw new Error('invalid_company_discovery');
  const plan = planSellerDocuments(extra.sellerQueries ?? [], configuration, companies);
  if (plan.queries.some((item) => !isCompanyQuery(item) && !item.documentTypes.includes(input.tipoDocumento))) throw new Error("unsupported_seller_document_type");
  if (plan.maxProviderCostBrl > 0 && extra.paidQueryConfirmed !== true) throw new Error("paid_query_confirmation_required");
  if (plan.queries.some((item) => item.provider !== "portal") && typeof query !== "function") throw new Error("seller_provider_unavailable");
  const work = plan.queries.flatMap((item) => isCompanyQuery(item)
    ? companies.map((cnpj, companyIndex) => ({ item, document: cnpj, documentType: "cnpj", id: `${item.id}-empresa${companyIndex + 1}`, label: `${item.label} — empresa ${companyIndex + 1}` }))
    : [{ item, document, documentType: input.tipoDocumento, id: item.id, label: item.label }]);
  work.push(...companies.map((cnpj,index)=>({company:cnpj,id:`company-${index+1}`,label:`Empresa ${index+1} — cadastro e QSA`})));
  function makeRow({item,id,label,document:target,documentType,company}) {
    return {id,tipo:label,kind:item?.kind||'data',scope:item?.scope||'Brasil',status:'pending',resultado:'indisponivel',provider:company?'Bases públicas de CNPJ':item.provider==='portal'?'SEFAZ-PE':'Direct Data',providerReference:'',subjectDocument:documentType==='cnpj'?target:company||'',details:documentType==='cnpj'?{'CNPJ consultado':target}:{},limitation:item?.limitation||''};
  }
  const rows=work.map(makeRow);
  function appendJob(job) { work.push(job); rows.push(makeRow(job)); }
  let companyRequests=0;
  async function progress(completed) {
    await input.onProgress?.({ stage: completed === rows.length ? "completed" : "seller_documents", completed, total: rows.length, currentCertificate: rows[completed]?.tipo || "", certidoes: structuredClone(rows) });
  }
  await progress(0);
  for (let index = 0; index < rows.length; index++) {
    try {
      if (!work[index].company) {
        const { item, document: target, documentType, id } = work[index];
        const parameters = { ...item.params, [documentType.toUpperCase()]: target };
        if (item.kind === "certificate" || item.includePdf === true) parameters.GERARCOMPROVANTE = "Habilitar";
        if (item.endpoint === "CertidaoConjuntaDebitosPessoaFisica") parameters.DATANASCIMENTO = extra.stateCourtFields?.birthDate || "";
        const portal = item.provider === "portal";
        if (portal && item.endpoint !== "PERegularidadeFiscal") throw new Error("unsupported_portal_query");
        const official = portal ? await portalQuery({ documento: target }) : null;
        const response = portal ? null : await query({ endpoint: item.endpoint, parameters, estimatedCostBrl: item.costBrl, requestId: `${input.consultaId}:${id}`, authorizationConfirmed: true, paidQueryConfirmed: extra.paidQueryConfirmed === true }, input.usageContext);
        rows[index].providerReference = clean(response?.result?.providerReference || response?.providerReference, 150);
        if (!portal && (response?.insufficientCredits || response?.result?.status !== "success")) throw new Error(/^[a-z0-9_]{1,80}$/.test(response?.reason || "") ? response.reason : "provider_query_failed");
        const payload = response?.result?.payload;
        const data = portal ? {} : field(payload, "retorno");
        if (!portal && (!data || typeof data !== "object" || !Object.keys(data).length)) throw new Error("provider_empty_response");
        const matchedDocument = verifyIdentity(data, target, documentType === "cpf" ? extra.stateCourtFields?.fullName : "");
        const expectedUf = item.params?.UF || item.params?.MUNICIPIO?.split("-").at(-1);
        const returnedUf = clean(field(data, "uf")).toUpperCase();
        const expectedCity = item.params?.MUNICIPIO?.slice(0, item.params.MUNICIPIO.lastIndexOf("-"));
        if ((expectedUf && returnedUf && expectedUf !== returnedUf) || (expectedCity && field(data, "cidade") && !sameCity(field(data, "cidade"), expectedCity, expectedUf))) throw new Error("evidence_scope_mismatch");
        let pdfPath;
        if (item.kind === "certificate" || item.includePdf === true) {
          const evidenceUrl = field(field(payload, "metaDados"), "urlComprovante") || field(data, "urlComprovante");
          if (!portal && !evidenceUrl) throw new Error("official_pdf_unavailable");
          const buffer = portal ? official?.buffer : await download(evidenceUrl);
          if (!Buffer.isBuffer(buffer) || buffer.subarray(0, 5).toString() !== "%PDF-") throw new Error("invalid_pdf_evidence");
          const pdfText = await readPdf(buffer);
          if (item.identityScope === "cnpj_root") {
            if (documentType !== "cnpj" || !matchedDocument || !Object.hasOwn(rootTemplates, item.id) || !await pdfHasCnpjRoot(buffer, target, { template: rootTemplates[item.id] })) throw new Error("evidence_identity_unverified");
            rows[index].details["Identificação no PDF"] = "CNPJ raiz: o documento abrange os estabelecimentos previstos no seu escopo.";
          } else if (!hasExactDocument(pdfText, target)) throw new Error("evidence_identity_unverified");
          if (!Array.isArray(item.expectedText) || !item.expectedText.length || item.expectedText.some((expected) => !compact(expected) || !compact(pdfText).includes(compact(expected)))) throw new Error("evidence_scope_mismatch");
          const saved = await savePdf({ consultaId: input.consultaId, fonte: "seller_documents", fileName: `${id}.pdf`, buffer });
          if (!saved?.pdfPath) throw new Error("evidence_save_failed");
          pdfPath = saved.pdfPath;
        } else if (!matchedDocument) throw new Error("evidence_identity_unverified");
        const summary = summarizeSellerData(item.endpoint, data);
        const evidenceJson = JSON.stringify(data, (key, value) => /token|senha|password|base64|urlcomprovante|documentoConsultado/i.test(key) ? undefined : value);
        const evidenceDataLimited = evidenceJson.length > 180000;
        rows[index] = { ...rows[index], status: "success", ...summary, evidenceData: evidenceDataLimited ? {} : JSON.parse(evidenceJson), evidenceDataLimited, evidenceIdentityVerified: true, details: { ...rows[index].details, ...summary.details }, ...(pdfPath ? { pdfPath } : {}), checkedAt: clean(portal ? official?.queriedAt : response.result.queriedAt) || new Date().toISOString(), providerReference: clean(response?.result?.providerReference, 150) };
        if(automaticCompanies&&item.id==='vinculos') {
          const linked=[...new Set(list(field(data,'relacionamentos')).map(entry=>normalizeDocument(field(entry,'documento'))).filter(cnpj=>isValidDocument('cnpj',cnpj)))];
          for(const [companyIndex,cnpj] of linked.slice(0,5).entries()) appendJob({company:cnpj,id:`company-${companyIndex+1}`,label:`Empresa ${companyIndex+1} — cadastro e QSA`});
          rows[index].details['Empresas consultadas automaticamente']=String(Math.min(5,linked.length));
          if(linked.length>5) rows[index].details['Empresas adicionais']=`${linked.length-5} vínculos excedem o limite de cinco empresas desta análise.`;
        }
      } else {
        if(companyRequests++) await delay(12000);
        const cnpj=work[index].company;
        const company = await collectCompany({ documento: cnpj, tipoDocumento: "cnpj", consultaId: input.consultaId, extraFields: {}, usageContext: input.usageContext, retries: 0, timeoutMs: 15000 });
        if (company?.status !== "success" || normalizeDocument(company.dados?.cnpj) !== cnpj || !clean(company.dados?.razaoSocial)) throw new Error("company_identity_unverified");
        rows[index] = { ...rows[index], status: "success", details: companyDetails(company.dados), summary: "Cadastro empresarial e QSA obtidos. Situação cadastral não comprova regularidade fiscal.", checkedAt: new Date().toISOString(), providerReference: "" };
        rows[index].evidenceIdentityVerified=true;
        if(automaticCompanies) {
          const companyUf=clean(company.dados.uf||company.dados.endereco?.uf,2).toUpperCase();
          const municipality=clean(company.dados.municipio||company.dados.cidade||company.dados.endereco?.municipio,100);
          const available=getSellerDocumentCoverage(configuration).queries;
          const selected=Object.hasOwn(SELLER_STATES,companyUf)?sellerQueriesForState(available,companyUf,'cnpj',municipality):available.filter(item=>item.documentTypes.includes('cnpj')&&item.scope==='Brasil');
          for(const item of selected) appendJob({item,document:cnpj,documentType:'cnpj',id:`${item.id}-${work[index].id}`,label:`${item.label} — ${clean(company.dados.razaoSocial,100)}`});
          rows[index].details['Certidões da empresa']=companyUf?`Consultas nacionais e aplicáveis a ${companyUf}.`:'Somente consultas nacionais: UF cadastral não identificada.';
        }
      }
    } catch (error) {
      const errorCode = [error?.code, error?.message].find(value => /^[a-z0-9_]{1,80}$/.test(value || ""));
      rows[index] = { ...rows[index], status: "failed", resultado: "indisponivel", summary: "Não foi possível obter e validar esta consulta.", errorMessage: errorCode || "seller_document_unavailable", checkedAt: new Date().toISOString() };
    }
    await progress(index + 1);
  }
  const obtained = rows.filter((row) => row.status === "success").length;
  const outcome = rows.some((row) => row.resultado === "consta") ? "consta" : rows.length && rows.every((row) => row.resultado === "nada_consta") ? "nada_consta" : "indisponivel";
  return {
    fonte: "seller_documents", status: obtained ? "success" : rows.length ? "failed" : "unavailable", resultado: outcome,
    dados: { modo: "autonomous", certidoes: rows, totalCertidoes: rows.length, certidoesBaixadas: rows.filter((row) => row.pdfPath).length, consultasObtidas: obtained, certidoesComFalha: rows.filter((row) => row.status !== "success").map((row) => row.tipo), progress: { stage: "completed", completed: rows.length, total: rows.length, updatedAt: new Date().toISOString() }, resumo: `${obtained} de ${rows.length} consultas obtidas e validadas. A cobertura se limita aos documentos e escopos selecionados.` },
    rawText: "", pdfPath: "", errorMessage: obtained ? "" : rows.length ? "Nenhuma consulta pôde ser validada nesta tentativa." : "Nenhuma consulta selecionada.",
  };
}
