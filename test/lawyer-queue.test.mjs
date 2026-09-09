import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createLawyerQueueService, requireLawyer } from "../services/lawyer-queue.service.mjs";
import { resolveUiRoute } from "../services/ui-routing.service.mjs";

test("lawyer access is explicit and queue refuses nonpersistent storage", async () => {
  for (const role of ["member", "owner", "admin", "super_admin"]) assert.throws(() => requireLawyer({ role }), { status: 403 });
  assert.throws(() => requireLawyer(null), { status: 401 });
  const queue = createLawyerQueueService({ getDb: () => ({}) });
  await assert.rejects(queue.list({ role: "lawyer" }), { status: 503 });
  await assert.rejects(queue.submit({ id: 1 }, {}), { status: 422 });
  for (const path of ["/advogados", "/advogados/"]) assert.equal(resolveUiRoute(path).path, "/advogados.html");
});

// Run against isolated PostgreSQL in WASM: set TEST_PGLITE_MODULE to its installed dist/index.js.
test("queue persists, deduplicates, claims once and restricts documents and completion", { skip: !process.env.TEST_PGLITE_MODULE }, async () => {
  const { PGlite } = await import(process.env.TEST_PGLITE_MODULE);
  let db = new PGlite();
  const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
  await db.exec(schema.replace("CREATE EXTENSION IF NOT EXISTS pgcrypto;", ""));
  await db.exec(`INSERT INTO audita_users (id,tenant_id,email,name,role,password_hash) VALUES
    (101,1,'client@example.test','Cliente','member','test'),
    (102,1,'lawyer@example.test','Advogado','lawyer','test'),
    (103,1,'other@example.test','Outro advogado','lawyer','test');`);
  const queue = createLawyerQueueService({ getDb: () => ({ pool: db, dbReady: true }) });
  const client = { id: 101, tenant_id: 1, role: "member" };
  const lawyer = { id: 102, role: "lawyer" }, other = { id: 103, role: "lawyer" };
  const pdf = Buffer.from("%PDF-test");
  const input = { key: "same-case", claimant: { fullName: "Cliente", uf: "SP", city: "Jundiaí" },
    acceptance: { id: "acceptance", accepted: true }, documents: { report: pdf, powerOfAttorney: pdf, agreement: pdf },
    sources: [{ name: "extrato.pdf", type: "application/pdf", base64: pdf.toString("base64") }] };
  const job = await queue.submit(client, input);
  assert.equal((await queue.submit(client, input)).id, job.id);
  assert.equal((await queue.list(lawyer)).length, 1);
  assert.equal((await queue.list(lawyer))[0].client_name, null);
  await assert.rejects(queue.document(lawyer, job.id, "report"), { status: 404 });
  const claims = await Promise.allSettled([queue.claim(lawyer, job.id), queue.claim(other, job.id)]);
  assert.equal(claims.filter(result => result.status === "fulfilled").length, 1);
  const winner = claims[0].status === "fulfilled" ? lawyer : other;
  const loser = winner === lawyer ? other : lawyer;
  assert.equal((await queue.list(loser)).length, 0);
  await assert.rejects(queue.document(loser, job.id, "report"), { status: 404 });
  assert.deepEqual(Buffer.from((await queue.document(winner, job.id, "report")).bytes), pdf);
  assert.deepEqual(Buffer.from((await queue.document(winner, job.id, "source-0")).bytes), pdf);
  await assert.rejects(queue.document(winner, job.id, "source-1"), { status: 404 });
  await assert.rejects(queue.complete(loser, job.id, "12345"), { status: 409 });
  await assert.rejects(queue.complete(winner, job.id, ""), { status: 422 });
  assert.equal((await queue.complete(winner, job.id, "12345")).status, "filed");
  assert.equal((await queue.submit(client, input)).status, "filed");
  const saved = await db.dumpDataDir();
  await db.close();
  db = new PGlite({ loadDataDir: saved });
  assert.equal((await queue.list(winner))[0].protocol_number, "12345");
  assert.deepEqual(Buffer.from((await queue.document(winner, job.id, "agreement")).bytes), pdf);
  await db.close();
});
