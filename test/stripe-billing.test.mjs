import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import {
  createStripeBillingService,
  StripeBillingError,
  verifyStripeWebhookSignature,
} from "../services/stripe-billing.service.mjs";

const AUTH = {
  tenantId: "tenant-1",
  user: {
    id: "user-1",
    email: "owner@example.com",
    name: "Owner",
    role: "owner",
  },
};

function configuredEnv(overrides = {}) {
  return {
    AUDITA_BILLING_ENABLED: "true",
    AUDITA_CREDITS_ENABLED: "true",
    APP_URL: "https://audita.example",
    STRIPE_SECRET_KEY: "sk_test_example",
    STRIPE_WEBHOOK_SECRET: "whsec_example",
    STRIPE_API_VERSION: "2026-06-24.dahlia",
    STRIPE_INTEGRATION_IDENTIFIER: "audita_checkout_kmqrvzdp",
    STRIPE_PRICE_STANDARD_MONTHLY: "price_standard_month",
    STRIPE_PRICE_STANDARD_ANNUAL: "price_standard_year",
    STRIPE_PRICE_ITAU_CHARGE_TIER_1: "price_itau_tier_1",
    STRIPE_PRICE_ITAU_CHARGE_TIER_2: "price_itau_tier_2",
    STRIPE_PRICE_ITAU_CHARGE_TIER_3: "price_itau_tier_3",
    STRIPE_PRICE_ITAU_LAWYER_KIT: "price_itau_lawyer_kit",
    STRIPE_PRICE_CREDITS_25: "price_credits_25",
    STRIPE_PRICE_CREDITS_100: "price_credits_100",
    STRIPE_PRICE_CREDITS_500: "price_credits_500",
    ...overrides,
  };
}

function stripeSignature(payload, secret, timestamp) {
  const digest = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

function response(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("Stripe webhook signatures are verified against the untouched body", () => {
  const now = 1_800_000_000_000;
  const timestamp = Math.floor(now / 1000);
  const payload = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
  const signature = stripeSignature(payload, "whsec_example", timestamp);

  assert.equal(
    verifyStripeWebhookSignature(payload, signature, "whsec_example", {
      now: () => now,
    }),
    true,
  );
  assert.throws(
    () =>
      verifyStripeWebhookSignature(`${payload} `, signature, "whsec_example", {
        now: () => now,
      }),
    (error) => error instanceof StripeBillingError && error.code === "invalid_webhook_signature",
  );
});

test("checkout remains unavailable until billing itself is enabled", async () => {
  const service = createStripeBillingService({
    env: configuredEnv({ AUDITA_BILLING_ENABLED: "false" }),
    creditsService: {
      getWallet: async () => ({ enabled: false, balance: 0 }),
      grant: async () => {
        throw new Error("must not grant");
      },
    },
  });

  const result = await service.createCheckoutSession(AUTH, {
    kind: "subscription",
    planId: "standard",
    interval: "monthly",
  });
  assert.equal(result.unavailable, true);
  assert.ok(result.missing.includes("AUDITA_BILLING_ENABLED"));
});

test("hosted subscription checkout uses the configured price and tenant metadata", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options, body: new URLSearchParams(options.body) });
    if (url.endsWith("/v1/customers")) {
      return response({ id: "cus_1", email: AUTH.user.email });
    }
    return response({
      id: "cs_test_1",
      url: "https://checkout.stripe.com/c/pay/cs_test_1",
    });
  };
  const service = createStripeBillingService({
    env: configuredEnv(),
    fetchImpl,
    creditsService: {
      getWallet: async () => ({ enabled: true, balance: 0 }),
      grant: async () => ({ ok: true }),
    },
  });

  const result = await service.createCheckoutSession(AUTH, {
    kind: "subscription",
    planId: "standard",
    interval: "monthly",
    requestId: "request-1",
  });

  assert.equal(result.url, "https://checkout.stripe.com/c/pay/cs_test_1");
  assert.equal(calls.length, 2);
  const checkout = calls[1];
  assert.equal(checkout.body.get("mode"), "subscription");
  assert.equal(
    checkout.body.get("line_items[0][price]"),
    "price_standard_month",
  );
  assert.equal(checkout.body.get("metadata[audita_tenant_id]"), "tenant-1");
  assert.equal(checkout.body.get("integration_identifier"), "audita_checkout_kmqrvzdp");
  assert.equal(checkout.options.headers["stripe-version"], "2026-06-24.dahlia");
  assert.equal(checkout.options.headers["idempotency-key"], "audita-checkout-tenant-1-request-1");
});

test("Itaú checkout is a case-bound one-time payment available to members", async () => {
  const calls = [];
  const member = { ...AUTH, user: { ...AUTH.user, role: "member" } };
  const service = createStripeBillingService({
    env: configuredEnv(),
    fetchImpl: async (url, options) => {
      calls.push({ url, options, body: new URLSearchParams(options.body) });
      if (url.endsWith("/v1/customers")) return response({ id: "cus_itau" });
      return response({ id: "cs_itau", url: "https://checkout.stripe.com/c/pay/cs_itau" });
    },
  });

  const result = await service.createCheckoutSession(member, {
    kind: "itau_charge_service",
    tierId: "itau-cobrancas-faixa-2",
    caseIds: ["case-1", "case-2"],
    claimAmountCents: 1500000,
    requestId: "itau-request-1",
  });

  const checkout = calls[1];
  assert.equal(result.kind, "itau_charge_service");
  assert.equal(checkout.body.get("mode"), "payment");
  assert.equal(checkout.body.get("line_items[0][price]"), "price_itau_tier_2");
  assert.equal(checkout.body.get("metadata[itau_tier_id]"), "itau-cobrancas-faixa-2");
  assert.equal(checkout.body.get("metadata[itau_claim_cents]"), "1500000");
  assert.equal(checkout.body.get("metadata[itau_case_ids_1]"), '["case-1","case-2"]');
  assert.equal(checkout.body.has("allow_promotion_codes"), false);
  assert.match(checkout.body.get("success_url"), /itau_checkout=success/);
});

test("paid Itaú checkout grants only the purchased cases", async () => {
  const now = 1_800_000_000_000;
  const member = { ...AUTH, user: { ...AUTH.user, role: "member" } };
  const event = {
    id: "evt_itau_1",
    type: "checkout.session.completed",
    created: Math.floor(now / 1000),
    data: {
      object: {
        id: "cs_itau_1",
        customer: "cus_itau_1",
        client_reference_id: "tenant-1",
        payment_status: "paid",
        metadata: {
          audita_tenant_id: "tenant-1",
          purchase_kind: "itau_charge_service",
          itau_tier_id: "itau-cobrancas-faixa-1",
          itau_claim_cents: "900000",
          itau_case_ids_1: '["case-paid"]',
        },
      },
    },
  };
  const payload = JSON.stringify(event);
  const signature = stripeSignature(payload, "whsec_example", Math.floor(now / 1000));
  const service = createStripeBillingService({ env: configuredEnv(), now: () => now });

  const webhook = await service.handleWebhook(payload, signature);
  const purchased = await service.itauCaseAccessState(member, ["case-paid"]);
  const other = await service.itauCaseAccessState(member, ["case-other"]);

  assert.equal(webhook.status, "processed");
  assert.equal(purchased.entitled, true);
  assert.equal(purchased.source, "itau_charge_service");
  assert.equal(other.entitled, false);
});

test("paid lawyer kit checkout grants permanent tenant access", async () => {
  const calls = [];
  const now = 1_800_000_000_000;
  const member = { ...AUTH, user: { ...AUTH.user, role: "member" } };
  const service = createStripeBillingService({
    env: configuredEnv(),
    now: () => now,
    fetchImpl: async (url, options) => {
      calls.push({ url, body: new URLSearchParams(options.body) });
      if (url.endsWith("/v1/customers")) return response({ id: "cus_lawyer" });
      return response({ id: "cs_lawyer", url: "https://checkout.stripe.com/c/pay/cs_lawyer" });
    },
  });

  const checkout = await service.createCheckoutSession(member, {
    kind: "itau_lawyer_kit",
    requestId: "lawyer-kit-1",
    uf: "SP",
  });
  assert.equal(checkout.kind, "itau_lawyer_kit");
  assert.equal(calls[1].body.get("mode"), "payment");
  assert.equal(calls[1].body.get("line_items[0][price]"), "price_itau_lawyer_kit");
  assert.equal(calls[1].body.get("metadata[itau_lawyer_kit_uf]"), "SP");
  assert.match(calls[1].body.get("success_url"), /lawyer_kit_checkout=success/);

  const event = {
    id: "evt_lawyer_1",
    type: "checkout.session.completed",
    created: Math.floor(now / 1000),
    data: {
      object: {
        id: "cs_lawyer",
        customer: "cus_lawyer",
        client_reference_id: "tenant-1",
        payment_status: "paid",
        metadata: {
          audita_tenant_id: "tenant-1",
          purchase_kind: "itau_lawyer_kit",
          itau_lawyer_kit_id: "itau-kit-advocacia",
          itau_lawyer_kit_uf: "SP",
        },
      },
    },
  };
  const payload = JSON.stringify(event);
  const signature = stripeSignature(payload, "whsec_example", Math.floor(now / 1000));
  await service.handleWebhook(payload, signature);

  assert.deepEqual(await service.itauLawyerKitAccessState(member), {
    entitled: true,
    source: "itau_lawyer_kit",
    uf: "SP",
  });
});

test("lawyer kit checkout requires a valid Brazilian state", async () => {
  const service = createStripeBillingService({ env: configuredEnv() });
  const result = await service.createCheckoutSession(AUTH, {
    kind: "itau_lawyer_kit",
    uf: "XX",
  });

  assert.deepEqual(result, {
    invalid: true,
    reason: "itau_lawyer_kit_uf_required",
  });
});

test("Standard subscription does not replace the Itaú case purchase", async () => {
  const service = createStripeBillingService({
    env: configuredEnv(),
    accessService: {
      getEntitlement: async () => ({ entitled: true, source: "subscription" }),
    },
  });

  assert.deepEqual(await service.itauCaseAccessState(AUTH, ["case-unpaid"]), {
    entitled: false,
    source: "none",
  });
});

test("credit pack checkout is blocked before creating a Stripe customer when credits are disabled", async () => {
  let calls = 0;
  const service = createStripeBillingService({
    env: configuredEnv({ AUDITA_CREDITS_ENABLED: "false" }),
    fetchImpl: async () => {
      calls += 1;
      throw new Error("must not call Stripe");
    },
    creditsService: {
      getWallet: async () => ({ enabled: false, balance: 0 }),
    },
  });

  const result = await service.createCheckoutSession(AUTH, {
    kind: "credit_pack",
    packId: "creditos-100",
  });

  assert.deepEqual(result, {
    unavailable: true,
    reason: "credits_not_enabled",
    missing: ["AUDITA_CREDITS_ENABLED"],
  });
  assert.equal(calls, 0);
});

test("paid credit pack webhook grants credits once even when Stripe retries it", async () => {
  const grants = [];
  const now = 1_800_000_000_000;
  const event = {
    id: "evt_pack_1",
    type: "checkout.session.completed",
    created: Math.floor(now / 1000),
    livemode: false,
    data: {
      object: {
        id: "cs_pack_1",
        customer: "cus_pack_1",
        client_reference_id: "tenant-1",
        payment_status: "paid",
        customer_details: { email: AUTH.user.email },
        metadata: {
          audita_tenant_id: "tenant-1",
          purchase_kind: "credit_pack",
          credit_pack_id: "creditos-100",
          credits: "100",
        },
      },
    },
  };
  const payload = JSON.stringify(event);
  const signature = stripeSignature(
    payload,
    "whsec_example",
    Math.floor(now / 1000),
  );
  const service = createStripeBillingService({
    env: configuredEnv(),
    now: () => now,
    creditsService: {
      getWallet: async () => ({ enabled: true, balance: 0 }),
      grant: async (_auth, input) => {
        grants.push(input);
        return { ok: true, state: "granted" };
      },
    },
  });

  const first = await service.handleWebhook(payload, signature);
  const retry = await service.handleWebhook(payload, signature);

  assert.equal(first.status, "processed");
  assert.equal(retry.duplicate, true);
  assert.equal(grants.length, 1);
  assert.equal(grants[0].amount, 100);
  assert.equal(grants[0].referenceId, "stripe:checkout:cs_pack_1");
});

test("paid subscription invoice records active Standard access without fake credits", async () => {
  const grants = [];
  const now = 1_800_000_000_000;
  const event = {
    id: "evt_invoice_1",
    type: "invoice.paid",
    created: Math.floor(now / 1000),
    data: {
      object: {
        id: "in_1",
        customer: "cus_1",
        subscription: "sub_1",
        metadata: { audita_tenant_id: "tenant-1" },
        lines: {
          data: [
            {
              price: { id: "price_standard_year" },
              period: {
                start: Math.floor(now / 1000),
                end: Math.floor(now / 1000) + 31_536_000,
              },
            },
          ],
        },
      },
    },
  };
  const payload = JSON.stringify(event);
  const signature = stripeSignature(
    payload,
    "whsec_example",
    Math.floor(now / 1000),
  );
  const service = createStripeBillingService({
    env: configuredEnv(),
    now: () => now,
    creditsService: {
      getWallet: async () => ({ enabled: true, balance: 0 }),
      grant: async (_auth, input) => {
        grants.push(input);
        return { ok: true, state: "granted" };
      },
    },
  });

  const result = await service.handleWebhook(payload, signature);
  const state = await service.billingState(AUTH);

  assert.equal(result.status, "processed");
  assert.equal(grants.length, 0);
  assert.equal(state.subscription.planId, "standard");
  assert.equal(state.subscription.interval, "annual");
  assert.equal(state.subscription.active, true);
});

test("only tenant billing managers can create checkout sessions", async () => {
  const service = createStripeBillingService({
    env: configuredEnv(),
    fetchImpl: async () => {
      throw new Error("must not call Stripe");
    },
    creditsService: {
      getWallet: async () => ({ enabled: true, balance: 0 }),
    },
  });
  const result = await service.createCheckoutSession(
    { ...AUTH, user: { ...AUTH.user, role: "member" } },
    {
      kind: "subscription",
      planId: "standard",
      interval: "monthly",
    },
  );
  assert.deepEqual(result, { forbidden: true });
});

test("demo mode lets a member activate only their own tester access", async () => {
  const calls = [];
  const member = { ...AUTH, user: { ...AUTH.user, role: "member" } };
  const service = createStripeBillingService({
    env: configuredEnv({ AUDITA_BILLING_DEMO_MODE: "true" }),
    accessService: {
      grantOwnDemoAccess: async (authContext, input) => {
        calls.push({ authContext, input });
        return { grant: { userId: authContext.user.id, status: "active" } };
      },
      getEntitlement: async () => ({
        entitled: true,
        source: "tester",
        planId: "standard",
      }),
    },
  });

  const result = await service.createDemoSubscription(member, { interval: "monthly" });

  assert.equal(result.demo, true);
  assert.equal(result.subscription, null);
  assert.equal(result.access.entitled, true);
  assert.equal(result.access.source, "tester");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].authContext.user.id, "user-1");
  assert.equal(calls[0].input.interval, "monthly");
});
