import assert from "node:assert/strict";
import test from "node:test";

import {
  createJecTestimonyService,
  JecTestimonyError,
  normalizeJecTestimony,
} from "../services/jec-testimony.service.mjs";

test("testimony refinement uses the production secret reference and a fact-preserving prompt", async () => {
  let clientConfig;
  let request;
  const service = createJecTestimonyService({
    env: {
      AUDITA_OPENAI_API_KEY: "test-key",
      AUDITA_CHAT_MODEL: "gpt-test",
    },
    clientFactory(config) {
      clientConfig = config;
      return {
        responses: {
          async create(payload) {
            request = payload;
            return {
              output_text:
                "Percebi uma cobrança mensal de Seguro Alfa em janeiro de 2026. Não reconheço essa contratação e não autorizei o serviço.",
            };
          },
        },
      };
    },
  });

  const result = await service.refine(
    "vi uma cobrança mensal de Seguro Alfa em janeiro de 2026 e eu não contratei nem autorizei esse serviço",
  );

  assert.equal(clientConfig.secretRef, "AUDITA_OPENAI_API_KEY");
  assert.equal(clientConfig.model, "gpt-test");
  assert.match(request.instructions, /Não invente, complete ou presuma datas, valores, produtos/i);
  assert.match(request.instructions, /primeira pessoa/i);
  assert.equal(request.input, result.original);
  assert.match(result.refined, /Seguro Alfa/);
});

test("testimony refinement rejects insufficient input and missing AI configuration", async () => {
  const service = createJecTestimonyService({ env: {} });

  await assert.rejects(
    service.refine("Não contratei."),
    (error) => error instanceof JecTestimonyError && error.code === "jec_testimony_too_short",
  );
  await assert.rejects(
    service.refine("Identifiquei uma cobrança que não reconheço e desejo registrar exatamente o ocorrido."),
    (error) => error instanceof JecTestimonyError && error.code === "jec_testimony_ai_unavailable",
  );
});

test("testimony conversation asks only for missing facts and completes within three answers", async () => {
  const requests = [];
  const outputs = [
    JSON.stringify({
      status: "follow_up",
      question: "Desde quando você se lembra de pagar essa cobrança e qual era o valor mensal?",
      refined: "",
    }),
    JSON.stringify({
      status: "complete",
      question: "",
      refined:
        "Percebi uma cobrança de Proteção Financeira em minhas faturas. Lembro-me de pagá-la desde 2023, no valor mensal aproximado de R$ 89,90, e afirmo que nunca contratei nem autorizei esse serviço.",
    }),
  ];
  const service = createJecTestimonyService({
    env: { AUDITA_OPENAI_API_KEY: "test-key" },
    clientFactory() {
      return {
        responses: {
          async create(payload) {
            requests.push(payload);
            return { output_text: outputs.shift() };
          },
        },
      };
    },
  });

  const first = await service.continueConversation([
    {
      question: "Conte com suas palavras o que aconteceu.",
      answer: "Vi Proteção Financeira nas faturas e nunca contratei esse serviço.",
    },
  ]);
  const completed = await service.continueConversation([
    ...first.turns,
    { question: first.question, answer: "Desde 2023, cerca de R$ 89,90 por mês." },
  ]);

  assert.equal(first.status, "follow_up");
  assert.match(first.question, /Desde quando/);
  assert.equal(completed.status, "complete");
  assert.match(completed.refined, /nunca contratei nem autorizei/i);
  assert.match(requests[0].instructions, /no máximo 3/);
  assert.equal(requests[0].text.format.type, "json_schema");
});

test("testimony conversation forces the third answer to produce the final account", async () => {
  let request;
  const service = createJecTestimonyService({
    env: { AUDITA_OPENAI_API_KEY: "test-key" },
    clientFactory() {
      return {
        responses: {
          async create(payload) {
            request = payload;
            return {
              output_text: JSON.stringify({
                status: "complete",
                question: "",
                refined:
                  "Percebi cobranças mensais de seguro desde 2022. O valor variava e eu nunca contratei nem autorizei o serviço indicado nas faturas.",
              }),
            };
          },
        },
      };
    },
  });

  const result = await service.continueConversation([
    { question: "O que aconteceu?", answer: "Vi um seguro nas faturas." },
    { question: "Desde quando?", answer: "Desde 2022." },
    { question: "Você autorizou?", answer: "Nunca contratei nem autorizei." },
  ]);

  assert.equal(result.status, "complete");
  assert.match(request.instructions, /terceira pergunta/i);
});

test("testimony normalization preserves paragraphs and removes control characters", () => {
  assert.equal(
    normalizeJecTestimony("  Primeiro fato.\u0000\n\n\n Segundo fato.  "),
    "Primeiro fato.\n\nSegundo fato.",
  );
});
