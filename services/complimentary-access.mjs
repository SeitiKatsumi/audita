// Only use the authenticated server context, never request body/profile fields.
export function hasUnlimitedAccess(auth, env = process.env) {
  if (auth?.unauthorized || !auth?.tenantId || !auth?.user?.id || auth.user.status === 'disabled') return false;
  const email = String(auth.user.email || '').trim().toLowerCase();
  return Boolean(email && String(env.AUDITA_UNLIMITED_ACCESS_EMAILS || '')
    .split(',').some(entry => entry.trim().toLowerCase() === email));
}
