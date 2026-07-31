import assert from "node:assert/strict";
import test from "node:test";

import {
  createDirectDataPersonService,
  normalizeDirectDataPersonResponse,
  personNamesMatch,
} from "../services/direct-data-person.service.mjs";

const configuredEnv = {
  DIRECT_DATA_PERSON_ENABLED: "true",
  DIRECT_DATA_TOKEN: "test-token",
  DIRECT_DATA_API_BASE_URL: "https://apiv3.directd.com.br/api",
  DIRECT_DATA_PERSON_QUERY_COST_BRL: "0.36",
};

test("normalizes only the identity fields needed by the seller flow", () => {
  assert.deepEqual(
    normalizeDirectDataPersonResponse({
      metaDados: { consultaUid: "query-123" },
      retorno: {
        cpf: "52998224725",
        nome: "Maria da Silva",
        nomeMae: "Ana da Silva",
        telefones: [{ telefoneComDDD: "11999999999" }],
        enderecos: [{ cidade: "Brasilia" }],
      },
    }),
    {
      fullName: "Maria da Silva",
      motherName: "Ana da Silva",
      providerReference: "query-123",
    },
  );
});

test("matches full names ignoring accents, case and repeated spacing", () => {
  assert.equal(personNamesMatch("Maria  de Fátima Silva", "MARIA DE FATIMA SILVA"), true);
  assert.equal(personNamesMatch("Maria Silva", "Maria de Fatima Silva"), false);
});

test("queries CadastroPessoaFisica once, charges once and reuses the CPF cache", async () => {
  let fetchCalls = 0;
  let consumeCalls = 0;
  const usageEvents = [];
  const service = createDirectDataPersonService({
    env: configuredEnv,
    fetchImpl: async (url) => {
      fetchCalls += 1;
      assert.equal(url.pathname, "/api/CadastroPessoaFisica");
      assert.equal(url.searchParams.get("CPF"), "52998224725");
      assert.equal(url.searchParams.get("TOKEN"), "test-token");
      return new Response(JSON.stringify({
        metaDados: { consultaUid: "query-123" },
        retorno: { nome: "Maria da Silva", nomeMae: "Ana da Silva" },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
    creditsService: {
      getWallet: async () => ({ enabled: true, balance: 10 }),
      consume: async () => {
        consumeCalls += 1;
        return { ok: true, wallet: { enabled: true, balance: 9 } };
      },
    },
    recordApiUsage: async (_context, event) => usageEvents.push(event),
    now: () => new Date("2026-07-31T12:00:00.000Z"),
  });

  const first = await service.lookup({
    cpf: "529.982.247-25",
    authorizationConfirmed: true,
    requestId: "seller-1",
  }, { tenantId: "tenant-1" });
  const second = await service.lookup({
    cpf: "52998224725",
    authorizationConfirmed: true,
    requestId: "seller-2",
  }, { tenantId: "tenant-1" });

  assert.equal(first.result.motherName, "Ana da Silva");
  assert.equal(second.result.cacheHit, true);
  assert.equal(fetchCalls, 1);
  assert.equal(consumeCalls, 1);
  assert.equal(usageEvents.length, 1);
  assert.equal(usageEvents[0].actualCost, 0.36);
});

test("returns provider failures without retrying a potentially billed request", async () => {
  let fetchCalls = 0;
  const service = createDirectDataPersonService({
    env: configuredEnv,
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify({ metaDados: { consultaUid: "failed-1" } }), { status: 503 });
    },
  });

  const result = await service.lookup({
    cpf: "52998224725",
    authorizationConfirmed: true,
  });

  assert.equal(result.failed, true);
  assert.equal(result.reason, "provider_temporarily_unavailable");
  assert.equal(result.billingVerificationRequired, true);
  assert.equal(fetchCalls, 1);
});
