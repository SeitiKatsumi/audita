import crypto from "node:crypto";

import {
  isValidDocument,
  maskDocument,
  normalizeDocument,
} from "./audit.service.mjs";

const DEFAULT_BASE_URL = "https://apiv3.directd.com.br/api";
const DEFAULT_TIMEOUT_MS = 90000;
const DEFAULT_POLL_INTERVAL_MS = 1500;
const DEFAULT_POLL_ATTEMPTS = 20;

export const DIRECT_DATA_CERTIFICATE_CONFIRMED_UFS = Object.freeze([
  "AC",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "RN",
  "RR",
  "RS",
  "SE",
  "TO",
]);

export const DIRECT_DATA_CERTIFICATE_ALL_UFS = Object.freeze([
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
]);

export const DIRECT_DATA_CERTIFICATE_EXPERIMENTAL_UFS = Object.freeze(
  DIRECT_DATA_CERTIFICATE_ALL_UFS.filter(
    (uf) => !DIRECT_DATA_CERTIFICATE_CONFIRMED_UFS.includes(uf),
  ),
);

export const DIRECT_DATA_CERTIFICATE_TYPES = Object.freeze([
  "C\u00edvel",
  "Criminal",
  "Fiscal",
  "FinsEleitorais",
  "Fal\u00eanciaRecupera\u00e7\u00e3o",
  "Fam\u00edlia",
  "Militar",
]);

const UF_SET = new Set(DIRECT_DATA_CERTIFICATE_ALL_UFS);
const TYPE_BY_KEY = new Map(
  DIRECT_DATA_CERTIFICATE_TYPES.map((type) => [plainKey(type), type]),
);

for (const [alias, canonical] of [
  ["civil", "C\u00edvel"],
  ["civel", "C\u00edvel"],
  ["fins eleitorais", "FinsEleitorais"],
  ["eleitoral", "FinsEleitorais"],
  ["falencia", "Fal\u00eanciaRecupera\u00e7\u00e3o"],
  ["recuperacao judicial", "Fal\u00eanciaRecupera\u00e7\u00e3o"],
  ["familia", "Fam\u00edlia"],
]) {
  TYPE_BY_KEY.set(plainKey(alias), canonical);
}

function cleanText(value, maxLength = 400) {
  return String(value || "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function plainKey(value) {
  return cleanText(value, 120)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseUfList(value, fallback) {
  const parsed = String(value || "")
    .split(",")
    .map((uf) => uf.trim().toUpperCase())
    .filter((uf) => UF_SET.has(uf));
  return parsed.length ? [...new Set(parsed)] : [...fallback];
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function safeEvidenceUrl(value) {
  const candidate = cleanText(value, 2000);
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === 1) return true;
  if (value === 0) return false;
  const key = plainKey(value);
  if (
    ["sim", "true", "positivo", "positiva", "consta", "possui ocorrencia"].includes(
      key,
    )
  ) {
    return true;
  }
  if (
    [
      "nao",
      "false",
      "negativo",
      "negativa",
      "nada consta",
      "sem ocorrencia",
      "nao possui ocorrencia",
    ].includes(key)
  ) {
    return false;
  }
  return null;
}

function providerFailure(status) {
  if (status === 401) return "provider_authentication_failed";
  if (status === 403) return "provider_permission_or_balance_required";
  if (status === 429) return "provider_rate_limited";
  if ([408, 503].includes(status)) return "provider_temporarily_unavailable";
  if (status === 400) return "provider_rejected_parameters";
  if (status === 404) return "provider_result_not_found";
  return "provider_request_failed";
}

function normalizedCoverage(uf, confirmedUfs) {
  return confirmedUfs.includes(uf) ? "confirmed" : "experimental";
}

export function normalizeCertificateType(value) {
  return TYPE_BY_KEY.get(plainKey(value)) || "";
}

export function normalizeDirectDataCertificateRequest(input = {}) {
  const document = normalizeDocument(input.document);
  const inferredDocumentType =
    document.length === 11 ? "cpf" : document.length === 14 ? "cnpj" : "";
  const requestedDocumentType = cleanText(input.documentType, 8).toLowerCase();
  const documentType = ["cpf", "cnpj"].includes(requestedDocumentType)
    ? requestedDocumentType
    : inferredDocumentType;
  const genderKey = plainKey(input.gender);
  const gender =
    genderKey === "masculino"
      ? "Masculino"
      : genderKey === "feminino"
        ? "Feminino"
        : "";

  return {
    authorizationConfirmed: input.authorizationConfirmed === true,
    paidQueryConfirmed: input.paidQueryConfirmed === true,
    requestId: cleanText(input.requestId, 100),
    uf: cleanText(input.uf, 2).toUpperCase(),
    certificateType: normalizeCertificateType(
      input.certificateType || input.type,
    ),
    document,
    documentType,
    fullName: cleanText(input.fullName || input.name, 180),
    birthDate: cleanText(input.birthDate, 10),
    motherName: cleanText(input.motherName, 180),
    fatherName: cleanText(input.fatherName, 180),
    rg: cleanText(input.rg, 30),
    gender,
    generatePdf: input.generatePdf === true,
  };
}

export function validateDirectDataCertificateRequest(
  request,
  allowedUfs = DIRECT_DATA_CERTIFICATE_ALL_UFS,
) {
  if (!request.authorizationConfirmed) return "authorization_required";
  if (!request.paidQueryConfirmed) return "paid_query_confirmation_required";
  if (!allowedUfs.includes(request.uf)) return "unsupported_uf";
  if (!request.certificateType) return "invalid_certificate_type";
  if (
    !["cpf", "cnpj"].includes(request.documentType) ||
    !isValidDocument(request.documentType, request.document)
  ) {
    return "invalid_document";
  }
  if (
    request.birthDate &&
    !/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(request.birthDate)
  ) {
    return "invalid_birth_date";
  }
  return "";
}

export function analyzeDirectDataCertificateOccurrence(value) {
  const occurrence = normalizeBoolean(value);
  if (occurrence === true) {
    return {
      outcome: "occurrence_found",
      risk: "high",
      occurrence: true,
      summary:
        "O provedor informou ocorrência nesta certidão. Revise o documento e o portal oficial antes de qualquer decisão.",
    };
  }
  if (occurrence === false) {
    return {
      outcome: "no_occurrence_reported",
      risk: "low",
      occurrence: false,
      summary:
        "O provedor não informou ocorrência nesta certidão na data da consulta.",
    };
  }
  return {
    outcome: "inconclusive",
    risk: "review",
    occurrence: null,
    summary:
      "O retorno não permite concluir se há ocorrência. A certidão precisa de revisão humana.",
  };
}

export function normalizeDirectDataCertificateResponse(
  payload = {},
  request = {},
  { confirmedUfs = DIRECT_DATA_CERTIFICATE_CONFIRMED_UFS, now = new Date() } = {},
) {
  const metadata = payload.metaDados || payload.metadados || {};
  const source = payload.retorno || payload.resultado || {};
  const analysis = analyzeDirectDataCertificateOccurrence(
    source.possuiOcorrencia,
  );
  const evidenceUrl = safeEvidenceUrl(
    metadata.urlComprovante || source.urlComprovante,
  );

  return {
    status: "success",
    provider: "Direct Data",
    source:
      "TJ - Certidão Cível, Criminal e Fiscal - Tribunal de Justiça",
    uf: cleanText(source.uf || request.uf, 2).toUpperCase(),
    coverage: normalizedCoverage(request.uf, confirmedUfs),
    certificateType: cleanText(
      source.tipoCertidao || request.certificateType,
      80,
    ),
    subjectMasked: maskDocument(request.documentType, request.document),
    queriedAt: now.toISOString(),
    providerReference: cleanText(metadata.consultaUid, 100),
    providerMessage: cleanText(metadata.mensagem, 300),
    certificate: {
      entityName: cleanText(source.nomeEntidade, 180),
      issueDate: cleanText(source.dataEmissao, 40),
      expiryDate: cleanText(source.dataValidade, 40),
      number: cleanText(source.numeroCertidao, 120),
      validationCode: cleanText(source.codigoValidacao, 160),
      status: cleanText(source.status, 120),
      observation: cleanText(source.observacao, 500),
      evidenceUrl: request.generatePdf ? evidenceUrl : "",
    },
    analysis,
    disclaimer:
      "Resultado obtido via provedor de dados. Confirme autenticidade, validade e efeitos jurídicos no tribunal emissor.",
  };
}

export function createDirectDataCertificatesService({
  env = process.env,
  fetchImpl = globalThis.fetch,
  creditsService = null,
  recordApiUsage = null,
  now = () => new Date(),
  delay = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  const token = cleanText(env.DIRECT_DATA_TOKEN, 500);
  const enabled =
    String(env.DIRECT_DATA_CERTIFICATE_ENABLED || "false").toLowerCase() ===
    "true";
  const baseUrl =
    cleanText(env.DIRECT_DATA_API_BASE_URL, 500) || DEFAULT_BASE_URL;
  const allowedUfs = parseUfList(
    env.DIRECT_DATA_CERTIFICATE_ALLOWED_UFS,
    DIRECT_DATA_CERTIFICATE_ALL_UFS,
  );
  const confirmedUfs = parseUfList(
    env.DIRECT_DATA_CERTIFICATE_CONFIRMED_UFS,
    DIRECT_DATA_CERTIFICATE_CONFIRMED_UFS,
  );
  const timeoutMs = positiveInteger(
    env.DIRECT_DATA_CERTIFICATE_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
  );
  const pollIntervalMs = positiveInteger(
    env.DIRECT_DATA_CERTIFICATE_POLL_INTERVAL_MS,
    DEFAULT_POLL_INTERVAL_MS,
  );
  const pollAttempts = positiveInteger(
    env.DIRECT_DATA_CERTIFICATE_POLL_ATTEMPTS,
    DEFAULT_POLL_ATTEMPTS,
  );
  const creditCost = positiveInteger(
    env.DIRECT_DATA_CERTIFICATE_CREDIT_COST,
    1,
  );
  const queryCostBrl = positiveNumber(
    env.DIRECT_DATA_CERTIFICATE_QUERY_COST_BRL,
    0.36,
  );
  const pdfSurchargeRate = positiveNumber(
    env.DIRECT_DATA_CERTIFICATE_PDF_SURCHARGE_RATE,
    0.5,
  );
  const requestCache = new Map();

  function getStatus() {
    const configured = Boolean(
      enabled && token && token !== "change-me" && /^https:\/\//i.test(baseUrl),
    );
    const pdfSurchargeBrl = Number(
      (queryCostBrl * pdfSurchargeRate).toFixed(2),
    );
    const pdfTotalCostBrl = Number(
      (queryCostBrl + pdfSurchargeBrl).toFixed(2),
    );
    return {
      enabled,
      configured,
      provider: "Direct Data",
      source:
        "TJ - Certidão Cível, Criminal e Fiscal - Tribunal de Justiça",
      allowedUfs: [...allowedUfs],
      confirmedUfs: allowedUfs.filter((uf) => confirmedUfs.includes(uf)),
      experimentalUfs: allowedUfs.filter((uf) => !confirmedUfs.includes(uf)),
      certificateTypes: [...DIRECT_DATA_CERTIFICATE_TYPES],
      creditCost,
      queryCostBrl,
      pdfSurchargeBrl,
      pdfTotalCostBrl,
      pricingNote: `Consulta sem PDF: R$ ${queryCostBrl.toFixed(2)}. Consulta com PDF, total: R$ ${pdfTotalCostBrl.toFixed(2)}.`,
      docsUrl:
        "https://apiv3.directd.com.br/swagger/index.html",
      marketplaceUrl:
        "https://app.directd.com.br/marketplace/detalhes-da-api/tj-certidao-civel-criminal-e-fiscal-tribunal-de-justica",
      mode: "paid_read_only",
      retryPolicy: "manual_after_provider_history_check",
    };
  }

  async function fetchProvider(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(url, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async function pollAsyncResult(consultaUid) {
    for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
      if (attempt > 0) await delay(pollIntervalMs);
      const url = new URL(
        `${baseUrl.replace(/\/+$/, "")}/Historico/ObterRetornoConsultaAsync`,
      );
      url.searchParams.set("TOKEN", token);
      url.searchParams.set("ConsultaUid", consultaUid);
      const response = await fetchProvider(url);
      const payload = parseJson(await response.text());
      if (response.ok && response.status === 200 && payload?.retorno) {
        return { response, payload };
      }
      if (![201, 202].includes(response.status)) {
        return { response, payload };
      }
    }
    return { timedOut: true };
  }

  async function recordUsage(authContext, result, request, referenceId) {
    if (typeof recordApiUsage !== "function") return;
    try {
      const success = result?.status === "success";
      await recordApiUsage(authContext, {
        provider: "directdata",
        service: "tj_certificate",
        operation: "certificate_query",
        status: success ? "success" : "failed",
        requestCount: 1,
        quantity: success ? 1 : 0,
        unitName: "consulta",
        referenceId:
          result?.providerReference || referenceId || crypto.randomUUID(),
        actualCost: success
          ? Number(
              (
                queryCostBrl *
                (request.generatePdf ? 1 + pdfSurchargeRate : 1)
              ).toFixed(2),
            )
          : null,
        currency: "BRL",
        metadata: {
          uf: request.uf,
          certificateType: request.certificateType,
          documentType: request.documentType,
          generatePdf: request.generatePdf,
          coverage: normalizedCoverage(request.uf, confirmedUfs),
          outcome: result?.analysis?.outcome || "",
        },
      });
    } catch {
      // Telemetry must never change the provider result.
    }
  }

  async function executeQuery(input, authContext) {
    const configuration = getStatus();
    if (!configuration.configured) {
      return {
        unavailable: true,
        reason: enabled
          ? "direct_data_token_missing"
          : "direct_data_certificates_disabled",
        configuration,
      };
    }

    const request = normalizeDirectDataCertificateRequest(input);
    const validationError = validateDirectDataCertificateRequest(
      request,
      allowedUfs,
    );
    if (validationError === "unsupported_uf") {
      return {
        unsupported: true,
        reason: validationError,
        allowedUfs: [...allowedUfs],
        configuration,
      };
    }
    if (validationError) {
      return { invalid: true, reason: validationError, configuration };
    }

    if (creditsService) {
      const wallet = await creditsService.getWallet(authContext);
      if (wallet.enabled && wallet.balance < creditCost) {
        return {
          insufficientCredits: true,
          creditCost,
          wallet,
          configuration,
        };
      }
    }

    const url = new URL(
      `${baseUrl.replace(/\/+$/, "")}/TJCertidaoCivelCriminalFiscal`,
    );
    url.searchParams.set("TOKEN", token);
    url.searchParams.set(request.documentType.toUpperCase(), request.document);
    url.searchParams.set("UF", request.uf);
    url.searchParams.set("TIPO", request.certificateType);
    url.searchParams.set(
      "GERARCOMPROVANTE",
      request.generatePdf ? "Habilitar" : "Desabilitar",
    );
    for (const [parameter, value] of [
      ["NOME", request.fullName],
      ["DATANASCIMENTO", request.birthDate],
      ["NOMEMAE", request.motherName],
      ["NOMEPAI", request.fatherName],
      ["RG", request.rg],
      ["GENERO", request.gender],
    ]) {
      if (value) url.searchParams.set(parameter, value);
    }

    let response;
    let payload;
    try {
      response = await fetchProvider(url);
      payload = parseJson(await response.text());
      if ([201, 202].includes(response.status)) {
        const consultaUid = cleanText(
          payload?.metaDados?.consultaUid || payload?.consultaUid,
          100,
        );
        if (!consultaUid) {
          const result = {
            failed: true,
            status: "failed",
            reason: "provider_async_reference_missing",
            configuration,
          };
          await recordUsage(authContext, result, request, request.requestId);
          return result;
        }
        const polled = await pollAsyncResult(consultaUid);
        if (polled.timedOut) {
          const result = {
            failed: true,
            status: "failed",
            reason: "provider_async_timeout",
            providerReference: consultaUid,
            configuration,
          };
          await recordUsage(authContext, result, request, consultaUid);
          return result;
        }
        response = polled.response;
        payload = polled.payload;
      }
    } catch (error) {
      const result = {
        failed: true,
        status: "failed",
        reason:
          error?.name === "AbortError"
            ? "provider_timeout"
            : "provider_connection_failed",
        providerRequestSubmitted: true,
        billingVerificationRequired: true,
        configuration,
      };
      await recordUsage(authContext, result, request, request.requestId);
      return result;
    }

    if (!response.ok) {
      const result = {
        failed: true,
        status: "failed",
        reason: providerFailure(response.status),
        providerStatus: response.status,
        providerRequestSubmitted: true,
        billingVerificationRequired: true,
        providerReference: cleanText(
          payload?.metaDados?.consultaUid || payload?.consultaUid,
          100,
        ),
        configuration,
      };
      await recordUsage(authContext, result, request, request.requestId);
      return result;
    }

    if (!payload?.retorno || payload?.metaDados?.resultado === false) {
      const result = {
        failed: true,
        status: "failed",
        reason: "provider_empty_response",
        providerReference: cleanText(payload?.metaDados?.consultaUid, 100),
        configuration,
      };
      await recordUsage(authContext, result, request, request.requestId);
      return result;
    }

    const result = {
      ...normalizeDirectDataCertificateResponse(payload, request, {
        confirmedUfs,
        now: now(),
      }),
      configuration,
    };

    if (creditsService) {
      const charge = await creditsService.consume(authContext, {
        amount: creditCost,
        referenceId:
          result.providerReference || request.requestId || crypto.randomUUID(),
        operation: "direct_data_tj_certificate",
        metadata: {
          provider: "directdata",
          uf: request.uf,
          certificateType: request.certificateType,
          documentType: request.documentType,
          generatePdf: request.generatePdf,
        },
      });
      if (!charge.ok) {
        await recordUsage(authContext, result, request, request.requestId);
        return {
          insufficientCredits: true,
          providerCompleted: true,
          result,
          creditCost,
          wallet: charge.wallet,
          configuration,
        };
      }
      result.wallet = charge.wallet;
    }

    await recordUsage(authContext, result, request, request.requestId);
    return { result, configuration };
  }

  async function query(input = {}, authContext = {}) {
    const requestId = cleanText(input.requestId, 100);
    const tenantId = cleanText(authContext?.tenantId, 100) || "public";
    if (!requestId) return executeQuery(input, authContext);

    const cacheKey = `${tenantId}:${requestId}`;
    if (requestCache.has(cacheKey)) return requestCache.get(cacheKey);

    const task = executeQuery(input, authContext).then((result) => {
      if (
        result?.failed ||
        result?.unavailable ||
        result?.invalid ||
        result?.unsupported ||
        result?.insufficientCredits
      ) {
        requestCache.delete(cacheKey);
      }
      return result;
    });
    requestCache.set(cacheKey, task);
    if (requestCache.size > 200) {
      requestCache.delete(requestCache.keys().next().value);
    }
    return task;
  }

  return { getStatus, query };
}
