import crypto from "node:crypto";
const MANAGEABLE_ROLES = new Set(["owner", "admin", "analyst", "member", "lawyer"]);
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
    const password = input.password === undefined || input.password === '' ? null : input.password;
    if (password !== null && (typeof password !== 'string' || password.length < 8 || password.length > 128)) return { invalid: true, reason: 'invalid_user_password' };
    const name = input.name === undefined ? null : text(input.name);
    const email = input.email === undefined ? null : text(input.email).toLowerCase();
    if (name !== null && (typeof input.name !== 'string' || name.length < 2 || name.length > 160 || /[\u0000-\u001f]/.test(name))) return { invalid: true, reason: 'invalid_user_name' };
    if (email !== null && (typeof input.email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { invalid: true, reason: 'invalid_user_email' };
    if (!targetId || (!status && !role && name === null && email === null && password === null)) return { invalid: true, reason: "empty_user_update" };
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
      if (name !== null || email !== null || password !== null) return { invalid: true, reason: "user_edit_requires_database" };
      const user = updateFallbackUser?.(targetId, { status, role });
      return user ? { user } : { notFound: true };
    }

    let passwordHash = null;
    if (password !== null) {
      const salt = crypto.randomBytes(16).toString('hex');
      passwordHash = salt + ':' + crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex');
    }
    try {
    const result = await pool.query(
      `WITH updated AS (UPDATE audita_users
       SET status = COALESCE(NULLIF($2, ''), status),
           role = COALESCE(NULLIF($3, ''), role),
           name = COALESCE($4, name),
           email = COALESCE($5, email),
           password_hash = COALESCE($6, password_hash),
           updated_at = NOW()
       WHERE id = $1 AND role <> 'super_admin'
       RETURNING id, tenant_id, email, name, role, status, updated_at),
       revoked AS (DELETE FROM audita_sessions WHERE user_id IN (SELECT id FROM updated) AND $6::text IS NOT NULL)
       SELECT * FROM updated`,
      [targetId, status, role, name, email, passwordHash],
    );
    if (!result.rows[0]) return { notFound: true };
    return { user: result.rows[0] };
    } catch (error) {
      if (error.code === "23505") return { invalid: true, reason: "email_already_registered" };
      throw error;
    }
  }

  return { getDashboard, updateUser };
}
