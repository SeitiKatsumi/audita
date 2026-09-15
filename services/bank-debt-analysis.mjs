import {statementSchema} from './bank-debt-ai.mjs';
import {debtParse,debtRequire} from './bank-debt-domain.mjs';
import {fetchDebtRate,DEBT_SERIES} from './bank-debt-estimate.mjs';
import {ITAU_CHARGE_SERVICE_TIERS} from './billing-catalog.service.mjs';

export function debtPlan(saving){return ITAU_CHARGE_SERVICE_TIERS[saving<=1000000?0:saving<=2000000?1:2];}
export async function analyzeStatements(documents,{rateProvider=fetchDebtRate}={}){
 debtRequire(documents.length,'Envie ao menos um extrato.');
 const files=documents.map(d=>({...d,data:debtParse(statementSchema,d.data)}));
 const issues=files.flatMap(d=>d.data.issues.map(message=>({documentId:d.id,message})));
 const rows=files.flatMap(d=>d.data.entries.map(e=>({...e,documentId:d.id}))).sort((a,b)=>a.date.localeCompare(b.date));
 const add=message=>issues.push({documentId:null,message});
 if(!rows.length)add('Não foram encontrados lançamentos legíveis. Envie outro extrato.');
 const accounts=new Set(files.map(d=>d.data.accountKey).filter(Boolean));
 if(accounts.size!==1)add('Confirme que os documentos pertencem à mesma conta.');
 const people=new Set(files.map(d=>d.data.person)),modalities=new Set(files.map(d=>d.data.modality));
 const person=files[0].data.person,modality=files[0].data.modality;
 if(person==='pf'&&rows.some(r=>/empresarial|pessoa jur[ií]dica/i.test(r.description)))add('Há indícios de conta empresarial. Envie o contrato para confirmar a modalidade PF/PJ/MEI.');
 if(people.size!==1||person==='unknown')add('Envie o contrato ou comprovante que identifique se a conta é PF, PJ ou MEI.');
 if(modalities.size!==1||modality!=='overdraft')add('Esta modalidade precisa de metodologia específica da equipe para calcular o saldo.');
 if(rows.some(r=>['late_fee','transfer','unknown'].includes(r.kind)))add('Há mora, transferências ou lançamentos a esclarecer. Envie o demonstrativo detalhado da evolução da dívida.');
 const seen=new Set();for(const r of rows){const key=[r.date,r.description,r.amountCents].join('|');if(seen.has(key))add('Há possíveis lançamentos repetidos entre documentos. A equipe precisa conferir a sobreposição.');seen.add(key);}
 const ordered=[...files].sort((a,b)=>(a.data.entries[0]?.date||'').localeCompare(b.data.entries[0]?.date||''));
 const opening=ordered[0].data.opening,closing=ordered.at(-1).data.closing;
 let checkpoint=null;for(const row of rows){if(checkpoint!==null)checkpoint+=row.amountCents;if(row.balanceCents!==null){if(checkpoint!==null&&Math.abs(checkpoint-row.balanceCents)>2)add('Há um lançamento com sinal ou valor incompatível com os saldos impressos. A equipe precisa conferir a leitura.');checkpoint=row.balanceCents;}}
 if(rows.some(r=>r.page>files.find(f=>f.id===r.documentId).data.pages))add('A referência de página de um lançamento é inválida.');
 if(!opening||!closing)add('Envie o saldo anterior e o saldo final do período para conferir a evolução.');
 if(opening&&closing){
  if(opening.date>rows[0]?.date||closing.date<rows.at(-1)?.date||Date.parse(closing.date)-Date.parse(opening.date)>3660*86400000)add('As datas do período precisam ser conferidas.');
  let balance=opening.balanceCents;
  for(const row of rows){balance+=row.amountCents;if(row.balanceCents!==null&&Math.abs(balance-row.balanceCents)>2){add('Os lançamentos não fecham com um saldo impresso. Há dados faltantes ou leitura a conferir.');break;}}
  if(Math.abs(balance-closing.balanceCents)>2)add('A soma das movimentações não corresponde ao saldo final.');
  if(closing.balanceCents>=0)add('O último saldo não demonstra dívida em aberto. Envie a cobrança atual.');
 }
 const totals={interestCents:0,lateCents:0,feesCents:0,taxCents:0};
 for(const r of rows){const key={interest:'interestCents',late_fee:'lateCents',fee:'feesCents',tax:'taxCents'}[r.kind];if(key&&r.amountCents<0)totals[key]-=r.amountCents;}
 if(!totals.interestCents&&!totals.lateCents)add('Não encontramos juros identificados nos arquivos enviados.');
 const result={version:'statement-analysis-2',createdAt:new Date().toISOString(),documents:files.map(f=>({id:f.id,pages:f.data.pages,rawRows:f.data.rawRows||[],checkpoints:f.data.checkpoints||[],extractionAudit:f.data.extractionAudit||[]})),bank:files[0].data.bank,person,modality,totals,rows,issues,opening,closing,range:null,rates:[],assumptions:['Comparação preliminar com a taxa média BACEN de cada mês, não promessa de acordo ou valor judicialmente devido.','Tarifas e IOF são mantidos; não se presume que sejam indevidos.','Movimentações no fim do dia; referência de 30 dias. Faixa entre cenários simples diário e composto diário.']};
 if(issues.length)return result;
 const series=person==='pj'?'pjOverdraft':'overdraft';let day=opening.date;
 try{while(day<=closing.date){const month=day.slice(0,7);if(!result.rates.some(r=>r.month===month)){const rate=await rateProvider(series,month);debtRequire(rate.code===DEBT_SERIES[series].code&&rate.month===month&&Number.isFinite(rate.monthlyPercent)&&rate.monthlyPercent>=0&&rate.monthlyPercent<=100,'Referência BACEN incompatível.',503);result.rates.push(rate);}day=new Date(Date.parse(day)+86400000).toISOString().slice(0,10);}}
 catch{add('A referência do Banco Central está indisponível. Tente analisar novamente.');return result;}
 // ponytail: comparação diária de cheque especial até dez anos; outras modalidades exigem metodologia própria.
 const scenario=compound=>{let balance=opening.balanceCents,accrued=0,day=opening.date;const byDate=new Map();for(const r of rows){if(!byDate.has(r.date))byDate.set(r.date,[]);byDate.get(r.date).push(r);}
  while(day<=closing.date){if(day>opening.date&&balance<0){const rate=result.rates.find(r=>r.month===day.slice(0,7)).monthlyPercent/100;const interest=Math.round(-balance*(compound?Math.pow(1+rate,1/30)-1:rate/30));if(compound)balance-=interest;else accrued+=interest;}
   for(const r of byDate.get(day)||[]){if(r.kind!=='interest')balance+=r.amountCents;}
   if(!compound&&balance>0&&accrued>0){const paid=Math.min(balance,accrued);balance-=paid;accrued-=paid;}
   debtRequire(Number.isSafeInteger(balance)&&Math.abs(balance)+accrued<1e12,'Saldo fora do limite da análise.');day=new Date(Date.parse(day)+86400000).toISOString().slice(0,10);
  }return Math.max(0,-balance+accrued);};
 const a=scenario(false),b=scenario(true),minCents=Math.min(a,b),maxCents=Math.max(a,b),chargedCents=-closing.balanceCents;
 if(maxCents>=chargedCents){add('A comparação não indica redução positiva nos dois cenários. A equipe precisa revisar.');return result;}
 result.range={minCents,maxCents,chargedCents,minReductionPercent:Math.floor((chargedCents-maxCents)/chargedCents*10000)/100,maxReductionPercent:Math.floor((chargedCents-minCents)/chargedCents*10000)/100,asOf:closing.date};
 return result;
}
