import test from 'node:test';
import assert from 'node:assert/strict';
import {certificateSelection} from '../certificate-selection.js';
import {sellerStatePlans} from '../services/seller-state-plan.mjs';
import {getAutonomousCertificateCoverage} from '../services/state-court-autonomous.service.mjs';

test('official portal directory covers all states without selling candidates as automatic certificates',()=>{
  const coverage=getAutonomousCertificateCoverage({configured:true,allowedUfs:['BA','SE']});
  assert.equal(new Set(coverage.officialPortals.map(item=>item.uf)).size,27);
  assert(coverage.officialPortals.every(item=>new URL(item.url).protocol==='https:'));
  assert.equal(coverage.officialPortals.find(item=>item.uf==='ES').url,'https://sistemas.tjes.jus.br/certidao-negativa/emitir');
  assert(coverage.certificates.every(item=>item.documentTypes.every(type=>item.validatedDocumentTypes.includes(type))));
  const all=getAutonomousCertificateCoverage({configured:true,allowedUfs:coverage.officialPortals.map(p=>p.uf)});
  assert.deepEqual(all.certificates.filter(c=>c.uf==='DF').map(c=>c.portalType).sort(),['civil','criminal','especial','falencia'],'unproven Direct Data aliases must not inherit portal homologation');
});

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
