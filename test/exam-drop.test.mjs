import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('../general-chat.js',import.meta.url),'utf8');
function fixture(){
 const state={busy:false,files:[],consent:{checked:true},status:{textContent:''},renderFiles(){}};
 runInNewContext(source.slice(source.indexOf(' const addExamFiles='),source.indexOf(" filesInput.addEventListener('change'"))+';this.add=addExamFiles;',state);
 return state;
}
test('exam drop shares picker validation and queues multiple files without uploading',()=>{
 const s=fixture(), files=[{name:'exame.pdf',size:100},{name:'laudo.jpg',size:200}];
 s.add(files);assert.equal(s.files.length,2);assert.equal(s.files[0],files[0]);assert.equal(s.consent.checked,false);
 assert.ok(source.includes('bindChatFileDrop(root,{addFiles:addExamFiles,isBusy:()=>busy})'));
 assert.ok(source.includes('addExamFiles([...filesInput.files])'));
});
test('exam drop rejects invalid or oversized files and ignores busy/empty drops',()=>{
 const s=fixture();s.add([{name:'bad.exe',size:1}]);assert.equal(s.files.length,0);assert.match(s.status.textContent,/PDF/);
 s.add([{name:'large.pdf',size:51*1024*1024}]);assert.equal(s.files.length,0);
 s.busy=true;s.add([{name:'valid.pdf',size:1}]);assert.equal(s.files.length,0);
 s.busy=false;s.add([]);assert.equal(s.consent.checked,true);
});
