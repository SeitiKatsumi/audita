import {DEFAULT_CERTIFICATE_PRICING} from '../certificate-selection.js';

const fail=(code,status)=>{throw Object.assign(new Error(code),{code,status});};
export function validateCertificatePricing(input,keys){
  const limits={standardMarkupPercent:100000,highCostMarkupPercent:100000,highCostThresholdCents:500000,freeSourceCents:1000000,subscriberDiscountPercent:100};
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!Object.hasOwn(limits,k)&&k!=='exceptions'))fail('invalid_certificate_pricing',400);
  const output={};
  for(const [key,max]of Object.entries(limits)){
    const value=input[key];if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max||Math.abs(value*100-Math.round(value*100))>1e-6||key.endsWith('Cents')&&!Number.isSafeInteger(value))fail('invalid_certificate_pricing',400);output[key]=value;
  }
  if(!input.exceptions||typeof input.exceptions!=='object'||Array.isArray(input.exceptions)||Object.keys(input.exceptions).length>300)fail('invalid_certificate_pricing',400);
  output.exceptions={};
  for(const [key,rule]of Object.entries(input.exceptions)){
    if(!keys.has(key)||!rule||!['fixed','markup'].includes(rule.mode)||Object.keys(rule).some(k=>!['mode','value'].includes(k))||typeof rule.value!=='number'||!Number.isFinite(rule.value)||rule.value<0||rule.value>(rule.mode==='fixed'?1000000:100000)||Math.abs(rule.value*(rule.mode==='fixed'?1:100)-Math.round(rule.value*(rule.mode==='fixed'?1:100)))>1e-6)fail('invalid_certificate_pricing',400);
    output.exceptions[key]={mode:rule.mode,value:rule.value};
  }
  return output;
}

export function createCertificatePricingService({getDb,catalog}){
  function db(){const state=getDb();if(!state?.dbReady||!state.pool)fail('certificate_pricing_unavailable',503);return state.pool;}
  async function get({required=false}={}){
    if(required)db();
    const state=getDb();if(!state?.dbReady||!state.pool)return {pricing:structuredClone(DEFAULT_CERTIFICATE_PRICING),revision:0};
    const row=(await db().query('SELECT pricing,revision,updated_at FROM audita_certificate_pricing WHERE id=TRUE')).rows[0];
    return row?{pricing:row.pricing,revision:row.revision,updatedAt:row.updated_at}:{pricing:structuredClone(DEFAULT_CERTIFICATE_PRICING),revision:0};
  }
  async function save(actor,input){
    if(actor?.unauthorized||!actor?.user)fail('authentication_required',401);
    if(actor.user.role!=='super_admin')fail('super_admin_required',403);
    const pricing=validateCertificatePricing(input?.pricing,new Set(catalog().map(item=>item.key)));
    if(!Number.isSafeInteger(input.revision)||input.revision<0)fail('invalid_pricing_revision',400);
    const result=await db().query(input.revision===0?
      'INSERT INTO audita_certificate_pricing(id,pricing,revision,updated_by_user_id) VALUES(TRUE,$1::jsonb,1,$2) ON CONFLICT(id) DO NOTHING RETURNING revision':
      'UPDATE audita_certificate_pricing SET pricing=$1::jsonb,revision=revision+1,updated_by_user_id=$2,updated_at=NOW() WHERE id=TRUE AND revision=$3 RETURNING revision',
      input.revision===0?[JSON.stringify(pricing),actor.user.id]:[JSON.stringify(pricing),actor.user.id,input.revision]);
    if(!result.rows.length)fail('pricing_revision_conflict',409);
    return {pricing,revision:result.rows[0].revision};
  }
  return {get,save,catalog};
}
