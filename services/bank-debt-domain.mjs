import {z} from 'zod';
import {validateProfileCpf} from './user-profile.service.mjs';
export const DEBT_VERSION='2026-09-11.1';
export const DEBT_UFS='AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
export const DEBT_STATUSES={triage:'Conhecendo sua situação',not_eligible:'Fora do foco inicial',details:'Detalhes da dívida',calculation_pending:'Aguardando cálculo Audita',offer:'Análise disponível',payment_pending:'Aguardando pagamento',paid:'Pagamento confirmado',signature:'Assinatura',submitted:'Com o advogado'};
export const DEBT_QUESTIONS=[
  {key:'open',title:'Você tem alguma dívida bancária em aberto?',yes:'Sim, tenho uma dívida em aberto',no:'Não tenho dívida em aberto'},
];
export const DEBT_TERMS='Contratação da análise de dívida bancária, preparação documental e encaminhamento ao advogado responsável. O valor da proposta do cliente não substitui o cálculo Audita. Não há garantia de redução, acordo ou decisão favorável. Custas, depósitos judiciais e honorários adicionais dependem de avaliação e ajuste prévio específico; não estão automaticamente incluídos no preço do serviço.';
const text=z.string().trim().min(1).max(300).refine(v=>!/[\x00-\x1f]/.test(v),'Texto inválido.');
const cents=z.number().int().min(0).max(10000000000);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v);return !isNaN(d)&&d.toISOString().slice(0,10)===v&&v>='1900-01-01'&&v<=new Date().toISOString().slice(0,10)},'Informe uma data válida, não futura.');
export const debtDetails=z.object({creditor:text,kind:z.enum(['overdraft','card','loan','financing','other']),since:date,originalCents:cents.refine(v=>v>0),chargedCents:cents.refine(v=>v>0),offeredCents:cents.optional(),description:z.string().trim().max(3000),consent:z.literal(true)}).strict();
export const debtClaimant=z.object({fullName:text,document:z.string().transform(v=>v.replace(/\D/g,'')).refine(validateProfileCpf,'CPF inválido.'),email:z.string().email().max(254),phone:text,nationality:text,maritalStatus:text,profession:text,street:text,number:text,complement:z.string().trim().max(200),neighborhood:text,city:text,uf:z.enum(DEBT_UFS),postalCode:z.string().regex(/^\d{5}-?\d{3}$/)}).strict();
export const debtReview=z.object({reviewedCents:cents,priceCents:cents.refine(v=>v>=100),methodology:z.string().trim().min(30).max(12000),legalBasis:z.string().trim().min(30).max(12000),creditorLegalName:text,creditorDocument:z.string().regex(/^\d{14}$/),creditorAddress:text,lawyerUserId:z.number().int().positive(),lawyerName:text,lawyerOab:text,confirmed:z.literal(true)}).strict();
export function debtRequire(ok,message,status=422){if(!ok)throw Object.assign(new Error(message),{status});}
export function debtParse(schema,input){const result=schema.safeParse(input);debtRequire(result.success,result.error?.issues?.[0]?.message||'Confira os dados informados.');return result.data;}
export const debtMoney=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
export function debtLegalTexts(p) {
  const c=p.claimant,r=p.review,d=p.details;
  const identity=`${c.fullName}, CPF ${c.document}, ${c.nationality}, ${c.maritalStatus}, ${c.profession}, residente em ${c.street}, ${c.number}, ${c.complement}, ${c.neighborhood}, ${c.city}/${c.uf}, CEP ${c.postalCode}, e-mail ${c.email}`;
  return {powerOfAttorney:`PROCURAÇÃO — DÍVIDAS BANCÁRIAS\nOutorgante: ${identity}.\nOutorgado: ${r.lawyerName}, OAB ${r.lawyerOab}.\nObjeto: representação judicial e extrajudicial para análise e revisão da dívida perante ${r.creditorLegalName}, CNPJ ${r.creditorDocument}, relativa à cobrança de ${debtMoney(d.chargedCents)}.\nPoderes gerais para o foro, apresentação da demanda, juntada de documentos e acompanhamento do processo. Transigir, desistir, renunciar, receber valores e dar quitação dependem de autorização específica do outorgante.`,
  agreement:`CONTRATAÇÃO — DÍVIDAS BANCÁRIAS\nSolicitante: ${identity}.\nAdvogado indicado: ${r.lawyerName}, OAB ${r.lawyerOab}.\nPreço do serviço: ${debtMoney(r.priceCents)}, pagamento único.\n${DEBT_TERMS}\nVersão dos termos: ${DEBT_VERSION}.`};
}

// Critérios removidos não bloqueiam a retomada; respostas antigas permanecem no histórico.
export function debtTriageStatus(status,answers={}){return ['triage','not_eligible'].includes(status)&&answers.open===true?'details':status;}
