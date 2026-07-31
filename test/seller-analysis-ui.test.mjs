import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");

test("seller analysis is grouped under real estate purchase and sale", () => {
  assert.match(indexHtml, /<span class="nav-label">An&aacute;lise Compra e Venda de Im&oacute;veis<\/span>/);
  assert.match(indexHtml, /href="#analise-vendedor"/);
  assert.match(indexHtml, /<span class="nav-label">An&aacute;lise de Vendedor<\/span>/);
});

test("seller analysis route opens its introductory screen", () => {
  assert.match(indexHtml, /id="analise-vendedor" data-page="analise-vendedor"/);
  assert.match(indexHtml, /certid&otilde;es dispon&iacute;veis para pessoa f&iacute;sica no TJDFT/);
  assert.match(indexHtml, /organizamos os PDFs oficiais/);
  assert.match(indexHtml, /Dispon&iacute;vel no DF/);
  assert.match(appJs, /"analise-vendedor":\s*\{/);
});

test("seller analysis collects all four DF certificates without AI risk analysis", () => {
  assert.match(indexHtml, /id="sellerAnalysisForm"/);
  assert.match(indexHtml, /id="sellerAnalysisCpf"/);
  assert.match(indexHtml, /id="sellerAnalysisFullName"/);
  assert.match(indexHtml, /id="sellerAnalysisMotherField"/);
  assert.doesNotMatch(indexHtml, /id="sellerAnalysisFatherName"/);
  assert.match(indexHtml, /id="sellerAnalysisAuthorization"/);
  assert.match(indexHtml, /Fal&ecirc;ncia e Recupera&ccedil;&atilde;o Judicial/);
  assert.match(indexHtml, /Especial &mdash; C&iacute;vel e Criminal/);
  assert.match(indexHtml, /A an&aacute;lise de risco por IA ser&aacute; adicionada em uma etapa futura/);
  assert.match(appJs, /\/api\/seller-analysis\/df/);
  assert.match(appJs, /motherNameRequired/);
  assert.match(appJs, /role="progressbar"/);
  assert.match(appJs, /Tempo normal: cerca de 30 segundos a 2 minutos/);
  assert.match(appJs, /Sem avanço há/);
  assert.match(appJs, /renderSellerAnalysisFailure/);
});
