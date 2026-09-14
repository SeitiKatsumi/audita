import {z} from 'zod';
import {debtParse,debtRequire,debtMoney} from './bank-debt-domain.mjs';

export const DEBT_SERIES={
  overdraft:{code:25463,label:'Pessoa física — cheque especial'},
  loan:{code:25464,label:'Pessoa física — crédito pessoal não consignado'},
  vehicle:{code:25471,label:'Pessoa física — aquisição de veículos'},
  revolving:{code:25477,label:'Pessoa física — cartão de crédito rotativo'},
};
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v);return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v&&v>='1994-01-01';},'Data inválida.');
const cents=z.number().int().min(0).max(10000000000);
const schema=z.object({modality:z.enum(['overdraft','loan','vehicle','revolving']),contractDate:date,baseDate:date,asOf:date,baseCents:cents.refine(v=>v>0),contractMonthlyRate:z.number().min(0).max(100).nullable(),capitalization:z.enum(['compound','simple']),payments:z.array(z.object({date,amountCents:cents.refine(v=>v>0)}).strict()).max(120),confirmed:z.literal(true)}).strict();
export function parseEstimate(input,today=new Date().toISOString().slice(0,10)){
  const s=debtParse(schema,input);
  debtRequire(s.contractDate<=s.baseDate&&s.baseDate<s.asOf&&s.asOf<=today,'Confira as datas: contratação, saldo inicial e cobrança, nessa ordem, sem datas futuras.');
  debtRequire((Date.parse(s.asOf)-Date.parse(s.baseDate))/86400000<=3660,'Períodos acima de dez anos precisam de análise manual.');
  debtRequire(s.payments.every(p=>p.date>=s.baseDate&&p.date<=s.asOf),'Os pagamentos devem estar dentro do período informado.');
  s.payments.sort((a,b)=>a.date.localeCompare(b.date));return s;
}
export async function fetchDebtRate(modality,month,{fetchImpl=fetch,now=()=>new Date()}={}){
  const series=DEBT_SERIES[modality];debtRequire(series&&/^\d{4}-\d{2}$/.test(month),'Modalidade ou mês inválido.');
  const [year,m]=month.split('-'),last=new Date(Date.UTC(Number(year),Number(m),0)).getUTCDate();
  const url=`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${series.code}/dados?formato=json&dataInicial=01/${m}/${year}&dataFinal=${last}/${m}/${year}`;
  try{
    const response=await fetchImpl(url,{signal:AbortSignal.timeout(12000),redirect:'error'});
    if(!response.ok)throw new Error('BCB unavailable');
    const rows=await response.json();
    const matches=Array.isArray(rows)?rows.filter(r=>r.data===`01/${m}/${year}`):[];
    debtRequire(matches.length===1,'O Banco Central não disponibilizou uma taxa para essa modalidade e mês. A análise manual continua disponível.',503);
    const raw=String(matches[0].valor),rate=Number(raw);
    debtRequire(/^\d+(\.\d+)?$/.test(raw)&&Number.isFinite(rate)&&rate>=0&&rate<=100,'Taxa oficial inválida; solicite análise manual.',503);
    return {...series,month,monthlyPercent:rate,annualEffectivePercent:((1+rate/100)**12-1)*100,url,retrievedAt:now().toISOString(),observation:matches[0]};
  }catch(e){if(e.status)throw e;debtRequire(false,'Não foi possível consultar o Banco Central. Seus dados anteriores foram preservados; tente novamente ou solicite análise manual.',503);}
}
// ponytail: cenário de saldo em aberto sem novos saques; cronogramas Price/SAC exigem revisão específica.
export function evolveDebt(s,monthlyPercent){
  let principal=s.baseCents,interest=0,previous=s.baseDate;const rows=[];
  for(const event of [...s.payments,{date:s.asOf,amountCents:0}]){
    const days=(Date.parse(event.date)-Date.parse(previous))/86400000;
    const opening=principal+interest;
    const accrued=Math.round(s.capitalization==='compound'?opening*((1+monthlyPercent/100)**(days/30)-1):principal*monthlyPercent/100*days/30);
    debtRequire(Number.isSafeInteger(accrued)&&opening+accrued<=1000000000000,'O saldo excede o limite da simulação. Encaminhe para análise manual.');
    interest+=accrued;
    debtRequire(event.amountCents<=principal+interest,'Há pagamento superior ao saldo simulado. É necessário revisar o histórico manualmente.');
    const interestPaid=Math.min(interest,event.amountCents);interest-=interestPaid;principal-=event.amountCents-interestPaid;
    rows.push({from:previous,to:event.date,days,openingCents:opening,interestCents:accrued,paymentCents:event.amountCents,balanceCents:principal+interest});previous=event.date;
  }
  return {balanceCents:principal+interest,rows};
}
export async function estimateDebt(details,input,{rateProvider=fetchDebtRate,now=()=>new Date()}={}){
  const scenario=parseEstimate(input,now().toISOString().slice(0,10));
  const compatible={overdraft:['overdraft'],loan:['loan'],card:['revolving'],financing:['vehicle'],other:[]};
  debtRequire(compatible[details.kind]?.includes(scenario.modality),'A modalidade da estimativa deve corresponder à dívida informada. Outras modalidades seguem para análise manual.');
  const rate=await rateProvider(scenario.modality,scenario.contractDate.slice(0,7));
  debtRequire(rate.code===DEBT_SERIES[scenario.modality].code&&rate.month===scenario.contractDate.slice(0,7)&&Number.isFinite(rate.monthlyPercent)&&rate.monthlyPercent>=0&&rate.monthlyPercent<=100,'Referência BACEN incompatível.',503);
  const revised=evolveDebt(scenario,rate.monthlyPercent);
  const contracted=scenario.contractMonthlyRate===null?null:evolveDebt(scenario,scenario.contractMonthlyRate);
  const differenceCents=Math.max(0,details.chargedCents-revised.balanceCents);
  const assumptions=[
    'Estimativa comparativa, não laudo definitivo nem confirmação automática de abusividade. Não autoriza contratação ou petição sem revisão.',
    `Taxa média BACEN do mês da contratação (${rate.month}), mantida constante no cenário; não é SELIC nem taxa máxima legal.`,
    `Juros ${scenario.capitalization==='compound'?'compostos com equivalência diária':'simples sobre principal remanescente'}, dias corridos/30; arredondamento em centavos a cada pagamento e encerramento. Premissa de simulação a confirmar no contrato.`,
    'Saldo-base informado pelo cliente, sem novas utilizações de crédito. Pagamentos ao fim do dia, primeiro nos juros e depois no principal.',
    'Multa, juros de mora, tarifas, seguros, IOF e correção monetária não são acrescentados ao cenário. Encargos já embutidos no saldo-base não foram expurgados.',
    'A diferença perante a cobrança pode incluir encargos e divergências de informação; não corresponde automaticamente a juros abusivos nem a restituição de valores pagos.',
    'Não reconstrói parcelas Price/SAC, renegociações, limites legais específicos ou alterações de taxa. Esses pontos exigem conferência da equipe.',
  ];
  return {version:'bacen-scenario-1',status:'estimated',createdAt:now().toISOString(),scenario,rate,revised,contracted,chargedCents:details.chargedCents,differenceCents,rateDifferencePoints:scenario.contractMonthlyRate===null?null:scenario.contractMonthlyRate-rate.monthlyPercent,assumptions};
}
export function estimateText(e){
  return [`ESTIMATIVA PRELIMINAR — ${e.version}`,`Referência: SGS ${e.rate.code}, ${e.rate.label}, ${e.rate.month}: ${e.rate.monthlyPercent}% a.m. Fonte: ${e.rate.url}. Consultada em ${e.rate.retrievedAt}.`,
    `Saldo-base: ${debtMoney(e.scenario.baseCents)} em ${e.scenario.baseDate}. Cobrança em ${e.scenario.asOf}: ${debtMoney(e.chargedCents)}. Saldo estimado BACEN: ${debtMoney(e.revised.balanceCents)}. Diferença estimada para análise: ${debtMoney(e.differenceCents)}.`,
    e.contracted?`Cenário à taxa contratada informada (${e.scenario.contractMonthlyRate}% a.m.): ${debtMoney(e.contracted.balanceCents)}. Diferença entre taxas: ${e.rateDifferencePoints.toFixed(4)} pontos percentuais.`:'Taxa contratada não informada: comparação entre taxas indisponível.',
    ...e.assumptions,...e.revised.rows.map(r=>`${r.from} a ${r.to}: saldo ${debtMoney(r.openingCents)}, juros ${debtMoney(r.interestCents)}, pagamento ${debtMoney(r.paymentCents)}, saldo final ${debtMoney(r.balanceCents)}.`)].join('\n');
}
