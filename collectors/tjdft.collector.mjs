import {
  failedResult,
  manualRequiredResult,
  successResult,
  unavailableResult,
  waitingUserActionResult,
  SOURCE_RESULT,
} from "./base.collector.mjs";
import { readFile } from "node:fs/promises";
import { extractPdfText, saveAndExtractPdfBuffer } from "../services/pdf.service.mjs";
import {
  findStateCourtProfile,
  getStateCourtCertificateLabel,
  getStateCourtFieldLabel,
} from "../services/state-courts.service.mjs";
import {
  createStateCourtAgentSession,
  isStateCourtAgentAssistedEnabled,
  startStateCourtAgentSession,
} from "../services/state-court-agent.service.mjs";

export const fonte = "tjdft";

const OFFICIAL_URL = "https://cnc.tjdft.jus.br/solicitacao-externa";
const CERTIFICATE_TYPES = [
  { id: "criminal", label: "Criminal", radioIndex: 0 },
  { id: "civil", label: "Cível", radioIndex: 1 },
  { id: "falencia", label: "Falência e Recuperação Judicial", radioIndex: 2 },
  { id: "especial", label: "Especial (Cível e Criminal)", radioIndex: 3 },
];

const STANDARD_CHROME_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const TJMT_SEC2_API_BASE = process.env.TJMT_SEC2_API_BASE || "https://hellsgate-preview.tjmt.jus.br/sec2gestao";
const TJMT_SEC2_PUBLIC_TOKEN = process.env.TJMT_SEC2_API_TOKEN || "NuFa-5lmp7-dAAn0";

const assistedSessions = new Map();
const assistedDownloadPages = new WeakSet();

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

export function analyzeAssistedSessionSnapshot({ title = "", url = "", text = "", links = [], pdfEmbeds = [] } = {}) {
  const safeText = String(text || "");
  const safeUrl = String(url || "");
  const normalizedText = safeText
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const safeLinks = Array.isArray(links) ? links : [];
  const safePdfEmbeds = Array.isArray(pdfEmbeds) ? pdfEmbeds : [];
  const linkedText = [
    safeUrl,
    ...safeLinks.map((link) => `${link.text || ""} ${link.href || ""}`),
    ...safePdfEmbeds.map((embed) => `${embed.href || ""} ${embed.type || ""} ${embed.text || ""}`),
  ].join(" ");
  const isEsajCadastroForm = /abrirCadastro\.do/i.test(safeUrl) || /Cadastro de Pedido de Certid|Para pedir uma certid/i.test(safeText);
  const isCadastroForm =
    isEsajCadastroForm ||
    /certidao\/unificada/i.test(safeUrl) ||
    /Tipo Pessoa\s*\*|Grau de Jurisdi[cç][aã]o\s*\*|Tipo Certid[aã]o\s*\*|Nome\s*\/\s*Raz[aã]o Social/i.test(safeText);
  const detectedPdfLinks = isCadastroForm
    ? []
    : safeLinks.filter((link) => {
        const href = String(link.href || "");
        const label = String(link.text || "");
        const combined = `${href} ${label}`;
        const looksLikeCertificatePdf = /certid|abrirDownload|download/i.test(combined) && /\.pdf(?:\?|#|$)/i.test(href);
        const explicitCertificateDownload = /(?:abrirDownload|download).*certid/i.test(combined) && !/valid[aã]o|validacao|autentic/i.test(combined);
        const genericDocument = /manual|provimento|ato|politica|privacy|termos|orienta[cç][aã]o|valida[cç][aã]o\/download/i.test(combined);
        return !genericDocument && (looksLikeCertificatePdf || explicitCertificateDownload);
      });
  const currentPageLooksGenericPdf = /manual|provimento|ato|politica|privacy|termos|orienta[cç][aã]o/i.test(safeUrl);
  const currentPagePdfLink = !isCadastroForm && !currentPageLooksGenericPdf && (/\.pdf(?:\?|#|$)/i.test(safeUrl) || /(?:abrirDownload|download).*certid/i.test(safeUrl))
    ? [{ text: "PDF atual", href: safeUrl }]
    : [];
  const embeddedPdfLinks = isCadastroForm
    ? []
    : safePdfEmbeds
        .filter((embed) => {
          const href = String(embed.href || "");
          return href && !/^blob:/i.test(href) && !/^data:/i.test(href) && /pdf|certid/i.test(`${href} ${embed.type || ""} ${embed.text || ""}`);
        })
        .map((embed) => ({ text: embed.text || "PDF incorporado", href: embed.href }));
  const pdfLinks = [...currentPagePdfLink, ...detectedPdfLinks, ...embeddedPdfLinks].filter((link, index, array) => {
    const href = String(link.href || "");
    return href && array.findIndex((candidate) => String(candidate.href || "") === href) === index;
  });
  const hasEmbeddedPdf = !isCadastroForm && safePdfEmbeds.some((embed) => /pdf|certid/i.test(`${embed.href || ""} ${embed.type || ""} ${embed.text || ""}`));
  const rawProtocolMatch = safeText.match(
    /(?:n[uú]mero\s+do\s+pedido|(?:protocolo|pedido|solicita)\s*(?:n(?:umero|[o.])?)?)\s*[:\-]?\s*([A-Z0-9][A-Z0-9./-]{4,})/i,
  );
  const certificateNumberMatch = safeText.match(/certid[aã]o\s*n[ºo.:]*\s*([A-Z0-9][A-Z0-9./-]{4,})/i) ||
    safeText.match(/n[ºo.]?\s+da\s+certid[aã]o\s*[:\-]?\s*([A-Z0-9][A-Z0-9./-]{4,})/i);
  const protocol = /\d/.test(rawProtocolMatch?.[1] || certificateNumberMatch?.[1] || "") ? rawProtocolMatch?.[1] || certificateNumberMatch?.[1] : "";
  const hasRequestRegistered = /pedido\s+foi\s+cadastrado\s+com\s+sucesso|dados\s+para\s+(?:download|emiss[aã]o)\s+da\s+certid[aã]o|ser[aã]o?\s+encaminhadas?\s+instru[cç][oõ]es\s+no\s+e-?mail|prazo\s+m[aá]ximo\s+para\s+libera[cç][aã]o/i.test(safeText);
  const hasResultSignal = !isCadastroForm && /nada\s+consta|n[aã]o\s+constar|certid[aã]o\s*n[ºo.:]|certid\s*(?:negativa|emitida)|consta(?:m)?\s+(?:registro|apontamento|distribui|processo)|protocolo|pedido\s+(?:gerado|registrado|cadastrado)/i.test(safeText);
  const hasCaptchaSignal = /captcha|recaptcha|hcaptcha|confirme que voc|sou humano|valid.*humana|falha\s+na\s+verifica|solu[cç][aã]o\s+de\s+problemas|cloudflare|turnstile/i.test(`${safeText} ${linkedText}`);
  const hasBlockingValidationSignal = hasCaptchaSignal || /c[oÃ³]digo\s+de\s+seguran[cÃ§]a|valor\s+da\s+imagem/i.test(safeText);
  const hasBlockingValidationBarrier =
    hasBlockingValidationSignal || /codigo\s+de\s+segur|valor\s+da\s+imagem|campo\s+codigo\s+de\s+segur/.test(normalizedText);
  const hasErrorSignal =
    /erro|falha|indispon|service unavailable|http\/1\.1\s+service unavailable|servidor n[aã]o dispon[ií]vel|n[aã]o foi poss|tente novamente|exception|nullpointerexception|tipo de exce[cç][aã]o|detalhes do erro/i.test(safeText);
  const status = hasErrorSignal
    ? "portal_error"
    : (pdfLinks.length || hasEmbeddedPdf) && !hasBlockingValidationBarrier
      ? "result_available"
      : hasRequestRegistered || (protocol && /pedido/i.test(safeText))
        ? "request_registered"
        : (hasBlockingValidationBarrier && !protocol) || isEsajCadastroForm
          ? "captcha_pending"
          : protocol || hasResultSignal
          ? "result_available"
          : "no_result_yet";

  return {
    status,
    title: String(title || ""),
    url: safeUrl,
    protocol,
    requestRegistered: hasRequestRegistered,
    pdfLinks: pdfLinks.slice(0, 5),
    pdfEmbeds: safePdfEmbeds.slice(0, 5),
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

  const stateCourtFields = extra.stateCourtFields && typeof extra.stateCourtFields === "object" ? extra.stateCourtFields : {};
  const fullNameFallback = String(
    stateCourtFields.firstName ||
      stateCourtFields.fullName ||
      stateCourtFields.companyName ||
      extra.tjdftCompanyName ||
      "",
  ).trim();
  const firstName = String(extra.firstName || extra.primeiroNome || fullNameFallback.split(/\s+/)[0] || "").trim();
  const motherName = String(extra.motherName || extra.nomeMae || stateCourtFields.motherName || "").trim();
  const fatherName = String(extra.fatherName || extra.nomePai || stateCourtFields.fatherName || "").trim();
  const missingFields = documentType === "cpf"
    ? getTjdftPfMissingFields({
        firstName,
        motherName,
        certificateTypes: getCertificateTypesForInput(input),
      })
    : [];

  if (missingFields.length) {
    return unavailableResult(fonte, "Informe o primeiro nome e, para certidões Criminais ou Especiais, o nome da mãe.", {
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

  if (profile?.automationStatus === "blocked") {
    return unavailableResult(
      fonte,
      `${stateCourtName} esta bloqueado temporariamente por ${profile?.blocker || "protecao oficial"}.`,
      {
        ...baseData,
        modo: "bloqueado",
        blockedByProtection: true,
        blocker: profile?.blocker || "official_protection",
        resumo: "Fluxo pausado porque o portal oficial bloqueou a validacao no navegador automatizado.",
      },
    );
  }

  if (profile?.uf !== "MT" && (profile?.automationStatus === "agent_assisted" || profile?.platform === "agent_assisted")) {
    if (isStateCourtAgentAssistedEnabled(profile)) {
      return collectAgentAssistedStateCourt({
        input,
        profile,
        stateCourtName,
        stateCourtUrl,
        requestedCertificates,
        baseData,
      });
    }
  }

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

  if (profile?.uf === "TO") {
    return collectToTjtoStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData });
  }

  if (profile?.uf === "MT") {
    return collectMtTjmtStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData });
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

  if (profile?.platform === "sirece") {
    return collectCeTjceStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData });
  }

  if (profile?.platform === "tjpe") {
    return collectPeTjpeStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData });
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

  if (profile?.uf === "MA") {
    return collectMaTjmaStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData });
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

async function collectAgentAssistedStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData }) {
  const preferredApiKeyRef = process.env.STATE_COURT_AGENT_API_KEY_SECRET || "AUDITA_OPENAI_API_KEY";
  const apiKeyRef = process.env[preferredApiKeyRef]
    ? preferredApiKeyRef
    : process.env.AUDITA_OPENAI_API_KEY
      ? "AUDITA_OPENAI_API_KEY"
      : process.env.OPENAI_API_KEY
        ? "OPENAI_API_KEY"
        : preferredApiKeyRef;
  if (!process.env[apiKeyRef]) {
    return unavailableResult(fonte, `${stateCourtName} esta configurado para agente navegador, mas o secret ${apiKeyRef} nao esta disponivel.`, {
      ...baseData,
      automationStatus: "agent_assisted",
      captchaMode: "assisted",
      modo: "agent_assisted_unavailable",
      proximoPasso: `Configure ${apiKeyRef} no ambiente para executar o agente navegador ou use emissao manual guiada.`,
    });
  }

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return unavailableResult(fonte, `Instale a dependencia Playwright para executar o agente navegador ${stateCourtName}.`, {
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
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1365, height: 768 },
    userAgent: STANDARD_CHROME_USER_AGENT,
    extraHTTPHeaders: {
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });
  let keepBrowserOpen = false;
  let sessionId = "";
  let agentSession = null;

  try {
    const page = await context.newPage();
    page.setDefaultTimeout(envNumber("STATE_COURT_STEP_TIMEOUT_MS", input.timeoutMs || 30000));
    await page.goto(stateCourtUrl || profile?.url, {
      waitUntil: "domcontentloaded",
      timeout: envNumber("STATE_COURT_NAV_TIMEOUT_MS", 30000),
    });
    await page.waitForTimeout(envNumber("STATE_COURT_AGENT_INITIAL_WAIT_MS", 1200)).catch(() => {});
    let prefilledFields = [];
    if (profile?.uf === "AP" && requestedCertificates[0]) {
      prefilledFields = await fillTjapPageFields({ page, input, profile, certificateType: requestedCertificates[0] })
        .then((ok) => (ok ? ["tjap_prefill"] : []))
        .catch(() => []);
    } else if (profile?.uf === "PI" && requestedCertificates[0]) {
      prefilledFields = await fillTjpiPageFields({ page, input, profile, certificateType: requestedCertificates[0] }).catch(() => []);
    }
    const pageText = await page.locator("body").innerText().catch(() => "");
    const results = requestedCertificates.map((certificateType) => ({
      tipo: certificateType.label,
      certificateId: certificateType.id,
      status: "agent_assisted",
      resultado: SOURCE_RESULT.INDISPONIVEL,
      portalLoaded: true,
      requiresCaptcha: /captcha|recaptcha|codigo de seguranca|c[oó]digo de seguran[çc]a/i.test(pageText),
      requiresLogin: /login|entrar|senha|certificado digital/i.test(pageText),
      requiresConfirmation: false,
      blockedByProtection: /cloudflare|turnstile|just a moment|azion|access denied/i.test(pageText),
      pageText: pageText.slice(0, 2000),
      filledFields: prefilledFields,
      errorMessage: "Agente navegador iniciado; aguardando decisao do agente ou acao humana.",
    }));

    keepBrowserOpen = true;
    sessionId = createAssistedSession({
      browser,
      context,
      courtName: stateCourtName || profile?.court,
      courtUf: profile?.uf,
      portalUrl: stateCourtUrl || profile?.url,
      input,
      profile,
      results,
    });
    agentSession = createStateCourtAgentSession({
      uf: profile?.uf || input.extraFields?.stateCourtUf || "",
      tribunal: stateCourtName || profile?.court,
      portalUrl: stateCourtUrl || profile?.url,
      assistedSession: sessionId,
      input,
      profile,
      requestedCertificates,
      getView: getAssistedSessionView,
      interact: interactAssistedSession,
    });

    agentSession = startStateCourtAgentSession(agentSession.id, {
      userMessage: `Inicie o fluxo para ${stateCourtName || profile?.court}. Localize a emissao oficial, preencha apenas campos seguros com os dados recebidos e pause para humano em CAPTCHA, login, certificado, pagamento, confirmacao sensivel ou ambiguidade.`,
    });

    return waitingUserActionResult(
      fonte,
      `${stateCourtName} foi aberto em modo agente navegador. O agente trabalha em paralelo e pausa quando precisar de acao humana.`,
      {
        ...baseData,
        automationStatus: "agent_assisted",
        captchaMode: "assisted",
        modo: "agent_assisted",
        tribunal: stateCourtName || profile?.court,
        uf: profile?.uf || input.extraFields?.stateCourtUf || "",
        validationFrameUrl: stateCourtUrl || profile?.url,
        assistedPortalUrl: stateCourtUrl || profile?.url,
        assistedSession: sessionId,
        agentSession: agentSession?.id || "",
        agentStatus: agentSession?.status || "ready",
        agentMessages: agentSession?.messages || [],
        agentNextAction: agentSession?.nextAction || "",
        sessionOpen: keepBrowserOpen,
        certidoes: results,
        totalCertidoes: results.length,
        captchaLab: buildCaptchaLabReport({ profile, results, sessionOpen: keepBrowserOpen, sessionId, browserEngine: "playwright+openai-agent" }),
        resumo: `${stateCourtName} iniciado em agente navegador paralelo.`,
        proximoPasso:
          agentSession?.nextAction === "user_message"
            ? "Responder a pergunta do agente no chat e acionar Devolver ao agente."
            : "Acompanhar a sessao assistida. Se o agente pausar, assuma a validacao humana e devolva o controle.",
      },
    );
  } catch (error) {
    if (keepBrowserOpen && sessionId) {
      return waitingUserActionResult(fonte, `${stateCourtName} abriu o navegador assistido, mas o agente encontrou uma falha: ${error.message}`, {
        ...baseData,
        automationStatus: "agent_assisted",
        captchaMode: "assisted",
        modo: "agent_assisted_error",
        assistedSession: sessionId,
        agentSession: agentSession?.id || "",
        sessionOpen: true,
        proximoPasso: "Use a sessao assistida manualmente ou tente devolver ao agente apos revisar a tela.",
      });
    }
    return failedResult(fonte, `Falha ao iniciar agente navegador ${stateCourtName}: ${error.message}`, {
      ...baseData,
      automationStatus: "agent_assisted",
      modo: "agent_assisted_error",
    });
  } finally {
    if (!keepBrowserOpen) {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
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
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    userAgent: STANDARD_CHROME_USER_AGENT,
    extraHTTPHeaders: {
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    },
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
    const captchaOrLoginDetected = results.some((result) => result.requiresCaptcha || result.requiresLogin || result.blockedByProtection);
    const protectionDetected = results.some((result) => result.requiresCaptcha || result.requiresLogin || result.requiresConfirmation || result.blockedByProtection);
    if (loaded && filledCount === 0 && !captchaOrLoginDetected) {
      return manualRequiredResult(
        fonte,
        `${stateCourtName} carregou, mas a IA AUDITA ainda nao reconhece campos suficientes para automacao assistida confiavel.`,
        {
          ...baseData,
          automationStatus: "needs_mapping",
          captchaMode: profile?.captchaMode || "assisted",
          modo: "mapeamento_pendente",
          tribunal: stateCourtName || profile?.court,
          uf: profile?.uf || input.extraFields?.stateCourtUf || "",
          assistedPortalUrl: stateCourtUrl || profile?.url,
          certidoes: results,
          totalCertidoes: results.length,
          camposPreenchidos: filledCount,
          portalInspection: {
            loaded,
            protectionDetected,
            filledFields: [],
            textSample: results.find((result) => result.pageText)?.pageText?.slice(0, 500) || "",
          },
          resumo: `${stateCourtName} carregado, mas nenhum campo confiavel foi preenchido. Necessario mapear seletores especificos do portal.`,
          proximoPasso: "Mapear formulario real, botoes de avanco, validacao oficial e download/protocolo antes de considerar esta UF funcional.",
        },
      );
    }
    if (loaded && shouldKeepAssistedOpen()) {
      keepBrowserOpen = true;
      sessionId = createAssistedSession({ browser, context, courtName: stateCourtName || profile?.court, courtUf: profile?.uf, portalUrl: stateCourtUrl || profile?.url, input, profile, results });
    }

    return waitingUserActionResult(
      fonte,
      `${stateCourtName} esta em automacao assistida. A IA AUDITA preenche os campos reconhecidos e pausa na validacao oficial quando o portal exigir.`,
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
          ? "Resolver reCAPTCHA, captcha, login ou confirmacao na janela oficial ja preenchida; depois anexar/confirmar a certidao na IA AUDITA."
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

async function collectMaTjmaStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData }) {
  if (input.tipoDocumento !== "cpf") {
    return unavailableResult(fonte, "TJMA/JurisConsult informa que certidoes para pessoa juridica nao estao disponiveis para emissao online neste fluxo.", {
      ...baseData,
      tribunal: stateCourtName || "TJMA",
      uf: "MA",
      proximoPasso: "Para CNPJ, seguir contato oficial com forum/comarca ou diretoria indicada pelo JurisConsult.",
    });
  }

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return unavailableResult(fonte, "Instale a dependencia Playwright para executar o modo assistido TJMA.", {
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
    userAgent: `Audita/0.1 ${stateCourtName || "TJMA"} assisted collector`,
  });
  let keepBrowserOpen = false;
  let sessionId = "";

  try {
    const results = [];
    for (const certificateType of requestedCertificates) {
      results.push(await fillMaTjmaCertificate({
        context,
        input,
        profile,
        certificateType,
        keepPageOpen: shouldKeepAssistedOpen(),
      }));
    }

    if (shouldKeepAssistedOpen()) {
      keepBrowserOpen = true;
      sessionId = createAssistedSession({
        browser,
        context,
        courtName: stateCourtName || "TJMA",
        courtUf: "MA",
        portalUrl: stateCourtUrl || profile?.url,
        input,
        profile,
        results,
      });
    }

    const filledCount = results.reduce((sum, result) => sum + (Array.isArray(result.filledFields) ? result.filledFields.length : 0), 0);
    const protectionDetected = results.some((result) => result.requiresCaptcha || result.blockedByProtection || result.requiresConfirmation);
    return waitingUserActionResult(
      fonte,
      "TJMA/JurisConsult foi aberto no formulario oficial de Certidao Estadual. A IA AUDITA preenche os campos reconhecidos e pausa no CAPTCHA oficial.",
      {
        ...baseData,
        automationStatus: "active",
        captchaMode: profile?.captchaMode || "assisted",
        modo: "automatico_com_validacao",
        tribunal: stateCourtName || "TJMA",
        uf: "MA",
        validationFrameUrl: stateCourtUrl || profile?.url,
        assistedPortalUrl: stateCourtUrl || profile?.url,
        assistedSession: sessionId || "external_browser",
        sessionOpen: keepBrowserOpen,
        certidoes: results,
        totalCertidoes: results.length,
        camposPreenchidos: filledCount,
        portalInspection: {
          loaded: results.some((result) => result.portalLoaded),
          protectionDetected,
          filledFields: [...new Set(results.flatMap((result) => result.filledFields || []))],
          textSample: results.find((result) => result.pageText)?.pageText?.slice(0, 500) || "",
        },
        captchaLab: buildCaptchaLabReport({ profile, results, sessionOpen: keepBrowserOpen, sessionId }),
        resumo: `TJMA em modo assistido. Campos preenchidos: ${filledCount}.`,
        proximoPasso: keepBrowserOpen
          ? "Resolver o CAPTCHA oficial no navegador assistido e concluir a emissao/consulta no JurisConsult."
          : "Resolver o CAPTCHA oficial no JurisConsult e anexar o protocolo/PDF ou resultado textual à IA AUDITA.",
      },
    );
  } finally {
    if (!keepBrowserOpen) {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  }
}

async function fillMaTjmaCertificate({ context, input, profile, certificateType, keepPageOpen }) {
  const page = await context.newPage();
  let shouldKeepPageOpen = false;
  try {
    page.setDefaultTimeout(envNumber("STATE_COURT_STEP_TIMEOUT_MS", input.timeoutMs || 25000));
    const fields = input.extraFields?.stateCourtFields || {};
    const documentValue = String(input.extraFields?.cpfDocument || input.documento || "").replace(/\D/g, "");
    await gotoMaTjmaPortal(page, profile?.url || "https://jurisconsult.tjma.jus.br/#/certidao-generate-state-certificate-form");
    await page.waitForTimeout(envNumber("STATE_COURT_DISCOVERY_DELAY_MS", 2500));

    let pageText = await page.locator("body").innerText().catch(() => "");
    if (/acesso negado|limite de requis/i.test(pageText)) {
      shouldKeepPageOpen = keepPageOpen;
      return {
        tipo: certificateType.label,
        status: "waiting_user_action",
        resultado: SOURCE_RESULT.INDISPONIVEL,
        portalLoaded: true,
        filledFields: [],
        pageText,
        blockedByProtection: true,
        humanCheckpoint: "anti_bot_block",
        assistedWindowOpen: shouldKeepPageOpen,
        errorMessage: "TJMA/JurisConsult recusou temporariamente por limite de requisicoes do portal oficial.",
        resumo: "Portal carregou pagina de bloqueio temporario/limite de requisicoes.",
      };
    }

    await clickMaTjmaCookieConsent(page);

    const filledFields = [];
    const recordField = async (name, promise) => {
      const ok = await promise.catch(() => false);
      if (ok) filledFields.push(name);
      return ok;
    };

    await recordField("instancia", selectMaTjmaOption(page, "instancia", "Primeiro Grau"));
    await recordField("natureza", selectMaTjmaOption(page, "natureza", maTjmaNatureLabel(certificateType.id)));
    await recordField("cpf", fillMaTjmaControl(page, "cpf", formatDocument(documentValue)));
    await recordField("nome", fillMaTjmaControl(page, "nome", fields.fullName || input.extraFields?.fullName || ""));
    await recordField("nascimento", fillMaTjmaBirthDate(page, fields.birthDate || input.extraFields?.birthDate || ""));
    await recordField("mae", fillMaTjmaControl(page, "mae", fields.motherName || input.extraFields?.motherName || input.extraFields?.nomeMae || ""));
    await recordField("pai", fillMaTjmaControl(page, "pai", fields.fatherName || input.extraFields?.fatherName || input.extraFields?.nomePai || ""));

    await page.waitForTimeout(800);
    pageText = await page.locator("body").innerText().catch(() => "");
    const captchaDetected =
      /captcha|recaptcha|digite o valor da imagem|codigo de seguranca|c[oó]digo de seguran[cç]a/i.test(pageText) ||
      (await page.locator('input[formcontrolname="recaptcha"], ion-input[formcontrolname="recaptcha"], iframe[src*="recaptcha"]').count().catch(() => 0)) > 0;
    const confirmationDetected = /solicitar|emitir|gerar|confirmar/i.test(pageText);
    shouldKeepPageOpen = keepPageOpen;

    return {
      tipo: certificateType.label,
      status: "waiting_user_action",
      resultado: SOURCE_RESULT.INDISPONIVEL,
      portalLoaded: true,
      filledFields: [...new Set(filledFields)],
      pageText,
      requiresCaptcha: captchaDetected,
      requiresLogin: false,
      requiresConfirmation: !captchaDetected && confirmationDetected,
      blockedByProtection: false,
      humanCheckpoint: classifyHumanCheckpoint({
        requiresCaptcha: captchaDetected,
        requiresConfirmation: !captchaDetected && confirmationDetected,
      }),
      assistedWindowOpen: shouldKeepPageOpen,
      errorMessage: captchaDetected
        ? "TJMA/JurisConsult preenchido ate o CAPTCHA oficial."
        : "TJMA/JurisConsult preenchido ate a proxima etapa oficial.",
      resumo: filledFields.length
        ? `Campos reconhecidos preenchidos: ${[...new Set(filledFields)].join(", ")}.`
        : "Formulario TJMA carregado, mas nenhum campo confiavel foi preenchido.",
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
    if (!shouldKeepPageOpen) {
      await page.close().catch(() => {});
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
      const hintedField = (haystack) => {
        const aliases = values.fieldAliases || {};
        for (const [field, terms] of Object.entries(aliases)) {
          const normalizedTerms = Array.isArray(terms) ? terms.map(normalizeText).filter(Boolean) : [];
          if (normalizedTerms.some((term) => haystack.includes(term))) return field;
        }
        return "";
      };
      const hintedSelectField = (haystack) => {
        const aliases = values.selectAliases || {};
        for (const [field, terms] of Object.entries(aliases)) {
          const normalizedTerms = Array.isArray(terms) ? terms.map(normalizeText).filter(Boolean) : [];
          if (normalizedTerms.some((term) => haystack.includes(term))) return field;
        }
        return "";
      };
      const pickField = (text, element) => {
        const name = normalizeText(`${element.name || ""} ${element.id || ""}`);
        const haystack = `${text} ${name}`;
        const hinted = hintedField(haystack);
        if (hinted) return hinted;
        if (/(cnpj|cpf|documento|doc\.?|cic)/.test(haystack)) return "document";
        if (/(tipo documento|tipo de documento|documento ao lado)/.test(haystack)) return "documentType";
        if (/(instancia|grau)/.test(haystack)) return "instance";
        if (/(natureza|classe|area|competencia)/.test(haystack)) return "nature";
        if (/(tipo de certidao|tipo certidao|modelo|certidao|certidao negativa)/.test(haystack)) return "certificate";
        if (/(participacao|participa|polo|figura como|parte ativa|parte passiva)/.test(haystack)) return "participation";
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
        if (/(titulo de eleitor|eleitor)/.test(haystack)) return "voterTitle";
        if (/(ctps|carteira profissional|carteira de trabalho).*serie|serie/.test(haystack)) return "ctpsSeries";
        if (/(ctps|carteira profissional|carteira de trabalho)/.test(haystack)) return "ctpsNumber";
        if (/(numero)/.test(haystack) && /(endereco|logradouro|residencia)/.test(haystack)) return "addressNumber";
        if (/(complemento)/.test(haystack)) return "addressComplement";
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
        if (field === "instance") return [values.instance];
        if (field === "nature") return [values.nature, values.certificateLabel, values.certificateId];
        if (field === "certificate") return [values.certificateLabel, values.certificateId, values.nature, values.certificateKind];
        if (field === "participation") return [values.participation];
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
        field = hintedSelectField(text) || field;
        if (/(certidao|certidão|modelo|natureza|tipo)/.test(text)) field = "certificate";
        if (/(pessoa|tipo pessoa|fisica|juridica|cpf|cnpj)/.test(text)) field = "personType";
        if (/(instancia|grau)/.test(text)) field = "instance";
        if (/(participacao|polo|figura)/.test(text)) field = "participation";
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
        protectionDetected: /403 forbidden|forbidden|acesso bloqueado|site maintenance|security service|security verification|malicious bots|muitas tentativas|acesso foi bloqueado/i.test(bodyText) ||
          frameSources.some((src) => /cloudflare|turnstile|perfdrive|shieldsquare/i.test(src)),
        loginDetected: /login|entrar|senha|certificado digital|gov\.br|credenciais|usu[aá]rio/i.test(bodyText),
        confirmationDetected: /confirmar|prosseguir|avan[cç]ar|emitir|solicitar|enviar|aceito|declaro/i.test(bodyText),
        bodyText: bodyText.slice(0, 4000),
      };
    }, fields);

    const pageText = fillReport.bodyText || (await page.locator("body").innerText().catch(() => ""));
    keepPageOpen = shouldKeepAssistedOpen();
    const blockedByProtection = Boolean(fillReport.protectionDetected);
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
  const defaults = profile?.defaultValues || {};
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
    voterTitle: fields.voterTitle || "",
    ctpsNumber: fields.ctpsNumber || "",
    ctpsSeries: fields.ctpsSeries || "",
    cep: fields.cep || "",
    city: fields.city || "",
    comarca: fields.comarca || defaults.comarca || "",
    domicile: fields.domicile || defaults.domicile || "",
    address: fields.address || "",
    addressNumber: fields.addressNumber || "",
    addressComplement: fields.addressComplement || "",
    neighborhood: fields.neighborhood || "",
    profession: fields.profession || "",
    nationality: fields.nationality || defaults.nationality || "Brasileira",
    naturality: fields.naturality || fields.city || "",
    civilStatus: fields.civilStatus || defaults.civilStatus || "",
    participation: fields.participation || defaults.participation || "Passiva",
    instance: fields.instance || defaults.instance || "1ª instância",
    certificateKind: fields.certificateKind || defaults.certificateKind || "",
    nature: fields.nature || defaults.nature || certificateType.label || "",
    gender,
    certificateId: certificateType.id,
    certificateLabel: certificateType.label,
    court: profile?.court || "",
    uf: profile?.uf || "",
    fieldAliases: profile?.fieldAliases || {},
    selectAliases: profile?.selectAliases || {},
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

    if (waiting.length && shouldKeepAssistedOpen()) {
      keepBrowserOpen = true;
      sessionId = createAssistedSession({
        browser,
        context,
        courtName: stateCourtName || "TJAP",
        courtUf: "AP",
        portalUrl: stateCourtUrl || profile?.url,
        input,
        profile,
        results,
      });
    }

    if (completed.length && !waiting.length) {
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
          ? "Resolver a validação oficial na janela oficial já preenchida. Depois baixe/anexe o PDF ou protocolo na IA AUDITA."
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

function createAssistedSession({
  browser,
  context,
  courtName,
  courtUf,
  portalUrl,
  input = {},
  profile,
  results,
  owner = null,
  purpose = "state_certificate",
  finalSubmissionHumanOnly = false,
}) {
  const sessionId = cryptoRandomId();
  const session = {
    browser,
    context,
    courtName,
    courtUf,
    portalUrl,
    consultaId: input?.consultaId,
    input,
    profile,
    owner,
    purpose,
    finalSubmissionHumanOnly,
    createdAt: new Date().toISOString(),
    results,
    downloads: [],
  };
  assistedSessions.set(sessionId, session);
  attachAssistedSessionDownloads(session);
  return sessionId;
}

function attachAssistedSessionDownloads(session) {
  const register = (page) => {
    if (!page || assistedDownloadPages.has(page)) return;
    assistedDownloadPages.add(page);
    page.on("download", (download) => recordAssistedSessionDownload(session, download));
  };
  for (const page of session.context?.pages?.() || []) register(page);
  session.context?.on?.("page", register);
}

async function recordAssistedSessionDownload(session, download) {
  try {
    const path = await download.path();
    const buffer = path ? Buffer.from(await readFile(path)) : null;
    if (!buffer?.length) return;
    session.downloads = [
      ...(session.downloads || []),
      {
        buffer,
        fileName: download.suggestedFilename?.() || assistedPdfFileName(session, { href: download.url?.() || "" }),
        downloadUrl: download.url?.() || "",
        capturedAt: new Date().toISOString(),
      },
    ].slice(-5);
  } catch (error) {
    session.lastDownloadError = error instanceof Error ? error.message : "download_capture_failed";
  }
}

function getAssistedSession(sessionId) {
  return assistedSessions.get(String(sessionId || ""));
}

function assistedSessionForbidden(session, auth) {
  if (!session?.owner || !auth) return false;
  const ownerTenant = String(session.owner.tenantId || "");
  const ownerUser = String(session.owner.userId || "");
  const authTenant = String(auth.tenantId || "");
  const authUser = String(auth.userId || auth.user?.id || "");
  if (ownerTenant && ownerTenant !== authTenant) return true;
  if (ownerUser && ownerUser !== authUser) return true;
  return false;
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
    const controls = [...document.querySelectorAll("input, select, textarea, [role='combobox'], [aria-haspopup='listbox'], .MuiSelect-select, .mat-select, mat-select")]
      .filter((element) => visible(element) && String(element.type || "").toLowerCase() !== "hidden")
      .slice(0, 80)
      .map((element) => {
        const tagName = String(element.tagName || "").toLowerCase();
        const type = String(element.type || element.tagName || "").toLowerCase();
        const isCustomSelect = !["input", "select", "textarea"].includes(tagName);
        const rawValue = isCustomSelect
          ? String(element.textContent || element.getAttribute("aria-valuetext") || "").replace(/\s+/g, " ").trim()
          : type === "checkbox" || type === "radio" ? (element.checked ? element.value || "checked" : "") : element.value || "";
        const label =
          element.getAttribute("aria-label") ||
          document.querySelector(`label[for="${CSS.escape(element.id || "")}"]`)?.textContent ||
          element.closest("label")?.textContent ||
          element.getAttribute("formcontrolname") ||
          element.closest("tr, .form-group, .field, .row, div")?.innerText ||
          element.name ||
          element.id ||
          element.placeholder ||
          type;
        const filled = Boolean(rawValue) && !(isCustomSelect && /selecione|tipo pessoa|grau de jurisdi|tipo certid|estado civil|municipio|uf/i.test(rawValue));
        return {
          label: String(label || "").replace(/\s+/g, " ").trim().slice(0, 80),
          type,
          filled,
          valuePreview: maskValue(rawValue),
          options:
            String(element.tagName || "").toLowerCase() === "select"
              ? [...element.options].slice(0, 20).map((option) => String(option.textContent || option.value || "").replace(/\s+/g, " ").trim()).filter(Boolean)
              : [],
        };
      });
    const buttons = [...document.querySelectorAll("button, input[type='button'], input[type='submit'], a[href]")]
      .filter((element) => visible(element) && !element.disabled)
      .slice(0, 60)
      .map((element) => ({
        label: String(element.textContent || element.value || element.getAttribute("aria-label") || element.title || "").replace(/\s+/g, " ").trim().slice(0, 100),
        tag: String(element.tagName || "").toLowerCase(),
        href: element.href || "",
      }))
      .filter((item) => item.label || item.href);
    const nationalityField = document.querySelector("#entity\\.nacionalidade\\.deNacionalidade");
    const nationalityTable = nationalityField?.closest("table.spwInputSelect");
    const nationalityCode =
      nationalityTable?.querySelector('input[name="entity.nacionalidade.cdNacionalidade"], #inputCdNacionalidade')?.value ||
      document.querySelector('input[name="entity.nacionalidade.cdNacionalidade"], #inputCdNacionalidade')?.value ||
      "";
    return {
      filledCount: controls.filter((control) => control.filled).length,
      totalCount: controls.length,
      controls: controls.slice(0, 40),
      fields: controls.filter((control) => control.filled).slice(0, 24),
      actions: buttons.slice(0, 30),
      diagnostics: nationalityField
        ? {
            nationality: {
              code: nationalityCode,
              description: String(nationalityField.value || ""),
              lookupOpen: Boolean(document.querySelector("iframe#layerFormConsulta")),
            },
          }
        : {},
    };
  }).catch(() => ({ filledCount: 0, totalCount: 0, fields: [] }));
}

async function readAssistedSessionFrameFormState(page) {
  const states = [];
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    const state = await frame.evaluate(() => {
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
      const nativeControls = [...document.querySelectorAll("input, select, textarea")]
        .filter((element) => visible(element) && element.type !== "hidden")
        .slice(0, 80)
        .map((element) => {
          const type = String(element.type || element.tagName || "").toLowerCase();
          const rawValue = type === "checkbox" || type === "radio" ? (element.checked ? element.value || "checked" : "") : element.value || "";
          const label =
            element.getAttribute("aria-label") ||
            (element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent : "") ||
            element.closest("label")?.textContent ||
            element.name ||
            element.id ||
            element.placeholder ||
            element.closest("tr, .form-group, .field, .row, div")?.innerText ||
            type;
          return {
            label: String(label || "").replace(/\s+/g, " ").trim().slice(0, 100),
            type,
            filled: Boolean(rawValue),
            valuePreview: maskValue(rawValue),
            options:
              String(element.tagName || "").toLowerCase() === "select"
                ? [...element.options].slice(0, 20).map((option) => String(option.textContent || option.value || "").replace(/\s+/g, " ").trim()).filter(Boolean)
                : [],
          };
        });
      const customControls = [...document.querySelectorAll("[role='combobox'], [aria-haspopup='listbox'], .MuiSelect-select, .mat-select, mat-select")]
        .filter(visible)
        .slice(0, 40)
        .map((element) => {
          const label =
            element.getAttribute("aria-label") ||
            element.getAttribute("aria-labelledby")?.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ") ||
            element.closest("label")?.textContent ||
            element.closest(".form-group, .MuiFormControl-root, mat-form-field, .field, .row, div")?.innerText ||
            element.textContent ||
            "combobox";
          const value = element.textContent || element.getAttribute("aria-valuetext") || "";
          return {
            label: String(label || "").replace(/\s+/g, " ").trim().slice(0, 100),
            type: "combobox",
            filled: Boolean(String(value || "").trim() && !/selecione|tipo pessoa|grau de jurisdi|tipo certid/i.test(String(value || ""))),
            valuePreview: String(value || "").replace(/\s+/g, " ").trim().slice(0, 40),
            options: [],
          };
        });
      const controls = [...nativeControls, ...customControls];
      const actions = [...document.querySelectorAll("button, input[type='button'], input[type='submit'], a[href], [role='button'], [role='option'], li, .MuiMenuItem-root, mat-option")]
        .filter((element) => visible(element) && !element.disabled)
        .slice(0, 60)
        .map((element) => ({
          label: String(element.textContent || element.value || element.getAttribute("aria-label") || element.title || "").replace(/\s+/g, " ").trim().slice(0, 100),
          tag: String(element.tagName || "").toLowerCase(),
          href: element.href || "",
        }))
        .filter((item) => item.label || item.href);
      return {
        frameUrl: location.href,
        frameTitle: document.title || "",
        controls,
        actions,
      };
    }).catch(() => null);
    if (state && (state.controls?.length || state.actions?.length)) {
      states.push(state);
    }
  }
  return states;
}

function mergeAssistedFormStates(mainState, frameStates) {
  const controls = [
    ...frameStates.flatMap((frame) => (frame.controls || []).map((control) => ({ ...control, frameUrl: frame.frameUrl }))),
    ...(Array.isArray(mainState?.controls) ? mainState.controls : []),
  ];
  const actions = [
    ...frameStates.flatMap((frame) => (frame.actions || []).map((action) => ({ ...action, frameUrl: frame.frameUrl }))),
    ...(Array.isArray(mainState?.actions) ? mainState.actions : []),
  ];
  const fields = controls.filter((control) => control.filled).slice(0, 30);
  return {
    ...(mainState || {}),
    filledCount: controls.filter((control) => control.filled).length,
    totalCount: controls.length,
    controls: controls.slice(0, 60),
    fields,
    actions: actions.slice(0, 50),
    frames: frameStates.map((frame) => ({ url: frame.frameUrl, title: frame.frameTitle, controls: frame.controls.length, actions: frame.actions.length })),
  };
}

export async function getAssistedSessionView(sessionId, auth) {
  const session = getAssistedSession(sessionId);
  if (!session) {
    return { notFound: true };
  }
  if (assistedSessionForbidden(session, auth)) {
    return { forbidden: true };
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
      purpose: session.purpose,
      finalSubmissionHumanOnly: session.finalSubmissionHumanOnly,
    };
  }

  const screenshot = await page.screenshot({ type: "jpeg", quality: 78, fullPage: false });
  const viewport = page.viewportSize?.() || { width: 1280, height: 720 };
  const mainFormState = await readAssistedSessionFormState(page);
  const frameFormStates = await readAssistedSessionFrameFormState(page);
  const formState = mergeAssistedFormStates(mainFormState, frameFormStates);
  const snapshot = await page.evaluate(() => {
    const collectPdfEmbeds = (root) => {
      const items = [];
      const visit = (node) => {
        if (!node?.querySelectorAll) return;
        for (const element of node.querySelectorAll("embed, iframe, object")) {
          const href = element.src || element.data || element.getAttribute("src") || element.getAttribute("data") || "";
          const type = element.type || element.getAttribute("type") || "";
          const text = element.title || element.getAttribute("aria-label") || element.getAttribute("name") || "";
          if (/pdf|certid|captcha|recaptcha|hcaptcha|turnstile|cloudflare/i.test(`${href} ${type} ${text}`)) {
            items.push({ href, type, text });
          }
        }
        for (const element of node.querySelectorAll("*")) {
          if (element.shadowRoot) visit(element.shadowRoot);
        }
      };
      visit(root);
      return items;
    };
    return {
      title: document.title || "",
      url: location.href,
      text: (document.body?.innerText || "").slice(0, 12000),
      links: [...document.querySelectorAll("a[href]")]
        .slice(0, 80)
        .map((link) => ({
          text: (link.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160),
          href: link.href,
        })),
      pdfEmbeds: collectPdfEmbeds(document).slice(0, 20),
    };
  }).catch(() => ({
    title: "",
    url: page.url(),
    text: "",
    links: [],
    pdfEmbeds: [],
  }));
  const frameSnapshots = await Promise.all(
    page.frames()
      .filter((frame) => frame !== page.mainFrame())
      .map((frame) =>
        frame.evaluate(() => ({
          title: document.title || "",
          url: location.href,
          text: (document.body?.innerText || "").slice(0, 6000),
          links: [...document.querySelectorAll("a[href]")]
            .slice(0, 60)
            .map((link) => ({
              text: (link.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160),
              href: link.href,
            })),
          pdfEmbeds: [...document.querySelectorAll("embed, iframe, object")]
            .slice(0, 20)
            .map((element) => ({
              href: element.src || element.data || element.getAttribute("src") || element.getAttribute("data") || "",
              type: element.type || element.getAttribute("type") || "",
              text: element.title || element.getAttribute("aria-label") || element.getAttribute("name") || "",
            })),
        })).catch(() => null),
      ),
  );
  for (const frameSnapshot of frameSnapshots.filter(Boolean)) {
    snapshot.text = `${snapshot.text}\n\n[IFRAME ${frameSnapshot.url}]\n${frameSnapshot.text}`.slice(0, 18000);
    snapshot.links = [...(snapshot.links || []), ...(frameSnapshot.links || [])].slice(0, 120);
    snapshot.pdfEmbeds = [...(snapshot.pdfEmbeds || []), ...(frameSnapshot.pdfEmbeds || [])].slice(0, 30);
  }
  const analyzedOutcome = analyzeAssistedSessionSnapshot(snapshot);
  const hasCaptchaAction = /captcha|recaptcha|hcaptcha|turnstile|cloudflare/i.test(JSON.stringify(formState?.actions || []));
  const outcome = hasCaptchaAction ? { ...analyzedOutcome, status: "captcha_pending" } : analyzedOutcome;
  return {
    id: sessionId,
    closed: false,
    courtName: session.courtName,
    courtUf: session.courtUf,
    portalUrl: session.portalUrl,
    consultaId: session.consultaId,
    createdAt: session.createdAt,
    purpose: session.purpose,
    finalSubmissionHumanOnly: session.finalSubmissionHumanOnly,
    title: await page.title().catch(() => ""),
    url: page.url(),
    viewport,
    formState,
    outcome,
    screenshot: `data:image/jpeg;base64,${screenshot.toString("base64")}`,
  };
}

export async function interactAssistedSession(sessionId, action = {}, auth) {
  const session = getAssistedSession(sessionId);
  if (!session) {
    return { notFound: true };
  }
  if (assistedSessionForbidden(session, auth)) {
    return { forbidden: true };
  }
  const page = getAssistedSessionPage(session);
  if (!page) {
    return { closed: true };
  }

  const type = String(action.type || "").trim();
  const isJecSession = session.purpose === "jec_petition";
  const actionLabel = String(action.label || action.text || action.name || "");
  if (isJecSession && type === "submit") {
    return { invalid: true, reason: "final_submission_requires_human" };
  }
  if (
    isJecSession &&
    type === "clickText" &&
    /enviar\s*formul[aá]rio|protocolar|ajuizar|assinar|confirmar\s*envio|finalizar\s*(?:pedido|peti[cç][aã]o|processo)/i.test(
      actionLabel,
    )
  ) {
    return { invalid: true, reason: "final_submission_requires_human" };
  }
  if (
    isJecSession &&
    String(action.actor || "").toLowerCase() === "agent" &&
    ["click", "drag"].includes(type)
  ) {
    return { invalid: true, reason: "agent_coordinate_click_disabled_for_jec" };
  }
  if (type === "click") {
    await page.mouse.click(Number(action.x || 0), Number(action.y || 0));
  } else if (type === "drag") {
    const path = Array.isArray(action.path)
      ? action.path
          .map((point) => ({ x: Number(point?.x), y: Number(point?.y) }))
          .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
          .slice(0, 80)
      : [];
    if (path.length < 2) {
      return { invalid: true, reason: "drag_path_too_short" };
    }
    await page.mouse.move(path[0].x, path[0].y);
    await page.mouse.down();
    for (const point of path.slice(1)) {
      await page.mouse.move(point.x, point.y, { steps: 2 });
    }
    await page.mouse.up();
  } else if (type === "type") {
    const text = String(action.text || "");
    if (text) await typeAssistedSessionText(page, text);
  } else if (type === "press") {
    const key = String(action.key || "");
    if (key) await page.keyboard.press(key);
  } else if (type === "scroll") {
    await page.mouse.wheel(Number(action.deltaX || 0), Number(action.deltaY || 0));
  } else if (type === "clickText") {
    const clicked = await clickAssistedSessionText(page, action.label || action.text || action.name || "");
    if (!clicked) {
      return { invalid: true, reason: "text_target_not_found" };
    }
  } else if (type === "fillField") {
    const filled = await fillAssistedSessionField(page, action.label || action.name || "", action.value || "");
    if (!filled) {
      return { invalid: true, reason: "field_not_found" };
    }
  } else if (type === "selectField") {
    const selected = await selectAssistedSessionField(page, action.label || action.name || "", action.value || action.option || "");
    if (!selected) {
      return { invalid: true, reason: "select_target_not_found" };
    }
  } else if (type === "recover") {
    const navigationTimeout = envNumber("STATE_COURT_NAV_TIMEOUT_MS", 30000);
    await page.goto(session.portalUrl || page.url(), { waitUntil: "domcontentloaded", timeout: navigationTimeout }).catch(async () => {
      await page.reload({ waitUntil: "domcontentloaded", timeout: navigationTimeout }).catch(() => {});
    });
    if (session.input && isTjapAssistedSession(session)) {
      const certificateType = getTjapSessionCertificateType(session);
      await fillTjapPageFields({ page, input: session.input, profile: session.profile, certificateType }).catch(() => null);
    } else if (session.input && isTjpiAssistedSession(session)) {
      const certificateType = getTjpiSessionCertificateType(session);
      await fillTjpiPageFields({ page, input: session.input, profile: session.profile, certificateType }).catch(() => null);
    } else if (session.input && isEsajAssistedSession(session)) {
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

async function clickAssistedSessionText(page, label) {
  const targetLabel = String(label || "").trim();
  if (!targetLabel) return false;
  for (const frame of page.frames()) {
    const clicked = await frame.evaluate((labelText) => {
      const normalize = (value) =>
        String(value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
      const wanted = normalize(labelText);
      const visible = (element) => {
        const style = window.getComputedStyle(element);
        return (
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          !element.disabled &&
          Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
        );
      };
      const candidates = [...document.querySelectorAll("button, input[type='button'], input[type='submit'], a[href], form, [role='button'], [role='option'], li, .MuiMenuItem-root, mat-option, [role='combobox'], [aria-haspopup='listbox'], .MuiSelect-select")].filter(visible);
      const target = candidates.find((element) => {
        const text = normalize(`${element.textContent || ""} ${element.value || ""} ${element.getAttribute("aria-label") || ""} ${element.title || ""}`);
        if (!text) return false;
        return text === wanted || text.includes(wanted) || wanted.includes(text);
      });
      if (!target) return false;
      target.scrollIntoView?.({ block: "center", inline: "center" });
      if (target.tagName === "FORM" && target.querySelector("input[name='TipoModelo']")) {
        if (typeof target.requestSubmit === "function") target.requestSubmit();
        else target.submit();
        return true;
      }
      target.click();
      return true;
    }, targetLabel).catch(() => false);
    if (clicked) return true;
  }
  return false;
}

async function fillAssistedSessionField(page, label, value) {
  const targetLabel = String(label || "").trim();
  let nextValue = String(value || "");
  if (/data|nascimento/i.test(targetLabel)) {
    nextValue = formatBrazilianDate(nextValue);
  }
  if (!targetLabel) return false;
  for (const frame of page.frames().filter((candidate) => candidate !== page.mainFrame())) {
    const frameFilled = await fillAssistedSessionFrameField(frame, targetLabel, nextValue);
    if (frameFilled) return true;
  }
  return page.evaluate(({ labelText, valueText }) => {
    const normalize = (input) =>
      String(input || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    const wanted = normalize(labelText);
    const formControlNameFor = (() => {
      if (!/europa\.tjpi\.jus\.br$/i.test(location.hostname)) return "";
      if (/(^|[^a-z])(nome|razao|requerente|interessado)/i.test(wanted)) return "requerente";
      if (/(cpf|cnpj|documento)/i.test(wanted)) return "cpf";
      if (/(^|[^a-z])(rg|identidade)/i.test(wanted)) return "rg";
      if (/(orgao|expedidor|expeditor|emissor)/i.test(wanted)) return "orgaoExpedidor";
      if (/(pai|genitor)/i.test(wanted)) return "pai";
      if (/(mae|genitora)/i.test(wanted)) return "mae";
      if (/(cep)/i.test(wanted)) return "cep";
      if (/(enderec|logradouro)/i.test(wanted)) return "endereco";
      if (/(^|[^a-z])(n|no|num|numero|nro|nº|n°)([^a-z]|$)/i.test(wanted)) return "numero";
      if (/(complemento)/i.test(wanted)) return "complemento";
      if (/(bairro)/i.test(wanted)) return "bairro";
      return "";
    })();
    const duplicateFormControlNameFor = (() => {
      if (!/europa\.tjpi\.jus\.br$/i.test(location.hostname)) return "";
      if (/(^|[^a-z])(nome|razao|requerente|interessado)/i.test(wanted)) return "requerente";
      if (/(cpf|cnpj|documento)/i.test(wanted)) return "cpf";
      if (/(^|[^a-z])(rg|identidade)/i.test(wanted)) return "rg";
      if (/(orgao|expedidor|expeditor|emissor)/i.test(wanted)) return "orgaoExpedidor";
      if (/(pai|genitor)/i.test(wanted)) return "pai";
      if (/(mae|genitora)/i.test(wanted)) return "mae";
      if (/(cep)/i.test(wanted)) return "cep";
      if (/(enderec|logradouro)/i.test(wanted)) return "endereco";
      if (/(^|[^a-z])(n|no|num|numero|nro|nº|n°)([^a-z]|$)/i.test(wanted)) return "numero";
      if (/(complemento)/i.test(wanted)) return "complemento";
      if (/(bairro)/i.test(wanted)) return "bairro";
      return "";
    })();
    const directSelectorFor = (() => {
      if (!/^www3\.tjrj\.jus\.br$/i.test(location.hostname) || !/\/cje\//i.test(location.pathname)) return "";
      const path = location.pathname.toLowerCase();
      const isRequerente = /cadastrarequerentecapital/.test(path);
      const isRequerido = /cadastrarequerido|validarequerido/.test(path);
      if (isRequerente) {
        if (/(mae|mãe|pai|genitor|nascimento|data)/i.test(wanted)) return "";
        if (/(^|[^a-z])(nome|requerente|solicitante)/i.test(wanted)) return "#nomerequerente";
        if (/(cpf|cnpj|documento)/i.test(wanted)) return "#cpfcnpj2";
        if (/e-?mail|email/i.test(wanted)) return "#email";
        if (/telefone|celular|phone/i.test(wanted)) return "#telefone";
      }
      if (isRequerido) {
        if (/(mae|mãe|genitora)/i.test(wanted)) return "#txtMae";
        if (/(pai|genitor)/i.test(wanted)) return "#txtPai";
        if (/(^|[^a-z])(nome|requerido|pesquisad)/i.test(wanted)) return "#nomerequerido";
        if (/(cpf|cnpj|documento)/i.test(wanted)) return "#cpfcnpj";
        if (/nascimento|data/i.test(wanted)) return "#DN";
        if (/(mae|mãe|genitora)/i.test(wanted)) return "#txtMae";
        if (/(pai|genitor)/i.test(wanted)) return "#txtPai";
      }
      if (/finalidade|complemento/i.test(wanted) && /finalidadepessoa/.test(path)) return "#CompFinalidade";
      return "";
    })();
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      return (
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        !element.disabled &&
        !element.readOnly &&
        Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
      );
    };
    const labelFor = (element) => {
      const explicit = element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent : "";
      return normalize([
        element.getAttribute("aria-label"),
        explicit,
        element.closest("label")?.textContent,
        element.name,
        element.id,
        element.placeholder,
        element.closest("tr, .form-group, .field, .row, div")?.innerText,
      ].filter(Boolean).join(" "));
    };
    const fire = (element) => {
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: valueText.slice(-1) || "" }));
      element.dispatchEvent(new Event("blur", { bubbles: true }));
    };
    const setNativeValue = (element, newValue) => {
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
      if (descriptor?.set) descriptor.set.call(element, newValue);
      else element.value = newValue;
    };
    const valuesEquivalent = (actual, expected) => {
      const actualText = String(actual || "");
      const expectedText = String(expected || "");
      if (actualText === expectedText) return true;
      const actualDigits = actualText.replace(/\D/g, "");
      const expectedDigits = expectedText.replace(/\D/g, "");
      if (expectedDigits && actualDigits === expectedDigits) return true;
      return normalize(actualText) === normalize(expectedText);
    };
    const directLabelFor = (element) =>
      normalize([
        element.getAttribute("aria-label"),
        element.name,
        element.id,
        element.placeholder,
      ].filter(Boolean).join(" "));
    const scoreTarget = (element) => {
      if (formControlNameFor && element.getAttribute("formcontrolname") === formControlNameFor) return 120;
      const direct = directLabelFor(element);
      const label = labelFor(element);
      if (direct === wanted) return 100;
      if (label === wanted) return 90;
      if (direct.includes(wanted) || wanted.includes(direct)) return 70;
      if (label.includes(wanted) || wanted.includes(label)) return 40;
      return 0;
    };
    const controls = [...document.querySelectorAll("input, textarea, select")].filter((element) => visible(element) && element.type !== "hidden");
    const directTarget = directSelectorFor ? document.querySelector(directSelectorFor) : null;
    const matchedTarget = controls
      .map((element) => ({ element, score: scoreTarget(element) }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score)[0]?.element;
    const selectedTarget = directTarget && visible(directTarget) ? directTarget : matchedTarget;
    if (!selectedTarget) return false;
    const target = selectedTarget;
    target.scrollIntoView?.({ block: "center", inline: "center" });
    target.focus();
    const tag = String(target.tagName || "").toLowerCase();
    const type = String(target.type || "").toLowerCase();
    if (tag === "select") {
      const option = [...target.options].find((item) => {
        const optionText = normalize(`${item.textContent || ""} ${item.value || ""}`);
        const valueNormalized = normalize(valueText);
        return optionText === valueNormalized || optionText.includes(valueNormalized) || valueNormalized.includes(optionText);
      });
      if (!option) return false;
      target.value = option.value;
      fire(target);
      return true;
    }
    if (type === "checkbox" || type === "radio") {
      target.checked = !/^(false|0|nao|não|no|off)$/i.test(valueText);
      fire(target);
      return true;
    }
    setNativeValue(target, valueText);
    target.setSelectionRange?.(String(valueText).length, String(valueText).length);
    fire(target);
    return valuesEquivalent(target.value, valueText);
  }, { labelText: targetLabel, valueText: nextValue }).catch(() => false);
}

async function fillAssistedSessionFrameField(frame, label, value) {
  return frame.evaluate(({ labelText, valueText }) => {
    const normalize = (input) =>
      String(input || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    const wanted = normalize(labelText);
    const formControlNameFor = (() => {
      if (!/europa\.tjpi\.jus\.br$/i.test(location.hostname)) return "";
      if (/(^|[^a-z])(nome|razao|requerente|interessado)/i.test(wanted)) return "requerente";
      if (/(cpf|cnpj|documento)/i.test(wanted)) return "cpf";
      if (/(^|[^a-z])(rg|identidade)/i.test(wanted)) return "rg";
      if (/(orgao|expedidor|expeditor|emissor)/i.test(wanted)) return "orgaoExpedidor";
      if (/(pai|genitor)/i.test(wanted)) return "pai";
      if (/(mae|genitora)/i.test(wanted)) return "mae";
      if (/(cep)/i.test(wanted)) return "cep";
      if (/(enderec|logradouro)/i.test(wanted)) return "endereco";
      if (/(^|[^a-z])(n|no|num|numero|nro|nº|n°)([^a-z]|$)/i.test(wanted)) return "numero";
      if (/(complemento)/i.test(wanted)) return "complemento";
      if (/(bairro)/i.test(wanted)) return "bairro";
      return "";
    })();
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      return (
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        !element.disabled &&
        !element.readOnly &&
        Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
      );
    };
    const labelFor = (element) => {
      const explicit = element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent : "";
      return normalize([
        element.getAttribute("aria-label"),
        explicit,
        element.closest("label")?.textContent,
        element.name,
        element.id,
        element.placeholder,
        element.closest("tr, .form-group, .field, .row, div")?.innerText,
      ].filter(Boolean).join(" "));
    };
    const fire = (element) => {
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: String(valueText || "").slice(-1) || "" }));
      element.dispatchEvent(new Event("blur", { bubbles: true }));
    };
    const setNativeValue = (element, newValue) => {
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
      if (descriptor?.set) descriptor.set.call(element, newValue);
      else element.value = newValue;
    };
    const valuesEquivalent = (actual, expected) => {
      const actualText = String(actual || "");
      const expectedText = String(expected || "");
      if (actualText === expectedText) return true;
      const actualDigits = actualText.replace(/\D/g, "");
      const expectedDigits = expectedText.replace(/\D/g, "");
      if (expectedDigits && actualDigits === expectedDigits) return true;
      return normalize(actualText) === normalize(expectedText);
    };
    const directLabelFor = (element) =>
      normalize([
        element.getAttribute("aria-label"),
        element.name,
        element.id,
        element.placeholder,
      ].filter(Boolean).join(" "));
    const scoreTarget = (element) => {
      if (formControlNameFor && element.getAttribute("formcontrolname") === formControlNameFor) return 120;
      const direct = directLabelFor(element);
      const labelValue = labelFor(element);
      if (direct === wanted) return 100;
      if (labelValue === wanted) return 90;
      if (direct.includes(wanted) || wanted.includes(direct)) return 70;
      if (labelValue.includes(wanted) || wanted.includes(labelValue)) return 40;
      return 0;
    };
    const controls = [...document.querySelectorAll("input, textarea, select")].filter((element) => visible(element) && element.type !== "hidden");
    const target = controls
      .map((element) => ({ element, score: scoreTarget(element) }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score)[0]?.element;
    if (!target) return false;
    target.scrollIntoView?.({ block: "center", inline: "center" });
    target.focus();
    const tag = String(target.tagName || "").toLowerCase();
    const type = String(target.type || "").toLowerCase();
    if (tag === "select") {
      const option = [...target.options].find((item) => {
        const optionText = normalize(`${item.textContent || ""} ${item.value || ""}`);
        const valueNormalized = normalize(valueText);
        return optionText === valueNormalized || optionText.includes(valueNormalized) || valueNormalized.includes(optionText);
      });
      if (!option) return false;
      target.value = option.value;
      fire(target);
      return true;
    }
    if (type === "checkbox" || type === "radio") {
      target.checked = !/^(false|0|nao|não|no|off)$/i.test(String(valueText || ""));
      fire(target);
      return true;
    }
    const nextValue = String(valueText || "");
    setNativeValue(target, nextValue);
    target.setSelectionRange?.(nextValue.length, nextValue.length);
    fire(target);
    return valuesEquivalent(target.value, nextValue);
  }, { labelText: label, valueText: value }).catch(() => false);
}

async function selectAssistedSessionField(page, label, option) {
  if (await fillAssistedSessionField(page, label, option)) return true;
  const targetLabel = String(label || "").trim();
  const targetOption = String(option || "").trim();
  if (!targetLabel || !targetOption) return false;
  for (const frame of page.frames().filter((candidate) => candidate !== page.mainFrame())) {
    if (await selectAssistedSessionFrameCustomField(frame, targetLabel, targetOption)) return true;
  }
  return selectAssistedSessionFrameCustomField(page.mainFrame(), targetLabel, targetOption);
}

async function selectAssistedSessionFrameCustomField(frame, label, option) {
  const opened = await frame.evaluate(({ labelText }) => {
    const normalize = (input) =>
      String(input || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    const wanted = normalize(labelText);
    const formControlNameFor = (() => {
      if (/tipo\s+pessoa|pessoa/.test(wanted)) return "tipoParte";
      if (/grau|jurisdicao|jurisdicao/.test(wanted)) return "grauJuridicao";
      if (/tipo\s+certidao|certidao/.test(wanted)) return "tipoCertidao";
      if (/estado\s*civil/.test(wanted)) return "estadoCivil";
      if (/^(uf|estado)$/.test(wanted) || /\buf\b/.test(wanted)) return "ufRequerente";
      if (/municipio|cidade/.test(wanted)) return "municipioRequerente";
      return "";
    })();
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      return (
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        !element.disabled &&
        Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
      );
    };
    const labelFor = (element) =>
      normalize([
        element.getAttribute("aria-label"),
        element.getAttribute("aria-labelledby")?.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" "),
        element.closest("label")?.textContent,
        element.closest(".form-group, .MuiFormControl-root, mat-form-field, .field, .row, div")?.innerText,
        element.textContent,
      ].filter(Boolean).join(" "));
    const candidates = [...document.querySelectorAll("[role='combobox'], [aria-haspopup='listbox'], .MuiSelect-select, .mat-select, mat-select, input[readonly]")]
      .filter(visible);
    const byFormControl = formControlNameFor
      ? candidates.find((element) => element.getAttribute("formcontrolname") === formControlNameFor)
      : null;
    const targetById = byFormControl || null;
    if (targetById) {
      targetById.scrollIntoView?.({ block: "center", inline: "center" });
      targetById.focus?.();
      targetById.click();
      return true;
    }
    const target = candidates.find((element) => {
      const label = labelFor(element);
      return label === wanted || label.includes(wanted) || wanted.includes(label);
    });
    if (!target) return false;
    target.scrollIntoView?.({ block: "center", inline: "center" });
    target.focus?.();
    target.click();
    return true;
  }, { labelText: label }).catch(() => false);
  if (!opened) return false;
  await frame.page().waitForTimeout(envNumber("ASSISTED_SESSION_AFTER_ACTION_DELAY_MS", 350)).catch(() => {});
  return clickAssistedSessionOption(frame.page(), option);
}

async function clickAssistedSessionOption(page, option) {
  const targetOption = String(option || "").trim();
  if (!targetOption) return false;
  const aliases = assistedSessionOptionAliases(targetOption);
  for (const frame of page.frames()) {
    const clicked = await frame.evaluate(({ optionTexts }) => {
      const normalize = (input) =>
        String(input || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
      const wantedValues = optionTexts.map((item) => normalize(item)).filter(Boolean);
      const visible = (element) => {
        const style = window.getComputedStyle(element);
        return (
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          !element.disabled &&
          Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
        );
      };
      const candidates = [...document.querySelectorAll("[role='option'], li, .MuiMenuItem-root, mat-option, [role='menuitem'], button")]
        .filter(visible);
      const target = candidates.find((element) => {
        const text = normalize(`${element.textContent || ""} ${element.getAttribute("aria-label") || ""} ${element.title || ""}`);
        return wantedValues.some((wanted) => text === wanted || text.includes(wanted) || wanted.includes(text));
      });
      if (!target) return false;
      target.scrollIntoView?.({ block: "center", inline: "center" });
      target.click();
      return true;
    }, { optionTexts: aliases }).catch(() => false);
    if (clicked) return true;
  }
  return false;
}

function assistedSessionOptionAliases(option) {
  const value = String(option || "").trim();
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const aliases = new Set([value]);
  if (/fisic|pessoa\s*f/.test(normalized)) {
    aliases.add("PESSOA FISICA");
    aliases.add("PESSOA FÍSICA");
    aliases.add("FISICA");
    aliases.add("FÍSICA");
  }
  if (/juridic|pessoa\s*j/.test(normalized)) {
    aliases.add("PESSOA JURIDICA");
    aliases.add("PESSOA JURÍDICA");
  }
  if (/1|primeiro/.test(normalized) && /grau/.test(normalized)) {
    aliases.add("PRIMEIRO GRAU");
    aliases.add("1 GRAU");
    aliases.add("1º GRAU");
  }
  if (/2|segundo/.test(normalized) && /grau/.test(normalized)) {
    aliases.add("SEGUNDO GRAU");
    aliases.add("2 GRAU");
    aliases.add("2º GRAU");
  }
  if (/civil|civel|civel|distribuicao|negativa/.test(normalized)) {
    aliases.add("Negativa Cível, Execução Cível, Criminal e Auditoria Militar");
    aliases.add("Negativa Cível e Execução Cível");
    aliases.add("NEGATIVA CIVEL");
  }
  if (/criminal/.test(normalized)) {
    aliases.add("Negativa Criminal e Auditoria Militar");
  }
  return [...aliases];
}

async function typeAssistedSessionText(page, text) {
  const value = String(text || "");
  if (!value) {
    return false;
  }

  const injected = await page
    .evaluate((textValue) => {
      const visible = (element) => {
        const style = window.getComputedStyle(element);
        return (
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          !element.disabled &&
          !element.readOnly &&
          Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
        );
      };
      const isEditable = (element) => {
        if (!element) return false;
        const tag = String(element.tagName || "").toLowerCase();
        const type = String(element.type || "").toLowerCase();
        return (
          element.isContentEditable ||
          tag === "textarea" ||
          (tag === "input" && !["button", "checkbox", "file", "hidden", "image", "radio", "reset", "submit"].includes(type))
        );
      };
      const normalizeText = (input) =>
        String(input || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
      const fire = (element) => {
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: textValue.slice(-1) || "" }));
        element.dispatchEvent(new Event("blur", { bubbles: true }));
      };
      const setNativeValue = (element, nextValue) => {
        const prototype = Object.getPrototypeOf(element);
        const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
        if (descriptor?.set) {
          descriptor.set.call(element, nextValue);
        } else {
          element.value = nextValue;
        }
      };
      const appendToElement = (element) => {
        if (!element || !visible(element) || !isEditable(element)) return false;
        element.focus();
        if (element.isContentEditable) {
          document.execCommand?.("insertText", false, textValue);
          element.dispatchEvent(new Event("input", { bubbles: true }));
          return true;
        }
        const current = String(element.value || "");
        const start = Number.isFinite(element.selectionStart) ? element.selectionStart : current.length;
        const end = Number.isFinite(element.selectionEnd) ? element.selectionEnd : current.length;
        const nextValue = `${current.slice(0, start)}${textValue}${current.slice(end)}`;
        setNativeValue(element, nextValue);
        const cursor = start + textValue.length;
        element.setSelectionRange?.(cursor, cursor);
        fire(element);
        return true;
      };

      const active = document.activeElement?.shadowRoot?.activeElement || document.activeElement;
      if (appendToElement(active)) {
        return { ok: true, target: "active" };
      }

      const controls = [...document.querySelectorAll("input, textarea")]
        .filter((element) => visible(element) && isEditable(element));
      const captcha = controls.find((element) => {
        const label = [
          element.getAttribute("formcontrolname"),
          element.getAttribute("name"),
          element.getAttribute("id"),
          element.getAttribute("placeholder"),
          element.getAttribute("aria-label"),
          element.closest("ion-item, label, div, tr, td")?.innerText,
        ]
          .filter(Boolean)
          .join(" ");
        return /captcha|recaptcha|valor da imagem|codigo de seguranca|seguranca|verificacao|verificacao humana/.test(normalizeText(label));
      });
      if (appendToElement(captcha)) {
        return { ok: true, target: "captcha" };
      }

      const emptyTextInput = controls.find((element) => !String(element.value || "").trim());
      if (appendToElement(emptyTextInput)) {
        return { ok: true, target: "empty_input" };
      }
      return { ok: false };
    }, value)
    .catch(() => ({ ok: false }));

  if (injected?.ok) {
    return true;
  }
  await page.keyboard.type(value);
  return true;
}

export async function inspectAssistedSessionResult(sessionId, auth) {
  const session = getAssistedSession(sessionId);
  if (!session) {
    return { notFound: true };
  }
  if (assistedSessionForbidden(session, auth)) {
    return { forbidden: true };
  }
  const page = getAssistedSessionPage(session);
  if (!page) {
    return { closed: true };
  }

  const snapshot = await page.evaluate(() => {
    const collectPdfEmbeds = (root) => {
      const items = [];
      const visit = (node) => {
        if (!node?.querySelectorAll) return;
        for (const element of node.querySelectorAll("embed, iframe, object")) {
          const href = element.src || element.data || element.getAttribute("src") || element.getAttribute("data") || "";
          const type = element.type || element.getAttribute("type") || "";
          const text = element.title || element.getAttribute("aria-label") || element.getAttribute("name") || "";
          if (/pdf|certid/i.test(`${href} ${type} ${text}`)) {
            items.push({ href, type, text });
          }
        }
        for (const element of node.querySelectorAll("*")) {
          if (element.shadowRoot) visit(element.shadowRoot);
        }
      };
      visit(root);
      return items;
    };
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
      pdfEmbeds: collectPdfEmbeds(document).slice(0, 20),
    };
  }).catch(async () => ({
    title: await page.title().catch(() => ""),
    url: page.url(),
    text: "",
    links: [],
    pdfEmbeds: [],
  }));
  const screenshot = await page.screenshot({ type: "jpeg", quality: 78, fullPage: false }).catch(() => null);
  const formState = await readAssistedSessionFormState(page);
  const inspection = analyzeAssistedSessionSnapshot(snapshot);
  const pdfEvidence = await downloadAssistedSessionPdf({ page, session, inspection }).catch((error) => ({
    pdfDownloadError: error.message,
  }));

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
    ...inspection,
    ...pdfEvidence,
  };
}

async function downloadAssistedSessionPdf({ page, session, inspection }) {
  const captured = await persistCapturedAssistedSessionDownload(session);
  if (captured?.pdfDownloaded) return captured;

  const firstPdf = Array.isArray(inspection?.pdfLinks) ? inspection.pdfLinks[0] : null;
  const pdfUrl = firstPdf?.href || "";
  if (!pdfUrl) {
    const generated = await captureAssistedSessionPdfFromPage({ page, session, inspection });
    return generated?.pdfDownloaded ? generated : captured || generated;
  }

  let downloadError = "";
  const response = await page.context().request.get(pdfUrl, {
    timeout: envNumber("ASSISTED_SESSION_PDF_DOWNLOAD_TIMEOUT_MS", 20000),
  }).catch((error) => {
    downloadError = error.message;
    return null;
  });
  if (response?.ok()) {
    const buffer = await response.body();
    if (buffer?.length) {
      const fileName = assistedPdfFileName(session, firstPdf);
      const { pdfPath, rawText } = await saveAndExtractPdfBuffer({
        consultaId: session.consultaId,
        fonte,
        fileName,
        buffer,
      });
      return {
        pdfDownloaded: true,
        pdfFileName: fileName,
        pdfPath,
        pdfContentBase64: buffer.toString("base64"),
        pdfRawText: rawText,
        pdfDownloadUrl: maskSignedUrl(pdfUrl),
      };
    }
    downloadError = "empty_pdf_response";
  } else if (response) {
    downloadError = `HTTP ${response.status()}`;
  }

  const generated = await captureAssistedSessionPdfFromPage({ page, session, inspection });
  return generated?.pdfDownloaded
    ? { ...generated, pdfDownloadUrl: maskSignedUrl(pdfUrl), pdfDownloadFallbackError: downloadError }
    : {
        pdfDownloadUrl: maskSignedUrl(pdfUrl),
        pdfDownloadError: downloadError || "pdf_download_failed",
      };
}

async function persistCapturedAssistedSessionDownload(session) {
  const downloads = Array.isArray(session?.downloads) ? session.downloads : [];
  let lastError = session?.lastDownloadError || "";
  for (const download of downloads.slice().reverse()) {
    if (!download?.buffer?.length) continue;
    const result = await persistAssistedSessionPdf({
      session,
      buffer: download.buffer,
      fileName: download.fileName,
      downloadUrl: download.downloadUrl,
    });
    if (result?.pdfDownloaded) return result;
    lastError = result?.pdfDownloadError || lastError;
  }
  return lastError ? { pdfDownloadError: lastError } : {};
}

async function captureAssistedSessionPdfFromPage({ page, session, inspection }) {
  const printableResult = inspection?.status === "result_available" || shouldPrintAssistedSessionCertificateResult(inspection);
  const pdfControl = await findAssistedSessionPdfControl(page).catch(() => null);

  const fallbackErrors = [];
  const embeddedPdf = await extractEmbeddedAssistedSessionPdf(page, session).catch((error) => ({
    pdfDownloadError: error.message,
  }));
  if (embeddedPdf?.buffer?.length) {
    return persistAssistedSessionPdf({
      session,
      buffer: embeddedPdf.buffer,
      fileName: embeddedPdf.fileName || assistedPdfFileName(session, { href: embeddedPdf.downloadUrl || "" }),
      downloadUrl: embeddedPdf.downloadUrl || page.url(),
    });
  }
  if (embeddedPdf?.pdfDownloadError) {
    fallbackErrors.push(embeddedPdf.pdfDownloadError);
  }

  if (!printableResult && !pdfControl) {
    return {};
  }

  const officialPdf = await clickAssistedSessionPdfControl(page, pdfControl).catch((error) => ({
    pdfDownloadError: error.message,
  }));
  if (officialPdf?.buffer?.length) {
    return persistAssistedSessionPdf({
      session,
      buffer: officialPdf.buffer,
      fileName: officialPdf.fileName || assistedPdfFileName(session, { href: "" }),
      downloadUrl: officialPdf.downloadUrl || "",
    });
  }
  if (officialPdf?.pdfDownloadError) {
    fallbackErrors.push(officialPdf.pdfDownloadError);
  }

  if (session?.courtUf === "PE") {
    return fallbackErrors.length ? { pdfDownloadError: fallbackErrors.join("; ") } : {};
  }

  const printed = await printAssistedSessionResultPage(page).catch(() => null);
  if (printed?.length) {
    return persistAssistedSessionPdf({
      session,
      buffer: printed,
      fileName: assistedPdfFileName(session, { href: "" }),
      downloadUrl: page.url(),
      generatedFromPage: true,
    });
  }
  return fallbackErrors.length ? { pdfDownloadError: fallbackErrors.join("; ") } : {};
}

function shouldPrintAssistedSessionCertificateResult(inspection) {
  const text = String(inspection?.textSample || "");
  const normalizedText = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/codigo\s+de\s+segur|valor\s+da\s+imagem|captcha|recaptcha|hcaptcha/.test(normalizedText)) {
    return false;
  }
  return Boolean(
    inspection?.protocol &&
      /certid|n[aãÃ£]o\s+constar|nada\s+consta|certifico\s+que|tribunal\s+de\s+justi/i.test(text),
  );
}

async function extractEmbeddedAssistedSessionPdf(page, session) {
  const payload = await page.evaluate(async () => {
    const collectCandidates = (root) => {
      const items = [];
      const visit = (node) => {
        if (!node?.querySelectorAll) return;
        for (const element of node.querySelectorAll("embed, iframe, object")) {
          const href = element.src || element.data || element.getAttribute("src") || element.getAttribute("data") || "";
          const type = element.type || element.getAttribute("type") || "";
          const text = element.title || element.getAttribute("aria-label") || element.getAttribute("name") || "";
          if (/pdf|certid/i.test(`${href} ${type} ${text}`)) {
            items.push({ href, type, text });
          }
        }
        for (const element of node.querySelectorAll("*")) {
          if (element.shadowRoot) visit(element.shadowRoot);
        }
      };
      visit(root);
      return items;
    };
    const toBase64 = (blob) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || "").split(",")[1] || "");
        reader.onerror = () => reject(new Error("pdf_blob_read_failed"));
        reader.readAsDataURL(blob);
      });
    const candidates = collectCandidates(document);
    if (/\.pdf(?:\?|#|$)/i.test(location.href) || /^blob:|^data:application\/pdf/i.test(location.href)) {
      candidates.unshift({ href: location.href, type: "application/pdf", text: "PDF atual" });
    }
    for (const candidate of candidates) {
      const href = String(candidate.href || "");
      if (!href) continue;
      if (/^data:application\/pdf[^,]*,/i.test(href)) {
        return {
          contentBase64: href.split(",")[1] || "",
          href,
          type: "application/pdf",
        };
      }
      if (/^data:/i.test(href)) continue;
      try {
        const response = await fetch(href, { credentials: "include" });
        if (!response.ok) continue;
        const contentType = response.headers.get("content-type") || candidate.type || "";
        const blob = await response.blob();
        const contentBase64 = await toBase64(blob);
        if (contentBase64) {
          return {
            contentBase64,
            href,
            type: contentType || blob.type || candidate.type || "",
          };
        }
      } catch {
        // Try the next embedded candidate.
      }
    }
    return null;
  });

  if (!payload?.contentBase64) {
    return {};
  }
  const buffer = Buffer.from(payload.contentBase64, "base64");
  if (!buffer.length || buffer.slice(0, 4).toString("latin1") !== "%PDF") {
    return {};
  }
  return {
    buffer,
    fileName: assistedPdfFileName(session, { href: payload.href || "" }),
    downloadUrl: payload.href || page.url(),
  };
}

async function clickAssistedSessionPdfControl(page, candidate = null) {
  const downloadPromise = page.waitForEvent("download", {
    timeout: envNumber("ASSISTED_SESSION_PDF_DOWNLOAD_TIMEOUT_MS", 12000),
  }).catch(() => null);
  const responsePromise = page.waitForResponse((response) => {
    const contentType = String(response.headers()["content-type"] || "");
    return /application\/pdf/i.test(contentType) || /\.pdf(?:\?|#|$)/i.test(response.url());
  }, {
    timeout: envNumber("ASSISTED_SESSION_PDF_DOWNLOAD_TIMEOUT_MS", 12000),
  }).catch(() => null);
  const newPagePromise = page.context().waitForEvent("page", {
    timeout: envNumber("ASSISTED_SESSION_PDF_DOWNLOAD_TIMEOUT_MS", 12000),
  }).catch(() => null);

  const target = candidate || await findAssistedSessionPdfControl(page);
  if (!target) {
    return {};
  }
  await page.mouse.click(target.x, target.y);

  const download = await downloadPromise;
  if (download) {
    const path = await download.path();
    return {
      buffer: Buffer.from(await readFile(path)),
      fileName: download.suggestedFilename?.() || "",
      downloadUrl: "",
    };
  }

  const pdfResponse = await responsePromise;
  if (pdfResponse?.ok()) {
    return {
      buffer: await pdfResponse.body(),
      fileName: "",
      downloadUrl: pdfResponse.url(),
    };
  }

  const newPage = await newPagePromise;
  if (newPage) {
    await newPage.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => {});
    const newPageUrl = newPage.url();
    if (/\.pdf(?:\?|#|$)/i.test(newPageUrl)) {
      const response = await newPage.context().request.get(newPageUrl, {
        timeout: envNumber("ASSISTED_SESSION_PDF_DOWNLOAD_TIMEOUT_MS", 12000),
      });
      if (response.ok()) {
        const buffer = await response.body();
        await newPage.close().catch(() => {});
        return { buffer, fileName: "", downloadUrl: newPageUrl };
      }
    }
  }

  return {};
}

async function findAssistedSessionPdfControl(page) {
  return page.evaluate(() => {
    const normalize = (value) =>
      String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 10 && rect.height > 10;
    };
    const candidates = [...document.querySelectorAll("a, button, [role='button'], mat-icon, ion-icon, svg")]
      .filter(visible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const text = normalize([
          element.textContent,
          element.getAttribute("aria-label"),
          element.getAttribute("title"),
          element.getAttribute("href"),
          element.getAttribute("class"),
          element.getAttribute("name"),
          element.getAttribute("icon"),
        ].filter(Boolean).join(" "));
        const rightBottomScore = rect.left > window.innerWidth * 0.55 && rect.top > window.innerHeight * 0.45 ? 1 : 0;
        const semanticScore = /pdf|picture_as_pdf|download|baixar|imprimir|print|arquivo/.test(text) ? 4 : 0;
        const fabScore = /mat-fab|fab|floating/.test(text) ? 2 : 0;
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          score: semanticScore + fabScore + rightBottomScore,
        };
      })
      .filter((item) => item.score >= 4)
      .sort((a, b) => b.score - a.score);
    return candidates[0] || null;
  });
}

async function printAssistedSessionResultPage(page) {
  if (typeof page.pdf !== "function") {
    return null;
  }
  return page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
  });
}

async function persistAssistedSessionPdf({ session, buffer, fileName, downloadUrl, generatedFromPage = false }) {
  if (!buffer?.length) {
    return {};
  }
  const rawText = await extractPdfText(buffer);
  if (!isAssistedSessionPdfContentValid({ session, rawText, generatedFromPage })) {
    return { pdfDownloadError: "pdf_content_not_certificate" };
  }
  const safeFileName = String(fileName || assistedPdfFileName(session, { href: "" }))
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-");
  const { pdfPath } = await saveAndExtractPdfBuffer({
    consultaId: session.consultaId,
    fonte,
    fileName: safeFileName,
    buffer,
  });
  return {
    pdfDownloaded: true,
    pdfGeneratedFromPage: Boolean(generatedFromPage),
    pdfFileName: safeFileName,
    pdfPath,
    pdfContentBase64: buffer.toString("base64"),
    pdfRawText: rawText,
    pdfDownloadUrl: downloadUrl ? maskSignedUrl(downloadUrl) : "",
  };
}

export function isAssistedSessionPdfContentValid({ session, rawText, generatedFromPage = false }) {
  const text = String(rawText || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (session?.courtUf !== "PA") return true;
  const paMenu = /solicitar certidao/.test(text) && /acompanhar analise da certidao/.test(text) && /autenticidade/.test(text);
  const resultSignal = /certifico|nada consta|nao constar|nao consta|certidao\s*(?:n|no|numero)|numero\s+da\s+certidao|codigo\s+de\s+validacao|protocolo\s*[:#]?\s*\d|pedido\s*[:#]?\s*\d/.test(text);
  return resultSignal && !(generatedFromPage && paMenu);
}

function assistedPdfFileName(session, link) {
  const fromUrl = (() => {
    try {
      return new URL(link?.href || "").pathname.split("/").pop() || "";
    } catch {
      return "";
    }
  })();
  const baseName = fromUrl && /\.pdf$/i.test(fromUrl)
    ? fromUrl
    : `${session?.courtUf || "tribunal"}-certidao-assistida-${Date.now()}.pdf`;
  return baseName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-");
}

export async function closeAssistedSession(sessionId, auth) {
  const session = getAssistedSession(sessionId);
  if (!session) {
    return { notFound: true };
  }
  if (assistedSessionForbidden(session, auth)) {
    return { forbidden: true };
  }
  assistedSessions.delete(String(sessionId || ""));
  await session.context?.close?.().catch(() => {});
  await session.browser?.close?.().catch(() => {});
  return { id: sessionId, ok: true, closed: true };
}

export async function openAssistedBrowserSession({
  portalUrl,
  courtName,
  courtUf,
  input = {},
  profile = {},
  results = [],
  owner = null,
  purpose = "generic_assisted",
  allowedHosts = [],
  finalSubmissionHumanOnly = false,
} = {}) {
  let parsedUrl;
  try {
    parsedUrl = new URL(String(portalUrl || ""));
  } catch {
    return { invalid: true, reason: "invalid_portal_url" };
  }
  const normalizedHosts = allowedHosts.map((host) => String(host || "").trim().toLowerCase()).filter(Boolean);
  if (
    parsedUrl.protocol !== "https:" ||
    (normalizedHosts.length && !normalizedHosts.includes(parsedUrl.hostname.toLowerCase()))
  ) {
    return { invalid: true, reason: "portal_not_allowed" };
  }

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return { unavailable: true, reason: "playwright_not_installed" };
  }

  const browser = await chromium.launch({
    headless: getAssistedHeadless(profile),
    slowMo: envNumber("ASSISTED_BROWSER_SLOW_MO_MS", 0),
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    ignoreHTTPSErrors: true,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1365, height: 768 },
    userAgent: STANDARD_CHROME_USER_AGENT,
    extraHTTPHeaders: {
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });

  try {
    const page = await context.newPage();
    await page.goto(parsedUrl.href, {
      waitUntil: "domcontentloaded",
      timeout: envNumber("ASSISTED_BROWSER_NAV_TIMEOUT_MS", 45_000),
    });
    const sessionId = createAssistedSession({
      browser,
      context,
      courtName,
      courtUf,
      portalUrl: parsedUrl.href,
      input,
      profile,
      results,
      owner,
      purpose,
      finalSubmissionHumanOnly,
    });
    return {
      sessionId,
      session: await getAssistedSessionView(sessionId),
    };
  } catch (error) {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    return {
      failed: true,
      reason: "portal_navigation_failed",
      message: error instanceof Error ? error.message : "Falha ao abrir o portal.",
    };
  }
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
    headless: getAssistedHeadless(profile),
    slowMo: envNumber("TJAP_SLOW_MO_MS", 0),
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    ignoreHTTPSErrors: true,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1365, height: 768 },
    userAgent: STANDARD_CHROME_USER_AGENT,
    extraHTTPHeaders: {
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });
  let keepBrowserOpen = false;
  let sessionId = "";

  try {
    const results = [];
    for (const certificateType of requestedCertificates) {
      results.push(await fillApTjapCertificate({ context, input, profile, certificateType }));
    }

    const completed = results.filter((result) => result.status === "success");
    const waiting = results.filter((result) => result.status === "waiting_user_action");

    if (waiting.length && shouldKeepAssistedOpen()) {
      keepBrowserOpen = true;
      sessionId = createAssistedSession({
        browser,
        context,
        courtName: stateCourtName || "TJAP",
        courtUf: "AP",
        portalUrl: stateCourtUrl || profile?.url,
        input,
        profile,
        results,
      });
    }

    if (completed.length && !waiting.length) {
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
        tribunal: stateCourtName || "TJAP",
        uf: "AP",
        certidoes: results,
        sessionOpen: false,
        captchaLab: buildCaptchaLabReport({
          profile,
          results,
          sessionOpen: false,
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
        blocker: "cloudflare",
        tribunal: stateCourtName || "TJAP",
        uf: "AP",
        validationFrameUrl: stateCourtUrl || profile?.url,
        assistedPortalUrl: stateCourtUrl || profile?.url,
        assistedSession: sessionId || "external_browser",
        sessionOpen: keepBrowserOpen,
        certidoes: results,
        captchaLab: buildCaptchaLabReport({
          profile,
          results,
          sessionOpen: keepBrowserOpen,
          sessionId,
        }),
        proximoPasso: "Resolver a verificação Cloudflare/Turnstile na janela aberta e enviar a requisição no portal oficial.",
      },
    );
  } finally {
    if (!keepBrowserOpen) {
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
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    userAgent: STANDARD_CHROME_USER_AGENT,
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
    const completedWithEvidence = results.filter(hasStateCourtResultEvidence);
    if (completed.length && !waiting.length && completedWithEvidence.length === results.length) {
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
          ? "Resolver a validação/confirmar a emissão na janela oficial já preenchida. Depois baixe/anexe o PDF ou protocolo na IA AUDITA."
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

function hasStateCourtResultEvidence(result) {
  if (!result || result.status !== "success") {
    return false;
  }
  if (result.pdfPath || result.protocolo || result.protocol || result.numeroPedido || result.pedido) {
    return true;
  }
  const text = `${result.rawText || ""}\n${result.pageText || ""}`;
  return result.resultado !== SOURCE_RESULT.INDISPONIVEL && hasCertificateResultSignal(text);
}

function isExpectedStateCourtCertificateText(text, { documentValue = "", fields = {} } = {}) {
  const safeText = String(text || "");
  const normalizedText = normalize(safeText);
  const documentDigits = String(documentValue || "").replace(/\D/g, "");
  const textDigits = safeText.replace(/\D/g, "");
  const fullName = normalize(fields.fullName || fields.companyName || "");
  const hasSubject =
    (documentDigits.length >= 11 && textDigits.includes(documentDigits)) ||
    (fullName.length >= 8 && normalizedText.includes(fullName));
  return hasSubject && hasCertificateResultSignal(safeText);
}

async function collectBaTjbaStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData }) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return unavailableResult(fonte, "Instale a dependência Playwright para executar o adapter TJBA.", {
      ...baseData,
      install: "npm install && npx playwright install chromium",
    });
  }

  const browser = await chromium.launch({ headless: getAssistedHeadless(profile) });
  const context = await browser.newContext({
    acceptDownloads: true,
    userAgent: "Audita/0.1 TJBA certificate collector",
  });
  let keepBrowserOpen = false;
  let sessionId = "";

  try {
    const results = [];
    for (const certificateType of requestedCertificates) {
      results.push(await fillBaTjbaCertificate({ context, input, profile, certificateType, keepPageOpen: shouldKeepAssistedOpen() }));
    }

    const completed = results.filter((result) => result.status === "success");
    if (completed.length === results.length) {
      const encontrados = results.filter((result) => result.resultado === SOURCE_RESULT.CONSTA);
      const resultadoGeral = encontrados.length ? SOURCE_RESULT.CONSTA : SOURCE_RESULT.NADA_CONSTA;
      return successResult(fonte, resultadoGeral, {
        ...baseData,
        modo: "automatico",
        tribunal: stateCourtName || "TJBA",
        uf: "BA",
        certidoes: results,
        totalCertidoes: results.length,
        certidoesBaixadas: 0,
        resumo: "TJBA consultado automaticamente pelo Portal de Certidões.",
      }, {
        rawText: results.map((result) => result.rawText || result.pageText || "").filter(Boolean).join("\n\n---\n\n"),
      });
    }

    if (shouldKeepAssistedOpen()) {
      keepBrowserOpen = true;
      sessionId = createAssistedSession({
        browser,
        context,
        courtName: stateCourtName || "TJBA",
        courtUf: "BA",
        portalUrl: stateCourtUrl || profile?.url || "https://portalcertidoes.tjba.jus.br/#/primeirograu",
        input,
        profile,
        results,
      });
    }

    return waitingUserActionResult(
      fonte,
      "TJBA foi preenchido automaticamente até a validação oficial. O portal possui reCAPTCHA, então exige ação do usuário.",
      {
        ...baseData,
        modo: "automatico_com_validacao",
        tribunal: stateCourtName || "TJBA",
        uf: "BA",
        validationFrameUrl: stateCourtUrl || profile?.url || "https://portalcertidoes.tjba.jus.br/#/primeirograu",
        assistedPortalUrl: stateCourtUrl || profile?.url || "https://portalcertidoes.tjba.jus.br/#/primeirograu",
        assistedSession: sessionId || "external_browser",
        sessionOpen: keepBrowserOpen,
        certidoes: results,
        totalCertidoes: results.length,
        captchaLab: buildCaptchaLabReport({ profile, results, sessionOpen: keepBrowserOpen, sessionId }),
        proximoPasso: "Resolver a validação oficial no portal do TJBA para continuar a emissão.",
      },
    );
  } finally {
    if (!keepBrowserOpen) {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  }
}

async function collectPeTjpeStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData }) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return unavailableResult(fonte, "Instale a dependência Playwright para executar o adapter TJPE.", {
      ...baseData,
      install: "npm install && npx playwright install chromium",
    });
  }

  const browser = await chromium.launch({ headless: getAssistedHeadless(profile) });
  const context = await browser.newContext({
    acceptDownloads: true,
    userAgent: STANDARD_CHROME_USER_AGENT,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1365, height: 900 },
  });
  let keepBrowserOpen = false;
  let sessionId = "";

  try {
    const results = [];
    for (const certificateType of requestedCertificates) {
      results.push(await fillPeTjpeCertificate({ context, input, profile, certificateType, keepPageOpen: shouldKeepAssistedOpen() }));
    }

    const waiting = results.filter((result) => result.status === "waiting_user_action");
    const failed = results.filter((result) => result.status === "failed");
    if (failed.length && !waiting.length) {
      return failedResult(fonte, failed[0].errorMessage || "TJPE retornou erro antes do CAPTCHA.", {
        ...baseData,
        modo: "automatico_com_validacao",
        tribunal: stateCourtName || "TJPE",
        uf: "PE",
        certidoes: results,
        totalCertidoes: results.length,
        resumo: failed[0].resumo || "Portal TJPE indisponível ou com erro oficial.",
      });
    }

    if (waiting.length && shouldKeepAssistedOpen()) {
      keepBrowserOpen = true;
      sessionId = createAssistedSession({
        browser,
        context,
        courtName: stateCourtName || "TJPE",
        courtUf: "PE",
        portalUrl: peTjpeCertificateUrl(profile, waiting.at(-1)?.certificateId || requestedCertificates.at(-1)?.id),
        input,
        profile,
        results,
      });
    }

    return waitingUserActionResult(
      fonte,
      "TJPE foi preenchido automaticamente até o Código de Segurança. Digite o código exibido no portal e acione Emitir.",
      {
        ...baseData,
        modo: "automatico_com_validacao",
        tribunal: stateCourtName || "TJPE",
        uf: "PE",
        validationFrameUrl: stateCourtUrl || profile?.url,
        assistedPortalUrl: stateCourtUrl || profile?.url,
        assistedSession: sessionId || "external_browser",
        sessionOpen: keepBrowserOpen,
        certidoes: results,
        totalCertidoes: results.length,
        camposPreenchidos: results.reduce((sum, result) => sum + (Array.isArray(result.filledFields) ? result.filledFields.length : 0), 0),
        captchaLab: buildCaptchaLabReport({ profile, results, sessionOpen: keepBrowserOpen, sessionId }),
        proximoPasso: keepBrowserOpen
          ? "Preencher o Código de Segurança no navegador assistido e acionar Emitir. Depois use Inspecionar resultado."
          : "Preencher o Código de Segurança no portal oficial e concluir a emissão.",
      },
    );
  } finally {
    if (!keepBrowserOpen) {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  }
}

async function collectCeTjceStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData }) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return unavailableResult(fonte, "Instale a dependência Playwright para executar o adapter TJCE.", {
      ...baseData,
      install: "npm install && npx playwright install chromium",
    });
  }

  const browser = await chromium.launch({ headless: getAssistedHeadless(profile) });
  const context = await browser.newContext({
    acceptDownloads: true,
    userAgent: STANDARD_CHROME_USER_AGENT,
  });
  let keepBrowserOpen = false;
  let sessionId = "";

  try {
    const results = [];
    for (const certificateType of requestedCertificates) {
      results.push(await fillCeTjceCertificate({ context, input, profile, certificateType, keepPageOpen: shouldKeepAssistedOpen() }));
    }

    const waiting = results.filter((result) => result.status === "waiting_user_action");
    const failed = results.filter((result) => result.status === "failed");

    if (failed.length && !waiting.length) {
      return failedResult(fonte, failed[0].errorMessage || "TJCE/SIRECE retornou erro oficial antes da validação.", {
        ...baseData,
        modo: "automatico_com_validacao",
        tribunal: stateCourtName || "TJCE",
        uf: "CE",
        certidoes: results,
        totalCertidoes: results.length,
        resumo: failed[0].resumo || "Portal TJCE/SIRECE indisponível ou com erro oficial.",
        proximoPasso: "Retestar mais tarde; não há CAPTCHA para resolver enquanto o portal retorna erro oficial.",
      });
    }

    if (waiting.length && shouldKeepAssistedOpen()) {
      keepBrowserOpen = true;
      sessionId = createAssistedSession({
        browser,
        context,
        courtName: stateCourtName || "TJCE",
        courtUf: "CE",
        portalUrl: stateCourtUrl || profile?.url,
        input,
        profile,
        results,
      });
    }

    return waitingUserActionResult(
      fonte,
      "TJCE/SIRECE foi preenchido automaticamente até o reCAPTCHA oficial. Resolva a validação no portal para prosseguir.",
      {
        ...baseData,
        modo: "automatico_com_validacao",
        tribunal: stateCourtName || "TJCE",
        uf: "CE",
        validationFrameUrl: stateCourtUrl || profile?.url,
        assistedPortalUrl: stateCourtUrl || profile?.url,
        assistedSession: sessionId || "external_browser",
        sessionOpen: keepBrowserOpen,
        certidoes: results,
        totalCertidoes: results.length,
        camposPreenchidos: results.reduce((sum, result) => sum + (Array.isArray(result.filledFields) ? result.filledFields.length : 0), 0),
        captchaLab: buildCaptchaLabReport({ profile, results, sessionOpen: keepBrowserOpen, sessionId }),
        proximoPasso: keepBrowserOpen
          ? "Resolver o reCAPTCHA no navegador assistido e acionar Confirmar no portal. Depois use Inspecionar resultado."
          : "Resolver o reCAPTCHA no portal oficial e concluir a emissão.",
      },
    );
  } finally {
    if (!keepBrowserOpen) {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
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
      results.push(await fillSeTjseCertificate({ context, input, profile, certificateType, keepPageOpen: shouldKeepAssistedOpen() }));
    }

    const completed = results.filter((result) => result.status === "success");
    if (completed.length) {
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

async function fillSeTjseCertificate({ context, input, profile, certificateType, keepPageOpen = false }) {
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
    await chooseTjsePersonType(page, input.tipoDocumento === "cnpj");
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
    if (!fields.mobile && fields.phone) {
      await safeFill(page, "input[formcontrolname='celular']", fields.phone);
    }

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

    const existingCertificateMatch = pageText.match(/certid(?:ao|ão)\s+gerada[\s\S]{0,300}?\b(\d{6,})\b/i);
    if (existingCertificateMatch) {
      const existingDownloadPromise = page.waitForEvent("download", { timeout: envNumber("STATE_COURT_DOWNLOAD_TIMEOUT_MS", 30000) }).catch(() => null);
      await page.getByText(existingCertificateMatch[1], { exact: true }).click({ timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 8000) }).catch(() => {});
      const existingDownload = await existingDownloadPromise;
      if (existingDownload) {
        const downloadPath = await existingDownload.path();
        const buffer = Buffer.from(await readFile(downloadPath));
        const { pdfPath, rawText } = await saveAndExtractPdfBuffer({
          consultaId: input.consultaId,
          fonte,
          fileName: `tjse-${certificateType.id}-${existingCertificateMatch[1]}.pdf`,
          buffer,
        });
        return {
          tipo: certificateType.label,
          status: "success",
          resultado: classifyCertificateText(rawText || pageText),
          pdfPath,
          rawText,
          pageText,
          protocolo: existingCertificateMatch[1],
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
    page.off?.("requestfailed", handleEmitRequestFailed);
    if (!keepPageOpen) {
      await page.close().catch(() => {});
    }
  }
}

async function fillPeTjpeCertificate({ context, input, profile, certificateType, keepPageOpen = false }) {
  const page = await context.newPage();
  try {
    page.setDefaultTimeout(envNumber("STATE_COURT_STEP_TIMEOUT_MS", input.timeoutMs || 30000));
    const fields = input.extraFields?.stateCourtFields || {};
    const documentValue = String(input.extraFields?.cpfDocument || input.documento || "").replace(/\D/g, "");
    const portalUrl = peTjpeCertificateUrl(profile, certificateType.id);
    const response = await page.goto(portalUrl, {
      waitUntil: "networkidle",
      timeout: envNumber("STATE_COURT_NAV_TIMEOUT_MS", 45000),
    });
    await page.waitForTimeout(1200);
    const initialText = await page.locator("body").innerText().catch(() => "");
    if ((response?.status && response.status() >= 500) || /service unavailable|erro|indispon[ií]vel/i.test(initialText)) {
      return {
        certificateId: certificateType.id,
        tipo: certificateType.label,
        status: "failed",
        resultado: SOURCE_RESULT.ERRO,
        pageText: initialText,
        errorMessage: "TJPE retornou erro ou indisponibilidade antes do Código de Segurança.",
        resumo: "Portal TJPE indisponível ou com erro oficial.",
      };
    }

    await page.locator("#field_nomeCompleto").waitFor({ state: "visible", timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 12000) });
    await fillPeTjpeInput(page, "#field_nomeCompleto", fields.fullName || fields.companyName);
    await fillPeTjpeTextInputAt(page, 1, formatDocument(documentValue));
    await fillPeTjpeTextInputAt(page, 2, formatBrazilianDate(fields.birthDate));
    await fillPeTjpeInput(page, "#field_nomeMae", fields.motherName);
    await fillPeTjpeInput(page, "#field_nomePai", fields.fatherName);

    const pageText = await page.locator("body").innerText().catch(() => "");
    return {
      certificateId: certificateType.id,
      tipo: certificateType.label,
      status: "waiting_user_action",
      resultado: SOURCE_RESULT.INDISPONIVEL,
      pageText,
      filledFields: ["fullName", "document", "birthDate", "motherName", fields.fatherName ? "fatherName" : ""].filter(Boolean),
      requiresCaptcha: true,
      errorMessage: "TJPE exige Código de Segurança antes de emitir.",
      resumo: "Campos preenchidos; Código de Segurança oficial pendente.",
    };
  } catch (error) {
    return {
      certificateId: certificateType.id,
      tipo: certificateType.label,
      status: "failed",
      resultado: SOURCE_RESULT.ERRO,
      errorMessage: String(error?.message || error),
    };
  } finally {
    if (!keepPageOpen) {
      await page.close().catch(() => {});
    }
  }
}

async function fillCeTjceCertificate({ context, input, profile, certificateType, keepPageOpen = false }) {
  const page = await context.newPage();
  try {
    page.setDefaultTimeout(envNumber("STATE_COURT_STEP_TIMEOUT_MS", input.timeoutMs || 30000));
    const fields = input.extraFields?.stateCourtFields || {};
    const documentValue = String(input.extraFields?.cpfDocument || input.extraFields?.cnpjDocument || input.documento || "").replace(/\D/g, "");
    const response = await page.goto(profile?.url || "https://sirece.tjce.jus.br/sirece-web/nova/solicitacao.jsf?certidao=pf1cijudicial", {
      waitUntil: "domcontentloaded",
      timeout: envNumber("STATE_COURT_NAV_TIMEOUT_MS", 30000),
    });
    await page.waitForTimeout(2500);
    const initialText = await page.locator("body").innerText().catch(() => "");
    if ((response?.status && response.status() >= 500) || /service unavailable|http\/1\.1\s+service unavailable|servidor n[aã]o dispon[ií]vel/i.test(initialText)) {
      return {
        tipo: certificateType.label,
        status: "failed",
        resultado: SOURCE_RESULT.ERRO,
        pageText: initialText,
        errorMessage: "TJCE/SIRECE retornou HTTP 503 Service Unavailable antes da validação.",
        resumo: "Portal TJCE/SIRECE indisponível no momento; retestar mais tarde.",
      };
    }

    const natureValue = ceNatureValue(certificateType.id);
    await selectCeNativeOption(page, "#form-nova-solicitacao\\:insercaoNatureza_input", natureValue);
    await selectCeNativeOption(page, "#form-nova-solicitacao\\:insercaoTipoCertidao_input", ceJudicialCertificateValue(natureValue));
    await confirmCeTjceWarningDialog(page);
    await page.locator("#form-nova-solicitacao\\:insercaoNomePessoaFisica").waitFor({ state: "visible", timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 10000) }).catch(() => {});
    await selectCeNativeOption(page, "#form-nova-solicitacao\\:insercaoTipoDocumentoPessoaFisica_input", "CPF");

    await safeFillVisible(page, "#form-nova-solicitacao\\:insercaoNomePessoaFisica", fields.fullName || fields.companyName);
    await safeFillVisible(page, "#form-nova-solicitacao\\:insercaoNomeMaePessoaFisica", fields.motherName);
    await safeFillVisible(page, "#form-nova-solicitacao\\:insercaoNomePaiPessoaFisica", fields.fatherName);
    await safeFillVisible(page, "#form-nova-solicitacao\\:insercaoDataNascimento_input", formatBrazilianDate(fields.birthDate));
    await safeFillVisible(page, "#form-nova-solicitacao\\:insercaoNumeroDocumentoPessoaFisica", formatDocument(documentValue));
    await safeFillVisible(page, "#form-nova-solicitacao\\:insercaoTelefoneResidencialPessoaFisica", formatBrazilianPhone(fields.phone));
    await safeFillVisible(page, "#form-nova-solicitacao\\:insercaoTelefoneCelularPessoaFisica", formatBrazilianMobile(fields.mobile || fields.phone));
    await safeFillVisible(page, "#form-nova-solicitacao\\:insercaoEmailPessoaFisica", fields.email);
    await safeFillVisible(page, "#form-nova-solicitacao\\:insercaoConfirmacaoEmailPessoaFisica", fields.email);
    await confirmCeTjceWarningDialog(page);

    const pageText = await page.locator("body").innerText().catch(() => "");
    return {
      tipo: certificateType.label,
      status: "waiting_user_action",
      resultado: SOURCE_RESULT.INDISPONIVEL,
      pageText,
      filledFields: [
        "personType",
        "instance",
        "nature",
        "certificateKind",
        "fullName",
        "motherName",
        "fatherName",
        "birthDate",
        "document",
        fields.phone ? "phone" : "",
        fields.mobile || fields.phone ? "mobile" : "",
        "email",
        "emailConfirmation",
      ].filter(Boolean),
      requiresRecaptcha: /recaptcha|captcha|i'm not a robot|não sou um robô|nao sou um robo/i.test(pageText) || true,
      errorMessage: "TJCE possui reCAPTCHA oficial antes da confirmação da solicitação.",
      resumo: "Certidão Judicial selecionada; campos preenchidos; reCAPTCHA oficial pendente.",
    };
  } catch (error) {
    const message = String(error?.message || "");
    if (/ERR_EMPTY_RESPONSE|Service Unavailable|HTTP 503|net::ERR|Navigation timeout|Timeout/i.test(message)) {
      return {
        tipo: certificateType.label,
        status: "failed",
        resultado: SOURCE_RESULT.ERRO,
        errorMessage: "TJCE/SIRECE não entregou uma página válida para abrir no navegador assistido.",
        resumo: "Portal TJCE/SIRECE indisponível ou instável antes do CAPTCHA; retestar mais tarde.",
      };
    }
    return {
      tipo: certificateType.label,
      status: "failed",
      resultado: SOURCE_RESULT.ERRO,
      errorMessage: message,
    };
  } finally {
    if (!keepPageOpen) {
      await page.close().catch(() => {});
    }
  }
}

async function fillBaTjbaCertificate({ context, input, profile, certificateType, keepPageOpen = false }) {
  const page = await context.newPage();
  try {
    page.setDefaultTimeout(envNumber("STATE_COURT_STEP_TIMEOUT_MS", input.timeoutMs || 30000));
    const fields = input.extraFields?.stateCourtFields || {};
    await page.goto(profile?.url || "https://portalcertidoes.tjba.jus.br/#/primeirograu", {
      waitUntil: "domcontentloaded",
      timeout: envNumber("STATE_COURT_NAV_TIMEOUT_MS", 30000),
    });
    await page.waitForTimeout(2500);
    await page.locator(input.tipoDocumento === "cnpj" ? "#radioJuridica" : "#radioFisica").check({ force: true }).catch(() => {});
    await page.locator("#selectModelo").selectOption(baModelValue(certificateType.id));
    await page.locator(baParticipationSelector(fields.participation)).check({ force: true }).catch(() => {});
    await clickBaTjbaGenerateAdvance(page);
    await page.waitForTimeout(1800);

    const documentValue = String(input.extraFields?.cpfDocument || input.extraFields?.cnpjDocument || input.documento || "").replace(/\D/g, "");
    await fillByLabelLike(page, /nome completo|nome/i, fields.fullName || fields.companyName);
    await fillByLabelLike(page, /cpf|cnpj/i, formatDocument(documentValue));
    await fillByLabelLike(page, /\brg\b/i, fields.rg);
    await fillByLabelLike(page, /orgao expedidor|órgao expedidor|expedidor/i, fields.issuingAuthority || fields.rgIssuer || fields.rgOrgao || "SSP");
    await fillByLabelLike(page, /endereco completo|endere[cç]o/i, buildBaAddress(fields));
    await fillByLabelLike(page, /nome da mae|m[aã]e/i, fields.motherName);
    await fillByLabelLike(page, /nome do pai|pai/i, fields.fatherName);
    await selectByLabelLike(page, /estado civil/i, fields.civilStatus || "Solteiro");
    const nationalitySelected = await selectByLabelLike(page, /nacionalidade/i, fields.nationality || "Brasileiro");
    if (!nationalitySelected) {
      await fillByLabelLike(page, /nacionalidade/i, fields.nationality || "Brasileiro");
    }
    await clickBaTjbaVisibleAdvance(page);
    await page
      .waitForFunction(
        () => /certid[aã]o\s*n[ºo.:]|n[aã]o\s+constar|captcha|recaptcha|campos obrigat[oó]rios/i.test(document.body?.innerText || ""),
        null,
        { timeout: envNumber("STATE_COURT_STEP_TIMEOUT_MS", 12000) },
      )
      .catch(() => {});
    await page.waitForTimeout(1200);

    const pageText = await page.locator("body").innerText().catch(() => "");
    const filledFields = [
      "personType",
      "certificateType",
      "participation",
      "fullName",
      "nationality",
      "civilStatus",
      "document",
      "rg",
      "issuingAuthority",
      "address",
      "motherName",
      fields.fatherName ? "fatherName" : "",
    ].filter(Boolean);
    const protocol = pageText.match(/certid[aã]o\s*n[ºo.:]*\s*([A-Z0-9.-]+)/i)?.[1] || "";
    if (/certid[aã]o\s*n[ºo.:]|n[aã]o\s+constar|nada\s+consta|constam?/i.test(pageText)) {
      return {
        tipo: certificateType.label,
        status: "success",
        resultado: classifyCertificateText(pageText),
        protocolo: protocol,
        rawText: pageText,
        pageText,
        filledFields,
        resumo: summarizeCertificateText(pageText),
      };
    }
    return {
      tipo: certificateType.label,
      status: "waiting_user_action",
      resultado: SOURCE_RESULT.INDISPONIVEL,
      pageText,
      filledFields,
      requiresRecaptcha: true,
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
    if (!keepPageOpen) {
      await page.close().catch(() => {});
    }
  }
}

async function collectToTjtoStateCourt({ input, profile, stateCourtName, stateCourtUrl, requestedCertificates, baseData }) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return unavailableResult(fonte, "Instale a dependencia Playwright para executar o adapter TJTO/eproc.", {
      ...baseData,
      install: "npm install && npx playwright install chromium",
    });
  }

  const browser = await chromium.launch({ headless: process.env.STATE_COURT_HEADLESS !== "false" });
  const context = await browser.newContext({
    acceptDownloads: true,
    ignoreHTTPSErrors: true,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    userAgent: STANDARD_CHROME_USER_AGENT,
  });

  try {
    const results = [];
    for (const certificateType of requestedCertificates) {
      results.push(await fillToTjtoCertificate({ context, input, profile, certificateType }));
    }
    const completed = results.filter((result) => result.status === "success");
    if (!completed.length) {
      return failedResult(fonte, results[0]?.errorMessage || "TJTO nao retornou PDF nem resultado conclusivo.", {
        ...baseData,
        modo: "automatico",
        tribunal: stateCourtName || "TJTO",
        uf: "TO",
        certidoes: results,
        totalCertidoes: results.length,
        certidoesBaixadas: 0,
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
      captchaMode: "none",
      tribunal: stateCourtName || "TJTO",
      uf: "TO",
      certidoes: results,
      totalCertidoes: results.length,
      certidoesBaixadas: results.filter((result) => result.pdfPath).length,
      resumo: "TJTO consultado automaticamente pelo eproc e PDF capturado.",
    }, {
      rawText: results.map((result) => result.rawText || result.pageText || "").filter(Boolean).join("\n\n---\n\n"),
      pdfPath: results.find((result) => result.pdfPath)?.pdfPath || "",
    });
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function fillToTjtoCertificate({ context, input, profile, certificateType }) {
  const page = await context.newPage();
  try {
    page.setDefaultTimeout(envNumber("STATE_COURT_STEP_TIMEOUT_MS", input.timeoutMs || 30000));
    const fields = input.extraFields?.stateCourtFields || {};
    const documentValue = String(input.extraFields?.cpfDocument || input.extraFields?.cnpjDocument || input.documento || "").replace(/\D/g, "");
    const portalUrl = profile?.url || "https://eproc1.tjto.jus.br/eprocV2_prod_1grau/externo_controlador.php?acao=cj_online&acao_origem=&acao_retorno=cj";

    await page.goto(portalUrl, { waitUntil: "domcontentloaded", timeout: envNumber("STATE_COURT_NAV_TIMEOUT_MS", 30000) });
    await page.waitForSelector("#txtCpfCnpj", { timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 10000) });

    await fillTjtoField(page, "#txtCpfCnpj", documentValue);
    await checkTjtoCompetence(page, certificateType.id);
    let download = await clickTjtoSubmitAndWaitDownload(page, 8000);
    if (!download && (await page.locator("#txtStrParte").count().catch(() => 0))) {
      await fillTjtoField(page, "#txtCpfCnpj", documentValue);
      await checkTjtoCompetence(page, certificateType.id);
      await fillTjtoField(page, "#txtStrParte", fields.fullName || fields.companyName || input.extraFields?.fullName || "");
      download = await clickTjtoSubmitAndWaitDownload(page, envNumber("STATE_COURT_DOWNLOAD_TIMEOUT_MS", 25000));
    }

    const pageText = await page.locator("body").innerText().catch(() => "");
    if (download) {
      const downloadPath = await download.path();
      const buffer = Buffer.from(await readFile(downloadPath));
      const { pdfPath, rawText } = await saveAndExtractPdfBuffer({
        consultaId: input.consultaId,
        fonte,
        fileName: `tjto-${certificateType.id}.pdf`,
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
      const pdfResponse = await context.request.get(pdfLink).catch(() => null);
      if (pdfResponse?.ok()) {
        const headers = pdfResponse.headers();
        const buffer = Buffer.from(await pdfResponse.body());
        const looksLikePdf = /pdf/i.test(headers["content-type"] || "") || buffer.subarray(0, 4).toString("utf8") === "%PDF";
        if (looksLikePdf) {
          const { pdfPath, rawText } = await saveAndExtractPdfBuffer({
            consultaId: input.consultaId,
            fonte,
            fileName: `tjto-${certificateType.id}.pdf`,
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
      return {
        tipo: certificateType.label,
        status: "failed",
        resultado: SOURCE_RESULT.ERRO,
        downloadUrl: maskSignedUrl(pdfLink),
        pageText,
        errorMessage: "TJTO retornou link de certidao, mas o PDF nao foi baixado automaticamente.",
        resumo: "TJTO retornou link de certidao no eproc.",
      };
    }

    return {
      tipo: certificateType.label,
      status: "failed",
      resultado: SOURCE_RESULT.ERRO,
      pageText,
      errorMessage: /forbidden|403|access denied/i.test(pageText)
        ? "TJTO/eproc recusou acesso ao formulario oficial."
        : "TJTO/eproc nao retornou PDF apos a emissao.",
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

async function fillTjtoField(page, selector, value) {
  const text = String(value || "").trim();
  if (!text) return false;
  return page.locator(selector).first().evaluate((element, nextValue) => {
    element.value = nextValue;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
    return true;
  }, text).catch(() => false);
}

async function checkTjtoCompetence(page, certificateId) {
  const selector = certificateId === "criminal" ? "#competenciaCriminal" : "#competenciaCivel";
  return page.locator(selector).check({ force: true }).then(() => true).catch(() => false);
}

async function clickTjtoSubmitAndWaitDownload(page, timeoutMs) {
  const downloadPromise = page.waitForEvent("download", { timeout: timeoutMs }).catch(() => null);
  const button = page.locator("form#frmProcessoLista button#sbmNovo, button#sbmNovo, input#sbmNovo").last();
  await button.click({ force: true }).catch(async () => {
    await page.locator("#sbmNovo").last().click({ force: true });
  });
  const download = await downloadPromise;
  await page.waitForLoadState("domcontentloaded", { timeout: envNumber("STATE_COURT_NAV_TIMEOUT_MS", 30000) }).catch(() => {});
  await page.waitForTimeout(700).catch(() => {});
  return download;
}

async function fillMtTjmtCertificate({ context, input, profile, certificateType }) {
  const page = await context.newPage();
  let keepPageOpen = false;
  let emitRequestError = "";
  const handleEmitRequestFailed = (request) => {
    if (/emitir-certidao-negativa-com-busca/i.test(request.url())) {
      emitRequestError = request.failure()?.errorText || "Falha de rede no portal TJMT/SEC.";
    }
  };
  try {
    page.setDefaultTimeout(envNumber("STATE_COURT_STEP_TIMEOUT_MS", input.timeoutMs || 30000));
    const fields = input.extraFields?.stateCourtFields || {};
    const documentValue = String(input.extraFields?.cpfDocument || input.documento || "").replace(/\D/g, "");
    await page.goto(mtTjmtCertificateFormUrl(profile), {
      waitUntil: "domcontentloaded",
      timeout: envNumber("STATE_COURT_NAV_TIMEOUT_MS", 30000),
    });
    await page.waitForTimeout(1600);
    await closeMtTjmtModal(page);

    await fillMtTjmtInputValue(page, "#documentoRequerido", documentValue);
    await safeFillVisible(page, "#dataNascimento", formatBrazilianDate(fields.birthDate));
    await fillByLabelLike(page, /data de nascimento|nascimento/i, formatBrazilianDate(fields.birthDate));
    const personLookup = page
      .waitForResponse((response) => /\/pessoa\/consultar-documento/i.test(response.url()), {
        timeout: envNumber("STATE_COURT_NAV_TIMEOUT_MS", 30000),
      })
      .catch(() => null);
    await page.locator("button").filter({ hasText: /consultar documento/i }).first().click({ force: true }).catch(() => clickByText(page, /consultar documento/i));
    await page.waitForLoadState("domcontentloaded", { timeout: envNumber("STATE_COURT_NAV_TIMEOUT_MS", 30000) }).catch(() => {});
    await page.waitForTimeout(3200);
    const lookedUpName = await extractMtTjmtPersonName(await personLookup);

    await setMtTjmtNameField(page, lookedUpName || fields.fullName);
    await safeFillVisible(page, "#nomeRequerido", lookedUpName || fields.fullName);
    await selectMtCertificateType(page, certificateType.id);

    const sec2Emission = await emitMtTjmtSec2Certificate({ page, fields, documentValue, certificateType, lookedUpName });
    if (sec2Emission?.certidao) {
      const sec2Pdf = await fetchMtTjmtSec2Pdf({ page, certificateId: sec2Emission.certidao });
      if (sec2Pdf) {
        const extractedText = await extractPdfText(sec2Pdf);
        if (!isExpectedStateCourtCertificateText(extractedText, { documentValue, fields })) {
          keepPageOpen = shouldKeepAssistedOpen();
          return {
            tipo: certificateType.label,
            status: "waiting_user_action",
            resultado: SOURCE_RESULT.INDISPONIVEL,
            rawText: extractedText,
            assistedWindowOpen: keepPageOpen,
            errorMessage: "TJMT/SEC2 emitiu PDF, mas ele nao corresponde ao documento/nome consultado.",
            resumo: "PDF ignorado por nao conter o interessado da consulta.",
          };
        }
        const { pdfPath, rawText } = await saveAndExtractPdfBuffer({
          consultaId: input.consultaId,
          fonte,
          fileName: `tjmt-${certificateType.id}.pdf`,
          buffer: sec2Pdf,
        });
        return {
          tipo: certificateType.label,
          status: "success",
          resultado: classifyCertificateText(rawText || extractedText),
          pdfPath,
          rawText,
          downloadUrl: `tjmt-sec2:${sec2Emission.certidao}`,
          resumo: summarizeCertificateText(rawText || extractedText || sec2Emission.mensagem || ""),
        };
      }
    }
    if (sec2Emission?.processos || sec2Emission?.message) {
      keepPageOpen = shouldKeepAssistedOpen();
      return {
        tipo: certificateType.label,
        status: "waiting_user_action",
        resultado: SOURCE_RESULT.INDISPONIVEL,
        pageText: sec2Emission.message || sec2Emission.mensagem || "",
        assistedWindowOpen: keepPageOpen,
        errorMessage: sec2Emission.message || sec2Emission.mensagem || "TJMT/SEC2 retornou resposta sem PDF.",
        resumo: "TJMT/SEC2 nao emitiu PDF automaticamente; fluxo exige pedido, revisao ou etapa oficial adicional.",
      };
    }

    page.on("requestfailed", handleEmitRequestFailed);
    const emitResponsePromise = page
      .waitForResponse((response) => /\/certidao\/emitir-certidao-negativa-com-busca/i.test(response.url()), {
        timeout: envNumber("STATE_COURT_NAV_TIMEOUT_MS", 30000),
      })
      .catch(() => null);
    await page.locator("button.btn-success").filter({ hasText: /emitir certid/i }).first().click({ force: true }).catch(() => clickByText(page, /emitir certid[aã]o/i));
    await page.waitForTimeout(1800);

    const pageText = await page.locator("body").innerText().catch(() => "");
    const emittedHash = await extractMtTjmtCertificateHash(await emitResponsePromise);
    if (emittedHash) {
      const hashPdf = await fetchMtTjmtCertificatePdfByHash({ context, hash: emittedHash });
      if (hashPdf) {
        const extractedText = await extractPdfText(hashPdf);
        if (!isExpectedStateCourtCertificateText(extractedText, { documentValue, fields })) {
          keepPageOpen = shouldKeepAssistedOpen();
          return {
            tipo: certificateType.label,
            status: "waiting_user_action",
            resultado: SOURCE_RESULT.INDISPONIVEL,
            rawText: extractedText,
            pageText,
            assistedWindowOpen: keepPageOpen,
            errorMessage: "TJMT/SEC emitiu hash, mas o PDF retornado nao corresponde ao documento/nome consultado.",
            resumo: "PDF ignorado por nao conter o interessado da consulta.",
          };
        }
        const { pdfPath, rawText } = await saveAndExtractPdfBuffer({
          consultaId: input.consultaId,
          fonte,
          fileName: `tjmt-${certificateType.id}.pdf`,
          buffer: hashPdf,
        });
        return {
          tipo: certificateType.label,
          status: "success",
          resultado: classifyCertificateText(rawText || pageText),
          pdfPath,
          rawText,
          pageText,
          downloadUrl: `tjmt-hash:${emittedHash}`,
          resumo: summarizeCertificateText(rawText || pageText),
        };
      }
    }
    const download = await page.waitForEvent("download", { timeout: envNumber("STATE_COURT_DOWNLOAD_TIMEOUT_MS", 6000) }).catch(() => null);
    if (download) {
      const downloadPath = await download.path();
      const buffer = Buffer.from(await readFile(downloadPath));
      const extractedText = await extractPdfText(buffer);
      if (!isExpectedStateCourtCertificateText(extractedText, { documentValue, fields })) {
        keepPageOpen = shouldKeepAssistedOpen();
        return {
          tipo: certificateType.label,
          status: "waiting_user_action",
          resultado: SOURCE_RESULT.INDISPONIVEL,
          rawText: extractedText,
          pageText,
          assistedWindowOpen: keepPageOpen,
          errorMessage: "TJMT/SEC gerou um PDF, mas ele nao corresponde ao documento/nome consultado.",
          resumo: "PDF ignorado por nao conter o interessado da consulta.",
        };
      }
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

    const pdfLink = await findVisiblePdfLink(page);
    if (pdfLink) {
      const pdfResponse = await context.request.get(pdfLink).catch(() => null);
      if (pdfResponse?.ok()) {
        const headers = pdfResponse.headers();
        const buffer = Buffer.from(await pdfResponse.body());
        const looksLikePdf = /pdf/i.test(headers["content-type"] || "") || buffer.subarray(0, 4).toString("utf8") === "%PDF";
        if (looksLikePdf) {
          const extractedText = await extractPdfText(buffer);
          if (!isExpectedStateCourtCertificateText(extractedText, { documentValue, fields })) {
            keepPageOpen = shouldKeepAssistedOpen();
            return {
              tipo: certificateType.label,
              status: "waiting_user_action",
              resultado: SOURCE_RESULT.INDISPONIVEL,
              rawText: extractedText,
              pageText,
              downloadUrl: maskSignedUrl(pdfLink),
              assistedWindowOpen: keepPageOpen,
              errorMessage: "TJMT/SEC retornou um PDF, mas ele nao corresponde ao documento/nome consultado.",
              resumo: "PDF ignorado por nao conter o interessado da consulta.",
            };
          }
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
            downloadUrl: maskSignedUrl(pdfLink),
            resumo: summarizeCertificateText(rawText || pageText),
          };
        }
      }
      keepPageOpen = shouldKeepAssistedOpen();
      return {
        tipo: certificateType.label,
        status: "waiting_user_action",
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
      errorMessage: emitRequestError
        ? `TJMT/SEC rejeitou a emissao no portal oficial: ${emitRequestError}.`
        : /captcha|recaptcha|validacao|confirme|obrigatorio|divergencia/i.test(String(pageText || "").normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
          ? "TJMT/SEC exige validacao, correcao de dados ou confirmacao antes de emitir."
          : "TJMT/SEC preenchido; emissao ainda nao retornou PDF nem texto conclusivo.",
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

async function closeMtTjmtModal(page) {
  await page.locator("button, a, [role='button']").filter({ hasText: /^(fechar|close)$/i }).last().click({ timeout: 3000 }).catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(300).catch(() => {});
}

async function fillMtTjmtInputValue(page, selector, value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";
  const input = page.locator(selector).first();
  if (!(await input.count().catch(() => 0))) return "";

  await input.click({ force: true, timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 5000) }).catch(() => {});
  await page.keyboard.press("Control+A").catch(() => {});
  await page.keyboard.press("Backspace").catch(() => {});
  await page.keyboard.type(rawValue, { delay: 45 }).catch(() => {});
  await input.blur().catch(() => {});
  await page.waitForTimeout(250).catch(() => {});

  let currentValue = await input.inputValue().catch(() => "");
  if (rawValue.replace(/\D/g, "") && currentValue.replace(/\D/g, "") === rawValue.replace(/\D/g, "")) {
    return currentValue;
  }

  await page
    .evaluate(
      ({ fieldSelector, textValue }) => {
        const field = document.querySelector(fieldSelector);
        if (!field) return false;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        if (setter) setter.call(field, textValue);
        else field.value = textValue;
        for (const eventName of ["input", "change", "keyup", "blur"]) {
          field.dispatchEvent(new Event(eventName, { bubbles: true }));
        }
        return true;
      },
      { fieldSelector: selector, textValue: rawValue },
    )
    .catch(() => false);
  await page.waitForTimeout(250).catch(() => {});
  currentValue = await input.inputValue().catch(() => "");
  return currentValue;
}

function mtTjmtCertificateFormUrl(profile) {
  try {
    const origin = new URL(profile?.url || "https://sec.tjmt.jus.br/primeiro-grau").origin;
    return `${origin}/primeiro-grau/certidao-negativa-pessoa-fisica`;
  } catch {
    return "https://sec.tjmt.jus.br/primeiro-grau/certidao-negativa-pessoa-fisica";
  }
}

async function extractMtTjmtPersonName(response) {
  if (!response?.ok?.()) return "";
  const data = await response.json().catch(() => null);
  return String(data?.result?.nome || "").trim();
}

async function extractMtTjmtCertificateHash(response) {
  if (!response?.ok?.()) return "";
  const data = await response.json().catch(() => null);
  return String(data?.result?.hash || data?.hash || "").trim();
}

async function setMtTjmtNameField(page, name) {
  const value = String(name || "").trim();
  if (!value) return false;
  return page
    .evaluate((textValue) => {
      const input = document.querySelector("#nomeRequerido");
      if (!input) return false;
      input.disabled = false;
      input.removeAttribute("disabled");
      input.classList.remove("ant-input-disabled");
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (setter) setter.call(input, textValue);
      else input.value = textValue;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new Event("blur", { bubbles: true }));
      return true;
    }, value)
    .catch(() => false);
}

function mtTjmtTipoCertidaoId(certificateId) {
  if (certificateId === "criminal") return 1;
  return 2;
}

async function emitMtTjmtSec2Certificate({ page, fields, documentValue, certificateType, lookedUpName }) {
  const name = String(lookedUpName || fields.fullName || "").trim().toUpperCase();
  const documentDigits = String(documentValue || "").replace(/\D/g, "");
  if (!name || !documentDigits) {
    return null;
  }

  return page
    .evaluate(
      async ({ apiBase, apiToken, payload }) => {
        const response = await fetch(`${apiBase}/certidao/emitir-certidao-negativa`, {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            token: apiToken,
          },
          body: JSON.stringify(payload),
        });
        const text = await response.text();
        let data = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = { message: text };
        }
        if (!response.ok) {
          return {
            ok: false,
            status: response.status,
            message: data?.errorMessage || data?.message || data?.title || text || `TJMT/SEC2 retornou HTTP ${response.status}.`,
          };
        }
        return { ok: true, ...data };
      },
      {
        apiBase: TJMT_SEC2_API_BASE,
        apiToken: TJMT_SEC2_PUBLIC_TOKEN,
        payload: {
          requerente: name,
          requerenteCpfCnpj: documentDigits,
          requerido: name,
          requeridoCpfCnpj: documentDigits,
          idOpcaoCertidao: 1,
          idTipoCertidao: mtTjmtTipoCertidaoId(certificateType.id),
          idTipoSituacaoProcesso: 3,
        },
      },
    )
    .catch((error) => ({
      ok: false,
      message: error?.message || "Falha ao emitir certidao pelo TJMT/SEC2.",
    }));
}

async function fetchMtTjmtSec2Pdf({ page, certificateId }) {
  const id = String(certificateId || "").trim();
  if (!id) return null;
  const result = await page
    .evaluate(
      async ({ apiBase, apiToken, idCertidao }) => {
        const response = await fetch(`${apiBase}/certidao/obter-certidao-pdf?idCertidao=${encodeURIComponent(idCertidao)}`, {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/pdf,application/octet-stream,*/*",
            "Content-Type": "application/json",
            token: apiToken,
          },
        });
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let index = 0; index < bytes.length; index += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
        }
        return {
          ok: response.ok,
          status: response.status,
          contentType: response.headers.get("content-type") || "",
          base64: btoa(binary),
        };
      },
      {
        apiBase: TJMT_SEC2_API_BASE,
        apiToken: TJMT_SEC2_PUBLIC_TOKEN,
        idCertidao: id,
      },
    )
    .catch(() => null);
  if (!result?.ok || !result.base64) return null;
  const buffer = Buffer.from(result.base64, "base64");
  if (/pdf/i.test(result.contentType || "") || buffer.subarray(0, 4).toString("utf8") === "%PDF") {
    return buffer;
  }
  return null;
}

async function fetchMtTjmtCertificatePdfByHash({ context, hash }) {
  const cleanHash = String(hash || "").trim();
  if (!cleanHash) return null;
  const urls = [
    `https://sec-api.tjmt.jus.br/certidao/obter-certidao-pdf?hash=${encodeURIComponent(cleanHash)}`,
    `https://sec-api.tjmt.jus.br/certidao/obter-certidao-pdf?Hash=${encodeURIComponent(cleanHash)}`,
  ];
  for (const url of urls) {
    const response = await context.request
      .get(url, {
        headers: {
          Accept: "application/pdf,application/octet-stream,*/*",
          Origin: "https://sec.tjmt.jus.br",
          Referer: "https://sec.tjmt.jus.br/primeiro-grau/certidao-negativa-pessoa-fisica",
        },
        timeout: envNumber("STATE_COURT_DOWNLOAD_TIMEOUT_MS", 15000),
      })
      .catch(() => null);
    if (!response?.ok()) continue;
    const buffer = Buffer.from(await response.body());
    const contentType = response.headers()["content-type"] || "";
    if (/pdf/i.test(contentType) || buffer.subarray(0, 4).toString("utf8") === "%PDF") {
      return buffer;
    }
  }
  return null;
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
    await clickEsTjesSolicitar(page);
    await waitForEsTjesResultOrValidation(page);
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

async function clickEsTjesSolicitar(page) {
  const timeout = envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 8000);
  const button = page.locator("#btnSolicitar").first();
  await button.waitFor({ state: "attached", timeout });
  await button.scrollIntoViewIfNeeded({ timeout }).catch(() => {});
  const clicked = await button.click({ timeout, noWaitAfter: true }).then(() => true).catch(() => false);
  if (clicked) {
    return true;
  }
  return page
    .evaluate(() => {
      const button = document.querySelector("#btnSolicitar");
      if (!button) return false;
      button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      button.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      if (button.form && typeof button.form.requestSubmit === "function") {
        button.form.requestSubmit(button);
      }
      return true;
    })
    .catch(() => false);
}

async function waitForEsTjesResultOrValidation(page) {
  const timeout = envNumber("STATE_COURT_TJES_RESULT_TIMEOUT_MS", envNumber("STATE_COURT_STEP_TIMEOUT_MS", 45000));
  await page
    .waitForFunction(
      () => {
        const text = String(document.body?.innerText || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        return (
          /certidaoimpressao/i.test(location.href) ||
          text.includes("dados da certidao") ||
          text.includes("nada consta") ||
          text.includes("captcha") ||
          text.includes("codigo de seguranca") ||
          text.includes("nao foi possivel")
        );
      },
      null,
      { timeout },
    )
    .catch(() => page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {}));
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

function isTjapAssistedSession(session) {
  return /tucujuris|tjap|amapa/i.test(`${session?.portalUrl || ""} ${session?.courtName || ""} ${session?.courtUf || ""}`);
}

function isTjpiAssistedSession(session) {
  return /europa\.tjpi|tjpi|piau/i.test(`${session?.portalUrl || ""} ${session?.courtName || ""} ${session?.courtUf || ""}`);
}

function getEsajSessionCertificateType(session) {
  const types = getStateCertificateTypesForInput(session.input || {}, session.profile || {});
  return types[0] || { id: "civil", label: getStateCourtCertificateLabel("civil") };
}

function getTjapSessionCertificateType(session) {
  const types = getStateCertificateTypesForInput(session.input || {}, session.profile || {});
  return types[0] || { id: "civil", label: getStateCourtCertificateLabel("civil") };
}

function getTjpiSessionCertificateType(session) {
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
  const selectedModel = String(fields.certificateKind || "").trim();
  const modelFilled = selectedModel
    ? await selectVisibleByTextOrValue(page, "#cdModelo", selectedModel)
    : false;
  if (!modelFilled) {
    await page.locator("#cdModelo").selectOption(esajModelValue(certificateType.id, profile), {
      timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 8000),
    });
  }
  filledFields.push("modelo");
  await page.waitForTimeout(900);
  const comarcaValue = fields.comarca || esajDefaultComarca(profile);
  await recordField("comarca", selectEsajComarca(page, comarcaValue));

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
  await recordField("nacionalidade", selectEsajLookupValue(page, {
    fieldSelector: "#entity\\.nacionalidade\\.deNacionalidade",
    value: fields.nationality || "BRASILEIRO",
    fallbackValue: "BRASILEIRO",
    popupTitle: /nacionalidade/i,
  }));
  await recordField("naturalidade", setEsajMunicipalityValue(page, {
    nameSelector: "#entity\\.naturalidade\\.nmMunicipio",
    codeSelector: "#entity\\.naturalidade\\.cdMunicipio",
    ufSelector: "#entity\\.naturalidade\\.cdUf",
    value: fields.naturality || fields.city,
  }));
  await recordField("estadoCivil", selectVisibleByTextOrValue(page, "#id_sco\\.pedido\\.label\\.cdEstadocivil", fields.civilStatus || "Solteiro"));
  await recordField("profissao", safeFillVisible(page, "#entity\\.deProfissao", fields.profession));
  await recordField("endereco", safeFillVisible(page, "#identity\\.endNomePesq\\.deEndereco", fields.address));
  await recordField("complemento", safeFillVisible(page, "#identity\\.endNomePesq\\.deComplemento", fields.addressComplement));
  await recordField("cep", safeFillVisible(page, "#identity\\.endNomePesq\\.nuCep", formatCep(fields.cep)));
  await recordField("bairro", safeFillVisible(page, "#identity\\.endNomePesq\\.deBairro", fields.neighborhood));
  await recordField("municipio", setEsajMunicipalityValue(page, {
    nameSelector: "#entity\\.endNomePesq\\.municipio\\.nmMunicipio",
    codeSelector: "#entity\\.endNomePesq\\.municipio\\.cdMunicipio",
    ufSelector: "#entity\\.endNomePesq\\.municipio\\.cdUf",
    value: fields.city,
  }));
  await recordField("email", safeFillVisible(page, "#identity\\.solicitante\\.deEmail", fields.email));
  await recordField("confirmacao", safeCheck(page, "#confirmacaoInformacoes"));
  await recordField("comarcaConfirmada", selectEsajComarca(page, comarcaValue));

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
  let keepPageOpen = false;
  try {
    page.setDefaultTimeout(envNumber("STATE_COURT_STEP_TIMEOUT_MS", input.timeoutMs || 30000));
    await page.goto(profile?.url || "https://tucujuris.tjap.jus.br/pages/certidao-publica/certidao-publica.html", {
      waitUntil: "domcontentloaded",
      timeout: envNumber("STATE_COURT_NAV_TIMEOUT_MS", 30000),
    });

    const formReady = await waitForTjapFormOrProtection(page);
    if (!formReady.formVisible) {
      keepPageOpen = shouldKeepAssistedOpen();
      return {
        tipo: certificateType.label,
        status: "waiting_user_action",
        resultado: SOURCE_RESULT.INDISPONIVEL,
        pageText: formReady.pageText,
        requiresCloudflare: true,
        blockedByProtection: true,
        assistedWindowOpen: keepPageOpen,
        errorMessage: "TJAP/Tucujuris exibiu proteção Cloudflare/Azion antes do formulário.",
        resumo: "Abra a janela oficial, resolva a verificação e execute novamente para a IA AUDITA preencher os campos.",
      };
    }

    await fillTjapPageFields({ page, input, profile, certificateType });

    const pageText = await page.locator("body").innerText().catch(() => "");
    const protectedChallenge = await hasTjapProtection(page, pageText);
    if (protectedChallenge) {
      keepPageOpen = shouldKeepAssistedOpen();
      return {
        tipo: certificateType.label,
        status: "waiting_user_action",
        resultado: SOURCE_RESULT.INDISPONIVEL,
        pageText,
        requiresCloudflare: true,
        blockedByProtection: true,
        assistedWindowOpen: keepPageOpen,
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

    keepPageOpen = shouldKeepAssistedOpen();
    return {
      tipo: certificateType.label,
      status: "waiting_user_action",
      resultado: SOURCE_RESULT.INDISPONIVEL,
      pageText: submittedText,
      filledFields: ["tipoPessoa", "nome", "documento", "email", "certidao"],
      assistedWindowOpen: keepPageOpen,
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
    if (!keepPageOpen) {
      await page.close().catch(() => {});
    }
  }
}

async function fillTjapPageFields({ page, input, profile, certificateType }) {
  const fields = input.extraFields?.stateCourtFields || {};
  const documentValue = String(input.extraFields?.cpfDocument || input.extraFields?.cnpjDocument || input.documento || "").replace(/\D/g, "");
  const isCompany = input.tipoDocumento === "cnpj";
  const formReady = await waitForTjapFormOrProtection(page);
  if (!formReady.formVisible) {
    return false;
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
  await selectFirstVisibleSelectByTextOrValue(page, fields.uf || profile?.uf || "AP");
  await fillVisibleInputByIndex(page, "input[type='email']", 0, fields.email);
  await chooseTjapCertificateType(page, certificateType.id);
  return true;
}

async function fillTjpiPageFields({ page, input, profile, certificateType }) {
  const fields = input.extraFields?.stateCourtFields || {};
  const documentValue = String(input.extraFields?.cpfDocument || input.extraFields?.cnpjDocument || input.documento || "").replace(/\D/g, "");
  const filled = [];
  const record = async (name, promise) => {
    const ok = await promise.catch(() => false);
    if (ok) filled.push(name);
    return ok;
  };

  const ready = await page.locator("mat-select[formcontrolname='tipoParte']").waitFor({ timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 8000) }).then(() => true).catch(() => false);
  if (!ready) return filled;

  await record("tipoParte", selectTjpiMatSelect(page, "tipoParte", input.tipoDocumento === "cnpj" ? "PESSOA JURIDICA" : "PESSOA FISICA"));
  await record("grauJuridicao", selectTjpiMatSelect(page, "grauJuridicao", "PRIMEIRO GRAU"));
  const certificateOption = certificateType?.id === "criminal" ? "Negativa Criminal" : "Negativa Civel";
  const selectedCertificate = await record("tipoCertidao", selectTjpiMatSelect(page, "tipoCertidao", certificateOption));
  if (!selectedCertificate) {
    await record("tipoCertidao", selectTjpiMatSelect(page, "tipoCertidao", "Negativa Civel"));
  }
  await record("requerente", fillTjpiInput(page, "requerente", fields.fullName || fields.companyName || input.extraFields?.tjdftCompanyName || ""));
  await record("cpf", fillTjpiInput(page, "cpf", documentValue));
  await record("rg", fillTjpiInput(page, "rg", fields.rg));
  await record("orgaoExpedidor", fillTjpiInput(page, "orgaoExpedidor", fields.issuingAuthority || fields.issuingAgency || fields.rgIssuer));
  await record("estadoCivil", selectTjpiMatSelect(page, "estadoCivil", fields.civilStatus || "Solteiro"));
  await record("pai", fillTjpiInput(page, "pai", fields.fatherName || input.extraFields?.fatherName));
  await record("mae", fillTjpiInput(page, "mae", fields.motherName || input.extraFields?.motherName || input.extraFields?.nomeMae));
  await record("cep", fillTjpiInput(page, "cep", fields.cep));
  await page.waitForTimeout(500).catch(() => {});
  await record("endereco", fillTjpiInput(page, "endereco", fields.address));
  await record("numero", fillTjpiInput(page, "numero", fields.addressNumber || fields.number));
  await record("complemento", fillTjpiInput(page, "complemento", fields.addressComplement));
  await record("bairro", fillTjpiInput(page, "bairro", fields.neighborhood));
  await record("ufRequerente", selectTjpiMatSelect(page, "ufRequerente", fields.stateUf || fields.uf || profile?.uf));
  await page.waitForTimeout(800).catch(() => {});
  await record("municipioRequerente", selectTjpiMatSelect(page, "municipioRequerente", fields.city));
  return filled;
}

async function fillTjpiInput(page, formControlName, value) {
  const text = String(value || "").trim();
  if (!text) return false;
  const selector = `input[formcontrolname="${formControlName}"]`;
  const locator = page.locator(selector).first();
  if (!(await locator.count().catch(() => 0))) return false;
  await locator.evaluate((element, nextValue) => {
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
    if (descriptor?.set) descriptor.set.call(element, nextValue);
    else element.value = nextValue;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: String(nextValue).slice(-1) || "" }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
  }, text);
  return true;
}

async function selectTjpiMatSelect(page, formControlName, optionText) {
  const wanted = String(optionText || "").trim();
  if (!wanted) return false;
  const select = page.locator(`mat-select[formcontrolname="${formControlName}"]`).first();
  if (!(await select.count().catch(() => 0))) return false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await select.click({ force: true }).catch(() => {});
    await page.waitForTimeout(250).catch(() => {});
    const clicked = await page.evaluate((rawOption) => {
      const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const wantedNormalized = normalize(rawOption);
      const option = [...document.querySelectorAll("mat-option,[role='option']")]
        .find((element) => normalize(element.textContent).includes(wantedNormalized));
      if (!option) return false;
      option.click();
      return true;
    }, wanted).catch(() => false);
    if (clicked) {
      await page.waitForTimeout(500).catch(() => {});
      return true;
    }
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(500).catch(() => {});
  }
  return false;
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

export function esajModelValue(certificateId, profile = {}) {
  const valuesByUf = {
    AL: {
      falencia: "40",
      criminal: "39",
      civil: "38",
    },
    AM: {
      falencia: "31",
      criminal: "7",
      civil: "9",
    },
    MS: {
      falencia: "93",
      criminal: "92",
      civil: "91",
    },
    SP: {
      falencia: "58",
      criminal: "6",
      civil: "52",
    },
  };
  const values = valuesByUf[String(profile?.uf || "").toUpperCase()] || valuesByUf.SP;
  return values[certificateId] || values.civil;
}

function esajDefaultComarca(profile = {}) {
  const uf = String(profile?.uf || "").toUpperCase();
  if (uf === "AM") return "Manaus";
  if (uf === "MS") return "Campo Grande";
  return "";
}

async function selectEsajComarca(page, value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return false;
  }
  await page.waitForFunction(() => {
    const select =
      document.querySelector("#id_sco\\.pedido\\.label\\.cdComarca") ||
      document.querySelector('select[name="entity.cdComarca"]');
    if (!select) return false;
    return [...select.options].some((option) => {
      const text = String(option.textContent || option.text || "").trim();
      return option.value && text && !/selecione|escolha/i.test(text);
    });
  }, null, { timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 8000) }).catch(() => null);
  const directSelectors = ["#id_sco\\.pedido\\.label\\.cdComarca", 'select[name="entity.cdComarca"]'];
  for (const selector of directSelectors) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    if (!count) continue;
    const selected = await locator
      .selectOption({ label: raw }, { timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 8000) })
      .then(() => true)
      .catch(() => false);
    if (selected) return true;
  }
  return page
    .evaluate((rawValue) => {
      const normalizeText = (input) =>
        String(input || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();
      const wanted = normalizeText(rawValue);
      const meaningfulOption = (item) => {
        const text = normalizeText(item.textContent || item.text || "");
        const value = normalizeText(item.value || "");
        return Boolean(value && text && !/selecione|escolha/.test(text));
      };
      const matchesWanted = (item) => {
        const text = normalizeText(item.textContent || item.text || "");
        const value = normalizeText(item.value || "");
        return (
          value === wanted ||
          text === wanted ||
          text.includes(wanted) ||
          wanted.includes(text) ||
          text.split(/[-/|]/).some((part) => normalizeText(part) === wanted)
        );
      };
      const selects = [
        document.querySelector("#id_sco\\.pedido\\.label\\.cdComarca"),
        document.querySelector('select[name="entity.cdComarca"]'),
        ...[...document.querySelectorAll("select")].filter((candidate) => {
          const labelText = [
            candidate.id,
            candidate.name,
            candidate.getAttribute("aria-label"),
            candidate.closest("tr")?.innerText,
            candidate.closest("label")?.innerText,
            candidate.previousElementSibling?.innerText,
          ]
            .filter(Boolean)
            .join(" ");
          return normalizeText(labelText).includes("comarca");
        }),
      ].filter(Boolean);
      const select = selects.find((candidate) => [...candidate.options].some(matchesWanted)) ||
        selects.find((candidate) => [...candidate.options].some(meaningfulOption));
      if (!select) return false;
      const option = [...select.options].find(matchesWanted) || [...select.options].find(meaningfulOption);
      if (!option) return false;
      select.value = option.value;
      option.selected = true;
      [select].forEach((element) => {
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        element.dispatchEvent(new Event("blur", { bubbles: true }));
      });
      return true;
    }, raw)
    .catch(() => false);
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

function maTjmaNatureLabel(certificateId) {
  const values = {
    civil: "Acoes Civeis",
    criminal: "Acoes Penais",
  };
  return values[certificateId] || values.civil;
}

async function gotoMaTjmaPortal(page, url) {
  const navigationTimeout = envNumber("STATE_COURT_TJMA_NAV_TIMEOUT_MS", envNumber("STATE_COURT_NAV_TIMEOUT_MS", 45000));
  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: navigationTimeout,
    });
    return;
  } catch (error) {
    const hasBody = await page.locator("body").count().catch(() => 0);
    const bodyText = hasBody ? await page.locator("body").innerText({ timeout: 3000 }).catch(() => "") : "";
    if (bodyText.trim() || page.url().includes("jurisconsult.tjma.jus.br")) {
      return;
    }
    await page.reload({ waitUntil: "domcontentloaded", timeout: Math.min(navigationTimeout, 30000) }).catch(() => {
      throw error;
    });
  }
}

async function clickMaTjmaCookieConsent(page) {
  return page
    .evaluate(() => {
      const normalizeText = (value) =>
        String(value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
      const buttons = [...document.querySelectorAll("button, .cookie-item")];
      const button = buttons.find((element) => normalizeText(element.innerText || element.textContent || "").includes("ciente"));
      if (!button) return false;
      button.click();
      return true;
    })
    .catch(() => false);
}

async function selectMaTjmaOption(page, controlName, wantedValue) {
  const wanted = String(wantedValue || "").trim();
  if (!wanted) return false;
  return page
    .evaluate(
      ({ control, wantedText }) => {
        const normalizeText = (value) =>
          String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
        const fire = (element) => {
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
          element.dispatchEvent(new Event("blur", { bubbles: true }));
        };
        const wantedNormalized = normalizeText(wantedText);
        const select = [...document.querySelectorAll("select")].find((element) => element.getAttribute("formcontrolname") === control);
        if (select) {
          const option = [...select.options].find((item) => {
            const optionText = normalizeText(`${item.text || ""} ${item.value || ""}`);
            return optionText === wantedNormalized || optionText.includes(wantedNormalized) || wantedNormalized.includes(optionText);
          });
          if (!option) return false;
          select.value = option.value;
          option.selected = true;
          fire(select);
          return true;
        }

        const ionSelect = [...document.querySelectorAll("ion-select")].find((element) => element.getAttribute("formcontrolname") === control);
        if (!ionSelect) return false;
        const selectedText = ionSelect.querySelector(".select-text");
        if (selectedText) selectedText.textContent = wantedText;
        ionSelect.value = wantedText;
        fire(ionSelect);
        return true;
      },
      { control: controlName, wantedText: wanted },
    )
    .catch(() => false);
}

async function fillMaTjmaControl(page, controlName, value) {
  const text = String(value || "").trim();
  if (!text) return false;
  const selectors = [
    `input[formcontrolname="${controlName}"]`,
    `textarea[formcontrolname="${controlName}"]`,
    `ion-input[formcontrolname="${controlName}"] input`,
  ];
  for (const selector of selectors) {
    if (await safeFillVisible(page, selector, text)) {
      return true;
    }
  }
  return false;
}

async function fillMaTjmaBirthDate(page, value) {
  const text = formatBrazilianDate(value);
  if (!text) return false;
  const selectors = [
    'input[placeholder="xx/xx/xxxx"]',
    "input.flatpickr-input",
    'input[aria-label*="Nascimento"]',
  ];
  for (const selector of selectors) {
    if (await safeFillVisible(page, selector, text)) {
      return true;
    }
  }
  return page
    .evaluate((dateValue) => {
      const normalizeText = (value) =>
        String(value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
      const inputs = [...document.querySelectorAll("input")].filter((input) => {
        const text = [
          input.placeholder,
          input.getAttribute("aria-label"),
          input.closest("ion-item, div, label")?.innerText,
          input.className,
        ]
          .filter(Boolean)
          .join(" ");
        return normalizeText(text).includes("nascimento") || input.placeholder === "xx/xx/xxxx";
      });
      const input = inputs.find((candidate) => !candidate.disabled && !candidate.readOnly);
      if (!input) return false;
      input.focus();
      input.value = dateValue;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new Event("blur", { bubbles: true }));
      return true;
    }, text)
    .catch(() => false);
}

function ceNatureValue(certificateId) {
  const values = {
    civil: "Civel",
    criminal: "Criminal",
    especial: "CivelCriminal",
  };
  return values[certificateId] || "Criminal";
}

function ceJudicialCertificateValue(natureValue) {
  return natureValue === "Criminal" ? "5" : "6";
}

function baParticipationSelector(value) {
  const normalized = normalize(value);
  if (normalized.includes("ativa")) return "#radioAtiva";
  if (normalized.includes("ambas")) return "#radioAmbas";
  return "#radioPassiva";
}

function formatBrazilianPhone(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 10);
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return String(value || "").trim();
}

function formatBrazilianMobile(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return String(value || "").trim();
}

function peTjpeCertificateUrl(profile, certificateId) {
  const base = String(profile?.url || "https://certidoesunificadas.app.tjpe.jus.br/").replace(/\/+$/, "");
  if (certificateId === "criminal") {
    return `${base}/certidao-criminal-pf`;
  }
  return `${base}/certidao-civel-1g/pessoa-fisica`;
}

async function fillPeTjpeInput(page, selector, value) {
  const text = String(value || "").trim();
  if (!text) {
    return false;
  }
  const locator = page.locator(selector);
  if (!(await locator.count().catch(() => 0))) {
    return false;
  }
  await locator.fill(text, { timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 5000) });
  await locator
    .evaluate((element) => {
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: element.value }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.dispatchEvent(new Event("blur", { bubbles: true }));
    })
    .catch(() => {});
  return true;
}

async function fillPeTjpeTextInputAt(page, index, value) {
  const text = String(value || "").trim();
  if (!text) {
    return false;
  }
  const locator = page.locator("input[type='text']").nth(index);
  if (!(await locator.count().catch(() => 0))) {
    return false;
  }
  await locator.click({ timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 5000) });
  await locator.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
  await locator.press("Backspace").catch(() => {});
  await locator.type(text.replace(/\D/g, ""), { delay: 20, timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 8000) });
  await locator.press("Tab").catch(() => {});
  return true;
}

async function confirmCeTjceWarningDialog(page) {
  const clicked = await page
    .evaluate(() => {
      const normalizeText = (value) =>
        String(value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
      const candidates = [...document.querySelectorAll("button, input[type='button'], input[type='submit'], a")];
      const button = candidates.find((element) =>
        normalizeText(element.textContent || element.value).includes("confirmar a leitura dos avisos"),
      );
      if (!button) return false;
      button.click();
      return true;
    })
    .catch(() => false);
  if (clicked) {
    await page.waitForTimeout(1000);
  }
  return clicked;
}

function buildBaAddress(fields = {}) {
  return [fields.address, fields.addressNumber, fields.addressComplement, fields.neighborhood, fields.city, fields.cep ? `CEP ${formatCep(fields.cep)}` : ""]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");
}

async function clickBaTjbaGenerateAdvance(page) {
  const clicked = await page
    .evaluate(() => {
      const normalizeText = (value) =>
        String(value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
      const visible = (element) => {
        const style = window.getComputedStyle(element);
        return Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length) && style.visibility !== "hidden" && style.display !== "none";
      };
      const cards = [...document.querySelectorAll("form, mat-card, .card, section, div")].filter((element) => visible(element));
      const generateCard = cards.find((element) => /gerar certidao|gerar certidão/i.test(normalizeText(element.innerText || "")));
      const scope = generateCard || document;
      const buttons = [...scope.querySelectorAll("button, input[type='button'], input[type='submit']")].filter((element) => visible(element));
      const button = buttons.find((element) => /avancar|avançar/i.test(normalizeText(element.innerText || element.value || "")));
      if (!button) return false;
      button.click();
      return true;
    })
    .catch(() => false);
  if (clicked) {
    return true;
  }
  return clickBaTjbaVisibleAdvance(page);
}

async function clickBaTjbaVisibleAdvance(page) {
  return page
    .evaluate(() => {
      const normalizeText = (value) =>
        String(value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
      const visible = (element) => {
        const style = window.getComputedStyle(element);
        return Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length) && style.visibility !== "hidden" && style.display !== "none";
      };
      const buttons = [...document.querySelectorAll("button, input[type='button'], input[type='submit']")].filter((element) => visible(element));
      const button = buttons.find((element) => /avancar|avançar/i.test(normalizeText(element.innerText || element.value || "")));
      if (!button) return false;
      button.click();
      return true;
    })
    .catch(() => false);
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
  await locator
    .evaluate((element) => {
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.dispatchEvent(new Event("blur", { bubbles: true }));
    })
    .catch(() => {});
  return true;
}

async function setPrimeFacesSelect(page, selector, valueOrLabel) {
  const wanted = String(valueOrLabel || "").trim();
  if (!wanted) {
    return false;
  }
  return page
    .evaluate(
      ({ selectorValue, wantedValue }) => {
        const normalizeText = (value) =>
          String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
        const select = document.querySelector(selectorValue);
        if (!select) return false;
        const wantedNormalized = normalizeText(wantedValue);
        const option =
          [...select.options].find((item) => item.value === wantedValue) ||
          [...select.options].find((item) => normalizeText(item.textContent).includes(wantedNormalized));
        if (!option) return false;
        select.value = option.value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        select.dispatchEvent(new Event("blur", { bubbles: true }));
        const rootId = select.id.replace(/_input$/, "");
        const label = document.getElementById(`${rootId}_label`);
        if (label) {
          label.textContent = option.textContent || option.value;
          label.classList.remove("ui-state-disabled");
        }
        return true;
      },
      { selectorValue: selector, wantedValue: wanted },
    )
    .catch(() => false);
}

async function selectCeNativeOption(page, selector, value) {
  const wanted = String(value || "").trim();
  if (!wanted) {
    return false;
  }
  const locator = page.locator(selector);
  if (!(await locator.count().catch(() => 0))) {
    return false;
  }
  const selected = await locator
    .selectOption(wanted, { timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 8000) })
    .then(() => true)
    .catch(() => false);
  if (!selected) {
    return false;
  }
  await page.waitForLoadState("domcontentloaded", { timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 8000) }).catch(() => {});
  await page.waitForTimeout(1400);
  return true;
}

function formatCep(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return String(value || "").trim();
}

function knownMunicipality(value) {
  const normalizedValue = normalize(value);
  const known = {
    jundiai: { code: "3525904", name: "Jundiaí", uf: "SP" },
    "jundiaí": { code: "3525904", name: "Jundiaí", uf: "SP" },
    manaus: { code: "1302603", name: "Manaus", uf: "AM" },
  };
  return known[normalizedValue] || null;
}

async function setEsajMunicipalityValue(page, { nameSelector, codeSelector, ufSelector, value }) {
  const text = String(value || "").trim();
  if (!text) {
    return false;
  }
  const filled = await safeFillVisible(page, nameSelector, text);
  const match = knownMunicipality(text);
  if (!match) {
    return filled;
  }
  return page
    .evaluate(
      ({ nameSelectorValue, codeSelectorValue, ufSelectorValue, city }) => {
        const name = document.querySelector(nameSelectorValue);
        const code = document.querySelector(codeSelectorValue);
        const uf = document.querySelector(ufSelectorValue);
        if (!name) return false;
        name.value = city.name;
        if (code) code.value = city.code;
        if (uf) uf.value = city.uf;
        [name, code, uf].filter(Boolean).forEach((element) => {
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
          element.dispatchEvent(new Event("blur", { bubbles: true }));
        });
        return true;
      },
      {
        nameSelectorValue: nameSelector,
        codeSelectorValue: codeSelector,
        ufSelectorValue: ufSelector,
        city: match,
      },
    )
    .catch(() => filled);
}

async function selectEsajLookupValue(page, { fieldSelector, value, fallbackValue = "", popupTitle }) {
  const wanted = String(value || fallbackValue || "").trim();
  if (!wanted) {
    return false;
  }

  const field = page.locator(fieldSelector).first();
  const usable = await field
    .evaluate((element) => {
      const style = window.getComputedStyle(element);
      const visible = Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
      return visible && !element.disabled && !element.readOnly && style.visibility !== "hidden" && style.display !== "none";
    })
    .catch(() => false);
  if (!usable) {
    return false;
  }

  const opened = await field
    .evaluate((element) => {
      const table = element.closest("table.spwInputSelect");
      const lookup = table?.querySelector('img[title*="consulta"], img[src*="botProcurar"]');
      if (!lookup) return false;
      lookup.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      lookup.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
      lookup.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      return true;
    })
    .catch(() => false);
  if (!opened) {
    return false;
  }

  const hardSetNationality = () =>
    field
      .evaluate((element) => {
        const table = element.closest("table.spwInputSelect");
        const codeInput =
          table?.querySelector('input[name="entity.nacionalidade.cdNacionalidade"], #inputCdNacionalidade') ||
          document.querySelector('input[name="entity.nacionalidade.cdNacionalidade"], #inputCdNacionalidade');
        if (!codeInput) return false;
        codeInput.value = "1";
        element.value = "Brasileira";
        [codeInput, element].forEach((control) => {
          control.dispatchEvent(new Event("input", { bubbles: true }));
          control.dispatchEvent(new Event("change", { bubbles: true }));
          control.dispatchEvent(new Event("blur", { bubbles: true }));
        });
        document.querySelector("iframe#layerFormConsulta")?.remove();
        document.querySelector("#divLayerFormConsulta")?.remove();
        return true;
      })
      .catch(() => false);

  const frameSelector = "iframe#layerFormConsulta";
  await page.locator(frameSelector).waitFor({ state: "attached", timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 8000) }).catch(() => {});
  const frame = page.frameLocator(frameSelector);
  const option = frame.locator('input[name="rowSelect"][title="Brasileira"]');
  await option.first().waitFor({ state: "attached", timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 8000) }).catch(() => {});
  if (!(await option.count().catch(() => 0))) {
    return hardSetNationality();
  }
  await option.first().check({ force: true, timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 5000) });
  const selectedTitle = await frame.locator('input[name="rowSelect"]:checked').first().getAttribute("title").catch(() => "");
  if (normalize(selectedTitle) !== "brasileira") {
    return hardSetNationality();
  }

  const readSelection = () =>
    field
      .evaluate((element) => {
        const table = element.closest("table.spwInputSelect");
        const code =
          table?.querySelector('input[name="entity.nacionalidade.cdNacionalidade"], #inputCdNacionalidade')?.value ||
          document.querySelector('input[name="entity.nacionalidade.cdNacionalidade"], #inputCdNacionalidade')?.value ||
          "";
        const description = String(element.value || "");
        return {
          code,
          description,
          lookupOpen: Boolean(document.querySelector("iframe#layerFormConsulta")),
        };
      })
      .catch(() => ({ code: "", description: "", lookupOpen: false }));

  await frame.locator("#pbSelecionar").click({ force: true, timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 5000) }).catch(() => {});
  await page.waitForTimeout(900);
  let selection = await readSelection();
  if (selection.code === "1" && /brasileir/i.test(selection.description)) {
    return true;
  }

  const popupFrame = page.frames().find((item) => /searchNacionalidade/i.test(item.url()));
  if (popupFrame) {
    await popupFrame
      .evaluate(() => {
        const rows = [...document.querySelectorAll("tr")];
        const row = rows.find((candidate) => candidate.querySelector('input[name="rowSelect"][title="Brasileira"]'));
        const radio = row?.querySelector('input[name="rowSelect"][title="Brasileira"]');
        if (!row || !radio) return false;
        if (typeof window.mudarSelecaoRegistroAtual === "function") {
          window.mudarSelecaoRegistroAtual(row);
        }
        radio.checked = true;
        radio.dispatchEvent(new Event("input", { bubbles: true }));
        radio.dispatchEvent(new Event("change", { bubbles: true }));
        if (typeof window.selecionarRegistroAtual === "function") {
          window.selecionarRegistroAtual(row);
          return true;
        }
        if (typeof window.selecionarRegistros === "function") {
          window.selecionarRegistros();
          return true;
        }
        document.querySelector("#pbSelecionar")?.click();
        return true;
      })
      .catch(() => false);
    await page.waitForTimeout(900);
    selection = await readSelection();
    if (selection.code === "1" && /brasileir/i.test(selection.description)) {
      return true;
    }
  }

  return hardSetNationality();
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

async function selectByLabelLike(page, pattern, value) {
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
        const wanted = normalizeText(textValue);
        const visible = (element) => {
          const style = window.getComputedStyle(element);
          return Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length) && style.visibility !== "hidden" && style.display !== "none";
        };
        const selects = [...document.querySelectorAll("select")].filter((element) => visible(element) && !element.disabled);
        for (const select of selects) {
          const label = [
            select.getAttribute("aria-label"),
            select.name,
            select.id,
            select.closest("label")?.innerText,
            select.closest(".form-group, .v-input, .q-field, .row, div")?.innerText,
          ].join(" ");
          if (!pattern.test(normalizeText(label))) {
            continue;
          }
          const options = [...select.options];
          const option =
            options.find((item) => {
              const candidate = normalizeText(`${item.textContent} ${item.value}`);
              return candidate === wanted || candidate.includes(wanted) || wanted.includes(candidate);
            }) ||
            options.find((item) => normalizeText(item.textContent || item.value)) ||
            null;
          if (!option) {
            return false;
          }
          select.value = option.value;
          select.dispatchEvent(new Event("input", { bubbles: true }));
          select.dispatchEvent(new Event("change", { bubbles: true }));
          select.dispatchEvent(new Event("blur", { bubbles: true }));
          return true;
        }
        return false;
      },
      { source: pattern.source, flags: pattern.flags.includes("i") ? pattern.flags : `${pattern.flags}i`, textValue: text },
    )
    .catch(() => false);
}

async function selectMtCertificateType(page, certificateId) {
  const wantedText = certificateId === "criminal" ? "criminal" : "civel";
  const antSelect = page.locator(".ant-select-selection").first();
  if (await antSelect.count().catch(() => 0)) {
    await antSelect.click({ force: true, timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 5000) }).catch(() => {});
    await page.waitForTimeout(500).catch(() => {});
    const treeCheckbox = page.locator(".ant-select-tree-checkbox").nth(certificateId === "criminal" ? 0 : 1);
    if (await treeCheckbox.count().catch(() => 0)) {
      await treeCheckbox.click({ force: true, timeout: envNumber("STATE_COURT_FIELD_TIMEOUT_MS", 5000) }).catch(() => {});
      await page.waitForTimeout(400).catch(() => {});
      await page.keyboard.press("Escape").catch(() => {});
      return true;
    }
    const targetBox = await page
      .evaluate((wanted) => {
        const normalizeText = (value) =>
          String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
        const items = [...document.querySelectorAll(".ant-select-tree li")];
        const item = items.find((element) => normalizeText(element.textContent).includes(wanted));
        const target = item?.querySelector(".ant-select-tree-checkbox") || item?.querySelector(".ant-select-tree-title") || item;
        if (!target) return null;
        const rect = target.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      }, wantedText)
      .catch(() => null);
    if (targetBox) {
      await page.mouse.click(targetBox.x, targetBox.y).catch(() => {});
      await page.waitForTimeout(400).catch(() => {});
      await page.keyboard.press("Escape").catch(() => {});
      return true;
    }
  }

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

async function chooseTjsePersonType(page, isCompany) {
  return page.evaluate((shouldChooseCompany) => {
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      return (
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
      );
    };
    const normalizeText = (value) =>
      String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const radios = [...document.querySelectorAll('mat-radio-button, input[type="radio"]')].filter(visible);
    const wanted = shouldChooseCompany ? /juridica|cnpj/ : /fisica|cpf/;
    const byText = radios.find((element) => wanted.test(normalizeText(element.innerText || element.closest("label, div")?.innerText || "")));
    const target = byText || radios[shouldChooseCompany ? 1 : 0];
    if (!target) return false;
    const input = target.matches?.('input[type="radio"]') ? target : target.querySelector?.('input[type="radio"]');
    const clickable = input || target;
    clickable.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    if (input) {
      input.checked = true;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return true;
  }, Boolean(isCompany)).catch(() => false);
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

async function findVisiblePdfLink(page) {
  const links = page.locator("a[href*='.pdf'], a[href*='Download'], a[href*='download'], a[href*='Certidao']");
  const count = await links.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const link = links.nth(index);
    if (!(await link.isVisible().catch(() => false))) {
      continue;
    }
    const href = await link.getAttribute("href").catch(() => "");
    if (!href) {
      continue;
    }
    const text = await link.innerText().catch(() => "");
    const combined = `${href} ${text}`;
    if (/manual|provimento|ato|orienta[cç][aã]o|exclusaoFiltros|exclus[aã]o\s+de\s+filtros|decis[aã]o/i.test(combined)) {
      continue;
    }
    try {
      return new URL(href, page.url()).toString();
    } catch {
      continue;
    }
  }
  return "";
}

async function collectAllCertificates({ context, input, firstName, motherName, fatherName }) {
  const results = [];
  const certificateTypes = getCertificateTypesForInput(input);
  await notifyTjdftProgress(input, {
    stage: "portal_started",
    completed: 0,
    total: certificateTypes.length,
    currentCertificate: certificateTypes[0]?.label || "",
    currentCertificateId: certificateTypes[0]?.id || "",
    certidoes: [],
  });
  for (const certificateType of certificateTypes) {
    await notifyTjdftProgress(input, {
      stage: "certificate_started",
      completed: results.length,
      total: certificateTypes.length,
      currentCertificate: certificateType.label,
      currentCertificateId: certificateType.id,
      certidoes: results.map(toTjdftProgressCertificate),
    });
    const result = await collectCertificate({ context, input, firstName, motherName, fatherName, certificateType });
    results.push(result);
    const nextCertificate = certificateTypes[results.length];
    await notifyTjdftProgress(input, {
      stage: nextCertificate ? "certificate_completed" : "portal_completed",
      completed: results.length,
      total: certificateTypes.length,
      currentCertificate: nextCertificate?.label || "",
      currentCertificateId: nextCertificate?.id || "",
      certidoes: results.map(toTjdftProgressCertificate),
    });
  }
  return results;
}

function toTjdftProgressCertificate(certificate = {}) {
  return {
    tipo: certificate.tipo || "",
    status: certificate.status || "",
    resultado: certificate.resultado || "",
    pdfPath: certificate.pdfPath || "",
    pdfDownloaded: Boolean(certificate.pdfDownloaded || certificate.pdfPath),
    errorMessage: certificate.errorMessage || "",
  };
}

async function notifyTjdftProgress(input, progress) {
  if (typeof input?.onProgress !== "function") return;
  try {
    await input.onProgress(progress);
  } catch {
    // Progress telemetry must never interrupt certificate issuance.
  }
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

export function getTjdftPfMissingFields({ firstName, motherName, certificateTypes = CERTIFICATE_TYPES } = {}) {
  const missingFields = [];
  if (!String(firstName || "").trim()) missingFields.push("firstName");
  const needsMotherName = certificateTypes.some((certificateType) =>
    ["criminal", "especial"].includes(String(certificateType?.id || certificateType)),
  );
  if (needsMotherName && !String(motherName || "").trim()) missingFields.push("motherName");
  return missingFields;
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
  const compact = normalized.replace(/\s+/g, "");
  return (
    normalized.includes("nada consta") ||
    normalized.includes("nao consta") ||
    compact.includes("nadaconsta") ||
    compact.includes("naoconsta") ||
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
    normalized.includes("certidao gerada") ||
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
