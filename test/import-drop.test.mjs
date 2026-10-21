import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('import accepts XML drag/drop, rejects multiple files and allows removal',()=>{
 const source=readFileSync(new URL('../import-audit.js',import.meta.url),'utf8');
 const bind=new Function(source.slice(source.indexOf('function bindImportFileDrop'),source.indexOf('const root=document'))+';return bindImportFileDrop;')();
 const handlers={},names={innerHTML:''};let busy=false;
 const input={files:[],focus(){},closest:()=>zone,setCustomValidity(v){this.error=v;},reportValidity(){},dispatchEvent(){handlers.change({target:this});}};
 const zone={classList:{add(){},remove(){}},querySelector:s=>s==='input[type=file]'?input:s==='[data-import-remove-file]'?null:names};
 bind({addEventListener:(n,h)=>handlers[n]=h},()=>busy);
 const original=globalThis.DataTransfer;globalThis.DataTransfer=class{files=[];items={add:f=>this.files.push(f)}};
 try {
 const file={name:'invoice.xml',type:'application/xml',size:100},event={target:{closest:()=>zone},preventDefault(){},dataTransfer:{files:[file]}};
 handlers.drop(event);assert.deepEqual(input.files,[file]);assert.match(names.innerHTML,/invoice.xml/);
 event.dataTransfer.files=[file,file];handlers.drop(event);assert.match(input.error,/um arquivo/);assert.equal(input.files.length,1);
 event.dataTransfer.files=[{...file,name:'bad.exe',type:'application/octet-stream'}];handlers.drop(event);assert.match(input.error,/XML/);
 event.dataTransfer.files=[{...file,size:11*1024*1024}];handlers.drop(event);assert.match(input.error,/10 MB/);
 const button={dataset:{importRemoveFile:'0'},closest:()=>zone},click={target:{closest:()=>button},preventDefault(){},stopPropagation(){}};
 busy=true;handlers.click(click);assert.equal(input.files.length,1);
 busy=false;handlers.click(click);assert.equal(input.files.length,0);assert.equal(names.innerHTML,'');
 } finally {globalThis.DataTransfer=original;}
});
