import {calculateJudicialReport} from './judicial-report.mjs';
import {judicialReportPdf} from './judicial-report-pdf.mjs';
export function createJudicialReportHandler({getAuth,readJson,sendJson}){
 return async(req,res,url)=>{
  if(!['/api/judicial-report/preview','/api/judicial-report/pdf'].includes(url.pathname))return false;
  res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');
  try{
   if(req.method!=='POST')throw Object.assign(new Error('Método não permitido.'),{status:405});
   if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host))throw Object.assign(new Error('Origem inválida.'),{status:403});
   const auth=await getAuth(req);
   if(auth.unauthorized||!auth.user?.id)throw Object.assign(new Error('Entre na sua conta para gerar o relatório.'),{status:401});
   const body=await readJson(req);
   if(JSON.stringify(body).length>12000)throw Object.assign(new Error('Dados excedem o tamanho permitido.'),{status:413});
   const result=calculateJudicialReport(body.data);
   if(url.pathname.endsWith('/preview'))sendJson(res,200,result);
   else{
    if(body.confirmed!==true)throw Object.assign(new Error('Confira os dados e confirme antes de gerar o PDF.'),{status:400});
    const bytes=await judicialReportPdf(result);
    res.writeHead(200,{'content-type':'application/pdf','content-disposition':'attachment; filename="relatorio-financeiro-judicial.pdf"','content-length':bytes.length});res.end(bytes);
   }
  }catch(e){sendJson(res,e.status||400,{message:e.status?e.message:'Não foi possível gerar o relatório. Confira os campos.'});}
  return true;
 };
}
