import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { irKey, sealIr, openIr } from './ir-exemption-domain.mjs';
import { getPdfRoot } from './storage.service.mjs';

export const chatId = id => typeof id === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);
export function chatCheck(ok, code, statusCode = 400) {
  if (!ok) throw Object.assign(new Error(code), { code, statusCode });
}
const TYPES = { pdf:'application/pdf', html:'text/html', txt:'text/plain', md:'text/markdown', csv:'text/csv', json:'application/json',
  png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp', svg:'image/svg+xml',
  docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation' };

// ponytail: private encrypted files on the existing persistent PDF volume; object storage if instances multiply.
export function createGeneralChatStorage({ root = join(getPdfRoot(), 'chat'), env = process.env } = {}) {
  const key = () => irKey(env.AUDITA_CHAT_DOCUMENTS_ENCRYPTION_KEY || env.AUDITA_IR_ENCRYPTION_KEY || env.AUDITA_IMPORT_ENCRYPTION_KEY || env.AUDITA_PROFILE_ENCRYPTION_KEY);
  function owner(auth) {
    chatCheck(auth?.user?.id && auth?.tenantId && !auth.unauthorized, 'authentication_required', 401);
    const ids = [auth.tenantId, auth.user.id].map(String);
    chatCheck(ids.every(id => /^[1-9]\d{0,18}$/.test(id)), 'authentication_required', 401);
    chatCheck(key(), 'chat_storage_unavailable', 503);
    return ids.join('-');
  }
  function path(auth, kind, id) { chatCheck(chatId(id), 'not_found', 404); return join(root, owner(auth), kind, id + '.enc'); }
  function aad(auth, kind, id) { return `general-chat:${owner(auth)}:${kind}:${id}`; }
  async function save(auth, kind, id, value) {
    const target=path(auth,kind,id), temp=target+'.'+randomUUID()+'.tmp';
    await mkdir(join(root, owner(auth), kind), { recursive:true, mode:0o700 });
    try { await writeFile(temp,sealIr(value,key(),aad(auth,kind,id)),{mode:0o600}); await rename(temp,target); }
    finally { await unlink(temp).catch(()=>{}); }
  }
  async function load(auth,kind,id) {
    try { return openIr(await readFile(path(auth,kind,id),'utf8'),key(),aad(auth,kind,id)); }
    catch(error) { if(error.code==='ENOENT') chatCheck(false,'not_found',404); throw error; }
  }
  async function getThread(auth,id) { return load(auth,'threads',id); }
  async function listThreads(auth) {
    const names=await readdir(join(root,owner(auth),'threads')).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
    const threads=[];
    for(const name of names.filter(n=>n.endsWith('.enc'))) {
      const t=await getThread(auth,name.slice(0,-4));
      threads.push({id:t.id,title:t.title,updatedAt:t.updatedAt});
    }
    return threads.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,100);
  }
  async function saveThread(auth,thread) {
    chatCheck(chatId(thread.id) && Array.isArray(thread.messages) && thread.messages.length<=100,'chat_invalid_thread');
    await save(auth,'threads',thread.id,thread);
  }
  async function deleteThread(auth,id) {
    const thread=await getThread(auth,id);
    await unlink(path(auth,'threads',id));
    for(const artifact of thread.messages.flatMap(m=>m.artifacts||[])) await unlink(path(auth,'artifacts',artifact.id)).catch(()=>{});
  }
  async function saveArtifact(auth,{name,buffer}) {
    chatCheck(Buffer.isBuffer(buffer)&&buffer.length>0&&buffer.length<=20*1024*1024,'chat_artifact_too_large',413);
    const fileName=String(name||'arquivo.txt').replace(/[\\/\x00-\x1f\x7f]/g,'_').slice(-160);
    const mime=TYPES[fileName.split('.').at(-1).toLowerCase()];
    chatCheck(mime,'chat_unsupported_artifact',422);
    if(mime==='application/pdf')chatCheck(buffer.subarray(0,5).toString()==='%PDF-','chat_invalid_artifact',422);
    const id=randomUUID();
    await save(auth,'artifacts',id,{name:fileName,mime,base64:buffer.toString('base64')});
    return {id,name:fileName,mime,size:buffer.length,url:`/api/chat/artifacts/${id}`};
  }
  async function getArtifact(auth,id) { const a=await load(auth,'artifacts',id);return {...a,buffer:Buffer.from(a.base64,'base64')}; }
  const sealResult=(auth,id,value)=>({encrypted:sealIr(value,key(),`general-chat:${owner(auth)}:result:${id}`)});
  const openResult=(auth,id,value)=>value?.encrypted?openIr(value.encrypted,key(),`general-chat:${owner(auth)}:result:${id}`):value;
  return {getThread,listThreads,saveThread,deleteThread,saveArtifact,getArtifact,sealResult,openResult};
}
