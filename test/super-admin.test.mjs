import assert from "node:assert/strict";
import test from "node:test";

import { createSuperAdminService } from "../services/super-admin.service.mjs";

test("super admin service rejects tenant admins", async () => {
  const service = createSuperAdminService();
  const result = await service.updateUser(
    { user: { id: "1", role: "admin" } },
    "2",
    { status: "suspended" },
  );
  assert.equal(result.forbidden, true);
});

test("super admin service prevents self-demotion or suspension", async () => {
  const service = createSuperAdminService();
  const result = await service.updateUser(
    { user: { id: "1", role: "super_admin" } },
    "1",
    { role: "member" },
  );
  assert.equal(result.invalid, true);
  assert.equal(result.reason, "cannot_modify_current_super_admin");
});

test("super admin service updates a fallback user", async () => {
  let update;
  const service = createSuperAdminService({
    getDb: () => ({ pool: null, dbReady: false }),
    updateFallbackUser: (id, changes) => {
      update = { id, changes };
      return { id, ...changes };
    },
  });
  const result = await service.updateUser(
    { user: { id: "1", role: "super_admin" } },
    "2",
    { status: "suspended", role: "analyst" },
  );
  assert.deepEqual(update, {
    id: "2",
    changes: { status: "suspended", role: "analyst" },
  });
  assert.equal(result.user.status, "suspended");
});

test('editing account details validates authorization and preserves other fields in PostgreSQL', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE audita_users(id bigint PRIMARY KEY, tenant_id bigint, name text, email text UNIQUE, role text, status text, updated_at timestamptz, password_hash text);
      CREATE TABLE audita_sessions (user_id bigint);
      INSERT INTO audita_users(id,tenant_id,name,email,role,status,updated_at) VALUES (1,1,'Admin','admin@example.test','super_admin','active',now()),(2,2,'Cliente','client@example.test','member','active',now());`);
    const service = createSuperAdminService({getDb:()=>({pool:db,dbReady:true})});
    const actor={user:{id:1,role:'super_admin'}};
    assert.equal((await service.updateUser({user:{id:3,role:'admin'}},2,{name:'Intruso'})).forbidden,true);
    assert.equal((await service.updateUser(actor,1,{name:'Outro'})).invalid,true);
    for(const fields of [{name:''},{name:{}},{email:'invalid'},{email:'admin@example.test'}]) assert.equal((await service.updateUser(actor,2,fields)).invalid,true);
    const result=await service.updateUser(actor,2,{name:' Nome atualizado ',email:' NEW@EXAMPLE.TEST '});
    assert.equal(result.user.name,'Nome atualizado');assert.equal(result.user.email,'new@example.test');
    const row=(await db.query('SELECT * FROM audita_users WHERE id=2')).rows[0];
    assert.equal(row.tenant_id,2);assert.equal(row.role,'member');assert.equal(row.status,'active');
    await db.exec('INSERT INTO audita_sessions VALUES (1),(2),(2)');
    assert.equal((await service.updateUser(actor,2,{password:'short'})).invalid,true);
    await service.updateUser(actor,2,{password:'' ,name:'Mesmo usuário'});
    assert.equal((await db.query('SELECT * FROM audita_sessions')).rows.length,3);
    const changed=await service.updateUser(actor,2,{password:'SenhaFicticia123!'});
    assert.equal(changed.user.password_hash,undefined);
    const hash=(await db.query('SELECT password_hash FROM audita_users WHERE id=2')).rows[0].password_hash;
    const crypto=await import('node:crypto');const [salt,digest]=hash.split(':');
    assert.equal(digest,crypto.pbkdf2Sync('SenhaFicticia123!',salt,310000,32,'sha256').toString('hex'));
    assert.deepEqual((await db.query('SELECT user_id FROM audita_sessions')).rows,[{user_id:1}]);
    assert.equal((await service.updateUser(actor,999,{name:'Ausente'})).notFound,true);
  } finally {await db.close();}
});
