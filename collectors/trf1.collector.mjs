import { failedResult, successResult, unavailableResult, SOURCE_RESULT } from "./base.collector.mjs";

export const fonte = "trf1";

const OFFICIAL_URL = "https://certidao-unificada.cjf.jus.br/#/solicitacao-certidao";

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
    "1. API oficial documentada: nao localizada para emissao aberta da Certidao Unificada CJF.",
    "2. Endpoint HTTP/JSON publico: portal Angular sera inspecionado por Playwright; endpoint estavel ainda nao documentado.",
    "3. Request HTTP normal: nao usado enquanto o fluxo depender de estado do front-end.",
    "4. Playwright: usado para preencher tipo de certidao, orgaos, CPF/CNPJ, nome social e e-mail.",
    "5. PDF/OCR: extrair texto quando o portal expuser PDF; se enviar por e-mail, registrar protocolo/resumo.",
  ];
}

export async function collect(input) {
  const extra = input.extraFields || {};
  const cpf = String(extra.cpfDocument || input.documento || "").replace(/\D/g, "");
  const cnpj = String(extra.cnpjDocument || input.documento || "").replace(/\D/g, "");
  const documentType = input.tipoDocumento === "cnpj" && cnpj ? "cnpj" : cpf ? "cpf" : "cnpj";
  const documentValue = documentType === "cpf" ? cpf : cnpj;
  const certificateType = String(extra.trf1CertificateType || "Criminal").trim();
  const orgaos = String(extra.trf1Orgaos || "Todos os 4 órgãos selecionados").trim();
  const email = String(extra.trf1Email || "").trim();
  const socialName = String(extra.trf1SocialName || "").trim();
  const missingFields = [];

  if (!documentValue) missingFields.push(documentType === "cpf" ? "cpfDocument" : "cnpjDocument");
  if (!certificateType) missingFields.push("trf1CertificateType");
  if (!orgaos) missingFields.push("trf1Orgaos");
  if (!email) missingFields.push("trf1Email");

  if (missingFields.length) {
    return unavailableResult(fonte, "Informe documento, tipo de certidao, orgaos e e-mail para consultar a Certidao Unificada/CJF.", {
      officialUrl: OFFICIAL_URL,
      missingFields,
      integrationStrategy: discoverIntegrationStrategy(),
    });
  }

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return unavailableResult(fonte, "Instale a dependencia Playwright para executar o portal da Certidao Unificada/CJF.", {
      officialUrl: OFFICIAL_URL,
      install: "npm install && npx playwright install chromium",
      integrationStrategy: discoverIntegrationStrategy(),
    });
  }

  const timeoutMs = envNumber("TRF1_COLLECTOR_TIMEOUT_MS", 120000);
  try {
    return await withTimeout(
      collectWithBrowser({ chromium, documentType, documentValue, certificateType, orgaos, email, socialName }),
      timeoutMs,
      `TRF1/CJF excedeu o tempo maximo de ${Math.round(timeoutMs / 1000)}s.`,
    );
  } catch (error) {
    return failedResult(fonte, error.message || "Falha ao consultar Certidao Unificada/CJF.", {
      officialUrl: OFFICIAL_URL,
      integrationStrategy: discoverIntegrationStrategy(),
    });
  }
}

async function collectWithBrowser({ chromium, documentType, documentValue, certificateType, orgaos, email, socialName }) {
  const browser = await chromium.launch({ headless: process.env.TRF1_HEADLESS !== "false" });
  const context = await browser.newContext({
    acceptDownloads: true,
    ignoreHTTPSErrors: true,
    userAgent: "Audita/0.1 CJF unified certificate collector",
  });
  const page = await context.newPage();

  try {
    page.setDefaultTimeout(envNumber("TRF1_STEP_TIMEOUT_MS", 45000));
    await page.goto(OFFICIAL_URL, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: envNumber("TRF1_NETWORK_IDLE_TIMEOUT_MS", 20000) }).catch(() => {});
    await page.waitForSelector("input, select, ng-select, mat-select", { timeout: envNumber("TRF1_STEP_TIMEOUT_MS", 45000) });

    await chooseCertificateType(page, certificateType);
    await chooseOrgaos(page, orgaos);
    await chooseDocumentType(page, documentType);
    await fillDocument(page, documentValue);
    await fillOptionalText(page, ["Nome social", "Nome social (opcional)"], socialName);
    await fillOptionalText(page, ["E-mail", "Digite o e-mail para receber a certidão"], email);

    const submit = await findSubmitButton(page);
    if (!submit) {
      return unavailableResult(fonte, "Portal CJF carregou, mas o botao de solicitacao nao foi localizado.", {
        officialUrl: OFFICIAL_URL,
        camposPreenchidos: true,
        integrationStrategy: discoverIntegrationStrategy(),
      });
    }

    const downloadPromise = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);
    await submit.click();
    const download = await downloadPromise;
    const pageText = await page.locator("body").innerText().catch(() => "");

    if (download) {
      return successResult(fonte, SOURCE_RESULT.INDISPONIVEL, {
        officialUrl: OFFICIAL_URL,
        resumo: "A certidao foi emitida pelo portal, mas o download ainda precisa ser persistido neste collector.",
        tipoCertidao: certificateType,
        orgaos,
        email,
      }, {
        rawText: pageText,
      });
    }

    return successResult(fonte, SOURCE_RESULT.INDISPONIVEL, {
      officialUrl: OFFICIAL_URL,
      resumo: summarizePageText(pageText),
      tipoCertidao: certificateType,
      orgaos,
      email,
      protocoloOuRetorno: pageText.slice(0, 1200),
    }, {
      rawText: pageText,
    });
  } catch (error) {
    return unavailableResult(fonte, `Nao foi possivel completar o fluxo da Certidao Unificada/CJF: ${error.message}`, {
      officialUrl: OFFICIAL_URL,
      integrationStrategy: discoverIntegrationStrategy(),
      detalhe:
        "No ambiente local atual, o host certidao-unificada.cjf.jus.br nao respondeu na porta 443. Em rede autorizada, o collector tenta preencher e solicitar via Playwright.",
    });
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function chooseCertificateType(page, certificateType) {
  await selectByLabelOrText(page, ["Tipo de certidão", "Tipo de certidao"], certificateType);
}

async function chooseOrgaos(page, orgaos) {
  await selectByLabelOrText(page, ["Órgãos", "Orgaos"], orgaos);
}

async function chooseDocumentType(page, documentType) {
  const label = documentType === "cpf" ? "CPF" : "CNPJ";
  const radio = page.getByLabel(label, { exact: true });
  if ((await radio.count().catch(() => 0)) > 0) {
    await radio.check({ force: true }).catch(() => radio.click({ force: true }));
    return;
  }
  await page.getByText(label, { exact: true }).click({ force: true }).catch(() => {});
}

async function fillDocument(page, documentValue) {
  const selectors = [
    "input[formcontrolname*='cpf' i]",
    "input[formcontrolname*='cnpj' i]",
    "input[name*='cpf' i]",
    "input[name*='cnpj' i]",
    "input[placeholder*='CPF' i]",
    "input[placeholder*='CNPJ' i]",
  ];
  for (const selector of selectors) {
    const input = page.locator(selector).first();
    if ((await input.count().catch(() => 0)) > 0) {
      await input.fill(documentValue);
      return;
    }
  }

  const visibleTextInputs = page.locator("input:not([type='hidden']):not([type='radio']):not([type='checkbox'])");
  const count = await visibleTextInputs.count();
  if (count > 0) {
    await visibleTextInputs.nth(0).fill(documentValue);
  }
}

async function fillOptionalText(page, labels, value) {
  if (!value) return;
  for (const label of labels) {
    const input = page.getByLabel(label, { exact: false });
    if ((await input.count().catch(() => 0)) > 0) {
      await input.fill(value);
      return;
    }
  }
  const placeholder = labels.find((label) => label.toLowerCase().includes("e-mail")) || labels[0];
  const byPlaceholder = page.getByPlaceholder(placeholder, { exact: false });
  if ((await byPlaceholder.count().catch(() => 0)) > 0) {
    await byPlaceholder.fill(value);
  }
}

async function selectByLabelOrText(page, labels, value) {
  for (const label of labels) {
    const native = page.getByLabel(label, { exact: false });
    if ((await native.count().catch(() => 0)) > 0) {
      const tagName = await native.evaluate((node) => node.tagName.toLowerCase()).catch(() => "");
      if (tagName === "select") {
        await native.selectOption({ label: value }).catch(() => native.selectOption(value));
        return;
      }
      await native.click({ force: true }).catch(() => {});
      if (await clickOption(page, value)) return;
    }
  }

  const byText = page.getByText(labels[0], { exact: false });
  if ((await byText.count().catch(() => 0)) > 0) {
    await byText.click({ force: true }).catch(() => {});
    await clickOption(page, value);
  }
}

async function clickOption(page, value) {
  const optionLocators = [
    page.getByText(value, { exact: true }),
    page.getByText(value, { exact: false }),
    page.locator("mat-option, .mat-option, ng-option, .ng-option, option").filter({ hasText: value }),
  ];
  for (const locator of optionLocators) {
    if ((await locator.count().catch(() => 0)) > 0) {
      await locator.first().click({ force: true }).catch(() => {});
      return true;
    }
  }
  return false;
}

async function findSubmitButton(page) {
  const candidates = [
    page.getByRole("button", { name: "Solicitar certidão" }),
    page.getByText("Solicitar certidão", { exact: false }),
    page.locator("button[type='submit']").first(),
    page.locator("button").filter({ hasText: "Solicitar" }).first(),
  ];
  for (const candidate of candidates) {
    if ((await candidate.count().catch(() => 0)) > 0) {
      return candidate;
    }
  }
  return null;
}

function summarizePageText(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Solicitacao enviada ou aguardando retorno do portal CJF.";
  }
  if (/enviad[ao]|e-mail|email|protocolo|certid[aã]o/i.test(normalized)) {
    return normalized.slice(0, 280);
  }
  return "Fluxo CJF executado, mas o retorno precisa de revisao manual.";
}
