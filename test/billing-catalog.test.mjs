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
    STRIPE_PRICE_STANDARD_MONTHLY: "price_standard_month",
    STRIPE_PRICE_STANDARD_ANNUAL: "price_standard_year",
    STRIPE_PRICE_CREDITS_25: "price_credits_25",
    STRIPE_PRICE_CREDITS_100: "price_credits_100",
    STRIPE_PRICE_CREDITS_500: "price_credits_500",
    ...overrides,
  };
}

test("billing readiness depends on Stripe, not the optional credit wallet", () => {
  const ready = billingConfiguration(configuredEnv());
  assert.equal(ready.checkoutReady, true);
  assert.equal(ready.webhookReady, true);

  const creditsDisabled = billingConfiguration(
    configuredEnv({ AUDITA_CREDITS_ENABLED: "false" }),
  );
  assert.equal(creditsDisabled.checkoutReady, true);

  const missingSecret = billingConfiguration(configuredEnv({ STRIPE_SECRET_KEY: "" }));
  assert.equal(missingSecret.checkoutReady, false);
  assert.ok(missingSecret.missing.includes("STRIPE_SECRET_KEY"));
});

test("placeholder Stripe credentials never make billing ready", () => {
  const configuration = billingConfiguration(
    configuredEnv({
      STRIPE_SECRET_KEY: "change-me",
      STRIPE_WEBHOOK_SECRET: "change-me",
      APP_URL: "not-a-url",
    }),
  );

  assert.equal(configuration.checkoutReady, false);
  assert.equal(configuration.webhookReady, false);
  assert.equal(configuration.stripeMode, "not_configured");
  assert.deepEqual(configuration.missing, [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "APP_URL",
  ]);
});

test("public catalog exposes the Standard monthly and annual offer", () => {
  const catalog = getPublicBillingCatalog(configuredEnv());
  const standard = catalog.plans.find((plan) => plan.id === "standard");

  assert.equal(catalog.billing.checkoutReady, true);
  assert.equal(catalog.plans.length, 1);
  assert.equal(standard.prices.monthly.cents, 19900);
  assert.equal(standard.prices.annual.cents, 118800);
  assert.equal(standard.prices.monthly.checkoutAvailable, true);
  assert.equal(catalog.creditPacks[0].checkoutAvailable, true);
  assert.match(standard.annualBenefits[0], /advogado parceiro/);
  assert.equal(catalog.rules.annualItauLegalSupportIncluded, true);
  assert.equal(catalog.rules.legalRepresentationIncluded, false);
  assert.equal(JSON.stringify(catalog).includes("price_standard_month"), false);
});

test("demo catalog exposes checkout without claiming Stripe readiness", () => {
  const catalog = getPublicBillingCatalog({ AUDITA_BILLING_DEMO_MODE: "true" });
  const standard = catalog.plans[0];
  assert.equal(catalog.billing.demoMode, true);
  assert.equal(catalog.billing.checkoutReady, false);
  assert.equal(standard.prices.monthly.checkoutAvailable, true);
  assert.equal(standard.prices.monthly.stripeConfigured, false);
});

test("annual Standard selection resolves the annual charge", () => {
  const selection = resolveBillingSelection(
    { kind: "subscription", planId: "standard", interval: "annual" },
    configuredEnv(),
  );

  assert.equal(selection.invalid, undefined);
  assert.equal(selection.priceId, "price_standard_year");
  assert.equal(selection.amount.cents, 118800);
  assert.equal(selection.monthlyCredits, 0);
});

test("credit pack selection remains available for future paid tools", () => {
  const selection = resolveBillingSelection(
    { kind: "credit_pack", packId: "creditos-100" },
    configuredEnv(),
  );
  assert.equal(selection.priceId, "price_credits_100");
  assert.equal(selection.credits, 100);
});

test("credit packs stay visible but cannot be purchased while credits are disabled", () => {
  const catalog = getPublicBillingCatalog(
    configuredEnv({ AUDITA_CREDITS_ENABLED: "false" }),
  );

  assert.equal(catalog.creditPacks[0].stripeConfigured, true);
  assert.equal(catalog.creditPacks[0].checkoutAvailable, false);
});

test("missing Standard price prevents real checkout", () => {
  const selection = resolveBillingSelection(
    { kind: "subscription", planId: "standard", interval: "monthly" },
    configuredEnv({ STRIPE_PRICE_STANDARD_MONTHLY: "" }),
  );
  assert.deepEqual(selection, {
    unavailable: true,
    reason: "stripe_price_not_configured",
  });
});

test("configured price maps back to Standard", () => {
  const product = resolveBillingProductFromPrice(
    "price_standard_year",
    configuredEnv(),
  );
  assert.equal(product.id, "standard");
  assert.equal(product.interval, "annual");
});
