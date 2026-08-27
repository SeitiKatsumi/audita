import { existsSync } from "node:fs";
import { join } from "node:path";

import { PDFDocument } from "pdf-lib";
import { chromium } from "playwright";

export function resolveJecPdfBrowserExecutable({
  env = process.env,
  fileExists = existsSync,
  bundledExecutable = "",
} = {}) {
  let playwrightExecutable = bundledExecutable;
  if (!playwrightExecutable) {
    try {
      playwrightExecutable = chromium.executablePath();
    } catch {
      playwrightExecutable = "";
    }
  }
  const candidates = [
    env.JEC_PDF_BROWSER_EXECUTABLE_PATH,
    playwrightExecutable,
    env.LOCALAPPDATA && join(env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
    env.ProgramFiles && join(env.ProgramFiles, "Google", "Chrome", "Application", "chrome.exe"),
    env["ProgramFiles(x86)"] && join(env["ProgramFiles(x86)"], "Google", "Chrome", "Application", "chrome.exe"),
    env.ProgramFiles && join(env.ProgramFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    env["ProgramFiles(x86)"] && join(env["ProgramFiles(x86)"], "Microsoft", "Edge", "Application", "msedge.exe"),
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ].filter(Boolean);
  return candidates.find((candidate) => fileExists(candidate)) || "";
}

function launchJecPdfBrowser(options = {}) {
  const executablePath = resolveJecPdfBrowserExecutable();
  return chromium.launch({
    ...options,
    ...(executablePath ? { executablePath } : {}),
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatReportMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "-";
}

function formatReportDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "Data não informada";
}

export function buildJecCalculationReportHtml(prepared) {
  const report = prepared?.calculationReport;
  if (!Array.isArray(report?.items) || !report.items.length) return "";

  const rows = report.items.map((item) => `
    <tr>
      <td>${escapeHtml(formatReportDate(item.date))}</td>
      <td>${escapeHtml(formatReportMoney(item.amount))}</td>
      <td>${escapeHtml(formatReportMoney(item.interest))}</td>
      <td>${escapeHtml(formatReportMoney(item.correction))}</td>
      <td>${escapeHtml(formatReportMoney(item.updatedPrincipal))}</td>
      <td>${escapeHtml(formatReportMoney(item.doubleWithAdjustments))}</td>
    </tr>`).join("");
  const calculationDate = formatReportDate(report.calculationAsOf);

  return `
    <section class="audit-calculation-report" aria-label="Memória de cálculo da auditoria financeira">
      <header class="audit-report-header">
        <div class="audit-report-brand">IA AUDITA</div>
        <h1>RELATÓRIO TÉCNICO DE AUDITORIA FINANCEIRA INDÉBITO E PERDAS E DANOS</h1>
        <p>Apuração de danos materiais, repetição de indébito e indenização por perdas e danos</p>
      </header>

      <div class="audit-summary-grid">
        <article><span>1. Principal atualizado</span><strong>${escapeHtml(formatReportMoney(report.updatedPrincipal))}</strong></article>
        <article><span>2. Repetição (dobro)</span><strong>${escapeHtml(formatReportMoney(report.doubleWithAdjustments))}</strong></article>
        <article><span>3. Perdas e danos</span><strong>${escapeHtml(formatReportMoney(report.damagesAmount))}</strong></article>
        <article class="audit-summary-total"><span>Soma total (1+2+3)</span><strong>${escapeHtml(formatReportMoney(report.estimatedClaimValue))}</strong></article>
      </div>

      <section class="audit-report-block">
        <h2>Resumo dos pedidos apurados</h2>
        <div class="audit-report-summary">
          <p>(+) Principal atualizado (valor original + juros + correção monetária): <strong>${escapeHtml(formatReportMoney(report.updatedPrincipal))}</strong></p>
          <p>(+) Repetição do indébito em dobro (2 x valor original + juros + correção): <strong>${escapeHtml(formatReportMoney(report.doubleWithAdjustments))}</strong></p>
          <p>(+) Perdas e danos / danos morais (parâmetro referencial): <strong>${escapeHtml(formatReportMoney(report.damagesAmount))}</strong></p>
          <p class="audit-report-grand-total">(=) Total geral apurado em auditoria: ${escapeHtml(formatReportMoney(report.estimatedClaimValue))}</p>
        </div>
      </section>

      <section class="audit-report-block audit-methodology">
        <h2>Critérios da memória de cálculo</h2>
        <p><strong>Juros:</strong> 1% ao mês sobre cada lançamento, a partir da data do débito até ${escapeHtml(calculationDate)}.</p>
        <p><strong>Correção monetária:</strong> variação mensal acumulada do IPCA disponível para o período de cada lançamento.</p>
        <p><strong>Principal atualizado:</strong> valor original acrescido dos juros e da correção monetária.</p>
        <p><strong>Repetição em dobro:</strong> duas vezes o valor original, acrescido dos juros e da correção monetária.</p>
        <p><strong>Indenização referencial:</strong> ${escapeHtml(formatReportMoney(report.damagesAmount))}, sujeita à revisão conforme os fatos e as provas do caso.</p>
      </section>

      <section class="audit-report-block audit-table-block">
        <h2>Memória de cálculo discriminada (parcela por parcela)</h2>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Valor orig.</th>
              <th>Juros (1%/mês)</th>
              <th>Correção mon.</th>
              <th>Principal atualizado</th>
              <th>Dobro atualizado</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <td colspan="5">Total geral apurado (principal atualizado + dobro + perdas e danos)</td>
              <td>${escapeHtml(formatReportMoney(report.estimatedClaimValue))}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <p class="audit-report-disclaimer">Memória técnica estimativa elaborada a partir dos lançamentos documentados e classificados pelo consumidor como não reconhecidos. A incidência jurídica, os valores finais e eventual indenização dependem de revisão e decisão judicial.</p>
    </section>`;
}

function paragraphClass(text, index, paragraphs, claimantName) {
  if (index === 0 && text.startsWith("EXCELENTÍSSIMO")) return "court-address";
  if (text.startsWith("AÇÃO ")) return "action-title";
  if (
    /^(?:DA LIMITAÇÃO TEMPORAL|[IVX]+\.\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]|[1-5]\.\s+(?:Da|Do|Dos|DAS|DA))/u.test(
      text,
    )
  ) {
    return "section-title";
  }
  const remaining = paragraphs.length - index;
  if (
    remaining <= 4 ||
    text === claimantName ||
    text.startsWith("CPF nº") ||
    text.startsWith("(Jus Postulandi")
  ) {
    return "signature";
  }
  return "body";
}

export function buildJecPetitionHtml(prepared) {
  if (!prepared?.draft) throw new Error("jec_petition_draft_required");
  const paragraphs = String(prepared.draft)
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  const claimantName = String(prepared.claimant?.fullName || "").trim();
  const renderedParagraphs = paragraphs.map((paragraph, index) => {
    const className = paragraphClass(
      paragraph,
      index,
      paragraphs,
      claimantName,
    );
    return {
      className,
      html: `<p class="${className}">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
    };
  });
  const signatureStart = renderedParagraphs.findIndex(
    ({ className }) => className === "signature",
  );
  const content = signatureStart < 0
    ? renderedParagraphs.map(({ html }) => html).join("\n")
    : [
        ...renderedParagraphs.slice(0, signatureStart).map(({ html }) => html),
        `<section class="signature-block">${renderedParagraphs
          .slice(signatureStart)
          .map(({ html }) => html)
          .join("\n")}</section>`,
      ].join("\n");
  const modelLabel = escapeHtml(
    prepared.template?.label || "Relatório Técnico de Auditoria",
  );
  const calculationReport = buildJecCalculationReportHtml(prepared);

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <title>${modelLabel}</title>
    <style>
      @page {
        size: A4;
        margin: 25mm 22mm 24mm 30mm;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: #111;
        font-family: "Times New Roman", Times, serif;
        font-size: 12pt;
        line-height: 1.5;
      }
      p {
        margin: 0 0 12pt;
        orphans: 3;
        widows: 3;
      }
      .body {
        text-align: justify;
        text-indent: 1.25cm;
      }
      .court-address,
      .action-title {
        margin-bottom: 18pt;
        font-weight: 700;
        text-align: center;
      }
      .action-title {
        text-transform: uppercase;
      }
      .section-title {
        margin-top: 18pt;
        margin-bottom: 12pt;
        font-weight: 700;
        page-break-after: avoid;
      }
      .signature {
        margin: 4pt 0;
        text-align: center;
      }
      .signature-block {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .audit-calculation-report {
        break-before: page;
        page-break-before: always;
        color: #13283d;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 8.5pt;
        line-height: 1.3;
      }
      .audit-report-header {
        margin: 0 0 16pt;
        padding: 16pt 18pt;
        border-bottom: 4pt solid #2c6ca3;
        background: #10283f;
        color: #fff;
      }
      .audit-report-header h1 {
        margin: 0 0 5pt;
        font-size: 13pt;
        letter-spacing: .2pt;
      }
      .audit-report-brand {
        margin: 0 0 3pt;
        color: #7cc7d0;
        font-size: 10pt;
        font-weight: 700;
        letter-spacing: .4pt;
      }
      .audit-report-header p {
        margin: 0;
        color: #c7d6e7;
        font-size: 10pt;
      }
      .audit-summary-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8pt;
        margin-bottom: 16pt;
      }
      .audit-summary-grid article {
        min-height: 62pt;
        padding: 10pt 8pt;
        border: 1px solid #d4dce5;
        border-radius: 4pt;
        background: #f5f7fa;
        text-align: center;
      }
      .audit-summary-grid span {
        display: block;
        min-height: 24pt;
        color: #536274;
        font-size: 7.5pt;
        font-weight: 700;
        text-transform: uppercase;
      }
      .audit-summary-grid strong {
        display: block;
        margin-top: 5pt;
        color: #13283d;
        font-size: 14pt;
      }
      .audit-summary-grid .audit-summary-total {
        border-color: #10283f;
        background: #10283f;
      }
      .audit-summary-grid .audit-summary-total span { color: #c7d6e7; }
      .audit-summary-grid .audit-summary-total strong { color: #fff; }
      .audit-report-block {
        margin: 0 0 14pt;
      }
      .audit-report-block h2 {
        margin: 0 0 8pt;
        padding-bottom: 5pt;
        border-bottom: 2px solid #13283d;
        font-size: 12pt;
        text-transform: uppercase;
      }
      .audit-report-summary {
        padding: 8pt 10pt;
        border: 1px solid #d4dce5;
        border-radius: 4pt;
        background: #f9fafb;
      }
      .audit-report-summary p,
      .audit-methodology p {
        margin: 0 0 4pt;
      }
      .audit-report-summary p:last-child,
      .audit-methodology p:last-child {
        margin-bottom: 0;
      }
      .audit-report-grand-total {
        margin-top: 6pt !important;
        padding-top: 6pt;
        border-top: 1px dashed #536274;
        font-size: 10pt;
        font-weight: 700;
        text-transform: uppercase;
      }
      .audit-table-block table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        font-size: 7.2pt;
      }
      .audit-table-block thead { display: table-header-group; }
      .audit-table-block tfoot { display: table-row-group; }
      .audit-table-block tr {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .audit-table-block th,
      .audit-table-block td {
        padding: 4pt 3pt;
        border: 1px solid #d4dce5;
        text-align: right;
        white-space: nowrap;
      }
      .audit-table-block th:first-child,
      .audit-table-block td:first-child { text-align: left; }
      .audit-table-block th {
        border-color: #10283f;
        background: #10283f;
        color: #fff;
        font-weight: 700;
      }
      .audit-table-block tbody tr:nth-child(even) { background: #f5f7fa; }
      .audit-table-block tfoot td {
        border-top: 2px solid #10283f;
        background: #e8eef5;
        font-weight: 700;
      }
      .audit-table-block tfoot td:first-child {
        text-align: right;
        text-transform: uppercase;
      }
      .audit-report-disclaimer {
        margin: 10pt 0 0;
        padding: 8pt;
        border-left: 3px solid #2c6ca3;
        background: #eef4fa;
        color: #405267;
        font-size: 7.5pt;
      }
    </style>
  </head>
  <body>
    <main>${content}</main>
    ${calculationReport}
  </body>
</html>`;
}

export async function createJecPetitionPdf(
  prepared,
  { launch = launchJecPdfBrowser } = {},
) {
  if (!prepared?.ready) {
    const error = new Error("jec_petition_incomplete");
    error.code = "jec_petition_incomplete";
    error.missingFields = Array.isArray(prepared?.missingFields)
      ? prepared.missingFields
      : [];
    throw error;
  }

  const browser = await launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(buildJecPetitionHtml(prepared), {
      waitUntil: "domcontentloaded",
    });
    await page.emulateMedia({ media: "print" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `
        <div style="width:100%;padding:0 22mm 6mm 30mm;font:8px Arial,sans-serif;color:#667085;display:flex;justify-content:space-between;">
          <span>Relatório Técnico gerado pela IA AUDITA - revisar antes do protocolo</span>
          <span><span class="pageNumber"></span>/<span class="totalPages"></span></span>
        </div>
      `,
      margin: {
        top: "25mm",
        right: "22mm",
        bottom: "24mm",
        left: "30mm",
      },
    });
  } finally {
    await browser.close();
  }
}

function invalidPdf(code, label = "") {
  const error = new Error(code);
  error.code = code;
  if (label) error.attachment = label;
  return error;
}

async function loadPdf(bytes, code, label = "") {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
    throw invalidPdf(code, label);
  }
  try {
    const pdf = await PDFDocument.load(bytes);
    if (pdf.getPageCount() === 0) throw invalidPdf(code, label);
    return pdf;
  } catch (error) {
    if (error?.code === code) throw error;
    throw invalidPdf(code, label);
  }
}

export async function appendJecPetitionAttachments(basePdf, attachments = []) {
  const output = await loadPdf(basePdf, "jec_petition_pdf_invalid");
  if (!Array.isArray(attachments)) {
    throw invalidPdf("jec_petition_attachment_invalid");
  }

  for (const attachment of attachments) {
    const label = String(attachment?.label || "").trim();
    const source = await loadPdf(
      attachment?.bytes,
      "jec_petition_attachment_invalid",
      label,
    );
    const pages = await output.copyPages(source, source.getPageIndices());
    for (const page of pages) output.addPage(page);
  }

  return output.save();
}
