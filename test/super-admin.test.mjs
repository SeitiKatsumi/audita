import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

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
    { status: "suspended" },
  );
  assert.deepEqual(update, {
    id: "2",
    changes: { status: "suspended", role: "" },
  });
  assert.equal(result.user.status, "suspended");
  for (const role of ['admin','member','analyst']) {
    assert.equal((await service.updateUser({user:{id:'1',role:'super_admin'}},'2',{role})).reason,'user_edit_requires_database');
  }
});

test('editing account details validates authorization and preserves other fields in PostgreSQL', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE audita_users(id bigint PRIMARY KEY, tenant_id bigint, name text, email text UNIQUE, role text, status text, updated_at timestamptz, password_hash text);
      CREATE TABLE audita_sessions (user_id bigint);
      CREATE TABLE audita_app_events (tenant_id bigint, event_type text, payload jsonb);
      INSERT INTO audita_users(id,tenant_id,name,email,role,status,updated_at) VALUES (1,1,'Admin','admin@example.test','super_admin','active',now()),(2,2,'Cliente','client@example.test','member','active',now()),(3,1,'Outro Super Admin','super@example.test','super_admin','active',now());`);
    const service = createSuperAdminService({getDb:()=>({pool:db,dbReady:true})});
    const actor={user:{id:1,role:'super_admin'}};
    assert.equal((await service.updateUser({user:{id:3,role:'admin'}},2,{name:'Intruso'})).forbidden,true);
    assert.equal((await service.updateUser(actor,1,{name:'Outro'})).invalid,true);
    assert.equal((await service.updateUser(actor,2,{role:'super_admin'})).reason,'invalid_user_role');
    assert.equal((await service.updateUser(actor,3,{role:'member',status:'suspended'})).notFound,true);
    for(const fields of [{name:''},{name:{}},{email:'invalid'},{email:'admin@example.test'}]) assert.equal((await service.updateUser(actor,2,fields)).invalid,true);
    const result=await service.updateUser(actor,2,{name:' Nome atualizado ',email:' NEW@EXAMPLE.TEST '});
    assert.equal(result.user.name,'Nome atualizado');assert.equal(result.user.email,'new@example.test');
    const row=(await db.query('SELECT * FROM audita_users WHERE id=2')).rows[0];
    assert.equal(row.tenant_id,2);assert.equal(row.role,'member');assert.equal(row.status,'active');
    await db.exec('INSERT INTO audita_sessions VALUES (1),(2),(2)');
    assert.equal((await service.updateUser({user:{id:2,role:'admin'}},2,{role:'admin'})).forbidden,true);
    assert.equal((await service.updateUser(actor,2,{role:'admin'})).user.role,'admin');
    assert.equal((await db.query('SELECT * FROM audita_sessions')).rows.length,3);
    await service.updateUser(actor,2,{role:'admin'});
    assert.deepEqual((await db.query('SELECT * FROM audita_app_events')).rows,[{
      tenant_id:2,event_type:'user_role_changed',payload:{actorId:'1',targetId:'2',fromRole:'member',toRole:'admin'}
    }]);
    await db.exec("ALTER TABLE audita_app_events ADD CONSTRAINT reject_role_event CHECK (payload->>'toRole' <> 'analyst')");
    await assert.rejects(service.updateUser(actor,2,{role:'analyst'}));
    assert.equal((await db.query('SELECT role FROM audita_users WHERE id=2')).rows[0].role,'admin');
    assert.equal((await db.query('SELECT * FROM audita_app_events')).rows.length,1);
    assert.equal((await service.updateUser(actor,2,{role:'member'})).user.role,'member');
    assert.deepEqual((await db.query('SELECT payload FROM audita_app_events')).rows[1].payload,{actorId:'1',targetId:'2',fromRole:'admin',toRole:'member'});
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

test('admin directory shows free service access and protects every super admin', async () => {
  const source=await readFile(new URL('../super-admin.js',import.meta.url),'utf8');
  const elements=new Map();
  const context=vm.createContext({
    $:selector=>{if(!elements.has(selector))elements.set(selector,{value:'',textContent:'',innerHTML:''});return elements.get(selector);},
    dashboard:{users:[
      {id:'1',name:'Super Admin atual',email:'root@example.test',role:'super_admin',status:'active'},
      {id:'2',name:'Outra supervisão',email:'other@example.test',role:'super_admin',status:'active'},
      {id:'3',name:'Administrador',email:'admin@example.test',role:'admin',status:'active'},
      {id:'4',name:'Administrador suspenso',role:'admin',status:'suspended'},
      {id:'5',name:'Membro',role:'member',status:'active'}
    ]}
  });
  vm.runInContext(source.slice(source.indexOf('const escapeHtml ='),source.indexOf('async function loadDashboard()')),context);
  vm.runInContext('render()',context);
  const rows=elements.get('#userRows').innerHTML.split('<tr>').slice(1);
  for (const row of rows.slice(0,2)) {
    assert.match(row,/<select[^>]+disabled><option value="super_admin" selected>Super Admin<\/option><\/select>/);
    assert.match(row,/data-status="suspended"[^>]+disabled/);
    assert.match(row,/data-edit-user="[12]" disabled/);
  }
  assert.match(rows[2],/<option value="admin" selected>Administrador — sem cobrança<\/option>/);
  assert.match(rows[2],/Sem cobrança<\/span><small>Todos os módulos e serviços/);
  assert.match(rows[3],/Sem acesso<\/span><small>Conta suspensa/);
  assert.doesNotMatch(rows[4],/value="super_admin"/);
  assert.equal(elements.get('#userAccessSummary').textContent,'3 admins ativos sem cobrança');
});

test('a rejected role change remains visible after refreshing the directory', async () => {
  const source=await readFile(new URL('../super-admin.js',import.meta.url),'utf8');
  let listener,message='';
  const context=vm.createContext({
    $:()=>({addEventListener:(_,callback)=>{listener=callback;}}),setBusy:()=>{},
    api:async()=>{throw new Error('Não foi possível alterar o perfil.');},
    loadDashboard:async()=>{message='';},showError:value=>{message=value;}
  });
  vm.runInContext(source.split('\n').find(line=>line.startsWith('$("#userRows").addEventListener("change"')),context);
  await listener({target:{dataset:{userRole:'2'},value:'admin'}});
  assert.equal(message,'Não foi possível alterar o perfil.');
});
