import test from 'node:test';
import assert from 'node:assert/strict';
import {bindRecoveryPostalCode} from '../charge-analysis.js';
function setup(fetcher){
 const handlers={},status={textContent:''},elements={};
 for(const name of ['street','district','city','uf','postalCode','addressNumber','addressComplement'])elements[name]={name,value:'',maxLength:160};
 const form={id:'chargeRecoveryForm',isConnected:true,elements,querySelector:()=>status};
 elements.postalCode.form=form;
 bindRecoveryPostalCode({addEventListener:(type,fn)=>handlers[type]=fn},fetcher);
 return {elements,status,form,run:(cep,type='input')=>{elements.postalCode.value=cep;return handlers[type]({target:elements.postalCode});}};
}
const address={logradouro:'Rua Exemplo',bairro:'Centro',localidade:'São Paulo',uf:'SP'};
const response=data=>({ok:true,json:async()=>data});
test('complete CEP fills address once, keeps number/complement and permits manual edits',async()=>{
 let calls=0;const s=setup(async(url)=>{calls++;assert.match(url,/01001000\/json\/$/);return response(address);});
 s.elements.addressNumber.value='10';s.elements.addressComplement.value='Sala 2';
 await s.run('01001');assert.equal(calls,0);
 await s.run('01001-000');await s.run('01001-000','change');assert.equal(calls,1);
 for(const [name,key] of Object.entries({street:'logradouro',district:'bairro',city:'localidade',uf:'uf'}))assert.equal(s.elements[name].value,address[key]);
 assert.equal(s.elements.addressNumber.value,'10');assert.equal(s.elements.addressComplement.value,'Sala 2');
 s.elements.street.value='Correção manual';await s.run('01001');assert.equal(s.elements.street.value,'Correção manual');assert.equal(s.elements.city.value,'');
});
test('stale lookup cannot override a new CEP or edits made during lookup',async()=>{
 const pending=[];const s=setup(()=>new Promise(resolve=>pending.push(resolve)));
 const first=s.run('01001000');const second=s.run('20040002');s.elements.street.value='Rua digitada';
 pending[1](response({...address,logradouro:'Outra rua',localidade:'Rio de Janeiro',uf:'RJ'}));await second;
 pending[0](response(address));await first;
 assert.equal(s.elements.city.value,'Rio de Janeiro');assert.equal(s.elements.street.value,'Rua digitada');
});
test('not found and network errors leave manual entry available and allow retry',async()=>{
 let calls=0;const s=setup(async()=>{calls++;if(calls===1)return response({erro:true});throw Error('offline');});
 await s.run('99999999');assert.match(s.status.textContent,/não encontrado/);
 s.elements.street.value='Manual';await s.run('99999999','change');assert.match(s.status.textContent,/manualmente/);assert.equal(s.elements.street.value,'Manual');assert.equal(calls,2);
});
test('detached forms are not updated and generic CEP leaves missing fields editable',async()=>{
 let finish;const s=setup(()=>new Promise(resolve=>finish=resolve));const p=s.run('01001000');s.form.isConnected=false;finish(response(address));await p;assert.equal(s.elements.city.value,'');
 const generic=setup(async()=>response({...address,logradouro:'',bairro:''}));await generic.run('01001000');assert.equal(generic.elements.street.value,'');assert.equal(generic.elements.city.value,'São Paulo');
});
