import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {requireIr as check,sealIr,openIr,irKey} from './ir-exemption-domain.mjs';
import {PIS_VERSION,PIS_SOURCE,PIS_STATUSES,PIS_DOCUMENTS,pisQuestions,pisAnswer,pisChecklist,pisSummary,pisDate,pisText,pisAmount} from './pis-pasep-domain.mjs';

export function createPisPasepService({getDb,env=process.env,now=()=>new Date()}) {
  const storage=resolve(env.AUDITA_PIS_STORAGE_PATH||'private-documents/pis');
  const key=()=>irKey(env.AUDITA_PIS_ENCRYPTION_KEY||env.AUDITA_IR_ENCRYPTION_KEY);
  const seal=(kind,id,p)=>sealIr(p,key(),`audita-pis:${kind}:${id}`);
  const open=(kind,id,p,binary=false)=>openIr(p,key(),`audita-pis:${kind}:${id}`,binary);
  function advance(status,target){const order=Object.keys(PIS_STATUSES);return order.indexOf(target)>order.indexOf(status)?target:status;}
  function signed(auth){check(auth?.user?.id&&auth.tenantId,'authentication_required','Entre na sua conta para continuar.',401);}
  function team(auth){return ['lawyer','super_admin'].includes(auth?.user?.role);}
  function db(){const s=getDb();check(env.AUDITA_PIS_ENABLED==='true','pis_disabled','Atendimento ainda não habilitado.',503);check(s?.pool&&s.dbReady&&key(),'pis_unavailable','Armazenamento seguro indisponível. Tente novamente mais tarde.',503);return s.pool;}
  async function tx(fn){const c=await db().connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
  async function access(c,auth,id,lock=false){
    signed(auth);const row=(await c.query(`SELECT * FROM audita_pis_cases WHERE id=$1${lock?' FOR UPDATE':''}`,[id])).rows[0];
    const owner=row&&String(row.tenant_id)===String(auth.tenantId)&&String(row.user_id)===String(auth.user.id);
    const operator=row&&team(auth)&&(auth.user.role==='super_admin'||String(row.assigned_user_id)===String(auth.user.id));
    check(owner||operator,'case_not_found','Atendimento não encontrado.',404);
    return {row,owner:!!owner,operator:!!operator,p:open('case',id,row.encrypted_payload)};
  }
  async function event(c,a,auth,kind,data,internal=false){const id=(await c.query("SELECT nextval('audita_pis_events_id_seq') AS id")).rows[0].id;await c.query('INSERT INTO audita_pis_events(id,case_id,actor_id,kind,internal,encrypted_payload) VALUES($1,$2,$3,$4,$5,$6)',[id,a.row.id,auth.user.id,kind,internal,seal('event',id,data)]);}
  async function save(c,a,status=a.row.status){await c.query('UPDATE audita_pis_cases SET encrypted_payload=$2,status=$3,revision=revision+1,updated_at=NOW() WHERE id=$1',[a.row.id,seal('case',a.row.id,a.p),status]);}
  async function docs(c,id){return (await c.query('SELECT * FROM audita_pis_documents WHERE case_id=$1 ORDER BY created_at',[id])).rows.map(r=>({id:r.id,createdAt:r.created_at,...open('document',r.id,r.encrypted_payload)}));}
  async function view(c,a){const questions=pisQuestions(a.p.answers),summary=pisSummary(a.p.answers);
    if(a.p.review?.result==='verified'){summary.message='O comprovante da consulta foi conferido pela equipe. O ressarcimento depende da decisão do órgão responsável.';summary.pending=[];}
    if(a.p.records.some(r=>r.kind==='receipt'&&r.confirmed))summary.message='O recebimento informado foi registrado com comprovante e conferido pela equipe. Consulte os registros abaixo.';
    return {id:a.row.id,status:a.row.status,revision:a.row.revision,assignedUserId:a.row.assigned_user_id,updatedAt:a.row.updated_at,permissions:{owner:a.owner,operator:a.operator},...a.p,questions,question:questions.find(q=>a.p.answers[q.key]===undefined)||null,checklist:pisChecklist(a.p.answers),summary,documents:await docs(c,a.row.id),events:(await c.query(`SELECT * FROM audita_pis_events WHERE case_id=$1 ${a.operator?'':'AND internal=FALSE'} ORDER BY id DESC LIMIT 200`,[a.row.id])).rows.map(r=>({id:r.id,kind:r.kind,internal:r.internal,at:r.created_at,...open('event',r.id,r.encrypted_payload)}))};}
  async function configuration(auth){const s=getDb(),enabled=env.AUDITA_PIS_ENABLED==='true';let ready=false;if(enabled&&s?.pool&&s.dbReady&&key()){ready=!!(await s.pool.query("SELECT to_regclass('audita_pis_cases') AS name")).rows[0]?.name;}return {enabled,ready,authenticated:!!auth?.user,operator:team(auth),version:PIS_VERSION,source:PIS_SOURCE,statuses:PIS_STATUSES,documentTypes:PIS_DOCUMENTS};}
  async function list(auth){signed(auth);return (await db().query('SELECT id,status,updated_at FROM audita_pis_cases WHERE tenant_id=$1 AND user_id=$2 ORDER BY updated_at DESC LIMIT 100',[auth.tenantId,auth.user.id])).rows;}
  async function create(auth){signed(auth);return tx(async c=>{const id=randomUUID();await c.query('INSERT INTO audita_pis_cases(id,tenant_id,user_id,encrypted_payload) VALUES($1,$2,$3,$4)',[id,auth.tenantId,auth.user.id,seal('case',id,{version:PIS_VERSION,answers:{},review:null,contracts:[],records:[],tasks:[]})]);const a=await access(c,auth,id);await event(c,a,auth,'created',{message:'Atendimento iniciado.'});return view(c,a);});}
  async function get(auth,id){return tx(async c=>{const a=await access(c,auth,id);await event(c,a,auth,'access',{message:'Atendimento consultado.'},true);return view(c,a);});}
  async function queue(auth){signed(auth);check(team(auth),'operator_required','Acesso reservado à equipe autorizada.',403);return (await db().query(`SELECT id,status,assigned_user_id,created_at,updated_at FROM audita_pis_cases WHERE (status='queued' AND assigned_user_id IS NULL AND user_id<>$1) OR assigned_user_id=$1 ${auth.user.role==='super_admin'?"OR status<>'triage'":''} ORDER BY updated_at DESC LIMIT 200`,[auth.user.id])).rows;}
  async function claim(auth,id){signed(auth);check(team(auth),'operator_required','Acesso reservado à equipe autorizada.',403);return tx(async c=>{const result=await c.query("UPDATE audita_pis_cases SET assigned_user_id=$2,status='review',revision=revision+1,updated_at=NOW() WHERE id=$1 AND status='queued' AND assigned_user_id IS NULL AND user_id<>$2 RETURNING id",[id,auth.user.id]);check(result.rows.length,'case_conflict','Este atendimento já foi assumido ou não está na fila.',409);const a=await access(c,auth,id);await event(c,a,auth,'assigned',{message:'Um responsável da equipe assumiu o atendimento.'});return view(c,a);});}
  async function command(auth,id,input={}){check(input&&typeof input==='object'&&!Array.isArray(input),'invalid_action','Solicitação inválida.');return tx(async c=>{
    const a=await access(c,auth,id,true),p=a.p;
    check(input.revision===a.row.revision,'case_conflict','O atendimento foi atualizado. Recarregue antes de salvar.',409);
    const owner=()=>check(a.owner,'owner_required','Somente o solicitante pode confirmar.',403);
    const operator=()=>check(a.operator&&!a.owner,'operator_required','Ação reservada ao responsável da equipe.',403);
    const files=await docs(c,id);
    const evidence=(documentId,type)=>{check(files.some(d=>d.id===documentId&&d.type===type),'evidence_required',`Anexe o documento: ${PIS_DOCUMENTS[type]}.`);return documentId;};
    let status=a.row.status,message,internal=false;
    if(input.action==='answer'){
      owner();check(!p.contracts.some(x=>x.acceptedAt)&&!p.records.length,'intake_locked','O atendimento já avançou. Envie uma atualização à equipe para corrigir os dados.',409);
      const qs=pisQuestions(p.answers),index=qs.findIndex(q=>q.key===input.key),next=qs.findIndex(q=>p.answers[q.key]===undefined);
      check(index>=0&&(next<0||index<=next),'invalid_question','Responda à pergunta atual primeiro.');
      const value=pisAnswer(input.key,input.value,p.answers);
      // Changing an earlier answer invalidates dependent answers, review and unaccepted terms.
      for(const q of qs.slice(index))delete p.answers[q.key];p.answers[input.key]=value;
      p.review=null;p.contracts.forEach(x=>{if(x.state==='published')x.state='superseded';});
      const complete=pisQuestions(p.answers).every(q=>p.answers[q.key]!==undefined);
      status=complete?(p.answers.referral==='yes'?(a.row.assigned_user_id?'review':'queued'):pisSummary(p.answers).pending.length||p.answers.consultation==='difficulty'?'assistance':'ready'):'triage';
      message=input.key==='consent'?'Autorização registrada.':input.key==='referral'&&value==='yes'?'Atendimento encaminhado à equipe.':'Resposta confirmada.';
    }else if(input.action==='review'){
      operator();check(p.answers.referral==='yes'&&pisQuestions(p.answers).every(q=>p.answers[q.key]!==undefined),'intake_incomplete','Conclua a conversa e solicite apoio da equipe.');
      check(pisChecklist(p.answers).every(d=>files.some(f=>f.type===d.type)),'documents_pending','Confira e anexe os documentos de identificação e representação do checklist.');
      check(input.confirmed===true,'review_required','Confirme a revisão documental.');
      check(['verified','assistance'].includes(input.result),'invalid_review','Selecione a conclusão da conferência.');
      if(input.result==='verified')evidence(input.documentId,'consultation');
      p.review={by:auth.user.id,at:now().toISOString(),result:input.result,note:pisText(input.note),documentId:input.result==='verified'?input.documentId:null};
      status='review';message='Revisão documental registrada pela equipe.';
    }else if(input.action==='contract'){
      operator();check(p.review,'review_required','Revise os documentos antes de apresentar as condições.');
      check(!p.contracts.some(x=>x.acceptedAt),'contract_locked','Já existe contrato aceito. Alterações exigem atendimento específico da equipe.',409);
      check(p.contracts.length<50,'contract_limit','Limite de versões de contratação atingido.');
      const percent=Number(input.percent);check(Number.isFinite(percent)&&percent>0&&percent<=100&&Math.abs(percent*100-Math.round(percent*100))<1e-7,'invalid_percent','Informe um percentual de êxito entre 0,01 e 100.');
      const contract={id:randomUUID(),version:p.contracts.length+1,percent,basis:pisText(input.basis,2000),scope:pisText(input.scope,5000),terms:pisText(input.terms,5000),state:'published',publishedAt:now().toISOString(),initialCents:0};
      p.contracts.forEach(x=>{if(x.state==='published')x.state='superseded';});p.contracts.push(contract);message='Condições de contratação disponíveis. Sem cobrança inicial.';
    }else if(input.action==='accept'){
      owner();const contract=p.contracts.find(x=>x.id===input.contractId&&x.version===input.version&&x.state==='published');
      check(contract&&p.review,'contract_conflict','Estas condições não estão disponíveis. Atualize o atendimento.',409);check(input.accepted===true,'acceptance_required','Confirme o aceite.');
      Object.assign(contract,{state:'accepted',acceptedAt:now().toISOString(),acceptedBy:auth.user.id});message=`Condições da versão ${contract.version} aceitas. Falta anexar e conferir o contrato assinado.`;
    }else if(input.action==='activate'){
      operator();const contract=p.contracts.find(x=>x.state==='accepted');check(contract&&p.review,'contract_required','É necessário aceite e revisão.');
      contract.documentId=evidence(input.documentId,'contract');contract.state='signed';contract.verifiedAt=now().toISOString();status='preparation';message='Contrato assinado conferido. Preparação do pedido iniciada.';
    }else if(input.action==='record'){
      check(p.answers.consent&&p.answers.referral!==undefined,'intake_incomplete','Conclua a conversa antes de registrar o andamento.');
      const kind=input.kind;check(['protocol','requirement','decision','receipt','fee'].includes(kind),'invalid_record','Tipo de registro inválido.');
      if(kind==='fee')operator();
      const record={id:randomUUID(),kind,date:pisDate(input.date,now()),documentId:evidence(input.documentId,kind),note:pisText(input.note),confirmed:a.operator&&!a.owner,by:auth.user.id};
      check(!p.records.some(r=>r.documentId===record.documentId&&r.kind===kind),'duplicate_record','Este comprovante já foi registrado.',409);
      if(kind==='protocol'){record.number=pisText(input.number,120);record.authority=pisText(input.authority,180);check(!p.records.some(r=>r.kind==='protocol'&&r.number===record.number&&r.authority===record.authority),'duplicate_record','Protocolo já registrado.',409);}
      if(['requirement','decision'].includes(kind))check(p.records.some(r=>r.kind==='protocol'),'protocol_required','Registre o requerimento primeiro.');
      if(kind==='decision'){check(['granted','denied','other'].includes(input.result),'invalid_result','Informe a decisão.');record.result=input.result;}
      if(kind==='receipt'){check(p.records.some(r=>r.kind==='protocol'),'protocol_required','Registre o requerimento primeiro.');record.amountCents=pisAmount(input.amountCents);}
      if(kind==='fee'){
        check(p.contracts.some(x=>x.state==='signed'),'contract_required','Confira o contrato assinado.');
        check(p.records.some(r=>r.kind==='receipt'&&r.confirmed),'receipt_required','Confirme o recebimento do ressarcimento antes dos honorários.');
        record.amountCents=pisAmount(input.amountCents);
      }
      check(p.records.length<200,'record_limit','Limite de registros atingido.');p.records.push(record);
      if(record.confirmed&&kind!=='fee'){const target={protocol:'filed',requirement:'requirement',decision:'decision',receipt:'received'}[kind];status=advance(status,target);}
      message=`${PIS_DOCUMENTS[kind]} registrado${record.confirmed?' pela equipe.':' pelo cliente; pendente de conferência.'}`;
    }else if(input.action==='confirm_record'){
      operator();const record=p.records.find(r=>r.id===input.recordId);check(record&&!record.confirmed,'invalid_record','Registro não disponível para conferência.');
      record.confirmed=true;record.confirmedBy=auth.user.id;record.confirmedAt=now().toISOString();
      // Confirming an older receipt must not regress the current operational status.
      const target={protocol:'filed',requirement:'requirement',decision:'decision',receipt:'received'}[record.kind];
      status=advance(status,target);message='Registro informado pelo cliente conferido pela equipe.';
    }else if(input.action==='note'){
      check(p.answers.consent,'consent_required','Confirme a autorização.');if(input.internal)operator();
      message=pisText(input.note);internal=input.internal===true;
    }else if(input.action==='task'){
      operator();const title=pisText(input.title,300),date=input.dueDate;
      check(!date||(typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&!isNaN(new Date(date))&&new Date(date).toISOString().slice(0,10)===date),'invalid_date','Prazo inválido.');
      if(input.taskId){const task=p.tasks.find(t=>t.id===input.taskId);check(task,'invalid_task','Pendência não encontrada.');Object.assign(task,{title,dueDate:date||null,done:input.done===true});}
      else{check(p.tasks.length<100,'task_limit','Limite de pendências atingido.');p.tasks.push({id:randomUUID(),title,dueDate:date||null,done:false});}
      message='Pendências atualizadas pela equipe.';
    }else if(input.action==='close'){
      operator();check(['decision','received'].includes(status),'invalid_transition','Registre e confira uma decisão ou recebimento antes de encerrar.');status='closed';message=pisText(input.note);
    }else check(false,'invalid_action','Ação não disponível.');
    await save(c,a,status);await event(c,a,auth,input.action,{message,version:PIS_VERSION},internal);return view(c,await access(c,auth,id));
  });}
  async function upload(auth,id,{buffer,name,type}){
    check(Buffer.isBuffer(buffer)&&buffer.length>0&&buffer.length<=10*1024*1024,'invalid_file','Envie um arquivo de até 10 MB.');check(Object.hasOwn(PIS_DOCUMENTS,type),'invalid_document_type','Selecione o tipo de documento.');
    const mime=buffer.subarray(0,5).toString()==='%PDF-'?'application/pdf':buffer.subarray(0,3).equals(Buffer.from([255,216,255]))?'image/jpeg':buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':null;
    check(mime,'invalid_file','Envie PDF, PNG ou JPEG.');const docId=randomUUID();let written=false;
    try{return await tx(async c=>{const a=await access(c,auth,id,true);check(a.p.answers.consent,'consent_required','Confirme a autorização antes de enviar documentos.');check((await docs(c,id)).length<100,'document_limit','Limite de documentos atingido.');
      const filename=pisText(name,180).replace(/[\x00-\x1f]/g,'');await mkdir(storage,{recursive:true,mode:0o700});await writeFile(join(storage,`${docId}.bin`),seal('file',docId,buffer),{mode:0o600,flag:'wx'});written=true;
      await c.query('INSERT INTO audita_pis_documents(id,case_id,encrypted_payload) VALUES($1,$2,$3)',[docId,id,seal('document',docId,{type,name:filename,mime,size:buffer.length})]);
      if(['identity','representation','death','succession','consultation'].includes(type)&&!a.p.contracts.some(x=>x.acceptedAt)){a.p.review=null;a.p.contracts.forEach(x=>{if(x.state==='published')x.state='superseded';});}
      await save(c,a);await event(c,a,auth,'document',{message:`Documento recebido: ${PIS_DOCUMENTS[type]}.`,documentId:docId});return view(c,await access(c,auth,id));
    });}catch(e){if(written)await unlink(join(storage,`${docId}.bin`)).catch(()=>{});throw e;}
  }
  async function download(auth,id,docId){return tx(async c=>{const a=await access(c,auth,id);const d=(await docs(c,id)).find(x=>x.id===docId);check(d,'document_not_found','Documento não encontrado.',404);const buffer=open('file',docId,await readFile(join(storage,`${docId}.bin`),'utf8'),true);await event(c,a,auth,'download',{documentId:docId},true);return {...d,buffer};});}
  return {configuration,list,create,get,queue,claim,command,upload,download};
}
