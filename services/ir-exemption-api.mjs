import {IrError,requireIr} from './ir-exemption-domain.mjs';
import {DATAJUD_TRIBUNALS} from './ir-exemption.service.mjs';

export function createIrExemptionHandler({service,getAuth,readJson,readBuffer,sendJson}) {
  return async function handle(request,response,url) {
    if(!url.pathname.startsWith('/api/ir-exemption'))return false;
    response.setHeader('cache-control','no-store');response.setHeader('x-content-type-options','nosniff');
    try {
      const auth=await getAuth(request),path=url.pathname.slice('/api/ir-exemption'.length),method=request.method;
      if(path==='/config'&&method==='GET'){sendJson(response,200,{...await service.configuration(auth),tribunals:DATAJUD_TRIBUNALS});return true;}
      const config=await service.configuration(auth);
      requireIr(config.enabled,'ir_disabled','Este módulo ainda não foi habilitado.',503);
      requireIr(auth?.user?.id,'authentication_required','Entre na sua conta para continuar.',401);
      requireIr(config.ready,'ir_unavailable','O armazenamento seguro está indisponível. Tente novamente mais tarde.',503);
      if(!['GET','HEAD'].includes(method)) {
        const origin=request.headers.origin;
        requireIr(request.headers['sec-fetch-site']!=='cross-site'&&(!origin||new URL(origin).host===request.headers.host),'invalid_origin','Origem da solicitação inválida.',403);
      }
      let result,status=200;
      if(path==='/cases'&&method==='GET')result={cases:await service.list(auth)};
      else if(path==='/cases'&&method==='POST'){result={case:await service.create(auth)};status=201;}
      else if(path==='/staff'&&method==='GET')result={staff:await service.staffList(auth)};
      else if(path==='/staff'&&method==='POST')result=await service.grantStaff(auth,await readJson(request));
      else {
        const match=path.match(/^\/cases\/([0-9a-f-]{36})(?:\/(.*))?$/i);
        requireIr(match,'not_found','Rota não encontrada.',404);
        const [,caseId,action='']=match;
        if(!action&&method==='GET')result={case:await service.get(auth,caseId)};
        else if(action==='actions'&&method==='POST')result={case:await service.command(auth,caseId,await readJson(request))};
        else if(action==='documents'&&method==='POST')result={case:await service.upload(auth,caseId,{buffer:await readBuffer(request,10*1024*1024),name:url.searchParams.get('name'),type:url.searchParams.get('type')})};
        else if(action==='proposals'&&method==='POST')result={case:await service.publishProposal(auth,caseId,await readJson(request))};
        else if(/^proposals\/[0-9a-f-]{36}\/accept$/i.test(action)&&method==='POST')result={case:await service.acceptProposal(auth,caseId,action.split('/')[1],await readJson(request))};
        else if(/^proposals\/[0-9a-f-]{36}\/checkout$/i.test(action)&&method==='POST')result=await service.createCheckout(auth,caseId,action.split('/')[1]);
        else if(/^documents\/[0-9a-f-]{36}\/extract$/i.test(action)&&method==='POST')result={case:await service.extract(auth,caseId,action.split('/')[1])};
        else if((/^documents\/[0-9a-f-]{36}$/i.test(action)||action==='generate')&&method==='GET') {
          const file=action==='generate'?await service.generate(auth,caseId,url.searchParams.get('kind')||'dossier'):await service.download(auth,caseId,action.split('/')[1]);
          response.writeHead(200,{'content-type':file.mime,'content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,'content-length':file.buffer.length});response.end(file.buffer);return true;
        }else throw new IrError('not_found','Rota não encontrada.',404);
      }
      sendJson(response,status,result);
    }catch(error){sendJson(response,error instanceof IrError?error.statusCode:error.code==='BODY_TOO_LARGE'?413:500,{error:error instanceof IrError?error.code:'ir_request_failed',message:error instanceof IrError?error.message:'Não foi possível concluir a solicitação. Atualize e tente novamente.'});}
    return true;
  };
}
