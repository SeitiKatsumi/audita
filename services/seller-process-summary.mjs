const field=(o,key)=>o?.[Object.keys(o||{}).find(k=>k.toLowerCase()===key.toLowerCase())];
const digits=x=>String(x||'').replace(/\D/g,'');
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const states=new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
export function processMoneyCents(value){
 if(typeof value==='number')return Number.isFinite(value)&&value>=0&&Number.isSafeInteger(Math.round(value*100))?Math.round(value*100):null;
 let s=String(value??'').trim().replace(/^R\$\s*/,'').replace(/\s/g,'');
 if(/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s))s=s.replace(/\./g,'').replace(',','.');
 else if(/^\d+(,\d{1,2})$/.test(s))s=s.replace(',','.');
 else if(!/^\d+(\.\d{1,2})?$/.test(s))return null;
 return s?processMoneyCents(Number(s)):null;
}
function recordState(p){
 const court=field(p,'orgaoJulgador')||{};
 const uf=String(field(p,'uf')||field(court,'uf')||'').toUpperCase();
 if(states.has(uf))return uf;
 const tribunal=String(field(court,'tribunal')||field(p,'tribunal')||'').toUpperCase();
 const suffix=tribunal.match(/^(?:TJ|JF|TRE)[- ]?([A-Z]{2})$/)?.[1];
 return states.has(suffix)?suffix:tribunal==='TJDFT'||tribunal==='TJ-DFT'?'DF':null;
}
function recordRole(p,document){
 const roles=new Set();
 for(const party of field(p,'partes')||[]){
  if(!document||digits(field(party,'documento'))!==document)continue;
  const position=norm(field(party,'posicaoProcessual'));
  if(/advogad|representante|procurador/.test(position))continue;
  const role=norm(`${field(party,'polo')||''} ${position}`);
  if(/\b(passiv[oa]|re|reu|reus|requerid[oa]|executad[oa]|reclamad[oa])\b/.test(role))roles.add('defendant');
  if(/\b(ativ[oa]|autor|autora|requerente|exequente|reclamante)\b/.test(role))roles.add('claimant');
 }
 return roles.size===1?[...roles][0]:null;
}
// Totals use saved source records, never amounts or roles inferred from AI prose.
export async function summarizeReportProcesses(sources,{readBatch,authorize=async()=>{}}){
 const records=new Map(), totals=[],tribunals=[];let unavailable=0,restricted=0,withoutNumber=0;
 for(const source of sources){
  // A related company's proceedings must not become the consulted individual's totals.
  if(source.subject?.document)continue;
  const count=Number(source.details?.['Total de processos']);
  if(Number.isSafeInteger(count)&&count>=0)totals.push({source:source.title,total:count});
  if(source.details?.['Processos por tribunal'])tribunals.push({source:source.title,distribution:source.details['Processos por tribunal']});
  const collection=source.processCollection;if(!collection)continue;
  if(!totals.some(x=>x.source===source.title))totals.push({source:source.title,total:collection.reportedTotal});
  try{await authorize(collection.auditId);}catch{unavailable+=collection.total;continue;}
  for(const batch of collection.batches){
   let data;try{data=await readBatch(collection,batch);}catch{unavailable+=batch.count;continue;}
   for(const p of data.processos){
    if(field(p,'segredoJustica')===true){restricted++;continue;}
    const id=digits(field(p,'numeroProcesso'));if(id.length!==20){withoutNumber++;continue;}
    const candidate={uf:recordState(p),role:recordRole(p,digits(data.documentoConsultado)),amount:processMoneyCents(field(p,'valorCausa')??field(p,'valorDaCausa'))};
    const old=records.get(id);
    if(!old){records.set(id,candidate);continue;}
    for(const key of ['uf','role','amount']){
     if(old[key+'Conflict'])continue;
     if(old[key]==null)old[key]=candidate[key];
     else if(candidate[key]!=null&&old[key]!==candidate[key]){old[key]=null;old[key+'Conflict']=true;}
    }
   }
  }
 }
 const summary={totals,tribunals,total:records.size,byState:{},unknownState:0,unavailable,restricted,withoutNumber,excluded:0,defendant:{cents:0,count:0},claimant:{cents:0,count:0}};
 for(const record of records.values()){
  if(record.uf)summary.byState[record.uf]=(summary.byState[record.uf]||0)+1;else summary.unknownState++;
  if(!record.role||record.amount===null||!Number.isSafeInteger(summary[record.role].cents+record.amount)){summary.excluded++;continue;}
  summary[record.role].cents+=record.amount;summary[record.role].count++;
 }
 return summary;
}
