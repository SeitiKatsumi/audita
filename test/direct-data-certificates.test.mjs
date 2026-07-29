import assert from "node:assert/strict";
import test from "node:test";

import {
  DIRECT_DATA_CERTIFICATE_ALL_UFS,
  DIRECT_DATA_CERTIFICATE_CONFIRMED_UFS,
  DIRECT_DATA_CERTIFICATE_EXPERIMENTAL_UFS,
  analyzeDirectDataCertificateOccurrence,
  createDirectDataCertificatesService,
  normalizeCertificateType,
  normalizeDirectDataCertificateResponse,
} from "../services/direct-data-certificates.service.mjs";

const AUTH = {
  tenantId: "tenant-direct-data-certificates",
  user: { id: "user-1", name: "Pessoa Teste" },
};

function configuredEnv(overrides = {}) {
  return {
    DIRECT_DATA_CERTIFICATE_ENABLED: "true",
    DIRECT_DATA_TOKEN: "test-token",
    DIRECT_DATA_API_BASE_URL: "https://apiv3.directd.com.br/api",
    DIRECT_DATA_CERTIFICATE_ALLOWED_UFS:
      DIRECT_DATA_CERTIFICATE_ALL_UFS.join(","),
    DIRECT_DATA_CERTIFICATE_CONFIRMED_UFS:
      DIRECT_DATA_CERTIFICATE_CONFIRMED_UFS.join(","),
    DIRECT_DATA_CERTIFICATE_TIMEOUT_MS: "5000",
    DIRECT_DATA_CERTIFICATE_CREDIT_COST: "1",
    DIRECT_DATA_CERTIFICATE_QUERY_COST_BRL: "0.36",
    DIRECT_DATA_CERTIFICATE_PDF_SURCHARGE_RATE: "0.5",
    ...overrides,
  };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function validRequest(overrides = {}) {
  return {
    requestId: "certificate-request-1",
    uf: "BA",
    certificateType: "Civel",
    document: "529.982.247-25",
    fullName: "Pessoa Teste",
    authorizationConfirmed: true,
    paidQueryConfirmed: true,
    generatePdf: false,
    ...overrides,
  };
}

test("Direct Data certificate coverage separates confirmed and experimental UFs", () => {
  assert.equal(DIRECT_DATA_CERTIFICATE_ALL_UFS.length, 27);
  assert.equal(DIRECT_DATA_CERTIFICATE_CONFIRMED_UFS.length, 18);
  assert.deepEqual(DIRECT_DATA_CERTIFICATE_EXPERIMENTAL_UFS, [
    "AL",
    "MA",
    "MG",
    "MS",
    "PR",
    "RJ",
    "RO",
    "SC",
    "SP",
  ]);
});

test("Direct Data certificate type aliases use the provider enum", () => {
  assert.equal(normalizeCertificateType("civil"), "C\u00edvel");
  assert.equal(
    normalizeCertificateType("recuperacao judicial"),
    "Fal\u00eanciaRecupera\u00e7\u00e3o",
  );
  assert.equal(normalizeCertificateType("eleitoral"), "FinsEleitorais");
  assert.equal(normalizeCertificateType("desconhecida"), "");
});

test("Direct Data certificate integration stays unavailable without configuration", async () => {
  const service = createDirectDataCertificatesService({
    env: {},
    fetchImpl: async () => {
      throw new Error("fetch must not run");
    },
  });

  const response = await service.query(validRequest(), AUTH);

  assert.equal(response.unavailable, true);
  assert.equal(response.reason, "direct_data_certificates_disabled");
  assert.equal(response.configuration.configured, false);
});

test("Direct Data certificate pricing distinguishes PDF surcharge from total", () => {
  const service = createDirectDataCertificatesService({
    env: configuredEnv(),
  });
  const status = service.getStatus();

  assert.equal(status.queryCostBrl, 0.36);
  assert.equal(status.pdfSurchargeBrl, 0.18);
  assert.equal(status.pdfTotalCostBrl, 0.54);
  assert.match(status.pricingNote, /total: R\$ 0\.54/);
});

test("Direct Data certificate requires legal and paid-query confirmations", async () => {
  let calls = 0;
  const service = createDirectDataCertificatesService({
    env: configuredEnv(),
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({});
    },
  });

  const withoutAuthorization = await service.query(
    validRequest({ authorizationConfirmed: false, requestId: "" }),
    AUTH,
  );
  const withoutCostConfirmation = await service.query(
    validRequest({ paidQueryConfirmed: false, requestId: "" }),
    AUTH,
  );

  assert.equal(withoutAuthorization.reason, "authorization_required");
  assert.equal(
    withoutCostConfirmation.reason,
    "paid_query_confirmation_required",
  );
  assert.equal(calls, 0);
});

test("Direct Data certificate sends documented CPF, UF, type and PDF parameters", async () => {
  let requestedUrl = "";
  const usage = [];
  const creditCalls = [];
  const service = createDirectDataCertificatesService({
    env: configuredEnv(),
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return jsonResponse({
        metaDados: {
          consultaUid: "certificate-success",
          resultado: true,
          urlComprovante: "https://files.directd.com.br/certidao.pdf",
        },
        retorno: {
          nomeEntidade: "Tribunal de Justica",
          documentoConsultado: "52998224725",
          tipoCertidao: "C\u00edvel",
          uf: "BA",
          dataEmissao: "29/07/2026",
          dataValidade: "29/08/2026",
          possuiOcorrencia: false,
          numeroCertidao: "CERT-123",
          codigoValidacao: "VALID-123",
          status: "Emitida",
        },
      });
    },
    creditsService: {
      getWallet: async () => ({ enabled: true, balance: 5 }),
      consume: async (_auth, input) => {
        creditCalls.push(input);
        return {
          ok: true,
          state: "consumed",
          wallet: { enabled: true, balance: 4 },
        };
      },
    },
    recordApiUsage: async (_auth, event) => usage.push(event),
  });

  const response = await service.query(
    validRequest({
      generatePdf: true,
      birthDate: "01/07/2002",
      motherName: "Nome da Mae",
      fatherName: "Nome do Pai",
      rg: "123456789",
      gender: "Masculino",
    }),
    AUTH,
  );
  const url = new URL(requestedUrl);

  assert.equal(url.pathname, "/api/TJCertidaoCivelCriminalFiscal");
  assert.equal(url.searchParams.get("TOKEN"), "test-token");
  assert.equal(url.searchParams.get("CPF"), "52998224725");
  assert.equal(url.searchParams.get("UF"), "BA");
  assert.equal(url.searchParams.get("TIPO"), "C\u00edvel");
  assert.equal(url.searchParams.get("GERARCOMPROVANTE"), "Habilitar");
  assert.equal(url.searchParams.get("DATANASCIMENTO"), "01/07/2002");
  assert.equal(response.result.analysis.outcome, "no_occurrence_reported");
  assert.equal(response.result.certificate.evidenceUrl, "https://files.directd.com.br/certidao.pdf");
  assert.equal(response.result.subjectMasked, "529********25");
  assert.doesNotMatch(JSON.stringify(response), /52998224725/);
  assert.equal(creditCalls.length, 1);
  assert.equal(usage[0].actualCost, 0.54);
});

test("Direct Data certificate supports a valid CNPJ without leaking it", async () => {
  const service = createDirectDataCertificatesService({
    env: configuredEnv(),
    fetchImpl: async (url) => {
      const parsed = new URL(String(url));
      assert.equal(parsed.searchParams.get("CNPJ"), "60701190000104");
      assert.equal(parsed.searchParams.has("CPF"), false);
      return jsonResponse({
        metaDados: { consultaUid: "company-certificate", resultado: true },
        retorno: {
          uf: "RS",
          tipoCertidao: "Fiscal",
          possuiOcorrencia: true,
        },
      });
    },
  });

  const response = await service.query(
    validRequest({
      uf: "RS",
      certificateType: "Fiscal",
      document: "60.701.190/0001-04",
      documentType: "cnpj",
      requestId: "company-request",
    }),
    AUTH,
  );

  assert.equal(response.result.analysis.outcome, "occurrence_found");
  assert.equal(response.result.analysis.risk, "high");
  assert.equal(response.result.subjectMasked, "60.************04");
  assert.doesNotMatch(JSON.stringify(response), /60701190000104/);
});

test("Direct Data certificate marks technical-only UFs as experimental", () => {
  const normalized = normalizeDirectDataCertificateResponse(
    {
      metaDados: { consultaUid: "experimental" },
      retorno: {
        uf: "SP",
        tipoCertidao: "C\u00edvel",
        possuiOcorrencia: false,
      },
    },
    {
      uf: "SP",
      certificateType: "C\u00edvel",
      documentType: "cpf",
      document: "52998224725",
      generatePdf: false,
    },
  );

  assert.equal(normalized.coverage, "experimental");
});

test("Direct Data certificate keeps an ambiguous occurrence inconclusive", () => {
  assert.deepEqual(analyzeDirectDataCertificateOccurrence("Nao informado"), {
    outcome: "inconclusive",
    risk: "review",
    occurrence: null,
    summary:
      "O retorno não permite concluir se há ocorrência. A certidão precisa de revisão humana.",
  });
});

test("Direct Data certificate request id prevents duplicate paid calls", async () => {
  let calls = 0;
  const service = createDirectDataCertificatesService({
    env: configuredEnv(),
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({
        metaDados: { consultaUid: "same-provider-result", resultado: true },
        retorno: { uf: "BA", possuiOcorrencia: false },
      });
    },
  });
  const input = validRequest({ requestId: "same-request" });

  const [first, second] = await Promise.all([
    service.query(input, AUTH),
    service.query(input, AUTH),
  ]);

  assert.equal(calls, 1);
  assert.deepEqual(second, first);
});

test("Direct Data certificate maps provider errors without leaking its body or token", async () => {
  const service = createDirectDataCertificatesService({
    env: configuredEnv(),
    fetchImpl: async () =>
      jsonResponse(
        {
          mensagem:
            "Saldo insuficiente; request TOKEN=test-token; documento 52998224725",
        },
        403,
      ),
  });

  const response = await service.query(validRequest(), AUTH);

  assert.equal(response.failed, true);
  assert.equal(response.reason, "provider_permission_or_balance_required");
  assert.equal(response.providerRequestSubmitted, true);
  assert.equal(response.billingVerificationRequired, true);
  assert.doesNotMatch(JSON.stringify(response), /test-token|52998224725|Saldo insuficiente/);
});

test("Direct Data certificate never auto-retries a billed unavailable response", async () => {
  let calls = 0;
  const service = createDirectDataCertificatesService({
    env: configuredEnv(),
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({ mensagem: "portal indisponivel" }, 503);
    },
  });

  const response = await service.query(
    validRequest({ requestId: "provider-unavailable" }),
    AUTH,
  );

  assert.equal(calls, 1);
  assert.equal(response.reason, "provider_temporarily_unavailable");
  assert.equal(response.billingVerificationRequired, true);
  assert.equal(
    response.configuration.retryPolicy,
    "manual_after_provider_history_check",
  );
});

test("Direct Data certificate can recover an asynchronous provider response", async () => {
  const calls = [];
  const service = createDirectDataCertificatesService({
    env: configuredEnv({
      DIRECT_DATA_CERTIFICATE_POLL_INTERVAL_MS: "1",
      DIRECT_DATA_CERTIFICATE_POLL_ATTEMPTS: "2",
    }),
    fetchImpl: async (url) => {
      const parsed = new URL(String(url));
      calls.push(parsed.pathname);
      if (parsed.pathname.endsWith("/TJCertidaoCivelCriminalFiscal")) {
        return jsonResponse(
          { metaDados: { consultaUid: "async-certificate" } },
          202,
        );
      }
      assert.equal(
        parsed.searchParams.get("ConsultaUid"),
        "async-certificate",
      );
      return jsonResponse({
        metaDados: { consultaUid: "async-certificate", resultado: true },
        retorno: { uf: "BA", possuiOcorrencia: false },
      });
    },
    delay: async () => {},
  });

  const response = await service.query(
    validRequest({ requestId: "async-request" }),
    AUTH,
  );

  assert.deepEqual(calls, [
    "/api/TJCertidaoCivelCriminalFiscal",
    "/api/Historico/ObterRetornoConsultaAsync",
  ]);
  assert.equal(response.result.status, "success");
});

test("server and chat UI expose authenticated certificate routes without protocol actions", async () => {
  const { readFile } = await import("node:fs/promises");
  const serverSource = await readFile(
    new URL("../server.mjs", import.meta.url),
    "utf8",
  );
  const appSource = await readFile(
    new URL("../app.js", import.meta.url),
    "utf8",
  );

  assert.match(
    serverSource,
    /\/api\/integrations\/direct-data\/tj\/certificates\/status/,
  );
  assert.match(
    serverSource,
    /\/api\/integrations\/direct-data\/tj\/certificates/,
  );
  assert.match(serverSource, /directDataCertificatesService\.query/);
  assert.match(appSource, /data-court-certificate-form/);
  assert.match(appSource, /authorizationConfirmed/);
  assert.match(appSource, /paidQueryConfirmed/);
  assert.doesNotMatch(
    serverSource,
    /\/api\/integrations\/direct-data\/tj\/certificates\/(?:protocol|submit)/i,
  );
});
