import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { PGlite } from "@electric-sql/pglite";
import { createAuditService, validateCnpj } from "../services/audit.service.mjs";
import { normalizeDfSellerInput, normalizeSellerInput, buildDfSellerAuditRequest } from "../services/seller-analysis.service.mjs";
import { planSellerDocuments,getSellerDocumentCoverage } from "../services/seller-documents.service.mjs";
import { collectAutonomousCertificates, planAutonomousCertificates,getAutonomousCertificateCoverage } from "../services/state-court-autonomous.service.mjs";
import { sellerStatePlans,sellerQueriesForState } from '../services/seller-state-plan.mjs';
import { createDirectDataSellerService } from "../services/direct-data-seller.service.mjs";
import { createSellerReviewService } from '../services/seller-review.service.mjs';
import { personNamesMatch, normalizePersonBirthDate } from "../services/direct-data-person.service.mjs";

test("seller POST validates selection and consent, persists the selected source and needs no unrelated identity fields", async () => {
  const pg = new PGlite();
  try {
    await pg.exec((await readFile(new URL("../db/schema.sql", import.meta.url), "utf8")).replace("CREATE EXTENSION IF NOT EXISTS pgcrypto;", ""));
    await pg.exec("INSERT INTO audita_users(id,tenant_id,email,name,password_hash) VALUES (811,1,'seller-api@example.test','Pessoa Teste','fixture')");
    const owner = { tenantId: 1, user: { id: 811 }, unauthorized: false };
    const auth = async (request) => request.auth || { unauthorized: true };
    const providerCalls = [], collectorInputs = [], errors = [];
    let enrichmentCalls = 0, courtCalls = 0;
    const provider = createDirectDataSellerService({
      env: { DIRECT_DATA_SELLER_ENABLED: "true", DIRECT_DATA_TOKEN: "fixture-token" },
      fetchImpl: async (url, options) => {
        providerCalls.push({ url, options });
        return new Response(JSON.stringify({ metaDados: { resultadoId: 1, resultado: "Sucesso", consultaUid: "fixture-protestos" }, retorno: { documentoConsultado: "52998224725", constamProtestos: false, numeroTotalProtestos: 0 } }), { status: 200 });
      },
    });
    const auditService = createAuditService({
      getDb: () => ({ pool: pg, dbReady: true }), getAuthContext: auth, logError: (...args) => errors.push(args),
      getSellerDocumentConfiguration: provider.getStatus,
      querySellerDocument: (input, context) => { collectorInputs.push({ input, context }); return provider.query(input, context); },
      customCollectors: {
        seller_documents: {},
        tjdft: { collect: (input) => collectAutonomousCertificates(input, { configuration: { configured: true, allowedUfs: ["AP"] }, queryCertificate: async () => { courtCalls++; throw new Error("unexpected_court_call"); } }) },
      },
    });
    const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
    const genericStart = source.indexOf('  if (pathname === "/audit" && request.method === "POST")');
    const genericEnd = source.indexOf('  if (pathname === "/api/seller-analysis/coverage"', genericStart);
    const sellerStart = source.indexOf('  if (["/api/seller-analysis/df", "/api/seller-analysis"].includes(pathname)');
    const sellerEnd = source.indexOf("  const publicAuditEvidenceMatch =", sellerStart);
    assert.ok(genericStart > 0 && genericEnd > genericStart && sellerStart > 0 && sellerEnd > sellerStart);
    const context = vm.createContext({
      crypto, auditService, normalizeDfSellerInput, normalizeSellerInput, normalizePersonBirthDate, buildDfSellerAuditRequest, planSellerDocuments, planAutonomousCertificates, validateCnpj, personNamesMatch,
      getSellerDocumentCoverage,getAutonomousCertificateCoverage,sellerStatePlans,sellerQueriesForState,sellerReviewService:{ready:()=>true},
      getTenantIdForRequest: auth, readJsonBody: async (request) => request.body,
      directDataSellerService: provider,
      directDataCertificatesService: { getStatus: () => ({ configured: true, allowedUfs: ["AP"] }) },
      directDataPersonService: { lookup: async () => { enrichmentCalls++; throw new Error("unexpected_enrichment"); } },
      sendJson: (response, status, body) => { response.status = status; response.body = body; },
    });
    vm.runInContext(`async function handle(pathname, request, response) { ${source.slice(genericStart, genericEnd)} ${source.slice(sellerStart, sellerEnd)} }`, context);
    const post = async (body, actor = owner, pathname = "/api/seller-analysis") => {
      const response = {};
      assert.equal(await context.handle(pathname, { method: "POST", body, auth: actor }, response), true);
      return response;
    };
    const waitForAudit = async (id) => {
      for (let attempt = 0; attempt < 200; attempt++) {
        const row = (await pg.query("SELECT status FROM audita_audits WHERE public_id=$1", [id])).rows[0];
        if (row && ["success", "failed"].includes(row.status)) return row;
        await new Promise((done) => setTimeout(done, 5));
      }
      assert.fail("audit did not finish");
    };
    const body = { cpf: "52998224725", fullName: "Pessoa Teste", ufs: [], sellerQueries: ["protestos"], authorizationConfirmed: true, paidQueryConfirmed: true };
    assert.equal((await post({ ...body }, null)).status, 401);
    for (const override of [{ authorizationConfirmed: false }, { paidQueryConfirmed: false }, { sellerQueries: ["unknown"] }, { sellerQueries: [] }, { ufs: ["XX"] }, { companyCnpjs: ["11111111111111"] }]) {
      assert.equal((await post({ ...body, ...override })).status, 400);
    }
    assert.equal(providerCalls.length, 0);
    assert.equal(Number((await pg.query("SELECT count(*) AS count FROM audita_audits")).rows[0].count), 0);

    const started = await post({ ...body });
    assert.equal(started.status, 202);
    assert.equal(started.body.identityEnriched, false);
    assert.equal((await waitForAudit(started.body.consultaId)).status, "success");
    const persisted = (await pg.query("SELECT requested_by_user_id,authorization_confirmed,request_payload FROM audita_audits WHERE public_id=$1", [started.body.consultaId])).rows[0];
    assert.equal(persisted.requested_by_user_id, 811);
    assert.equal(persisted.authorization_confirmed, true);
    assert.deepEqual(persisted.request_payload.fontes, ["seller_documents"]);
    const executions = (await pg.query("SELECT fonte,status,dados_json FROM audita_audit_executions WHERE audit_id=(SELECT id FROM audita_audits WHERE public_id=$1)", [started.body.consultaId])).rows;
    assert.equal(executions.length, 1);
    assert.equal(executions[0].fonte, "seller_documents");
    assert.equal(executions[0].dados_json.certidoes[0].id, "protestos");
    assert.equal(executions[0].dados_json.certidoes[0].status, "success");
    assert.equal(providerCalls.length, 1);
    assert.equal(providerCalls[0].url.pathname, "/api/ProtestosOnline");
    assert.equal(providerCalls[0].options.headers.Authorization, "Bearer fixture-token");
    assert.equal(collectorInputs[0].input.authorizationConfirmed, true);
    assert.equal(collectorInputs[0].input.paidQueryConfirmed, true);
    assert.equal(collectorInputs[0].context.userId, owner.user.id);
    assert.equal(enrichmentCalls, 0);
    assert.equal(courtCalls, 0);
    assert.equal(errors.length, 0);

    for (const extraFields of [{}, { sellerQueries: ["protestos"], autonomousUfs: ["AP"], paidQueryConfirmed: true, authorizationConfirmed: false, stateCourtFields: { fullName: "Pessoa Teste" } }]) {
      const generic = await post({ documento: body.cpf, tipoDocumento: "cpf", extraFields }, owner, "/audit");
      assert.equal(generic.status, 202);
      assert.equal((await waitForAudit(generic.body.consultaId)).status, "failed");
    }
    assert.equal(providerCalls.length, 1, "generic/default audits without consent must not trigger paid queries");
    assert.equal(courtCalls, 0);
    assert.equal(enrichmentCalls, 0);
    assert.equal((await post({...body,flow:'certificates',aiConsent:true})).status,400,'data queries are not certificate issuance');
    const issuance=await post({...body,flow:'certificates',aiConsent:true,sellerQueries:['cndt']});
    assert.equal(issuance.status,202,'issuance works without an AI integration');
    await waitForAudit(issuance.body.consultaId);
    const saved=(await pg.query('SELECT request_payload FROM audita_audits WHERE public_id=$1',[issuance.body.consultaId])).rows[0].request_payload;
    assert.equal(saved.sellerFlow,'certificates');assert.equal(saved.sellerAiConsent,false);
    const history=await auditService.listAuditHistory({auth:owner});
    assert.equal(history.audits.find(a=>a.consultaId===issuance.body.consultaId).sellerFlow,'certificates');
    const review=createSellerReviewService({getDb:()=>({pool:pg,dbReady:true}),auditService,ai:{ready:()=>{throw Error('AI must not run');}}});
    await assert.rejects(()=>review.start(issuance.body.consultaId,owner,{auth:owner},true),/certificate_collection_only/);
    const beforeAutomatic=providerCalls.length;
    for(const override of [{state:'XX'},{state:'SP',aiConsent:false},{state:'SP',municipality:'Cidade inválida'},{state:'SP',paidQueryConfirmed:false}]) {
      assert.equal((await post({...body,automatic:true,aiConsent:true,...override})).status,400);
    }
    assert.equal(providerCalls.length,beforeAutomatic,'invalid automatic requests never call providers');
    const automaticRequest={...body,automatic:true,state:'SP',aiConsent:true,sellerQueries:['unknown'],ufs:['XX'],companyCnpjs:['invalid']};
    const automatic=await post(automaticRequest);
    assert.equal(automatic.status,202);
    await waitForAudit(automatic.body.consultaId);
    const automaticSaved=(await pg.query('SELECT request_payload FROM audita_audits WHERE public_id=$1',[automatic.body.consultaId])).rows[0].request_payload;
    assert.equal(automaticSaved.extraFieldsProvided.sellerState,true);
    assert.equal(automaticSaved.extraFieldsProvided.discoverCompanies,true);
    assert.equal(automaticRequest.companyCnpjs.length,0);
    assert.equal(automaticRequest.sellerQueries.length,13);
    assert.ok(automaticRequest.sellerQueries.includes('cnd-sp'));
    assert.ok(!automaticRequest.sellerQueries.includes('cnd-mg'));
    const automaticAudit=await auditService.findAudit(automatic.body.consultaId,{auth:owner});
    assert.deepEqual(automaticAudit.resultados[0].dados.certidoes.map(r=>r.id),Array.from(automaticRequest.sellerQueries));
  } finally {
    await pg.close();
  }
});

test('CPF enrichment asks only missing RG; CNPJ starts company sources and persists through report/PDF without PF data', async () => {
  const pg=new PGlite();
  try {
    await pg.exec((await readFile(new URL('../db/schema.sql',import.meta.url),'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
    await pg.exec("INSERT INTO audita_users(id,tenant_id,email,name,password_hash) VALUES(812,1,'company-seller@example.test','Pessoa Ficticia','fixture')");
    const owner={tenantId:1,user:{id:812},unauthorized:false}, auth=async request=>request.auth||{unauthorized:true};
    const calls=[],courtInputs=[];let lookups=0;
    const companyProfile={status:'success',dados:{cnpj:'04252011000110',razaoSocial:'Empresa Ficticia Ltda',uf:'AP',qsa:[{nome:'Socio Ficticio',qualificacao:'Administrador'}]}};
    const auditService=createAuditService({getDb:()=>({pool:pg,dbReady:true}),getAuthContext:auth,logError:()=>{},
      getSellerDocumentConfiguration:()=>({configured:true}),
      customCollectors:{seller_documents:{collectCompany:async()=>companyProfile},tjdft:{collect:async input=>{courtInputs.push(input);return {status:'success',resultado:'nada_consta',dados:{certidoes:[{tipo:'AP Civel',status:'success',resultado:'nada_consta',rawText:'Certidao ficticia para teste sem apontamentos.'}]}};}}},
      querySellerDocument:async input=>{calls.push(input);return {result:{status:'success',payload:{retorno:{documentoConsultado:input.parameters.CNPJ||input.parameters.CPF,possuemDebitos:false}}}};},
    });
    const review=createSellerReviewService({getDb:()=>({pool:pg,dbReady:true}),auditService,ai:{ready:()=>true,read:async()=>({summary:'Cadastro empresarial obtido no material ficticio.',identity:'compatible',outcome:'informational',issuedAt:null,validUntil:null,limitations:[],findings:[]})}});
    const code=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
    const sandbox=vm.createContext({crypto,auditService,normalizeDfSellerInput,normalizeSellerInput,normalizePersonBirthDate,buildDfSellerAuditRequest,planSellerDocuments,planAutonomousCertificates,validateCnpj,personNamesMatch,sellerStatePlans,sellerQueriesForState,getSellerDocumentCoverage,getAutonomousCertificateCoverage,sellerReviewService:review,
      collectSellerCompany:async()=>companyProfile,
      getTenantIdForRequest:auth,readJsonBody:async request=>request.body,sendJson:(response,status,body)=>Object.assign(response,{status,body}),
      directDataSellerService:{getStatus:()=>({configured:true})},directDataCertificatesService:{getStatus:()=>({configured:true,allowedUfs:['AP']})},
      directDataPersonService:{lookup:async()=>{lookups++;return {result:{document:'52998224725',fullName:'Pessoa Ficticia',motherName:'Mae Ficticia',birthDate:'1980-02-15',gender:'Feminino',rg:''}};}},
    });
    vm.runInContext(`async function handle(pathname,request,response){${code.slice(code.indexOf('  if (["/api/seller-analysis/df"'),code.indexOf('  const sellerReviewMatch ='))}}`,sandbox);
    const post=async(body,actor=owner)=>{const response={};await sandbox.handle('/api/seller-analysis',{method:'POST',body,auth:actor},response);return response;};
    const base={automatic:true,state:'AP',authorizationConfirmed:true,paidQueryConfirmed:true,aiConsent:true,flow:'seller'};
    const cpf={...base,documentType:'cpf',document:'52998224725'};
    const pending=await post({...cpf});assert.equal(pending.status,422);assert.deepEqual(Array.from(pending.body.missingFields),['rg']);assert.equal(pending.body.identity.birthDate,'1980-02-15');assert.equal(lookups,1);assert.equal(courtInputs.length,0);assert.equal(calls.length,0);
    const completed=await post({...cpf,...pending.body.identity,rg:'12345678'});assert.equal(completed.status,202);assert.equal(lookups,1,'completed identity avoids another lookup');
    const wait=async id=>{for(let i=0;i<150;i++){const result=await auditService.findAudit(id,{auth:owner});if(result.resultados?.length&&result.resultados.every(row=>!['running','pending'].includes(row.status)))return result;await new Promise(resolve=>setTimeout(resolve,10));}assert.fail('collection timed out');};
    await wait(completed.body.consultaId);assert.equal(courtInputs[0].extraFields.stateCourtFields.birthDate,'15/02/1980');assert.equal(courtInputs[0].extraFields.stateCourtFields.gender,'Feminino');
    const before=calls.length;
    const company={...base,documentType:'cnpj',document:'04252011000110'};
    assert.equal((await post({...company,document:'11111111111111'})).status,400);
    assert.equal((await post({...company},null)).status,401);assert.equal(calls.length,before);
    const start=await post({...company});assert.equal(start.status,202);
    const result=await wait(start.body.consultaId);assert.equal(result.subjectName,'Empresa Ficticia Ltda');assert.equal(result.tipoDocumento,'cnpj');
    assert.equal(courtInputs.length,1,'company uses company coverage, never PF court collectors');assert.equal(lookups,1);
    assert.ok(calls.slice(before).length>0);assert.ok(calls.slice(before).every(call=>call.parameters.CNPJ==='04252011000110'&&!call.parameters.CPF&&!call.parameters.DATANASCIMENTO));
    await review.start(start.body.consultaId,owner,{auth:owner},true);await review.wait(start.body.consultaId);
    const report=await review.get(start.body.consultaId,owner);assert.equal(report.status,'completed');assert.equal(report.report.subject.name,'Empresa Ficticia Ltda');
    assert.equal((await review.pdf(start.body.consultaId,owner)).subarray(0,5).toString(),'%PDF-');
    const restored=createSellerReviewService({getDb:()=>({pool:pg,dbReady:true}),auditService,ai:{ready:()=>true}});
    assert.equal((await restored.get(start.body.consultaId,owner)).status,'completed');
    await assert.rejects(()=>restored.get(start.body.consultaId,{tenantId:1,user:{id:813}}),/seller_analysis_not_found/);
    sandbox.directDataPersonService.lookup=async()=>{lookups++;return {unavailable:true,reason:'provider_temporarily_unavailable'};};
    const fallback=await post({...cpf,state:'ES'});
    assert.equal(fallback.status,503);assert.equal(fallback.body.motherNameRequired,false);
    assert.deepEqual(Array.from(fallback.body.missingFields),['fullName']);
    const manual=await post({...cpf,state:'ES',fullName:'Pessoa Ficticia'});
    assert.equal(manual.status,202);assert.equal(lookups,2,'manual fallback avoids another lookup');await wait(manual.body.consultaId);
  } finally {await pg.close();}
});
