import test from "node:test";
import assert from "node:assert/strict";
import { collectAutonomousCertificates, certificatePdfMatches, certificateScopeMatches, downloadCertificateEvidence, planAutonomousCertificates } from "../services/state-court-autonomous.service.mjs";
const configuration = { configured: true, allowedUfs: ["AP"], pdfTotalCostBrl: 0.54 };

test("autonomous plan rejects unsupported coverage and deduplicates states", () => {
  assert.throws(() => planAutonomousCertificates(["SP"], configuration), /unsupported/);
  assert.throws(() => planAutonomousCertificates(["AP"], {}), /unsupported/);
  assert.equal(planAutonomousCertificates(["AP", "AP"], configuration).certificates.length, 2);
  assert.equal(planAutonomousCertificates(["AP"], configuration).maxProviderCostBrl, 1.08);
});

test("autonomous batch keeps a failed certificate pending in the outcome and preserves verified PDFs", async () => {
  const buffer = Buffer.from("%PDF-test");
  const progress = [];
  let requests = 0;
  const input = { consultaId: "test-batch", documento: "52998224725", tipoDocumento: "cpf", extraFields: { authorizationConfirmed: true, autonomousUfs: ["AP"], paidQueryConfirmed: true, stateCourtFields: { fullName: "Pessoa Teste" } }, onProgress: async (value) => progress.push(value.completed) };
  const options = { configuration, queryCertificate: async (request) => {
    requests++;
    assert.equal(request.generatePdf, true);
    return requests === 1 ? { result: { certificate: { evidenceUrl: "https://apiv3.directd.com.br/evidence" }, analysis: { occurrence: false } } } : { failed: true, reason: "provider_timeout" };
  }, download: async () => buffer, readPdf: async () => "TRIBUNAL DO AMAPA CERTIDAO CIVEL Pessoa Teste 52998224725", savePdf: async () => ({ pdfPath: "private-test.pdf" }) };
  await assert.rejects(() => collectAutonomousCertificates({ ...input, extraFields: { ...input.extraFields, paidQueryConfirmed: false } }, options), /paid_query/);
  assert.equal(requests, 0);
  const result = await collectAutonomousCertificates(input, options);
  assert.equal(result.resultado, "indisponivel");
  assert.equal(result.dados.certidoesBaixadas, 1);
  assert.equal(result.dados.certidoesComFalha.length, 1);
  assert.equal(result.dados.progress.stage, "completed");
  assert.deepEqual(progress, [0, 1]);
  assert.equal(certificatePdfMatches(buffer, "CERTIDAO Pessoa Teste 11111111111", input.documento, "Pessoa Teste"), false);
  assert.equal(certificateScopeMatches("Certidão de Distribuição de Ação Militar", "Certidão de Distribuição de Ação Criminal"), false);
  assert.equal(certificateScopeMatches("Tribunal do Pará CERTIDÃO CÍVEL", "CERTIDÃO CÍVEL", "AP"), false);
  await assert.rejects(() => downloadCertificateEvidence("https://127.0.0.1/document.pdf"), /invalid_evidence_host/);
});

test("autonomous certificates require explicit consent before paid queries or public portal collection", async () => {
  let calls = 0;
  const options = { configuration, queryCertificate: async () => { calls++; }, collectPortal: async () => { calls++; } };
  for (const uf of ["AP", "DF"]) {
    for (const authorizationConfirmed of [undefined, false, "true"]) {
      await assert.rejects(() => collectAutonomousCertificates({
        consultaId: "test-consent", documento: "52998224725", tipoDocumento: "cpf",
        extraFields: { authorizationConfirmed, autonomousUfs: [uf], paidQueryConfirmed: true, stateCourtFields: { fullName: "Pessoa Teste" } },
      }, options), /authorization_required/);
    }
  }
  assert.equal(calls, 0);
});
