import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { PDFDocument } from "pdf-lib";

import {
  appendJecPetitionAttachments,
  buildJecCalculationReportHtml,
  buildJecPetitionHtml,
  buildLegalServicesAgreementHtml,
  buildPowerOfAttorneyHtml,
  createLegalServicesAgreementPdf,
  createPowerOfAttorneyPdf,
  createJecPetitionPdf,
  resolveJecPdfBrowserExecutable,
  validatePowerOfAttorneyAcceptance,
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

  assert.match(reportHtml, /class="audit-report-brand">IA AUDITA/);
  assert.match(reportHtml, /RELATÓRIO TÉCNICO DE AUDITORIA FINANCEIRA INDÉBITO E PERDAS E DANOS/);
  assert.doesNotMatch(reportHtml, /IA AUDITA - RELATÓRIO/);
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

async function pdfWithPageSizes(sizes) {
  const pdf = await PDFDocument.create();
  for (const size of sizes) pdf.addPage(size);
  return pdf.save();
}

test("PDF attachments are appended after every base page in the supplied order", async () => {
  const mergedBytes = await appendJecPetitionAttachments(
    await pdfWithPageSizes([[310, 410], [320, 420]]),
    [
      { label: "identity", bytes: await pdfWithPageSizes([[510, 610]]) },
      {
        label: "residence",
        bytes: await pdfWithPageSizes([[710, 810], [720, 820]]),
      },
    ],
  );
  const merged = await PDFDocument.load(mergedBytes);

  assert.deepEqual(
    merged.getPages().map((page) => [page.getWidth(), page.getHeight()]),
    [[310, 410], [320, 420], [510, 610], [710, 810], [720, 820]],
  );
});

test("PDF attachment composition rejects malformed files with mappable codes", async () => {
  const basePdf = await pdfWithPageSizes([[310, 410]]);

  await assert.rejects(
    appendJecPetitionAttachments(Buffer.from("not a pdf")),
    (error) => error.code === "jec_petition_pdf_invalid",
  );
  await assert.rejects(
    appendJecPetitionAttachments(basePdf, [
      { label: "identity", bytes: Buffer.from("not a pdf") },
    ]),
    (error) =>
      error.code === "jec_petition_attachment_invalid" &&
      error.attachment === "identity",
  );
});

test("petition upload accepts only identity and residence while requiring electronic acceptance", () => {
  const serverSource = readFileSync(new URL("../server.mjs", import.meta.url), "utf8");
  const requestReader = serverSource.slice(
    serverSource.indexOf("async function readJecPetitionPdfRequest"),
    serverSource.indexOf("function sendJson"),
  );

  assert.match(requestReader, /readBufferBody\(request, request\.url\?\.includes\("\/petitions\/submit"\) \? 90 \* 1024 \* 1024 : 26 \* 1024 \* 1024\)/);
  assert.match(requestReader, /file\.size > 12 \* 1024 \* 1024/);
  assert.match(requestReader, /PDFDocument\.load\(bytes\)/);
  assert.doesNotMatch(requestReader, /signedPowerOfAttorney|hasPdfDigitalSignature/);
  assert.match(
    requestReader,
    /attachments: \[identityDocument, proofOfResidence\]/,
  );
  assert.match(serverSource, /validatePowerOfAttorneyAcceptance\(\{/);
  assert.match(serverSource, /\/api\/jec\/legal-documents/);
  assert.match(serverSource, /documents\.append\(\s*"powerOfAttorney"/);
  assert.match(serverSource, /documents\.append\(\s*"legalServicesAgreement"/);
  assert.match(serverSource, /createLegalServicesAgreementPdf\(\{/);
  assert.match(serverSource, /JEC_POWER_OF_ATTORNEY_ACCEPTANCE_REQUIRED: 422/);
  assert.match(serverSource, /JEC_POWER_OF_ATTORNEY_NAME_MISMATCH: 422/);
  assert.doesNotMatch(serverSource, /Assine o PDF no gov\.br|JEC_PDF_SIGNATURE_REQUIRED/);
});

test("electronic acceptance requires the typed claimant name", () => {
  assert.deepEqual(
    validatePowerOfAttorneyAcceptance({
      claimant: { fullName: "João da Silva" },
      powerOfAttorneyAcceptance: {
        accepted: true,
        signerName: "  joao   DA SILVA ",
      },
    }),
    {
      accepted: true,
      signerName: "joao DA SILVA",
      statement: "Declaro que li e aceito integralmente a Procuração Ad Judicia et Extra e o Contrato de Prestação de Serviços Jurídicos e Honorários Advocatícios, e que a digitação do meu nome completo representa minha assinatura eletrônica e manifestação de vontade.",
      version: "2026-08-28-contract-1",
    },
  );
  assert.throws(
    () => validatePowerOfAttorneyAcceptance({
      claimant: { fullName: "João da Silva" },
      powerOfAttorneyAcceptance: { accepted: true, signerName: "Outra Pessoa" },
    }),
    (error) => error.code === "JEC_POWER_OF_ATTORNEY_NAME_MISMATCH",
  );
});

test("power of attorney contains the typed signature and renders as a separate PDF", async () => {
  const document = {
    claimant: {
      fullName: "João da Silva",
      document: "52998224725",
      rg: "12.345.678-9",
      nationality: "Brasileiro",
      maritalStatus: "Solteiro",
      profession: "Analista",
      email: "joao@example.com",
      phone: "11999999999",
      street: "Rua das Flores",
      addressNumber: "123",
      district: "Centro",
      postalCode: "01001000",
      city: "São Paulo",
      uf: "SP",
    },
    acceptance: {
      accepted: true,
      signerName: "João da Silva",
      statement: "Declaro que li e aceito integralmente esta procuração.",
      version: "2026-08-28",
      id: "acceptance-test-id",
      acceptedAt: "2026-08-28T15:00:00.000Z",
      ipAddress: "127.0.0.1",
      userAgent: "Test Browser",
      fingerprint: "abc123",
    },
  };
  const html = buildPowerOfAttorneyHtml(document);
  assert.match(html, /Assinado eletronicamente por/);
  assert.match(html, /João da Silva/);
  assert.match(html, /ID acceptan/);
  assert.doesNotMatch(html, /REGISTRO DE ACEITE ELETRÔNICO|ICP-Brasil|Origem técnica do acesso/);

  let renderedHtml = "";
  let browserClosed = false;
  const bytes = Buffer.from(await createPowerOfAttorneyPdf(document, {
    launch: async () => ({
      newPage: async () => ({
        setContent: async (value) => { renderedHtml = value; },
        emulateMedia: async () => {},
        pdf: async () => pdfWithPageSizes([[595, 842]]),
      }),
      close: async () => { browserClosed = true; },
    }),
  }));
  assert.match(renderedHtml, /João da Silva/);
  assert.equal(bytes.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.equal(browserClosed, true);
  const output = await PDFDocument.load(bytes);
  assert.equal(output.getPageCount(), 1);
  assert.match(output.getSubject(), /acceptance-test-id/);
  assert.match(output.getSubject(), /abc123/);
});

test("legal-services contract preserves the supplied terms and uses the same compact acceptance", async () => {
  const document = {
    claimant: {
      fullName: "Maria José <Cliente>",
      document: "52998224725",
      rg: "12.345.678-9",
      nationality: "Brasileira",
      maritalStatus: "Solteira",
      profession: "Analista",
      street: "Rua das Flores",
      addressNumber: "123",
      district: "Centro",
      postalCode: "01001-000",
      city: "São Paulo",
      uf: "SP",
    },
    acceptance: {
      accepted: true,
      signerName: "Maria José <Cliente>",
      id: "shared-acceptance-id",
      acceptedAt: "2026-08-28T15:00:00.000Z",
      fingerprint: "shared-fingerprint",
    },
  };
  const html = buildLegalServicesAgreementHtml(document);
  assert.match(html, /CONTRATO DE PRESTAÇÃO DE SERVIÇOS JURÍDICOS E HONORÁRIOS ADVOCATÍCIOS/);
  assert.match(html, /10% \(dez por cento\)/);
  assert.match(html, /fica totalmente isento\(a\) do pagamento de taxas judiciárias/);
  assert.match(html, /CONTRATADO NÃO interporá recurso/);
  assert.match(html, /risco financeiro direto[\s\S]*?ZERO/);
  assert.match(html, /Advogado responsável pendente de vinculação/);
  assert.match(html, /Assinado eletronicamente pelo contratante/);
  assert.match(html, /Maria José &lt;Cliente&gt;/);
  assert.match(html, /ID shared-a/);

  let renderedHtml = "";
  let browserClosed = false;
  const bytes = Buffer.from(await createLegalServicesAgreementPdf(document, {
    launch: async () => ({
      newPage: async () => ({
        setContent: async (value) => { renderedHtml = value; },
        emulateMedia: async () => {},
        pdf: async () => pdfWithPageSizes([[595, 842], [595, 842]]),
      }),
      close: async () => { browserClosed = true; },
    }),
  }));
  assert.match(renderedHtml, /shared-a/);
  assert.equal(browserClosed, true);
  const output = await PDFDocument.load(bytes);
  assert.equal(output.getPageCount(), 2);
  assert.match(output.getSubject(), /shared-acceptance-id/);
  assert.match(output.getSubject(), /shared-fingerprint/);
});
