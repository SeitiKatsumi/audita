import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizedCnj,processNumbers} from '../judicial-processes.js';
const cnj='0701379-18.2025.8.01.0013';
test('offers only valid CNJs across Direct Data structured fields and certificate text',()=>{
  const number=normalizedCnj(cnj);assert.equal(number,'07013791820258010013');
  for(const data of [{processos:[{numeroProcesso:cnj}]},{processos:[{numero:cnj}]},{processos:[{processo:[number]}]},
    {pessoaJuridica:{pendenciaFinanceira:{acoesJudiciais:[{numeroProcessoPrincipal:cnj}]}}},`Certidão com o processo ${cnj}`]) assert.deepEqual(processNumbers(data),[number]);
  assert.deepEqual(processNumbers({totalProcessos:20000,numeroCertidao:cnj,codigoValidacao:cnj}),[]);
  assert.deepEqual(processNumbers({processos:[{numeroProcesso:cnj,segredoJustica:true}]}),[]);
  assert.deepEqual(processNumbers({processos:[{numeroProcesso:cnj,segredoJustica:'Sim'}]}),[]);
  assert.deepEqual(processNumbers([{cnj},{cnj}]),[number]);
  assert.equal(normalizedCnj(cnj.replace('-18.','-19.')),null);
  const cycle={};cycle.self=cycle;assert.deepEqual(processNumbers(cycle),[]);
});
