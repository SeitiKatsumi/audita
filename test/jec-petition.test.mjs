import assert from "node:assert/strict";
import test from "node:test";

import {
  buildJecAgentProfile,
  getJecManualFilingGuide,
  getJecPortal,
  listJecPortals,
  prepareJecPetition,
  suggestJecClaimValues,
} from "../services/jec-petition.service.mjs";

const sampleCase = {
  candidates: [
    {
      id: "charge-1",
      label: "Proteção Horizonte",
      date: "2026-07-22",
      amount: 39.9,
      answer: "not_recognized",
    },
  ],
  answers: {
    historicalEvidence: "yes",
    historicalDocumentsAvailable: "yes",
    priorComplaint: "yes",
    priorComplaintDate: "2026-07-23",
    priorComplaintProtocol: "ABC123",
  },
};

const completeClaimant = {
  fullName: "Cliente Teste",
  document: "52998224725",
  rg: "123456789",
  nationality: "brasileiro",
  maritalStatus: "solteiro",
  profession: "analista",
  email: "cliente@example.com",
  phone: "11999999999",
  address: "Rua de Teste, 100",
  city: "São Paulo",
  uf: "SP",
  doubleRefundAmount: "79,80",
  lostProfitsAmount: "0,00",
  moralDamagesAmount: "5000,00",
  caseValue: "5079,80",
};

test("catalog exposes verified entry points for configured JEC routes", () => {
  assert.deepEqual(
    listJecPortals().map((portal) => portal.uf),
    ["SP", "RJ", "MG", "PR", "MT", "DF", "GO", "AC", "AM", "CE", "MA", "PA", "PB", "ES", "SC", "BA", "RO", "RR", "PI", "SE", "PE", "TO", "RN", "AL", "AP", "MS", "RS"],
  );
  assert.match(getJecPortal("SP").startUrl, /tjsp\.jus\.br/);
  assert.match(getJecPortal("RJ").startUrl, /tjrj\.jus\.br/);
  assert.match(getJecPortal("PR").startUrl, /ejud\.tjpr\.jus\.br/);
  assert.match(getJecPortal("MT").startUrl, /atermacao\.tjmt\.jus\.br/);
  assert.match(getJecPortal("DF").startUrl, /tjdft\.jus\.br/);
  assert.match(getJecPortal("GO").startUrl, /orquestrador\.tjgo\.jus\.br/);
  assert.match(getJecPortal("AC").startUrl, /tjac\.jus\.br/);
  assert.match(getJecPortal("AM").startUrl, /tjam\.jus\.br/);
  assert.match(getJecPortal("CE").startUrl, /sisatermacao\.tjce\.jus\.br/);
  assert.match(getJecPortal("MA").startUrl, /tjma\.jus\.br/);
  assert.match(getJecPortal("PA").startUrl, /tjpa\.jus\.br/);
  assert.match(getJecPortal("PB").startUrl, /app\.tjpb\.jus\.br/);
  assert.match(getJecPortal("AP").startUrl, /pje\.tjap\.jus\.br/);
  assert.match(getJecPortal("MS").startUrl, /eproc1g\.tjms\.jus\.br/);
  assert.match(getJecPortal("RS").startUrl, /tjrs\.jus\.br/);
  for (const uf of ["SP", "RJ", "MG", "PR"]) {
    const guide = getJecPortal(uf).guide;
    assert.equal(guide.verifiedAt, "2026-07-27");
    assert.ok(guide.steps.length >= 6);
    assert.ok(guide.humanOnly.length >= 3);
    assert.ok(guide.sources.every((source) => source.startsWith("https://")));
  }
});

test("capital-specific forms are used only for Belo Horizonte and Curitiba", () => {
  assert.match(getJecPortal("MG", { city: "Belo Horizonte" }).startUrl, /docs\.google\.com/);
  assert.match(getJecPortal("MG", { city: "Uberlandia" }).startUrl, /tjmg\.jus\.br/);
  assert.match(getJecPortal("PR", { city: "Curitiba" }).startUrl, /idFormulario=6953/);
  assert.match(getJecPortal("PR", { city: "Londrina" }).startUrl, /ejud\.tjpr\.jus\.br/);
});

test("manual filing guide exposes official links and keeps final submission human", () => {
  const guide = getJecManualFilingGuide("SP", { city: "Sao Paulo" });

  assert.equal(guide.tribunal, "TJSP");
  assert.equal(guide.finalActionHumanOnly, true);
  assert.match(guide.portalUrl, /^https:\/\/.*tjsp\.jus\.br/);
  assert.ok(guide.steps.length >= 5);
  assert.match(guide.steps.at(-1), /pessoalmente/i);
});

test("petition draft uses the supplied audited-values model", () => {
  const prepared = prepareJecPetition({
    caseData: sampleCase,
    uf: "SP",
    city: "São Paulo",
    claimant: completeClaimant,
    generatedAt: new Date("2026-07-27T12:00:00-03:00"),
  });

  assert.equal(prepared.ready, true);
  assert.equal(prepared.template.id, "audited_values");
  assert.equal(prepared.template.sourceModel, 1);
  assert.equal(prepared.disputedCount, 1);
  assert.equal(prepared.knownAmountCount, 1);
  assert.equal(prepared.totalDisputed, 39.9);
  assert.match(prepared.draft, /AÇÃO DECLARATÓRIA DE INEXISTÊNCIA DE DÉBITO/);
  assert.match(prepared.draft, /Cliente Teste, brasileiro, solteiro, analista/);
  assert.match(prepared.draft, /R\$\s+79,80/);
  assert.match(prepared.draft, /R\$\s+5\.079,80/);
  assert.doesNotMatch(prepared.draft, /\[PENDENTE:/);

  const profile = buildJecAgentProfile(prepared);
  assert.equal(profile.blockAutomatedSubmit, true);
  assert.match(profile.agentInstructions, /Nunca clique em Enviar Formulário/i);
  assert.match(profile.agentInstructions, /Petição inicial/i);
  assert.match(profile.agentInstructions, /Confirmar ajuizamento/i);
});

test("AI claim suggestion uses only evidenced disputed amounts", () => {
  const suggestion = suggestJecClaimValues({ caseData: sampleCase });

  assert.deepEqual(suggestion.values, {
    doubleRefundAmount: "79,80",
    lostProfitsAmount: "",
    moralDamagesAmount: "",
    caseValue: "79,80",
  });
  assert.equal(suggestion.evidencedPrincipal, 39.9);
  assert.equal(suggestion.reviewRequired, true);
  assert.match(suggestion.notes.join("\n"), /R\$ 39,90/);
  assert.match(suggestion.disclaimer, /revisão jurídica/i);
});

test("AI claim suggestion does not capitalize unsupported historical recurrence", () => {
  const suggestion = suggestJecClaimValues({
    caseData: {
      ...sampleCase,
      candidates: [{ ...sampleCase.candidates[0], amount: null }],
      answers: {
        ...sampleCase.answers,
        historicalEvidence: "yes",
        historicalDocumentsAvailable: "no",
      },
    },
  });

  assert.equal(suggestion.values.doubleRefundAmount, "");
  assert.equal(suggestion.values.caseValue, "");
  assert.equal(suggestion.values.lostProfitsAmount, "");
  assert.equal(suggestion.values.moralDamagesAmount, "");
  assert.match(suggestion.notes.join("\n"), /não entrou no cálculo/i);
});

test("AI claim suggestion preserves amounts already supplied for human review", () => {
  const suggestion = suggestJecClaimValues({
    caseData: sampleCase,
    claimant: completeClaimant,
  });

  assert.equal(suggestion.values.doubleRefundAmount, "79,80");
  assert.equal(suggestion.values.lostProfitsAmount, "");
  assert.equal(suggestion.values.moralDamagesAmount, "5.000,00");
  assert.equal(suggestion.values.caseValue, "5.079,80");
});

test("AI claim suggestion uses losses expressly quantified in conversation", () => {
  const suggestion = suggestJecClaimValues({
    caseData: {
      ...sampleCase,
      answers: {
        ...sampleCase.answers,
        reportedLostProfitsAmount: 350,
        requestedMoralDamagesAmount: 2_000,
      },
    },
  });

  assert.equal(suggestion.values.doubleRefundAmount, "79,80");
  assert.equal(suggestion.values.lostProfitsAmount, "350,00");
  assert.equal(suggestion.values.moralDamagesAmount, "2.000,00");
  assert.equal(suggestion.values.caseValue, "2.429,80");
  assert.match(suggestion.notes.join("\n"), /valor informado/i);
});

test("PR guide routes Curitiba banking matters to the official banking option", () => {
  const portal = getJecPortal("PR", { city: "Curitiba" });
  assert.match(portal.guide.steps.join("\n"), /BANCÁRIO/i);
  assert.match(portal.guide.caseNotes.join("\n"), /independentemente do bairro/i);
});

test("petition preparation reports every field needed before PDF generation", () => {
  const incomplete = prepareJecPetition({ caseData: sampleCase, uf: "SP", claimant: {} });
  assert.equal(incomplete.ready, false);
  assert.ok(incomplete.missingFields.includes("document"));
  assert.ok(incomplete.missingFields.includes("address"));
  assert.ok(incomplete.missingFields.includes("doubleRefundAmount"));
  assert.match(incomplete.draft, /\[PENDENTE: FULL_NAME\]/);

  const unsupported = prepareJecPetition({ caseData: sampleCase, uf: "XX", claimant: {} });
  assert.equal(unsupported.unsupported, true);
});

test("petition omits optional claims that do not have a positive reviewed value", () => {
  const prepared = prepareJecPetition({
    caseData: {
      ...sampleCase,
      answers: {
        ...sampleCase.answers,
        historicalDocumentsAvailable: "no",
      },
    },
    uf: "SP",
    city: "São Paulo",
    claimant: {
      ...completeClaimant,
      historicalDocumentsAvailable: "no",
      lostProfitsAmount: "",
      moralDamagesAmount: "",
      caseValue: "79,80",
    },
  });

  assert.equal(prepared.ready, true);
  assert.doesNotMatch(prepared.draft, /\[PENDENTE: (?:LOST_PROFITS|MORAL_DAMAGES)\]/);
  assert.doesNotMatch(prepared.draft, /Lucros Cessantes/i);
  assert.doesNotMatch(prepared.draft, /Danos Morais/i);
  assert.doesNotMatch(prepared.draft, /R\$\s+0,00/);
  assert.match(prepared.warnings.join("\n"), /Danos morais não foram incluídos/i);
});

test("petition validates CPF and composes a structured address", () => {
  const structured = prepareJecPetition({
    caseData: sampleCase,
    uf: "SP",
    city: "São Paulo",
    claimant: {
      ...completeClaimant,
      address: "",
      postalCode: "01310-100",
      street: "Avenida Paulista",
      addressNumber: "1000",
      addressComplement: "Conjunto 10",
      district: "Bela Vista",
    },
  });

  assert.equal(structured.ready, true);
  assert.equal(
    structured.claimant.address,
    "Avenida Paulista, 1000 - Conjunto 10 - Bela Vista - São Paulo/SP - 01310-100",
  );
  assert.match(structured.draft, /529\.982\.247-25/);
  assert.match(structured.draft, /\(11\) 99999-9999/);

  const invalidCpf = prepareJecPetition({
    caseData: sampleCase,
    uf: "SP",
    claimant: { ...completeClaimant, document: "111.111.111-11" },
  });
  assert.ok(invalidCpf.missingFields.includes("document"));
});

test("petition metadata does not invent a total for a charge without amount", () => {
  const prepared = prepareJecPetition({
    caseData: {
      ...sampleCase,
      candidates: [{ ...sampleCase.candidates[0], amount: null }],
    },
    uf: "SP",
    city: "São Paulo",
    claimant: completeClaimant,
  });

  assert.equal(prepared.knownAmountCount, 0);
  assert.equal(prepared.totalDisputed, 0);
  assert.match(prepared.draft, /R\$\s+79,80/);
});

test("journey without historical statements selects the supplied exhibition model", () => {
  const prepared = prepareJecPetition({
    caseData: {
      ...sampleCase,
      answers: {
        ...sampleCase.answers,
        historicalDocumentsAvailable: "no",
      },
    },
    uf: "SP",
    city: "São Paulo",
    claimant: {
      ...completeClaimant,
      historicalDocumentsAvailable: "no",
    },
  });

  assert.equal(prepared.journey, "without_historical_documents");
  assert.equal(prepared.template.id, "document_exhibition");
  assert.equal(prepared.template.sourceModel, 2);
  assert.ok(
    prepared.template.reviewNotes.some((note) =>
      /recorrência relatada/i.test(note),
    ),
  );
  assert.doesNotMatch(prepared.draft, /23\.?156/);
  assert.match(
    prepared.draft,
    /AÇÃO DECLARATÓRIA DE INEXISTÊNCIA DE RELAÇÃO JURÍDICA C\/C EXIBIÇÃO INCIDENTAL DE DOCUMENTOS/i,
  );
  assert.match(prepared.draft, /documento recente fornecido/i);
  assert.match(prepared.draft, /Proteção Horizonte/i);
  assert.match(prepared.draft, /22\/07\/2026/i);
  assert.match(prepared.draft, /extensão temporal permanece não comprovada/i);
  assert.match(prepared.draft, /exiba em juízo/i);
  assert.doesNotMatch(prepared.draft, /auditoria analítica de seus extratos e faturas/i);
  assert.doesNotMatch(prepared.draft, /totalizando o valor atualizado/i);
  assert.doesNotMatch(prepared.draft, /R\$\s+0,00/);
  assert.doesNotMatch(prepared.draft, /Lucros Cessantes/i);
});

test("document-exhibition model includes optional claims only when a positive value is supplied", () => {
  const prepared = prepareJecPetition({
    caseData: {
      ...sampleCase,
      answers: {
        ...sampleCase.answers,
        historicalDocumentsAvailable: "no",
      },
    },
    uf: "SP",
    city: "São Paulo",
    claimant: {
      ...completeClaimant,
      historicalDocumentsAvailable: "no",
      lostProfitsAmount: "350,00",
      moralDamagesAmount: "2000,00",
      caseValue: "2429,80",
    },
  });

  assert.equal(prepared.ready, true);
  assert.match(prepared.draft, /Lucros Cessantes/i);
  assert.match(prepared.draft, /R\$\s+350,00/);
  assert.match(prepared.draft, /Danos Morais/i);
  assert.match(prepared.draft, /R\$\s+2\.000,00/);
  assert.doesNotMatch(prepared.draft, /R\$\s+0,00/);
});

test("journey with historical statements selects the supplied audited model", () => {
  const prepared = prepareJecPetition({
    caseData: sampleCase,
    uf: "SP",
    city: "São Paulo",
    claimant: completeClaimant,
  });

  assert.equal(prepared.journey, "with_historical_documents");
  assert.equal(prepared.template.id, "audited_values");
  assert.match(
    prepared.draft,
    /auditoria técnica profunda por meio da plataforma IA AUDITA/i,
  );
});

test("chat UI focuses the JEC secure intake returned by the AI tool", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(source, /data-chat-jec=/);
  assert.match(source, /function activateJecIntake/);
  assert.match(source, /pendingJecFocusCaseId/);
  assert.match(source, /panel\.scrollIntoView/);
  assert.match(source, /state\.open \|\| state\.prepared/);
  assert.match(source, /\/api\/jec\/petitions\/pdf/);
  assert.match(source, /Baixar PDF para revisão/);
  assert.match(source, /data-jec-monitoring-form/);
  assert.match(source, /\/api\/integrations\/direct-data\/tj\/processes/);
  assert.match(source, /Acessar portal oficial/);
  assert.match(source, /Conhecer suporte profissional/);
  assert.doesNotMatch(source, /data-jec-action="open"/);
  assert.doesNotMatch(source, /Abrir portal assistido/);
  assert.match(source, /Sugestão da IA/);
  assert.match(source, /suggestion\.notes/);
  assert.match(source, /\/api\/user\/profile/);
  assert.match(source, /data-jec-mask="cpf"/);
  assert.match(source, /name="postalCode"/);
  assert.match(source, /Salvar estes dados no meu perfil/);
});

test("JEC browser is disabled by default while PDF and manual filing stay available", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");

  assert.match(source, /AUDITA_JEC_BROWSER_ENABLED/);
  assert.match(source, /jec_browser_temporarily_disabled/);
  assert.match(source, /O envio assistido esta temporariamente desativado/);
});
