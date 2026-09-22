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
const BRAZIL_UFS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

function text(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function integer(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function normalizeUf(value) {
  const uf = text(value).toUpperCase();
  return BRAZIL_UFS.has(uf) ? uf : "";
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
  const caseIds = [metadata.itau_case_ids_1, metadata.itau_case_ids_2]
    .flatMap((value) => {
      try {
        const parsed = JSON.parse(text(value, "[]"));
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })
    .map(text)
    .filter(Boolean)
    .slice(0, 20);
  return {
    purchaseKind: text(metadata.purchase_kind ?? metadata.purchaseKind),
    planId: text(metadata.plan_id ?? metadata.planId),
    interval: text(metadata.interval),
    creditPackId: text(metadata.credit_pack_id ?? metadata.creditPackId),
    credits: Math.max(0, integer(metadata.credits)),
    itauTierId: text(metadata.itau_tier_id ?? metadata.itauTierId),
    itauLawyerKitId: text(
      metadata.itau_lawyer_kit_id ?? metadata.itauLawyerKitId,
    ),
    itauLawyerKitUf: normalizeUf(
      metadata.itau_lawyer_kit_uf ?? metadata.itauLawyerKitUf,
    ),
    itauClaimCents: Math.max(0, integer(metadata.itau_claim_cents ?? metadata.itauClaimCents)),
    caseIds,
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
  return stripeObjectId(
    object.subscription ||
      object.parent?.subscription_details?.subscription ||
      object.subscription_details?.subscription,
  );
}

function stripeObjectId(value) {
  return text(typeof value === "object" ? value?.id : value);
}

function isChatKind(kind) {
  return ["chat_subscription", "chat_experiment"].includes(kind);
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
  chatAccessService,
  onIrPaymentEvent,
  onDebtPaymentEvent,
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

  async function stripeRequest(path, params, { idempotencyKey = "", method = "POST" } = {}) {
    const config = configuration();
    if (!config.secretKey) {
      throw new StripeBillingError(
        "billing_not_configured",
        "A chave secreta da Stripe nao esta configurada.",
        503,
      );
    }
    const encoded = flattenStripeParams(params).toString();
    const response = await fetchImpl(`${config.apiBaseUrl}${path}${method === "GET" && encoded ? `?${encoded}` : ""}`, {
      method,
      headers: {
        authorization: `Bearer ${config.secretKey}`,
        "content-type": "application/x-www-form-urlencoded",
        "stripe-version": config.apiVersion,
        ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
      },
      ...(method === "GET" ? {} : { body: encoded }),
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

  function chatDatabase() {
    const state = db();
    if (!state.ready) throw new StripeBillingError("chat_database_unavailable", "Chat billing requires persistent storage.", 503);
    return state.pool;
  }

  async function loadChatCustomer(auth) {
    const result = await chatDatabase().query(
      `SELECT c.* FROM audita_chat_customers c JOIN audita_users u ON u.id=c.user_id AND u.tenant_id=c.tenant_id
       WHERE c.tenant_id=$1 AND c.user_id=$2`, [auth.tenantId, auth.user.id]);
    return result.rows[0] || null;
  }

  async function ensureChatCustomer(auth) {
    const pool = chatDatabase();
    const identity = [text(auth.tenantId), text(auth.user.id)];
    const params = { email: text(auth.user.email), name: text(auth.user.name),
      metadata: { audita_tenant_id: identity[0], audita_user_id: identity[1], purchase_kind: "chat_customer" } };
    await pool.query(`INSERT INTO audita_chat_customers(tenant_id,user_id,customer_params,created_at)
      SELECT tenant_id,id,$3::jsonb,$4 FROM audita_users WHERE tenant_id=$1 AND id=$2
      ON CONFLICT (tenant_id,user_id) DO NOTHING`, [...identity, JSON.stringify(params), new Date(now())]);
    const row = await loadChatCustomer(auth);
    if (!row) throw new StripeBillingError("chat_unauthorized", "Chat customer identity invalid.", 401);
    if (row.stripe_customer_id) return { id: row.stripe_customer_id };
    // Stripe may discard idempotency keys after 24 hours; uncertain older attempts need reconciliation.
    if (now() - new Date(row.created_at).getTime() >= 23 * 3600000) {
      throw new StripeBillingError("chat_customer_reconciliation_required", "Chat customer creation needs reconciliation.", 503);
    }
    const customer = await stripeRequest("/v1/customers", row.customer_params, {
      idempotencyKey: `audita-chat-customer-${crypto.createHash("sha256").update(JSON.stringify(identity)).digest("hex")}`,
    });
    if (!customer.id) throw new StripeBillingError("stripe_customer_invalid", "Stripe customer missing.", 502);
    await pool.query(`UPDATE audita_chat_customers SET stripe_customer_id=$3
      WHERE tenant_id=$1 AND user_id=$2 AND stripe_customer_id IS NULL`, [...identity, customer.id]);
    return { id: (await loadChatCustomer(auth)).stripe_customer_id };
  }

  async function createChatCheckout(auth, selection, params) {
    const pool = chatDatabase();
    const ids = [auth.tenantId, auth.user.id];
    for (let attempt = 0; attempt < 2; attempt++) {
      const key = `audita-chat-checkout-${crypto.randomUUID()}`;
      const storedParams = { ...params, expires_at: Math.floor(now() / 1000) + 3600 };
      await pool.query(`UPDATE audita_chat_customers SET checkout_key=$3,checkout_plan=$4,checkout_params=$5::jsonb,checkout_session=NULL
        WHERE tenant_id=$1 AND user_id=$2 AND checkout_key IS NULL`, [...ids, key, selection.id, JSON.stringify(storedParams)]);
      const row = await loadChatCustomer(auth);
      if (!row?.checkout_key) throw new StripeBillingError("chat_checkout_pending", "Chat checkout is being updated.", 409);
      const session = row.checkout_session;
      if (session?.id && Number(row.checkout_params.expires_at) <= now() / 1000) {
        const current = await stripeRequest(`/v1/checkout/sessions/${encodeURIComponent(session.id)}`, {}, { method: "GET" });
        let finished = current.status === "expired";
        if (current.status === "complete") {
          if (current.subscription) {
            const subscription = await stripeRequest(`/v1/subscriptions/${encodeURIComponent(stripeObjectId(current.subscription))}`, {}, { method: "GET" });
            finished = ["canceled", "incomplete_expired"].includes(subscription.status);
          } else {
            const access = await requireChatAccess().getAccess(auth);
            finished = access.trialUsed === true && !access.active;
          }
        }
        if (finished) {
          await pool.query(`UPDATE audita_chat_customers SET checkout_key=NULL,checkout_plan=NULL,checkout_params=NULL,checkout_session=NULL
            WHERE tenant_id=$1 AND user_id=$2 AND checkout_key=$3`, [...ids, row.checkout_key]);
          continue;
        }
        throw new StripeBillingError("chat_checkout_pending", "Previous chat payment is still pending or subscribed.", 409);
      }
      if (row.checkout_plan !== selection.id) throw new StripeBillingError("chat_checkout_pending", "Another chat plan checkout is pending.", 409);
      if (session?.id) return session;
      // Persist the exact request before calling Stripe, including across timeouts and process restarts.
      if (now() / 1000 >= Number(row.checkout_params.expires_at) + 22 * 3600) {
        throw new StripeBillingError("chat_checkout_reconciliation_required", "Uncertain checkout needs reconciliation.", 503);
      }
      const access = await requireChatAccess().getAccess(auth);
      if (access.active || (selection.kind === "chat_experiment" && !access.trialAvailable)) {
        throw new StripeBillingError("chat_plan_already_active", "Chat access changed before checkout.", 409);
      }
      const created = await stripeRequest("/v1/checkout/sessions", row.checkout_params, { idempotencyKey: row.checkout_key });
      if (!created.id || !created.url) throw new StripeBillingError("stripe_checkout_invalid", "Stripe checkout missing.", 502);
      await pool.query(`UPDATE audita_chat_customers SET checkout_session=$4::jsonb
        WHERE tenant_id=$1 AND user_id=$2 AND checkout_key=$3`, [...ids, row.checkout_key, JSON.stringify(created)]);
      return created;
    }
    throw new StripeBillingError("chat_checkout_pending", "Chat checkout changed; retry shortly.", 409);
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

  async function itauCaseAccessState(authContext, caseIds = []) {
    const globalAccess = await accessState(authContext);
    if (globalAccess.entitled && globalAccess.source === "tester") return globalAccess;
    const requested = [...new Set(caseIds.map(text).filter(Boolean))].slice(0, 20);
    if (!requested.length) return { entitled: false, source: "none" };
    const { pool, ready } = db();
    let purchased = [];
    if (!ready) {
      purchased = [...memoryEvents.values()]
        .filter(
          (event) =>
            event.status === "processed" &&
            event.tenantId === text(authContext.tenantId) &&
            event.metadata?.purchaseKind === "itau_charge_service",
        )
        .flatMap((event) => event.metadata.caseIds || []);
    } else {
      const result = await pool.query(
        `SELECT metadata
         FROM audita_billing_events
         WHERE tenant_id = $1
           AND status = 'processed'
           AND event_type = 'checkout.session.completed'
           AND metadata->>'purchaseKind' = 'itau_charge_service'`,
        [authContext.tenantId],
      );
      purchased = result.rows.flatMap((row) =>
        Array.isArray(row.metadata?.caseIds) ? row.metadata.caseIds : [],
      );
    }
    const purchasedSet = new Set(purchased.map(text));
    return requested.every((caseId) => purchasedSet.has(caseId))
      ? { entitled: true, source: "itau_charge_service", caseIds: requested }
      : { entitled: false, source: "none" };
  }

  async function itauLawyerKitAccessState(authContext) {
    if (!authContext?.tenantId) return { unauthorized: true };
    const { pool, ready } = db();
    if (!ready) {
      const purchase = [...memoryEvents.values()].findLast(
        (event) =>
          event.status === "processed" &&
          event.tenantId === text(authContext.tenantId) &&
          event.metadata?.purchaseKind === "itau_lawyer_kit",
      );
      return {
        entitled: Boolean(purchase),
        source: purchase ? "itau_lawyer_kit" : "none",
        uf: normalizeUf(purchase?.metadata?.uf),
      };
    }
    const result = await pool.query(
      `SELECT metadata
       FROM audita_billing_events
       WHERE tenant_id = $1
         AND status = 'processed'
         AND event_type = 'checkout.session.completed'
         AND metadata->>'purchaseKind' = 'itau_lawyer_kit'
       ORDER BY processed_at DESC, id DESC
       LIMIT 1`,
      [authContext.tenantId],
    );
    return {
      entitled: Boolean(result.rows[0]),
      source: result.rows[0] ? "itau_lawyer_kit" : "none",
      uf: normalizeUf(result.rows[0]?.metadata?.uf),
    };
  }

  async function createDemoSubscription(authContext, input = {}) {
    if (!authContext?.tenantId || !authContext?.user) return { unauthorized: true };
    if (isChatKind(text(input.kind)) || text(input.planId).startsWith("chat-")) {
      return { invalid: true, reason: "chat_demo_forbidden" };
    }
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

  // Called only by the IR service with a locked, accepted server-side proposal.
  async function createIrCheckoutSession(authContext, proposal) {
    const config = configuration();
    if (!config.checkoutReady) throw new StripeBillingError("billing_not_configured", "Pagamento ainda não configurado.", 503);
    const metadata = {
      purchase_kind: "ir_proposal", audita_tenant_id: String(authContext.tenantId),
      audita_user_id: String(authContext.user.id), ir_case_id: proposal.caseId,
      ir_proposal_id: proposal.id, ir_proposal_version: String(proposal.version),
    };
    const session = await stripeRequest("/v1/checkout/sessions", {
      mode: "payment", customer_email: authContext.user.email,
      client_reference_id: String(authContext.tenantId),
      success_url: `${config.appUrl}/chat?tool=ir-exemption&case=${proposal.caseId}&payment=return`,
      cancel_url: `${config.appUrl}/chat?tool=ir-exemption&case=${proposal.caseId}`,
      locale: "pt-BR", integration_identifier: config.integrationIdentifier,
      line_items: [{quantity: 1, price_data: {currency: "brl", unit_amount: proposal.amountCents,
        product_data: {name: `Audita — serviço ${proposal.kind.toUpperCase()}`}}}],
      metadata, payment_intent_data: {metadata},
    }, {idempotencyKey: `audita-ir-${proposal.id}-${proposal.attempt}`});
    return {id: session.id, url: session.url, expiresAt: session.expires_at};
  }

  // Server-validated analysis owns the price and identity; no client amount is accepted.
  async function createDebtCheckoutSession(authContext, proposal) {
    const config = configuration();
    if (!config.checkoutReady || !config.appUrl) throw new StripeBillingError("billing_not_configured", "Pagamento ainda não configurado.", 503);
    const metadata = {purchase_kind: "bank_debt", audita_tenant_id: String(authContext.tenantId),
      audita_user_id: String(authContext.user.id), debt_case_id: proposal.caseId, debt_review_id: proposal.reviewId};
    const session = await stripeRequest("/v1/checkout/sessions", {
      mode: "payment", customer_email: authContext.user.email,
      success_url: `${config.appUrl}/?debt_case=${proposal.caseId}&debt_payment=return#dividas-bancarias`,
      cancel_url: `${config.appUrl}/?debt_case=${proposal.caseId}#dividas-bancarias`,
      locale: "pt-BR", integration_identifier: config.integrationIdentifier,
      line_items: [{quantity: 1, price_data: {currency: "brl", unit_amount: proposal.amountCents,
        product_data: {name: "Audita — Dívidas Bancárias Abusivas"}}}], metadata, payment_intent_data: {metadata},
    }, {idempotencyKey: `audita-debt-${proposal.caseId}-${proposal.reviewId}-${proposal.attempt}`});
    return {id: session.id, url: session.url, expiresAt: session.expires_at};
  }

  async function createCheckoutSession(authContext, input = {}) {
    if (!authContext?.tenantId || !authContext?.user) {
      return { unauthorized: true };
    }
    const requestedKind = text(input.kind, "subscription");
    if (
      !["itau_charge_service", "itau_lawyer_kit"].includes(requestedKind) && !isChatKind(requestedKind) &&
      !["super_admin", "owner", "admin"].includes(authContext.user.role)
    ) {
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
    const isChat = isChatKind(selection.kind);
    const isSubscription = ["subscription", "chat_subscription"].includes(selection.kind);
    if (isChat) {
      if (input.demo === true) return { invalid: true, reason: "chat_demo_forbidden" };
      if (!authContext.user.id) return { unauthorized: true };
      if (!chatAccessService) return { unavailable: true, reason: "chat_access_unavailable" };
      const access = await chatAccessService.getAccess(authContext);
      if (access?.active) return { invalid: true, reason: "chat_plan_already_active" };
      if (selection.kind === "chat_experiment" && access?.trialAvailable !== true) {
        return { invalid: true, reason: "chat_experiment_already_used" };
      }
    }
    if (selection.kind === "credit_pack" && !config.creditsEnabled) {
      return {
        unavailable: true,
        reason: "credits_not_enabled",
        missing: ["AUDITA_CREDITS_ENABLED"],
      };
    }

    const lawyerKitUf = normalizeUf(input.uf);
    if (selection.kind === "itau_lawyer_kit" && !lawyerKitUf) {
      return { invalid: true, reason: "itau_lawyer_kit_uf_required" };
    }
    const customer = isChat ? await ensureChatCustomer(authContext) : await ensureCustomer(authContext);
    const requestId = text(input.requestId) || crypto.randomUUID();
    const caseIds = [...new Set((Array.isArray(input.caseIds) ? input.caseIds : []).map(text).filter(Boolean))]
      .slice(0, 20);
    if (selection.kind === "itau_charge_service" && !caseIds.length) {
      return { invalid: true, reason: "itau_case_required" };
    }
    const commonMetadata = {
      audita_tenant_id: text(authContext.tenantId),
      audita_user_id: text(authContext.user.id),
      purchase_kind: selection.kind,
      plan_id: isSubscription || isChat ? selection.id : "",
      credit_pack_id: selection.kind === "credit_pack" ? selection.id : "",
      interval: selection.interval || "",
      credits: String(selection.credits),
      itau_tier_id: selection.kind === "itau_charge_service" ? selection.id : "",
      itau_lawyer_kit_id: selection.kind === "itau_lawyer_kit" ? selection.id : "",
      itau_lawyer_kit_uf: selection.kind === "itau_lawyer_kit" ? lawyerKitUf : "",
      itau_claim_cents:
        selection.kind === "itau_charge_service" ? String(Math.max(0, integer(input.claimAmountCents))) : "",
      itau_case_ids_1:
        selection.kind === "itau_charge_service" ? JSON.stringify(caseIds.slice(0, 10)) : "",
      itau_case_ids_2:
        selection.kind === "itau_charge_service" ? JSON.stringify(caseIds.slice(10, 20)) : "",
    };
    const isItauService = selection.kind === "itau_charge_service";
    const isItauLawyerKit = selection.kind === "itau_lawyer_kit";
    const params = {
      mode: isSubscription ? "subscription" : "payment",
      customer: customer.id,
      client_reference_id: text(authContext.tenantId),
      success_url: isChat ? `${config.appUrl}/chat?chat_checkout=success` : isItauService
        ? `${config.appUrl}/?itau_checkout=success&session_id={CHECKOUT_SESSION_ID}#analise-cobrancas`
        : isItauLawyerKit
          ? `${config.appUrl}/?lawyer_kit_checkout=success&session_id={CHECKOUT_SESSION_ID}#analise-cobrancas`
          : `${config.appUrl}/planos?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: isChat ? `${config.appUrl}/chat?chat_checkout=cancelled` : isItauService
        ? `${config.appUrl}/?itau_checkout=cancelled#analise-cobrancas`
        : isItauLawyerKit
          ? `${config.appUrl}/?lawyer_kit_checkout=cancelled#analise-cobrancas`
          : `${config.appUrl}/planos?checkout=cancelled`,
      locale: "pt-BR",
      billing_address_collection: "required",
      integration_identifier: config.integrationIdentifier,
      line_items: [{ price: selection.priceId, quantity: 1 }],
      metadata: commonMetadata,
      ...(isChat || isItauService || isItauLawyerKit ? {} : { allow_promotion_codes: true }),
      ...(isSubscription
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
    const session = isChat ? await createChatCheckout(authContext, selection, params) :
      await stripeRequest("/v1/checkout/sessions", params, { idempotencyKey: `audita-checkout-${text(authContext.tenantId)}-${requestId}` });
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

  async function createPortalSession(authContext, input = {}) {
    if (!authContext?.tenantId || !authContext?.user) return { unauthorized: true };
    const isChat = input.kind === "chat";
    if (isChat && !authContext.user.id) return { unauthorized: true };
    if (!isChat && !["super_admin", "owner", "admin"].includes(authContext.user.role)) {
      return { forbidden: true };
    }
    const config = configuration();
    if (!config.checkoutReady || !config.appUrl) {
      return { unavailable: true, reason: "billing_not_configured" };
    }
    const row = isChat ? await loadChatCustomer(authContext) : null;
    const customer = isChat ? { id: row?.stripe_customer_id } : await loadCustomer(authContext.tenantId);
    if (!customer?.id) return { notFound: true, reason: "billing_customer_not_found" };

    const session = await stripeRequest("/v1/billing_portal/sessions", {
      customer: customer.id,
      return_url: `${config.appUrl}/${isChat ? "chat" : "planos"}`,
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
    if (metadata.purchaseKind === "itau_lawyer_kit") {
      if (!["paid", "no_payment_required"].includes(text(object.payment_status))) {
        return { ignored: true, tenantId, reason: "payment_not_completed" };
      }
      return {
        tenantId,
        purchase: {
          purchaseKind: metadata.purchaseKind,
          productId: metadata.itauLawyerKitId,
          uf: metadata.itauLawyerKitUf,
          stripeCheckoutSessionId: text(object.id),
        },
      };
    }
    if (metadata.purchaseKind === "itau_charge_service") {
      if (!["paid", "no_payment_required"].includes(text(object.payment_status))) {
        return { ignored: true, tenantId, reason: "payment_not_completed" };
      }
      return {
        tenantId,
        purchase: {
          purchaseKind: metadata.purchaseKind,
          productId: metadata.itauTierId,
          claimCents: metadata.itauClaimCents,
          caseIds: metadata.caseIds,
          stripeCheckoutSessionId: text(object.id),
        },
      };
    }
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

  function requireChatAccess() {
    if (!chatAccessService) throw new StripeBillingError("chat_access_unavailable", "Chat billing access unavailable.", 503);
    return chatAccessService;
  }

  function chatIdentity(object) {
    const metadata = metadataFromObject(object);
    const tenantId = text(metadata.audita_tenant_id);
    const userId = text(metadata.audita_user_id);
    if (!tenantId || !userId) throw new StripeBillingError("chat_identity_missing", "Chat payment identity missing.", 400);
    return { tenantId, userId };
  }

  async function processChatEvent(event, product) {
    const object = event.data.object;
    const type = text(event.type);
    const ignored = reason => ({ ignored: true, reason });
    if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(type)) {
      if (type === "customer.subscription.deleted" || ["canceled", "unpaid", "incomplete_expired", "paused"].includes(object.status)) {
        const identity = chatIdentity(object);
        await requireChatAccess().revokeSubscription({ ...identity, subscriptionId: stripeObjectId(object.id) });
        return identity;
      }
      return ignored("chat_subscription_requires_paid_invoice");
    }
    // Failed renewals do not extend or revoke an already-paid period; getAccess enforces expiry.
    if (type === "invoice.payment_failed") return ignored("chat_paid_period_not_extended");
    const recurring = type === "invoice.paid";
    if (!recurring && !["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(type)) {
      return ignored("event_not_used");
    }
    const metadata = safeMetadata(metadataFromObject(object));
    const kind = recurring ? "chat_subscription" : "chat_experiment";
    if (!recurring && metadata.purchaseKind !== kind) return ignored("chat_subscription_requires_paid_invoice");
    const selection = recurring ? product : resolveBillingSelection({ kind, planId: metadata.planId, interval: "once" }, env);
    if (!selection || selection.invalid || selection.unavailable || selection.kind !== kind ||
        (metadata.planId && metadata.planId !== selection.id)) return ignored("chat_product_not_resolved");
    const amount = recurring ? object.amount_paid : object.amount_total;
    if ((recurring ? object.status !== "paid" || object.paid_out_of_band === true : object.payment_status !== "paid" || object.mode !== "payment") ||
        !Number.isSafeInteger(amount) || amount <= 0 || amount !== selection.amount.cents ||
        text(object.currency).toUpperCase() !== selection.amount.currency) return ignored("chat_payment_not_confirmed");
    const identity = chatIdentity(object);
    const subscriptionId = recurring ? subscriptionIdFromObject(object) : null;
    const paymentId = recurring ? stripeObjectId(object.id) : stripeObjectId(object.payment_intent);
    let period = subscriptionPeriod(object);
    if (!recurring && paymentId) {
      const payment = await stripeRequest(`/v1/payment_intents/${encodeURIComponent(paymentId)}`,
        { expand: ["latest_charge"] }, { method: "GET" });
      if (payment.status !== "succeeded") return ignored("chat_payment_not_confirmed");
      const charge = typeof payment.latest_charge === "object" ? payment.latest_charge :
        payment.latest_charge ? await stripeRequest(`/v1/charges/${encodeURIComponent(payment.latest_charge)}`, {}, { method: "GET" }) : null;
      if (!charge?.paid) return ignored("chat_payment_not_confirmed");
      period = { start: timestampToIso(charge.created), end: timestampToIso(Number(charge.created) + 30 * 86400) };
    }
    if (!paymentId || (recurring && !subscriptionId) || !period.start || !period.end || period.end <= period.start) {
      return ignored("chat_payment_reference_or_period_missing");
    }
    let grant;
    try {
      grant = await requireChatAccess().grantPaidAccess({ ...identity, planId: selection.id,
        periodStart: period.start, periodEnd: period.end, paymentId, subscriptionId });
    } catch (error) {
      if (error.code === "chat_access_revoked") return ignored("chat_payment_revoked");
      throw error;
    }
    return { ...identity, grant };
  }

  async function processChatReversal(object, type) {
    if (type.startsWith("refund.") && object.status !== "succeeded") return { ignored: true, reason: "refund_not_completed" };
    if (type === "charge.refunded" && !(object.amount_refunded > 0)) return { ignored: true, reason: "refund_not_completed" };
    let charge = object;
    let paymentId = stripeObjectId(object.payment_intent);
    const chargeId = stripeObjectId(object.charge);
    if (!paymentId && chargeId) {
      charge = await stripeRequest(`/v1/charges/${encodeURIComponent(chargeId)}`, {}, { method: "GET" });
      paymentId = stripeObjectId(charge.payment_intent);
    }
    let metadata = metadataFromObject(charge);
    if (paymentId && !isChatKind(metadata.purchase_kind)) {
      const payment = await stripeRequest(`/v1/payment_intents/${encodeURIComponent(paymentId)}`, {}, { method: "GET" });
      metadata = metadataFromObject(payment);
    }
    if (metadata.purchase_kind === "chat_experiment" && paymentId) {
      const identity = chatIdentity({ metadata });
      await requireChatAccess().revokePayment({ ...identity, paymentId });
      return identity;
    }
    let invoiceId = stripeObjectId(charge.invoice);
    if (!invoiceId && paymentId) {
      const payments = await stripeRequest("/v1/invoice_payments", {
        payment: { type: "payment_intent", payment_intent: paymentId }, limit: 100,
      }, { method: "GET" });
      // Checkout chat subscriptions have one invoice per payment. Never guess across multiple invoices.
      if (payments.has_more || payments.data?.length > 1) throw new StripeBillingError("chat_payment_ambiguous", "Payment has multiple invoices.", 503);
      invoiceId = stripeObjectId(payments.data?.[0]?.invoice);
    }
    if (!invoiceId) return { ignored: true, reason: "chat_payment_not_resolved" };
    const invoice = await stripeRequest(`/v1/invoices/${encodeURIComponent(invoiceId)}`, {}, { method: "GET" });
    const product = resolveBillingProductFromPrice(priceIdFromObject(invoice), env);
    if (product?.kind !== "chat_subscription" && metadataFromObject(invoice).purchase_kind !== "chat_subscription") {
      return { ignored: true, reason: "not_chat_payment" };
    }
    const identity = chatIdentity(invoice);
    await requireChatAccess().revokePayment({ ...identity, paymentId: invoiceId });
    return identity;
  }

  async function processEvent(event) {
    const object = event?.data?.object || {};
    if (object.metadata?.purchase_kind === "bank_debt") {
      if (!onDebtPaymentEvent) throw new StripeBillingError("debt_handler_unavailable", "Processamento de dívida indisponível.", 503);
      return onDebtPaymentEvent(event);
    }
    if (object.metadata?.purchase_kind === "ir_proposal") {
      if (!onIrPaymentEvent) throw new StripeBillingError("ir_handler_unavailable", "Processamento IR indisponível.", 503);
      return onIrPaymentEvent(event);
    }
    const product = resolveBillingProductFromPrice(priceIdFromObject(object), env);
    if (isChatKind(metadataFromObject(object).purchase_kind) || isChatKind(product?.kind)) {
      if (!["charge.refunded", "charge.dispute.created", "refund.created", "refund.updated"].includes(event.type)) {
        return processChatEvent(event, product);
      }
    }
    const state = db();
    if (customerIdFromObject(object) && state.ready && !["charge.refunded", "charge.dispute.created", "refund.created", "refund.updated"].includes(event.type)) {
      const isolated = await state.pool.query("SELECT 1 FROM audita_chat_customers WHERE stripe_customer_id=$1", [customerIdFromObject(object)]);
      if (isolated.rows.length) return { ignored: true, reason: "chat_metadata_missing" };
    }
    if (["charge.refunded", "charge.dispute.created", "refund.created", "refund.updated"].includes(event.type)) {
      return processChatReversal(object, event.type);
    }
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
          ...(result.purchase || {}),
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

  async function setCancellationAtPeriodEnd(tenantId, action) {
    const normalizedAction = text(action);
    if (!["cancel", "resume"].includes(normalizedAction)) {
      return { invalid: true, reason: "invalid_subscription_action" };
    }
    const current = await loadSubscription(tenantId);
    if (!current?.id) return { notFound: true, reason: "subscription_not_found" };
    if (current.provider !== "stripe") {
      return { unavailable: true, reason: "subscription_not_managed_by_stripe" };
    }
    const object = await stripeRequest(
      `/v1/subscriptions/${encodeURIComponent(current.id)}`,
      { cancel_at_period_end: normalizedAction === "cancel" ? "true" : "false" },
      { idempotencyKey: `super-admin-${normalizedAction}-${current.id}-${Math.floor(now() / 60000)}` },
    );
    await processSubscriptionChanged(object, false);
    return { subscription: await loadSubscription(tenantId) };
  }

  return {
    accessState,
    itauCaseAccessState,
    itauLawyerKitAccessState,
    billingState,
    catalog: () => getPublicBillingCatalog(env),
    createCheckoutSession,
    createPortalSession,
    createDemoSubscription,
    getSubscription: loadSubscription,
    handleWebhook,
    createIrCheckoutSession,
    createDebtCheckoutSession,
    setCancellationAtPeriodEnd,
  };
}
