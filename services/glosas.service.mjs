import {randomUUID,createHash} from 'node:crypto';
import {caseSchema,summarize,reportText} from './glosas-domain.mjs';
import {IrError,requireIr as check,sealIr,openIr,irKey} from './ir-exemption-domain.mjs';
import {inspectGlosasDocument,validateExtraction,analysisSchema} from './glosas-ai.mjs';
import {reconcileGlosas} from './glosas-reconcile.mjs';
import {glosasPdf} from './glosas-report.mjs';

export function createGlosasService({getDb,env=process.env,ai,now=()=>new Date()}){
 const key=()=>irKey(env.AUDITA_GLOSAS_ENCRYPTION_KEY||env.AUDITA_IR_ENCRYPTION_KEY);
 function db(){const d=getDb();check(d.dbReady&&d.pool&&key(),'unavailable','Armazenamento seguro de glosas indisponível.',503);return d.pool;}
 const signed=a=>check(a?.user?.id&&a.tenantId,'authentication_required','Entre na sua conta.',401);
 const seal=(id,value)=>sealIr(value,key(),'glosas:'+id);
 const open=(id,value,binary=false)=>openIr(value,key(),'glosas:'+id,binary);
 function decode(row){const {automation=null,...data}=open(row.id,row.encrypted_payload);return {id:row.id,revision:row.revision,updatedAt:row.updated_at,data,automation};}
 const idle=v=>check(!v.automation?.busy||Date.parse(v.automation.busy.until)<=now().getTime(),'busy','Uma análise está em andamento. Aguarde antes de alterar o lote.',409);
 const revision=(v,n)=>check(Number.isInteger(n)&&v.revision===n,'conflict','Lote alterado. Atualize antes de continuar.',409);
 async function owned(a,id){signed(a);const r=await db().query('SELECT * FROM audita_glosas WHERE id=$1 AND tenant_id=$2 AND user_id=$3',[id,a.tenantId,a.user.id]);check(r.rows[0],'not_found','Lote não encontrado.',404);return decode(r.rows[0]);}
 async function documents(id,files=false){return (await db().query(`SELECT id,hash,size,pages,encrypted_metadata${files?',encrypted_file':''} FROM audita_glosas_documents WHERE case_id=$1 ORDER BY created_at,id`,[id])).rows.map(r=>({id:r.id,hash:r.hash,size:r.size,pages:r.pages,...open(r.id,r.encrypted_metadata),...(files?{buffer:open(r.id+':file',r.encrypted_file,true)}:{})}));}
 async function get(a,id){const v=await owned(a,id);return {...v,summary:summarize(v.data),documents:await documents(id)};}
 async function replace(a,v){const r=await db().query('UPDATE audita_glosas SET encrypted_payload=$4,revision=revision+1,updated_at=NOW() WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND revision=$5 RETURNING id',[v.id,a.tenantId,a.user.id,seal(v.id,{...v.data,...(v.automation?{automation:v.automation}:{})}),v.revision]);check(r.rows.length,'conflict','Lote alterado em outra janela. Atualize antes de continuar.',409);v.revision++;}
 async function configuration(){const d=getDb();let ready=false;if(d.dbReady&&d.pool&&key())try{const r=(await d.pool.query("SELECT to_regclass('audita_glosas') AS cases,to_regclass('audita_glosas_documents') AS documents")).rows[0];ready=!!(r?.cases&&r?.documents);}catch{}return {storageReady:ready,aiReady:!!ai?.available(),maxFiles:4,maxPages:20,maxBytes:10*1024*1024};}
 async function list(a){signed(a);return (await db().query('SELECT * FROM audita_glosas WHERE tenant_id=$1 AND user_id=$2 ORDER BY updated_at DESC LIMIT 100',[a.tenantId,a.user.id])).rows.map(row=>{const v=decode(row);return {id:v.id,lot:v.data.lot,operator:v.data.operator,updatedAt:v.updatedAt};});}
 async function save(a,input,id=null){signed(a);const data=caseSchema.parse(input.data);
  if(id){const v=await owned(a,id);idle(v);revision(v,input.revision);v.data=data;
   if(v.automation){check(input.confirmed===true&&v.automation.extraction&&data.items.length===v.automation.extraction.items.length,'confirmation_required','Confira todas as linhas extraídas e confirme os dados.');v.automation={...v.automation,confirmedAt:now().toISOString(),analysis:null,completed:[],error:null};}
   await replace(a,v);
  }else{id=randomUUID();const payload={...data};if(input.aiConsent===true)payload.automation={consentAt:now().toISOString(),busy:null,extraction:null,analysis:null,confirmedAt:null,completed:[],attempts:0};await db().query('INSERT INTO audita_glosas(id,tenant_id,user_id,encrypted_payload) VALUES($1,$2,$3,$4)',[id,a.tenantId,a.user.id,seal(id,payload)]);}
  return get(a,id);
 }
 async function remove(a,id,n){const v=await owned(a,id);idle(v);revision(v,n);const r=await db().query('DELETE FROM audita_glosas WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND revision=$4 RETURNING id',[id,a.tenantId,a.user.id,n]);check(r.rows.length,'conflict','Lote alterado. Atualize.',409);return {removed:true};}
 async function upload(a,id,{buffer,name,type,revision:n}){
  const v=await owned(a,id);idle(v);revision(v,n);check(v.automation?.consentAt,'consent_required','Confirme a autorização para leitura pela OpenAI.');
  check(['denial','billing','contract','authorization'].includes(type),'invalid_type','Tipo de documento inválido.');
  const info=await inspectGlosasDocument(buffer,name),existing=await documents(id),hash=createHash('sha256').update(buffer).digest('hex');
  if(existing.some(d=>d.hash===hash))return get(a,id);
  check(existing.length<4&&existing.reduce((s,d)=>s+d.size,0)+buffer.length<=20*1024*1024&&existing.reduce((s,d)=>s+d.pages,0)+info.pages<=40,'file_limit','Limite por lote: 4 arquivos, 20 MB e 40 páginas no total.');
  const did=randomUUID();v.automation={...v.automation,busy:null,extraction:null,analysis:null,confirmedAt:null,completed:[],error:null};
  v.data={...v.data,items:[]};
  // One statement: attaching a file and invalidating results must succeed together.
  const result=await db().query(`WITH changed AS (UPDATE audita_glosas SET encrypted_payload=$4,revision=revision+1,updated_at=NOW() WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND revision=$5 RETURNING id)
   INSERT INTO audita_glosas_documents(id,case_id,hash,size,pages,encrypted_metadata,encrypted_file)
   SELECT $6,id,$7,$8,$9,$10,$11 FROM changed RETURNING id`,[id,a.tenantId,a.user.id,seal(id,{...v.data,automation:v.automation}),n,did,hash,buffer.length,info.pages,seal(did,{name:String(name||'documento').slice(0,150),type,mime:info.mime}),seal(did+':file',buffer)]);
  check(result.rows.length,'conflict','Lote alterado. Atualize antes de enviar novamente.',409);return get(a,id);
 }
 async function download(a,id,did){await owned(a,id);const r=(await db().query('SELECT encrypted_metadata,encrypted_file FROM audita_glosas_documents WHERE case_id=$1 AND id=$2',[id,did])).rows[0];check(r,'not_found','Documento não encontrado.',404);return {...open(did,r.encrypted_metadata),buffer:open(did+':file',r.encrypted_file,true)};}
 async function command(a,id,input){
  const v=await owned(a,id);check(['extract','analyze'].includes(input?.action),'invalid_action','Ação inválida.');
  check(typeof input.requestId==='string'&&/^[0-9a-f-]{36}$/i.test(input.requestId),'request_id','Identificação de requisição inválida.');
  if(v.automation?.completed?.includes(input.requestId))return get(a,id);
  idle(v);revision(v,input.revision);check(v.automation?.consentAt,'consent_required','Autorize a leitura dos documentos.');check(ai?.available(),'ai_unavailable','A integração OpenAI não está configurada neste ambiente.',503);
  check((v.automation.attempts||0)<10,'attempt_limit','Limite de 10 processamentos deste lote atingido. Solicite suporte.');
  const docs=await documents(id,true);check(docs.some(d=>d.type==='denial'),'documents_required','Envie o demonstrativo de glosas antes da análise.');
  if(input.action==='analyze')check(v.automation.confirmedAt&&v.data.items.length,'confirmation_required','Confira e confirme a extração antes de gerar minutas.');
  const token=randomUUID();v.automation.busy={token,action:input.action,until:new Date(now().getTime()+15*60000).toISOString()};v.automation.attempts=(v.automation.attempts||0)+1;v.automation.error=null;await replace(a,v);
  let result,error=null;
  try{
   if(input.action==='extract'){
    const extracted=[];for(const doc of docs)extracted.push({...doc,buffer:undefined,extraction:validateExtraction(await ai.extract(doc,a),doc)});
    result=reconcileGlosas(extracted);check(result.items.length>0&&result.items.length<=100,'empty_extraction','Nenhum item identificado ou lote acima de 100 itens. Confira os documentos.');
   }else{
    const extraction=v.automation.extraction;
    const response=analysisSchema.parse(await ai.analyze({items:v.data.items.map((item,index)=>({...item,index,evidenceIds:extraction.items[index].evidenceIds,extractionWarnings:extraction.items[index].issues})),facts:extraction.facts,evidence:extraction.evidence},a));
    check(response.items.length===v.data.items.length&&new Set(response.items.map(i=>i.index)).size===v.data.items.length&&response.items.every(i=>i.index<v.data.items.length),'incomplete_analysis','Análise incompleta. Nenhum resultado parcial foi aplicado.');
    for(const item of response.items){const allowed=new Set([...extraction.items[item.index].evidenceIds,...extraction.facts.map(f=>f.evidenceId)]);check(item.evidenceIds.every(ref=>allowed.has(ref)),'invalid_evidence','A análise citou evidência não vinculada ao item.');if(!item.evidenceIds.length)item.draft='';}
    result={...response,at:now().toISOString(),notice:'Sugestões e minutas por IA, sem revisão profissional. Não protocoladas e sem decisão sobre procedência.'};
   }
  }catch(e){error=e instanceof IrError&&['ambiguous_lines','truncated','empty_extraction','context_limit'].includes(e.code)?e.message:'Não foi possível concluir a leitura/análise. Nenhum resultado parcial foi aplicado; confira os arquivos ou tente novamente.';}
  const latest=await owned(a,id);check(latest.automation?.busy?.token===token,'conflict','Uma operação mais recente substituiu esta leitura.',409);latest.automation.busy=null;latest.automation.error=error;
  if(result){if(input.action==='extract'){latest.automation.extraction=result;latest.automation.analysis=null;latest.automation.confirmedAt=null;latest.data.items=[];}else latest.automation.analysis=result;latest.automation.completed=[...(latest.automation.completed||[]),input.requestId].slice(-20);}
  await replace(a,latest);return get(a,id);
 }
 async function report(a,id,pdf=false){const v=await get(a,id);check(v.data.items.length,'empty','Confira os dados extraídos antes de exportar.');
  const extra=v.automation?.analysis?.items.flatMap(item=>['',`Item ${item.index+1} - sugestão de IA não revisada`,item.observation,...item.missing.map(m=>'Pendente: '+m),'Minuta para revisão: '+(item.draft||'Evidência insuficiente para minuta.'),'Prevenção: '+item.prevention,'Evidências: '+item.evidenceIds.join(', ')])||[];
  const sources=v.automation?.extraction?.evidence.flatMap(e=>[`${e.id} | ${e.name} | ${e.page?'Página '+e.page:e.locator}`,e.quote])||[];
  const content=`Referência ${id} | Revisão ${v.revision}\n${reportText(v.data)}\n\n${extra.join('\n')}\n\nEVIDÊNCIAS EXTRAÍDAS POR IA, SUJEITAS À CONFERÊNCIA\n${sources.join('\n')}`;
  return pdf?glosasPdf(content):Buffer.from(content,'utf8');
 }
 return {configuration,list,get,save,remove,report,upload,download,command};
}
