import assert from "node:assert/strict";
import test from "node:test";

import {
  AUDITA_CHAT_CAPABILITIES,
  buildItauTransitionAnswer,
  buildAuditaChatInstructions,
  cleanAuditaChatAnswer,
  inferItauChatCaseUpdate,
  inferItauConversationStage,
  maskSensitiveIdentifiers,
  normalizeChatMessages,
  normalizeItauCaseContext,
  runAuditaChat,
} from "../services/chat-assistant.service.mjs";
import { updateItauCaseSnapshot } from "../services/itau-refund.service.mjs";

test("chat masks CPF, CNPJ and email before model input", () => {
  const masked = maskSensitiveIdentifiers(
    "CPF 495.327.248-00, CNPJ 12.345.678/0001-90 e contato pessoa@empresa.com.br",
  );

  assert.equal(
    masked,
    "CPF [CPF informado], CNPJ [CNPJ informado] e contato [e-mail informado]",
  );
});

test("chat removes duplicated source labels from the conversational answer", () => {
  assert.equal(
    cleanAuditaChatAnswer(
      'Você reconhece "Cartão Protegido"? Fonte: fatura do Itaú enviada pelo usuário.',
    ),
    'Você reconhece "Cartão Protegido"?',
  );
});

test("chat normalizes roles and keeps only the latest bounded context", () => {
  const messages = Array.from({ length: 30 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: `Mensagem ${index}`,
  }));
  messages.push({ role: "system", content: "ignorar" });

  const normalized = normalizeChatMessages(messages);

  assert.equal(normalized.length, 24);
  assert.equal(normalized[0].content, "Mensagem 6");
  assert.equal(normalized.at(-1).content, "Mensagem 29");
  assert.ok(normalized.every((message) => ["user", "assistant"].includes(message.role)));
});

test("chat instructions prohibit invented results and personal data collection", () => {
  const instructions = buildAuditaChatInstructions();

  assert.match(instructions, /Nunca invente certidoes/i);
  assert.match(instructions, /Nao solicite CPF, CNPJ/i);
  assert.match(instructions, /Diferencie dado oficial/i);
  assert.match(instructions, /no maximo 80 palavras/i);
  assert.match(instructions, /uma evidencia recente/i);
  assert.match(instructions, /uma pergunta curta por vez/i);
});

test("Itau conversation advances from one recent finding to historical evidence", () => {
  assert.deepEqual(inferItauConversationStage({ status: "no_candidate_found", candidates: [] }), {
    phase: "screening_no_signal",
    nextQuestion: "Qual nome, valor ou detalhe do lancamento fez voce desconfiar?",
  });

  const confirmation = inferItauConversationStage({
    status: "review_required",
    candidates: [{ label: "Cartao Protegido", answer: "pending" }],
  });
  assert.equal(confirmation.phase, "confirm_candidate");
  assert.match(confirmation.nextQuestion, /Cartao Protegido/);

  const history = inferItauConversationStage({
    status: "review_required",
    candidates: [{ label: "Cartao Protegido", answer: "not_recognized" }],
  });
  assert.equal(history.phase, "collect_history");
  assert.match(history.nextQuestion, /outros meses/i);
});

test("Itau typed replies update the candidate asked by the assistant", () => {
  const update = inferItauChatCaseUpdate({
    caseData: {
      id: "case-1",
      candidates: [
        { id: "protection", label: "Protecao Horizonte", answer: "not_recognized" },
        { id: "stream", label: "StreamPlay", answer: "pending" },
      ],
    },
    messages: [
      { role: "assistant", content: 'Voce reconhece a contratacao de "StreamPlay"?' },
      { role: "user", content: "sim" },
    ],
  });

  assert.equal(update?.kind, "candidate");
  assert.deepEqual(update?.payload.candidateAnswers, { stream: "recognized" });
});

test("Itau understands that all other charges are recognized", () => {
  const update = inferItauChatCaseUpdate({
    caseData: {
      id: "case-2",
      candidates: [
        { id: "protection", label: "Protecao Horizonte", answer: "not_recognized" },
        { id: "stream", label: "StreamPlay", answer: "pending" },
        { id: "tariff", label: "Tarifa bancaria", answer: "pending" },
      ],
    },
    messages: [
      { role: "assistant", content: 'Voce reconhece a contratacao de "StreamPlay"?' },
      {
        role: "user",
        content: "As outras eu reconhco, apenas essa protecao acho que foi indevida",
      },
    ],
  });

  assert.deepEqual(update?.payload.candidateAnswers, {
    stream: "recognized",
    tariff: "recognized",
  });
});

test("Itau persists a complaint reported naturally in chat", () => {
  const update = inferItauChatCaseUpdate({
    caseData: {
      id: "case-3",
      candidates: [
        { id: "protection", label: "Protecao Horizonte", answer: "not_recognized" },
      ],
    },
    messages: [
      { role: "assistant", content: "Quer que eu prepare uma reclamacao para o Itau?" },
      { role: "user", content: "ja fiz a reclamacao previa" },
    ],
  });

  assert.equal(update?.kind, "complaint");
  assert.equal(update?.payload.priorComplaint, "yes");
});

test("Itau gives precedence to a natural negative complaint reply", () => {
  const update = inferItauChatCaseUpdate({
    caseData: {
      id: "case-negative-complaint",
      candidates: [
        { id: "protection", label: "Protecao Horizonte", answer: "not_recognized" },
      ],
    },
    messages: [
      { role: "assistant", content: "Voce ja reclamou ao Itau sobre essa cobranca atual?" },
      { role: "user", content: "Não reclamei ainda." },
    ],
  });

  assert.equal(update?.payload.priorComplaint, "no");
});

test("Itau understands that a charge only appeared this month", () => {
  const update = inferItauChatCaseUpdate({
    caseData: {
      id: "case-single-month",
      candidates: [
        { id: "protection", label: "Protecao Horizonte", answer: "not_recognized" },
      ],
    },
    messages: [
      {
        role: "assistant",
        content: "Essa cobranca aparece em outros meses ou voce tem extratos anteriores para comparar?",
      },
      { role: "user", content: "Só apareceu esse mês." },
    ],
  });

  assert.equal(update?.payload.historicalEvidence, "no");
});

test("Itau does not confuse accepting a draft with having complained already", () => {
  const update = inferItauChatCaseUpdate({
    caseData: {
      id: "case-4",
      candidates: [
        { id: "protection", label: "Protecao Horizonte", answer: "not_recognized" },
      ],
    },
    messages: [
      { role: "assistant", content: "Quer que eu prepare uma reclamacao para o Itau?" },
      { role: "user", content: "sim" },
    ],
  });

  assert.equal(update?.kind, "complaint_draft");
  assert.equal(update?.payload.administrativeDraftRequested, "yes");
});

test("Itau marks a generated complaint as sent when the user reports its protocol", () => {
  const update = inferItauChatCaseUpdate({
    caseData: {
      id: "case-complaint-sent",
      candidates: [
        {
          id: "protection",
          label: "Protecao Horizonte",
          answer: "not_recognized",
        },
      ],
      answers: {
        historicalEvidence: "no",
        priorComplaint: "no",
        administrativeDraftRequested: "yes",
      },
    },
    messages: [
      {
        role: "assistant",
        content:
          "O rascunho administrativo esta pronto. Quando voce enviar ao Itau, me avise.",
      },
      {
        role: "user",
        content:
          "Ja enviei a reclamacao em 23/07/2026, protocolo AUDITA-TESTE-20260723.",
      },
    ],
  });

  assert.equal(update?.kind, "complaint_details");
  assert.equal(update?.payload.priorComplaint, "yes");
  assert.equal(update?.payload.priorComplaintDate, "2026-07-23");
  assert.equal(
    update?.payload.priorComplaintProtocol,
    "AUDITA-TESTE-20260723",
  );
});

test("Itau advances from an unanswered bank complaint to the JEC decision", () => {
  const noResponse = inferItauChatCaseUpdate({
    caseData: {
      id: "case-jec",
      candidates: [{ id: "protection", label: "Protecao Horizonte", answer: "not_recognized" }],
      answers: {
        priorComplaint: "yes",
        priorComplaintDate: "2026-07-23",
        bankResponseStatus: "pending",
      },
    },
    messages: [
      { role: "assistant", content: "O Itau ja respondeu, cancelou ou estornou essa cobranca?" },
      { role: "user", content: "não" },
    ],
  });

  assert.equal(noResponse?.payload.bankResponseStatus, "no_response");
  const updatedCase = updateItauCaseSnapshot(
    {
      id: "case-jec",
      candidates: [{ id: "protection", label: "Protecao Horizonte", answer: "not_recognized" }],
      answers: {
        priorComplaint: "yes",
        priorComplaintDate: "2026-07-23",
        bankResponseStatus: "pending",
        wantsJec: "pending",
      },
    },
    noResponse.payload,
  );
  assert.equal(inferItauConversationStage(updatedCase).phase, "consider_jec");

  const wantsJec = inferItauChatCaseUpdate({
    caseData: updatedCase,
    messages: [
      {
        role: "assistant",
        content: "Como não houve solução integral, quer que eu prepare o caminho assistido para o Juizado Especial?",
      },
      { role: "user", content: "sim" },
    ],
  });
  assert.equal(wantsJec?.payload.wantsJec, "yes");
  assert.equal(wantsJec?.payload.bankResponseStatus, undefined);

  const jecCase = updateItauCaseSnapshot(updatedCase, wantsJec.payload);
  assert.equal(inferItauConversationStage(jecCase).phase, "jec_intake");
});

test("Itau transition answer does not apply the 2025 deadline to a 2026 charge", () => {
  const caseData = {
    status: "evaluated",
    candidates: [
      {
        id: "protection",
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
    evaluation: {
      agreementStatus: "outside_period",
    },
  };

  const answer = buildItauTransitionAnswer(caseData, { kind: "complaint" });
  assert.match(answer, /posterior a 18\/12\/2025/i);
  assert.match(answer, /atendimento normal do Ita[uú]/i);
  assert.doesNotMatch(answer, /exige reclamacao previa/i);
});

test("Itau transition does not turn an unknown charge amount into zero", () => {
  const answer = buildItauTransitionAnswer(
    {
      candidates: [
        {
          label: "Protecao Horizonte",
          amount: null,
          answer: "not_recognized",
        },
      ],
      answers: {
        historicalEvidence: "pending",
      },
    },
    { kind: "candidate" },
  );

  assert.doesNotMatch(answer, /R\$\s*0,00/);
});

test("chat capability registry exposes current module status and routes", () => {
  const stateCourts = AUDITA_CHAT_CAPABILITIES.find((item) => item.id === "state_courts");
  const propertySearch = AUDITA_CHAT_CAPABILITIES.find((item) => item.id === "property_search");
  const unavailability = AUDITA_CHAT_CAPABILITIES.find((item) => item.id === "asset_unavailability");
  const itauRefund = AUDITA_CHAT_CAPABILITIES.find((item) => item.id === "itau_refund");

  assert.equal(stateCourts?.status, "active_assisted");
  assert.match(stateCourts?.statusLabel || "", /Ativa/);
  assert.equal(stateCourts?.route, "/#consulta-tjdft-pf");
  assert.equal(propertySearch?.status, "homologation");
  assert.match(propertySearch?.statusLabel || "", /homologacao/i);
  assert.equal(unavailability?.status, "provider_required");
  assert.match(unavailability?.statusLabel || "", /Aguardando provedor/i);
  assert.equal(itauRefund?.status, "active");
  assert.equal(itauRefund?.route, "/chat?tool=itau-refund");
});

test("chat receives only normalized Itau findings instead of the uploaded document", () => {
  const context = normalizeItauCaseContext({
    type: "itau_refund",
    case: {
      id: "internal-case-id",
      status: "review_required",
      document: { fileName: "CPF-49532724800.pdf", rawText: "conteudo sigiloso" },
      candidates: [
        {
          label: "Seguro Fatura Protegida",
          date: "2025-07-10",
          amount: 18.9,
          answer: "not_recognized",
          evidence: "linha completa da fatura",
        },
      ],
      answers: { priorComplaint: "yes", priorComplaintDate: "2025-10-01" },
      evaluation: {
        classification: "possible_unauthorized",
        disputedCount: 1,
        totalDisputed: 18.9,
      },
    },
  });

  assert.match(context, /Seguro Fatura Protegida/);
  assert.match(context, /follow_up_complaint/);
  assert.doesNotMatch(context, /49532724800|conteudo sigiloso|linha completa/);
  assert.doesNotMatch(context, /internal-case-id/);
});

test("chat reports configuration pending without importing or calling OpenAI", async () => {
  const result = await runAuditaChat({
    messages: [{ role: "user", content: "O que a Audita faz?" }],
    env: {},
  });

  assert.equal(result.unavailable, true);
  assert.equal(result.reason, "openai_not_configured");
  assert.equal(result.secretRef, "AUDITA_OPENAI_API_KEY");
});

test("chat rejects an empty or assistant-ended transcript", async () => {
  assert.deepEqual(await runAuditaChat({ messages: [], env: {} }), { invalid: true });
  assert.deepEqual(
    await runAuditaChat({ messages: [{ role: "assistant", content: "Oi" }], env: {} }),
    { invalid: true },
  );
});
