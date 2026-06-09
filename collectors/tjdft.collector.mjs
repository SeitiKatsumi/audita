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

const assistedSessions = new Map();

function envNumber(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function envFlag(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function isCaptchaLabMode() {
  return envFlag("AUDITA_CAPTCHA_LAB_MODE", false);
}

function isRemoteAssistedBrowser() {
  return envFlag("AUDITA_REMOTE_ASSISTED_BROWSER", true);
}

function getAssistedHeadless(profile) {
  if (isRemoteAssistedBrowser()) {
    return true;
  }
  if (profile?.captchaMode === "assisted") {
    return envFlag("STATE_COURT_ASSISTED_HEADLESS", false);
  }
  return process.env.STATE_COURT_HEADLESS !== "false";
}

function shouldKeepAssistedOpen() {
  return isCaptchaLabMode() || process.env.STATE_COURT_KEEP_ASSISTED_OPEN !== "false";
}

export function classifyHumanCheckpoint({ requiresCaptcha, requiresRecaptcha, requiresLogin, requiresConfirmation, blockedByProtection } = {}) {
  if (blockedByProtection) return "anti_bot_block";
  if (requiresCaptcha || requiresRecaptcha) return "captcha_or_recaptcha";
  if (requiresLogin) return "login_or_certificate";
  if (requiresConfirmation) return "official_confirmation";
  return "manual_review";
}

export function buildCaptchaLabReport({ profile, results, sessionOpen, sessionId, browserEngine = "playwright" }) {
  const safeResults = Array.isArray(results) ? results : [];
  const checkpoints = safeResults.map((result) => classifyHumanCheckpoint(result));
  const uniqueCheckpoints = [...new Set(checkpoints)];
  return {
    enabled: isCaptchaLabMode(),
    policy: "no_bypass",
    remoteBrowser: isRemoteAssistedBrowser(),
    browserEngine,
    headless: getAssistedHeadless(profile),
    sessionOpen: Boolean(sessionOpen),
    assistedSession: sessionId || "",
    checkpoints: uniqueCheckpoints,
    reachedCaptcha: safeResults.some((result) => result.requiresCaptcha || result.requiresRecaptcha),
    reachedAntiBot: safeResults.some((result) => result.blockedByProtection),
    reachedLogin: safeResults.some((result) => result.requiresLogin),
    reachedConfirmation: safeResults.some((result) => result.requiresConfirmation),
    filledFields: [...new Set(safeResults.flatMap((result) => result.filledFields || []))],
    note: "Laboratorio local mede ate onde o fluxo oficial avanca e pausa para validacao humana; nao tenta contornar CAPTCHA, reCAPTCHA, Cloudflare ou protecao anti-bot.",
  };
}

export function analyzeAssistedSessionSnapshot({ title = "", url = "", text = "", links = [] } = {}) {
  const safeText = String(text || "");
  const safeLinks = Array.isArray(links) ? links : [];
  const isCadastroForm = /abrirCadastro\.do/i.test(String(url || "")) || /Cadastro de Pedido de Certid[aã]o|Para pedir uma certid[aã]o/i.test(safeText);
  const pdfLinks = isCadastroForm
    ? []
    : safeLinks.filter((link) => {
        const href = String(link.href || "");
        const label = String(link.text || "");
        return /\.pdf(?:\?|#|$)/i.test(href) || /(?:abrirDownload|download).*certid/i.test(`${href} ${label}`);
      });
  const rawProtocolMatch = safeText.match(
    /(?:protocolo|pedido|solicita[cç][aã]o)\s*(?:n(?:[uú]mero|[ºo.])?)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9./-]{4,})/i,
  );
  const protocol = /\d/.test(rawProtocolMatch?.[1] || "") ? rawProtocolMatch[1] : "";
  const hasResultSignal = !isCadastroForm && /nada\s+consta|certid[aã]o\s+(?:negativa|emitida)|consta(?:m)?\s+(?:registro|apontamento|distribui[cç][aã]o|processo)|protocolo|pedido\s+(?:gerado|registrado|cadastrado)/i.test(safeText);
  const hasCaptchaSignal = /captcha|recaptcha|confirme que voc[eê]|sou humano|valida[cç][aã]o humana/i.test(safeText);
  const hasErrorSignal = /erro|falha|indispon[ií]vel|n[aã]o foi poss[ií]vel|tente novamente/i.test(safeText);
  const status = pdfLinks.length || protocol || hasResultSignal
    ? "result_available"
    : hasErrorSignal
      ? "portal_error"
      : hasCaptchaSignal || isCadastroForm
        ? "captcha_pending"
        : "no_result_yet";

  return {
    status,
    title: String(title || ""),
    url: String(url || ""),
    protocol,
    pdfLinks: pdfLinks.slice(0, 5),
    textSample: safeText.replace(/\s+/g, " ").trim().slice(0, 900),
  };
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
      const firstError = results.find((result) => result.errorMessage)?.errorMessage;
      return failedResult(fonte, firstError || "Nao foi possivel emitir nenhuma certidao TJDFT.", {
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

  if (profile?.uf === "AP" && profile?.automationStatus === "active") {
    return collectApTjapStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData });
  }

  if (profile?.uf === "MT" && profile?.automationStatus === "mapped") {
    return collectMtTjmtStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData });
  }

  if (profile?.platform === "esaj") {
    return collectEsajStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData });
  }

  if (profile?.uf === "SE") {
    return collectSeTjseStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData });
  }

  if (profile?.uf === "BA") {
    return collectBaTjbaStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData });
  }

  if (profile?.automationStatus === "mapped") {
    return collectGenericAssistedStateCourt({
      input,
      profile,
      stateCourtName,
      stateCourtUrl,
      requestedCertificates,
      baseData,
    });
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

async function collectGenericAssistedStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData }) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return unavailableResult(fonte, `Instale a dependencia Playwright para executar o modo assistido ${stateCourtName}.`, {
      ...baseData,
      install: "npm install && npx playwright install chromium",
    });
  }

  const browser = await chromium.launch({
    headless: getAssistedHeadless(profile),
    slowMo: envNumber("STATE_COURT_ASSISTED_SLOW_MO_MS", 0),
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    ignoreHTTPSErrors: true,
    userAgent: `Audita/0.1 ${stateCourtName || profile?.court || "state-court"} assisted collector`,
  });
  let keepBrowserOpen = false;
  let sessionId = "";

  try {
    const results = [];
    for (const certificateType of requestedCertificates) {
      results.push(await fillGenericAssistedCertificate({ context, input, profile, certificateType }));
    }
    const loaded = results.some((result) => result.portalLoaded);
    const filledCount = results.reduce((sum, result) => sum + (Array.isArray(result.filledFields) ? result.filledFields.length : 0), 0);
    const protectionDetected = results.some((result) => result.requiresCaptcha || result.requiresLogin || result.requiresConfirmation);
    if (loaded && shouldKeepAssistedOpen()) {
      keepBrowserOpen = true;
      sessionId = createAssistedSession({ browser, context, courtName: stateCourtName || profile?.court, courtUf: profile?.uf, portalUrl: stateCourtUrl || profile?.url, input, profile, results });
    }

    return waitingUserActionResult(
      fonte,
      `${stateCourtName} esta em automacao assistida. O Audita preenche os campos reconhecidos e pausa na validacao oficial quando o portal exigir.`,
      {
        ...baseData,
        automationStatus: "active",
        captchaMode: profile?.captchaMode || "assisted",
        modo: "automatico_com_validacao",
        tribunal: stateCourtName || profile?.court,
        uf: profile?.uf || input.extraFields?.stateCourtUf || "",
        validationFrameUrl: stateCourtUrl || profile?.url,
        assistedPortalUrl: stateCourtUrl || profile?.url,
        assistedSession: sessionId || "external_browser",
        sessionOpen: keepBrowserOpen,
        certidoes: results,
        totalCertidoes: results.length,
        camposPreenchidos: filledCount,
        portalInspection: {
          loaded,
          protectionDetected,
          filledFields: [...new Set(results.flatMap((result) => result.filledFields || []))],
          textSample: results.find((result) => result.pageText)?.pageText?.slice(0, 500) || "",
        },
        captchaLab: buildCaptchaLabReport({ profile, results, sessionOpen: keepBrowserOpen, sessionId }),
        resumo: loaded
          ? `${stateCourtName} carregado e preenchido em modo assistido. Campos preenchidos: ${filledCount}.`
          : `${stateCourtName} nao carregou completamente no teste automatico.`,
        proximoPasso: keepBrowserOpen
          ? "Resolver reCAPTCHA, captcha, login ou confirmacao na janela oficial ja preenchida; depois anexar/confirmar a certidao no Audita."
          : "Resolver reCAPTCHA, captcha, login ou confirmacao oficial no portal; depois anexar/confirmar a certidao para fechar a consulta.",
      },
    );
  } finally {
    if (!keepBrowserOpen) {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  }
}

async function fillGenericAssistedCertificate({ context, input, profile, certificateType }) {
  const page = await context.newPage();
  let keepPageOpen = false;
  try {
    page.setDefaultTimeout(envNumber("STATE_COURT_STEP_TIMEOUT_MS", input.timeoutMs || 25000));
    await page.goto(profile?.url, {
      waitUntil: "domcontentloaded",
      timeout: envNumber("STATE_COURT_NAV_TIMEOUT_MS", 30000),
    });
    await page.waitForTimeout(envNumber("STATE_COURT_DISCOVERY_DELAY_MS", 1800));

    const fields = buildGenericStateCourtValues(input, profile, certificateType);
    await executeProfileNavigation(page, profile, fields);
    const fillReport = await page.evaluate((values) => {
      const normalizeText = (value) =>
        String(value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();
      const visible = (element) => {
        const style = window.getComputedStyle(element);
        return Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length) && style.visibility !== "hidden" && style.display !== "none";
      };
      const fire = (element) => {
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        element.dispatchEvent(new Event("blur", { bubbles: true }));
      };
      const labelText = (element) => {
        const pieces = [];
        if (element.id) {
          const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
          if (label) pieces.push(label.innerText || label.textContent || "");
        }
        const closestLabel = element.closest("label");
        if (closestLabel) pieces.push(closestLabel.innerText || closestLabel.textContent || "");
        const row = element.closest(".form-group, .field, .linha, .row, .control-group, p, div, td, tr, li");
        if (row) pieces.push(row.innerText || row.textContent || "");
        pieces.push(element.getAttribute("aria-label") || "");
        pieces.push(element.getAttribute("placeholder") || "");
        pieces.push(element.getAttribute("name") || "");
        pieces.push(element.id || "");
        return normalizeText(pieces.join(" "));
      };
      const pickField = (text, element) => {
        const name = normalizeText(`${element.name || ""} ${element.id || ""}`);
        const haystack = `${text} ${name}`;
        if (/(cnpj|cpf|documento|doc\.?|cic)/.test(haystack)) return "document";
        if (/(tipo documento|tipo de documento|documento ao lado)/.test(haystack)) return "documentType";
        if (/(email|e-mail)/.test(haystack)) return "email";
        if (/(mae|mãe|genitora)/.test(haystack)) return "motherName";
        if (/(pai|genitor)/.test(haystack)) return "fatherName";
        if (/(nasc|data nascimento|dt nascimento)/.test(haystack)) return "birthDate";
        if (/(rg|identidade|registro geral)/.test(haystack)) return "rg";
        if (/(telefone|celular|whatsapp)/.test(haystack)) return "phone";
        if (/(cep)/.test(haystack)) return "cep";
        if (/(bairro)/.test(haystack)) return "neighborhood";
        if (/(cidade|municipio|município|comarca|domicilio|domicílio)/.test(haystack)) return "city";
        if (/(endereco|endereço|logradouro|rua|avenida)/.test(haystack)) return "address";
        if (/(profissao|profissão)/.test(haystack)) return "profession";
        if (/(nacionalidade)/.test(haystack)) return "nationality";
        if (/(naturalidade)/.test(haystack)) return "naturality";
        if (/(estado civil|estadocivil)/.test(haystack)) return "civilStatus";
        if (/(nome|razao social|razão social|requerente|parte|pessoa)/.test(haystack) && !/(mae|mãe|pai)/.test(haystack)) return "fullName";
        return "";
      };
      const valuesFor = (field, element) => {
        if (!field) return [];
        if (field === "birthDate") {
          return element.type === "date" ? [values.birthDateIso, values.birthDateText] : [values.birthDateText, values.birthDateIso];
        }
        if (field === "phone") return [values.mobile, values.phone];
        if (field === "city") return [values.city, values.comarca, values.domicile];
        return [values[field]];
      };
      const firstValue = (field, element) => valuesFor(field, element).find((item) => String(item || "").trim());
      const fillElement = (element, field) => {
        const value = firstValue(field, element);
        if (!value || element.disabled || element.readOnly) return false;
        element.focus();
        element.value = String(value);
        fire(element);
        return true;
      };
      const chooseSelect = (select, field) => {
        const preferred = valuesFor(field, select).map(normalizeText).filter(Boolean);
        if (field === "certificate") preferred.push(normalizeText(values.certificateLabel), normalizeText(values.certificateId));
        if (field === "personType") preferred.push(values.isCompany ? "juridica" : "fisica", values.isCompany ? "cnpj" : "cpf");
        if (field === "documentType") preferred.push(values.isCompany ? "cnpj" : "cpf", values.isCompany ? "pessoa juridica" : "pessoa fisica");
        if (!preferred.length) return false;
        const options = [...select.options].filter((option) => !option.disabled);
        const option = options.find((item) => {
          const optionText = normalizeText(`${item.text} ${item.value}`);
          return preferred.some((itemText) => itemText && (optionText === itemText || optionText.includes(itemText) || itemText.includes(optionText)));
        });
        if (!option) return false;
        select.value = option.value;
        fire(select);
        return true;
      };
      const filledFields = [];
      const inputs = [...document.querySelectorAll("input, textarea")].filter((element) => visible(element) && !["hidden", "submit", "button", "reset", "file"].includes(element.type));
      for (const input of inputs) {
        const text = labelText(input);
        if (input.type === "radio") {
          const radioText = normalizeText(`${text} ${input.value || ""}`);
          const checked =
            (/(fisica|física|cpf)/.test(radioText) && !values.isCompany) ||
            (/(juridica|jurídica|cnpj)/.test(radioText) && values.isCompany) ||
            (/(masculino|^m$)/.test(radioText) && values.gender === "M") ||
            (/(feminino|^f$)/.test(radioText) && values.gender === "F") ||
            (radioText.includes(normalizeText(values.certificateLabel)) || radioText.includes(normalizeText(values.certificateId)));
          if (checked) {
            input.checked = true;
            fire(input);
            filledFields.push(`opcao:${input.name || values.certificateId}`);
          }
          continue;
        }
        if (input.type === "checkbox") {
          if (/(declaro|confirmo|aceito|ciente|termos|responsabilidade|informa[cç][oõ]es verdadeiras)/.test(text)) {
            input.checked = true;
            fire(input);
            filledFields.push(`confirmacao:${input.name || input.id || "checkbox"}`);
          }
          continue;
        }
        const field = pickField(text, input);
        if (fillElement(input, field)) {
          filledFields.push(field);
        }
      }

      const selects = [...document.querySelectorAll("select")].filter((element) => visible(element) && !element.disabled);
      for (const select of selects) {
        const text = labelText(select);
        let field = pickField(text, select);
        if (/(certidao|certidão|modelo|natureza|tipo)/.test(text)) field = "certificate";
        if (/(pessoa|tipo pessoa|fisica|juridica|cpf|cnpj)/.test(text)) field = "personType";
        if (!field && select.options.length <= 5) field = "certificate";
        if (chooseSelect(select, field)) {
          filledFields.push(`select:${field}`);
        }
      }

      const bodyText = document.body?.innerText || "";
      const frameSources = [...document.querySelectorAll("iframe")].map((frame) => frame.src || "").filter(Boolean);
      return {
        filledFields: [...new Set(filledFields)],
        inputCount: inputs.length,
        selectCount: selects.length,
        iframeCount: frameSources.length,
        frameSources,
        captchaDetected: /captcha|recaptcha|hcaptcha|turnstile|cloudflare|security verification|malicious bots|codigo de seguranca|c[oó]digo de seguran[cç]a|sou humano|verify you are human/i.test(bodyText) ||
          frameSources.some((src) => /captcha|recaptcha|hcaptcha|turnstile|cloudflare/i.test(src)),
        loginDetected: /login|entrar|senha|certificado digital|gov\.br|credenciais|usu[aá]rio/i.test(bodyText),
        confirmationDetected: /confirmar|prosseguir|avan[cç]ar|emitir|solicitar|enviar|aceito|declaro/i.test(bodyText),
        bodyText: bodyText.slice(0, 4000),
      };
    }, fields);

    const pageText = fillReport.bodyText || (await page.locator("body").innerText().catch(() => ""));
    keepPageOpen = shouldKeepAssistedOpen();
    const blockedByProtection = Boolean(
      fillReport.captchaDetected &&
        (fillReport.frameSources || []).some((src) => /cloudflare|turnstile|perfdrive|shieldsquare/i.test(src)),
    );
    return {
      tipo: certificateType.label,
      status: "waiting_user_action",
      resultado: SOURCE_RESULT.INDISPONIVEL,
      portalLoaded: true,
      filledFields: fillReport.filledFields || [],
      pageText,
      requiresCaptcha: Boolean(fillReport.captchaDetected),
      requiresLogin: Boolean(fillReport.loginDetected),
      requiresConfirmation: Boolean(fillReport.confirmationDetected),
      blockedByProtection,
      humanCheckpoint: classifyHumanCheckpoint({
        requiresCaptcha: Boolean(fillReport.captchaDetected),
        requiresLogin: Boolean(fillReport.loginDetected),
        requiresConfirmation: Boolean(fillReport.confirmationDetected),
        blockedByProtection,
      }),
      assistedWindowOpen: keepPageOpen,
      iframeCount: fillReport.iframeCount || 0,
      frameSources: fillReport.frameSources || [],
      errorMessage: fillReport.captchaDetected
        ? `${profile?.court || "Portal"} preenchido ate a validacao CAPTCHA/reCAPTCHA oficial.`
        : `${profile?.court || "Portal"} preenchido ate a etapa assistida; confirmacao oficial pendente.`,
      resumo: (fillReport.filledFields || []).length
        ? `Campos reconhecidos preenchidos: ${fillReport.filledFields.join(", ")}. Janela oficial mantida aberta para validação.`
        : "Portal carregado, mas nenhum campo confiavel foi preenchido automaticamente. Janela oficial mantida aberta para validação.",
    };
  } catch (error) {
    return {
      tipo: certificateType.label,
      status: "failed",
      resultado: SOURCE_RESULT.ERRO,
      portalLoaded: false,
      errorMessage: error.message,
    };
  } finally {
    if (!keepPageOpen) {
      await page.close().catch(() => {});
    }
  }
}

async function executeProfileNavigation(page, profile, values) {
  const steps = Array.isArray(profile?.navigationSteps) ? profile.navigationSteps : [];
  for (const step of steps) {
    const action = String(step?.action || "").trim();
    if (!action) continue;

    if (action === "wait") {
      await page.waitForTimeout(Number(step.ms || 1000));
      continue;
    }

    if (action === "goto" && step.url) {
      await page.goto(String(step.url), {
        waitUntil: "domcontentloaded",
        timeout: envNumber("STATE_COURT_NAV_TIMEOUT_MS", 30000),
      });
      await page.waitForTimeout(Number(step.waitAfterMs || 1000));
      continue;
    }

    if (action === "clickText" && step.text) {
      await clickByText(page, String(step.text), { exact: step.exact !== false, timeoutMs: Number(step.timeoutMs || 8000) });
      await page.waitForTimeout(Number(step.waitAfterMs || 1200));
      continue;
    }

    if (action === "clickHrefContains" && step.hrefContains) {
      const clicked = await page.evaluate((needle) => {
        const link = [...document.querySelectorAll("a[href]")].find((anchor) => String(anchor.href || "").includes(needle));
        if (!link) return false;
        link.click();
        return true;
      }, String(step.hrefContains));
      if (clicked) {
        await page.waitForLoadState("domcontentloaded", { timeout: Number(step.timeoutMs || 15000) }).catch(() => {});
        await page.waitForTimeout(Number(step.waitAfterMs || 1200));
      }
      continue;
    }

    if (action === "choosePersonType") {
      await page.evaluate((isCompany) => {
        const normalizeText = (value) =>
          String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
        const expected = isCompany ? /juridica|cnpj/ : /fisica|cpf/;
        const radios = [...document.querySelectorAll('input[type="radio"]')];
        const radio = radios.find((input) => {
          const label = input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null;
          const wrapper = input.closest("label, mat-radio-button, .mat-radio-button, div, span");
          const text = normalizeText(`${input.value || ""} ${label?.textContent || ""} ${wrapper?.textContent || ""}`);
          return expected.test(text);
        });
        if (!radio) return false;
        radio.checked = true;
        radio.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        radio.dispatchEvent(new Event("input", { bubbles: true }));
        radio.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }, Boolean(values?.isCompany));
      await page.waitForTimeout(Number(step.waitAfterMs || 1800));
    }
  }
}

function buildGenericStateCourtValues(input, profile, certificateType) {
  const extra = input.extraFields || {};
  const fields = extra.stateCourtFields || {};
  const documentValue = String(input.tipoDocumento === "cnpj" ? extra.cnpjDocument || input.documento : extra.cpfDocument || input.documento).replace(/\D/g, "");
  const gender = normalize(fields.gender || "").startsWith("f") ? "F" : "M";
  return {
    isCompany: input.tipoDocumento === "cnpj",
    document: formatDocument(documentValue),
    documentRaw: documentValue,
    fullName: fields.fullName || fields.companyName || extra.tjdftCompanyName || "",
    motherName: fields.motherName || extra.motherName || extra.nomeMae || "",
    fatherName: fields.fatherName || extra.fatherName || extra.nomePai || "",
    birthDateIso: fields.birthDate || extra.birthDate || "",
    birthDateText: formatBrazilianDate(fields.birthDate || extra.birthDate || ""),
    rg: fields.rg || "",
    email: fields.email || "",
    phone: fields.phone || "",
    mobile: fields.mobile || fields.phone || "",
    cep: fields.cep || "",
    city: fields.city || "",
    comarca: fields.comarca || "",
    domicile: fields.domicile || "",
    address: fields.address || "",
    neighborhood: fields.neighborhood || "",
    profession: fields.profession || "",
    nationality: fields.nationality || "Brasileira",
    naturality: fields.naturality || fields.city || "",
    civilStatus: fields.civilStatus || "",
        participation: fields.participation || "Passiva",
    instance: fields.instance || "Estadual",
    certificateKind: fields.certificateKind || "",
    nature: fields.nature || certificateType.label || "",
    gender,
    certificateId: certificateType.id,
    certificateLabel: certificateType.label,
    court: profile?.court || "",
    uf: profile?.uf || "",
  };
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

async function collectEsajStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData }) {
  const courtName = stateCourtName || profile?.court || "Tribunal ESAJ";
  const courtUf = profile?.uf || input.extraFields?.stateCourtUf || "";
  const portalUrl = stateCourtUrl || profile?.url || "https://esaj.tjsp.jus.br/sco/abrirCadastro.do";
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return unavailableResult(fonte, `Instale a dependência Playwright para executar o adapter ${courtName}/ESAJ.`, {
      ...baseData,
      install: "npm install && npx playwright install chromium",
    });
  }

  const browser = await chromium.launch({
    headless: getAssistedHeadless(profile),
    slowMo: envNumber("STATE_COURT_ASSISTED_SLOW_MO_MS", 0),
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    userAgent: `Audita/0.1 ${courtName} ESAJ certificate collector`,
  });
  let keepBrowserOpen = false;
  let sessionId = "";

  try {
    const results = [];
    for (const certificateType of requestedCertificates) {
      const result = await fillEsajCertificate({ context, input, profile, certificateType });
      results.push(result);
      if (result.status === "waiting_user_action" && shouldKeepAssistedOpen()) {
        break;
      }
    }

    const completed = results.filter((result) => result.status === "success");
    const waiting = results.filter((result) => result.status === "waiting_user_action");
    if (completed.length && !waiting.length) {
      return successResult(fonte, SOURCE_RESULT.INDISPONIVEL, {
        ...baseData,
        modo: "automatico",
        tribunal: courtName,
        uf: courtUf,
        certidoes: results,
        totalCertidoes: results.length,
        certidoesBaixadas: results.filter((result) => result.pdfPath).length,
        resumo: `${courtName} consultado automaticamente pelo ESAJ.`,
      }, {
        rawText: results.map((result) => result.rawText || result.pageText || "").filter(Boolean).join("\n\n---\n\n"),
        pdfPath: results.find((result) => result.pdfPath)?.pdfPath || "",
      });
    }

    if (waiting.length && shouldKeepAssistedOpen()) {
      keepBrowserOpen = true;
      sessionId = createAssistedSession({ browser, context, courtName, courtUf, portalUrl, input, profile, results });
    }

    return waitingUserActionResult(
      fonte,
      `${courtName}/ESAJ foi preenchido automaticamente, mas o portal exige reCAPTCHA/validação oficial antes de emitir.`,
      {
        ...baseData,
        modo: "automatico_com_validacao",
        tribunal: courtName,
        uf: courtUf,
        validationFrameUrl: portalUrl,
        assistedPortalUrl: portalUrl,
        assistedSession: sessionId || "external_browser",
        sessionOpen: keepBrowserOpen,
        certidoes: results,
        captchaLab: buildCaptchaLabReport({ profile, results, sessionOpen: keepBrowserOpen, sessionId }),
        proximoPasso: keepBrowserOpen
          ? "Resolver a validação oficial na janela oficial já preenchida. Depois baixe/anexe o PDF ou protocolo no Audita."
          : "Resolver a validação oficial no portal para permitir o envio e o download.",
      },
    );
  } finally {
    if (!keepBrowserOpen) {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  }
}

function createAssistedSession({ browser, context, courtName, courtUf, portalUrl, input, profile, results }) {
  const sessionId = cryptoRandomId();
  assistedSessions.set(sessionId, {
    browser,
    context,
    courtName,
    courtUf,
    portalUrl,
    consultaId: input.consultaId,
    input,
    profile,
    createdAt: new Date().toISOString(),
    results,
  });
  return sessionId;
}

function getAssistedSession(sessionId) {
  return assistedSessions.get(String(sessionId || ""));
}

function getAssistedSessionPage(session) {
  const pages = session?.context?.pages?.() || [];
  return pages.filter((page) => !page.isClosed()).at(-1) || null;
}

async function readAssistedSessionFormState(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      return (
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
      );
    };
    const maskValue = (value) => {
      const text = String(value || "");
      if (!text) return "";
      if (text.length <= 3) return "***";
      return `${text.slice(0, 2)}***${text.slice(-2)}`;
    };
    const controls = [...document.querySelectorAll("input, select, textarea")]
      .filter((element) => visible(element) && element.type !== "hidden")
      .slice(0, 80)
      .map((element) => {
        const type = String(element.type || element.tagName || "").toLowerCase();
        const rawValue = type === "checkbox" || type === "radio" ? (element.checked ? element.value || "checked" : "") : element.value || "";
        const label =
          element.getAttribute("aria-label") ||
          document.querySelector(`label[for="${CSS.escape(element.id || "")}"]`)?.textContent ||
          element.name ||
          element.id ||
          element.placeholder ||
          type;
        return {
          label: String(label || "").replace(/\s+/g, " ").trim().slice(0, 80),
          type,
          filled: Boolean(rawValue),
          valuePreview: maskValue(rawValue),
        };
      });
    return {
      filledCount: controls.filter((control) => control.filled).length,
      totalCount: controls.length,
      fields: controls.filter((control) => control.filled).slice(0, 24),
    };
  }).catch(() => ({ filledCount: 0, totalCount: 0, fields: [] }));
}

export async function getAssistedSessionView(sessionId) {
  const session = getAssistedSession(sessionId);
  if (!session) {
    return { notFound: true };
  }
  const page = getAssistedSessionPage(session);
  if (!page) {
    return {
      id: sessionId,
      closed: true,
      courtName: session.courtName,
      courtUf: session.courtUf,
      portalUrl: session.portalUrl,
      consultaId: session.consultaId,
      createdAt: session.createdAt,
    };
  }

  const screenshot = await page.screenshot({ type: "jpeg", quality: 78, fullPage: false });
  const viewport = page.viewportSize?.() || { width: 1280, height: 720 };
  const formState = await readAssistedSessionFormState(page);
  return {
    id: sessionId,
    closed: false,
    courtName: session.courtName,
    courtUf: session.courtUf,
    portalUrl: session.portalUrl,
    consultaId: session.consultaId,
    createdAt: session.createdAt,
    title: await page.title().catch(() => ""),
    url: page.url(),
    viewport,
    formState,
    screenshot: `data:image/jpeg;base64,${screenshot.toString("base64")}`,
  };
}

export async function interactAssistedSession(sessionId, action = {}) {
  const session = getAssistedSession(sessionId);
  if (!session) {
    return { notFound: true };
  }
  const page = getAssistedSessionPage(session);
  if (!page) {
    return { closed: true };
  }

  const type = String(action.type || "").trim();
  if (type === "click") {
    await page.mouse.click(Number(action.x || 0), Number(action.y || 0));
  } else if (type === "type") {
    const text = String(action.text || "");
    if (text) await page.keyboard.type(text);
  } else if (type === "press") {
    const key = String(action.key || "");
    if (key) await page.keyboard.press(key);
  } else if (type === "scroll") {
    await page.mouse.wheel(Number(action.deltaX || 0), Number(action.deltaY || 0));
  } else if (type === "recover") {
    const navigationTimeout = envNumber("STATE_COURT_NAV_TIMEOUT_MS", 30000);
    const previousPage = await page.goBack({ waitUntil: "domcontentloaded", timeout: navigationTimeout }).catch(() => null);
    if (!previousPage && session.portalUrl) {
      await page.goto(session.portalUrl, { waitUntil: "domcontentloaded", timeout: navigationTimeout }).catch(() => {});
    }
    if (session.input && isEsajAssistedSession(session)) {
      const certificateType = getEsajSessionCertificateType(session);
      await fillEsajPageFields({ page, input: session.input, profile: session.profile, certificateType }).catch(() => null);
    }
  } else if (type === "submit") {
    const clicked = await page.evaluate(() => {
      const candidates = [
        "#pbEnviar",
        "button[type='submit']",
        "input[type='submit']",
        "button",
        "input[type='button']",
      ];
      const isVisible = (element) => {
        const style = window.getComputedStyle(element);
        return (
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          !element.disabled &&
          Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
        );
      };
      for (const selector of candidates) {
        const elements = [...document.querySelectorAll(selector)];
        const target = elements.find((element) => {
          const label = `${element.textContent || ""} ${element.value || ""} ${element.getAttribute("aria-label") || ""}`;
          return isVisible(element) && /enviar|emitir|consultar|continuar|prosseguir|gerar/i.test(label);
        });
        if (target) {
          target.click();
          return true;
        }
      }
      return false;
    }).catch(() => false);
    if (!clicked) {
      return { invalid: true, reason: "submit_target_not_found" };
    }
  } else {
    return { invalid: true };
  }

  await page.waitForTimeout(envNumber("ASSISTED_SESSION_AFTER_ACTION_DELAY_MS", 350)).catch(() => {});
  return getAssistedSessionView(sessionId);
}

export async function inspectAssistedSessionResult(sessionId) {
  const session = getAssistedSession(sessionId);
  if (!session) {
    return { notFound: true };
  }
  const page = getAssistedSessionPage(session);
  if (!page) {
    return { closed: true };
  }

  const snapshot = await page.evaluate(() => {
    const links = [...document.querySelectorAll("a[href]")]
      .slice(0, 80)
      .map((link) => ({
        text: (link.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160),
        href: link.href,
      }));
    return {
      title: document.title || "",
      url: location.href,
      text: (document.body?.innerText || "").slice(0, 12000),
      links,
    };
  }).catch(async () => ({
    title: await page.title().catch(() => ""),
    url: page.url(),
    text: "",
    links: [],
  }));
  const screenshot = await page.screenshot({ type: "jpeg", quality: 78, fullPage: false }).catch(() => null);
  const formState = await readAssistedSessionFormState(page);

  return {
    id: sessionId,
    closed: false,
    courtName: session.courtName,
    courtUf: session.courtUf,
    consultaId: session.consultaId,
    inspectedAt: new Date().toISOString(),
    evidenceScreenshot: screenshot ? `data:image/jpeg;base64,${screenshot.toString("base64")}` : "",
    evidenceFileName: `audita-${session.courtUf || "portal"}-${Date.now()}.jpg`.toLowerCase(),
    formState,
    ...analyzeAssistedSessionSnapshot(snapshot),
  };
}

export async function closeAssistedSession(sessionId) {
  const session = getAssistedSession(sessionId);
  if (!session) {
    return { notFound: true };
  }
  assistedSessions.delete(String(sessionId || ""));
  await session.context?.close?.().catch(() => {});
  await session.browser?.close?.().catch(() => {});
  return { id: sessionId, ok: true, closed: true };
}

function cryptoRandomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function collectApTjapStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData }) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return unavailableResult(fonte, "Instale a dependência Playwright para executar o adapter TJAP/Tucujuris.", {
      ...baseData,
      install: "npm install && npx playwright install chromium",
    });
  }

  const browser = await chromium.launch({
    headless: process.env.TJAP_HEADLESS === "true",
    slowMo: envNumber("TJAP_SLOW_MO_MS", 0),
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    ignoreHTTPSErrors: true,
    userAgent: "Audita/0.1 TJAP Tucujuris certificate collector",
  });

  try {
    const results = [];
    for (const certificateType of requestedCertificates) {
      results.push(await fillApTjapCertificate({ context, input, profile, certificateType }));
    }

    const completed = results.filter((result) => result.status === "success");
    const waiting = results.filter((result) => result.status === "waiting_user_action");
    if (completed.length && !waiting.length) {
      return successResult(fonte, SOURCE_RESULT.INDISPONIVEL, {
        ...baseData,
        modo: "automatico",
        automationStatus: "active",
        tribunal: stateCourtName || "TJAP",
        uf: "AP",
        certidoes: results,
        sessionOpen: isCaptchaLabMode() || process.env.TJAP_KEEP_BROWSER_OPEN === "true",
        captchaLab: buildCaptchaLabReport({
          profile,
          results,
          sessionOpen: isCaptchaLabMode() || process.env.TJAP_KEEP_BROWSER_OPEN === "true",
        }),
        totalCertidoes: results.length,
        resumo: "TJAP consultado automaticamente pelo Tucujuris.",
      }, {
        rawText: results.map((result) => result.rawText || result.pageText || "").filter(Boolean).join("\n\n---\n\n"),
        pdfPath: results.find((result) => result.pdfPath)?.pdfPath || "",
      });
    }

    return waitingUserActionResult(
      fonte,
      "TJAP/Tucujuris foi aberto e preenchido automaticamente. Confirme o Cloudflare/Turnstile na janela oficial para concluir.",
      {
        ...baseData,
        modo: "automatico_com_validacao",
        automationStatus: "active",
        captchaMode: "assisted",
        frameMode: "new_tab",
        blocker: "cloudflare",
        tribunal: stateCourtName || "TJAP",
        uf: "AP",
        validationFrameUrl: stateCourtUrl || profile?.url,
        assistedPortalUrl: stateCourtUrl || profile?.url,
        certidoes: results,
        sessionOpen: isCaptchaLabMode() || process.env.TJAP_KEEP_BROWSER_OPEN === "true",
        captchaLab: buildCaptchaLabReport({
          profile,
          results,
          sessionOpen: isCaptchaLabMode() || process.env.TJAP_KEEP_BROWSER_OPEN === "true",
        }),
        proximoPasso: "Resolver a verificação Cloudflare/Turnstile na janela aberta e enviar a requisição no portal oficial.",
      },
    );
  } finally {
    if (!isCaptchaLabMode() && process.env.TJAP_KEEP_BROWSER_OPEN !== "true") {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
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

async function collectMtTjmtStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData }) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return unavailableResult(fonte, "Instale a dependência Playwright para executar o adapter TJMT/SEC.", {
      ...baseData,
      install: "npm install && npx playwright install chromium",
    });
  }

  const browser = await chromium.launch({
    headless: getAssistedHeadless(profile),
    slowMo: envNumber("STATE_COURT_ASSISTED_SLOW_MO_MS", 0),
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    ignoreHTTPSErrors: true,
    userAgent: "Audita/0.1 TJMT SEC certificate collector",
  });
  let keepBrowserOpen = false;
  let sessionId = "";

  try {
    const results = [];
    for (const certificateType of requestedCertificates) {
      results.push(await fillMtTjmtCertificate({ context, input, profile, certificateType }));
    }
    const waiting = results.filter((result) => result.status === "waiting_user_action");
    const completed = results.filter((result) => result.status === "success");
    if (completed.length && !waiting.length) {
      return successResult(fonte, SOURCE_RESULT.INDISPONIVEL, {
        ...baseData,
        modo: "automatico",
        tribunal: stateCourtName || "TJMT",
        uf: "MT",
        certidoes: results,
        totalCertidoes: results.length,
        certidoesBaixadas: results.filter((result) => result.pdfPath).length,
        resumo: "TJMT consultado automaticamente pelo SEC.",
      }, {
        rawText: results.map((result) => result.rawText || result.pageText || "").filter(Boolean).join("\n\n---\n\n"),
        pdfPath: results.find((result) => result.pdfPath)?.pdfPath || "",
      });
    }

    if (shouldKeepAssistedOpen()) {
      keepBrowserOpen = true;
      sessionId = createAssistedSession({ browser, context, courtName: stateCourtName || "TJMT", courtUf: "MT", portalUrl: stateCourtUrl || profile?.url, input, profile, results });
    }

    return waitingUserActionResult(
      fonte,
      "TJMT/SEC foi preenchido automaticamente até a etapa permitida. Resolva a validação ou confirme a emissão na janela oficial.",
      {
        ...baseData,
        modo: "automatico_com_validacao",
        automationStatus: "active",
        captchaMode: "assisted",
        tribunal: stateCourtName || "TJMT",
        uf: "MT",
        validationFrameUrl: stateCourtUrl || profile?.url,
        assistedPortalUrl: stateCourtUrl || profile?.url,
        assistedSession: sessionId || "external_browser",
        sessionOpen: keepBrowserOpen,
        certidoes: results,
        totalCertidoes: results.length,
        captchaLab: buildCaptchaLabReport({ profile, results, sessionOpen: keepBrowserOpen, sessionId }),
        proximoPasso: keepBrowserOpen
          ? "Resolver a validação/confirmar a emissão na janela oficial já preenchida. Depois baixe/anexe o PDF ou protocolo no Audita."
          : "Resolver a validação/confirmar a emissão no portal oficial.",
      },
    );
  } finally {
    if (!keepBrowserOpen) {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
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

async function collectSeTjseStateCourt({ input, profile, stateCourtName, requestedCertificates, baseData }) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return unavailableResult(fonte, "Instale a dependência Playwright para executar o adapter TJSE.", {
      ...baseData,
      install: "npm install && npx playwright install chromium",
    });
  }

  const browser = await chromium.launch({ headless: process.env.STATE_COURT_HEADLESS !== "false" });
  const context = await browser.newContext({
    acceptDownloads: true,
    userAgent: "Audita/0.1 TJSE certificate collector",
  });

  try {
    const results = [];
    for (const certificateType of requestedCertificates) {
      results.push(await fillSeTjseCertificate({ context, input, profile, certificateType }));
    }

    const completed = results.filter((result) => result.status === "success");
    if (completed.length) {
      return successResult(fonte, SOURCE_RESULT.INDISPONIVEL, {
        ...baseData,
        modo: "automatico_com_validacao",
        tribunal: stateCourtName || "TJSE",
        uf: "SE",
        certidoes: results,
        totalCertidoes: results.length,
        certidoesBaixadas: results.filter((result) => result.pdfPath).length,
        resumo: "TJSE consultado pelo portal de certidão online.",
      }, {
        rawText: results.map((result) => result.rawText || result.pageText || "").filter(Boolean).join("\n\n---\n\n"),
        pdfPath: results.find((result) => result.pdfPath)?.pdfPath || "",
      });
    }

    return waitingUserActionResult(
      fonte,
      "TJSE foi preenchido automaticamente até a etapa permitida pelo portal oficial.",
      {
        ...baseData,
        modo: "automatico_com_validacao",
        tribunal: stateCourtName || "TJSE",
        uf: "SE",
        certidoes: results,
        totalCertidoes: results.length,
        proximoPasso: "Resolver validação oficial ou confirmar a solicitação no portal do TJSE quando exigido.",
      },
    );
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function fillSeTjseCertificate({ context, input, profile, certificateType }) {
  const page = await context.newPage();
  try {
    page.setDefaultTimeout(envNumber("STATE_COURT_STEP_TIMEOUT_MS", input.timeoutMs || 30000));
    const fields = input.extraFields?.stateCourtFields || {};
    const documentValue = String(input.extraFields?.cpfDocument || input.extraFields?.cnpjDocument || input.documento || "").replace(/\D/g, "");
    await page.goto(profile?.url || "https://certidao-online.tjse.jus.br/app/solicitacao/", {
      waitUntil: "domcontentloaded",
      timeout: envNumber("STATE_COURT_NAV_TIMEOUT_MS", 30000),
    });
    await page.waitForTimeout(2500);
    await page.getByText(input.tipoDocumento === "cnpj" ? "Jurídica" : "Física", { exact: true }).click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1200);

    await selectTjseMatOption(page, 0, fields.domicile || "Aracaju");
    await selectTjseMatOption(page, 1, fields.nature || certificateType.label || certificateType.id);
    await safeFill(page, "input[formcontrolname='cpfCnpj']", documentValue);
    await safeFill(page, "input[formcontrolname='nomeParte']", fields.fullName || fields.companyName);
    await safeFill(page, "input[formcontrolname='dataNascimento']", formatCompactBrazilianDate(fields.birthDate));
    await safeFill(page, "input[formcontrolname='nomeMae']", fields.motherName);
    await safeFill(page, "input[formcontrolname='nomePai']", fields.fatherName);
    await safeFill(page, "input[formcontrolname='email']", fields.email);
    await safeFill(page, "input[formcontrolname='celular']", fields.mobile);

    const beforeSubmitText = await page.locator("body").innerText().catch(() => "");
    const downloadPromise = page.waitForEvent("download", { timeout: envNumber("STATE_COURT_DOWNLOAD_TIMEOUT_MS", 30000) }).catch(() => null);
    await page.getByRole("button", { name: /solicitar|emitir|avançar|enviar/i }).click({ timeout: 8000 }).catch(() => {});
    const download = await downloadPromise;
    await page.waitForLoadState("domcontentloaded", { timeout: envNumber("STATE_COURT_STEP_TIMEOUT_MS", 30000) }).catch(() => {});
    await page.waitForTimeout(1800);
    const pageText = await page.locator("body").innerText().catch(() => beforeSubmitText);

    if (download) {
      const downloadPath = await download.path();
      const buffer = Buffer.from(await readFile(downloadPath));
      const { pdfPath, rawText } = await saveAndExtractPdfBuffer({
        consultaId: input.consultaId,
        fonte,
        fileName: `tjse-${certificateType.id}.pdf`,
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
      status: "waiting_user_action",
      resultado: SOURCE_RESULT.INDISPONIVEL,
      pageText,
      errorMessage: "TJSE preenchido; portal ainda exige confirmação/validação ou não retornou PDF conclusivo.",
      resumo: "Campos preenchidos; validação ou confirmação oficial pendente.",
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

async function fillMtTjmtCertificate({ context, input, profile, certificateType }) {
  const page = await context.newPage();
  let keepPageOpen = false;
  try {
    page.setDefaultTimeout(envNumber("STATE_COURT_STEP_TIMEOUT_MS", input.timeoutMs || 30000));
    const fields = input.extraFields?.stateCourtFields || {};
    const documentValue = String(input.extraFields?.cpfDocument || input.documento || "").replace(/\D/g, "");
    await page.goto(profile?.url || "https://sec.tjmt.jus.br/primeiro-grau/criar-pedido-certidao", {
      waitUntil: "domcontentloaded",
      timeout: envNumber("STATE_COURT_NAV_TIMEOUT_MS", 30000),
    });
    await page.waitForTimeout(1600);

    await clickByText(page, /certid[aã]o negativa/i);
    await page.waitForTimeout(900);

    await fillByLabelLike(page, /documento|cpf/i, formatDocument(documentValue));
    await fillByLabelLike(page, /data de nascimento|nascimento/i, formatBrazilianDate(fields.birthDate));
    await clickByText(page, /consultar documento/i);
    await page.waitForTimeout(1800);

    await fillByLabelLike(page, /^nome|nome completo/i, fields.fullName);
    await selectMtCertificateType(page, certificateType.id);
    await clickByText(page, /emitir certid[aã]o/i);
    await page.waitForTimeout(1800);

    const pageText = await page.locator("body").innerText().catch(() => "");
    const download = await page.waitForEvent("download", { timeout: envNumber("STATE_COURT_DOWNLOAD_TIMEOUT_MS", 6000) }).catch(() => null);
    if (download) {
      const downloadPath = await download.path();
      const buffer = Buffer.from(await readFile(downloadPath));
      const { pdfPath, rawText } = await saveAndExtractPdfBuffer({
        consultaId: input.consultaId,
        fonte,
        fileName: `tjmt-${certificateType.id}.pdf`,
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
      return {
        tipo: certificateType.label,
        status: "success",
        resultado: SOURCE_RESULT.INDISPONIVEL,
        downloadUrl: maskSignedUrl(pdfLink),
        pageText,
        resumo: "TJMT retornou link de certidão no SEC.",
      };
    }

    keepPageOpen = shouldKeepAssistedOpen();
    return {
      tipo: certificateType.label,
      status: "waiting_user_action",
      resultado: SOURCE_RESULT.INDISPONIVEL,
      pageText,
      assistedWindowOpen: keepPageOpen,
      errorMessage: /captcha|recaptcha|valida[çc][aã]o|confirme|obrigat[oó]rio|diverg[eê]ncia/i.test(pageText)
        ? "TJMT/SEC exige validação, correção de dados ou confirmação antes de emitir."
        : "TJMT/SEC preenchido; emissão ainda não retornou PDF nem texto conclusivo.",
      resumo: keepPageOpen
        ? "Campos TJMT preenchidos; janela oficial mantida aberta para validação ou emissão."
        : "Campos TJMT preenchidos; validação ou emissão pendente no portal.",
    };
  } catch (error) {
    return {
      tipo: certificateType.label,
      status: "failed",
      resultado: SOURCE_RESULT.ERRO,
      errorMessage: error.message,
    };
  } finally {
    if (!keepPageOpen) {
      await page.close().catch(() => {});
    }
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
    await safeFill(page, input.tipoDocumento === "cnpj" ? "#edCnpj" : "#edCpf", formatDocument(documentValue));
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
    await page.waitForLoadState("domcontentloaded", { timeout: envNumber("STATE_COURT_STEP_TIMEOUT_MS", 30000) }).catch(() => {});
    await page.waitForTimeout(1500);
    const pageText = await page.locator("body").innerText().catch(() => "");
    const download = await Promise.race([downloadPromise, page.waitForTimeout(1200).then(() => null)]);
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

    if (hasEsTjesPrintableCertificateSignal(pageText) || (hasCertificateResultSignal(pageText) && !hasEsTjesRequestFormSignal(pageText))) {
      const { pdfPath, rawText } = await saveEsTjesPrintedCertificate({ page, input, certificateType });
      return {
        tipo: certificateType.label,
        status: "success",
        resultado: classifyCertificateText(pageText),
        pdfPath,
        rawText: rawText || pageText,
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

async function saveEsTjesPrintedCertificate({ page, input, certificateType }) {
  await page
    .addStyleTag({
      content: `
        @media print {
          input[type="button"], input[type="submit"], button { display: none !important; }
        }
      `,
    })
    .catch(() => {});
  await page.emulateMedia({ media: "print" }).catch(() => {});
  const buffer = await page.pdf({
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" },
  });
  return saveAndExtractPdfBuffer({
    consultaId: input.consultaId,
    fonte,
    fileName: `tjes-${certificateType.id}.pdf`,
    buffer,
  });
}

function isEsajAssistedSession(session) {
  return /esaj|saj/i.test(`${session?.portalUrl || ""} ${session?.courtName || ""} ${session?.profile?.adapter || ""}`);
}

function getEsajSessionCertificateType(session) {
  const types = getStateCertificateTypesForInput(session.input || {}, session.profile || {});
  return types[0] || { id: "civil", label: getStateCourtCertificateLabel("civil") };
}

async function fillEsajPageFields({ page, input, profile, certificateType }) {
  const fields = input.extraFields?.stateCourtFields || {};
  const filledFields = [];
  const recordField = async (label, promise) => {
    const filled = await promise.catch(() => false);
    if (filled) filledFields.push(label);
    return filled;
  };
  const documentValue = String(input.extraFields?.cpfDocument || input.extraFields?.cnpjDocument || input.documento || "").replace(/\D/g, "");
  const portalUrl = input.extraFields?.stateCourtUrl || profile?.url || "https://esaj.tjsp.jus.br/sco/abrirCadastro.do";
  const hasModelSelect = await page.locator("#cdModelo").count().catch(() => 0);
  if (!hasModelSelect) {
    await page.goto(portalUrl, {
      waitUntil: "domcontentloaded",
      timeout: envNumber("STATE_COURT_NAV_TIMEOUT_MS", 30000),
    });
  }
  await page.locator("#cdModelo").selectOption(esajModelValue(certificateType.id), {
    timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 8000),
  });
  filledFields.push("modelo");
  await page.waitForTimeout(900);

  const personType = input.tipoDocumento === "cnpj" ? "J" : "F";
  await recordField("tipoPessoa", safeCheck(page, `input[name="entity.tpPessoa"][value="${personType}"]`));
  await page.waitForTimeout(600);

  const nameValue = fields.fullName || fields.companyName || "";
  await recordField("nome", safeFillVisible(page, "#nmCadastroF", nameValue));
  await recordField("razaoSocial", safeFillVisible(page, "#nmCadastroJ", nameValue));
  await recordField("cpf", safeFillVisible(page, "#identity\\.nuCpfFormatado", formatDocument(documentValue)));
  await safeFillVisible(page, "#identity\\.nuRgFormatado", fields.rg || "DECLARA NÃO POSSUIR RG");
  if (fields.rg) filledFields.push("rg");
  await recordField("cnpj", safeFillVisible(page, "#identity\\.nuCnpjFormatado", formatDocument(documentValue)));
  await recordField("mae", safeFillVisible(page, "#nmMaeCadastro", fields.motherName));
  await recordField("pai", safeFillVisible(page, "#nmPaiCadastro", fields.fatherName));
  await recordField("nascimento", safeFillVisible(page, "#dataNascimento", formatBrazilianDate(fields.birthDate)));
  await recordField("genero", setVisibleRadioValue(page, "entity.flGenero", fields.gender));
  await recordField("nacionalidade", safeFillVisible(page, "#entity\\.nacionalidade\\.deNacionalidade", fields.nationality || "Brasileira"));
  await recordField("naturalidade", safeFillVisible(page, "#entity\\.naturalidade\\.nmMunicipio", fields.naturality || fields.city));
  await recordField("estadoCivil", selectVisibleByTextOrValue(page, "#id_sco\\.pedido\\.label\\.cdEstadocivil", fields.civilStatus || "Solteiro"));
  await recordField("profissao", safeFillVisible(page, "#entity\\.deProfissao", fields.profession));
  await recordField("endereco", safeFillVisible(page, "#identity\\.endNomePesq\\.deEndereco", fields.address));
  await recordField("complemento", safeFillVisible(page, "#identity\\.endNomePesq\\.deComplemento", fields.addressComplement));
  await recordField("cep", safeFillVisible(page, "#identity\\.endNomePesq\\.nuCep", fields.cep));
  await recordField("bairro", safeFillVisible(page, "#identity\\.endNomePesq\\.deBairro", fields.neighborhood));
  await recordField("municipio", safeFillVisible(page, "#entity\\.endNomePesq\\.municipio\\.nmMunicipio", fields.city));
  await recordField("email", safeFillVisible(page, "#identity\\.solicitante\\.deEmail", fields.email));
  await recordField("confirmacao", safeCheck(page, "#confirmacaoInformacoes"));

  const beforeSubmitText = await page.locator("body").innerText().catch(() => "");
  const preSubmitRecaptcha = await page.locator("[name='g-recaptcha-response'], iframe[src*='recaptcha']").count().catch(() => 0);
  return { filledFields, beforeSubmitText, preSubmitRecaptcha };
}

async function fillEsajCertificate({ context, input, profile, certificateType }) {
  const page = await context.newPage();
  const courtName = profile?.court || input.extraFields?.stateCourtName || "Tribunal ESAJ";
  const courtSlug = String(profile?.uf || input.extraFields?.stateCourtUf || "esaj").toLowerCase();
  let keepPageOpen = false;
  try {
    page.setDefaultTimeout(envNumber("STATE_COURT_STEP_TIMEOUT_MS", input.timeoutMs || 30000));
    const { filledFields, beforeSubmitText, preSubmitRecaptcha } = await fillEsajPageFields({ page, input, profile, certificateType });
    if (preSubmitRecaptcha) {
      keepPageOpen = shouldKeepAssistedOpen();
      return {
        tipo: certificateType.label,
        status: "waiting_user_action",
        resultado: SOURCE_RESULT.INDISPONIVEL,
        pageText: beforeSubmitText,
        requiresRecaptcha: true,
        filledFields,
        assistedWindowOpen: keepPageOpen,
        errorMessage: `${courtName}/ESAJ possui reCAPTCHA oficial antes do envio.`,
        resumo: keepPageOpen
          ? "Campos preenchidos; reCAPTCHA oficial pendente na sessao remota."
          : "Campos preenchidos; reCAPTCHA oficial pendente.",
      };
    }

    const downloadPromise = page.waitForEvent("download", { timeout: envNumber("STATE_COURT_DOWNLOAD_TIMEOUT_MS", 30000) }).catch(() => null);
    await page.locator("#pbEnviar").click({ timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 8000) }).catch(() => {});
    const download = await downloadPromise;
    await page.waitForLoadState("domcontentloaded", { timeout: envNumber("STATE_COURT_STEP_TIMEOUT_MS", 30000) }).catch(() => {});
    await page.waitForTimeout(1800);
    const submittedText = await page.locator("body").innerText().catch(() => beforeSubmitText);

    if (download) {
      const downloadPath = await download.path();
      const buffer = Buffer.from(await readFile(downloadPath));
      const { pdfPath, rawText } = await saveAndExtractPdfBuffer({
        consultaId: input.consultaId,
        fonte,
        fileName: `${courtSlug}-${certificateType.id}.pdf`,
        buffer,
      });
      return {
        tipo: certificateType.label,
        status: "success",
        resultado: classifyCertificateText(rawText || submittedText),
        pdfPath,
        rawText,
        pageText: submittedText,
        resumo: summarizeCertificateText(rawText || submittedText),
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
          fileName: `${courtSlug}-${certificateType.id}.pdf`,
          buffer,
        });
        return {
          tipo: certificateType.label,
          status: "success",
          resultado: classifyCertificateText(rawText || submittedText),
          pdfPath,
          rawText,
          pageText: submittedText,
          downloadUrl: maskSignedUrl(pdfLink),
          resumo: summarizeCertificateText(rawText || submittedText),
        };
      }
    }

    if (hasCertificateResultSignal(submittedText)) {
      return {
        tipo: certificateType.label,
        status: "success",
        resultado: classifyCertificateText(submittedText),
        rawText: submittedText,
        pageText: submittedText,
        resumo: summarizeCertificateText(submittedText),
      };
    }

    const pageText = await page.locator("body").innerText().catch(() => submittedText);
    const recaptchaPresent = await page.locator("[name='g-recaptcha-response'], iframe[src*='recaptcha']").count().catch(() => 0);
    if (recaptchaPresent) {
      keepPageOpen = shouldKeepAssistedOpen();
      return {
        tipo: certificateType.label,
        status: "waiting_user_action",
        resultado: SOURCE_RESULT.INDISPONIVEL,
        pageText,
        requiresRecaptcha: true,
        filledFields,
        assistedWindowOpen: keepPageOpen,
        errorMessage: `${courtName}/ESAJ possui reCAPTCHA oficial antes do envio.`,
        resumo: keepPageOpen
          ? "Campos preenchidos; reCAPTCHA oficial pendente na janela aberta."
          : "Campos preenchidos; reCAPTCHA oficial pendente.",
      };
    }

    const validationDetected = /captcha|recaptcha|c[oó]digo de seguran[çc]a|confirme que voc[eê]|valida[çc][aã]o|obrigat[oó]rio|inv[aá]lido/i.test(submittedText);
    keepPageOpen = shouldKeepAssistedOpen();
    return {
      tipo: certificateType.label,
      status: "waiting_user_action",
      resultado: SOURCE_RESULT.INDISPONIVEL,
      pageText,
      filledFields,
      assistedWindowOpen: keepPageOpen,
      errorMessage: validationDetected
        ? `${courtName}/ESAJ exige validação oficial ou correção de campos antes de emitir.`
        : `${courtName}/ESAJ preenchido; emissão ainda não retornou PDF nem texto conclusivo.`,
      resumo: keepPageOpen
        ? "Campos visíveis preenchidos; validação oficial pendente na janela aberta."
        : "Campos visíveis preenchidos; validação oficial pendente no portal.",
    };
  } catch (error) {
    return {
      tipo: certificateType.label,
      status: "failed",
      resultado: SOURCE_RESULT.ERRO,
      errorMessage: error.message,
    };
  } finally {
    if (!keepPageOpen) {
      await page.close().catch(() => {});
    }
  }
}

async function fillApTjapCertificate({ context, input, profile, certificateType }) {
  const page = await context.newPage();
  try {
    page.setDefaultTimeout(envNumber("STATE_COURT_STEP_TIMEOUT_MS", input.timeoutMs || 30000));
    const fields = input.extraFields?.stateCourtFields || {};
    const documentValue = String(input.extraFields?.cpfDocument || input.extraFields?.cnpjDocument || input.documento || "").replace(/\D/g, "");
    const isCompany = input.tipoDocumento === "cnpj";
    await page.goto(profile?.url || "https://tucujuris.tjap.jus.br/pages/certidao-publica/certidao-publica.html", {
      waitUntil: "domcontentloaded",
      timeout: envNumber("STATE_COURT_NAV_TIMEOUT_MS", 30000),
    });

    const formReady = await waitForTjapFormOrProtection(page);
    if (!formReady.formVisible) {
      return {
        tipo: certificateType.label,
        status: "waiting_user_action",
        resultado: SOURCE_RESULT.INDISPONIVEL,
        pageText: formReady.pageText,
        requiresCloudflare: true,
        errorMessage: "TJAP/Tucujuris exibiu proteção Cloudflare/Azion antes do formulário.",
        resumo: "Abra a janela oficial, resolva a verificação e execute novamente para o Audita preencher os campos.",
      };
    }

    await safeCheck(page, `input[name="tipopessoa"][value="${isCompany ? "juridica" : "fisica"}"]`);
    await page.waitForTimeout(400);

    const fullName = fields.fullName || fields.companyName || input.extraFields?.tjdftCompanyName || "";
    await fillVisibleInputByIndex(page, "input[type='text']", 0, fullName);
    if (!isCompany) {
      await setVisibleRadioValue(page, "sexo", fields.gender || "M");
      await fillVisibleInputByIndex(page, "input[type='date']", 0, fields.birthDate);
      await fillVisibleInputByIndex(page, "input[type='text']", 1, fields.motherName || input.extraFields?.motherName);
      await fillVisibleInputByIndex(page, "input[type='text']", 2, fields.fatherName || input.extraFields?.fatherName);
      await fillVisibleInputByIndex(page, "input[type='text']", 3, formatDocument(documentValue));
      await fillVisibleInputByIndex(page, "input[type='text']", 4, fields.rg || "NAO INFORMADO");
    } else {
      await fillVisibleInputByIndex(page, "input[type='text']", 1, formatDocument(documentValue));
    }
    await selectFirstVisibleSelectByTextOrValue(page, fields.uf || "AP");
    await fillVisibleInputByIndex(page, "input[type='email']", 0, fields.email);
    await chooseTjapCertificateType(page, certificateType.id);

    const pageText = await page.locator("body").innerText().catch(() => "");
    const protectedChallenge = await hasTjapProtection(page, pageText);
    if (protectedChallenge) {
      return {
        tipo: certificateType.label,
        status: "waiting_user_action",
        resultado: SOURCE_RESULT.INDISPONIVEL,
        pageText,
        requiresCloudflare: true,
        errorMessage: "Campos TJAP preenchidos; confirme o Cloudflare/Turnstile na janela oficial.",
        resumo: "Formulário preenchido automaticamente; validação humana pendente.",
      };
    }

    const downloadPromise = page.waitForEvent("download", { timeout: envNumber("STATE_COURT_DOWNLOAD_TIMEOUT_MS", 25000) }).catch(() => null);
    await page.locator("input[type='submit'], button[type='submit']").first().click({ timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 8000) }).catch(() => {});
    const download = await downloadPromise;
    await page.waitForTimeout(1600);
    const submittedText = await page.locator("body").innerText().catch(() => pageText);

    if (download) {
      const downloadPath = await download.path();
      const buffer = Buffer.from(await readFile(downloadPath));
      const { pdfPath, rawText } = await saveAndExtractPdfBuffer({
        consultaId: input.consultaId,
        fonte,
        fileName: `tjap-${certificateType.id}.pdf`,
        buffer,
      });
      return {
        tipo: certificateType.label,
        status: "success",
        resultado: classifyCertificateText(rawText || submittedText),
        pdfPath,
        rawText,
        pageText: submittedText,
        resumo: summarizeCertificateText(rawText || submittedText),
      };
    }

    const pdfLink = await findPdfLink(page);
    if (pdfLink) {
      return {
        tipo: certificateType.label,
        status: "success",
        resultado: SOURCE_RESULT.INDISPONIVEL,
        downloadUrl: maskSignedUrl(pdfLink),
        pageText: submittedText,
        resumo: "TJAP retornou link de certidão no portal oficial.",
      };
    }

    return {
      tipo: certificateType.label,
      status: "waiting_user_action",
      resultado: SOURCE_RESULT.INDISPONIVEL,
      pageText: submittedText,
      errorMessage: "TJAP/Tucujuris preenchido; envio final ou download ainda depende do portal oficial.",
      resumo: "Campos preenchidos; etapa final pendente.",
    };
  } catch (error) {
    return {
      tipo: certificateType.label,
      status: "failed",
      resultado: SOURCE_RESULT.ERRO,
      errorMessage: error.message,
    };
  } finally {
    if (process.env.TJAP_KEEP_PAGE_OPEN !== "true") {
      await page.close().catch(() => {});
    }
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

function esajModelValue(certificateId) {
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

async function waitForTjapFormOrProtection(page) {
  await page
    .waitForFunction(
      () => /Requisitar certid|Tipo de pessoa|Cloudflare|Azion|Forbidden|Verify you are human/i.test(document.body?.innerText || ""),
      null,
      { timeout: envNumber("TJAP_CLOUDFLARE_TIMEOUT_MS", 120000) },
    )
    .catch(() => {});
  const pageText = await page.locator("body").innerText().catch(() => "");
  const formVisible = /Requisitar certid|Tipo de pessoa/i.test(pageText) && (await page.locator("input[name='tipopessoa']").count().catch(() => 0)) > 0;
  return { formVisible, pageText };
}

async function hasTjapProtection(page, pageText = "") {
  const text = pageText || (await page.locator("body").innerText().catch(() => ""));
  if (/Verify you are human|Cloudflare|Azion|Forbidden|seguran[çc]a|verifica/i.test(text)) {
    return true;
  }
  return (
    (await page
      .locator("iframe[src*='turnstile'], iframe[src*='cloudflare'], input[name='cf-turnstile-response'], .cf-turnstile")
      .count()
      .catch(() => 0)) > 0
  );
}

async function fillVisibleInputByIndex(page, selector, index, value) {
  const text = String(value || "").trim();
  if (!text) {
    return false;
  }
  const locator = page.locator(selector).filter({ visible: true });
  if ((await locator.count().catch(() => 0)) <= index) {
    return false;
  }
  await locator.nth(index).fill(text, { timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 5000) }).catch(() => {});
  return true;
}

async function selectFirstVisibleSelectByTextOrValue(page, value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return false;
  }
  const selects = page.locator("select").filter({ visible: true });
  if (!(await selects.count().catch(() => 0))) {
    return false;
  }
  const selected = await selects
    .first()
    .evaluate((select, rawValue) => {
      const normalized = String(rawValue || "").toLowerCase();
      const option = [...select.options].find((item) => item.value.toLowerCase() === normalized || item.text.toLowerCase().includes(normalized));
      if (!option) return false;
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, raw)
    .catch(() => false);
  return selected;
}

async function chooseTjapCertificateType(page, certificateId) {
  const labels = {
    falencia: /fal[eê]ncia|recupera[çc][aã]o/i,
    especial: /c[ií]vel e criminal|incidente/i,
    criminal: /^criminal$/i,
    civil: /^c[ií]vel$/i,
  };
  const pattern = labels[certificateId] || labels.especial;
  const radios = page.locator("input[name='tipocertidao']").filter({ visible: true });
  const count = await radios.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const containerText = await radios.nth(index).evaluate((input) => input.parentElement?.innerText || input.nextSibling?.textContent || "").catch(() => "");
    if (pattern.test(containerText)) {
      await radios.nth(index).check({ force: true }).catch(() => {});
      return true;
    }
  }
  if (count) {
    await radios.nth(Math.min(1, count - 1)).check({ force: true }).catch(() => {});
    return true;
  }
  return false;
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

async function safeFillVisible(page, selector, value) {
  const text = String(value || "").trim();
  if (!text) {
    return false;
  }
  const matches = page.locator(selector);
  if (!(await matches.count().catch(() => 0))) {
    return false;
  }
  const locator = matches.first();
  const usable = await locator
    .evaluate((element) => {
      const style = window.getComputedStyle(element);
      const visible = Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
      return visible && !element.disabled && !element.readOnly && style.visibility !== "hidden" && style.display !== "none";
    })
    .catch(() => false);
  if (!usable) {
    return false;
  }
  await locator.fill(text, { timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 5000) }).catch(() => {});
  return true;
}

async function safeCheck(page, selector) {
  const matches = page.locator(selector);
  if (!(await matches.count().catch(() => 0))) {
    return false;
  }
  const locator = matches.first();
  const usable = await locator
    .evaluate((element) => {
      const visible = Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
      return visible && !element.disabled;
    })
    .catch(() => false);
  if (!usable) {
    return false;
  }
  await locator.check({ force: true, timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 5000) }).catch(() => {});
  return true;
}

async function clickByText(page, pattern) {
  const locator = page.locator("button, a, .q-item, .v-list-item, .card, [role='button'], div").filter({ hasText: pattern }).filter({ visible: true });
  const count = await locator.count().catch(() => 0);
  if (!count) {
    return false;
  }
  await locator.first().click({ timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 5000) }).catch(() => {});
  return true;
}

async function fillByLabelLike(page, pattern, value) {
  const text = String(value || "").trim();
  if (!text) {
    return false;
  }
  return page
    .evaluate(
      ({ source, flags, textValue }) => {
        const pattern = new RegExp(source, flags);
        const normalizeText = (value) =>
          String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          return Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length) && style.visibility !== "hidden" && style.display !== "none";
        };
        const fields = [...document.querySelectorAll("input, textarea")].filter((element) => visible(element) && !element.disabled && !element.readOnly);
        for (const field of fields) {
          const label = [
            field.getAttribute("aria-label"),
            field.getAttribute("placeholder"),
            field.name,
            field.id,
            field.closest("label")?.innerText,
            field.closest(".form-group, .v-input, .q-field, .row, div")?.innerText,
          ].join(" ");
          if (pattern.test(normalizeText(label))) {
            field.focus();
            field.value = textValue;
            field.dispatchEvent(new Event("input", { bubbles: true }));
            field.dispatchEvent(new Event("change", { bubbles: true }));
            field.dispatchEvent(new Event("blur", { bubbles: true }));
            return true;
          }
        }
        return false;
      },
      { source: pattern.source, flags: pattern.flags.includes("i") ? pattern.flags : `${pattern.flags}i`, textValue: text },
    )
    .catch(() => false);
}

async function selectMtCertificateType(page, certificateId) {
  const label = certificateId === "criminal" ? /criminal/i : /c[ií]vel/i;
  const checkbox = page.locator("label, .v-list-item, .q-item, div").filter({ hasText: label }).locator("input[type='checkbox']").filter({ visible: true });
  if (await checkbox.count().catch(() => 0)) {
    await checkbox.first().check({ force: true, timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 5000) }).catch(() => {});
    return true;
  }
  return clickByText(page, label);
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

async function setVisibleRadioValue(page, name, value) {
  const normalized = normalize(value);
  let radioValue = "";
  if (["m", "masculino"].includes(normalized)) radioValue = "M";
  if (["f", "feminino"].includes(normalized)) radioValue = "F";
  if (!radioValue) {
    return false;
  }
  return safeCheck(page, `input[name="${name}"][value="${radioValue}"]`);
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

async function selectVisibleByTextOrValue(page, selector, value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return false;
  }
  const locator = page.locator(selector).first();
  const usable = await locator
    .evaluate((element) => {
      const visible = Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
      return visible && !element.disabled;
    })
    .catch(() => false);
  if (!usable) {
    return false;
  }
  return selectByTextOrValue(page, selector, raw);
}

async function selectTjseMatOption(page, index, preferredText) {
  const selects = page.locator("mat-select");
  if ((await selects.count().catch(() => 0)) <= index) {
    return false;
  }
  await selects.nth(index).click({ timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 5000) }).catch(() => {});
  await page.waitForTimeout(500);
  const raw = String(preferredText || "").trim();
  const normalized = normalize(raw);
  const options = page.locator("mat-option");
  const count = await options.count().catch(() => 0);
  if (!count) {
    return false;
  }
  for (let optionIndex = 0; optionIndex < count; optionIndex += 1) {
    const text = await options.nth(optionIndex).innerText().catch(() => "");
    if (!normalized || normalize(text).includes(normalized)) {
      await options.nth(optionIndex).click({ timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 5000) }).catch(() => {});
      return true;
    }
  }
  await options.first().click({ timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 5000) }).catch(() => {});
  return true;
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
  await page.getByRole("button", { name: /pr[óo]ximo/i }).click();
  const firstStepState = await page.waitForFunction(
    () => {
      const text = document.body.innerText || "";
      if (/Ocorreu um erro|erro ao recuperar os dados do solicitante|solicitante n[aã]o encontrado/i.test(text)) return "error";
      if (/Nome da M[ãa]e|Nome do Pai|DOWNLOAD|Download/i.test(text)) return "ready";
      return "";
    },
    null,
    { timeout: stepTimeoutMs },
  );
  const state = await firstStepState.jsonValue().catch(() => "");
  if (state === "error") {
    const pageText = await page.locator("body").innerText().catch(() => "");
    throw new Error(extractPortalError(pageText) || "TJDFT nao conseguiu recuperar os dados do solicitante. Confira CPF/CNPJ e primeiro nome.");
  }
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
  await page.getByRole("button", { name: /pr[óo]ximo/i }).click();
  const secondStepState = await page.waitForFunction(
    () => {
      const text = document.body.innerText || "";
      if (/Ocorreu um erro|erro ao recuperar|inv[aá]lid|obrigat[oó]rio/i.test(text)) return "error";
      if (/DOWNLOAD|Download/i.test(text)) return "ready";
      return "";
    },
    null,
    { timeout: stepTimeoutMs },
  );
  const state = await secondStepState.jsonValue().catch(() => "");
  if (state === "error") {
    const pageText = await page.locator("body").innerText().catch(() => "");
    throw new Error(extractPortalError(pageText) || "TJDFT recusou os dados complementares informados.");
  }
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

function extractPortalError(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    lines.find((line) => /erro ao recuperar os dados do solicitante|solicitante n[aã]o encontrado/i.test(line)) ||
    lines.find((line) => /Ocorreu um erro/i.test(line)) ||
    ""
  );
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

function hasEsTjesPrintableCertificateSignal(text) {
  const normalized = normalize(text);
  return (
    normalized.includes("tribunal de justica do estado do espirito santo") &&
    normalized.includes("certidao negativa") &&
    (normalized.includes("dados da certidao") || normalized.includes("nada consta") || normalized.includes("imprimir"))
  );
}

function hasEsTjesRequestFormSignal(text) {
  const normalized = normalize(text);
  return (
    normalized.includes("solicitacao de certidao negativa") ||
    normalized.includes("preencha o cpf") ||
    normalized.includes("preencha o cnpj") ||
    normalized.includes("informe o nome conforme o cpf")
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

function formatCompactBrazilianDate(value) {
  return formatBrazilianDate(value).replace(/\D/g, "");
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
