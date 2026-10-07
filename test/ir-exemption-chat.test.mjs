import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('IR uploads every selected medical file before confirming documents', async () => {
  let submit;
  const calls=[];
  const node={setAttribute(){},focus(){}};
  const root={querySelector:()=>node,querySelectorAll:()=>[],addEventListener:(name,fn)=>{if(name==='submit')submit=fn;}};
  const context=vm.createContext({
    document:{querySelector:()=>root,body:{dataset:{activePage:'home'}},addEventListener(){}},
    window:{addEventListener(){}},Intl,URL,URLSearchParams,
    FormData:class{get(){return 'medical';}getAll(){return [{name:'laudo.pdf',size:12},{name:'biopsia.png',size:24}];}},
    createAuditaChatMotion:()=>({}),
    record:(value)=>calls.push(value),
  });
  vm.runInContext((await readFile(new URL('../ir-exemption.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/,''),context);
  vm.runInContext(`
    state.case={id:'fixture',question:{type:'documents'}};
    guarded=async fn=>fn();
    api=async (url,options)=>{record(options.body.name);return {};};
    updateCase=async ()=>{};
    command=async (action,input)=>record(input.value);
  `,context);
  submit({target:{id:'uploadForm'},preventDefault(){}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls,['laudo.pdf','biopsia.png','ready']);
  calls.length=0;
  vm.runInContext("api=async (url,options)=>{record(options.body.name);if(options.body.name==='biopsia.png')throw new Error('upload failed');return {};}; guarded=async fn=>{try{await fn();}catch{record('failed');}};",context);
  submit({target:{id:'uploadForm'},preventDefault(){}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls,['laudo.pdf','biopsia.png','failed']);
});

test('IR integrates explicit consent with the benefit question, without a separate consent screen', async () => {
  let submit;
  const node={hidden:true,textContent:'',scrollIntoView(){},setAttribute(){},focus(){}};
  const root={querySelector:()=>node,querySelectorAll:()=>[],addEventListener:(name,fn)=>{if(name==='submit')submit=fn;}};
  const calls=[];
  const context=vm.createContext({
    document:{querySelector:()=>root,body:{dataset:{activePage:'home'}},addEventListener(){}},
    window:{addEventListener(){}},Intl,URL,URLSearchParams,
    FormData:class {constructor(form){this.form=form;}has(){return this.form.authorized;}get(){return '';}},
    createAuditaChatMotion:()=>({cancelTyping(){},moveAssistantAvatar(){},scrollLatestAssistant(){},animateAssistant(){}}),
    save:async(...args)=>{calls.push(args);},
  });
  vm.runInContext((await readFile(new URL('../ir-exemption.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/,''),context);
  const html=vm.runInContext(`
    command=save;
    state.case={intakeVersion:2,answers:{role:'self'},permissions:{owner:true},steps:[
      {key:'role',type:'choice',title:'Para quem?',options:[{value:'self',label:'Para mim'}]},
      {key:'consent',type:'consent',title:'Podemos analisar suas informações?'},
      {key:'benefits',type:'simple-benefits',title:'Você é aposentado, pensionista ou reformado?'}
    ],question:{key:'consent',type:'consent'}};
    chatView();
  `,context);
  assert.doesNotMatch(html,/Podemos analisar suas informações/);
  assert.match(html,/Você é aposentado/);
  assert.match(html,/name="authorize"[^>]*required/);
  assert.doesNotMatch(html,/name="authorize"[^>]*checked/);
  const event=authorized=>({target:{id:'benefitConsentForm',authorized},submitter:{value:'retirement'},preventDefault(){}});
  submit(event(false));await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,0);
  submit(event(true));await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls.length,2);assert.equal(calls[0][1].key,'consent');assert.equal(calls[1][1].key,'benefits');
});

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
  vm.runInContext("state.case.intakeVersion=2; state.case.answers.medical='available'; state.case.steps.push({key:'documents',type:'documents',title:'Envie seu laudo'}); state.case.question=null; render();",context);
  const upload=element('#app').innerHTML;
  assert.ok(upload.includes('id="uploadForm"'));
  assert.ok(upload.includes('Envie os documentos'));
  assert.ok(upload.includes('multiple required'));
  assert.ok(!upload.includes('Tipo de documento'));
  vm.runInContext("state.case.answers.medical='available'; state.case.question=identity; render();",context);
  assert.ok(element('#app').innerHTML.includes('id="uploadForm"'));
  vm.runInContext("state.case.question=null;",context);
  assert.ok(!upload.includes('Checklist'));
  assert.ok(!upload.includes('Como deseja continuar'));
  assert.equal((upload.match(/id="uploadForm"/g)||[]).length,1);
  assert.ok(!upload.includes('Sua triagem foi'));
  assert.ok(!upload.includes('Finalizando sua triagem'));
  vm.runInContext("state.case.answers.documents='later'; render();",context);
  const completed=element('#app').innerHTML;
  assert.ok(completed.includes('Finalizando sua triagem'));
  assert.ok(!completed.includes('id="uploadForm"'));
  assert.ok(!completed.includes('Ver meu resumo'));
  assert.ok(!completed.includes('ir-chat-tools'));
  assert.ok(!completed.includes('id="irConversationPanel"'));
  assert.ok(!completed.includes('data-tab="proposals"'));
  vm.runInContext('state.case.analysis={state:"preliminary_indications",warnings:[],pending:[],estimate:{rows:[],notice:"Estimativa preliminar"},sources:[]}; state.case.proposals=[{kind:"adm",state:"paid"}]; render();',context);
  const reviewed=element('#app').innerHTML;
  assert.ok(reviewed.includes('Sua triagem foi concluída'));
  assert.ok(reviewed.includes('Pronto, &lt;script&gt;test&lt;/script&gt;!'));
  assert.ok(reviewed.includes('<details class="ir-completion-upload">'));
  assert.ok(reviewed.includes('Enviar meu laudo'));
  assert.ok(!reviewed.includes('Há indícios para aprofundar'));
  assert.ok(!reviewed.includes('Valores informados'));
  assert.ok(reviewed.includes('Proposta ADM'));
  assert.ok(reviewed.indexOf('Sua triagem foi concluída')<reviewed.indexOf('id="uploadForm"'));
  assert.ok(!reviewed.includes('data-tab="analysis"'));


  vm.runInContext("state.editing='role'; render();",context);
  assert.ok(!element('#app').innerHTML.includes('Iniciar nova análise'));
  assert.ok(!element('#app').innerHTML.includes('qa@example.test'));
  assert.ok(!element('#app').innerHTML.includes('data-edit="role"'));
  assert.ok(!element('#app').innerHTML.includes('Proposta ADM'));
  assert.ok(element('#app').innerHTML.includes('Retomar conversa'));
  assert.equal(vm.runInContext('state.case.answers.identity.email',context),'qa@example.test');
  vm.runInContext("state.editing='identity'; render();",context);
  assert.ok(element('#app').innerHTML.includes('data-edit="role"'));
  assert.ok(!element('#app').innerHTML.includes('data-edit="identity"'));
  assert.ok(element('#app').innerHTML.includes('id="answerForm"'));
  vm.runInContext('state.editing=null; state.case.permissions.owner=false; render();',context);
  assert.ok(element('#app').innerHTML.includes('qa@example.test'));
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
  assert.match(node('#app').innerHTML,/Sua triagem foi concluída/);
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
