import assert from "node:assert/strict";
import test from "node:test";

import {
  buildJecPetitionHtml,
  createJecPetitionPdf,
} from "../services/jec-petition-pdf.service.mjs";

const prepared = {
  ready: true,
  generatedAt: "2026-07-27T15:00:00.000Z",
  template: {
    id: "audited_values",
    label: "Modelo 1 - Auditoria concluída e valores apurados",
  },
  claimant: {
    fullName: "Cliente Teste",
  },
  draft: [
    "EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DO JUIZADO ESPECIAL CÍVEL DA COMARCA DE SÃO PAULO/SP",
    "",
    "Cliente Teste, brasileiro, solteiro, analista, apresenta a presente:",
    "",
    "AÇÃO DECLARATÓRIA DE INEXISTÊNCIA DE DÉBITO",
    "",
    "I. DOS FATOS",
    "",
    "Os fatos serão revisados pelo consumidor antes do protocolo.",
    "",
    "São Paulo/SP, 27 de julho de 2026.",
    "",
    "Cliente Teste",
    "",
    "CPF nº 52998224725",
    "",
    "(Jus Postulandi - Art. 9º da Lei 9.099/95)",
  ].join("\n"),
};

test("petition HTML uses A4 legal-document typography and escapes content", () => {
  const html = buildJecPetitionHtml({
    ...prepared,
    draft: prepared.draft.replace("analista", "analista <teste>"),
  });

  assert.match(html, /@page\s*\{[\s\S]*size:\s*A4/);
  assert.match(html, /Times New Roman/);
  assert.match(html, /class="court-address"/);
  assert.match(html, /class="action-title"/);
  assert.match(html, /analista &lt;teste&gt;/);
});

test("PDF generation refuses an incomplete petition before opening a browser", async () => {
  let launched = false;
  await assert.rejects(
    createJecPetitionPdf(
      { ...prepared, ready: false, missingFields: ["caseValue"] },
      {
        launch: async () => {
          launched = true;
          return null;
        },
      },
    ),
    (error) => {
      assert.equal(error.code, "jec_petition_incomplete");
      assert.deepEqual(error.missingFields, ["caseValue"]);
      return true;
    },
  );
  assert.equal(launched, false);
});
