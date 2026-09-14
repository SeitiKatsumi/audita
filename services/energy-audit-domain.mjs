import {z} from 'zod';
export const VERSION='2026-09-14.1';
export const STATUSES={collecting:'Documentos em análise',prepared:'Pedido preparado',protocol:'Protocolo informado',pending:'Em análise',response:'Resposta recebida',denied:'Pedido negado',approved:'Devolução aprovada',received:'Recebimento confirmado',closed:'Encerrado'};
const text=z.string().trim().max(250),num=z.number().finite().min(0).max(1e12).nullable().default(null);
const money=z.number().int().min(0).max(1e12).nullable().default(null);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s);
export const billSchema=z.object({
 distributor:text.nullable().default(null),unit:text.nullable().default(null),holder:text.nullable().default(null),
 month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable().default(null),start:date.nullable().default(null),end:date.nullable().default(null),
 modality:z.enum(['residential','commercial','large','solar','free','unknown']).default('unknown'),kind:z.enum(['supply','distribution','combined']).default('combined'),
 distributorCnpj:text.nullable().default(null),tariffClass:text.nullable().default(null),tariffSubclass:text.nullable().default(null),detail:text.nullable().default(null),accessingAgent:text.nullable().default(null),flagLabel:text.nullable().default(null),interconnected:z.boolean().nullable().default(null),
 group:text.nullable().default(null),subdistributorCnpj:text.nullable().default(null),tariffClass:text.nullable().default(null),tariffSubclass:text.nullable().default(null),detail:text.nullable().default(null),accessingAgent:text.nullable().default(null),flagLabel:text.nullable().default(null),interconnected:z.boolean().nullable().default(null),
 group:text.nullable().default(null),tariffMode:text.nullable().default(null),taxIncluded:z.boolean().nullable().default(null),
 totalCents:money,itemsComplete:z.boolean().default(false),paid:z.boolean().nullable().default(null),paymentDocumentId:z.string().uuid().nullable().default(null),
 previousReading:num,currentReading:num,multiplier:num,consumption:num,
 items:z.array(z.object({label:text,unit:text.nullable().default(null),component:text.nullable().default(null),quantity:num,rate:num,amountCents:money,credit:z.boolean().default(false),page:z.number().int().min(1).max(300),post:text.nullable().default(null)})).max(500).default([]),
 taxes:z.array(z.object({label:text,baseCents:money,percent:num,amountCents:money,page:z.number().int().min(1).max(300)})).max(20).default([]),
 solar:z.object({opening:num,incoming:num,used:num,expired:num,transferredIn:num,transferredOut:num,closing:num}).nullable().default(null),
 contract:z.object({documentId:z.string().uuid(),confirmed:z.boolean(),start:date,end:date,rates:z.array(z.object({label:text,rate:z.number().finite().min(0).max(1e8),taxIncluded:z.boolean()})).max(100)}).nullable().default(null),
 fieldPages:z.record(z.string().max(100),z.number().int().min(1).max(300)).default({}),channel:text.nullable().default(null),sourcePages:z.array(z.number().int().min(1).max(300)).max(300).default([])
}).refine(b=>!b.start||!b.end||b.start<=b.end,{message:'Período inválido'});
export function validateBill(value){return billSchema.parse(value);}
export function auditBills(documents,references=[]){
 const findings=[],checks=[],pending=[],excluded=new Set(),bills=documents.filter(d=>d.type==='invoice'&&d.bill&&!d.supersededBy);
 for(let i=0;i<bills.length;i++)for(let j=0;j<i;j++){
  const a=bills[i],b=bills[j];
  if(a.bill.unit&&a.bill.distributor&&a.bill.unit===b.bill.unit&&a.bill.distributor===b.bill.distributor&&a.bill.kind===b.bill.kind&&((a.bill.month&&a.bill.month===b.bill.month)||(a.bill.start&&b.bill.start&&a.bill.end&&b.bill.end&&a.bill.start<=b.bill.end&&b.bill.start<=a.bill.end))){excluded.add(a.id);excluded.add(b.id);pending.push({documentId:a.id,message:'Períodos sobrepostos: indique qual documento substitui o anterior antes de somar.'});}
 }
 for(const d of bills){
  const b=d.bill,base={documentId:d.id,unit:b.unit,month:b.month,version:VERSION};
  if(excluded.has(d.id))continue;
  for(const field of ['distributor','unit','month','holder','totalCents'])if(b[field]===null||b[field]==='')pending.push({...base,message:`Complete o campo ${field}.`});
  const check=(rule,label,actual,expected,page=null,reference='Fatura enviada',monetary=true,calculation='')=>{
   if(actual==null||expected==null||(!Number.isFinite(expected)||(monetary&&!Number.isSafeInteger(Math.round(expected))))){checks.push({...base,rule,label,state:'not_checked',reason:({total:'Falta total ou confirmação de que todos os itens foram lidos.',reading:'Faltam leituras, consumo ou multiplicador compatíveis.',item:'Falta quantidade, preço unitário ou valor do item.',tariff:'Sem referência oficial com todas as dimensões, unidade, tributos e vigência compatíveis.',contract:'Falta contrato confirmado com preço e vigência compatíveis.',tax:'Falta base, alíquota ou valor declarado.',solar:'Falta algum componente do histórico completo de créditos.',flag:'Sem referência de bandeira com mês, sistema, unidade e tributos compatíveis.'})[rule]||'Dados insuficientes'});return;}
   const delta=actual-expected,divergent=Math.abs(delta)>(monetary?2:0.01);
   const r={...base,rule,label,state:divergent?'difference':'checked',actual,expected:Math.round(expected*100)/100,delta:Math.round(delta*100)/100,page,reference,monetary,calculation};checks.push(r);if(divergent)findings.push(r);
  };
  check('total','Soma de itens, créditos e descontos',b.totalCents,b.itemsComplete&&b.items.length&&b.items.every(x=>x.amountCents!==null)?b.items.reduce((n,x)=>n+(x.credit?-1:1)*x.amountCents,0):null,b.fieldPages?.totalCents??null,'Fatura enviada',true,b.items.map(x=>(x.credit?'-':'+')+' R$ '+(x.amountCents/100).toFixed(2)).join(' '));
  check('reading','Consumo e leituras informadas',b.consumption,[b.currentReading,b.previousReading,b.multiplier].every(x=>x!==null)&&b.currentReading>=b.previousReading?(b.currentReading-b.previousReading)*b.multiplier:null,b.fieldPages?.consumption??null,'Leituras declaradas na fatura; não comprova medição real',false,`(${b.currentReading} - ${b.previousReading}) × ${b.multiplier}`);
  for(const x of b.items){
   if(b.items.some(other=>other!==x&&other.label===x.label&&other.amountCents===x.amountCents))checks.push({...base,rule:'repeated_item',state:'not_checked',label:x.label,reason:'Lançamento repetido: indício para conferência, sem presumir duplicidade.'});
   check('item',x.label,x.amountCents,x.quantity!==null&&x.rate!==null?Math.round(x.quantity*x.rate*100):null,x.page,'Fatura enviada',true,`${x.quantity} × R$ ${x.rate}`);
   const matching=references.filter(r=>r.kind==='tariff'&&(r.distributor===b.distributor||(b.distributorCnpj&&r.cnpj===b.distributorCnpj.replace(/\D/g,'')))&&r.tariffClass===b.tariffClass&&r.tariffSubclass===b.tariffSubclass&&r.detail===b.detail&&r.accessingAgent===b.accessingAgent&&r.unit===x.unit&&r.subgroup===b.subgroup&&r.mode===b.tariffMode&&r.component===x.component&&r.post===x.post&&r.taxIncluded===b.taxIncluded&&b.start&&b.end&&r.start<=b.start&&r.end>=b.end);
   const rate=matching.length&&matching.every(r=>r.rate===matching[0].rate)?matching[0]:null;
   if(b.modality!=='free')check('tariff',`Tarifa: ${x.label}`,x.amountCents,rate&&x.quantity!==null?Math.round(x.quantity*rate.rate*100):null,x.page,rate?.source||'Sem referência compatível',true,rate?`${x.quantity} ${x.unit} × R$ ${rate.rate}`:'');
   const cr=b.contract?.confirmed&&b.start&&b.end&&b.contract.start<=b.start&&b.contract.end>=b.end&&b.contract.rates.find(r=>r.label===x.label&&r.taxIncluded===b.taxIncluded);
   if(['large','free'].includes(b.modality))check('contract',`Contrato: ${x.label}`,x.amountCents,cr&&x.quantity!==null?Math.round(x.quantity*cr.rate*100):null,x.page,'Contrato confirmado pelo cliente',true,cr?`${x.quantity} × R$ ${cr.rate}`:'');
  }
  for(const x of b.taxes)check('tax',`Aritmética: ${x.label}`,x.amountCents,x.baseCents!==null&&x.percent!==null?Math.round(x.baseCents*x.percent/100):null,x.page,'Base e alíquota declaradas; validade jurídica não conferida',true,`R$ ${x.baseCents/100} × ${x.percent}%`);
  checks.push({...base,rule:'tax_law',state:'not_checked',label:'Enquadramento jurídico dos tributos',reason:'Revisão especializada necessária'});
  // Separate registers: never turn generation or a transfer into money automatically.
  if(b.modality==='solar'){
   const s=b.solar;check('solar','Conciliação dos créditos (kWh)',s?.closing??null,s&&Object.values(s).every(v=>v!==null)?s.opening+s.incoming+s.transferredIn-s.transferredOut-s.used-s.expired:null,b.fieldPages?.solar??null,'Histórico completo de créditos informado',false,s?`${s.opening} + ${s.incoming} + ${s.transferredIn} - ${s.transferredOut} - ${s.used} - ${s.expired} kWh`:'');
  }
  const bandItems=b.items.filter(x=>x.component==='bandeira');
  for(const x of bandItems){
   const r=references.find(r=>r.kind==='flag'&&r.month===b.month&&r.label===b.flagLabel&&b.interconnected===true&&x.unit==='kWh'&&r.taxIncluded===b.taxIncluded&&b.start?.slice(0,7)===b.month&&b.end?.slice(0,7)===b.month);
   check('flag','Bandeira tarifária',x.amountCents,r&&x.quantity!==null&&!['solar','free'].includes(b.modality)?Math.round(r.rate*x.quantity*100):null,x.page,r?.source||'Sem referência ou base aplicável',true,r?`${x.quantity} kWh × R$ ${r.rate}`:'');
  }
 }
 for(const d of documents.filter(d=>d.type==='invoice'&&!d.bill&&!d.supersededBy))pending.push({documentId:d.id,message:d.error||'Leitura ainda não concluída.'});
 // Overlapping checks describe the same money: no aggregate recovery total.
 return {version:VERSION,createdAt:new Date().toISOString(),state:findings.length?'differences':pending.length||!checks.some(x=>x.state==='checked')?'insufficient':'partial',findings,checks,pending,notice:'Análise parcial das verificações executadas. Diferenças não são restituição aprovada. Não somamos achados que podem representar a mesma cobrança.',specialist:'Saldo residual de PIS/Cofins e enquadramento jurídico dependem de revisão especializada.'};
}
