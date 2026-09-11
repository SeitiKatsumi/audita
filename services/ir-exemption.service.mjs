import crypto from 'node:crypto';
import {mkdir,writeFile,readFile,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {IR_VERSION,IR_DOCUMENT_TYPES,IR_STATUSES,IR_SOURCES,IrError,requireIr,irSteps,validateAnswer,documentChecklist,analyzeIr,sealIr,openIr,irKey} from './ir-exemption-domain.mjs';

const uuid=()=>crypto.randomUUID();
const safe=(value,max=2000)=>String(value||'').trim().slice(0,max);
const idValid=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id));
const transitions={triage:['documents_pending','review'],documents_pending:['review'],review:['documents_pending','preparation'],preparation:['review','filed'],filed:['requirement','decision'],requirement:['filed','review','decision'],decision:['preparation','closed'],closed:['review']};
export function createIrExemptionService({getDb,env=process.env,checkout,extractor,now=()=>new Date()}={}) {
  const key=()=>irKey(env.AUDITA_IR_ENCRYPTION_KEY);
  const storage=resolve(env.AUDITA_IR_STORAGE_PATH||'private-documents/ir');
  const context=(kind,id)=>`audita-ir:${kind}:${id}`;
  const encrypt=(kind,id,value)=>sealIr(value,key(),context(kind,id));
  const decrypt=(kind,row)=>openIr(row.encrypted_payload,key(),context(kind,row.id));
  function db() {const state=getDb();requireIr(state?.pool&&state.dbReady,'ir_database_unavailable','O armazenamento seguro está indisponível. Tente novamente mais tarde.',503);requireIr(key(),'ir_encryption_unavailable','O armazenamento seguro ainda não foi configurado.',503);return state.pool;}
  async function transaction(fn) {const client=await db().connect();try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
  function signed(auth) {requireIr(auth?.user?.id&&auth?.tenantId,'authentication_required','Entre na sua conta para continuar.',401);}
  async function staff(db,auth) {signed(auth);if(auth.user.role==='super_admin')return 'super_admin';return (await db.query('SELECT role FROM audita_ir_staff WHERE user_id=$1',[auth.user.id])).rows[0]?.role||null;}
  async function access(db,auth,id,lock=false) {
    signed(auth);requireIr(idValid(id),'case_not_found','Caso não encontrado.',404);
    const row=(await db.query(`SELECT * FROM audita_ir_cases WHERE id=$1${lock?' FOR UPDATE':''}`,[id])).rows[0];
    requireIr(row,'case_not_found','Caso não encontrado.',404);
    const role=await staff(db,auth), sameTenant=String(row.tenant_id)===String(auth.tenantId);
    const owner=sameTenant&&String(row.user_id)===String(auth.user.id);
    const operator=role==='super_admin'||(role==='manager'&&sameTenant)||(role==='lawyer'&&String(row.assigned_user_id)===String(auth.user.id));
    requireIr(owner||operator,'case_not_found','Caso não encontrado.',404);
    return {row,role,owner,operator,payload:decrypt('case',row)};
  }
  async function event(db,c,auth,kind,payload={},internal=false,dedupe=null) {
    const id=uuid();await db.query(`INSERT INTO audita_ir_events(id,case_id,actor_id,kind,internal,dedupe_key,encrypted_payload) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(dedupe_key) DO NOTHING`,[id,c.id,auth?.user?.id||null,kind,internal,dedupe,encrypt('event',id,payload)]);
  }
  async function save(db,c,payload,status=c.status) {await db.query('UPDATE audita_ir_cases SET encrypted_payload=$2,status=$3,revision=revision+1,updated_at=NOW() WHERE id=$1',[c.id,encrypt('case',c.id,payload),status]);}
  async function documents(db,id) {return (await db.query('SELECT * FROM audita_ir_documents WHERE case_id=$1 ORDER BY created_at',[id])).rows.map(r=>({id:r.id,createdAt:r.created_at,...decrypt('document',r)}));}
  async function proposals(db,id) {return (await db.query('SELECT * FROM audita_ir_proposals WHERE case_id=$1 ORDER BY version DESC',[id])).rows.map(r=>({id:r.id,version:r.version,kind:r.kind,amountCents:Number(r.amount_cents),state:r.state,acceptedAt:r.accepted_at,paidAt:r.paid_at,...decrypt('proposal',r)}));}
  async function view(db,a,auth) {
    const docs=await documents(db,a.row.id), offers=await proposals(db,a.row.id);
    const history=(await db.query(`SELECT * FROM audita_ir_events WHERE case_id=$1 ${a.operator?'':'AND internal=FALSE'} ORDER BY created_at DESC LIMIT 200`,[a.row.id])).rows.map(r=>({id:r.id,kind:r.kind,internal:r.internal,createdAt:r.created_at,...decrypt('event',r)}));
    const steps=irSteps(a.payload.answers),index=steps.findIndex(s=>a.payload.answers[s.key]===undefined);
    return {id:a.row.id,revision:a.row.revision,status:a.row.status,createdAt:a.row.created_at,updatedAt:a.row.updated_at,assignedUserId:a.row.assigned_user_id,
      permissions:{owner:a.owner,operator:a.operator,assign:a.role==='super_admin'||a.role==='manager'},
      ...a.payload,documents:docs,proposals:offers,events:history,steps,question:index===-1?null:steps[index],progress:{completed:index===-1?steps.length:index,total:steps.length},checklist:documentChecklist(a.payload.answers)};
  }
  async function configuration(auth) {
    const enabled=env.AUDITA_IR_ENABLED==='true',state=getDb();
    const ready=Boolean(enabled&&state?.pool&&state.dbReady&&key());
    let role=null;if(ready&&auth?.user)role=await staff(state.pool,auth);
    return {enabled,ready,authenticated:!!auth?.user,operator:!!role,staffRole:role,aiEnabled:env.AUDITA_IR_AI_ENABLED==='true',datajudConfigured:!!env.DATAJUD_API_KEY,version:IR_VERSION,sources:IR_SOURCES,documentTypes:IR_DOCUMENT_TYPES,statuses:IR_STATUSES};
  }
  async function list(auth) {signed(auth);const pool=db(),role=await staff(pool,auth);let query='SELECT * FROM audita_ir_cases WHERE tenant_id=$1 AND user_id=$2',args=[auth.tenantId,auth.user.id];
    if(role==='super_admin'){query='SELECT * FROM audita_ir_cases';args=[];}
    else if(role==='manager'){query='SELECT * FROM audita_ir_cases WHERE tenant_id=$1';args=[auth.tenantId];}
    else if(role==='lawyer'){query='SELECT * FROM audita_ir_cases WHERE (tenant_id=$1 AND user_id=$2) OR assigned_user_id=$2';}
    return (await pool.query(`${query} ORDER BY updated_at DESC LIMIT 100`,args)).rows.map(r=>({id:r.id,status:r.status,updatedAt:r.updated_at,title:decrypt('case',r).answers?.identity?.name||'Nova análise',assignedUserId:r.assigned_user_id}));
  }
  async function create(auth) {signed(auth);return transaction(async db=>{const id=uuid();await db.query('INSERT INTO audita_ir_cases(id,tenant_id,user_id,encrypted_payload) VALUES($1,$2,$3,$4)',[id,auth.tenantId,auth.user.id,encrypt('case',id,{answers:{},analysis:null,review:null,protocols:[],tasks:[],outcomes:{},extractions:[]})]);await event(db,{id},auth,'case_created',{message:'Atendimento iniciado.'});return view(db,await access(db,auth,id),auth);});}
  async function get(auth,id) {return transaction(async db=>{const a=await access(db,auth,id);await event(db,a.row,auth,'case_viewed',{},true);return view(db,a,auth);});}
  async function command(auth,id,input={}) {
    return transaction(async db=>{
      const a=await access(db,auth,id,true),p=a.payload;
      requireIr(input.revision===a.row.revision,'case_conflict','Este caso foi atualizado. Recarregue antes de salvar.',409);
      const action=input.action;
      if(action==='answer') {
        requireIr(a.owner,'owner_required','Somente o solicitante confirma as respostas.',403);
        const steps=irSteps(p.answers),target=steps.findIndex(s=>s.key===input.key),next=steps.findIndex(s=>p.answers[s.key]===undefined);
        requireIr(target>=0&&(next===-1||target<=next),'invalid_step','Conclua a pergunta atual primeiro.');
        requireIr(p.answers.consent||['role','consent'].includes(input.key),'consent_required','Confirme a autorização antes de informar dados.');
        const accepted=(await db.query("SELECT id FROM audita_ir_proposals WHERE case_id=$1 AND state IN ('accepted','payment_pending')",[id])).rows;
        requireIr(!accepted.length,'payment_in_progress','Finalize o pagamento pendente antes de alterar as informações.',409);
        p.answers[input.key]=validateAnswer(input.key,input.value,p.answers);
        if(input.key==='role') {delete p.answers.subject;delete p.answers.heir;delete p.answers.consent;}
        if(input.key==='benefits')delete p.answers.taxes;
        p.analysis=null;p.review=null;
        await db.query("UPDATE audita_ir_proposals SET state='superseded' WHERE case_id=$1 AND state='published'",[id]);
        await event(db,a.row,auth,input.key==='consent'?'consent_recorded':'answer_confirmed',{question:input.key,version:IR_VERSION});
        await save(db,a.row,p,['triage','documents_pending','review'].includes(a.row.status)?'triage':a.row.status);
      } else if(action==='analyze') {
        requireIr(p.answers.consent,'consent_required','Confirme a autorização.');
        p.analysis=analyzeIr(p.answers,await documents(db,id),now());p.review=null;
        requireIr(!p.analysis.missing.length,'intake_incomplete','Responda às perguntas antes de concluir.');
        await save(db,a.row,p,['triage','documents_pending','review'].includes(a.row.status)?(p.analysis.pending.length?'documents_pending':'review'):a.row.status);
        await event(db,a.row,auth,'analysis_created',{message:'Análise preliminar disponível.',version:IR_VERSION});
      } else if(action==='review') {
        requireIr(a.operator,'operator_required','Acesso restrito à equipe.',403);
        requireIr(p.analysis&&!p.analysis.missing.length,'analysis_required','Conclua a análise preliminar.');
        requireIr(input.confirmed===true&&safe(input.note),'review_required','Confirme a revisão e registre sua fundamentação.');
        const reviewedCents=input.reviewedCents==null?null:Number(input.reviewedCents);
        requireIr(reviewedCents===null||(Number.isSafeInteger(reviewedCents)&&reviewedCents>=0&&reviewedCents<=10000000000),'invalid_amount','Valor inválido.');
        p.review={by:auth.user.id,at:now().toISOString(),note:safe(input.note,5000),version:IR_VERSION,reviewedCents};
        await save(db,a.row,p,['triage','documents_pending','review'].includes(a.row.status)?'review':a.row.status);
        await event(db,a.row,auth,'review_completed',{message:'Revisão da equipe concluída.'});
      } else if(action==='assign') {
        requireIr(a.role==='super_admin'||(a.role==='manager'&&String(a.row.tenant_id)===String(auth.tenantId)),'operator_required','Sem permissão para atribuir.',403);
        const user=(await db.query("SELECT u.id FROM audita_users u JOIN audita_ir_staff s ON s.user_id=u.id WHERE u.id=$1 AND u.status='active'",[String(input.userId)])).rows[0];
        requireIr(user,'invalid_assignee','Selecione um operador credenciado.');
        await db.query('UPDATE audita_ir_cases SET assigned_user_id=$2 WHERE id=$1',[id,user.id]);await save(db,a.row,p);
        await event(db,a.row,auth,'assigned',{message:'Responsável atribuído.',userId:user.id},true);
      } else if(action==='status') {
        requireIr(a.operator,'operator_required','Acesso restrito à equipe.',403);
        requireIr(transitions[a.row.status]?.includes(input.status),'invalid_transition','Transição de situação inválida.');
        if(input.status==='preparation') {
          const paid=(await db.query("SELECT id FROM audita_ir_proposals WHERE case_id=$1 AND state='paid'",[id])).rows;
          requireIr(p.review&&paid.length,'payment_required','Revisão e pagamento confirmado são necessários.');
        }
        if(input.status==='filed')requireIr(p.protocols.length,'protocol_required','Registre o protocolo e o comprovante.');
        if(input.status==='decision')requireIr(p.outcomes.exemption||p.outcomes.refund,'evidence_required','Registre uma decisão ou restituição com evidência.');
        await save(db,a.row,p,input.status);await event(db,a.row,auth,'status_updated',{message:IR_STATUSES[input.status],note:safe(input.note)});
      } else if(action==='note') {
        requireIr(a.operator,'operator_required','Acesso restrito à equipe.',403);requireIr(safe(input.text),'empty_note','Escreva a atualização.');
        await event(db,a.row,auth,'note',{message:safe(input.text,5000)},input.internal===true);await save(db,a.row,p);
      } else if(action==='task') {
        requireIr(a.operator,'operator_required','Acesso restrito à equipe.',403);
        const task=input.task||{};requireIr(safe(task.title),'invalid_task','Informe a tarefa.');
        requireIr(!task.dueDate||/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate),'invalid_date','Data inválida.');
        if(task.id) {const old=p.tasks.find(t=>t.id===task.id);requireIr(old,'task_not_found','Tarefa não encontrada.');Object.assign(old,{title:safe(task.title),done:task.done===true,dueDate:task.dueDate||null});}
        else {requireIr(p.tasks.length<200,'task_limit','Limite de tarefas atingido.');p.tasks.push({id:uuid(),title:safe(task.title),done:false,dueDate:task.dueDate||null});}
        await save(db,a.row,p);await event(db,a.row,auth,'task_updated',{message:'Lista de tarefas atualizada.'});
      } else if(action==='protocol') {
        requireIr(a.operator,'operator_required','Acesso restrito à equipe.',403);
        const paid=(await db.query("SELECT id FROM audita_ir_proposals WHERE case_id=$1 AND state='paid'",[id])).rows;
        requireIr(paid.length&&p.review,'payment_required','Revisão e contratação são necessárias para registrar protocolo.');
        const data=input.protocol||{},docs=await documents(db,id);
        requireIr(docs.some(d=>d.id===data.documentId&&d.type==='protocol'),'evidence_required','Anexe o comprovante de protocolo.');
        requireIr(['administrative','judicial'].includes(data.kind)&&safe(data.number)&&safe(data.authority),'invalid_protocol','Informe tipo, órgão e número.');
        requireIr(/^\d{4}-\d{2}-\d{2}$/.test(data.date)&&!isNaN(new Date(data.date))&&data.date<=now().toISOString().slice(0,10),'invalid_date','Data de protocolo inválida.');
        const number=data.kind==='judicial'?safe(data.number).replace(/\D/g,''):safe(data.number);
        if(data.kind==='judicial') requireIr(/^\d{20}$/.test(number)&&DATAJUD_TRIBUNALS.includes(data.tribunal),'invalid_process','Informe número CNJ com 20 dígitos e tribunal válido.');
        requireIr(!p.protocols.some(x=>x.number===number&&x.authority===data.authority),'duplicate_protocol','Protocolo já registrado.');
        const protocol={id:uuid(),kind:data.kind,number,authority:safe(data.authority),date:data.date,tribunal:data.tribunal||null,documentId:data.documentId,monitoring:null};p.protocols.push(protocol);
        if(data.kind==='judicial')await db.query('INSERT INTO audita_ir_jobs(id,case_id,protocol_id) VALUES($1,$2,$3)',[uuid(),id,protocol.id]);
        await save(db,a.row,p,'filed');await event(db,a.row,auth,'protocol_recorded',{message:'Protocolo registrado.',protocol});
      } else if(action==='outcome') {
        requireIr(a.operator,'operator_required','Acesso restrito à equipe.',403);
        const data=input.outcome||{},docs=await documents(db,id);
        requireIr(['exemption','refund'].includes(data.kind),'invalid_outcome','Resultado inválido.');
        requireIr(docs.some(d=>d.id===data.documentId&&d.type===(data.kind==='refund'?'refund':'decision')),'evidence_required','Anexe a evidência adequada.');
        requireIr(safe(data.note),'invalid_outcome','Descreva o resultado.');
        const amount=data.amountCents==null?null:Number(data.amountCents);requireIr(amount===null||(Number.isSafeInteger(amount)&&amount>=0&&amount<=10000000000),'invalid_amount','Valor inválido.');
        requireIr(!(data.kind==='exemption'&&p.answers.role==='heir'&&data.granted===true),'invalid_outcome','Não há concessão de isenção futura ao titular falecido.');
        p.outcomes[data.kind]={note:safe(data.note),documentId:data.documentId,amountCents:amount,granted:data.granted===true,at:now().toISOString()};
        await save(db,a.row,p,'decision');await event(db,a.row,auth,'outcome_recorded',{message:data.kind==='refund'?'Resultado de restituição registrado.':'Decisão de isenção registrada.'});
      } else throw new IrError('invalid_action','Ação inválida.');
      return view(db,await access(db,auth,id),auth);
    });
  }
  async function upload(auth,id,{buffer,name,type}) {
    requireIr(Buffer.isBuffer(buffer)&&buffer.length>0&&buffer.length<=10*1024*1024,'invalid_file','Envie um arquivo de até 10 MB.');
    requireIr(Object.hasOwn(IR_DOCUMENT_TYPES,type),'invalid_document_type','Selecione o tipo de documento.');
    const mime=buffer.subarray(0,5).toString()==='%PDF-'?'application/pdf':buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff?'image/jpeg':buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':null;
    requireIr(mime,'invalid_file','São aceitos PDF, JPEG e PNG válidos.');
    const docId=uuid();let written=false;
    try{return await transaction(async db=>{
      const a=await access(db,auth,id,true);requireIr(a.payload.answers.consent,'consent_required','Confirme a autorização antes de anexar.');
      requireIr((await documents(db,id)).length<100,'document_limit','Limite de documentos atingido.');
      await mkdir(storage,{recursive:true,mode:0o700});
      await writeFile(join(storage,`${docId}.bin`),sealIr(buffer,key(),context('file',docId)),{mode:0o600,flag:'wx'});written=true;
      const metadata={name:safe(name,180).replace(/[\r\n\x00-\x1f]/g,''),type,mime,size:buffer.length,sha256:crypto.createHash('sha256').update(buffer).digest('hex')};
      await db.query('INSERT INTO audita_ir_documents(id,case_id,encrypted_payload) VALUES($1,$2,$3)',[docId,id,encrypt('document',docId,metadata)]);
      // Operational receipts do not invalidate the medical/financial review.
      if (['identity','representation','medical','benefit','income','tax_return','death','estate'].includes(type)) {
        a.payload.review=null;
        a.payload.analysis=null;
        await db.query("UPDATE audita_ir_proposals SET state='superseded' WHERE case_id=$1 AND state='published'",[id]);
      }
      await save(db,a.row,a.payload);await event(db,a.row,auth,'document_uploaded',{message:`Documento recebido: ${IR_DOCUMENT_TYPES[type]}.`,documentId:docId});
      return view(db,await access(db,auth,id),auth);
    });}catch(e){if(written)await unlink(join(storage,`${docId}.bin`)).catch(()=>{});throw e;}
  }
  async function download(auth,id,docId) {return transaction(async db=>{const a=await access(db,auth,id);const doc=(await documents(db,id)).find(d=>d.id===docId);requireIr(doc,'document_not_found','Documento não encontrado.',404);const content=await readFile(join(storage,`${doc.id}.bin`),'utf8');const buffer=openIr(content,key(),context('file',doc.id),true);await event(db,a.row,auth,'document_accessed',{documentId:doc.id},true);return {...doc,buffer};});}
  async function publishProposal(auth,id,input) {return transaction(async db=>{
    const a=await access(db,auth,id,true);requireIr(a.operator,'operator_required','Acesso restrito à equipe.',403);
    requireIr(a.row.revision===input.revision,'case_conflict','Recarregue o caso antes de publicar.',409);
    requireIr(a.payload.review,'review_required','Revise as informações antes da proposta.');
    const amount=Number(input.amountCents);requireIr(['adm','ouro'].includes(input.kind)&&Number.isSafeInteger(amount)&&amount>=100&&amount<=1000000000,'invalid_proposal','Informe plano e preço válido (mínimo R$ 1).');
    requireIr(safe(input.scope)&&safe(input.terms),'invalid_proposal','Descreva entregas e condições.');
    const old=await proposals(db,id);requireIr(!old.some(p=>['accepted','payment_pending'].includes(p.state)),'payment_in_progress','Há proposta aceita ou pagamento pendente.',409);
    const paid=old.filter(p=>p.state==='paid');
    requireIr(!paid.length||(input.kind==='ouro'&&paid.every(p=>p.kind==='adm')&&input.additional===true),'invalid_upgrade','Após ADM pago, publique apenas upgrade Ouro com valor adicional explícito.');
    requireIr(!(a.payload.answers.role==='heir'&&input.kind==='adm'&&!safe(input.rationale)),'review_required','Registre a justificativa da via administrativa para o espólio.');
    await db.query("UPDATE audita_ir_proposals SET state='superseded' WHERE case_id=$1 AND state='published'",[id]);
    const offerId=uuid(),version=(old[0]?.version||0)+1;
    await db.query('INSERT INTO audita_ir_proposals(id,case_id,version,kind,amount_cents,encrypted_payload) VALUES($1,$2,$3,$4,$5,$6)',[offerId,id,version,input.kind,amount,encrypt('proposal',offerId,{scope:safe(input.scope,8000),terms:safe(input.terms,8000),additional:paid.length>0,rationale:safe(input.rationale),review:a.payload.review,caseRevision:a.row.revision})]);
    await save(db,a.row,a.payload);await event(db,a.row,auth,'proposal_published',{message:`Proposta ${input.kind.toUpperCase()} disponível para revisão.`,proposalId:offerId,version});return view(db,await access(db,auth,id),auth);
  });}
  async function acceptProposal(auth,id,proposalId,input) {return transaction(async db=>{
    const a=await access(db,auth,id,true);requireIr(a.owner,'owner_required','Somente o solicitante pode aceitar.',403);requireIr(input.accepted===true,'acceptance_required','Confirme o aceite das condições.');
    const offer=(await proposals(db,id)).find(p=>p.id===proposalId);requireIr(offer&&offer.state==='published'&&offer.version===input.version,'proposal_conflict','Proposta não está disponível para aceite.',409);
    requireIr(a.payload.review,'review_required','A equipe precisa revisar os documentos atualizados.');
    await db.query("UPDATE audita_ir_proposals SET state='accepted',accepted_at=NOW() WHERE id=$1",[proposalId]);await save(db,a.row,a.payload);await event(db,a.row,auth,'proposal_accepted',{proposalId,version:offer.version,message:'Proposta aceita. Aguardando pagamento.'});return view(db,await access(db,auth,id),auth);
  });}
  async function createCheckout(auth,id,proposalId) {return transaction(async db=>{
    const a=await access(db,auth,id,true);requireIr(a.owner,'owner_required','Somente o solicitante pode pagar.',403);
    const r=(await db.query('SELECT * FROM audita_ir_proposals WHERE id=$1 AND case_id=$2',[proposalId,id])).rows[0];
    requireIr(r&&['accepted','payment_pending'].includes(r.state),'proposal_conflict','Aceite uma proposta disponível antes de pagar.',409);
    if(r.checkout_url&&new Date(r.checkout_expires_at)>now())return {url:r.checkout_url};
    // Do not create another session until the previous one is confirmed expired by Stripe.
    requireIr(!r.checkout_id,'checkout_pending','Aguardando confirmação do pagamento ou expiração pelo provedor. Atualize em instantes.',409);
    requireIr(checkout,'billing_not_configured','Pagamento ainda não configurado.',503);
    const session=await checkout(auth,{id:proposalId,caseId:id,version:r.version,kind:r.kind,amountCents:Number(r.amount_cents),attempt:r.checkout_attempt});
    requireIr(session?.id&&session.url&&Number.isFinite(session.expiresAt),'billing_unavailable','Não foi possível abrir o pagamento.',503);
    await db.query("UPDATE audita_ir_proposals SET state='payment_pending',checkout_id=$2,checkout_url=$3,checkout_expires_at=$4 WHERE id=$1",[proposalId,session.id,session.url,new Date(session.expiresAt*1000)]);await save(db,a.row,a.payload);return {url:session.url};
  });}
  async function paymentEvent(stripeEvent) {
    const obj=stripeEvent.data?.object||{},meta=obj.metadata||{};
    if(meta.purchase_kind!=='ir_proposal')return {ignored:true};
    return transaction(async db=>{
      requireIr(idValid(meta.ir_case_id)&&idValid(meta.ir_proposal_id),'invalid_payment','Referência de pagamento inválida.');
      const c=(await db.query('SELECT * FROM audita_ir_cases WHERE id=$1 FOR UPDATE',[meta.ir_case_id])).rows[0];
      requireIr(c,'invalid_payment','Caso do pagamento não encontrado.');
      const r=(await db.query('SELECT * FROM audita_ir_proposals WHERE id=$1 AND case_id=$2',[meta.ir_proposal_id,c.id])).rows[0];
      requireIr(r&&String(c.tenant_id)===String(meta.audita_tenant_id)&&String(c.user_id)===String(meta.audita_user_id)&&String(r.version)===String(meta.ir_proposal_version),'invalid_payment','Pagamento não corresponde à proposta.');
      if(r.checkout_id!==obj.id)return {ignored:true,tenantId:c.tenant_id,reason:'obsolete_checkout'};
      if(r.state==='paid')return {tenantId:c.tenant_id};
      if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(stripeEvent.type)&&obj.payment_status==='paid') {
        requireIr(obj.currency==='brl'&&Number(obj.amount_total)===Number(r.amount_cents),'invalid_payment_amount','Valor do pagamento não corresponde à proposta.');
        await db.query("UPDATE audita_ir_proposals SET state='paid',paid_at=NOW() WHERE id=$1",[r.id]);await event(db,c,null,'payment_confirmed',{message:'Pagamento confirmado.',proposalId:r.id},false,`stripe:${stripeEvent.id}`);
      } else if(['checkout.session.expired','checkout.session.async_payment_failed'].includes(stripeEvent.type)) {
        await db.query("UPDATE audita_ir_proposals SET state='accepted',checkout_id=NULL,checkout_url=NULL,checkout_expires_at=NULL,checkout_attempt=checkout_attempt+1 WHERE id=$1",[r.id]);await event(db,c,null,'payment_retry',{message:'Pagamento não concluído. Você pode tentar novamente.'},false,`stripe:${stripeEvent.id}`);
      } else return {ignored:true,tenantId:c.tenant_id};
      await save(db,c,decrypt('case',c));return {tenantId:c.tenant_id};
    });
  }
  async function staffList(auth) {const pool=db(),role=await staff(pool,auth);requireIr(role==='super_admin'||role==='manager','operator_required','Acesso restrito.',403);return (await pool.query('SELECT u.id,u.name,u.email,s.role FROM audita_ir_staff s JOIN audita_users u ON u.id=s.user_id WHERE u.status=\'active\' ORDER BY u.name')).rows;}
  async function grantStaff(auth,{email,role}) {requireIr(auth.user?.role==='super_admin','super_admin_required','Somente o superadministrador credencia operadores.',403);requireIr(['manager','lawyer'].includes(role),'invalid_role','Função inválida.');const pool=db();const user=(await pool.query("SELECT id FROM audita_users WHERE lower(email)=$1 AND status='active'",[safe(email).toLowerCase()])).rows[0];requireIr(user,'user_not_found','O operador precisa criar uma conta primeiro.');await pool.query('INSERT INTO audita_ir_staff(user_id,role) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET role=EXCLUDED.role',[user.id,role]);return {ok:true};}
  async function generate(auth,id,kind='dossier') {
    return transaction(async db=>{
      const a=await access(db,auth,id);requireIr(a.operator,'operator_required','Geração disponível à equipe responsável.',403);requireIr(a.payload.review,'review_required','Revise o caso antes de gerar documentos.');
      requireIr(['dossier','request'].includes(kind),'invalid_template','Modelo inválido.');
      const p=a.payload,subject=p.answers.role==='self'?p.answers.identity:p.answers.subject;
      const lines=[kind==='request'?'MINUTA — REQUERIMENTO DE ISENÇÃO DE IR':'DOSSIÊ DE ISENÇÃO E RESTITUIÇÃO DE IR',`Modelo ${IR_VERSION} | Caso ${id}`,`Gerado em ${now().toISOString()}`,'DOCUMENTO PARA REVISÃO DA EQUIPE. NÃO PROTOCOLADO.',
        `Titular: ${subject?.name||'Pendente'} | CPF: ${subject?.cpf||'Pendente'}`,`Solicitante: ${p.answers.identity?.name||''}`,`Qualidade: ${p.answers.role}`, ...p.answers.benefits.map(b=>`Fonte: ${b.payer} | Tipo: ${b.type} | Início: ${b.start||'a confirmar'}`),
        `Diagnóstico: ${p.answers.diagnosis?.date||p.answers.diagnosis?.year||'a confirmar'}`,`Condições informadas: ${(p.answers.conditions||[]).join(', ')}`,
        ...(kind==='request'?[p.answers.role==='heir'?'Solicita-se análise dos recolhimentos do titular falecido e orientação sobre restituição ao espólio, conforme documentação de representação.':'Solicita-se análise do enquadramento dos rendimentos de benefício na isenção prevista na Lei 7.713/88, conforme documentação médica e previdenciária anexa.', 'A autoridade competente deverá avaliar a documentação, o termo inicial e os rendimentos abrangidos.']:[]),
        `Revisão da equipe: ${p.review.note}`,`Valor revisado: ${p.review.reviewedCents===null?'não definido':(p.review.reviewedCents/100).toFixed(2)}`,
        'Documentos anexos:',...(await documents(db,id)).map(d=>`${IR_DOCUMENT_TYPES[d.type]}: ${d.name}`),
        'Fontes:',...IR_SOURCES.map(s=>s.url),'Assinatura do responsável: __________________________________'];
      const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);let page,y;
      function newPage(){page=pdf.addPage([595,842]);y=790;}newPage();
      for(const raw of lines){const sanitized=raw.replace(/[^\x20-\x7e\xa0-\xff]/g,'-');let line='';for(const word of sanitized.split(' ')){if(font.widthOfTextAtSize(`${line} ${word}`,10)>490){if(y<55)newPage();page.drawText(line,{x:50,y,size:10,font,color:rgb(.08,.19,.22)});y-=16;line=word;}else line+=(line?' ':'')+word;}if(y<55)newPage();page.drawText(line,{x:50,y,size:10,font});y-=23;}
      await event(db,a.row,auth,'document_generated',{template:kind,version:IR_VERSION},true);
      return {buffer:Buffer.from(await pdf.save()),name:`audita-ir-${kind}.pdf`,mime:'application/pdf'};
    });
  }
  async function extract(auth,id,docId) {
    requireIr(env.AUDITA_IR_AI_ENABLED==='true'&&extractor,'ai_unavailable','Extração opcional indisponível. Preencha as respostas manualmente.',503);
    const owned=await get(auth,id);requireIr(owned.permissions.owner,'owner_required','Somente o solicitante pode solicitar a extração.',403);
    const doc=await download(auth,id,docId);requireIr(['medical','benefit','income'].includes(doc.type),'unsupported_extraction','Use laudo, comprovante de benefício ou informe.');
    const result=await extractor(doc,auth);
    return transaction(async db=>{const a=await access(db,auth,id,true);requireIr(a.owner,'owner_required','Somente o solicitante confirma informações extraídas.',403);
      const candidates=[];for(const candidate of result.candidates||[]){try{if(!['diagnosis','benefits','conditions'].includes(candidate.key))continue;candidates.push({key:candidate.key,value:validateAnswer(candidate.key,candidate.value,a.payload.answers)});}catch{}}
      a.payload.extractions=[...a.payload.extractions.slice(-9),{id:uuid(),documentId:docId,at:now().toISOString(),candidates,notice:'Sugestões não aplicadas. Confira o documento e confirme cada resposta no questionário.'}];
      await save(db,a.row,a.payload);await event(db,a.row,auth,'extraction_suggested',{message:'Sugestões de leitura disponíveis para conferência.'});return view(db,await access(db,auth,id),auth);
    });
  }
  async function runJobs(fetchImpl=globalThis.fetch) {
    if(!(await configuration()).ready)return;
    // One durable lease per job; no credentials or medical documents go to DataJud.
    const pool=db();const jobs=(await pool.query(`UPDATE audita_ir_jobs SET lease_until=NOW()+INTERVAL '2 minutes' WHERE id IN (SELECT id FROM audita_ir_jobs WHERE run_at<=NOW() AND (lease_until IS NULL OR lease_until<NOW()) ORDER BY run_at LIMIT 5 FOR UPDATE SKIP LOCKED) RETURNING *`)).rows;
    for(const job of jobs) {
      try {
        const row=(await pool.query('SELECT * FROM audita_ir_cases WHERE id=$1',[job.case_id])).rows[0];if(!row)continue;
        const protocol=decrypt('case',row).protocols.find(p=>p.id===job.protocol_id);if(!protocol)continue;
        let data={movements:[],state:'closed'};
        if(row.status!=='closed')data=await queryDatajud(protocol,env.DATAJUD_API_KEY,fetchImpl);
        await transaction(async db=>{const c=(await db.query('SELECT * FROM audita_ir_cases WHERE id=$1 FOR UPDATE',[job.case_id])).rows[0],p=decrypt('case',c),item=p.protocols.find(p=>p.id===job.protocol_id);
          item.monitoring={state:data.state,lastCheckedAt:now().toISOString(),source:'DataJud / CNJ',message:data.state==='not_found'?'Processo não localizado na base pública. Consulte o tribunal.':data.state==='closed'?'Acompanhamento pausado: caso encerrado.':'Consulta concluída. Não substitui intimações oficiais.'};
          for(const move of data.movements){const digest=crypto.createHash('sha256').update(JSON.stringify(move)).digest('hex');await event(db,c,null,'court_movement',{message:safe(move.nome)||'Movimentação processual',date:move.dataHora,source:'DataJud / CNJ'},false,`datajud:${job.protocol_id}:${digest}`);}
          await save(db,c,p);await db.query("UPDATE audita_ir_jobs SET attempts=0,last_error=NULL,lease_until=NULL,run_at=NOW()+INTERVAL '1 day',updated_at=NOW() WHERE id=$1",[job.id]);
        });
      }catch(e){const code=e instanceof IrError?e.code:'datajud_unavailable';await transaction(async db=>{
        const c=(await db.query('SELECT * FROM audita_ir_cases WHERE id=$1 FOR UPDATE',[job.case_id])).rows[0];if(c){const p=decrypt('case',c),item=p.protocols.find(p=>p.id===job.protocol_id);if(item){item.monitoring={state:'error',lastCheckedAt:now().toISOString(),source:'DataJud / CNJ',message:code==='datajud_not_configured'?'Consulta automática aguardando configuração.':'Consulta indisponível; a equipe deve conferir no tribunal.'};await save(db,c,p);}}
        await db.query("UPDATE audita_ir_jobs SET attempts=CASE WHEN attempts>=2 THEN 0 ELSE attempts+1 END,last_error=$2,lease_until=NULL,run_at=NOW()+CASE WHEN attempts>=2 THEN INTERVAL '1 day' ELSE INTERVAL '15 minutes' END,updated_at=NOW() WHERE id=$1",[job.id,code]);
      });}
    }
  }
  return {configuration,list,create,get,command,upload,download,publishProposal,acceptProposal,createCheckout,paymentEvent,staffList,grantStaff,generate,extract,runJobs};
}
export const DATAJUD_TRIBUNALS=['trf1','trf2','trf3','trf4','trf5','trf6','tjac','tjal','tjam','tjap','tjba','tjce','tjdft','tjes','tjgo','tjma','tjmg','tjms','tjmt','tjpa','tjpb','tjpe','tjpi','tjpr','tjrj','tjrn','tjro','tjrr','tjrs','tjsc','tjse','tjsp','tjto'];
export async function queryDatajud(protocol,apiKey,fetchImpl=globalThis.fetch) {
  requireIr(apiKey,'datajud_not_configured','DataJud não configurado.',503);
  requireIr(DATAJUD_TRIBUNALS.includes(protocol.tribunal)&&/^\d{20}$/.test(protocol.number),'invalid_process','Processo inválido.');
  const response=await fetchImpl(`https://api-publica.datajud.cnj.jus.br/api_publica_${protocol.tribunal}/_search`,{method:'POST',headers:{'content-type':'application/json',authorization:`APIKey ${apiKey}`},body:JSON.stringify({size:10,query:{match:{numeroProcesso:protocol.number}}}),signal:AbortSignal.timeout(20000)});
  requireIr(response.ok,'datajud_unavailable','DataJud indisponível.',503);const result=await response.json();
  requireIr(Array.isArray(result.hits?.hits),'datajud_invalid_response','Resposta DataJud inválida.',503);
  const hits=result.hits.hits.filter(h=>String(h._source?.numeroProcesso).replace(/\D/g,'')===protocol.number);
  return {state:hits.length?'ok':'not_found',movements:hits.flatMap(h=>h._source.movimentos||[]).map(m=>({codigo:m.codigo,nome:safeMovement(m.nome),dataHora:m.dataHora,complementosTabelados:m.complementosTabelados||[]})).slice(0,1000)};
}
function safeMovement(value){return String(value||'').slice(0,1000);}
