import { failedResult, successResult, unavailableResult, SOURCE_RESULT } from "./base.collector.mjs";

export const fonte = "fgts";

const OFFICIAL_URL = "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf";

export function discoverIntegrationStrategy() {
  return [
    "1. API oficial documentada: nao localizada para consulta CRF aberta sem credencial.",
    "2. Endpoint HTTP/JSON publico: nao ha endpoint oficial documentado; o portal usa fluxo JSF.",
    "3. Request HTTP normal: nao usado porque o portal controla estado de formulario JSF.",
    "4. Playwright: usado para preencher o portal oficial da Caixa, sem burlar bloqueio, captcha ou protecao anti-bot.",
    "5. PDF/OCR: preparado para anexar texto/HTML retornado; download de PDF sera usado quando o portal expuser link publico.",
  ];
}

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

export async function collect(input) {
  const extra = input.extraFields || {};
  const registrationType = String(extra.fgtsRegistrationType || extra.tipoInscricaoFgts || "CNPJ").trim().toUpperCase();
  const registration = String(extra.fgtsRegistration || extra.inscricaoFgts || extra.cnpjDocument || input.documento || "").replace(/\D/g, "");
  const uf = String(extra.fgtsUf || extra.ufFgts || "").trim().toUpperCase();
  const missingFields = [];

  if (!["CNPJ", "CEI"].includes(registrationType)) missingFields.push("fgtsRegistrationType");
  if (!registration) missingFields.push("fgtsRegistration");
  if (!uf) missingFields.push("fgtsUf");

  if (missingFields.length) {
    return unavailableResult(fonte, "Informe tipo de inscricao, inscricao e UF para consultar CRF/FGTS.", {
      officialUrl: OFFICIAL_URL,
      missingFields,
      integrationStrategy: discoverIntegrationStrategy(),
    });
  }

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return unavailableResult(fonte, "Instale a dependencia Playwright para executar o portal FGTS/CRF.", {
      officialUrl: OFFICIAL_URL,
      install: "npm install && npx playwright install chromium",
      integrationStrategy: discoverIntegrationStrategy(),
    });
  }

  const timeoutMs = envNumber("FGTS_COLLECTOR_TIMEOUT_MS", 90000);
  try {
    return await withTimeout(
      collectWithBrowser({ chromium, registrationType, registration, uf }),
      timeoutMs,
      `FGTS/CRF excedeu o tempo maximo de ${Math.round(timeoutMs / 1000)}s.`,
    );
  } catch (error) {
    return failedResult(fonte, error.message || "Falha ao consultar FGTS/CRF.", {
      officialUrl: OFFICIAL_URL,
      integrationStrategy: discoverIntegrationStrategy(),
    });
  }
}

async function collectWithBrowser({ chromium, registrationType, registration, uf }) {
  const browser = await chromium.launch({
    headless: process.env.FGTS_HEADLESS !== "false",
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    userAgent: "Audita/0.1 FGTS CRF collector",
  });
  const page = await context.newPage();

  try {
    const stepTimeoutMs = envNumber("FGTS_STEP_TIMEOUT_MS", 30000);
    page.setDefaultTimeout(stepTimeoutMs);
    await page.goto(OFFICIAL_URL, { waitUntil: "domcontentloaded" });

    const initialText = await page.locator("body").innerText().catch(() => "");
    if (isBlockedByProtection(page.url(), initialText)) {
      return unavailableResult(fonte, "A Caixa bloqueou a automacao do portal CRF/FGTS nesta execucao.", {
        officialUrl: OFFICIAL_URL,
        blockedBy: "ShieldSquare/PerfDrive",
        detalhe: "O MVP nao burla protecao anti-bot. Tente FGTS_HEADLESS=false em ambiente autorizado ou use integracao oficial/credenciada.",
        integrationStrategy: discoverIntegrationStrategy(),
      });
    }

    await fillSearchForm(page, { registrationType, registration, uf });
    await page.getByRole("button", { name: "Consultar" }).click();
    await page.waitForLoadState("domcontentloaded", { timeout: stepTimeoutMs }).catch(() => {});
    await page.waitForFunction(
      () => document.body.innerText.length > 0 && !document.body.innerText.includes("Critérios de Pesquisa"),
      null,
      { timeout: stepTimeoutMs },
    ).catch(() => {});

    const resultText = await page.locator("body").innerText().catch(() => "");
    if (isBlockedByProtection(page.url(), resultText)) {
      return unavailableResult(fonte, "A Caixa bloqueou a automacao do portal CRF/FGTS apos a consulta.", {
        officialUrl: OFFICIAL_URL,
        blockedBy: "ShieldSquare/PerfDrive",
        integrationStrategy: discoverIntegrationStrategy(),
      });
    }

    const resultado = classifyResult(resultText);
    return successResult(fonte, resultado, {
      officialUrl: OFFICIAL_URL,
      tipoInscricao: registrationType,
      uf,
      resumo: summarizeResult(resultText, resultado),
      textoDisponivel: Boolean(resultText),
      integrationStrategy: discoverIntegrationStrategy(),
    }, {
      rawText: resultText,
    });
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function fillSearchForm(page, { registrationType, registration, uf }) {
  const selects = page.locator("select");
  const selectCount = await selects.count();
  if (selectCount < 2) {
    throw new Error("Formulario FGTS/CRF nao foi localizado no portal da Caixa.");
  }

  await selects.nth(0).selectOption({ label: registrationType }).catch(async () => {
    await selects.nth(0).selectOption(registrationType);
  });
  await page.locator("input[type='text']").nth(0).fill(registration);
  await selects.nth(1).selectOption({ label: uf }).catch(async () => {
    await selects.nth(1).selectOption(uf);
  });
}

function isBlockedByProtection(url, text) {
  const normalized = normalize(`${url}\n${text}`);
  return (
    normalized.includes("validate.perfdrive.com") ||
    normalized.includes("shieldsquare") ||
    normalized.includes("comportamento malicioso") ||
    normalized.includes("nao podemos processar sua requisicao")
  );
}

function classifyResult(text) {
  const normalized = normalize(text);
  if (!normalized) {
    return SOURCE_RESULT.INDISPONIVEL;
  }
  if (
    normalized.includes("regular perante o fgts") ||
    normalized.includes("certificado de regularidade do fgts") ||
    normalized.includes("situacao regular")
  ) {
    return SOURCE_RESULT.NADA_CONSTA;
  }
  if (
    normalized.includes("irregular") ||
    normalized.includes("nao esta regular") ||
    normalized.includes("nao possui certificado") ||
    normalized.includes("pendencia")
  ) {
    return SOURCE_RESULT.CONSTA;
  }
  return SOURCE_RESULT.INDISPONIVEL;
}

function summarizeResult(text, resultado) {
  if (resultado === SOURCE_RESULT.NADA_CONSTA) {
    return "Regularidade FGTS/CRF indicada no texto retornado pelo portal.";
  }
  if (resultado === SOURCE_RESULT.CONSTA) {
    return "Portal FGTS/CRF indicou pendencia ou irregularidade. Revise o texto bruto.";
  }
  if (text) {
    return "Consulta FGTS/CRF retornou texto, mas a regularidade nao foi classificada automaticamente.";
  }
  return "Consulta FGTS/CRF sem texto classificavel.";
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
