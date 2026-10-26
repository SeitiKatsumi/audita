import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildChargeCompletionMarkup} from '../charge-analysis.js';
const id = '00000000-0000-4000-8000-000000000001';
test('completion shows the saved amounts, partial coverage and original private PDF without new generation', () => {
  const html = buildChargeCompletionMarkup({ id, analysisSummary: {
    documentCount: 2, disputedCount: 3, totalDisputed: 150, documentaryCoverage: 'partial',
    values: { updatedPrincipal: 180, doubleWithAdjustments: 330, damagesAmount: 0, estimatedClaimValue: 510 },
  } });
  assert.match(html, /Sua solicitação está completa/);
  assert.match(html, /O advogado responsável/);
  assert.match(html, /Resumo da análise/);
  assert.match(html, /Apuração parcial/);
  assert.match(html, /R\$\s*150,00/); assert.match(html, /R\$\s*510,00/); assert.match(html, /R\$\s*0,00/);
  assert.match(html, new RegExp('<iframe[^>]+src="/api/jec/petitions/' + id + '/pdf"'));
  assert.match(html, /download=1/); assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /não é um protocolo judicial/);
  assert.doesNotMatch(html, /\/prepare|\/submit|Abrir portal oficial/);
});
test('old jobs retain the PDF link without inventing a monetary summary; invalid identifiers never become URLs', () => {
  const legacy = buildChargeCompletionMarkup({ id });
  assert.match(legacy, /detalhes desta solicitação/); assert.match(legacy, /<iframe/); assert.doesNotMatch(legacy, /R\$/);
  const unsafe = buildChargeCompletionMarkup({ id: '<img src=x onerror=alert(1)>' });
  assert.doesNotMatch(unsafe, /<img|<iframe|href=/); assert.match(unsafe, /&lt;img/);
});
test('owner PDF route only reads persisted bytes, authenticates the session and prohibits caching', () => {
  const server = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  const start = server.indexOf('const customerPetitionPdf =');
  const end = server.indexOf('if (pathname === "/api/jec/petitions/prepare"', start);
  const route = server.slice(start, end);
  assert.ok(start > 0 && end > start);
  assert.match(route, /getSessionUser\(request\)/); assert.match(route, /lawyerQueue.customerReport/);
  assert.match(route, /private, no-store/); assert.match(route, /SAMEORIGIN/);
  assert.match(route, /attachment.*inline/);
  assert.doesNotMatch(route, /createJecPetitionPdf|generateFromCaseData|\.submit\(/);
});
