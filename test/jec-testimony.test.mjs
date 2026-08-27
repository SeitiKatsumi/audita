import assert from "node:assert/strict";
import test from "node:test";

import {
  createJecTestimonyService,
  JecTestimonyError,
  normalizeJecTestimony,
} from "../services/jec-testimony.service.mjs";

test("case facts generation sends only structured non-personal evidence to the AI", async () => {
  let request;
  const service = createJecTestimonyService({
    env: { AUDITA_OPENAI_API_KEY: "test-key", AUDITA_CHAT_MODEL: "gpt-test" },
    clientFactory() {
      return {
        responses: {
          async create(payload) {
            request = payload;
            return {
              output_text:
                "Ao revisar meus extratos, identifiquei em janeiro de 2026 uma cobrança de Seguro Alfa no valor de R$ 89,90, que marquei como não reconhecida.",
            };
          },
        },
      };
    },
  });

  const result = await service.generateFromCaseData({
    caseData: {
      claimant: { name: "Nome Sigiloso", cpf: "123.456.789-00", address: "Rua Sigilosa" },
      identityPdf: "JVBERi0xLjQ=",
      candidates: [
        {
          answer: "not_recognized",
          label: "Seguro Alfa",
          date: "2026-01-15",
          amount: 89.9,
          sourceFileName: "extrato-janeiro.pdf",
          rawText: "CPF 123.456.789-00",
        },
        { answer: "recognized", label: "Compra reconhecida", amount: 500 },
      ],
      answers: {
        authorizationAnswer: "denied",
        selectedBrand: "Itaú",
        documentAvailability: "complete",
        priorComplaint: "no",
        cpf: "123.456.789-00",
        address: "Rua Sigilosa",
        consumerTestimony: "texto pessoal anterior",
      },
      calculation: {
        items: [{
          date: "2026-01-15",
          amount: 89.9,
          correction: 1.25,
          interest: 2.1,
          updatedPrincipal: 93.25,
          doubleWithAdjustments: 183.15,
          rawPdf: "JVBERi0xLjQ=",
        }],
        principal: 89.9,
        doubleWithAdjustments: 183.15,
        moralDamagesAmount: 4_400,
        estimatedClaimValue: 4_676.4,
        calculationAsOf: "2026-08-27",
      },
    },
  });

  const facts = JSON.parse(request.input);
  assert.deepEqual(facts.lancamentosNaoReconhecidos, [{
    descricao: "Seguro Alfa",
    data: "2026-01-15",
    valor: 89.9,
  }]);
  assert.equal(facts.informacoesColetadas.authorizationAnswer, undefined);
  assert.equal(facts.informacoesColetadas.coberturaDosDocumentos, "completa");
  assert.equal(facts.resumoDoCalculo.perdasEDanosReferenciais, 4_400);
  assert.doesNotMatch(request.input, /Nome Sigiloso|123\.456|Rua Sigilosa|JVBER|Compra reconhecida|texto pessoal|extrato-janeiro/i);
  assert.match(request.instructions, /primeira pessoa/i);
  assert.match(request.instructions, /1 a 3 parágrafos/i);
  assert.match(request.instructions, /nunca exponha chaves técnicas/i);
  assert.match(request.instructions, /Não inclua fundamentos jurídicos, pedidos/i);
  assert.equal(result.refined.includes("Seguro Alfa"), true);
});

test("case facts generation fails without AI, on provider error, and on short output", async () => {
  await assert.rejects(
    createJecTestimonyService({ env: {} }).generateFromCaseData({ caseData: {} }),
    (error) => error instanceof JecTestimonyError && error.code === "jec_testimony_ai_unavailable",
  );

  const failing = createJecTestimonyService({
    env: { AUDITA_OPENAI_API_KEY: "test-key" },
    clientFactory() {
      return { responses: { async create() { throw new Error("provider down"); } } };
    },
  });
  await assert.rejects(
    failing.generateFromCaseData({ caseData: {} }),
    (error) => error instanceof JecTestimonyError && error.code === "jec_testimony_ai_failed",
  );

  const shortOutput = createJecTestimonyService({
    env: { AUDITA_OPENAI_API_KEY: "test-key" },
    clientFactory() {
      return { responses: { async create() { return { output_text: "Poucos fatos." }; } } };
    },
  });
  await assert.rejects(
    shortOutput.generateFromCaseData({ caseData: {} }),
    (error) => error instanceof JecTestimonyError && error.code === "jec_testimony_ai_invalid_output",
  );
});

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

test("testimony conversation asks the four topics in order and synthesizes after the fourth answer", async () => {
  const requests = [];
  const service = createJecTestimonyService({
    env: { AUDITA_OPENAI_API_KEY: "test-key" },
    clientFactory() {
      return {
        responses: {
          async create(payload) {
            requests.push(payload);
            return {
              output_text:
                "Descobri a cobrança ao revisar o relatório em agosto de 2026. O lançamento Proteção Financeira aparecia mensalmente por R$ 89,90 e eu não o autorizei. Não tenho protocolo bancário.",
            };
          },
        },
      };
    },
  });

  const first = await service.continueConversation([
    {
      question: "Como você descobriu a cobrança?",
      answer: "Descobri ao revisar o relatório em agosto de 2026.",
    },
  ]);
  const second = await service.continueConversation([
    ...first.turns,
    { question: first.question, answer: "Proteção Financeira, R$ 89,90 por mês." },
  ]);
  const third = await service.continueConversation([
    ...second.turns,
    { question: second.question, answer: "Nunca contratei nem autorizei." },
  ]);
  const completed = await service.continueConversation([
    ...third.turns,
    { question: third.question, answer: "Não tenho protocolo bancário." },
  ]);

  assert.equal(first.status, "follow_up");
  assert.match(first.question, /nome exato do lançamento/i);
  assert.match(second.question, /contratou ou autorizou/i);
  assert.match(third.question, /reclamou ou buscou atendimento/i);
  assert.equal(completed.status, "complete");
  assert.match(completed.refined, /não o autorizei/i);
  assert.equal(requests.length, 1);
  assert.match(requests[0].instructions, /quatro tópicos/i);
  assert.match(requests[0].instructions, /Não trate reclamação prévia ou protocolo como requisito/i);
  assert.equal(requests[0].text.verbosity, "low");
});

test("testimony conversation requires all four topic answers before the final account", async () => {
  let request;
  const service = createJecTestimonyService({
    env: { AUDITA_OPENAI_API_KEY: "test-key" },
    clientFactory() {
      return {
        responses: {
          async create(payload) {
            request = payload;
            return {
              output_text:
                "Percebi cobranças mensais de seguro desde 2022. O valor variava e eu nunca contratei nem autorizei o serviço indicado nas faturas. Não procurei o banco.",
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
    { question: "Procurou o banco?", answer: "Não procurei o banco." },
  ]);

  assert.equal(result.status, "complete");
  assert.match(request.instructions, /quatro tópicos/i);
});

test("testimony normalization preserves paragraphs and removes control characters", () => {
  assert.equal(
    normalizeJecTestimony("  Primeiro fato.\u0000\n\n\n Segundo fato.  "),
    "Primeiro fato.\n\nSegundo fato.",
  );
});
