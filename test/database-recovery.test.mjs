import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("database recovers after startup DNS failure and later disconnect without repeating migrations", async () => {
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const lifecycle = source.slice(source.indexOf("async function initializeDatabase()"), source.indexOf("async function cacheDefaultTenant()"));
  let unavailable = true, pools = 0, migrations = 0, bootstrap = 0, idleError;
  class Pool {
    constructor(options) { pools++; assert.equal(options.connectionTimeoutMillis, 5000); }
    on(event, callback) { assert.equal(event, "error"); idleError = callback; }
    async query(sql) {
      if (unavailable) throw Object.assign(new Error("private connection detail"), { code: "ENOTFOUND" });
      if (typeof sql === "string") migrations++;
    }
  }
  const context = vm.createContext({
    databaseUrl: "postgres://test", autoMigrate: true, pool: undefined,
    dbReady: false, dbError: null, dbInitialized: false, dbChecking: false,
    process: { env: {} }, console: { info() {}, error() {} },
    loadPg: async () => ({ Pool }), root: "test", join: (...parts) => parts.join("/"),
    readFile: async () => "schema", cacheDefaultTenant: async () => {},
    bootstrapAdminUser: async () => { bootstrap++; },
  });
  vm.runInContext(lifecycle.replace('import("pg")', "loadPg()"), context);
  await context.initializeDatabase();
  assert.equal(context.dbReady, false);
  assert.equal(context.dbError, "ENOTFOUND");
  unavailable = false;
  await Promise.all([context.initializeDatabase(), context.initializeDatabase()]);
  assert.equal(context.dbReady, true);
  assert.equal(context.dbError, null);
  assert.equal(pools, 1);
  assert.equal(migrations, 9);
  assert.equal(bootstrap, 1);
  unavailable = true;
  idleError({ code: "ECONNRESET" });
  assert.equal(context.dbReady, false);
  await context.initializeDatabase();
  unavailable = false;
  await context.initializeDatabase();
  assert.equal(context.dbReady, true);
  assert.equal(context.dbError, null);
  assert.equal(migrations, 9);
  assert.equal(bootstrap, 1);

  const health = source.slice(source.indexOf('  if (pathname === "/api/health")'), source.indexOf('  if (pathname === "/api/config")'));
  Object.assign(context, { pathname: "/api/health", response: {}, appVersion: "test", appEnv: "production", authRequired: true,
    sendJson: (_, status, body) => { context.result = { status, body }; } });
  const checkHealth = () => vm.runInContext(`(function () { ${health} })()`, context);
  checkHealth(); assert.equal(context.result.status, 200);
  context.dbReady = false;
  checkHealth(); assert.equal(context.result.status, 503);
  assert.equal(context.result.body.status, "unavailable");
  context.databaseUrl = undefined;
  checkHealth(); assert.equal(context.result.status, 503);
  context.appEnv = "local";
  checkHealth(); assert.equal(context.result.status, 200);
});
