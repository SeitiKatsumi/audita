import {cnj as validateCnj} from './process-online-workflow.service.mjs';
import {randomUUID,createHash} from 'node:crypto';
import {validateCpf,validateCnpj} from './audit.service.mjs';
import {sealIr,openIr,irKey} from './ir-exemption-domain.mjs';
export const PROCESS_SEARCH_PRICE = 4990;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(code,status=400)=>{throw Object.assign(new Error(code),{code:`process_online_${code}`,status});};
export function createProcessOnlinePayments({getDb,workflow,createCheckout,checkoutReady=()=>false,env=process.env,now=()=>Date.now()}) {
 const key=()=>irKey(env.AUDITA_PROFILE_ENCRYPTION_KEY||'');
 const db=()=>{const value=getDb();if(!value?.dbReady||!value.pool||!key())fail('payment_storage_unavailable',503);return value.pool;};
 const authCheck=auth=>{if(!auth?.tenantId||!auth?.user?.id)fail('authentication_required',401);};
 const decode=row=>openIr(row.encrypted_input,key(),`process-search:${row.id}`);
 const publicOrder=row=>({id:row.id,kind:row.kind,status:row.status,amountCents:PROCESS_SEARCH_PRICE,requestId:row.request_id||null,checkoutUrl:row.status==='pending'?row.checkout_url:null});
 async function owned(auth,id){authCheck(auth);if(!UUID.test(id||''))fail('order_not_found',404);const row=(await db().query('SELECT * FROM audita_process_search_orders WHERE id=$1 AND tenant_id=$2 AND user_id=$3',[id,auth.tenantId,auth.user.id])).rows[0];if(!row)fail('order_not_found',404);return row;}
 function config(){return {amountCents:PROCESS_SEARCH_PRICE,currency:'brl',checkoutReady:checkoutReady()&&Boolean(getDb()?.dbReady&&key())};}
 async function checkout(auth,body={},kind='search'){
  if(!['search','copy'].includes(kind))fail('invalid_checkout');
  authCheck(auth);if(!config().checkoutReady||!workflow.getStatus().ready||(kind==='search'&&workflow.getStatus().searchReady===false))fail('checkout_unavailable',503);
  if(body.consent!==true||!UUID.test(body.operationId||''))fail('invalid_checkout');
  const input={consent:true,approvedCredits:0,operationId:body.operationId.toLowerCase()};
  if(kind==='copy') { input.cnj=validateCnj(body.cnj);input.interesse='outro';input.interesseDetalhe=''; }
  else {
   const documento=String(body.documento||'').replace(/\D/g,'');
   if(!(documento.length===11?validateCpf(documento):documento.length===14&&validateCnpj(documento)))fail('invalid_document');
   input.documento=documento;
  }
  if(body.parentAuditId!=null){if(!UUID.test(body.parentAuditId))fail('invalid_parent');
   const parent=await db().query('SELECT id FROM audita_audits WHERE public_id=$1 AND tenant_id=$2 AND requested_by_user_id=$3',[body.parentAuditId,auth.tenantId,auth.user.id]);
   if(!parent.rows.length)fail('parent_not_found',404);input.parentAuditId=body.parentAuditId;
  }
  const fingerprint=createHash('sha256').update(JSON.stringify(kind==='search'?{documento:input.documento,consent:input.consent,approvedCredits:input.approvedCredits,operationId:input.operationId,...(input.parentAuditId?{parentAuditId:input.parentAuditId}:{})}:input)).digest('hex'),id=randomUUID(),mode=workflow.getStatus().mode;
  await db().query(`INSERT INTO audita_process_search_orders(id,tenant_id,user_id,operation_id,fingerprint,encrypted_input,amount_cents,provider_mode,kind)
   VALUES($1,$2,$3,$4,$5,$6,4990,$7,$8) ON CONFLICT(tenant_id,user_id,operation_id) DO NOTHING`,[id,auth.tenantId,auth.user.id,input.operationId,fingerprint,sealIr(input,key(),`process-search:${id}`),mode,kind]);
  let row=(await db().query('SELECT * FROM audita_process_search_orders WHERE tenant_id=$1 AND user_id=$2 AND operation_id=$3',[auth.tenantId,auth.user.id,input.operationId])).rows[0];
  if(row.fingerprint!==fingerprint||row.kind!==kind)fail('operation_conflict',409);
  if(row.status!=='pending')return publicOrder(row);
  if(row.checkout_url)return publicOrder(row);
  // Do not recreate an uncertain Checkout after Stripe's idempotency retention window.
  if(now()-new Date(row.created_at).getTime()>22*3600000)fail('checkout_needs_review',409);
  const session=await createCheckout(auth,{id:row.id,amountCents:PROCESS_SEARCH_PRICE,createdAt:row.created_at,mode:row.provider_mode,kind:row.kind});
  if(!session?.id||!session.url||new URL(session.url).origin!=='https://checkout.stripe.com')fail('invalid_checkout_response',502);
  row=(await db().query('UPDATE audita_process_search_orders SET checkout_session=$2,checkout_url=$3 WHERE id=$1 AND (checkout_session IS NULL OR checkout_session=$2) RETURNING *',[row.id,session.id,session.url])).rows[0];
  if(!row)fail('checkout_conflict',409);return publicOrder(row);
 }
 async function active(auth){authCheck(auth);const rows=(await db().query("SELECT * FROM audita_process_search_orders WHERE tenant_id=$1 AND user_id=$2 AND status IN ('pending','paid') ORDER BY created_at DESC LIMIT 1",[auth.tenantId,auth.user.id])).rows;return {orders:rows.map(publicOrder)};}
 async function get(auth,id){const row=await owned(auth,id);return {...publicOrder(row),...(row.request_id?{request:await workflow.get(auth,row.request_id)}:{})};}
 async function paymentEvent(event){
  const object=event?.data?.object||{},meta=object.metadata||{};
  const types=['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired'];
  if(meta.purchase_kind!=='process_search'||!types.includes(event.type))return {ignored:true};
  if(!UUID.test(meta.process_search_order_id||''))fail('invalid_payment',400);
  let row=(await db().query('SELECT * FROM audita_process_search_orders WHERE id=$1',[meta.process_search_order_id])).rows[0];
  if(!row||String(row.tenant_id)!==meta.audita_tenant_id||String(row.user_id)!==meta.audita_user_id||object.mode!=='payment'||object.currency!=='brl'||object.amount_total!==PROCESS_SEARCH_PRICE||!object.id||row.checkout_session&&row.checkout_session!==object.id)fail('payment_mismatch',400);
  if(row.provider_mode==='test'&&event.livemode===true)fail('payment_mode_mismatch',400);
  if(['checkout.session.expired','checkout.session.async_payment_failed'].includes(event.type)){
   await db().query("UPDATE audita_process_search_orders SET status=$2 WHERE id=$1 AND status='pending'",[row.id,event.type.endsWith('expired')?'expired':'failed']);return {tenantId:row.tenant_id};
  }
  if(object.payment_status!=='paid')return {ignored:true,reason:'payment_pending'};
  row=(await db().query("UPDATE audita_process_search_orders SET status=CASE WHEN status='fulfilled' THEN status ELSE 'paid' END,paid_at=COALESCE(paid_at,NOW()),checkout_session=COALESCE(checkout_session,$2) WHERE id=$1 RETURNING *",[row.id,object.id])).rows[0];
  if(row.status==='fulfilled')return {tenantId:row.tenant_id};
  if(workflow.getStatus().mode!==row.provider_mode)fail('provider_mode_changed',503);
  const auth={tenantId:row.tenant_id,user:{id:row.user_id}};
  // The workflow owns provider idempotency, including concurrent or repeated webhooks.
  const request=await (row.kind==='copy'?workflow.requestCopy(auth,decode(row)):workflow.search(auth,decode(row)));
  if(!request?.id)fail('search_unavailable',503);
  await db().query("UPDATE audita_process_search_orders SET status='fulfilled',request_id=$2 WHERE id=$1",[row.id,request.id]);
  return {tenantId:row.tenant_id};
 }
 return {config,checkout,get,active,paymentEvent};
}
