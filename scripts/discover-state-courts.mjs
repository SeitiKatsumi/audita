import { listStateCourtProfiles } from "../services/state-courts.service.mjs";

const timeoutMs = Number(process.env.STATE_COURT_DISCOVERY_TIMEOUT_MS || 15000);

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Playwright is not installed. Run npm install first.");
  process.exit(1);
}

const browser = await chromium.launch({ headless: process.env.STATE_COURT_HEADLESS !== "false" });
const context = await browser.newContext({ userAgent: "Audita/0.1 state-court-discovery" });
const report = [];

for (const profile of listStateCourtProfiles()) {
  const page = await context.newPage();
  try {
    page.setDefaultTimeout(timeoutMs);
    await page.goto(profile.url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    const title = await page.title().catch(() => "");
    const bodyText = await page.locator("body").innerText().catch(() => "");
    report.push({
      uf: profile.uf,
      court: profile.court,
      platform: profile.platform,
      automationStatus: profile.automationStatus,
      loaded: true,
      title,
      captchaDetected: /captcha|recaptcha|caracteres exibidos|codigo de seguranca|c[oó]digo de seguran[çc]a/i.test(bodyText),
      loginDetected: /login|entrar|senha|certificado digital/i.test(bodyText),
      certificateTextDetected: /certid[aã]o|certidoes|certidões|nada consta|negativa/i.test(bodyText),
    });
  } catch (error) {
    report.push({
      uf: profile.uf,
      court: profile.court,
      platform: profile.platform,
      automationStatus: profile.automationStatus,
      loaded: false,
      errorMessage: error.message,
    });
  } finally {
    await page.close().catch(() => {});
  }
}

await context.close().catch(() => {});
await browser.close().catch(() => {});

console.log(JSON.stringify({ checkedAt: new Date().toISOString(), total: report.length, report }, null, 2));
