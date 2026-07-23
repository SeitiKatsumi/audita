import test from "node:test";
import assert from "node:assert/strict";
import { createAuditService, validateCnpj, validateCpf } from "../services/audit.service.mjs";
import { calculateRiskScore } from "../services/risk-score.service.mjs";
import { listStateCourtProfiles } from "../services/state-courts.service.mjs";
import { getStateCourtAgentPortalPrompt, isStateCourtAgentAssistedEnabled } from "../services/state-court-agent.service.mjs";
import { collect as collectCnib, extractCnibOccurrences, selectDatasetForDocumentType } from "../collectors/cnib.collector.mjs";
import {
  analyzeAssistedSessionSnapshot,
  buildCaptchaLabReport,
  classifyHumanCheckpoint,
  collect as collectTjdft,
  esajModelValue,
  getCertificateTypesForInput,
  isAssistedSessionPdfContentValid,
} from "../collectors/tjdft.collector.mjs";

function snapshotCnibEnv() {
  return {
    BIGDATACORP_CNIB_ENABLED: process.env.BIGDATACORP_CNIB_ENABLED,
    BIGDATACORP_ACCESS_TOKEN: process.env.BIGDATACORP_ACCESS_TOKEN,
    BIGDATACORP_TOKEN_ID: process.env.BIGDATACORP_TOKEN_ID,
    BIGDATACORP_MARKETPLACE_URL: process.env.BIGDATACORP_MARKETPLACE_URL,
  };
}

function restoreCnibEnv(values) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

test("valida CPF e CNPJ", () => {
  assert.equal(validateCpf("529.982.247-25"), true);
  assert.equal(validateCpf("111.111.111-11"), false);
  assert.equal(validateCnpj("04.252.011/0001-10"), true);
  assert.equal(validateCnpj("11.111.111/1111-11"), false);
});

test("calcula score alto quando alguma fonte consta", () => {
  const score = calculateRiskScore([
    { fonte: "portal_transparencia", status: "success", resultado: "consta" },
    { fonte: "receita_federal", status: "success", resultado: "nada_consta" },
  ]);
  assert.equal(score.nivel, "alto");
});

test("CNIB seleciona dataset BigDataCorp por tipo de documento", () => {
  assert.equal(selectDatasetForDocumentType("cpf"), "partner_quod_credit_risk_details_person");
  assert.equal(selectDatasetForDocumentType("cnpj"), "partner_quod_credit_risk_details_company");
});

test("CNIB sem token retorna indisponivel sem quebrar consulta", async () => {
  const env = snapshotCnibEnv();
  restoreCnibEnv({
    BIGDATACORP_CNIB_ENABLED: "true",
    BIGDATACORP_ACCESS_TOKEN: "",
    BIGDATACORP_TOKEN_ID: "",
  });
  try {
    const result = await collectCnib({ tipoDocumento: "cpf", documento: "52998224725", retries: 0, timeoutMs: 100 });
    assert.equal(result.status, "unavailable");
    assert.equal(result.resultado, "indisponivel");
  } finally {
    restoreCnibEnv(env);
  }
});

test("CNIB detecta natureza de indisponibilidade em resposta BigDataCorp", async () => {
  const occurrences = extractCnibOccurrences({
    Result: [
      {
        Restricoes: [
          {
            Natureza: "IBI",
            Descricao: "Indisponibilidade de bens",
            Origem: "Teste",
          },
        ],
      },
    ],
  });
  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].natureza, "IBI");
});

test("CNIB retorna consta quando BigDataCorp traz codigo IB", async () => {
  const env = snapshotCnibEnv();
  const originalFetch = globalThis.fetch;
  restoreCnibEnv({
    BIGDATACORP_CNIB_ENABLED: "true",
    BIGDATACORP_ACCESS_TOKEN: "access",
    BIGDATACORP_TOKEN_ID: "token",
    BIGDATACORP_MARKETPLACE_URL: "https://example.test/marketplace",
  });
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://example.test/marketplace");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.AccessToken, "access");
    assert.equal(options.headers.TokenId, "token");
    assert.equal(JSON.parse(options.body).Datasets, "partner_quod_credit_risk_details_person");
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          Result: [{ Restricoes: [{ Natureza: "IBG", Descricao: "Indisponibilidade geral" }] }],
        }),
    };
  };
  try {
    const result = await collectCnib({ tipoDocumento: "cpf", documento: "52998224725", retries: 0, timeoutMs: 100 });
    assert.equal(result.status, "success");
    assert.equal(result.resultado, "consta");
    assert.deepEqual(result.dados.naturezaCodes, ["IBG"]);
  } finally {
    globalThis.fetch = originalFetch;
    restoreCnibEnv(env);
  }
});

test("CNIB retorna nada consta sem codigo IB", async () => {
  const env = snapshotCnibEnv();
  const originalFetch = globalThis.fetch;
  restoreCnibEnv({
    BIGDATACORP_CNIB_ENABLED: "true",
    BIGDATACORP_ACCESS_TOKEN: "access",
    BIGDATACORP_TOKEN_ID: "token",
    BIGDATACORP_MARKETPLACE_URL: "https://example.test/marketplace",
  });
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ Result: [{ Restricoes: [{ Natureza: "PEF" }] }] }),
  });
  try {
    const result = await collectCnib({ tipoDocumento: "cnpj", documento: "04252011000110", retries: 0, timeoutMs: 100 });
    assert.equal(result.status, "success");
    assert.equal(result.resultado, "nada_consta");
  } finally {
    globalThis.fetch = originalFetch;
    restoreCnibEnv(env);
  }
});

test("CNIB retorna failed quando BigDataCorp falha", async () => {
  const env = snapshotCnibEnv();
  const originalFetch = globalThis.fetch;
  restoreCnibEnv({
    BIGDATACORP_CNIB_ENABLED: "true",
    BIGDATACORP_ACCESS_TOKEN: "access",
    BIGDATACORP_TOKEN_ID: "token",
    BIGDATACORP_MARKETPLACE_URL: "https://example.test/marketplace",
  });
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    text: async () => JSON.stringify({ error: "provider_failed" }),
  });
  try {
    const result = await collectCnib({ tipoDocumento: "cpf", documento: "52998224725", retries: 0, timeoutMs: 100 });
    assert.equal(result.status, "failed");
    assert.equal(result.resultado, "erro");
  } finally {
    globalThis.fetch = originalFetch;
    restoreCnibEnv(env);
  }
});

test("score CNIB positivo fica alto", () => {
  const score = calculateRiskScore([{ fonte: "cnib", status: "success", resultado: "consta" }]);
  assert.equal(score.nivel, "alto");
  assert.match(score.motivos.join(" "), /indisponibilidade de bens/i);
});

test("cria consulta e executa collector mock", async () => {
  const service = createAuditService({
    getDb: () => ({ pool: null, dbReady: false }),
    getAuthContext: async () => ({ tenantId: 1, user: { id: 7 }, unauthorized: false }),
    customCollectors: {
      mock: {
        collect: async () => ({
          fonte: "mock",
          status: "success",
          resultado: "nada_consta",
          dados: { ok: true },
        }),
      },
    },
  });

  const started = await service.startAudit({
    body: {
      documento: "52998224725",
      tipoDocumento: "cpf",
      fontes: ["mock"],
    },
  });
  assert.equal(started.status, "pending");
  assert.match(started.consultaId, /^[0-9a-f-]{36}$/);

  await new Promise((resolve) => setTimeout(resolve, 30));
  const audit = await service.findAudit(started.consultaId);
  assert.equal(audit.resultados[0].status, "success");
  assert.equal(audit.scoreRisco.nivel, "baixo");
});

test("collector falhando nao derruba consulta", async () => {
  const service = createAuditService({
    getDb: () => ({ pool: null, dbReady: false }),
    getAuthContext: async () => ({ tenantId: 1, user: null, unauthorized: false }),
    logError: () => {},
    customCollectors: {
      boom: {
        collect: async () => {
          throw new Error("falha controlada");
        },
      },
    },
  });

  const started = await service.startAudit({
    body: {
      documento: "52998224725",
      tipoDocumento: "cpf",
      fontes: ["boom"],
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 30));
  const audit = await service.findAudit(started.consultaId);
  assert.equal(audit.resultados[0].status, "failed");
  assert.equal(audit.status, "failed");
});

test("filtra certidoes TJDFT selecionadas", () => {
  const certificates = getCertificateTypesForInput({
    extraFields: {
      tjdftCertificateTypes: ["criminal", "especial"],
    },
  });

  assert.deepEqual(
    certificates.map((certificate) => certificate.id),
    ["criminal", "especial"],
  );
});

test("catalogo de tribunais estaduais contem 27 UFs validas", () => {
  const profiles = listStateCourtProfiles();
  const ufs = profiles.map((profile) => profile.uf);
  assert.equal(profiles.length, 27);
  assert.equal(new Set(ufs).size, 27);
  for (const profile of profiles) {
    assert.equal(Boolean(profile.url), true);
    assert.equal(Boolean(profile.platform), true);
    assert.equal(Array.isArray(profile.requiredFields), true);
    assert.equal(Array.isArray(profile.certificateTypes), true);
    assert.equal(profile.certificateTypes.length > 0, true);
    assert.equal(["active", "mapped", "needs_mapping", "agent_assisted", "blocked"].includes(profile.automationStatus), true);
    assert.equal(["none", "assisted", "manual"].includes(profile.captchaMode), true);
  }
});

test("catalogo marca TJSP como ESAJ automatico com reCAPTCHA assistido", () => {
  const tjsp = listStateCourtProfiles().find((profile) => profile.uf === "SP");
  assert.equal(tjsp.court, "TJSP");
  assert.equal(tjsp.platform, "esaj");
  assert.equal(tjsp.automationStatus, "active");
  assert.equal(tjsp.automatic, true);
  assert.equal(tjsp.captchaMode, "assisted");
});

test("catalogo marca TJAM como ESAJ mapeado e assistido", () => {
  const tjam = listStateCourtProfiles().find((profile) => profile.uf === "AM");
  assert.equal(tjam.court, "TJAM");
  assert.equal(tjam.platform, "esaj");
  assert.equal(tjam.automationStatus, "mapped");
  assert.equal(tjam.captchaMode, "assisted");
});

test("catalogo habilita agente navegador para UFs experimentais", () => {
  const profiles = listStateCourtProfiles();
  const agentUfs = profiles.filter((profile) => profile.automationStatus === "agent_assisted").map((profile) => profile.uf).sort();
  assert.deepEqual(agentUfs, ["AC", "AP", "MG", "MT", "PA", "PI", "RJ", "RN", "RO", "RR", "RS", "SC"]);
  for (const uf of agentUfs) {
    const profile = profiles.find((item) => item.uf === uf);
    assert.equal(profile.platform, "agent_assisted");
    assert.equal(profile.captchaMode, "assisted");
    assert.equal(isStateCourtAgentAssistedEnabled(profile), true);
  }
});

test("catalogo TJMA aponta para formulario de certidao estadual do JurisConsult", () => {
  const tjma = listStateCourtProfiles().find((profile) => profile.uf === "MA");
  assert.equal(tjma.court, "TJMA");
  assert.equal(tjma.url, "https://jurisconsult.tjma.jus.br/#/certidao-generate-state-certificate-form");
  assert.deepEqual(tjma.requiredFields, ["document", "fullName", "birthDate", "motherName"]);
  assert.deepEqual(tjma.certificateTypes, ["civil", "criminal"]);
});

test("catalogo TJPR aponta para formulario publico de certidao", () => {
  const tjpr = listStateCourtProfiles().find((profile) => profile.uf === "PR");
  assert.equal(tjpr.court, "TJPR");
  assert.equal(tjpr.url, "https://www.tjpr.jus.br/certidao-de-2-grau-para-pessoa-fisica");
  assert.equal(tjpr.automationStatus, "mapped");
  assert.deepEqual(tjpr.requiredFields, ["document", "fullName", "email", "phone", "motherName", "fatherName", "birthDate"]);
});

test("catalogo mapeia aliases para tribunais estaduais parciais", () => {
  const mappedUfs = ["RJ", "MA", "MG", "PR", "TO", "PB", "SC", "RR", "MT", "BA"];
  const profiles = listStateCourtProfiles();
  for (const uf of mappedUfs) {
    const profile = profiles.find((item) => item.uf === uf);
    assert.equal(Boolean(profile), true);
    assert.equal(profile.mappingVersion, "2026-06-11");
    assert.equal(profile.mappingScope, "field_navigation_assisted");
    assert.equal(Array.isArray(profile.fieldAliases?.document), true);
    assert.equal(Array.isArray(profile.fieldAliases?.fullName), true);
    assert.equal(Boolean(profile.defaultValues), true);
  }
});

test("mapeia modelos ESAJ por tribunal", () => {
  assert.equal(esajModelValue("civil", { uf: "SP" }), "52");
  assert.equal(esajModelValue("criminal", { uf: "SP" }), "6");
  assert.equal(esajModelValue("falencia", { uf: "SP" }), "58");
  assert.equal(esajModelValue("civil", { uf: "AL" }), "38");
  assert.equal(esajModelValue("criminal", { uf: "AL" }), "39");
  assert.equal(esajModelValue("falencia", { uf: "AL" }), "40");
  assert.equal(esajModelValue("civil", { uf: "AM" }), "9");
  assert.equal(esajModelValue("criminal", { uf: "AM" }), "7");
  assert.equal(esajModelValue("falencia", { uf: "AM" }), "31");
  assert.equal(esajModelValue("civil", { uf: "MS" }), "91");
  assert.equal(esajModelValue("criminal", { uf: "MS" }), "92");
  assert.equal(esajModelValue("falencia", { uf: "MS" }), "93");
});

test("catalogo TJAP usa Tucujuris com campos reais do formulario", () => {
  const tjap = listStateCourtProfiles().find((profile) => profile.uf === "AP");
  assert.equal(tjap.court, "TJAP");
  assert.equal(tjap.url, "https://tucujuris.tjap.jus.br/pages/certidao-publica/certidao-publica.html");
  assert.equal(tjap.automationStatus, "agent_assisted");
  assert.equal(tjap.platform, "agent_assisted");
  assert.equal(tjap.captchaMode, "assisted");
  assert.equal(tjap.remoteAssisted, undefined);
  assert.equal(tjap.frameMode, undefined);
  assert.equal(tjap.blocker, "cloudflare");
  assert.deepEqual(tjap.requiredFields, ["document", "fullName", "gender", "birthDate", "motherName", "rg", "email"]);
  assert.deepEqual(tjap.certificateTypes, ["civil", "criminal", "especial", "falencia"]);
});

test("catalogo TJPA usa portal novo de certidoes com hCaptcha assistido", () => {
  const tjpa = listStateCourtProfiles().find((profile) => profile.uf === "PA");
  assert.equal(tjpa.court, "TJPA");
  assert.equal(tjpa.url, "https://portal-certidao.tjpa.jus.br/solicitacao-certidao");
  assert.equal(tjpa.automationStatus, "agent_assisted");
  assert.equal(tjpa.platform, "agent_assisted");
  assert.equal(tjpa.captchaMode, "assisted");
  assert.deepEqual(tjpa.requiredFields, ["document", "birthDate", "fullName", "motherName", "naturality", "civilStatus", "nationality"]);
  assert.match(getStateCourtAgentPortalPrompt(tjpa), /nao pare so porque ainda existe iframe hCaptcha residual/i);
});

test("prompt TJRJ orienta fluxo CJE sem usar Adicionar para um unico CPF", () => {
  const tjrj = listStateCourtProfiles().find((profile) => profile.uf === "RJ");
  const prompt = getStateCourtAgentPortalPrompt(tjrj);
  assert.match(prompt, /formulario POST com id myForm1/i);
  assert.match(prompt, /Nao use o botao Adicionar/i);
  assert.match(prompt, /dd\/mm\/aaaa/i);
  assert.match(prompt, /Informacao pessoal/i);
  assert.match(prompt, /pare em handoff_human se houver reCAPTCHA/i);
});

test("catalogo TJPI coleta campos obrigatorios do formulario Europa", () => {
  const tjpi = listStateCourtProfiles().find((profile) => profile.uf === "PI");
  assert.equal(tjpi.court, "TJPI");
  assert.equal(tjpi.platform, "agent_assisted");
  assert.deepEqual(tjpi.requiredFields, [
    "document",
    "fullName",
    "rg",
    "issuingAuthority",
    "civilStatus",
    "motherName",
    "cep",
    "address",
    "addressNumber",
    "neighborhood",
    "stateUf",
    "city",
  ]);
  const prompt = getStateCourtAgentPortalPrompt(tjpi);
  assert.match(prompt, /Orgao Expedidor/);
  assert.match(prompt, /CEP/);
  assert.match(prompt, /Municipio/);
  assert.match(prompt, /orgaoExpedidor=issuingAuthority/);
  assert.match(prompt, /estadoCivil=civilStatus/);
  assert.match(prompt, /ufRequerente=stateUf/);
  assert.match(prompt, /municipioRequerente=city/);
});

test("encaminha campos TJDFT para collector", async () => {
  let receivedExtraFields = null;
  const service = createAuditService({
    getDb: () => ({ pool: null, dbReady: false }),
    getAuthContext: async () => ({ tenantId: 2, user: null, unauthorized: false }),
    customCollectors: {
      tjdft: {
        collect: async (input) => {
          receivedExtraFields = input.extraFields;
          return {
            fonte: "tjdft",
            status: "success",
            resultado: "nada_consta",
            dados: { ok: true },
          };
        },
      },
    },
  });

  const started = await service.startAudit({
    body: {
      documento: "52998224725",
      tipoDocumento: "cpf",
      fontes: ["tjdft"],
      extraFields: {
        tjdftPersonType: "pf",
        tjdftCertificateTypes: ["criminal", "civil"],
        firstName: "Maria",
        motherName: "Ana",
        fatherName: "Jose",
      },
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(Boolean(started.consultaId), true);
  assert.equal(receivedExtraFields.tjdftPersonType, "pf");
  assert.deepEqual(receivedExtraFields.tjdftCertificateTypes, ["criminal", "civil"]);
});

test("encaminha tribunal estadual selecionado para collector", async () => {
  let receivedExtraFields = null;
  const service = createAuditService({
    getDb: () => ({ pool: null, dbReady: false }),
    getAuthContext: async () => ({ tenantId: 1, user: null, unauthorized: false }),
    customCollectors: {
      tjdft: {
        collect: async (input) => {
          receivedExtraFields = input.extraFields;
          return {
            fonte: "tjdft",
            status: "unavailable",
            resultado: "indisponivel",
            dados: { officialUrl: input.extraFields.stateCourtUrl },
          };
        },
      },
    },
  });

  const started = await service.startAudit({
    body: {
      documento: "52998224725",
      tipoDocumento: "cpf",
      fontes: ["tjdft"],
      extraFields: {
        stateCourtUf: "SP",
        stateCourtName: "TJSP",
        stateCourtUrl: "https://esaj.tjsp.jus.br/sco/abrirCadastro.do",
      },
    },
  });

  assert.equal(started.status, "pending");
  for (let index = 0; index < 10 && !receivedExtraFields; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  assert.equal(receivedExtraFields.stateCourtUf, "SP");
  assert.equal(receivedExtraFields.stateCourtName, "TJSP");
});

test("tribunal estadual agent-assisted sem secret retorna indisponivel controlado", async () => {
  const previousOpenAiKey = process.env.AUDITA_OPENAI_API_KEY;
  const previousAgentKey = process.env.STATE_COURT_AGENT_API_KEY_SECRET;
  delete process.env.AUDITA_OPENAI_API_KEY;
  delete process.env.STATE_COURT_AGENT_API_KEY_SECRET;
  try {
    const result = await collectTjdft({
      documento: "25308218870",
      tipoDocumento: "cpf",
      extraFields: {
        stateCourtUf: "AC",
        stateCourtName: "TJAC",
        stateCourtUrl: "https://www.tjac.jus.br/servicos/certidoes/",
        stateCourtFields: {
          fullName: "Aparecido Seiti Katsumi",
        },
        stateCourtCertificateTypes: ["criminal", "civil"],
      },
    });

    assert.equal(result.status, "unavailable");
    assert.equal(result.resultado, "indisponivel");
    assert.equal(result.dados.tribunal, "TJAC");
    assert.equal(result.dados.uf, "AC");
    assert.equal(result.dados.automationStatus, "agent_assisted");
    assert.equal(result.dados.modo, "agent_assisted_unavailable");
    assert.match(result.errorMessage, /AUDITA_OPENAI_API_KEY/);
  } finally {
    if (previousOpenAiKey === undefined) {
      delete process.env.AUDITA_OPENAI_API_KEY;
    } else {
      process.env.AUDITA_OPENAI_API_KEY = previousOpenAiKey;
    }
    if (previousAgentKey === undefined) {
      delete process.env.STATE_COURT_AGENT_API_KEY_SECRET;
    } else {
      process.env.STATE_COURT_AGENT_API_KEY_SECRET = previousAgentKey;
    }
  }
});

test("tribunal agent-assisted nao bloqueia antes do agente por campo estadual faltante", async () => {
  const previousOpenAiKey = process.env.AUDITA_OPENAI_API_KEY;
  delete process.env.AUDITA_OPENAI_API_KEY;
  try {
    const result = await collectTjdft({
      documento: "25308218870",
      tipoDocumento: "cpf",
      extraFields: {
        stateCourtUf: "PI",
        stateCourtName: "TJPI",
        stateCourtUrl: "https://europa.tjpi.jus.br/certidao/unificada",
        stateCourtFields: {},
        stateCourtCertificateTypes: ["civil"],
      },
    });

    assert.equal(result.status, "unavailable");
    assert.equal(result.dados.automationStatus, "agent_assisted");
    assert.equal(result.dados.modo, "agent_assisted_unavailable");
    assert.deepEqual(result.dados.missingFields, [
      "fullName",
      "rg",
      "issuingAuthority",
      "civilStatus",
      "motherName",
      "cep",
      "address",
      "addressNumber",
      "neighborhood",
      "stateUf",
      "city",
    ]);
    assert.doesNotMatch(result.errorMessage, /exige campos adicionais/);
  } finally {
    if (previousOpenAiKey === undefined) {
      delete process.env.AUDITA_OPENAI_API_KEY;
    } else {
      process.env.AUDITA_OPENAI_API_KEY = previousOpenAiKey;
    }
  }
});

test("cache considera tribunal estadual selecionado", async () => {
  const service = createAuditService({
    getDb: () => ({ pool: null, dbReady: false }),
    getAuthContext: async () => ({ tenantId: 1, user: null, unauthorized: false }),
    customCollectors: {
      tjdft: {
        collect: async (input) => ({
          fonte: "tjdft",
          status: "manual_required",
          resultado: "indisponivel",
          dados: {
            tribunal: input.extraFields.stateCourtName,
            uf: input.extraFields.stateCourtUf,
          },
        }),
      },
    },
  });

  const baseBody = {
    documento: "25308218870",
    tipoDocumento: "cpf",
    fontes: ["tjdft"],
    extraFields: {
      firstName: "Aparecido Seiti Katsumi",
      motherName: "Nadir Oliveira Katsumi",
      fatherName: "Hisashi Katsumi",
      tjdftPersonType: "pf",
      tjdftCertificateTypes: ["criminal"],
    },
  };

  const ac = await service.startAudit({
    body: {
      ...baseBody,
      extraFields: { ...baseBody.extraFields, stateCourtUf: "AC", stateCourtName: "TJAC" },
    },
  });
  const sp = await service.startAudit({
    body: {
      ...baseBody,
      extraFields: { ...baseBody.extraFields, stateCourtUf: "SP", stateCourtName: "TJSP" },
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 50));
  const auditAc = await service.findAudit(ac.consultaId);
  const auditSp = await service.findAudit(sp.consultaId);

  assert.equal(auditAc.resultados[0].dados.tribunal, "TJAC");
  assert.equal(auditSp.resultados[0].dados.tribunal, "TJSP");
});

test("nao cacheia sessao assistida viva", async () => {
  let calls = 0;
  const service = createAuditService({
    getDb: () => ({ pool: null, dbReady: false }),
    getAuthContext: async () => ({ tenantId: 1, user: null, unauthorized: false }),
    customCollectors: {
      tjdft: {
        collect: async () => {
          calls += 1;
          return {
            fonte: "tjdft",
            status: "waiting_user_action",
            resultado: "indisponivel",
            dados: {
              assistedSession: `session-${calls}`,
              sessionOpen: true,
              resumo: "Sessao assistida pendente.",
            },
          };
        },
      },
    },
  });

  const body = {
    documento: "52998224725",
    tipoDocumento: "cpf",
    fontes: ["tjdft"],
    extraFields: {
      stateCourtUf: "SP",
      stateCourtName: "TJSP",
      stateCourtFields: { fullName: "Pessoa Teste" },
    },
  };

  const first = await service.startAudit({ body });
  const second = await service.startAudit({ body });

  await new Promise((resolve) => setTimeout(resolve, 80));
  const firstAudit = await service.findAudit(first.consultaId);
  const secondAudit = await service.findAudit(second.consultaId);

  assert.equal(calls, 2);
  assert.equal(firstAudit.resultados[0].dados.assistedSession, "session-1");
  assert.equal(secondAudit.resultados[0].dados.assistedSession, "session-2");
});

test("anexa evidencia em consulta audit real e conclui fonte pendente", async () => {
  const service = createAuditService({
    getDb: () => ({ pool: null, dbReady: false }),
    getAuthContext: async () => ({ tenantId: 1, user: null, unauthorized: false }),
    customCollectors: {
      tjdft: {
        collect: async () => ({
          fonte: "tjdft",
          status: "waiting_user_action",
          resultado: "indisponivel",
          dados: {
            assistedSession: "session-evidence",
            sessionOpen: true,
            resumo: "Validacao pendente.",
          },
        }),
      },
    },
  });

  const started = await service.startAudit({
    body: {
      documento: "52998224725",
      tipoDocumento: "cpf",
      fontes: ["tjdft"],
      extraFields: { stateCourtUf: "SP", stateCourtName: "TJSP" },
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 80));

  const result = await service.addEvidence(started.consultaId, {
    body: {
      executionId: "tjdft",
      evidenceType: "summary",
      title: "Resultado inspecionado",
      value: "Nada consta",
      fileName: "captura.jpg",
      contentBase64: "Y2FwdHVyYQ==",
    },
  });

  assert.equal(result.evidence.type, "summary");
  assert.equal(result.audit.resultados[0].status, "success");
  assert.equal(result.audit.resultados[0].resultado, "nada_consta");
  assert.equal(result.audit.resultados[0].evidence.length, 1);
  assert.equal(result.audit.resultados[0].evidence[0].fileName, "captura.jpg");
});

test("evidencia de checkpoint humano nao conclui fonte pendente", async () => {
  const service = createAuditService({
    getDb: () => ({ pool: null, dbReady: false }),
    getAuthContext: async () => ({ tenantId: 1, user: null, unauthorized: false }),
    customCollectors: {
      tjdft: {
        collect: async () => ({
          fonte: "tjdft",
          status: "waiting_user_action",
          resultado: "indisponivel",
          erro: "TJSP/ESAJ possui reCAPTCHA oficial antes do envio.",
          dados: {
            assistedSession: "session-pending-evidence",
            sessionOpen: true,
            resumo: "Validacao pendente.",
          },
        }),
      },
    },
  });

  const started = await service.startAudit({
    body: {
      documento: "52998224725",
      tipoDocumento: "cpf",
      fontes: ["tjdft"],
      extraFields: { stateCourtUf: "SP", stateCourtName: "TJSP" },
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 80));

  const result = await service.addEvidence(started.consultaId, {
    body: {
      executionId: "tjdft",
      evidenceType: "manual_step",
      title: "Checkpoint de validacao oficial",
      value: "Validacao oficial pendente na sessao assistida.",
      fileName: "checkpoint.jpg",
      contentBase64: "Y2hlY2twb2ludA==",
    },
  });

  assert.equal(result.evidence.type, "manual_step");
  assert.equal(result.audit.status, "partial");
  assert.equal(result.audit.resultados[0].status, "waiting_user_action");
  assert.equal(result.audit.resultados[0].resultado, "indisponivel");
  assert.equal(result.audit.resultados[0].evidence.length, 1);
  assert.equal(result.audit.resultados[0].evidence[0].fileName, "checkpoint.jpg");
});

test("classifica requiresRecaptcha como checkpoint humano de captcha", () => {
  assert.equal(classifyHumanCheckpoint({ requiresRecaptcha: true }), "captcha_or_recaptcha");
  assert.equal(classifyHumanCheckpoint({ requiresCaptcha: true }), "captcha_or_recaptcha");
  assert.equal(classifyHumanCheckpoint({ blockedByProtection: true, requiresRecaptcha: true }), "anti_bot_block");
});

test("relatorio captchaLab preserva campos preenchidos e checkpoint recaptcha", () => {
  const report = buildCaptchaLabReport({
    profile: { court: "TJSP", captchaMode: "assisted" },
    sessionOpen: true,
    sessionId: "sessao-teste",
    results: [
      {
        status: "waiting_user_action",
        requiresRecaptcha: true,
        filledFields: ["modelo", "cpf", "email", "cpf"],
      },
    ],
  });

  assert.equal(report.policy, "no_bypass");
  assert.equal(report.reachedCaptcha, true);
  assert.deepEqual(report.checkpoints, ["captcha_or_recaptcha"]);
  assert.deepEqual(report.filledFields, ["modelo", "cpf", "email"]);
  assert.equal(report.sessionOpen, true);
  assert.equal(report.assistedSession, "sessao-teste");
});

test("analisa snapshot de sessao assistida com pdf e protocolo", () => {
  const inspection = analyzeAssistedSessionSnapshot({
    title: "e-SAJ",
    url: "https://esaj.tjsp.jus.br/sco/resultado.do",
    text: "Pedido numero 12345-67 cadastrado. Certidao emitida.",
    links: [{ text: "Baixar certidao", href: "https://esaj.tjsp.jus.br/documento/certidao.pdf" }],
  });

  assert.equal(inspection.status, "result_available");
  assert.equal(inspection.protocol, "12345-67");
  assert.equal(inspection.pdfLinks.length, 1);
});

test("analisa certidao textual do TJBA como resultado disponivel", () => {
  const inspection = analyzeAssistedSessionSnapshot({
    title: "Portal de Certidoes TJBA",
    url: "https://portalcertidoes.tjba.jus.br/#/primeirograu",
    text: `
      CERTIDAO ESTADUAL DE 1 GRAU
      CERTIDAO N: 03672668E
      verifiquei NAO CONSTAR em nome da parte indicada.
    `,
    links: [],
  });

  assert.equal(inspection.status, "result_available");
  assert.equal(inspection.protocol, "03672668E");
});

test("analisa certidao textual do TJMA como resultado disponivel", () => {
  const inspection = analyzeAssistedSessionSnapshot({
    title: "JurisConsult",
    url: "https://jurisconsult.tjma.jus.br/#/certidao-generate-state-certificate-form",
    text: `
      Certidao Estadual Online
      CERTIDAO ESTADUAL - PRIMEIRO GRAU ACOES PENAIS
      Data da Emissao: 17/06/2026
      N da Certidao: 126309089-33
      Codigo de Validacao: aacdde497b
      Certifico que NADA CONSTA nos registros de distribuicao do 1 GRAU.
    `,
    links: [],
  });

  assert.equal(inspection.status, "result_available");
  assert.equal(inspection.protocol, "126309089-33");
});

test("analisa pedido ESAJ registrado para liberacao por email", () => {
  const inspection = analyzeAssistedSessionSnapshot({
    title: "e-SAJ",
    url: "https://www2.tjal.jus.br/sco/abrirCadastro.do",
    text: `
      O seu pedido foi cadastrado com sucesso.
      Para emissao da Certidao, serao encaminhadas instrucoes no e-mail informado.
      Prazo maximo para liberacao da Certidao 05 dias.
      Dados para Download da Certidao
      Numero do Pedido : 4816220
      Data do Pedido : 12/06/2026
    `,
    links: [],
  });

  assert.equal(inspection.status, "request_registered");
  assert.equal(inspection.protocol, "4816220");
  assert.equal(inspection.requestRegistered, true);
});

test("analisa snapshot de sessao assistida quando a pagina atual e o pdf", () => {
  const inspection = analyzeAssistedSessionSnapshot({
    title: "Certidao",
    url: "https://portal.tj.example/abrirDownloadCertidao.do?id=12345",
    text: "",
    links: [],
  });

  assert.equal(inspection.status, "result_available");
  assert.equal(inspection.pdfLinks.length, 1);
  assert.equal(inspection.pdfLinks[0].href, "https://portal.tj.example/abrirDownloadCertidao.do?id=12345");
});

test("nao trata menu do TJPA como certidao baixada", () => {
  const inspection = analyzeAssistedSessionSnapshot({
    title: "Portal Certidoes",
    url: "https://portal-certidao.tjpa.jus.br/",
    text: "Solicitar Certidao Utilize esse link para solicitar certidao Acompanhar Analise da Certidao Certidao ja requerida? Autenticidade Acesso Interno",
    links: [],
  });

  assert.equal(inspection.status, "no_result_yet");
  assert.equal(inspection.pdfLinks.length, 0);
});

test("valida conteudo de PDF capturado do TJPA", () => {
  const session = { courtUf: "PA" };
  assert.equal(
    isAssistedSessionPdfContentValid({
      session,
      rawText: "Solicitar Certidao Acompanhar Analise da Certidao Autenticidade Acesso Interno",
      generatedFromPage: true,
    }),
    false,
  );
  assert.equal(
    isAssistedSessionPdfContentValid({
      session,
      rawText: "CERTIDAO JUDICIAL Numero da Certidao 12345 Codigo de Validacao ABCD Certifico que NADA CONSTA",
    }),
    true,
  );
});

test("analisa PDF incorporado do TJPE como resultado disponivel", () => {
  const inspection = analyzeAssistedSessionSnapshot({
    title: "Emissao de Certidoes",
    url: "https://certidoesunificadas.app.tjpe.jus.br/certidao-criminal-pf",
    text: `
      PODER JUDICIARIO DO ESTADO DE PERNAMBUCO
      CERTIDAO CRIMINAL
      Data da Emissao: 17/06/2026 10:55
      N da Certidao: 1223901/2026
      N da Autenticidade: 1U.NR.KJ.4E.1F.1Q
    `,
    links: [],
    pdfEmbeds: [{ href: "blob:https://certidoesunificadas.app.tjpe.jus.br/abc", type: "application/pdf", text: "PDF viewer" }],
  });

  assert.equal(inspection.status, "result_available");
  assert.equal(inspection.protocol, "1223901/2026");
  assert.equal(inspection.pdfEmbeds.length, 1);
});

test("analisa snapshot de sessao assistida ainda pendente em captcha", () => {
  const inspection = analyzeAssistedSessionSnapshot({
    text: "Confirme que voce nao e um robo. reCAPTCHA pendente.",
    links: [],
  });

  assert.equal(inspection.status, "captcha_pending");
});

test("nao trata formulario TJPE com codigo de seguranca como PDF emitido", () => {
  const inspection = analyzeAssistedSessionSnapshot({
    title: "Emissao de Certidoes",
    url: "https://certidoesunificadas.app.tjpe.jus.br/certidao-criminal-pf",
    text: `
      Certidao Criminal - Pessoa Fisica
      Nome Completo Vicente Costa Zippinotti
      Codigo de Seguranca
      Apenas sera emitida pelo site do TJPE a certidao cujo resultado seja "NADA CONSTA"
      Emitir
    `,
    links: [],
  });

  assert.equal(inspection.status, "captcha_pending");
  assert.equal(inspection.protocol, "");
  assert.equal(inspection.pdfLinks.length, 0);
});

test("nao imprime formulario TJPE pendente mesmo com texto de nada consta", () => {
  const inspection = analyzeAssistedSessionSnapshot({
    title: "Emissao de Certidoes",
    url: "https://certidoesunificadas.app.tjpe.jus.br/certidao-criminal-pf",
    text: `
      Certid\\uE04Ao Criminal - Pessoa Fisica
      Nome Completo Vicente Costa Zippinotti
      Codigo de Segur\\uE02Cn\\u00E7\\uE02C
      Apenas sera emitida pelo site do TJPE a certidao cujo resultado seja "NADA CONSTA"
      Emitir
    `,
    links: [],
    pdfEmbeds: [{ href: "blob:https://certidoesunificadas.app.tjpe.jus.br/form", type: "application/pdf", text: "PDF viewer" }],
  });

  assert.equal(inspection.status, "captcha_pending");
  assert.equal(inspection.protocol, "");
});

test("nao trata formulario ESAJ como resultado disponivel", () => {
  const inspection = analyzeAssistedSessionSnapshot({
    title: "e-SAJ",
    url: "https://esaj.tjsp.jus.br/sco/abrirCadastro.do",
    text: "Cadastro de Pedido de Certidao Para pedir uma certidao, preencha os campos do formulario abaixo.",
    links: [
      { text: "Visualizar Certidao", href: "https://esaj.tjsp.jus.br/sco/abrirDownload.do" },
      { text: "Cadastro de Pedido de Certidao", href: "https://esaj.tjsp.jus.br/sco/abrirCadastro.do" },
    ],
  });

  assert.equal(inspection.status, "captcha_pending");
  assert.equal(inspection.protocol, "");
  assert.equal(inspection.pdfLinks.length, 0);
});

test("classifica erro oficial ESAJ apos envio como erro do portal", () => {
  const inspection = analyzeAssistedSessionSnapshot({
    title: "e-SAJ",
    url: "https://esaj.tjsp.jus.br/sco/salvarCadastro.do",
    text: "Cadastro de Pedido de Certidao Atencao Nao foi possivel executar esta operacao. Tente novamente mais tarde.",
    links: [],
  });

  assert.equal(inspection.status, "portal_error");
  assert.equal(inspection.protocol, "");
  assert.equal(inspection.pdfLinks.length, 0);
});

test("classifica NullPointerException do TJCE como erro oficial do portal", () => {
  const inspection = analyzeAssistedSessionSnapshot({
    title: "Sistema de Requerimento e Expedicao de Certidoes",
    url: "https://sirece.tjce.jus.br/sirece-web/nova/solicitacao.jsf",
    text: "Detalhes do erro Tipo de Excecao java.lang.NullPointerException Data 2026-06-16",
    links: [],
  });

  assert.equal(inspection.status, "portal_error");
  assert.equal(inspection.protocol, "");
  assert.equal(inspection.pdfLinks.length, 0);
});

test("classifica Service Unavailable como erro oficial do portal", () => {
  const inspection = analyzeAssistedSessionSnapshot({
    title: "Http/1.1 Service Unavailable",
    url: "https://sirece.tjce.jus.br/sirece-web/nova/solicitacao.jsf",
    text: "Http/1.1 Service Unavailable",
    links: [],
  });

  assert.equal(inspection.status, "portal_error");
  assert.equal(inspection.protocol, "");
  assert.equal(inspection.pdfLinks.length, 0);
});

