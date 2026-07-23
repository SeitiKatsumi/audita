import crypto from "node:crypto";

const memoryUsage = [];
const memoryPricing = new Map();

export const DEFAULT_API_PRICING = Object.freeze({
  provider: "openai",
  service: "responses",
  model: "gpt-5-mini",
  displayName: "OpenAI GPT-5 mini",
  currency: "USD",
  unitName: "token",
  inputCostPerMillion: 0.25,
  cachedInputCostPerMillion: 0.025,
  outputCostPerMillion: 2,
  requestCost: 0,
  unitCost: 0,
  source: "OpenAI pricing",
});

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function integerValue(value, fallback = 0) {
  return Math.max(0, Math.trunc(numberValue(value, fallback)));
}

function normalizedText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizedCurrency(value) {
  const currency = normalizedText(value, "USD").toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : "USD";
}

function pricingKey(tenantId, pricing) {
  return [tenantId || "public", pricing.provider, pricing.service, pricing.model || ""].join(":");
}

function publicPricing(row = {}) {
  return {
    id: row.id || null,
    provider: normalizedText(row.provider),
    service: normalizedText(row.service),
    model: normalizedText(row.model),
    displayName: normalizedText(row.display_name ?? row.displayName),
    currency: normalizedCurrency(row.currency),
    unitName: normalizedText(row.unit_name ?? row.unitName, "request"),
    inputCostPerMillion: numberValue(row.input_cost_per_million ?? row.inputCostPerMillion),
    cachedInputCostPerMillion: numberValue(
      row.cached_input_cost_per_million ?? row.cachedInputCostPerMillion,
    ),
    outputCostPerMillion: numberValue(row.output_cost_per_million ?? row.outputCostPerMillion),
    requestCost: numberValue(row.request_cost ?? row.requestCost),
    unitCost: numberValue(row.unit_cost ?? row.unitCost),
    active: row.active !== false,
    source: normalizedText(row.source, "admin"),
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

function publicUsage(row = {}) {
  return {
    id: row.public_id ?? row.publicId ?? row.id ?? crypto.randomUUID(),
    userId: row.user_id ?? row.userId ?? null,
    userName: normalizedText(row.user_name ?? row.userName, "Sem usu\u00e1rio"),
    userEmail: normalizedText(row.user_email ?? row.userEmail),
    provider: normalizedText(row.provider),
    service: normalizedText(row.service),
    operation: normalizedText(row.operation),
    model: normalizedText(row.model),
    status: normalizedText(row.status, "success"),
    requestCount: integerValue(row.request_count ?? row.requestCount, 1),
    inputUnits: integerValue(row.input_units ?? row.inputUnits),
    cachedInputUnits: integerValue(row.cached_input_units ?? row.cachedInputUnits),
    outputUnits: integerValue(row.output_units ?? row.outputUnits),
    totalUnits: integerValue(row.total_units ?? row.totalUnits),
    quantity: numberValue(row.quantity, 1),
    unitName: normalizedText(row.unit_name ?? row.unitName, "request"),
    currency: normalizedCurrency(row.currency),
    estimatedCost:
      row.estimated_cost === null || row.estimatedCost === null
        ? null
        : numberValue(row.estimated_cost ?? row.estimatedCost),
    actualCost:
      row.actual_cost === null || row.actualCost === null || row.actual_cost === undefined
        ? null
        : numberValue(row.actual_cost ?? row.actualCost),
    priced: row.priced === true || row.priced === "true",
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
  };
}

function extractDetailValue(details, candidates) {
  const list = Array.isArray(details) ? details : details ? [details] : [];
  return list.reduce((total, detail) => {
    if (!detail || typeof detail !== "object") return total;
    const key = candidates.find((candidate) => detail[candidate] !== undefined);
    return total + (key ? integerValue(detail[key]) : 0);
  }, 0);
}

export function extractOpenAIUsage(resultOrUsage) {
  const usage =
    resultOrUsage?.state?.usage ||
    resultOrUsage?.runContext?.usage ||
    resultOrUsage?.usage ||
    resultOrUsage ||
    {};
  const inputUnits = integerValue(usage.inputTokens ?? usage.input_tokens);
  const outputUnits = integerValue(usage.outputTokens ?? usage.output_tokens);
  const totalUnits = integerValue(usage.totalTokens ?? usage.total_tokens, inputUnits + outputUnits);
  const cachedInputUnits = Math.min(
    inputUnits,
    extractDetailValue(usage.inputTokensDetails ?? usage.input_tokens_details, [
      "cachedTokens",
      "cached_tokens",
      "cached_input_tokens",
    ]),
  );

  return {
    requestCount: integerValue(usage.requests, usage.requestUsageEntries?.length || 1),
    inputUnits,
    cachedInputUnits,
    outputUnits,
    totalUnits: totalUnits || inputUnits + outputUnits,
  };
}

export function estimateApiUsageCost(event, pricing) {
  if (!pricing?.active) return null;
  const inputUnits = integerValue(event.inputUnits);
  const cachedInputUnits = Math.min(inputUnits, integerValue(event.cachedInputUnits));
  const uncachedInputUnits = Math.max(0, inputUnits - cachedInputUnits);
  const outputUnits = integerValue(event.outputUnits);
  const requestCount = integerValue(event.requestCount, 1);
  const quantity = numberValue(event.quantity, 1);
  const estimated =
    (uncachedInputUnits / 1_000_000) * numberValue(pricing.inputCostPerMillion) +
    (cachedInputUnits / 1_000_000) * numberValue(pricing.cachedInputCostPerMillion) +
    (outputUnits / 1_000_000) * numberValue(pricing.outputCostPerMillion) +
    requestCount * numberValue(pricing.requestCost) +
    quantity * numberValue(pricing.unitCost);
  return Number(estimated.toFixed(10));
}

function normalizePricingInput(input = {}) {
  const provider = normalizedText(input.provider).toLowerCase();
  const service = normalizedText(input.service).toLowerCase();
  if (!provider || !service) return null;
  return {
    provider,
    service,
    model: normalizedText(input.model),
    displayName: normalizedText(input.displayName, `${provider} / ${service}`),
    currency: normalizedCurrency(input.currency),
    unitName: normalizedText(input.unitName, "request"),
    inputCostPerMillion: numberValue(input.inputCostPerMillion),
    cachedInputCostPerMillion: numberValue(input.cachedInputCostPerMillion),
    outputCostPerMillion: numberValue(input.outputCostPerMillion),
    requestCost: numberValue(input.requestCost),
    unitCost: numberValue(input.unitCost),
    active: input.active !== false,
    source: normalizedText(input.source, "admin"),
  };
}

function normalizeUsageInput(event = {}) {
  const provider = normalizedText(event.provider).toLowerCase();
  const service = normalizedText(event.service).toLowerCase();
  const operation = normalizedText(event.operation);
  if (!provider || !service || !operation) return null;
  const inputUnits = integerValue(event.inputUnits);
  const outputUnits = integerValue(event.outputUnits);
  return {
    provider,
    service,
    operation,
    model: normalizedText(event.model),
    status: ["success", "failed", "cancelled"].includes(event.status) ? event.status : "success",
    requestCount: integerValue(event.requestCount, 1),
    inputUnits,
    cachedInputUnits: Math.min(inputUnits, integerValue(event.cachedInputUnits)),
    outputUnits,
    totalUnits: integerValue(event.totalUnits, inputUnits + outputUnits),
    quantity: numberValue(event.quantity, 1),
    unitName: normalizedText(event.unitName, "request"),
    referenceId: normalizedText(event.referenceId) || crypto.randomUUID(),
    actualCost:
      event.actualCost === null || event.actualCost === undefined ? null : numberValue(event.actualCost),
    currency: event.currency ? normalizedCurrency(event.currency) : "",
    metadata: event.metadata && typeof event.metadata === "object" ? event.metadata : {},
  };
}

function matchesPricing(pricing, event) {
  return (
    pricing.active &&
    pricing.provider === event.provider &&
    pricing.service === event.service &&
    (!pricing.model || pricing.model === event.model)
  );
}

function choosePricing(pricingRows, event) {
  return (
    pricingRows.find((pricing) => matchesPricing(pricing, event) && pricing.model === event.model) ||
    pricingRows.find((pricing) => matchesPricing(pricing, event) && !pricing.model) ||
    null
  );
}

function costsByCurrency(rows) {
  const costs = new Map();
  rows.forEach((row) => {
    const value = row.actualCost ?? row.estimatedCost;
    if (value === null) return;
    costs.set(row.currency, (costs.get(row.currency) || 0) + value);
  });
  return [...costs.entries()].map(([currency, amount]) => ({
    currency,
    amount: Number(amount.toFixed(6)),
  }));
}

function aggregateRows(rows, keyFn, labelFn) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = keyFn(row);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: labelFn(row),
        provider: row.provider,
        service: row.service,
        model: row.model,
        userId: row.userId,
        userName: row.userName,
        userEmail: row.userEmail,
        requests: 0,
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        unpricedRequests: 0,
        rows: [],
      });
    }
    const group = groups.get(key);
    group.requests += row.requestCount;
    group.inputTokens += row.inputUnits;
    group.cachedInputTokens += row.cachedInputUnits;
    group.outputTokens += row.outputUnits;
    group.totalTokens += row.totalUnits;
    if (!row.priced) group.unpricedRequests += row.requestCount;
    group.rows.push(row);
  });
  return [...groups.values()]
    .map(({ rows: groupedRows, ...group }) => ({ ...group, costs: costsByCurrency(groupedRows) }))
    .sort((a, b) => b.requests - a.requests);
}

function buildDashboard(rows, pricing, days) {
  const userIds = new Set(rows.map((row) => row.userId).filter(Boolean));
  const providers = new Set(rows.map((row) => row.provider).filter(Boolean));
  const summary = {
    requests: rows.reduce((total, row) => total + row.requestCount, 0),
    inputTokens: rows.reduce((total, row) => total + row.inputUnits, 0),
    cachedInputTokens: rows.reduce((total, row) => total + row.cachedInputUnits, 0),
    outputTokens: rows.reduce((total, row) => total + row.outputUnits, 0),
    totalTokens: rows.reduce((total, row) => total + row.totalUnits, 0),
    activeUsers: userIds.size,
    providers: providers.size,
    failedRequests: rows
      .filter((row) => row.status !== "success")
      .reduce((total, row) => total + row.requestCount, 0),
    unpricedRequests: rows
      .filter((row) => !row.priced)
      .reduce((total, row) => total + row.requestCount, 0),
    costs: costsByCurrency(rows),
  };

  return {
    period: { days },
    summary,
    byProvider: aggregateRows(
      rows,
      (row) => `${row.provider}:${row.service}:${row.model}`,
      (row) => [row.provider, row.service, row.model].filter(Boolean).join(" / "),
    ),
    byUser: aggregateRows(
      rows,
      (row) => String(row.userId || row.userEmail || "anonymous"),
      (row) => row.userName || row.userEmail || "Sem usu\u00e1rio",
    ),
    recent: rows.slice(0, 50),
    pricing,
  };
}

export function createApiUsageService({ getDb } = {}) {
  async function ensureDefaultPricing(authContext) {
    const tenantId = authContext?.tenantId;
    const pricing = normalizePricingInput(DEFAULT_API_PRICING);
    const { pool, dbReady } = getDb ? getDb() : {};
    if (!pool || !dbReady || !tenantId) {
      const key = pricingKey(tenantId, pricing);
      if (!memoryPricing.has(key)) memoryPricing.set(key, { ...pricing, id: key, source: "OpenAI pricing" });
      return;
    }

    await pool.query(
      `INSERT INTO audita_api_pricing (
         tenant_id, provider, service, model, display_name, currency, unit_name,
         input_cost_per_million, cached_input_cost_per_million, output_cost_per_million,
         request_cost, unit_cost, active, source
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, $13)
       ON CONFLICT (tenant_id, provider, service, model) DO NOTHING`,
      [
        tenantId,
        pricing.provider,
        pricing.service,
        pricing.model,
        pricing.displayName,
        pricing.currency,
        pricing.unitName,
        pricing.inputCostPerMillion,
        pricing.cachedInputCostPerMillion,
        pricing.outputCostPerMillion,
        pricing.requestCost,
        pricing.unitCost,
        pricing.source,
      ],
    );
  }

  async function listPricing(authContext) {
    await ensureDefaultPricing(authContext);
    const tenantId = authContext?.tenantId;
    const { pool, dbReady } = getDb ? getDb() : {};
    if (!pool || !dbReady || !tenantId) {
      return [...memoryPricing.entries()]
        .filter(([key]) => key.startsWith(`${tenantId || "public"}:`))
        .map(([, pricing]) => publicPricing(pricing));
    }
    const result = await pool.query(
      `SELECT * FROM audita_api_pricing
       WHERE tenant_id = $1
       ORDER BY provider, service, model`,
      [tenantId],
    );
    return result.rows.map(publicPricing);
  }

  async function record(authContext, rawEvent) {
    const event = normalizeUsageInput(rawEvent);
    if (!event) return { invalid: true };
    const pricingRows = await listPricing(authContext);
    const pricing = choosePricing(pricingRows, event);
    const estimatedCost = pricing ? estimateApiUsageCost(event, pricing) : null;
    const currency = event.currency || pricing?.currency || "USD";
    const priced = Boolean(pricing) || event.actualCost !== null;
    const tenantId = authContext?.tenantId;
    const userId = authContext?.user?.id ?? authContext?.userId ?? null;
    const userName = authContext?.user?.name || "";
    const userEmail = authContext?.user?.email || "";
    const createdAt = new Date().toISOString();
    const { pool, dbReady } = getDb ? getDb() : {};

    if (!pool || !dbReady || !tenantId) {
      const row = publicUsage({
        publicId: crypto.randomUUID(),
        userId,
        userName,
        userEmail,
        ...event,
        currency,
        estimatedCost,
        priced,
        createdAt,
      });
      memoryUsage.unshift({ tenantId: tenantId || "public", ...row });
      return row;
    }

    const result = await pool.query(
      `INSERT INTO audita_api_usage (
         tenant_id, user_id, provider, service, operation, model, status,
         request_count, input_units, cached_input_units, output_units, total_units,
         quantity, unit_name, currency, estimated_cost, actual_cost, priced,
         reference_id, pricing_snapshot, metadata
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
         $13, $14, $15, $16, $17, $18, $19, $20, $21
       )
       ON CONFLICT (tenant_id, provider, reference_id)
       DO UPDATE SET status = EXCLUDED.status
       RETURNING *`,
      [
        tenantId,
        userId,
        event.provider,
        event.service,
        event.operation,
        event.model,
        event.status,
        event.requestCount,
        event.inputUnits,
        event.cachedInputUnits,
        event.outputUnits,
        event.totalUnits,
        event.quantity,
        event.unitName,
        currency,
        estimatedCost,
        event.actualCost,
        priced,
        event.referenceId,
        JSON.stringify(pricing || {}),
        JSON.stringify(event.metadata || {}),
      ],
    );
    return publicUsage({ ...result.rows[0], user_name: userName, user_email: userEmail });
  }

  async function savePricing(authContext, rawPricing) {
    const pricing = normalizePricingInput(rawPricing);
    if (!pricing) return { invalid: true };
    const tenantId = authContext?.tenantId;
    const { pool, dbReady } = getDb ? getDb() : {};
    if (!pool || !dbReady || !tenantId) {
      const key = pricingKey(tenantId, pricing);
      const row = { ...pricing, id: memoryPricing.get(key)?.id || key, updatedAt: new Date().toISOString() };
      memoryPricing.set(key, row);
      return publicPricing(row);
    }

    const result = await pool.query(
      `INSERT INTO audita_api_pricing (
         tenant_id, provider, service, model, display_name, currency, unit_name,
         input_cost_per_million, cached_input_cost_per_million, output_cost_per_million,
         request_cost, unit_cost, active, source, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
       ON CONFLICT (tenant_id, provider, service, model)
       DO UPDATE SET
         display_name = EXCLUDED.display_name,
         currency = EXCLUDED.currency,
         unit_name = EXCLUDED.unit_name,
         input_cost_per_million = EXCLUDED.input_cost_per_million,
         cached_input_cost_per_million = EXCLUDED.cached_input_cost_per_million,
         output_cost_per_million = EXCLUDED.output_cost_per_million,
         request_cost = EXCLUDED.request_cost,
         unit_cost = EXCLUDED.unit_cost,
         active = EXCLUDED.active,
         source = EXCLUDED.source,
         updated_at = NOW()
       RETURNING *`,
      [
        tenantId,
        pricing.provider,
        pricing.service,
        pricing.model,
        pricing.displayName,
        pricing.currency,
        pricing.unitName,
        pricing.inputCostPerMillion,
        pricing.cachedInputCostPerMillion,
        pricing.outputCostPerMillion,
        pricing.requestCost,
        pricing.unitCost,
        pricing.active,
        pricing.source,
      ],
    );
    return publicPricing(result.rows[0]);
  }

  async function getDashboard(authContext, { days = 30, provider = "" } = {}) {
    const boundedDays = Math.min(365, Math.max(1, integerValue(days, 30)));
    const normalizedProvider = normalizedText(provider).toLowerCase();
    const pricing = await listPricing(authContext);
    const tenantId = authContext?.tenantId;
    const { pool, dbReady } = getDb ? getDb() : {};
    if (!pool || !dbReady || !tenantId) {
      const since = Date.now() - boundedDays * 86400000;
      const rows = memoryUsage
        .filter((row) => row.tenantId === (tenantId || "public"))
        .filter((row) => new Date(row.createdAt).getTime() >= since)
        .filter((row) => !normalizedProvider || row.provider === normalizedProvider)
        .map(publicUsage);
      return buildDashboard(rows, pricing, boundedDays);
    }

    const params = [tenantId, boundedDays];
    const providerFilter = normalizedProvider ? "AND au.provider = $3" : "";
    if (normalizedProvider) params.push(normalizedProvider);
    const result = await pool.query(
      `SELECT
         au.*,
         COALESCE(u.name, 'Sem usu\u00e1rio') AS user_name,
         COALESCE(u.email, '') AS user_email
       FROM audita_api_usage au
       LEFT JOIN audita_users u ON u.id = au.user_id
       WHERE au.tenant_id = $1
         AND au.created_at >= NOW() - ($2::text || ' days')::interval
         ${providerFilter}
       ORDER BY au.created_at DESC
       LIMIT 5000`,
      params,
    );
    return buildDashboard(result.rows.map(publicUsage), pricing, boundedDays);
  }

  return { record, getDashboard, listPricing, savePricing };
}
