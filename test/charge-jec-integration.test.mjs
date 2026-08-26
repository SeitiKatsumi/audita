import assert from "node:assert/strict";
import test from "node:test";

import { buildChargeJecHandoff } from "../charge-analysis.js";
import { buildChargeCalculationSnapshot } from "../charge-calculation.js";
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
  const caseData = {
    candidates: [
      {
        id: "charge-1",
        label: "Seguro Fatura Protegida",
        date: "2025-07-10",
        amount: 18.9,
        answer: "not_recognized",
      },
    ],
  };
  const calculation = buildChargeCalculationSnapshot(caseData, {
    asOf: "2025-07-10",
    ipcaRates: [{ data: "01/07/2025", valor: "0" }],
  });
  const handoff = buildChargeJecHandoff({
    handoffId: "model-1",
    documentAvailability: "complete",
    caseData,
    calculation,
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
  assert.equal(prepared.calculationReport.items.length, 1);
  assert.equal(prepared.claimant.doubleRefundAmount, 37.8);
  assert.equal(prepared.claimant.moralDamagesAmount, 4_400);
  assert.equal(prepared.claimant.caseValue, 4_456.7);
});

test("no-document charge flow cannot reach petition preparation", () => {
  const handoff = buildChargeJecHandoff({
    handoffId: "model-2",
    documentAvailability: "none",
    authorizationAnswer: "confirmed",
    estimate: {
      description: "Proteção do cartão",
      monthlyAmount: 19.9,
      months: 12,
      estimatedPaid: 238.8,
      hypotheticalDouble: 477.6,
    },
  });

  assert.equal(handoff.ready, false);
  assert.equal(handoff.caseData.answers.authorizationAnswer, "confirmed");
  assert.equal(handoff.caseData.answers.declaredEstimate, undefined);
  assert.deepEqual(handoff.caseData.candidates, []);
  assert.match(handoff.reason, /Anexe ao menos uma fatura ou extrato/);
});
