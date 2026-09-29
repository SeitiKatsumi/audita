import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const category = { fiscal: 'Fiscal e tributário', judicial: 'Judicial', labor: 'Trabalhista', credit: 'Crédito e protestos', company: 'Empresas relacionadas', identity: 'Identificação', other: 'Outros' };
const outcome = { occurrences: 'Apontamentos na fonte', no_occurrence_in_scope: 'Sem ocorrência no alcance consultado', informational: 'Informações cadastrais', inconclusive: 'Inconclusivo' };
export async function sellerReportPdf(report) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle('Análise documental do vendedor'); pdf.setAuthor('Audita');
  let page, y;
  const ink = rgb(.08,.17,.24), green = rgb(.0,.4,.35);
  const clean = text => [...String(text ?? '').normalize('NFC')].map(c => { if(c === '\n') return c; try { font.encodeText(c); return c; } catch { return '-'; } }).join('');
  const next = () => {
    page = pdf.addPage([595,842]); y = 780;
    page.drawText('AUDITA  |  ANÁLISE DO VENDEDOR', { x:44,y,font:bold,size:12,color:green });
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
  text('1. Resumo e alcance',true);
  text(report.conclusion);
  text(`${report.analyzed} de ${report.total} fontes analisadas. ${report.gaps} fonte(s) com lacunas ou conclusão inconclusiva. ${report.findings.length} apontamento(s), incluindo informações cadastrais. Prioridade indica necessidade de conferência, não uma classificação de crédito.`);
  text(report.scopeNotice);
  text('2. Apontamentos e providências',true);
  if (!report.findings.length) text('Nenhum apontamento extraído. Isso não elimina as lacunas e os limites descritos neste relatório.');
  for (const [index,f] of report.findings.entries()) {
    text(`${index+1}. ${f.title}`,true);
    text(`${category[f.category] || 'Outros'} | Prioridade: ${{high:'Alta',medium:'Atenção',information:'Informativa'}[f.priority]}\nFonte: ${f.sourceTitle} [${f.sourceId}]`);
    if (f.identity !== 'compatible') text('IDENTIDADE NÃO CONFIRMADA: não atribuir este registro ao vendedor sem conferência.');
    text(f.description);
    if (f.amount) text(`Valor informado pela fonte: ${f.amount}. Não somado a outros registros para evitar duplicidade.`);
    if (f.date) text(`Data informada: ${f.date}`);
    text(`Trecho de evidência: "${f.quote}"\nPróximo passo: ${f.recommendation}`);
  }
  text('3. Fontes, documentos e lacunas',true);
  for (const s of report.sources) {
    text(`${s.title} [${s.id}]`,true);
    text(`Origem: ${s.provider} | Alcance: ${s.scope}\nColeta: ${s.checkedAt || 'Data não informada'}\nResultado da leitura: ${s.status === 'analyzed' ? outcome[s.outcome] : 'Não analisado'}`);
    text(s.status === 'analyzed' ? s.summary : s.message);
    if(s.issuedAt || s.validUntil) text(`Emissão: ${s.issuedAt || 'Não identificada'} | Validade: ${s.validUntil || 'Não identificada'}`);
    if(s.method) text(`Método: ${s.method}`);
    for(const limitation of [s.limitation,...(s.limitations || [])].filter(Boolean)) text(`Limitação: ${limitation}`);
    if(s.url) text('Documento original disponível na consulta autenticada da Audita, em Documentos e resultados das fontes.');
  }
  text('4. Como usar este relatório',true);
  text('Confira a identidade, datas, validade e abrangência de cada documento original. Solicite documentos ausentes ou atualizados. Leve os apontamentos e as evidências a um profissional habilitado para avaliar o efeito na negociação. Processos, vínculos societários e registros de terceiros não constituem, isoladamente, dívida pessoal nem impedimento à venda.');
  text('Leitura assistida por IA, sujeita a erros de interpretação. Não é certidão oficial, decisão jurídica, garantia de regularidade ou recomendação automática de contratar. Não foram feitas pesquisas além das fontes selecionadas.');
  const pages=pdf.getPages();
  pages.forEach((p,i)=>p.drawText(`Audita | Relatório documental | ${i+1} / ${pages.length}`,{x:44,y:30,font,size:8,color:ink}));
  return Buffer.from(await pdf.save());
}
