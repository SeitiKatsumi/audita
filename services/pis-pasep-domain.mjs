import {requireIr as check} from './ir-exemption-domain.mjs';
export const PIS_VERSION='2026-09-11';
export const PIS_SOURCE={label:'REPIS Cidadão · Ministério da Fazenda',url:'https://repiscidadao.fazenda.gov.br/',instructions:'https://www.gov.br/pt-br/servicos/consultar-saldo-de-cotas-pis-pasep',request:'https://www.fgts.gov.br/Paginas/trabalhador/ressarcimento-pis-pasep.aspx'};
export const PIS_STATUSES={triage:'Em conversa',assistance:'Precisa de assistência',ready:'Consulta informada',queued:'Aguardando responsável',review:'Em revisão',preparation:'Preparação',filed:'Pedido registrado',requirement:'Exigência',decision:'Decisão registrada',received:'Recebimento registrado',closed:'Encerrado'};
export const PIS_DOCUMENTS={identity:'Identificação do titular e solicitante',representation:'Autorização / procuração',death:'Certidão de óbito',succession:'Comprovação de dependentes ou sucessores',consultation:'Resultado da consulta',contract:'Contrato assinado',protocol:'Comprovante do requerimento',requirement:'Exigência oficial',decision:'Decisão oficial',receipt:'Comprovante de recebimento',fee:'Comprovante de honorários',other:'Outro documento'};
const choice=(key,title,values,help)=>({key,title,type:'choice',options:Object.entries(values).map(([value,label])=>({value,label})),help});
const yn={yes:'Sim',no:'Não',unknown:'Não sei'};
export function pisQuestions(a={}) {
  return [choice('role','Para quem você quer consultar as cotas do PIS/PASEP?',{self:'Para mim',representative:'Represento uma pessoa viva',heir:'Sou herdeiro(a) ou dependente'}),
    {key:'consent',type:'consent',title:'Podemos guardar suas respostas para continuar este atendimento?',help:'Autorizo o tratamento dos dados e documentos deste atendimento e o acesso da equipe responsável. Confirmo que sou o titular ou tenho autorização para representá-lo ou tratar da sucessão.'},
    {key:'requester',type:'text',title:'Qual é o seu nome completo?'},
    ...(a.role&&a.role!=='self'?[{key:'subject',type:'text',title:'Qual é o nome completo do titular das cotas?'}]:[]),
    ...(a.role==='heir'?[{key:'relationship',type:'text',title:'Qual é o seu vínculo com o titular falecido?'}]:[]),
    choice('work','O titular trabalhou com carteira assinada ou como servidor público entre 1971 e 1988?',yn),
    choice('withdrawal','As cotas antigas já foram sacadas?',yn),
    choice('hasNumber','Você tem o número PIS/PASEP do titular?',{yes:'Tenho o número',unknown:'Não sei / preciso de ajuda'}),
    ...(a.hasNumber==='yes'?[{key:'number',type:'pis',title:'Qual é o número PIS/PASEP do titular?'}]:[]),
    choice('consultation','O que apareceu na consulta?',{found:'Foi apresentado um saldo',not_found:'Não apareceu saldo',difficulty:'Não consegui consultar'},a.role==='heir'?'Abra o REPIS e entre com a sua própria conta gov.br prata ou ouro. Para consultar o titular falecido, informe o número PIS/PASEP dele. Depois volte aqui para contar o resultado.':'Abra o REPIS com a conta gov.br prata ou ouro do próprio titular. Se você o representa, peça que ele faça a consulta ou solicite apoio. Depois volte aqui para contar o resultado.'),
    choice('documents','Quer enviar os documentos disponíveis agora?',{ready:'Já enviei os documentos disponíveis',later:'Vou complementar depois'},'O comprovante da consulta é opcional neste momento. Você pode enviar os documentos nesta conversa.'),
    choice('referral','Quer encaminhar este atendimento para a equipe do Inventarium?',{yes:'Quero apoio da equipe',no:'Vou continuar por conta própria'},'A consulta é gratuita. Se precisar contratar atuação jurídica, você receberá as condições por caso, com honorários de êxito, antes de aceitar. Não há cobrança inicial.')];
}
export function pisAnswer(key,value,answers) {
  const q=pisQuestions(answers).find(q=>q.key===key);check(q,'invalid_answer','Pergunta inválida.');
  if(q.type==='choice'){check(q.options.some(o=>o.value===value),'invalid_answer','Escolha uma das respostas.');return value;}
  if(q.type==='consent'){check(value===true,'consent_required','Confirme a autorização para continuar.');return true;}
  check(typeof value==='string','invalid_answer','Informe uma resposta válida.');
  const v=value.trim();
  if(q.type==='pis'){const n=v.replace(/[.\s-]/g,'');check(/^\d{11}$/.test(n)&&!/^([0-9])\1{10}$/.test(n),'invalid_number','Informe os 11 dígitos do PIS/PASEP.');return n;}
  check(v.length>=2&&v.length<=180&&!/[\x00-\x1f]/.test(v),'invalid_answer','Use entre 2 e 180 caracteres.');return v;
}
export function pisChecklist(a) {
  return ['identity',...(a.role==='representative'?['representation']:[]),...(a.role==='heir'?['death','succession']:[])].map(type=>({type,label:PIS_DOCUMENTS[type]}));
}
export function pisSummary(a) {
  const pending=[];
  if(a.work==='unknown')pending.push('Confirmar o vínculo de trabalho no período de 1971 a 1988.');
  if(a.work==='no')pending.push('Revisar o período de trabalho informado. Este atendimento trata das cotas antigas, não do abono anual.');
  if(a.withdrawal!=='no')pending.push('Conferir se houve saque anterior das cotas.');
  if(a.hasNumber==='unknown')pending.push('Localizar o número PIS/PASEP, especialmente para consulta de titular falecido.');
  if(a.consultation==='difficulty')pending.push('Apoiar o acesso ao canal oficial ou orientar atendimento na CAIXA.');
  return {pending,message:a.consultation==='found'?'Você informou que encontrou saldo. O resultado está pendente de conferência documental e não confirma o ressarcimento.':a.consultation==='not_found'?'Você informou que não apareceu saldo. Isso não é uma conclusão definitiva sobre a existência de direito. A equipe pode revisar os dados utilizados.':'A consulta ainda não foi concluída. Podemos ajudar a organizar os dados e orientar o próximo passo.',next:'O ressarcimento é solicitado pelo aplicativo FGTS ou em uma agência da CAIXA, conforme as orientações oficiais. A decisão cabe ao órgão responsável.'};
}
export function pisDate(value,now=new Date()) {check(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!isNaN(new Date(value))&&new Date(value).toISOString().slice(0,10)===value&&value<=now.toISOString().slice(0,10),'invalid_date','Informe uma data válida, sem data futura.');return value;}
export function pisText(value,max=5000){check(typeof value==='string'&&value.trim().length>0&&value.length<=max,'invalid_text',`Preencha o texto (até ${max} caracteres).`);return value.trim();}
export function pisAmount(value){check(Number.isSafeInteger(value)&&value>0&&value<=10000000000,'invalid_amount','Informe um valor positivo válido.');return value;}
