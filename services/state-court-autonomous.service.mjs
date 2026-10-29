import { readFileSync } from "node:fs";
import { processNumbers } from '../judicial-processes.js';
import { readFile } from "node:fs/promises";
import { saveAndExtractPdfBuffer, extractPdfText } from "./pdf.service.mjs";
import { successResult, failedResult } from "../collectors/base.collector.mjs";
import { findStateCourtProfile, listStateCourtProfiles } from "./state-courts.service.mjs";
import { collectInParallel } from './collection-concurrency.mjs';

const coverage = JSON.parse(readFileSync(new URL("../data/state-court-autonomous.json", import.meta.url), "utf8"));
const compact = (value) => String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export function getAutonomousCertificateCoverage(configuration = {}, { includeCandidates = false } = {}) {
  const certificates = coverage.certificates.filter((item) => item.provider === "portal" || (configuration.configured && configuration.allowedUfs?.includes(item.uf)))
    .map(item=>{
      const supported = item.documentTypes || ['cpf'];
      // Legacy evidence was PF only; adding CNPJ support must not silently homologate it.
      const validatedDocumentTypes = (item.validatedDocumentTypes || ['cpf']).filter(type=>supported.includes(type));
      const documentTypes = supported.filter(type=>['cpf','cnpj'].includes(type) && (includeCandidates === true || validatedDocumentTypes.includes(type)));
      return {...item,documentTypes,validatedDocumentTypes,id:`${item.uf}:${item.type}`,requiredIdentityFields:(findStateCourtProfile(item.uf)?.requiredFields||[]).filter(field=>['birthDate','motherName','rg','gender'].includes(field))};
    }).filter(item=>item.documentTypes.length);
  const officialPortals = listStateCourtProfiles().filter(item=>/^https:\/\//.test(item.url)).map(({uf,stateName,court,url})=>({uf,stateName,court,url}));
  return { ...coverage, certificates, officialPortals, ufs: [...new Set(certificates.map((item) => item.uf))], pdfQueryCostBrl: configuration.pdfTotalCostBrl || 0.54 };
}

export function planAutonomousCertificates(ufs, configuration = {}, ids, documentType = 'cpf', { includeCandidates = false } = {}) {
  if (!['cpf','cnpj'].includes(documentType)) throw new Error('invalid_autonomous_subject');
  if (!Array.isArray(ufs) || !ufs.length) throw new Error("unsupported_autonomous_uf");
  const catalog = getAutonomousCertificateCoverage(configuration, { includeCandidates });
  const available = catalog.certificates.filter((item) => ufs.includes(item.uf) && item.documentTypes.includes(documentType));
  if (ufs.some((uf) => !available.some(item=>item.uf===uf))) throw new Error("unsupported_autonomous_uf");
  if(ids!==undefined && (!Array.isArray(ids)||!ids.length||ids.some(id=>!available.some(c=>c.id===id))))throw new Error('invalid_autonomous_certificate_selection');
  const certificates=ids===undefined?available:available.filter(c=>ids.includes(c.id));
  const requiredIdentityFields=documentType==='cpf'?[...new Set(certificates.flatMap(item=>findStateCourtProfile(item.uf)?.requiredFields||[]))].filter(field=>['birthDate','motherName','rg','gender'].includes(field)):[];
  return { certificates, requiredIdentityFields, maxProviderCostBrl: Number((certificates.filter((item) => item.provider === "direct_data").length * catalog.pdfQueryCostBrl).toFixed(2)) };
}

export function certificatePdfMatches(buffer, text, document, fullName) {
  const digits=String(document||'').replace(/\D/g,'');
  if(!compact(fullName) || ![11,14].includes(digits.length)) return false;
  const identifier=new RegExp(`(?<!\\d)${digits.split('').join('[.\\s/\\-]*')}(?!\\d)`);
  return buffer.subarray(0, 5).toString() === "%PDF-" &&
    compact(text).includes(compact(fullName)) && identifier.test(text) &&
    /certid[ãa]o|certifica(?:mos|do)/i.test(text);
}

export function certificateScopeMatches(text, expectedText, uf) {
  const stateName = uf ? findStateCourtProfile(uf)?.stateName : "";
  const titles=Array.isArray(expectedText)?expectedText:[expectedText];
  return Boolean(titles.some(title=>title && compact(text).includes(compact(title))) && (!uf || (stateName && compact(text).includes(compact(stateName)))));
}

export async function downloadCertificateEvidence(url, fetchImpl = fetch) {
  const parsed = new URL(url);
  // Provider evidence is downloaded only from its documented host; do not follow arbitrary redirects.
  if (parsed.protocol !== "https:" || parsed.hostname !== "apiv3.directd.com.br" || parsed.username || parsed.password || (parsed.port && parsed.port !== "443")) throw new Error("invalid_evidence_host");
  const response = await fetchImpl(parsed, { redirect: "error", signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error("evidence_download_failed");
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 20 * 1024 * 1024) throw new Error("evidence_too_large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function portalFailureDetail(message, input) {
  let detail = String(message || "").split(/\r?\n/)[0];
  for (const value of [input.documento, ...Object.values(input.extraFields?.stateCourtFields || {})]) {
    if (typeof value === "string" && value.trim().length >= 3) detail = detail.replaceAll(value.trim(), "[dado omitido]");
  }
  return detail.replace(/https?:\/\/\S+/gi, "[endereço omitido]")
    .replace(/(?:Bearer\s+|(?:TOKEN|API_KEY|PASSWORD)=)[^\s&]+/gi, "[credencial omitida]")
    .replace(/\b(?:\d[.\-/\s]*){11,14}\b/g, "[documento omitido]")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[e-mail omitido]").slice(0, 400);
}

export async function collectAutonomousCertificates(input, { collectPortal, closeAssisted, queryCertificate, configuration, includeCandidates = false, download = downloadCertificateEvidence, savePdf = saveAndExtractPdfBuffer, readPdf = extractPdfText } = {}) {
  const extra = input.extraFields || {};
  if (extra.authorizationConfirmed !== true) throw new Error("authorization_required");
  if (!['cpf','cnpj'].includes(input.tipoDocumento) || !extra.stateCourtFields?.fullName) throw new Error("invalid_autonomous_subject");
  const plan = planAutonomousCertificates(extra.autonomousUfs, configuration, extra.autonomousCertificates, input.tipoDocumento, { includeCandidates });
  if (plan.certificates.some((item) => item.provider === "direct_data") && extra.paidQueryConfirmed !== true) throw new Error("paid_query_confirmation_required");
  const rows = plan.certificates.map((item) => ({ uf: item.uf, tipo: `${item.uf} · ${item.type}`, status: "pending", resultado: "indisponivel", provider: item.provider }));
  let completed=0, portalTurn=Promise.resolve(), progressWrites=Promise.resolve();
  function progress() {
    const snapshot={stage:completed===rows.length?'completed':'autonomous_certificates',total:rows.length,completed,currentCertificate:rows.find(row=>row.status==='running')?.tipo||rows.find(row=>row.status==='pending')?.tipo||'',certidoes:structuredClone(rows)};
    progressWrites=progressWrites.then(()=>input.onProgress?.(snapshot));
    return progressWrites;
  }
  await progress();
  await collectInParallel(plan.certificates, async (item,i) => {
    let release;
    if(item.provider==='portal') {
      const previous=portalTurn;portalTurn=new Promise(resolve=>{release=resolve;});await previous;
    }
    rows[i].status='running';
    try {
      if (item.provider === "portal") {
        const birthDate = extra.stateCourtFields.birthDate?.split("/").reverse().join("-");
        const native = await collectPortal({ ...input, onProgress: undefined, extraFields: { ...extra, autonomousUfs: [], stateCourtUf: item.uf, stateCourtName: item.uf === "DF" ? "TJDFT" : `TJ${item.uf}`, stateCourtUrl: "", stateCourtFields: { ...extra.stateCourtFields, birthDate, instance: "1", nature: item.portalType, certificateKind: item.portalType }, stateCourtCertificateTypes: [item.portalType], tjdftCertificateTypes: [item.portalType] } });
        if (native.dados?.assistedSession) await closeAssisted?.(native.dados.assistedSession);
        const certificate = native.dados?.certidoes?.[0];
        if (!certificate?.pdfPath) {
          const missingFields = (native.dados?.missingFields || []).filter(field => ["firstName", "fullName", "motherName", "fatherName", "birthDate", "rg", "gender", "email"].includes(field));
          const message = certificate?.errorMessage || native.errorMessage;
          const code = certificate?.errorCode || (missingFields.length ? "portal_identity_fields_required" : message ? "portal_collection_failed" : "official_pdf_unavailable");
          throw Object.assign(new Error(/^[a-z_]{1,80}$/.test(code) ? code : "portal_collection_failed"), {
            errorDetail: portalFailureDetail(message, input), missingFields,
            errorStage: /^[a-z_]{1,48}$/.test(certificate?.errorStage || "") ? certificate.errorStage : "",
          });
        }
        const buffer = await readFile(certificate.pdfPath);
        const text = await readPdf(buffer);
        if (!certificatePdfMatches(buffer, text, input.documento, extra.stateCourtFields.fullName)) throw new Error("evidence_identity_unverified");
        if (!certificateScopeMatches(text, item.expectedText, item.uf)) throw new Error("evidence_scope_mismatch");
        rows[i] = { ...rows[i], ...certificate, processNumbers: processNumbers(text), uf: item.uf, tipo: rows[i].tipo, status: "success" };
      } else {
        const response = await queryCertificate({ ...extra.stateCourtFields, document: input.documento, documentType: input.tipoDocumento, uf: item.uf, certificateType: item.providerType || item.type, generatePdf: true, authorizationConfirmed: true, paidQueryConfirmed: true, requestId: `${input.consultaId}:${item.uf}:${item.type}` }, input.usageContext);
        if (!response.result?.certificate?.evidenceUrl) throw new Error(response.reason || "official_pdf_unavailable");
        const buffer = await download(response.result.certificate.evidenceUrl);
        const text = await readPdf(buffer);
        if (!certificatePdfMatches(buffer, text, input.documento, extra.stateCourtFields.fullName)) throw new Error("evidence_identity_unverified");
        if (!certificateScopeMatches(text, item.expectedText, item.uf)) throw new Error("evidence_scope_mismatch");
        const saved = await savePdf({ consultaId: input.consultaId, fonte: "tjdft", fileName: `${item.uf}-${i}.pdf`, buffer });
        const certificate = response.result.certificate;
        const details = Object.fromEntries([['Titular',certificate.entityName],['Emissão',certificate.issueDate],['Validade',certificate.expiryDate],['Número',certificate.number],['Código de validação',certificate.validationCode],['Situação',certificate.status],['Observação',certificate.observation]].filter(([,value])=>value!==undefined&&value!==null&&value!==''));
        rows[i] = { ...rows[i], status: "success", details, evidenceData: response.result.evidenceData, evidenceDataLimited: response.result.evidenceDataLimited, processNumbers: processNumbers(text), pdfPath: saved.pdfPath, resultado: response.result.analysis.occurrence === true ? "consta" : response.result.analysis.occurrence === false ? "nada_consta" : "indisponivel", providerReference: response.result.providerReference };
      }
      rows[i].evidenceIdentityVerified=true;
    } catch (error) {
      rows[i] = { ...rows[i], status: "failed", errorMessage: /^[a-z_]+$/.test(error.message) ? error.message : "certificate_unavailable",
        ...(item.provider === "portal" ? {
          errorDetail: error.errorDetail || portalFailureDetail(error.message, input),
          ...(error.errorStage ? { errorStage: error.errorStage } : {}),
          ...(error.missingFields?.length ? { missingFields: error.missingFields } : {}),
        } : {}),
      };
    } finally {
      release?.();
    }
    completed++;
    await progress();
  });
  const downloaded = rows.filter((item) => item.pdfPath).length;
  const dados = { modo: "autonomous", certidoes: rows, totalCertidoes: rows.length, certidoesBaixadas: downloaded, certidoesComFalha: rows.filter((item) => item.status !== "success").map((item) => item.tipo), progress: { stage: "completed", completed: rows.length, total: rows.length, updatedAt: new Date().toISOString() }, resumo: `${downloaded} de ${rows.length} certidões obtidas. A cobertura se limita aos estados e tipos selecionados.` };
  if (!downloaded) return failedResult("tjdft", "Nenhum PDF oficial disponível nesta tentativa.", dados);
  const outcome = rows.some((item) => item.resultado === "consta") ? "consta" : rows.some((item) => item.resultado === "indisponivel") ? "indisponivel" : "nada_consta";
  return successResult("tjdft", outcome, dados);
}
