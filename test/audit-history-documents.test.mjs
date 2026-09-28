import assert from "node:assert/strict";
import test from "node:test";
import { createAuditService } from "../services/audit.service.mjs";

const owner = { tenantId: "history-documents-tenant", user: { id: "owner" } };
const data = { certidoes: [{ tipo: "Indisponível", status: "failed" }, { tipo: "Certidão obtida", pdfPath: "/private/second.pdf" }] };

function assertDocumentLinks(history, consultaId) {
  const audit = history.audits.find((item) => item.consultaId === consultaId);
  assert.deepEqual(audit.pdfs, [
    { fonte: "batch", titulo: "Certidão obtida", url: `/audit/${consultaId}/documents/batch/1` },
    { fonte: "single", titulo: "PDF da certidao", url: `/audit/${consultaId}/documents/single/0` },
  ]);
  assert.doesNotMatch(JSON.stringify(audit.pdfs), /storage\/pdfs|private|\.pdf/);
}

test("memory history links use owned document routes and preserve indices after missing PDFs", async () => {
  const service = createAuditService({
    getAuthContext: async () => owner,
    customCollectors: {
      batch: { collect: async () => ({ status: "success", resultado: "indisponivel", dados: data, pdfPath: "/private/duplicate.pdf" }) },
      single: { collect: async () => ({ status: "success", resultado: "indisponivel", pdfPath: "/private/single.pdf" }) },
    },
  });
  const started = await service.startAudit({ body: { documento: "52998224725", tipoDocumento: "cpf", fontes: ["batch", "single"] } });
  for (let attempt = 0; attempt < 100; attempt++) {
    const audit = await service.findAudit(started.consultaId, {});
    if (audit.status === "success") break;
    await new Promise((done) => setTimeout(done, 5));
  }
  assertDocumentLinks(await service.listAuditHistory({}), started.consultaId);
});

test("database history uses the same authenticated PDF links as memory history", async () => {
  const consultaId = "12345678-1234-1234-1234-123456789012";
  const pool = { query: async (sql) => sql.includes("FROM audita_audits")
    ? { rows: [{ id: 1, public_id: consultaId, document_masked: "masked", tipo_documento: "cpf" }] }
    : { rows: [
      { fonte: "batch", status: "success", resultado: "indisponivel", dados_json: data, pdf_path: "/private/duplicate.pdf" },
      { fonte: "single", status: "success", resultado: "indisponivel", dados_json: {}, pdf_path: "/private/single.pdf" },
    ] } };
  const service = createAuditService({ getAuthContext: async () => owner, getDb: () => ({ pool, dbReady: true }) });
  assertDocumentLinks(await service.listAuditHistory({}), consultaId);
});
