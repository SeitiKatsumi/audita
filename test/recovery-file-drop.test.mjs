import test from 'node:test';
import assert from 'node:assert/strict';
import { bindRecoveryFileDrop } from '../charge-analysis.js';
test('recovery drop selects files, rejects oversized/multiple files and clears validity', () => {
 const handlers = {};
 const input = { multiple:false, files:[], setCustomValidity(v){this.error=v;},reportValidity(){},dispatchEvent(){this.changed=true;} };
 const zone = {classList:{add(){},remove(){}},querySelector(){return input;},contains(){return false;}};
 bindRecoveryFileDrop({addEventListener(name,handler){handlers[name]=handler;}});
 const original = globalThis.DataTransfer;
 globalThis.DataTransfer = class { files=[]; items={add:f=>this.files.push(f)}; };
 try {
  const file={name:'identity.heic',size:20};
  const event={target:{closest:()=>zone},preventDefault(){this.prevented=true;},dataTransfer:{files:[file]}};
  handlers.drop(event); assert.deepEqual(input.files,[file]); assert.equal(input.changed,true); assert.equal(event.prevented,true);
  event.dataTransfer.files=[file,file]; handlers.drop(event); assert.match(input.error,/apenas um/); assert.deepEqual(input.files,[file]);
  event.dataTransfer.files=[{size:13*1024*1024}]; handlers.drop(event); assert.match(input.error,/12 MB/);
  input.multiple=true; event.dataTransfer.files=[file,file]; handlers.drop(event); assert.equal(input.files.length,2); assert.equal(input.error,'');
 } finally { globalThis.DataTransfer=original; }
});
