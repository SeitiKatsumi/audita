import assert from "node:assert/strict";
import test from "node:test";

import {
  buildJecCalculationReportHtml,
  buildJecPetitionHtml,
  createJecPetitionPdf,
  resolveJecPdfBrowserExecutable,
} from "../services/jec-petition-pdf.service.mjs";

const prepared = {
  ready: true,
  generatedAt: "2026-07-27T15:00:00.000Z",
  template: {
    id: "audited_values",
    label: "Relatório Técnico de Auditoria - Modelo 1 (valores apurados)",
  },
  claimant: {
    fullName: "Cliente Teste",
  },
  draft: [
    "EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DO JUIZADO ESPECIAL CÍVEL DA COMARCA DE SÃO PAULO/SP",
    "",
    "Cliente Teste, brasileiro, solteiro, analista, apresenta a presente:",
    "",
    "AÇÃO DECLARATÓRIA DE INEXISTÊNCIA DE DÉBITO",
    "",
    "I. DOS FATOS",
    "",
    "Os fatos serão revisados pelo consumidor antes do protocolo.",
    "",
    "São Paulo/SP, 27 de julho de 2026.",
    "",
    "Cliente Teste",
    "",
    "CPF nº 52998224725",
    "",
    "(Jus Postulandi - Art. 9º da Lei 9.099/95)",
  ].join("\n"),
};

const calculationReport = {
  items: [
    {
      date: "2025-07-10",
      amount: 18.9,
      interest: 1.9,
      correction: 0.95,
      updatedPrincipal: 21.75,
      doubleWithAdjustments: 40.65,
    },
  ],
  updatedPrincipal: 21.75,
  doubleWithAdjustments: 40.65,
  damagesAmount: 4_400,
  estimatedClaimValue: 4_462.4,
  calculationAsOf: "2026-08-26",
};

test("petition HTML uses A4 legal-document typography and escapes content", () => {
  const html = buildJecPetitionHtml({
    ...prepared,
    draft: prepared.draft.replace("analista", "analista <teste>"),
  });

  assert.match(html, /@page\s*\{[\s\S]*size:\s*A4/);
  assert.match(html, /Times New Roman/);
  assert.match(html, /class="court-address"/);
  assert.match(html, /class="action-title"/);
  assert.match(html, /class="signature-block"/);
  assert.match(html, /analista &lt;teste&gt;/);
});

test("petition HTML appends the calculation report after the legal document", () => {
  const reportHtml = buildJecCalculationReportHtml({ calculationReport });
  const html = buildJecPetitionHtml({ ...prepared, calculationReport });

  assert.match(reportHtml, /RELATÓRIO TÉCNICO DE AUDITORIA FINANCEIRA/);
  assert.match(reportHtml, /R\$\s*4\.400,00/);
  assert.match(reportHtml, /R\$\s*4\.462,40/);
  assert.match(reportHtml, /10\/07\/2025/);
  assert.match(html, /page-break-before:\s*always/);
  assert.ok(
    html.indexOf('<section class="signature-block">') <
      html.indexOf('<section class="audit-calculation-report"'),
  );
});

test("PDF renderer accepts both petition models and returns PDF bytes", async () => {
  for (const template of [
    { id: "audited_values", label: "Modelo 1", sourceModel: 1 },
    { id: "document_exhibition", label: "Modelo 2", sourceModel: 2 },
  ]) {
    let renderedHtml = "";
    let browserClosed = false;
    const bytes = Buffer.from(
      await createJecPetitionPdf(
        { ...prepared, template },
        {
          launch: async () => ({
            newPage: async () => ({
              setContent: async (html) => {
                renderedHtml = html;
              },
              emulateMedia: async () => {},
              pdf: async () => Buffer.from("%PDF-model-test"),
            }),
            close: async () => {
              browserClosed = true;
            },
          }),
        },
      ),
    );

    assert.match(renderedHtml, new RegExp(template.label));
    assert.equal(bytes.subarray(0, 5).toString("ascii"), "%PDF-");
    assert.equal(browserClosed, true);
  }
});

test("PDF browser resolution falls back to an installed system browser", () => {
  const executable = resolveJecPdfBrowserExecutable({
    env: { JEC_PDF_BROWSER_EXECUTABLE_PATH: "C:\\Browsers\\chrome.exe" },
    bundledExecutable: "C:\\missing\\playwright.exe",
    fileExists: (candidate) => candidate === "C:\\Browsers\\chrome.exe",
  });

  assert.equal(executable, "C:\\Browsers\\chrome.exe");
});

test("PDF generation refuses an incomplete petition before opening a browser", async () => {
  let launched = false;
  await assert.rejects(
    createJecPetitionPdf(
      { ...prepared, ready: false, missingFields: ["caseValue"] },
      {
        launch: async () => {
          launched = true;
          return null;
        },
      },
    ),
    (error) => {
      assert.equal(error.code, "jec_petition_incomplete");
      assert.deepEqual(error.missingFields, ["caseValue"]);
      return true;
    },
  );
  assert.equal(launched, false);
});
