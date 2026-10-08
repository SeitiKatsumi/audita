import {randomUUID} from 'node:crypto';
import {sealIr,openIr,irKey,requireIr as check} from './ir-exemption-domain.mjs';
import {hashDocument,maskDocument} from './audit.service.mjs';
import {certificateQuote,CERTIFICATE_PRICE_MULTIPLIER} from '../certificate-selection.js';

export {CERTIFICATE_PRICE_MULTIPLIER,certificateQuote};
export const certificatePriceCents=cost=>{
  const cents=Math.round(Number(cost)*100);
  check(typeof cost==='number'&&Number.isSafeInteger(cents)&&cents>=0&&cents<=500000,'invalid_certificate_price','Seleção inválida.',400);
  return certificateQuote([cost]).amountCents;
};

// Orders reuse audit JSON; keep the encrypted request for manual recovery after provider interruption.
export function createCertificateOrderService({getDb,checkout,startAudit,env=process.env,now=()=>Date.now()}){
  const key=()=>irKey(env.AUDITA_PROFILE_ENCRYPTION_KEY);
  function db(){const d=getDb();check(d?.dbReady&&d.pool&&key(),'certificate_storage_unavailable','O armazenamento seguro está indisponível.',503);return d.pool;}
  const signed=a=>check(a?.tenantId&&a?.user?.id&&!a.unauthorized,'authentication_required','Entre para continuar.',401);
  const seal=(id,value)=>sealIr(value,key(),'certificate-order:'+id);
  const open=(id,value)=>openIr(value,key(),'certificate-order:'+id);
  async function owned(a,id){signed(a);check(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id)),'certificate_order_not_found','Pedido não encontrado.',404);const row=(await db().query('SELECT public_id,request_payload FROM audita_audits WHERE public_id=$1 AND tenant_id=$2 AND requested_by_user_id=$3',[id,a.tenantId,a.user.id])).rows[0];check(row?.request_payload?.certificateOrder,'certificate_order_not_found','Pedido não encontrado.',404);return row.request_payload.certificateOrder;}
  const publicOrder=(id,o)=>({orderId:id,status:o.status,amountCents:o.amountCents,baseCents:o.baseCents,discountCents:o.discountCents,subscriber:o.subscriber,flow:o.flow||'certificates',segment:o.segment||'analise-vendedor',documentCount:o.documentCount,consultaId:o.status==='started'?id:null,...(o.status==='pending'&&o.checkout?{checkoutUrl:o.checkout.url}:{})});
  async function update(a,id,o){await db().query("UPDATE audita_audits SET request_payload=jsonb_set(request_payload,'{certificateOrder}',$4::jsonb),updated_at=NOW() WHERE public_id=$1 AND tenant_id=$2 AND requested_by_user_id=$3",[id,a.tenantId,a.user.id,JSON.stringify(o)]);}
  async function create(a,body,{providerCostBrl,costs=[providerCostBrl],subscriber=false,complimentary=false,documentCount}){
    signed(a);check(Array.isArray(costs)&&costs.length>0&&costs.length<=300,'invalid_certificate_price','Seleção inválida.',400);
    costs.forEach(certificatePriceCents);
    const id=randomUUID(),quote=certificateQuote(costs,subscriber);
    if(complimentary)quote.amountCents=0;
    const order={...quote,status:quote.amountCents?'pending':'paid',flow:body.extraFields.sellerFlow||'certificates',segment:body.extraFields.sellerSegment||'analise-vendedor',documentCount,createdAt:now(),encryptedBody:seal(id,body)};
    await db().query(`INSERT INTO audita_audits(public_id,tenant_id,requested_by_user_id,document_type,tipo_documento,document_hash,documento_hash,document_masked,subject_name,status,authorization_confirmed,request_payload)
      VALUES($1,$2,$3,$4,$4,$5,$5,$6,$7,'pending',true,$8)`,[id,a.tenantId,a.user.id,body.tipoDocumento,hashDocument(a.tenantId,body.documento),maskDocument(body.tipoDocumento,body.documento),body.extraFields.stateCourtFields.fullName,JSON.stringify({sellerFlow:order.flow,sellerSegment:order.segment,fontes:body.fontes,certificateOrder:order})]);
    if(!order.amountCents)return collect(a,id,{});
    order.checkout=await checkout(a,{id,amountCents:order.amountCents,flow:order.flow,segment:order.segment});
    check(order.checkout?.id&&/^https:\/\/checkout\.stripe\.com\//.test(order.checkout.url),'certificate_checkout_invalid','Não foi possível abrir o pagamento.',502);
    await update(a,id,order);return publicOrder(id,order);
  }
  async function get(a,id){const o=await owned(a,id);return publicOrder(id,o);}
  async function collect(a,id,request){
    const order=await owned(a,id);if(order.status==='started')return publicOrder(id,order);
    check(order.status==='paid','certificate_payment_pending','Aguardando confirmação do pagamento.',409);
    const claim=await db().query("UPDATE audita_audits SET request_payload=jsonb_set(request_payload,'{certificateOrder,status}','\"starting\"'),updated_at=NOW() WHERE public_id=$1 AND tenant_id=$2 AND requested_by_user_id=$3 AND request_payload->'certificateOrder'->>'status'='paid' RETURNING public_id",[id,a.tenantId,a.user.id]);
    if(!claim.rows.length)return get(a,id);
    try{
      const result=await startAudit({...request,body:open(id,order.encryptedBody)},{consultaId:id,paidCertificateOrder:true,authContext:a});
      check(result?.consultaId===id,'certificate_collection_failed','Não foi possível iniciar a emissão. Contate a equipe.',503);
      order.status='started';order.startedAt=now();await update(a,id,order);return publicOrder(id,order);
    }catch(error){
      const count=(await db().query('SELECT count(*) AS count FROM audita_audit_executions WHERE audit_id=(SELECT id FROM audita_audits WHERE public_id=$1)',[id])).rows[0].count;
      // ponytail: never repeat provider calls after an ambiguous start; the team checks that order.
      order.status=Number(count)?'review_required':'paid';await update(a,id,order);throw error;
    }
  }
  async function paymentEvent(event){
    const s=event?.data?.object,m=s?.metadata||{};
    if(!['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired'].includes(event.type))return {ignored:true,reason:'certificate_event_not_used'};
    const a={tenantId:Number(m.audita_tenant_id),user:{id:Number(m.audita_user_id)}},id=m.certificate_order_id,o=await owned(a,id);
    check(o.checkout?.id===s.id&&s.mode==='payment'&&s.currency==='brl'&&s.amount_total===o.amountCents,'certificate_payment_mismatch','Pagamento não corresponde ao pedido.',400);
    if(['started','starting','review_required'].includes(o.status))return {tenantId:a.tenantId};
    if(o.status==='paid'){await collect(a,id,{});return {tenantId:a.tenantId};}
    if(['checkout.session.expired','checkout.session.async_payment_failed'].includes(event.type)){
      await db().query("UPDATE audita_audits SET request_payload=jsonb_set(request_payload,'{certificateOrder,status}',$4::jsonb),updated_at=NOW() WHERE public_id=$1 AND tenant_id=$2 AND requested_by_user_id=$3 AND request_payload->'certificateOrder'->>'status'='pending'",[id,a.tenantId,a.user.id,JSON.stringify(event.type.endsWith('expired')?'expired':'failed')]);
      return {tenantId:a.tenantId};
    }
    if(s.payment_status!=='paid')return {ignored:true,reason:'certificate_payment_pending',tenantId:a.tenantId};
    const marked=await db().query("UPDATE audita_audits SET request_payload=jsonb_set(jsonb_set(request_payload,'{certificateOrder,status}','\"paid\"'),'{certificateOrder,paidAt}',$4::jsonb),updated_at=NOW() WHERE public_id=$1 AND tenant_id=$2 AND requested_by_user_id=$3 AND request_payload->'certificateOrder'->>'status' IN ('pending','expired','failed') RETURNING public_id",[id,a.tenantId,a.user.id,JSON.stringify(now())]);
    if(marked.rows.length)await collect(a,id,{});return {tenantId:a.tenantId};
  }
  return {create,get,collect,paymentEvent,ready:()=>Boolean(getDb()?.dbReady&&key())};
}
