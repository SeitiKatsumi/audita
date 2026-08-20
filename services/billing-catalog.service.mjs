const MONTHS_PER_YEAR = 12;

function envValue(env, name) {
  return String(env?.[name] || "").trim();
}

function isStripeSecretKey(value) {
  return /^(?:sk|rk)_(?:test|live)_[A-Za-z0-9_]+$/.test(String(value || "").trim());
}

function isStripeWebhookSecret(value) {
  return /^whsec_[A-Za-z0-9_]+$/.test(String(value || "").trim());
}

function isStripePriceId(value) {
  return /^price_[A-Za-z0-9_]+$/.test(String(value || "").trim());
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function money(cents) {
  return {
    currency: "BRL",
    cents,
  };
}

export const BILLING_PLANS = Object.freeze([
  {
    id: "standard",
    name: "Standard",
    audience: "Para pessoas que querem usar a IA AUDITA",
    description: "Acesso \u00e0 plataforma, \u00e0 IA e \u00e0s ferramentas inclu\u00eddas no plano.",
    kind: "subscription",
    recommended: true,
    monthlyCredits: 0,
    memberLimit: 1,
    prices: {
      monthly: money(19900),
      annual: money(118800),
    },
    priceEnv: {
      monthly: "STRIPE_PRICE_STANDARD_MONTHLY",
      annual: "STRIPE_PRICE_STANDARD_ANNUAL",
    },
    features: [
      "Uso da plataforma IA AUDITA",
      "Chat com a IA AUDITA",
      "An\u00e1lise de documentos e cobran\u00e7as Ita\u00fa",
      "Simula\u00e7\u00e3o, relat\u00f3rio e orienta\u00e7\u00e3o de pr\u00f3ximos passos",
      "Ferramentas inclu\u00eddas conforme disponibilidade",
    ],
    annualBenefits: [
      "Suporte de advogado parceiro para o caso Ita\u00fa inclu\u00eddo",
    ],
  },
]);

export const CREDIT_PACKS = Object.freeze([
  {
    id: "creditos-25",
    name: "25 creditos",
    credits: 25,
    price: money(3900),
    priceEnv: "STRIPE_PRICE_CREDITS_25",
  },
  {
    id: "creditos-100",
    name: "100 creditos",
    credits: 100,
    price: money(12900),
    priceEnv: "STRIPE_PRICE_CREDITS_100",
    recommended: true,
  },
  {
    id: "creditos-500",
    name: "500 creditos",
    credits: 500,
    price: money(49900),
    priceEnv: "STRIPE_PRICE_CREDITS_500",
  },
]);

export const ITAU_CHARGE_SERVICE_TIERS = Object.freeze([
  {
    id: "itau-cobrancas-faixa-1",
    name: "Faixa 1",
    minimumClaimCents: 0,
    maximumClaimCents: 1000000,
    discountPercent: 50,
    fullPrice: money(39800),
    price: money(19900),
    priceEnv: "STRIPE_PRICE_ITAU_CHARGE_TIER_1",
  },
  {
    id: "itau-cobrancas-faixa-2",
    name: "Faixa 2",
    minimumClaimCents: 1000001,
    maximumClaimCents: 2000000,
    discountPercent: 40,
    fullPrice: money(66500),
    price: money(39900),
    priceEnv: "STRIPE_PRICE_ITAU_CHARGE_TIER_2",
  },
  {
    id: "itau-cobrancas-faixa-3",
    name: "Faixa 3",
    minimumClaimCents: 2000001,
    maximumClaimCents: 3242000,
    discountPercent: 30,
    fullPrice: money(85571),
    price: money(59900),
    priceEnv: "STRIPE_PRICE_ITAU_CHARGE_TIER_3",
  },
]);

export function billingConfiguration(env = process.env) {
  const billingFlag = envValue(env, "AUDITA_BILLING_ENABLED").toLowerCase() === "true";
  const demoMode = envValue(env, "AUDITA_BILLING_DEMO_MODE").toLowerCase() === "true";
  const creditsFlag = envValue(env, "AUDITA_CREDITS_ENABLED").toLowerCase() === "true";
  const secretKey = envValue(env, "STRIPE_SECRET_KEY");
  const webhookSecret = envValue(env, "STRIPE_WEBHOOK_SECRET");
  const appUrl = envValue(env, "APP_URL");
  const secretReady = isStripeSecretKey(secretKey);
  const webhookSecretReady = isStripeWebhookSecret(webhookSecret);
  const appUrlReady = isHttpUrl(appUrl);

  return {
    enabled: billingFlag,
    demoMode,
    checkoutReady: Boolean(billingFlag && secretReady && appUrlReady),
    webhookReady: Boolean(billingFlag && secretReady && webhookSecretReady),
    creditsEnabled: creditsFlag,
    provider: "stripe",
    appUrl,
    stripeMode: secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_")
      ? "live"
      : secretReady
        ? "test"
        : "not_configured",
    missing: [
      !billingFlag ? "AUDITA_BILLING_ENABLED" : "",
      !secretReady ? "STRIPE_SECRET_KEY" : "",
      !webhookSecretReady ? "STRIPE_WEBHOOK_SECRET" : "",
      !appUrlReady ? "APP_URL" : "",
    ].filter(Boolean),
  };
}

function publicPrice(price) {
  if (!price) return null;
  return {
    currency: price.currency,
    cents: price.cents,
  };
}

function publicPlan(plan, env, configuration) {
  const prices = {};
  const demoMode = envValue(env, "AUDITA_BILLING_DEMO_MODE").toLowerCase() === "true";
  for (const interval of ["monthly", "annual"]) {
    const price = plan.prices?.[interval];
    const stripePriceId = plan.priceEnv?.[interval]
      ? envValue(env, plan.priceEnv[interval])
      : "";
    const stripeConfigured = isStripePriceId(stripePriceId);
    prices[interval] = price
      ? {
          ...publicPrice(price),
          checkoutAvailable:
            plan.kind === "free" ||
            demoMode ||
            Boolean(configuration.checkoutReady && stripeConfigured),
          stripeConfigured,
        }
      : null;
  }

  return {
    id: plan.id,
    name: plan.name,
    audience: plan.audience,
    description: plan.description,
    kind: plan.kind,
    recommended: Boolean(plan.recommended),
    monthlyCredits: plan.monthlyCredits,
    annualCredits:
      Number.isInteger(plan.monthlyCredits) && plan.monthlyCredits > 0
        ? plan.monthlyCredits * MONTHS_PER_YEAR
        : plan.monthlyCredits,
    memberLimit: plan.memberLimit,
    prices,
    features: [...plan.features],
    annualBenefits: [...(plan.annualBenefits || [])],
  };
}

function publicPack(pack, env, configuration) {
  const stripeConfigured = isStripePriceId(envValue(env, pack.priceEnv));
  return {
    id: pack.id,
    name: pack.name,
    credits: pack.credits,
    price: publicPrice(pack.price),
    recommended: Boolean(pack.recommended),
    stripeConfigured,
    checkoutAvailable: Boolean(
      configuration.checkoutReady && configuration.creditsEnabled && stripeConfigured,
    ),
  };
}

function publicItauTier(tier, env, configuration) {
  const stripeConfigured = isStripePriceId(envValue(env, tier.priceEnv));
  return {
    id: tier.id,
    name: tier.name,
    minimumClaimCents: tier.minimumClaimCents,
    maximumClaimCents: tier.maximumClaimCents,
    discountPercent: tier.discountPercent,
    fullPrice: publicPrice(tier.fullPrice),
    price: publicPrice(tier.price),
    stripeConfigured,
    checkoutAvailable: Boolean(configuration.checkoutReady && stripeConfigured),
  };
}

export function resolveItauChargeServiceTier(claimAmountCents) {
  const amount = Number(claimAmountCents);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return ITAU_CHARGE_SERVICE_TIERS.find(
    (tier) => amount >= tier.minimumClaimCents && amount <= tier.maximumClaimCents,
  ) || null;
}

export function getPublicBillingCatalog(env = process.env) {
  const configuration = billingConfiguration(env);
  return {
    currency: "BRL",
    model: "subscription_with_credits",
    billing: {
      enabled: configuration.enabled,
      checkoutReady: configuration.checkoutReady,
      provider: configuration.provider,
      demoMode: configuration.demoMode,
    },
    rules: {
      includedCreditsRenew: "billing_cycle",
      includedCreditsRollover: false,
      paidOperationsRequireConfirmation: true,
      legalServicesIncluded: false,
      annualItauLegalSupportIncluded: true,
      legalRepresentationIncluded: false,
    },
    plans: BILLING_PLANS.map((plan) => publicPlan(plan, env, configuration)),
    creditPacks: CREDIT_PACKS.map((pack) => publicPack(pack, env, configuration)),
    itauChargeService: {
      kind: "itau_charge_service",
      name: "Análise de cobranças indevidas Itaú",
      billingType: "one_time",
      tiers: ITAU_CHARGE_SERVICE_TIERS.map((tier) =>
        publicItauTier(tier, env, configuration),
      ),
    },
  };
}

export function resolveBillingSelection(input = {}, env = process.env) {
  const kind = String(input.kind || "subscription").trim();
  if (kind === "subscription") {
    const planId = String(input.planId || "").trim();
    const interval = String(input.interval || "monthly").trim();
    const plan = BILLING_PLANS.find((candidate) => candidate.id === planId);
    if (!plan || plan.kind !== "subscription" || !["monthly", "annual"].includes(interval)) {
      return { invalid: true, reason: "invalid_subscription_selection" };
    }
    const priceId = envValue(env, plan.priceEnv[interval]);
    if (!isStripePriceId(priceId)) {
      return { unavailable: true, reason: "stripe_price_not_configured" };
    }
    return {
      kind,
      id: plan.id,
      interval,
      priceId,
      credits:
        interval === "annual"
          ? plan.monthlyCredits * MONTHS_PER_YEAR
          : plan.monthlyCredits,
      monthlyCredits: plan.monthlyCredits,
      memberLimit: plan.memberLimit,
      amount: plan.prices[interval],
    };
  }

  if (kind === "credit_pack") {
    const packId = String(input.packId || "").trim();
    const pack = CREDIT_PACKS.find((candidate) => candidate.id === packId);
    if (!pack) {
      return { invalid: true, reason: "invalid_credit_pack_selection" };
    }
    const priceId = envValue(env, pack.priceEnv);
    if (!isStripePriceId(priceId)) {
      return { unavailable: true, reason: "stripe_price_not_configured" };
    }
    return {
      kind,
      id: pack.id,
      priceId,
      credits: pack.credits,
      amount: pack.price,
    };
  }

  if (kind === "itau_charge_service") {
    const tierId = String(input.tierId || "").trim();
    const tier = ITAU_CHARGE_SERVICE_TIERS.find((candidate) => candidate.id === tierId);
    if (!tier) return { invalid: true, reason: "invalid_itau_service_tier" };
    const priceId = envValue(env, tier.priceEnv);
    if (!isStripePriceId(priceId)) {
      return { unavailable: true, reason: "stripe_price_not_configured" };
    }
    return {
      kind,
      id: tier.id,
      priceId,
      credits: 0,
      amount: tier.price,
      fullPrice: tier.fullPrice,
      discountPercent: tier.discountPercent,
      minimumClaimCents: tier.minimumClaimCents,
      maximumClaimCents: tier.maximumClaimCents,
    };
  }

  return { invalid: true, reason: "invalid_purchase_kind" };
}

export function resolveBillingProductFromPrice(priceId, env = process.env) {
  const normalizedPriceId = String(priceId || "").trim();
  if (!normalizedPriceId) return null;

  for (const plan of BILLING_PLANS) {
    if (plan.kind !== "subscription") continue;
    for (const interval of ["monthly", "annual"]) {
      if (envValue(env, plan.priceEnv[interval]) === normalizedPriceId) {
        return resolveBillingSelection(
          { kind: "subscription", planId: plan.id, interval },
          env,
        );
      }
    }
  }

  for (const pack of CREDIT_PACKS) {
    if (envValue(env, pack.priceEnv) === normalizedPriceId) {
      return resolveBillingSelection({ kind: "credit_pack", packId: pack.id }, env);
    }
  }


  for (const tier of ITAU_CHARGE_SERVICE_TIERS) {
    if (envValue(env, tier.priceEnv) === normalizedPriceId) {
      return resolveBillingSelection(
        { kind: "itau_charge_service", tierId: tier.id },
        env,
      );
    }
  }

  return null;
}
