import crypto from "node:crypto";
import { isValidDocument, normalizeDocument } from "./audit.service.mjs";

const UFS = "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" ");
const OPTION = ["Desabilitar", "Habilitar"];
const DOCUMENTS = ["CPF", "CNPJ"];
const COMMON = [...DOCUMENTS, "GERARCOMPROVANTE"];
// Allowlist transcribed from the provider OpenAPI; no caller-supplied URL or token.
const ENDPOINTS = {
  CertidaoConjuntaDebitosPessoaFisica: { parameters: ["CPF", "DATANASCIMENTO", "GERARCOMPROVANTE"], required: ["DATANASCIMENTO"] },
  CertidaoConjuntaDebitosPessoaJuridica: { parameters: ["CNPJ", "GERARCOMPROVANTE"] },
  CertidaoNegativaDebitos: { parameters: [...COMMON, "UF", "IE"], required: ["UF"] },
  CertidaoNegativaDebitosMunicipal: { parameters: [...COMMON, "MUNICIPIO", "IM"], required: ["MUNICIPIO"] },
  CADINSecretariaFazendaEstaduais: { parameters: [...COMMON, "UF"], required: ["UF"] },
  CADINSecretariaFazendaSP: { parameters: COMMON },
  TSTCertidaoNegativaDebitosTrabalhistas: { parameters: COMMON },
  TribunalRegionalFederal: { parameters: [...COMMON, "REGIAO", "TIPO"], required: ["REGIAO", "TIPO"], regions: ["TRF1", "TRF2", "TRF3", "TRF4", "TRF5", "TRF6"], types: ["Cível", "Criminal", "FinsEleitorais"] },
  TribunalRegionalTrabalho: { parameters: [...COMMON, "REGIAO", "TIPO"], required: ["REGIAO"], regions: Array.from({ length: 24 }, (_, index) => String(index + 1)), types: ["Eletrônico", "Físico"] },
  ProtestosOnline: { parameters: DOCUMENTS },
  VinculosSocietarios: { parameters: DOCUMENTS },
  ReceitaPJParticipacaoSocietaria: { parameters: ["CNPJ"] },
  ReceitaFederalPessoaJuridica: { parameters: ["CNPJ", "QSA", "GERARCOMPROVANTE"] },
  CaixaRegularidadeEmpregadorFGTS: { parameters: COMMON },
  DetalhamentoNegativo: { parameters: DOCUMENTS },
  ProcessosJudiciaisAgrupada: { parameters: DOCUMENTS },
  ProcessosJudiciaisSimplificada: { parameters: DOCUMENTS },
  ProcessosJudiciaisCompleta: { parameters: DOCUMENTS },
};

export const DIRECT_DATA_SELLER_ENDPOINTS = Object.freeze(Object.keys(ENDPOINTS));

function field(object, name) {
  if (!object || typeof object !== "object") return undefined;
  const key = Object.keys(object).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : object[key];
}

function text(value) {
  return typeof value === "string" || typeof value === "number" ? String(value).normalize("NFC").trim() : "";
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function meaningful(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "object") return Object.values(value).some(meaningful);
  return typeof value === "boolean" || typeof value === "number";
}

function providerFailed(payload) {
  const metadata = field(payload, "metaDados");
  const result = field(metadata, "resultado");
  const resultId = field(metadata, "resultadoId");
  return !metadata || Number(resultId) !== 1 ||
    (result !== undefined && ![true, 1, "1", "sucesso", "success", "true"].includes(typeof result === "string" ? result.toLowerCase().trim() : result));
}

function normalizeParameters(endpoint, input) {
  const definition = ENDPOINTS[endpoint];
  if (!Object.hasOwn(ENDPOINTS, endpoint)) return { reason: "unsupported_endpoint" };
  if (!input || typeof input !== "object" || Array.isArray(input)) return { reason: "invalid_parameters" };
  const parameters = {};
  for (const key of Object.keys(input).sort()) {
    if (!definition.parameters.includes(key)) return { reason: "unsupported_parameter" };
    const value = text(input[key]);
    if (!value || value.length > 180 || /[\u0000-\u001f\u007f]/.test(value)) return { reason: "invalid_parameter" };
    parameters[key] = value;
  }
  const documentKeys = DOCUMENTS.filter((key) => parameters[key]);
  if (documentKeys.length !== 1) return { reason: "invalid_document" };
  const documentKey = documentKeys[0];
  if (!/^[\d.\-/\s]+$/.test(parameters[documentKey])) return { reason: "invalid_document" };
  parameters[documentKey] = normalizeDocument(parameters[documentKey]);
  if (!isValidDocument(documentKey.toLowerCase(), parameters[documentKey])) return { reason: "invalid_document" };
  if ((definition.required || []).some((key) => !parameters[key])) return { reason: "required_parameter_missing" };
  for (const key of ["GERARCOMPROVANTE", "QSA"]) {
    if (parameters[key] && !OPTION.includes(parameters[key])) return { reason: "invalid_parameter_option" };
  }
  if (parameters.UF && !UFS.includes(parameters.UF)) return { reason: "invalid_uf" };
  if (parameters.REGIAO && !definition.regions?.includes(parameters.REGIAO)) return { reason: "invalid_region" };
  if (parameters.TIPO && !definition.types?.includes(parameters.TIPO)) return { reason: "invalid_certificate_type" };
  if (parameters.MUNICIPIO && !new RegExp(`^[\\p{L}\\p{N}][\\p{L}\\p{N} .'-]*-(?:${UFS.join("|")})$`, "u").test(parameters.MUNICIPIO)) return { reason: "invalid_municipality" };
  for (const key of ["IE", "IM"]) {
    if (parameters[key] && !/^[\d.\-/\s]{1,30}$/.test(parameters[key])) return { reason: "invalid_registration" };
  }
  if (parameters.DATANASCIMENTO) {
    const value = parameters.DATANASCIMENTO;
    if (!/^(?:\d{8}|\d{2}([/-])\d{2}\1\d{4})$/.test(value)) return { reason: "invalid_birth_date" };
    const digits = value.replace(/\D/g, "");
    const day = Number(digits.slice(0, 2)), month = Number(digits.slice(2, 4)), year = Number(digits.slice(4));
    const date = new Date(Date.UTC(year, month - 1, day));
    if (year < 1900 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return { reason: "invalid_birth_date" };
    parameters.DATANASCIMENTO = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }
  return { parameters };
}

export function createDirectDataSellerService({
  env = process.env,
  fetchImpl = globalThis.fetch,
  creditsService = null,
  recordApiUsage = null,
  now = () => new Date(),
  delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  const enabled = String(env.DIRECT_DATA_SELLER_ENABLED || "false").toLowerCase() === "true";
  const token = text(env.DIRECT_DATA_TOKEN);
  let baseUrl;
  try {
    const candidate = new URL(env.DIRECT_DATA_API_BASE_URL || "https://apiv3.directd.com.br/api");
    if (candidate.protocol === "https:" && !candidate.username && !candidate.password && !candidate.search && !candidate.hash) baseUrl = candidate.toString().replace(/\/+$/, "");
  } catch { /* Invalid configuration stays unavailable. */ }
  const timeoutMs = positiveInteger(env.DIRECT_DATA_SELLER_TIMEOUT_MS, 120000);
  const pollAttempts = positiveInteger(env.DIRECT_DATA_SELLER_POLL_ATTEMPTS, 120);
  const pollIntervalMs = positiveInteger(env.DIRECT_DATA_SELLER_POLL_INTERVAL_MS, 2000);
  const creditCost = positiveInteger(env.DIRECT_DATA_SELLER_CREDIT_COST, 1);
  // ponytail: process-local deduplication; persistent operation records are needed across restarts/replicas.
  // Never evict submitted requests automatically: an eviction could permit another paid emission.
  const requests = new Map();
  // Serializes this service's wallet check, emission and settlement within one process.
  // Other processes/replicas or credit consumers still require a shared database reservation.
  const tenantOperations = new Map();
  const cacheLimit = positiveInteger(env.DIRECT_DATA_SELLER_CACHE_MAX_ENTRIES, 1000);

  function getStatus() {
    return { enabled, configured: Boolean(enabled && token && token !== "change-me" && baseUrl), provider: "Direct Data", endpoints: [...DIRECT_DATA_SELLER_ENDPOINTS], creditCost, mode: "paid_read_only", retryPolicy: "manual_after_provider_history_check", idempotencyScope: "process" };
  }

  async function fetchProvider(endpoint, parameters, requestTimeoutMs = timeoutMs) {
    const url = new URL(`${baseUrl}/${endpoint}`);
    for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetchImpl(url, { method: "GET", redirect: "error", headers: { accept: "application/json", Authorization: `Bearer ${token}` }, signal: controller.signal });
      const body = await response.text();
      let payload;
      try { payload = JSON.parse(body); } catch { payload = null; }
      return { status: response.status, payload };
    } finally {
      clearTimeout(timer);
    }
  }

  async function execute(request, authContext) {
    const configuration = getStatus();
    if (creditsService && authContext.paidCertificateOrder !== true) {
      let wallet;
      try { wallet = await creditsService.getWallet(authContext); }
      catch { return { unavailable: true, reason: "credits_unavailable", configuration }; }
      if (!wallet || (wallet.enabled && (!Number.isFinite(Number(wallet.balance)) || Number(wallet.balance) < creditCost))) return { insufficientCredits: true, reason: "insufficient_credits", creditCost, wallet, configuration };
    }
    let providerReference = "";
    let reply;
    const failure = (reason, providerStatus) => ({ failed: true, status: "failed", reason, providerStatus, providerReference, providerRequestSubmitted: true, billingVerificationRequired: true, configuration });
    try {
      // Global GET option documented in OpenAPI info.description, outside endpoint parameters.
      let response = await fetchProvider(request.endpoint, { ...request.parameters, Async: "Habilitar" });
      providerReference = text(field(field(response.payload, "metaDados"), "consultaUid") || field(response.payload, "consultaUid"));
      if ([201, 202].includes(response.status)) {
        if (!providerReference) reply = failure("provider_async_reference_missing", response.status);
        else if (!/^[a-zA-Z0-9_-]{1,150}$/.test(providerReference)) {
          providerReference = "";
          reply = failure("provider_async_reference_invalid", response.status);
        }
        else {
          const pollDeadline = Date.now() + pollAttempts * pollIntervalMs;
          for (let attempt = 0; attempt < pollAttempts; attempt += 1) {
            if (attempt) await delay(pollIntervalMs);
            const remainingMs = pollDeadline - Date.now();
            if (remainingMs <= 0) break;
            response = await fetchProvider("Historico/ObterRetornoConsultaAsync", { ConsultaUid: providerReference }, Math.min(timeoutMs, remainingMs));
            if (![201, 202].includes(response.status)) break;
          }
          if ([201, 202].includes(response.status)) reply = failure("provider_async_timeout", response.status);
        }
      }
      if (!reply) {
        providerReference = text(field(field(response.payload, "metaDados"), "consultaUid") || providerReference).slice(0, 150);
        if (response.status !== 200) reply = failure(`provider_http_${response.status}`, response.status);
        else if (providerFailed(response.payload)) reply = failure("provider_reported_failure", response.status);
        else if (!meaningful(field(response.payload, "retorno"))) reply = failure("provider_empty_response", response.status);
        else reply = { result: { status: "success", provider: "Direct Data", endpoint: request.endpoint, providerReference, queriedAt: now().toISOString(), payload: response.payload }, configuration };
      }
    } catch (error) {
      reply = failure(error?.name === "AbortError" ? "provider_timeout" : "provider_connection_failed");
    }
    const providerSucceeded = Boolean(reply.result);
    if (providerSucceeded && creditsService && authContext.paidCertificateOrder !== true) {
      try {
        const charge = await creditsService.consume(authContext, { amount: creditCost, referenceId: providerReference || `seller:${text(authContext.user?.id || authContext.userId)}:${request.requestId}`, operation: "direct_data_seller_document", metadata: { endpoint: request.endpoint, uf: request.parameters.UF || "", region: request.parameters.REGIAO || "" } });
        if (!charge.ok) reply = { ...reply, insufficientCredits: true, reason: "insufficient_credits", creditCost, wallet: charge.wallet, providerCompleted: true, providerRequestSubmitted: true };
        else reply.result.wallet = charge.wallet;
      } catch {
        reply = { ...failure("credits_settlement_failed"), providerCompleted: true };
      }
    }
    if (typeof recordApiUsage === "function") {
      try {
        await recordApiUsage(authContext, { provider: "directdata", service: request.endpoint, operation: "seller_document_query", status: providerSucceeded ? "success" : "failed", requestCount: 1, quantity: providerSucceeded ? 1 : 0, unitName: "consulta", referenceId: providerReference || request.requestId, actualCost: null, currency: "BRL", metadata: { endpoint: request.endpoint, estimatedCostBrl: request.estimatedCostBrl, uf: request.parameters.UF || "", region: request.parameters.REGIAO || "" } });
      } catch { /* Usage recording must not trigger another paid request. */ }
    }
    return reply;
  }

  async function executeForTenant(tenantId, request, authContext) {
    const previous = tenantOperations.get(tenantId) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => { release = resolve; });
    tenantOperations.set(tenantId, current);
    await previous;
    try {
      return await execute(request, authContext);
    } finally {
      release();
      if (tenantOperations.get(tenantId) === current) tenantOperations.delete(tenantId);
    }
  }

  async function query(input = {}, authContext = {}) {
    const configuration = getStatus();
    const invalid = (reason) => ({ invalid: true, reason, configuration });
    if (!input || typeof input !== "object" || Array.isArray(input)) return invalid("invalid_request");
    if (!authContext || typeof authContext !== "object") return invalid("authentication_required");
    const tenantId = text(authContext.tenantId), userId = text(authContext.user?.id || authContext.userId);
    if (authContext.unauthorized || !tenantId || !userId) return invalid("authentication_required");
    if (input.authorizationConfirmed !== true) return invalid("authorization_required");
    if (input.paidQueryConfirmed !== true) return invalid("paid_query_confirmation_required");
    const requestId = text(input.requestId);
    if (!/^[a-zA-Z0-9:_-]{1,150}$/.test(requestId)) return invalid("invalid_request_id");
    const endpoint = text(input.endpoint);
    const normalized = normalizeParameters(endpoint, input.parameters);
    if (normalized.reason) return invalid(normalized.reason);
    const estimatedCostBrl = input.estimatedCostBrl == null ? null : Number(input.estimatedCostBrl);
    if (estimatedCostBrl !== null && (!Number.isFinite(estimatedCostBrl) || estimatedCostBrl < 0)) return invalid("invalid_estimated_cost");
    if (!configuration.configured) return { unavailable: true, reason: enabled ? "direct_data_configuration_missing" : "direct_data_seller_disabled", configuration };
    const request = { requestId, endpoint, parameters: normalized.parameters, estimatedCostBrl };
    const cacheKey = JSON.stringify([tenantId, userId, requestId]);
    const fingerprint = crypto.createHash("sha256").update(JSON.stringify(request)).digest("hex");
    const cached = requests.get(cacheKey);
    if (cached) return cached.fingerprint === fingerprint ? structuredClone(await cached.task) : invalid("request_id_conflict");
    if (requests.size >= cacheLimit) return { unavailable: true, reason: "idempotency_capacity_reached", configuration };
    const operation = creditsService ? executeForTenant(tenantId, request, authContext) : execute(request, authContext);
    const task = operation.then((reply) => {
      if (!reply.result && !reply.providerRequestSubmitted) requests.delete(cacheKey);
      return reply;
    });
    requests.set(cacheKey, { fingerprint, task });
    return structuredClone(await task);
  }

  return { getStatus, query };
}
