import test from 'node:test';
import assert from 'node:assert/strict';
import {bindChatFileDrop} from '../general-chat.js';

function setup() {
 const handlers={},classes=new Set(),batches=[];let busy=false;
 const area={addEventListener:(name,fn)=>handlers[name]=fn,classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)}};
 bindChatFileDrop(area,{addFiles:files=>batches.push(files),isBusy:()=>busy});
 function fire(name,files=[],types=['Files']) {
   const event={dataTransfer:{files,types},preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}};
   handlers[name](event);return event;
 }
 return {fire,classes,batches,setBusy:value=>busy=value};
}
test('file drag survives child transitions, queues all dropped files once and prevents navigation',()=>{
 const s=setup(),files=[{name:'document.pdf'},{name:'photo.png'}];
 s.fire('dragenter');s.fire('dragenter');s.fire('dragleave');
 assert.ok(s.classes.has('chat-file-dragging'));
 assert.equal(s.fire('dragover').dataTransfer.dropEffect,'copy');
 const event=s.fire('drop',files);
 assert.equal(event.prevented,true);assert.equal(event.stopped,true);
 assert.deepEqual(s.batches,[files]);assert.equal(s.classes.size,0);
});
test('text drags stay untouched, busy chat rejects files, and leaving clears the hint',()=>{
 const s=setup();assert.equal(s.fire('drop',[],['text/plain']).prevented,undefined);
 s.setBusy(true);s.fire('dragenter');assert.equal(s.classes.size,0);
 assert.equal(s.fire('dragover').dataTransfer.dropEffect,'none');
 assert.equal(s.fire('drop',[{name:'file.pdf'}]).prevented,true);assert.equal(s.batches.length,0);
 s.setBusy(false);s.fire('dragenter');s.fire('dragleave');assert.equal(s.classes.size,0);
 s.fire('dragenter');s.fire('dragend');assert.equal(s.classes.size,0);
});
