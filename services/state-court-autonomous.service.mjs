import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { saveAndExtractPdfBuffer, extractPdfText } from "./pdf.service.mjs";
import { successResult, failedResult } from "../collectors/base.collector.mjs";
import { findStateCourtProfile } from "./state-courts.service.mjs";

const coverage = JSON.parse(readFileSync(new URL("../data/state-court-autonomous.json", import.meta.url), "utf8"));
const compact = (value) => String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export function getAutonomousCertificateCoverage(configuration = {}) {
  const certificates = coverage.certificates.filter((item) => item.provider === "portal" || (configuration.configured && configuration.allowedUfs?.includes(item.uf)));
  return { ...coverage, certificates, ufs: [...new Set(certificates.map((item) => item.uf))], pdfQueryCostBrl: configuration.pdfTotalCostBrl || 0.54 };
}

export function planAutonomousCertificates(ufs, configuration = {}) {
  const catalog = getAutonomousCertificateCoverage(configuration);
  if (!Array.isArray(ufs) || !ufs.length || ufs.some((uf) => !catalog.ufs.includes(uf))) throw new Error("unsupported_autonomous_uf");
  const certificates = catalog.certificates.filter((item) => ufs.includes(item.uf));
  return { certificates, maxProviderCostBrl: Number((certificates.filter((item) => item.provider === "direct_data").length * catalog.pdfQueryCostBrl).toFixed(2)) };
}

export function certificatePdfMatches(buffer, text, document, fullName) {
  return buffer.subarray(0, 5).toString() === "%PDF-" &&
    compact(text).includes(compact(fullName)) && text.replace(/\D/g, "").includes(String(document).replace(/\D/g, "")) &&
    /certid[ãa]o|certifica(?:mos|do)/i.test(text);
}

export function certificateScopeMatches(text, expectedText, uf) {
  const stateName = uf ? findStateCourtProfile(uf)?.stateName : "";
  return Boolean(expectedText && compact(text).includes(compact(expectedText)) && (!uf || (stateName && compact(text).includes(compact(stateName)))));
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

export async function collectAutonomousCertificates(input, { collectPortal, closeAssisted, queryCertificate, configuration, download = downloadCertificateEvidence, savePdf = saveAndExtractPdfBuffer, readPdf = extractPdfText } = {}) {
  const extra = input.extraFields || {};
  if (extra.authorizationConfirmed !== true) throw new Error("authorization_required");
  const plan = planAutonomousCertificates(extra.autonomousUfs, configuration);
  if (input.tipoDocumento !== "cpf" || !extra.stateCourtFields?.fullName) throw new Error("invalid_autonomous_subject");
  if (plan.certificates.some((item) => item.provider === "direct_data") && extra.paidQueryConfirmed !== true) throw new Error("paid_query_confirmation_required");
  const rows = plan.certificates.map((item) => ({ uf: item.uf, tipo: `${item.uf} · ${item.type}`, status: "pending", resultado: "indisponivel", provider: item.provider }));
  for (let i = 0; i < plan.certificates.length; i++) {
    const item = plan.certificates[i];
    await input.onProgress?.({ stage: "autonomous_certificates", total: rows.length, completed: i, currentCertificate: rows[i].tipo, certidoes: rows });
    try {
      if (item.provider === "portal") {
        const birthDate = extra.stateCourtFields.birthDate?.split("/").reverse().join("-");
        const native = await collectPortal({ ...input, onProgress: undefined, extraFields: { ...extra, autonomousUfs: [], stateCourtUf: item.uf, stateCourtName: item.uf === "DF" ? "TJDFT" : `TJ${item.uf}`, stateCourtUrl: "", stateCourtFields: { ...extra.stateCourtFields, birthDate, instance: "1", nature: item.portalType, certificateKind: item.portalType }, stateCourtCertificateTypes: [item.portalType], tjdftCertificateTypes: [item.portalType] } });
        if (native.dados?.assistedSession) await closeAssisted?.(native.dados.assistedSession);
        const certificate = native.dados?.certidoes?.[0];
        if (!certificate?.pdfPath) throw new Error("official_pdf_unavailable");
        const buffer = await readFile(certificate.pdfPath);
        const text = await readPdf(buffer);
        if (!certificatePdfMatches(buffer, text, input.documento, extra.stateCourtFields.fullName)) throw new Error("evidence_identity_unverified");
        if (!certificateScopeMatches(text, item.expectedText, item.uf)) throw new Error("evidence_scope_mismatch");
        rows[i] = { ...rows[i], ...certificate, uf: item.uf, tipo: rows[i].tipo, status: "success" };
      } else {
        const response = await queryCertificate({ ...extra.stateCourtFields, document: input.documento, documentType: "cpf", uf: item.uf, certificateType: item.providerType || item.type, generatePdf: true, authorizationConfirmed: true, paidQueryConfirmed: true, requestId: `${input.consultaId}:${item.uf}:${item.type}` }, input.usageContext);
        if (!response.result?.certificate?.evidenceUrl) throw new Error(response.reason || "official_pdf_unavailable");
        const buffer = await download(response.result.certificate.evidenceUrl);
        const text = await readPdf(buffer);
        if (!certificatePdfMatches(buffer, text, input.documento, extra.stateCourtFields.fullName)) throw new Error("evidence_identity_unverified");
        if (!certificateScopeMatches(text, item.expectedText, item.uf)) throw new Error("evidence_scope_mismatch");
        const saved = await savePdf({ consultaId: input.consultaId, fonte: "tjdft", fileName: `${item.uf}-${i}.pdf`, buffer });
        rows[i] = { ...rows[i], status: "success", pdfPath: saved.pdfPath, resultado: response.result.analysis.occurrence === true ? "consta" : response.result.analysis.occurrence === false ? "nada_consta" : "indisponivel", providerReference: response.result.providerReference };
      }
    } catch (error) {
      rows[i] = { ...rows[i], status: "failed", errorMessage: /^[a-z_]+$/.test(error.message) ? error.message : "certificate_unavailable" };
    }
  }
  const downloaded = rows.filter((item) => item.pdfPath).length;
  const dados = { modo: "autonomous", certidoes: rows, totalCertidoes: rows.length, certidoesBaixadas: downloaded, certidoesComFalha: rows.filter((item) => item.status !== "success").map((item) => item.tipo), progress: { stage: "completed", completed: rows.length, total: rows.length, updatedAt: new Date().toISOString() }, resumo: `${downloaded} de ${rows.length} certidões obtidas. A cobertura se limita aos estados e tipos selecionados.` };
  if (!downloaded) return failedResult("tjdft", "Nenhum PDF oficial disponível nesta tentativa.", dados);
  const outcome = rows.some((item) => item.resultado === "consta") ? "consta" : rows.some((item) => item.resultado === "indisponivel") ? "indisponivel" : "nada_consta";
  return successResult("tjdft", outcome, dados);
}
