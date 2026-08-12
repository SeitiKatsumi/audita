import {
  billingConfiguration,
  getPublicBillingCatalog,
} from "./billing-catalog.service.mjs";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

function text(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function envEnabled(env, name) {
  return text(env?.[name]).toLowerCase() === "true";
}

function publicSubscription(row = {}) {
  return {
    id: text(row.provider_subscription_id),
    provider: text(row.provider, "stripe"),
    tenantId: text(row.tenant_id),
    tenantName: text(row.tenant_name, "Organizacao"),
    customerEmail: text(row.customer_email),
    planId: text(row.plan_id),
    interval: text(row.billing_interval),
    status: text(row.status, "inactive"),
    monthlyCredits: positiveInteger(row.monthly_credits, 0),
    creditBalance: positiveInteger(row.credit_balance, 0),
    memberLimit: positiveInteger(row.member_limit, 0),
    currentPeriodEnd: row.current_period_end || null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    updatedAt: row.updated_at || null,
  };
}

function publicEvent(row = {}) {
  return {
    type: text(row.event_type),
    status: text(row.status),
    tenantName: text(row.tenant_name, "Sem organizacao associada"),
    eventCreatedAt: row.event_created_at || null,
    processedAt: row.processed_at || null,
    hasError: Boolean(text(row.error_message)),
  };
}

function getCommercialOperations(env = process.env) {
  const onrEnabled = envEnabled(env, "ONR_WSRIDIGITAL_ENABLED");
  return [
    {
      id: "state_certificate",
      category: "Certid\u00f5es",
      name: "Certid\u00e3o estadual",
      provider: "Direct Data",
      billingMode: "per_query",
      credits: positiveInteger(env.DIRECT_DATA_CERTIFICATE_CREDIT_COST, 1),
      enabled: envEnabled(env, "DIRECT_DATA_CERTIFICATE_ENABLED"),
      availability: "27 UFs conforme produto contratado",
    },
    {
      id: "court_monitoring",
      category: "Processos",
      name: "Consulta e acompanhamento processual",
      provider: "Direct Data",
      billingMode: "per_query",
      credits: positiveInteger(env.DIRECT_DATA_TJ_CREDIT_COST, 1),
      enabled: envEnabled(env, "DIRECT_DATA_TJ_ENABLED"),
      availability: "Cobertura conforme endpoint do provedor",
    },
    {
      id: "property_prior_search",
      category: "Imoveis",
      name: "Pesquisa pr\u00e9via de im\u00f3veis",
      provider: "ONR / RI Digital",
      billingMode: "per_query",
      credits: positiveInteger(env.AUDITA_PROPERTY_CREDITS_PESQUISA_PREVIA, 1),
      enabled: onrEnabled,
      availability: "UFs participantes do RI Digital",
    },
    {
      id: "property_qualified_search",
      category: "Imoveis",
      name: "Pesquisa qualificada",
      provider: "ONR / RI Digital",
      billingMode: "per_query",
      credits: positiveInteger(env.AUDITA_PROPERTY_CREDITS_PESQUISA_QUALIFICADA, 2),
      enabled: onrEnabled,
      availability: "Cartorios habilitados",
    },
    {
      id: "property_certificate",
      category: "Imoveis",
      name: "Certid\u00e3o digital de matr\u00edcula",
      provider: "ONR / RI Digital",
      billingMode: "per_query",
      credits: positiveInteger(env.AUDITA_PROPERTY_CREDITS_CERTIDAO_DIGITAL, 2),
      enabled: onrEnabled,
      availability: "Cartorios habilitados",
    },
    {
      id: "asset_unavailability",
      category: "Imoveis",
      name: "Indisponibilidade de bens",
      provider: "A definir",
      billingMode: "per_query",
      credits: null,
      enabled: false,
      availability: "Produto ainda sem integra\u00e7\u00e3o oficial ativa",
    },
  ];
}

function planMonthlyValue(plan, interval) {
  const price = plan?.prices?.[interval];
  if (!price?.cents) return 0;
  return interval === "annual"
    ? Math.round(Number(price.cents) / 12)
    : Number(price.cents);
}

function computeSummary(subscriptions, catalog, outstandingCredits, eventCount) {
  const planMap = new Map(catalog.plans.map((plan) => [plan.id, plan]));
  const activeSubscriptions = subscriptions.filter((subscription) =>
    ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status),
  );
  const mrrCents = activeSubscriptions.reduce((total, subscription) => {
    const plan = planMap.get(subscription.planId);
    return total + planMonthlyValue(plan, subscription.interval);
  }, 0);

  return {
    activeSubscriptions: activeSubscriptions.length,
    pastDueSubscriptions: subscriptions.filter(
      (subscription) => subscription.status === "past_due",
    ).length,
    cancelingSubscriptions: subscriptions.filter(
      (subscription) => subscription.cancelAtPeriodEnd,
    ).length,
    mrr: {
      currency: catalog.currency || "BRL",
      cents: mrrCents,
    },
    outstandingCredits: positiveInteger(outstandingCredits, 0),
    processedEvents30d: positiveInteger(eventCount, 0),
  };
}

export function createBillingAdminService({
  getDb,
  env = process.env,
  accessService,
  getSubscription,
} = {}) {
  function database() {
    const state = getDb ? getDb() : {};
    return {
      pool: state?.pool,
      ready: Boolean(state?.pool && state?.dbReady),
    };
  }

  async function getDashboard(authContext = {}) {
    const catalog = getPublicBillingCatalog(env);
    const configuration = billingConfiguration(env);
    const operations = getCommercialOperations(env);
    const { pool, ready } = database();

    let subscriptions = [];
    let recentEvents = [];
    let outstandingCredits = 0;
    let processedEvents30d = 0;
    let users = accessService ? await accessService.listUsers(authContext) : [];
    const scopeTenantId = authContext?.user?.role === "super_admin"
      ? ""
      : text(authContext?.tenantId);

    if (ready) {
      const [
        subscriptionsResult,
        eventsResult,
        walletResult,
        eventCountResult,
      ] = await Promise.all([
        pool.query(
          `SELECT
             s.*,
             t.name AS tenant_name,
             bc.customer_email,
             COALESCE(w.balance, 0)::int AS credit_balance
           FROM audita_subscriptions s
           INNER JOIN audita_tenants t ON t.id = s.tenant_id
           LEFT JOIN audita_billing_customers bc ON bc.tenant_id = s.tenant_id
           LEFT JOIN audita_credit_wallets w ON w.tenant_id = s.tenant_id
           WHERE ($1::text = '' OR s.tenant_id::text = $1)
           ORDER BY
             CASE WHEN s.status IN ('active', 'trialing', 'past_due') THEN 0 ELSE 1 END,
             s.updated_at DESC
           LIMIT 200`,
          [scopeTenantId],
        ),
        pool.query(
          `SELECT
             be.event_type,
             be.status,
             be.event_created_at,
             be.processed_at,
             be.error_message,
             t.name AS tenant_name
           FROM audita_billing_events be
           LEFT JOIN audita_tenants t ON t.id = be.tenant_id
           WHERE ($1::text = '' OR be.tenant_id::text = $1)
           ORDER BY COALESCE(be.event_created_at, be.created_at) DESC
           LIMIT 20`,
          [scopeTenantId],
        ),
        pool.query(
          `SELECT COALESCE(SUM(balance), 0)::int AS outstanding_credits
           FROM audita_credit_wallets
           WHERE ($1::text = '' OR tenant_id::text = $1)`,
          [scopeTenantId],
        ),
        pool.query(
          `SELECT COUNT(*)::int AS total
           FROM audita_billing_events
           WHERE status = 'processed'
             AND ($1::text = '' OR tenant_id::text = $1)
             AND created_at >= NOW() - INTERVAL '30 days'`,
          [scopeTenantId],
        ),
      ]);
      subscriptions = subscriptionsResult.rows.map(publicSubscription);
      recentEvents = eventsResult.rows.map(publicEvent);
      outstandingCredits = walletResult.rows[0]?.outstanding_credits || 0;
      processedEvents30d = eventCountResult.rows[0]?.total || 0;
    } else if (getSubscription) {
      const subscriptionsByTenant = new Map();
      users = await Promise.all(users.map(async (user) => {
        let subscription = subscriptionsByTenant.get(user.tenantId);
        if (subscription === undefined) {
          subscription = await getSubscription(user.tenantId);
          subscriptionsByTenant.set(user.tenantId, subscription || null);
        }
        return { ...user, subscription: subscription || null };
      }));
      subscriptions = [...subscriptionsByTenant.entries()]
        .filter(([, subscription]) => subscription)
        .map(([tenantId, subscription]) => {
          const owner = users.find((user) => user.tenantId === tenantId);
          return {
            ...subscription,
            tenantId,
            tenantName: owner?.tenantName || "Ambiente local",
            customerEmail: owner?.email || "",
            creditBalance: 0,
          };
        });
    }

    const configuredPlanPrices = catalog.plans
      .filter((plan) => plan.kind === "subscription")
      .reduce(
        (total, plan) =>
          total +
          ["monthly", "annual"].filter(
            (interval) => plan.prices?.[interval]?.stripeConfigured,
          ).length,
        0,
      );
    const configuredCreditPacks = catalog.creditPacks.filter(
      (pack) => pack.checkoutAvailable,
    ).length;

    return {
      generatedAt: new Date().toISOString(),
      databaseReady: ready,
      configuration: {
        billingEnabled: configuration.enabled,
        demoMode: configuration.demoMode,
        creditsEnabled: configuration.creditsEnabled,
        checkoutReady: configuration.checkoutReady,
        webhookReady: configuration.webhookReady,
        stripeMode: text(env.STRIPE_SECRET_KEY).startsWith("sk_live_")
          ? "live"
          : text(env.STRIPE_SECRET_KEY)
            ? "test"
            : "not_configured",
        configuredPlanPrices,
        expectedPlanPrices: 2,
        configuredCreditPacks,
        expectedCreditPacks: catalog.creditPacks.length,
        missing: [...configuration.missing],
      },
      summary: computeSummary(
        subscriptions,
        catalog,
        outstandingCredits,
        processedEvents30d,
      ),
      catalog,
      operations,
      subscriptions,
      users,
      recentEvents,
    };
  }

  return { getDashboard };
}

export { getCommercialOperations };
