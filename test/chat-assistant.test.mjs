import assert from "node:assert/strict";
import test from "node:test";

import {
  AUDITA_CHAT_CAPABILITIES,
  buildAuditaChatInstructions,
  maskSensitiveIdentifiers,
  normalizeChatMessages,
  normalizeItauCaseContext,
  runAuditaChat,
} from "../services/chat-assistant.service.mjs";

test("chat masks CPF, CNPJ and email before model input", () => {
  const masked = maskSensitiveIdentifiers(
    "CPF 495.327.248-00, CNPJ 12.345.678/0001-90 e contato pessoa@empresa.com.br",
  );

  assert.equal(
    masked,
    "CPF [CPF informado], CNPJ [CNPJ informado] e contato [e-mail informado]",
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
