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
    STRIPE_PRICE_ESSENTIAL_MONTHLY: "price_essential_month",
    STRIPE_PRICE_ESSENTIAL_ANNUAL: "price_essential_year",
    STRIPE_PRICE_PROFESSIONAL_MONTHLY: "price_professional_month",
    STRIPE_PRICE_PROFESSIONAL_ANNUAL: "price_professional_year",
    STRIPE_PRICE_TEAM_MONTHLY: "price_team_month",
    STRIPE_PRICE_TEAM_ANNUAL: "price_team_year",
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

test("checkout remains unavailable until billing and credits are both enabled", async () => {
  const service = createStripeBillingService({
    env: configuredEnv({ AUDITA_CREDITS_ENABLED: "false" }),
    creditsService: {
      getWallet: async () => ({ enabled: false, balance: 0 }),
      grant: async () => {
        throw new Error("must not grant");
      },
    },
  });

  const result = await service.createCheckoutSession(AUTH, {
    kind: "subscription",
    planId: "essencial",
    interval: "monthly",
  });
  assert.equal(result.unavailable, true);
  assert.ok(result.missing.includes("AUDITA_CREDITS_ENABLED"));
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
    planId: "profissional",
    interval: "monthly",
    requestId: "request-1",
  });

  assert.equal(result.url, "https://checkout.stripe.com/c/pay/cs_test_1");
  assert.equal(calls.length, 2);
  const checkout = calls[1];
  assert.equal(checkout.body.get("mode"), "subscription");
  assert.equal(
    checkout.body.get("line_items[0][price]"),
    "price_professional_month",
  );
  assert.equal(checkout.body.get("metadata[audita_tenant_id]"), "tenant-1");
  assert.equal(checkout.options.headers["idempotency-key"], "audita-checkout-tenant-1-request-1");
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

test("paid subscription invoice grants the plan allowance and records active state", async () => {
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
              price: { id: "price_essential_year" },
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
      getWallet: async () => ({ enabled: true, balance: 360 }),
      grant: async (_auth, input) => {
        grants.push(input);
        return { ok: true, state: "granted" };
      },
    },
  });

  const result = await service.handleWebhook(payload, signature);
  const state = await service.billingState(AUTH);

  assert.equal(result.status, "processed");
  assert.equal(grants[0].amount, 360);
  assert.equal(state.subscription.planId, "essencial");
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
      planId: "essencial",
      interval: "monthly",
    },
  );
  assert.deepEqual(result, { forbidden: true });
});
