import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildChargeAuditSnapshot,
  buildChargeEstimate,
  buildChargeJecHandoff,
  CHARGE_ANALYSIS_BRANDS,
} from "../charge-analysis.js";

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const stylesCss = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
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

test("charge analysis exposes a guided flow without an open chat input", () => {
  const moduleMarkup = indexHtml.match(
    /<section class="charge-analysis-page"[\s\S]*?<\/section>/,
  )?.[0];

  assert.ok(moduleMarkup);
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
  assert.match(indexHtml, /Etapa 1 de 7/);
  assert.match(chargeAnalysisJs, /state\.recovery\.phase === "guide"[\s\S]*?"tribunal"/);
  assert.doesNotMatch(chargeAnalysisJs, /charge-recovery-progress/);
  assert.match(stylesCss, /\.charge-module-progress\s*\{/);
});

test("charge analysis reveals agent messages before moving to the selected path", () => {
  assert.match(chargeAnalysisJs, /revealTriageMessages/);
  assert.match(chargeAnalysisJs, /Audita est&aacute; digitando/);
  assert.match(chargeAnalysisJs, /continueFromTriage/);
  assert.match(chargeAnalysisJs, /prefers-reduced-motion: reduce/);
  assert.match(chargeAnalysisJs, /function typingDelayFor\(message\)/);
  assert.match(chargeAnalysisJs, /Math\.min\(1700, Math\.max\(900, visibleLength \* 4\)\)/);
});

test("charge analysis starts by asking about express authorization", () => {
  assert.match(
    chargeAnalysisJs,
    /Voc&ecirc; contratou ou autorizou expressamente a cobran&ccedil;a de algum seguro ou servi&ccedil;o/,
  );
  assert.match(chargeAnalysisJs, /data-charge-action="not-authorized"/);
  assert.match(chargeAnalysisJs, /data-charge-action="authorized"/);
  assert.match(chargeAnalysisJs, /data-charge-action="verify-statement"/);
  assert.match(chargeAnalysisJs, /N&atilde;o tenho certeza \/ Quero verificar o extrato/);
  assert.match(chargeAnalysisJs, /Seguro Perda e Roubo \/ Cart&atilde;o Protegido/);
  assert.match(chargeAnalysisJs, /Seguro Prestamista/);
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

test("charge analysis separates complete, partial and no-statement journeys", () => {
  assert.match(chargeAnalysisJs, /documents-complete/);
  assert.match(chargeAnalysisJs, /documents-partial/);
  assert.match(chargeAnalysisJs, /documents-none/);
  assert.match(chargeAnalysisJs, /Tenho todos ou a maior parte/);
  assert.match(chargeAnalysisJs, /Tenho apenas alguns ou um print recente/);
  assert.match(chargeAnalysisJs, /Não tenho nenhum extrato/);
  assert.match(chargeAnalysisJs, /multiple/);
  assert.match(chargeAnalysisJs, /aggregateChargeCases/);
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

test("declaratory simulation keeps estimated values separate from documentary totals", () => {
  assert.deepEqual(
    buildChargeEstimate({
      monthlyAmount: 19,
      durationValue: 15,
      durationUnit: "years",
    }),
    {
      monthlyAmount: 19,
      durationValue: 15,
      durationUnit: "years",
      months: 180,
      estimatedPaid: 3420,
      hypotheticalDouble: 6840,
    },
  );
  assert.match(chargeAnalysisJs, /valores como declarados e estimados/);
  assert.match(chargeAnalysisJs, /não comprovados por extratos/);
  assert.match(chargeAnalysisJs, /A definir na revisão/);
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

test("guided no-statement journey hands a declared estimate to JEC model 2", () => {
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

  assert.equal(handoff.ready, true);
  assert.equal(handoff.journey, "without_historical_documents");
  assert.equal(handoff.caseData.answers.historicalDocumentsAvailable, "no");
  assert.equal(handoff.caseData.answers.authorizationAnswer, "confirmed");
  assert.equal(handoff.caseData.answers.declaredEstimate.estimatedPaid, 3420);
  assert.equal(handoff.caseData.candidates[0].answer, "not_recognized");
  assert.equal(handoff.caseData.candidates[0].amount, null);
  assert.equal(handoff.suggestion.values.doubleRefundAmount, "6.840,00");
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
  assert.match(chargeAnalysisJs, /Os valores calculados na análise serão incluídos automaticamente/);
});
