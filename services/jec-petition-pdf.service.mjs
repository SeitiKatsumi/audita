import { existsSync } from "node:fs";
import { join } from "node:path";

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
    </style>
  </head>
  <body>
    <main>${content}</main>
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
