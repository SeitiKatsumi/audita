import crypto from "node:crypto";

import { validateCpf } from "./audit.service.mjs";

const DEFAULT_BASE_URL = "https://apiv3.directd.com.br/api";
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000;

function cleanText(value, maxLength = 200) {
  return String(value || "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function providerFailure(status) {
  if (status === 401) return "provider_authentication_failed";
  if (status === 403) return "provider_permission_or_balance_required";
  if (status === 404) return "person_not_found";
  if (status === 408) return "provider_timeout";
  if (status === 429) return "provider_rate_limited";
  if (status === 503) return "provider_temporarily_unavailable";
  return "provider_request_failed";
}

export function normalizePersonName(value) {
  return cleanText(value, 180)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function personNamesMatch(informedName, providerName) {
  const informed = normalizePersonName(informedName);
  const provider = normalizePersonName(providerName);
  return Boolean(informed && provider && informed === provider);
}

export function normalizeDirectDataPersonResponse(payload = {}) {
  const source = payload.retorno && typeof payload.retorno === "object" ? payload.retorno : {};
  const metadata = payload.metaDados && typeof payload.metaDados === "object" ? payload.metaDados : {};
  return {
    fullName: cleanText(source.nome, 180),
    motherName: cleanText(source.nomeMae, 180),
    providerReference: cleanText(metadata.consultaUid, 100),
  };
}

export function createDirectDataPersonService({
  env = process.env,
  fetchImpl = globalThis.fetch,
  creditsService = null,
  recordApiUsage = null,
  now = () => new Date(),
} = {}) {
  const enabled = String(env.DIRECT_DATA_PERSON_ENABLED || "false").toLowerCase() === "true";
  const token = cleanText(env.DIRECT_DATA_TOKEN, 500);
  const baseUrl = cleanText(env.DIRECT_DATA_API_BASE_URL, 500) || DEFAULT_BASE_URL;
  const timeoutMs = positiveInteger(env.DIRECT_DATA_PERSON_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const cacheTtlMs = positiveInteger(env.DIRECT_DATA_PERSON_CACHE_TTL_MS, DEFAULT_CACHE_TTL_MS);
  const creditCost = positiveInteger(env.DIRECT_DATA_PERSON_CREDIT_COST, 1);
  const queryCostBrl = positiveNumber(env.DIRECT_DATA_PERSON_QUERY_COST_BRL, 0.36);
  const cache = new Map();
  const pending = new Map();

  function getStatus() {
    return {
      enabled,
      configured: Boolean(enabled && token && token !== "change-me" && /^https:\/\//i.test(baseUrl)),
      provider: "Direct Data",
      service: "Cadastro - Pessoa Física - Básica",
      creditCost,
      queryCostBrl,
      mode: "paid_read_only",
    };
  }

  async function recordUsage(authContext, result, referenceId) {
    if (typeof recordApiUsage !== "function") return;
    try {
      await recordApiUsage(authContext, {
        provider: "directdata",
        service: "person_basic_data",
        operation: "seller_identity_enrichment",
        status: result?.status === "success" ? "success" : "failed",
        requestCount: 1,
        quantity: result?.status === "success" ? 1 : 0,
        unitName: "consulta",
        referenceId: result?.providerReference || referenceId || crypto.randomUUID(),
        actualCost: result?.status === "success" ? queryCostBrl : null,
        currency: "BRL",
        metadata: {
          purpose: "df_seller_certificate_issuance",
          motherNameReturned: Boolean(result?.motherName),
        },
      });
    } catch {
      // Telemetry must never change the provider result.
    }
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

  async function executeLookup({ cpf, requestId }, authContext) {
    const configuration = getStatus();
    if (!configuration.configured) {
      return {
        unavailable: true,
        reason: enabled ? "direct_data_token_missing" : "direct_data_person_disabled",
        configuration,
      };
    }

    if (creditsService) {
      const wallet = await creditsService.getWallet(authContext);
      if (wallet.enabled && wallet.balance < creditCost) {
        return { insufficientCredits: true, creditCost, wallet, configuration };
      }
    }

    const url = new URL(`${baseUrl.replace(/\/+$/, "")}/CadastroPessoaFisica`);
    url.searchParams.set("CPF", cpf);
    url.searchParams.set("TOKEN", token);

    let response;
    let payload;
    try {
      response = await fetchProvider(url);
      payload = parseJson(await response.text());
    } catch (error) {
      const result = {
        failed: true,
        status: "failed",
        reason: error?.name === "AbortError" ? "provider_timeout" : "provider_connection_failed",
        providerRequestSubmitted: true,
        billingVerificationRequired: true,
        configuration,
      };
      await recordUsage(authContext, result, requestId);
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
        providerReference: cleanText(payload?.metaDados?.consultaUid, 100),
        configuration,
      };
      await recordUsage(authContext, result, requestId);
      return result;
    }

    const identity = normalizeDirectDataPersonResponse(payload);
    if (!identity.fullName) {
      const result = {
        failed: true,
        status: "failed",
        reason: "provider_empty_response",
        providerReference: identity.providerReference,
        configuration,
      };
      await recordUsage(authContext, result, requestId);
      return result;
    }

    const result = {
      status: "success",
      ...identity,
      queriedAt: now().toISOString(),
    };

    if (creditsService) {
      const charge = await creditsService.consume(authContext, {
        amount: creditCost,
        referenceId: result.providerReference || requestId || crypto.randomUUID(),
        operation: "direct_data_person_basic",
        metadata: { provider: "directdata", purpose: "df_seller_certificate_issuance" },
      });
      if (!charge.ok) {
        await recordUsage(authContext, result, requestId);
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

    await recordUsage(authContext, result, requestId);
    return { result, configuration };
  }

  async function lookup(input = {}, authContext = {}) {
    const cpf = String(input.cpf || "").replace(/\D/g, "");
    if (!validateCpf(cpf)) return { invalid: true, reason: "invalid_cpf", configuration: getStatus() };
    if (input.authorizationConfirmed !== true) {
      return { invalid: true, reason: "authorization_required", configuration: getStatus() };
    }

    const tenantScope = cleanText(authContext?.tenantId, 100) || "public";
    const cacheKey = crypto.createHash("sha256").update(`${tenantScope}:${cpf}`).digest("hex");
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < cacheTtlMs) {
      return {
        result: { ...cached.result, cacheHit: true },
        configuration: getStatus(),
      };
    }
    if (pending.has(cacheKey)) return pending.get(cacheKey);

    const request = executeLookup(
      { cpf, requestId: cleanText(input.requestId, 100) },
      authContext,
    ).then((response) => {
      if (response?.result?.status === "success") {
        cache.set(cacheKey, { createdAt: Date.now(), result: response.result });
      }
      return response;
    }).finally(() => pending.delete(cacheKey));

    pending.set(cacheKey, request);
    return request;
  }

  return { getStatus, lookup };
}
