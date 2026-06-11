import test from "node:test";
import assert from "node:assert/strict";
import { createAuditService, validateCnpj, validateCpf } from "../services/audit.service.mjs";
import { calculateRiskScore } from "../services/risk-score.service.mjs";
import { listStateCourtProfiles } from "../services/state-courts.service.mjs";
import {
  analyzeAssistedSessionSnapshot,
  buildCaptchaLabReport,
  classifyHumanCheckpoint,
  collect as collectTjdft,
  esajModelValue,
  getCertificateTypesForInput,
} from "../collectors/tjdft.collector.mjs";

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

test("catalogo TJPR aponta para formulario publico de certidao", () => {
  const tjpr = listStateCourtProfiles().find((profile) => profile.uf === "PR");
  assert.equal(tjpr.court, "TJPR");
  assert.equal(tjpr.url, "https://www.tjpr.jus.br/certidao-de-2-grau-para-pessoa-fisica");
  assert.equal(tjpr.automationStatus, "mapped");
  assert.deepEqual(tjpr.requiredFields, ["document", "fullName", "email", "phone", "motherName", "fatherName", "birthDate"]);
});

test("catalogo mapeia aliases para tribunais estaduais parciais", () => {
  const mappedUfs = ["RJ", "MA", "MG", "PR", "RN", "TO", "PB", "SC", "RR", "MT", "BA"];
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

test("analisa snapshot de sessao assistida ainda pendente em captcha", () => {
  const inspection = analyzeAssistedSessionSnapshot({
    text: "Confirme que voce nao e um robo. reCAPTCHA pendente.",
    links: [],
  });

  assert.equal(inspection.status, "captcha_pending");
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

