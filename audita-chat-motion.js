// Shared Itaú-style timing and avatar movement for assisted Audita conversations.
export function createAuditaChatMotion({getStage,getConversation,isActive}) {
let floatingAssistantAvatar=null;
function moveAssistantAvatar(conversation,{immediate=false}={}){
  const stage=getStage();
  if(!floatingAssistantAvatar){
    floatingAssistantAvatar=document.createElement('span');
    floatingAssistantAvatar.className='charge-analysis-avatar charge-analysis-floating-avatar';
    floatingAssistantAvatar.setAttribute('aria-hidden','true');
    floatingAssistantAvatar.innerHTML='<img src="/assets/audita-profile-assistant.png" alt="" loading="eager" decoding="async">';
  }
  if(!stage.contains(floatingAssistantAvatar))stage.appendChild(floatingAssistantAvatar);
  const avatar=floatingAssistantAvatar;
  const messages=conversation?.querySelectorAll('.charge-analysis-message.assistant');
  const anchor=messages?.[messages.length-1]?.querySelector('.charge-analysis-avatar-anchor');
  if(!anchor){avatar.classList.remove('is-ready');return;}
  const positionAvatar=()=>{
    if(!anchor.isConnected)return;
    const stageRect=stage.getBoundingClientRect(),anchorRect=anchor.getBoundingClientRect();
    avatar.style.setProperty('--charge-avatar-x',`${Math.round(anchorRect.left-stageRect.left+stage.scrollLeft)}px`);
    avatar.style.setProperty('--charge-avatar-y',`${Math.round(anchorRect.top-stageRect.top+stage.scrollTop)}px`);
    avatar.classList.add('is-ready');
  };
  if(immediate||!avatar.classList.contains('is-ready')){
    avatar.classList.add('is-positioning');positionAvatar();avatar.getBoundingClientRect();avatar.classList.remove('is-positioning');
  }else window.requestAnimationFrame(positionAvatar);
}
let cancelTyping=()=>{};
function scrollLatestAssistant(message=getConversation()?.lastElementChild){
  window.requestAnimationFrame(()=>{
    if(message?.isConnected&&isActive())message.scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth',block:'end'});
  });
}
function animateAssistant(){
  const conversation=getConversation(),message=conversation?.lastElementChild;
  if(!message)return;
  message.remove();
  moveAssistantAvatar(conversation);
  scrollLatestAssistant(conversation.lastElementChild);
  // Itaú: show the reply, pause 900 ms, move the avatar to typing, then wait 1500 ms.
  return new Promise(resolve=>{
    let typing,timer;
    const finish=()=>{
      window.clearTimeout(timer);
      typing?.remove();
      conversation.appendChild(message);
      moveAssistantAvatar(conversation);
      cancelTyping=()=>{};
      resolve();
    };
    timer=window.setTimeout(()=>{
      typing=document.createElement('div');
      typing.className='charge-analysis-message assistant charge-analysis-message-typing';
      typing.setAttribute('role','status');
      typing.innerHTML='<span class="charge-analysis-avatar-anchor" aria-hidden="true"></span><div class="charge-analysis-typing">IA AUDITA está digitando…</div>';
      conversation.appendChild(typing);
      moveAssistantAvatar(conversation);
      scrollLatestAssistant(typing);
      timer=window.setTimeout(()=>{
        finish();
        if(message.isConnected){message.classList.add('charge-analysis-message-typing');scrollLatestAssistant(message);}
      },1500);
    },900);
    cancelTyping=finish;
  });
}

return {moveAssistantAvatar,scrollLatestAssistant,animateAssistant,cancelTyping:()=>cancelTyping()};
}
