import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {createHash} from 'node:crypto';
import {debtLegalTexts,debtMoney} from './bank-debt-domain.mjs';
export const debtHash=value=>createHash('sha256').update(value).digest('hex');
export async function debtPdf(title,sections) {
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(title);pdf.setAuthor('Audita');
  let page,y;const next=()=>{page=pdf.addPage([595,842]);y=780;page.drawText('AUDITA | DÍVIDAS BANCÁRIAS',{x:45,y,font:bold,size:12,color:rgb(.13,.27,.42)});y-=32;};next();
  const clean=t=>[...String(t).normalize('NFC')].map(c=>{if(c==='\n')return c;try{font.encodeText(c);return c}catch{return '?'}}).join('');
  for(const section of [title,...sections]) {
    for(const paragraph of clean(section).split('\n')) {
      let line='';
      for(const word of paragraph.split(/\s+/).flatMap(w=>w.match(/.{1,65}/g)||[''])) {
        if(font.widthOfTextAtSize(`${line} ${word}`,10)>505){if(y<65)next();page.drawText(line,{x:45,y,font,size:10});y-=15;line=word;}else line=line?`${line} ${word}`:word;
      }
      if(y<65)next();page.drawText(line,{x:45,y,font,size:10});y-=17;
    }y-=10;
  }
  const pages=pdf.getPages();pages.forEach((pg,i)=>pg.drawText(`${i+1} / ${pages.length} · Documento para revisão do advogado`,{x:45,y:30,font,size:8}));
  return Buffer.from(await pdf.save());
}
export async function debtDocuments(p,id) {
  const c=p.claimant,d=p.details,r=p.review,a=p.acceptance,texts=debtLegalTexts(p);
  const signature=`ASSINATURA ELETRÔNICA\n${a.name} · CPF ${c.document}\nConfirmada em ${a.at} · Registro ${a.id}\nVersão ${a.version} · Hash dos termos: ${a.termsHash}\nIP observado: ${a.ip} · Navegador: ${a.userAgent}`;
  const powerOfAttorney=await debtPdf('Procuração',[texts.powerOfAttorney,signature]);
  const agreement=await debtPdf('Contrato de prestação de serviço',[texts.agreement,signature]);
  const report=await debtPdf('Petição de revisão de dívida bancária — minuta para conferência e protocolo',[
    `AO JUÍZO COMPETENTE DA COMARCA DE ${c.city.toUpperCase()}/${c.uf}\nA unidade e a via processual serão confirmadas pelo advogado antes do protocolo.`,
    `AUTOR: ${c.fullName}, CPF ${c.document}, ${c.nationality}, ${c.maritalStatus}, ${c.profession}, ${c.street}, ${c.number}, ${c.complement}, ${c.neighborhood}, ${c.city}/${c.uf}, CEP ${c.postalCode}, ${c.email}, telefone ${c.phone}.\nADVOGADO: ${r.lawyerName}, OAB ${r.lawyerOab}.\nRÉU: ${r.creditorLegalName}, CNPJ ${r.creditorDocument}, ${r.creditorAddress}.`,
    `I — DOS FATOS\nO autor relata dívida em aberto desde ${d.since}, com principal informado de ${debtMoney(d.originalCents)} e cobrança atual de ${debtMoney(d.chargedCents)}. Relata recebimento de notificações e questiona os encargos.\nRelato: ${d.description||'Conforme documentos anexos.'}\nProposta pessoal de pagamento: ${debtMoney(d.offeredCents)}. Essa proposta não constitui o resultado técnico.`,
    `II — DA ANÁLISE FINANCEIRA\nValor recalculado submetido à revisão: ${debtMoney(r.reviewedCents)}. Diferença em discussão: ${debtMoney(d.chargedCents-r.reviewedCents)}.\nMemória e metodologia:\n${r.methodology}`,
    `III — DOS FUNDAMENTOS\n${r.legalBasis}`,
    'IV — DOS PEDIDOS\nRequer-se a citação da parte ré; a apresentação do contrato e demonstrativo de evolução da dívida; a revisão dos encargos especificamente impugnados na fundamentação; a apuração do saldo conforme a memória de cálculo; e a produção das provas documentais e técnicas cabíveis. Eventual consignação, depósito, tutela de urgência e pedidos acessórios dependem da definição da via e revisão expressa do advogado, sem declaração de depósito já realizado.',
    `V — VALOR DA CAUSA\nBenefício econômico controvertido indicado: ${debtMoney(d.chargedCents-r.reviewedCents)}, sujeito à adequação pelo advogado à cumulação de pedidos e à via processual escolhida.\nO autor tem interesse na tentativa de conciliação, conforme confirmação na coleta cadastral.`,
    `VI — DOCUMENTOS\nProcuração e contrato assinados anexos. Documentos de identificação, residência e cobranças disponibilizados no mesmo atendimento.\nCaso Audita: ${id}.\n${c.city}/${c.uf}.\n${r.lawyerName} — OAB ${r.lawyerOab}\nAssinatura do advogado no sistema do tribunal, no momento do protocolo.`]);
  const bundle=await PDFDocument.load(report);
  for(const bytes of [powerOfAttorney,agreement]){const doc=await PDFDocument.load(bytes);for(const pg of await bundle.copyPages(doc,doc.getPageIndices()))bundle.addPage(pg);}
  return {report:Buffer.from(await bundle.save()),powerOfAttorney,agreement};
}
