import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { PGlite } from "@electric-sql/pglite";
import { createAuditService, validateCnpj } from "../services/audit.service.mjs";
import { normalizeDfSellerInput, buildDfSellerAuditRequest } from "../services/seller-analysis.service.mjs";
import { planSellerDocuments } from "../services/seller-documents.service.mjs";
import { collectAutonomousCertificates, planAutonomousCertificates } from "../services/state-court-autonomous.service.mjs";
import { createDirectDataSellerService } from "../services/direct-data-seller.service.mjs";
import { createSellerReviewService } from '../services/seller-review.service.mjs';
import { personNamesMatch } from "../services/direct-data-person.service.mjs";

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
      crypto, auditService, normalizeDfSellerInput, buildDfSellerAuditRequest, planSellerDocuments, planAutonomousCertificates, validateCnpj, personNamesMatch,
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
  } finally {
    await pg.close();
  }
});
