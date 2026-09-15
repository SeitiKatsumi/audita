import {debtRequire} from './bank-debt-domain.mjs';
import {debtHash} from './bank-debt-pdf.mjs';
export function createBankDebtHandler({service,getAuth,readJson,readBuffer,sendJson}) {
  return async(request,response,url)=>{
    if(!url.pathname.startsWith('/api/bank-debt/'))return false;
    response.setHeader('cache-control','no-store');response.setHeader('x-content-type-options','nosniff');
    try{
      const auth=await getAuth(request),path=url.pathname.slice('/api/bank-debt'.length),method=request.method;
      if(method!=='GET'){const origin=request.headers.origin;debtRequire(request.headers['sec-fetch-site']!=='cross-site'&&(!origin||new URL(origin).host===request.headers.host),'Origem inválida.',403);}
      let result;
      if(path==='/config'&&method==='GET')result=await service.configuration(auth);
      else if(path==='/cases'&&method==='GET')result={cases:await service.list(auth)};
      else if(path==='/cases'&&method==='POST')result={case:await service.create(auth)};
      else {
        const match=path.match(/^\/cases\/([0-9a-f-]{36})(?:\/(actions|checkout|documents)(?:\/([a-zA-Z0-9-]+))?)?$/i);debtRequire(match,'Rota não encontrada.',404);
        const [,id,action,doc]=match;
        if(!action&&method==='GET')result={case:await service.get(auth,id)};
        else if(action==='actions'&&method==='POST'){const input=await readJson(request);result={case:input.action==='analyze'?await service.startAnalysis(auth,id,input):await service.command(auth,id,input,{ip:request.socket.remoteAddress,userAgent:request.headers['user-agent']})};}
        else if(action==='checkout'&&method==='POST')result=await service.createCheckout(auth,id,await readJson(request));
        else if(action==='documents'&&!doc&&method==='POST')result={case:await service.upload(auth,id,{bytes:await readBuffer(request,10*1024*1024),name:url.searchParams.get('name'),kind:url.searchParams.get('kind')})};
        else if(action==='documents'&&doc&&method==='GET'){const f=await service.download(auth,id,doc);response.writeHead(200,{'content-type':f.mime,'content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,'content-length':f.bytes.length});response.end(f.bytes);return true;}
        else debtRequire(false,'Rota não encontrada.',404);
      }
      if(result.case?.legalTexts)result.case.termsHash=debtHash(JSON.stringify(result.case.legalTexts));
      sendJson(response,200,result);
    }catch(e){sendJson(response,e.status|| (e.code==='BODY_TOO_LARGE'?413:e instanceof SyntaxError?400:500),{message:e.status?e.message:'Não foi possível concluir. Atualize a tela e tente novamente.'});}
    return true;
  };
}
