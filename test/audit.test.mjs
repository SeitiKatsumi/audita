import test from "node:test";
import assert from "node:assert/strict";
import { createAuditService, validateCnpj, validateCpf } from "../services/audit.service.mjs";
import { calculateRiskScore } from "../services/risk-score.service.mjs";
import { getCertificateTypesForInput } from "../collectors/tjdft.collector.mjs";

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

test("encaminha campos TJDFT para collector", async () => {
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

