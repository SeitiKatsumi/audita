const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

function text(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function publicGrant(row = {}) {
  if (!row || !Object.keys(row).length) return null;
  return {
    id: text(row.id),
    tenantId: text(row.tenant_id ?? row.tenantId),
    userId: text(row.user_id ?? row.userId),
    planId: text(row.plan_id ?? row.planId, "standard"),
    accessType: text(row.access_type ?? row.accessType, "tester"),
    status: text(row.status, "revoked"),
    expiresAt: row.expires_at ?? row.expiresAt ?? null,
    note: text(row.note),
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
  };
}

function grantIsActive(grant, now = Date.now()) {
  if (!grant || grant.status !== "active") return false;
  if (!grant.expiresAt) return true;
  const expiresAt = new Date(grant.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function createBillingAccessService({
  getDb,
  listFallbackUsers = () => [],
  now = () => Date.now(),
} = {}) {
  const memoryGrants = new Map();

  function database() {
    const state = getDb ? getDb() : {};
    return {
      pool: state?.pool,
      ready: Boolean(state?.pool && state?.dbReady),
    };
  }

  async function loadGrant(authContext) {
    const userId = text(authContext?.user?.id);
    if (!userId) return null;
    const { pool, ready } = database();
    if (!ready) return publicGrant(memoryGrants.get(userId));
    const result = await pool.query(
      `SELECT *
       FROM audita_billing_access_grants
       WHERE user_id = $1
         AND status = 'active'
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY updated_at DESC
       LIMIT 1`,
      [authContext.user.id],
    );
    return publicGrant(result.rows[0]);
  }

  async function getEntitlement(authContext, subscription = null) {
    const subscriptionActive =
      subscription?.planId === "standard" &&
      ACTIVE_SUBSCRIPTION_STATUSES.has(text(subscription.status));
    if (subscriptionActive) {
      return {
        entitled: true,
        source: "subscription",
        planId: "standard",
        interval: text(subscription.interval),
        annualItauLegalSupport: subscription.interval === "annual",
      };
    }

    const grant = await loadGrant(authContext);
    if (grantIsActive(grant, now())) {
      return {
        entitled: true,
        source: grant.accessType,
        planId: grant.planId,
        interval: "",
        annualItauLegalSupport: false,
        expiresAt: grant.expiresAt,
      };
    }

    return {
      entitled: false,
      source: "none",
      planId: "",
      interval: "",
      annualItauLegalSupport: false,
    };
  }

  function canManage(actor, targetTenantId) {
    if (!actor?.user) return false;
    if (actor.user.role === "super_admin") return true;
    return (
      ["owner", "admin"].includes(actor.user.role) &&
      text(actor.tenantId) === text(targetTenantId)
    );
  }

  async function setTesterGrant(actor, targetUserId, input = {}) {
    const action = text(input.action);
    if (!['grant', 'revoke'].includes(action)) {
      return { invalid: true, reason: "invalid_access_action" };
    }
    const targetId = text(targetUserId);
    const { pool, ready } = database();

    if (!ready) {
      const target = listFallbackUsers().find((user) => text(user.id) === targetId);
      if (!target) return { notFound: true };
      if (!canManage(actor, target.tenant_id)) return { forbidden: true };
      const grant = publicGrant({
        id: `tester:${targetId}`,
        tenantId: target.tenant_id,
        userId: target.id,
        planId: "standard",
        accessType: "tester",
        status: action === "grant" ? "active" : "revoked",
        expiresAt: input.expiresAt || null,
        note: input.note,
        updatedAt: new Date(now()).toISOString(),
      });
      memoryGrants.set(targetId, grant);
      return { grant };
    }

    const targetResult = await pool.query(
      `SELECT id, tenant_id FROM audita_users WHERE id = $1 LIMIT 1`,
      [targetUserId],
    );
    const target = targetResult.rows[0];
    if (!target) return { notFound: true };
    if (!canManage(actor, target.tenant_id)) return { forbidden: true };

    const status = action === "grant" ? "active" : "revoked";
    const result = await pool.query(
      `INSERT INTO audita_billing_access_grants (
         tenant_id, user_id, plan_id, access_type, status,
         granted_by_user_id, expires_at, note, created_at, updated_at
       )
       VALUES ($1, $2, 'standard', 'tester', $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (user_id, access_type)
       DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         plan_id = EXCLUDED.plan_id,
         status = EXCLUDED.status,
         granted_by_user_id = EXCLUDED.granted_by_user_id,
         expires_at = EXCLUDED.expires_at,
         note = EXCLUDED.note,
         updated_at = NOW()
       RETURNING *`,
      [
        target.tenant_id,
        target.id,
        status,
        actor.user.id || null,
        input.expiresAt || null,
        text(input.note).slice(0, 500),
      ],
    );
    return { grant: publicGrant(result.rows[0]) };
  }

  async function listUsers(actor) {
    const { pool, ready } = database();
    if (!ready) {
      return listFallbackUsers()
        .filter((user) => canManage(actor, user.tenant_id))
        .map((user) => ({
          id: text(user.id),
          tenantId: text(user.tenant_id),
          tenantName: "Ambiente local",
          name: text(user.name),
          email: text(user.email),
          role: text(user.role),
          status: text(user.status, "active"),
          createdAt: user.created_at || null,
          testerGrant: publicGrant(memoryGrants.get(text(user.id))),
          subscription: null,
        }));
    }

    const params = [];
    const tenantFilter = actor?.user?.role === "super_admin"
      ? ""
      : (params.push(actor.tenantId), `WHERE u.tenant_id = $${params.length}`);
    const result = await pool.query(
      `SELECT
         u.id, u.tenant_id, u.name, u.email, u.role, u.status, u.created_at,
         t.name AS tenant_name,
         g.id AS grant_id, g.plan_id AS grant_plan_id, g.access_type AS grant_access_type,
         g.status AS grant_status, g.expires_at AS grant_expires_at, g.note AS grant_note,
         g.updated_at AS grant_updated_at,
         s.provider_subscription_id, s.provider, s.plan_id AS subscription_plan_id,
         s.billing_interval, s.status AS subscription_status,
         s.current_period_end
       FROM audita_users u
       INNER JOIN audita_tenants t ON t.id = u.tenant_id
       LEFT JOIN audita_billing_access_grants g
         ON g.user_id = u.id AND g.access_type = 'tester'
       LEFT JOIN LATERAL (
         SELECT * FROM audita_subscriptions candidate
         WHERE candidate.tenant_id = u.tenant_id
         ORDER BY CASE WHEN candidate.status IN ('active', 'trialing') THEN 0 ELSE 1 END,
                  candidate.updated_at DESC
         LIMIT 1
       ) s ON true
       ${tenantFilter}
       ORDER BY u.created_at DESC
       LIMIT 500`,
      params,
    );
    return result.rows.map((row) => ({
      id: text(row.id),
      tenantId: text(row.tenant_id),
      tenantName: text(row.tenant_name),
      name: text(row.name),
      email: text(row.email),
      role: text(row.role),
      status: text(row.status),
      createdAt: row.created_at || null,
      testerGrant: row.grant_id
        ? publicGrant({
            id: row.grant_id,
            tenant_id: row.tenant_id,
            user_id: row.id,
            plan_id: row.grant_plan_id,
            access_type: row.grant_access_type,
            status: row.grant_status,
            expires_at: row.grant_expires_at,
            note: row.grant_note,
            updated_at: row.grant_updated_at,
          })
        : null,
      subscription: row.provider_subscription_id
        ? {
            id: text(row.provider_subscription_id),
            provider: text(row.provider),
            planId: text(row.subscription_plan_id),
            interval: text(row.billing_interval),
            status: text(row.subscription_status),
            currentPeriodEnd: row.current_period_end || null,
          }
        : null,
    }));
  }

  return {
    getEntitlement,
    listUsers,
    setTesterGrant,
  };
}

