import {
  failedResult,
  manualRequiredResult,
  successResult,
  unavailableResult,
  waitingUserActionResult,
  SOURCE_RESULT,
} from "./base.collector.mjs";
import { readFile } from "node:fs/promises";
import { saveAndExtractPdfBuffer } from "../services/pdf.service.mjs";
import {
  findStateCourtProfile,
  getStateCourtCertificateLabel,
  getStateCourtFieldLabel,
} from "../services/state-courts.service.mjs";

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
  const stateCourtProfile = findStateCourtProfile(stateCourtUf);
  const stateCourtName = String(extra.stateCourtName || stateCourtProfile?.court || "TJDFT").trim();
  const stateCourtUrl = String(extra.stateCourtUrl || stateCourtProfile?.url || OFFICIAL_URL).trim();
  if (stateCourtUf && stateCourtUf !== "DF") {
    return collectStateCourtPortal({ input, profile: stateCourtProfile, stateCourtName, stateCourtUrl });
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

async function collectStateCourtPortal({ input, profile, stateCourtName, stateCourtUrl }) {
  const requestedCertificates = getStateCertificateTypesForInput(input, profile);
  const missingFields = getMissingStateCourtFields(input, profile);
  const baseData = {
    officialUrl: stateCourtUrl,
    tribunal: stateCourtName,
    uf: profile?.uf || input.extraFields?.stateCourtUf || "",
    stateName: profile?.stateName || "",
    platform: profile?.platform || "manual",
    automationStatus: profile?.automationStatus || "needs_mapping",
    captchaMode: profile?.captchaMode || "manual",
    requiredFields: profile?.requiredFields || [],
    optionalFields: profile?.optionalFields || [],
    missingFields,
    modo: "portal_oficial",
    certidoes: requestedCertificates.map((certificateType) => ({
      tipo: certificateType.label,
      status: "portal_oficial",
      errorMessage: "Emissao pelo portal oficial do tribunal.",
    })),
    integrationStrategy: discoverIntegrationStrategy(),
  };

  if (missingFields.length) {
    return unavailableResult(
      fonte,
      `${stateCourtName} exige campos adicionais antes da emissao: ${missingFields.map(getStateCourtFieldLabel).join(", ")}.`,
      {
        ...baseData,
        resumo: "Preencha os campos solicitados para continuar a emissao estadual.",
      },
    );
  }

  if (profile?.uf === "GO" && profile?.automationStatus === "active") {
    return collectGoStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData });
  }

  if (profile?.uf === "ES" && profile?.automationStatus === "active") {
    return collectEsTjesStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData });
  }

  if (profile?.uf === "SP" && profile?.platform === "esaj") {
    return collectSpEsajStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData });
  }

  if (profile?.uf === "BA") {
    return collectBaTjbaStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData });
  }

  if (profile?.automationStatus === "mapped" && ["esaj", "projudi", "eproc"].includes(profile.platform)) {
    const portal = await inspectStateCourtPortal(profile);
    return waitingUserActionResult(
      fonte,
      `${stateCourtName} usa portal com validacao assistida. O Audita abriu o fluxo e precisa da etapa humana quando houver captcha/login.`,
      {
        ...baseData,
        modo: "assistido",
        resumo: `${stateCourtName} mapeado em modo assistido. Portal carregado: ${portal.loaded ? "sim" : "nao"}.`,
        portalInspection: portal,
        proximoPasso: "Resolver validacao/captcha no portal oficial ou concluir mapeamento do adapter para persistir o PDF.",
      },
    );
  }

  return manualRequiredResult(
    fonte,
    `${stateCourtName} ainda nao tem adapter Playwright ativo. Use o portal oficial com os campos listados.`,
    {
      ...baseData,
      resumo: `${stateCourtName} cadastrado no catalogo. Automacao ainda em mapeamento para este tribunal.`,
      proximoPasso: "Mapear campos, captcha, botao de emissao e fluxo de download do PDF deste tribunal.",
    },
  );
}

function getMissingStateCourtFields(input, profile) {
  const fields = profile?.requiredFields || [];
  const provided = input.extraFields?.stateCourtFields || {};
  return fields.filter((field) => {
    if (field === "document") {
      const documentValue = input.tipoDocumento === "cnpj" ? input.extraFields?.cnpjDocument || input.documento : input.extraFields?.cpfDocument || input.documento;
      return !String(documentValue || "").replace(/\D/g, "");
    }
    if (field === "firstName") return !String(input.extraFields?.firstName || input.extraFields?.primeiroNome || provided.firstName || "").trim();
    if (field === "motherName") return !String(input.extraFields?.motherName || input.extraFields?.nomeMae || provided.motherName || "").trim();
    if (field === "fatherName") return !String(input.extraFields?.fatherName || input.extraFields?.nomePai || provided.fatherName || "").trim();
    if (field === "companyName") return !String(input.extraFields?.tjdftCompanyName || provided.companyName || "").trim();
    return !String(provided[field] || "").trim();
  });
}

function getStateCertificateTypesForInput(input, profile) {
  const available = Array.isArray(profile?.certificateTypes) && profile.certificateTypes.length ? profile.certificateTypes : ["civil", "criminal"];
  const selected = Array.isArray(input.extraFields?.stateCourtCertificateTypes)
    ? input.extraFields.stateCourtCertificateTypes.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const selectedSet = new Set(selected.length ? selected : available);
  return available
    .filter((certificateId) => selectedSet.has(certificateId))
    .map((certificateId) => ({ id: certificateId, label: getStateCourtCertificateLabel(certificateId) }));
}

async function inspectStateCourtPortal(profile) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return {
      loaded: false,
      errorMessage: "Playwright nao esta instalado neste ambiente.",
    };
  }

  const browser = await chromium.launch({ headless: process.env.STATE_COURT_HEADLESS !== "false" });
  const context = await browser.newContext({ userAgent: "Audita/0.1 state-court-discovery" });
  const page = await context.newPage();
  try {
    page.setDefaultTimeout(envNumber("STATE_COURT_STEP_TIMEOUT_MS", 12000));
    await page.goto(profile.url, { waitUntil: "domcontentloaded", timeout: envNumber("STATE_COURT_NAV_TIMEOUT_MS", 20000) });
    const title = await page.title().catch(() => "");
    const bodyText = await page.locator("body").innerText().catch(() => "");
    const normalized = normalize(bodyText);
    return {
      loaded: true,
      title,
      captchaDetected: /captcha|recaptcha|caracteres exibidos|codigo de seguranca|c[oó]digo de seguran[çc]a/i.test(bodyText),
      loginDetected: /login|entrar|senha|certificado digital/i.test(bodyText),
      downloadDetected: /download|baixar|pdf|certidao|certidão/i.test(bodyText),
      textSample: normalized.slice(0, 500),
    };
  } catch (error) {
    return {
      loaded: false,
      errorMessage: error.message,
    };
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function collectGoStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData }) {
  if (input.tipoDocumento !== "cpf") {
    return unavailableResult(fonte, "TJGO/Projudi emite certidão pública automatizada apenas para pessoa física neste adapter.", {
      ...baseData,
      resultado: "Pessoa jurídica deve usar fluxo próprio do portal quando disponível.",
    });
  }

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return unavailableResult(fonte, "Instale a dependência Playwright para executar o adapter TJGO/Projudi.", {
      ...baseData,
      install: "npm install && npx playwright install chromium",
    });
  }

  const browser = await chromium.launch({ headless: process.env.STATE_COURT_HEADLESS !== "false" });
  const context = await browser.newContext({
    acceptDownloads: true,
    userAgent: "Audita/0.1 TJGO certificate collector",
  });

  try {
    const collectorTimeoutMs = envNumber("STATE_COURT_COLLECTOR_TIMEOUT_MS", 120000);
    const results = await withTimeout(
      collectGoCertificates({ context, input, requestedCertificates }),
      collectorTimeoutMs,
      `TJGO excedeu o tempo máximo de ${Math.round(collectorTimeoutMs / 1000)}s.`,
    );

    if (results.every((result) => result.status !== "success")) {
      return failedResult(fonte, "Não foi possível emitir nenhuma certidão TJGO.", {
        ...baseData,
        certidoes: results,
      });
    }

    const encontrados = results.filter((result) => result.resultado === SOURCE_RESULT.CONSTA);
    const pendentes = results.filter((result) => result.resultado === SOURCE_RESULT.INDISPONIVEL);
    const resultadoGeral = encontrados.length
      ? SOURCE_RESULT.CONSTA
      : pendentes.length
        ? SOURCE_RESULT.INDISPONIVEL
        : SOURCE_RESULT.NADA_CONSTA;

    return successResult(fonte, resultadoGeral, {
      ...baseData,
      modo: "automatico",
      automationStatus: "active",
      officialUrl: stateCourtUrl || profile.url,
      tribunal: stateCourtName || profile.court,
      uf: "GO",
      certidoes: results,
      totalCertidoes: results.length,
      certidoesBaixadas: results.filter((result) => result.pdfPath).length,
      certidoesComApontamento: encontrados.map((result) => result.tipo),
      certidoesComAnalisePendente: pendentes.map((result) => result.tipo),
      resumo: encontrados.length
        ? "Uma ou mais certidões TJGO indicaram possível apontamento."
        : "TJGO consultado automaticamente pelo Projudi.",
    }, {
      rawText: results.map((result) => result.rawText || result.pageText || "").filter(Boolean).join("\n\n---\n\n"),
      pdfPath: results.find((result) => result.pdfPath)?.pdfPath || "",
    });
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function collectSpEsajStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData }) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return unavailableResult(fonte, "Instale a dependência Playwright para executar o adapter TJSP/ESAJ.", {
      ...baseData,
      install: "npm install && npx playwright install chromium",
    });
  }

  const browser = await chromium.launch({ headless: process.env.STATE_COURT_HEADLESS !== "false" });
  const context = await browser.newContext({
    acceptDownloads: true,
    userAgent: "Audita/0.1 TJSP ESAJ certificate collector",
  });

  try {
    const results = [];
    for (const certificateType of requestedCertificates) {
      results.push(await fillSpEsajCertificate({ context, input, certificateType }));
    }

    const completed = results.filter((result) => result.status === "success");
    const waiting = results.filter((result) => result.status === "waiting_user_action");
    if (completed.length) {
      return successResult(fonte, SOURCE_RESULT.INDISPONIVEL, {
        ...baseData,
        modo: waiting.length ? "automatico_com_validacao" : "automatico",
        tribunal: stateCourtName,
        uf: "SP",
        certidoes: results,
        totalCertidoes: results.length,
        certidoesBaixadas: results.filter((result) => result.pdfPath).length,
        resumo: waiting.length
          ? "TJSP foi preenchido automaticamente, mas algumas certidões exigem validação oficial."
          : "TJSP consultado automaticamente pelo ESAJ.",
      }, {
        rawText: results.map((result) => result.rawText || result.pageText || "").filter(Boolean).join("\n\n---\n\n"),
        pdfPath: results.find((result) => result.pdfPath)?.pdfPath || "",
      });
    }

    return waitingUserActionResult(
      fonte,
      "TJSP/ESAJ foi preenchido automaticamente, mas o portal exige reCAPTCHA/validação oficial antes de emitir.",
      {
        ...baseData,
        modo: "automatico_com_validacao",
        tribunal: stateCourtName,
        uf: "SP",
        certidoes: results,
        proximoPasso: "Resolver a validação oficial no portal para permitir o envio e o download.",
      },
    );
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function collectEsTjesStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData }) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return unavailableResult(fonte, "Instale a dependência Playwright para executar o adapter TJES.", {
      ...baseData,
      install: "npm install && npx playwright install chromium",
    });
  }

  const browser = await chromium.launch({ headless: process.env.STATE_COURT_HEADLESS !== "false" });
  const context = await browser.newContext({
    acceptDownloads: true,
    userAgent: "Audita/0.1 TJES certificate collector",
  });

  try {
    const results = [];
    for (const certificateType of requestedCertificates) {
      results.push(await collectEsTjesCertificate({ context, input, certificateType }));
    }

    if (results.every((result) => result.status !== "success")) {
      return failedResult(fonte, "Não foi possível emitir nenhuma certidão TJES.", {
        ...baseData,
        certidoes: results,
      });
    }

    const encontrados = results.filter((result) => result.resultado === SOURCE_RESULT.CONSTA);
    const pendentes = results.filter((result) => result.resultado === SOURCE_RESULT.INDISPONIVEL);
    const resultadoGeral = encontrados.length
      ? SOURCE_RESULT.CONSTA
      : pendentes.length
        ? SOURCE_RESULT.INDISPONIVEL
        : SOURCE_RESULT.NADA_CONSTA;

    return successResult(fonte, resultadoGeral, {
      ...baseData,
      modo: "automatico",
      tribunal: stateCourtName || "TJES",
      uf: "ES",
      certidoes: results,
      totalCertidoes: results.length,
      certidoesBaixadas: results.filter((result) => result.pdfPath).length,
      certidoesComApontamento: encontrados.map((result) => result.tipo),
      certidoesComAnalisePendente: pendentes.map((result) => result.tipo),
      resumo: "TJES consultado automaticamente pelo portal de Certidão Negativa.",
    }, {
      rawText: results.map((result) => result.rawText || result.pageText || "").filter(Boolean).join("\n\n---\n\n"),
      pdfPath: results.find((result) => result.pdfPath)?.pdfPath || "",
    });
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function collectBaTjbaStateCourt({ input, stateCourtName, requestedCertificates, baseData }) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return unavailableResult(fonte, "Instale a dependência Playwright para executar o adapter TJBA.", {
      ...baseData,
      install: "npm install && npx playwright install chromium",
    });
  }

  const browser = await chromium.launch({ headless: process.env.STATE_COURT_HEADLESS !== "false" });
  const context = await browser.newContext({
    acceptDownloads: true,
    userAgent: "Audita/0.1 TJBA certificate collector",
  });

  try {
    const results = [];
    for (const certificateType of requestedCertificates) {
      results.push(await fillBaTjbaCertificate({ context, input, certificateType }));
    }

    return waitingUserActionResult(
      fonte,
      "TJBA foi preenchido automaticamente até a validação oficial. O portal possui reCAPTCHA, então exige ação do usuário.",
      {
        ...baseData,
        modo: "automatico_com_validacao",
        tribunal: stateCourtName || "TJBA",
        uf: "BA",
        certidoes: results,
        totalCertidoes: results.length,
        proximoPasso: "Resolver a validação oficial no portal do TJBA para continuar a emissão.",
      },
    );
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function fillBaTjbaCertificate({ context, input, certificateType }) {
  const page = await context.newPage();
  try {
    page.setDefaultTimeout(envNumber("STATE_COURT_STEP_TIMEOUT_MS", input.timeoutMs || 30000));
    const fields = input.extraFields?.stateCourtFields || {};
    await page.goto("https://portalcertidoes.tjba.jus.br/#/primeirograu", {
      waitUntil: "domcontentloaded",
      timeout: envNumber("STATE_COURT_NAV_TIMEOUT_MS", 30000),
    });
    await page.waitForTimeout(2500);
    await page.locator(input.tipoDocumento === "cnpj" ? "#radioJuridica" : "#radioFisica").check({ force: true }).catch(() => {});
    await page.locator("#selectModelo").selectOption(baModelValue(certificateType.id));
    await page.locator(baParticipationSelector(fields.participation)).check({ force: true }).catch(() => {});

    const pageText = await page.locator("body").innerText().catch(() => "");
    return {
      tipo: certificateType.label,
      status: "waiting_user_action",
      resultado: SOURCE_RESULT.INDISPONIVEL,
      pageText,
      errorMessage: "TJBA possui reCAPTCHA oficial antes do avanço da solicitação.",
      resumo: "Tipo de pessoa, modelo e participação preenchidos; validação oficial pendente.",
    };
  } catch (error) {
    return {
      tipo: certificateType.label,
      status: "failed",
      resultado: SOURCE_RESULT.ERRO,
      errorMessage: error.message,
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function collectEsTjesCertificate({ context, input, certificateType }) {
  const page = await context.newPage();
  try {
    page.setDefaultTimeout(envNumber("STATE_COURT_STEP_TIMEOUT_MS", input.timeoutMs || 30000));
    const fields = input.extraFields?.stateCourtFields || {};
    const documentValue = String(
      input.tipoDocumento === "cnpj" ? input.extraFields?.cnpjDocument || input.documento : input.extraFields?.cpfDocument || input.documento,
    ).replace(/\D/g, "");
    await page.goto("https://sistemas.tjes.jus.br/certidaonegativa/sistemas/certidao/CERTIDAOPESQUISA.cfm", {
      waitUntil: "domcontentloaded",
      timeout: envNumber("STATE_COURT_NAV_TIMEOUT_MS", 30000),
    });

    await page.locator("#cbInstancia").selectOption(esInstanceValue(fields.instance));
    await page.waitForTimeout(500);
    await page.locator("#cbNatureza").selectOption(esNatureValue(certificateType.id)).catch(() => {});
    await page.locator(input.tipoDocumento === "cnpj" ? "#rbPessoaJ" : "#rbPessoaF").check({ force: true }).catch(() => {});
    await safeFill(page, input.tipoDocumento === "cnpj" ? "#edCnpj" : "#edCpf", documentValue);
    await safeFill(page, "#edRg", fields.rg);
    await safeFill(page, "#edTitEleitor", fields.voterTitle);
    await safeFill(page, "#edCtpsNumero", fields.ctpsNumber);
    await safeFill(page, "#edCtpsSerie", fields.ctpsSeries);
    await safeFill(page, "#edNome", fields.fullName);
    await safeFill(page, "#edMae", fields.motherName);
    await safeFill(page, "#edPai", fields.fatherName);
    await safeFill(page, "#edNascimento", formatBrazilianDate(fields.birthDate));
    await selectByTextOrValue(page, "#cbNacionalidade", fields.nationality || "BRASILEIRO");
    await selectByTextOrValue(page, "#cbEstadoCivil", fields.civilStatus);
    await safeFill(page, "input[name='edProfissao']", fields.profession);
    await selectByTextOrValue(page, "#cbMunicipioInfo", fields.city);
    await safeFill(page, "#edBairro", fields.neighborhood);
    await safeFill(page, "#edRua", fields.address);
    await safeFill(page, "#edNumero", fields.addressNumber);
    await safeFill(page, "#edComplemento", fields.addressComplement);
    await safeFill(page, "#edCep", fields.cep);
    await safeFill(page, "#edEmail", fields.email);
    await safeFill(page, "#edTelFixo", fields.phone);
    await safeFill(page, "#edTelCelular", fields.mobile);

    const downloadPromise = page.waitForEvent("download", { timeout: envNumber("STATE_COURT_DOWNLOAD_TIMEOUT_MS", 25000) }).catch(() => null);
    await page.locator("#btnSolicitar").click();
    const download = await downloadPromise;
    await page.waitForLoadState("domcontentloaded", { timeout: envNumber("STATE_COURT_STEP_TIMEOUT_MS", 30000) }).catch(() => {});
    await page.waitForTimeout(1500);
    const pageText = await page.locator("body").innerText().catch(() => "");
    const captchaDetected = /captcha|recaptcha|c[oó]digo de seguran[çc]a|caracteres exibidos/i.test(pageText);
    if (captchaDetected) {
      return {
        tipo: certificateType.label,
        status: "waiting_user_action",
        resultado: SOURCE_RESULT.INDISPONIVEL,
        pageText,
        errorMessage: "TJES solicitou validação/captcha durante a emissão.",
      };
    }

    if (download) {
      const downloadPath = await download.path();
      const buffer = Buffer.from(await readFile(downloadPath));
      const { pdfPath, rawText } = await saveAndExtractPdfBuffer({
        consultaId: input.consultaId,
        fonte,
        fileName: `tjes-${certificateType.id}.pdf`,
        buffer,
      });
      return {
        tipo: certificateType.label,
        status: "success",
        resultado: classifyCertificateText(rawText || pageText),
        pdfPath,
        rawText,
        pageText,
        resumo: summarizeCertificateText(rawText || pageText),
      };
    }

    const pdfLink = await findPdfLink(page);
    if (pdfLink) {
      const pdfResponse = await fetch(pdfLink);
      if (pdfResponse.ok) {
        const buffer = Buffer.from(await pdfResponse.arrayBuffer());
        const { pdfPath, rawText } = await saveAndExtractPdfBuffer({
          consultaId: input.consultaId,
          fonte,
          fileName: `tjes-${certificateType.id}.pdf`,
          buffer,
        });
        return {
          tipo: certificateType.label,
          status: "success",
          resultado: classifyCertificateText(rawText || pageText),
          pdfPath,
          rawText,
          pageText,
          downloadUrl: maskSignedUrl(pdfLink),
          resumo: summarizeCertificateText(rawText || pageText),
        };
      }
    }

    if (hasCertificateResultSignal(pageText)) {
      return {
        tipo: certificateType.label,
        status: "success",
        resultado: classifyCertificateText(pageText),
        rawText: pageText,
        pageText,
        resumo: summarizeCertificateText(pageText),
      };
    }

    return {
      tipo: certificateType.label,
      status: "failed",
      resultado: SOURCE_RESULT.ERRO,
      pageText,
      errorMessage: "TJES não retornou PDF nem texto conclusivo de certidão.",
    };
  } catch (error) {
    return {
      tipo: certificateType.label,
      status: "failed",
      resultado: SOURCE_RESULT.ERRO,
      errorMessage: error.message,
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function fillSpEsajCertificate({ context, input, certificateType }) {
  const page = await context.newPage();
  try {
    page.setDefaultTimeout(envNumber("STATE_COURT_STEP_TIMEOUT_MS", input.timeoutMs || 30000));
    const fields = input.extraFields?.stateCourtFields || {};
    const cpf = String(input.extraFields?.cpfDocument || input.documento || "").replace(/\D/g, "");
    await page.goto("https://esaj.tjsp.jus.br/sco/abrirCadastro.do", {
      waitUntil: "domcontentloaded",
      timeout: envNumber("STATE_COURT_NAV_TIMEOUT_MS", 30000),
    });
    await page.locator("#cdModelo").selectOption(spEsajModelValue(certificateType.id));
    await page.waitForTimeout(700);

    const personType = input.tipoDocumento === "cnpj" ? "J" : "F";
    await page.locator(`input[name="entity.tpPessoa"][value="${personType}"]`).check({ force: true });
    await safeFill(page, "#nmCadastroF", fields.fullName);
    await safeFill(page, "#nmCadastroJ", fields.fullName);
    await safeFill(page, "#identity\\.nuCpfFormatado", formatDocument(cpf));
    await safeFill(page, "#identity\\.nuRgFormatado", fields.rg);
    await safeFill(page, "#identity\\.nuCnpjFormatado", String(input.extraFields?.cnpjDocument || input.documento || ""));
    await safeFill(page, "#nmMaeCadastro", fields.motherName);
    await safeFill(page, "#nmPaiCadastro", fields.fatherName);
    await safeFill(page, "#dataNascimento", formatBrazilianDate(fields.birthDate));
    await setRadioValue(page, "entity.flGenero", fields.gender);
    await safeFill(page, "#entity\\.nacionalidade\\.deNacionalidade", fields.nationality || "Brasileira");
    await safeFill(page, "#entity\\.naturalidade\\.nmMunicipio", fields.naturality);
    await selectByTextOrValue(page, "#id_sco\\.pedido\\.label\\.cdEstadocivil", fields.civilStatus);
    await safeFill(page, "#entity\\.deProfissao", fields.profession);
    await safeFill(page, "#identity\\.endNomePesq\\.deEndereco", fields.address);
    await safeFill(page, "#identity\\.endNomePesq\\.deComplemento", fields.addressComplement);
    await safeFill(page, "#identity\\.endNomePesq\\.nuCep", fields.cep);
    await safeFill(page, "#identity\\.endNomePesq\\.deBairro", fields.neighborhood);
    await safeFill(page, "#entity\\.endNomePesq\\.municipio\\.nmMunicipio", fields.city);
    await safeFill(page, "#identity\\.solicitante\\.deEmail", fields.email);
    await page.locator("#confirmacaoInformacoes").check({ force: true }).catch(() => {});

    const pageText = await page.locator("body").innerText().catch(() => "");
    const recaptchaPresent = await page.locator("[name='g-recaptcha-response'], iframe[src*='recaptcha']").count().catch(() => 0);
    if (recaptchaPresent) {
      return {
        tipo: certificateType.label,
        status: "waiting_user_action",
        resultado: SOURCE_RESULT.INDISPONIVEL,
        pageText,
        errorMessage: "TJSP/ESAJ possui reCAPTCHA oficial antes do envio.",
        resumo: "Campos preenchidos; validação oficial pendente.",
      };
    }

    return {
      tipo: certificateType.label,
      status: "waiting_user_action",
      resultado: SOURCE_RESULT.INDISPONIVEL,
      pageText,
      errorMessage: "TJSP/ESAJ preenchido; envio final requer confirmação no portal oficial.",
      resumo: "Campos preenchidos; ação final do usuário pendente.",
    };
  } catch (error) {
    return {
      tipo: certificateType.label,
      status: "failed",
      resultado: SOURCE_RESULT.ERRO,
      errorMessage: error.message,
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function collectGoCertificates({ context, input, requestedCertificates }) {
  const results = [];
  for (const certificateType of requestedCertificates) {
    results.push(await collectGoCertificate({ context, input, certificateType }));
  }
  return results;
}

async function collectGoCertificate({ context, input, certificateType }) {
  const page = await context.newPage();
  try {
    page.setDefaultTimeout(envNumber("STATE_COURT_STEP_TIMEOUT_MS", input.timeoutMs || 30000));
    const url = goCertificateUrl(certificateType.id);
    const fields = input.extraFields?.stateCourtFields || {};
    const cpf = String(input.extraFields?.cpfDocument || input.documento || "").replace(/\D/g, "");
    const fullName = String(fields.fullName || input.extraFields?.fullName || "").trim();
    const motherName = String(fields.motherName || input.extraFields?.motherName || "").trim();
    const birthDate = String(fields.birthDate || input.extraFields?.birthDate || "").trim();

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: envNumber("STATE_COURT_NAV_TIMEOUT_MS", 30000) });
    await page.locator("#Nome").fill(fullName);
    await page.locator("#Cpf").fill(cpf);
    await page.locator("#NomeMae").fill(motherName);
    await page.locator("#DataNascimento").fill(formatBrazilianDate(birthDate));

    const submit = page.locator("input[name='imgSubmeter']");
    const downloadPromise = page.waitForEvent("download", { timeout: envNumber("STATE_COURT_DOWNLOAD_TIMEOUT_MS", 25000) }).catch(() => null);
    await submit.click();
    const download = await downloadPromise;
    await page.waitForLoadState("domcontentloaded", { timeout: envNumber("STATE_COURT_STEP_TIMEOUT_MS", 30000) }).catch(() => {});
    await page.waitForTimeout(1500);

    const pageText = await page.locator("body").innerText().catch(() => "");
    const captchaDetected = /captcha|recaptcha|c[oó]digo de seguran[çc]a|caracteres exibidos/i.test(pageText);
    if (captchaDetected) {
      return {
        tipo: certificateType.label,
        status: "waiting_user_action",
        resultado: SOURCE_RESULT.INDISPONIVEL,
        pageText,
        errorMessage: "TJGO solicitou validação/captcha durante a emissão.",
      };
    }

    if (download) {
      const downloadPath = await download.path();
      const buffer = Buffer.from(await readFile(downloadPath));
      const { pdfPath, rawText } = await saveAndExtractPdfBuffer({
        consultaId: input.consultaId,
        fonte,
        fileName: `tjgo-${certificateType.id}.pdf`,
        buffer,
      });
      return {
        tipo: certificateType.label,
        status: "success",
        resultado: classifyCertificateText(rawText || pageText),
        pdfPath,
        rawText,
        pageText,
        resumo: summarizeCertificateText(rawText || pageText),
      };
    }

    const pdfLink = await findPdfLink(page);
    if (pdfLink) {
      const pdfResponse = await fetch(pdfLink);
      if (pdfResponse.ok) {
        const buffer = Buffer.from(await pdfResponse.arrayBuffer());
        const { pdfPath, rawText } = await saveAndExtractPdfBuffer({
          consultaId: input.consultaId,
          fonte,
          fileName: `tjgo-${certificateType.id}.pdf`,
          buffer,
        });
        return {
          tipo: certificateType.label,
          status: "success",
          resultado: classifyCertificateText(rawText || pageText),
          pdfPath,
          rawText,
          pageText,
          downloadUrl: maskSignedUrl(pdfLink),
          resumo: summarizeCertificateText(rawText || pageText),
        };
      }
    }

    if (hasCertificateResultSignal(pageText)) {
      return {
        tipo: certificateType.label,
        status: "success",
        resultado: classifyCertificateText(pageText),
        pageText,
        rawText: pageText,
        resumo: summarizeCertificateText(pageText),
      };
    }

    return {
      tipo: certificateType.label,
      status: "failed",
      resultado: SOURCE_RESULT.ERRO,
      pageText,
      errorMessage: "TJGO não retornou PDF nem texto conclusivo de certidão.",
    };
  } catch (error) {
    return {
      tipo: certificateType.label,
      status: "failed",
      resultado: SOURCE_RESULT.ERRO,
      errorMessage: error.message,
    };
  } finally {
    await page.close().catch(() => {});
  }
}

function goCertificateUrl(certificateId) {
  if (certificateId === "criminal") {
    return "https://projudi.tjgo.jus.br/CertidaoNegativaPositivaPublica?PaginaAtual=1&TipoArea=2&InteressePessoal=S";
  }
  return "https://projudi.tjgo.jus.br/CertidaoNegativaPositivaPublica?PaginaAtual=1&TipoArea=1&InteressePessoal=&Territorio=&Finalidade=";
}

function spEsajModelValue(certificateId) {
  const values = {
    falencia: "58",
    criminal: "6",
    civil: "52",
  };
  return values[certificateId] || values.civil;
}

function esInstanceValue(value) {
  const normalized = normalize(value);
  if (normalized.includes("2") || normalized.includes("segunda")) {
    return "2";
  }
  return "1";
}

function esNatureValue(certificateId) {
  const values = {
    civil: "1",
    criminal: "5",
    falencia: "11",
  };
  return values[certificateId] || "99";
}

function baModelValue(certificateId) {
  const values = {
    civil: "1",
    criminal: "2",
    inventario: "3",
    insolvencia: "5",
    interdicao: "10",
  };
  return values[certificateId] || values.civil;
}

function baParticipationSelector(value) {
  const normalized = normalize(value);
  if (normalized.includes("ativa")) return "#radioAtiva";
  if (normalized.includes("ambas")) return "#radioAmbas";
  return "#radioPassiva";
}

async function safeFill(page, selector, value) {
  const text = String(value || "").trim();
  if (!text) {
    return;
  }
  const locator = page.locator(selector);
  if (await locator.count().catch(() => 0)) {
    await locator.fill(text, { timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 5000) }).catch(() => {});
  }
}

async function setRadioValue(page, name, value) {
  const normalized = normalize(value);
  let radioValue = "";
  if (["m", "masculino"].includes(normalized)) radioValue = "M";
  if (["f", "feminino"].includes(normalized)) radioValue = "F";
  if (!radioValue) {
    return;
  }
  await page.locator(`input[name="${name}"][value="${radioValue}"]`).check({ force: true }).catch(() => {});
}

async function selectByTextOrValue(page, selector, value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return;
  }
  const locator = page.locator(selector);
  if (!(await locator.count().catch(() => 0))) {
    return;
  }
  const selected = await locator.evaluate((select, rawValue) => {
    const normalized = String(rawValue || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const option = [...select.options].find((item) => {
      const text = String(item.text || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      return item.value === rawValue || text === normalized || text.includes(normalized);
    });
    if (!option) return false;
    select.value = option.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, raw).catch(() => false);
  return selected;
}

async function findPdfLink(page) {
  const href = await page
    .locator("a[href*='.pdf'], a[href*='Download'], a[href*='download'], a[href*='Certidao']")
    .first()
    .getAttribute("href")
    .catch(() => "");
  if (!href) {
    return "";
  }
  try {
    return new URL(href, page.url()).toString();
  } catch {
    return "";
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

function hasCertificateResultSignal(text) {
  const normalized = normalize(text);
  return (
    hasPositiveCertificateSignal(text) ||
    hasNegativeCertificateSignal(text) ||
    normalized.includes("certidao nada consta") ||
    normalized.includes("certidao positiva") ||
    normalized.includes("certidao emitida")
  );
}

function formatBrazilianDate(value) {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-");
    return `${day}/${month}/${year}`;
  }
  if (digits.length === 8) {
    if (raw.includes("/")) {
      return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    }
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }
  return raw;
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
