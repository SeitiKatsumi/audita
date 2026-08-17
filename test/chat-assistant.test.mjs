import assert from "node:assert/strict";
import test from "node:test";

import {
  AUDITA_CHAT_CAPABILITIES,
  buildAuditaChatInstructions,
  buildCourtCertificateIntakeAction,
  buildCourtCertificateResultAction,
  buildJecIntakeAction,
  buildItauToolUpdatePayload,
  cleanAuditaChatAnswer,
  inferItauChatCaseUpdate,
  maskSensitiveIdentifiers,
  normalizeChatMessages,
  normalizeItauCaseContext,
  normalizeJecBrowserContext,
  runAuditaChat,
  shouldRepairConversationalAnswer,
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

test("chat exposes the Direct Data certificate capability and safe intake action", () => {
  const capability = AUDITA_CHAT_CAPABILITIES.find(
    (item) => item.id === "court_certificates_api",
  );
  const action = buildCourtCertificateIntakeAction({
    uf: "SP",
    certificateType: "Civel",
    subjectType: "cnpj",
    configuration: {
      allowedUfs: ["BA", "SP"],
      confirmedUfs: ["BA"],
      experimentalUfs: ["SP"],
      certificateTypes: ["C\u00edvel"],
      queryCostBrl: 0.36,
      pdfTotalCostBrl: 0.54,
      creditCost: 1,
    },
  });

  assert.equal(capability.status, "provider_configured");
  assert.equal(action.kind, "court_certificate_intake");
  assert.equal(action.subjectType, "cnpj");
  assert.equal(action.configuration.experimentalUfs[0], "SP");
  assert.doesNotMatch(JSON.stringify(action), /\d{11}|\d{14}/);
});

test("chat certificate result action keeps the normalized provider result", () => {
  const action = buildCourtCertificateResultAction({
    status: "success",
    uf: "BA",
    subjectMasked: "529********25",
    analysis: {
      outcome: "no_occurrence_reported",
      summary: "Sem ocorrencia informada.",
    },
  });

  assert.equal(action.kind, "court_certificate_result");
  assert.equal(action.result.subjectMasked, "529********25");
});

test("chat certificate instructions require authorization, cost and secure document intake", () => {
  const instructions = buildAuditaChatInstructions();

  assert.match(instructions, /consultar_certidao_estadual_direct_data/);
  assert.match(instructions, /duas confirmacoes expressas/i);
  assert.match(instructions, /formulario protegido/i);
  assert.match(instructions, /resultado inconclusivo/i);
});

test("chat removes duplicated source labels from the conversational answer", () => {
  assert.equal(
    cleanAuditaChatAnswer(
      'Você reconhece "Cartão Protegido"? Fonte: fatura do Itaú enviada pelo usuário.',
    ),
    'Você reconhece "Cartão Protegido"?',
  );
  assert.equal(
    cleanAuditaChatAnswer(
      "A preparação assistida foi aberta. (Fonte: módulo de preparação assistida)",
    ),
    "A preparação assistida foi aberta.",
  );
  assert.equal(
    cleanAuditaChatAnswer(
      'Selecione "searchForo" e depois "searchCompetencia".',
    ),
    'Selecione "Foro/Comarca" e depois "Competência".',
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
  assert.match(instructions, /Nao simule um formulario nem siga um questionario rigido/i);
  assert.match(instructions, /memoria factual, nao um roteiro/i);
  assert.match(instructions, /registrar_fatos_caso_itau/i);
  assert.match(instructions, /chame preparar_peticao_jec/i);
  assert.match(instructions, /duas jornadas Itau/i);
  assert.match(instructions, /reclamacao administrativa ao Itau nao faz parte/i);
  assert.match(instructions, /ofereca diretamente a preparacao judicial/i);
  assert.match(instructions, /navegador interno e o protocolo automatico nao fazem parte/i);
  assert.match(instructions, /link oficial e o passo a passo manual/i);
  assert.match(instructions, /acompanhamento no TJ via Direct Data/i);
  assert.match(instructions, /advogado da IA AUDITA/i);
});

test("live JEC browser context exposes screen structure without field values", () => {
  const normalized = JSON.parse(
    normalizeJecBrowserContext({
      status: "live",
      transport: "live",
      controlMode: "human",
      courtName: "TJSP",
      courtUf: "SP",
      title: "Peticionamento Eletrônico",
      url: "https://portal.tjsp.jus.br/PeticionamentoEletronico",
      outcome: { status: "in_progress" },
      formState: {
        filledCount: 1,
        totalCount: 2,
        controls: [
          {
            label: "CPF",
            type: "text",
            filled: true,
            valuePreview: "49532724800",
          },
          {
            label: "Rito",
            type: "select",
            filled: false,
            options: ["Juizado Especial", "Procedimento Comum"],
          },
        ],
        actions: [
          {
            label: "Petição inicial",
            tag: "a",
            href: "https://portal.tjsp.jus.br/segredo",
          },
        ],
      },
      portalGuide: {
        name: "Juizado Especial Cível de São Paulo",
        steps: ["Acesse Petição inicial."],
        humanOnly: ["Confirmar ajuizamento."],
        sources: ["https://www.tjsp.jus.br/juizadosespeciais"],
      },
    }),
  );

  assert.equal(normalized.controlMode, "human");
  assert.equal(normalized.transport, "live");
  assert.equal(normalized.visibleForm.controls[0].label, "CPF");
  assert.equal(normalized.visibleForm.controls[0].filled, true);
  assert.deepEqual(normalized.visibleForm.controls[1].options, [
    "Juizado Especial",
    "Procedimento Comum",
  ]);
  assert.equal(normalized.visibleForm.actions[0].label, "Petição inicial");
  assert.equal(normalized.visibleForm.controls[0].valuePreview, undefined);
  assert.equal(normalized.visibleForm.actions[0].href, undefined);
  assert.doesNotMatch(JSON.stringify(normalized), /49532724800|segredo/);
});

test("Itau context is factual memory without a scripted next question", () => {
  const context = JSON.parse(
    normalizeItauCaseContext({
      type: "itau_refund",
      case: {
        status: "review_required",
        candidates: [{ label: "Cartao Protegido", answer: "not_recognized" }],
        answers: { priorComplaint: "pending" },
      },
    }),
  );

  assert.equal(context.candidates[0].index, 0);
  assert.equal(context.candidates[0].answer, "not_recognized");
  assert.equal(context.documentReview.recentEvidenceAnalyzed, true);
  assert.equal(context.answers.priorComplaint, undefined);
  assert.equal(context.journey, "undetermined");
  assert.equal("conversation" in context, false);
  assert.equal("nextQuestion" in context, false);
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

test("Itau records recurring charges even when older statements are unavailable", () => {
  const caseData = {
    id: "case-recurring-without-files",
    status: "review_required",
    candidates: [
      { id: "protection", label: "Protecao Horizonte", answer: "not_recognized" },
    ],
    answers: {
      historicalEvidence: "pending",
      priorComplaint: "pending",
    },
  };
  const update = inferItauChatCaseUpdate({
    caseData,
    messages: [
      {
        role: "assistant",
        content: "Essa cobranca aparece em outros meses ou voce tem extratos anteriores para comparar?",
      },
      {
        role: "user",
        content: "Não tenho os extratos, mas já estou pagando isso a uns 3 anos.",
      },
    ],
  });

  assert.equal(update?.kind, "history");
  assert.equal(update?.payload.historicalEvidence, "yes");
  assert.equal(update?.payload.historicalDocumentsAvailable, "no");

  const updatedCase = updateItauCaseSnapshot(caseData, update.payload);
  assert.equal(updatedCase.answers.historicalEvidence, "yes");
  assert.equal(updatedCase.answers.historicalDocumentsAvailable, "no");
  assert.equal(updatedCase.answers.priorComplaint, "pending");
});

test("Itau accepts an unknown complaint date and unavailable protocol without repeating", () => {
  const caseData = {
    id: "case-unknown-complaint-details",
    status: "review_required",
    candidates: [
      { id: "protection", label: "Protecao Horizonte", answer: "not_recognized" },
    ],
    answers: {
      historicalEvidence: "yes",
      historicalDocumentsAvailable: "no",
      priorComplaint: "yes",
      bankResponseStatus: "pending",
    },
  };
  const update = inferItauChatCaseUpdate({
    caseData,
    messages: [
      {
        role: "assistant",
        content: "Em que data voce reclamou ao Itau? Se tiver o protocolo, pode informar junto.",
      },
      {
        role: "user",
        content:
          "Nem me lembro e nao vou ter acesso ao protocolo porque nao tenho mais acesso a essa conta.",
      },
    ],
  });

  assert.equal(update?.kind, "complaint_details");
  assert.equal(update?.payload.priorComplaintDateStatus, "unknown");
  assert.equal(update?.payload.priorComplaintProtocolStatus, "unavailable");
  assert.equal(update?.payload.priorComplaintProtocol, undefined);

  const updatedCase = updateItauCaseSnapshot(caseData, update.payload);
  assert.equal(updatedCase.answers.priorComplaintDateStatus, "unknown");
  assert.equal(updatedCase.answers.priorComplaintProtocolStatus, "unavailable");
  assert.equal(
    shouldRepairConversationalAnswer({
      answer: "Em que data voce reclamou ao Itau? Se tiver o protocolo, pode informar junto.",
      messages: [
        {
          role: "assistant",
          content: "Em que data voce reclamou ao Itau? Se tiver o protocolo, pode informar junto.",
        },
        {
          role: "user",
          content:
            "Nem me lembro e nao vou ter acesso ao protocolo porque nao tenho mais acesso a essa conta.",
        },
      ],
      caseContext: { type: "itau_refund", case: updatedCase },
    }),
    true,
  );
  assert.equal(
    shouldRepairConversationalAnswer({
      answer:
        "Entendi. A falta da data exata e do protocolo limita a prova, mas nao impede a triagem. O Itau chegou a responder ou estornar algum valor?",
      messages: [{ role: "user", content: "Nao lembro a data e nao tenho o protocolo." }],
      caseContext: { type: "itau_refund", case: updatedCase },
    }),
    false,
  );
});

test("Itau accepts an approximate complaint month and unavailable protocol", () => {
  const caseData = {
    id: "case-approximate-complaint-details",
    status: "review_required",
    candidates: [
      { id: "protection", label: "Protecao Horizonte", answer: "not_recognized" },
    ],
    answers: {
      historicalEvidence: "yes",
      historicalDocumentsAvailable: "no",
      priorComplaint: "yes",
      bankResponseStatus: "pending",
    },
  };
  const update = inferItauChatCaseUpdate({
    caseData,
    messages: [
      {
        role: "assistant",
        content: "Em que data voce reclamou ao Itau? Se tiver o protocolo, pode informar junto.",
      },
      {
        role: "user",
        content: "Nao tenho o protocolo, acho que reclamei por volta de janeiro de 2026.",
      },
    ],
  });

  assert.equal(update?.kind, "complaint_details");
  assert.equal(update?.payload.priorComplaintDateApproximate, "2026-01");
  assert.equal(update?.payload.priorComplaintDateStatus, "approximate");
  assert.equal(update?.payload.priorComplaintProtocolStatus, "unavailable");
  assert.equal(update?.payload.priorComplaintProtocol, undefined);

  const updatedCase = updateItauCaseSnapshot(caseData, update.payload);
  assert.equal(updatedCase.answers.priorComplaintDateApproximate, "2026-01");
  assert.equal(updatedCase.answers.priorComplaintDateStatus, "approximate");
  assert.equal(updatedCase.answers.priorComplaintProtocolStatus, "unavailable");
  assert.equal(
    shouldRepairConversationalAnswer({
      answer: "Qual foi a data exata da reclamacao e qual e o protocolo?",
      messages: [{ role: "user", content: "Foi por volta de janeiro de 2026 e nao tenho protocolo." }],
      caseContext: { type: "itau_refund", case: updatedCase },
    }),
    true,
  );
});

test("Itau completes the reported conversation sequence without entering a loop", () => {
  let caseData = {
    id: "case-reported-loop",
    status: "review_required",
    candidates: [
      { id: "protection", label: "Protecao Horizonte", answer: "not_recognized" },
    ],
    answers: {
      historicalEvidence: "pending",
      priorComplaint: "pending",
      bankResponseStatus: "pending",
    },
  };

  const historyUpdate = inferItauChatCaseUpdate({
    caseData,
    messages: [
      {
        role: "assistant",
        content: "Essa cobranca aparece em outros meses ou voce tem extratos anteriores para comparar?",
      },
      {
        role: "user",
        content: "Não tenho os extratos, mas já estou pagando isso a uns 3 anos.",
      },
    ],
  });
  caseData = updateItauCaseSnapshot(caseData, historyUpdate.payload);
  assert.equal(caseData.answers.historicalEvidence, "yes");
  assert.equal(caseData.answers.historicalDocumentsAvailable, "no");

  const complaintUpdate = inferItauChatCaseUpdate({
    caseData,
    messages: [
      {
        role: "assistant",
        content: "Voce ja reclamou ao Itau sobre essa cobranca atual?",
      },
      {
        role: "user",
        content: "Sim, reclamei no começo, mas nada foi feito.",
      },
    ],
  });
  caseData = updateItauCaseSnapshot(caseData, complaintUpdate.payload);
  assert.equal(caseData.answers.priorComplaint, "yes");

  const detailsUpdate = inferItauChatCaseUpdate({
    caseData,
    messages: [
      {
        role: "assistant",
        content: "Em que data voce reclamou ao Itau? Se tiver o protocolo, pode informar junto.",
      },
      {
        role: "user",
        content:
          "Nem me lembro e não vou ter acesso ao protocolo porque não tenho mais acesso a essa conta.",
      },
    ],
  });
  caseData = updateItauCaseSnapshot(caseData, detailsUpdate.payload);
  assert.equal(caseData.answers.priorComplaintDateStatus, "unknown");
  assert.equal(caseData.answers.priorComplaintProtocolStatus, "unavailable");
  assert.equal(
    shouldRepairConversationalAnswer({
      answer: "Anotei que voce reclamou. Em que data voce reclamou ao Itau?",
      messages: [
        {
          role: "assistant",
          content: "Em que data voce reclamou ao Itau? Se tiver o protocolo, pode informar junto.",
        },
        {
          role: "user",
          content:
            "Nem me lembro e nao vou ter acesso ao protocolo porque nao tenho mais acesso a essa conta.",
        },
      ],
      caseContext: { type: "itau_refund", case: caseData },
    }),
    true,
  );
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
  assert.equal(updatedCase.answers.bankResponseStatus, "no_response");

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
  assert.equal(jecCase.answers.wantsJec, "yes");
});

test("Itau factual memory preserves the agreement period classification without scripting", () => {
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

  const context = JSON.parse(
    normalizeItauCaseContext({ type: "itau_refund", case: caseData }),
  );
  assert.equal(context.evaluation.agreementStatus, "outside_period");
  assert.equal("conversation" in context, false);
  assert.equal("nextQuestion" in context, false);
});

test("Itau factual memory distinguishes the journey without historical statements", () => {
  const context = JSON.parse(
    normalizeItauCaseContext({
      type: "itau_refund",
      case: {
        candidates: [{ label: "Seguro", answer: "not_recognized" }],
        answers: {
          historicalEvidence: "yes",
          historicalDocumentsAvailable: "no",
        },
      },
    }),
  );

  assert.equal(context.journey, "without_historical_documents");
  assert.equal(context.answers.historicalEvidence, "yes");
  assert.equal(context.answers.historicalDocumentsAvailable, "no");
});

test("JEC action opens only a supported secure intake and never claims protocol", () => {
  const action = buildJecIntakeAction({
    uf: "sp",
    caseId: "case-jec-action",
    suggestion: {
      values: { doubleRefundAmount: "79,80", caseValue: "79,80" },
    },
  });

  assert.equal(action?.kind, "jec_intake");
  assert.equal(action?.moduleId, "jec_petition");
  assert.equal(action?.uf, "SP");
  assert.equal(action?.caseId, "case-jec-action");
  assert.equal(action?.suggestion?.values?.doubleRefundAmount, "79,80");
  assert.match(action?.description || "", /protocolo será feito por você/i);
  assert.equal(buildJecIntakeAction({ uf: "BA", caseId: "case-1" }), null);
  assert.equal(buildJecIntakeAction({ uf: "SP" }), null);
});

test("Itau factual memory does not turn an unknown charge amount into zero", () => {
  const context = JSON.parse(
    normalizeItauCaseContext({
      type: "itau_refund",
      case: {
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
    }),
  );

  assert.equal(context.candidates[0].amount, null);
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
  assert.doesNotMatch(context, /nextQuestion|conversation/);
  assert.doesNotMatch(context, /49532724800|conteudo sigiloso|linha completa/);
  assert.doesNotMatch(context, /internal-case-id/);
});

test("Itau AI tool records conversational facts by candidate index", () => {
  const payload = buildItauToolUpdatePayload(
    {
      candidateUpdates: [{ candidateIndex: 0, answer: "not_recognized" }],
      historicalEvidence: "yes",
      historicalDocumentsAvailable: "no",
      reason: "Usuario explicou os fatos em linguagem livre.",
    },
    {
      candidates: [{ id: "protection", label: "Protecao Horizonte" }],
    },
  );

  assert.deepEqual(payload.candidateAnswers, { protection: "not_recognized" });
  assert.equal(payload.historicalEvidence, "yes");
  assert.equal(payload.historicalDocumentsAvailable, "no");
});

test("Itau AI tool does not preserve an approximate complaint date without a value", () => {
  const payload = buildItauToolUpdatePayload({
    priorComplaintDateStatus: "approximate",
  });

  assert.equal(payload.priorComplaintDateStatus, "unknown");
  assert.equal(payload.priorComplaintDateApproximate, undefined);
});

test("Itau AI tool leaves unmentioned binary facts pending instead of inventing unknowns", () => {
  const payload = buildItauToolUpdatePayload({
    cancellationRequested: "unknown",
    duplicateCharge: "unknown",
    wantsJec: "unknown",
  });

  assert.equal(payload.cancellationRequested, undefined);
  assert.equal(payload.duplicateCharge, undefined);
  assert.equal(payload.wantsJec, undefined);
});

test("Itau AI tool records only claim amounts expressly supplied by the user", () => {
  const payload = buildItauToolUpdatePayload(
    {
      reportedLostProfitsAmount: 350,
      requestedMoralDamagesAmount: 2000,
    },
    { candidates: [] },
  );

  assert.equal(payload.reportedLostProfitsAmount, 350);
  assert.equal(payload.requestedMoralDamagesAmount, 2000);
  assert.equal(
    buildItauToolUpdatePayload({ reportedLostProfitsAmount: -1 }, { candidates: [] })
      .reportedLostProfitsAmount,
    undefined,
  );
});

test("anti-repeat guard permits an explicit request to repeat", () => {
  assert.equal(
    shouldRepairConversationalAnswer({
      answer: "Voce ja reclamou ao Itau sobre essa cobranca?",
      messages: [
        { role: "assistant", content: "Voce ja reclamou ao Itau sobre essa cobranca?" },
        { role: "user", content: "Nao entendi a pergunta, pode repetir?" },
      ],
      caseContext: {
        type: "itau_refund",
        case: { answers: { priorComplaint: "pending" } },
      },
    }),
    false,
  );
});

test("conversational guard rejects a false JEC preparation without the JEC tool action", () => {
  const answer =
    "Pronto, preparei o módulo para protocolar no Procon-SP e no Juizado Especial.";
  assert.equal(
    shouldRepairConversationalAnswer({
      answer,
      messages: [{ role: "user", content: "SP" }],
      actions: [],
    }),
    true,
  );
  assert.equal(
    shouldRepairConversationalAnswer({
      answer: "O painel da petição do JEC-SP foi aberto para sua revisão.",
      messages: [{ role: "user", content: "SP" }],
      actions: [
        buildJecIntakeAction({ uf: "SP", caseId: "case-jec-action" }),
      ],
    }),
    false,
  );
  assert.equal(
    shouldRepairConversationalAnswer({
      answer:
        "A preparação foi aberta. Deseja que eu gere agora o rascunho da petição?",
      messages: [{ role: "user", content: "SP" }],
      actions: [
        buildJecIntakeAction({ uf: "SP", caseId: "case-jec-action" }),
      ],
    }),
    true,
  );
});

test("conversational guard rejects claims that the JEC browser was opened", () => {
  assert.equal(
    shouldRepairConversationalAnswer({
      answer: "Abri o navegador do tribunal e vou protocolar a petição.",
      messages: [{ role: "user", content: "Pode continuar em SP." }],
      caseContext: {
        type: "itau_refund",
        case: { answers: { wantsJec: "yes" } },
      },
      actions: [
        buildJecIntakeAction({ uf: "SP", caseId: "case-jec-action" }),
      ],
    }),
    true,
  );
});

test("anti-repeat guard prevents requesting a recent document that was already analyzed", () => {
  assert.equal(
    shouldRepairConversationalAnswer({
      answer:
        "Quer que eu peca para anexar os extratos dos ultimos 12 meses para medir a recorrencia?",
      messages: [
        {
          role: "user",
          content: "Nao tenho os extratos antigos e nao tenho mais acesso a conta.",
        },
      ],
      caseContext: {
        type: "itau_refund",
        case: {
          candidates: [
            {
              id: "protection",
              label: "Protecao Horizonte",
              answer: "not_recognized",
            },
          ],
          answers: {
            historicalDocumentsAvailable: "no",
          },
        },
      },
    }),
    true,
  );
});

test("conversational guard rejects promises to retrieve bank statements through Audita", () => {
  assert.equal(
    shouldRepairConversationalAnswer({
      answer:
        "Quer que eu abra pelo modulo da Audita um pedido ao banco para obter seus extratos?",
      messages: [{ role: "user", content: "Nao tenho mais acesso a conta." }],
      caseContext: {
        type: "itau_refund",
        case: {
          candidates: [{ id: "protection", answer: "not_recognized" }],
          answers: { historicalDocumentsAvailable: "no" },
        },
      },
    }),
    true,
  );
});

test("conversational guard rejects offering to request old statements for the user", () => {
  assert.equal(
    shouldRepairConversationalAnswer({
      answer:
        "Quer que eu peca os extratos antigos para verificar a recorrencia?",
      messages: [
        {
          role: "user",
          content: "Eu pago essa cobranca ha tres anos, mas so tenho a fatura atual.",
        },
      ],
      caseContext: {
        type: "itau_refund",
        case: {
          candidates: [{ id: "protection", answer: "not_recognized" }],
          answers: {
            historicalEvidence: "yes",
            historicalDocumentsAvailable: "unknown",
          },
        },
      },
    }),
    true,
  );
});

test("conversational guard rejects the removed administrative complaint step", () => {
  assert.equal(
    shouldRepairConversationalAnswer({
      answer:
        "Preparei um rascunho de reclamacao administrativa para voce enviar ao Itau.",
      messages: [{ role: "user", content: "Sim, pode preparar." }],
      caseContext: {
        type: "itau_refund",
        case: {
          candidates: [{ id: "protection", answer: "not_recognized" }],
          answers: { administrativeDraftRequested: "yes" },
        },
      },
    }),
    true,
  );
});

test("server never substitutes the OpenAI answer with an Itau state-machine response", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");

  assert.doesNotMatch(
    source,
    /buildItauTransitionAnswer|audita-itau-state-machine|inferItauChatCaseUpdate/,
  );
  assert.match(source, /result = await runAuditaChat\(/);
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
