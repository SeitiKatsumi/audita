import {z} from 'zod';
import {productSchema} from './import-audit-domain.mjs';
import {requireIr as check} from './ir-exemption-domain.mjs';

export const documentFields={description:'Descrição em português',original:'Descrição original',productCode:'Código do produto',manufacturer:'Fabricante',manufacturerCode:'Código do fabricante',model:'Modelo',materials:'Materiais',application:'Aplicação',specifications:'Características técnicas',quantity:'Quantidade',unit:'Unidade',unitValue:'Valor unitário',totalValue:'Valor total do item',currency:'Moeda',netWeight:'Peso líquido do item',grossWeight:'Peso bruto do item',weightUnit:'Unidade de peso'};
const nullable=z.string().trim().max(2000).nullable().default(null);
const additions=Object.fromEntries(['productCode','manufacturer','manufacturerCode','model','materials','application','unit','unitValue','totalValue','netWeight','grossWeight','weightUnit','line'].map(k=>[k,nullable]));
export const extractedLineSchema=productSchema.omit({documentId:true}).extend({...additions,description:nullable,original:nullable,specifications:z.string().max(4000).nullable(),unitValue:z.string().max(100).nullable().default(null),totalValue:z.string().max(100).nullable().default(null)}).strict();
const totalSchema=z.object({label:z.string().trim().min(1).max(200),value:nullable,unit:nullable,page:z.number().int().min(1).max(5000).nullable(),line:nullable}).strict();
export const documentExtractionSchema=z.object({products:z.array(extractedLineSchema).max(30),totals:z.array(totalSchema).max(30).default([]),warnings:z.array(z.string().max(2000)).max(30)}).strict();
const lineSchema=extractedLineSchema.extend({id:z.string().uuid(),documentId:z.string().uuid(),numberFormat:z.enum(['auto','dot','comma']).default('auto')}).strict();
const selectionSchema=z.partialRecord(z.enum(Object.keys(documentFields)),z.enum(['invoice','packing','technical']));
const groupSchema=z.object({invoiceId:z.string().uuid().nullable(),packingId:z.string().uuid().nullable(),technicalId:z.string().uuid().nullable(),selected:selectionSchema.default({}),note:z.string().trim().max(2000).default(''),acknowledged:z.boolean().default(false)}).strict();
const draftSchema=z.object({lines:z.array(lineSchema).min(1).max(30),groups:z.array(groupSchema).min(1).max(30),excluded:z.array(z.object({id:z.string().uuid(),reason:z.string().trim().min(1).max(2000)}).strict()).max(29)}).strict();
const normalized=v=>String(v??'').trim().normalize('NFKC').toLocaleUpperCase('pt-BR').replace(/\s+/g,' ');
const present=v=>v!==null&&v!==undefined&&String(v).trim()!=='';

// Compare canonical decimal strings, never binary floats; no unit/currency conversion.
export function decimal(value,format='auto'){
 if(!present(value))return null;
 let s=String(value).trim();
 if(s.length>100)return null;
 if(format==='auto'){
  if(!/^\d+(?:[.,]\d+)?$/.test(s)||/^\d{1,3}[.,]\d{3}$/.test(s))return null;
 }else if(!(format==='dot'?/^\d+(?:\.\d+)?$/:/^\d+(?:,\d+)?$/).test(s))return null;
 s=s.replace(',','.');let [whole,fraction='']=s.split('.');
 whole=whole.replace(/^0+(?=\d)/,'');fraction=fraction.replace(/0+$/,'');
 return whole+(fraction?'.'+fraction:'');
}
const numeric={quantity:'unit',unitValue:'currency',totalValue:'currency',netWeight:'weightUnit',grossWeight:'weightUnit'};
const comparable=['productCode','manufacturer','manufacturerCode','model','quantity','unit','unitValue','totalValue','currency','netWeight','grossWeight','weightUnit'];
const sides={invoice:'invoiceId',packing:'packingId',technical:'technicalId'};
export function compareLines(invoice,packing){
 return comparable.map(field=>{
  const left=invoice?.[field]??null,right=packing?.[field]??null;
  let status='não verificável',reason='Informação ausente em um dos documentos.';
  if(present(left)&&present(right)){
   const unit=numeric[field];
   if(unit&&(!present(invoice[unit])||!present(packing[unit])||normalized(invoice[unit])!==normalized(packing[unit])))reason='Unidade ou moeda ausente/diferente; sem conversão automática.';
   else {
    const a=unit?decimal(left,invoice.numberFormat):normalized(left),b=unit?decimal(right,packing.numberFormat):normalized(right);
    if(a===null||b===null)reason='Número ambíguo ou inválido. Confirme o separador decimal, sem separador de milhares.';
    else {status=a===b?'coincidente':'divergente';reason=a===b?'Valores equivalentes.':'Os documentos apresentam valores diferentes.';}
   }
  }
  return {field,label:documentFields[field],left,right,status,reason,leftId:invoice?.id??null,rightId:packing?.id??null};
 });
}
export function suggestPairs(lines,documents){
 const byType=type=>lines.filter(l=>documents.find(d=>d.id===l.documentId)?.type===type);
 const invoices=byType('invoice'),packings=byType('packing');
 return invoices.flatMap(i=>{
  const code=normalized(i.productCode);if(!code||invoices.filter(l=>normalized(l.productCode)===code).length!==1)return [];
  const matches=packings.filter(l=>normalized(l.productCode)===code);if(matches.length!==1)return [];
  const p=matches[0];if(['manufacturer','manufacturerCode','model'].some(k=>present(i[k])&&present(p[k])&&normalized(i[k])!==normalized(p[k])))return [];
  return [{invoiceId:i.id,packingId:p.id}];
 });
}
export function initialCheck(lines,documents){
 const groups=lines.map(l=>({...Object.fromEntries(Object.values(sides).map(k=>[k,null])),[sides[documents.find(d=>d.id===l.documentId).type]]:l.id,selected:{},note:'',acknowledged:false}));
 return {lines:lines.map(l=>({...l,numberFormat:'auto'})),groups,excluded:[],confirmed:false};
}
export function evaluateCheck(draft,extraction,documents,confirmed=false){
 const parsed=draftSchema.parse(draft&&{lines:draft.lines,groups:draft.groups,excluded:draft.excluded});
 const originals=new Map(extraction.lines.map(l=>[l.id,l]));
 check(parsed.lines.length===originals.size&&new Set(parsed.lines.map(l=>l.id)).size===originals.size,'invalid_document','Todas as linhas originais precisam ser preservadas.');
 for(const l of parsed.lines)check(originals.get(l.id)?.documentId===l.documentId,'invalid_document','Referência documental inválida.');
 const lines=new Map(parsed.lines.map(l=>[l.id,l])),used=new Set();
 function use(id,type){
  if(!id)return null;
  const l=lines.get(id);check(l&&!used.has(id)&&(!type||documents.find(d=>d.id===l.documentId)?.type===type),'invalid_document','Associação duplicada ou documento incompatível.');used.add(id);return l;
 }
 for(const e of parsed.excluded)use(e.id);
 const products=[],comparisons=[];
 for(const group of parsed.groups){
  const members=Object.fromEntries(Object.entries(sides).map(([side,key])=>[side,use(group[key],side)]));
  check(Object.values(members).some(Boolean),'invalid_document','Associe pelo menos uma linha ao produto.');
  const rows=compareLines(members.invoice,members.packing);
  const unresolved=rows.filter(r=>r.status!=='coincidente');
  const hasCorrections=Object.values(members).filter(Boolean).some(l=>Object.keys(l).some(k=>k!=='numberFormat'&&JSON.stringify(l[k])!==JSON.stringify(originals.get(l.id)[k]))||l.numberFormat!=='auto');
  if(confirmed||group.acknowledged){
   check(group.acknowledged,'confirmation_required','Confira cada produto e reconheça as informações não verificáveis.');
   if(hasCorrections||rows.some(r=>r.status==='divergente'))check(group.note.length>0,'justification_required','Justifique as correções ou divergências deste produto.');
  }
  const resolved={};
  for(const field of Object.keys(documentFields)){
   const chosen=group.selected[field];
   if(chosen)check(members[chosen]&&present(members[chosen][field]),'invalid_selection','O valor escolhido precisa existir na fonte indicada.');
   if(chosen==='technical')check(![...Object.keys(numeric),'unit','currency','weightUnit'].includes(field),'invalid_selection','Ficha técnica não substitui evidência comercial.');
   const values=Object.entries(members).filter(([s,l])=>l&&present(l[field])&&(s!=='technical'||![...Object.keys(numeric),'unit','currency','weightUnit'].includes(field)));
   const divergence=values.length>1&&new Set(values.map(([,l])=>normalized(l[field]))).size>1&&rows.find(r=>r.field===field)?.status!=='coincidente';
   if((confirmed||group.acknowledged)&&divergence){check(chosen,'selection_required','Escolha a origem do dado confirmado para cada valor conflitante.');check(group.note.length>0,'justification_required','Justifique os valores conflitantes mantidos.');}
   resolved[field]=chosen?members[chosen][field]:values[0]?.[1][field]??null;
  }
  const primary=members.invoice||members.packing||members.technical;
  products.push(productSchema.parse({description:resolved.description||'Descrição não informada',original:resolved.original||'Descrição original não informada',specifications:[resolved.specifications,resolved.productCode&&`Código: ${resolved.productCode}`,resolved.manufacturer&&`Fabricante: ${resolved.manufacturer}`,resolved.manufacturerCode&&`Código do fabricante: ${resolved.manufacturerCode}`,resolved.model&&`Modelo: ${resolved.model}`,resolved.materials&&`Materiais: ${resolved.materials}`,resolved.application&&`Aplicação: ${resolved.application}`].filter(Boolean).join('\n').slice(0,4000),quantity:resolved.quantity,value:resolved.totalValue,currency:resolved.currency,documentId:primary.documentId,page:primary.page}));
  comparisons.push({rows,resolved,missing:unresolved.length,divergent:rows.filter(r=>r.status==='divergente').length,hasCorrections});
 }
 check(used.size===lines.size,'incomplete_check','Associe ou justifique a exclusão de todas as linhas.');
 return {...parsed,comparisons,suggestedPairs:suggestPairs(parsed.lines,documents),confirmed,products};
}

export function documentReport(payload){
 const legacyHistory=(payload.previousLegacyProducts||[]).flatMap(v=>[`Produtos anteriores (${v.at}), sem comparação documental:`,...v.products.map(p=>`${p.description} | documento ${p.documentId} | quantidade ${p.quantity??'ausente'} | valor legado (não reinterpretado): ${p.value??'ausente'} ${p.currency??''}`)]);
 if(!payload.extraction)return ['Conferência documental: sem comparação documental (atendimento anterior).',...legacyHistory];
 const c=payload.documentCheck;
 const ref=l=>`${l.documentId}; página ${l.page??'não identificada'}; linha ${l.line??'não identificada'}`;
 const rows=l=>Object.keys(documentFields).filter(k=>present(l[k])).map(k=>`${documentFields[k]}: ${l[k]}`).join(' | ');
 // Repeated saves retain full snapshots in storage, not duplicate pages in the PDF.
 const seen=new Set(payload.extraction.lines.map(l=>'Original '+JSON.stringify(l))),history=[];
 for(const v of payload.previousDocumentChecks||[]){
  const entries=[];
  const add=(key,text)=>{if(!seen.has(key)){seen.add(key);entries.push(text);}};
  for(const l of v.extraction.lines)add('Original '+JSON.stringify(l),`Original anterior ${l.id} | ${ref(l)} | ${rows(l)}`);
  for(const l of v.documentCheck?.lines||[]){const o=v.extraction.lines.find(o=>o.id===l.id);const changes=Object.keys(documentFields).filter(k=>l[k]!==o[k]).map(k=>`${documentFields[k]}: ${o[k]??'ausente'} → ${l[k]??'ausente'}`).join('; ');if(changes||l.numberFormat!=='auto')add('Correção '+JSON.stringify(l),`Correção anterior ${l.id} | ${ref(l)} | ${changes} | formato ${l.numberFormat}`);}
  for(const g of v.documentCheck?.groups||[])add('Grupo '+JSON.stringify(g),`Associação anterior: Invoice ${g.invoiceId??'ausente'} / Packing ${g.packingId??'ausente'} / Ficha ${g.technicalId??'ausente'} | Escolhas ${JSON.stringify(g.selected)} | ${g.note||'Sem justificativa'} | Reconhecido: ${g.acknowledged?'sim':'não'}`);
  for(const e of v.documentCheck?.excluded||[])add('Exclusão '+JSON.stringify(e),`Não pertinente ${e.id}: ${e.reason}`);
  if(entries.length)history.push(`Registros anteriores distintos (${v.at}), não vigentes:`,...entries);
 }
 return ['CONFERÊNCIA DOCUMENTAL - não é aprovação fiscal',c?.confirmed?'Conferência confirmada pelo solicitante.':'Conferência pendente.',
  'Extração original:',...payload.extraction.lines.map(l=>`Linha ${l.id} | ${ref(l)} | ${rows(l)}`),
  'Totais dos documentos (não atribuídos aos produtos):',...payload.extraction.totals.map(t=>`${ref(t)} | ${t.label}: ${t.value??'ausente'} ${t.unit??''}`),
  ...(c?c.groups.flatMap((g,index)=>[`Associação ${index+1}: Invoice ${g.invoiceId??'ausente'}; Packing List ${g.packingId??'ausente'}; ficha técnica ${g.technicalId??'ausente'}.`,
   ...c.comparisons[index].rows.map(r=>`${r.label}: ${r.left??'ausente'} / ${r.right??'ausente'} - ${r.status}. ${r.reason}`),
   `Dados confirmados/propostos: ${rows(c.comparisons[index].resolved)}`,
   `Informações ausentes: ${Object.keys(documentFields).filter(k=>!present(c.comparisons[index].resolved[k])).map(k=>documentFields[k]).join('; ')||'nenhuma'}`,
   `Origens escolhidas: ${Object.entries(g.selected).map(([k,v])=>`${documentFields[k]}: ${v}`).join('; ')||'Sem escolha manual'}`,
   `Pendências reconhecidas: ${g.acknowledged?'sim':'não'}. Justificativa: ${g.note||'não informada'}`]):[]),
  ...(c?['Transcrições após conferência:',...c.lines.map(l=>`${l.id} | ${ref(l)} | ${rows(l)} | Formato numérico: ${l.numberFormat}`),...c.excluded.map(e=>`Item não pertinente ${e.id}: ${e.reason}`)]:[]),
  `Versões documentais anteriores preservadas: ${payload.previousDocumentChecks?.length||0}.`,
  ...history,...legacyHistory];
}
