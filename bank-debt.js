const root=document.querySelector('#dividas-bancarias');
const $=s=>root.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)/100);
const currencyCents=value=>Number(String(value).replace(/\D/g,''));
function maskCurrency(input){const digits=input.value.replace(/\D/g,'');input.value=digits?money(Number(digits)):'';const cents=currencyCents(input.value);input.setCustomValidity(digits&&(cents<Number(input.dataset.minCents)||cents>10000000000)?'Informe um valor entre '+money(input.dataset.minCents)+' e '+money(10000000000)+'.':'');}
const questions=[['open','Você tem alguma dívida bancária em aberto?','Sim, tenho uma dívida em aberto','Não tenho dívida em aberto']];
const statuses={triage:'Triagem',not_eligible:'Fora do foco inicial',details:'Detalhes da dívida',calculation_pending:'Aguardando cálculo',offer:'Contratação disponível',payment_pending:'Pagamento pendente',paid:'Cadastro',signature:'Documentos e assinatura',submitted:'Com o advogado'};
const ufs='AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
let current=null,config=null,busy=false,edit=false,viewDocuments=false,initialized=false,poll,intakeNotice='';
async function api(path,options={}){const res=await fetch('/api/bank-debt'+path,{...options,headers:{...(typeof options.body==='string'?{'content-type':'application/json'}:{}),...options.headers}});const data=await res.json();if(!res.ok)throw Object.assign(new Error(data.message||'Não foi possível continuar.'),{status:res.status});return data;}
const post=(path,body={})=>api(path,{method:'POST',body:JSON.stringify(body)});
function error(message=''){$('#debtError').hidden=!message;$('#debtError').textContent=message;}
async function run(fn){if(busy)return;busy=true;error();root.setAttribute('aria-busy','true');root.querySelectorAll('button').forEach(b=>b.disabled=true);const notice=document.createElement('p');notice.setAttribute('role','status');notice.textContent='Salvando. Aguarde um instante.';$('#debtStage').append(notice);try{await fn();}catch(e){error(e.message);if(e.status===409&&current)await load(current.id).catch(()=>{});}finally{notice.remove();busy=false;root.setAttribute('aria-busy','false');root.querySelectorAll('button').forEach(b=>b.disabled=false);}}
const button=(action,label)=>['back-documents','return-stage'].includes(action)?`<div class="charge-result-actions"><button type="button" class="secondary-action" data-debt="${action}">${label}</button></div>`:`<div class="charge-analysis-actions"><button type="button" data-debt="${action}">${label}</button></div>`;
const field=(name,label,value='',type='text',extra='')=>type==='number'?`<label>${label}<input name="${name}" type="text" inputmode="numeric" data-currency data-min-cents="${Math.round(Number(extra.match(/min="([^"]+)"/)?.[1]||0)*100)}" value="${esc(value===''?'':money(Math.round(Number(value)*100)))}" placeholder="R$ 0,00" required></label>`:`<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" required ${extra}></label>`;
const area=(name,label,value='',extra='')=>`<label>${label}<textarea name="${name}" rows="4" ${extra}>${esc(value)}</textarea></label>`;
const select=(name,label,choices,value)=>`<label>${label}<select name="${name}" required>${choices.map(([v,l])=>`<option value="${v}" ${v===value?'selected':''}>${l}</option>`).join('')}</select></label>`;
const bubble=html=>`<div class="charge-analysis-message assistant"><span class="charge-analysis-avatar" aria-hidden="true"><img src="/assets/audita-profile-assistant.png" alt=""></span><div class="charge-analysis-bubble">${html}</div></div>`;
const form=(id,html,label)=>`<form data-form="${id}" class="debt-form">${html}<div class="charge-analysis-actions"><button type="submit">${label}</button></div></form>`;
function detailsForm(){const d=current.details||{};return form('details',
  field('creditor','Qual banco ou cobrador está pedindo o pagamento?',d.creditor||'','text','maxlength="300"')+
  select('kind','Qual é o tipo de dívida?',[['overdraft','Cheque especial'],['card','Cartão de crédito'],['loan','Empréstimo'],['financing','Financiamento em atraso'],['other','Outra dívida bancária']],d.kind)+
  field('since','Desde quando a dívida está em aberto?',d.since||'','date',`max="${new Date().toISOString().slice(0,10)}"`)+
  field('original','Quanto ficou em aberto originalmente (R$)?',d.originalCents?d.originalCents/100:'','number','min="0.01" max="100000000" step="0.01"')+
  field('charged','Quanto estão cobrando agora (R$)?',d.chargedCents?d.chargedCents/100:'','number','min="0.01" max="100000000" step="0.01"')+
  '<label class="debt-check"><input type="checkbox" name="consent" required> Autorizo a análise destes dados e documentos pela Audita e pela equipe responsável.</label>','Enviar para análise');}

function paymentRow(p={}){return `<div data-payment>${field('paymentDate','Data do pagamento',p.date||'','date')}${field('paymentAmount','Valor pago (R$)',p.amountCents!=null?p.amountCents/100:'','number','min="0.01"')}<div class="charge-analysis-actions"><button type="button" data-debt="remove-payment">Remover pagamento</button></div></div>`;}
function estimateForm(){
 const d=current.details||{},s=current.estimate?.scenario||{},choices={overdraft:[['overdraft','Pessoa física — cheque especial']],loan:[['loan','Pessoa física — crédito pessoal não consignado']],card:[['revolving','Pessoa física — cartão rotativo']],financing:[['vehicle','Pessoa física — aquisição de veículos']]}[d.kind];
 if(!choices)return '<p>A modalidade informada exige revisão manual. Anexe os documentos para a equipe analisar.</p>';
 return '<details '+(current.estimate?'':'open')+'><summary>'+ (current.estimate?'Refazer estimativa':'Estimar com a taxa do Banco Central')+'</summary><p>Confirme a modalidade exata. Contratos de pessoa jurídica, consignados, cartão parcelado e outros financiamentos seguem para análise manual.</p>'+form('estimate',
 select('modality','Modalidade para comparação',choices,s.modality)+field('contractDate','Data da contratação',s.contractDate||'','date')+
 field('baseDate','Data do saldo inicial da simulação',s.baseDate||d.since,'date')+field('base','Saldo em aberto nessa data (R$)',s.baseCents!=null?s.baseCents/100:d.originalCents/100,'number','min="0.01"')+
 field('asOf','Data da cobrança atual informada',s.asOf||'','date')+
 '<label>Taxa de juros do contrato (% ao mês, opcional — não informe o CET)<input name="contractRate" type="number" inputmode="decimal" step="0.0001" min="0" max="100" value="'+esc(s.contractMonthlyRate??'')+'"></label>'+
 select('capitalization','Premissa de juros para esta simulação',[['compound','Compostos — equivalência diária'],['simple','Simples — sobre principal remanescente']],s.capitalization||'compound')+
 '<p class="debt-note">Usaremos dias corridos/30. A equipe confirmará essa premissa no contrato; não é uma conclusão sobre a capitalização permitida.</p><p>Pagamentos entre a data inicial e a cobrança (se não houve, deixe sem pagamentos).</p><div data-payments>'+ (s.payments||[]).map(paymentRow).join('')+'</div>'+button('add-payment','Adicionar pagamento')+
 '<label class="debt-check"><input type="checkbox" name="confirmed" required> Confirmo a modalidade, as datas, todos os pagamentos e que não houve novos saques ou compras neste período. Entendo que esta é uma estimativa sem acrescentar multa, mora, tarifas, seguros, IOF ou correção monetária.</label>','Calcular estimativa')+'</details>';
}
function estimateResult(){const e=current.estimate;if(!e)return '';const rate=v=>Number(v).toLocaleString('pt-BR',{maximumFractionDigits:4});return `<section class="debt-result"><p>ESTIMATIVA PRELIMINAR · AGUARDA VALIDAÇÃO</p><h3>Saldo estimado pela referência BACEN</h3><strong>${money(e.revised.balanceCents)}</strong><p>Diferença estimada para análise: <b>${money(e.differenceCents)}</b></p><p>Taxa BACEN: ${rate(e.rate.monthlyPercent)}% ao mês · ${e.rate.month} · SGS ${e.rate.code}.</p>${e.rateDifferencePoints!==null?`<p>Taxa contratada informada: ${rate(e.scenario.contractMonthlyRate)}% ao mês. Diferença: ${rate(e.rateDifferencePoints)} pontos percentuais.</p>`:'<p>Taxa contratada não informada; não foi feita comparação entre taxas.</p>'}${e.differenceCents===0?'<p>Este cenário não identificou diferença positiva frente à cobrança informada.</p>':''}<p>O resultado não comprova abusividade nem garante redução. A equipe precisa revisar antes de liberar a contratação.</p><details><summary>Ver premissas e memória de cálculo</summary><p class="debt-pre">${esc(current.estimateText)}</p><a href="${esc(e.rate.url)}" target="_blank" rel="noopener">Consultar dado oficial do Banco Central</a></details></section>`;}

function documentList(){const docs=current?.documents||[];if(!docs.length)return '';const seen=new Set();return '<details class="debt-documents"><summary>Ver arquivos enviados</summary><ul>'+docs.filter(d=>{const key=d.kind+':'+(d.sha256||d.id);if(seen.has(key))return false;seen.add(key);return true;}).map(d=>'<li><a href="/api/bank-debt/cases/'+current.id+'/documents/'+d.id+'">'+esc(d.name)+'</a></li>').join('')+'</ul></details>';}
function uploads(){return documentList()+(current.owner&&['paid','signature'].includes(current.status)?form('upload',select('kind','Que documento você vai enviar?',[['identity','Documento de identificação'],['address','Comprovante de residência'],['evidence','Extrato, contrato ou notificação de cobrança']])+fileInput('file',true,'Documento em PDF, PNG ou JPG'),'Anexar documento'):'');}
function fileInput(name,required,label='Extratos em PDF, PNG ou JPG'){return '<label>'+label+'<input type="file" name="'+name+'" multiple '+(required?'required':'')+' accept="application/pdf,image/png,image/jpeg"></label><small>Você pode selecionar vários arquivos. Até 10 MB por arquivo e 40 MB no total.</small>';}
function analysisConsent(){return current?.documentConsent?'':'<p class="debt-note">Ao solicitar a análise, você autoriza a leitura dos documentos pela IA e pela equipe Audita.</p>';}
function analysisProgress(){
 const p=current?.analysisProgress||{},percent=Math.max(0,Math.min(99,Number(p.percent)||0));
 const label=p.stage==='calculating'?'Conferindo saldos e preparando o resultado':p.stage==='checking'?'Conferindo a leitura dos valores':p.total?`${p.completed} de ${p.total} páginas lidas`:'Preparando a leitura dos seus arquivos';
 return `<div class="debt-analysis-progress"><div class="debt-progress-label" role="status"><span>${esc(label)}</span><strong>${percent}%</strong></div><progress max="100" value="${percent}" aria-label="Progresso da análise" aria-valuetext="${percent}% — ${esc(label)}"></progress>${p.total&&p.stage!=='reading'?`<small>${p.completed} de ${p.total} páginas lidas</small>`:''}<small>A leitura das páginas representa até 90%. Depois conferimos os valores para concluir.</small></div>`;
}
function documentIntake(){
 const pending=current?.analysisPending,hasFiles=!!current?.documents?.length,analyzed=!!current?.analysis&&!current?.analysisError;
 if(pending){const slow=Date.now()-Date.parse(pending)>15*60*1000;return bubble('<div class="charge-analysis-loader debt-analysis-loader" aria-hidden="true"></div><h2>Seus extratos estão em análise</h2>'+analysisProgress()+'<p>Estou conferindo os lançamentos, os juros e a evolução do saldo devedor. Essa leitura pode levar alguns minutos.</p><p>Não precisa enviar os mesmos arquivos novamente. Você pode sair desta tela e voltar: o andamento ficará salvo aqui.</p>'+documentList()+(slow?'<p>A leitura está levando mais tempo que o esperado. Consulte o andamento. Se ela tiver sido interrompida, tente novamente com os arquivos já enviados.</p>'+button('refresh','Consultar andamento')+(current.owner?form('retry-analysis',analysisConsent(),'Tentar novamente'):''):'') );}
 const title='Envie seus extratos bancários';
 const explanation='';
 const request='<p><strong>Anexe abaixo os extratos bancários desde o início do saldo devedor até a presente data.</strong></p><p>Com base no extrato, vou fazer a perícia dos juros abusivos e débitos cobrados indevidamente, gerar o <strong>Relatório Técnico de Auditoria Financeira, Indébito e Perdas e Danos</strong> e demonstrar a evolução real da dívida.</p>';
 const label=analyzed?'Enviar complemento e atualizar análise':hasFiles?'Analisar extratos enviados':'Enviar extratos e analisar';
 return bubble((intakeNotice?'<p role="alert">'+esc(intakeNotice)+'</p>':'')+'<h2>'+title+'</h2>'+explanation+request+(current?.analysisError?'<p role="alert">Não foi possível concluir a leitura. Seus arquivos estão salvos. Tente analisar novamente.</p>':'')+(hasFiles?'<p class="debt-note">Os arquivos enviados já estão salvos. Não é necessário anexá-los outra vez.</p>':'')+(current&&!current.owner?'':form('documents',fileInput('files',current?.status==='offer'||!hasFiles)+analysisConsent(),label))+documentList()+analysisResult()+ (current?reviewer():''));
}
function summary(){const d=current.details;return d?`<dl class="debt-summary"><div><dt>Banco / cobrador</dt><dd>${esc(d.creditor)}</dd></div><div><dt>Dívida original informada</dt><dd>${money(d.originalCents)}</dd></div><div><dt>Cobrança atual</dt><dd>${money(d.chargedCents)}</dd></div></dl>`:'';}
function reviewer(){if(current.operator&&!current.details)return '<details><summary>Equipe Audita · conferir dados extraídos</summary>'+detailsForm()+'</details>';if(!current.operator||!['calculation_pending','offer','paid'].includes(current.status))return '';const r=current.review||{};return `<details class="debt-review"><summary>Equipe Audita · publicar análise validada</summary><p>A estimativa BACEN é preliminar. Confira contrato, histórico, encargos e fundamentação antes de publicar a análise validada que libera a contratação.</p>${form('review',field('reviewed','Saldo recalculado (R$)',r.reviewedCents!=null?r.reviewedCents/100:'','number','min="0" step="0.01" max="100000000"')+field('price','Preço do serviço (R$)',r.priceCents?r.priceCents/100:'','number','min="1" step="0.01" max="100000000"')+area('methodology','Memória de cálculo: períodos, taxas, valores e fontes',r.methodology||current.estimateText||'','required minlength="30" maxlength="12000"')+area('legalBasis','Fundamentação jurídica específica revisada',r.legalBasis||'','required minlength="30" maxlength="12000"')+field('creditorLegalName','Razão social do credor',r.creditorLegalName||'')+field('creditorDocument','CNPJ do credor (14 dígitos)',r.creditorDocument||'','text','pattern="[0-9]{14}"')+field('creditorAddress','Endereço do credor',r.creditorAddress||'')+field('lawyerName','Nome do advogado outorgado',r.lawyerName||'')+field('lawyerOab','OAB e UF do advogado',r.lawyerOab||'')+'<label class="debt-check"><input name="confirmed" type="checkbox" required> Confirmei documentos, cálculo, fundamentação e condições do serviço.</label>','Publicar análise e contratação')}</details>`;}
function claimantForm(){const c=current.claimant||{};return form('claimant',field('fullName','Nome completo',c.fullName||'')+field('document','CPF',c.document||'')+field('email','E-mail',c.email||'','email')+field('phone','Telefone',c.phone||'','tel')+field('nationality','Nacionalidade',c.nationality||'Brasileiro(a)')+field('maritalStatus','Estado civil',c.maritalStatus||'')+field('profession','Profissão',c.profession||'')+field('postalCode','CEP',c.postalCode||'','text','pattern="[0-9]{5}-?[0-9]{3}"')+field('street','Rua / avenida',c.street||'')+field('number','Número',c.number||'')+`<label>Complemento (opcional)<input name="complement" value="${esc(c.complement)}" maxlength="200"></label>`+field('neighborhood','Bairro',c.neighborhood||'')+field('city','Cidade',c.city||'')+select('uf','Estado',ufs.map(v=>[v,v]),c.uf||'SP')+'<label class="debt-check"><input type="checkbox" name="conciliation" required> Tenho interesse na tentativa de conciliação com o credor.</label>','Conferir procuração e contrato');}
function render(){
  if(current?.owner&&current.status==='calculation_pending'&&!current.analysisPending&&(current.analysis||current.analysisError||current.manualReview)){
    viewDocuments=true;edit=false;
    intakeNotice='Não foi possível concluir a análise. Seus arquivos estão salvos neste atendimento. Anexe documentos complementares ou tente analisar novamente.';
  }
  const s=current?.status||'triage',step=({triage:0,not_eligible:0,details:0,calculation_pending:1,offer:2,payment_pending:2,paid:3,signature:4,submitted:4})[s];
  $('#debtProgress').innerHTML=['Documentos','Análise','Contratação','Negociação','Advogado'].map((label,i)=>`<li ${i===step?'aria-current="step"':''} class="${i<step?'done':''}"><span>${i<step?'✓':i+1}</span>${label}</li>`).join('');
  let html='';
  if(!current){html=documentIntake();}
  else if(viewDocuments&&['offer','payment_pending','paid','signature'].includes(s)){
    html=button('return-stage','Voltar à etapa anterior');
    if(s==='payment_pending')html+=bubble('<h2>Documentos do atendimento</h2><p>Há um pagamento pendente. Aguarde sua confirmação ou expiração antes de alterar os arquivos usados no cálculo.</p>'+documentList()+button('refresh','Consultar pagamento'));
    else if(['paid','signature'].includes(s))html+=bubble('<h2>Anexar documentos ao atendimento</h2><p>Os arquivos anteriores estão preservados.</p>'+uploads());
    else html+=documentIntake();
  }
  else if(edit){html=bubble('<h2>Confira os dados da dívida</h2><p>Alterações exigem uma nova análise.</p>'+detailsForm()+button('cancel-edit','Cancelar',true));}
  else if(['triage','not_eligible','details','calculation_pending'].includes(s))html=documentIntake();
  else if(['offer','payment_pending'].includes(s)&&current.docOffer&&!current.review){html=documentOffer();}
  else if(['offer','payment_pending'].includes(s)){const r=current.review;html=bubble('<h2>Sua análise está disponível</h2>'+summary()+`<div class="debt-result"><span>Saldo recalculado pela Audita</span><strong>${money(r.reviewedCents)}</strong><p>Diferença em discussão: ${money(current.details.chargedCents-r.reviewedCents)}. Sujeita à avaliação jurídica e à decisão do caso.</p></div><details><summary>Entender o cálculo</summary><p class="debt-pre">${esc(r.methodology)}</p><p class="debt-pre">${esc(r.legalBasis)}</p></details><section class="debt-plan"><span>Seu plano de atendimento</span><h3>${money(r.priceCents)} <small>pagamento único</small></h3><ul><li>Análise e relatório da dívida</li><li>Preparação da petição e procuração</li><li>Assinatura eletrônica</li><li>Encaminhamento e acompanhamento pelo advogado</li></ul><p>${esc(current.terms)}</p>${current.owner?form('checkout',`<label class="debt-check"><input type="checkbox" name="accepted" required> Li a análise e aceito as condições do serviço.</label>`,s==='payment_pending'?'Retomar pagamento':'Contratar e continuar'):''}</section>`+(s==='payment_pending'?'<p>O avanço depende da confirmação do pagamento pela Stripe. Se você já pagou, consulte a atualização.</p>'+button('refresh','Verificar pagamento',true):current.owner?button('edit','Corrigir informações',true):'')+reviewer());}
  else if(s==='paid'&&!current.review)html=negotiationPanel()+bubble(current.judicialRequested?'<h2>Solicitação enviada à equipe</h2><p>O advogado precisa conferir os documentos e o cálculo antes de preparar o processo.</p>'+button('refresh','Consultar andamento'):'<p>Se a negociação não resolver, solicite a avaliação do advogado responsável.</p>'+button('judicial','Não resolvi. Solicitar advogado'))+reviewer();
  else if(s==='paid')html=negotiationPanel()+bubble('<h2>Pagamento confirmado. Vamos preparar seus documentos.</h2><p>Precisamos dos seus dados para a petição e a procuração. O advogado fará o protocolo no tribunal do seu estado.</p>'+claimantForm()+uploads());
  else if(s==='signature'){html=bubble(`<h2>Confira e assine seus documentos</h2><p>Advogado indicado: ${esc(current.review.lawyerName)} · OAB ${esc(current.review.lawyerOab)}.</p><details open><summary>Procuração</summary><p class="debt-pre">${esc(current.legalTexts.powerOfAttorney)}</p></details><details><summary>Contrato do serviço</summary><p class="debt-pre">${esc(current.legalTexts.agreement)}</p></details>`+uploads()+(current.acceptance?`<p class="debt-success">Assinado por ${esc(current.acceptance.name)} em ${new Date(current.acceptance.at).toLocaleString('pt-BR')}.</p>`+button('submit','Concluir e enviar ao advogado'):form('sign',field('name','Digite seu nome completo para assinar',current.claimant.fullName)+'<label class="debt-check"><input name="accepted" type="checkbox" required> Li a procuração e o contrato e confirmo minha assinatura eletrônica.</label>','Assinar digitalmente'))+`<details><summary>Corrigir meus dados</summary><p>Após alterar, será necessário assinar novamente.</p>${claimantForm()}</details>`);}
  else if(s==='submitted')html=bubble(`<p class="debt-eyebrow">SOLICITAÇÃO CONCLUÍDA</p><h2>${current.job?.status==='filed'?'Protocolo registrado pelo advogado':'Tudo pronto para o advogado responsável'}</h2><p>Sua solicitação está completa. O advogado responsável da Audita dará início ao protocolo da sua petição no tribunal da sua região.</p><p>${current.job?.status==='filed'?`Protocolo: <strong>${esc(current.job.protocol_number)}</strong>`:current.job?.status==='claimed'?'O advogado já assumiu seu atendimento.':'Seu atendimento está na fila do advogado.'}</p><div class="charge-analysis-actions">${[['report','Baixar petição completa'],['powerOfAttorney','Baixar procuração'],['agreement','Baixar contrato']].map(([key,label])=>`<a class="secondary-action" href="/api/bank-debt/cases/${current.id}/documents/${key}">${label}</a>`).join('')}</div>${button('refresh','Atualizar acompanhamento',true)}`);
  if(current?.analysisProgress?.stage==='completed'&&!current.analysisPending&&!current.analysisError&&['calculation_pending','offer'].includes(s)&&!edit)html=html.replace(/<h2\b/,'<p class="debt-note" role="status">Leitura concluída · 100%</p><h2');
  if(current?.owner&&!viewDocuments&&['offer','payment_pending','paid','signature'].includes(s))html=button('back-documents','Voltar aos documentos')+html;
  $('#debtStage').innerHTML=html;
  const reviewForm=$('#debtStage form[data-form=review]');if(reviewForm)reviewForm.insertAdjacentHTML('afterbegin',select('lawyerUserId','Advogado responsável cadastrado',(config?.lawyers||[]).map(u=>[String(u.id),esc(u.name)]),String(current.review?.lawyerUserId||'')));
  if(current&&!current.owner)$('#debtStage').querySelectorAll('form:not([data-form="review"]):not([data-form="details"]),[data-debt="submit"],[data-answer]').forEach(e=>e.hidden=true);
  schedulePaymentCheck();
}
function schedulePaymentCheck(){clearTimeout(poll);if((current?.status!=='payment_pending'&&!current?.analysisPending)||document.body.dataset.activePage!=='dividas-bancarias')return;poll=setTimeout(async()=>{try{if(!busy){const id=current.id,fresh=(await api('/cases/'+id)).case;if(current?.id!==id)return;if(fresh.revision!==current.revision||(fresh.analysisPending&&Date.now()-Date.parse(fresh.analysisPending)>15*60*1000&&!$('#debtStage [data-debt=refresh]'))){current=fresh;render();await refreshList();}else if(JSON.stringify(fresh.analysisProgress)!==JSON.stringify(current.analysisProgress)){current=fresh;const progress=$('.debt-analysis-progress');if(progress)progress.outerHTML=analysisProgress();}}}catch{}finally{schedulePaymentCheck();}},current?.analysisPending?3000:10000);}
async function refreshList(){const cases=config?.authenticated&&config.ready?(await api('/cases')).cases:[];$('#debtCases').innerHTML=cases.map(c=>`<button type="button" data-case="${c.id}" class="${c.id===current?.id?'selected':''}"><strong>${esc(c.creditor||'Nova análise')}</strong><small>${c.status==='calculation_pending'&&c.manual_review_requested?(config?.operator?'Revisão solicitada':'Envie novos extratos'):statuses[c.status]} · ${new Date(c.updated_at).toLocaleDateString('pt-BR')}</small></button>`).join('')||'<p>Nenhum atendimento salvo.</p>';if(config?.operator&&cases.some(c=>c.status==='calculation_pending'&&c.manual_review_requested))$('#debtCases').closest('details')?.setAttribute('open','');}
async function load(id){current=(await api('/cases/'+id)).case;edit=false;viewDocuments=false;const url=new URL(location.href);url.searchParams.set('debt_case',id);history.replaceState(null,'',url);render();await refreshList();}
async function command(action,extra={}){current=(await post(`/cases/${current.id}/actions`,{action,revision:current.revision,...extra})).case;edit=false;viewDocuments=false;intakeNotice='';render();await refreshList();$('#debtQuestion')?.focus();}
async function start(){intakeNotice='';if(!config?.authenticated){document.querySelector('#loginButton')?.click();return;}current=(await post('/cases')).case;await load(current.id);}
root.addEventListener('input',e=>{if(e.target.matches('[data-currency]'))maskCurrency(e.target);});
root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.startAnswer!==undefined){run(async()=>{await start();if(current)await command('answer',{key:'open',value:b.dataset.startAnswer==='true'});});return;}
  if(b.dataset.case){run(()=>load(b.dataset.case));return;}
  if(b.dataset.answer){run(()=>command('answer',{key:b.dataset.answer,value:b.dataset.value==='true'}));return;}
  const action=b.dataset.debt;
  if(action==='back-documents'){viewDocuments=true;edit=false;render();$('#debtStage').scrollIntoView?.({block:'start'});return;}
  if(action==='return-stage'){viewDocuments=false;render();$('#debtStage').scrollIntoView?.({block:'start'});return;}
  if(action==='add-payment'){const list=$('[data-payments]');if(list.children.length<120)list.insertAdjacentHTML('beforeend',paymentRow());return;}
  if(action==='remove-payment'){b.closest('[data-payment]').remove();return;}
  if(action==='start'||action==='new')run(start);
  if(action==='refresh'&&current)run(()=>load(current.id));
  if(action==='edit'){edit=true;render();}
  if(action==='cancel-edit'){edit=false;render();}
  if(action==='judicial')run(()=>command('judicial'));
  if(action==='submit')run(()=>command('submit'));
  if(action==='help')error('Envie os extratos desde o início da dívida até o saldo devedor atualizado. A análise começa após o envio. Se os documentos forem insuficientes, você verá um aviso e voltará ao envio inicial. Depois da contratação, você recebe o relatório para negociar e pode solicitar a avaliação do advogado.');
});
root.addEventListener('submit',e=>{const f=e.target;if(!f.dataset.form)return;e.preventDefault();run(async()=>{const d=new FormData(f),v=Object.fromEntries(d),cents=k=>currencyCents(v[k]);
  if(f.dataset.form==='documents'){const files=[...f.querySelector('[name=files]').files];if(!current)await start();if(!current)return;if(files.length)await uploadFiles(files);if(current.status==='offer'){viewDocuments=false;render();return;}await command('analyze',{consent:true});}
  if(f.dataset.form==='retry-analysis')await command('analyze',{consent:true});
  if(f.dataset.form==='estimate')await command('estimate',{scenario:{modality:v.modality,contractDate:v.contractDate,baseDate:v.baseDate,asOf:v.asOf,baseCents:cents('base'),contractMonthlyRate:v.contractRate===''?null:Number(v.contractRate),capitalization:v.capitalization,payments:[...f.querySelectorAll('[data-payment]')].map(row=>({date:row.querySelector('[name=paymentDate]').value,amountCents:currencyCents(row.querySelector('[name=paymentAmount]').value)})),confirmed:d.has('confirmed')}});
  if(f.dataset.form==='details')await command('details',{details:{creditor:v.creditor,kind:v.kind,since:v.since,originalCents:cents('original'),chargedCents:cents('charged'),description:current.details?.description||'',consent:d.has('consent')}});
  if(f.dataset.form==='review'){v.lawyerUserId=Number(v.lawyerUserId);const reviewedCents=cents('reviewed'),priceCents=cents('price');delete v.reviewed;delete v.price;await command('review',{review:{...v,reviewedCents,priceCents,confirmed:d.has('confirmed')}});}
  if(f.dataset.form==='claimant'){delete v.conciliation;await command('claimant',{claimant:v,conciliation:d.has('conciliation')});}
  if(f.dataset.form==='sign')await command('sign',{name:v.name,accepted:d.has('accepted'),version:current.version,termsHash:current.termsHash});
  if(f.dataset.form==='upload')await uploadFiles([...f.querySelector('[name=file]').files],v.kind);
  if(f.dataset.form==='checkout'){const r=await post(`/cases/${current.id}/checkout`,{accepted:d.has('accepted'),reviewId:(current.review||current.docOffer).id});const url=new URL(r.url);if(url.protocol!=='https:')throw new Error('Endereço de pagamento inválido.');location.assign(url.href);}
});});
async function init(){config=await api('/config');const id=new URLSearchParams(location.search).get('debt_case');if(config.authenticated&&config.ready&&id)await load(id);else{current=null;render();await refreshList();}}
function activate(){if(document.body.dataset.activePage!=='dividas-bancarias'){clearTimeout(poll);return;}if(!initialized){initialized=true;run(async()=>{try{await init();}catch(e){initialized=false;throw e;}});}else render();}
document.addEventListener('audita:pagechange',activate);
window.addEventListener('audita:auth-changed',()=>{clearTimeout(poll);current=null;config=null;viewDocuments=false;initialized=false;render();activate();});
render();activate();

async function uploadFiles(files,kind='evidence'){
 if(!files.length||files.length>15||files.some(f=>!f.size||f.size>10*1024*1024))throw new Error('Envie até 15 arquivos de até 10 MB cada.');
 for(const file of files){current=(await api(`/cases/${current.id}/documents?kind=${encodeURIComponent(kind)}&name=${encodeURIComponent(file.name)}`,{method:'POST',body:file,headers:{'content-type':'application/octet-stream'}})).case;}render();
}
function analysisResult(){const a=current?.analysis;if(!a)return '';const source=id=>current.documents.find(d=>d.id===id)?.name||'Conferência geral';return '<details><summary>O que encontramos nos arquivos</summary><dl class="debt-summary"><div><dt>Banco identificado</dt><dd>'+esc(a.bank)+'</dd></div><div><dt>Total de juros identificados nos extratos</dt><dd>'+money(a.totals.interestCents)+'</dd></div><div><dt>Encargos de atraso (mora)</dt><dd>'+money(a.totals.lateCents)+'</dd></div></dl>'+((a.reconciliations||[]).map(r=>'<p>Saldo inicial conciliado com o extrato anterior: '+money(r.openingBalanceCents)+'. Arquivo: '+esc(source(r.documentId))+'.</p>').join(''))+'<p>Esses valores são cobranças encontradas nos documentos. Ainda não representam juros abusivos confirmados nem o valor de redução da dívida.</p><h3>O que precisa ser conferido</h3><ul>'+a.issues.map(i=>'<li><strong>'+esc(source(i.documentId))+':</strong> '+esc(i.message)+'</li>').join('')+'</ul><details><summary>Ver lançamentos encontrados</summary><div style="overflow-x:auto"><table><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Arquivo / página</th></tr></thead><tbody>'+a.rows.map(r=>'<tr><td>'+esc(r.date)+'</td><td>'+esc(r.description)+'</td><td>'+money(r.amountCents)+'</td><td>'+esc(source(r.documentId))+' · '+r.page+'</td></tr>').join('')+'</tbody></table></div></details></details>';}
function documentOffer(){
 const offer=current.docOffer,r=offer.range,a=current.analysis,date=r.asOf.split('-').reverse().join('/');
 const reductionMin=r.chargedCents-r.maxCents,reductionMax=r.chargedCents-r.minCents;
 return `<div class="charge-paywall debt-checkout">
  <section class="charge-paywall-result" aria-labelledby="debtOfferTitle">
   <span class="charge-analysis-mark" aria-hidden="true"><img src="/assets/audita-logo-original.png" alt=""></span>
   <div><p class="eyebrow">Análise preliminar concluída</p>
    <h2 id="debtOfferTitle">Sua dívida pode ter uma redução de ${r.minReductionPercent.toLocaleString('pt-BR')}% a ${r.maxReductionPercent.toLocaleString('pt-BR')}%</h2>
    <p>Confira a estimativa e o serviço indicado para o seu atendimento.</p>
   </div>
  </section>
  ${a.rateFallbackNotice?`<p class="debt-checkout-notice" role="status">${esc(a.rateFallbackNotice)}</p>`:''}
  <section class="charge-paywall-value" aria-label="Resumo do cálculo">
   <dl class="debt-checkout-values">
    <div><dt>Saldo cobrado no extrato</dt><dd>${money(r.chargedCents)}</dd></div>
    <div><dt>Saldo estimado pela Audita</dt><dd>${money(r.minCents)} a ${money(r.maxCents)}</dd></div>
    <div><dt>Redução estimada em reais</dt><dd>${money(reductionMin)} a ${money(reductionMax)}</dd></div>
   </dl>
   <p class="debt-note">Valores em ${esc(date)}. Estimativa antes do custo do serviço. O acordo depende do credor; a redução não é garantida.</p>
   <details><summary>Como calculamos</summary>
    <p>Juros identificados nos extratos: <strong>${money(a.totals.interestCents)}</strong>. Esse total não corresponde automaticamente a juros abusivos.</p>
    ${a.assumptions.map(v=>'<p>'+esc(v)+'</p>').join('')}
   </details>
  </section>
  <section class="charge-paywall-plans charge-paywall-tiers" aria-label="Oferta do serviço de dívidas bancárias">
   <article class="charge-tier-card recommended selected">
    <div class="charge-tier-content">
     <header class="charge-tier-heading"><h3>${esc(offer.planName)}</h3><em>Sua faixa</em></header>
     <p class="debt-checkout-price-label">Seu plano de atendimento</p>
     <strong class="charge-tier-price">${money(offer.priceCents)}</strong>
     <p class="charge-tier-installments">Pagamento único</p>
     <ul class="charge-tier-inclusions" aria-label="Itens incluídos na contratação">
      <li><strong>Relatório de análise da dívida</strong><span>Conferência dos juros e da evolução do saldo com memória do cálculo.</span></li>
      <li><strong>Documento e passo a passo para negociar</strong><span>Orientações para apresentar a proposta ao banco ou à empresa de cobrança.</span></li>
      <li><strong>Avaliação do advogado Audita</strong><span>Se a negociação não resolver, encaminhamento para avaliar a medida judicial.</span></li>
     </ul>
    </div>
    <details class="debt-checkout-terms"><summary>Condições do serviço</summary><p>${esc(current.terms)}</p></details>
    <form data-form="checkout" class="debt-form debt-checkout-form">
     <label class="debt-check"><input name="accepted" type="checkbox" required> Li a análise e as condições do serviço.</label>
     <button type="submit" class="primary-action">Contratar e continuar</button>
    </form>
   </article>
  </section>
 </div>`;
}
function negotiationPanel(){return bubble(`<h2>Primeiro, vamos tentar resolver por negociação</h2><p>Baixe o documento e siga os passos. Guarde as respostas para o advogado, caso seja necessário.</p><div class="charge-analysis-actions"><a href="/api/bank-debt/cases/${current.id}/documents/negotiation">Baixar laudo de renegociação</a></div><ol><li>Confirme com o banco o canal oficial da empresa de cobrança.</li><li>Envie o relatório e peça a memória de evolução da dívida.</li><li>Solicite uma proposta por escrito e guarde o protocolo.</li><li>Confira condições, beneficiário e quitação antes de pagar.</li><li>Se não resolver, solicite o advogado responsável pela Audita.</li></ol>`);}
