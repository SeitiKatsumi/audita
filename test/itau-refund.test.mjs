import assert from "node:assert/strict";
import test from "node:test";

import {
  createItauRefundService,
  detectItauCandidateCharges,
  evaluateItauCase,
  extractItauSearchableEntries,
  findDirectedItauEntries,
  updateItauCaseSnapshot,
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

test("extracts searchable transactions without classifying them as candidates", () => {
  const entries = extractItauSearchableEntries([
    "18/07/2026 StreamPlay Assinatura mensal -R$ 34,90",
    "22/07/2026 Protecao Horizonte Seguro -R$ 39.90",
  ].join("\n"));

  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0], {
    description: "StreamPlay Assinatura mensal",
    date: "2026-07-18",
    amount: 34.9,
    evidence: "18/07/2026 StreamPlay Assinatura mensal -R$ 34,90",
  });
  assert.equal(findDirectedItauEntries(entries, "stream play")[0].matchMethod, "fuzzy");
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
  assert.equal(result.administrativeRequest, undefined);
  assert.match(result.nextActions.join(" "), /Juizado Especial/i);
  assert.doesNotMatch(result.nextActions.join(" "), /administrativ|protocolo/i);
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
  assert.equal(result.agreementStatus, "historical_context_only");
  assert.match(result.agreementLabel, /via judicial/i);
});

test("a 2026 charge is outside the collective agreement regardless of prior complaint", () => {
  const result = evaluateItauCase({
    candidates: [
      {
        id: "charge-2026",
        label: "Protecao Horizonte",
        date: "2026-07-22",
        amount: 39.9,
        answer: "not_recognized",
      },
    ],
    answers: {
      historicalEvidence: "no",
      priorComplaint: "no",
    },
  });

  assert.equal(result.agreementStatus, "outside_period");
  assert.match(result.agreementLabel, /fora do per[ií]odo/i);
  assert.doesNotMatch(result.nextActions.join(" "), /reclamacao anterior.*18\/12\/2025/i);
});

test("legacy complaint evidence is preserved without blocking the judicial path", () => {
  const updated = updateItauCaseSnapshot(
    {
      id: "approximate-complaint",
      status: "review_required",
      candidates: [
        {
          id: "charge-1",
          label: "Seguro Fatura Protegida",
          date: "2025-07-10",
          amount: 18.9,
          answer: "not_recognized",
        },
      ],
      answers: {
        priorComplaint: "yes",
      },
    },
    {
      priorComplaintDateApproximate: "2025-11",
      priorComplaintDateStatus: "approximate",
      priorComplaintProtocolStatus: "unavailable",
    },
  );

  assert.equal(updated.answers.priorComplaintDateApproximate, "2025-11");
  assert.equal(updated.answers.priorComplaintDateStatus, "approximate");
  assert.equal(updated.answers.priorComplaintProtocolStatus, "unavailable");
  assert.equal(updated.evaluation.agreementStatus, "historical_context_only");
  assert.match(updated.evaluation.agreementLabel, /via judicial/i);
  assert.match(updated.evaluation.nextActions.join(" "), /Juizado Especial/i);
  assert.doesNotMatch(updated.evaluation.nextActions.join(" "), /e-mail|SMS|administrativ/i);
});

test("legacy complaint date is not used to gate the current judicial path", () => {
  const result = evaluateItauCase({
    candidates: [
      {
        id: "charge-1",
        label: "Seguro Fatura Protegida",
        date: "2025-07-10",
        amount: 18.9,
        answer: "not_recognized",
      },
    ],
    answers: {
      priorComplaint: "yes",
      priorComplaintDateStatus: "unknown",
      priorComplaintProtocolStatus: "unavailable",
    },
  });

  assert.equal(result.agreementStatus, "historical_context_only");
  assert.match(result.agreementLabel, /via judicial/i);
  assert.doesNotMatch(result.agreementLabel, /reclamação|informe a data/i);
});

test("a saved chat snapshot can continue after the in-memory case expires", () => {
  const updated = updateItauCaseSnapshot(
    {
      id: "expired-case",
      status: "review_required",
      candidates: [
        { id: "protection", label: "Protecao Horizonte", date: "2026-07-22", answer: "not_recognized" },
        { id: "stream", label: "StreamPlay", date: "2026-07-18", answer: "pending" },
      ],
      answers: { historicalEvidence: "pending", priorComplaint: "pending" },
    },
    {
      candidateAnswers: { stream: "recognized" },
      historicalEvidence: "no",
    },
  );

  assert.equal(updated.candidates[1].answer, "recognized");
  assert.equal(updated.answers.historicalEvidence, "no");
  assert.equal(updated.evaluation.agreementStatus, "outside_period");
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
  assert.equal("searchEntries" in analyzed.case, false);

  const candidate = analyzed.case.candidates[0];
  const updated = service.updateCase(
    analyzed.case.id,
    {
      candidateAnswers: { [candidate.id]: "not_recognized" },
      historicalEvidence: "yes",
      priorComplaint: "yes",
      priorComplaintDate: "2025-10-01",
    },
    { tenantId: "tenant-a", userId: "user-a" },
  );
  assert.equal(updated.case.evaluation.classification, "possible_unauthorized");
  assert.equal(updated.case.evaluation.agreementStatus, "historical_context_only");
  assert.equal(updated.case.answers.historicalEvidence, "yes");

  assert.equal(
    service.getCase(analyzed.case.id, { tenantId: "tenant-b", userId: "user-a" }).forbidden,
    true,
  );
});

test("directed search recovers a missed charge from attached document evidence", async () => {
  const service = createItauRefundService({
    aiAnalyzer: async () => ({
      document_readable: true,
      institution_mentioned: true,
      billing_period: "07/2026",
      candidate_charges: [],
      searchable_entries: [
        {
          description: "StreamPlay Assinatura mensal",
          date: "2026-07-18",
          amount: 34.9,
          evidence: "18/07/2026 StreamPlay Assinatura mensal -R$ 34,90",
        },
      ],
      notes: [],
      model: "test-model",
    }),
  });
  const analyzed = await service.analyze({
    buffer: Buffer.from("Documento sem catalogo local."),
    fileName: "julho.txt",
    mimeType: "text/plain",
    tenantId: "tenant-a",
    userId: "user-a",
  });
  assert.equal(analyzed.case.candidates.length, 0);

  const result = service.searchCases(
    [analyzed.case.id],
    "StreamPlay",
    { tenantId: "tenant-a", userId: "user-a" },
  );
  assert.equal(result.matches.length, 1);
  assert.equal(result.cases[0].candidates.length, 1);
  assert.equal(result.cases[0].candidates[0].origin, "directed_search");
  assert.equal(result.cases[0].candidates[0].answer, "pending");
  assert.equal(result.cases[0].candidates[0].amount, 34.9);
  assert.equal(result.cases[0].candidates[0].date, "2026-07-18");
});

test("directed search keeps automatic candidates and adds only evidenced matches", async () => {
  const service = createItauRefundService({
    aiAnalyzer: async () => ({
      document_readable: true,
      institution_mentioned: true,
      billing_period: "07/2026",
      candidate_charges: [
        {
          label: "Protecao Horizonte",
          description: "Protecao Horizonte",
          category: "seguro",
          date: "2026-07-22",
          amount: 39.9,
          evidence: "22/07/2026 Protecao Horizonte -R$ 39,90",
          reason: "Seguro para confirmacao.",
          confidence: "high",
        },
      ],
      searchable_entries: [
        {
          description: "StreamPlay Assinatura mensal",
          date: "2026-07-18",
          amount: 34.9,
          evidence: "18/07/2026 StreamPlay Assinatura mensal -R$ 34,90",
        },
      ],
      notes: [],
      model: "test-model",
    }),
  });
  const analyzed = await service.analyze({
    buffer: Buffer.from("Documento financeiro."),
    fileName: "julho.txt",
    mimeType: "text/plain",
  });
  const result = service.searchCases([analyzed.case.id], "StreamPlay");

  assert.equal(result.cases[0].candidates.length, 2);
  assert.deepEqual(
    result.cases[0].candidates.map((candidate) => candidate.origin).sort(),
    ["auto_detected", "directed_search"],
  );
});

test("directed search without document evidence creates no candidate", async () => {
  const service = createItauRefundService({
    aiAnalyzer: async () => ({
      document_readable: true,
      institution_mentioned: true,
      billing_period: "07/2026",
      candidate_charges: [],
      searchable_entries: [],
      notes: [],
      model: "test-model",
    }),
  });
  const analyzed = await service.analyze({
    buffer: Buffer.from("18/07/2026 Mercado Central -R$ 100,00"),
    fileName: "julho.txt",
    mimeType: "text/plain",
  });
  const result = service.searchCases([analyzed.case.id], "StreamPlay");

  assert.equal(result.matches.length, 0);
  assert.equal(result.cases[0].candidates.length, 0);
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

test("reconciles an AI label with extra insurance wording against the catalog", async () => {
  const service = createItauRefundService({
    aiAnalyzer: async () => ({
      document_readable: true,
      institution_mentioned: true,
      billing_period: "07/2025",
      candidate_charges: [
        {
          label: "SEGURO CARTAO PROTEGIDO",
          description: "Cartao Protegido",
          category: "seguro",
          date: "2025-07-11",
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
    buffer: Buffer.from("11/07/2025 SEGURO CARTAO PROTEGIDO R$ 18,90"),
    fileName: "fatura.txt",
    mimeType: "text/plain",
  });

  assert.equal(analyzed.case.candidates.length, 1);
  assert.equal(analyzed.case.candidates[0].label, "Cartao Protegido");
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

test("times out a stalled visual analysis without reporting a false clean result", async () => {
  const service = createItauRefundService({
    env: { ITAU_ANALYSIS_TIMEOUT_MS: "20" },
    aiAnalyzer: async () => new Promise(() => {}),
  });

  const startedAt = Date.now();
  const result = await service.analyze({
    buffer: Buffer.from("fake-image-bytes"),
    fileName: "extrato.png",
    mimeType: "image/png",
  });

  assert.ok(Date.now() - startedAt < 1_000);
  assert.equal(result.case.status, "unreadable");
  assert.equal(result.case.document.processedBy, "analysis_unavailable");
  assert.equal(result.case.candidates.length, 0);
  assert.match(result.aiError, /excedeu/i);
  assert.match(result.case.notes.join(" "), /nenhum resultado foi presumido/i);
});
