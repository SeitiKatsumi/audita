import assert from "node:assert/strict";
import test from "node:test";

import {
  buildJecAgentProfile,
  getJecPortal,
  listJecPortals,
  prepareJecPetition,
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

test("catalog exposes verified entry points for SP, RJ, MG and PR", () => {
  assert.deepEqual(
    listJecPortals().map((portal) => portal.uf),
    ["SP", "RJ", "MG", "PR"],
  );
  assert.match(getJecPortal("SP").startUrl, /tjsp\.jus\.br/);
  assert.match(getJecPortal("RJ").startUrl, /tjrj\.jus\.br/);
  assert.match(getJecPortal("PR").startUrl, /ejud\.tjpr\.jus\.br/);
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

  const unsupported = prepareJecPetition({ caseData: sampleCase, uf: "BA", claimant: {} });
  assert.equal(unsupported.unsupported, true);
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
      /ausência dos documentos históricos/i.test(note),
    ),
  );
  assert.doesNotMatch(prepared.draft, /23\.?156/);
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
  assert.match(source, /state\.open \|\| state\.session/);
  assert.match(source, /\/api\/jec\/petitions\/pdf/);
  assert.match(source, /Baixar PDF para revisão/);
});
