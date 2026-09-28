import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createAuditService } from "../services/audit.service.mjs";

test("audit PDF download requires ownership and serves only referenced private PDFs", async (t) => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "audita-download-test-"));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  const pdfRoot = join(fixtureRoot, "pdfs");
  await mkdir(pdfRoot);
  const validPdf = join(pdfRoot, "certificate.pdf");
  const invalidPdf = join(pdfRoot, "invalid.pdf");
  const outsidePdf = join(fixtureRoot, "outside.pdf");
  const bytes = Buffer.from("%PDF-1.4\nSynthetic certificate fixture\n%%EOF");
  await writeFile(validPdf, bytes);
  await writeFile(invalidPdf, "<html>Not a PDF</html>");
  await writeFile(outsidePdf, bytes);
  const linkPdf = join(pdfRoot, "linked.pdf");
  let hasSymlink = true;
  try { await symlink(outsidePdf, linkPdf, "file"); }
  catch (error) { if (error.code === "EPERM") hasSymlink = false; else throw error; }

  const owner = { tenantId: "download-tenant", user: { id: "owner" } };
  const authContext = async (request) => request.auth || { unauthorized: true };
  const certificates = [validPdf, outsidePdf, invalidPdf, join(pdfRoot, "missing.pdf"), linkPdf]
    .map((pdfPath) => ({ pdfPath, status: "success" }));
  const auditService = createAuditService({
    getAuthContext: authContext,
    customCollectors: {
      downloads: { collect: async () => ({ status: "success", resultado: "indisponivel", dados: { certidoes: certificates } }) },
      single: { collect: async () => ({ status: "success", resultado: "indisponivel", dados: {}, pdfPath: validPdf }) },
    },
  });
  const created = await auditService.startAudit({ auth: owner, body: {
    tipoDocumento: "cpf", documento: "52998224725", fontes: ["downloads", "single"], authorizationConfirmed: true,
  } });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const audit = await auditService.findAudit(created.consultaId, { auth: owner });
    if (audit.resultados.every((item) => item.status === "success")) break;
    await new Promise((done) => setTimeout(done, 5));
  }
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const start = source.indexOf("  const auditDocumentMatch =");
  const end = source.indexOf("  const publicAuditMatch =", start);
  assert.ok(start > 0 && end > start);
  const context = vm.createContext({
    auditService, getTenantIdForRequest: authContext, getPdfRoot: () => pdfRoot,
    dirname, resolve, lstat, realpath, readFile,
    sendJson: (response, status, body) => { response.status = status; response.body = body; },
  });
  vm.runInContext(`async function handleDownload(pathname, request, response) { ${source.slice(start, end)} }`, context);
  const request = async (auth = owner, suffix = "downloads/0", id = created.consultaId) => {
    const response = {
      writeHead(status, headers) { this.status = status; this.headers = headers; },
      end(body) { this.body = body; },
    };
    const handled = await context.handleDownload(`/audit/${id}/documents/${suffix}`, { method: "GET", auth }, response);
    return { ...response, handled };
  };

  const success = await request();
  assert.equal(success.status, 200);
  assert.deepEqual(success.body, bytes);
  assert.equal(success.headers["content-type"], "application/pdf");
  assert.equal(success.headers["cache-control"], "private, no-store");
  assert.equal(success.headers["x-content-type-options"], "nosniff");
  assert.equal((await request(null)).status, 401);
  assert.equal((await request({ tenantId: owner.tenantId, user: null })).status, 401);
  assert.equal((await request({ ...owner, user: { id: "other-user" } })).status, 404);
  assert.equal((await request({ ...owner, tenantId: "other-tenant" })).status, 404);
  assert.equal((await request(owner, "downloads/0", "00000000-0000-0000-0000-000000000000")).status, 404);
  for (const suffix of ["downloads/1", "downloads/2", "downloads/3", "downloads/9999", "unknown/0", "single/1"]) {
    const denied = await request(owner, suffix);
    assert.equal(denied.status, 404, suffix);
    assert.equal(JSON.stringify(denied.body).includes(fixtureRoot), false);
  }
  assert.equal((await request(owner, "single/0")).status, 200);
  assert.equal((await request(owner, "downloads/../0")).handled, undefined);
  assert.equal((await request(owner, "downloads/%2e%2e")).handled, undefined);
  if (hasSymlink) assert.equal((await request(owner, "downloads/4")).status, 404);
  else t.diagnostic("File symlink creation unavailable; ownership, outside-root paths, missing files and PDF validation were checked.");
});
