import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getAnalysisSegment } from '../analysis-segments.js';

const category = { fiscal: 'Fiscal e tributário', judicial: 'Judicial', labor: 'Trabalhista', credit: 'Crédito e protestos', company: 'Empresas relacionadas', identity: 'Identificação', other: 'Outros' };
export async function sellerReportPdf(report) {
  const pdf = await PDFDocument.create();
  const segment = getAnalysisSegment(report.segment) || getAnalysisSegment();
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(segment.title); pdf.setAuthor('Audita');
  let page, y;
  const ink = rgb(.08,.17,.24), green = rgb(.0,.4,.35);
  const clean = text => [...String(text ?? '').normalize('NFC')].map(c => { if(c === '\n') return c; try { font.encodeText(c); return c; } catch { return '-'; } }).join('');
  const next = () => {
    page = pdf.addPage([595,842]); y = 780;
    page.drawText(`AUDITA  |  ${segment.title.toUpperCase()}`, { x:44,y,font:bold,size:12,color:green });
    page.drawLine({ start:{x:44,y:y-13}, end:{x:551,y:y-13}, thickness:1,color:green }); y -= 40;
  };
  next();
  function text(value, heading = false) {
    const face = heading ? bold : font, size = heading ? 12 : 10;
    if (heading && y < 115) next();
    for (const paragraph of clean(value).split('\n')) {
      let line = '';
      // Break long tokens as well as words so source identifiers cannot cross the margin.
      for (const word of paragraph.split(/\s+/).flatMap(w => w.match(/.{1,55}/g) || [''])) {
        const candidate = line ? `${line} ${word}` : word;
        if (face.widthOfTextAtSize(candidate,size) > 507 && line) { draw(line); line=word; } else line=candidate;
      }
      draw(line); y -= 4;
    }
    y -= heading ? 6 : 5;
    function draw(line) { if(y < 65) next(); page.drawText(line,{x:44,y,font:face,size,color:ink}); y-=15; }
  }
  text('Relatório de análise documental', true);
  text(`${report.subject.name}\nDocumento: ${report.subject.document}\nConsulta: ${report.id}\nGerado em: ${new Date(report.generatedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} (Brasília)`);
  text('Resumo da análise',true);
  text(report.executiveSummary || report.conclusion);
  text(`${report.analyzed} documentos e consultas analisados. ${report.findings.filter(f=>f.priority!=='information').length} pontos de atenção no material obtido.`);
  const issues=report.findings.filter(f=>f.priority!=='information');
  if(issues.length) text('Pendências identificadas e próximos passos',true);
  for (const [index,f] of issues.entries()) {
    text(`${index+1}. ${f.title}`,true);
    text(`${category[f.category] || 'Outros'} | Prioridade: ${{high:'Alta',medium:'Atenção',information:'Informativa'}[f.priority]}\nFonte: ${f.sourceTitle}`);
    if (f.identity !== 'compatible') text('IDENTIDADE NÃO CONFIRMADA: não atribuir este registro ao titular sem conferência.');
    text(f.description);
    if (f.amount) text(`Valor informado pela fonte: ${f.amount}. Não somado a outros registros para evitar duplicidade.`);
    if (f.date) text(`Data informada: ${f.date}`);
    text(`Trecho de evidência: "${f.quote}"\nPróximo passo: ${f.recommendation}`);
  }
  text('Sobre este levantamento',true);
  text(report.scopeNotice || segment.scope);
  text(`Análise de ${report.analyzed} das ${report.total} fontes do levantamento, limitada ao material obtido e à data da consulta. Originais, status e detalhes das fontes permanecem disponíveis na consulta autenticada da Audita.`);
  text('Leitura assistida por IA para conferência. Registros de processos ou empresas não representam automaticamente dívida pessoal do titular. Não é certidão oficial nem decisão jurídica ou garantia de regularidade.');
  const pages=pdf.getPages();
  pages.forEach((p,i)=>p.drawText(`Audita | Relatório documental | ${i+1} / ${pages.length}`,{x:44,y:30,font,size:8,color:ink}));
  return Buffer.from(await pdf.save());
}
