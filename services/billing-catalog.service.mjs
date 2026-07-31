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
    id: "explorar",
    name: "Explorar",
    audience: "Para conhecer a Audita",
    description: "Converse com a IA e entenda quais consultas podem ajudar no seu caso.",
    kind: "free",
    monthlyCredits: 0,
    memberLimit: 1,
    prices: {
      monthly: money(0),
      annual: money(0),
    },
    features: [
      "Acesso ao chat da Audita",
      "Orienta\u00e7\u00e3o inicial sobre consultas",
      "Sem consultas pagas inclu\u00eddas",
    ],
  },
  {
    id: "essencial",
    name: "Essencial",
    audience: "Para uso individual",
    description: "An\u00e1lises e consultas pontuais com previsibilidade de custo.",
    kind: "subscription",
    monthlyCredits: 30,
    memberLimit: 1,
    prices: {
      monthly: money(4990),
      annual: money(49900),
    },
    priceEnv: {
      monthly: "STRIPE_PRICE_ESSENTIAL_MONTHLY",
      annual: "STRIPE_PRICE_ESSENTIAL_ANNUAL",
    },
    features: [
      "30 cr\u00e9ditos por m\u00eas",
      "1 usu\u00e1rio",
      "Chat jur\u00eddico e an\u00e1lise de documentos",
      "Certid\u00f5es e consultas por cr\u00e9dito",
      "Hist\u00f3rico das an\u00e1lises",
    ],
  },
  {
    id: "profissional",
    name: "Profissional",
    audience: "Para profissionais e pequenos escrit\u00f3rios",
    description: "Mais volume, colabora\u00e7\u00e3o e controle do consumo da equipe.",
    kind: "subscription",
    recommended: true,
    monthlyCredits: 150,
    memberLimit: 3,
    prices: {
      monthly: money(14990),
      annual: money(149900),
    },
    priceEnv: {
      monthly: "STRIPE_PRICE_PROFESSIONAL_MONTHLY",
      annual: "STRIPE_PRICE_PROFESSIONAL_ANNUAL",
    },
    features: [
      "150 cr\u00e9ditos por m\u00eas",
      "At\u00e9 3 usu\u00e1rios",
      "Tudo do Essencial",
      "Gest\u00e3o de consumo por usu\u00e1rio",
      "Exporta\u00e7\u00e3o de relat\u00f3rios e peti\u00e7\u00f5es",
      "Suporte prioritario",
    ],
  },
  {
    id: "equipe",
    name: "Equipe",
    audience: "Para opera\u00e7\u00f5es jur\u00eddicas",
    description: "Capacidade compartilhada para equipes com consultas recorrentes.",
    kind: "subscription",
    monthlyCredits: 500,
    memberLimit: 10,
    prices: {
      monthly: money(39990),
      annual: money(399900),
    },
    priceEnv: {
      monthly: "STRIPE_PRICE_TEAM_MONTHLY",
      annual: "STRIPE_PRICE_TEAM_ANNUAL",
    },
    features: [
      "500 cr\u00e9ditos por m\u00eas",
      "At\u00e9 10 usu\u00e1rios",
      "Tudo do Profissional",
      "Administra\u00e7\u00e3o centralizada",
      "Relat\u00f3rios de consumo da equipe",
      "Prioridade nas filas de processamento",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    audience: "Para alto volume e integra\u00e7\u00f5es",
    description: "Contrato sob medida, SLA e integra\u00e7\u00e3o com os processos da empresa.",
    kind: "contact",
    monthlyCredits: null,
    memberLimit: null,
    prices: {
      monthly: null,
      annual: null,
    },
    features: [
      "Volume de cr\u00e9ditos personalizado",
      "Usu\u00e1rios e unidades sob medida",
      "API e integra\u00e7\u00f5es dedicadas",
      "SLA, seguran\u00e7a e governan\u00e7a",
      "Onboarding acompanhado",
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
  const creditsFlag = envValue(env, "AUDITA_CREDITS_ENABLED").toLowerCase() === "true";
  const secretKey = envValue(env, "STRIPE_SECRET_KEY");
  const webhookSecret = envValue(env, "STRIPE_WEBHOOK_SECRET");
  const appUrl = envValue(env, "APP_URL");

  return {
    enabled: billingFlag,
    checkoutReady: Boolean(billingFlag && creditsFlag && secretKey && appUrl),
    webhookReady: Boolean(billingFlag && creditsFlag && secretKey && webhookSecret),
    creditsEnabled: creditsFlag,
    provider: "stripe",
    appUrl,
    missing: [
      !billingFlag ? "AUDITA_BILLING_ENABLED" : "",
      !creditsFlag ? "AUDITA_CREDITS_ENABLED" : "",
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
  for (const interval of ["monthly", "annual"]) {
    const price = plan.prices?.[interval];
    const stripePriceId = plan.priceEnv?.[interval]
      ? envValue(env, plan.priceEnv[interval])
      : "";
    prices[interval] = price
      ? {
          ...publicPrice(price),
          checkoutAvailable: plan.kind === "free" || Boolean(stripePriceId),
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
    },
    rules: {
      includedCreditsRenew: "billing_cycle",
      includedCreditsRollover: false,
      paidOperationsRequireConfirmation: true,
      legalServicesIncluded: false,
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
