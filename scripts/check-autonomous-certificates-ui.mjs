// Local UI check with synthetic API responses; never sends a paid query or changes accounts.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { getAutonomousCertificateCoverage } from "../services/state-court-autonomous.service.mjs";
const base = process.env.AUDITA_BASE_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const coverage = getAutonomousCertificateCoverage({ configured: true, allowedUfs: ["AP"], pdfTotalCostBrl: 0.54 });
coverage.sellerSources = { configured: true, queries: [
  { id: "fixture_tax", label: "Certidão fiscal de teste", category: "Fiscal", scope: "Nacional", costBrl: 0.54, kind: "certificate", documentTypes: ["cpf"], limitation: "Não inclui dívida ativa neste teste." },
  { id: "fixture_data", label: "Consulta de dados de teste", category: "Dados complementares", scope: "Nacional", costBrl: 0.36, kind: "data", documentTypes: ["cpf"] },
  { id: "fixture_ccd", label: "CND conjunta federal de teste", category: "Fiscal", scope: "Nacional", endpoint: "CertidaoConjuntaDebitosPessoaFisica", costBrl: 0.54, kind: "certificate", documentTypes: ["cpf"] },
  { id: "fixture_company", label: "Certidão empresarial de teste", category: "Empresas", scope: "Brasil", costBrl: 0.54, kind: "certificate", documentTypes: ["cnpj"] },
  ...Array.from({ length: 86 }, (_, index) => ({ id: `fixture_extra_${index}`, label: `Consulta adicional de teste ${index + 1}`, category: `Grupo de teste ${index % 6 + 1}`, scope: "Nacional", costBrl: 0.54, kind: "certificate", documentTypes: ["cpf"] })),
] };
const browser = await chromium.launch({ headless: true });
await mkdir("output/autonomous-ui", { recursive: true });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    let posted;
    let polls = 0;
    let nationalOnly = false;
    let companyOnly = false;
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.startsWith("/api/") && !url.pathname.startsWith("/audit/")) {
        if (process.env.AUDITA_UI_CHECK_LOCAL_FILES === "true" && (url.pathname === "/" || /^\/(?:[\w-]+\.(?:js|css)|assets\/[^.][\w/.-]+)$/.test(url.pathname))) {
          return route.fulfill({ path: fileURLToPath(new URL(`..${url.pathname === "/" ? "/index.html" : url.pathname}`, import.meta.url)) });
        }
        return route.continue();
      }
      let body = {};
      if (url.pathname === "/api/auth/me") body = { authRequired: true, user: { id: "fixture", name: "Pessoa Teste", email: "test@example.com", role: "owner" } };
      if (url.pathname === "/api/seller-analysis/coverage") body = coverage;
      if (url.pathname === "/api/seller-analysis") {
        posted = route.request().postDataJSON();
        polls = 0;
        body = { consultaId: "12345678-1234-1234-1234-123456789012" };
      }
      if (url.pathname.startsWith("/audit/")) {
        polls += 1;
        const pending = !nationalOnly && polls === 1;
        body = { consultaId: "12345678-1234-1234-1234-123456789012", status: pending ? "partial" : "success", documento: "529********25", resultados: [
          ...(!nationalOnly ? [{ fonte: "tjdft", status: "success", dados: { progress: { stage: "completed", total: 2, completed: 2 }, certidoes: [{ uf: "AP", tipo: "AP · Cível", pdfPath: "synthetic.pdf", status: "success", resultado: "nada_consta" }, { uf: "AP", tipo: "AP · Criminal", status: "failed", resultado: "indisponivel", errorMessage: "provider_timeout" }] } }] : []),
          ...(!companyOnly ? [{ fonte: "seller_sources", status: pending ? "running" : "success", dados: { certidoes: [
            ...(!nationalOnly ? [{ tipo: "Certidão fiscal de teste", kind: "certificate", status: pending ? "pending" : "success", ...(pending ? {} : { pdfPath: "synthetic-national.pdf" }) }] : []),
            { tipo: "Consulta de dados de teste", kind: "data", status: "success", summary: "Dados consultados", scope: "Nacional", details: { Situação: "Disponível" } },
          ] } }] : []),
          ...(!nationalOnly || companyOnly ? [{ fonte: "company_cnpj", status: "success", dados: { certidoes: [{ tipo: "Cadastro e QSA", kind: "data", status: "success", details: { Razão: "Empresa Fictícia" } }] } }] : []),
        ] };
      }
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto(`${base}/#analise-vendedor`);
    await page.locator("#sellerAnalysisUfs input").first().waitFor();
    assert.equal(await page.locator("#sellerAnalysisUfs input:checked, #sellerAnalysisQueries input:checked").count(), 0);
    assert.equal(await page.locator("#sellerAnalysisQueries input").count(), 90);
    assert.equal(await page.locator("#sellerAnalysisQueries details[open]").count(), 0);
    assert.equal(await page.locator("#sellerAnalysisBirthDate").evaluate((input) => input.required), false);
    assert.ok((await page.locator("#sellerAnalysisQueries").boundingBox()).height < 500, "90 queries must fit in collapsed groups");
    await page.screenshot({ path: `output/autonomous-ui/${width}-collapsed.png`, fullPage: true });
    await page.locator("#sellerAnalysisSelectAll").click();
    assert.equal(await page.locator("#sellerAnalysisQueries input:checked").count(), 90);
    assert.equal(await page.locator("#sellerAnalysisQueries details[open]").count(), 0, "selecting all must preserve collapsed groups");
    assert.equal(await page.locator("#sellerAnalysisBirthDate").evaluate((input) => input.required), true);
    await page.locator("#sellerAnalysisClearAll").click();
    assert.equal(await page.locator("#sellerAnalysisQueries input:checked").count(), 0);
    await page.getByText("Fiscal (2)", { exact: true }).click();
    await page.getByText("Dados complementares (1)", { exact: true }).click();
    assert.equal(await page.getByText("Não inclui dívida ativa neste teste.", { exact: true }).isVisible(), true);
    for (const input of await page.locator("#sellerAnalysisUfs input").all()) await input.setChecked((await input.getAttribute("value")) === "AP");
    await page.locator('#sellerAnalysisQueries input[value="fixture_tax"]').check();
    await page.locator('#sellerAnalysisQueries input[value="fixture_data"]').check();
    await page.locator("#sellerAnalysisCompanyCnpjs").fill("04.252.011/0001-10");
    assert.match(await page.locator("#sellerAnalysisCost").innerText(), /1,98/);
    await page.locator("#sellerAnalysisCpf").fill("52998224725");
    await page.locator("#sellerAnalysisFullName").fill("Pessoa Teste");
    await page.locator("#sellerAnalysisMotherName").fill("Mae Teste");
    await page.locator("#sellerAnalysisBirthDate").fill("1990-01-01");
    await page.locator("#sellerAnalysisRg").fill("12345678");
    await page.locator("#sellerAnalysisGender").selectOption("Masculino");
    await page.locator("#sellerAnalysisAuthorization").check();
    await page.locator("#sellerAnalysisSubmit").click();
    assert.equal(posted, undefined, "paid consent must be required");
    await page.locator("#sellerAnalysisPaid").check();
    await page.locator("#sellerAnalysisSubmit").click();
    await page.getByText("Concluído parcialmente", { exact: true }).waitFor();
    assert.ok(polls >= 2, "a completed state source must not interrupt another pending source");
    assert.deepEqual(posted.ufs, ["AP"]);
    assert.deepEqual(posted.sellerQueries, ["fixture_tax", "fixture_data"]);
    assert.deepEqual(posted.companyCnpjs, ["04252011000110"]);
    assert.equal(posted.paidQueryConfirmed, true);
    assert.equal(await page.locator("#sellerAnalysisResult a").count(), 2);
    assert.match(await page.locator("#sellerAnalysisResult a").last().getAttribute("href"), /\/documents\/seller_sources\/0$/);
    assert.match(await page.locator("#sellerAnalysisResult").innerText(), /4\/5 resultados · 2 PDFs/);
    assert.equal(await page.getByText("Consulta disponível", { exact: true }).count(), 2);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `output/autonomous-ui/${width}.png`, fullPage: true });
    nationalOnly = true;
    await page.locator("#sellerAnalysisClearAll").click();
    await page.locator("#sellerAnalysisCompanyCnpjs").fill("");
    await page.locator("#sellerAnalysisMotherName").fill("");
    await page.locator("#sellerAnalysisBirthDate").fill("");
    await page.locator("#sellerAnalysisRg").fill("");
    await page.locator("#sellerAnalysisGender").selectOption("");
    await page.locator('#sellerAnalysisQueries input[value="fixture_ccd"]').check();
    assert.equal(await page.locator("#sellerAnalysisBirthDate").evaluate((input) => input.required), true);
    posted = undefined;
    await page.locator("#sellerAnalysisSubmit").click();
    assert.equal(posted, undefined, "CND conjunta must require birth date");
    await page.locator('#sellerAnalysisQueries input[value="fixture_ccd"]').uncheck();
    await page.locator('#sellerAnalysisQueries input[value="fixture_data"]').check();
    assert.equal(await page.locator("#sellerAnalysisBirthDate").evaluate((input) => input.required), false);
    await page.locator("#sellerAnalysisSubmit").click();
    await page.getByText("Concluído", { exact: true }).waitFor();
    assert.deepEqual(posted.ufs, []);
    assert.deepEqual(posted.sellerQueries, ["fixture_data"]);
    assert.deepEqual(posted.companyCnpjs, []);
    assert.equal(posted.birthDate, "");
    assert.equal(posted.rg, "");
    assert.match(await page.locator("#sellerAnalysisResult").innerText(), /1\/1 resultados · 0 PDFs/);
    assert.equal(await page.locator("#sellerAnalysisResult a").count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    companyOnly = true;
    await page.locator("#sellerAnalysisClearAll").click();
    await page.locator("#sellerAnalysisCompanyCnpjs").fill("04.252.011/0001-10");
    assert.equal(await page.locator("#sellerAnalysisBirthDate").evaluate((input) => input.required), false);
    await page.locator("#sellerAnalysisSubmit").click();
    await page.getByText("Cadastro e QSA", { exact: true }).waitFor();
    assert.deepEqual(posted.ufs, []);
    assert.deepEqual(posted.sellerQueries, []);
    assert.deepEqual(posted.companyCnpjs, ["04252011000110"]);
    assert.equal(posted.birthDate, "");
    assert.deepEqual(errors, []);
    await page.getByText("Empresas (1)", { exact: true }).click();
    await page.locator('#sellerAnalysisQueries input[value="fixture_company"]').check();
    await page.locator("#sellerAnalysisCompanyCnpjs").fill("");
    posted = undefined;
    await page.locator("#sellerAnalysisSubmit").click();
    assert.equal(posted, undefined);
    assert.match(await page.locator("#sellerAnalysisError").innerText(), /Informe os CNPJs/);
    await page.locator("#sellerAnalysisCompanyCnpjs").fill("04.252.011/0001-10, 11.444.777/0001-61");
    assert.match(await page.locator("#sellerAnalysisCost").innerText(), /1,08/);
    await page.locator("#sellerAnalysisSubmit").click();
    await page.getByText("Cadastro e QSA", { exact: true }).waitFor();
    assert.deepEqual(posted.sellerQueries, ["fixture_company"]);
    assert.equal(posted.companyCnpjs.length, 2);
    await context.close();
  }
  console.log("Seller UI passed: desktop/mobile, 90 collapsed queries, limitations, select all, conditional birth date, costs, CNPJ-only and national queries, private PDF links and multi-source polling.");
} finally { await browser.close(); }
