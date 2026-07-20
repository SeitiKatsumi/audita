import test from "node:test";
import assert from "node:assert/strict";
import { collect as collectOnrProperties } from "../collectors/imoveis-onr.collector.mjs";
import { createCreditsService } from "../services/credits.service.mjs";
import {
  buildSoapEnvelope,
  createOnrHash,
  getOnrProviderConfig,
  getPropertyOperation,
  isPriorSearchAvailable,
  listOnrRegistryOffices,
  parseSoapOperationResult,
  pollOnrRequest,
  submitOnrRequest,
} from "../services/onr-ri-digital.service.mjs";
import { createPropertyAssetsService } from "../services/property-assets.service.mjs";
import { calculateRiskScore } from "../services/risk-score.service.mjs";

const ONR_ENV_KEYS = [
  "ONR_WSRIDIGITAL_ENABLED",
  "ONR_WSRIDIGITAL_ENVIRONMENT",
  "ONR_WSRIDIGITAL_PARTNER_ID",
  "ONR_WSRIDIGITAL_KEY",
  "ONR_WSRIDIGITAL_USER_EMAIL",
  "ONR_WSRIDIGITAL_USER_CPF",
  "ONR_WSRIDIGITAL_REQUESTER_NAME",
  "ONR_WSRIDIGITAL_REQUESTER_EMAIL",
  "ONR_WSRIDIGITAL_REQUESTER_CPF",
  "ONR_WSRIDIGITAL_PURPOSE",
  "ONR_WSRIDIGITAL_ECPF_CPF",
  "ONR_WSRIDIGITAL_ECPF_EMAIL",
  "ONR_WSRIDIGITAL_ECPF_ISSUER",
  "ONR_WSRIDIGITAL_ECPF_PUBLIC_KEY",
  "ONR_WSRIDIGITAL_ECPF_SERIAL_NUMBER",
  "ONR_WSRIDIGITAL_ECPF_SUBJECT_CN",
  "ONR_WSRIDIGITAL_ECPF_VALID_UNTIL",
  "AUDITA_CREDITS_ENABLED",
  "AUDITA_INITIAL_CREDITS",
];

function snapshotEnv() {
  return Object.fromEntries(ONR_ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(values) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function completeOnrEnv(overrides = {}) {
  return {
    ONR_WSRIDIGITAL_ENABLED: "true",
    ONR_WSRIDIGITAL_ENVIRONMENT: "homologation",
    ONR_WSRIDIGITAL_PARTNER_ID: "321",
    ONR_WSRIDIGITAL_KEY: "CHAVE-CONVENIO",
    ONR_WSRIDIGITAL_USER_EMAIL: "integracao@example.com",
    ONR_WSRIDIGITAL_USER_CPF: "52998224725",
    ONR_WSRIDIGITAL_REQUESTER_NAME: "Requerente Autorizado",
    ONR_WSRIDIGITAL_REQUESTER_EMAIL: "requerente@example.com",
    ONR_WSRIDIGITAL_REQUESTER_CPF: "52998224725",
    ONR_WSRIDIGITAL_PURPOSE: "Auditoria documental imobiliaria autorizada.",
    ONR_WSRIDIGITAL_ECPF_CPF: "52998224725",
    ONR_WSRIDIGITAL_ECPF_EMAIL: "certificado@example.com",
    ONR_WSRIDIGITAL_ECPF_ISSUER: "AC TESTE",
    ONR_WSRIDIGITAL_ECPF_PUBLIC_KEY: "PUBLIC-KEY",
    ONR_WSRIDIGITAL_ECPF_SERIAL_NUMBER: "SERIAL-123",
    ONR_WSRIDIGITAL_ECPF_SUBJECT_CN: "REQUERENTE:52998224725",
    ONR_WSRIDIGITAL_ECPF_VALID_UNTIL: "2027-07-13T23:59:59",
    ...overrides,
  };
}

function soapResponse(operation, resultXml) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <${operation}Response xmlns="http://tempuri.org/WSArisp">
          <${operation}Result>${resultXml}</${operation}Result>
        </${operation}Response>
      </soap:Body>
    </soap:Envelope>`;
}

function response(xml, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => xml };
}

function createOnrContractFetch({ searchResultXml } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const action = String(options.headers.soapaction || "");
    if (action.includes("LoginClienteConvenio")) {
      return response(soapResponse("LoginClienteConvenio", `
        <RETORNO>true</RETORNO><CODIGOERRO>0</CODIGOERRO><ERRODESCRICAO></ERRODESCRICAO>
        <IDCliente>77</IDCliente><Ativo>true</Ativo>
        <Tokens><string>TOKEN01</string><string>TOKEN02</string><string>TOKEN03</string></Tokens>`));
    }
    if (action.includes("EstadosListar")) {
      return response(soapResponse("EstadosListar", `
        <RETORNO>true</RETORNO><CODIGOERRO>0</CODIGOERRO><ERRODESCRICAO></ERRODESCRICAO>
        <Estados><Estado_WSResp><ID>26</ID><Estado>Sao Paulo</Estado><UF>SP</UF></Estado_WSResp></Estados>`));
    }
    if (action.includes("ConsultaPesquisaPrevia_v4")) {
      return response(soapResponse("ConsultaPesquisaPrevia_v4", searchResultXml || `
        <RETORNO>true</RETORNO><CODIGOERRO>0</CODIGOERRO><ERRODESCRICAO></ERRODESCRICAO>
        <IDPesquisa>991</IDPesquisa><Protocolo>PO000000991</Protocolo>
        <VlPesquisa>12.30</VlPesquisa><VlTaxaAdmin>0.00</VlTaxaAdmin><VlTaxaISS>0.00</VlTaxaISS><VlTotal>12.30</VlTotal>
        <ResultadoConsulta>
          <PesquisaPreviaBDLightResult_WSResp>
            <IDCartorio>100</IDCartorio><NomeCartorio>1 RI de Sao Paulo</NomeCartorio><QtdeOcorrencias>1</QtdeOcorrencias>
            <Matricula>12345</Matricula><UltimaAtualizacao>2026-07-13</UltimaAtualizacao>
            <BlnPesquisaBens>true</BlnPesquisaBens><BlnMatriculaOnline>true</BlnMatriculaOnline><BlnCertidaoDigital>true</BlnCertidaoDigital>
          </PesquisaPreviaBDLightResult_WSResp>
        </ResultadoConsulta>`));
    }
    throw new Error(`Chamada SOAP inesperada: ${url}`);
  };
  return { fetchImpl, calls };
}

test("ONR cataloga as quatro operacoes imobiliarias", () => {
  assert.equal(getPropertyOperation("pesquisa_previa").label, "Pesquisa Pr\u00e9via");
  assert.equal(getPropertyOperation("pesquisa_previa").apiImplemented, true);
  assert.equal(getPropertyOperation("pesquisa_qualificada").apiImplemented, true);
  assert.equal(getPropertyOperation("certidao_digital").apiImplemented, true);
  assert.equal(getPropertyOperation("certidao_digital").resultKind, "official_certificate");
  assert.equal(getPropertyOperation("indisponibilidade").resultKind, "restriction_report");
});

test("Pesquisa Previa respeita cobertura oficial publicada", () => {
  assert.equal(isPriorSearchAvailable("SP"), true);
  assert.equal(isPriorSearchAvailable("RO"), true);
  assert.equal(isPriorSearchAvailable("AC"), false);
});

test("configuracao WSRIDIGITAL exige credenciais oficiais completas", () => {
  const incomplete = getOnrProviderConfig({ ONR_WSRIDIGITAL_ENABLED: "true" });
  assert.equal(incomplete.mode, "credentialing_required");
  assert.equal(incomplete.contractReady, false);
  assert.ok(incomplete.missingRequirements.includes("IDParceiro"));

  const complete = getOnrProviderConfig(completeOnrEnv());
  assert.equal(complete.mode, "api");
  assert.equal(complete.contractReady, true);
  assert.equal(complete.readiness.pesquisa_qualificada, true);
  assert.equal(complete.readiness.certidao_digital, true);
  assert.equal(complete.endpoints.priorSearch, "https://hml3-ws.onr.org.br/pesquisaprevia.asmx");
});

test("hash WSRIDIGITAL usa SHA-1 da chave concatenada ao token", () => {
  assert.equal(createOnrHash("CHAVE", "TOKEN"), "414EE153AFFB48B7719393F642B73AEAC7F1A2D9");
  assert.equal(createOnrHash("CHAVE", "TOKEN", "lower"), "414ee153affb48b7719393f642b73aeac7f1a2d9");
});

test("envelope SOAP segue namespace e oRequest publicados no WSDL", () => {
  const xml = buildSoapEnvelope("LoginClienteConvenio", { Email: "a@example.com", CPF: "52998224725", IDParceiro: 321 });
  assert.match(xml, /<soap:Envelope/);
  assert.match(xml, /<LoginClienteConvenio xmlns="http:\/\/tempuri\.org\/WSArisp">/);
  assert.match(xml, /<oRequest><Email>a@example\.com<\/Email><CPF>52998224725<\/CPF><IDParceiro>321<\/IDParceiro><\/oRequest>/);
});

test("parser SOAP extrai resultado e rejeita Fault", () => {
  const result = parseSoapOperationResult(soapResponse("LoginClienteConvenio", "<RETORNO>true</RETORNO><CODIGOERRO>0</CODIGOERRO>"), "LoginClienteConvenio");
  assert.equal(result.RETORNO, "true");
  assert.throws(
    () => parseSoapOperationResult(`
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>
        <soap:Fault><faultcode>soap:Server</faultcode><faultstring>Falha oficial</faultstring></soap:Fault>
      </soap:Body></soap:Envelope>`, "LoginClienteConvenio"),
    /Falha oficial/,
  );
});

test("ONR sem convenio usa apenas contingencia oficial sem scraping", async () => {
  const result = await submitOnrRequest({
    tipoDocumento: "cpf",
    documento: "52998224725",
    subjectName: "Pessoa Teste",
    uf: "SP",
    operation: "pesquisa_previa",
  }, { env: { ONR_WSRIDIGITAL_ENABLED: "false" } });
  assert.equal(result.providerMode, "official_manual");
  assert.equal(result.status, "waiting_user_action");
  assert.equal(result.noScraping, true);
  assert.match(result.officialUrl, /ridigital\.org\.br/);
});

test("ONR direciona UF sem Pesquisa Previa para Pesquisa Qualificada", async () => {
  const result = await submitOnrRequest({
    tipoDocumento: "cpf",
    documento: "52998224725",
    subjectName: "Pessoa Teste",
    uf: "AC",
    operation: "pesquisa_previa",
  }, { env: completeOnrEnv() });
  assert.equal(result.status, "waiting_user_action");
  assert.equal(result.coverageAvailable, false);
  assert.equal(result.nextAction, "choose_qualified_search");
});

test("adapter real executa login, estados e ConsultaPesquisaPrevia_v4", async () => {
  const { fetchImpl, calls } = createOnrContractFetch();
  const result = await submitOnrRequest({
    tipoDocumento: "cpf",
    documento: "529.982.247-25",
    subjectName: "Pessoa Teste",
    uf: "SP",
    operation: "pesquisa_previa",
  }, { env: completeOnrEnv(), fetchImpl });

  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, "https://hml3-ws.onr.org.br/logincliente.asmx");
  assert.match(calls[0].options.headers.soapaction, /LoginClienteConvenio/);
  assert.doesNotMatch(calls[0].options.body, /CHAVE-CONVENIO/);
  assert.match(calls[1].options.body, new RegExp(createOnrHash("CHAVE-CONVENIO", "TOKEN01")));
  assert.match(calls[2].options.headers.soapaction, /ConsultaPesquisaPrevia_v4/);
  assert.match(calls[2].options.body, /<CPFCNPJ>52998224725<\/CPFCNPJ>/);
  assert.match(calls[2].options.body, /<Finalidade>Auditoria documental imobiliaria autorizada\.<\/Finalidade>/);
  assert.equal(result.providerMode, "api");
  assert.equal(result.status, "completed");
  assert.equal(result.outcome, "assets_found");
  assert.equal(result.providerOrderId, "PO000000991");
  assert.equal(result.assets[0].registrationNumber, "12345");
  assert.equal(result.providerCosts.total, 12.3);
});

test("saldo insuficiente do ONR vira acao pendente, sem sucesso falso", async () => {
  const { fetchImpl } = createOnrContractFetch({
    searchResultXml: "<RETORNO>false</RETORNO><CODIGOERRO>32</CODIGOERRO><ERRODESCRICAO>Saldo insuficiente para realizar a pesquisa.</ERRODESCRICAO>",
  });
  const result = await submitOnrRequest({
    tipoDocumento: "cpf",
    documento: "52998224725",
    subjectName: "Pessoa Teste",
    uf: "SP",
    operation: "pesquisa_previa",
  }, { env: completeOnrEnv(), fetchImpl });
  assert.equal(result.status, "waiting_user_action");
  assert.equal(result.nextAction, "fund_onr_account");
  assert.equal(result.outcome, "pending");
});

test("diretorio oficial lista cartorios habilitados para Consulta Eletronica", async () => {
  const actions = [];
  const fetchImpl = async (_url, options) => {
    const action = String(options.headers.soapaction || "");
    actions.push(action);
    if (action.includes("LoginClienteConvenio")) {
      return response(soapResponse("LoginClienteConvenio", "<RETORNO>true</RETORNO><Ativo>true</Ativo><Tokens><string>T1</string><string>T2</string></Tokens>"));
    }
    if (action.includes("EstadosListar")) {
      return response(soapResponse("EstadosListar", "<RETORNO>true</RETORNO><Estados><Estado_WSResp><ID>26</ID><UF>SP</UF></Estado_WSResp></Estados>"));
    }
    if (action.includes("CartoriosListar")) {
      return response(soapResponse("CartoriosListar", "<RETORNO>true</RETORNO><Cartorios><Cartorio_WSResp><ID>100</ID><Razao>1 RI de Sao Paulo</Razao><Cidade>Sao Paulo</Cidade><UF>SP</UF><CNS>123456</CNS></Cartorio_WSResp></Cartorios>"));
    }
    throw new Error(`SOAP inesperado: ${action}`);
  };
  const result = await listOnrRegistryOffices({ uf: "SP", operation: "pesquisa_qualificada" }, { env: completeOnrEnv(), fetchImpl });
  assert.equal(result.status, "completed");
  assert.equal(result.registryOffices[0].id, 100);
  assert.equal(result.registryOffices[0].cns, "123456");
  assert.equal(actions.length, 3);
});

test("Consulta Eletronica cria confirmacao real nos cartorios selecionados", async () => {
  const calls = [];
  const fetchImpl = async (_url, options) => {
    const action = String(options.headers.soapaction || "");
    calls.push(options);
    if (action.includes("LoginClienteConvenio")) {
      return response(soapResponse("LoginClienteConvenio", "<RETORNO>true</RETORNO><Ativo>true</Ativo><Tokens><string>T1</string><string>T2</string></Tokens>"));
    }
    if (action.includes("ConsultaPreviaCE_v3")) {
      return response(soapResponse("ConsultaPreviaCE_v3", `
        <RETORNO>true</RETORNO><IDPesquisa>700</IDPesquisa><Protocolo>CE000000700</Protocolo>
        <VlPesquisa>9.00</VlPesquisa><VlTaxaAdmin>1.00</VlTaxaAdmin><VlTaxaISS>0.20</VlTaxaISS><VlTotal>10.20</VlTotal>
        <ResultadoConsulta><BDLightResult_WSResp><IDCartorio>100</IDCartorio><NomeCartorio>1 RI</NomeCartorio><QtdeOcorrencias>1</QtdeOcorrencias></BDLightResult_WSResp></ResultadoConsulta>`));
    }
    if (action.includes("FinalizarCE")) {
      return response(soapResponse("FinalizarCE", "<RETORNO>true</RETORNO><ConfirmacaoCartorio><FinConfRICE_WSResp><IDCartorio>100</IDCartorio><Cartorio>1 RI</Cartorio></FinConfRICE_WSResp></ConfirmacaoCartorio>"));
    }
    throw new Error(`SOAP inesperado: ${action}`);
  };
  const result = await submitOnrRequest({
    tipoDocumento: "cpf",
    documento: "52998224725",
    subjectName: "Pessoa Teste",
    uf: "SP",
    operation: "pesquisa_qualificada",
    registryOfficeIds: [100],
  }, { env: completeOnrEnv(), fetchImpl });
  assert.equal(result.status, "processing");
  assert.equal(result.providerRequestId, 700);
  assert.equal(result.providerDetails[0].registryOfficeId, 100);
  assert.match(calls[1].body, /<IDCartorio><int>100<\/int><\/IDCartorio>/);
  assert.match(calls[1].body, /<CERT_PUBLICKEY>PUBLIC-KEY<\/CERT_PUBLICKEY>/);
});

test("acompanhamento da Consulta Eletronica captura matricula confirmada", async () => {
  const fetchImpl = async (_url, options) => {
    const action = String(options.headers.soapaction || "");
    if (action.includes("LoginClienteConvenio")) {
      return response(soapResponse("LoginClienteConvenio", "<RETORNO>true</RETORNO><Ativo>true</Ativo><Tokens><string>T1</string></Tokens>"));
    }
    if (action.includes("ListarConfirmacoesCE")) {
      return response(soapResponse("ListarConfirmacoesCE", `
        <RETORNO>true</RETORNO><ConfirmacaoCartorio><ListConfRICE_WSResp>
          <IDCartorio>100</IDCartorio><Cartorio>1 RI</Cartorio><IDStatus>2</IDStatus><Matricula>12345</Matricula><Endereco>Rua Teste</Endereco><DataConfirmacao>2026-07-14T12:00:00</DataConfirmacao>
        </ListConfRICE_WSResp></ConfirmacaoCartorio>`));
    }
    throw new Error(`SOAP inesperado: ${action}`);
  };
  const result = await pollOnrRequest({ operation: "pesquisa_qualificada", uf: "SP", providerRequestId: 700, providerOrderId: "CE000000700" }, { env: completeOnrEnv(), fetchImpl });
  assert.equal(result.status, "completed");
  assert.equal(result.outcome, "assets_found");
  assert.equal(result.assets[0].registrationNumber, "12345");
});

test("Certidao Digital usa RegistrarSolicitacaoMatricula_v5 com Request", async () => {
  const calls = [];
  const fetchImpl = async (_url, options) => {
    const action = String(options.headers.soapaction || "");
    calls.push(options);
    if (action.includes("LoginClienteConvenio")) {
      return response(soapResponse("LoginClienteConvenio", "<RETORNO>true</RETORNO><Ativo>true</Ativo><Tokens><string>T1</string></Tokens>"));
    }
    if (action.includes("RegistrarSolicitacaoMatricula_v5")) {
      return response(soapResponse("RegistrarSolicitacaoMatricula_v5", `
        <RETORNO>true</RETORNO><IDPedidoArisp>880</IDPedidoArisp><Protocolo>CD000000880</Protocolo><Status>Pedido_Realizado</Status>
        <PrazoEntrega>2026-07-19T18:00:00</PrazoEntrega><CustoEmolumentos>40.00</CustoEmolumentos><CustoEstado>10.00</CustoEstado><CustoAdministracao>2.00</CustoAdministracao><CustoISS>0.10</CustoISS><ValorTotal>52.10</ValorTotal><Saldo>100.00</Saldo>`));
    }
    throw new Error(`SOAP inesperado: ${action}`);
  };
  const result = await submitOnrRequest({
    tipoDocumento: "cpf",
    documento: "52998224725",
    uf: "SP",
    operation: "certidao_digital",
    registryOfficeId: 100,
    registrationNumber: "12345",
    certificatePurposeId: 2,
  }, { env: completeOnrEnv(), fetchImpl });
  assert.equal(result.status, "processing");
  assert.equal(result.providerRequestId, 880);
  assert.equal(result.providerCosts.total, 52.1);
  assert.match(calls[1].body, /<Request>/);
  assert.match(calls[1].body, /<IDTipoPedido>4<\/IDTipoPedido><Numero>12345<\/Numero>/);
  assert.match(calls[1].body, /<IdTipoFinalidade>2<\/IdTipoFinalidade>/);
});

test("collector consolidado retorna espera humana quando convenio esta desabilitado", async () => {
  const env = snapshotEnv();
  process.env.ONR_WSRIDIGITAL_ENABLED = "false";
  try {
    const result = await collectOnrProperties({
      documento: "52998224725",
      tipoDocumento: "cpf",
      consultaId: "consulta-1",
      extraFields: { propertyUf: "SP", propertyOperation: "pesquisa_previa", fullName: "Pessoa Teste" },
    });
    assert.equal(result.status, "waiting_user_action");
    assert.equal(result.resultado, "indisponivel");
    assert.equal(result.dados.noScraping, true);
  } finally {
    restoreEnv(env);
  }
});

test("carteira de creditos evita cobranca duplicada", async () => {
  const env = snapshotEnv();
  process.env.AUDITA_CREDITS_ENABLED = "true";
  process.env.AUDITA_INITIAL_CREDITS = "2";
  try {
    const service = createCreditsService({ getDb: () => ({ pool: null, dbReady: false }) });
    const auth = { tenantId: 901, user: { id: 1 } };
    const first = await service.consume(auth, { amount: 1, referenceId: "case-credit-1", operation: "pesquisa_previa" });
    const duplicate = await service.consume(auth, { amount: 1, referenceId: "case-credit-1", operation: "pesquisa_previa" });
    const insufficient = await service.consume(auth, { amount: 2, referenceId: "case-credit-2", operation: "pesquisa_qualificada" });
    assert.equal(first.ok, true);
    assert.equal(first.wallet.balance, 1);
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.wallet.balance, 1);
    assert.equal(insufficient.ok, false);
    assert.equal(insufficient.state, "insufficient");
  } finally {
    restoreEnv(env);
  }
});

test("servico de imoveis percorre pedido, protocolo e resultado oficial", async () => {
  const env = snapshotEnv();
  process.env.AUDITA_CREDITS_ENABLED = "false";
  try {
    const credits = createCreditsService({ getDb: () => ({ pool: null, dbReady: false }) });
    const service = createPropertyAssetsService({
      getDb: () => ({ pool: null, dbReady: false }),
      getAuthContext: async () => ({ tenantId: 902, user: { id: 8 }, unauthorized: false }),
      creditsService: credits,
      submitProvider: async () => ({
        provider: "ONR / RI Digital",
        providerMode: "official_manual",
        status: "waiting_user_action",
        outcome: "pending",
        operation: "pesquisa_previa",
        operationLabel: "Pesquisa Pr\u00e9via",
        officialUrl: "https://www.ridigital.org.br/PO/DefaultPO.aspx",
        coverageAvailable: true,
        supportedUfs: ["SP"],
        summary: "Pedido oficial pendente.",
        nextAction: "complete_official_request",
      }),
    });

    const created = await service.createSearch({
      body: {
        tipoDocumento: "cpf",
        documento: "52998224725",
        subjectName: "Pessoa Teste",
        uf: "SP",
        operation: "pesquisa_previa",
        authorizationConfirmed: true,
      },
    });
    assert.equal(created.search.status, "waiting_user_action");
    assert.match(created.search.subjectMasked, /\*+/);

    const protocol = await service.handleAction(created.search.id, {
      body: { action: "record_protocol", protocol: "ONR-2026-1" },
    });
    assert.equal(protocol.search.status, "processing");
    assert.equal(protocol.search.providerOrderId, "ONR-2026-1");

    const completed = await service.handleAction(created.search.id, {
      body: {
        action: "record_result",
        outcome: "assets_found",
        assets: [{ matricula: "12345", cartorio: "1 RI", municipio: "Sao Paulo", uf: "SP" }],
        summary: "Uma matricula localizada.",
        evidenceType: "onr_report",
        evidenceTitle: "Relatorio ONR",
      },
    });
    assert.equal(completed.search.status, "completed");
    assert.equal(completed.search.outcome, "assets_found");
    assert.equal(completed.search.assets.length, 1);
    assert.equal(completed.search.evidence.length, 2);
    assert.equal(completed.search.credit.state, "not_charged");
  } finally {
    restoreEnv(env);
  }
});

test("servico de imoveis atualiza pedido automatico ate o resultado oficial", async () => {
  const env = snapshotEnv();
  process.env.AUDITA_CREDITS_ENABLED = "false";
  try {
    const credits = createCreditsService({ getDb: () => ({ pool: null, dbReady: false }) });
    const service = createPropertyAssetsService({
      getDb: () => ({ pool: null, dbReady: false }),
      getAuthContext: async () => ({ tenantId: 903, user: { id: 9 }, unauthorized: false }),
      creditsService: credits,
      submitProvider: async () => ({
        provider: "ONR / RI Digital",
        providerMode: "api",
        status: "processing",
        outcome: "pending",
        operation: "pesquisa_previa",
        operationLabel: "Pesquisa Previa",
        officialUrl: "https://www.ridigital.org.br/PO/DefaultPO.aspx",
        coverageAvailable: true,
        supportedUfs: ["SP"],
        providerOrderId: "PP000000901",
        providerRequestId: 901,
        summary: "Pedido registrado no ONR.",
        nextAction: "wait_provider_result",
      }),
      pollProvider: async () => ({
        status: "completed",
        outcome: "assets_found",
        summary: "Uma matricula localizada pelo ONR.",
        nextAction: "request_qualified_search",
        providerDetails: [{ code: "1", description: "Sao Paulo" }],
        providerCosts: { total: 12.5 },
        providerAttachments: [{ name: "resultado.pdf", url: "https://example.invalid/resultado.pdf" }],
        assets: [{ registrationNumber: "12345", registryOffice: "1 RI", city: "Sao Paulo", uf: "SP" }],
      }),
    });

    const created = await service.createSearch({
      body: {
        tipoDocumento: "cpf",
        documento: "52998224725",
        subjectName: "Pessoa Teste",
        uf: "SP",
        operation: "pesquisa_previa",
        authorizationConfirmed: true,
      },
    });
    assert.equal(created.search.providerMode, "api");
    assert.equal(created.search.status, "processing");

    const refreshed = await service.handleAction(created.search.id, {
      body: { action: "refresh_provider" },
    });
    assert.equal(refreshed.search.status, "completed");
    assert.equal(refreshed.search.outcome, "assets_found");
    assert.equal(refreshed.search.assets[0].registrationNumber, "12345");
    assert.equal(refreshed.search.providerCosts.total, 12.5);
    assert.equal(refreshed.search.providerAttachments[0].name, "resultado.pdf");
    assert.equal(refreshed.search.timeline.at(-1).label, "Resultado oficial recebido");
  } finally {
    restoreEnv(env);
  }
});

test("imovel localizado nao vira risco alto por si so", () => {
  const score = calculateRiskScore([
    {
      fonte: "imoveis_onr",
      status: "success",
      resultado: "consta",
      dados: { operation: "pesquisa_previa", assets: [{ registrationNumber: "123" }] },
    },
  ]);
  assert.equal(score.nivel, "baixo");
  assert.match(score.motivos.join(" "), /titularidade/i);
});
