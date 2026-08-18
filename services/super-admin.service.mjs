const MANAGEABLE_ROLES = new Set(["owner", "admin", "analyst", "member"]);
const MANAGEABLE_STATUSES = new Set(["active", "suspended"]);

function text(value) {
  return String(value ?? "").trim();
}

export function createSuperAdminService({ getDb, billingAdminService, updateFallbackUser } = {}) {
  function database() {
    const state = getDb ? getDb() : {};
    return { pool: state?.pool, ready: Boolean(state?.pool && state?.dbReady) };
  }

  async function getDashboard(authContext) {
    return billingAdminService.getDashboard(authContext);
  }

  async function updateUser(actor, targetUserId, input = {}) {
    if (actor?.user?.role !== "super_admin") return { forbidden: true };

    const targetId = text(targetUserId);
    const status = input.status === undefined ? "" : text(input.status);
    const role = input.role === undefined ? "" : text(input.role);
    if (!targetId || (!status && !role)) return { invalid: true, reason: "empty_user_update" };
    if (status && !MANAGEABLE_STATUSES.has(status)) {
      return { invalid: true, reason: "invalid_user_status" };
    }
    if (role && !MANAGEABLE_ROLES.has(role)) {
      return { invalid: true, reason: "invalid_user_role" };
    }
    if (text(actor.user.id) === targetId) {
      return { invalid: true, reason: "cannot_modify_current_super_admin" };
    }

    const { pool, ready } = database();
    if (!ready) {
      const user = updateFallbackUser?.(targetId, { status, role });
      return user ? { user } : { notFound: true };
    }

    const result = await pool.query(
      `UPDATE audita_users
       SET status = COALESCE(NULLIF($2, ''), status),
           role = COALESCE(NULLIF($3, ''), role),
           updated_at = NOW()
       WHERE id = $1 AND role <> 'super_admin'
       RETURNING id, tenant_id, email, name, role, status, updated_at`,
      [targetId, status, role],
    );
    if (!result.rows[0]) return { notFound: true };
    return { user: result.rows[0] };
  }

  return { getDashboard, updateUser };
}
