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
    priorComplaint: "yes",
    priorComplaintDate: "2026-07-23",
    priorComplaintProtocol: "ABC123",
  },
};

test("catalog exposes verified entry points for SP, RJ, MG and PR", () => {
  assert.deepEqual(
    listJecPortals().map((portal) => portal.uf),
    ["SP", "RJ", "MG", "PR"],
  );
  assert.match(getJecPortal("SP").startUrl, /tjsp\.jus\.br/);
  assert.match(getJecPortal("RJ").startUrl, /tjrj\.jus\.br/);
});

test("capital-specific forms are used only for Belo Horizonte and Curitiba", () => {
  assert.match(getJecPortal("MG", { city: "Belo Horizonte" }).startUrl, /docs\.google\.com/);
  assert.match(getJecPortal("MG", { city: "Uberlandia" }).startUrl, /tjmg\.jus\.br/);
  assert.match(getJecPortal("PR", { city: "Curitiba" }).startUrl, /idFormulario=6953/);
  assert.match(getJecPortal("PR", { city: "Londrina" }).startUrl, /ateliedeinovacao/);
});

test("petition draft uses confirmed facts and remains unfiled", () => {
  const prepared = prepareJecPetition({
    caseData: sampleCase,
    uf: "SP",
    city: "São Paulo",
    claimant: {
      fullName: "Cliente Teste",
      document: "52998224725",
      email: "cliente@example.com",
      address: "Rua de Teste, 100",
      city: "São Paulo",
      uf: "SP",
    },
  });

  assert.equal(prepared.ready, true);
  assert.equal(prepared.disputedCount, 1);
  assert.equal(prepared.knownAmountCount, 1);
  assert.equal(prepared.totalDisputed, 39.9);
  assert.match(prepared.draft, /RASCUNHO PARA REVISÃO - NÃO PROTOCOLADO/);
  assert.match(prepared.draft, /Proteção Horizonte/);
  assert.match(prepared.draft, /R\$\s+39,90/);
  assert.doesNotMatch(prepared.draft, /indeniza[cç][aã]o em dobro/i);

  const profile = buildJecAgentProfile(prepared);
  assert.equal(profile.blockAutomatedSubmit, true);
  assert.match(profile.agentInstructions, /Nunca clique em Enviar Formulário/i);
});

test("petition preparation reports missing data and unsupported states", () => {
  const incomplete = prepareJecPetition({ caseData: sampleCase, uf: "SP", claimant: {} });
  assert.equal(incomplete.ready, false);
  assert.ok(incomplete.missingFields.includes("document"));
  assert.ok(incomplete.missingFields.includes("address"));

  const unsupported = prepareJecPetition({ caseData: sampleCase, uf: "BA", claimant: {} });
  assert.equal(unsupported.unsupported, true);
});

test("petition draft labels an unknown charge amount instead of inventing zero", () => {
  const prepared = prepareJecPetition({
    caseData: {
      ...sampleCase,
      candidates: [{ ...sampleCase.candidates[0], amount: null }],
    },
    uf: "SP",
    city: "São Paulo",
    claimant: {
      fullName: "Cliente Teste",
      document: "52998224725",
      email: "cliente@example.com",
      address: "Rua de Teste, 100",
      city: "São Paulo",
      uf: "SP",
    },
  });

  assert.match(prepared.draft, /valor não identificado/);
  assert.doesNotMatch(prepared.draft, /R\$\s*0,00/);
  assert.equal(prepared.knownAmountCount, 0);
  assert.equal(prepared.totalDisputed, 0);
});

test("journey without historical statements requests document exhibition without inventing totals", () => {
  const prepared = prepareJecPetition({
    caseData: {
      ...sampleCase,
      answers: {
        ...sampleCase.answers,
        historicalEvidence: "yes",
        historicalDocumentsAvailable: "no",
      },
    },
    uf: "SP",
    city: "São Paulo",
    claimant: {
      fullName: "Cliente Teste",
      document: "52998224725",
      email: "cliente@example.com",
      address: "Rua de Teste, 100",
      city: "São Paulo",
      uf: "SP",
    },
  });

  assert.equal(prepared.journey, "without_historical_documents");
  assert.match(prepared.draft, /não possuir.*extratos ou contratos históricos/i);
  assert.match(prepared.draft, /exibição dos extratos, contratos e autorizações/i);
  assert.match(prepared.draft, /não foram presumidos nem calculados automaticamente/i);
  assert.doesNotMatch(prepared.draft, /23\.?156|5\.?000/);
});

test("journey with historical statements asks for period-by-period evidence review", () => {
  const prepared = prepareJecPetition({
    caseData: {
      ...sampleCase,
      answers: {
        ...sampleCase.answers,
        historicalDocumentsAvailable: "yes",
      },
    },
    uf: "SP",
    city: "São Paulo",
    claimant: {
      fullName: "Cliente Teste",
      document: "52998224725",
      email: "cliente@example.com",
      address: "Rua de Teste, 100",
      city: "São Paulo",
      uf: "SP",
    },
  });

  assert.equal(prepared.journey, "with_historical_documents");
  assert.match(prepared.draft, /organizados por período/i);
  assert.match(prepared.draft, /cobranças efetivamente comprovadas/i);
});

test("chat UI focuses the JEC secure intake returned by the AI tool", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");

  assert.match(source, /data-chat-jec=/);
  assert.match(source, /function activateJecIntake/);
  assert.match(source, /pendingJecFocusCaseId/);
  assert.match(source, /panel\.scrollIntoView/);
  assert.match(source, /state\.open \|\| state\.session/);
});
