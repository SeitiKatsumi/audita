import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildChargeAuditSnapshot,
  buildChargeEstimate,
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

test("charge analysis reveals agent messages before moving to the selected path", () => {
  assert.match(chargeAnalysisJs, /revealTriageMessages/);
  assert.match(chargeAnalysisJs, /Audita est&aacute; digitando/);
  assert.match(chargeAnalysisJs, /continueFromTriage/);
  assert.match(chargeAnalysisJs, /prefers-reduced-motion: reduce/);
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
