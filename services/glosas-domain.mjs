import {z} from 'zod';

const text=z.string().trim().min(1).max(200);
const cents=z.number().int().min(0).max(1000000000);
export const caseSchema=z.object({
 operator:text, lot:text, consent:z.literal(true),
 items:z.array(z.object({
  guide:text, sequence:text, code:z.string().trim().max(30),
  reason:text, category:z.enum(['administrative','financial','clinical','unknown']),
  billed:cents, paid:cents, denied:cents,
  evidence:z.string().trim().max(2000),
 }).strict().refine(v=>v.paid+v.denied<=v.billed,'Pago e glosado excedem o faturado.')).max(100),
}).strict().superRefine((v,ctx)=>{
 const keys=new Set();
 v.items.forEach((item,index)=>{const key=JSON.stringify([item.guide,item.sequence]);
  if(keys.has(key))ctx.addIssue({code:'custom',path:['items',index],message:'Guia e sequência duplicadas.'});
  keys.add(key);
 });
});
export function summarize(input){
 const data=caseSchema.parse(input);
 const totals={billed:0,paid:0,denied:0,unreconciled:0};
 const items=data.items.map(item=>{
  for(const key of ['billed','paid','denied'])totals[key]+=item[key];
  const unreconciled=item.billed-item.paid-item.denied;
  totals.unreconciled+=unreconciled;
  return {...item,unreconciled,pending:[
   ...(unreconciled?['Saldo não conciliado; conferir o demonstrativo.']:[]),
   ...(!item.evidence?['Referência de evidência ausente.']:[]),
   ...(item.category==='clinical'?['Revisão por profissional de saúde necessária.']:[]),
   ...(item.category==='unknown'?['Categoria ainda não conferida.']:[]),
  ]};
 });
 return {totals,denialPercent:totals.billed?Math.round(totals.denied/totals.billed*10000)/100:null,items};
}
export function reportText(data){
 const summary=summarize(data);
 const money=v=>(v/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 return ['AUDITA - CONFERÊNCIA PRELIMINAR DE GLOSAS',
  'Dados informados pelo solicitante. Sem validação documental, parecer médico ou conclusão jurídica.',
  `Operadora: ${data.operator} | Lote: ${data.lot}`,
  ...Object.entries(summary.totals).map(([k,v])=>`${({billed:'Faturado',paid:'Pago',denied:'Glosado',unreconciled:'Não conciliado'})[k]}: ${money(v)}`),
  `Índice de glosa: ${summary.denialPercent===null?'não calculável':summary.denialPercent+'%'}`,
  ...summary.items.flatMap((v,index)=>['',`Item ${index+1} | Guia ${v.guide} | Sequência ${v.sequence} | Código informado ${v.code||'ausente'}`,
   `Motivo informado: ${v.reason}`,`Faturado ${money(v.billed)} | Pago ${money(v.paid)} | Glosado ${money(v.denied)}`,
   `Evidência indicada (não verificada): ${v.evidence||'ausente'}`,
   ...v.pending]),
  '', 'Próximos passos: conferir documentos e cláusulas contratuais, prazo e marco inicial antes de preparar recurso.',
  'Nenhum recurso foi protocolado. Não há garantia de recuperação financeira.',
 ].join('\n');
}
