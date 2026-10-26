// Only use the authenticated server context, never request body/profile fields.
export function hasUnlimitedAccess(auth, env = process.env) {
  if (auth?.unauthorized || !auth?.tenantId || !auth?.user?.id || auth.user.status && auth.user.status !== 'active') return false;
  if (['admin', 'super_admin'].includes(auth.user.role)) return true;
  const email = String(auth.user.email || '').trim().toLowerCase();
  return Boolean(email && String(env.AUDITA_UNLIMITED_ACCESS_EMAILS || '')
    .split(',').some(entry => entry.trim().toLowerCase() === email));
}
