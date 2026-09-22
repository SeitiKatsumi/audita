import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const helpers = extract('function parseCookies(', 'async function readJsonBody(') +
  extract('function hashToken(', 'function hashSubjectIdentifier(') +
  extract('async function createSession(', 'async function changeUserPassword(') +
  extract('async function getSessionUser(', 'function publicUser(');
function context(pool = null) {
  const c = vm.createContext({ crypto, Date, process: { env: {} }, sessionCookieName: 'audita_session',
    pool, dbReady: !!pool, fallbackSessions: new Map(), fallbackUsers: new Map([[1, { id: 1 }]]),
    loadFallbackAuth: async () => {}, saveFallbackAuth: async () => {} });
  vm.runInContext(helpers, c);
  return c;
}

test('remember login uses matching cookie/server expiry, survives a new process context, expires and logs out in both stores', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE audita_sessions(user_id int, token_hash text, expires_at timestamptz);
      CREATE TABLE audita_users(id int, email text, name text, role text, tenant_id int, status text);
      CREATE TABLE audita_tenants(id int, name text, slug text, status text);
      INSERT INTO audita_users VALUES (1,'fixture@example.test','Teste','member',1,'active');
      INSERT INTO audita_tenants VALUES (1,'Teste','teste','active');`);
    for (const pool of [null, db]) for (const remember of [undefined, false, true, 'true', 1, null, {}]) {
      const c = context(pool);
      const seconds = remember === true ? 2592000 : 43200;
      let cookie;
      const response = { setHeader: (_name, value) => { cookie = value; } };
      const request = { headers: { 'x-forwarded-proto': 'https' } };
      const before = Date.now();
      await c.createSession(response, request, 1, remember);
      assert.match(cookie, new RegExp(`Max-Age=${seconds}(;|$)`));
      for (const flag of ['HttpOnly', 'SameSite=Lax', 'Secure', 'Path=/']) assert.ok(cookie.includes(flag));
      request.headers.cookie = cookie.split(';')[0];
      const tokenHash = c.hashToken(c.parseCookies(request).audita_session);
      const expiry = pool
        ? new Date((await db.query('SELECT expires_at FROM audita_sessions WHERE token_hash=$1', [tokenHash])).rows[0].expires_at).getTime()
        : c.fallbackSessions.get(tokenHash).expiresAt;
      assert.ok(expiry >= before + seconds * 1000 - 1000 && expiry <= Date.now() + seconds * 1000);
      const restarted = context(pool);
      restarted.fallbackSessions = new Map(JSON.parse(JSON.stringify([...c.fallbackSessions])));
      assert.equal((await restarted.getSessionUser(request)).id, 1);
      if (pool) await db.query("UPDATE audita_sessions SET expires_at=NOW()-INTERVAL '1 second' WHERE token_hash=$1", [tokenHash]);
      else restarted.fallbackSessions.get(tokenHash).expiresAt = Date.now() - 1;
      assert.equal(await restarted.getSessionUser(request), null);
      Object.assign(c, { request: { ...request, method: 'POST' }, response, pathname: '/api/auth/logout',
        sendJson: (_res, status) => assert.equal(status, 200) });
      vm.runInContext(`async function logout() { ${extract('  if (pathname === "/api/auth/logout"', '  if (pathname === "/api/dashboard"')} }`, c);
      await c.logout();
      assert.match(cookie, /Max-Age=0(?:;|$)/);
      assert.equal(await c.getSessionUser(request), null);
    }
  } finally { await db.close(); }
});

test('login passes only explicit boolean true after credentials succeed; registration keeps default duration', async () => {
  for (const dbReady of [false, true]) for (const rememberMe of [undefined, false, true, 'true', 1]) {
    let valid = true, created = [], status;
    const c = vm.createContext({ pathname: '/api/auth/login', request: { method: 'POST' }, response: {}, dbReady,
      pool: dbReady ? { query: async () => ({ rows: [{ id: 1, password_hash: 'fixture' }] }) } : null,
      readJsonBody: async () => ({ email: 'fixture@example.test', password: 'fixture', rememberMe }),
      ensureBootstrapUserForLogin: async () => {}, loadFallbackAuth: async () => {},
      getFallbackUserByEmail: () => ({ id: 1, password_hash: 'fixture' }), verifyPassword: () => valid,
      createSession: async (...args) => created.push(args), sendJson: (_res, code) => { status = code; } });
    vm.runInContext(`async function login() { ${extract('  if (pathname === "/api/auth/login"', '  if (pathname === "/api/auth/register"')} }`, c);
    await c.login();
    assert.equal(status, 200);
    assert.equal(created[0][3], rememberMe === true);
    valid = false; created = [];
    await c.login();
    assert.equal(status, 401);
    assert.equal(created.length, 0);
  }
  const register = extract('  if (pathname === "/api/auth/register"', '  if (pathname === "/api/auth/logout"');
  assert.match(register, /createSession\(response, request, user\.id\)/);
  assert.match(register, /createSession\(response, request, account\.userId\)/);
  assert.ok(!register.includes('rememberMe'));
});
