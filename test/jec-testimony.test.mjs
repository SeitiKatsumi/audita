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

test("testimony normalization preserves paragraphs and removes control characters", () => {
  assert.equal(
    normalizeJecTestimony("  Primeiro fato.\u0000\n\n\n Segundo fato.  "),
    "Primeiro fato.\n\nSegundo fato.",
  );
});
