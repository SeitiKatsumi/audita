// ANEEL CKAN: documented fields and units; unknown dimensions never become a tariff.
export const SOURCES={tariff:'fcf2906c-7c32-4b9b-a637-054e7a5234f4',activation:'0591b8f6-fe54-437b-b72b-1aa2efd46e42',additional:'5879ca80-b3bd-45b1-a135-d9b77c1d5b36'};
const base='https://dadosabertos.aneel.gov.br';
const decimal=v=>{if(v==null||String(v).trim()==='')return null;const n=Number(String(v).replace(',','.'));return Number.isFinite(n)&&n>=0?n:null;};
const day=v=>{const s=String(v||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s?s:null;};
export function normalizeTariffs(records){return records.flatMap(r=>{
 const start=day(r.DatInicioVigencia),end=day(r.DatFimVigencia),unit=String(r.DscUnidadeTerciaria||'').replace(/^R\$\//,'');
 if(!start||!end||start>end||r.DscBaseTarifaria!=='Tarifa de Aplicação'||!['MWh','kW'].includes(unit))return [];
 if(![r.SigAgente,r.DscClasse,r.DscSubClasse,r.DscDetalhe,r.NomPostoTarifario,r.DscSubGrupo,r.DscModalidadeTarifaria].every(v=>typeof v==='string'&&v.length))return [];
 return ['TE','TUSD'].flatMap(component=>{if(component==='TE'&&unit!=='MWh')return [];const rate=decimal(r['Vlr'+component]);return rate===null?[]:[{kind:'tariff',distributor:r.SigAgente,cnpj:String(r.NumCNPJDistribuidora||'').replace(/\D/g,''),subgroup:r.DscSubGrupo,mode:r.DscModalidadeTarifaria,tariffClass:r.DscClasse,tariffSubclass:r.DscSubClasse,detail:r.DscDetalhe,accessingAgent:r.SigAgenteAcessante||null,component,post:r.NomPostoTarifario,unit:unit==='MWh'?'kWh':'kW',taxIncluded:false,start,end,rate:rate/(unit==='MWh'?1000:1),source:base+'/dataset/tarifas-distribuidoras-energia-eletrica/resource/'+SOURCES.tariff+' | '+r.DscREH}];});
 });}
export function normalizeFlags(activation,additional){return activation.flatMap(r=>{
 const month=day(r.DatCompetencia)?.slice(0,7);if(!month)return [];
 const list=additional.filter(a=>a.NomBandeiraAcionada===r.NomBandeiraAcionada&&day(a.DatVigencia)&&day(a.DatVigencia)<=month+'-01').sort((a,b)=>b.DatVigencia.localeCompare(a.DatVigencia));
 if(additional.some(a=>a.NomBandeiraAcionada===r.NomBandeiraAcionada&&day(a.DatVigencia)>month+'-01'&&day(a.DatVigencia)?.slice(0,7)===month))return [];
 const a=list[0],rate=decimal(a?.VlrAdicionalBandeiraRSMWh);if(rate===null)return [];
 return [{kind:'flag',month,label:r.NomBandeiraAcionada,rate:rate/1000,taxIncluded:false,source:base+'/dataset/bandeiras-tarifarias | '+a.DscResolucao}];
 });}
export async function fetchAneel(resource,fetcher=fetch){
 const records=[];for(let offset=0;offset<1000000;offset+=10000){const u=new URL(base+'/api/3/action/datastore_search');u.search=new URLSearchParams({resource_id:resource,limit:'10000',offset:String(offset)});const response=await fetcher(u,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('ANEEL indisponível');const json=await response.json();if(!json.success||!Array.isArray(json.result?.records))throw Error('Formato ANEEL inesperado');records.push(...json.result.records);if(!json.result.records.length||records.length>=json.result.total)return records;}throw Error('Limite de importação excedido');
}
export async function refreshReferences(pool,{fetcher=fetch}={}){
 for(const kind of ['tariff','flag']){
  // Database lease keeps the daily schedule durable across restarts and multiple processes.
  const claimed=await pool.query("INSERT INTO audita_energy_references(kind,payload,fetched_at,next_attempt_at) VALUES($1,'{}',NULL,NOW()+INTERVAL '30 minutes') ON CONFLICT(kind) DO UPDATE SET next_attempt_at=NOW()+INTERVAL '30 minutes' WHERE audita_energy_references.next_attempt_at<=NOW() RETURNING kind",[kind]);
  if(!claimed.rows.length)continue;
  try{const rows=kind==='tariff'?normalizeTariffs(await fetchAneel(SOURCES.tariff,fetcher)):normalizeFlags(await fetchAneel(SOURCES.activation,fetcher),await fetchAneel(SOURCES.additional,fetcher));if(!rows.length)throw Error('Sem referências reconhecidas');await pool.query("UPDATE audita_energy_references SET payload=$2,fetched_at=NOW(),error=NULL,next_attempt_at=NOW()+INTERVAL '1 day' WHERE kind=$1",[kind,{rows}]);}
  catch{await pool.query("UPDATE audita_energy_references SET error='Falha na atualização ANEEL; somente referências armazenadas com vigência aplicável podem ser usadas.',next_attempt_at=NOW()+INTERVAL '1 day' WHERE kind=$1",[kind]);}
 }
}
