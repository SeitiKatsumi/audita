import {randomUUID,createHash} from 'node:crypto';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {requireIr as check,sealIr,openIr,irKey,IrError} from './ir-exemption-domain.mjs';
import {productsSchema,reviewSchema,simulate,loadNcm,NOTICE} from './import-audit-domain.mjs';

export function createImportService({getDb,env=process.env,ai,ncm=loadNcm,now=()=>new Date()}){
 const key=()=>irKey(env.AUDITA_IMPORT_ENCRYPTION_KEY||env.AUDITA_IR_ENCRYPTION_KEY);
 const reviewer=a=>a?.user?.role==='super_admin';
 const signed=a=>check(a?.user?.id&&a.tenantId,'authentication_required','Entre na sua conta.',401);
 const seal=(id,v)=>sealIr(v,key(),'import:'+id),open=(id,v,b=false)=>openIr(v,key(),'import:'+id,b);
 function db(){const d=getDb();check(d.dbReady&&d.pool&&key(),'unavailable','Armazenamento seguro de importação indisponível neste ambiente.',503);return d.pool;}
 async function tx(fn){const c=await db().connect();try{await c.query('BEGIN');const r=await fn(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 async function access(c,a,id,lock=false){
  signed(a);const r=(await c.query('SELECT * FROM audita_import_cases WHERE id=$1'+(lock?' FOR UPDATE':''),[id])).rows[0];
  const owner=r&&String(r.user_id)===String(a.user.id)&&String(r.tenant_id)===String(a.tenantId);
  check(r&&(owner||reviewer(a)),'not_found','Atendimento não encontrado.',404);
  return {r,p:open(id,r.encrypted_payload),owner};
 }
 function event(x,a,label){x.p.events=[...(x.p.events||[]),{at:now().toISOString(),by:String(a.user.id),label}];}
 function invalidate(x){if(x.p.review){x.p.previousReviews=[...(x.p.previousReviews||[]),x.p.review];x.p.review=null;}x.r.status='documents';}
 async function save(c,x){await c.query('UPDATE audita_import_cases SET encrypted_payload=$2,status=$3,revision=revision+1,updated_at=NOW() WHERE id=$1',[x.r.id,seal(x.r.id,x.p),x.r.status]);x.r.revision++;}
 function idle(x){check(!x.p.busy||Date.parse(x.p.busy.until)<=now().getTime(),'busy','Uma leitura está em andamento. Aguarde ou atualize o atendimento.',409);}
 async function documents(c,id,files=false){return (await c.query(`SELECT id,encrypted_payload${files?',encrypted_file':''} FROM audita_import_documents WHERE case_id=$1 ORDER BY created_at,id`,[id])).rows.map(r=>({...open(r.id,r.encrypted_payload),id:r.id,...(files?{buffer:open(r.id+':file',r.encrypted_file,true)}:{})}));}
 async function view(c,x,a){return {id:x.r.id,revision:x.r.revision,status:x.r.status,...x.p,busy:x.p.busy&&Date.parse(x.p.busy.until)>now().getTime()?x.p.busy:null,permissions:{owner:!!x.owner,reviewer:reviewer(a)},documents:await documents(c,x.r.id),notice:NOTICE};}
 async function configuration(a){
  const d=getDb();let schema=false;
  if(d.dbReady&&d.pool)try{const row=(await d.pool.query("SELECT to_regclass('audita_import_cases') AS cases,to_regclass('audita_import_documents') AS documents")).rows[0];schema=!!(row?.cases&&row?.documents);}catch{}
  const storageReady=!!(schema&&key());
  return {storageReady,aiReady:!!ai?.available(),ready:storageReady&&!!ai?.available(),reviewer:reviewer(a),notice:NOTICE};
 }
 async function list(a,queue=false){signed(a);if(queue)check(reviewer(a),'forbidden','Revisão restrita à equipe autorizada.',403);return (await db().query(queue?"SELECT id,status,revision,updated_at FROM audita_import_cases WHERE status='review' ORDER BY updated_at DESC LIMIT 100":'SELECT id,status,revision,updated_at FROM audita_import_cases WHERE tenant_id=$1 AND user_id=$2 ORDER BY updated_at DESC LIMIT 100',queue?[]:[a.tenantId,a.user.id])).rows;}
 async function create(a,i){signed(a);check(i?.consent===true,'consent_required','Confirme a autorização para leitura dos documentos.');check((await configuration(a)).storageReady,'unavailable','Atendimento ainda não configurado neste ambiente.',503);return tx(async c=>{const id=randomUUID(),p={consentAt:now().toISOString(),products:[],confirmed:false,suggestions:null,research:null,review:null,events:[]};await c.query('INSERT INTO audita_import_cases(id,tenant_id,user_id,encrypted_payload) VALUES($1,$2,$3,$4)',[id,a.tenantId,a.user.id,seal(id,p)]);const x=await access(c,a,id);event(x,a,'Atendimento iniciado com autorização para processamento OpenAI.');await save(c,x);return view(c,x,a);});}
 async function get(a,id){return tx(async c=>view(c,await access(c,a,id),a));}
 async function upload(a,id,{buffer,name,type,revision}){
  check(['invoice','packing','technical'].includes(type)&&Buffer.isBuffer(buffer)&&buffer.length>0&&buffer.length<=10*1024*1024,'invalid_file','Envie Invoice, Packing List ou ficha técnica de até 10 MB.');
  const mime=buffer.subarray(0,5).toString()==='%PDF-'?'application/pdf':buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':buffer[0]===255&&buffer[1]===216?'image/jpeg':String(name).toLowerCase().endsWith('.xml')?'application/xml':null;
  check(mime,'invalid_file','Use PDF, PNG, JPEG ou XML.');
  if(mime==='application/xml')check(!/<!DOCTYPE|<!ENTITY/i.test(buffer.toString('utf8')),'invalid_xml','Entidades XML não são permitidas.');
  return tx(async c=>{const x=await access(c,a,id,true);check(x.owner,'forbidden','Somente o solicitante envia documentos.',403);idle(x);check(revision===x.r.revision,'conflict','Atendimento atualizado. Recarregue.',409);
   const hash=createHash('sha256').update(buffer).digest('hex');if((await c.query('SELECT id FROM audita_import_documents WHERE case_id=$1 AND hash=$2',[id,hash])).rows.length)return view(c,x,a);
   const limits=(await c.query('SELECT COUNT(*) AS count,COALESCE(SUM(size),0) AS total FROM audita_import_documents WHERE case_id=$1',[id])).rows[0];check(Number(limits.count)<4&&Number(limits.total)+buffer.length<=20*1024*1024,'file_limit','Limite desta versão: quatro documentos e 20 MB por atendimento.');
   // ponytail: ciphertext in PostgreSQL, capped at 20 MB/case; use private object storage if volume grows.
   const did=randomUUID();await c.query('INSERT INTO audita_import_documents(id,case_id,hash,size,encrypted_payload,encrypted_file) VALUES($1,$2,$3,$4,$5,$6)',[did,id,hash,buffer.length,seal(did,{name:String(name||'documento').slice(0,150),type,mime}),seal(did+':file',buffer)]);
   invalidate(x);x.p.products=[];x.p.confirmed=false;x.p.suggestions=null;x.p.research=null;x.p.busy=null;event(x,a,'Documento recebido; resultados anteriores invalidados.');await save(c,x);return view(c,x,a);
  });
 }
 async function download(a,id,did){return tx(async c=>{await access(c,a,id);const row=(await c.query('SELECT encrypted_payload,encrypted_file FROM audita_import_documents WHERE case_id=$1 AND id=$2',[id,did])).rows[0];check(row,'not_found','Documento não encontrado.',404);return {...open(did,row.encrypted_payload),buffer:open(did+':file',row.encrypted_file,true)};});}
 async function work(a,id,i){
  const token=randomUUID();
  const snapshot=await tx(async c=>{const x=await access(c,a,id,true);check(x.owner,'forbidden','Ação do solicitante.',403);idle(x);check(i.revision===x.r.revision,'conflict','Atendimento atualizado. Recarregue.',409);check(ai.available(),'ai_unavailable','Integração OpenAI indisponível.',503);
   const files=await documents(c,id,true);check(files.length,'documents_required','Envie os documentos.');
   if(i.action==='suggest')check(x.p.confirmed&&x.p.products.length,'confirmation_required','Confira os produtos antes de pesquisar.');
   x.p.busy={token,action:i.action,until:new Date(now().getTime()+15*60*1000).toISOString()};x.p.error=null;event(x,a,i.action==='extract'?'Leitura solicitada.':'Pesquisa fiscal solicitada.');await save(c,x);return {products:x.p.products,files};
  });
  let result,error;
  try{
   if(i.action==='extract'){
    const products=[],warnings=[];
    for(const d of snapshot.files){const r=await ai.extract(d,a);products.push(...r.products.map(p=>({...p,documentId:d.id})));warnings.push(...r.warnings);}
    result={products:productsSchema.parse(products),warnings,confirmed:false,suggestions:null,research:null};
   }else{
    const catalog=await ncm(),proposed=await ai.suggest(snapshot.products,a);
    const items=snapshot.products.map((p,index)=>{const item=proposed.items.find(v=>v.index===index);return {index,missing:item?.missing||['Revisão técnica necessária.'],candidates:(item?.candidates||[]).filter(v=>catalog.rows.has(v.code)).map(v=>({...v,official:catalog.rows.get(v.code)}))};});
    const codes=[...new Set(items.flatMap(v=>v.candidates.map(c=>c.code)))];
    let research=null,researchError=null;
    if(codes.length)try{research=await ai.research(codes,a);}catch{researchError='Pesquisa de benefícios indisponível. Não conclua inexistência de benefício; tente novamente ou consulte as fontes oficiais.';}
    result={suggestions:{items,source:catalog.source,fetchedAt:catalog.fetchedAt,notice:catalog.notice},research,researchError};
   }
  }catch{error='Não foi possível concluir. Documentos e dados anteriores foram preservados. Confira os arquivos/configuração e tente novamente.';}
  return tx(async c=>{const x=await access(c,a,id,true);check(x.p.busy?.token===token,'conflict','Uma operação mais recente substituiu esta leitura.',409);x.p.busy=null;x.p.error=error||null;
   if(result){invalidate(x);Object.assign(x.p,result);x.r.status=i.action==='extract'?'products':'review';}
   event(x,a,error?'Processamento não concluído.':'Processamento concluído; revisão humana necessária.');await save(c,x);return view(c,x,a);
  });
 }
 async function command(a,id,i){
  if(['extract','suggest'].includes(i?.action))return work(a,id,i);
  return tx(async c=>{const x=await access(c,a,id,true);idle(x);check(i?.revision===x.r.revision,'conflict','Atendimento atualizado. Recarregue.',409);
   if(i.action==='products'){
    check(x.owner&&i.confirmed===true,'confirmation_required','Solicitante deve conferir os produtos.',403);
    const products=productsSchema.parse(i.products),files=await documents(c,id);
    check(products.every(p=>files.some(d=>d.id===p.documentId)),'invalid_document','Referência documental inválida.');
    invalidate(x);x.p.products=products;x.p.confirmed=true;x.p.suggestions=null;x.p.research=null;x.r.status='products';event(x,a,'Produtos conferidos; sugestões e revisão anteriores invalidadas.');
   }else if(i.action==='review'){
    check(reviewer(a),'forbidden','Revisão fiscal restrita à equipe autorizada.',403);check(x.p.confirmed&&x.p.suggestions,'analysis_required','Conclua a conferência e a pesquisa antes da revisão.');
    const review=reviewSchema.parse(i.review);
    check(review.rows.length===x.p.products.length&&new Set(review.rows.map(r=>r.index)).size===review.rows.length,'incomplete_review','Revise todos os produtos uma única vez.');
    check(review.rows.every(r=>x.p.suggestions.items.find(s=>s.index===r.index)?.candidates.some(c=>c.code===r.ncm)),'invalid_ncm','Escolha uma NCM candidata conferida na tabela oficial.');
    invalidate(x);x.p.review={...review,by:String(a.user.id),at:now().toISOString(),rows:review.rows.map(r=>({...r,calculation:simulate(r)}))};x.r.status='reviewed';event(x,a,'Revisão humana e premissas de II/IPI registradas.');
   }else throw new IrError('invalid_action','Ação inválida.');
   x.p.error=null;x.p.busy=null;await save(c,x);return view(c,x,a);
  });
 }
 async function report(a,id){
  const x=await get(a,id);check(x.products.length,'products_required','Leia ou confira os produtos antes de gerar o relatório.');
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100);
  const lines=['AUDITA - AUDITORIA ASSISTIDA DE IMPORTAÇÃO',`Referência: ${id} | Revisão ${x.revision}`,x.review?'Premissas revisadas por pessoa; não é decisão da Receita.':'PRELIMINAR - SEM REVISÃO FISCAL',NOTICE,
   ...x.documents.map(d=>`Documento ${d.id}: ${d.name} (${d.type})`),
   ...x.products.flatMap((p,index)=>[`Produto ${index+1}: ${p.description}`,`Original: ${p.original}`,`Quantidade: ${p.quantity||'não informada'} | Valor: ${p.value||'não informado'} ${p.currency||''}`,`Características: ${p.specifications}`,`Documento: ${p.documentId}; página: ${p.page||'não identificada'}`,...(x.suggestions?.items.find(v=>v.index===index)?.candidates||[]).map(c=>`NCM candidata ${c.code}: ${c.official.description}. Motivo sugerido: ${c.reason}`),...(x.suggestions?.items.find(v=>v.index===index)?.missing||[]).map(m=>'Pendente: '+m)]),
   x.suggestions?`Fonte NCM: ${x.suggestions.source} | Consultada: ${x.suggestions.fetchedAt}. ${x.suggestions.notice}`:'NCM não consultada.',
   x.research?.notice||x.researchError||'Benefícios não pesquisados.',x.research?.text||'',...(x.research?.sources||[]).map(s=>`${s.title}: ${s.url}`),
   ...(x.review?[`Revisor: ${x.review.by}, registrado em ${x.review.at}. Data da operação: ${x.review.operationDate}`,x.review.note,...x.review.rows.flatMap(r=>[`Produto ${r.index+1}, NCM ${r.ncm}. Valor aduaneiro: ${money(r.customsValueCents)}; demais parcelas da base IPI: ${money(r.otherIpiBaseCents)}.`,...['reference','proposed'].map(k=>`${k==='reference'?'Referência':'Cenário'}: II ${money(r.calculation[k].iiCents)}; base IPI ${money(r.calculation[k].ipiBaseCents)}; IPI ${money(r.calculation[k].ipiCents)}. Taxas II/IPI: ${k==='reference'?r.iiBps/100:r.scenarioIiBps/100}% / ${k==='reference'?r.ipiBps/100:r.scenarioIpiBps/100}%.`),`Diferença simulada: ${money(r.calculation.differenceCents)}. Fórmulas: II = valor aduaneiro × taxa; IPI = (valor aduaneiro + II + demais parcelas informadas) × taxa.`,r.basis,`Fonte II: ${r.iiSource}`,`Fonte IPI: ${r.ipiSource}`])]:[]),
   'Caracteres não latinos aparecem como ? neste PDF. Consulte a descrição original completa no atendimento e os documentos de origem.',
   'Histórico:',...x.events.map(e=>`${e.at} | usuário ${e.by} | ${e.label}`)];
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);let page=pdf.addPage(),y=790;
  for(const raw of lines){let line='';for(const word of String(raw).replace(/\s/g,' ').replace(/[^\x20-\x7e\xa0-\xff]/gu,'?').split(/\s+/).flatMap(w=>w.match(/.{1,60}/g)||[])){if(font.widthOfTextAtSize(line+' '+word,9)>490){if(y<45){page=pdf.addPage();y=790;}page.drawText(line,{x:45,y,size:9,font});y-=14;line=word;}else line+=(line?' ':'')+word;}if(y<45){page=pdf.addPage();y=790;}page.drawText(line,{x:45,y,size:9,font});y-=20;}
  return {buffer:Buffer.from(await pdf.save()),mime:'application/pdf',name:'auditoria-importacao.pdf'};
 }
 return {configuration,list,create,get,upload,download,command,report};
}
