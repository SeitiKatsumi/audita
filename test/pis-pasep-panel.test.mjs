import test from 'node:test';
import assert from 'node:assert/strict';
import {pisPanel,pisAnswerLabel} from '../pis-pasep-panel.js';
import {PIS_STATUSES,PIS_DOCUMENTS,PIS_SOURCE,pisQuestions} from '../services/pis-pasep-domain.mjs';
test('painel distingue contrato sem cobrança inicial, documentos e informações conferidas sem injetar HTML',()=>{
 const c={id:'00000000-0000-0000-0000-000000000000',status:'queued',permissions:{owner:true,operator:false},questions:pisQuestions(),answers:{role:'self',requester:'<img src=x onerror=alert(1)>'},summary:{message:'Informado pelo cliente',pending:[],next:'Conferir'},checklist:[],documents:[],contracts:[{id:'test',version:1,percent:20,basis:'Valor recebido',scope:'Apoio',terms:'<script>bad</script>',state:'published'}],records:[],events:[],tasks:[]};
 const config={statuses:PIS_STATUSES,documentTypes:PIS_DOCUMENTS,source:PIS_SOURCE};
 let html=pisPanel(c,config,{withAnswers:true});assert.ok(html.includes('&lt;script&gt;bad&lt;/script&gt;'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('Sem cobrança inicial'));assert.ok(html.includes('data-pis-form="accept"'));assert.ok(!html.includes('data-pis-form="review"'));
 c.permissions={owner:false,operator:true};html=pisPanel(c,config);assert.ok(html.includes('data-pis-form="review"'));assert.ok(!html.includes('data-pis-form="accept"'));assert.ok(!html.includes('Pagamento de honorários recebido'));
 assert.equal(pisAnswerLabel(pisQuestions()[0],'heir'),'Sou herdeiro(a) ou dependente');
});

test('PIS/PASEP ends with tracking only and preserves the previous case',async()=>{
 const {readFile}=await import('node:fs/promises'),{default:vm}=await import('node:vm');
 const elements=new Map(),listeners={};
 const element=selector=>{if(!elements.has(selector))elements.set(selector,{innerHTML:'',setAttribute(){},focus(){},scrollIntoView(){}});return elements.get(selector);};
 const root={querySelector:element,querySelectorAll:()=>[],addEventListener:(name,fn)=>listeners[name]=fn};
 const context=vm.createContext({
  document:{querySelector:()=>root,querySelectorAll:()=>[],body:{dataset:{activePage:'home'}},addEventListener(){}},
  window:{addEventListener(){}},location:{href:'http://localhost:3000/#pis-pasep'},history:{replaceState(){}},URL,URLSearchParams,
  createAuditaChatMotion:()=>({cancelTyping(){},moveAssistantAvatar(){},scrollLatestAssistant(){},async animateAssistant(){}}),
  e:String,pisAnswerLabel:()=> 'Para mim',pisApi:async()=>({enabled:false}),
 });
 vm.runInContext((await readFile(new URL('../pis-pasep.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,''),context);
 await vm.runInContext(`
  state.user={id:'user'};state.config={ready:true,statuses:{triage:'Triagem'}};
  const question={key:'role',title:'Para quem?',type:'choice',options:[{value:'self',label:'Para mim'}]};
  const oldCase={id:'old',answers:{},permissions:{owner:true},questions:[question],question,contracts:[],records:[],summary:{message:'Concluído',pending:[],next:'Acompanhe'}};
  state.case=oldCase;
  render();
 `,context);
 assert.ok(!element('#pisApp').innerHTML.includes('Iniciar nova análise'));
 await vm.runInContext("oldCase.answers.role='self'; oldCase.question=null; render();",context);
 assert.ok(!element('#pisApp').innerHTML.includes('Iniciar nova análise')); assert.ok(element('#pisApp').innerHTML.includes('Ver documentos e andamento'));
 assert.ok(!element('#pisApp').innerHTML.includes('data-pis-start'));
 await vm.runInContext("state.editing='role'; render();",context);
 assert.ok(!element('#pisApp').innerHTML.includes('Iniciar nova análise'));
 await vm.runInContext('state.editing=null;oldCase.permissions.owner=false; render();',context);
 assert.ok(!element('#pisApp').innerHTML.includes('Iniciar nova análise'));
 const calls=[];
 context.pisPost=async path=>{calls.push(path);return {case:{id:'new'}};};
 context.pisApi=async path=>path==='/cases'?{cases:[{id:'old',status:'triage',updated_at:new Date().toISOString()},{id:'new',status:'triage',updated_at:new Date().toISOString()}]}:{case:{id:'new',answers:{},permissions:{owner:true},questions:[],question:null,contracts:[],records:[],summary:{message:'Novo',pending:[],next:''}}};
 await vm.runInContext('start()',context);
 assert.deepEqual(calls,['/cases']);
 assert.equal(vm.runInContext('state.case.id',context),'new');
 assert.equal(vm.runInContext('oldCase.answers.role',context),'self');
 const page=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(!page.includes('Seus atendimentos de PIS/PASEP'));
 assert.ok(!page.includes('id="pisCaseList"'));
});
