import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ITAU_CONTRACT_PARAGRAPHS } from '../services/itau-contract-text.mjs';
import { buildItauContractPreviewHtml } from '../services/itau-contract-preview.mjs';

test('contract reading contains all 15 supplied clauses and signature fields', () => {
  const html = buildItauContractPreviewHtml();
  assert.equal((html.match(/<h2>/g)||[]).length,15);
  const text = html.match(/<main>([\s\S]*)<\/main>/)[1].replace(/<[^>]+>/g,'').split('\n');
  assert.deepEqual(text,ITAU_CONTRACT_PARAGRAPHS);
  assert.match(html,/TESTEMUNHA 2/);
  assert.match(html,/5\.3\. A base de cálculo/);
  assert.match(html,/9\.4\. O saldo pertencente/);
  assert.doesNotMatch(html,/risco financeiro direto.*ZERO|CONTRATADO NÃO interporá/);
});

test('read contract route uses supplied model and disables caching', () => {
  const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
  const start=server.indexOf('if (pathname === "/api/jec/legal-services-contract/preview"');
  const route=server.slice(start,server.indexOf('\n  if (',start+5));
  assert.match(route,/response.end\(buildItauContractPreviewHtml\(\)\)/);
  assert.match(route,/no-store/);
});
