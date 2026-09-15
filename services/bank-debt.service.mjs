import {analyzeStatements,debtPlan} from './bank-debt-analysis.mjs';
import {estimateDebt,estimateText} from './bank-debt-estimate.mjs';
import {randomUUID} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {DEBT_VERSION,DEBT_TERMS,DEBT_QUESTIONS,debtDetails,debtClaimant,debtReview,debtParse,debtRequire,debtLegalTexts,debtTriageStatus} from './bank-debt-domain.mjs';
import {debtHash,debtDocuments,debtPdf} from './bank-debt-pdf.mjs';
import {createLawyerQueueService} from './lawyer-queue.service.mjs';

export function createBankDebtService({getDb,checkout,rateProvider,extractor,now=()=>new Date()}) {
  function db(){const d=getDb();debtRequire(d.pool&&d.dbReady,'Seu atendimento está temporariamente indisponível. Tente novamente.',503);return d.pool;}
  const analyzing=new Set();
  const operator=auth=>auth?.user?.role==='super_admin';
  function signed(auth){debtRequire(auth?.user?.id&&auth.tenantId,'Entre na sua conta para salvar e continuar.',401);}
  async function tx(fn){const c=await db().connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
  async function access(c,auth,id,lock=false){signed(auth);debtRequire(/^[0-9a-f-]{36}$/i.test(id),'Atendimento não encontrado.',404);const r=(await c.query(`SELECT * FROM audita_debt_cases WHERE id=$1${lock?' FOR UPDATE':''}`,[id])).rows[0];debtRequire(r&&(operator(auth)||(String(r.tenant_id)===String(auth.tenantId)&&String(r.user_id)===String(auth.user.id))),'Atendimento não encontrado.',404);r.status=debtTriageStatus(r.status,r.payload.answers);return r;}
  const owner=(r,auth)=>debtRequire(String(r.user_id)===String(auth.user.id)&&String(r.tenant_id)===String(auth.tenantId),'Somente o solicitante pode confirmar esta etapa.',403);
  async function save(c,r,auth,kind){await c.query('UPDATE audita_debt_cases SET payload=$2,status=$3,revision=revision+1,updated_at=NOW() WHERE id=$1',[r.id,r.payload,r.status]);await c.query('INSERT INTO audita_debt_events(id,case_id,actor_id,kind) VALUES($1,$2,$3,$4)',[randomUUID(),r.id,auth?.user?.id||null,kind]);r.revision++;}
  async function view(c,r,auth){const documents=(await c.query('SELECT id,kind,name,mime,sha256,octet_length(bytes) AS size FROM audita_debt_documents WHERE case_id=$1 ORDER BY created_at',[r.id])).rows;let job=null;if(r.payload.jobId)job=(await c.query('SELECT id,status,protocol_number,filed_at FROM audita_lawyer_jobs WHERE id=$1',[r.payload.jobId])).rows[0];const {checkout:paymentSession,...payload}=r.payload;return {id:r.id,revision:r.revision,status:r.status,...payload,documents,job,estimateText:payload.estimate?estimateText(payload.estimate):null,operator:operator(auth),owner:String(r.user_id)===String(auth.user.id)&&String(r.tenant_id)===String(auth.tenantId),terms:DEBT_TERMS,version:DEBT_VERSION,legalTexts:payload.claimant&&payload.review?debtLegalTexts(payload):null};}
  async function list(auth){signed(auth);return (await db().query(`SELECT id,status,updated_at,payload->'answers' AS answers,payload->'details'->>'creditor' AS creditor FROM audita_debt_cases ${operator(auth)?'':'WHERE tenant_id=$1 AND user_id=$2'} ORDER BY updated_at DESC LIMIT 100`,operator(auth)?[]:[auth.tenantId,auth.user.id])).rows.map(({answers,...r})=>({...r,status:debtTriageStatus(r.status,answers)}));}
  async function create(auth){signed(auth);const r=(await db().query('INSERT INTO audita_debt_cases(id,tenant_id,user_id,payload) VALUES($1,$2,$3,$4) RETURNING *',[randomUUID(),auth.tenantId,auth.user.id,{answers:{}}])).rows[0];return view(db(),r,auth);}
  async function get(auth,id){return view(db(),await access(db(),auth,id),auth);}
  async function startAnalysis(auth,id,input){
    const snapshot=await tx(async c=>{const r=await access(c,auth,id,true);owner(r,auth);
      debtRequire(input.consent===true,'Autorize a leitura dos documentos.');
      debtRequire(['triage','details','calculation_pending'].includes(r.status)&&r.revision===input.revision,'Atualize antes de analisar.',409);
      debtRequire(!analyzing.has(id)&&(!r.payload.analysisPending||Date.now()-Date.parse(r.payload.analysisPending)>15*60*1000),'A leitura já está em andamento.',409);
      r.payload.analysisPending=new Date().toISOString();r.payload.analysisError=null;await save(c,r,auth,'analysis_started');return view(c,r,auth);});
    // Trabalho externo fora da transação; revisão otimista impede publicar sobre arquivos alterados.
    void command(auth,id,{...input,revision:snapshot.revision}).catch(async()=>{
      try{await tx(async c=>{const r=await access(c,auth,id,true);if(r.payload.analysisPending===snapshot.analysisPending){r.payload.analysisPending=null;r.payload.analysisError='Não foi possível concluir a leitura. Tente novamente ou envie arquivos menores.';await save(c,r,auth,'analysis_failed');}});}catch{}
    });
    return snapshot;
  }
  async function command(auth,id,input,requestInfo={}){
    let estimate,analysis;
    if(input.action==='analyze'){
      const snapshot=await access(db(),auth,id);owner(snapshot,auth);
      debtRequire(['triage','details','calculation_pending'].includes(snapshot.status)&&snapshot.revision===input.revision,'Atualize antes de analisar.',409);
      debtRequire(input.consent===true,'Autorize a leitura dos documentos.');
      debtRequire(extractor,'Leitura por IA indisponível.',503);
      const docs=(await db().query("SELECT id,mime,bytes,sha256 FROM audita_debt_documents WHERE case_id=$1 AND kind='evidence' ORDER BY created_at",[id])).rows;
      debtRequire(docs.length,'Envie seus extratos primeiro.');
      debtRequire(!analyzing.has(id),'A análise deste atendimento já está em andamento.',409);analyzing.add(id);try{const parsed=[];for(const doc of docs)parsed.push({id:doc.id,data:await extractor({...doc,bytes:Buffer.from(doc.bytes)},auth)});analysis=await analyzeStatements(parsed,{rateProvider});}finally{analyzing.delete(id);}
      analysis.documentHashes=docs.map(d=>({id:d.id,sha256:d.sha256}));
    }
    if(input.action==='estimate'){
      const snapshot=await access(db(),auth,id);owner(snapshot,auth);
      debtRequire(snapshot.status==='calculation_pending'&&snapshot.revision===input.revision,'Atualize a análise antes de simular.',409);
      estimate=await estimateDebt(snapshot.payload.details,input.scenario,{rateProvider,now});
    }
    return tx(async c=>{
    const r=await access(c,auth,id,true),p=r.payload;
    debtRequire(r.revision===input.revision,'Este atendimento foi atualizado. Atualize a tela antes de continuar.',409);
    const action=input.action;
    if(action==='analyze'){
      owner(r,auth);p.analysisPending=null;p.analysisError=null;p.analysis=analysis;p.review=null;p.docOffer=null;p.estimate=null;p.documentConsent={at:now().toISOString()};r.status='calculation_pending';
      if(analysis.range){const range=analysis.range,plan=debtPlan(range.chargedCents-range.maxCents);p.docOffer={id:randomUUID(),priceCents:plan.price.cents,planName:plan.name,range};r.status='offer';}
    }else if(action==='judicial'){
      owner(r,auth);debtRequire(p.paid,'Confirme a contratação antes de solicitar o advogado.',409);p.judicialRequested=true;
    }else if(action==='answer'){
      owner(r,auth);debtRequire(['triage','not_eligible'].includes(r.status),'A triagem já foi concluída.',409);
      const q=DEBT_QUESTIONS.find(x=>p.answers[x.key]===undefined);debtRequire(q&&q.key===input.key&&typeof input.value==='boolean','Responda à pergunta atual.');
      p.answers[q.key]=input.value;r.status=!input.value?'not_eligible':DEBT_QUESTIONS.every(x=>p.answers[x.key]===true)?'details':'triage';
    }else if(action==='details'){
      debtRequire(operator(auth)||String(r.user_id)===String(auth.user.id),'Acesso restrito.',403);debtRequire(['details','calculation_pending','offer','paid'].includes(r.status),'Não é possível alterar a dívida nesta etapa.',409);
      const details=debtParse(debtDetails,input.details);if(details.offeredCents===undefined&&p.details?.offeredCents!==undefined)details.offeredCents=p.details.offeredCents;p.details=details;p.review=null;if(!p.paid){p.estimate=null;p.docOffer=null;p.analysis=null;r.status='calculation_pending';}
    }else if(action==='estimate'){
      owner(r,auth);debtRequire(r.status==='calculation_pending','A revisão já foi publicada.',409);p.estimate=estimate;
    }else if(action==='review'){
      debtRequire(operator(auth),'Acesso restrito à equipe responsável.',403);debtRequire(['calculation_pending','offer','paid'].includes(r.status),'O caso não está disponível para revisão.',409);
      const review=debtParse(debtReview,input.review);if(p.paid)review.priceCents=p.paid.amountCents;debtRequire(p.details,'Confira os dados da dívida antes da revisão.');debtRequire(review.reviewedCents<p.details.chargedCents,'O cálculo precisa indicar uma diferença positiva para esta contratação.');
      const lawyer=(await c.query("SELECT id,name FROM audita_users WHERE id=$1 AND role='lawyer' AND status='active'",[review.lawyerUserId])).rows[0];
      debtRequire(lawyer,'Selecione um advogado ativo e autorizado na Audita.');review.lawyerName=lawyer.name;
      const evidence=await c.query("SELECT id FROM audita_debt_documents WHERE case_id=$1 AND kind='evidence'",[id]);debtRequire(evidence.rows.length,'Anexe a documentação da cobrança antes de publicar a análise.');
      debtRequire(p.details,'Confira os dados extraídos antes da revisão.');p.review={...review,id:randomUUID(),by:auth.user.id,at:now().toISOString(),version:DEBT_VERSION};r.status=p.paid?'paid':'offer';
    }else if(action==='claimant'){
      owner(r,auth);debtRequire(r.status==='paid'||r.status==='signature','O pagamento precisa estar confirmado.',409);debtRequire(input.conciliation===true,'Confirme o interesse na tentativa de conciliação.');
      p.claimant=debtParse(debtClaimant,input.claimant);p.conciliation=true;p.acceptance=null;r.status='signature';
    }else if(action==='sign'){
      owner(r,auth);debtRequire(r.status==='signature'&&p.paid&&p.claimant&&p.review,'Conclua o cadastro após a confirmação do pagamento.',409);
      const expected=debtHash(JSON.stringify(debtLegalTexts(p)));
      debtRequire(input.accepted===true&&input.version===DEBT_VERSION&&input.termsHash===expected,'Leia e confirme a versão atual da procuração e do contrato.');
      debtRequire(String(input.name||'').trim().normalize('NFC').toLocaleLowerCase('pt-BR')===p.claimant.fullName.toLocaleLowerCase('pt-BR'),'Digite seu nome completo conforme o cadastro.');
      p.acceptance={id:randomUUID(),name:p.claimant.fullName,at:now().toISOString(),version:DEBT_VERSION,termsHash:expected,ip:String(requestInfo.ip||'').slice(0,100),userAgent:String(requestInfo.userAgent||'').slice(0,500),userId:auth.user.id,accepted:true};
    }else if(action==='submit'){
      owner(r,auth);if(r.status==='submitted')return view(c,r,auth);
      debtRequire(r.status==='signature'&&p.paid&&p.acceptance,'Confirme o pagamento e assine os documentos antes de enviar.',409);
      const sources=(await c.query('SELECT * FROM audita_debt_documents WHERE case_id=$1',[id])).rows;
      debtRequire(['identity','address','evidence'].every(kind=>sources.some(d=>d.kind===kind)),'Anexe identificação, comprovante de residência e documentos da cobrança.');
      const documents=await debtDocuments(p,id);
      const bundle=await PDFDocument.load(documents.report);
      for(const source of sources){
        if(source.mime==='application/pdf'){const doc=await PDFDocument.load(source.bytes);for(const page of await bundle.copyPages(doc,doc.getPageIndices()))bundle.addPage(page);}
        else {const image=source.mime==='image/png'?await bundle.embedPng(source.bytes):await bundle.embedJpg(source.bytes);const size=image.scaleToFit(505,752),page=bundle.addPage([595,842]);page.drawImage(image,{x:45,y:842-45-size.height,width:size.width,height:size.height});}
      }
      documents.report=Buffer.from(await bundle.save());
      const queue=createLawyerQueueService({getDb:()=>({pool:c,dbReady:true})});
      const job=await queue.submit({...auth.user,tenant_id:r.tenant_id},{key:`bank-debt:${id}`,claimant:{...p.claimant,lawyerUserId:p.review.lawyerUserId,module:'bank_debt',moduleLabel:'Dívidas Bancárias Abusivas'},acceptance:p.acceptance,documents,sources:sources.map(d=>({name:d.name,type:d.mime,base64:Buffer.from(d.bytes).toString('base64')}))});
      p.jobId=job.id;r.status='submitted';
    }else debtRequire(false,'Ação inválida.',400);
    await save(c,r,auth,action);return view(c,r,auth);
  });}
  function pInvalidate(r){r.payload.analysis=null;r.payload.docOffer=null;r.payload.estimate=null;r.payload.review=null;}
  async function upload(auth,id,{bytes,name,kind}){return tx(async c=>{
    const r=await access(c,auth,id,true);owner(r,auth);debtRequire(['triage','details','calculation_pending','paid','signature'].includes(r.status),'Anexos não podem ser alterados nesta etapa.',409);
    debtRequire(['identity','address','evidence'].includes(kind),'Tipo de documento inválido.');
    if(['triage','details','calculation_pending'].includes(r.status))debtRequire(kind==='evidence','Envie agora os documentos da dívida.');
    debtRequire(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=10*1024*1024,'Envie um arquivo de até 10 MB.');
    let mime='';if(bytes.subarray(0,5).toString()==='%PDF-'){try{await PDFDocument.load(bytes);mime='application/pdf';}catch{debtRequire(false,'PDF inválido ou protegido.');}}
    else if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';
    else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)mime='image/jpeg';
    debtRequire(mime,'Use PDF, PNG ou JPG.');
    if(mime!=='application/pdf'){try{const doc=await PDFDocument.create();const img=mime==='image/png'?await doc.embedPng(bytes):await doc.embedJpg(bytes);debtRequire(img.width*img.height<=40000000,'Imagem excede 40 megapixels.');}catch(e){debtRequire(false,e.status?e.message:'Imagem inválida.');}}
    const count=(await c.query('SELECT count(*)::int AS total,coalesce(sum(octet_length(bytes)),0)::bigint AS size FROM audita_debt_documents WHERE case_id=$1',[id])).rows[0];
    debtRequire(count.total<15&&Number(count.size)+bytes.length<=40*1024*1024,'Limite de 15 documentos ou 40 MB por atendimento.');
    const filename=String(name||'documento').replace(/[\x00-\x1f/\\]/g,'_').slice(0,160);
    await c.query('INSERT INTO audita_debt_documents(id,case_id,kind,name,mime,bytes,sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),id,kind,filename,mime,bytes,debtHash(bytes)]);
    if(['triage','details','calculation_pending'].includes(r.status)){pInvalidate(r);r.status='calculation_pending';}await save(c,r,auth,'document_uploaded');return view(c,r,auth);
  });}
  async function createCheckout(auth,id,input){return tx(async c=>{
    const r=await access(c,auth,id,true),p=r.payload;owner(r,auth);
    debtRequire(['offer','payment_pending'].includes(r.status)&&(p.review||p.docOffer),'O cálculo Audita precisa ser validado antes da contratação.',409);
    debtRequire(input.accepted===true&&input.reviewId===(p.review||p.docOffer).id,'Confirme a análise e as condições atuais.');
    debtRequire(!p.paymentProcessing,'Seu pagamento está em processamento. Aguarde a confirmação antes de tentar novamente.',409);
    if(p.checkout?.url&&p.checkout.expiresAt*1000>now().getTime())return p.checkout;
    p.attempt=(p.attempt||0)+1;
    const session=await checkout(auth,{caseId:id,reviewId:(p.review||p.docOffer).id,amountCents:(p.review||p.docOffer).priceCents,attempt:p.attempt});
    debtRequire(session.id&&/^https:\/\//.test(session.url),'Não foi possível abrir o pagamento.',503);
    p.checkout=session;p.purchaseAcceptance={version:DEBT_VERSION,at:now().toISOString(),reviewId:(p.review||p.docOffer).id,terms:DEBT_TERMS};r.status='payment_pending';await save(c,r,auth,'checkout_created');return session;
  });}
  async function paymentEvent(event){
    const o=event?.data?.object,m=o?.metadata;
    if(!m?.debt_case_id||!['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.expired','checkout.session.async_payment_failed'].includes(event.type))return {ignored:true};
    return tx(async c=>{
      const r=(await c.query('SELECT * FROM audita_debt_cases WHERE id=$1 FOR UPDATE',[m.debt_case_id])).rows[0];debtRequire(r,'Atendimento de pagamento não encontrado.',404);const p=r.payload;
      if((await c.query('SELECT id FROM audita_debt_events WHERE id=$1',[event.id])).rows.length)return {duplicate:true};
      debtRequire(String(m.audita_user_id)===String(r.user_id)&&String(m.audita_tenant_id)===String(r.tenant_id)&&m.debt_review_id===(p.review||p.docOffer)?.id&&o.id===p.checkout?.id,'Pagamento não corresponde ao atendimento.',409);
      if(!p.paid){
        if(['checkout.session.expired','checkout.session.async_payment_failed'].includes(event.type)){r.status='offer';p.checkout=null;p.paymentProcessing=false;}
        else if(o.payment_status==='paid'){
          debtRequire(o.currency==='brl'&&o.amount_total===(p.review||p.docOffer).priceCents,'Valor do pagamento divergente.',409);
          p.paid={sessionId:o.id,eventId:event.id,amountCents:o.amount_total,at:now().toISOString()};p.paymentProcessing=false;r.status='paid';
        }else if(event.type==='checkout.session.completed')p.paymentProcessing=true;
      }
      await c.query('INSERT INTO audita_debt_events(id,case_id,kind) VALUES($1,$2,$3)',[event.id,r.id,event.type]);
      await c.query('UPDATE audita_debt_cases SET payload=$2,status=$3,revision=revision+1,updated_at=NOW() WHERE id=$1',[r.id,p,r.status]);return {received:true};
    });
  }
  async function download(auth,id,name){const c=db(),r=await access(c,auth,id);if(name==='negotiation'){
      debtRequire(r.payload.paid,'Confirme a contratação para baixar o documento.',403);
      const a=r.payload.analysis,review=r.payload.review,range=r.payload.docOffer?.range;
      debtRequire(a||review,'Análise não disponível.',409);
      const content=[`Atendimento ${id}. Banco: ${a?.bank||r.payload.details?.creditor}.`,
        range?`Estimativa na data ${range.asOf}: entre R$ ${(range.minCents/100).toFixed(2)} e R$ ${(range.maxCents/100).toFixed(2)}. Cobrança documentada: R$ ${(range.chargedCents/100).toFixed(2)}.`:review.methodology,
        'Solicito o contrato, a memória de evolução da dívida e a revisão dos encargos indicados, para discutir uma composição. A proposta depende da conferência documental e não representa reconhecimento do saldo cobrado.',
        ...(a?.assumptions||[]),...(a?.rates||[]).map(rate=>`Referência SGS ${rate.code}, ${rate.month}: ${rate.monthlyPercent}% a.m. ${rate.url}`),
        'PASSO A PASSO: 1. Confirme o canal oficial de cobrança junto ao banco. 2. Envie este relatório e solicite o demonstrativo completo. 3. Solicite resposta e contraproposta por escrito. 4. Guarde o protocolo e as mensagens. 5. Confira beneficiário, valor, parcelas e quitação no acordo antes de pagar. 6. Se não resolver, solicite o advogado na Audita. Nenhum contato, acordo ou protocolo judicial é realizado automaticamente.'];
      return {bytes:await debtPdf('Relatório para negociação extrajudicial',content),mime:'application/pdf',name:'audita-negociacao.pdf'};
    }if(['report','powerOfAttorney','agreement'].includes(name)){debtRequire(r.payload.jobId,'Conclua o envio ao advogado para baixar o conjunto.',409);const column={report:'report_pdf',powerOfAttorney:'power_of_attorney_pdf',agreement:'agreement_pdf'}[name];const row=(await c.query(`SELECT ${column} AS bytes FROM audita_lawyer_jobs WHERE id=$1`,[r.payload.jobId])).rows[0];return {bytes:Buffer.from(row.bytes),mime:'application/pdf',name:`audita-dividas-${name}.pdf`};}const row=(await c.query('SELECT bytes,mime,name FROM audita_debt_documents WHERE id=$1 AND case_id=$2',[name,id])).rows[0];debtRequire(row,'Documento não encontrado.',404);return {...row,bytes:Buffer.from(row.bytes)};}
  return {list,create,get,command,startAnalysis,upload,createCheckout,paymentEvent,download,configuration:async auth=>({authenticated:!!auth?.user,operator:operator(auth),ready:!!getDb().dbReady,version:DEBT_VERSION,
    lawyers:operator(auth)&&getDb().dbReady?(await db().query("SELECT id,name FROM audita_users WHERE role='lawyer' AND status='active' ORDER BY name")).rows:[]})};
}
