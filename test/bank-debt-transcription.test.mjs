import test from 'node:test';import assert from 'node:assert/strict';
import {printedCents,transcribePages,acceptReread} from '../services/bank-debt-transcription.mjs';
const page=rows=>({bank:'Banco fictício',accountKey:'test',person:'pj',modality:'overdraft',rows,unreadable:[]});
const row=(type,amountText,description='SALDO EM',date='2024-09-09')=>({type,amountText,description,date,rateText:null});

test('printed balance labels and carry lines do not invent transactions or remove a real transport debit',()=>{
 const original=page([row('opening','100,00DV'),row('transaction','10,00-','JUROS REMUN'),row('balance','110,00DV'),row('opening','110,00DV','TRANSPORTE'),row('transaction','1,00-','TRANSPORTE'),row('balance','111,00DV')]);
 const result=transcribePages([original]);assert.equal(result.entries.length,2);assert.equal(result.rawRows.length,5);
 assert.equal(result.opening.balanceCents,-10000);assert.equal(result.closing.balanceCents,-11100);assert.equal(result.checkpoints.length,0);
 assert.equal(original.rows[0].type,'opening');assert.equal(original.rows[3].description,'TRANSPORTE');
 const reread=page(original.rows.filter((_,i)=>i!==3));
 assert.equal(acceptReread(original,reread,{checkpoints:[{}],issues:['carry misclassified']},{checkpoints:[],issues:[]}),true);
 reread.rows=reread.rows.filter(r=>r.type!=='transaction');assert.equal(acceptReread(original,reread,{checkpoints:[{}],issues:['error']},{checkpoints:[],issues:[]}),false);
});

test('reread can fix an unreadable amount without deleting financial rows or introducing imbalance',()=>{
 const original=page([row('opening','100,00DV'),row('transaction','','TARIFA'),row('balance','101,00DV')]);
 const reread=structuredClone(original);reread.rows[1].amountText='1,00-';
 assert.equal(acceptReread(original,reread,{checkpoints:[],issues:['unreadable']},{checkpoints:[],issues:[]}),true);
 assert.equal(acceptReread(original,reread,{checkpoints:[],issues:['unreadable']},{checkpoints:[{}],issues:[]}),false);
});

test('primeiro saldo impresso abre o período e formatos da mesma conta não divergem',()=>{
 const pages=['1234-5 12.345-6','1234-5/12.345-6','1234-5 / 12.345-6'].map(accountKey=>({...page([row('balance','0,00CR')]),accountKey}));
 const result=transcribePages(pages);assert.equal(result.opening.balanceCents,0);assert.equal(result.opening.date,'2024-09-09');assert.equal(result.accountKey,'1234-5/12345-6');assert.equal(result.issues.length,0);
 pages[2].accountKey='1234-5/12.345-7';assert.match(transcribePages(pages).issues.join(' '),/contas diferentes/);
 assert.equal(transcribePages([page([row('transaction','1,00-','TARIFA')])]).opening,null);
});

test('extrato com duas folhas conserva sinais CR/DV e rubricas completas',()=>{
 assert.equal(printedCents('1.234,56CR'),123456);assert.equal(printedCents('1.234,56DV'),-123456);
 assert.throws(()=>printedCents('-1,00CR'));assert.throws(()=>printedCents('+1,00DV'));
 const r=transcribePages([page([row('opening','100,00DV'),row('transaction','10,00-','ENCARGOS LIMITE DE CRED'),row('balance','110,00DV'),row('transaction','110,00','ENCARGOS LIM CREDITO'),row('balance','0,00CR')])]);
 assert.equal(r.entries[0].kind,'interest');assert.equal(r.entries[1].kind,'transfer');
 assert.equal(r.checkpoints.length,0);assert.equal(r.closing.balanceCents,0);
});
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

test('saldo devedor textual preserva dívida e utilização do limite é débito',()=>{
 const r=transcribePages([page([row('opening','0,00'),row('transaction','-10.000,00','UTILIZAÇÃO CHEQUE ESPECIAL'),row('transaction','-20.925,80','JUROS REMUNERATÓRIOS'),row('balance','-30.925,80'),row('balance','30.925,80','SALDO DEVEDOR FINAL')])]);
 assert.equal(r.closing.balanceCents,-3092580);assert.equal(r.entries[0].kind,'debit');assert.equal(r.checkpoints.length,0);assert.equal(r.issues.length,0);assert.equal(r.rawRows.at(-1).amountText,'30.925,80');
 const bad=transcribePages([page([row('opening','0,00'),row('balance','30,00C','SALDO DEVEDOR')])]);assert.match(bad.issues.join(' '),/contraditório/);
});
