import assert from "node:assert/strict";
import test from "node:test";
import { createDirectDataSellerService, DIRECT_DATA_SELLER_ENDPOINTS } from "../services/direct-data-seller.service.mjs";

const AUTH = { tenantId: "tenant-test", user: { id: "user-test" } };
const ENV = { DIRECT_DATA_SELLER_ENABLED: "true", DIRECT_DATA_TOKEN: "test-token" };
const PAYLOAD = { metaDados: { consultaUid: "test-query", resultadoId: 1, resultado: "Sucesso" }, retorno: { possuiOcorrencia: false, numeroCertidao: "TEST-1" } };
const request = (overrides = {}) => ({ requestId: "test-request", endpoint: "TSTCertidaoNegativaDebitosTrabalhistas", parameters: { CPF: "529.982.247-25", GERARCOMPROVANTE: "Habilitar" }, authorizationConfirmed: true, paidQueryConfirmed: true, ...overrides });
const response = (payload = PAYLOAD, status = 200) => new Response(JSON.stringify(payload), { status });

test('a paid certificate order skips the customer wallet; a client body cannot request that bypass',async()=>{
  let calls=0,charges=0;
  const service=createDirectDataSellerService({env:ENV,fetchImpl:async()=>{calls++;return response();},creditsService:{getWallet:async()=>({enabled:true,balance:0}),consume:async()=>{charges++;throw Error('must not charge twice');}}});
  assert.equal((await service.query(request({paidCertificateOrder:true}),AUTH)).insufficientCredits,true);assert.equal(calls,0);
  assert.ok((await service.query(request(),{...AUTH,paidCertificateOrder:true})).result);assert.equal(calls,1);assert.equal(charges,0);
});

test("seller provider requires authorization, payment confirmation, identity, and documented parameters", async () => {
  let calls = 0;
  const service = createDirectDataSellerService({ env: ENV, fetchImpl: async () => { calls++; return response(); } });
  for (const [input, auth, reason] of [
    [null, AUTH, "invalid_request"],
    [request(), null, "authentication_required"],
    [request(), {}, "authentication_required"],
    [request({ authorizationConfirmed: false }), AUTH, "authorization_required"],
    [request({ paidQueryConfirmed: false }), AUTH, "paid_query_confirmation_required"],
    [request({ requestId: "" }), AUTH, "invalid_request_id"],
    [request({ endpoint: "https://invalid.test/api" }), AUTH, "unsupported_endpoint"],
    [request({ endpoint: "__proto__" }), AUTH, "unsupported_endpoint"],
    [request({ parameters: { CPF: "11111111111" } }), AUTH, "invalid_document"],
    [request({ parameters: { CPF: "52998224725", CNPJ: "04252011000110" } }), AUTH, "invalid_document"],
    [request({ parameters: { CPF: "52998224725", TOKEN: "injected" } }), AUTH, "unsupported_parameter"],
    [request({ endpoint: "CertidaoNegativaDebitos", parameters: { CPF: "52998224725" } }), AUTH, "required_parameter_missing"],
    [request({ endpoint: "CertidaoNegativaDebitos", parameters: { CPF: "52998224725", UF: "XX" } }), AUTH, "invalid_uf"],
    [request({ endpoint: "TribunalRegionalFederal", parameters: { CPF: "52998224725", REGIAO: "TRF7", TIPO: "Cível" } }), AUTH, "invalid_region"],
    [request({ endpoint: "TribunalRegionalTrabalho", parameters: { CPF: "52998224725", REGIAO: 25 } }), AUTH, "invalid_region"],
    [request({ endpoint: "ReceitaFederalPessoaJuridica", parameters: { CPF: "52998224725" } }), AUTH, "unsupported_parameter"],
    [request({ endpoint: "CertidaoConjuntaDebitosPessoaFisica", parameters: { CPF: "52998224725", DATANASCIMENTO: "31/02/2000" } }), AUTH, "invalid_birth_date"],
    [request({ endpoint: "CertidaoNegativaDebitosMunicipal", parameters: { CPF: "52998224725", MUNICIPIO: "São Paulo" } }), AUTH, "invalid_municipality"],
  ]) assert.equal((await service.query(input, auth)).reason, reason);
  assert.equal(calls, 0);
  assert.equal(DIRECT_DATA_SELLER_ENDPOINTS.length, 20);
  assert.equal((await createDirectDataSellerService({ env: {} }).query(request(), AUTH)).unavailable, true);
});

test("seller provider sends only GET with Bearer and returns private payload without inferred score", async () => {
  const usage = [];
  const service = createDirectDataSellerService({ env: ENV, now: () => new Date("2026-09-28T12:00:00Z"), recordApiUsage: async (_, entry) => usage.push(entry), fetchImpl: async (url, options) => {
    assert.equal(url.origin, "https://apiv3.directd.com.br");
    assert.equal(url.pathname, "/api/TSTCertidaoNegativaDebitosTrabalhistas");
    assert.equal(url.searchParams.get("CPF"), "52998224725");
    assert.equal(url.searchParams.has("TOKEN"), false);
    assert.equal(url.searchParams.get("Async"), "Habilitar");
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.Authorization, "Bearer test-token");
    return response();
  } });
  const result = await service.query(request({ estimatedCostBrl: 0.36 }), AUTH);
  assert.deepEqual(result.result.payload, PAYLOAD);
  assert.equal(result.result.queriedAt, "2026-09-28T12:00:00.000Z");
  assert.equal(result.result.score, undefined);
  assert.equal(usage[0].actualCost, null);
  assert.equal(usage[0].metadata.estimatedCostBrl, 0.36);
  assert.doesNotMatch(JSON.stringify(usage), /52998224725|test-token/);
});

test("seller provider normalizes formatted dates, accepts documented CNPJ and all region boundaries", async () => {
  const calls = [];
  const service = createDirectDataSellerService({ env: ENV, fetchImpl: async (url) => { calls.push(url); return response(); } });
  const cases = [
    ["CertidaoConjuntaDebitosPessoaFisica", { CPF: "52998224725", DATANASCIMENTO: "01012000" }],
    ["CertidaoNegativaDebitosMunicipal", { CPF: "52998224725", MUNICIPIO: "São Paulo-SP" }],
    ["ReceitaFederalPessoaJuridica", { CNPJ: "04.252.011/0001-10", QSA: "Habilitar" }],
    ["TribunalRegionalFederal", { CPF: "52998224725", REGIAO: "TRF6", TIPO: "FinsEleitorais" }],
    ["TribunalRegionalTrabalho", { CPF: "52998224725", REGIAO: 24, TIPO: "Eletrônico" }],
    ["ProcessosJudiciaisAgrupada", { CPF: "52998224725" }],
    ["ProcessosJudiciaisSimplificada", { CPF: "52998224725" }],
    ["ProcessosJudiciaisCompleta", { CNPJ: "04252011000110" }],
    ["ProtestosOnline", { CNPJ: "04252011000110" }],
    ["ProtestosBasica", { CPF: "52998224725" }],
    ["ProtestosBasica", { CNPJ: "04252011000110" }],
    ["DossieCreditoCompleto", { CNPJ: "04252011000110" }],
    ["DossieCreditoCompleto", { CPF: "52998224725" }],
  ];
  for (const [index, [endpoint, parameters]] of cases.entries()) assert.equal((await service.query(request({ requestId: endpoint+'-'+index, endpoint, parameters }), AUTH)).result.status, "success");
  assert.equal(calls[0].searchParams.get("DATANASCIMENTO"), "01/01/2000");
  assert.equal(calls[2].searchParams.get("CNPJ"), "04252011000110");
  assert(calls.slice(8).every(url=>!url.searchParams.has('GERARCOMPROVANTE')));
});

test("seller async queries poll history without issuing another paid request and accept provider casing", async () => {
  const calls = [];
  const waits = [];
  const service = createDirectDataSellerService({ env: ENV, delay: async (ms) => waits.push(ms), fetchImpl: async (url) => {
    calls.push(url);
    if (calls.length < 3) return response({ MetaDados: { ConsultaUid: "async-test" }, Retorno: null }, calls.length === 1 ? 201 : 202);
    return response({ MetaDados: { ResultadoId: 1, Resultado: "Sucesso", ConsultaUid: "async-test" }, Retorno: { situacao: "Emitida" } });
  } });
  const result = await service.query(request(), AUTH);
  assert.equal(result.result.status, "success");
  assert.equal(result.result.providerReference, "async-test");
  assert.deepEqual(calls.map((url) => url.pathname), ["/api/TSTCertidaoNegativaDebitosTrabalhistas", "/api/Historico/ObterRetornoConsultaAsync", "/api/Historico/ObterRetornoConsultaAsync"]);
  assert.equal(calls[1].searchParams.get("ConsultaUid"), "async-test");
  assert.equal(calls[1].searchParams.has("Async"), false);
  assert.equal(waits.length, 1);
  assert.equal(waits[0], 2000);
});

test("seller provider never treats HTTP 200 errors or empty data as success and caches submitted failures", async () => {
  for (const [payload, status, reason] of [
    [{ ...PAYLOAD, metaDados: { resultadoId: 21, resultado: "Falha Ao Realizar Consulta" } }, 200, "provider_reported_failure"],
    [{ ...PAYLOAD, metaDados: { resultado: false } }, 200, "provider_reported_failure"],
    [{ ...PAYLOAD, metaDados: { Resultado: "Documento Entidade Não Encontrada" } }, 200, "provider_reported_failure"],
    [{ retorno: { documentoConsultado: "52998224725", possuiProcesso: false } }, 200, "provider_reported_failure"],
    [{ metaDados: { resultado: "Sucesso" }, retorno: PAYLOAD.retorno }, 200, "provider_reported_failure"],
    [{ ...PAYLOAD, retorno: {} }, 200, "provider_empty_response"],
    [{ ...PAYLOAD, retorno: [] }, 200, "provider_empty_response"],
    [PAYLOAD, 503, "provider_http_503"],
    [{ retorno: null }, 202, "provider_async_reference_missing"],
    [{ metaDados: { consultaUid: "invalid/uid" } }, 202, "provider_async_reference_invalid"],
  ]) {
    let calls = 0;
    const service = createDirectDataSellerService({ env: ENV, fetchImpl: async () => { calls++; return response(payload, status); } });
    const first = await service.query(request(), AUTH);
    assert.equal(first.reason, reason);
    assert.equal(first.providerRequestSubmitted, true);
    assert.equal(first.billingVerificationRequired, true);
    assert.deepEqual(await service.query(request(), AUTH), first);
    assert.equal(calls, 1);
  }
});

test("seller idempotency deduplicates concurrent calls, rejects changed payloads and isolates users/tenants", async () => {
  let calls = 0;
  const service = createDirectDataSellerService({ env: ENV, fetchImpl: async () => { calls++; return response(); } });
  const [one, two] = await Promise.all([service.query(request(), AUTH), service.query(request(), AUTH)]);
  assert.deepEqual(one, two);
  assert.equal(calls, 1);
  one.result.payload.retorno.numeroCertidao = "mutated";
  assert.equal((await service.query(request(), AUTH)).result.payload.retorno.numeroCertidao, "TEST-1");
  assert.equal((await service.query(request({ parameters: { CPF: "52998224725", GERARCOMPROVANTE: "Desabilitar" } }), AUTH)).reason, "request_id_conflict");
  await service.query(request(), { ...AUTH, tenantId: "tenant-two" });
  await service.query(request(), { ...AUTH, user: { id: "user-two" } });
  assert.equal(calls, 3);
});

test("seller timeouts and async exhaustion remain cached; cache capacity cannot evict a charged request", async () => {
  let calls = 0;
  const service = createDirectDataSellerService({ env: { ...ENV, DIRECT_DATA_SELLER_CACHE_MAX_ENTRIES: "1" }, fetchImpl: async () => { calls++; throw Object.assign(new Error("private details"), { name: "AbortError" }); } });
  assert.equal((await service.query(request(), AUTH)).reason, "provider_timeout");
  assert.equal((await service.query(request(), AUTH)).reason, "provider_timeout");
  assert.equal((await service.query(request({ requestId: "other" }), AUTH)).reason, "idempotency_capacity_reached");
  assert.equal(calls, 1);
  const asyncService = createDirectDataSellerService({ env: { ...ENV, DIRECT_DATA_SELLER_POLL_ATTEMPTS: "2" }, delay: async () => {}, fetchImpl: async () => { calls++; return response({ metaDados: { consultaUid: "async" } }, 202); } });
  const pending = await asyncService.query(request(), AUTH);
  assert.equal(pending.reason, "provider_async_timeout");
  assert.equal(pending.providerReference, "async");
  assert.deepEqual(await asyncService.query(request(), AUTH), pending);
  assert.equal(calls, 4);
});

test("seller credits block emission before sending, permit retry after replenishment and consume once on success", async () => {
  let balance = 0, calls = 0;
  const charges = [];
  const service = createDirectDataSellerService({ env: { ...ENV, DIRECT_DATA_SELLER_CREDIT_COST: "2" }, fetchImpl: async () => { calls++; return response(); }, creditsService: {
    getWallet: async () => ({ enabled: true, balance }),
    consume: async (auth, charge) => { assert.deepEqual(auth, AUTH); charges.push(charge); balance -= charge.amount; return { ok: true, wallet: { enabled: true, balance } }; },
  } });
  const blocked = await service.query(request(), AUTH);
  assert.equal(blocked.insufficientCredits, true);
  assert.equal(blocked.creditCost, 2);
  assert.equal(calls, 0);
  balance = 3;
  const success = await service.query(request(), AUTH);
  assert.equal(success.result.wallet.balance, 1);
  await service.query(request(), AUTH);
  assert.equal(calls, 1);
  assert.equal(charges.length, 1);
  assert.equal(charges[0].amount, 2);
  assert.equal(charges[0].referenceId, "test-query");
  assert.equal(charges[0].operation, "direct_data_seller_document");
});

test("seller credit check and settlement errors cannot reemit or silently release a failed charge", async () => {
  let calls = 0;
  const brokenWallet = createDirectDataSellerService({ env: ENV, fetchImpl: async () => { calls++; return response(); }, creditsService: { getWallet: async () => { throw new Error("private database details"); } } });
  assert.equal((await brokenWallet.query(request(), AUTH)).reason, "credits_unavailable");
  assert.equal(calls, 0);
  for (const consume of [async () => ({ ok: false, wallet: { enabled: true, balance: 0 } }), async () => { throw new Error("private settlement details"); }]) {
    const service = createDirectDataSellerService({ env: ENV, fetchImpl: async () => { calls++; return response(); }, creditsService: { getWallet: async () => ({ enabled: true, balance: 1 }), consume } });
    const failed = await service.query(request(), AUTH);
    assert.equal(failed.providerCompleted, true);
    assert.equal(failed.providerRequestSubmitted, true);
    assert.ok(failed.insufficientCredits || failed.reason === "credits_settlement_failed");
    assert.deepEqual(await service.query(request(), AUTH), failed);
    assert.doesNotMatch(JSON.stringify(failed), /private settlement/);
  }
  assert.equal(calls, 2);
});

test("concurrent requests share the tenant wallet check through settlement before another paid emission", async () => {
  let balance = 1, emissions = 0, walletChecks = 0, settlements = 0, releaseProvider, providerStarted;
  const started = new Promise(resolve => { providerStarted = resolve; });
  const providerGate = new Promise(resolve => { releaseProvider = resolve; });
  const service = createDirectDataSellerService({ env: ENV, fetchImpl: async () => {
    const emission = ++emissions;
    if (emission === 1) { providerStarted(); await providerGate; }
    return response({ ...PAYLOAD, metaDados: { ...PAYLOAD.metaDados, consultaUid: `concurrent-${emission}` } });
  }, creditsService: {
    getWallet: async () => { walletChecks++; return { enabled: true, balance }; },
    consume: async (_auth, charge) => {
      settlements++;
      if (balance < charge.amount) return { ok: false, wallet: { enabled: true, balance } };
      balance -= charge.amount;
      return { ok: true, wallet: { enabled: true, balance } };
    },
  } });
  const first = service.query(request({ requestId: "concurrent-first" }), AUTH);
  await started;
  const secondInput = request({ requestId: "concurrent-second" });
  const secondAuth = { ...AUTH, user: { id: "another-user-in-same-tenant" } };
  const second = service.query(secondInput, secondAuth);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(emissions, 1);
  assert.equal(walletChecks, 1);
  releaseProvider();
  const [completed, blocked] = await Promise.all([first, second]);
  assert.equal(completed.result.status, "success");
  assert.equal(blocked.insufficientCredits, true);
  assert.equal(blocked.providerRequestSubmitted, undefined);
  assert.equal(emissions, 1);
  assert.equal(settlements, 1);
  assert.equal(walletChecks, 2);
  balance = 1;
  assert.equal((await service.query(secondInput, secondAuth)).result.status, "success");
  assert.equal(emissions, 2);
  assert.equal(settlements, 2);
});

test("a pending tenant emission does not block another tenant", async () => {
  let calls = 0, releaseProvider, providerStarted;
  const started = new Promise(resolve => { providerStarted = resolve; });
  const providerGate = new Promise(resolve => { releaseProvider = resolve; });
  const service = createDirectDataSellerService({ env: ENV, fetchImpl: async () => {
    if (++calls === 1) { providerStarted(); await providerGate; }
    return response();
  }, creditsService: {
    getWallet: async () => ({ enabled: true, balance: 1 }),
    consume: async () => ({ ok: true, wallet: { enabled: true, balance: 0 } }),
  } });
  const first = service.query(request(), AUTH);
  await started;
  try {
    const other = await service.query(request(), { ...AUTH, tenantId: "independent-tenant" });
    assert.equal(other.result.status, "success");
    assert.equal(calls, 2);
  } finally {
    releaseProvider();
  }
  assert.equal((await first).result.status, "success");
});
