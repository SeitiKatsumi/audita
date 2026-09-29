import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import pg from 'pg';
import {chromium} from 'playwright';

const url=new URL(process.env.DATABASE_URL);
assert.equal(process.env.APP_ENV,'local');
assert.equal(url.hostname,'127.0.0.1');
assert.equal(url.port,'54329');
assert.equal(url.pathname,'/audita_local');
const db=new pg.Client({connectionString:process.env.DATABASE_URL});
await db.connect();
let userId,caseId,browser;
try {
 const token=randomUUID();
 userId=(await db.query("INSERT INTO audita_users(tenant_id,name,email,password_hash,role) VALUES(1,'Storage test',$1,'disabled-test-login','member') RETURNING id",[`${randomUUID()}@example.test`])).rows[0].id;
 await db.query("INSERT INTO audita_sessions(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '5 minutes')",[userId,createHash('sha256').update(token).digest('hex')]);
 const headers={cookie:`audita_session=${token}`,origin:'http://localhost:3000','content-type':'application/json'};
 const created=await fetch('http://localhost:3000/api/ir-exemption/cases',{method:'POST',headers,body:'{}'});
 assert.equal(created.status,201);
 let c=(await created.json()).case;caseId=c.id;
 const answer=await fetch(`http://localhost:3000/api/ir-exemption/cases/${caseId}/actions`,{method:'POST',headers,body:JSON.stringify({action:'answer',key:'role',value:'self',revision:c.revision})});
 assert.equal(answer.status,200);
 c=(await answer.json()).case;
 const recovered=await fetch(`http://localhost:3000/api/ir-exemption/cases/${caseId}`,{headers});
 assert.equal(recovered.status,200);
 assert.equal((await recovered.json()).case.revision,c.revision);
 const stored=(await db.query('SELECT encrypted_payload FROM audita_ir_cases WHERE id=$1',[caseId])).rows[0].encrypted_payload;
 assert.ok(!stored.includes('"self"'));
 const anonymous=await fetch(`http://localhost:3000/api/ir-exemption/cases/${caseId}`);
 assert.equal(anonymous.status,401);
 browser=await chromium.launch();
 const context=await browser.newContext();
 await context.addCookies([{name:'audita_session',value:token,url:'http://localhost:3000'}]);
 const page=await context.newPage();
 await page.goto('http://localhost:3000/#isencao-ir');
 const start=page.getByRole('button',{name:'Para mim',exact:true});
 await start.waitFor();
 assert.equal(await start.isEnabled(),true);
 assert.equal(await page.getByText('O atendimento será liberado assim que o armazenamento seguro estiver configurado.',{exact:true}).isVisible(),false);
 console.log('PASS: IR ready, encrypted case creation/save/recovery, anonymous denied, UI enabled.');
} finally {
 await browser?.close();
 if(caseId){await db.query('DELETE FROM audita_ir_events WHERE case_id=$1',[caseId]);await db.query('DELETE FROM audita_ir_cases WHERE id=$1 AND user_id=$2',[caseId,userId]);}
 if(userId)await db.query('DELETE FROM audita_users WHERE id=$1',[userId]);
 await db.end();
}
