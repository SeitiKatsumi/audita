import test from 'node:test';
import assert from 'node:assert/strict';
import {serviceCertificateSelection} from '../certificate-selection.js';
const coverage = {states:[{uf:'SP',queryIds:['processos-agrupados','processos-completos','certidao']}],companyStates:[{uf:'SP',queryIds:['processos-agrupados','processos-completos','certidao']}],certificates:[{uf:'SP',type:'civil',documentTypes:['cpf','cnpj']}],sellerSources:{configured:true,queries:['processos-agrupados','processos-completos','certidao'].map(id=>({id,kind:id==='certidao'?'certificate':'data',documentTypes:['cpf','cnpj'],scope:'Brasil',costBrl:1}))}};
for (const type of ['cpf','cnpj']) {
  test(`national process page isolates the two queries for ${type} without state selection`,()=>{
    const result=serviceCertificateSelection(coverage,[],type,true);
    assert.deepEqual(result.queries.map(q=>q.id),['processos-agrupados','processos-completos']);
    assert.deepEqual(result.courts,[]);
    assert.ok(result.queries.every(q=>q.priceCents===19900));
  });
  test(`general certificates excludes national process queries for ${type}`,()=>{
    const result=serviceCertificateSelection(coverage,['SP'],type);
    assert.deepEqual(result.queries.map(q=>q.id),['certidao']);
    assert.equal(result.courts.length,1);
  });
}
