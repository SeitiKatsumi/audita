import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Exercise the actual server functions, following database-recovery.test.mjs.
const source = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const helpers = extract('function hashPassword(', 'async function loadFallbackAuth(') +
  extract('async function changeUserPassword(', 'async function getTenantIdForRequest(');
function context(overrides = {}) {
  const ctx = vm.createContext({ crypto, Buffer, Date, databaseUrl: '', pool: null, dbReady: false,
    passwordChangeAttempts: new Map(), fallbackUsers: new Map(), fallbackSessions: new Map(),
    saveFallbackAuth: async () => {}, ...overrides });
  vm.runInContext(helpers, ctx);
  return ctx;
}
const oldPassword = 'Ficticia-atual-123!';
const nextPassword = 'Ficticia-nova-456!';
const actor = { id: 1, tenant_id: 10 };

test('password change requires current password, validates, limits attempts, revokes own sessions and rolls back local write failures', async () => {
  const ctx = context();
  const user = { ...actor, status: 'active', password_hash: ctx.hashPassword(oldPassword) };
  ctx.fallbackUsers.set(1, user);
  ctx.fallbackSessions.set('one', { userId: 1 });
  ctx.fallbackSessions.set('two', { userId: 1 });
  ctx.fallbackSessions.set('other', { userId: 2 });
  for (const value of [null, {}, 'short', 'x'.repeat(129)]) {
    await assert.rejects(ctx.changeUserPassword(actor, oldPassword, value), { code: 'invalid_password' });
  }
  for (let i = 0; i < 5; i++) await assert.rejects(ctx.changeUserPassword(actor, 'wrong', nextPassword), { code: 'incorrect_password' });
  await assert.rejects(ctx.changeUserPassword(actor, oldPassword, nextPassword), { code: 'too_many_attempts' });
  assert.equal(ctx.fallbackSessions.size, 3);
  ctx.passwordChangeAttempts.get('10:1').expires = 0;
  await assert.rejects(ctx.changeUserPassword(actor, oldPassword, oldPassword), { code: 'password_unchanged' });
  ctx.saveFallbackAuth = async () => { throw new Error('write failed'); };
  await assert.rejects(ctx.changeUserPassword(actor, oldPassword, nextPassword));
  assert.ok(ctx.verifyPassword(oldPassword, user.password_hash));
  assert.equal(ctx.fallbackSessions.size, 3);
  ctx.saveFallbackAuth = async () => {};
  await ctx.changeUserPassword(actor, oldPassword, nextPassword);
  assert.ok(ctx.verifyPassword(nextPassword, user.password_hash));
  assert.equal(ctx.verifyPassword(oldPassword, user.password_hash), false);
  assert.deepEqual([...ctx.fallbackSessions.keys()], ['other']);
  ctx.databaseUrl = 'configured';
  await assert.rejects(ctx.changeUserPassword(actor, nextPassword, oldPassword), { code: 'database_unavailable' });
});

test('PostgreSQL change is atomic, tenant-scoped and preserves other accounts', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE audita_users(id int PRIMARY KEY, tenant_id int, status text DEFAULT 'active', password_hash text, updated_at timestamptz);
      CREATE TABLE audita_sessions(id int, user_id int);
      INSERT INTO audita_sessions VALUES (1,1),(2,1),(3,2);`);
    const ctx = context({ pool: db, dbReady: true, databaseUrl: 'test-only' });
    await db.query('INSERT INTO audita_users(id,tenant_id,password_hash) VALUES (1,10,$1),(2,20,$1)', [ctx.hashPassword(oldPassword)]);
    await assert.rejects(ctx.changeUserPassword({ id: 1, tenant_id: 20 }, oldPassword, nextPassword), { code: 'incorrect_password' });
    await ctx.changeUserPassword(actor, oldPassword, nextPassword);
    const rows = (await db.query('SELECT * FROM audita_users ORDER BY id')).rows;
    assert.ok(ctx.verifyPassword(nextPassword, rows[0].password_hash));
    assert.ok(ctx.verifyPassword(oldPassword, rows[1].password_hash));
    assert.deepEqual((await db.query('SELECT id FROM audita_sessions')).rows, [{ id: 3 }]);
    await db.exec('INSERT INTO audita_sessions VALUES (4,1)');
    const realQuery = db.query.bind(db);
    ctx.pool = { query: async (sql, args) => {
      if (sql.startsWith('WITH updated')) await realQuery('UPDATE audita_users SET password_hash=$1 WHERE id=1', [ctx.hashPassword('Concurrent-password!')]);
      return realQuery(sql, args);
    } };
    await assert.rejects(ctx.changeUserPassword(actor, nextPassword, oldPassword), { code: 'password_changed_retry' });
    assert.equal((await db.query('SELECT * FROM audita_sessions WHERE user_id=1')).rows.length, 1);
  } finally { await db.close(); }
});

test('password endpoint enforces authentication, origin, JSON and safe error responses', async () => {
  const route = extract('  if (pathname === "/api/auth/password"', '  if (pathname === "/api/auth/login"');
  let changed = 0, cleared = 0, result;
  const ctx = context({ pathname: '/api/auth/password', response: {}, URL,
    getSessionUser: async () => actor, readBufferBody: async (_req, max) => { assert.equal(max, 8192); return Buffer.from(JSON.stringify({ currentPassword: oldPassword, newPassword: nextPassword, userId: 999 })); },
    sendJson: (_res, status, body) => { result = { status, body }; }, clearSessionCookie: () => cleared++ });
  ctx.changeUserPassword = async (user, current, next) => { assert.equal(user.id, 1); assert.equal(current, oldPassword); assert.equal(next, nextPassword); changed++; };
  vm.runInContext(`async function route() { ${route} }`, ctx);
  const request = { method: 'POST', headers: { host: 'localhost:3000', origin: 'http://localhost:3000', 'content-type': 'application/json' } };
  ctx.request = structuredClone(request);
  ctx.request.headers.origin = 'https://untrusted.test';
  await ctx.route(); assert.equal(result.status, 403);
  ctx.request = structuredClone(request); ctx.request.headers['content-type'] = 'text/plain';
  await ctx.route(); assert.equal(result.status, 415);
  ctx.request = structuredClone(request); ctx.getSessionUser = async () => null;
  await ctx.route(); assert.equal(result.status, 401);
  assert.equal(changed, 0);
  ctx.getSessionUser = async () => actor;
  await ctx.route(); assert.equal(result.status, 200); assert.equal(changed, 1); assert.equal(cleared, 1);
  ctx.changeUserPassword = async () => { throw new Error('private secret'); };
  await ctx.route(); assert.equal(result.status, 500); assert.equal(result.body.error, 'password_change_failed');
  ctx.databaseUrl = 'configured';
  await ctx.route(); assert.equal(result.status, 503);
});

test('bootstrap never replaces an existing password or role', async () => {
  const existing = { password_hash: 'changed', role: 'member' };
  let sql;
  const ctx = context({ defaultTenantId: 1, process: { env: { AUDITA_BOOTSTRAP_ADMIN_EMAIL: 'fixture@example.test', AUDITA_BOOTSTRAP_ADMIN_PASSWORD: oldPassword } },
    loadFallbackAuth: async () => {}, getFallbackUserByEmail: () => existing, createFallbackUser: () => assert.fail('must not recreate user') });
  vm.runInContext(extract('async function bootstrapAdminUser()', 'function parseCookies('), ctx);
  await ctx.ensureBootstrapUserForLogin('fixture@example.test', oldPassword);
  assert.deepEqual(existing, { password_hash: 'changed', role: 'member' });
  ctx.pool = { query: async text => { sql = text; } }; ctx.dbReady = true;
  await ctx.bootstrapAdminUser();
  assert.match(sql, /ON CONFLICT \(email\) DO NOTHING/);
});
