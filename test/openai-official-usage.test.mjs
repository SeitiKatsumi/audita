import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateOpenAICosts,
  aggregateOpenAIUsage,
  buildOpenAICostsUrl,
  buildOpenAIUsageUrl,
  createOpenAIOfficialUsageService,
} from "../services/openai-official-usage.service.mjs";

const scope = {
  startTime: 1700000000,
  endTime: 1702592000,
  projectId: "proj_audita",
  apiKeyId: "key_audita",
};

test("builds official OpenAI URLs scoped to the Audita project and API key", () => {
  const usageUrl = buildOpenAIUsageUrl(scope);
  const costsUrl = buildOpenAICostsUrl({ ...scope, page: "next-cursor" });

  assert.equal(usageUrl.pathname, "/v1/organization/usage/completions");
  assert.deepEqual(usageUrl.searchParams.getAll("project_ids[]"), ["proj_audita"]);
  assert.deepEqual(usageUrl.searchParams.getAll("api_key_ids[]"), ["key_audita"]);
  assert.deepEqual(usageUrl.searchParams.getAll("group_by[]"), [
    "project_id",
    "api_key_id",
    "model",
  ]);

  assert.equal(costsUrl.pathname, "/v1/organization/costs");
  assert.deepEqual(costsUrl.searchParams.getAll("project_ids[]"), ["proj_audita"]);
  assert.deepEqual(costsUrl.searchParams.getAll("api_key_ids[]"), ["key_audita"]);
  assert.deepEqual(costsUrl.searchParams.getAll("group_by[]"), [
    "project_id",
    "api_key_id",
    "line_item",
  ]);
  assert.equal(costsUrl.searchParams.get("page"), "next-cursor");
});

test("aggregates paginated official usage and costs", () => {
  const usage = aggregateOpenAIUsage([
    {
      data: [
        {
          results: [
            {
              model: "gpt-5-mini",
              num_model_requests: 2,
              input_tokens: 1200,
              input_cached_tokens: 300,
              output_tokens: 400,
            },
          ],
        },
      ],
    },
    {
      data: [
        {
          results: [
            {
              model: "gpt-5-mini",
              num_model_requests: 1,
              input_tokens: 500,
              input_cached_tokens: 100,
              output_tokens: 200,
            },
          ],
        },
      ],
    },
  ]);
  const costs = aggregateOpenAICosts([
    {
      data: [
        {
          results: [
            { line_item: "Text models", amount: { value: 0.0123, currency: "usd" } },
            { line_item: "Text models", amount: { value: 0.0045, currency: "usd" } },
          ],
        },
      ],
    },
  ]);

  assert.deepEqual(
    {
      requests: usage.requests,
      inputTokens: usage.inputTokens,
      cachedInputTokens: usage.cachedInputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
    },
    {
      requests: 3,
      inputTokens: 1700,
      cachedInputTokens: 400,
      outputTokens: 600,
      totalTokens: 2300,
    },
  );
  assert.equal(usage.models.length, 1);
  assert.deepEqual(costs.totals, [{ currency: "USD", amount: 0.0168 }]);
  assert.deepEqual(costs.lineItems, [
    { lineItem: "Text models", currency: "USD", amount: 0.0168 },
  ]);
});

test("reports missing official credentials without exposing any secret", async () => {
  const service = createOpenAIOfficialUsageService({ env: {} });
  const result = await service.getUsage({ days: 30 });

  assert.equal(result.status, "configuration_required");
  assert.equal(result.configured, false);
  assert.deepEqual(result.missing, [
    "AUDITA_OPENAI_API_KEY",
    "OPENAI_ADMIN_KEY",
    "OPENAI_PROJECT_ID",
    "OPENAI_AUDITA_API_KEY_ID",
  ]);
  assert.doesNotMatch(JSON.stringify(result), /Bearer|sk-/);
});

test("loads exact official key usage and billed cost through the organization APIs", async () => {
  const calls = [];
  const env = {
    AUDITA_OPENAI_API_KEY: "sk-proj-dedicated-secret",
    OPENAI_ADMIN_KEY: "sk-admin-secret",
    OPENAI_PROJECT_ID: "proj_audita",
    OPENAI_AUDITA_API_KEY_ID: "key_audita",
    AUDITA_CHAT_API_KEY_SECRET: "AUDITA_OPENAI_API_KEY",
    STATE_COURT_AGENT_API_KEY_SECRET: "AUDITA_OPENAI_API_KEY",
  };
  const responses = {
    usageFirst: {
      data: [{ results: [{ model: "gpt-5-mini", num_model_requests: 1, input_tokens: 10, output_tokens: 5 }] }],
      has_more: true,
      next_page: "usage-page-2",
    },
    usageSecond: {
      data: [{ results: [{ model: "gpt-5-mini", num_model_requests: 2, input_tokens: 20, output_tokens: 8 }] }],
      has_more: false,
      next_page: null,
    },
    costs: {
      data: [{ results: [{ line_item: "Text models", amount: { value: 0.007, currency: "usd" } }] }],
      has_more: false,
      next_page: null,
    },
  };
  const fetchImpl = async (url, options) => {
    calls.push({ url: new URL(url), authorization: options.headers.authorization });
    const parsed = new URL(url);
    const isCosts = parsed.pathname.endsWith("/organization/costs");
    const payload = isCosts
      ? responses.costs
      : parsed.searchParams.get("page")
        ? responses.usageSecond
        : responses.usageFirst;
    return {
      ok: true,
      status: 200,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    };
  };
  const service = createOpenAIOfficialUsageService({
    env,
    fetchImpl,
    now: () => 1800000000000,
    cacheTtlMs: 0,
  });

  const result = await service.getUsage({ days: 30, force: true });

  assert.equal(result.status, "connected");
  assert.equal(result.usage.requests, 3);
  assert.equal(result.usage.totalTokens, 43);
  assert.deepEqual(result.costs.totals, [{ currency: "USD", amount: 0.007 }]);
  assert.equal(result.configuration.chatUsesDedicatedKey, true);
  assert.equal(result.configuration.agentUsesDedicatedKey, true);
  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.authorization === "Bearer sk-admin-secret"));
  assert.ok(calls.every((call) => call.url.searchParams.get("api_key_ids[]") === "key_audita"));
  assert.doesNotMatch(JSON.stringify(result), /sk-admin-secret|sk-proj-dedicated-secret/);
});

test("keeps the admin dashboard available when OpenAI synchronization fails", async () => {
  const service = createOpenAIOfficialUsageService({
    env: {
      AUDITA_OPENAI_API_KEY: "dedicated",
      OPENAI_ADMIN_KEY: "admin",
      OPENAI_PROJECT_ID: "proj_audita",
      OPENAI_AUDITA_API_KEY_ID: "key_audita",
    },
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      text: async () => '{"error":"invalid admin credential"}',
    }),
  });

  const result = await service.getUsage({ days: 7, force: true });

  assert.equal(result.status, "sync_failed");
  assert.equal(result.configured, true);
  assert.match(result.message, /HTTP 401/);
});
