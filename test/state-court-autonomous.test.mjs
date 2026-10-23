import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import { collectAutonomousCertificates, certificatePdfMatches, certificateScopeMatches, downloadCertificateEvidence, getAutonomousCertificateCoverage, planAutonomousCertificates } from "../services/state-court-autonomous.service.mjs";
import { findStateCourtProfile } from '../services/state-courts.service.mjs';
const configuration = { configured: true, allowedUfs: ["AP"], pdfTotalCostBrl: 0.54 };

test("autonomous plan rejects unsupported coverage and deduplicates states", () => {
  assert.throws(() => planAutonomousCertificates(["SP"], configuration), /unsupported/);
  assert.throws(() => planAutonomousCertificates(["AP"], {}), /unsupported/);
  assert.equal(planAutonomousCertificates(["AP", "AP"], configuration).certificates.length, 2);
  assert.equal(planAutonomousCertificates(["AP"], configuration).maxProviderCostBrl, 1.08);
  const selected=planAutonomousCertificates(['AP'],configuration,['AP:Cível']);assert.equal(selected.certificates.length,1);assert.equal(selected.maxProviderCostBrl,.54);
  assert.throws(()=>planAutonomousCertificates(['AP'],configuration,['DF:Cível']),/invalid_autonomous_certificate_selection/);
});

test("autonomous batch keeps a failed certificate pending in the outcome and preserves verified PDFs", async () => {
  const buffer = Buffer.from("%PDF-test");
  const progress = [];
  let requests = 0;
  const input = { consultaId: "test-batch", documento: "52998224725", tipoDocumento: "cpf", extraFields: { authorizationConfirmed: true, autonomousUfs: ["AP"], paidQueryConfirmed: true, stateCourtFields: { fullName: "Pessoa Teste" } }, onProgress: async (value) => progress.push(value.completed) };
  const options = { configuration, queryCertificate: async (request) => {
    requests++;
    assert.equal(request.generatePdf, true);
    return requests === 1 ? { result: { certificate: { evidenceUrl: "https://apiv3.directd.com.br/evidence",issueDate:'23/10/2026',number:'TEST-1' }, evidenceData:{extra:{validadeDias:90}}, analysis: { occurrence: false } } } : { failed: true, reason: "provider_timeout" };
  }, download: async () => buffer, readPdf: async () => "TRIBUNAL DO AMAPA CERTIDAO CIVEL Pessoa Teste 52998224725", savePdf: async () => ({ pdfPath: "private-test.pdf" }) };
  await assert.rejects(() => collectAutonomousCertificates({ ...input, extraFields: { ...input.extraFields, paidQueryConfirmed: false } }, options), /paid_query/);
  assert.equal(requests, 0);
  const result = await collectAutonomousCertificates(input, options);
  assert.equal(result.dados.certidoes[0].details['Emissão'],'23/10/2026');
  assert.equal(result.dados.certidoes[0].details['Número'],'TEST-1');
  assert.equal(result.dados.certidoes[0].evidenceData.extra.validadeDias,90);
  assert.equal(result.resultado, "indisponivel");
  assert.equal(result.dados.certidoesBaixadas, 1);
  assert.equal(result.dados.certidoesComFalha.length, 1);
  assert.equal(result.dados.progress.stage, "completed");
  assert.deepEqual(progress, [0, 1]);
  assert.equal(certificatePdfMatches(buffer, "CERTIDAO Pessoa Teste 11111111111", input.documento, "Pessoa Teste"), false);
  assert.equal(certificatePdfMatches(buffer, "CERTIDAO Pessoa Teste 529982247250", input.documento, "Pessoa Teste"), false);
  assert.equal(certificatePdfMatches(buffer, "CERTIDAO Pessoa Teste 529.982.247-25", input.documento, "  "), false);
  assert.equal(certificatePdfMatches(buffer, "CERTIDAO Pessoa Teste 529.982.247-25", input.documento, "Pessoa Teste"), true);
  assert.equal(certificateScopeMatches("Certidão de Distribuição de Ação Militar", "Certidão de Distribuição de Ação Criminal"), false);
  assert.equal(certificateScopeMatches("Tribunal do Pará CERTIDÃO CÍVEL", "CERTIDÃO CÍVEL", "AP"), false);
  assert.equal(certificateScopeMatches("Espírito Santo CERTIDÃO NEGATIVA DE PRIMEIRA INSTÂNCIA CÍVEL. Observações: ações de natureza criminal.", "CERTIDÃO NEGATIVA DE PRIMEIRA INSTÂNCIA CRIMINAL", "ES"), false);
  assert.equal(certificateScopeMatches("Bahia CERTIDÃO ESTADUAL CRIMINAIS", ["CERTIDÃO ESTADUAL CRIMINAL","CERTIDÃO ESTADUAL CRIMINAIS"], "BA"), true);
  await assert.rejects(() => downloadCertificateEvidence("https://127.0.0.1/document.pdf"), /invalid_evidence_host/);
});

test("autonomous certificates require explicit consent before paid queries or public portal collection", async () => {
  let calls = 0;
  const options = { configuration, queryCertificate: async () => { calls++; }, collectPortal: async () => { calls++; } };
  for (const uf of ["AP", "DF"]) {
    for (const authorizationConfirmed of [undefined, false, "true"]) {
      await assert.rejects(() => collectAutonomousCertificates({
        consultaId: "test-consent", documento: "52998224725", tipoDocumento: "cpf",
        extraFields: { authorizationConfirmed, autonomousUfs: [uf], paidQueryConfirmed: true, stateCourtFields: { fullName: "Pessoa Teste" } },
      }, options), /authorization_required/);
    }
  }
  assert.equal(calls, 0);
});

test('unhomologated CNPJ candidates cannot enter plans or billing without internal opt-in',()=>{
  const all=getAutonomousCertificateCoverage(configuration,{includeCandidates:true});
  const candidate=all.certificates.find(c=>c.provider==='direct_data'&&c.documentTypes.includes('cnpj')&&!c.validatedDocumentTypes.includes('cnpj'));
  assert(candidate,'catalog preserves candidates until real per-subject evidence exists');
  const approved=getAutonomousCertificateCoverage(configuration).certificates.find(c=>c.id===candidate.id);
  assert(!approved?.documentTypes.includes('cnpj'));
  assert.throws(()=>planAutonomousCertificates([candidate.uf],configuration,[candidate.id],'cnpj'),/unsupported_autonomous_uf|invalid_autonomous_certificate_selection/);
  const plan=planAutonomousCertificates([candidate.uf],configuration,[candidate.id],'cnpj',{includeCandidates:true});
  assert.equal(plan.certificates.length,1);
  assert.equal(plan.maxProviderCostBrl,.54);
  assert.deepEqual(plan.requiredIdentityFields,[]);
  assert.throws(()=>planAutonomousCertificates([candidate.uf],{},[candidate.id],'cnpj',{includeCandidates:true}),/unsupported_autonomous_uf/);
  assert.throws(()=>planAutonomousCertificates([candidate.uf],configuration,[candidate.id],'other',{includeCandidates:true}),/invalid_autonomous_subject/);
});

test('CNPJ collection forwards its document type and still rejects wrong identity, title and state',async()=>{
  const candidate=getAutonomousCertificateCoverage(configuration,{includeCandidates:true}).certificates.find(c=>c.provider==='direct_data'&&c.documentTypes.includes('cnpj')&&!c.validatedDocumentTypes.includes('cnpj'));
  assert(candidate);
  const document='04252011000110',fullName='Empresa Fictícia Ltda',state=findStateCourtProfile(candidate.uf).stateName;
  const input={consultaId:'fixture-company',documento:document,tipoDocumento:'cnpj',extraFields:{authorizationConfirmed:true,paidQueryConfirmed:true,autonomousUfs:[candidate.uf],autonomousCertificates:[candidate.id],stateCourtFields:{fullName}}};
  let requests=0,saved=0,text=`${state} ${candidate.expectedText} ${fullName} ${document}`;
  const options={configuration,includeCandidates:true,queryCertificate:async request=>{
    requests++;
    assert.equal(request.documentType,'cnpj');assert.equal(request.document,document);assert.equal(request.fullName,fullName);
    assert.equal(request.certificateType,candidate.providerType||candidate.type);assert.equal(request.generatePdf,true);
    return {result:{certificate:{evidenceUrl:'https://apiv3.directd.com.br/fixture'},analysis:{occurrence:false}}};
  },download:async()=>Buffer.from('%PDF-fixture'),readPdf:async()=>text,savePdf:async()=>{saved++;return {pdfPath:'private-company-fixture.pdf'};}};
  await assert.rejects(()=>collectAutonomousCertificates(input,{...options,includeCandidates:false}),/unsupported_autonomous_uf|invalid_autonomous_certificate_selection/);
  await assert.rejects(()=>collectAutonomousCertificates({...input,extraFields:{...input.extraFields,paidQueryConfirmed:false}},options),/paid_query_confirmation_required/);
  await assert.rejects(()=>collectAutonomousCertificates({...input,extraFields:{...input.extraFields,authorizationConfirmed:false}},options),/authorization_required/);
  assert.equal(requests,0);
  const result=await collectAutonomousCertificates(input,options);
  assert.equal(result.dados.certidoesBaixadas,1);assert.equal(saved,1);assert.equal(result.dados.certidoes[0].evidenceIdentityVerified,true);
  for(const [wrong,error]of [[`${state} ${candidate.expectedText} ${fullName} 11222333000181`,'evidence_identity_unverified'],[`${state} CERTIDÃO DE OUTRA NATUREZA ${fullName} ${document}`,'evidence_scope_mismatch'],[`Outro Estado ${candidate.expectedText} ${fullName} ${document}`,'evidence_scope_mismatch']]){
    text=wrong;
    const failed=await collectAutonomousCertificates(input,options);
    assert.equal(failed.dados.certidoesBaixadas,0);assert.equal(failed.dados.certidoes[0].errorMessage,error);
  }
  assert.equal(saved,1,'unverified company PDFs must never be persisted as accepted evidence');
});

test('CNPJ native portal keeps the company subject and legacy certificate id',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'audita-company-fixture-'));
  const pdfPath=join(directory,'fictional.pdf');
  try{
    await writeFile(pdfPath,'%PDF-fixture');
    let calls=0;
    const input={consultaId:'fixture-native-company',documento:'04252011000110',tipoDocumento:'cnpj',extraFields:{authorizationConfirmed:true,autonomousUfs:['DF'],autonomousCertificates:['DF:Cível'],stateCourtFields:{fullName:'Empresa Fictícia Ltda'}}};
    const result=await collectAutonomousCertificates(input,{configuration:{},includeCandidates:true,collectPortal:async request=>{
      calls++;assert.equal(request.tipoDocumento,'cnpj');assert.equal(request.documento,input.documento);assert.equal(request.extraFields.stateCourtUf,'DF');
      assert.deepEqual(request.extraFields.stateCourtCertificateTypes,['civil']);assert.deepEqual(request.extraFields.autonomousUfs,[]);
      return {dados:{certidoes:[{pdfPath,resultado:'nada_consta'}]}};
    },readPdf:async()=>`Distrito Federal CERTIDÃO (AÇÕES CÍVEIS) ${input.extraFields.stateCourtFields.fullName} ${input.documento}`});
    assert.equal(calls,1);assert.equal(result.dados.certidoesBaixadas,1);assert.equal(result.dados.certidoes[0].evidenceIdentityVerified,true);
  }finally{await rm(pdfPath,{force:true});await rmdir(directory);}
});

test('October CNPJ additions are selectable by exact type without enabling unverified CPF or duplicate paid DF certificates',()=>{
  const pairs=[['PA','Cível'],['PI','Cível'],['PI','Criminal'],['SE','Cível'],['AP','Falência e recuperação judicial'],['BA','Falência e recuperação judicial']];
  const configuration={configured:true,allowedUfs:[...new Set(pairs.map(([uf])=>uf)),'DF','MT']};
  for(const [uf,type]of pairs){const plan=planAutonomousCertificates([uf],configuration,[uf+':'+type],'cnpj');assert.equal(plan.certificates.length,1);assert.equal(plan.certificates[0].type,type);}
  for(const uf of ['AP','BA']){
    assert.throws(()=>planAutonomousCertificates([uf],configuration,[uf+':Falência e recuperação judicial'],'cpf'),/invalid_autonomous_certificate_selection/);
    const item=planAutonomousCertificates([uf],configuration,[uf+':Falência e recuperação judicial'],'cnpj').certificates[0];
    assert.equal(item.providerType,'FalênciaRecuperação');
    assert.equal(certificateScopeMatches(findStateCourtProfile(uf).stateName+' CERTIDÃO CÍVEL observação: falência',item.expectedText,uf),false);
  }
  assert.equal(planAutonomousCertificates(['MT'],configuration,['MT:Criminal'],'cpf').certificates.length,1);
  assert.throws(()=>planAutonomousCertificates(['MT'],configuration,['MT:Criminal'],'cnpj'),/unsupported_autonomous_uf|invalid_autonomous_certificate_selection/);
  const df=getAutonomousCertificateCoverage(configuration).certificates.filter(c=>c.uf==='DF'&&/Falência/i.test(c.type));assert.equal(df.length,1);assert.equal(df[0].provider,'portal');
});
