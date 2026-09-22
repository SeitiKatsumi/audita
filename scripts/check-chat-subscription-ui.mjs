// Self-contained browser fixture. Every request is mocked; no server or charge is used.
import assert from "node:assert/strict";
import { readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { runInNewContext } from "node:vm";

const root = new URL("../", import.meta.url);
const js = await readFile(new URL("chat-subscription.js", root), "utf8");
const css = await readFile(new URL("chat-subscription.css", root), "utf8");
const index = await readFile(new URL("index.html", root), "utf8");
const app = await readFile(new URL("app.js", root), "utf8");
const sendSource = app.slice(app.indexOf("async function sendChatMessage("), app.indexOf("chatForm?.addEventListener(\"submit\""));
const storageSource = app.slice(app.indexOf("function chatStorageKey()"), app.indexOf("let chatSending"));
let sequence = 0;
const first = { id: "first", title: "Nova conversa", messages: [] };
const second = { id: "second", title: "Nova conversa", messages: [] };
let currentThread = first, sends = 0, release;
const harness = {
  currentAuthState: { user: { id: "same-user", tenant: { id: "tenant-a" } } },
  chatState: { threads: [first, second] }, chatSending: false, chatSendingThreadId: "", chatPendingAttachment: null,
  chatInput: { value: "rascunho", focus() {} }, chatSendButton: {}, chatAttachment: {},
  activeChatBrowserSession: null, document: { querySelector: () => null },
  chatSubscription: { ensureAccess: async () => true, refresh() {}, handleAccessError: () => false, open() {},
    analyzeDocument: () => new Promise(resolve => { release = resolve; }) },
  getCurrentChatThread: () => currentThread, createChatId: () => `message-${++sequence}`,
  getLatestItauCase: () => ({ id: "itau-existing" }), findItauCaseMessage: () => null,
  activateJecIntake() {}, renderChatWorkspace() {}, renderPendingChatAttachment() {},
  resizeChatInput() {}, setChatError() {}, saveChatState() {}, showLogin() {},
  fetch: async (url, options) => { sends++; harness.payload = JSON.parse(options.body); return { ok: true, status: 200, json: async () => ({ answer: "resposta" }) }; },
};
runInNewContext(storageSource + sendSource + "\nthis.send = sendChatMessage; this.storageKey = chatStorageKey;", harness);
const initialKey = harness.storageKey();
harness.currentAuthState.user.tenant.id = "tenant-b";
assert.notEqual(harness.storageKey(), initialKey);
harness.currentAuthState.user.tenant.id = "tenant-a";
first.messages = Array.from({ length: 30 }, (_, i) => ({ id: `old-${i}`, role: i % 2 ? "assistant" : "user", content: "x".repeat(6000) }));
await harness.send("rascunho", null);
assert.ok(harness.payload.messages.length <= 24);
assert.ok(harness.payload.messages.every(item => item.content.length <= 5000));
assert.ok(harness.payload.messages.reduce((sum, item) => sum + item.content.length, 0) <= 32000);
assert.equal(harness.payload.messages.at(-1).role, "user");
assert.equal(harness.payload.caseContext.case.id, "itau-existing");
const upload = { name: "teste.pdf" };
harness.chatPendingAttachment = upload;
const analyzing = harness.send("", upload);
await Promise.resolve();
assert.equal(harness.chatSending, true);
await harness.send("duplicate", upload);
currentThread = second;
const newerUpload = { name: "novo.pdf" };
harness.chatPendingAttachment = newerUpload;
release({ id: "document-first", summary: "Resumo" });
await analyzing;
assert.equal(first.documentId, "document-first");
assert.equal(second.documentId, undefined);
assert.equal(harness.chatPendingAttachment, newerUpload);
assert.equal(sends, 1, "Document summary does not POST chat");
currentThread = first;
const obsolete = harness.send("", upload);
await Promise.resolve();
harness.currentAuthState.user.tenant.id = "tenant-b";
harness.chatState = { threads: [second] };
release({ id: "private-old-document", summary: "Do not inject" });
await obsolete;
assert.equal(second.documentId, undefined);
assert.equal(first.documentId, "document-first");
assert.ok(!first.messages.some(message => message.content === "Do not inject"));

currentThread = second;
harness.chatInput.value = "retry released";
const retriedIds = [];
harness.fetch = async (url, options) => {
  retriedIds.push(JSON.parse(options.body).requestId);
  return retriedIds.length === 1
    ? { ok: false, status: 503, json: async () => ({ error: "chat_unavailable", quotaReleased: true }) }
    : { ok: true, status: 200, json: async () => ({ answer: "Recovered" }) };
};
await harness.send("retry released", null);
assert.equal(harness.chatInput.value, "retry released");
assert.equal(second.messages.length, 0);
await harness.send("retry released", null);
assert.notEqual(retriedIds[0], retriedIds[1], "503 with quotaReleased requires a fresh request ID");
assert.equal(second.messages.filter(message => message.role === "user").length, 1);
const networkIds = [];
harness.chatInput.value = "retry unknown";
harness.fetch = async (url, options) => {
  networkIds.push(JSON.parse(options.body).requestId);
  if (networkIds.length === 1) throw new TypeError("Network lost after request");
  return { ok: true, status: 200, json: async () => ({ answer: "Recovered cached answer" }) };
};
await harness.send("retry unknown", null);
await harness.send("retry unknown", null);
assert.equal(networkIds[0], networkIds[1], "An unknown network outcome retains the request ID");

const records = new Map([["audita.chat.threads.v1", JSON.stringify({ threads: [{ id: "unowned", messages: [{ content: "private-global" }], documentId: "unowned-document" }] })]]);
let authListener;
const storageHarness = { ...harness,
  currentAuthState: { user: { id: "account-a", tenant: { id: "tenant-a" } } },
  localStorage: { getItem: key => records.get(key), setItem: (key, value) => records.set(key, value) },
  window: { addEventListener: (name, callback) => { authListener = callback; } },
  sendChatMessage: () => {},
  stopChatBrowserMonitor() {}, syncChatBrowserUi() {}, initializeChatEntryContext() {},
  assistedRemoteSessions: new Map(), stateCourtAgentSessions: new Map(), jecCaseStates: new Map(),
  activeChatBrowserAgentStatus: null, pendingJecFocusCaseId: "",
};
runInNewContext(storageSource + app.slice(app.indexOf("function createChatThread()"), app.indexOf("function initializeChatEntryContext()")) +
  app.slice(app.indexOf("function saveChatState()"), app.indexOf("function formatChatText(")) +
  "\nthis.inspect=()=>chatState; this.save=saveChatState; this.key=chatStorageKey;", storageHarness);
assert.notEqual(storageHarness.inspect().threads[0].id, "unowned", "Unidentified legacy history is never adopted");
storageHarness.inspect().threads[0].documentId = "owned-a";
storageHarness.save();
const keyA = storageHarness.key();
storageHarness.chatInput.value = "private draft";
storageHarness.chatPendingAttachment = upload;
storageHarness.currentAuthState = { user: { id: "account-b", tenant: { id: "tenant-a" } } };
authListener();
assert.equal(storageHarness.chatInput.value, "");
assert.equal(storageHarness.chatPendingAttachment, null);
assert.equal(storageHarness.inspect().threads[0].documentId, undefined);
storageHarness.save();
assert.notEqual(storageHarness.key(), keyA);
storageHarness.currentAuthState = { user: { id: "account-a", tenant: { id: "tenant-a" } } };
authListener();
assert.equal(storageHarness.inspect().threads[0].documentId, "owned-a");
storageHarness.currentAuthState = { user: { id: "account-a", tenant: { id: "tenant-b" } } };
authListener();
assert.equal(storageHarness.inspect().threads[0].documentId, undefined);
assert.ok(records.has("audita.chat.threads.v1"), "Old storage is ignored, not migrated or destroyed");
const form = index.match(/<form[^>]+id="chatForm"[\s\S]*?<\/form>/)?.[0];
assert.ok(form, "Use the repository's real chat form");
const output = await mkdtemp(join(tmpdir(), "audita-chat-subscription-"));
const browser = await chromium.launch({ headless: true });
const errors = [];
const posts = [];
let access = { active: false, planId: null, remaining: { messages: 0, pages: 0 }, periodEnd: null, legacy: false };
let accessFailure = false, catalogFailure = false, analyzeFailure = false, checkoutFailure = false, prepareQuotaFailure = false;
const chatPlans = [
  ["experiment", "Experimente", 990, 20, 5], ["essential", "Essencial", 4990, 100, 20],
  ["professional", "Profissional", 9990, 300, 80], ["premium", "Premium", 19990, 700, 200],
].map(([id, name, cents, messages, pages]) => ({ id: `chat-${id}`, name, kind: id === "experiment" ? "chat_experiment" : "chat_subscription",
  price: { currency: "BRL", cents }, messages, pages, days: 30, checkoutAvailable: true, recommended: id === "professional" }));
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.route("**/*", async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin !== "http://127.0.0.1:3199") return route.fulfill({ contentType: "text/html", body: "<h1>Mock checkout</h1>" });
  if (url.pathname === "/chat-subscription.js") return route.fulfill({ contentType: "text/javascript", body: js });
  if (url.pathname === "/chat-subscription.css") return route.fulfill({ contentType: "text/css", body: css });
  if (!url.pathname.startsWith("/api/")) return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/chat-subscription.css"><style>body{font-family:Arial,sans-serif;margin:16px}textarea{max-width:100%}.hidden{display:none}</style><body>${form}<script type="module">
    import {initChatSubscription} from '/chat-subscription.js';
    window.auth = {user:null}; window.loginCalls=0; window.sent=0; window.attached=0;
    window.chat = initChatSubscription({getAuthState:()=>window.auth,requestLogin:(message,resume)=>{window.loginCalls++;window.resume=resume}});
    document.querySelector('#chatForm').addEventListener('submit',event=>{event.preventDefault();window.sent++});
    document.querySelector('#chatAttachmentButton').addEventListener('click',()=>window.attached++);
    window.ready=true;
  </script></body></html>` });
  if (request.method() === "POST") posts.push({ path: url.pathname, body: request.postDataJSON() });
  let status = 200, body;
  switch (url.pathname) {
    case "/api/billing/plans": status = catalogFailure ? 503 : 200; body = { plans: [{ id: "standard" }], chatPlans }; break;
    case "/api/chat/access": status = accessFailure ? 503 : 200; body = { access }; break;
    case "/api/billing/subscription": body = { canManage: true, subscription: { provider: "stripe" } }; break;
    case "/api/billing/checkout": status = checkoutFailure ? 503 : 200; body = { url: "https://checkout.stripe.com/mock" }; break;
    case "/api/billing/portal": body = { url: "https://billing.stripe.com/mock" }; break;
    case "/api/chat/documents/prepare": status = prepareQuotaFailure ? 429 : 200; body = { document: { id: "fixture-doc", pages: 3 } }; break;
    case "/api/chat/documents/fixture-doc/analyze": status = analyzeFailure ? 503 : 200; body = { document: { id: "fixture-doc", pages: 3, text: "Documento ficticio" } }; break;
    default: throw new Error(`Unexpected API request: ${url.pathname}`);
  }
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
});
const page = await context.newPage();
page.on("pageerror", error => errors.push(error.message));
const modal = page.locator("#chatSubscriptionDialog");
const docModal = page.locator("#chatDocumentDialog");
const choose = id => page.locator(`[data-plan="chat-${id}"]`);
async function boot(search = "") {
  await page.goto(`http://127.0.0.1:3199/${search}`);
  await page.waitForFunction(() => window.ready);
  await page.evaluate(() => window.chat.refresh());
}
async function login(id = "user-a") {
  await page.evaluate(async id => { window.auth = { user: { id } }; await window.chat.onAuthChanged(); }, id);
}
async function active() {
  access = { active: true, planId: "chat-essential", remaining: { messages: 100, pages: 20 }, periodEnd: "2026-10-22T00:00:00Z", legacy: false };
  await login();
}
async function close() { if (await modal.evaluate(el => el.open)) await modal.locator("[data-close]").click(); }
async function prepare() {
  await page.evaluate(() => { window.docResult = "pending"; window.chat.prepareDocument(new File(["fake PDF"], "teste.pdf", { type: "application/pdf" })).then(value => window.docResult = value); });
  await docModal.waitFor({ state: "visible" });
}

try {
  await boot();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (let opening = 0; opening < 2; opening++) {
    await page.evaluate(() => window.chat.open());
    assert.equal(await modal.evaluate(el => getComputedStyle(el).animationName), "subscription-enter");
    assert.equal(await modal.evaluate(el => getComputedStyle(el, "::backdrop").animationName), "subscription-backdrop-enter");
    await close();
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => window.chat.open());
  assert.equal(await modal.evaluate(el => getComputedStyle(el).animationName), "none");
  assert.equal(await modal.evaluate(el => getComputedStyle(el, "::backdrop").animationName), "none");
  await close();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const trigger of [
    () => page.locator("#chatInput").dispatchEvent("beforeinput", { inputType: "insertText", data: "x", cancelable: true }),
    () => page.locator("#chatInput").dispatchEvent("paste", { cancelable: true }),
    () => page.locator("#chatSendButton").click(),
    () => page.locator("#chatAttachmentButton").click(),
    () => page.locator("#chatInput").press("Enter"),
    () => page.locator("#chatForm").dispatchEvent("submit", { cancelable: true }),
  ]) {
    await trigger();
    assert.equal(await modal.evaluate(el => el.open), true);
    assert.equal(await page.evaluate(() => window.loginCalls + window.sent + window.attached), 0);
    await close();
  }
  await page.locator(".chat-subscription-usage").click();
  assert.equal(await modal.locator("article").count(), 4);
  assert.match(await modal.innerText(), /9,90[\s\S]*49,90[\s\S]*99,90[\s\S]*199,90/);
  assert.match(await modal.innerText(), /sem renova/);
  assert.match(await modal.locator(".is-recommended").innerText(), /Profissional/);
  assert.match(await modal.locator(".chat-subscription-rules").innerText(), /honor\u00e1rios[\s\S]*sem compartilhamento[\s\S]*n\u00e3o acumulam/);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await modal.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      assert.ok(await modal.evaluate(el => el.contains(document.activeElement)), "Native dialog traps focus");
    }
    await page.screenshot({ path: join(output, `plans-${width}.png`) });
  }
  await page.keyboard.press("Escape");
  assert.equal(await modal.evaluate(el => el.open), false);
  assert.ok(await page.locator(".chat-subscription-usage").evaluate(el => el === document.activeElement));
  await page.evaluate(() => window.chat.open());
  await choose("experiment").click();
  assert.equal(await page.evaluate(() => window.loginCalls), 1);
  assert.equal(posts.length, 0, "Guest selection only requests login");
  await page.evaluate(async () => { window.auth = { user: { id: "user-a" } }; document.querySelector("#chatInput").value = "Rascunho ficticio"; await window.resume(); });
  await page.waitForURL("https://checkout.stripe.com/mock");
  const checkout = posts.at(-1).body;
  assert.equal(checkout.kind, "chat_experiment");
  assert.equal(checkout.interval, "once");
  assert.ok(checkout.requestId);
  await boot("?checkout=success");
  await login();
  assert.equal(await page.locator("#chatInput").inputValue(), "Rascunho ficticio");
  assert.equal(await page.evaluate(() => window.chat.ensureAccess()), false, "Query parameter must not grant access");
  assert.match(await modal.locator("[data-notice]").innerText(), /ainda n/);
  assert.equal(await page.evaluate(() => sessionStorage.getItem("audita:chat-checkout::user-a")), null);
  await close();
  await active();
  assert.equal(await page.evaluate(() => window.chat.ensureAccess()), true);
  assert.doesNotMatch(await modal.locator("[data-access]").textContent(), /usadas/);
  access.used = { messages: 12, pages: 3 };
  access.limits = { messages: 100, pages: 20 };
  access.remaining = { messages: 88, pages: 17 };
  await page.evaluate(() => window.chat.refresh());
  assert.match(await modal.locator("[data-access]").textContent(), /88 mensagens e 17 p\u00e1ginas restantes.*Mensagens: 12\/100 usadas.*P\u00e1ginas: 3\/20 usadas/);
  assert.ok(await page.locator('.chat-subscription-usage').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
  await page.locator("#chatInput").fill("Pode conversar");
  await page.locator("#chatSendButton").click();
  assert.equal(await page.evaluate(() => window.sent), 1);
  await prepare();
  assert.match(await docModal.innerText(), /3 p/);
  assert.equal(posts.filter(post => post.path.endsWith("/analyze")).length, 0);
  await docModal.locator("[data-cancel]").click();
  await page.waitForFunction(() => window.docResult === null);
  assert.equal(await page.evaluate(() => window.docResult), null);
  await prepare();
  analyzeFailure = true;
  await docModal.locator("[data-analyze]").click();
  await page.waitForFunction(() => document.querySelector("[data-document-error]").textContent);
  analyzeFailure = false;
  await docModal.locator("[data-analyze]").click();
  await page.waitForFunction(() => window.docResult?.id === "fixture-doc");
  const analyses = posts.filter(post => post.path.endsWith("/analyze"));
  assert.equal(analyses[0].body.confirmed, true);
  assert.equal(analyses[0].body.requestId, analyses[1].body.requestId, "Retry retains idempotency key");
  assert.equal(posts.find(post => post.path.endsWith("/prepare")).body.contentBase64, Buffer.from("fake PDF").toString("base64"));
  const invalid = await page.evaluate(async () => {
    const results = [];
    for (const file of [new File(["csv"], "a.csv", { type: "text/csv" }), new File([], "a.pdf", { type: "application/pdf" }), new File([new Uint8Array(12 * 1024 * 1024 + 1)], "a.pdf", { type: "application/pdf" })]) {
      try { await window.chat.prepareDocument(file); results.push(false); } catch { results.push(true); }
    }
    return results;
  });
  assert.deepEqual(invalid, [true, true, true]);
  prepareQuotaFailure = true;
  assert.equal(await page.evaluate(() => window.chat.analyzeDocument(new File(["fake"], "a.pdf", { type: "application/pdf" }))), null);
  assert.equal(await modal.evaluate(el => el.open), true);
  prepareQuotaFailure = false;
  await close();
  access = { active: true, planId: "standard", remaining: null, periodEnd: null, legacy: true };
  assert.equal(await page.evaluate(() => window.chat.ensureAccess()), true, "Server-confirmed legacy access is retained");
  await active();
  access.remaining.pages = 2;
  await page.evaluate(() => window.chat.refresh());
  await prepare();
  assert.ok(await docModal.locator("[data-analyze]").isDisabled());
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => window.docResult === null);
  access.remaining.messages = 0;
  await page.evaluate(() => window.chat.refresh());
  assert.equal(await page.evaluate(() => window.chat.ensureAccess()), false);
  assert.equal(await page.evaluate(() => window.chat.handleAccessError(429)), true);
  assert.equal(await modal.evaluate(el => el.open), true);
  assert.equal(await page.evaluate(() => window.chat.handleAccessError(500)), false);
  await close();
  accessFailure = true;
  assert.equal(await page.evaluate(() => window.chat.ensureAccess()), false);
  accessFailure = false;
  await close();
  await active();
  await page.evaluate(() => { document.querySelector("#chatInput").value = "Privado A"; sessionStorage.setItem("audita:chat-checkout::user-a", JSON.stringify({text:"Privado A",expires:Date.now()+60000})); });
  await login("user-b");
  assert.equal(await page.locator("#chatInput").inputValue(), "");
  assert.equal(await page.evaluate(() => sessionStorage.getItem("audita:chat-checkout::user-a")), null);
  await page.evaluate(() => window.chat.open());
  checkoutFailure = true;
  await choose("professional").click();
  await page.waitForFunction(() => document.querySelector("[data-notice]").textContent.includes("Tente novamente"));
  await choose("professional").click();
  await page.waitForFunction(() => document.querySelector("[data-notice]").textContent.includes("Tente novamente"));
  const checkouts = posts.filter(post => post.path.endsWith("/checkout"));
  assert.equal(checkouts.at(-1).body.kind, "chat_subscription");
  assert.equal(checkouts.at(-1).body.interval, "monthly");
  assert.equal(checkouts.at(-1).body.requestId, checkouts.at(-2).body.requestId);
  catalogFailure = true;
  await page.evaluate(() => window.chat.refresh());
  assert.equal(await page.evaluate(() => window.chat.ensureAccess()), false);
  assert.match(await modal.locator("[data-payment-status]").innerText(), /Pagamentos indispon/);
  catalogFailure = false;
  await boot();
  await active();
  await page.evaluate(() => window.chat.open());
  await modal.locator('[data-manage]').click();
  await page.waitForURL("https://billing.stripe.com/mock");
  assert.deepEqual(posts.at(-1).body, { kind: "chat" });
  await boot();
  access = { active: true, legacy: true, planId: "standard", remaining: null };
  await login();
  await page.evaluate(() => window.chat.open());
  await modal.locator('[data-manage]').click();
  await page.waitForURL("https://billing.stripe.com/mock");
  assert.deepEqual(posts.at(-1).body, {});
  assert.deepEqual(errors, []);
  console.log(`Chat subscription checks passed: gates, login resume, catalog, server-only access, drafts, documents, retries, keyboard, desktop/mobile. Screenshots: ${output}`);
} finally { await browser.close(); }
