import { failedResult, unavailableResult } from "./base.collector.mjs";

export const fonte = "cndt";

const OFFICIAL_URL = "https://cndt-certidao.tst.jus.br/inicio.faces";

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
    "1. API oficial documentada: nao localizada para emissao aberta da CNDT.",
    "2. Endpoint HTTP/JSON publico: o portal usa JSF/Ajax e validacao humana, sem endpoint publico estavel para emissao direta.",
    "3. Request HTTP normal: nao usar para burlar captcha ou reCAPTCHA.",
    "4. Playwright: pode preencher CPF/CNPJ e detectar a barreira, mas deve parar para resolucao humana do captcha.",
    "5. PDF/OCR: baixar e extrair texto do PDF somente depois de emissao autorizada.",
  ];
}

export async function collect(input) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return unavailableResult(fonte, "Instale a dependencia Playwright para analisar o fluxo oficial da CNDT.", {
      officialUrl: OFFICIAL_URL,
      install: "npm install && npx playwright install chromium",
      integrationStrategy: discoverIntegrationStrategy(),
    });
  }

  const browser = await chromium.launch({
    headless: process.env.CNDT_HEADLESS !== "false",
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    userAgent: "Audita/0.1 CNDT certificate collector",
  });

  try {
    const timeoutMs = envNumber("CNDT_COLLECTOR_TIMEOUT_MS", 60000);
    return await withTimeout(
      inspectCndtFlow({ context, input }),
      timeoutMs,
      `CNDT excedeu o tempo maximo de ${Math.round(timeoutMs / 1000)}s.`,
    );
  } catch (error) {
    return failedResult(fonte, `Falha ao analisar fluxo CNDT/TST: ${error.message}`, {
      officialUrl: OFFICIAL_URL,
      integrationStrategy: discoverIntegrationStrategy(),
    });
  } finally {
    await browser.close();
  }
}

async function inspectCndtFlow({ context, input }) {
  const page = await context.newPage();
  try {
    page.setDefaultTimeout(envNumber("CNDT_STEP_TIMEOUT_MS", input.timeoutMs || 30000));
    await page.goto(OFFICIAL_URL, { waitUntil: "domcontentloaded" });

    const emitirInicial = page.locator("input[type='submit']").first();
    if ((await emitirInicial.count()) === 0) {
      return unavailableResult(fonte, "CNDT/TST nao exibiu o botao inicial de emissao.", {
        officialUrl: OFFICIAL_URL,
        integrationStrategy: discoverIntegrationStrategy(),
      });
    }

    await emitirInicial.click();
    await page.waitForSelector("#gerarCertidaoForm\\:cpfCnpj", { timeout: envNumber("CNDT_STEP_TIMEOUT_MS", 30000) });
    await page.locator("#gerarCertidaoForm\\:cpfCnpj").fill(input.documento);

    const captchaDetected = await page.evaluate(() => {
      const captchaImage = document.querySelector("#idImgBase64");
      const captchaAnswer = document.querySelector("#idCampoResposta");
      const recaptchaScript = [...document.scripts].some((script) => script.src.includes("recaptcha"));
      return Boolean(captchaImage || captchaAnswer || recaptchaScript || window.grecaptcha);
    });

    if (captchaDetected) {
      return unavailableResult(fonte, "CNDT/TST exige captcha/reCAPTCHA no fluxo oficial; a IA AUDITA nao burla essa validacao.", {
        officialUrl: OFFICIAL_URL,
        captchaRequired: true,
        documentFilled: true,
        fieldsDetected: ["cpfCnpj", "respostaCaptcha"],
        nextStep:
          "Para automatizar sem violar a validacao, implemente uma etapa assistida: o app exibe o captcha ao usuario, recebe a resposta e continua o download da certidao na mesma sessao.",
        integrationStrategy: discoverIntegrationStrategy(),
      });
    }

    return unavailableResult(fonte, "CNDT/TST carregou o formulario, mas nao retornou certidao sem etapa adicional.", {
      officialUrl: OFFICIAL_URL,
      documentFilled: true,
      integrationStrategy: discoverIntegrationStrategy(),
    });
  } finally {
    await page.close();
  }
}
