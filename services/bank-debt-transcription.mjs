import {z} from 'zod';
import {debtRequire} from './bank-debt-domain.mjs';

const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v&&v<=new Date().toISOString().slice(0,10));
export const pageSchema=z.object({bank:z.string(),accountKey:z.string(),person:z.enum(['pf','pj','mei','unknown']),modality:z.enum(['overdraft','revolving','loan','vehicle','unknown']),
 rows:z.array(z.object({date:date.nullable(),type:z.enum(['opening','transaction','balance']),description:z.string().min(1).max(350),amountText:z.string().max(80),rateText:z.string().max(40).nullable()}).strict()).max(400),
 unreadable:z.array(z.string().max(300)).max(20)
}).strict();

export function acceptReread(original,reread,before,after){
 return ['opening','transaction','balance'].every(type=>reread.rows.filter(r=>r.type===type).length>=original.rows.filter(r=>r.type===type).length)&&after.checkpoints.length<before.checkpoints.length&&after.issues.length<=before.issues.length;
}

// O sinal vem da coluna numérica, nunca do nome da rubrica.
export function printedCents(text){
 const raw=String(text).trim().toUpperCase().replace(/R\$/g,'').replace(/\s/g,'');
 debtRequire(/^[+-]?(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2}[DC+-]?$/.test(raw),'Valor impresso ilegível ou em formato não reconhecido.');
 const negative=raw.startsWith('-')||/[-D]$/.test(raw),positive=raw.startsWith('+')||/[+C]$/.test(raw);
 debtRequire(!(negative&&positive),'Sinal impresso contraditório.');
 const amount=Number(raw.replace(/[^0-9]/g,''));debtRequire(Number.isSafeInteger(amount)&&amount<=10000000000,'Valor fora do limite.');return negative?-amount:amount;
}
function category(description,amount){
 const d=description.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
 if(/ENC\s*LIM\s*CREDITO|JUROS REMUN/.test(d))return amount<0?'interest':'transfer';
 if(/MORA|MULTA/.test(d))return 'late_fee';
 if(/IOF/.test(d))return 'tax';
 if(/TARIFA|CESTA/.test(d))return 'fee';
 if(/ESTORNO|CH DEV|RESGATE|APL[ .]INVEST/.test(d))return 'transfer';
 if(/PIX|DEP DIN|DEPOSITO/.test(d))return amount>=0?'payment':'debit';
 if(/SAQ|CHQ COMPENSADO|COMPRA|GASTO C CREDITO/.test(d))return amount<0?'debit':'transfer';
 if(/UTILIZA[ÇC][ÃA]O CHEQUE ESPECIAL|UTILIZACAO CHEQUE ESPECIAL/.test(d))return amount<0?'debit':'unknown';
 return 'unknown';
}
export function transcribePages(pages){
 const entries=[],checkpoints=[],issues=[],rawRows=[];let opening=null,closing=null,balance=null,first=true;
 for(const [index,input] of pages.entries()){
  const page=pageSchema.parse(input),physical=index+1;
  issues.push(...page.unreadable.map(s=>`Página ${physical}: ${s}`));
  for(const [line,row] of page.rows.entries()){
   rawRows.push({...row,page:physical,line:line+1});
   let value;try{value=printedCents(row.amountText);}catch{issues.push(`Página ${physical}, linha ${line+1}: confira o valor impresso.`);continue;}
   if(row.type!=='transaction'&&/\bSALDO\b.*\bDEVEDOR\b/i.test(row.description)){
    if(/^\s*\+|[+C]\s*$/i.test(row.amountText)){issues.push(`Página ${physical}, linha ${line+1}: saldo devedor com sinal credor contraditório.`);continue;}
    value=-Math.abs(value);
   }
   if(!row.date){issues.push(`Página ${physical}, linha ${line+1}: data não identificada.`);continue;}
   if(row.type==='opening'){
    if(first){opening={date:row.date,balanceCents:value,evidence:`Página ${physical}: ${row.amountText}`};balance=value;first=false;}
    else if(balance!==null&&value!==balance){issues.push(`Página ${physical}: saldo anterior impresso não corresponde ao saldo precedente; conferir continuidade.`);}
    continue;
   }
   if(row.type==='balance'){
    if(balance!==null&&Math.abs(balance-value)>2)checkpoints.push({page:physical,line:line+1,expectedCents:balance,printedCents:value});
    const last=entries.at(-1);if(last&&last.date===row.date)last.balanceCents=value;
    balance=value;closing={date:row.date,balanceCents:value,evidence:`Página ${physical}: ${row.amountText}`};first=false;continue;
   }
   if(first)first=false;
   if(balance!==null)balance+=value;
   const rate=row.rateText?.replace(/\s|%/g,'').replace(',','.');
   entries.push({date:row.date,page:physical,description:row.description,amountCents:value,kind:category(row.description,value),ratePercent:rate&&/^\d+(\.\d+)?$/.test(rate)&&Number(rate)<=100?Number(rate):null,balanceCents:null,amountText:row.amountText});
  }
 }
 const known=key=>[...new Set(pages.map(p=>p[key]).filter(v=>v&&v!=='unknown'))];
 const people=known('person'),accounts=known('accountKey'),modalities=known('modality');
 if(accounts.length>1)issues.push('Os arquivos contêm contas diferentes.');
 if(people.length>1)issues.push('O enquadramento PF/PJ/MEI diverge entre páginas.');
 for(const c of checkpoints)issues.push(`Página ${c.page}, linha ${c.line}: os movimentos não fecham com o saldo impresso.`);
 return {bank:known('bank')[0]||'',accountKey:accounts.length===1?accounts[0]:'',person:people.length===1?people[0]:'unknown',modality:modalities.length===1?modalities[0]:'unknown',pages:pages.length,opening,closing,entries,issues:[...new Set(issues)],rawRows,checkpoints};
}
