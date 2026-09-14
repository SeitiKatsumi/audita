import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateDebt,evolveDebt,fetchDebtRate,parseEstimate,estimateText} from '../services/bank-debt-estimate.mjs';
const scenario={modality:'loan',contractDate:'2025-01-01',baseDate:'2025-01-01',asOf:'2025-01-31',baseCents:100000,contractMonthlyRate:5,capitalization:'simple',payments:[],confirmed:true};
const details={kind:'loan',chargedCents:150000};
const rateProvider=async()=>({code:25464,month:'2025-01',monthlyPercent:2,url:'https://api.bcb.gov.br/test',retrievedAt:'2025-02-01T00:00:00Z',label:'Teste'});
test('estimativa: taxa mensal, saldo, diferença e pagamentos datados',async()=>{
 const e=await estimateDebt(details,scenario,{rateProvider});assert.equal(e.revised.balanceCents,102000);assert.equal(e.contracted.balanceCents,105000);assert.equal(e.differenceCents,48000);assert.equal(e.rateDifferencePoints,3);assert.match(estimateText(e),/SGS 25464/);
 const paid=evolveDebt({...scenario,payments:[{date:'2025-01-16',amountCents:50000}]},2);assert.equal(paid.balanceCents,51510);assert.equal(paid.rows[0].interestCents,1000);assert.equal(paid.rows[1].interestCents,510);
 assert.equal(evolveDebt({...scenario,asOf:'2025-03-02',capitalization:'compound'},2).balanceCents,104040);
 assert.equal(evolveDebt({...scenario,asOf:'2025-03-02'},2).balanceCents,104000);
 assert.equal((await estimateDebt({...details,chargedCents:1},{...scenario,contractMonthlyRate:null},{rateProvider})).differenceCents,0);
 assert.equal((await estimateDebt(details,{...scenario,contractMonthlyRate:null},{rateProvider})).contracted,null);
 assert.throws(()=>evolveDebt({...scenario,payments:[{date:'2025-01-01',amountCents:100001}]},2));
});
test('estimativa: datas, modalidade, valores e referência incompatíveis são rejeitados',async()=>{
 for(const bad of [{contractDate:'2025-02-30'},{asOf:'2099-01-01'},{baseDate:'2024-12-31'},{asOf:'2025-01-01'},{baseCents:-1},{contractMonthlyRate:NaN},{confirmed:false},{payments:[{date:'2025-02-01',amountCents:1}]}])assert.throws(()=>parseEstimate({...scenario,...bad}));
 await assert.rejects(estimateDebt({kind:'other',chargedCents:1},scenario,{rateProvider}));
 await assert.rejects(estimateDebt(details,scenario,{rateProvider:async()=>({...await rateProvider(),month:'2024-01'})}));
});
test('BACEN: consulta apenas o mês exato, mantém proveniência e não usa fallback',async()=>{
 let called;const r=await fetchDebtRate('loan','2025-01',{fetchImpl:async u=>{called=u;return {ok:true,json:async()=>[{data:'01/01/2025',valor:'2.00'}]}}});assert.match(called,/bcdata.sgs.25464/);assert.match(called,/dataFinal=31\/01\/2025/);assert.equal(r.monthlyPercent,2);assert.ok(r.observation);assert.ok(r.retrievedAt);
 for(const rows of [[],[{data:'01/02/2025',valor:'2'}],[{data:'01/01/2025',valor:'NaN'}],[{data:'01/01/2025',valor:'2'},{data:'01/01/2025',valor:'3'}]])await assert.rejects(fetchDebtRate('loan','2025-01',{fetchImpl:async()=>({ok:true,json:async()=>rows})}),{status:503});
 await assert.rejects(fetchDebtRate('loan','2025-01',{fetchImpl:async()=>{throw Error('timeout')}}),{status:503});
});
