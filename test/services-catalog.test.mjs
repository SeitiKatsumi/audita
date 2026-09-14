import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {matchesService} from '../services-catalog.js';

test('catalog search combines accents, words, category and feature availability', () => {
  const service={text:'Isenção e restituição de IR imposto renda',categories:['beneficios']};
  assert.equal(matchesService(service,'  ISENCAO   renda ','all'),true);
  assert.equal(matchesService(service,'restituicao','beneficios'),true);
  assert.equal(matchesService(service,'isenção','bancario'),false);
  assert.equal(matchesService(service,'imovel','all'),false);
  assert.equal(matchesService({...service,enabled:false},'','all'),false);
});

test('catalog links keep existing services and collapse only their sidebar entries', async () => {
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const sidebar=html.slice(html.indexOf('<nav class="nav-list">'),html.indexOf('</nav>'));
 const catalog=html.slice(html.indexOf('<section class="services-page'),html.indexOf('<section class="home-hero"'));
 for(const route of ['analise-vendedor','consulta-imoveis','isencao-ir','pis-pasep','analise-cobrancas','dividas-bancarias']){
  assert.ok(catalog.includes(`href="#${route}"`));
 }
 for(const route of ['isencao-ir','pis-pasep','analise-cobrancas','dividas-bancarias','analise-vendedor']) assert.ok(!sidebar.includes(`href="#${route}"`));
 assert.ok(sidebar.includes('href="#central-servicos"'));
 assert.ok(catalog.includes('data-service-pis hidden'));
 assert.ok(sidebar.includes('class="nav-ai" href="/chat"'));
 assert.ok(!catalog.includes('services-help'));
});


test('every service destination includes the shared return navigation', async () => {
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const nav=html.match(/<nav class="service-return[^]*?<\/nav>/)[0];
 const pages=nav.match(/data-page="([^"]+)"/)[1].split(' ');
 const catalog=html.slice(html.indexOf('<section class="services-page'),html.indexOf('<section class="home-hero"'));
 for(const [,route] of catalog.matchAll(/href="#([^"]+)" data-service-card/g)) assert.ok(pages.includes(route));
 assert.ok(nav.includes('href="#central-servicos"'));
 assert.ok(!pages.includes('central-servicos'));
});
