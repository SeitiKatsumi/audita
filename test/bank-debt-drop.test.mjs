import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('debt drop selects multiple files and blocks invalid, oversized and busy drops',()=>{
 const source=readFileSync(new URL('../bank-debt.js',import.meta.url),'utf8');
 const bind=new Function(source.slice(0,source.indexOf("const root=document"))+';return bindDebtFileDrop;')();
 const handlers={},names={innerHTML:''};let busy=false;
 const input={focus(){},files:[],setCustomValidity(v){this.error=v;},reportValidity(){},dispatchEvent(){handlers.change({target:{closest:()=>zone,files:this.files,setCustomValidity:v=>this.setCustomValidity(v)}});}};
 const zone={classList:{add(){},remove(){}},querySelector:s=>s==='input[type=file]'?input:s==='[data-debt-remove-file]'?null:names,contains:()=>false};
 bind({addEventListener:(n,h)=>handlers[n]=h},()=>busy);
 const original=globalThis.DataTransfer;globalThis.DataTransfer=class{files=[];items={add:f=>this.files.push(f)}};
 try{
 const files=[{name:'one.pdf',type:'application/pdf',size:20},{name:'two.png',type:'image/png',size:30}];
 const e={target:{closest:()=>zone},preventDefault(){},dataTransfer:{files}};
 handlers.drop(e);assert.deepEqual(input.files,files);assert.match(names.innerHTML,/one.pdf/);assert.match(names.innerHTML,/data-debt-remove-file="1"/);
 e.dataTransfer.files=[{name:'bad.exe',type:'application/octet-stream',size:1}];handlers.drop(e);assert.match(input.error,/PDF/);assert.deepEqual(input.files,files);
 e.dataTransfer.files=[{...files[0],size:11*1024*1024}];handlers.drop(e);assert.match(input.error,/10 MB/);
 busy=true;e.dataTransfer.files=[];handlers.drop(e);assert.deepEqual(input.files,files);
 busy=false;const remove={dataset:{debtRemoveFile:'0'},closest:()=>zone};
 const click={target:{closest:()=>remove},preventDefault(){},stopPropagation(){}};
 handlers.click(click);assert.deepEqual(input.files,[files[1]]);assert.doesNotMatch(names.innerHTML,/one.pdf/);
 busy=true;handlers.click(click);assert.equal(input.files.length,1);
 busy=false;handlers.click(click);assert.equal(input.files.length,0);assert.equal(names.innerHTML,'');
 }finally{globalThis.DataTransfer=original;}
});
