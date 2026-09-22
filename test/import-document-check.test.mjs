import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {decimal,compareLines,suggestPairs,initialCheck,evaluateCheck,documentExtractionSchema,documentReport} from '../services/import-document-check.mjs';

const docs=['invoice','packing','technical'].map(type=>({id:randomUUID(),type,name:type+'.pdf'}));
const line=(side,changes={})=>({...documentExtractionSchema.parse({products:[{description:'Bomba fictícia',original:'Fictional pump',specifications:'Apenas teste',productCode:'P-1',manufacturer:'Fixture',model:'M-1',quantity:'2',unit:'UN',value:null,unitValue:'100.00',totalValue:'200',currency:'USD',netWeight:'4.00',grossWeight:'5',weightUnit:'KG',page:1,line:'2',...changes}],warnings:[]}).products[0],id:randomUUID(),documentId:docs.find(d=>d.type===side).id});
const draft=lines=>initialCheck(lines,docs);
function paired(lines){const d=draft(lines);d.groups=[{...d.groups[0],packingId:lines[1].id,technicalId:lines[2]?.id||null}];return d;}
const evaluate=(d,lines,confirmed=false)=>evaluateCheck(d,{version:2,lines,totals:[]},docs,confirmed);

test('decimal comparison is exact, large values and ambiguous separators never use floating point',()=>{
 assert.equal(decimal('9007199254740993.0001'),'9007199254740993.0001');
 assert.notEqual(decimal('9007199254740993.0001'),decimal('9007199254740993.0002'));
 assert.equal(decimal('0002,00'),'2');assert.equal(decimal('1.000'),null);assert.equal(decimal('1,000'),null);
 assert.equal(decimal('1.000','dot'),'1');assert.equal(decimal('1,000','comma'),'1');
 for(const v of ['1,234.50','1.234,50','1e3','NaN','-2','1 000',''])assert.equal(decimal(v),null);
});
test('equivalent values, quantity/weight conflicts, missing prices, currencies and units',()=>{
 const i=line('invoice'),p=line('packing',{quantity:'2.00',netWeight:'4',unitValue:null,totalValue:null});
 const rows=compareLines(i,p);assert.equal(rows.find(r=>r.field==='quantity').status,'coincidente');assert.equal(rows.find(r=>r.field==='unitValue').status,'não verificável');
 p.quantity='3';p.netWeight='5';assert.equal(compareLines(i,p).find(r=>r.field==='netWeight').status,'divergente');
 p.unit='BOX';p.currency='BRL';p.totalValue='200';p.weightUnit='LB';
 for(const field of ['quantity','netWeight','totalValue'])assert.equal(compareLines(i,p).find(r=>r.field===field).status,'não verificável');
 p.unit='UN';p.quantity='1.000';assert.match(compareLines(i,p).find(r=>r.field==='quantity').reason,/ambíguo/);
 assert.equal(compareLines(i,null).every(r=>r.status==='não verificável'),true);
});
test('only unique exact product codes suggest links; no description, manufacturer or model guessing',()=>{
 const i=line('invoice'),p=line('packing');assert.equal(suggestPairs([i,p],docs).length,1);
 for(const change of [{model:'OTHER'},{manufacturer:'OTHER'},{productCode:null},{productCode:'P-2'}])assert.equal(suggestPairs([i,{...p,...change}],docs).length,0);
 assert.equal(suggestPairs([i,p,line('packing')],docs).length,0);
 assert.equal(suggestPairs([i,p,line('invoice')],docs).length,0);
 assert.equal(draft([i,p]).groups.length,2,'suggestion must not merge automatically');
 const partials=[i,p,line('packing',{quantity:'1'})];assert.deepEqual(evaluate(draft(partials),partials).products.map(p=>p.quantity),['2','2','1'],'partial shipments stay separate');
});
test('manual links, corrections, explicit conflicts, exclusions, unlink and source validation',()=>{
 const originals=[line('invoice'),line('packing',{productCode:'P-2',quantity:'3'})];
 const d=paired(originals);let c=evaluate(d,originals);assert.equal(c.products.length,1);assert.equal(c.comparisons[0].divergent,2);
 assert.throws(()=>evaluate(d,originals,true),/Confira/);
 d.groups[0].acknowledged=true;assert.throws(()=>evaluate(d,originals,true),/Justifique/);
 d.groups[0].note='Código e quantidade conferidos na Invoice; Packing List precisa revisão.';
 assert.throws(()=>evaluate(d,originals,true),/Escolha/);d.groups[0].selected={productCode:'invoice',quantity:'invoice'};
 c=evaluate(d,originals,true);assert.equal(c.confirmed,true);assert.equal(c.products[0].quantity,'2');
 d.lines[0].quantity='2.00';assert.equal(originals[0].quantity,'2');assert.equal(evaluate(d,originals,true).comparisons[0].hasCorrections,true);
 d.groups=[{...d.groups[0],packingId:null,selected:{}},{...draft(originals).groups[1],acknowledged:true}];assert.equal(evaluate(d,originals,true).products.length,2);
 d.groups.pop();d.excluded=[{id:originals[1].id,reason:'Linha de outro pedido.'}];assert.equal(evaluate(d,originals,true).products.length,1);
 d.excluded[0].reason='';assert.throws(()=>evaluate(d,originals));
 const invalid=paired(originals);invalid.lines[0]={...invalid.lines[0],documentId:randomUUID()};assert.throws(()=>evaluate(invalid,originals),/Referência/);
 const duplicate=paired(originals);duplicate.groups.push(duplicate.groups[0]);assert.throws(()=>evaluate(duplicate,originals),/duplicada/);
 const wrong=paired(originals);wrong.groups[0].invoiceId=originals[1].id;assert.throws(()=>evaluate(wrong,originals),/incompatível/);
 const omitted=draft(originals);omitted.groups.pop();assert.throws(()=>evaluate(omitted,originals),/todas as linhas/);
 assert.throws(()=>evaluate(undefined,originals));
});
test('incompatible numeric values need explicit choice, technical evidence is not commercial',()=>{
 const originals=[line('invoice'),line('packing',{quantity:'3',unit:'BOX'}),line('technical',{quantity:'99'})];
 const d=paired(originals);d.groups[0].acknowledged=true;d.groups[0].note='Unidades diferentes, solicitada retificação.';d.groups[0].selected={unit:'invoice'};
 assert.throws(()=>evaluate(d,originals,true),/Escolha/);d.groups[0].selected.quantity='technical';assert.throws(()=>evaluate(d,originals,true),/Ficha técnica/);
 d.groups[0].selected.quantity='invoice';const result=evaluate(d,originals,true);assert.equal(result.comparisons[0].rows.find(r=>r.field==='quantity').status,'não verificável');
 const tech=[line('technical')],t=evaluate(draft(tech),tech);assert.equal(t.products[0].quantity,null);assert.equal(t.products[0].value,null);
});
test('document totals remain separate, missing text remains absent and legacy values are not unit prices',()=>{
 const raw=documentExtractionSchema.parse({products:[{description:null,original:null,specifications:null,quantity:null,value:'100',currency:null,page:null}],totals:[{label:'Peso bruto total',value:'1000',unit:'KG',page:2,line:null}],warnings:[]});
 assert.equal(raw.products[0].grossWeight,null);assert.equal(raw.products[0].unitValue,null);
 const originals=raw.products.map(p=>({...p,id:randomUUID(),documentId:docs[0].id})),extraction={version:2,lines:originals,totals:raw.totals.map(t=>({...t,documentId:docs[0].id}))};
 const documentCheck=evaluateCheck(draft(originals),extraction,docs);
 assert.equal(documentCheck.products[0].value,null);assert.equal(extraction.lines[0].description,null);
 const report=documentReport({extraction,documentCheck}).join('\n');assert.match(report,/Totais dos documentos/);assert.match(report,/não verificável/);assert.match(report,/1000/);
 assert.match(documentReport({products:[{value:'100'}]}).join(''),/sem comparação documental/);
});
