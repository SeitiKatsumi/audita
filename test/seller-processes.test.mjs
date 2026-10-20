import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PGlite } from '@electric-sql/pglite';
import { createAuditService } from '../services/audit.service.mjs';
import { createSellerReviewService } from '../services/seller-review.service.mjs';
import { summarizeSellerData } from '../services/seller-documents.service.mjs';
import { saveSellerProcesses, readSellerProcessBatch } from '../services/seller-processes.service.mjs';

const env = { AUDITA_PROFILE_ENCRYPTION_KEY: 'fictitious-process-storage-encryption-key-for-tests-only' };
const owner = { tenantId:1,user:{id:811} };
const records = count => Array.from({length:count},(_,index)=>({numeroProcesso:`FICTICIO-${index+1}`,classe:'Processo fictício para teste',token:'never-store-this-token'}));

test('20,000 returned processes are preserved encrypted in bounded batches, with restricted records omitted and no preview truncation at 20',async()=>{
  const root=await mkdtemp(join(tmpdir(),'audita-processes-'));
  try{
    const data={documentoConsultado:'52998224725',totalProcessos:20000,processos:records(20000)};
    data.processos[19999]={segredoJustica:true,numeroProcesso:'SECRET-CASE',nome:'secret-name'};
    const collection=await saveSellerProcesses(data,'fictitious-audit',{root,env});
    assert.equal(collection.total,20000);assert.equal(collection.batches.length,400);
    const first=await readSellerProcessBatch(collection,collection.batches[0],{root,env});
    const last=await readSellerProcessBatch(collection,collection.batches.at(-1),{root,env});
    assert.equal(first.processos.length,50);assert.equal(first.processos[0].numeroProcesso,'FICTICIO-1');
    assert.deepEqual(last.processos.at(-1),{segredoJustica:true});
    assert(!JSON.stringify(first).includes('never-store-this-token'));
    const ciphertext=await readFile(join(root,collection.batches[0].storageName),'utf8');
    assert(!ciphertext.includes('FICTICIO-1'));assert(!ciphertext.includes('52998224725'));
    const preview=summarizeSellerData('ProcessosJudiciaisCompleta',data);
    assert(preview.details['Processo 200'].includes('FICTICIO-200'));assert.equal(preview.details['Processo 201'],undefined);
    await writeFile(join(root,collection.batches[0].storageName),'corrupted');
    await assert.rejects(readSellerProcessBatch(collection,collection.batches[0],{root,env}));
    await assert.rejects(readSellerProcessBatch(collection,{...collection.batches[1],storageName:'../outside.enc'},{root,env}));
  }finally{await rm(root,{recursive:true,force:true});}
});

test('seller and certificate analyses read 200 per execution, continue after restart without duplicate reads, and page only owned saved processes',async()=>{
  for(const flow of ['seller','certificates']){
    const root=await mkdtemp(join(tmpdir(),'audita-processes-')),db=new PGlite();
    try{
      await db.exec((await readFile(new URL('../db/schema.sql',import.meta.url),'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
      await db.exec("INSERT INTO audita_users(id,tenant_id,email,name,password_hash) VALUES(811,1,'processes@example.test','Pessoa Fictícia','disabled'),(812,1,'other-processes@example.test','Outra Conta','disabled')");
      const analyzed=[];let collections=0;
      const data={documentoConsultado:'52998224725',totalProcessos:451,processos:records(451)};
      const audit=createAuditService({getDb:()=>({pool:db,dbReady:true}),getAuthContext:async req=>req?.auth||owner,logError:()=>{},customCollectors:{tjdft:{collect:async input=>{
        collections++;const processCollection=await saveSellerProcesses(data,input.consultaId,{root,env});
        return{status:'success',resultado:'indisponivel',dados:{certidoes:[{tipo:'Processos fictícios',kind:'data',status:'success',evidenceIdentityVerified:true,evidenceData:{totalProcessos:451},processCollection,checkedAt:'2026-10-19'}]}};
      }}}});
      const ai={ready:()=>true,read:async source=>{
        if(source.details.processos){assert(source.details.processos.length<=50);for(const record of source.details.processos)analyzed.push(record.numeroProcesso);}
        return{summary:'Dados fictícios recebidos para conferência.',identity:'compatible',outcome:'informational',issuedAt:null,validUntil:null,limitations:[],findings:[]};
      }};
      const options={getDb:()=>({pool:db,dbReady:true}),auditService:audit,ai,getAnalysisAccess:async()=>true,readProcessBatch:(collection,batch)=>readSellerProcessBatch(collection,batch,{root,env})};
      let review=createSellerReviewService(options);
      const request={auth:owner,body:{tipoDocumento:'cpf',documento:'52998224725',fontes:['tjdft'],extraFields:{sellerFlow:flow,stateCourtFields:{fullName:'Pessoa Fictícia'}}}};
      const {consultaId:id}=await audit.startAudit(request);
      for(let i=0;i<300;i++){const state=await audit.findAudit(id,request);if(state.resultados?.every(source=>source.status==='success'))break;await new Promise(resolve=>setTimeout(resolve,5));}
      const selection=flow==='certificates'?{mode:'general'}:{};
      for(const expected of [200,400,451]){
        await review.start(id,owner,request,true,undefined,{...selection,...(expected>200?{continueProcesses:true,continueFrom:analyzed.length}:{})});await review.wait(id);
        const state=await review.get(id,owner,request);
        assert.equal(state.processCoverage.analyzed,expected,JSON.stringify(state));
        assert.equal(state.processCoverage.remaining,451-expected);assert.equal(state.processCoverage.complete,expected===451);
        assert.equal(analyzed.length,expected);assert.equal(new Set(analyzed).size,expected);
        if(expected<451){assert(state.report.scopeNotice.includes('Análise parcial'));assert.notEqual(state.report.safetyScore?.band,'green');}
        if(expected===400){await review.start(id,owner,request,true,undefined,{...selection,continueProcesses:true,continueFrom:200});assert.equal(analyzed.length,400,'retrying the same continuation cannot start another 200');}
        const priorReads=analyzed.length;
        await review.start(id,owner,request,true,undefined,selection);
        assert.equal(analyzed.length,priorReads,'opening an existing completed execution does not advance another paid AI batch');
        review=createSellerReviewService(options);
      }
      const page=await review.processes(id,owner,request,'tjdft:0',400);
      assert.equal(page.records.length,50);assert.equal(page.records[0].index,401);assert.equal(page.total,451);
      const last=await review.processes(id,owner,request,'tjdft:0',450);assert.equal(last.records.length,1);assert.equal(last.records[0].data.numeroProcesso,'FICTICIO-451');
      const stranger={tenantId:1,user:{id:812}};
      await assert.rejects(review.processes(id,stranger,{auth:stranger},'tjdft:0',0),{code:'seller_analysis_not_found'});
      await assert.rejects(review.start(id,owner,request,false,undefined,{...selection,continueProcesses:true,continueFrom:451}),{code:'seller_ai_consent_required'});
      assert.equal(collections,1,'continuation and paging never repeat the original provider collection');
    }finally{await db.close();await rm(root,{recursive:true,force:true});}
  }
});
