// Development only. Install the runtime once:
// npm install --prefix storage/dev-tools embedded-postgres
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import crypto from 'node:crypto';
import EmbeddedPostgres from '../storage/dev-tools/node_modules/embedded-postgres/dist/index.js';

const root=resolve('.');
if(process.env.APP_ENV && process.env.APP_ENV!=='local')throw Error('This helper is for local development only.');
await mkdir('storage',{recursive:true});
const secretFile='storage/local-postgres-secret';
let password;
try{password=(await readFile(secretFile,'utf8')).trim();}catch(e){if(e.code!=='ENOENT')throw e;password=crypto.randomBytes(32).toString('hex');await writeFile(secretFile,password,{mode:0o600,flag:'wx'});}
const postgres=new EmbeddedPostgres({databaseDir:resolve('storage/postgresql'),user:'audita_local',password,port:54329,persistent:true,authMethod:'scram-sha-256',postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
if(!existsSync('storage/postgresql/PG_VERSION'))await postgres.initialise();
await postgres.start();
const client=postgres.getPgClient();await client.connect();
if(!(await client.query("SELECT 1 FROM pg_database WHERE datname='audita_local'")).rows.length)await postgres.createDatabase('audita_local');
await client.end();
const {default:pg}=await import('pg');
const appClient=new pg.Client({host:'127.0.0.1',port:54329,user:'audita_local',password,database:'audita_local'});await appClient.connect();
await appClient.query(await readFile('db/schema.sql','utf8'));
await appClient.query(await readFile('db/ir-exemption.sql','utf8'));
// Preserve existing local accounts and sessions when bringing this workspace onto PostgreSQL.
if(!(await appClient.query('SELECT 1 FROM audita_users LIMIT 1')).rows.length&&existsSync('storage/local-auth.json')) {
  const old=JSON.parse(await readFile('storage/local-auth.json','utf8')), ids=new Map();
  await appClient.query('BEGIN');
  try{
    for(const user of old.users||[]) {
      const slug=String(user.tenant_slug||`local-${user.tenant_id}`);
      const t=(await appClient.query('INSERT INTO audita_tenants(name,slug) VALUES($1,$2) ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name RETURNING id',[user.tenant_name||'Conta local',slug])).rows[0];
      const u=(await appClient.query('INSERT INTO audita_users(tenant_id,email,name,role,password_hash,status) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[t.id,user.email,user.name,user.role,user.password_hash,user.status||'active'])).rows[0];ids.set(String(user.id),u.id);
    }
    for(const session of old.sessions||[])if(ids.has(String(session.userId))&&session.expiresAt>Date.now())await appClient.query('INSERT INTO audita_sessions(user_id,token_hash,expires_at) VALUES($1,$2,$3) ON CONFLICT(token_hash) DO NOTHING',[ids.get(String(session.userId)),session.tokenHash,new Date(session.expiresAt)]);
    await appClient.query('COMMIT');
  }catch(e){await appClient.query('ROLLBACK');throw e;}
}
await appClient.end();
if(!existsSync('.env.local'))await writeFile('.env.local',`APP_ENV=local\nAPP_URL=http://localhost:3000\nPORT=3000\nHOST=127.0.0.1\nDATABASE_URL=postgres://audita_local:${password}@127.0.0.1:54329/audita_local\nAUDITA_IR_ENABLED=true\nAUDITA_IR_ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}\nAUDITA_IR_AI_ENABLED=false\n`,{mode:0o600,flag:'wx'});
console.log('Local PostgreSQL ready on 127.0.0.1:54329. Persistent workspace storage; credentials not displayed.');
// EmbeddedPostgres registers an exit hook that stops the process without deleting data.
