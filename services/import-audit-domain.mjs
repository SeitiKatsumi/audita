import {z} from 'zod';
export const NOTICE='Auditoria assistida, sujeita à revisão fiscal. Não comprova benefício, não registra DI/Duimp e não garante economia, desembaraço ou ausência de penalidades. A simulação cobre somente II e IPI ad valorem; não representa o custo total de importação.';
const text=z.string().trim().min(1).max(2000);
export function officialUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='gov.br'||u.hostname.endsWith('.gov.br'));}catch{return false;}}
const source=z.string().max(2000).refine(officialUrl,'Use uma fonte oficial HTTPS gov.br.');
export const productSchema=z.object({
 description:text, original:text, quantity:z.string().max(100).nullable(), value:z.string().max(100).nullable(),
 currency:z.string().max(20).nullable(), specifications:z.string().max(4000),
 documentId:z.string().uuid(), page:z.number().int().min(1).max(5000).nullable(),
}).strict();
export const productsSchema=z.array(productSchema).min(1).max(30);
export const extractionSchema=z.object({products:z.array(productSchema.omit({documentId:true})).max(30),warnings:z.array(text).max(30)}).strict();
export const suggestionSchema=z.object({items:z.array(z.object({index:z.number().int().min(0).max(29),candidates:z.array(z.object({code:z.string().regex(/^\d{8}$/),reason:text})).max(3),missing:z.array(text).max(10)})).max(30)}).strict();
const cents=z.number().int().min(0).max(100000000000);
const bps=z.number().int().min(0).max(30000);
export const reviewSchema=z.object({
 confirmed:z.literal(true), standardAdValorem:z.literal(true),
 operationDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v),
 note:text, rows:z.array(z.object({
 index:z.number().int().min(0).max(29),ncm:z.string().regex(/^\d{8}$/),
 customsValueCents:cents,otherIpiBaseCents:cents,
 iiBps:bps,ipiBps:bps,scenarioIiBps:bps,scenarioIpiBps:bps,
 iiSource:source,ipiSource:source,basis:text,
 })).min(1).max(30),
}).strict();
export function simulate(row){
 const tax=(base,rate)=>Number((BigInt(base)*BigInt(rate)+5000n)/10000n);
 const scenario=(iiRate,ipiRate)=>{const ii=tax(row.customsValueCents,iiRate),ipiBase=row.customsValueCents+ii+row.otherIpiBaseCents,ipi=tax(ipiBase,ipiRate);return {iiCents:ii,ipiBaseCents:ipiBase,ipiCents:ipi,totalCents:ii+ipi};};
 const reference=scenario(row.iiBps,row.ipiBps),proposed=scenario(row.scenarioIiBps,row.scenarioIpiBps);
 return {reference,proposed,differenceCents:reference.totalCents-proposed.totalCents};
}
export const NCM_URL='https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json';
export function normalizeNcm(data){
 if(!Array.isArray(data?.Nomenclaturas))throw Error('invalid_ncm_source');
 const all=new Map(data.Nomenclaturas.map(r=>[String(r.Codigo||'').replace(/\./g,''),r]));
 return new Map([...all].filter(([code])=>/^\d{8}$/.test(code)).map(([code,r])=>[code,{code,description:[2,4,6,7,8].map(n=>all.get(code.slice(0,n))?.Descricao).filter(Boolean).map(s=>String(s).replace(/<[^>]*>/g,'')).join(' > '),start:r.Data_Inicio||null,end:r.Data_Fim||null,act:[r.Tipo_Ato_Ini,r.Numero_Ato_Ini,r.Ano_Ato_Ini].filter(Boolean).join(' ')}]));
}
export async function loadNcm(fetcher=fetch){
 const res=await fetcher(NCM_URL,{signal:AbortSignal.timeout(60000),redirect:'error'});
 if(!res.ok)throw Error('ncm_unavailable');
 const reader=res.body.getReader();let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>12*1024*1024)throw Error('ncm_too_large');chunks.push(Buffer.from(value));}}finally{await reader.cancel();}
 const data=JSON.parse(Buffer.concat(chunks).toString('utf8')),rows=normalizeNcm(data);
 if(rows.size<1000)throw Error('incomplete_ncm');
 return {rows,source:NCM_URL,fetchedAt:new Date().toISOString(),notice:'Tabela NCM vigente na data da consulta. Não valida enquadramento técnico, alíquota ou vigência histórica/futura.'};
}
