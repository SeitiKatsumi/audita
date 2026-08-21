import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildChargeAuditSnapshot,
  buildChargeCalculationSnapshot,
  buildChargeEstimate,
  buildChargeJecHandoff,
  buildChargeProgressSnapshot,
  CHARGE_ANALYSIS_BRANDS,
  ITAU_DOCUMENT_REQUEST_TEMPLATE,
  mergeChargeAnalysisFiles,
} from "../charge-analysis.js";
import { ITAU_FAQ_ITEMS, ITAU_FAQ_LEGAL_NOTICE } from "../itau-faq.js";
import { resolveItauChargeServiceTier } from "../services/billing-catalog.service.mjs";

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const plansHtml = readFileSync(new URL("../plans.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const stylesCss = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
const chargeAnalysisJs = readFileSync(
  new URL("../charge-analysis.js", import.meta.url),
  "utf8",
);
const serverJs = readFileSync(new URL("../server.mjs", import.meta.url), "utf8");

test("charge analysis module is available from the dashboard sidebar", () => {
  assert.match(indexHtml, /href="#analise-cobrancas"/);
  assert.match(indexHtml, /id="analise-cobrancas" data-page="analise-cobrancas"/);
  assert.match(appJs, /"analise-cobrancas":\s*\{/);
});

test("sidebar keeps charge analysis at the main level and uses the selected adaptive navigation", () => {
  const chargeMainLink = indexHtml.match(
    /<a href="#analise-cobrancas">[\s\S]*?An&aacute;lise de cobran&ccedil;as indevidas[\s\S]*?<\/a>/,
  )?.[0];
  const settingsGroup = indexHtml.match(
    /<details class="nav-group" open>\s*<summary>[\s\S]*?Configura&ccedil;&otilde;es[\s\S]*?<\/summary>[\s\S]*?<\/details>/,
  )?.[0];
  const developmentSummaryIndex = indexHtml.indexOf("Ferramentas de Consulta (Dev)");
  const developmentStart = indexHtml.lastIndexOf('<details class="nav-group">', developmentSummaryIndex);
  const developmentEnd = indexHtml.indexOf("</details>", developmentSummaryIndex);
  const developmentGroup = indexHtml.slice(developmentStart, developmentEnd + "</details>".length);

  assert.ok(chargeMainLink);
  assert.match(chargeMainLink, /assets\/nav-icons\/file-dollar\.svg/);
  assert.ok(settingsGroup);
  assert.match(settingsGroup, /\sopen(?:\s|>)/);
  assert.match(settingsGroup, /#historico/);
  assert.match(settingsGroup, /#meu-painel/);
  assert.match(settingsGroup, /id="adminBillingNav"/);
  assert.match(settingsGroup, /id="adminUsageNav"/);
  assert.ok(developmentGroup);
  assert.doesNotMatch(developmentGroup, /\sopen(?:\s|>)/);
  assert.doesNotMatch(developmentGroup, /#analise-cobrancas/);
  assert.match(developmentGroup, /#consulta-tjdft-pf/);
  assert.match(developmentGroup, /#consulta-imoveis/);
  assert.match(developmentGroup, /#consulta-cnib/);
  assert.ok(indexHtml.indexOf(settingsGroup) > indexHtml.indexOf("#analise-vendedor"));
  assert.ok(indexHtml.indexOf(developmentGroup) > indexHtml.indexOf(settingsGroup));
  assert.match(indexHtml, /id="sidebarToggleIcon"[\s\S]*?assets\/nav-icons\/chevron-left\.svg/);
  assert.match(indexHtml, /id="sidebarScrim"/);
  assert.match(appJs, /classList\.add\("has-active-child"\)/);
  assert.match(stylesCss, /body\.sidebar-collapsed \.nav-group\.has-active-child > summary/);
  assert.match(stylesCss, /body\.sidebar-collapsed \.nav-label\s*\{[\s\S]*?position:\s*absolute/);
});

test("Audita AI uses a generic AI icon and standard sidebar colors", () => {
  const aiLink = indexHtml.match(
    /<a class="nav-ai" href="\/chat"[\s\S]*?<\/a>/,
  )?.[0];

  assert.ok(aiLink);
  assert.match(aiLink, /assets\/nav-icons\/sparkles\.svg/);
  assert.doesNotMatch(aiLink, /assets\/nav-icons\/audita-ai\.svg/);
  assert.doesNotMatch(aiLink, /square-rounded-letter-a\.svg/);
  assert.doesNotMatch(stylesCss, /\.nav-list a\.nav-ai \.nav-icon/);
  assert.doesNotMatch(stylesCss, /\.nav-list a\.nav-ai\s*\{/);
});

test("every Audita surface uses the official logo asset", () => {
  const surfaces = [indexHtml, plansHtml, appJs];
  for (const surface of surfaces) {
    assert.doesNotMatch(surface, /audita-logo-white\.svg/);
  }
  assert.match(indexHtml, /assets\/audita-logo-original\.png/);
  assert.match(plansHtml, /assets\/audita-logo-original\.png/);
  assert.match(appJs, /assets\/audita-logo-original\.png/);
});

test("charge analysis messages use the Audita profile avatar", () => {
  assert.match(chargeAnalysisJs, /assets\/audita-profile-assistant\.png/);
  assert.match(stylesCss, /\.charge-analysis-avatar\s*\{[\s\S]*?border-radius:\s*50%/);
  assert.match(stylesCss, /\.charge-analysis-avatar img\s*\{[\s\S]*?transform:\s*scale\(2\.1\)/);
});

test("sidebar keeps expanded groups scrollable and collapsed icons centered", () => {
  assert.match(stylesCss, /\.nav-list\s*\{[\s\S]*?grid-auto-rows:\s*max-content/);
  assert.match(
    stylesCss,
    /body\.sidebar-collapsed \.nav-list (?:a|summary),[\s\S]*?width:\s*100%[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/,
  );
  assert.match(appJs, /function keepNavGroupVisible\(group\)/);
  assert.match(appJs, /group\.addEventListener\("toggle", \(\) => keepNavGroupVisible\(group\)\)/);
  assert.match(appJs, /navList\.scrollBy\(\{/);
});

test("sidebar stays in compact desktop mode until the true mobile breakpoint", () => {
  assert.match(stylesCss, /@media \(max-width: 960px\)\s*\{[\s\S]*?\.mobile-menu-button/);
  assert.match(
    stylesCss,
    /@media \(min-width: 961px\) and \(max-width: 1280px\)\s*\{[\s\S]*?--sidebar-width:\s*300px/,
  );
  assert.match(stylesCss, /@media \(max-width: 1120px\)\s*\{[\s\S]*?\.hero-grid/);
  assert.equal((appJs.match(/max-width: 960px/g) || []).length, 2);
  assert.doesNotMatch(appJs, /max-width: 1120px/);
});

test("home exposes the two real product modules without mock indicators", () => {
  const homeStart = indexHtml.indexOf('<section class="home-hero"');
  const homeEnd = indexHtml.indexOf('<section class="seller-analysis-page"', homeStart);
  const homeMarkup = indexHtml.slice(homeStart, homeEnd);

  assert.ok(homeStart >= 0 && homeEnd > homeStart);
  assert.equal((homeMarkup.match(/class="home-module-action"/g) || []).length, 2);
  assert.match(homeMarkup, /href="#analise-cobrancas"/);
  assert.match(homeMarkup, /Cobran&ccedil;as indevidas/);
  assert.match(homeMarkup, /href="#analise-vendedor"/);
  assert.match(homeMarkup, /Compra e venda de im&oacute;veis/);
  assert.doesNotMatch(homeMarkup, /Consultas hoje|Fontes conectadas|Alertas cr&iacute;ticos|Tempo m&eacute;dio/);
  assert.doesNotMatch(homeMarkup, /home-hero-features|class="metrics"/);
  assert.match(stylesCss, /\.home-module-actions\s*\{/);
  assert.match(stylesCss, /\.home-module-action:hover/);
  assert.match(
    stylesCss,
    /\.home-module-icon img\s*\{[\s\S]*?filter:\s*brightness\(0\)[\s\S]*?hue-rotate\(85deg\)/,
  );
  assert.match(
    stylesCss,
    /\.home-module-chevron\s*\{[\s\S]*?filter:\s*brightness\(0\)[\s\S]*?hue-rotate\(85deg\)/,
  );
  assert.doesNotMatch(appJs, /metricCards|consultationsToday|connectedSources|criticalAlerts/);
});

test("charge analysis exposes a guided flow without an open chat input", () => {
  const moduleStart = indexHtml.indexOf('<section class="charge-analysis-page"');
  const moduleEnd = indexHtml.indexOf('<section class="assistant-workbench"', moduleStart);
  const moduleMarkup = indexHtml.slice(moduleStart, moduleEnd);

  assert.ok(moduleStart >= 0 && moduleEnd > moduleStart);
  assert.match(moduleMarkup, /Fluxo guiado/);
  assert.match(moduleMarkup, /sem conversa aberta com IA/);
  assert.match(moduleMarkup, /id="chargeAnalysisStage"/);
  assert.match(indexHtml, /charge-analysis\.js/);
  assert.doesNotMatch(moduleMarkup, /textarea|contenteditable|chatInput/);
});

test("charge analysis keeps progress internal without rendering the step rail", () => {
  const moduleStart = indexHtml.indexOf('<section class="charge-analysis-page"');
  const moduleEnd = indexHtml.indexOf('<section class="assistant-workbench"', moduleStart);
  const moduleMarkup = indexHtml.slice(moduleStart, moduleEnd);

  assert.doesNotMatch(moduleMarkup, /chargeAnalysisProgress|data-charge-progress=/);
  assert.match(indexHtml, /class="charge-analysis-workspace"/);
  assert.match(indexHtml, /class="charge-analysis-content"/);
  assert.match(chargeAnalysisJs, /buildChargeProgressSnapshot\(state\)/);
  assert.doesNotMatch(chargeAnalysisJs, /charge-recovery-progress/);
  assert.match(stylesCss, /grid-template-rows: minmax\(0, 1fr\)/);
});

test("charge analysis exposes a searchable accessible FAQ dialog", () => {
  assert.equal(ITAU_FAQ_ITEMS.length, 34);
  assert.match(ITAU_FAQ_ITEMS[0].question, /ressarcimento/);
  assert.match(ITAU_FAQ_ITEMS.at(-1).question, /indeniza&ccedil;&atilde;o ou restitui&ccedil;&atilde;o/);
  assert.match(ITAU_FAQ_LEGAL_NOTICE, /n&atilde;o presta servi&ccedil;os de advocacia/);
  assert.match(indexHtml, /id="chargeAnalysisHelpButton"/);
  assert.match(indexHtml, /aria-haspopup="dialog"/);
  assert.match(indexHtml, /id="chargeAnalysisFaqDialog" aria-labelledby="chargeFaqTitle"/);
  assert.match(indexHtml, /id="chargeFaqSearch" type="search"/);
  assert.match(chargeAnalysisJs, /ITAU_FAQ_ITEMS\.filter/);
  assert.match(chargeAnalysisJs, /faqDialog\.showModal/);
  assert.match(chargeAnalysisJs, /faqButton\?\.focus\(\)/);
  assert.match(stylesCss, /\.charge-faq-dialog::backdrop/);
  assert.match(stylesCss, /@media \(max-width: 520px\)[\s\S]*?\.charge-faq-dialog/);
  assert.match(dockerfile, /COPY[^\n]*itau-faq\.js[^\n]*server\.mjs/);
});

test("charge progress is evidence-based and never treats document generation as filing", () => {
  assert.deepEqual(
    buildChargeProgressSnapshot({
      screen: "no-documents",
      authorizationAnswer: "denied",
      documentAvailability: "none",
    }),
    {
      percent: 20,
      activeStep: "statements",
      message: "Faltam faturas ou extratos. Sem documentos, a análise e a preparação jurídica não avançam.",
      evidenceCoverage: "absent",
      protocolStatus: "human_pending",
    },
  );

  const partial = buildChargeProgressSnapshot({
    screen: "result",
    authorizationAnswer: "denied",
    documentAvailability: "partial",
    selectedFiles: [{ name: "julho.pdf" }],
    caseData: {
      candidates: [{ amount: 39.9, answer: "not_recognized" }],
    },
  });
  assert.equal(partial.percent, 65);
  assert.equal(partial.activeStep, "recovery");
  assert.equal(partial.evidenceCoverage, "partial");
  assert.match(partial.message, /cobertura é parcial/);

  const generated = buildChargeProgressSnapshot({
    screen: "recovery",
    authorizationAnswer: "denied",
    documentAvailability: "complete",
    selectedFiles: [{ name: "historico.pdf" }],
    caseData: {
      candidates: [{ amount: 39.9, answer: "not_recognized" }],
    },
    recovery: {
      phase: "guide",
      handoff: { ready: true },
      prepared: { ready: true },
      pdfGeneratedAt: "2026-08-06T12:00:00.000Z",
    },
  });
  assert.equal(generated.percent, 90);
  assert.equal(generated.activeStep, "tribunal");
  assert.equal(generated.protocolStatus, "human_pending");
  assert.match(generated.message, /protocolo final continua pendente/);
});

test("charge analysis reveals agent messages before moving to the selected path", () => {
  assert.match(chargeAnalysisJs, /revealTriageMessages/);
  assert.match(chargeAnalysisJs, /IA AUDITA est&aacute; digitando/);
  assert.match(chargeAnalysisJs, /continueFromTriage/);
  assert.match(chargeAnalysisJs, /prefers-reduced-motion: reduce/);
  assert.match(chargeAnalysisJs, /function typingDelayFor\(message\)/);
  assert.match(chargeAnalysisJs, /Math\.min\(2800, Math\.max\(1500, visibleLength \* 8\)\)/);
  assert.match(chargeAnalysisJs, /await messageDelay\(1000\)/);
  assert.match(chargeAnalysisJs, /await messageDelay\(1500\)/);
  assert.match(chargeAnalysisJs, /function startTriageWhenOpened\(\)/);
  assert.match(chargeAnalysisJs, /document\.body\.dataset\.activePage !== "analise-cobrancas"/);
  assert.match(appJs, /new CustomEvent\("audita:pagechange"/);
});

test("charge analysis reuses one avatar and moves it to the latest assistant message", () => {
  assert.match(chargeAnalysisJs, /let floatingAssistantAvatar = null/);
  assert.match(chargeAnalysisJs, /function assistantAvatarAnchor\(\)/);
  assert.match(chargeAnalysisJs, /function ensureFloatingAssistantAvatar\(\)/);
  assert.match(chargeAnalysisJs, /function moveAssistantAvatar\(conversation/);
  assert.match(chargeAnalysisJs, /querySelectorAll\("\.charge-analysis-message\.assistant"\)/);
  assert.match(chargeAnalysisJs, /stage\.appendChild\(floatingAssistantAvatar\)/);
  assert.match(chargeAnalysisJs, /moveAssistantAvatar\(conversation\);/);
  assert.match(stylesCss, /\.charge-analysis-floating-avatar\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?transform 460ms/);
  assert.match(stylesCss, /\.charge-analysis-floating-avatar\.is-positioning\s*\{[\s\S]*?transition:\s*none/);
});

test("charge analysis starts with the two self-assessment paths and the lawyer kit", () => {
  assert.match(
    chargeAnalysisJs,
    /Voc&ecirc; possui ou possuiu algum cart&atilde;o dessas bandeiras/,
  );
  assert.match(chargeAnalysisJs, /data-charge-action="not-authorized"/);
  assert.match(chargeAnalysisJs, /data-charge-action="verify-statement"/);
  assert.match(chargeAnalysisJs, /Sim, tenho um desses cart&otilde;es/);
  assert.match(chargeAnalysisJs, /N&atilde;o sei, quais s&atilde;o todas as bandeiras/);
  assert.doesNotMatch(chargeAnalysisJs, /<button[^>]+data-charge-action="authorized"/);
  assert.match(chargeAnalysisJs, /<button[^>]+data-charge-action="lawyer"/);
  assert.match(chargeAnalysisJs, /Sou advogado\(a\)/);
  assert.doesNotMatch(chargeAnalysisJs, /Seguro Perda e Roubo \/ Cart&atilde;o Protegido/);
  assert.doesNotMatch(chargeAnalysisJs, /Seguro Prestamista/);
});

test("charge analysis keeps identification, attachments and analysis in one continuous journey", () => {
  assert.match(chargeAnalysisJs, /function earlyJourneyMarkup\(/);
  assert.match(chargeAnalysisJs, /stage\.innerHTML = earlyJourneyMarkup\(\{ documentChoice: true \}\)/);
  assert.match(chargeAnalysisJs, /\$\{earlyJourneyMarkup\(\{ documentSelected: true \}\)\}/);
  assert.match(chargeAnalysisJs, /await openCalculation\(\)/);
  assert.doesNotMatch(chargeAnalysisJs, /function renderReview\(\)/);
  assert.doesNotMatch(chargeAnalysisJs, /state\.screen = "review"/);
});

test("charge analysis introduction links the historical card scope to the searchable references", () => {
  assert.match(chargeAnalysisJs, /function chargeAnalysisIntroMarkup\(\)/);
  assert.equal(
    (chargeAnalysisJs.match(/Vou conduzir uma verifica&ccedil;&atilde;o inicial/g) || []).length,
    1,
  );
  assert.match(chargeAnalysisJs, /133 parceiras/);
  assert.match(chargeAnalysisJs, /Casas Bahia, Magalu, Ponto, Marisa/);
  assert.match(chargeAnalysisJs, /data-charge-action="open-brand-references"/);
  assert.match(chargeAnalysisJs, /Abrir 113 refer&ecirc;ncias nominais das 133 bandeiras/);
  assert.match(chargeAnalysisJs, /\$\{chargeAnalysisIntroMarkup\(\)\}/);
  assert.match(
    chargeAnalysisJs,
    /assistantMessage\(chargeAnalysisIntroMarkup\(\), "IA AUDITA", "charge-analysis-intro-message"\)/,
  );
  assert.match(
    chargeAnalysisJs,
    /action === "open-brand-references"[\s\S]*?state\.screen = "brands";/,
  );
  assert.doesNotMatch(chargeAnalysisJs, /Conte&uacute;do atualizado em julho de 2026/);
  assert.doesNotMatch(chargeAnalysisJs, /Para entender melhor o seu caso, vou fazer algumas perguntas r&aacute;pidas/);
  assert.match(stylesCss, /\.charge-analysis-inline-link[\s\S]*?text-underline-offset:\s*3px/);
});

test("the initial question aligns with the standard assistant message width", () => {
  assert.match(
    stylesCss,
    /\.charge-analysis-message\.question \.charge-analysis-bubble\s*\{[\s\S]*?max-width:\s*590px/,
  );
});

test("assistant messages use a visual speech-bubble tail", () => {
  assert.match(
    stylesCss,
    /\.charge-analysis-message\.assistant \.charge-analysis-bubble::before\s*\{[\s\S]*?left:\s*-7px;[\s\S]*?transform:\s*rotate\(45deg\)/,
  );
});

test("charge analysis keeps previous messages stable while loading the next step", () => {
  assert.match(
    chargeAnalysisJs,
    /querySelectorAll\("\.charge-analysis-actions"\)[\s\S]*?actions\.hidden = true;[\s\S]*?insertAdjacentHTML\("beforeend", userMessage\(reply\)\)/,
  );
  assert.doesNotMatch(
    chargeAnalysisJs,
    /querySelector\("\.charge-analysis-message\.question"\)\?\.remove\(\)/,
  );
  assert.match(
    stylesCss,
    /\.charge-analysis-message-typing\s*\{[\s\S]*?animation:\s*charge-message-in 220ms ease-out both;/,
  );
  assert.doesNotMatch(
    stylesCss,
    /\.charge-analysis-message\s*\{[^}]*animation:\s*charge-message-in/,
  );
});

test("charge analysis uses the full available desktop workspace", () => {
  assert.match(
    stylesCss,
    /@media \(min-width: 1081px\)[\s\S]*?\.charge-analysis-shell\s*\{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*none;/,
  );
  assert.match(
    stylesCss,
    /\.charge-analysis-content \.charge-analysis-message\.assistant\s*\{[\s\S]*?width:\s*min\(70%, 980px\);[\s\S]*?align-self:\s*flex-start;/,
  );
  assert.match(
    stylesCss,
    /\.charge-analysis-content \.charge-analysis-bubble,[\s\S]*?max-width:\s*none;/,
  );
  assert.match(
    stylesCss,
    /\.charge-analysis-content \.charge-brand-panel,[\s\S]*?\.charge-analysis-content \.charge-result-actions\s*\{[\s\S]*?width:\s*calc\(100% - 62px\);/,
  );
});

test("the information path opens the searchable reference list before documents", () => {
  assert.equal(
    buildChargeProgressSnapshot({
      screen: "brands",
      authorizationAnswer: "uncertain",
    }).message,
    "Confira as referências e informe se já teve um dos cartões apresentados.",
  );
  assert.match(
    chargeAnalysisJs,
    /action === "verify-statement"[\s\S]*?authorizationAnswer = "uncertain";[\s\S]*?state\.screen = "brands";/,
  );
  assert.match(chargeAnalysisJs, /Buscar entre 113 referências/);
  assert.match(chargeAnalysisJs, /data-charge-action="select-brand"/);
  assert.match(chargeAnalysisJs, /data-charge-action="brand-history-yes"/);
  assert.match(chargeAnalysisJs, /data-charge-action="brand-history-no"/);
  assert.match(chargeAnalysisJs, /Sim, já tive ou tenho um desses cartões/);
  assert.match(chargeAnalysisJs, /Não, nunca tive um desses cartões/);
  assert.match(chargeAnalysisJs, /encontrar uma referência não comprova, por si só, que houve cobrança indevida/);
  assert.match(
    chargeAnalysisJs,
    /action === "brand-history-yes"[\s\S]*?state\.screen = "documents";/,
  );
  assert.match(
    chargeAnalysisJs,
    /action === "brand-history-no"[\s\S]*?state\.screen = "ended";/,
  );
});

test("charge analysis removes the agreement context from the triage opening", () => {
  assert.match(chargeAnalysisJs, /charge-analysis-intro-message/);
  assert.doesNotMatch(chargeAnalysisJs, /Em 2026, o MPMG e o Idec divulgaram um acordo/);
  assert.doesNotMatch(chargeAnalysisJs, /Instrumento de Transa&ccedil;&atilde;o/);
  assert.doesNotMatch(chargeAnalysisJs, /Memorando explicativo e v&iacute;deo/);
  assert.doesNotMatch(chargeAnalysisJs, /youtube-nocookie\.com\/embed\/rzxDS0cbdlc/);
});

test("charge analysis keeps the initial triage focused on the card question", () => {
  assert.doesNotMatch(chargeAnalysisJs, /Seguros e servi&ccedil;os considerados/);
  assert.doesNotMatch(chargeAnalysisJs, /charge-analysis-insurance-details/);
});

test("charge analysis separates complete, partial and no-document journeys", () => {
  assert.match(chargeAnalysisJs, /documents-complete/);
  assert.match(chargeAnalysisJs, /documents-partial/);
  assert.match(chargeAnalysisJs, /documents-none/);
  assert.match(chargeAnalysisJs, /Tenho todos ou a maior parte/);
  assert.match(chargeAnalysisJs, /Tenho apenas alguns ou um print recente/);
  assert.match(chargeAnalysisJs, /Não tenho nenhum extrato/);
  assert.match(chargeAnalysisJs, /state\.screen = "no-documents"/);
  assert.match(chargeAnalysisJs, /multiple/);
  assert.match(chargeAnalysisJs, /aggregateChargeCases/);
});

test("the no-document path requests evidence without calculation or legal handoff", () => {
  assert.match(chargeAnalysisJs, /A IA AUDITA não consegue substituir documentos por estimativas/);
  assert.match(chargeAnalysisJs, /Sem ao menos um documento, não há base para calcular valores, gerar relatório técnico ou preparar uma eventual medida jurídica/);
  assert.match(chargeAnalysisJs, /data-charge-action="copy-document-request"/);
  assert.match(chargeAnalysisJs, /Carta copiada\./);
  assert.doesNotMatch(chargeAnalysisJs, /itau-solicitacao-extratos-e-autorizacao-debito\.docx/);
  assert.match(chargeAnalysisJs, /data-charge-action="resume-document-upload"/);
  assert.match(chargeAnalysisJs, /0800 728 0728/);
  assert.match(chargeAnalysisJs, /0800 570 0011/);
  assert.match(chargeAnalysisJs, /www\.itau\.com\.br\/atendimento-itau/);
  assert.doesNotMatch(ITAU_DOCUMENT_REQUEST_TEMPLATE, /\d{3}\.\d{3}\.\d{3}-\d{2}/);
  assert.match(ITAU_DOCUMENT_REQUEST_TEMPLATE, /\[NOME COMPLETO\]/);
  assert.match(ITAU_DOCUMENT_REQUEST_TEMPLATE, /\[MÊS\/ANO INICIAL\]/);
  assert.match(ITAU_DOCUMENT_REQUEST_TEMPLATE, /contrato, proposta ou termo de adesão/);
  assert.match(ITAU_DOCUMENT_REQUEST_TEMPLATE, /autorização prévia e expressa/);
  assert.match(ITAU_DOCUMENT_REQUEST_TEMPLATE, /número do protocolo/);
  assert.doesNotMatch(chargeAnalysisJs, /function renderEstimate\(/);
  assert.doesNotMatch(chargeAnalysisJs, /function renderEstimateResult\(/);
  assert.doesNotMatch(chargeAnalysisJs, /state\.screen = "estimate-result"/);
});

test("charge analysis accepts and manages multiple documents in every upload journey", () => {
  assert.match(chargeAnalysisJs, /id="chargeAnalysisFile"[\s\S]*?multiple/);
  assert.doesNotMatch(chargeAnalysisJs, /files\.slice\(0, 1\)/);
  assert.match(chargeAnalysisJs, /data-charge-action="remove-upload-file"/);
  assert.match(chargeAnalysisJs, /Clique para adicionar mais documentos/);

  const first = { name: "janeiro.pdf", size: 120, lastModified: 1, type: "application/pdf" };
  const duplicate = { ...first };
  const second = { name: "fevereiro.pdf", size: 160, lastModified: 2, type: "application/pdf" };
  assert.deepEqual(mergeChargeAnalysisFiles([first], [duplicate, second]), [first, second]);
});

test("document analysis starts without a confirmation checkbox and shows progress", () => {
  assert.doesNotMatch(chargeAnalysisJs, /chargeAnalysisConsent|charge-upload-consent/);
  assert.doesNotMatch(chargeAnalysisJs, /titularidade ou autorização para processar/);
  assert.doesNotMatch(chargeAnalysisJs, /Selecione e autorize o processamento/);
  assert.doesNotMatch(chargeAnalysisJs, /Confirme que possui autoriza/);
  assert.match(chargeAnalysisJs, /aria-busy="true"/);
  assert.match(chargeAnalysisJs, /Estamos analisando seus extratos/);
  assert.match(stylesCss, /\.charge-analysis-loader[\s\S]*?animation:\s*charge-analysis-spin 800ms linear infinite/);
});

test("charge analysis keeps the 113 supplied brand references as triage data", () => {
  assert.equal(CHARGE_ANALYSIS_BRANDS.length, 113);
  assert.equal(new Set(CHARGE_ANALYSIS_BRANDS).size, 113);
  assert.ok(CHARGE_ANALYSIS_BRANDS.includes("LuizaCred / Magalu"));
  assert.ok(CHARGE_ANALYSIS_BRANDS.includes("Cartão Universitário"));
});

test("preliminary audit calculates only evidenced and user-disputed amounts", () => {
  assert.deepEqual(
    buildChargeAuditSnapshot({
      candidates: [
        { amount: 19, answer: "not_recognized" },
        { amount: 12.5, answer: "recognized" },
        { amount: null, answer: "pending" },
      ],
    }),
    {
      candidateCount: 3,
      disputedCount: 1,
      pendingCount: 1,
      totalDetected: 31.5,
      totalDisputed: 19,
      hypotheticalDouble: 38,
    },
  );
});

test("closed catalog analysis proceeds directly to documentary calculation", () => {
  assert.doesNotMatch(chargeAnalysisJs, /state\.screen = "review"/);
  assert.doesNotMatch(chargeAnalysisJs, /function renderReview\(\)/);
  assert.doesNotMatch(chargeAnalysisJs, /data-charge-action="confirm-review"/);
  assert.doesNotMatch(chargeAnalysisJs, /answer-candidate|data-charge-answer|Você reconhece esta contratação/);
  assert.match(chargeAnalysisJs, /await openCalculation\(\)/);
  assert.match(chargeAnalysisJs, /compatíveis com as cinco famílias analisadas/);
  assert.doesNotMatch(chargeAnalysisJs, /id="chargeEstimateForm"/);
  assert.doesNotMatch(chargeAnalysisJs, /Complemento estimado aos documentos parciais/);
});

test("automatic analysis and preliminary simulation happen before the one-time service offer", () => {
  assert.doesNotMatch(chargeAnalysisJs, /state\.screen = "review"/);
  assert.match(chargeAnalysisJs, /await openCalculation\(\)/);
  assert.match(chargeAnalysisJs, /state\.screen = state\.access\?\.entitled \|\| !calculation\.itemCount \? "result" : "paywall"/);
  assert.match(chargeAnalysisJs, /Você pode ter entre \$\{escapeChargeHtml\(tierRangeLabel\(selectedTier\)\)\} para receber/);
  assert.match(chargeAnalysisJs, /No momento, atendemos casos a partir de R\$ 4\.999,99/);
  assert.doesNotMatch(chargeAnalysisJs, /Sua simulação documental indica \$\{formatChargeCurrency\(calculation\.estimatedMaterialClaim\)\}/);
  assert.match(chargeAnalysisJs, /Contratação única por caso/);
  assert.match(chargeAnalysisJs, /data-charge-action="continue-itau-service"/);
  assert.doesNotMatch(chargeAnalysisJs, /Standard mensal/);
  assert.doesNotMatch(chargeAnalysisJs, /Standard anual/);
  assert.doesNotMatch(chargeAnalysisJs, /Comparativo ilustrativo/);
  assert.doesNotMatch(chargeAnalysisJs, /552%/);
  assert.doesNotMatch(chargeAnalysisJs, /Transparência antes de contratar/);
  assert.doesNotMatch(chargeAnalysisJs, /charge-paywall-reference" role="group"/);
  assert.doesNotMatch(chargeAnalysisJs, /DevoluÃ§Ã£o em DOBRO automÃ¡tica|garantindo a reparaÃ§Ã£o integral|sem riscos financeiros/i);
  assert.match(chargeAnalysisJs, /Continue seu caso com a IA AUDITA/);
  assert.doesNotMatch(chargeAnalysisJs, /charge-audit-table-wrap/);
  assert.match(chargeAnalysisJs, /Não é assinatura: você paga uma única vez para continuar este caso/);
  assert.match(chargeAnalysisJs, />Continuar<\/button>/);
  assert.match(chargeAnalysisJs, /action === "continue-itau-service"[\s\S]*state\.screen = "result"/);
  assert.match(chargeAnalysisJs, /\/api\/itau-refund\/checkout/);
  assert.match(chargeAnalysisJs, /audita:itau-checkout-cases/);
  assert.match(chargeAnalysisJs, /itau_checkout/);
  assert.match(serverJs, /resolveItauChargeServiceTier/);
  assert.match(serverJs, /stripeBillingService\.createCheckoutSession\(authContext/);
  assert.match(serverJs, /case: result\.case/);
  assert.match(serverJs, /subscriptionRequired: locked/);
  assert.match(serverJs, /const reviewOnly =/);
  assert.match(serverJs, /connect-src 'self' https:\/\/api\.bcb\.gov\.br/);
});

test("lawyer route sells a protected one-time document kit", () => {
  assert.match(chargeAnalysisJs, /data-charge-action="lawyer"/);
  assert.match(chargeAnalysisJs, /Kit profissional Itaú/);
  assert.match(chargeAnalysisJs, /Processo completo/);
  assert.match(serverJs, /fileName: "processo-completo\.pdf"/);
  assert.doesNotMatch(chargeAnalysisJs, /Acordo integral/);
  assert.match(chargeAnalysisJs, /39999/);
  assert.match(chargeAnalysisJs, /document\.included === false/);
  assert.match(serverJs, /included: true/);
  assert.match(chargeAnalysisJs, /\/api\/itau-lawyer-kit\/checkout/);
  assert.match(serverJs, /\/api\/itau-lawyer-kit\/documents/);
  assert.match(serverJs, /itauLawyerKitAccessState/);
  assert.match(serverJs, /private-documents/);
  assert.match(serverJs, /itau_lawyer_kit_purchase_required/);
  assert.doesNotMatch(chargeAnalysisJs, /Sou advogado ou advogada — disponível em breve/);
});

test("calculation uses only confirmed non-recognized documentary occurrences", () => {
  const calculation = buildChargeCalculationSnapshot(
    {
      candidates: [
        { id: "auto", amount: 100, date: "2026-01-15", answer: "not_recognized", origin: "auto_detected", sourceFileName: "janeiro.pdf" },
        { id: "directed", amount: 50, date: "2026-02-15", answer: "not_recognized", origin: "directed_search", sourceFileName: "fevereiro.pdf" },
        { id: "known", amount: 12, answer: "recognized", sourceFileName: "julho.pdf" },
        { id: "pending", amount: 10, answer: "pending", sourceFileName: "agosto.pdf" },
      ],
    },
    {
      asOf: "2026-03-15",
      ipcaRates: [
        { data: "01/01/2026", valor: "1.00" },
        { data: "01/02/2026", valor: "2.00" },
        { data: "01/03/2026", valor: "3.00" },
      ],
    },
  );
  assert.equal(calculation.itemCount, 2);
  assert.equal(calculation.principal, 150);
  assert.equal(calculation.hypotheticalDouble, 300);
  assert.equal(calculation.monetaryAdjustment, 8.64);
  assert.equal(calculation.estimatedInterest, 2.4);
  assert.equal(calculation.estimatedMaterialClaim, 311.04);
  assert.equal(calculation.moralDamagesAmount, 2_000);
  assert.equal(calculation.estimatedClaimValue, 2_311.04);
  assert.equal(calculation.correctionAvailable, true);
  assert.equal(calculation.excludedWithoutAmount, 0);
});

test("minimum service tier uses the full simulation including default moral damages", () => {
  const calculation = buildChargeCalculationSnapshot(
    { candidates: [{ amount: 1_500, date: "2026-03-15", answer: "not_recognized" }] },
    { asOf: "2026-03-15", ipcaRates: [{ data: "01/03/2026", valor: "0" }] },
  );

  assert.equal(calculation.estimatedMaterialClaim, 3_000);
  assert.equal(calculation.moralDamagesAmount, 2_000);
  assert.equal(calculation.estimatedClaimValue, 5_000);
  assert.equal(
    resolveItauChargeServiceTier(Math.round(calculation.estimatedClaimValue * 100))?.id,
    "itau-cobrancas-faixa-1",
  );
  assert.match(chargeAnalysisJs, /calculation\?\.estimatedClaimValue/);
  assert.match(serverJs, /calculation\.estimatedClaimValue \* 100/);
});

test("automatic catalog flow has no manual candidate insertion or confirmation", () => {
  assert.doesNotMatch(chargeAnalysisJs, /Indicar uma cobrança para procurar nos meus anexos/);
  assert.doesNotMatch(chargeAnalysisJs, /\/api\/itau-refund\/cases\/search/);
  assert.doesNotMatch(chargeAnalysisJs, /Adicionar cobrança que não apareceu/);
  assert.doesNotMatch(chargeAnalysisJs, /name="(?:amount|date)"/);
  assert.doesNotMatch(chargeAnalysisJs, /answer-candidate|confirm-review/);
});

test("guided documentary journey hands evidenced charges to JEC model 1", () => {
  const handoff = buildChargeJecHandoff({
    handoffId: "documented-case",
    documentAvailability: "complete",
    authorizationAnswer: "confirmed",
    caseData: {
      candidates: [
        {
          id: "charge-1",
          label: "Seguro Fatura Protegida",
          amount: 19,
          answer: "not_recognized",
        },
      ],
    },
  });

  assert.equal(handoff.ready, true);
  assert.equal(handoff.journey, "with_historical_documents");
  assert.equal(handoff.caseData.id, "guided-jec-documented-case");
  assert.equal(handoff.caseData.answers.historicalDocumentsAvailable, "yes");
  assert.equal(handoff.caseData.answers.authorizationAnswer, "confirmed");
  assert.equal(handoff.suggestion.values.doubleRefundAmount, "38,00");
  assert.equal(handoff.caseData.candidates[0].amount, 19);
});

test("guided no-document journey blocks estimates and JEC preparation", () => {
  const estimate = {
    description: "Proteção do cartão",
    ...buildChargeEstimate({
      monthlyAmount: 19,
      durationValue: 15,
      durationUnit: "years",
    }),
  };
  const handoff = buildChargeJecHandoff({
    handoffId: "declared-case",
    documentAvailability: "none",
    authorizationAnswer: "confirmed",
    estimate,
  });

  assert.equal(handoff.ready, false);
  assert.equal(handoff.journey, "without_historical_documents");
  assert.equal(handoff.caseData.answers.historicalDocumentsAvailable, "no");
  assert.equal(handoff.caseData.answers.authorizationAnswer, "confirmed");
  assert.equal(handoff.caseData.answers.declaredEstimate, undefined);
  assert.deepEqual(handoff.caseData.candidates, []);
  assert.equal(handoff.suggestion.values.doubleRefundAmount, "");
  assert.equal(handoff.suggestion.values.caseValue, "");
  assert.match(handoff.reason, /Anexe ao menos uma fatura ou extrato/);
});

test("guided results continue through recovery without redirecting to chat", () => {
  assert.match(chargeAnalysisJs, /data-charge-action="start-recovery"/);
  assert.match(chargeAnalysisJs, /Prosseguir para recupera&ccedil;&atilde;o/);
  assert.match(chargeAnalysisJs, /Agora você pode preparar a documentação para avaliar o Juizado Especial Cível/);
  assert.doesNotMatch(chargeAnalysisJs, /Comece pelos canais administrativos/);
  assert.doesNotMatch(chargeAnalysisJs, /Consumidor\.gov\.br ou no Procon/);
  assert.match(chargeAnalysisJs, /function renderRecoveryIntro\(\)/);
  assert.match(chargeAnalysisJs, /function renderRecoveryReport\(\)/);
  assert.match(chargeAnalysisJs, /function renderRecoveryTestimony\(\)/);
  assert.match(chargeAnalysisJs, /function renderRecoveryGuide\(\)/);
  assert.match(chargeAnalysisJs, /\/api\/jec\/testimony\/refine/);
  assert.match(chargeAnalysisJs, /\/api\/jec\/petitions\/prepare/);
  assert.match(chargeAnalysisJs, /\/api\/jec\/petitions\/pdf/);
  assert.match(chargeAnalysisJs, /id="chargeRecoveryGuideUf"/);
  assert.doesNotMatch(chargeAnalysisJs, /audita:open-jec/);
  assert.doesNotMatch(appJs, /function openGuidedChargeJec\(event\)/);
  assert.doesNotMatch(appJs, /window\.history\.pushState\(\{\}, "", "\/chat"\)/);
});

test("app hides the one-page shell until the initial route is ready", () => {
  assert.match(indexHtml, /<html lang="pt-BR" class="app-booting">/);
  assert.match(indexHtml, /class="app-boot" id="appBoot" role="status"/);
  assert.match(indexHtml, /Preparando seu ambiente/);
  assert.match(stylesCss, /html\.app-booting \.shell,[\s\S]*?visibility:\s*hidden/);
  assert.match(stylesCss, /html:not\(\.app-booting\) \.app-boot/);
  assert.match(appJs, /function finishAppBoot\(\)/);
  assert.ok(
    appJs.lastIndexOf("setActivePage(getActivePage());") <
      appJs.lastIndexOf("await loadStateCourtCatalog();"),
  );
  assert.ok(
    appJs.lastIndexOf("finishAppBoot();") >
      appJs.lastIndexOf("const authState = await loadAuthState();"),
  );
  assert.match(indexHtml, /styles\.css\?v=20260818-app-boot-1/);
  assert.match(indexHtml, /app\.js\?v=20260818-app-boot-1/);
});

test("recovery collects testimony in up to three AI questions before user review and PDF", () => {
  assert.match(chargeAnalysisJs, /Continuar para o depoimento/);
  assert.match(chargeAnalysisJs, /id="chargeRecoveryTestimonyForm"/);
  assert.match(chargeAnalysisJs, /name="testimonyAnswer" required minlength="2" maxlength="2000"/);
  assert.match(chargeAnalysisJs, /Pergunta \$\{questionNumber\} de até 3/);
  assert.match(chargeAnalysisJs, /function continueRecoveryTestimony\(form\)/);
  assert.match(chargeAnalysisJs, /body: JSON\.stringify\(\{ turns \}\)/);
  assert.match(chargeAnalysisJs, /name="refinedTestimony" required minlength="40" maxlength="5000"/);
  assert.match(chargeAnalysisJs, /name="testimonyReviewed"/);
  assert.match(chargeAnalysisJs, /testimonyReviewed: true/);
  assert.match(chargeAnalysisJs, /consumerTestimony/);
  assert.doesNotMatch(chargeAnalysisJs, /data-recovery-submit="pdf"/);
  assert.match(stylesCss, /\.charge-testimony-field textarea/);
  assert.match(stylesCss, /\.charge-testimony-dialogue/);
  assert.match(stylesCss, /\.charge-testimony-confirmation/);
  assert.match(appJs, /name="originalTestimony" required minlength="40" maxlength="5000"/);
  assert.match(appJs, /data-jec-action="testimony"/);
  assert.match(appJs, /\/api\/jec\/testimony\/refine/);
  assert.match(appJs, /testimonyReviewed: true/);
  assert.match(stylesCss, /\.jec-testimony-section textarea/);
});

test("recovery report reuses calculated values without asking for another review", () => {
  assert.doesNotMatch(chargeAnalysisJs, /Valores para revisão/);
  assert.doesNotMatch(chargeAnalysisJs, /Restituição em dobro \(R\$\)<\/span><input/);
  assert.doesNotMatch(chargeAnalysisJs, /Valor da causa \(R\$\)<\/span><input/);
  assert.match(chargeAnalysisJs, /const calculatedValues = state\.recovery\.handoff\?\.suggestion\?\.values \|\| \{\}/);
  assert.match(chargeAnalysisJs, /type="hidden" name="doubleRefundAmount"/);
  assert.match(chargeAnalysisJs, /type="hidden" name="caseValue"/);
  assert.match(chargeAnalysisJs, /name="bankAgency"/);
  assert.match(appJs, /name="bankAgency"/);
  assert.match(chargeAnalysisJs, /bankAgency: normalizeRecoveryText/);
  assert.match(appJs, /bankAgency: normalizeJecText/);
  assert.doesNotMatch(chargeAnalysisJs, /name="reviewConfirmed"/);
  assert.doesNotMatch(chargeAnalysisJs, /event\.target\.elements\.reviewConfirmed/);
  assert.match(chargeAnalysisJs, /Os valores calculados na análise serão incluídos automaticamente/);
});

test("tribunal guide explains small claims and redirects cases above 20 minimum wages", () => {
  assert.match(chargeAnalysisJs, /O que são pequenas causas\?/);
  assert.match(chargeAnalysisJs, /Entenda advogado, custos e recursos/);
  assert.match(chargeAnalysisJs, /não existe garantia de “risco zero”/);
  assert.match(chargeAnalysisJs, /Lei 9\.099\/1995/);
  assert.match(chargeAnalysisJs, /Falar com o time IA AUDITA · em breve/);
  assert.match(chargeAnalysisJs, /eligibility\?\.status === "above_limit"/);
  assert.match(chargeAnalysisJs, />Abrir portal oficial<\/a>/);
  assert.match(appJs, /Pequenas causas/);
  assert.match(appJs, /Contato em breve/);
  assert.match(appJs, /smallClaimsAboveLimit/);
});
