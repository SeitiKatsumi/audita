import {IrError,requireIr as check} from './ir-exemption-domain.mjs';
export function createImportHandler({service,getAuth,readJson,readBuffer,sendJson}){
 return async(req,res,url)=>{
  if(!/^\/api\/import-audit(?:\/|$)/.test(url.pathname))return false;
  res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');
  try{
   const a=await getAuth(req),p=url.pathname.slice('/api/import-audit'.length),m=req.method;
   if(p==='/config'&&m==='GET'){sendJson(res,200,await service.configuration(a));return true;}
   check(a?.user?.id,'authentication_required','Entre na sua conta.',401);
   if(m!=='GET')check(req.headers['sec-fetch-site']!=='cross-site'&&(!req.headers.origin||new URL(req.headers.origin).host===req.headers.host),'invalid_origin','Origem inválida.',403);
   let r;
   if(p==='/cases'&&m==='GET')r={cases:await service.list(a)};
   else if(p==='/queue'&&m==='GET')r={cases:await service.list(a,true)};
   else if(p==='/cases'&&m==='POST')r={case:await service.create(a,await readJson(req))};
   else {const match=p.match(/^\/cases\/([0-9a-f-]{36})(?:\/(.*))?$/i);check(match,'not_found','Rota não encontrada.',404);const[,id,action='']=match;
    if(!action&&m==='GET')r={case:await service.get(a,id)};
    else if(action==='actions'&&m==='POST')r={case:await service.command(a,id,await readJson(req))};
    else if(action==='documents'&&m==='POST')r={case:await service.upload(a,id,{buffer:await readBuffer(req,10*1024*1024),name:url.searchParams.get('name'),type:url.searchParams.get('type'),revision:Number(url.searchParams.get('revision'))})};
    else if(m==='GET'&&(action==='report'||/^documents\/[0-9a-f-]{36}$/i.test(action))){const f=action==='report'?await service.report(a,id):await service.download(a,id,action.split('/')[1]);res.writeHead(200,{'content-type':f.mime,'content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`});res.end(f.buffer);return true;}
    else check(false,'not_found','Rota não encontrada.',404);
   }sendJson(res,200,r);
  }catch(e){sendJson(res,e instanceof IrError?e.statusCode:e.code==='BODY_TOO_LARGE'?413:e.name==='ZodError'||e instanceof SyntaxError?400:503,{error:e instanceof IrError?e.code:'import_error',message:e instanceof IrError?e.message:e.name==='ZodError'?'Revise os campos informados.':'Não foi possível concluir. Dados preservados; confira a configuração ou tente novamente.'});}
  return true;
 };
}
