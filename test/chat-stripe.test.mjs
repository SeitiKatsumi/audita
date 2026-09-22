import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { resolveBillingSelection } from "../services/billing-catalog.service.mjs";
import { createStripeBillingService } from "../services/stripe-billing.service.mjs";
import { createChatAccessService } from "../services/chat-access.service.mjs";

const NOW = 1800000000000;
const AUTH = { tenantId: "1", user: { id: "2", role: "member", email: "member@example.com" } };
const ENV = {
  AUDITA_BILLING_ENABLED: "true", APP_URL: "https://audita.example",
  STRIPE_SECRET_KEY: "sk_test_fake", STRIPE_WEBHOOK_SECRET: "whsec_fake",
  STRIPE_PRICE_CHAT_ESSENTIAL: "price_chat_essential",
  STRIPE_PRICE_CHAT_PROFESSIONAL: "price_chat_professional",
  STRIPE_PRICE_CHAT_PREMIUM: "price_chat_premium",
  STRIPE_PRICE_CHAT_EXPERIMENT: "price_chat_experiment",
  STRIPE_PRICE_STANDARD_MONTHLY: "price_standard",
};
const selection = (trial = false) => resolveBillingSelection({
  kind: trial ? "chat_experiment" : "chat_subscription",
  planId: trial ? "chat-experiment" : "chat-essential", interval: trial ? "once" : "monthly",
}, ENV);
const metadata = (trial = false) => ({ audita_tenant_id: "1", audita_user_id: "2",
  purchase_kind: trial ? "chat_experiment" : "chat_subscription",
  plan_id: trial ? "chat-experiment" : "chat-essential", interval: trial ? "once" : "monthly" });

function fixture({ access = { allowed: false, source: "none", trialAvailable: true }, fetch, grant, accessService, getDb, now = () => NOW } = {}) {
  const calls = [], grants = [], revoked = [];
  const chatAccessService = {
    getAccess: async () => access,
    grantPaidAccess: async input => { grants.push(input); return grant ? grant(input) : { duplicate: false }; },
    revokeSubscription: async input => { revoked.push(input); return { revoked: 1 }; },
    revokePayment: async input => { revoked.push(input); return { revoked: 1 }; },
  };
  const service = createStripeBillingService({ env: ENV, now, getDb, chatAccessService: accessService || chatAccessService,
    fetchImpl: async (url, options) => {
      calls.push({ url, ...options, params: new URLSearchParams(options.body) });
      const payload = fetch ? await fetch(url, options) : url.includes("/v1/payment_intents/")
        ? { status: "succeeded", latest_charge: { paid: true, created: NOW / 1000 } } : url.endsWith("/v1/customers")
        ? { id: `cus_${new URLSearchParams(options.body).get("metadata[audita_tenant_id]")}_${new URLSearchParams(options.body).get("metadata[audita_user_id]")}` }
        : { id: "cs_chat", url: "https://checkout.stripe.com/fake" };
      return { ok: true, json: async () => payload };
    },
  });
  let serial = 0;
  async function send(type, object, id = `evt_${++serial}`) {
    const body = JSON.stringify({ id, type, created: NOW / 1000, data: { object } });
    const digest = crypto.createHmac("sha256", ENV.STRIPE_WEBHOOK_SECRET).update(`${NOW / 1000}.${body}`).digest("hex");
    return service.handleWebhook(body, `t=${NOW / 1000},v1=${digest}`);
  }
  return { service, calls, grants, revoked, send, chatAccessService };
}

async function customerDatabase(t) {
  const pg = new PGlite();
  t.after(() => pg.close());
  await pg.exec(`CREATE TABLE audita_tenants(id BIGINT PRIMARY KEY);
    CREATE TABLE audita_users(id BIGINT PRIMARY KEY,tenant_id BIGINT);
    INSERT INTO audita_tenants VALUES(1),(2); INSERT INTO audita_users VALUES(2,1),(3,1),(4,2);
    CREATE TABLE audita_billing_customers(tenant_id BIGINT PRIMARY KEY,stripe_customer_id TEXT UNIQUE,customer_email TEXT,created_at TIMESTAMPTZ,updated_at TIMESTAMPTZ);
    INSERT INTO audita_billing_customers VALUES(1,'cus_legacy','owner@example.com',NOW(),NOW());
    CREATE TABLE audita_billing_events(id BIGSERIAL PRIMARY KEY,provider TEXT,provider_event_id TEXT UNIQUE,event_type TEXT,status TEXT,
      event_created_at TIMESTAMPTZ,tenant_id BIGINT,processed_at TIMESTAMPTZ,error_message TEXT,metadata JSONB);`);
  const migration = await readFile(new URL("../db/migrations/20260922-chat-customers.sql", import.meta.url), "utf8");
  await pg.exec(migration);
  await pg.exec(migration);
  return { pg, getDb: () => ({ pool: pg, dbReady: true }) };
}

function invoice(overrides = {}) {
  const product = selection();
  assert.ok(product.amount, "parent catalog must resolve chat_subscription");
  return { id: "in_chat", status: "paid", currency: "brl", amount_paid: product.amount.cents,
    parent: { subscription_details: { subscription: "sub_chat", metadata: metadata() } },
    lines: { data: [{ pricing: { price_details: { price: product.priceId } },
      period: { start: NOW / 1000, end: NOW / 1000 + 31 * 86400 } }] }, ...overrides };
}

function checkout(overrides = {}) {
  const product = selection(true);
  assert.ok(product.amount, "parent catalog must resolve chat_experiment");
  return { id: "cs_chat", mode: "payment", payment_status: "paid", currency: "brl",
    amount_total: product.amount.cents, payment_intent: "pi_trial", created: NOW / 1000,
    metadata: metadata(true), ...overrides };
}

test("members buy chat subscriptions without discounts or Standard redirects", async t => {
  const f = fixture(await customerDatabase(t));
  const result = await f.service.createCheckoutSession(AUTH, { kind: "chat_subscription", planId: "chat-essential", interval: "monthly" });
  assert.equal(result.kind, "chat_subscription");
  const { params } = f.calls.at(-1);
  assert.equal(params.get("mode"), "subscription");
  assert.equal(params.get("line_items[0][price]"), selection().priceId);
  assert.equal(params.get("subscription_data[metadata][audita_user_id]"), "2");
  assert.equal(params.get("metadata[audita_tenant_id]"), "1");
  assert.equal(params.get("metadata[plan_id]"), "chat-essential");
  assert.equal(params.get("success_url"), "https://audita.example/chat?chat_checkout=success");
  assert.equal(params.get("cancel_url"), "https://audita.example/chat?chat_checkout=cancelled");
  assert.equal(params.has("allow_promotion_codes"), false);
  assert.equal(params.has("subscription_data[trial_period_days]"), false);
  assert.equal(f.grants.length, 0);
});

test("trial checkout uses a stable user-bound idempotency key even for parallel requests", async t => {
  const f = fixture(await customerDatabase(t));
  const input = { kind: "chat_experiment", planId: "chat-experiment", interval: "once" };
  await Promise.all([1, 2].map(requestId => f.service.createCheckoutSession(AUTH, { ...input, requestId })));
  const calls = f.calls.filter(call => call.url.endsWith("/checkout/sessions"));
  assert.ok(calls.length >= 1);
  assert.ok(calls.every(call => call.headers["idempotency-key"] === calls[0].headers["idempotency-key"]));
  assert.ok(calls.every(call => call.params.toString() === calls[0].params.toString()));
  assert.equal(calls[0].params.get("mode"), "payment");
  assert.equal(calls[0].params.get("payment_intent_data[metadata][plan_id]"), "chat-experiment");
  await f.service.createCheckoutSession({ ...AUTH, user: { ...AUTH.user, id: "3" } }, input);
  assert.notEqual(f.calls.at(-1).headers["idempotency-key"], calls[0].headers["idempotency-key"]);
});

test("active access and previously used experiments stop before Stripe; legacy access does not", async t => {
  for (const access of [
    { active: true, allowed: true, source: "entitlement", trialAvailable: true },
    { allowed: false, source: "none", trialAvailable: false },
    { allowed: false, source: "none" },
  ]) {
    const f = fixture({ access });
    const result = await f.service.createCheckoutSession(AUTH, { kind: "chat_experiment", planId: "chat-experiment", interval: "once" });
    assert.equal(result.invalid, true);
    assert.equal(f.calls.length, 0);
  }
  const f = fixture({ ...await customerDatabase(t), access: { allowed: true, source: "legacy", trialAvailable: true } });
  assert.ok((await f.service.createCheckoutSession(AUTH, { kind: "chat_subscription", planId: "chat-essential" })).url);
});

test("chat demo activation is forbidden even when legacy demo mode is enabled", async () => {
  const service = createStripeBillingService({ env: { ...ENV, AUDITA_BILLING_DEMO_MODE: "true" } });
  for (const input of [{ kind: "chat_subscription" }, { kind: "chat_experiment" }, { planId: "chat-essential" }]) {
    assert.deepEqual(await service.createDemoSubscription(AUTH, { interval: "monthly", ...input }),
      { invalid: true, reason: "chat_demo_forbidden" });
  }
  assert.deepEqual(await service.createCheckoutSession(AUTH, { kind: "chat_subscription", planId: "chat-essential", demo: true }),
    { invalid: true, reason: "chat_demo_forbidden" });
  assert.equal(await service.getSubscription(AUTH.tenantId), null);
});

test("only signed paid invoices grant recurring access; replay and Standard storage stay isolated", async () => {
  const f = fixture();
  await assert.rejects(f.service.handleWebhook(JSON.stringify({ id: "evt_bad" }), "invalid"));
  assert.equal(f.grants.length, 0);
  const object = invoice();
  assert.equal((await f.send("invoice.paid", object, "evt_paid")).status, "processed");
  assert.equal((await f.send("invoice.paid", object, "evt_paid")).duplicate, true);
  assert.deepEqual(f.grants, [{ tenantId: "1", userId: "2", planId: "chat-essential", paymentId: "in_chat",
    subscriptionId: "sub_chat", periodStart: new Date(NOW).toISOString(), periodEnd: new Date(NOW + 31 * 86400000).toISOString() }]);
  assert.equal(await f.service.getSubscription("1"), null);
});

test("unpaid, zero, discounted, wrong currency and unbound invoices cannot grant", async () => {
  for (const override of [{ status: "open" }, { amount_paid: 0 }, { amount_paid: 1 }, { currency: "usd" },
    { paid_out_of_band: true }, { parent: { subscription_details: { subscription: "sub_chat", metadata: { purchase_kind: "chat_subscription" } } } }]) {
    const f = fixture();
    try { await f.send("invoice.paid", invoice(override)); } catch (error) { assert.equal(error.code, "chat_identity_missing"); }
    assert.equal(f.grants.length, 0);
  }
});

test("subscription creation, updates, failed invoices and recurring checkout never grant", async () => {
  const f = fixture();
  for (const type of ["customer.subscription.created", "customer.subscription.updated", "invoice.payment_failed", "checkout.session.completed"]) {
    await f.send(type, { ...invoice(), metadata: metadata(), status: "active", payment_status: "paid", cancel_at_period_end: true });
  }
  assert.equal(f.grants.length, 0);
  assert.equal(f.revoked.length, 0);
  assert.equal(await f.service.getSubscription("1"), null);
});

test("paid experiment grants exactly 30 days and async delivery uses the same payment identity", async () => {
  const f = fixture();
  await f.send("checkout.session.completed", checkout({ payment_status: "unpaid" }));
  assert.equal(f.grants.length, 0);
  await f.send("checkout.session.async_payment_succeeded", checkout(), "evt_async");
  assert.equal((await f.send("checkout.session.async_payment_succeeded", checkout(), "evt_async")).duplicate, true);
  await f.send("checkout.session.completed", checkout());
  assert.deepEqual(f.grants[0], f.grants[1]);
  assert.equal(f.grants[0].paymentId, "pi_trial");
  assert.equal(f.grants[0].subscriptionId, null);
  assert.equal(Date.parse(f.grants[0].periodEnd) - Date.parse(f.grants[0].periodStart), 30 * 86400000);
  for (const override of [{ payment_status: "no_payment_required" }, { amount_total: 0 }, { amount_total: 1 }, { currency: "usd" }, { payment_intent: null }]) {
    await f.send("checkout.session.completed", checkout(override));
  }
  assert.equal(f.grants.length, 2);
});

test("deleted and terminal subscriptions revoke only the exact user subscription", async () => {
  const f = fixture();
  await f.send("customer.subscription.deleted", { id: "sub_chat", metadata: metadata() });
  await f.send("customer.subscription.updated", { id: "sub_other", metadata: metadata(), status: "unpaid" });
  assert.deepEqual(f.revoked, [{ tenantId: "1", userId: "2", subscriptionId: "sub_chat" },
    { tenantId: "1", userId: "2", subscriptionId: "sub_other" }]);
});

test("delayed experiment starts at the paid charge, not checkout creation or delivery", async () => {
  const paidAt = NOW / 1000 + 2 * 86400;
  const f = fixture({ fetch: async url => {
    assert.match(url, /payment_intents\/pi_trial\?expand%5B0%5D=latest_charge$/);
    return { status: "succeeded", latest_charge: { paid: true, created: paidAt } };
  } });
  await f.send("checkout.session.async_payment_succeeded", checkout());
  assert.equal(f.grants[0].periodStart, new Date(paidAt * 1000).toISOString());
  assert.equal(f.grants[0].periodEnd, new Date((paidAt + 30 * 86400) * 1000).toISOString());
  for (const payment of [{ status: "processing" }, { status: "succeeded", latest_charge: { paid: false, created: paidAt } }]) {
    const unpaid = fixture({ fetch: async () => payment });
    await unpaid.send("checkout.session.completed", checkout());
    assert.equal(unpaid.grants.length, 0);
  }
});

test("experiment refunds revoke matching payments; pending refunds do nothing", async () => {
  const f = fixture();
  await f.send("refund.created", { status: "pending", payment_intent: "pi_trial", metadata: metadata(true) });
  assert.equal(f.revoked.length, 0);
  await f.send("charge.refunded", { amount_refunded: 1, payment_intent: { id: "pi_trial" }, metadata: metadata(true) });
  assert.deepEqual(f.revoked, [{ tenantId: "1", userId: "2", paymentId: "pi_trial" }]);
});

test("modern dispute finds the invoice through payment mapping and revokes by invoice ID", async () => {
  const f = fixture({ fetch: async url => {
    if (url.includes("/charges/")) return { id: "ch_chat", payment_intent: "pi_recurring" };
    if (url.includes("/payment_intents/")) return { id: "pi_recurring", metadata: {} };
    if (url.includes("/invoice_payments?")) return { data: [{ invoice: "in_chat" }], has_more: false };
    if (url.includes("/invoices/")) return invoice();
    throw new Error(`Unexpected fake Stripe call: ${url}`);
  } });
  await f.send("charge.dispute.created", { charge: "ch_chat" });
  assert.deepEqual(f.revoked, [{ tenantId: "1", userId: "2", paymentId: "in_chat" }]);
  assert.ok(f.calls.every(call => call.method === "GET" && !call.body));
  assert.match(f.calls.find(call => call.url.includes("/invoice_payments?")).url, /payment%5Bpayment_intent%5D=pi_recurring/);
});

test("failed grant is retryable and prior revocation is acknowledged without granting", async () => {
  let attempts = 0;
  const f = fixture({ grant: async () => { if (++attempts === 1) throw new Error("db temporarily unavailable"); return {}; } });
  await assert.rejects(f.send("invoice.paid", invoice(), "evt_retry"), /temporarily unavailable/);
  assert.equal((await f.send("invoice.paid", invoice(), "evt_retry")).status, "processed");
  assert.equal(attempts, 2);
  const revoked = fixture({ grant: async () => { throw Object.assign(new Error("revoked"), { code: "chat_access_revoked" }); } });
  assert.equal((await revoked.send("invoice.paid", invoice())).status, "ignored");
});

test("real access integration preserves expiry, trial use and payment tombstones across billing restarts", async t => {
  const pg = new PGlite();
  t.after(() => pg.close());
  await pg.exec(`CREATE TABLE audita_tenants(id BIGINT PRIMARY KEY);
    CREATE TABLE audita_users(id BIGINT PRIMARY KEY,tenant_id BIGINT);
    INSERT INTO audita_tenants VALUES(1); INSERT INTO audita_users VALUES(2,1);`);
  await pg.exec(await readFile(new URL("../db/migrations/20260922-chat-access.sql", import.meta.url), "utf8"));
  const pool = { connect: async () => ({ query: (...args) => pg.query(...args), release() {} }) };
  let time = NOW;
  const accessService = createChatAccessService({ getDb: () => ({ pool, dbReady: true }), now: () => new Date(time) });
  const fetch = async url => {
    assert.match(url, /payment_intents\/pi_trial/);
    return { status: "succeeded", latest_charge: { paid: true, created: time / 1000 } };
  };
  const f = fixture({ accessService, fetch });
  await f.send("invoice.paid", invoice());
  assert.equal((await accessService.getAccess(AUTH)).active, true);
  await f.send("invoice.payment_failed", invoice());
  assert.equal((await accessService.getAccess(AUTH)).active, true);
  time += 31 * 86400000;
  assert.equal((await accessService.getAccess(AUTH)).active, false);
  const trial = checkout({ created: time / 1000 });
  await f.send("checkout.session.completed", trial);
  const restarted = fixture({ accessService, fetch });
  await restarted.send("checkout.session.async_payment_succeeded", trial);
  assert.equal((await accessService.getAccess(AUTH)).trialAvailable, false);
  await restarted.send("charge.refunded", { amount_refunded: selection(true).amount.cents,
    payment_intent: "pi_trial", metadata: metadata(true) });
  const access = await accessService.getAccess(AUTH);
  assert.equal(access.active, false);
  assert.equal(access.trialAvailable, false);
  assert.equal((await restarted.service.createCheckoutSession(AUTH,
    { kind: "chat_experiment", planId: "chat-experiment" })).reason, "chat_experiment_already_used");
  await restarted.send("customer.subscription.deleted", { id: "sub_next", metadata: metadata() });
  assert.equal((await restarted.send("invoice.paid", invoice({ id: "in_next",
    parent: { subscription_details: { subscription: "sub_next", metadata: metadata() } } }))).status, "ignored");
  assert.equal((await accessService.getAccess(AUTH)).active, false);
});

test("chat customer and portal isolate members, tenants and the legacy owner customer", async t => {
  const database = await customerDatabase(t);
  const f = fixture(database);
  const other = { ...AUTH, user: { ...AUTH.user, id: "3" } };
  const owner = { ...AUTH, user: { ...AUTH.user, role: "owner" } };
  const otherTenant = { tenantId: "2", user: { id: "4", role: "member" } };
  const input = { kind: "chat_subscription", planId: "chat-essential" };
  for (const auth of [AUTH, other, otherTenant]) await f.service.createCheckoutSession(auth, input);
  const customers = (await database.pg.query("SELECT stripe_customer_id FROM audita_chat_customers")).rows;
  assert.equal(new Set(customers.map(row => row.stripe_customer_id)).size, 3);
  const restarted = fixture(database);
  for (const auth of [AUTH, other, otherTenant]) {
    assert.ok((await restarted.service.createPortalSession(auth, { kind: "chat", customerId: "cus_legacy", userId: "3" })).url);
    assert.equal(restarted.calls.at(-1).params.get("customer"), `cus_${auth.tenantId}_${auth.user.id}`);
    assert.equal(restarted.calls.at(-1).params.get("return_url"), "https://audita.example/chat");
  }
  assert.deepEqual(await restarted.service.createPortalSession(AUTH), { forbidden: true });
  await restarted.service.createPortalSession(owner);
  assert.equal(restarted.calls.at(-1).params.get("customer"), "cus_legacy");
  await restarted.service.createPortalSession(owner, { kind: "chat" });
  assert.equal(restarted.calls.at(-1).params.get("customer"), "cus_1_2");
  assert.equal((await restarted.service.createPortalSession({ ...AUTH, tenantId: "2" }, { kind: "chat" })).notFound, true);
  await assert.rejects(restarted.service.createCheckoutSession({ ...AUTH, tenantId: "2" }, input), { code: "chat_unauthorized" });
  await f.send("checkout.session.completed", { customer: "cus_1_2", metadata: metadata(), subscription: "sub_chat", payment_status: "paid" });
  await f.send("checkout.session.completed", { customer: "cus_1_2", client_reference_id: "1", metadata: {} });
  assert.deepEqual((await database.pg.query("SELECT stripe_customer_id FROM audita_billing_customers WHERE tenant_id=1")).rows,
    [{ stripe_customer_id: "cus_legacy" }]);
});

test("persistent pending checkout survives timeouts and distinct concurrent request IDs, and only confirmed expiry unlocks", async t => {
  const database = await customerDatabase(t);
  let clock = NOW, failResponse = true, status = "complete";
  const sessions = new Map();
  const fetch = async (url, options) => {
    if (url.endsWith("/customers")) return { id: "cus_1_2" };
    if (url.includes("/subscriptions/")) return { status: "active" };
    if (options.method === "GET") return { status, subscription: "sub_pending" };
    const key = options.headers["idempotency-key"];
    if (!sessions.has(key)) sessions.set(key, { id: `cs_${sessions.size}`, url: "https://checkout.stripe.com/fake" });
    if (failResponse) { failResponse = false; throw new Error("response lost after Stripe created checkout"); }
    return sessions.get(key);
  };
  const options = { ...database, fetch, now: () => clock };
  const first = fixture(options);
  const input = { kind: "chat_subscription", planId: "chat-essential" };
  await assert.rejects(first.service.createCheckoutSession(AUTH, { ...input, requestId: "first" }), /response lost/);
  const restarted = fixture(options);
  const results = await Promise.all(["second", "third"].map(requestId => restarted.service.createCheckoutSession(AUTH, { ...input, requestId })));
  assert.equal(sessions.size, 1);
  assert.equal(results[0].sessionId, results[1].sessionId);
  const sent = [...first.calls, ...restarted.calls].filter(call => call.url.endsWith("/checkout/sessions"));
  assert.ok(sent.every(call => call.body === sent[0].body && call.headers["idempotency-key"] === sent[0].headers["idempotency-key"]));
  await assert.rejects(restarted.service.createCheckoutSession(AUTH, { ...input, planId: "chat-premium" }), { code: "chat_checkout_pending" });
  clock += 3700000;
  await assert.rejects(restarted.service.createCheckoutSession(AUTH, input), { code: "chat_checkout_pending" });
  assert.equal(sessions.size, 1, "local expiry cannot unlock an async or active subscription");
  status = "expired";
  const renewed = await restarted.service.createCheckoutSession(AUTH, { ...input, planId: "chat-premium" });
  assert.notEqual(renewed.sessionId, results[0].sessionId);
  assert.equal(sessions.size, 2);
  assert.equal(restarted.calls.at(-1).params.get("line_items[0][price]"), ENV.STRIPE_PRICE_CHAT_PREMIUM);
});

test("chat billing fails closed without persistent storage and on an uncertain request older than Stripe retention", async t => {
  const input = { kind: "chat_subscription", planId: "chat-essential" };
  const absent = fixture();
  await assert.rejects(absent.service.createCheckoutSession(AUTH, input), { code: "chat_database_unavailable" });
  await assert.rejects(absent.service.createPortalSession(AUTH, { kind: "chat" }), { code: "chat_database_unavailable" });
  assert.equal(absent.calls.length, 0);
  const database = await customerDatabase(t);
  let clock = NOW;
  const options = { ...database, now: () => clock, fetch: async url => {
    if (url.endsWith("/customers")) return { id: "cus_1_2" };
    throw new Error("network timeout");
  } };
  await assert.rejects(fixture(options).service.createCheckoutSession(AUTH, input), /network timeout/);
  clock += 24 * 3600000;
  const restarted = fixture(options);
  await assert.rejects(restarted.service.createCheckoutSession(AUTH, input), { code: "chat_checkout_reconciliation_required" });
  assert.equal(restarted.calls.length, 0);
});
