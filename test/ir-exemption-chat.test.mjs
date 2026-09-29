import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('IR keeps confirmed answers in the chat when the next question changes', async () => {
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, { innerHTML: '', setAttribute() {}, addEventListener() {}, contains(){return true;}, querySelectorAll(){return [];}  });
    return elements.get(selector);
  };
  const root = { querySelector: element, querySelectorAll: () => [], addEventListener() {} };
  const context = vm.createContext({
    document: { createElement:()=>({setAttribute(){},classList:{remove(){}}}), querySelector: () => root, body: { dataset: { activePage: 'home' } }, addEventListener() {} },
    window: { addEventListener() {} },
    Intl, URL, URLSearchParams,
  });
  vm.runInContext((await readFile(new URL('../audita-chat-motion.js', import.meta.url), 'utf8')).replace('export function','function'), context);
  vm.runInContext((await readFile(new URL('../ir-exemption.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/,''), context);
  vm.runInContext(`
    state.config = { statuses: { triage: 'Triagem' },documentTypes:{medical:'Laudo médico'} };
    const role = { key:'role', type:'choice', title:'Para quem?', options:[{ value:'self', label:'Para mim' }] };
    const identity = { key:'identity', type:'identity', title:'Como você se chama?' };
    state.case = { answers:{role:'self'}, permissions:{owner:true}, steps:[role,identity], question:identity,checklist:[],documents:[] };
    render();
  `, context);
  const first = element('#app').innerHTML;
  assert.ok(first.includes('Para mim'));
  assert.ok(first.includes('Como você se chama?'));
  vm.runInContext(`
    state.case.answers.identity = {name:'<script>test</script>',cpf:'123',phone:'456',email:'qa@example.test'};
    state.case.question = {key:'medical',type:'choice',title:'Você tem laudo?',options:[{value:'yes',label:'Sim'}]};
    render();
  `, context);
  const next = element('#app').innerHTML;
  assert.ok(next.indexOf('Para mim') < next.indexOf('Como você se chama?'));
  assert.ok(next.indexOf('Como você se chama?') < next.indexOf('Você tem laudo?'));
  assert.ok(next.includes('&lt;script&gt;test&lt;/script&gt;'));
  assert.ok(next.includes('Voltar à pergunta: Contato'));
  assert.ok(!next.includes('Iniciar nova análise'));
  assert.ok(!next.includes('ir-tabs'));
  assert.ok(!next.includes('etapas concluídas'));
  for(const action of ['documents','proposals','timeline']) assert.ok(!next.includes(`data-tab="${action}"`));
  vm.runInContext('state.case.question=null; render();',context);
  const completed=element('#app').innerHTML;
  assert.ok(completed.includes('Obrigado por compartilhar'));
  assert.ok(completed.includes('id="uploadForm"'));
  assert.ok(!completed.includes('Ver meu resumo'));
  assert.ok(!completed.includes('ir-chat-tools'));
  assert.ok(!completed.includes('id="irConversationPanel"'));
  assert.ok(!completed.includes('data-tab="proposals"'));
  vm.runInContext('state.case.analysis={state:"preliminary_indications",warnings:[],pending:[],estimate:{rows:[],notice:"Estimativa preliminar"},sources:[]}; state.case.proposals=[{kind:"adm",state:"paid"}]; render();',context);
  const reviewed=element('#app').innerHTML;
  assert.ok(reviewed.includes('Há indícios para aprofundar'));
  assert.ok(reviewed.includes('Proposta ADM'));
  assert.ok(reviewed.indexOf('Obrigado por compartilhar')<reviewed.indexOf('Há indícios para aprofundar'));
  assert.ok(reviewed.indexOf('Há indícios para aprofundar')<reviewed.indexOf('id="uploadForm"'));
  assert.ok(!reviewed.includes('data-tab="analysis"'));


  vm.runInContext("state.editing='role'; render();",context);
  assert.ok(!element('#app').innerHTML.includes('Iniciar nova análise'));
  vm.runInContext('state.editing=null; state.case.permissions.owner=false; render();',context);
  assert.ok(!element('#app').innerHTML.includes('Iniciar nova análise'));
  const page=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(!page.includes('id="newCase"'));
  assert.ok(!page.includes('id="pisNewCase"'));
  assert.ok(!page.includes('id="caseList"'));
  assert.ok(!page.includes('Seus atendimentos de IR'));
  const irSource=await readFile(new URL('../ir-exemption.js',import.meta.url),'utf8');
  assert.ok(!irSource.includes("$('#caseList')"));
  assert.ok(irSource.includes("get('case')"));
  assert.ok(!page.includes('id="pisCaseList"'));

  // Check the Itaú order: user reply -> 900 ms -> typing -> 1500 ms -> question.
  let finishTimer, delay, scrollOptions;
  context.document.body.dataset.activePage='isencao-ir';
  context.window.requestAnimationFrame=callback=>callback();
  const children=[];
  const node=()=>({isConnected:true,classList:{add(){},remove(){}},setAttribute(){},scrollIntoView(options){scrollOptions=options;},remove(){const index=children.indexOf(this);if(index>=0)children.splice(index,1);}});
  const reply=node(),question=node();
  children.push(reply,question);
  const conversation={get lastElementChild(){return children.at(-1);},appendChild(child){children.push(child);},querySelectorAll(){return [];}};
  root.querySelector = selector => selector==='#app'?element('#app'):conversation;
  context.document.createElement=node;
  context.window.setTimeout=(callback,milliseconds)=>{finishTimer=callback;delay=milliseconds;return 1;};
  context.window.clearTimeout=()=>{};
  const animated=vm.runInContext('animateAssistant()',context);
  assert.deepEqual(children,[reply]);
  assert.equal(delay,900);
  assert.equal(scrollOptions.block,'end');
  finishTimer();
  assert.equal(delay,1500);
  assert.ok(children.at(-1).innerHTML.includes('IA AUDITA está digitando…'));
  finishTimer();
  await animated;
  assert.deepEqual(children,[reply,question]);
  const cancelled=vm.runInContext('animateAssistant()',context);
  vm.runInContext('cancelTyping()',context);
  await cancelled;
  assert.deepEqual(children,[reply,question]);
  context.window.matchMedia=()=>({matches:true});
  const reduced=vm.runInContext('animateAssistant()',context);
  assert.equal(scrollOptions.behavior,'auto');
  finishTimer();
  assert.equal(delay,1500);
  finishTimer();
  await reduced;
  assert.deepEqual(children,[reply,question]);
});

test('Itaú follows new messages on desktop and mobile only while active', async () => {
  const source=await readFile(new URL('../charge-analysis.js',import.meta.url),'utf8');
  const start=source.indexOf('  function scrollLatestMessage(container) {');
  const end=source.indexOf('  async function revealTriageMessages',start);
  let options;
  const context=vm.createContext({window:{requestAnimationFrame:fn=>fn()},document:{body:{dataset:{activePage:'analise-cobrancas'}}},prefersReducedMotion:false,container:{lastElementChild:{scrollIntoView:value=>{options=value;}}}});
  vm.runInContext(source.slice(start,end)+'\nscrollLatestMessage(container);',context);
  assert.equal(options.block,'end');
  assert.equal(options.behavior,'smooth');
  context.prefersReducedMotion=true;
  vm.runInContext('scrollLatestMessage(container)',context);
  assert.equal(options.behavior,'auto');
  options=null;
  context.document.body.dataset.activePage='home';
  vm.runInContext('scrollLatestMessage(container)',context);
  assert.equal(options,null);
});

test('IR automatically prepares a missing summary, preserves saved reviews and allows retry without losing answers', async () => {
  const nodes=new Map(),node=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',setAttribute(){},scrollIntoView(){}});return nodes.get(s);};
  const root={querySelector:node,querySelectorAll:()=>[],addEventListener(){}};
  const calls=[];
  const context=vm.createContext({document:{querySelector:()=>root,body:{dataset:{activePage:'home'}},addEventListener(){}},window:{addEventListener(){}},Intl,URL,URLSearchParams,
    createAuditaChatMotion:()=>({cancelTyping(){},moveAssistantAvatar(){},scrollLatestAssistant(){},animateAssistant(){}}),
    fetch:async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true,json:async()=>({case:{...context.fixture,analysis:context.analysis}})}}
  });
  vm.runInContext((await readFile(new URL('../ir-exemption.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/,''),context);
  context.analysis={state:'preliminary_indications',warnings:[],pending:[],estimate:{rows:[]},sources:[]};
  context.fixture={id:'fixture',revision:5,answers:{},steps:[],question:null,permissions:{owner:true},documents:[],checklist:[]};
  await vm.runInContext('state.config={documentTypes:{}};state.case=fixture;completeSummary()',context);
  assert.deepEqual(calls,[{action:'analyze',revision:5}]);
  assert.match(node('#app').innerHTML,/Há indícios para aprofundar/);
  await vm.runInContext('completeSummary()',context);
  assert.equal(calls.length,1,'a saved summary/review must not be regenerated on resume');
  context.fetch=async()=>{throw Error('offline');};
  await vm.runInContext('state.case=fixture;completeSummary()',context);
  assert.equal(vm.runInContext('state.case===fixture',context),true);
  assert.match(node('#app').innerHTML,/Tentar preparar o resumo novamente/);
  assert.match(node('#notice').textContent,/respostas estão salvas/);
  await vm.runInContext('state.case={...fixture,permissions:{owner:false}};completeSummary()',context);
  assert.equal(calls.length,1,'operator view does not automatically replace the client summary');
  const css=await readFile(new URL('../ir-exemption.css',import.meta.url),'utf8');
  assert.match(css,/#isencao-ir #app \{[^}]*overflow-y: auto/);
  assert.match(css,/height: calc\(100dvh - var\(--mobile-nav-height\)\)/);
});
