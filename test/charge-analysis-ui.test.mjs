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

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const plansHtml = readFileSync(new URL("../plans.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const stylesCss = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
const chargeAnalysisJs = readFileSync(
  new URL("../charge-analysis.js", import.meta.url),
  "utf8",
);

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

test("every Audita surface uses the official logo asset", () => {
  const surfaces = [indexHtml, plansHtml, appJs, chargeAnalysisJs];
  for (const surface of surfaces) {
    assert.doesNotMatch(surface, /audita-logo-white\.svg/);
  }
  assert.match(indexHtml, /assets\/audita-logo-original\.png/);
  assert.match(plansHtml, /assets\/audita-logo-original\.png/);
  assert.match(appJs, /assets\/audita-logo-original\.png/);
  assert.match(chargeAnalysisJs, /assets\/audita-logo-original\.png/);
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

test("charge analysis uses one module-wide progress rail from authorization to tribunal", () => {
  const progressMarkup = indexHtml.match(
    /<ol class="charge-analysis-progress charge-module-progress"[\s\S]*?<\/ol>/,
  )?.[0];

  assert.ok(progressMarkup);
  assert.match(progressMarkup, /data-charge-progress="authorization"/);
  assert.match(progressMarkup, /data-charge-progress="statements"/);
  assert.match(progressMarkup, /data-charge-progress="analysis"/);
  assert.match(progressMarkup, /data-charge-progress="result"/);
  assert.match(progressMarkup, /data-charge-progress="recovery"/);
  assert.match(progressMarkup, /data-charge-progress="report"/);
  assert.match(progressMarkup, /data-charge-progress="tribunal"/);
  assert.match(indexHtml, /id="chargeAnalysisProgressPercent">0%/);
  assert.match(indexHtml, /id="chargeAnalysisProgressMeter" max="100" value="0"/);
  assert.match(indexHtml, /O processo s&oacute; chega a 100% ap&oacute;s o protocolo humano/);
  assert.ok(
    indexHtml.indexOf('class="charge-progress-summary"') <
      indexHtml.indexOf('id="chargeAnalysisProgress"'),
  );
  assert.match(chargeAnalysisJs, /buildChargeProgressSnapshot\(state\)/);
  assert.doesNotMatch(chargeAnalysisJs, /charge-recovery-progress/);
  assert.match(stylesCss, /\.charge-module-progress\s*\{/);
  assert.match(stylesCss, /\.charge-progress-summary\s*\{/);
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
  assert.match(chargeAnalysisJs, /Audita est&aacute; digitando/);
  assert.match(chargeAnalysisJs, /continueFromTriage/);
  assert.match(chargeAnalysisJs, /prefers-reduced-motion: reduce/);
  assert.match(chargeAnalysisJs, /function typingDelayFor\(message\)/);
  assert.match(chargeAnalysisJs, /Math\.min\(1700, Math\.max\(900, visibleLength \* 4\)\)/);
});

test("charge analysis starts with the four supported self-assessment paths", () => {
  assert.match(
    chargeAnalysisJs,
    /Qual destas op&ccedil;&otilde;es descreve melhor a sua situa&ccedil;&atilde;o/,
  );
  assert.match(chargeAnalysisJs, /data-charge-action="not-authorized"/);
  assert.match(chargeAnalysisJs, /data-charge-action="authorized"/);
  assert.match(chargeAnalysisJs, /data-charge-action="verify-statement"/);
  assert.match(chargeAnalysisJs, /Acredito que tenho alguma cobran&ccedil;a indevida no meu cart&atilde;o ou conta Ita&uacute;/);
  assert.match(chargeAnalysisJs, /Acredito que n&atilde;o tenho nenhuma cobran&ccedil;a indevida/);
  assert.match(chargeAnalysisJs, /N&atilde;o sei, gostaria de mais informa&ccedil;&otilde;es/);
  assert.match(chargeAnalysisJs, /<strong>Sou advogado\(a\)<\/strong>/);
  assert.match(chargeAnalysisJs, /Seguro Perda e Roubo \/ Cart&atilde;o Protegido/);
  assert.match(chargeAnalysisJs, /Seguro Prestamista/);
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

test("charge analysis context exposes the explanatory memorandum and video", () => {
  assert.match(chargeAnalysisJs, /Memorando explicativo e v&iacute;deo/);
  assert.match(chargeAnalysisJs, /17\/12\/2025/);
  assert.match(chargeAnalysisJs, /5085307-63\.2016\.8\.13\.0024/);
  assert.match(chargeAnalysisJs, /youtube-nocookie\.com\/embed\/rzxDS0cbdlc/);
  assert.match(chargeAnalysisJs, /youtube\.com\/shorts\/rzxDS0cbdlc/);
});

test("charge analysis keeps optional context collapsed by default", () => {
  assert.match(chargeAnalysisJs, /<details class="charge-analysis-disclosure charge-analysis-transaction">/);
  assert.match(chargeAnalysisJs, /<details class="charge-analysis-disclosure charge-analysis-context">/);
  assert.match(chargeAnalysisJs, /<details class="charge-analysis-disclosure charge-analysis-insurance-details">/);
  assert.doesNotMatch(chargeAnalysisJs, /<details class="[^"]*charge-analysis-(?:transaction|context|insurance-details)[^"]*" open>/);
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
  assert.match(chargeAnalysisJs, /A Audita não consegue substituir documentos por estimativas/);
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

test("review and documentary calculation are separate sequential stages", () => {
  assert.match(chargeAnalysisJs, /state\.screen = "review"/);
  assert.match(chargeAnalysisJs, /function renderReview\(\)/);
  assert.match(chargeAnalysisJs, /data-charge-action="confirm-review"/);
  assert.match(chargeAnalysisJs, /Confirmar revisão e calcular/);
  assert.match(chargeAnalysisJs, /Somente ocorrências encontradas nos anexos/);
  assert.doesNotMatch(chargeAnalysisJs, /id="chargeEstimateForm"/);
  assert.doesNotMatch(chargeAnalysisJs, /Complemento estimado aos documentos parciais/);
});

test("positive analysis is paywalled before descriptions, values and simulation", () => {
  assert.match(chargeAnalysisJs, /state\.screen = lockedPositiveResult \? "paywall" : "review"/);
  assert.match(chargeAnalysisJs, /Sim, encontramos cobranças que podem ser indevidas nos seus extratos/);
  assert.match(chargeAnalysisJs, /Os detalhes, valores e a simulação permanecem protegidos/);
  assert.match(chargeAnalysisJs, /Standard mensal/);
  assert.match(chargeAnalysisJs, /Standard anual/);
  assert.match(chargeAnalysisJs, /O que você libera agora/);
  assert.match(chargeAnalysisJs, /Achados detalhados/);
  assert.match(chargeAnalysisJs, /Revisão sob seu controle/);
  assert.match(chargeAnalysisJs, /Cálculo rastreável/);
  assert.match(chargeAnalysisJs, /Documentação organizada/);
  assert.match(chargeAnalysisJs, /Acesso imediato aos achados da análise/);
  assert.match(chargeAnalysisJs, /Melhor custo-benefício/);
  assert.match(chargeAnalysisJs, /Suporte de advogado parceiro para o caso Itaú incluído/);
  assert.match(chargeAnalysisJs, /Ambiente demonstrativo: nenhum valor será cobrado/);
  assert.match(chargeAnalysisJs, /\/api\/billing\/demo-subscription/);
  assert.match(chargeAnalysisJs, /unlockAnalyzedCases/);
});

test("calculation uses only confirmed non-recognized documentary occurrences", () => {
  assert.deepEqual(
    buildChargeCalculationSnapshot({
      candidates: [
        { id: "auto", amount: 39.9, answer: "not_recognized", origin: "auto_detected", sourceFileName: "julho.pdf" },
        { id: "directed", amount: 34.9, answer: "not_recognized", origin: "directed_search", sourceFileName: "agosto.pdf" },
        { id: "known", amount: 12, answer: "recognized", sourceFileName: "julho.pdf" },
        { id: "pending", amount: 10, answer: "pending", sourceFileName: "agosto.pdf" },
      ],
    }),
    {
      items: [
        { id: "auto", amount: 39.9, answer: "not_recognized", origin: "auto_detected", sourceFileName: "julho.pdf" },
        { id: "directed", amount: 34.9, answer: "not_recognized", origin: "directed_search", sourceFileName: "agosto.pdf" },
      ],
      itemCount: 2,
      principal: 74.8,
      hypotheticalDouble: 149.6,
      excludedWithoutAmount: 0,
    },
  );
});

test("false negatives can only be recovered by searching existing attachments", () => {
  assert.match(chargeAnalysisJs, /Indicar uma cobrança para procurar nos meus anexos/);
  assert.match(chargeAnalysisJs, /\/api\/itau-refund\/cases\/search/);
  assert.match(chargeAnalysisJs, /não localizada nos documentos enviados/);
  assert.match(chargeAnalysisJs, /caseIds: state\.caseBatches\.map/);
  assert.doesNotMatch(chargeAnalysisJs, /Adicionar cobrança que não apareceu/);
  assert.doesNotMatch(chargeAnalysisJs, /name="(?:amount|date)"/);
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
  assert.match(chargeAnalysisJs, /function renderRecoveryGuide\(\)/);
  assert.match(chargeAnalysisJs, /\/api\/jec\/petitions\/prepare/);
  assert.match(chargeAnalysisJs, /\/api\/jec\/petitions\/pdf/);
  assert.match(chargeAnalysisJs, /id="chargeRecoveryGuideUf"/);
  assert.doesNotMatch(chargeAnalysisJs, /audita:open-jec/);
  assert.doesNotMatch(appJs, /function openGuidedChargeJec\(event\)/);
  assert.doesNotMatch(appJs, /window\.history\.pushState\(\{\}, "", "\/chat"\)/);
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
  assert.match(chargeAnalysisJs, /Falar com o time Audita · em breve/);
  assert.match(chargeAnalysisJs, /eligibility\?\.status === "above_limit"/);
  assert.match(chargeAnalysisJs, />Abrir portal oficial<\/a>/);
  assert.match(appJs, /Pequenas causas/);
  assert.match(appJs, /Contato em breve/);
  assert.match(appJs, /smallClaimsAboveLimit/);
});
