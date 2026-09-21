import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {matchesService, initServicesCatalog} from '../services-catalog.js';

test('catalog keeps PIS, energy and IR visible without configured backends', () => {
 const cards = ['pis-pasep', 'contas-de-luz', 'isencao-ir'].map(text => ({
   textContent: text, dataset: {categories: 'beneficios'}, hidden: true
 }));
 const input = {value: '', addEventListener() {}};
 const count = {};
 const empty = {};
 const root = {
   querySelector(selector) {
     if (selector === '[data-service-count]') return count;
     if (selector === '[data-service-empty]') return empty;
     return input;
   },
   querySelectorAll(selector) { return selector === '[data-service-card]' ? cards : []; }
 };
 initServicesCatalog(root);
 assert.ok(cards.every(card => !card.hidden));
 assert.equal(count.textContent, '3 serviços encontrados');
 assert.equal(empty.hidden, true);
});

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
 for(const [,route] of catalog.matchAll(/class="service-card-entry" href="#([^"]+)"/g)) assert.ok(pages.includes(route));
 assert.ok(nav.includes('href="#central-servicos"'));
 assert.ok(!pages.includes('central-servicos'));
});

test('all catalog cards have details and preserve destinations and searchable audiences', async () => {
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const cards=[...html.matchAll(/<article class="home-module-action service-card service-card-explained"[^]*?<\/article>/g)].map(m=>m[0]);
 assert.equal(cards.length,9);
 for(const card of cards) {
  assert.ok(card.includes('<summary class="service-toggle">'));
  assert.ok(card.includes('Para quem é'));
  assert.ok(card.includes('service-note'));
  const pending=card.includes('data-categories="laudos"');
  assert.equal(card.includes('<a '),!pending);
  if(pending) assert.ok(card.includes('Em desenvolvimento'));
 }
 for(const [route,title,action,query,category] of [
  ['pis-pasep','PIS/Pasep: valores de cotas antigas','Verificar meu caso','herdeiros','beneficios'],
  ['isencao-ir','Imposto de Renda: isenção e restituição','Avaliar meu caso','aposentado imposto','beneficios'],
  ['contas-de-luz','Conta de luz: revisão de cobranças','Analisar minhas contas','conta de energia','energia']
 ]) {
  const card=cards.find(c=>c.includes(`href="#${route}"`));
  for(const text of [title,action,'Para quem é','Como podemos ajudar','service-note']) assert.ok(card.includes(text));
  assert.ok(!card.includes('<button'));
  assert.ok(card.includes('<summary class="service-toggle">'));
  assert.ok(card.includes(`class="service-card-entry" href="#${route}"`));
  assert.ok(card.includes('Mais informações'));
  assert.ok(card.includes('Menos informações'));
  assert.ok(!card.slice(0,card.indexOf('>')).includes(' open'));
  assert.ok(!card.match(/<summary[^>]*>([^]*?)<\/summary>/)[1].includes('<a '));
  const service={text:card.replace(/<[^>]*>/g,' ')+' '+card.match(/data-keywords="([^"]+)"/)[1],categories:[category]};
  assert.equal(matchesService(service,query,'all'),true);
  assert.equal(matchesService(service,query,category),true);
  assert.equal(matchesService(service,query,'bancario'),false);
 }
});
