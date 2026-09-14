import {pisApi,pisPost,pisPanel,submitPisPanel} from './pis-pasep-panel.js';
const root=document.querySelector('#advogados');
const $=s=>root.querySelector(s);
const refreshClasses=()=>root.querySelectorAll('button:not([class]),a.download').forEach(el=>el.classList.add('secondary-action'));
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v?new Date(v).toLocaleDateString('pt-BR'):'—';
let user=null,cases=[],filter='active',pisConfig={},irConfig={},energyConfig={},pisCase=null,saving=false;
async function api(path,body){const r=await fetch(path,body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Object.assign(new Error(data.message||data.error||'Não foi possível concluir a operação.'),{status:r.status});return data;}
const labels={itau:'Itaú / JEC',pis:'PIS/PASEP',ir:'Isenção de IR',energy:'Contas de luz'};
const pending=new Set(['documents_pending','documents','assistance','requirement','exigency','exigencia']);
const closed=new Set(['closed','filed']);
function normalized(c,module){
 const status=c.status,assigned=c.assigned_user_id??c.assignedUserId;
 const available=module==='energy'?!assigned:module==='itau'?status==='queued':module==='pis'?status==='queued'&&!assigned:!assigned&&!['triage','closed'].includes(status);
 return {...c,module,key:module+':'+c.id,title:c.client_name||c.title||'Atendimento '+String(c.id).slice(0,8),updated:c.updatedAt||c.updated_at||c.filed_at||c.claimed_at||c.created_at,
  group:closed.has(status)?'closed':available?'available':'active',pending:pending.has(status),
  statusLabel:module==='itau'?({queued:'Aguardando advogado',claimed:'Em atendimento',filed:'Protocolo registrado'})[status]:(module==='energy'?energyConfig.statuses:module==='pis'?pisConfig.statuses:irConfig.statuses)?.[status]||status,
  next:available?'Definir responsável':pending.has(status)?'Conferir pendências':closed.has(status)?'Consultar registro':'Revisar atendimento'};
}
function render(){
 const query=$('#lawyer-search').value.trim().toLocaleLowerCase('pt-BR'),service=$('#lawyer-service').value;
 const scoped=cases.filter(c=>service==='all'||c.module===service);
 $('#lawyer-countActive').textContent=scoped.filter(c=>c.group==='active').length;$('#lawyer-countPending').textContent=scoped.filter(c=>c.pending).length;$('#lawyer-countAvailable').textContent=scoped.filter(c=>c.group==='available').length;
 root.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
 const visible=scoped.filter(c=>c.group===filter&&`${c.title} ${c.id} ${labels[c.module]}`.toLocaleLowerCase('pt-BR').includes(query));
 $('#lawyer-caseRows').innerHTML=visible.map(c=>`<tr><td><strong>${escape(c.title)}</strong><small>${escape(String(c.id).slice(0,8))} · ${date(c.updated)}</small></td><td data-label="Serviço">${labels[c.module]}</td><td data-label="Situação"><span class="badge ${c.pending?'pending':c.group==='closed'?'closed':''}">${escape(c.statusLabel)}</span></td><td data-label="Próximo passo">${escape(c.next)}</td><td>${c.module==='energy'&&c.assigned_user_id?`<a class="download" href="/?energyCase=${encodeURIComponent(c.id)}#contas-de-luz">Abrir</a>`:c.module==='ir'?`<a class="download" href="/?case=${encodeURIComponent(c.id)}#isencao-ir">Abrir</a>`:`<button data-open="${escape(c.key)}">${c.module==='energy'?'Assumir atendimento':'Abrir'}</button>`}</td></tr>`).join('');
 $('#lawyer-empty').hidden=visible.length>0;refreshClasses();
 $('#lawyer-attention').innerHTML=scoped.filter(c=>c.pending).slice(0,3).map(c=>`<article><strong>${escape(c.title)}</strong><p>${escape(c.statusLabel)}</p><small>${labels[c.module]}</small></article>`).join('')||'<p>Nenhuma pendência sinalizada nos atendimentos disponíveis.</p>';
 $('#lawyer-recent').innerHTML=[...scoped].sort((a,b)=>new Date(b.updated)-new Date(a.updated)).slice(0,4).map(c=>`<article><strong>${escape(c.title)}</strong><p>${escape(c.statusLabel)}</p><small>Atualizado em ${date(c.updated)}</small></article>`).join('')||'<p>Nenhuma atualização disponível.</p>';
}
async function load(){
 const me=await api('/api/auth/me');user=me.user;
 const allowed=['lawyer','super_admin'].includes(user?.role);
 $('#lawyer-dashboard').hidden=!allowed;$('#lawyer-login').hidden=allowed;
 if(!allowed){cases=[];$('#lawyer-caseRows').innerHTML='';$('#lawyer-detailBody').innerHTML='';$('#lawyer-details').hidden=true;if(user)$('#lawyer-message').textContent='Esta conta não tem acesso à Área dos Advogados.';return;}
 $('#lawyer-countActive').textContent='—';$('#lawyer-countPending').textContent='—';$('#lawyer-countAvailable').textContent='—';$('#lawyer-dashboard').setAttribute('aria-busy','true');
 $('#lawyer-activeLabel').textContent=user.role==='super_admin'?'Em atendimento':'Meus atendimentos';
 const errors=[];cases=[];
 const results=await Promise.allSettled([
  api('/api/advogados/jobs').then(d=>d.jobs.map(c=>normalized(c,'itau'))),
  pisApi('/config').then(async config=>{pisConfig=config;if(!config.enabled)return [];if(!config.ready)throw Error('PIS/PASEP indisponível no momento.');return (await pisApi('/queue')).cases.map(c=>normalized(c,'pis'));}),
  api('/api/energy-audit/config').then(async config=>{energyConfig=config;if(!config.enabled)return [];if(!config.storageReady)throw Error('Contas de luz indisponível no momento.');return (await api('/api/energy-audit/queue')).cases.map(c=>normalized(c,'energy'));}),
  api('/api/ir-exemption/config').then(async config=>{irConfig=config;if(!config.enabled||!config.operator)return [];if(!config.ready)throw Error('IR indisponível no momento.');return (await api('/api/ir-exemption/cases')).cases.filter(c=>user.role==='super_admin'||String(c.assignedUserId)===String(user.id)).map(c=>normalized(c,'ir'));})
 ]);
 results.forEach((r,i)=>{if(r.status==='fulfilled')cases.push(...r.value);else errors.push(`${['Itaú','PIS/PASEP','Contas de luz','IR'][i]}: ${r.reason.message}`);});
 $('#lawyer-message').textContent=errors.join('\n');render();$('#lawyer-dashboard').setAttribute('aria-busy','false');
}
function detail(html){$('#lawyer-details').hidden=false;$('#lawyer-detailBody').innerHTML=html;refreshClasses();$('#lawyer-details').focus();$('#lawyer-details').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
function itauDetail(c){return `<h2>${escape(c.title)}</h2><p><span class="badge">${escape(c.statusLabel)}</span></p><p>${escape(c.city||'')} ${escape(c.uf||'')}</p>`+(c.status==='queued'?(user.role==='lawyer'?`<p>Assuma o atendimento para acessar os documentos.</p><button data-claim="${escape(c.id)}">Assumir atendimento</button>`:'<p>A solicitação está disponível para um advogado autorizado assumir.</p>'):c.mine?`<div class="actions">${Object.entries({report:'Relatório e anexos',powerOfAttorney:'Procuração',agreement:'Contrato'}).map(([key,label])=>`<a class="download" href="/api/advogados/jobs/${encodeURIComponent(c.id)}/documents/${key}">${label}</a>`).join('')}${(c.sources||[]).map((name,i)=>`<a class="download" href="/api/advogados/jobs/${encodeURIComponent(c.id)}/documents/source-${i}">${escape(name)}</a>`).join('')}</div>${c.status==='claimed'?`<p>Revise o conjunto antes de protocolar no canal oficial.</p><form class="protocol" data-complete="${escape(c.id)}"><label>Número do protocolo ou processo<input name="protocol" required minlength="5" maxlength="100"></label><button>Registrar protocolo</button></form>`:`<p>Protocolo registrado: ${escape(c.protocol_number)}</p>`}`:'<p>Os documentos permanecem restritos ao advogado responsável.</p>');}
async function run(fn,button){if(button)button.disabled=true;$('#lawyer-message').textContent='';try{await fn();}catch(e){$('#lawyer-message').textContent=e.message;if(e.status===401){$('#lawyer-dashboard').hidden=true;$('#lawyer-login').hidden=false;}}finally{if(button)button.disabled=false;}}
$('#lawyer-refresh').addEventListener('click',e=>void run(load,e.currentTarget));$('#lawyer-search').addEventListener('input',render);$('#lawyer-service').addEventListener('change',render);
for(const b of root.querySelectorAll('[data-filter]'))b.addEventListener('click',()=>{filter=b.dataset.filter;render();});
$('#lawyer-closeDetails').addEventListener('click',()=>{$('#lawyer-details').hidden=true;$('#lawyer-detailBody').innerHTML='';pisCase=null;$('#lawyer-search').focus();});
$('#lawyer-caseRows').addEventListener('click',e=>{const b=e.target.closest('[data-open]');if(!b)return;void run(async()=>{const c=cases.find(c=>c.key===b.dataset.open);if(!c)return;if(c.module==='energy'){await api('/api/energy-audit/cases/'+c.id+'/claim',{});location.href='/?energyCase='+encodeURIComponent(c.id)+'#contas-de-luz';return;}if(c.module==='itau'){pisCase=null;detail(itauDetail(c));return;}
 if(c.status==='queued'&&!c.assigned_user_id){pisCase=null;detail(`<h2>PIS/PASEP · ${escape(String(c.id).slice(0,8))}</h2><p>Assuma o atendimento para conferir os documentos.</p><button data-pis-claim="${escape(c.id)}">Assumir atendimento</button>`);}
 else {pisCase=(await pisApi('/cases/'+c.id)).case;detail(pisPanel(pisCase,pisConfig,{withAnswers:true}));}},b);});
$('#lawyer-detailBody').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.claim)void run(async()=>{await api('/api/advogados/jobs/'+b.dataset.claim+'/claim',{});filter='active';await load();detail(itauDetail(cases.find(c=>c.id===b.dataset.claim)));},b);if(b.dataset.pisClaim)void run(async()=>{pisCase=(await pisPost('/cases/'+b.dataset.pisClaim+'/claim')).case;await load();detail(pisPanel(pisCase,pisConfig,{withAnswers:true}));},b);});
$('#lawyer-detailBody').addEventListener('submit',e=>{const f=e.target;if(!f.matches('[data-complete],[data-pis-form]'))return;e.preventDefault();if(saving)return;saving=true;void run(async()=>{try{if(f.dataset.complete){await api('/api/advogados/jobs/'+f.dataset.complete+'/complete',{protocolNumber:new FormData(f).get('protocol')});$('#lawyer-details').hidden=true;filter='closed';await load();}else{try{pisCase=(await submitPisPanel(f,pisCase)).case;}catch(error){if(error.code==='case_conflict'){pisCase=(await pisApi('/cases/'+pisCase.id)).case;detail(pisPanel(pisCase,pisConfig,{withAnswers:true}));}throw error;}await load();detail(pisPanel(pisCase,pisConfig,{withAnswers:true}));}}finally{saving=false;}},f.querySelector('button'));});
let loading=false;
async function activate(){
 if(location.hash!=='#advogados'||loading)return;
 loading=true;try{await run(load);}finally{loading=false;}
}
window.addEventListener('hashchange',activate);
window.addEventListener('audita:auth-changed',activate);
void activate();
