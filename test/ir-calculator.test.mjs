import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../ir-exemption.js',import.meta.url),'utf8');
const calc=new Function(source.slice(source.indexOf('function irMonthToIso'),source.indexOf('function entryChoices'))+';return estimateIrRefund;')();
const now=new Date(2026,9,21),v={birth:'1970-01',diagnosis:'2026-01',retirement:'2026-01',amount:'1000',projection:true,correction:true};
test('recent scenario matches observed reference with explicit projection and correction',()=>{const r=calc(v,now);assert.equal(r.months,9);assert.equal(r.principal,900000);assert.equal(r.projection,1200000);assert.equal(r.correction,210000);assert.equal(r.total,2310000);});
test('caps past period at60 months and separates ages without inventing historical IR',()=>{const r=calc({...v,birth:'1960-01',diagnosis:'2020-01',retirement:'2018-01',amountBefore65:'1000'},now);assert.equal(r.months,60);assert.equal(r.before65+r.after65,60);assert.equal(r.principal,6000000);});
test('uses later benefit or diagnosis and disables hypothetical additions',()=>{assert.equal(calc({...v,retirement:'2026-08',projection:false,correction:false},now).total,200000);assert.equal(calc({...v,diagnosis:'2026-09'},now).months,1);assert.equal(calc({...v,diagnosis:'2026-10'},now).total,0);});
test('rejects invalid chronology, months and monetary inputs',()=>{for(const patch of [{birth:'2027-01'},{diagnosis:'2026-13'},{retirement:'1960-01'},{amount:'-1'},{amount:'NaN'},{amount:'1000001'},{diagnosis:''}])assert.throws(()=>calc({...v,...patch},now));});

test('entry exposes both paths and calculator does not submit data to the API', async()=>{
 const vm=await import('node:vm');const handlers={},app={innerHTML:'',setAttribute(){},scrollIntoView(){}},result={innerHTML:''};
 const notice={hidden:true,textContent:'',scrollIntoView(){}};
 const form={elements:{namedItem:()=>({value:'',closest:()=>({hidden:true})})}};
 const month={value:'',focus(){}},year={value:''},panel={hidden:true,querySelector:s=>s==='[data-ir-year]'?year:month},date={value:'01/1960',form,focus(){}},calendar={dataset:{irCalendar:'birth'},setAttribute(){}};
 const root={querySelector:s=>s==='#ir-calendar-birth'?panel:s==='#ir-date-birth'?date:s==='[data-ir-calendar="birth"]'?calendar:s==='#irCalculatorForm'?form:s==='#app'?app:s==='#notice'?notice:s==='#irCalculatorResult'?result:{focus(){}},querySelectorAll:()=>[],addEventListener:(n,h)=>handlers[n]=h};
 const ctx=vm.createContext({document:{querySelector:()=>root,body:{dataset:{activePage:'home'}},addEventListener(){}},window:{addEventListener(){}},Intl,URL,URLSearchParams,Date,FormData:class{get(k){return {birth:'01/1970',diagnosis:'01/2026',retirement:'01/2026',amount:'1000'}[k];}has(k){return k==='privacy';}},createAuditaChatMotion:()=>({cancelTyping(){},moveAssistantAvatar(){}}),fetch(){throw new Error('Unexpected network request');}});
 vm.runInContext(source.replace(/^import .*;\r?\n/,''),ctx);
 vm.runInContext('render()',ctx);assert.match(app.innerHTML,/Quero minha isenção/);assert.match(app.innerHTML,/Calcule seu reembolso/);
 handlers.click({target:{closest:()=>({dataset:{irEntry:'calculator'}})}});assert.match(app.innerHTML,/irCalculatorForm/);
 handlers.click({target:{closest:()=>calendar}});assert.equal(panel.hidden,false);assert.equal(month.value,'01');assert.equal(year.value,'1960');
 month.value='05';year.value='1958';handlers.click({target:{closest:()=>({dataset:{irCalendarApply:'birth'}})}});assert.equal(date.value,'05/1958');assert.equal(panel.hidden,true);
 handlers.submit({target:{id:'irCalculatorForm'},preventDefault(){}});assert.match(result.innerHTML,/Total estimado/);
 handlers.click({target:{closest:()=>({dataset:{irEntry:'triage'}})}});assert.match(app.innerHTML,/Para quem você está buscando/);
});

test('uses distinct discounts on either side of the 65th birthday',()=>{
 const r=calc({...v,birth:'1960-01',diagnosis:'2020-01',retirement:'2018-01',amountBefore65:'1500'},now);
 assert.equal(r.before65,39);assert.equal(r.after65,21);
 assert.equal(r.principal,7950000);assert.equal(r.total,10065000);
});
test('requires historical discount only when the past period crosses age 65',()=>{
 const older={...v,birth:'1960-01',diagnosis:'2020-01',retirement:'2018-01'};
 for(const amountBefore65 of ['',undefined,'-1','NaN','1000001'])assert.throws(()=>calc({...older,amountBefore65},now),/antes dos 65/);
 assert.equal(calc({...older,amountBefore65:'0'},now).principal,2100000);
 assert.equal(calc({...older,diagnosis:'2026-01'},now).principal,900000);
 assert.equal(calc({...v,amountBefore65:'invalid'},now).principal,900000);
});
test('birthday month starts the current discount and cents are preserved',()=>{
 const r=calc({...v,birth:'1961-10',diagnosis:'2026-01',amountBefore65:'1500.55'},now);
 assert.equal(r.before65,9);assert.equal(r.after65,0);assert.equal(r.principal,1350495);
});
test('historical discount visibility and required state follow the dates',()=>{
 const sync=new Function(source.slice(source.indexOf('function irMonthToIso'),source.indexOf('function estimateIrRefund'))+';return syncIrBefore65;')();
 const label={},field={closest:()=>label},fields={birth:{value:'01/1960'},diagnosis:{value:'01/2020'},retirement:{value:'01/2018'},amountBefore65:field},form={elements:{namedItem:n=>fields[n]}};
 sync(form);assert.equal(label.hidden,false);assert.equal(field.required,true);assert.equal(field.disabled,false);
 fields.birth.value='01/1970';sync(form);assert.equal(label.hidden,true);assert.equal(field.required,false);assert.equal(field.disabled,true);
 fields.birth.value='01/1960';fields.diagnosis.value='01/2026';sync(form);assert.equal(label.hidden,true);
});

test('month fields accept typed and pasted month/year while preserving calculation dates',()=>{
 const {irMonthToIso,irMonthDisplay,maskIrMonth}=new Function(source.slice(source.indexOf('function irMonthToIso'),source.indexOf('function needsIrBefore65'))+';return {irMonthToIso,irMonthDisplay,maskIrMonth};')();
 assert.equal(maskIrMonth('011958'),'01/1958');assert.equal(maskIrMonth('01/1958'),'01/1958');assert.equal(maskIrMonth('01/195'),'01/195');
 assert.equal(irMonthToIso('01/1958'),'1958-01');assert.equal(irMonthDisplay('1958-01'),'01/1958');
 for(const value of ['13/1958','00/1958','1/1958','01/195'])assert.equal(irMonthToIso(value),'');
 assert.doesNotMatch(source.slice(source.indexOf('function calculatorView'),source.indexOf('function calculatorResult')),/type="month"/);
});
