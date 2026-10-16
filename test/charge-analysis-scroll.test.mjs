import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../charge-analysis.js',import.meta.url),'utf8');
const start=source.indexOf('  function scrollLatestMessage(container) {');
const end=source.indexOf('\n  }',start)+4;
const fn=source.slice(start,end);
test('analysis scroll targets processing even for a queued chat scroll; reduced motion and navigation respected',()=>{
 const calls=[],frames=[],state={screen:'upload'},body={dataset:{activePage:'analise-cobrancas'}};
 const panel={isConnected:true,scrollIntoView:o=>calls.push(['panel',o.block,o.behavior])};
 const message={isConnected:true,scrollIntoView:o=>calls.push(['message',o.block,o.behavior])};
 const context={state,document:{body},stage:{querySelector:()=>panel,querySelectorAll:()=>[]},window:{requestAnimationFrame:fn=>frames.push(fn)},prefersReducedMotion:false};
 vm.createContext(context);vm.runInContext(fn,context);
 context.scrollLatestMessage({lastElementChild:message});state.screen='analyzing';frames.shift()();
 assert.deepEqual(calls.pop(),['panel','center','smooth']);
 context.prefersReducedMotion=true;context.scrollLatestMessage(null);frames.shift()();assert.deepEqual(calls.pop(),['panel','center','auto']);
 state.screen='result';context.scrollLatestMessage({lastElementChild:message});frames.shift()();assert.deepEqual(calls.pop(),['message','end','auto']);
 body.dataset.activePage='home';context.scrollLatestMessage(null);frames.shift()();assert.equal(calls.length,0);
});

test('Itaú scrolls to upload controls after the conversation',()=>{
 const calls=[];const upload={isConnected:true,matches:()=>false,scrollIntoView:o=>calls.push(o.block)};
 const context={state:{screen:'upload'},document:{body:{dataset:{activePage:'analise-cobrancas'}}},stage:{querySelectorAll:()=>[upload]},window:{requestAnimationFrame:f=>f()},prefersReducedMotion:false};
 vm.createContext(context);vm.runInContext(fn,context);context.scrollLatestMessage(null);assert.deepEqual(calls,['end']);
});
