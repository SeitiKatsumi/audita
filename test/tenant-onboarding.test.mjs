import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSelfServeTenantIdentity,
  createSelfServeAccount,
} from "../services/tenant-onboarding.service.mjs";

test("self-serve tenant identity is stable, readable and URL safe", () => {
  assert.deepEqual(
    buildSelfServeTenantIdentity({
      name: "Escrit\u00f3rio S\u00e3o Jos\u00e9",
      email: "contato@example.com",
      nonce: "A1B2C3",
    }),
    {
      name: "Conta Escrit\u00f3rio S\u00e3o Jos\u00e9",
      slug: "conta-escritorio-sao-jose-a1b2c3",
    },
  );
});

test("self-serve account creates an isolated tenant and its owner atomically", async () => {
  const calls = [];
  const client = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes("INSERT INTO audita_tenants")) {
        return {
          rows: [{ id: 91, name: values[0], slug: values[1] }],
        };
      }
      if (sql.includes("INSERT INTO audita_users")) {
        return { rows: [{ id: 204 }] };
      }
      return { rows: [] };
    },
    release() {
      calls.push({ sql: "RELEASE", values: [] });
    },
  };
  const pool = {
    async connect() {
      return client;
    },
  };

  const account = await createSelfServeAccount(pool, {
    name: "Pessoa Teste",
    email: "pessoa@example.com",
    passwordHash: "hash",
    nonce: "abc123",
  });

  assert.equal(account.userId, 204);
  assert.equal(account.tenantId, 91);
  assert.ok(calls[0].sql === "BEGIN");
  assert.match(calls[2].sql, /'owner'/);
  assert.ok(calls.at(-2).sql === "COMMIT");
  assert.ok(calls.at(-1).sql === "RELEASE");
});
