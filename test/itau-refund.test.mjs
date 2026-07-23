import assert from "node:assert/strict";
import test from "node:test";

import {
  createItauRefundService,
  detectItauCandidateCharges,
  evaluateItauCase,
} from "../services/itau-refund.service.mjs";

test("detects known insurance charges without classifying them as improper", () => {
  const candidates = detectItauCandidateCharges(
    "Fatura Itau 14/09/2024 Seguro Fatura Protegida R$ 18,90 Pagamento recebido",
  );

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].label, "Seguro Fatura Protegida");
  assert.equal(candidates[0].amount, 18.9);
  assert.equal(candidates[0].answer, "pending");
});

test("does not flag an ordinary card purchase", () => {
  const candidates = detectItauCandidateCharges(
    "05/04/2025 SUPERMERCADO CENTRAL R$ 214,70 06/04/2025 POSTO AVENIDA R$ 180,00",
  );

  assert.deepEqual(candidates, []);
});

test("consumer confirmation changes a candidate into a possible unauthorized charge", () => {
  const result = evaluateItauCase({
    candidates: [
      {
        id: "charge-1",
        label: "Seguro Fatura Protegida",
        date: "2024-09-14",
        amount: 18.9,
        answer: "not_recognized",
      },
    ],
    answers: {
      priorComplaint: "unknown",
      continuedAfterCancellation: "no",
      bankPromisedRefund: "no",
      duplicateCharge: "no",
    },
  });

  assert.equal(result.classification, "possible_unauthorized");
  assert.equal(result.risk, "medio");
  assert.equal(result.totalDisputed, 18.9);
  assert.match(result.administrativeRequest, /Pedido de revisão e restituição/i);
  assert.match(result.administrativeRequest, /não é petição judicial/i);
});

test("continued billing after cancellation is treated as a strong signal", () => {
  const result = evaluateItauCase({
    candidates: [
      {
        id: "charge-1",
        label: "Seguro Renda Premiada",
        date: "2025-06-10",
        amount: 22,
        answer: "not_recognized",
      },
    ],
    answers: {
      priorComplaint: "yes",
      priorComplaintDate: "2025-11-02",
      continuedAfterCancellation: "yes",
      bankPromisedRefund: "no",
      duplicateCharge: "no",
    },
  });

  assert.equal(result.classification, "strong_indication");
  assert.equal(result.risk, "alto");
  assert.equal(result.agreementStatus, "potentially_eligible");
});

test("service keeps only normalized findings and supports an authenticated review", async () => {
  const service = createItauRefundService({
    now: () => Date.UTC(2026, 6, 23, 12),
    aiAnalyzer: async () => ({
      document_readable: true,
      institution_mentioned: true,
      billing_period: "07/2025",
      candidate_charges: [
        {
          label: "Seguro Compra Segura",
          description: "SEGURO COMPRA SEGURA",
          category: "seguro",
          date: "2025-07-10",
          amount: 12.5,
          evidence: "Lancamento recorrente identificado.",
          reason: "Produto de seguro que exige confirmacao do titular.",
          confidence: "high",
        },
      ],
      notes: [],
      model: "test-model",
      usage: { inputUnits: 10, outputUnits: 5, totalUnits: 15 },
    }),
  });

  const analyzed = await service.analyze({
    buffer: Buffer.from("Documento financeiro sem dados adicionais."),
    fileName: "fatura.txt",
    mimeType: "text/plain",
    tenantId: "tenant-a",
    userId: "user-a",
  });
  assert.equal(analyzed.case.candidates.length, 1);
  assert.equal(analyzed.case.document.processedBy, "openai_and_rules");
  assert.equal("rawText" in analyzed.case, false);

  const candidate = analyzed.case.candidates[0];
  const updated = service.updateCase(
    analyzed.case.id,
    {
      candidateAnswers: { [candidate.id]: "not_recognized" },
      priorComplaint: "yes",
      priorComplaintDate: "2025-10-01",
    },
    { tenantId: "tenant-a", userId: "user-a" },
  );
  assert.equal(updated.case.evaluation.classification, "possible_unauthorized");
  assert.equal(updated.case.evaluation.agreementStatus, "potentially_eligible");

  assert.equal(
    service.getCase(analyzed.case.id, { tenantId: "tenant-b", userId: "user-a" }).forbidden,
    true,
  );
});

test("reconciles the same charge found by AI and local rules without duplication", async () => {
  const service = createItauRefundService({
    aiAnalyzer: async () => ({
      document_readable: true,
      institution_mentioned: true,
      billing_period: "07/2025",
      candidate_charges: [
        {
          label: "SEGURO FATURA PROTEGIDA",
          description: "Seguro Fatura Protegida",
          category: "seguro",
          date: "2025-07-12",
          amount: 18.9,
          evidence: "Leitura visual do lancamento.",
          reason: "Seguro que deve ser confirmado pelo titular.",
          confidence: "high",
        },
      ],
      notes: [],
      model: "test-model",
    }),
  });

  const analyzed = await service.analyze({
    buffer: Buffer.from("11/07/2025 SEGURO FATURA PROTEGIDA R$ 18,90"),
    fileName: "fatura.txt",
    mimeType: "text/plain",
  });

  assert.equal(analyzed.case.candidates.length, 1);
  assert.equal(analyzed.case.candidates[0].date, "2025-07-11");
  assert.equal(analyzed.case.candidates[0].amount, 18.9);
});

test("rejects unsupported document formats", async () => {
  const service = createItauRefundService({ aiAnalyzer: async () => ({ unavailable: true }) });
  const result = await service.analyze({
    buffer: Buffer.from("arquivo"),
    fileName: "arquivo.exe",
    mimeType: "application/octet-stream",
  });

  assert.equal(result.invalid, true);
  assert.equal(result.reason, "unsupported_document_type");
});
