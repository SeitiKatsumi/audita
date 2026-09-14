import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('máscara BRL conserva centavos, limites e limpeza',()=>{
 const source=readFileSync(new URL('../bank-debt.js',import.meta.url),'utf8');
 const {maskCurrency,currencyCents}=vm.runInNewContext(source.slice(source.indexOf('const money='),source.indexOf('const questions='))+';({maskCurrency,currencyCents})');
 const input={value:'',dataset:{minCents:'1'},setCustomValidity(message){this.error=message;}};
 for(const [raw,expected,cents] of [['1345967','R$ 13.459,67',1345967],['87976500','R$ 879.765,00',87976500],['R$ 1.234,56','R$ 1.234,56',123456],['1','R$ 0,01',1],['','',0]]){
  input.value=raw;maskCurrency(input);assert.equal(input.value.replace(/\u00a0/g,' '),expected);assert.equal(currencyCents(input.value),cents);assert.equal(input.error,'');
 }
 input.value='0';maskCurrency(input);assert.ok(input.error);
 input.dataset.minCents='0';maskCurrency(input);assert.equal(input.error,'');
 input.value='10000000001';maskCurrency(input);assert.ok(input.error);
});
