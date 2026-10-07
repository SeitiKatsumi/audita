import {requireIr as check} from './ir-exemption-domain.mjs';
// Match only unambiguous guide+sequence; never fuzzy-join patients or procedures.
export function reconcileGlosas(documents){
 const groups=new Map(),unmatched=[],evidence=[],facts=[];
 const fields=['guide','sequence','code','reason','billed','paid','denied'];
 for(const doc of documents){
  doc.extraction.items.forEach((item,index)=>{
   const id=doc.id+':item:'+index;evidence.push({id,documentId:doc.id,name:doc.name,...item.source});
   const line={...item,evidenceId:id,documentType:doc.type};
   const key=item.guide&&item.sequence?JSON.stringify([item.guide.trim(),item.sequence.trim()]):null;
   if(!key)unmatched.push([line]);else{if(!groups.has(key))groups.set(key,[]);groups.get(key).push(line);}
  });
  doc.extraction.facts.forEach((fact,index)=>{const id=doc.id+':fact:'+index;evidence.push({id,documentId:doc.id,name:doc.name,...fact.source});facts.push({kind:fact.kind,text:fact.text,evidenceId:id});});
 }
 const items=[...groups.values(),...unmatched].map(lines=>{
  const duplicate=new Set(lines.map(l=>l.evidenceId.split(':item:')[0])).size!==lines.length;
  const item={category:lines.some(l=>l.category==='clinical')?'clinical':lines[0].category,evidenceIds:lines.map(l=>l.evidenceId),issues:[],evidence:''};
  check(!duplicate,'ambiguous_lines','Há múltiplas linhas para a mesma guia/sequência em um documento. Separe os itens antes de prosseguir; não foram agregados automaticamente.');
  for(const k of fields){const values=[...new Set(lines.map(l=>l[k]).filter(v=>v!==null&&v!==''))];item[k]=values.length===1?values[0]:null;if(values.length>1)item.issues.push('Divergência em '+k+': '+values.join(' / '));if(!values.length)item.issues.push('Campo ausente: '+k);}
  if(item.billed!==null&&item.paid!==null&&item.denied!==null&&item.paid+item.denied>item.billed)item.issues.push('Pago e glosado excedem o faturado.');
  item.evidence=item.evidenceIds.map(id=>{const s=evidence.find(v=>v.id===id);return `${s.name}, ${s.page?'p. '+s.page:s.locator}: ${s.quote}`;}).join('\n').slice(0,2000);
  return item;
 });
 const unique=k=>{const values=[...new Set(documents.map(d=>d.extraction[k]).filter(Boolean))];return values.length===1?values[0]:'';};
 return {operator:unique('operator'),lot:unique('lot'),items,evidence,facts,warnings:documents.flatMap(d=>d.extraction.warnings.map(w=>d.name+': '+w))};
}
