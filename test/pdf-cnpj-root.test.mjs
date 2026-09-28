import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { pdfHasCnpjRoot } from "../services/pdf-cnpj-root.service.mjs";

const cnpj = "12345678000195";
const root = "12.345.678/";
const rsClause = "CNPJ base composto pelos 8 primeiros digitos. Todos os estabelecimentos da empresa foram avaliados";
async function pdf(lines) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const page = document.addPage([700, 800]);
  for (const [text, x = 30, y = 700] of lines) page.drawText(text, { x, y, font, size: 10 });
  return Buffer.from(await document.save());
}

test("recognizes the reviewed SP and RS root fields by position and RJ inline field", async () => {
  const sp = await pdf([["CPF/CNPJ Raiz:", 30, 700], [root, 130, 700.072]]);
  assert.equal(await pdfHasCnpjRoot(sp, cnpj, { template: "sp_municipal" }), true);
  const rj = await pdf([["CPF/RAIZ DO CNPJ: 12.345.678", 30, 700]]);
  assert.equal(await pdfHasCnpjRoot(rj, cnpj, { template: "rj_fiscal" }), true);
  const rs = await pdf([["CNPJ:", 30, 700], [root, 94, 700], [rsClause, 30, 500]]);
  assert.equal(await pdfHasCnpjRoot(rs, cnpj, { template: "rs_fiscal" }), true);
});

test("rejects unrelated roots, misplaced values, mismatches and unknown templates", async () => {
  for (const lines of [
    [[root, 130, 700]],
    [["CPF/CNPJ Raiz:", 30, 700], [root, 130, 690]],
    [["CPF/CNPJ Raiz:", 30, 700], [root, 300, 700]],
    [["CPF/CNPJ Raiz:", 200, 700], [root, 30, 700]],
    [["CPF/CNPJ Raiz:", 30, 700], ["98.765.432/", 130, 700]],
    [["CPF/CNPJ Raiz:", 30, 700], ["Protocolo", 110, 700], [root, 155, 700]],
    [["CPF/CNPJ Raiz:", 30, 700], [root, 125, 700], ["98.765.432/", 145, 700]],
    [["CPF/CNPJ Raiz:", 30, 700], [root, 130, 700], ["CPF/CNPJ Raiz:", 30, 650], [root, 130, 650]],
  ]) assert.equal(await pdfHasCnpjRoot(await pdf(lines), cnpj, { template: "sp_municipal" }), false);
  assert.equal(await pdfHasCnpjRoot(await pdf([["CPF/CNPJ Raiz:", 30, 700], [root, 130, 700]]), cnpj, { template: "unknown" }), false);
});

test("requires the RS whole-company scope clause and rejects inline ambiguity", async () => {
  assert.equal(await pdfHasCnpjRoot(await pdf([["CNPJ:", 30, 700], [root, 94, 700]]), cnpj, { template: "rs_fiscal" }), false);
  for (const text of ["CPF/RAIZ DO CNPJ: 98.765.432", "CPF/RAIZ DO CNPJ: 12.345.678 protocolo 123", "CPF/RAIZ DO CNPJ: 12.345.678/0001-95"]) {
    assert.equal(await pdfHasCnpjRoot(await pdf([[text]]), cnpj, { template: "rj_fiscal" }), false);
  }
  assert.equal(await pdfHasCnpjRoot(Buffer.from("not PDF"), cnpj, { template: "sp_municipal" }), false);
});
