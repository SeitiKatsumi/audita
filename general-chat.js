const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const uuid = () => crypto.randomUUID();
export function initExamConversation({getAuthState, subscription, requestLogin}) {
 const root=document.querySelector('#laudos-exames');
 if(!root)return;
 const form=root.querySelector('form'), filesInput=root.querySelector('[type=file]'), description=root.querySelector('textarea'), consent=root.querySelector('[type=checkbox]');
 const selected=root.querySelector('[data-exam-files]'), transcript=root.querySelector('[data-exam-messages]'), status=root.querySelector('[role=status]'), submit=form.querySelector('button[type=submit]');
 let files=[], documentIds=[], threadId=uuid(), busy=false, controller, revision=0, pendingRequest=null;
 const owner=()=>getAuthState()?.user?.id;
 const bubble=(role,text)=>{const row=document.createElement('div');row.className='charge-analysis-message '+role;row.innerHTML=(role==='assistant'?'<img class="exam-avatar" src="assets/audita-profile-assistant.png" alt="">':'')+'<div class="charge-analysis-bubble"></div>';row.lastElementChild.innerHTML=formatGeneralChat(text);transcript.append(row);row.scrollIntoView({block:'nearest',behavior:'auto'});return row.lastElementChild;};
 const renderFiles=()=>{selected.replaceChildren();files.forEach((file,index)=>{const item=document.createElement('li');item.textContent=file.name+' ';const remove=document.createElement('button');remove.type='button';remove.textContent='Remover';remove.disabled=busy;remove.addEventListener('click',()=>{files.splice(index,1);renderFiles();});item.append(remove);selected.append(item);});};
 const lock=value=>{busy=value;for(const el of form.elements)el.disabled=value;renderFiles();submit.textContent=value?'Analisando…':documentIds.length?'Enviar mensagem':'Enviar exames para análise';};
 const addExamFiles=next=>{
  if(busy||!next.length)return;
  if(next.some(f=>! /\.(pdf|png|jpe?g)$/i.test(f.name)||f.size>50*1024*1024)){status.textContent='Envie PDF, PNG ou JPEG, de até 50 MB por arquivo.';return;}
  files.push(...next);consent.checked=false;status.textContent='';renderFiles();
 };
 filesInput.addEventListener('change',()=>{addExamFiles([...filesInput.files]);filesInput.value='';});
 bindChatFileDrop(root,{addFiles:addExamFiles,isBusy:()=>busy});
 window.addEventListener('audita:auth-changed',()=>{revision++;controller?.abort();files=[];documentIds=[];threadId=uuid();pendingRequest=null;transcript.replaceChildren();description.value='';consent.checked=false;status.textContent='';lock(false);});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  if(!files.length&&!documentIds.length){status.textContent='Anexe pelo menos um exame ou laudo.';filesInput.focus();return;}
  if(!consent.checked){status.textContent='Confirme a autorização para analisar os arquivos.';consent.focus();return;}
  if(!owner()){requestLogin('Entre na sua conta para analisar seus exames.');return;}
  const run=revision, account=owner();lock(true);
  let reply, userRow;
  try{
   if(!await subscription.ensureAccess('messages')||run!==revision||owner()!==account)return;
   controller=new AbortController();
   const text=description.value.trim();
   for(const file of [...files]){
    status.textContent='Lendo '+file.name+'…';
    const doc=await subscription.analyzeDocument(file);
    if(run!==revision||owner()!==account)return;
    if(!doc)throw new Error('Não foi possível ler o arquivo. Tente novamente.');
    if(!documentIds.includes(doc.id))documentIds.push(doc.id);
    files=files.filter(f=>f!==file);renderFiles();
   }
   const content=EXAM_ANALYSIS_PROMPT+(text?'\n\nMinha dúvida: '+text:'');
   const fingerprint=JSON.stringify([content,documentIds]);
   if(pendingRequest&&pendingRequest.fingerprint!==fingerprint)throw new Error('A resposta anterior foi interrompida. Reenvie a mesma descrição antes de começar outra análise.');
   pendingRequest ||= {fingerprint,id:uuid()};
   userRow=bubble('user',text||'Enviei meus exames para análise.');
   reply=bubble('assistant','Estou analisando seus arquivos…');
   status.textContent='Analisando seus exames…';
   const response=await fetch('/api/chat/stream',{method:'POST',credentials:'same-origin',signal:controller.signal,headers:{'content-type':'application/json'},body:JSON.stringify({threadId,requestId:pendingRequest.id,mode:'auto',documentIds,messages:[{role:'user',content}]})});
   if(!response.ok){const data=await response.json().catch(()=>({}));if(response.status<500)pendingRequest=null;throw new Error(data.message||'Não foi possível iniciar a análise.');}
   const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',answer='',completed=false;
   while(true){const {value,done}=await reader.read();if(done)break;if(run!==revision)return;buffer+=decoder.decode(value,{stream:true});let boundary;
    while((boundary=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);const line=block.split('\n').find(l=>l.startsWith('data: '));if(!line)continue;const message=JSON.parse(line.slice(6));
     if(message.type==='error'){if(message.quotaReleased)pendingRequest=null;throw new Error(message.message||'Não foi possível concluir a análise.');}
     if(message.type==='delta'){answer+=message.text;reply.innerHTML=formatGeneralChat(answer);}
     if(message.type==='status')status.textContent=message.message;
     if(message.type==='completed'){completed=true;reply.innerHTML=formatGeneralChat(message.result.answer);}
    }
   }
   if(!completed)throw new Error('Conexão interrompida. Reenvie a mesma descrição para recuperar a resposta.');
   pendingRequest=null;description.value='';status.textContent='Você pode tirar outra dúvida ou anexar mais exames.';
  }catch(error){if(run===revision){if(reply)reply.parentElement.remove();if(userRow)userRow.parentElement.remove();status.textContent=error.message||'Não foi possível analisar agora.';}}
  finally{if(run===revision){lock(false);void subscription.refresh();}}
 });
}
export const EXAM_ANALYSIS_PROMPT = 'Explique os exames anexados em linguagem simples, usando somente os dados legíveis dos documentos. Cite o arquivo e a página quando disponíveis, preserve valores, unidades, datas e referências do laboratório. Destaque resultados fora dessas referências sem concluir um diagnóstico. Não invente dados nem trate imagens médicas como diagnóstico radiológico. Indique limitações e perguntas para levar ao profissional de saúde. Não prescreva tratamentos ou mudanças de medicação. Esta é uma explicação informativa, não um laudo médico.';
export function examChatEntry(search = '') { return new URLSearchParams(search).get('service') === 'exames'; }
const recall=key=>{try{return sessionStorage.getItem(key);}catch{return null;}};
const remember=(key,value)=>{try{sessionStorage.setItem(key,value);}catch{/* History remains available from the server. */}};
const assistantAvatar='<span class="chat-message-avatar"><img src="assets/audita-logo-original.png" alt=""></span>';
const copyIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>';
const retryIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9"/></svg>';
const safeLink = value => {
  try {const url=new URL(value,location.origin);return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}
};
export function formatGeneralChat(text) {
  const blocks=String(text||'').split(/(```[\s\S]*?```)/g);
  return blocks.map(block=>{
    if(block.startsWith('```'))return `<pre><code>${escape(block.replace(/^```[^\n]*\n?/,'').replace(/```$/,''))}</code></pre>`;
    return escape(block).replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g,(_,title,url)=>{
      const href=safeLink(url.replace(/&amp;/g,'&'));return href?`<a href="${escape(href)}" target="_blank" rel="noopener noreferrer">${title}</a>`:title;
    }).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`\n]+)`/g,'<code>$1</code>')
      .replace(/^#{1,4} (.+)$/gm,'<h3>$1</h3>').replace(/\n/g,'<br>');
  }).join('');
}

export function bindChatFileDrop(area, {addFiles, isBusy}) {
 let depth=0;
 const isFileDrag=e=>Array.from(e.dataTransfer?.types||[]).includes('Files');
 const reset=()=>{depth=0;area.classList.remove('chat-file-dragging');};
 area.addEventListener('dragenter',e=>{if(!isFileDrag(e))return;e.preventDefault();depth++;if(!isBusy())area.classList.add('chat-file-dragging');});
 area.addEventListener('dragover',e=>{if(!isFileDrag(e))return;e.preventDefault();e.dataTransfer.dropEffect=isBusy()?'none':'copy';});
 area.addEventListener('dragleave',e=>{if(!isFileDrag(e)&&!depth)return;e.preventDefault();if(--depth<=0)reset();});
 area.addEventListener('drop',e=>{
   if(!isFileDrag(e)&&!e.dataTransfer?.files?.length)return;
   e.preventDefault();e.stopPropagation();reset();
   if(!isBusy())addFiles(Array.from(e.dataTransfer?.files||[]));
 });
 area.addEventListener('dragend',reset);
 area.addEventListener('keydown',e=>{if(e.key==='Escape')reset();});
}

export function initGeneralChat({getAuthState,subscription,requestLogin,getLegacyThreads=()=>[]}) {
 const form=document.querySelector('#chatForm'),input=document.querySelector('#chatInput'),messages=document.querySelector('#chatMessages');
 const list=document.querySelector('#chatThreadList'),empty=document.querySelector('#chatEmptyState'),error=document.querySelector('#chatError');
 const fileInput=document.querySelector('#chatAttachment'),attach=document.querySelector('#chatAttachmentButton'),pending=document.querySelector('#chatAttachmentPreview');
 const send=document.querySelector('#chatSendButton'),stop=document.querySelector('#chatStopButton');
 const history=document.querySelector('#chatThreads'),historyButton=document.querySelector('#chatHistoryButton');
 const exams=examChatEntry(location.search);
 const historyKey=accountId=>(exams?'audita:exam-chat:':'audita:general-chat:')+accountId;
 let examConsent;
 if(exams){
   empty.innerHTML='<span class="chat-welcome-logo"><img src="assets/audita-logo-original.png" alt="IA AUDITA" /></span><p class="eyebrow">Análise de exames</p><h2>Vamos analisar seus exames?</h2><p>Anexe um ou mais arquivos em PDF ou fotos legíveis. Depois, clique em enviar. Se quiser, escreva também sua dúvida.</p><p>A IA explica os resultados, mas não emite laudo médico nem substitui a avaliação de um profissional de saúde.</p><a href="/#central-servicos">Voltar à Central de Serviços</a>';
   input.placeholder='Escreva sua dúvida sobre os exames (opcional)...';
   fileInput.accept='.pdf,.png,.jpg,.jpeg';
   form.querySelector('small').textContent='PDF, PNG ou JPEG. Você pode anexar vários exames. Até 50 MB por arquivo.';
   const consentLabel=document.createElement('label');
   consentLabel.className='chat-privacy-note exam-chat-consent';
   consentLabel.innerHTML='<input type="checkbox" id="examChatConsent"> Autorizo o envio destes exames à IA da OpenAI para análise e tenho autorização para compartilhar estes dados de saúde.';
   form.prepend(consentLabel);examConsent=consentLabel.querySelector('input');
 }
 function closeHistory(){if(history.open)history.close();historyButton.setAttribute('aria-expanded','false');}
 historyButton.addEventListener('click',()=>{history.showModal();historyButton.setAttribute('aria-expanded','true');});
 document.querySelector('#chatHistoryClose').addEventListener('click',closeHistory);
 history.addEventListener('close',()=>historyButton.setAttribute('aria-expanded','false'));
 history.addEventListener('click',e=>{if(e.target!==history)return;const r=history.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeHistory();});
 document.addEventListener('audita:pagechange',e=>{if(e.detail.page!=='chat')closeHistory();});
 const preview=document.createElement('dialog');preview.className='general-chat-preview';preview.innerHTML='<header><strong>Prévia do arquivo</strong><button type="button" aria-label="Fechar prévia">×</button></header><section></section>';document.body.append(preview);
 let threads=[],thread={id:uuid(),title:'Nova conversa',messages:[]},files=[],active=null,owner='',version=0,previewUrl=null,monitor=null;
 const account=()=>{const a=getAuthState();return a?.user?.id?`${a.tenantId||a.user.tenant?.id||''}:${a.user.id}`:'';};
 const current=()=>getAuthState()?.user?.id;
 async function request(url,options={}) {
   const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});const data=await r.json().catch(()=>({}));
   if(!r.ok)throw Object.assign(new Error(r.status===401?'Entre na sua conta para continuar.':data.message||'Não foi possível concluir. Tente novamente.'),{status:r.status,code:data.error});return data;
 }
 function showError(text=''){error.textContent=text;error.classList.toggle('hidden',!text);}
 function artifactHtml(a){
   const url=/^\/api\/chat\/artifacts\/[0-9a-f-]{36}$/i.test(a.url)?a.url:'';if(!url)return '';
   return `<div class="general-chat-artifact">${a.mime.startsWith('image/')&&a.mime!=='image/svg+xml'?`<img src="${url}" alt="${escape(a.name)}" loading="lazy">`:''}
     <strong>${escape(a.name)}</strong><div><a href="${url}" download>Baixar</a>${['application/pdf','text/html'].includes(a.mime)||a.mime.startsWith('image/')?`<button type="button" data-preview="${escape(a.id)}">Visualizar</button>`:''}</div></div>`;
 }
 function render(){
   if(!messages)return;
   const busy=Boolean(active)||thread.processing?.status==='running';
   const composerFocused=document.activeElement===send||document.activeElement===stop;
   empty.classList.toggle('hidden',thread.messages.length>0);
   messages.querySelectorAll('.chat-message-row').forEach(n=>n.remove());
   messages.insertAdjacentHTML('beforeend',thread.messages.map((m,index)=>`<article class="chat-message-row ${m.role==='user'?'user':'assistant'}">${m.role==='assistant'?assistantAvatar:''}<div class="chat-message-content">
     ${m.role==='assistant'?'<strong>IA AUDITA</strong>':''}<div class="chat-message-body">${formatGeneralChat(m.role==='user'&&m.content.startsWith(EXAM_ANALYSIS_PROMPT)?m.content.slice(EXAM_ANALYSIS_PROMPT.length).replace(/^\s*Minha dúvida:\s*/,'').trim()||'Analise meus exames anexados.':m.content)}</div>
     ${m.fileNames?.length?`<small>${m.fileNames.map(escape).join(' · ')}</small>`:m.documentIds?.length?'<small>Documentos vinculados a esta conversa</small>':''}
     ${(m.artifacts||[]).map(artifactHtml).join('')}
     ${m.sources?.length?`<details class="general-chat-sources"><summary>Fontes consultadas</summary>${m.sources.map(s=>safeLink(s.url)?`<a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.name)}</a>`:'').join('')}</details>`:''}
     ${m.role==='assistant'?`<div class="general-chat-message-actions"><button type="button" data-copy="${index}" aria-label="Copiar resposta" title="Copiar resposta">${copyIcon}</button><button type="button" data-retry="${index}" aria-label="Tentar novamente" title="Tentar novamente" ${busy?'disabled':''}>${retryIcon}</button></div>`:''}
   </div></article>`).join(''));
   if(thread.processing&&!active)messages.insertAdjacentHTML('beforeend',`<article class="chat-message-row assistant">${assistantAvatar}<div class="chat-message-content"><small role="status" ${busy?'class="general-chat-thinking"':''}>${escape(thread.processing.message|| (thread.processing.status==='running'?'Continuando a tarefa...':'A tarefa foi interrompida. Tente novamente.'))}</small></div></article>`);
   if(active)messages.insertAdjacentHTML('beforeend',`<article class="chat-message-row assistant">${assistantAvatar}<div class="chat-message-content"><small role="status" class="general-chat-thinking">${escape(active.status)}</small><div class="chat-message-body" data-stream>${formatGeneralChat(active.text)}</div></div></article>`);
   list.innerHTML=threads.length?threads.map(t=>`<div class="chat-thread-item ${t.id===thread.id?'active':''}"><button type="button" data-general-thread="${escape(t.id)}">${escape(t.title)}</button><button type="button" data-general-delete="${escape(t.id)}" aria-label="Excluir conversa">×</button></div>`).join(''):'<p class="chat-privacy-note">Nenhuma conversa salva ainda.</p>';
   pending.classList.toggle('hidden',!files.length);pending.innerHTML=files.map((f,i)=>`<span class="general-chat-pending-file"><strong title="${escape(f.name)}">${escape(f.name)}</strong><button class="general-chat-remove-file" type="button" data-remove-file="${i}" aria-label="Remover ${escape(f.name)}" ${busy?'disabled':''}>Remover <span aria-hidden="true">×</span></button></span>`).join('');
   send.disabled=busy;send.hidden=busy;attach.disabled=busy;fileInput.disabled=busy;stop.hidden=!busy;
   if(composerFocused)(busy?stop:input).focus();
   requestAnimationFrame(()=>{messages.scrollTop=messages.scrollHeight;});
 }
 async function reload(){
   if(examConsent)examConsent.checked=false;
   const run=++version;clearTimeout(monitor);owner=account();active?.controller.abort();active=null;files=[];thread={id:uuid(),title:'Nova conversa',messages:[]};threads=[];render();
   if(!owner)return;
   try{let data=await request('/api/chat/threads');
     const legacy=getLegacyThreads().filter(t=>t.messages?.length).slice(0,16);
     if(!data.threads?.length&&legacy.length&&!recall('audita:chat-imported:'+owner)){
       await request('/api/chat/threads',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({threads:legacy.map(t=>({title:t.title,messages:t.messages.slice(-40).map(m=>({role:m.role,content:String(m.content).slice(0,3000)}))}))})});
       remember('audita:chat-imported:'+owner,'1');data=await request('/api/chat/threads');
     }if(run!==version||owner!==account())return;threads=data.threads||[];
     const saved=recall(historyKey(owner));if(saved&&threads.some(t=>t.id===saved)){const restored=(await request('/api/chat/threads/'+saved)).thread;if(run!==version||owner!==account())return;thread=restored;thread.documentIds=[...new Set(thread.messages.flatMap(m=>m.documentIds||[]))];}
     if(run===version&&owner===account()){render();watch();}
   }catch(e){if(run===version)showError(e.message);}
 }
 function watch(){
   clearTimeout(monitor);if(thread.processing?.status!=='running')return;
   const id=thread.id,run=version;
   monitor=setTimeout(async()=>{try{const data=await request('/api/chat/threads/'+id);if(run!==version||thread.id!==id)return;thread=data.thread;thread.documentIds=[...new Set(thread.messages.flatMap(m=>m.documentIds||[]))];render();watch();}catch(e){if(run===version)showError(e.message);}},2000);
 }
 function newThread(){if(active)return;closeHistory();clearTimeout(monitor);thread={id:uuid(),title:'Nova conversa',messages:[]};files=[];if(examConsent)examConsent.checked=false;showError();render();input.focus();}
 async function sendMessage(raw=input.value){
   const text=String(raw||'').trim();if(active||thread.processing?.status==='running'||(!text&&!files.length))return;
   if(exams&&!files.length&&!thread.documentIds?.length){showError('Anexe pelo menos um exame para começar.');attach.focus();return;}
   if(exams&&!examConsent.checked){showError('Confirme a autorização para analisar seus exames.');examConsent.focus();return;}
   if(!current()){requestLogin('Entre para conversar com a IA AUDITA.',()=>sendMessage(raw));return;}
   const startingAccount=account(),startingVersion=version;
   if(!await subscription.ensureAccess('messages')||active||thread.processing?.status==='running'||startingAccount!==account()||startingVersion!==version)return;
   const accountId=account(),run=version,localThread=thread,controller=new AbortController();
   const content=exams ? (text.includes(EXAM_ANALYSIS_PROMPT)?text:EXAM_ANALYSIS_PROMPT+(text?'\n\nMinha dúvida: '+text:'')) : text||'Analise os arquivos anexados.';
   if(content.length>5000){showError('Resuma sua dúvida para até 4.000 caracteres.');return;}
   const userMessage={id:uuid(),role:'user',content,createdAt:new Date().toISOString()};
   const submittedFiles=[...files];let remainingFiles=[...submittedFiles],submitted=false;
   userMessage.fileNames=submittedFiles.map(file=>file.name);
   localThread.messages.push(userMessage);files=[];fileInput.value='';input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));
   active={controller,status:'Preparando conversa',text:'',threadId:thread.id,requestId:userMessage.id};showError();render();
   try {
     const docIds=[...(localThread.documentIds||[])];
     for(const file of submittedFiles){active.status=`Lendo ${file.name}`;render();const doc=await subscription.analyzeDocument(file);if(!doc)throw Object.assign(new Error('Leitura cancelada.'),{cancelled:true});if(!docIds.includes(doc.id))docIds.push(doc.id);localThread.documentIds=[...docIds];remainingFiles=remainingFiles.filter(f=>f!==file);}
     if(run!==version||accountId!==account())return;
     localThread.documentIds=docIds;userMessage.documentIds=docIds;
     const fingerprint=JSON.stringify([userMessage.content,docIds,'auto']);
     if(localThread.pendingRequest?.fingerprint===fingerprint){
       localThread.messages=localThread.messages.filter(m=>m===userMessage||m.id!==localThread.pendingRequest.id);
       userMessage.id=localThread.pendingRequest.id;
     }
     localThread.pendingRequest={fingerprint,id:userMessage.id};
     active.requestId=userMessage.id;remember(historyKey(accountId),localThread.id);
     submitted=true;
     active.status='Preparando resposta';render();
     const r=await fetch('/api/chat/stream',{method:'POST',credentials:'same-origin',signal:controller.signal,headers:{'content-type':'application/json'},
       body:JSON.stringify({requestId:userMessage.id,threadId:localThread.id,mode:'auto',documentIds:docIds,messages:[{role:'user',content:userMessage.content}]})});
     if(!r.ok){const data=await r.json().catch(()=>({}));throw Object.assign(new Error(data.message||'Não foi possível responder.'),{status:r.status,code:data.error,quotaReleased:data.quotaReleased});}
     const reader=r.body.getReader(),decoder=new TextDecoder();let buffer='',result;
     while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});
       let boundary;while((boundary=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);const line=block.split('\n').find(l=>l.startsWith('data: '));if(!line)continue;
         const event=JSON.parse(line.slice(6));if(event.type==='error')throw Object.assign(new Error(event.message),{code:event.error,quotaReleased:event.quotaReleased});
         if(event.type==='completed')result=event.result;
         if(run!==version||accountId!==account())return;
         if(event.type==='status')active.status=event.message;
         if(event.type==='delta')active.text+=event.text;
         const streamNode=messages.querySelector('[data-stream]');if(streamNode)streamNode.innerHTML=formatGeneralChat(active.text);
         const status=messages.querySelector('[role="status"]');if(status)status.textContent=active.status;
         messages.scrollTop=messages.scrollHeight;
       }
     }
     if(!result)throw new Error('Conexão interrompida. Abra a conversa novamente para conferir o resultado salvo.');
     if(run!==version||accountId!==account())return;
     delete localThread.pendingRequest;delete localThread.processing;
     localThread.messages.push({id:userMessage.id+'-reply',role:'assistant',content:result.answer,artifacts:result.artifacts||[],sources:result.sources||[],model:result.model,createdAt:new Date().toISOString()});
     if(localThread.title==='Nova conversa')localThread.title=userMessage.content.slice(0,65);
     localThread.updatedAt=new Date().toISOString();
     threads=[{id:localThread.id,title:localThread.title,updatedAt:localThread.updatedAt},...threads.filter(t=>t.id!==localThread.id)];
     remember(historyKey(accountId),localThread.id);
   }catch(e){if(run!==version||accountId!==account())return;
     if(!submitted){localThread.messages=localThread.messages.filter(m=>m!==userMessage);files=[...remainingFiles,...files];}
     if(e.quotaReleased||e.code==='chat_reservation_finalized'){delete localThread.pendingRequest;localThread.messages=localThread.messages.filter(m=>m.id!==userMessage.id);}
     if(e.name==='AbortError')showError('Geração interrompida. Você pode tentar novamente.');
     else if(!e.cancelled&&!subscription.handleAccessError(e.status))showError(e.message);
     if(!input.value){input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));}
   }finally{if(run===version&&accountId===account()){active=null;render();void subscription.refresh();}}
 }
 form.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();void sendMessage();},true);
 input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();e.stopImmediatePropagation();void sendMessage();}},true);
 stop.addEventListener('click',async()=>{
   if(!active&&thread.processing?.status!=='running')return;const task=active||{threadId:thread.id,requestId:thread.processing.requestId};
   try{await request('/api/chat/cancel',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({threadId:task.threadId,requestId:task.requestId})});if(task.controller)task.controller.abort();else watch();}
   catch(e){showError(e.message);}
 });
 function addFiles(next){
   if(active||thread.processing?.status==='running'||!next.length)return;
   if(exams&&next.some(f=>!(/\.(pdf|png|jpe?g)$/i.test(f.name)))){showError('Envie exames em PDF, PNG ou JPEG.');return;}
   if(examConsent)examConsent.checked=false;
   if(next.some(f=>f.size>50*1024*1024)){showError('Cada arquivo pode ter até 50 MB.');return;}
   files.push(...next);showError();render();
 }
 fileInput.addEventListener('change',e=>{e.stopImmediatePropagation();addFiles([...fileInput.files]);fileInput.value='';},true);
 bindChatFileDrop(form.closest('.chat-main'),{addFiles,isBusy:()=>Boolean(active)||thread.processing?.status==='running'});
 pending.addEventListener('click',e=>{const b=e.target.closest('[data-remove-file]');if(b){e.stopImmediatePropagation();if(active||thread.processing?.status==='running')return;const index=Number(b.dataset.removeFile);files.splice(index,1);render();(pending.querySelector(`[data-remove-file="${Math.min(index,files.length-1)}"]`)||attach).focus();}},true);
 for(const id of ['chatNewButton','chatMobileNewButton'])document.getElementById(id)?.addEventListener('click',e=>{e.stopImmediatePropagation();newThread();},true);
 list.addEventListener('click',async e=>{const button=e.target.closest('[data-general-thread],[data-general-delete]');if(!button)return;e.stopImmediatePropagation();if(active)return;
   try{if(button.dataset.generalDelete){await request('/api/chat/threads/'+button.dataset.generalDelete,{method:'DELETE'});threads=threads.filter(t=>t.id!==button.dataset.generalDelete);if(thread.id===button.dataset.generalDelete)newThread();render();}
     else{thread=(await request('/api/chat/threads/'+button.dataset.generalThread)).thread;thread.documentIds=[...new Set(thread.messages.flatMap(m=>m.documentIds||[]))];files=[];if(examConsent)examConsent.checked=false;remember(historyKey(owner),thread.id);closeHistory();render();watch();}
   }catch(e){showError(e.message);}
 },true);
 messages.addEventListener('click',async e=>{const b=e.target.closest('[data-copy],[data-retry],[data-preview]');if(!b)return;e.stopImmediatePropagation();
   try{
     if(b.dataset.copy!=null){await navigator.clipboard.writeText(thread.messages[Number(b.dataset.copy)].content);b.setAttribute('aria-label','Resposta copiada');b.title='Resposta copiada';b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4 10-10"/></svg>';setTimeout(()=>{if(b.isConnected){b.innerHTML=copyIcon;b.setAttribute('aria-label','Copiar resposta');b.title='Copiar resposta';}},2000);}
     if(b.dataset.retry!=null){const previous=thread.messages.slice(0,Number(b.dataset.retry)).findLast(m=>m.role==='user');if(previous)void sendMessage(previous.content);}
     if(b.dataset.preview){const a=thread.messages.flatMap(m=>m.artifacts||[]).find(a=>a.id===b.dataset.preview);if(!a)return;
       const r=await fetch(a.url);if(!r.ok)throw new Error('Arquivo indisponível.');const bytes=await r.blob();preview.querySelector('strong').textContent=a.name;const target=preview.querySelector('section');target.replaceChildren();
       if(a.mime==='text/html'){const frame=document.createElement('iframe');frame.setAttribute('sandbox','');frame.title=a.name;
         frame.srcdoc=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'none'; img-src data: blob:; form-action 'none'">`+await bytes.text();target.append(frame);
       }else{previewUrl=URL.createObjectURL(bytes);const element=document.createElement(a.mime.startsWith('image/')?'img':'iframe');element.src=previewUrl;element.title=a.name;if(element.tagName==='IMG')element.alt=a.name;target.append(element);}
       preview.showModal();
     }
   }catch(e){showError(e.message);}
 },true);
 preview.querySelector('button').addEventListener('click',()=>preview.close());preview.addEventListener('close',()=>{if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;preview.querySelector('section').replaceChildren();});
 window.addEventListener('audita:auth-changed',()=>void reload());
 void reload();return {render,send:sendMessage,newThread};
}
