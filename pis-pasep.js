import {createAuditaChatMotion} from './audita-chat-motion.js';
import {pisEscape as e,pisApi,pisPost,pisCommand,pisDocuments,pisPanel,pisAnswerLabel,submitPisPanel} from './pis-pasep-panel.js';
const root=document.querySelector('#pis-pasep'),$=selector=>root.querySelector(selector);
let sessionEpoch=0,operationEpoch=0;
const state={config:null,user:null,case:null,editing:null,panel:null,busy:false};
const motion=createAuditaChatMotion({getStage:()=>$('#pisApp'),getConversation:()=>$('.charge-analysis-conversation'),isActive:()=>document.body.dataset.activePage==='pis-pasep'});
const bubble=content=>`<div class="charge-analysis-message assistant charge-analysis-intro-message"><span class="charge-analysis-avatar-anchor" aria-hidden="true"></span><div class="charge-analysis-bubble">${content}</div></div>`;
const choices=q=>`<div class="charge-analysis-actions">${q.options.map(o=>`<button type="button" data-pis-answer="${e(o.value)}" data-key="${q.key}"><strong>${e(o.label)}</strong></button>`).join('')}</div>`;
function notice(message=''){const n=$('#pisNotice');n.hidden=!message;n.textContent=message;if(message)n.scrollIntoView({block:'nearest',behavior:'smooth'});}
async function run(fn){if(state.busy)return;operationEpoch=sessionEpoch;state.busy=true;notice();root.setAttribute('aria-busy','true');root.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(err){if(err.code==='case_conflict'&&state.case){try{state.case=(await pisApi(`/cases/${state.case.id}`)).case;await render();}catch{}}notice(err.message);}finally{state.busy=false;root.setAttribute('aria-busy','false');root.querySelectorAll('button').forEach(b=>b.disabled=false);}}
function fields(q){const current=state.case.answers[q.key];if(q.type==='choice')return choices(q);return `<form class="ir-form" data-pis-answer-form>${q.type==='consent'?`<label class="ir-check"><input name="value" type="checkbox" required><span>Autorizo e confirmo.</span></label>`:`<label>${e(q.title)}<input name="value" type="text" ${q.type==='pis'?'inputmode="numeric" maxlength="16"':'maxlength="180" minlength="2"'} value="${e(current??(q.key==='requester'?state.user?.name:'')??'')}" required></label>`}<button class="ir-primary" type="submit">Enviar resposta →</button></form>`;}
function landing(){return bubble(`<p><strong>Saiba como consultar possíveis cotas antigas do PIS/PASEP</strong></p><p>Você ou um familiar trabalhou com carteira assinada ou no serviço público entre 1971 e 1988? Vou orientar a consulta de possíveis cotas antigas do PIS/PASEP. Este atendimento não trata do abono salarial anual.</p><p>Vamos conversar, uma pergunta por vez, para entender quem é o titular e se você consulta para si ou para outra pessoa. As respostas ajudam a indicar as orientações e os documentos necessários. A consulta é gratuita e feita por você no canal oficial, sem compartilhar sua senha aqui. A orientação não significa que exista saldo disponível.</p><p><strong>Podemos começar?</strong></p><div class="charge-analysis-actions"><button type="button" data-pis-start><strong>Consultar cotas do PIS/PASEP</strong></button></div>${!state.user?'<p class="ir-micro">Entre na sua conta para salvar e retomar o atendimento.</p>':''}`);}
async function render(animate=false){
  motion.cancelTyping();const c=state.case;
  let html;if(!c)html=landing();else{
    const q=state.editing?c.questions.find(q=>q.key===state.editing):c.question,editable=!c.contracts.some(x=>x.acceptedAt)&&!c.records.length;
    html=c.questions.filter(q=>c.answers[q.key]!==undefined).map(q=>bubble(`<p>${e(q.title)}</p>`)+`<div class="charge-analysis-message user"><div class="charge-analysis-bubble"><p class="ir-readable">${e(pisAnswerLabel(q,c.answers[q.key]))}</p>${editable?`<button type="button" class="ir-text-button" data-pis-back="${q.key}" aria-label="Voltar à pergunta: ${e(q.title)}">Voltar</button>`:''}</div></div>`).join('');
    html+=bubble(q?`<p id="pisQuestion" tabindex="-1"><strong>${state.editing?'Vamos voltar a esta pergunta. ':''}${e(q.title)}</strong></p>${q.help?`<p>${e(q.help)}</p>`:''}${q.key==='consultation'?`<p><a class="ir-primary" href="${e(state.config.source.url)}" target="_blank" rel="noopener noreferrer">Abrir REPIS Cidadão ↗</a></p><p class="ir-micro">O portal abre em outra aba. Esta conversa continuará salva aqui.</p>`:''}${q.key==='documents'?'<button type="button" class="ir-secondary" data-pis-panel="documents">Enviar documentos disponíveis</button>':''}${fields(q)}${state.editing?'<button type="button" class="ir-text-button" data-pis-resume>Retomar conversa</button>':''}`:`<p id="pisQuestion" tabindex="-1"><strong>${c.answers.referral==='yes'?'Seu atendimento foi encaminhado à equipe.':'Sua consulta ficou registrada.'}</strong></p><p>${e(c.summary.message)}</p>${c.summary.pending.length?`<ul>${c.summary.pending.map(p=>`<li>${e(p)}</li>`).join('')}</ul>`:''}<p>${e(c.summary.next)}</p><div class="charge-analysis-actions"><button type="button" data-pis-panel="case"><strong>Ver documentos e andamento</strong></button></div>`);
  }
  $('#pisApp').innerHTML=`<div class="charge-analysis-conversation ir-chat-log" aria-label="Conversa sobre cotas antigas PIS/PASEP">${html}</div>${state.panel&&c?`<section id="pisDetails" tabindex="-1"><button type="button" class="ir-text-button" data-pis-resume>Voltar à conversa</button>${state.panel==='documents'?pisDocuments(c,state.config):pisPanel(c,state.config)}</section>`:''}`;
  $('#pisApp').setAttribute('aria-busy','false');
  if(animate&&!state.panel)await motion.animateAssistant();else motion.moveAssistantAvatar($('.charge-analysis-conversation'));
  root.querySelectorAll('button').forEach(b=>b.disabled=state.busy);
}
async function load(id,animate=false){const epoch=sessionEpoch,result=await pisApi(`/cases/${id}`);if(epoch!==sessionEpoch)return;state.case=result.case;state.editing=null;state.panel=null;const url=new URL(location.href);url.searchParams.set('pisCase',id);history.replaceState(null,'',url);await render(animate);motion.scrollLatestAssistant();}
async function update(result,animate=false){if(operationEpoch!==sessionEpoch)return;state.case=result.case;state.editing=null;await render(animate);if(!state.panel){$('#pisQuestion')?.focus({preventScroll:true});motion.scrollLatestAssistant();}}
async function start(){if(!state.user){document.querySelector('#loginButton')?.click();return;}if(!state.config.ready)throw new Error('Atendimento indisponível. Tente novamente mais tarde.');await load((await pisPost('/cases')).case.id,true);}
root.addEventListener('click',event=>{const b=event.target.closest('button');if(!b||state.busy)return;
  if(b.hasAttribute('data-pis-start'))void run(start);
  else if(b.dataset.pisAnswer)void run(()=>answer(b.dataset.key,b.dataset.pisAnswer));
  else if(b.dataset.pisBack){state.editing=b.dataset.pisBack;state.panel=null;void render();motion.scrollLatestAssistant();$('#pisQuestion')?.focus({preventScroll:true});}
  else if(b.dataset.pisPanel){state.panel=b.dataset.pisPanel;void render();$('#pisDetails')?.focus({preventScroll:true});$('#pisDetails')?.scrollIntoView({block:'start',behavior:'smooth'});}
  else if(b.hasAttribute('data-pis-resume')){state.panel=null;state.editing=null;void render();motion.scrollLatestAssistant();}
  else if(b.hasAttribute('data-pis-help'))notice('Vamos orientar a consulta das cotas antigas, guardar suas respostas e receber documentos. Use Voltar para corrigir uma resposta. A equipe pode revisar o resultado e oferecer apoio, se você solicitar.');
  else if(b.hasAttribute('data-pis-retry')){initializing=null;activate();}
});
async function pisCommandResult(key,value){return pisCommand(state.case,'answer',{key,value});}
// Await the server before displaying the next question; never guess a transition in the browser.
async function answer(key,value){await update(await pisCommandResult(key,value),true);}
root.addEventListener('submit',event=>{const f=event.target;if(!f.matches('[data-pis-answer-form],[data-pis-form]'))return;event.preventDefault();void run(async()=>{
  if(f.hasAttribute('data-pis-answer-form')){const q=state.editing?state.case.questions.find(q=>q.key===state.editing):state.case.question;await answer(q.key,q.type==='consent'?new FormData(f).has('value'):String(new FormData(f).get('value')||''));}
  else {await update(await submitPisPanel(f,state.case));$('#pisDetails')?.focus({preventScroll:true});}
});});
let initializing;
async function init(){const epoch=sessionEpoch;const authResponse=await fetch('/api/auth/me',{credentials:'same-origin'});if(!authResponse.ok)throw new Error('Não foi possível consultar a sessão. Tente novamente.');const user=(await authResponse.json()).user,config=await pisApi('/config');if(epoch!==sessionEpoch)return;state.user=user;state.config=config;
  if(!state.config.enabled){$('#pisApp').textContent='O atendimento PIS/PASEP ainda não foi habilitado.';$('#pisApp').setAttribute('aria-busy','false');return;}
  if(state.user&&state.config.ready){const id=new URLSearchParams(location.search).get('pisCase');if(id){await load(id);return;}}
  await render();
}
function activate(){if(document.body.dataset.activePage!=='pis-pasep')return;initializing??=init().catch(err=>{notice(err.message);$('#pisApp').innerHTML='<button type="button" class="ir-secondary" data-pis-retry>Tentar novamente</button>';$('#pisApp').setAttribute('aria-busy','false');});}
document.addEventListener('audita:pagechange',()=>{if(document.body.dataset.activePage!=='pis-pasep')motion.cancelTyping();activate();});
window.addEventListener('audita:auth-changed',()=>{sessionEpoch++;motion.cancelTyping();state.user=null;state.case=null;state.panel=null;state.editing=null;$('#pisApp').textContent='Preparando seu atendimento…';initializing=null;activate();});
window.addEventListener('resize',()=>{if(document.body.dataset.activePage==='pis-pasep')motion.moveAssistantAvatar($('.charge-analysis-conversation'),{immediate:true});});
void pisApi('/config').then(config=>document.querySelectorAll('[data-pis-entry]').forEach(el=>el.hidden=!config.enabled)).catch(()=>{});
activate();
