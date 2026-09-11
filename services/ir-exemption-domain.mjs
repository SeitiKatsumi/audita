import crypto from 'node:crypto';
import { z } from 'zod';
import { validateProfileCpf } from './user-profile.service.mjs';

export const IR_VERSION = '2026-09-10.1';
export const IR_SOURCES = [
  {title:'Receita Federal — moléstia grave', url:'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/preenchimento/molestia-grave'},
  {title:'Receita Federal — início do direito', url:'https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/perguntas-frequentes/imposto-de-renda/dirpf/isencao/como-saber-a-data-de'},
  {title:'PGFN — isenção por moléstia grave', url:'https://www.gov.br/pgfn/pt-br/cidadania-tributaria/por-assunto/imposto-de-renda-pessoa-fisica-irpf-2/isencao-por-molestia-grave'},
];
export const IR_CONDITIONS = [
  ['occupational','Moléstia profissional'],['tuberculosis','Tuberculose ativa'],
  ['mental','Alienação mental'],['multiple_sclerosis','Esclerose múltipla'],
  ['cancer','Neoplasia maligna (câncer)'],['blindness','Cegueira, inclusive monocular'],
  ['leprosy','Hanseníase'],['paralysis','Paralisia irreversível e incapacitante'],
  ['heart','Cardiopatia grave'],['parkinson','Doença de Parkinson'],
  ['spondylitis','Espondiloartrose anquilosante'],['kidney','Nefropatia grave'],
  ['liver','Hepatopatia grave'],['paget','Estados avançados da doença de Paget'],
  ['radiation','Contaminação por radiação'],['aids','Síndrome da imunodeficiência adquirida'],
  ['cystic_fibrosis','Fibrose cística'],['other','Outra condição / preciso de avaliação'],['unknown','Não sei'],
];
export const IR_STATUSES = {
  triage:'Triagem', documents_pending:'Documentos pendentes', review:'Em revisão',
  preparation:'Em preparação', filed:'Protocolado', requirement:'Exigência', decision:'Decisão', closed:'Encerrado',
};
export const IR_DOCUMENT_TYPES = {
  identity:'Identificação do titular', representation:'Procuração / representação', medical:'Laudo ou relatório médico',
  benefit:'Comprovante do benefício', income:'Informe de rendimentos / contracheque', tax_return:'Declaração de IR',
  death:'Certidão de óbito', estate:'Documentos do espólio', contract:'Contrato assinado',
  protocol:'Comprovante de protocolo', decision:'Decisão / concessão', refund:'Comprovante de restituição', other:'Outro documento',
};
export class IrError extends Error {
  constructor(code, message, status=400) { super(message); this.code=code; this.statusCode=status; }
}
export function requireIr(condition, code, message, status=400) { if (!condition) throw new IrError(code,message,status); }
const text = z.string().trim().min(1).max(500);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d=new Date(`${v}T00:00:00Z`); return !isNaN(d) && d.toISOString().slice(0,10)===v && v<=''+new Date().toISOString().slice(0,10) && v>='1900-01-01';
}, 'Data inválida ou futura');
const money = z.number().int().min(0).max(10000000000);
const unknownDate = date.nullable();
const cpf = z.string().transform(v=>v.replace(/\D/g,'')).refine(validateProfileCpf,'CPF inválido');
const identity = z.object({name:text,cpf,phone:z.string().regex(/^\+?[\d ()-]{10,20}$/),email:z.string().email().max(254)}).strict();
export const IR_ANSWER_SCHEMAS = {
  role:z.enum(['self','representative','heir']),
  consent:z.object({analysis:z.literal(true),representation:z.literal(true)}).strict(),
  identity,
  subject:z.object({name:text,cpf}).strict(),
  benefits:z.array(z.object({type:z.enum(['retirement','pension','military','private','salary','unknown']),payer:text,start:unknownDate}).strict()).min(1).max(12),
  conditions:z.array(z.enum(IR_CONDITIONS.map(([id])=>id))).min(1).max(18).transform(v=>[...new Set(v)]),
  diagnosis:z.object({date:unknownDate,year:z.number().int().min(1900).max(new Date().getFullYear()).nullable(),remission:z.enum(['yes','no','unknown'])}).strict(),
  medical:z.enum(['official','private','obtain','unknown']),
  taxes:z.object({withheld:z.enum(['yes','no','unknown']),periods:z.array(z.object({benefitIndex:z.number().int().min(0).max(11),month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).refine(v=>v<=new Date().toISOString().slice(0,7)&&v>='1900-01'),paidCents:money,refundedCents:money}).strict().refine(v=>v.refundedCents<=v.paidCents,'Restituído excede o recolhido')).max(240)}).strict(),
  prior:z.enum(['none','pending','denied','exempt','unknown']),
  heir:z.object({deathDate:date,relationship:text,estate:z.enum(['open','closed','none','unknown']),representative:z.enum(['yes','no','unknown'])}).strict(),
  documents:z.enum(['ready','later']),
};
const choices = pairs=>pairs.map(([value,label])=>({value,label}));
export function irSteps(answers={}) {
  const steps = [
    {key:'role',title:'Vamos começar. Para quem você está buscando a análise?',type:'choice',options:choices([['self','Para mim'],['representative','Represento uma pessoa viva'],['heir','Sou herdeiro(a)']])},
    {key:'consent',title:'Podemos analisar suas informações?',type:'consent',help:'Seus dados cadastrais e de saúde serão usados na análise preliminar e acessados pela equipe responsável. Ao representar alguém, confirme que tem autorização.'},
    {key:'identity',title:'Quais são seus dados de contato?',type:'identity',help:'São os dados de quem está solicitando. Eles ficam protegidos no caso.'},
  ];
  if (answers.role && answers.role!=='self') steps.push({key:'subject',title:'Quem é o titular do benefício?',type:'subject'});
  steps.push(
    {key:'benefits',title:'Quais benefícios ou rendimentos o titular recebe?',type:'benefits',help:'Adicione cada fonte separadamente. Se não souber a data, deixe-a em branco.'},
    {key:'conditions',title:'Qual condição consta no histórico médico?',type:'multi',options:choices(IR_CONDITIONS),help:'Selecione as condições documentadas. A confirmação do enquadramento será feita pela equipe.'},
    {key:'diagnosis',title:'Quando ocorreu o diagnóstico?',type:'diagnosis',help:'Informe a data ou apenas o ano aproximado. Estar em remissão não encerra a análise.'},
    {key:'medical',title:'Você tem laudo ou relatório médico?',type:'choice',options:choices([['official','Sim, de serviço médico oficial'],['private','Sim, de médico particular'],['obtain','Ainda não, mas posso obter'],['unknown','Não sei']])},
    {key:'taxes',title:'Há desconto de Imposto de Renda no benefício?',type:'taxes',help:'Informe apenas valores conhecidos, por mês e fonte. Você pode completar depois; não estimamos cinco anos a partir de um único mês.'},
    {key:'prior',title:'Já houve um pedido de isenção?',type:'choice',options:choices([['none','Ainda não'],['pending','Sim, aguardando resposta'],['denied','Sim, foi negado'],['exempt','A isenção já foi concedida'],['unknown','Não sei']])},
  );
  if (answers.role==='heir') steps.push({key:'heir',title:'Sobre o falecimento e a representação do espólio',type:'heir'});
  steps.push({key:'documents',title:'Vamos organizar os documentos?',type:'documents',help:'Anexe os arquivos disponíveis na área Documentos. Você pode continuar com pendências e complementar depois.'});
  return steps;
}
export function validateAnswer(key,value,answers={}) {
  const schema=Object.hasOwn(IR_ANSWER_SCHEMAS,key)?IR_ANSWER_SCHEMAS[key]:null;
  requireIr(schema,'invalid_answer','Pergunta inválida.');
  const result=schema.safeParse(value);
  requireIr(result.success,'invalid_answer',result.error?.issues?.[0]?.message || 'Resposta inválida.');
  if(key==='taxes') {
    const seen=new Set();
    for(const p of result.data.periods) {
      requireIr(answers.benefits?.[p.benefitIndex],'invalid_source','Fonte pagadora inválida.');
      const id=`${p.benefitIndex}:${p.month}`;
      requireIr(!seen.has(id),'duplicate_period','Informe apenas um total por fonte e mês.'); seen.add(id);
    }
  }
  if(key==='diagnosis'&&result.data.date&&result.data.year) requireIr(Number(result.data.date.slice(0,4))===result.data.year,'date_conflict','Data e ano do diagnóstico divergem.');
  return result.data;
}
export function documentChecklist(answers={}) {
  const types=['identity','medical','benefit','income','tax_return'];
  if(answers.role && answers.role!=='self') types.push('representation');
  if(answers.role==='heir') types.push('death','estate');
  return types.map(type=>({type,label:IR_DOCUMENT_TYPES[type]}));
}
export function analyzeIr(answers={},documents=[],now=new Date()) {
  const missing=irSteps(answers).filter(s=>answers[s.key]===undefined).map(s=>s.key);
  const warnings=[];
  const pending=documentChecklist(answers).filter(d=>!documents.some(x=>x.type===d.type)).map(d=>d.label);
  const supported=answers.benefits?.some(b=>['retirement','pension','military','private'].includes(b.type));
  const known=answers.conditions?.some(c=>!['other','unknown'].includes(c));
  if(!supported) warnings.push('Precisamos confirmar rendimentos de aposentadoria, pensão, reforma/reserva ou complementação. Salário da ativa não é tratado como benefício isento.');
  if(!known) warnings.push('A condição informada precisa de avaliação especializada.');
  if(answers.medical!=='official') warnings.push('A equipe verificará a documentação médica exigida pela fonte pagadora e pela via escolhida.');
  if(answers.role==='heir') warnings.push('Caso de herdeiro: revisar legitimidade, representação, períodos e via adequada. Não há isenção futura do titular falecido.');
  if(answers.benefits?.some(b=>b.type==='private')) warnings.push('Previdência complementar: revisar a modalidade e a natureza de cada rendimento.');
  if(answers.prior==='denied') warnings.push('Revisar a negativa antes de definir as providências.');
  const diagnosis=answers.diagnosis?.date;
  if(!diagnosis) warnings.push('O termo inicial e o cálculo dependem da data comprovada do diagnóstico; ano aproximado não é suficiente.');
  const cutoff=new Date(now); cutoff.setUTCFullYear(cutoff.getUTCFullYear()-5);
  let documentedCents=0; const rows=[];
  for(const period of answers.taxes?.periods||[]) {
    const benefit=answers.benefits?.[period.benefitIndex];
    let reason='';
    if(!benefit||!['retirement','pension','military','private'].includes(benefit.type)) reason='Rendimento não enquadrado nesta triagem';
    else if(!diagnosis||!benefit.start) reason='Faltam datas comprovadas';
    else if(period.month<(diagnosis>benefit.start?diagnosis:benefit.start).slice(0,7)) reason='Anterior ao possível início do direito';
    else if(period.month<=cutoff.toISOString().slice(0,7)) reason='Prescrição e datas de recolhimento exigem revisão';
    else if(answers.role==='heir'&&(!answers.heir?.deathDate||period.month>answers.heir.deathDate.slice(0,7))) reason='Período posterior ao óbito ou óbito não informado';
    const cents=reason?0:period.paidCents-period.refundedCents;
    documentedCents+=cents;
    rows.push({...period,cents,reason});
  }
  return {version:IR_VERSION,createdAt:now.toISOString(),state:missing.length?'incomplete':supported&&known?'preliminary_indications':'specialist_review',
    missing,pending,warnings,specialistReview:answers.role==='heir'||!known||answers.conditions?.some(c=>['unknown','other'].includes(c))||answers.benefits?.some(b=>b.type==='private')||answers.prior==='denied',
    message:'Análise preliminar, sujeita à revisão documental e jurídica. Não representa concessão ou garantia de recebimento.',
    estimate:{kind:'preliminary',documentedCents,rows, futureSavingsCents:null,notice:'Soma preliminar dos períodos informados, sem correção. Revisar declarações, recolhimentos, prescrição e restituições anteriores. Não é valor definitivo.'},sources:IR_SOURCES};
}
export function sealIr(value,key,context) {
  const iv=crypto.randomBytes(12), cipher=crypto.createCipheriv('aes-256-gcm',key,iv); cipher.setAAD(Buffer.from(context));
  const data=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value));
  return Buffer.concat([iv,cipher.update(data),cipher.final(),cipher.getAuthTag()]).toString('base64');
}
export function openIr(value,key,context,binary=false) {
  const b=Buffer.from(value,'base64'),dec=crypto.createDecipheriv('aes-256-gcm',key,b.subarray(0,12));
  dec.setAAD(Buffer.from(context));dec.setAuthTag(b.subarray(-16));
  const bytes=Buffer.concat([dec.update(b.subarray(12,-16)),dec.final()]);return binary?bytes:JSON.parse(bytes.toString());
}
export function irKey(secret) {return typeof secret==='string'&&secret.length>=32?crypto.createHash('sha256').update(`audita-ir-v1:${secret}`).digest():null;}
