import {IrError,requireIr as check} from './ir-exemption-domain.mjs';
export function createGlosasHandler({service,getAuth,readJson,readBuffer,sendJson}){
 return async(req,res,url)=>{
  if(!/^\/api\/glosas(?:\/|$)/.test(url.pathname))return false;
  res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');
  try{
   const p=url.pathname.slice('/api/glosas'.length),m=req.method;
   if(p==='/config'&&m==='GET'){sendJson(res,200,await service.configuration());return true;}
   const a=await getAuth(req);check(a?.user?.id&&a.tenantId,'authentication_required','Entre na sua conta.',401);
   if(m!=='GET')check(req.headers['sec-fetch-site']!=='cross-site'&&(!req.headers.origin||new URL(req.headers.origin).host===req.headers.host),'invalid_origin','Origem inválida.',403);
   let result;
   if(p==='/cases'&&m==='GET')result={cases:await service.list(a)};
   else if(p==='/cases'&&m==='POST')result={case:await service.save(a,await readJson(req))};
   else{
    const match=p.match(/^\/cases\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/(report|report.pdf|actions|documents(?:\/[0-9a-f-]{36})?))?$/i);
    check(match,'not_found','Rota não encontrada.',404);const id=match[1];
    if(['report','report.pdf'].includes(match[2])&&m==='GET'){const pdf=match[2]==='report.pdf',buffer=await service.report(a,id,pdf);res.writeHead(200,{'content-type':pdf?'application/pdf':'text/plain; charset=utf-8','content-disposition':`attachment; filename="glosas-${id}.${pdf?'pdf':'txt'}"`});res.end(buffer);return true;}
    if(match[2]?.startsWith('documents/')&&m==='GET'){const f=await service.download(a,id,match[2].split('/')[1]);res.writeHead(200,{'content-type':f.mime,'content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`});res.end(f.buffer);return true;}
    if(match[2]==='actions'&&m==='POST')result={case:await service.command(a,id,await readJson(req))};
    else if(match[2]==='documents'&&m==='POST')result={case:await service.upload(a,id,{buffer:await readBuffer(req,10*1024*1024),name:url.searchParams.get('name'),type:url.searchParams.get('type'),revision:Number(url.searchParams.get('revision'))})};
    else if(match[2])check(false,'not_found','Rota não encontrada.',404);
    else if(m==='GET')result={case:await service.get(a,id)};
    else if(m==='PUT')result={case:await service.save(a,await readJson(req),id)};
    else if(m==='DELETE')result=await service.remove(a,id,(await readJson(req)).revision);
    else check(false,'not_found','Rota não encontrada.',404);
   }
   sendJson(res,200,result);
  }catch(e){sendJson(res,e instanceof IrError?e.statusCode:e.code==='BODY_TOO_LARGE'?413:e.name==='ZodError'||e instanceof SyntaxError?400:503,{error:e instanceof IrError?e.code:'glosas_error',message:e instanceof IrError?e.message:e.name==='ZodError'?'Revise os campos, valores e sequências duplicadas.':'Não foi possível concluir. Tente novamente.'});}
  return true;
 };
}
