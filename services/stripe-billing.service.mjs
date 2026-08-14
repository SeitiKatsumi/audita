import crypto from "node:crypto";

import {
  billingConfiguration,
  getPublicBillingCatalog,
  resolveBillingProductFromPrice,
  resolveBillingSelection,
} from "./billing-catalog.service.mjs";

const STRIPE_API_BASE_URL = "https://api.stripe.com";
const STRIPE_API_VERSION = "2026-06-24.dahlia";
const STRIPE_INTEGRATION_IDENTIFIER = "audita_checkout_kmqrvzdp";
const WEBHOOK_TOLERANCE_SECONDS = 300;
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

function text(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function integer(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function timestampToIso(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0
    ? new Date(timestamp * 1000).toISOString()
    : null;
}

function normalizeAppUrl(value) {
  try {
    const url = new URL(text(value));
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.origin;
  } catch {
    return "";
  }
}

function safeMetadata(metadata = {}) {
  return {
    purchaseKind: text(metadata.purchase_kind ?? metadata.purchaseKind),
    planId: text(metadata.plan_id ?? metadata.planId),
    interval: text(metadata.interval),
    creditPackId: text(metadata.credit_pack_id ?? metadata.creditPackId),
    credits: Math.max(0, integer(metadata.credits)),
  };
}

function flattenStripeParams(params, prefix = "", output = new URLSearchParams()) {
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === "") continue;
    const field = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === "object") {
          flattenStripeParams(item, `${field}[${index}]`, output);
        } else if (item !== undefined && item !== null) {
          output.append(`${field}[${index}]`, String(item));
        }
      });
    } else if (typeof value === "object") {
      flattenStripeParams(value, field, output);
    } else {
      output.append(field, String(value));
    }
  }
  return output;
}

function stripeErrorMessage(payload, fallback) {
  return text(payload?.error?.message || payload?.message || fallback);
}

export class StripeBillingError extends Error {
  constructor(code, message, statusCode = 500) {
    super(message);
    this.name = "StripeBillingError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function verifyStripeWebhookSignature(
  rawBody,
  signatureHeader,
  endpointSecret,
  { now = () => Date.now(), toleranceSeconds = WEBHOOK_TOLERANCE_SECONDS } = {},
) {
  const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ""), "utf8");
  const signature = text(signatureHeader);
  const secret = text(endpointSecret);
  if (!payload.length || !signature || !secret) {
    throw new StripeBillingError(
      "invalid_webhook_signature",
      "Webhook Stripe sem corpo, assinatura ou segredo.",
      400,
    );
  }

  const values = signature.split(",").reduce(
    (result, entry) => {
      const [key, value] = entry.split("=", 2);
      if (key === "t") result.timestamp = Number(value);
      if (key === "v1" && value) result.signatures.push(value);
      return result;
    },
    { timestamp: 0, signatures: [] },
  );
  if (!Number.isFinite(values.timestamp) || values.timestamp <= 0 || !values.signatures.length) {
    throw new StripeBillingError(
      "invalid_webhook_signature",
      "Cabecalho Stripe-Signature invalido.",
      400,
    );
  }

  const ageSeconds = Math.abs(Math.floor(now() / 1000) - values.timestamp);
  if (ageSeconds > toleranceSeconds) {
    throw new StripeBillingError(
      "expired_webhook_signature",
      "Assinatura do webhook Stripe fora da janela permitida.",
      400,
    );
  }

  const signedPayload = Buffer.concat([
    Buffer.from(`${values.timestamp}.`, "utf8"),
    payload,
  ]);
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest();
  const valid = values.signatures.some((candidate) => {
    try {
      const received = Buffer.from(candidate, "hex");
      return received.length === expected.length && crypto.timingSafeEqual(received, expected);
    } catch {
      return false;
    }
  });
  if (!valid) {
    throw new StripeBillingError(
      "invalid_webhook_signature",
      "Assinatura do webhook Stripe nao confere.",
      400,
    );
  }
  return true;
}

function subscriptionIdFromObject(object = {}) {
  return text(
    object.subscription ||
      object.parent?.subscription_details?.subscription ||
      object.subscription_details?.subscription,
  );
}

function customerIdFromObject(object = {}) {
  const customer = object.customer;
  return text(typeof customer === "object" ? customer?.id : customer);
}

function priceIdFromObject(object = {}) {
  const firstItem = object.items?.data?.[0] || object.lines?.data?.[0] || {};
  return text(
    firstItem.price?.id ||
      firstItem.pricing?.price_details?.price ||
      object.plan?.id,
  );
}

function metadataFromObject(object = {}) {
  const firstItem = object.items?.data?.[0] || object.lines?.data?.[0] || {};
  return {
    ...(firstItem.metadata || {}),
    ...(object.parent?.subscription_details?.metadata || {}),
    ...(object.subscription_details?.metadata || {}),
    ...(object.metadata || {}),
  };
}

function tenantIdFromObject(object = {}) {
  const metadata = metadataFromObject(object);
  return text(metadata.audita_tenant_id || object.client_reference_id);
}

function subscriptionPeriod(object = {}) {
  const firstItem = object.items?.data?.[0] || object.lines?.data?.[0] || {};
  return {
    start: timestampToIso(
      object.current_period_start ||
        firstItem.period?.start ||
        object.period_start,
    ),
    end: timestampToIso(
      object.current_period_end ||
        firstItem.period?.end ||
        object.period_end,
    ),
  };
}

function publicSubscription(row = {}) {
  if (!row || !Object.keys(row).length) return null;
  return {
    id: row.provider_subscription_id ?? row.providerSubscriptionId ?? null,
    provider: text(row.provider, "stripe"),
    planId: text(row.plan_id ?? row.planId),
    interval: text(row.billing_interval ?? row.interval),
    status: text(row.status, "inactive"),
    monthlyCredits: Math.max(
      0,
      integer(row.monthly_credits ?? row.monthlyCredits),
    ),
    memberLimit: Math.max(0, integer(row.member_limit ?? row.memberLimit)),
    currentPeriodStart: row.current_period_start ?? row.currentPeriodStart ?? null,
    currentPeriodEnd: row.current_period_end ?? row.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: Boolean(
      row.cancel_at_period_end ?? row.cancelAtPeriodEnd,
    ),
    active: ACTIVE_SUBSCRIPTION_STATUSES.has(text(row.status)),
  };
}

export function createStripeBillingService({
  getDb,
  creditsService,
  accessService,
  fetchImpl = globalThis.fetch,
  env = process.env,
  now = () => Date.now(),
} = {}) {
  const memoryCustomers = new Map();
  const memoryCustomerTenants = new Map();
  const memorySubscriptions = new Map();
  const memoryEvents = new Map();

  function configuration() {
    const base = billingConfiguration(env);
    return {
      ...base,
      appUrl: normalizeAppUrl(base.appUrl),
      apiBaseUrl: text(env.STRIPE_API_BASE_URL) || STRIPE_API_BASE_URL,
      apiVersion: text(env.STRIPE_API_VERSION) || STRIPE_API_VERSION,
      integrationIdentifier:
        text(env.STRIPE_INTEGRATION_IDENTIFIER) || STRIPE_INTEGRATION_IDENTIFIER,
      secretKey: text(env.STRIPE_SECRET_KEY),
      webhookSecret: text(env.STRIPE_WEBHOOK_SECRET),
    };
  }

  function db() {
    const state = getDb ? getDb() : {};
    return {
      pool: state?.pool,
      ready: Boolean(state?.pool && state?.dbReady),
    };
  }

  async function stripeRequest(path, params, { idempotencyKey = "" } = {}) {
    const config = configuration();
    if (!config.secretKey) {
      throw new StripeBillingError(
        "billing_not_configured",
        "A chave secreta da Stripe nao esta configurada.",
        503,
      );
    }
    const response = await fetchImpl(`${config.apiBaseUrl}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.secretKey}`,
        "content-type": "application/x-www-form-urlencoded",
        "stripe-version": config.apiVersion,
        ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
      },
      body: flattenStripeParams(params).toString(),
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }
    if (!response.ok) {
      throw new StripeBillingError(
        "stripe_api_error",
        stripeErrorMessage(payload, `Stripe respondeu HTTP ${response.status}.`),
        response.status >= 400 && response.status < 600 ? response.status : 502,
      );
    }
    return payload;
  }

  async function loadCustomer(tenantId) {
    const tenantKey = text(tenantId);
    const { pool, ready } = db();
    if (!ready) return memoryCustomers.get(tenantKey) || null;
    const result = await pool.query(
      `SELECT stripe_customer_id, customer_email
       FROM audita_billing_customers
       WHERE tenant_id = $1
       LIMIT 1`,
      [tenantId],
    );
    const row = result.rows[0];
    return row
      ? {
          id: row.stripe_customer_id,
          email: row.customer_email,
        }
      : null;
  }

  async function saveCustomer(tenantId, customer) {
    const normalized = {
      id: text(typeof customer === "object" ? customer?.id : customer),
      email: text(typeof customer === "object" ? customer?.email : ""),
    };
    if (!normalized.id) return null;

    const tenantKey = text(tenantId);
    const { pool, ready } = db();
    if (!ready) {
      memoryCustomers.set(tenantKey, normalized);
      memoryCustomerTenants.set(normalized.id, tenantKey);
      return normalized;
    }
    await pool.query(
      `INSERT INTO audita_billing_customers (
         tenant_id, stripe_customer_id, customer_email, created_at, updated_at
       )
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (tenant_id)
       DO UPDATE SET
         stripe_customer_id = EXCLUDED.stripe_customer_id,
         customer_email = COALESCE(NULLIF(EXCLUDED.customer_email, ''), audita_billing_customers.customer_email),
         updated_at = NOW()`,
      [tenantId, normalized.id, normalized.email],
    );
    return normalized;
  }

  async function tenantForCustomer(customerId) {
    const normalized = text(customerId);
    if (!normalized) return "";
    const { pool, ready } = db();
    if (!ready) return memoryCustomerTenants.get(normalized) || "";
    const result = await pool.query(
      `SELECT tenant_id
       FROM audita_billing_customers
       WHERE stripe_customer_id = $1
       LIMIT 1`,
      [normalized],
    );
    return text(result.rows[0]?.tenant_id);
  }

  async function ensureCustomer(authContext) {
    const existing = await loadCustomer(authContext.tenantId);
    if (existing?.id) return existing;

    const created = await stripeRequest(
      "/v1/customers",
      {
        email: text(authContext.user?.email),
        name: text(authContext.user?.name),
        metadata: {
          audita_tenant_id: text(authContext.tenantId),
          audita_user_id: text(authContext.user?.id),
        },
      },
      {
        idempotencyKey: `audita-customer-${text(authContext.tenantId)}`,
      },
    );
    return saveCustomer(authContext.tenantId, created);
  }

  async function saveSubscription(tenantId, subscription = {}) {
    const providerSubscriptionId = text(
      subscription.providerSubscriptionId || subscription.id,
    );
    if (!providerSubscriptionId) return null;
    const normalized = {
      providerSubscriptionId,
      provider: text(subscription.provider, "stripe"),
      planId: text(subscription.planId),
      interval: text(subscription.interval),
      status: text(subscription.status, "inactive"),
      monthlyCredits: Math.max(0, integer(subscription.monthlyCredits)),
      memberLimit: Math.max(0, integer(subscription.memberLimit)),
      currentPeriodStart: subscription.currentPeriodStart || null,
      currentPeriodEnd: subscription.currentPeriodEnd || null,
      cancelAtPeriodEnd: Boolean(subscription.cancelAtPeriodEnd),
    };

    const tenantKey = text(tenantId);
    const { pool, ready } = db();
    if (!ready) {
      memorySubscriptions.set(tenantKey, normalized);
      return publicSubscription(normalized);
    }
    const result = await pool.query(
      `INSERT INTO audita_subscriptions (
         tenant_id, provider, provider_subscription_id, plan_id, billing_interval,
         status, monthly_credits, member_limit, current_period_start,
         current_period_end, cancel_at_period_end, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
       ON CONFLICT (provider_subscription_id)
       DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         provider = EXCLUDED.provider,
         plan_id = EXCLUDED.plan_id,
         billing_interval = EXCLUDED.billing_interval,
         status = EXCLUDED.status,
         monthly_credits = EXCLUDED.monthly_credits,
         member_limit = EXCLUDED.member_limit,
         current_period_start = EXCLUDED.current_period_start,
         current_period_end = EXCLUDED.current_period_end,
         cancel_at_period_end = EXCLUDED.cancel_at_period_end,
         updated_at = NOW()
       RETURNING *`,
      [
        tenantId,
        normalized.provider,
        normalized.providerSubscriptionId,
        normalized.planId,
        normalized.interval,
        normalized.status,
        normalized.monthlyCredits,
        normalized.memberLimit,
        normalized.currentPeriodStart,
        normalized.currentPeriodEnd,
        normalized.cancelAtPeriodEnd,
      ],
    );
    return publicSubscription(result.rows[0]);
  }

  async function loadSubscription(tenantId) {
    const tenantKey = text(tenantId);
    const { pool, ready } = db();
    if (!ready) return publicSubscription(memorySubscriptions.get(tenantKey));
    const result = await pool.query(
      `SELECT *
       FROM audita_subscriptions
       WHERE tenant_id = $1
       ORDER BY
         CASE WHEN status IN ('active', 'trialing', 'past_due') THEN 0 ELSE 1 END,
         updated_at DESC
       LIMIT 1`,
      [tenantId],
    );
    return publicSubscription(result.rows[0]);
  }

  async function claimEvent(event) {
    const eventId = text(event?.id);
    if (!eventId) {
      throw new StripeBillingError("invalid_webhook_event", "Evento Stripe sem ID.", 400);
    }
    const { pool, ready } = db();
    if (!ready) {
      const existing = memoryEvents.get(eventId);
      if (existing && existing.status !== "failed") return { duplicate: true };
      memoryEvents.set(eventId, { status: "processing" });
      return { duplicate: false };
    }
    const inserted = await pool.query(
      `INSERT INTO audita_billing_events (
         provider, provider_event_id, event_type, status, event_created_at, metadata
       )
       VALUES ('stripe', $1, $2, 'processing', $3, $4)
       ON CONFLICT (provider_event_id) DO NOTHING
       RETURNING id`,
      [
        eventId,
        text(event.type),
        timestampToIso(event.created),
        JSON.stringify({
          livemode: Boolean(event.livemode),
          objectId: text(event.data?.object?.id),
        }),
      ],
    );
    if (inserted.rows[0]) return { duplicate: false };
    const retried = await pool.query(
      `UPDATE audita_billing_events
       SET status = 'processing', error_message = NULL, processed_at = NULL
       WHERE provider_event_id = $1 AND status = 'failed'
       RETURNING id`,
      [eventId],
    );
    return { duplicate: !retried.rows[0] };
  }

  async function completeEvent(eventId, status, { tenantId = null, error = "", metadata = {} } = {}) {
    const normalizedId = text(eventId);
    const { pool, ready } = db();
    if (!ready) {
      memoryEvents.set(normalizedId, {
        status,
        tenantId: tenantId ? text(tenantId) : null,
        error: text(error),
        metadata,
      });
      return;
    }
    await pool.query(
      `UPDATE audita_billing_events
       SET tenant_id = $2,
           status = $3,
           error_message = NULLIF($4, ''),
           metadata = metadata || $5::jsonb,
           processed_at = NOW()
       WHERE provider_event_id = $1`,
      [
        normalizedId,
        tenantId || null,
        status,
        text(error),
        JSON.stringify(metadata || {}),
      ],
    );
  }

  async function billingState(authContext) {
    if (!authContext?.tenantId) {
      return { unauthorized: true };
    }
    const config = configuration();
    const subscription = await loadSubscription(authContext.tenantId);
    const access = accessService
      ? await accessService.getEntitlement(authContext, subscription)
      : { entitled: Boolean(subscription?.active), source: subscription?.active ? "subscription" : "none" };
    return {
      billing: {
        enabled: config.enabled,
        checkoutReady: config.checkoutReady && Boolean(config.appUrl),
        demoMode: config.demoMode,
        provider: "stripe",
      },
      subscription,
      access,
      wallet: creditsService
        ? await creditsService.getWallet(authContext)
        : { enabled: false, balance: 0, consumed: 0, reserved: 0, unit: "credito" },
      canManage: ["super_admin", "owner", "admin"].includes(authContext.user?.role),
    };
  }

  async function accessState(authContext) {
    if (!authContext?.tenantId) return { unauthorized: true };
    const subscription = await loadSubscription(authContext.tenantId);
    return accessService
      ? accessService.getEntitlement(authContext, subscription)
      : { entitled: Boolean(subscription?.active), source: subscription?.active ? "subscription" : "none" };
  }

  async function createDemoSubscription(authContext, input = {}) {
    if (!authContext?.tenantId || !authContext?.user) return { unauthorized: true };
    const config = configuration();
    if (!config.demoMode) return { unavailable: true, reason: "billing_demo_disabled" };
    const interval = text(input.interval);
    if (!["monthly", "annual"].includes(interval)) {
      return { invalid: true, reason: "invalid_subscription_selection" };
    }

    if (!["super_admin", "owner", "admin"].includes(authContext.user.role)) {
      if (!accessService?.grantOwnDemoAccess) {
        return { unavailable: true, reason: "billing_demo_access_unavailable" };
      }
      const granted = await accessService.grantOwnDemoAccess(authContext, { interval });
      if (granted.unauthorized || granted.forbidden || granted.invalid || !granted.grant) {
        return {
          unavailable: true,
          reason: granted.reason || "billing_demo_access_failed",
        };
      }
      return {
        demo: true,
        subscription: null,
        access: await accessState(authContext),
      };
    }

    const start = new Date(now());
    const end = new Date(start);
    if (interval === "annual") end.setUTCFullYear(end.getUTCFullYear() + 1);
    else end.setUTCMonth(end.getUTCMonth() + 1);
    const subscription = await saveSubscription(authContext.tenantId, {
      id: `demo:${text(authContext.tenantId)}`,
      provider: "demo",
      planId: "standard",
      interval,
      status: "active",
      monthlyCredits: 0,
      memberLimit: 1,
      currentPeriodStart: start.toISOString(),
      currentPeriodEnd: end.toISOString(),
    });
    return {
      demo: true,
      subscription,
      access: await accessState(authContext),
    };
  }

  async function createCheckoutSession(authContext, input = {}) {
    if (!authContext?.tenantId || !authContext?.user) {
      return { unauthorized: true };
    }
    if (!["super_admin", "owner", "admin"].includes(authContext.user.role)) {
      return { forbidden: true };
    }
    const config = configuration();
    if (!config.checkoutReady || !config.appUrl) {
      return {
        unavailable: true,
        reason: "billing_not_configured",
        missing: config.missing,
      };
    }
    const selection = resolveBillingSelection(input, env);
    if (selection.invalid || selection.unavailable) return selection;
    if (selection.kind === "credit_pack" && !config.creditsEnabled) {
      return {
        unavailable: true,
        reason: "credits_not_enabled",
        missing: ["AUDITA_CREDITS_ENABLED"],
      };
    }

    const customer = await ensureCustomer(authContext);
    const requestId = text(input.requestId) || crypto.randomUUID();
    const commonMetadata = {
      audita_tenant_id: text(authContext.tenantId),
      audita_user_id: text(authContext.user.id),
      purchase_kind: selection.kind,
      plan_id: selection.kind === "subscription" ? selection.id : "",
      credit_pack_id: selection.kind === "credit_pack" ? selection.id : "",
      interval: selection.interval || "",
      credits: String(selection.credits),
    };
    const params = {
      mode: selection.kind === "subscription" ? "subscription" : "payment",
      customer: customer.id,
      client_reference_id: text(authContext.tenantId),
      success_url: `${config.appUrl}/planos?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.appUrl}/planos?checkout=cancelled`,
      locale: "pt-BR",
      billing_address_collection: "required",
      allow_promotion_codes: true,
      integration_identifier: config.integrationIdentifier,
      line_items: [{ price: selection.priceId, quantity: 1 }],
      metadata: commonMetadata,
      ...(selection.kind === "subscription"
        ? {
            subscription_data: {
              metadata: commonMetadata,
            },
          }
        : {
            invoice_creation: { enabled: true },
            payment_intent_data: { metadata: commonMetadata },
          }),
    };
    const session = await stripeRequest("/v1/checkout/sessions", params, {
      idempotencyKey: `audita-checkout-${text(authContext.tenantId)}-${requestId}`,
    });
    if (!session?.url || !session?.id) {
      throw new StripeBillingError(
        "stripe_checkout_invalid",
        "A Stripe nao retornou uma sessao de checkout valida.",
        502,
      );
    }
    return {
      sessionId: session.id,
      url: session.url,
      kind: selection.kind,
      productId: selection.id,
    };
  }

  async function createPortalSession(authContext) {
    if (!authContext?.tenantId || !authContext?.user) return { unauthorized: true };
    if (!["super_admin", "owner", "admin"].includes(authContext.user.role)) {
      return { forbidden: true };
    }
    const config = configuration();
    if (!config.checkoutReady || !config.appUrl) {
      return { unavailable: true, reason: "billing_not_configured" };
    }
    const customer = await loadCustomer(authContext.tenantId);
    if (!customer?.id) return { notFound: true, reason: "billing_customer_not_found" };

    const session = await stripeRequest("/v1/billing_portal/sessions", {
      customer: customer.id,
      return_url: `${config.appUrl}/planos`,
    });
    return session?.url
      ? { url: session.url }
      : { unavailable: true, reason: "billing_portal_unavailable" };
  }

  async function processCheckoutCompleted(object) {
    const customerId = customerIdFromObject(object);
    const tenantId =
      tenantIdFromObject(object) || (await tenantForCustomer(customerId));
    if (!tenantId) return { ignored: true, reason: "tenant_not_resolved" };
    if (customerId) {
      await saveCustomer(tenantId, {
        id: customerId,
        email: object.customer_details?.email || object.customer_email,
      });
    }
    const metadata = safeMetadata(metadataFromObject(object));
    if (metadata.purchaseKind === "credit_pack") {
      if (!["paid", "no_payment_required"].includes(text(object.payment_status))) {
        return { ignored: true, tenantId, reason: "payment_not_completed" };
      }
      const amount = metadata.credits;
      if (!amount || !creditsService) {
        return { ignored: true, tenantId, reason: "credit_grant_unavailable" };
      }
      const grant = await creditsService.grant(
        { tenantId, user: null },
        {
          amount,
          referenceId: `stripe:checkout:${text(object.id)}`,
          operation: "stripe_credit_pack",
          metadata: {
            creditPackId: metadata.creditPackId,
            stripeCustomerId: customerId,
          },
        },
      );
      return { tenantId, grant };
    }

    const subscriptionId = subscriptionIdFromObject(object);
    if (metadata.purchaseKind === "subscription" && subscriptionId) {
      const product = resolveBillingSelection(
        {
          kind: "subscription",
          planId: metadata.planId,
          interval: metadata.interval,
        },
        env,
      );
      if (!product.invalid && !product.unavailable) {
        await saveSubscription(tenantId, {
          id: subscriptionId,
          planId: product.id,
          interval: product.interval,
          status: text(object.payment_status) === "paid" ? "active" : "incomplete",
          monthlyCredits: product.monthlyCredits,
          memberLimit: product.memberLimit,
        });
      }
    }
    return { tenantId };
  }

  async function processInvoicePaid(object) {
    const customerId = customerIdFromObject(object);
    const tenantId =
      tenantIdFromObject(object) || (await tenantForCustomer(customerId));
    if (!tenantId) return { ignored: true, reason: "tenant_not_resolved" };
    const priceId = priceIdFromObject(object);
    const product = resolveBillingProductFromPrice(priceId, env);
    if (!product || product.kind !== "subscription") {
      return { ignored: true, tenantId, reason: "subscription_price_not_resolved" };
    }
    const period = subscriptionPeriod(object);
    const subscriptionId = subscriptionIdFromObject(object);
    if (subscriptionId) {
      await saveSubscription(tenantId, {
        id: subscriptionId,
        planId: product.id,
        interval: product.interval,
        status: "active",
        monthlyCredits: product.monthlyCredits,
        memberLimit: product.memberLimit,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
      });
    }
    if (!product.credits) {
      return { tenantId, subscriptionUpdated: true };
    }
    if (!creditsService) {
      return { ignored: true, tenantId, reason: "credit_grant_unavailable" };
    }
    const grant = await creditsService.grant(
      { tenantId, user: null },
      {
        amount: product.credits,
        referenceId: `stripe:invoice:${text(object.id)}`,
        operation: "stripe_subscription_allowance",
        metadata: {
          planId: product.id,
          interval: product.interval,
          stripeSubscriptionId: subscriptionId,
          periodStart: period.start,
          periodEnd: period.end,
        },
      },
    );
    return { tenantId, grant };
  }

  async function processSubscriptionChanged(object, deleted = false) {
    const customerId = customerIdFromObject(object);
    const tenantId =
      tenantIdFromObject(object) || (await tenantForCustomer(customerId));
    if (!tenantId) return { ignored: true, reason: "tenant_not_resolved" };
    const priceId = priceIdFromObject(object);
    const product = resolveBillingProductFromPrice(priceId, env);
    const metadata = safeMetadata(metadataFromObject(object));
    const planId = product?.id || metadata.planId;
    const interval = product?.interval || metadata.interval;
    if (!planId || !interval) {
      return { ignored: true, tenantId, reason: "subscription_product_not_resolved" };
    }
    const period = subscriptionPeriod(object);
    await saveSubscription(tenantId, {
      id: object.id,
      planId,
      interval,
      status: deleted ? "canceled" : text(object.status, "inactive"),
      monthlyCredits: product?.monthlyCredits || 0,
      memberLimit: product?.memberLimit || 0,
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      cancelAtPeriodEnd: Boolean(object.cancel_at_period_end),
    });
    return { tenantId };
  }

  async function processPaymentFailed(object) {
    const customerId = customerIdFromObject(object);
    const tenantId =
      tenantIdFromObject(object) || (await tenantForCustomer(customerId));
    if (!tenantId) return { ignored: true, reason: "tenant_not_resolved" };
    const current = await loadSubscription(tenantId);
    const subscriptionId = subscriptionIdFromObject(object) || current?.id;
    if (!subscriptionId) return { ignored: true, tenantId, reason: "subscription_not_resolved" };
    await saveSubscription(tenantId, {
      id: subscriptionId,
      planId: current?.planId,
      interval: current?.interval,
      status: "past_due",
      monthlyCredits: current?.monthlyCredits,
      memberLimit: current?.memberLimit,
      currentPeriodStart: current?.currentPeriodStart,
      currentPeriodEnd: current?.currentPeriodEnd,
      cancelAtPeriodEnd: current?.cancelAtPeriodEnd,
    });
    return { tenantId };
  }

  async function processEvent(event) {
    const object = event?.data?.object || {};
    switch (text(event?.type)) {
      case "checkout.session.completed":
        return processCheckoutCompleted(object);
      case "invoice.paid":
        return processInvoicePaid(object);
      case "invoice.payment_failed":
        return processPaymentFailed(object);
      case "customer.subscription.created":
      case "customer.subscription.updated":
        return processSubscriptionChanged(object, false);
      case "customer.subscription.deleted":
        return processSubscriptionChanged(object, true);
      default:
        return { ignored: true, reason: "event_not_used" };
    }
  }

  async function handleWebhook(rawBody, signatureHeader) {
    const config = configuration();
    if (!config.webhookSecret) {
      throw new StripeBillingError(
        "billing_webhook_not_configured",
        "O segredo do webhook Stripe nao esta configurado.",
        503,
      );
    }
    verifyStripeWebhookSignature(rawBody, signatureHeader, config.webhookSecret, { now });
    let event;
    try {
      event = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody));
    } catch {
      throw new StripeBillingError("invalid_webhook_event", "JSON do webhook invalido.", 400);
    }
    const claim = await claimEvent(event);
    if (claim.duplicate) return { received: true, duplicate: true };

    try {
      const result = await processEvent(event);
      const status = result.ignored ? "ignored" : "processed";
      await completeEvent(event.id, status, {
        tenantId: result.tenantId || null,
        metadata: {
          reason: result.reason || "",
          grantState: result.grant?.state || "",
        },
      });
      return {
        received: true,
        duplicate: false,
        status,
      };
    } catch (error) {
      await completeEvent(event.id, "failed", {
        error: error instanceof Error ? error.message : "Unknown billing event error",
      });
      throw error;
    }
  }

  return {
    accessState,
    billingState,
    catalog: () => getPublicBillingCatalog(env),
    createCheckoutSession,
    createPortalSession,
    createDemoSubscription,
    getSubscription: loadSubscription,
    handleWebhook,
  };
}
