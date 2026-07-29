import assert from "node:assert/strict";
import test from "node:test";

import {
  createDirectDataCourtService,
  normalizeDirectDataCourtResponse,
} from "../services/direct-data-court.service.mjs";

const AUTH = {
  tenantId: "tenant-direct-data",
  user: { id: "user-1", name: "Pessoa Teste" },
};

function configuredEnv(overrides = {}) {
  return {
    DIRECT_DATA_TJ_ENABLED: "true",
    DIRECT_DATA_TOKEN: "test-token",
    DIRECT_DATA_API_BASE_URL: "https://apiv3.directd.com.br/api",
    DIRECT_DATA_TJ_SUPPORTED_UFS: "PE,PI,SC,SP",
    DIRECT_DATA_TJ_TIMEOUT_MS: "5000",
    DIRECT_DATA_TJ_CREDIT_COST: "1",
    DIRECT_DATA_TJ_QUERY_COST_BRL: "0.36",
    ...overrides,
  };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("Direct Data court integration reports a disabled configuration without a token", async () => {
  const service = createDirectDataCourtService({
    env: {},
    fetchImpl: async () => {
      throw new Error("fetch must not run");
    },
  });

  const response = await service.search(
    {
      uf: "SP",
      degree: 1,
      processNumber: "10000001234567890000",
      authorizationConfirmed: true,
    },
    AUTH,
  );

  assert.equal(response.unavailable, true);
  assert.equal(response.reason, "direct_data_disabled");
  assert.equal(response.configuration.configured, false);
});

test("Direct Data court integration rejects unsupported UFs before a paid request", async () => {
  let calls = 0;
  const service = createDirectDataCourtService({
    env: configuredEnv(),
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({});
    },
  });

  const response = await service.search(
    {
      uf: "RJ",
      degree: 1,
      processNumber: "10000001234567890000",
      authorizationConfirmed: true,
    },
    AUTH,
  );

  assert.equal(response.unsupported, true);
  assert.deepEqual(response.supportedUfs, ["PE", "PI", "SC", "SP"]);
  assert.equal(calls, 0);
});

test("Direct Data court response exposes process summaries without party data", () => {
  const normalized = normalizeDirectDataCourtResponse(
    {
      metaDados: {
        consultaUid: "query-123",
        mensagem: "Consulta realizada",
      },
      retorno: {
        uf: "SP",
        grau: 1,
        status: "Em andamento",
        primeiroGrau: {
          foros: [
            {
              foro: "Foro Central",
              dadosProcesso: {
                numeroProcesso: { numero: "1000000-12.2026.8.26.0001" },
                classe: "Procedimento do Juizado Especial Civel",
                assunto: "Obrigacoes",
                vara: "1 JEC",
                partesProcesso: [
                  { tipo: "Autor", nome: "Nome que nao deve sair" },
                ],
                movimentacoes: [
                  { data: "29/07/2026", movimento: "Distribuido" },
                ],
              },
            },
          ],
        },
      },
    },
    {
      uf: "SP",
      degree: 1,
      searchType: "process_number",
      processNumber: "10000001220268260001",
    },
  );

  assert.equal(normalized.status, "found");
  assert.equal(normalized.count, 1);
  assert.equal(normalized.providerReference, "query-123");
  assert.equal(normalized.processes[0].processNumber, "1000000-12.2026.8.26.0001");
  assert.equal(normalized.processes[0].lastMovement.title, "Distribuido");
  assert.equal("parties" in normalized.processes[0], false);
  assert.doesNotMatch(JSON.stringify(normalized), /Nome que nao deve sair/);
});

test("Direct Data court integration sends the documented GET parameters", async () => {
  let requestedUrl = "";
  const usage = [];
  const creditCalls = [];
  const service = createDirectDataCourtService({
    env: configuredEnv(),
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return jsonResponse({
        metaDados: { consultaUid: "query-success" },
        retorno: {
          uf: "SP",
          grau: 1,
          primeiroGrau: {
            foros: [
              {
                foro: "Foro Teste",
                resumoProcessos: [
                  {
                    numero: "1000000-12.2026.8.26.0001",
                    classe: "Procedimento",
                    assunto: "Obrigacoes",
                  },
                ],
              },
            ],
          },
        },
      });
    },
    creditsService: {
      getWallet: async () => ({ enabled: true, balance: 5 }),
      consume: async (_auth, input) => {
        creditCalls.push(input);
        return { ok: true, state: "consumed", wallet: { enabled: true, balance: 4 } };
      },
    },
    recordApiUsage: async (_auth, event) => usage.push(event),
  });

  const response = await service.search(
    {
      requestId: "request-success",
      uf: "SP",
      degree: 1,
      processNumber: "10000001220268260001",
      authorizationConfirmed: true,
    },
    AUTH,
  );
  const url = new URL(requestedUrl);

  assert.equal(url.pathname, "/api/TribunalJustica");
  assert.equal(url.searchParams.get("TOKEN"), "test-token");
  assert.equal(url.searchParams.get("UF"), "SP");
  assert.equal(url.searchParams.get("GRAU"), "1");
  assert.equal(url.searchParams.get("NUMEROPROCESSO"), "10000001220268260001");
  assert.equal(response.result.status, "found");
  assert.equal(creditCalls.length, 1);
  assert.equal(creditCalls[0].amount, 1);
  assert.equal(usage.length, 1);
  assert.equal(usage[0].actualCost, 0.36);
});

test("Direct Data court integration supports authorized CPF lookup and masks it", async () => {
  const service = createDirectDataCourtService({
    env: configuredEnv(),
    fetchImpl: async (url) => {
      const parsed = new URL(String(url));
      assert.equal(parsed.searchParams.get("CPF"), "52998224725");
      return jsonResponse({ retorno: { uf: "SP", grau: 1 } });
    },
  });

  const response = await service.search(
    {
      uf: "SP",
      degree: 1,
      document: "529.982.247-25",
      authorizationConfirmed: true,
    },
    AUTH,
  );

  assert.equal(response.result.status, "not_found");
  assert.equal(response.result.subjectMasked, "529********25");
  assert.doesNotMatch(JSON.stringify(response), /52998224725/);
});

test("Direct Data court request id prevents a duplicate paid provider call", async () => {
  let calls = 0;
  const service = createDirectDataCourtService({
    env: configuredEnv(),
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({ retorno: { uf: "SP", grau: 1 } });
    },
  });
  const input = {
    requestId: "same-request",
    uf: "SP",
    degree: 1,
    processNumber: "10000001220268260001",
    authorizationConfirmed: true,
  };

  const [first, second] = await Promise.all([
    service.search(input, AUTH),
    service.search(input, AUTH),
  ]);

  assert.equal(calls, 1);
  assert.deepEqual(second, first);
});

test("Direct Data court request id allows retry after a transient provider failure", async () => {
  let calls = 0;
  const service = createDirectDataCourtService({
    env: configuredEnv(),
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error("offline"), { name: "TypeError" });
      return jsonResponse({ retorno: { uf: "SP", grau: 1 } });
    },
  });
  const input = {
    requestId: "retry-request",
    uf: "SP",
    degree: 1,
    processNumber: "10000001220268260001",
    authorizationConfirmed: true,
  };

  const first = await service.search(input, AUTH);
  const second = await service.search(input, AUTH);

  assert.equal(first.failed, true);
  assert.equal(second.result.status, "not_found");
  assert.equal(calls, 2);
});

test("Direct Data court integration maps provider permission and balance failures", async () => {
  const service = createDirectDataCourtService({
    env: configuredEnv(),
    fetchImpl: async () => jsonResponse({ mensagem: "Saldo insuficiente" }, 403),
  });

  const response = await service.search(
    {
      uf: "SP",
      degree: 1,
      processNumber: "10000001220268260001",
      authorizationConfirmed: true,
    },
    AUTH,
  );

  assert.equal(response.failed, true);
  assert.equal(response.reason, "provider_permission_or_balance_required");
  assert.equal(JSON.stringify(response).includes("Saldo insuficiente"), false);
});

test("server exposes Direct Data TJ as a read-only authenticated integration", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");

  assert.match(source, /\/api\/integrations\/direct-data\/tj\/status/);
  assert.match(source, /\/api\/integrations\/direct-data\/tj\/processes/);
  assert.match(source, /directDataCourtService\.search/);
  assert.doesNotMatch(
    source,
    /\/api\/integrations\/direct-data\/tj\/(?:protocol|petition|submit)/i,
  );
});
