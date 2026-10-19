import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../audita-chat-motion.js',import.meta.url),'utf8').replace('export function','function');
test('shared chat follows new content and controls, skips unchanged polls and hidden modules',()=>{
 const frames=[],calls=[],listeners={};let active=true,reduced=false;
 const node=text=>({textContent:text,isConnected:true,scrollIntoView:o=>calls.push([text,o.block,o.behavior])});
 const conversation={lastElementChild:node('Pergunta'),querySelectorAll:()=>[]};
 const stage={contains:()=>true};
 const ctx={document:{createElement:()=>({setAttribute(){},classList:{remove(){}}})},window:{requestAnimationFrame:f=>frames.push(f),addEventListener:(name,fn)=>listeners[name]=fn,matchMedia:()=>({matches:reduced})},getStage:()=>stage,getConversation:()=>conversation,isActive:()=>active};
 vm.createContext(ctx);vm.runInContext(source+';globalThis.motion=createAuditaChatMotion({getStage,getConversation,isActive});',ctx);
 ctx.motion.moveAssistantAvatar(conversation);frames.shift()();assert.deepEqual(calls.pop(),['Pergunta','end','smooth']);
 ctx.motion.moveAssistantAvatar(conversation);assert.equal(frames.length,0);
 conversation.lastElementChild=node('Processando');ctx.motion.moveAssistantAvatar(conversation);conversation.lastElementChild=node('Resultado e continuar');reduced=true;frames.shift()();assert.deepEqual(calls.pop(),['Resultado e continuar','end','auto']);
 active=false;ctx.motion.moveAssistantAvatar(conversation);assert.equal(frames.length,0);
 active=true;listeners.hashchange();frames.shift()();assert.equal(calls.pop()[0],'Resultado e continuar');
});
