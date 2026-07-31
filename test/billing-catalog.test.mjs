import assert from "node:assert/strict";
import test from "node:test";

import {
  billingConfiguration,
  getPublicBillingCatalog,
  resolveBillingProductFromPrice,
  resolveBillingSelection,
} from "../services/billing-catalog.service.mjs";

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

test("billing is ready only when payments, credits and required secrets are configured", () => {
  const ready = billingConfiguration(configuredEnv());
  assert.equal(ready.checkoutReady, true);
  assert.equal(ready.webhookReady, true);

  const missingCredits = billingConfiguration(
    configuredEnv({ AUDITA_CREDITS_ENABLED: "false" }),
  );
  assert.equal(missingCredits.checkoutReady, false);
  assert.ok(missingCredits.missing.includes("AUDITA_CREDITS_ENABLED"));
});

test("public catalog exposes commercial rules without Stripe price IDs", () => {
  const catalog = getPublicBillingCatalog(configuredEnv());
  const professional = catalog.plans.find((plan) => plan.id === "profissional");

  assert.equal(catalog.billing.checkoutReady, true);
  assert.equal(professional.monthlyCredits, 150);
  assert.equal(professional.annualCredits, 1800);
  assert.equal(professional.prices.monthly.cents, 14990);
  assert.equal(professional.prices.monthly.checkoutAvailable, true);
  assert.equal(JSON.stringify(catalog).includes("price_professional_month"), false);
});

test("annual subscription selection grants twelve monthly credit allowances", () => {
  const selection = resolveBillingSelection(
    { kind: "subscription", planId: "essencial", interval: "annual" },
    configuredEnv(),
  );

  assert.equal(selection.invalid, undefined);
  assert.equal(selection.priceId, "price_essential_year");
  assert.equal(selection.credits, 360);
  assert.equal(selection.monthlyCredits, 30);
});

test("credit pack selection resolves its configured Stripe price", () => {
  const selection = resolveBillingSelection(
    { kind: "credit_pack", packId: "creditos-100" },
    configuredEnv(),
  );

  assert.equal(selection.priceId, "price_credits_100");
  assert.equal(selection.credits, 100);
  assert.equal(selection.amount.cents, 12900);
});

test("selection stays unavailable when the corresponding Stripe price is absent", () => {
  const selection = resolveBillingSelection(
    { kind: "subscription", planId: "equipe", interval: "monthly" },
    configuredEnv({ STRIPE_PRICE_TEAM_MONTHLY: "" }),
  );

  assert.deepEqual(selection, {
    unavailable: true,
    reason: "stripe_price_not_configured",
  });
});

test("configured price IDs map back to the commercial product", () => {
  const product = resolveBillingProductFromPrice(
    "price_professional_year",
    configuredEnv(),
  );

  assert.equal(product.id, "profissional");
  assert.equal(product.interval, "annual");
  assert.equal(product.credits, 1800);
});
