const MONTHS_PER_YEAR = 12;

function envValue(env, name) {
  return String(env?.[name] || "").trim();
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
    audience: "Para pessoas que querem usar a Audita",
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
      "Uso da plataforma Audita",
      "Chat com a IA Audita",
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

export function billingConfiguration(env = process.env) {
  const billingFlag = envValue(env, "AUDITA_BILLING_ENABLED").toLowerCase() === "true";
  const demoMode = envValue(env, "AUDITA_BILLING_DEMO_MODE").toLowerCase() === "true";
  const creditsFlag = envValue(env, "AUDITA_CREDITS_ENABLED").toLowerCase() === "true";
  const secretKey = envValue(env, "STRIPE_SECRET_KEY");
  const webhookSecret = envValue(env, "STRIPE_WEBHOOK_SECRET");
  const appUrl = envValue(env, "APP_URL");

  return {
    enabled: billingFlag,
    demoMode,
    checkoutReady: Boolean(billingFlag && secretKey && appUrl),
    webhookReady: Boolean(billingFlag && secretKey && webhookSecret),
    creditsEnabled: creditsFlag,
    provider: "stripe",
    appUrl,
    missing: [
      !billingFlag ? "AUDITA_BILLING_ENABLED" : "",
      !secretKey ? "STRIPE_SECRET_KEY" : "",
      !webhookSecret ? "STRIPE_WEBHOOK_SECRET" : "",
      !appUrl ? "APP_URL" : "",
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

function publicPlan(plan, env) {
  const prices = {};
  const demoMode = envValue(env, "AUDITA_BILLING_DEMO_MODE").toLowerCase() === "true";
  for (const interval of ["monthly", "annual"]) {
    const price = plan.prices?.[interval];
    const stripePriceId = plan.priceEnv?.[interval]
      ? envValue(env, plan.priceEnv[interval])
      : "";
    prices[interval] = price
      ? {
          ...publicPrice(price),
          checkoutAvailable: plan.kind === "free" || demoMode || Boolean(stripePriceId),
          stripeConfigured: Boolean(stripePriceId),
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

function publicPack(pack, env) {
  return {
    id: pack.id,
    name: pack.name,
    credits: pack.credits,
    price: publicPrice(pack.price),
    recommended: Boolean(pack.recommended),
    checkoutAvailable: Boolean(envValue(env, pack.priceEnv)),
  };
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
    plans: BILLING_PLANS.map((plan) => publicPlan(plan, env)),
    creditPacks: CREDIT_PACKS.map((pack) => publicPack(pack, env)),
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
    if (!priceId) {
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
    if (!priceId) {
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

  return null;
}
