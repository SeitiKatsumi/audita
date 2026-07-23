import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_API_PRICING,
  createApiUsageService,
  estimateApiUsageCost,
  extractOpenAIUsage,
} from "../services/api-usage.service.mjs";

test("extracts aggregated OpenAI agent usage including cached input", () => {
  const usage = extractOpenAIUsage({
    state: {
      usage: {
        requests: 3,
        inputTokens: 1200,
        outputTokens: 340,
        totalTokens: 1540,
        inputTokensDetails: [{ cached_tokens: 400 }, { cachedTokens: 100 }],
      },
    },
  });

  assert.deepEqual(usage, {
    requestCount: 3,
    inputUnits: 1200,
    cachedInputUnits: 500,
    outputUnits: 340,
    totalUnits: 1540,
  });
});

test("calculates GPT-5 mini cost with cached and uncached tokens", () => {
  const cost = estimateApiUsageCost(
    {
      requestCount: 1,
      inputUnits: 1_000_000,
      cachedInputUnits: 200_000,
      outputUnits: 1_000_000,
    },
    { ...DEFAULT_API_PRICING, active: true },
  );

  assert.equal(cost, 2.205);
});

test("records and aggregates generic paid API consumption per user", async () => {
  const service = createApiUsageService({ getDb: () => ({ pool: null, dbReady: false }) });
  const authContext = {
    tenantId: "tenant-api-usage-test",
    user: { id: "user-1", name: "Analista Teste", email: "analista@example.com" },
  };

  await service.savePricing(authContext, {
    provider: "directdata",
    service: "marketplace",
    displayName: "Direct Data",
    currency: "BRL",
    unitName: "consulta",
    unitCost: 3.5,
  });
  await service.record(authContext, {
    provider: "directdata",
    service: "marketplace",
    operation: "process_search",
    referenceId: "directdata-test-1",
    quantity: 2,
    unitName: "consulta",
  });

  const dashboard = await service.getDashboard(authContext, { days: 30 });

  assert.equal(dashboard.summary.requests, 1);
  assert.equal(dashboard.summary.activeUsers, 1);
  assert.equal(dashboard.summary.unpricedRequests, 0);
  assert.deepEqual(dashboard.summary.costs, [{ currency: "BRL", amount: 7 }]);
  assert.equal(dashboard.byProvider[0].provider, "directdata");
  assert.equal(dashboard.byUser[0].userEmail, "analista@example.com");
});

test("keeps unpriced provider calls visible without inventing a cost", async () => {
  const service = createApiUsageService({ getDb: () => ({ pool: null, dbReady: false }) });
  const authContext = { tenantId: "tenant-unpriced-test", userId: "user-2" };

  const row = await service.record(authContext, {
    provider: "future-provider",
    service: "certificate",
    operation: "certificate_issue",
    referenceId: "future-provider-test-1",
  });
  const dashboard = await service.getDashboard(authContext, { days: 30 });

  assert.equal(row.priced, false);
  assert.equal(row.estimatedCost, null);
  assert.equal(dashboard.summary.unpricedRequests, 1);
  assert.deepEqual(dashboard.summary.costs, []);
});
