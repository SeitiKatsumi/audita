import test from 'node:test';
import assert from 'node:assert/strict';
import {certificateSelection} from '../certificate-selection.js';
import {sellerStatePlans} from '../services/seller-state-plan.mjs';

test('UF plans and selectable courts separate PF and PJ without promoting legacy PF evidence',()=>{
  const coverage={certificates:[
    {uf:'DF',type:'Cível',provider:'portal',documentTypes:['cpf','cnpj']},
    {uf:'DF',type:'Criminal',provider:'direct_data',documentTypes:['cpf']},
    {uf:'ES',type:'Cível',provider:'portal'},
    {uf:'AP',type:'Falência',provider:'direct_data',documentTypes:['cnpj']},
  ],pdfQueryCostBrl:.54,sellerSources:{configured:true,queries:[]}};
  coverage.states=sellerStatePlans(coverage);
  coverage.companyStates=sellerStatePlans(coverage,'cnpj');
  assert.equal(coverage.states.find(s=>s.uf==='DF').certificateCount,2);
  assert.equal(coverage.companyStates.find(s=>s.uf==='DF').certificateCount,1);
  assert.equal(coverage.companyStates.find(s=>s.uf==='AP').baseCostBrl,.54);
  assert.equal(coverage.companyStates.find(s=>s.uf==='ES').certificateCount,0);
  assert.deepEqual(certificateSelection(coverage,['DF','ES'],'cnpj').courts.map(c=>c.type),['Cível']);
  assert.equal(certificateSelection(coverage,['DF','ES']).courts.length,3);
  assert.equal(certificateSelection(coverage,['AP']).courts.length,0);
});
