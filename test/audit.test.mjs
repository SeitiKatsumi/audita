import test from "node:test";
import assert from "node:assert/strict";
import { createAuditService, validateCnpj, validateCpf } from "../services/audit.service.mjs";
import { calculateRiskScore } from "../services/risk-score.service.mjs";
import { listStateCourtProfiles } from "../services/state-courts.service.mjs";
import { collect as collectTjdft, getCertificateTypesForInput } from "../collectors/tjdft.collector.mjs";

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
    assert.equal(["active", "mapped", "needs_mapping"].includes(profile.automationStatus), true);
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

test("catalogo TJAP usa Tucujuris com campos reais do formulario", () => {
  const tjap = listStateCourtProfiles().find((profile) => profile.uf === "AP");
  assert.equal(tjap.court, "TJAP");
  assert.equal(tjap.url, "https://tucujuris.tjap.jus.br/pages/certidao-publica/certidao-publica.html");
  assert.equal(tjap.automationStatus, "active");
  assert.equal(tjap.automatic, true);
  assert.equal(tjap.captchaMode, "assisted");
  assert.equal(tjap.frameMode, "new_tab");
  assert.equal(tjap.blocker, "cloudflare");
  assert.deepEqual(tjap.requiredFields, ["document", "fullName", "gender", "birthDate", "motherName", "rg", "email"]);
  assert.deepEqual(tjap.certificateTypes, ["civil", "criminal", "especial", "falencia"]);
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

test("tribunal estadual sem adapter ativo retorna portal oficial guiado", async () => {
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

  assert.equal(result.status, "manual_required");
  assert.equal(result.resultado, "indisponivel");
  assert.equal(result.dados.tribunal, "TJAC");
  assert.equal(result.dados.uf, "AC");
  assert.equal(result.dados.certidoes.length, 2);
  assert.match(result.dados.resumo, /TJAC cadastrado/);
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

