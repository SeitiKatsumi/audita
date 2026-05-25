import { failedResult, successResult, unavailableResult, SOURCE_RESULT } from "./base.collector.mjs";
import { saveAndExtractPdfBuffer } from "../services/pdf.service.mjs";

export const fonte = "tjdft";

const OFFICIAL_URL = "https://cnc.tjdft.jus.br/solicitacao-externa";
const CERTIFICATE_TYPES = [
  { id: "criminal", label: "Criminal", radioIndex: 0 },
  { id: "civil", label: "Cível", radioIndex: 1 },
  { id: "falencia", label: "Falência e Recuperação Judicial", radioIndex: 2 },
  { id: "especial", label: "Especial (Cível e Criminal)", radioIndex: 3 },
];

function envNumber(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function withTimeout(promise, timeoutMs, message) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

export function discoverIntegrationStrategy() {
  return [
    "1. API oficial documentada: nao ha API publica de emissao de certidao Nada Consta TJDFT.",
    "2. Endpoint HTTP/JSON publico: fluxo mapeado no portal cnc.tjdft.jus.br, sem endpoint oficial estavel documentado.",
    "3. Request HTTP normal: nao usado porque o site valida etapas e gera link temporario de PDF.",
    "4. Playwright: usado para preencher o wizard oficial, baixar os PDFs e parar se houver captcha/bloqueio.",
    "5. PDF/OCR: extrai texto do PDF quando possivel; OCR fica como evolucao se o PDF vier como imagem.",
  ];
}

export async function collect(input) {
  const extra = input.extraFields || {};
  const stateCourtUf = String(extra.stateCourtUf || "DF").trim().toUpperCase();
  const stateCourtName = String(extra.stateCourtName || "TJDFT").trim();
  const stateCourtUrl = String(extra.stateCourtUrl || OFFICIAL_URL).trim();
  if (stateCourtUf && stateCourtUf !== "DF") {
    const tribunal = stateCourtName || `TJ${stateCourtUf}`;
    return {
      fonte,
      status: "manual_required",
      resultado: SOURCE_RESULT.INDISPONIVEL,
      dados: {
        officialUrl: stateCourtUrl,
        tribunal,
        uf: stateCourtUf,
        modo: "portal_oficial",
        resumo: `${tribunal} selecionado. A emissão automática desse estado ainda não está ativa; use o portal oficial mapeado para emitir a certidão.`,
        certidoes: getCertificateTypesForInput(input).map((certificateType) => ({
          tipo: certificateType.label,
          status: "portal_oficial",
          errorMessage: "Emissão pelo portal oficial do tribunal.",
        })),
        proximoPasso: "Mapear campos, captcha e fluxo de PDF deste tribunal estadual.",
        integrationStrategy: discoverIntegrationStrategy(),
      },
      rawText: "",
      errorMessage: "",
    };
  }
  const documentType = input.tipoDocumento === "cnpj" || extra.tjdftPersonType === "pj" ? "cnpj" : "cpf";
  const documentValue = String(
    documentType === "cnpj" ? extra.cnpjDocument || input.documento || "" : extra.cpfDocument || input.documento || "",
  ).replace(/\D/g, "");

  if (!documentValue) {
    return unavailableResult(fonte, "TJDFT Nada Consta exige CPF para pessoa física ou CNPJ para pessoa jurídica.", {
      officialUrl: OFFICIAL_URL,
      integrationStrategy: discoverIntegrationStrategy(),
    });
  }

  const firstName = String(extra.firstName || extra.primeiroNome || "").trim();
  const motherName = String(extra.motherName || extra.nomeMae || "").trim();
  const fatherName = String(extra.fatherName || extra.nomePai || "").trim();
  const missingFields = [];

  if (documentType === "cpf") {
    if (!firstName) missingFields.push("firstName");
    if (!motherName) missingFields.push("motherName");
    if (!fatherName) missingFields.push("fatherName");
  }

  if (missingFields.length) {
    return unavailableResult(fonte, "Informe primeiro nome, nome da mãe e nome do pai para automatizar o TJDFT PF.", {
      officialUrl: OFFICIAL_URL,
      missingFields,
      integrationStrategy: discoverIntegrationStrategy(),
    });
  }

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return unavailableResult(fonte, "Instale a dependencia Playwright para executar o wizard do TJDFT.", {
      officialUrl: OFFICIAL_URL,
      install: "npm install && npx playwright install chromium",
      integrationStrategy: discoverIntegrationStrategy(),
    });
  }

  const browser = await chromium.launch({
    headless: process.env.TJDFT_HEADLESS !== "false",
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    userAgent: "Audita/0.1 TJDFT certificate collector",
  });

  try {
    const collectorTimeoutMs = envNumber("TJDFT_COLLECTOR_TIMEOUT_MS", 180000);
    const results = await withTimeout(
      collectAllCertificates({
        context,
        input: { ...input, documento: documentValue, tipoDocumento: documentType },
        firstName,
        motherName,
        fatherName,
      }),
      collectorTimeoutMs,
      `TJDFT excedeu o tempo maximo de ${Math.round(collectorTimeoutMs / 1000)}s.`,
    );

    const encontrados = results.filter((result) => result.resultado === SOURCE_RESULT.CONSTA);
    const analisePendente = results.filter((result) => result.resultado === SOURCE_RESULT.INDISPONIVEL);
    const falhas = results.filter((result) => result.status !== "success");

    if (results.every((result) => result.status !== "success")) {
      return failedResult(fonte, "Nao foi possivel emitir nenhuma certidao TJDFT.", {
        officialUrl: OFFICIAL_URL,
        certidoes: results,
      });
    }

    const resultadoGeral = encontrados.length
      ? SOURCE_RESULT.CONSTA
      : analisePendente.length
        ? SOURCE_RESULT.INDISPONIVEL
        : SOURCE_RESULT.NADA_CONSTA;

    return successResult(fonte, resultadoGeral, {
      officialUrl: stateCourtUrl || OFFICIAL_URL,
      tribunal: stateCourtName || "TJDFT",
      uf: stateCourtUf || "DF",
      certidoes: results,
      totalCertidoes: results.length,
      certidoesBaixadas: results.filter((result) => result.pdfPath).length,
      certidoesComApontamento: encontrados.map((result) => result.tipo),
      certidoesComAnalisePendente: analisePendente.map((result) => result.tipo),
      certidoesComFalha: falhas.map((result) => result.tipo),
      resumo: summarizeOverallResult({ encontrados, analisePendente }),
    }, {
      rawText: results.map((result) => result.rawText || result.pageText || "").filter(Boolean).join("\n\n---\n\n"),
      pdfPath: results.find((result) => result.pdfPath)?.pdfPath || "",
    });
  } finally {
    await browser.close();
  }
}

async function collectAllCertificates({ context, input, firstName, motherName, fatherName }) {
  const results = [];
  for (const certificateType of getCertificateTypesForInput(input)) {
    results.push(await collectCertificate({ context, input, firstName, motherName, fatherName, certificateType }));
  }
  return results;
}

export function getCertificateTypesForInput(input) {
  const selected = Array.isArray(input.extraFields?.tjdftCertificateTypes)
    ? input.extraFields.tjdftCertificateTypes.map((value) => String(value).trim()).filter(Boolean)
    : [];
  if (!selected.length) {
    return CERTIFICATE_TYPES;
  }

  const selectedSet = new Set(selected);
  const filtered = CERTIFICATE_TYPES.filter((certificateType) => selectedSet.has(certificateType.id));
  return filtered.length ? filtered : CERTIFICATE_TYPES;
}

async function collectCertificate({ context, input, firstName, motherName, fatherName, certificateType }) {
  const page = await context.newPage();
  try {
    page.setDefaultTimeout(envNumber("TJDFT_STEP_TIMEOUT_MS", input.timeoutMs || 30000));
    await page.goto(OFFICIAL_URL, { waitUntil: "domcontentloaded" });
    await fillFirstStep(page, input.documento, firstName, certificateType);
    await fillSecondStep(page, motherName, fatherName);
    const { downloadUrl, pageText } = await readResult(page);

    if (!downloadUrl) {
      return {
        tipo: certificateType.label,
        status: "failed",
        resultado: SOURCE_RESULT.ERRO,
        pageText,
        errorMessage: "TJDFT nao retornou link de download.",
      };
    }

    const pdfResponse = await fetch(downloadUrl);
    if (!pdfResponse.ok) {
      return {
        tipo: certificateType.label,
        status: "failed",
        resultado: SOURCE_RESULT.ERRO,
        pageText,
        downloadUrl,
        errorMessage: `Falha ao baixar PDF TJDFT: HTTP ${pdfResponse.status}`,
      };
    }

    const buffer = Buffer.from(await pdfResponse.arrayBuffer());
    const { pdfPath, rawText } = await saveAndExtractPdfBuffer({
      consultaId: input.consultaId,
      fonte,
      fileName: `tjdft-${certificateType.id}.pdf`,
      buffer,
    });

    const textForAnalysis = rawText || "";
    return {
      tipo: certificateType.label,
      status: "success",
      resultado: classifyCertificateText(textForAnalysis),
      pdfPath,
      rawText,
      pageText,
      downloadUrl: maskSignedUrl(downloadUrl),
      resumo: summarizeCertificateText(textForAnalysis),
    };
  } catch (error) {
    return {
      tipo: certificateType.label,
      status: "failed",
      resultado: SOURCE_RESULT.ERRO,
      errorMessage: error.message,
    };
  } finally {
    await page.close();
  }
}

async function fillFirstStep(page, documento, firstName, certificateType) {
  const stepTimeoutMs = envNumber("TJDFT_STEP_TIMEOUT_MS", 30000);
  const textInputs = page.locator("input[type='text']");
  await textInputs.nth(0).fill(formatDocument(documento));
  if (firstName) {
    await textInputs.nth(1).fill(firstName);
  }
  await chooseCertificateType(page, certificateType);
  await page.getByRole("button", { name: "Próximo" }).click();
  await page.waitForFunction(
    () => document.body.innerText.includes("Nome da Mãe") || document.body.innerText.includes("DOWNLOAD") || document.body.innerText.includes("Download"),
    null,
    { timeout: stepTimeoutMs },
  );
}

async function fillSecondStep(page, motherName, fatherName) {
  const stepTimeoutMs = envNumber("TJDFT_STEP_TIMEOUT_MS", 45000);
  if (!motherName && !fatherName) {
    return;
  }

  const textInputs = page.locator("input[type='text']");
  if (motherName) {
    await textInputs.nth(2).fill(motherName);
  }
  if (fatherName) {
    await textInputs.nth(3).fill(fatherName);
  }
  await page.getByRole("button", { name: "Próximo" }).click();
  await page.waitForFunction(
    () => document.body.innerText.includes("DOWNLOAD") || document.body.innerText.includes("Download"),
    null,
    { timeout: stepTimeoutMs },
  );
}

async function chooseCertificateType(page, certificateType) {
  await page.locator(".q-radio").nth(certificateType.radioIndex).click();
}

async function readResult(page) {
  const pageText = await page.locator("body").innerText();
  const downloadUrl = await page
    .locator("a[href*='certidoes.tjdft.jus.br']")
    .getAttribute("href")
    .catch(() => "");
  return { downloadUrl, pageText };
}

function hasPositiveCertificateSignal(text) {
  const normalized = normalize(text);
  return (
    normalized.includes("nada consta") ||
    normalized.includes("nao consta") ||
    normalized.includes("não consta") ||
    normalized.includes("certidao negativa") ||
    normalized.includes("certidão negativa")
  );
}

function hasNegativeCertificateSignal(text) {
  const normalized = normalize(text);
  return (
    normalized.includes("consta distribuicao") ||
    normalized.includes("consta distribuição") ||
    normalized.includes("foram encontrados") ||
    normalized.includes("acao penal") ||
    normalized.includes("ação penal") ||
    normalized.includes("processo")
  );
}

function classifyCertificateText(text) {
  if (!text) {
    return SOURCE_RESULT.INDISPONIVEL;
  }
  if (hasPositiveCertificateSignal(text)) {
    return SOURCE_RESULT.NADA_CONSTA;
  }
  if (hasNegativeCertificateSignal(text)) {
    return SOURCE_RESULT.CONSTA;
  }
  return SOURCE_RESULT.INDISPONIVEL;
}

function summarizeOverallResult({ encontrados, analisePendente }) {
  if (encontrados.length) {
    return "Uma ou mais certidoes indicaram possivel apontamento. Revise os textos/PDFs.";
  }
  if (analisePendente.length) {
    return "As certidoes foram baixadas, mas o texto do PDF nao foi extraido automaticamente. Revisao/OCR pendente.";
  }
  return "As certidoes baixadas nao indicaram apontamento pelo texto extraido.";
}

function summarizeCertificateText(text) {
  if (!text) {
    return "PDF baixado; texto nao extraido automaticamente. Revisao/OCR pendente.";
  }
  const normalized = normalize(text);
  if (hasPositiveCertificateSignal(text)) {
    return "Nada consta identificado no texto extraido.";
  }
  if (normalized.includes("ja existe uma certidao") || normalized.includes("já existe uma certidão")) {
    return "Certidao existente localizada e PDF disponibilizado pelo TJDFT.";
  }
  return "PDF baixado; revisar texto extraido para confirmar apontamentos.";
}

function maskSignedUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    parsed.search = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function formatDocument(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  return digits;
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
