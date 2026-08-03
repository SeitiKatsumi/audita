import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChargeEstimate,
  buildChargeJecHandoff,
} from "../charge-analysis.js";
import { prepareJecPetition } from "../services/jec-petition.service.mjs";

const claimant = {
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
};

test("documentary charge flow reaches a ready model 1 petition", () => {
  const handoff = buildChargeJecHandoff({
    handoffId: "model-1",
    documentAvailability: "complete",
    caseData: {
      candidates: [
        {
          id: "charge-1",
          label: "Seguro Fatura Protegida",
          date: "2025-07-10",
          amount: 18.9,
          answer: "not_recognized",
        },
      ],
    },
  });
  const prepared = prepareJecPetition({
    caseData: handoff.caseData,
    claimant: { ...claimant, ...handoff.suggestion.values },
    uf: "SP",
    city: "São Paulo",
  });

  assert.equal(handoff.ready, true);
  assert.equal(prepared.ready, true);
  assert.equal(prepared.template.sourceModel, 1);
  assert.equal(prepared.template.id, "audited_values");
  assert.match(prepared.draft, /Seguro Fatura Protegida/i);
});

test("no-statement charge flow reaches a ready declaratory model 2 petition", () => {
  const handoff = buildChargeJecHandoff({
    handoffId: "model-2",
    documentAvailability: "none",
    authorizationAnswer: "confirmed",
    estimate: {
      description: "Proteção do cartão",
      ...buildChargeEstimate({
        monthlyAmount: 19.9,
        durationValue: 12,
        durationUnit: "months",
      }),
    },
  });
  const prepared = prepareJecPetition({
    caseData: handoff.caseData,
    claimant: { ...claimant, ...handoff.suggestion.values },
    uf: "SP",
    city: "São Paulo",
  });

  assert.equal(handoff.ready, true);
  assert.equal(handoff.caseData.answers.authorizationAnswer, "confirmed");
  assert.equal(prepared.ready, true);
  assert.equal(prepared.template.sourceModel, 2);
  assert.equal(prepared.template.id, "document_exhibition");
  assert.match(prepared.draft, /valor mensal aproximado/i);
  assert.match(prepared.draft, /estimativa inicial sujeita à apuração/i);
  assert.doesNotMatch(prepared.draft, /documento recente fornecido/i);
});
