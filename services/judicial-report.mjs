const fail=message=>{throw Object.assign(new Error(message),{status:400});};
const text=(v,label,max=200)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail('Confira '+label+'.');return v.trim();};
export function decimalUnits(value,places,label,min,max){
 const s=String(value??'').trim().replace(',','.');
 if(!new RegExp('^-?\\d{1,12}(?:\\.\\d{1,'+places+'})?$').test(s))fail('Confira '+label+'. Use números sem separador de milhar.');
 const negative=s.startsWith('-'),[a,b='']=s.replace('-','').split('.');
 const n=BigInt(a)*10n**BigInt(places)+BigInt(b.padEnd(places,'0'));
 const result=Number(negative?-n:n);
 if(!Number.isSafeInteger(result)||result<min||result>max)fail('Confira '+label+'. Valor fora do limite.');
 return result;
}
const date=(v,label)=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))fail('Confira '+label+'.');const n=Date.parse(v+'T00:00:00Z');if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==v||v<'1900-01-01'||v>'2200-12-31')fail('Confira '+label+'.');return v;};
const rounded=(n,d)=>Number(n<0n?-((-n+d/2n)/d):(n+d/2n)/d);
export const reportMoney=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
export function calculateJudicialReport(raw){
 if(!raw||typeof raw!=='object')fail('Informe os dados do relatório.');
 const optional=['asOf','index','correction','interest','interestStart','fees','interestBase'];
 if(optional.some(key=>raw[key]===undefined||raw[key]===null||String(raw[key]).trim()==='')){
  const data={};
  for(const [key,label,max] of [['process','processo',80],['court','juízo/comarca',250],['subject','classe/assunto',250],['claimant','exequente',250],['defendant','executada',250],['decision','decisão-base',1500]])data[key]=text(raw[key],label,max);
  data.principal=decimalUnits(raw.principal,2,'valor homologado',1,100000000000);
  data.homologationDate=date(raw.homologationDate,'data da homologação');
  data.source=raw.source?text(raw.source,'origem',250):'Preenchimento manual';
  data.optional={};
  for(const key of optional){if(raw[key]===undefined||raw[key]===null||String(raw[key]).trim()==='')continue;
   if(['asOf','interestStart'].includes(key))data.optional[key]=date(raw[key],key);
   else if(['correction','interest','fees'].includes(key)){decimalUnits(raw[key],4,key,key==='correction'?-990000:0,key==='correction'?10000000:1000000);data.optional[key]=String(raw[key]);}
   else if(key==='interestBase'){if(!['original','corrected'].includes(raw[key]))fail('Escolha a base dos juros.');data.optional[key]=raw[key];}
   else data.optional[key]=text(raw[key],'índice',500);
  }
  if(data.optional.asOf&&(data.optional.asOf<data.homologationDate||data.optional.asOf<data.optional.interestStart))fail('Confira as datas de atualização e início dos juros.');
  return {data,calculated:false};
 }
 const data={};
 for(const [key,label,max] of [['process','processo',80],['court','juízo/comarca',250],['subject','classe/assunto',250],['claimant','exequente',250],['defendant','executada',250],['decision','decisão-base',1500],['index','índice e fonte da correção',500]])data[key]=text(raw[key],label,max);
 for(const [key,label] of [['homologationDate','data da homologação'],['asOf','data da atualização'],['interestStart','início dos juros']])data[key]=date(raw[key],label);
 if(data.asOf<data.homologationDate||data.asOf<data.interestStart)fail('A data de atualização não pode anteceder a homologação ou o início dos juros.');
 data.principal=decimalUnits(raw.principal,2,'valor homologado',1,100000000000);
 data.correction=decimalUnits(raw.correction,4,'correção acumulada',-990000,10000000);
 data.interest=decimalUnits(raw.interest,4,'juros mensais',0,1000000);
 data.fees=decimalUnits(raw.fees,4,'honorários',0,1000000);
 if(!['original','corrected'].includes(raw.interestBase))fail('Escolha a base dos juros.');
 data.interestBase=raw.interestBase;
 data.source=raw.source?text(raw.source,'origem',250):'Preenchimento manual';
 const days=Math.round((Date.parse(data.asOf)-Date.parse(data.interestStart))/86400000);
 const correction=rounded(BigInt(data.principal)*BigInt(data.correction),1000000n);
 const corrected=data.principal+correction;
 const interest=rounded(BigInt(data.interestBase==='corrected'?corrected:data.principal)*BigInt(data.interest)*BigInt(days),30000000n);
 const subtotal=corrected+interest;
 const fees=rounded(BigInt(subtotal)*BigInt(data.fees),1000000n);
 const total=subtotal+fees;
 if(!Number.isSafeInteger(total)||total>10000000000000)fail('O total excede o limite de cálculo.');
 return {data,days,correction,corrected,interest,subtotal,fees,total};
}
