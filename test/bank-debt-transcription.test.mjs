import test from 'node:test';import assert from 'node:assert/strict';
import {printedCents,transcribePages,acceptReread} from '../services/bank-debt-transcription.mjs';
const page=rows=>({bank:'Banco fictício',accountKey:'test',person:'pj',modality:'overdraft',rows,unreadable:[]});
const row=(type,amountText,description='SALDO EM',date='2024-09-09')=>({type,amountText,description,date,rateText:null});
test('coluna numérica determina sinal; crédito de limite não vira juros nem pagamento presumido',()=>{
 assert.equal(printedCents('12.000,00'),1200000);assert.equal(printedCents('12.000,00-'),-1200000);assert.equal(printedCents('1.234,56 D'),-123456);assert.equal(printedCents('0,00'),0);assert.throws(()=>printedCents('1.2,00'));assert.throws(()=>printedCents('-123,45C'));
 const r=transcribePages([page([row('opening','12.000,00-'),row('transaction','12.000,00','ENC LIM CREDITO'),row('balance','0,00')])]);
 assert.equal(r.entries[0].amountCents,1200000);assert.equal(r.entries[0].kind,'transfer');assert.equal(r.entries[0].balanceCents,0);assert.equal(r.checkpoints.length,0);assert.equal(r.rawRows.length,3);
 const wrong=transcribePages([page([row('opening','12.000,00-'),row('transaction','12.000,00-','ENC LIM CREDITO'),row('balance','0,00')])]);assert.equal(wrong.checkpoints.length,1);assert.equal(wrong.checkpoints[0].expectedCents,-2400000);
 const omitted=transcribePages([page([row('opening','100,00-'),row('balance','200,00-')])]);assert.equal(omitted.checkpoints.length,1);
 const across=transcribePages([page([row('opening','100,00-'),row('transaction','10,00-','TARIFA')]),page([row('balance','110,00-')])]);assert.equal(across.checkpoints.length,0);assert.equal(across.entries[0].balanceCents,-11000);
 const missingDate=transcribePages([page([row('transaction','10,00-','TARIFA',null)])]);assert.equal(missingDate.entries.length,0);assert.match(missingDate.issues[0],/data/);
 const original=page([row('opening','100,00-'),row('transaction','10,00-','TARIFA'),row('balance','90,00-')]),corrected=page([row('opening','100,00-'),row('transaction','10,00','ESTORNO'),row('balance','90,00-')]);
 assert.equal(acceptReread(original,corrected,transcribePages([original]),transcribePages([corrected])),true);
 assert.equal(acceptReread(original,page([]),transcribePages([original]),transcribePages([page([])])),false);
 assert.equal(acceptReread(original,original,transcribePages([original]),transcribePages([original])),false);
});
