import test from "node:test";
import assert from "node:assert/strict";
import { unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { collect, fillTjdftFirstStep, fillTjdftSecondStep, fillEsTjesPageFields, getMissingStateCourtFields, hasEsTjesPrintableCertificateSignal, saveNativeCertificatePdf } from "../collectors/tjdft.collector.mjs";

const company = { tipoDocumento: "cnpj", documento: "11222333000181", extraFields: { stateCourtFields: { fullName: "EMPRESA FICTICIA TESTE LTDA", motherName: "Nao preencher", birthDate: "1980-01-01", rg: "Nao preencher" } } };
function pageStub() {
  const calls = [];
  const locator = (selector) => ({
    nth: (index) => locator(`${selector}:${index}`),
    async count() { return 1; },
    async fill(value) { calls.push(["fill", selector, value]); },
    async check() { calls.push(["check", selector]); },
    async click() { calls.push(["click", selector]); },
    async selectOption(value) { calls.push(["select", selector, value]); },
  });
  return { calls, locator, getByRole: (role) => locator(role), async waitForFunction() { return { async jsonValue() { return "ready"; } }; } };
}

test("TJDFT CNPJ skips the removed first-name control and preserves the requested certificate type", async () => {
  const page = pageStub();
  await fillTjdftFirstStep(page, company.documento, "EMPRESA", { radioIndex: 2 });
  assert.deepEqual(page.calls, [["fill", "input[type='text']:0", "11.222.333/0001-81"], ["click", ".q-radio:2"], ["click", "button"]]);
  const person = pageStub();
  await fillTjdftFirstStep(person, "52998224725", "Pessoa", { radioIndex: 1 });
  assert.ok(person.calls.some((call) => call[1] === "input[type='text']:1" && call[2] === "Pessoa"));
});

test("current TJES form fills company identity without personal affiliation, birth date or RG", async () => {
  const page = pageStub();
  await fillEsTjesPageFields(page, company, { id: "falencia" });
  assert.deepEqual(page.calls, [["check", "#rbPessoaJ"], ["fill", "#edCnpj", "11.222.333/0001-81"], ["select", "#cbInstancia", "1"], ["select", "#cbNatureza1", "11"], ["fill", "#edRazaoSocial", "EMPRESA FICTICIA TESTE LTDA"]]);
  const person = pageStub();
  await fillEsTjesPageFields(person, { tipoDocumento: "cpf", documento: "52998224725", extraFields: { stateCourtFields: { fullName: "Pessoa Ficticia", motherName: "Mae Ficticia", instance: "2" } } }, { id: "criminal" });
  assert.ok(person.calls.some((call) => call[1] === "#edPrimeiroNome" && call[2] === "Pessoa"));
  assert.ok(person.calls.some((call) => call[1] === "#edMae" && call[2] === "Mae Ficticia"));
  assert.ok(person.calls.some((call) => call[1] === "#cbNatureza2" && call[2] === "5"));
});

test("TJDFT PF civel still confirms the second step when affiliation is optional and empty", async () => {
  const page = pageStub();
  await fillTjdftSecondStep(page, "", "");
  assert.deepEqual(page.calls, [["click", "button"]]);
});

test("native DF/ES company requirements never inherit personal identity fields; ES PF still requires mother once", () => {
  const requiredFields = ["document", "fullName", "motherName", "fatherName", "birthDate", "firstName", "gender", "rg"];
  const input = { ...company, extraFields: { stateCourtFields: { companyName: "EMPRESA FICTICIA TESTE LTDA" } } };
  for (const uf of ["DF", "ES"]) {
    assert.deepEqual(getMissingStateCourtFields(input, { uf, requiredFields }), []);
    assert.deepEqual(getMissingStateCourtFields({ ...input, extraFields: {} }, { uf, requiredFields }), ["fullName"]);
  }
  assert.deepEqual(getMissingStateCourtFields({ tipoDocumento: "cpf", documento: "52998224725", extraFields: { stateCourtFields: { fullName: "Pessoa Ficticia" } } }, { uf: "ES", requiredFields: ["document", "fullName", "motherName"] }), ["motherName"]);
  for (const uf of ["MA", "GO", "TO"]) assert.ok(getMissingStateCourtFields(input, { uf, requiredFields }).includes("motherName"));
});

test("TJES request form is never printed as an issued certificate merely because its header says Nada Consta", () => {
  assert.equal(hasEsTjesPrintableCertificateSignal("Tribunal de Justiça do Estado do Espírito Santo Emissão de Certidão Negativa de Nada Consta Tipo de Pessoa CPF CNPJ Primeiro Nome Natureza da Certidão Emitir Certidão"), false);
  assert.equal(hasEsTjesPrintableCertificateSignal("Tribunal de Justiça do Estado do Espírito Santo Certidão Negativa Dados da certidão Nada consta"), true);
});

test("native company PDF is saved only after matching the company identity", async () => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage().drawText("CERTIDAO\nEMPRESA FICTICIA TESTE LTDA\nCNPJ 11.222.333/0001-81\nNADA CONSTA", { font, size: 12 });
  const buffer = Buffer.from(await pdf.save({ useObjectStreams: false }));
  const input = { ...company, consultaId: `pj-portal-test-${randomUUID()}` };
  const saved = await saveNativeCertificatePdf(input, "ficticio.pdf", buffer);
  try {
    assert.match(saved.rawText, /FICTICIA/);
    await assert.rejects(saveNativeCertificatePdf({ ...input, documento: "99888777000166" }, "outra-empresa.pdf", buffer), /evidence_identity_unverified/);
    await assert.rejects(saveNativeCertificatePdf(input, "html.pdf", Buffer.from("<html>Portal indisponivel</html>")), /evidence_identity_unverified/);
  } finally { await unlink(saved.pdfPath); }
});

test("TJTO company is directed to official costs and GOV.BR without opening a browser", async () => {
  const result = await collect({ ...company, extraFields: { ...company.extraFields, stateCourtUf: "TO" } });
  assert.equal(result.status, "manual_required");
  assert.match(result.errorMessage, /custas/i);
  assert.equal(result.dados.officialUrl, "https://www.tjto.jus.br/servicos/certidoes");
});
