import {IrError,requireIr as check} from './ir-exemption-domain.mjs';
export function createPisPasepHandler({service,getAuth,readJson,readBuffer,sendJson}) {
  return async (request,response,url)=>{
    if(!/^\/api\/pis-pasep(?:\/|$)/.test(url.pathname))return false;
    response.setHeader('cache-control','no-store');response.setHeader('x-content-type-options','nosniff');
    try{
      const auth=await getAuth(request),config=await service.configuration(auth),path=url.pathname.slice('/api/pis-pasep'.length),method=request.method;
      if(path==='/config'&&method==='GET'){sendJson(response,200,config);return true;}
      check(config.enabled,'pis_disabled','Atendimento ainda não habilitado.',503);check(auth?.user?.id,'authentication_required','Entre na sua conta para continuar.',401);check(config.ready,'pis_unavailable','Armazenamento seguro indisponível.',503);
      if(method!=='GET'){const origin=request.headers.origin;check(request.headers['sec-fetch-site']!=='cross-site'&&(!origin||new URL(origin).host===request.headers.host),'invalid_origin','Origem inválida.',403);}
      let result,status=200;
      if(path==='/cases'&&method==='GET')result={cases:await service.list(auth)};
      else if(path==='/cases'&&method==='POST'){result={case:await service.create(auth)};status=201;}
      else if(path==='/queue'&&method==='GET')result={cases:await service.queue(auth)};
      else{
        const m=path.match(/^\/cases\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/(.*))?$/i);check(m,'not_found','Rota não encontrada.',404);const [,id,action='']=m;
        if(!action&&method==='GET')result={case:await service.get(auth,id)};
        else if(action==='claim'&&method==='POST')result={case:await service.claim(auth,id)};
        else if(action==='actions'&&method==='POST')result={case:await service.command(auth,id,await readJson(request))};
        else if(action==='documents'&&method==='POST')result={case:await service.upload(auth,id,{buffer:await readBuffer(request,10*1024*1024),name:url.searchParams.get('name'),type:url.searchParams.get('type')})};
        else if(/^documents\/[0-9a-f-]{36}$/i.test(action)&&method==='GET'){
          const file=await service.download(auth,id,action.split('/')[1]);response.writeHead(200,{'content-type':file.mime,'content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,'content-length':file.buffer.length});response.end(file.buffer);return true;
        }else check(false,'not_found','Rota não encontrada.',404);
      }
      sendJson(response,status,result);
    }catch(e){const known=e instanceof IrError;sendJson(response,known?e.statusCode:e.code==='BODY_TOO_LARGE'?413:500,{error:known?e.code:'pis_request_failed',message:known?e.message:'Não foi possível concluir. Tente novamente.'});}
    return true;
  };
}
