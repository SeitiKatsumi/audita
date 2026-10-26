import { readFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts, rgb, PDFName } from 'pdf-lib';
import { getAnalysisSegment } from '../analysis-segments.js';

const category = { fiscal: 'Fiscal e tributário', judicial: 'Judicial', labor: 'Trabalhista', credit: 'Crédito e protestos', company: 'Empresas relacionadas', identity: 'Identificação', other: 'Outros' };
export async function sellerReportPdf(report) {
  const pdf = await PDFDocument.create();
  const segment = report.purpose ? {title:report.title,scope:report.scopeNotice} : getAnalysisSegment(report.segment) || getAnalysisSegment();
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(segment.title); pdf.setAuthor('IA Audita');
  // Embed the original silhouette; tint its PDF color channels while preserving its alpha mask.
  const logo=await pdf.embedPng(await readFile(new URL('../assets/audita-logo-original.png',import.meta.url)));
  await logo.embed();
  pdf.context.lookup(logo.ref).dict.set(PDFName.of('Decode'),pdf.context.obj([.08,.08,.17,.17,.24,.24]));
  let page, y;
  const ink = rgb(.08,.17,.24), green = rgb(.0,.4,.35);
  const clean = text => [...String(text ?? '').normalize('NFC')].map(c => { if(c === '\n') return c; try { font.encodeText(c); return c; } catch { return '-'; } }).join('');
  const next = () => {
    page = pdf.addPage([595,842]); y = 780;
    page.drawImage(logo,{x:44,y:776,width:38,height:38*logo.height/logo.width});
    page.drawText(`IA Audita  |  ${segment.title.toUpperCase()}`, { x:94,y,font:bold,size:11,color:ink });
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
  if(report.purpose) text('Objetivo da análise: '+report.purpose);
  text(`${report.subject.name}\nDocumento: ${report.subject.document}\nConsulta: ${report.id}\nGerado em: ${new Date(report.generatedAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} (Brasília)`);
  if(report.processCoverage){const coverage=report.processCoverage;text(`${coverage.complete?'Cobertura dos processos':'ANÁLISE PARCIAL DOS PROCESSOS'}: ${coverage.analyzed} de ${coverage.total} registros recebidos analisados; ${coverage.reportedTotal} informados pela fonte.`,true);}
  const ps=report.processSummary;
  if(ps && (ps.totals.length||ps.total)){
    text('Quantidade de processos do titular',true);
    for(const item of ps.totals)text(`${item.source}: ${item.total.toLocaleString('pt-BR')} processos informados pela fonte.`);
    if(ps.totals.length>1)text('Totais de consultas distintas não são somados: podem incluir os mesmos processos.');
    text(`Processos únicos identificados nos registros disponíveis: ${ps.total.toLocaleString('pt-BR')}.`);
    text('Distribuição por estado dos registros disponíveis',true);
    for(const [uf,count] of Object.entries(ps.byState).sort())text(`${uf}: ${count.toLocaleString('pt-BR')} processo(s)`);
    if(ps.unknownState)text(`UF não identificada ou abrangência nacional/regional: ${ps.unknownState}.`);
    if(!Object.keys(ps.byState).length)text('Não há UF identificada nos registros disponíveis para esta contagem.');
    for(const item of ps.tribunals)text(`Por tribunal - ${item.source}: ${item.distribution}`);
  }
  text('Resumo da análise',true);
  text(report.executiveSummary || report.conclusion);
  text(`${report.analyzed} ${report.processCoverage ? 'fontes e lotes analisados' : 'documentos e consultas analisados'}. ${report.findings.filter(f=>f.priority!=='information').length} pontos de atenção no material obtido.`);
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
  text(`Análise de ${report.analyzed} das ${report.total} fontes do levantamento, limitada ao material obtido e à data da consulta. Originais, status e detalhes das fontes permanecem disponíveis na consulta autenticada da IA Audita.`);
  text('Leitura assistida por IA para conferência. Registros de processos ou empresas não representam automaticamente dívida pessoal do titular. Não é certidão oficial nem decisão jurídica ou garantia de regularidade.');
  if(ps?.totals.length || ps?.total || ps?.aggregates?.length || report.processCoverage){
  next();
  text('Somatório dos valores dos processos',true);
  const money=value=>(value/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  text('Totais agregados informados pelo fornecedor',true);
  text('Soma aritmética dos grupos por área e polo retornados em cada consulta. Não é uma soma de processos conferidos individualmente; pode conter sobreposição e não confirma dívida ou crédito.');
  if(!ps?.aggregates?.length)text('Não há valores agregados estruturados com identidade conferida disponíveis nesta consulta.');
  for(const aggregate of ps?.aggregates||[]){
    text(`Fonte: ${aggregate.source}`,true);
    for(const [key,label] of [['defendant','Réu / polo passivo'],['claimant','Autor / exequente (polo ativo)']]){
      const group=aggregate[key];text(label,true);
      for(const row of group.areas)text(`${row.area}: ${money(row.cents)}`);
      text(group.areas.length?`Subtotal agregado: ${money(group.cents)} (${group.areas.length} área(s)).`:'Não informado em grupos válidos pelo fornecedor.');
    }
    if(aggregate.excluded)text(`Grupos não somados por dados ausentes, papel não identificado ou valores conflitantes: ${aggregate.excluded}.`);
  }
  text('Agregados de consultas distintas não são somados entre si nem adicionados aos subtotais individuais abaixo.');
  text('Subtotais por processo individual identificado',true);
  for(const [key,label] of [['defendant','Como réu / polo passivo'],['claimant','Como autor / exequente']]){
    const total=ps?.[key];
    text(label,true);
    text(total?.count?`${money(total.cents)} - ${total.count} processo(s) com valor da causa e papel identificados.`:'Não apurado: não há registros com valor e papel confirmados para este subtotal.');
  }
  text('Os subtotais não são compensados nem somados entre si. São valores de causa informados, não saldos de dívida ou créditos reconhecidos. Não incluem atualização monetária.');
  if(ps)text(`Fora dos subtotais individuais: ${ps.excluded} processos com valor/papel ausente ou conflitante; ${ps.withoutNumber} registros sem número identificável; ${ps.restricted} registros restritos; ${ps.unavailable} registros indisponíveis. Duplicatas de número foram consolidadas; valores conflitantes foram excluídos.`);
  else text('Este relatório salvo não contém os dados estruturados necessários à soma. Não foram somados valores mencionados no texto da IA.');
  text('A soma abrange os registros disponíveis, que podem ser menos que o total informado pela fonte. Registros de empresas vinculadas ficam fora dos totais do titular.');
  }
  const pages=pdf.getPages();
  pages.forEach((p,i)=>p.drawText(`IA Audita | Relatório documental | ${i+1} / ${pages.length}`,{x:44,y:30,font,size:8,color:ink}));
  return Buffer.from(await pdf.save());
}
