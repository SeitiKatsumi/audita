const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_CACHE_TTL_MS = 120000;

function normalizedText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function boundedDays(value) {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) ? Math.min(365, Math.max(1, parsed)) : 30;
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function rounded(value, digits = 10) {
  return Number(numberValue(value).toFixed(digits));
}

function appendArray(searchParams, name, values) {
  values.filter(Boolean).forEach((value) => searchParams.append(`${name}[]`, value));
}

function endpointUrl(baseUrl, pathname) {
  return new URL(`${normalizedText(baseUrl, DEFAULT_BASE_URL).replace(/\/$/, "")}${pathname}`);
}

export function maskOpenAIIdentifier(value) {
  const text = normalizedText(value);
  if (!text) return "Não configurado";
  if (text.length <= 10) return `${text.slice(0, 3)}...`;
  return `${text.slice(0, 7)}...${text.slice(-4)}`;
}

export function buildOpenAIUsageUrl({
  baseUrl = DEFAULT_BASE_URL,
  startTime,
  endTime,
  projectId,
  apiKeyId,
  page = "",
} = {}) {
  const url = endpointUrl(baseUrl, "/organization/usage/completions");
  url.searchParams.set("start_time", String(startTime));
  url.searchParams.set("end_time", String(endTime));
  url.searchParams.set("bucket_width", "1d");
  url.searchParams.set("limit", "31");
  appendArray(url.searchParams, "project_ids", [projectId]);
  appendArray(url.searchParams, "api_key_ids", [apiKeyId]);
  appendArray(url.searchParams, "group_by", ["project_id", "api_key_id", "model"]);
  if (page) url.searchParams.set("page", page);
  return url;
}

export function buildOpenAICostsUrl({
  baseUrl = DEFAULT_BASE_URL,
  startTime,
  endTime,
  projectId,
  apiKeyId,
  page = "",
} = {}) {
  const url = endpointUrl(baseUrl, "/organization/costs");
  url.searchParams.set("start_time", String(startTime));
  url.searchParams.set("end_time", String(endTime));
  url.searchParams.set("bucket_width", "1d");
  url.searchParams.set("limit", "180");
  appendArray(url.searchParams, "project_ids", [projectId]);
  appendArray(url.searchParams, "api_key_ids", [apiKeyId]);
  appendArray(url.searchParams, "group_by", ["project_id", "api_key_id", "line_item"]);
  if (page) url.searchParams.set("page", page);
  return url;
}

function flattenResults(pages) {
  return pages.flatMap((page) =>
    (Array.isArray(page?.data) ? page.data : []).flatMap((bucket) =>
      Array.isArray(bucket?.results) ? bucket.results : [],
    ),
  );
}

export function aggregateOpenAIUsage(pages = []) {
  const models = new Map();
  const totals = {
    requests: 0,
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };

  flattenResults(pages).forEach((result) => {
    const inputTokens = numberValue(result?.input_tokens);
    const cachedInputTokens = numberValue(result?.input_cached_tokens);
    const outputTokens = numberValue(result?.output_tokens);
    const requests = numberValue(result?.num_model_requests);
    totals.requests += requests;
    totals.inputTokens += inputTokens;
    totals.cachedInputTokens += cachedInputTokens;
    totals.outputTokens += outputTokens;
    totals.totalTokens += inputTokens + outputTokens;

    const model = normalizedText(result?.model, "Modelo nao informado");
    if (!models.has(model)) {
      models.set(model, {
        model,
        requests: 0,
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      });
    }
    const item = models.get(model);
    item.requests += requests;
    item.inputTokens += inputTokens;
    item.cachedInputTokens += cachedInputTokens;
    item.outputTokens += outputTokens;
    item.totalTokens += inputTokens + outputTokens;
  });

  return {
    ...totals,
    models: [...models.values()].sort((a, b) => b.totalTokens - a.totalTokens),
  };
}

export function aggregateOpenAICosts(pages = []) {
  const currencies = new Map();
  const lineItems = new Map();

  flattenResults(pages).forEach((result) => {
    const amount = numberValue(result?.amount?.value);
    const currency = normalizedText(result?.amount?.currency, "usd").toUpperCase();
    const lineItem = normalizedText(result?.line_item, "Outros custos OpenAI");
    currencies.set(currency, (currencies.get(currency) || 0) + amount);
    const key = `${currency}:${lineItem}`;
    if (!lineItems.has(key)) lineItems.set(key, { lineItem, currency, amount: 0 });
    lineItems.get(key).amount += amount;
  });

  return {
    totals: [...currencies.entries()].map(([currency, amount]) => ({
      currency,
      amount: rounded(amount),
    })),
    lineItems: [...lineItems.values()]
      .map((item) => ({ ...item, amount: rounded(item.amount) }))
      .sort((a, b) => b.amount - a.amount),
  };
}

async function fetchJsonPage(fetchImpl, url, headers, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      const detail = body.slice(0, 400).replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]");
      throw new Error(`OpenAI Organization API respondeu HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAllPages({ fetchImpl, buildUrl, headers, timeoutMs }) {
  const pages = [];
  let page = "";
  for (let count = 0; count < 100; count += 1) {
    const payload = await fetchJsonPage(fetchImpl, buildUrl(page), headers, timeoutMs);
    pages.push(payload);
    if (!payload?.has_more || !payload?.next_page) return pages;
    page = payload.next_page;
  }
  throw new Error("A OpenAI retornou mais paginas do que o limite seguro da sincronizacao.");
}

function resolveConfiguration(env) {
  const keySecretRef = normalizedText(env.OPENAI_AUDITA_API_KEY_SECRET, "AUDITA_OPENAI_API_KEY");
  const projectId = normalizedText(env.OPENAI_PROJECT_ID);
  const apiKeyId = normalizedText(env.OPENAI_AUDITA_API_KEY_ID);
  const adminKey = normalizedText(env.OPENAI_ADMIN_KEY);
  const missing = [];
  if (!env[keySecretRef]) missing.push(keySecretRef);
  if (!adminKey) missing.push("OPENAI_ADMIN_KEY");
  if (!projectId) missing.push("OPENAI_PROJECT_ID");
  if (!apiKeyId) missing.push("OPENAI_AUDITA_API_KEY_ID");

  return {
    enabled: normalizedText(env.OPENAI_USAGE_SYNC_ENABLED, "true").toLowerCase() !== "false",
    keySecretRef,
    projectId,
    apiKeyId,
    adminKey,
    organizationId: normalizedText(env.OPENAI_ORGANIZATION_ID),
    baseUrl: normalizedText(env.OPENAI_USAGE_BASE_URL, DEFAULT_BASE_URL),
    timeoutMs: Math.max(1000, Number(env.OPENAI_USAGE_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS),
    missing: [...new Set(missing)],
    chatUsesDedicatedKey:
      Boolean(env[keySecretRef]) && normalizedText(env.AUDITA_CHAT_API_KEY_SECRET) === keySecretRef,
    agentUsesDedicatedKey:
      Boolean(env[keySecretRef]) && normalizedText(env.STATE_COURT_AGENT_API_KEY_SECRET) === keySecretRef,
  };
}

function publicConfiguration(config) {
  return {
    keySecretRef: config.keySecretRef,
    projectId: maskOpenAIIdentifier(config.projectId),
    apiKeyId: maskOpenAIIdentifier(config.apiKeyId),
    chatUsesDedicatedKey: config.chatUsesDedicatedKey,
    agentUsesDedicatedKey: config.agentUsesDedicatedKey,
  };
}

export function createOpenAIOfficialUsageService({
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
} = {}) {
  const cache = new Map();

  async function getUsage({ days = 30, force = false } = {}) {
    const config = resolveConfiguration(env);
    const periodDays = boundedDays(days);
    const configuration = publicConfiguration(config);

    if (!config.enabled) {
      return {
        status: "disabled",
        configured: false,
        missing: [],
        configuration,
        message: "A sincronizacao oficial da OpenAI esta desativada.",
      };
    }
    if (config.missing.length) {
      return {
        status: "configuration_required",
        configured: false,
        missing: config.missing,
        configuration,
        message: "Configure o projeto, a chave dedicada e a chave administrativa da OpenAI.",
      };
    }
    if (typeof fetchImpl !== "function") {
      return {
        status: "unavailable",
        configured: true,
        missing: [],
        configuration,
        message: "O runtime nao possui cliente HTTP para consultar a OpenAI.",
      };
    }

    const cacheKey = `${periodDays}:${config.projectId}:${config.apiKeyId}`;
    const cached = cache.get(cacheKey);
    if (!force && cached && now() - cached.cachedAt < cacheTtlMs) return cached.value;

    const endTime = Math.floor(now() / 1000);
    const startTime = endTime - periodDays * 86400;
    const headers = {
      accept: "application/json",
      authorization: `Bearer ${config.adminKey}`,
    };
    if (config.organizationId) headers["OpenAI-Organization"] = config.organizationId;

    try {
      const [usagePages, costPages] = await Promise.all([
        fetchAllPages({
          fetchImpl,
          headers,
          timeoutMs: config.timeoutMs,
          buildUrl: (page) =>
            buildOpenAIUsageUrl({
              baseUrl: config.baseUrl,
              startTime,
              endTime,
              projectId: config.projectId,
              apiKeyId: config.apiKeyId,
              page,
            }),
        }),
        fetchAllPages({
          fetchImpl,
          headers,
          timeoutMs: config.timeoutMs,
          buildUrl: (page) =>
            buildOpenAICostsUrl({
              baseUrl: config.baseUrl,
              startTime,
              endTime,
              projectId: config.projectId,
              apiKeyId: config.apiKeyId,
              page,
            }),
        }),
      ]);

      const value = {
        status: "connected",
        configured: true,
        missing: [],
        configuration,
        period: {
          days: periodDays,
          startTime,
          endTime,
        },
        usage: aggregateOpenAIUsage(usagePages),
        costs: aggregateOpenAICosts(costPages),
        syncedAt: new Date(now()).toISOString(),
        source: "OpenAI Organization Usage and Costs APIs",
        message: "Valores oficiais filtrados pelo projeto e pela chave de API da Audita.",
      };
      cache.set(cacheKey, { cachedAt: now(), value });
      return value;
    } catch (error) {
      return {
        status: "sync_failed",
        configured: true,
        missing: [],
        configuration,
        message: error?.name === "AbortError" ? "A consulta oficial da OpenAI expirou." : String(error?.message || error),
        syncedAt: null,
      };
    }
  }

  return { getUsage };
}
