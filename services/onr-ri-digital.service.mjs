import { createHash } from "node:crypto";
import { XMLBuilder, XMLParser } from "fast-xml-parser";

const DEFAULT_TIMEOUT_MS = 20000;
const SOAP_NAMESPACE = "http://tempuri.org/WSArisp";
const PESQUISA_PREVIA_SERVICE_ID = 14;

const HOMOLOGATION_ENDPOINTS = Object.freeze({
  login: "https://hml3-ws.onr.org.br/logincliente.asmx",
  states: "https://hml3-ws.onr.org.br/estados.asmx",
  registryOffices: "https://hml3-ws.onr.org.br/cartorios.asmx",
  priorSearch: "https://hml3-ws.onr.org.br/pesquisaprevia.asmx",
  certificates: "https://hml3-ws.onr.org.br/certidoes.asmx",
  electronicSearch: "https://hml3-ws.onr.org.br/consultaeletronica.asmx",
  credits: "https://hml3-ws.onr.org.br/creditos.asmx",
});

const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  format: false,
  suppressEmptyNode: false,
});

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

export const ONR_PROVIDER = "ONR / RI Digital";

export const PROPERTY_SEARCH_UFS = Object.freeze(["DF", "ES", "MG", "MS", "PR", "RJ", "RO", "RS", "SC", "SP"]);

export const PROPERTY_OPERATIONS = Object.freeze({
  pesquisa_previa: {
    id: "pesquisa_previa",
    label: "Pesquisa Pr\u00e9via",
    description: "Localiza matr\u00edculas associadas ao CPF ou CNPJ nas bases participantes do RI Digital.",
    officialUrl: "https://www.ridigital.org.br/PO/DefaultPO.aspx",
    resultKind: "property_report",
    coverageLimited: true,
    apiImplemented: true,
    defaultCreditCost: 1,
  },
  pesquisa_qualificada: {
    id: "pesquisa_qualificada",
    label: "Pesquisa Qualificada",
    description: "Confirma a rela\u00e7\u00e3o atual do pesquisado com a matr\u00edcula diretamente no cart\u00f3rio competente.",
    officialUrl: "https://www.ridigital.org.br/CE/DefaultCE.aspx",
    resultKind: "qualified_report",
    coverageLimited: false,
    apiImplemented: true,
    defaultCreditCost: 2,
  },
  certidao_digital: {
    id: "certidao_digital",
    label: "Certid\u00e3o Digital",
    description: "Solicita a certid\u00e3o oficial da matr\u00edcula, assinada digitalmente pelo Registro de Im\u00f3veis.",
    officialUrl: "https://www.ridigital.org.br/CertidaoDigital/frmPedidosCertidao.aspx?from=menu&digital=1",
    resultKind: "official_certificate",
    coverageLimited: false,
    apiImplemented: true,
    defaultCreditCost: 2,
  },
  indisponibilidade: {
    id: "indisponibilidade",
    label: "Indisponibilidade de Bens",
    description: "Consulta o relat\u00f3rio oficial de indisponibilidades judiciais para CPF ou CNPJ.",
    officialUrl: "https://indisponibilidade.onr.org.br/home/relatoriogratuito",
    resultKind: "restriction_report",
    coverageLimited: false,
    apiImplemented: false,
    defaultCreditCost: 1,
  },
});

export function getPropertyOperation(value) {
  return PROPERTY_OPERATIONS[String(value || "").trim().toLowerCase()] || PROPERTY_OPERATIONS.pesquisa_previa;
}

export function isPriorSearchAvailable(uf) {
  return PROPERTY_SEARCH_UFS.includes(String(uf || "").trim().toUpperCase());
}

export function getOperationCreditCost(operationId, env = process.env) {
  const operation = getPropertyOperation(operationId);
  const envKey = `AUDITA_PROPERTY_CREDITS_${operation.id.toUpperCase()}`;
  const configured = Number(env[envKey]);
  return Number.isInteger(configured) && configured >= 0 ? configured : operation.defaultCreditCost;
}

export function getOnrProviderConfig(env = process.env) {
  const enabled = envBoolean(env.ONR_WSRIDIGITAL_ENABLED, false);
  const environment = String(env.ONR_WSRIDIGITAL_ENVIRONMENT || "homologation").trim().toLowerCase();
  const defaults = environment === "homologation" ? HOMOLOGATION_ENDPOINTS : {};
  const endpoints = {
    login: String(env.ONR_WSRIDIGITAL_LOGIN_URL || defaults.login || "").trim(),
    states: String(env.ONR_WSRIDIGITAL_STATES_URL || defaults.states || "").trim(),
    registryOffices: String(env.ONR_WSRIDIGITAL_REGISTRY_OFFICES_URL || defaults.registryOffices || "").trim(),
    priorSearch: String(env.ONR_WSRIDIGITAL_PESQUISA_PREVIA_URL || defaults.priorSearch || "").trim(),
    certificates: String(env.ONR_WSRIDIGITAL_CERTIDOES_URL || defaults.certificates || "").trim(),
    electronicSearch: String(env.ONR_WSRIDIGITAL_CONSULTA_ELETRONICA_URL || defaults.electronicSearch || "").trim(),
    credits: String(env.ONR_WSRIDIGITAL_CREDITOS_URL || defaults.credits || "").trim(),
  };
  const credentials = {
    partnerId: parsePositiveInteger(env.ONR_WSRIDIGITAL_PARTNER_ID),
    key: String(env.ONR_WSRIDIGITAL_KEY || "").trim(),
    userEmail: String(env.ONR_WSRIDIGITAL_USER_EMAIL || "").trim(),
    userCpf: digitsOnly(env.ONR_WSRIDIGITAL_USER_CPF),
    requesterName: String(env.ONR_WSRIDIGITAL_REQUESTER_NAME || "").trim(),
    requesterEmail: String(env.ONR_WSRIDIGITAL_REQUESTER_EMAIL || env.ONR_WSRIDIGITAL_USER_EMAIL || "").trim(),
    requesterCpf: digitsOnly(env.ONR_WSRIDIGITAL_REQUESTER_CPF || env.ONR_WSRIDIGITAL_USER_CPF),
    purpose: String(env.ONR_WSRIDIGITAL_PURPOSE || "").trim(),
    eCpf: {
      cpf: digitsOnly(env.ONR_WSRIDIGITAL_ECPF_CPF),
      email: String(env.ONR_WSRIDIGITAL_ECPF_EMAIL || "").trim(),
      issuer: String(env.ONR_WSRIDIGITAL_ECPF_ISSUER || "").trim(),
      publicKey: String(env.ONR_WSRIDIGITAL_ECPF_PUBLIC_KEY || "").trim(),
      serialNumber: String(env.ONR_WSRIDIGITAL_ECPF_SERIAL_NUMBER || "").trim(),
      subjectCn: String(env.ONR_WSRIDIGITAL_ECPF_SUBJECT_CN || "").trim(),
      validUntil: String(env.ONR_WSRIDIGITAL_ECPF_VALID_UNTIL || "").trim(),
    },
  };
  const timeoutValue = Number(env.ONR_WSRIDIGITAL_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(timeoutValue) && timeoutValue > 0 ? timeoutValue : DEFAULT_TIMEOUT_MS;
  const hashCase = String(env.ONR_WSRIDIGITAL_HASH_CASE || "upper").trim().toLowerCase() === "lower" ? "lower" : "upper";

  const commonRequirements = [];
  if (!credentials.partnerId) commonRequirements.push("IDParceiro");
  if (!credentials.key) commonRequirements.push("chave do convenio");
  if (!credentials.userEmail) commonRequirements.push("e-mail do usuario conveniado");
  if (credentials.userCpf.length !== 11) commonRequirements.push("CPF do usuario conveniado");
  if (!credentials.requesterName) commonRequirements.push("nome do requerente");
  if (!credentials.requesterEmail) commonRequirements.push("e-mail do requerente");
  if (credentials.requesterCpf.length !== 11) commonRequirements.push("CPF do requerente");
  if (!endpoints.login) commonRequirements.push("endpoint de login");

  const priorSearchRequirements = [...commonRequirements];
  if (!credentials.purpose) priorSearchRequirements.push("finalidade da pesquisa");
  if (!endpoints.states) priorSearchRequirements.push("endpoint de estados");
  if (!endpoints.priorSearch) priorSearchRequirements.push("endpoint de Pesquisa Previa");

  const qualifiedSearchRequirements = [...commonRequirements];
  if (!credentials.purpose) qualifiedSearchRequirements.push("finalidade da pesquisa");
  if (!endpoints.states) qualifiedSearchRequirements.push("endpoint de estados");
  if (!endpoints.registryOffices) qualifiedSearchRequirements.push("endpoint de cartorios");
  if (!endpoints.electronicSearch) qualifiedSearchRequirements.push("endpoint de Consulta Eletronica");
  if (credentials.eCpf.cpf.length !== 11) qualifiedSearchRequirements.push("CPF do e-CPF");
  if (!credentials.eCpf.email) qualifiedSearchRequirements.push("e-mail do e-CPF");
  if (!credentials.eCpf.issuer) qualifiedSearchRequirements.push("issuer do e-CPF");
  if (!credentials.eCpf.publicKey) qualifiedSearchRequirements.push("chave publica do e-CPF");
  if (!credentials.eCpf.serialNumber) qualifiedSearchRequirements.push("numero de serie do e-CPF");
  if (!credentials.eCpf.subjectCn) qualifiedSearchRequirements.push("subject CN do e-CPF");
  if (!credentials.eCpf.validUntil) qualifiedSearchRequirements.push("validade do e-CPF");

  const certificateRequirements = [...commonRequirements];
  if (!endpoints.states) certificateRequirements.push("endpoint de estados");
  if (!endpoints.registryOffices) certificateRequirements.push("endpoint de cartorios");
  if (!endpoints.certificates) certificateRequirements.push("endpoint de Certidao Digital");

  const registryOfficeRequirements = [...commonRequirements];
  if (!endpoints.states) registryOfficeRequirements.push("endpoint de estados");
  if (!endpoints.registryOffices) registryOfficeRequirements.push("endpoint de cartorios");

  const operationRequirements = {
    pesquisa_previa: priorSearchRequirements,
    pesquisa_qualificada: qualifiedSearchRequirements,
    certidao_digital: certificateRequirements,
    indisponibilidade: ["contrato de API oficial da CNIB nao publicado para conveniados"],
  };
  const readiness = Object.fromEntries(
    Object.entries(operationRequirements).map(([operation, requirements]) => [operation, enabled && requirements.length === 0]),
  );
  const missingRequirements = [...new Set(Object.values(operationRequirements).flat())];
  const contractReady = readiness.pesquisa_previa;
  return {
    enabled,
    environment,
    endpoints,
    credentials,
    timeoutMs,
    hashCase,
    missingRequirements,
    operationRequirements,
    readiness,
    mode: contractReady ? "api" : enabled ? "credentialing_required" : "official_manual",
    contractReady,
  };
}

export function createOnrHash(key, token, hashCase = "upper") {
  const digest = createHash("sha1").update(`${String(key || "")}${String(token || "")}`, "utf8").digest("hex");
  return hashCase === "lower" ? digest : digest.toUpperCase();
}

export function buildSoapEnvelope(operation, requestFields, requestElementName = "oRequest") {
  return `<?xml version="1.0" encoding="utf-8"?>${xmlBuilder.build({
    "soap:Envelope": {
      "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      "@_xmlns:xsd": "http://www.w3.org/2001/XMLSchema",
      "@_xmlns:soap": "http://schemas.xmlsoap.org/soap/envelope/",
      "soap:Body": {
        [operation]: {
          "@_xmlns": SOAP_NAMESPACE,
          [requestElementName]: requestFields,
        },
      },
    },
  })}`;
}

export function parseSoapOperationResult(xml, operation) {
  let parsed;
  try {
    parsed = xmlParser.parse(String(xml || ""));
  } catch (error) {
    throw new OnrSoapError("Resposta XML invalida recebida do ONR.", { cause: error });
  }
  const body = parsed?.Envelope?.Body;
  const fault = body?.Fault;
  if (fault) {
    const message = scalar(fault.faultstring || fault.Reason?.Text || "Falha SOAP retornada pelo ONR.");
    throw new OnrSoapError(message, { providerCode: scalar(fault.faultcode || "SOAP_FAULT") });
  }
  const response = body?.[`${operation}Response`];
  const result = response?.[`${operation}Result`];
  if (!result || typeof result !== "object") {
    throw new OnrSoapError(`Resposta ${operation} sem envelope de resultado.`);
  }
  return result;
}

export async function submitOnrRequest(input, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const operation = getPropertyOperation(input.operation);
  const uf = String(input.uf || "").trim().toUpperCase();
  const creditCost = getOperationCreditCost(operation.id, env);
  const providerConfig = getOnrProviderConfig(env);
  const coverageAvailable = operation.coverageLimited ? isPriorSearchAvailable(uf) : true;
  const operationRequirements = providerConfig.operationRequirements[operation.id] || [];
  const canUseApi = operation.apiImplemented && providerConfig.readiness[operation.id];

  const base = {
    provider: ONR_PROVIDER,
    providerMode: canUseApi ? "api" : providerConfig.mode,
    providerEnvironment: providerConfig.environment,
    operation: operation.id,
    operationLabel: operation.label,
    officialUrl: operation.officialUrl,
    resultKind: operation.resultKind,
    uf,
    coverageAvailable,
    supportedUfs: [...PROPERTY_SEARCH_UFS],
    creditCost,
    creditState: "not_charged",
    apiContractReady: canUseApi,
    missingRequirements: operationRequirements,
    noScraping: true,
  };

  if (!coverageAvailable) {
    return {
      ...base,
      providerMode: "official_manual",
      status: "waiting_user_action",
      outcome: "inconclusive",
      nextAction: "choose_qualified_search",
      summary: `A Pesquisa Previa nao esta disponivel no RI Digital para ${uf}. Use a Pesquisa Qualificada no cartorio competente.`,
    };
  }

  if (!operation.apiImplemented) {
    return officialRequestRequired(base, operation, "O contrato deste servico ainda precisa ser confirmado e habilitado pelo ONR para o convenio da Audita.");
  }

  if (!canUseApi) {
    const detail = providerConfig.enabled
      ? `Credenciamento WSRIDIGITAL incompleto para ${operation.label}: ${operationRequirements.join(", ")}.`
      : "A Audita ainda precisa concluir o convenio WSRIDIGITAL com o ONR.";
    return officialRequestRequired(base, operation, detail);
  }

  const subjectName = String(input.subjectName || "").trim();
  if (["pesquisa_previa", "pesquisa_qualificada"].includes(operation.id) && !subjectName) {
    return {
      ...base,
      status: "waiting_user_action",
      outcome: "pending",
      nextAction: "provide_subject_name",
      summary: `Informe o nome completo ou a razao social exigida pela ${operation.label} do ONR.`,
    };
  }

  try {
    if (operation.id === "pesquisa_previa") {
      return await runPriorSearch(input, subjectName, base, providerConfig, fetchImpl);
    }
    if (operation.id === "pesquisa_qualificada") {
      return await runQualifiedSearch(input, subjectName, base, providerConfig, fetchImpl);
    }
    if (operation.id === "certidao_digital") {
      return await runDigitalCertificateRequest(input, base, providerConfig, fetchImpl);
    }
    return officialRequestRequired(base, operation, "O ONR nao publicou contrato WSRIDIGITAL para esta operacao.");
  } catch (error) {
    return normalizeOnrFailure(error, base);
  }
}

export async function listOnrRegistryOffices(input, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const config = getOnrProviderConfig(env);
  const operation = getPropertyOperation(input.operation);
  const serviceType = operation.id === "certidao_digital" ? 1 : operation.id === "pesquisa_qualificada" ? 3 : 0;
  const missingRequirements = config.operationRequirements[operation.id] || [];

  if (!config.enabled || !serviceType || missingRequirements.length) {
    return {
      status: "unavailable",
      registryOffices: [],
      missingRequirements,
    };
  }

  try {
    const tokens = await loginAndGetTokens(config, fetchImpl, 2);
    const state = await getStateByUf(config, fetchImpl, tokens[0], serviceType, input.uf);
    const result = await callSoap({
      endpoint: config.endpoints.registryOffices,
      operation: "CartoriosListar",
      requestFields: {
        Hash: createOnrHash(config.credentials.key, tokens[1], config.hashCase),
        TipoServico: serviceType,
        IDEstado: asInteger(state.ID),
        IDCidade: 0,
      },
      timeoutMs: config.timeoutMs,
      fetchImpl,
    });
    assertSuccessfulResult(result, "listagem de cartorios");
    const registryOffices = asArray(result.Cartorios?.Cartorio_WSResp).map((item) => ({
      id: asInteger(item?.ID),
      name: scalar(item?.Razao),
      number: scalar(item?.NrCartorio),
      cityId: asInteger(item?.IDCidade),
      city: scalar(item?.Cidade),
      stateId: asInteger(item?.IDEstado),
      state: scalar(item?.Estado),
      uf: scalar(item?.UF).toUpperCase(),
      cns: scalar(item?.CNS),
    })).filter((item) => item.id > 0);
    return { status: "completed", registryOffices, missingRequirements: [] };
  } catch (error) {
    const failure = normalizeOnrFailure(error, {
      provider: ONR_PROVIDER,
      providerMode: "api",
      operation: operation.id,
    });
    return { ...failure, registryOffices: [] };
  }
}

export async function pollOnrRequest(input, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const operation = getPropertyOperation(input.operation);
  const config = getOnrProviderConfig(env);
  const base = {
    provider: ONR_PROVIDER,
    providerMode: "api",
    providerEnvironment: config.environment,
    operation: operation.id,
    operationLabel: operation.label,
    officialUrl: operation.officialUrl,
    resultKind: operation.resultKind,
    uf: String(input.uf || "").trim().toUpperCase(),
    coverageAvailable: true,
    supportedUfs: [...PROPERTY_SEARCH_UFS],
    creditCost: getOperationCreditCost(operation.id, env),
    creditState: "not_charged",
    apiContractReady: Boolean(config.readiness[operation.id]),
    missingRequirements: config.operationRequirements[operation.id] || [],
    noScraping: true,
  };
  if (!config.readiness[operation.id]) {
    return officialRequestRequired(base, operation, "As credenciais desta operacao nao estao completas.");
  }
  try {
    if (operation.id === "pesquisa_qualificada") {
      return await pollQualifiedSearch(input, base, config, fetchImpl);
    }
    if (operation.id === "certidao_digital") {
      return await pollDigitalCertificate(input, base, config, fetchImpl);
    }
    return { ...base, status: "completed", outcome: input.outcome || "inconclusive", nextAction: "review_result" };
  } catch (error) {
    return normalizeOnrFailure(error, base);
  }
}

async function runQualifiedSearch(input, subjectName, base, config, fetchImpl) {
  const registryOfficeIds = normalizeRegistryOfficeIds(input.registryOfficeIds || input.registryOfficeId);
  if (!registryOfficeIds.length) {
    return {
      ...base,
      status: "waiting_user_action",
      outcome: "pending",
      nextAction: "select_registry_offices",
      summary: "Selecione ao menos um Cartorio de Registro de Imoveis habilitado para a Consulta Eletronica.",
    };
  }
  const includeTransferred = Boolean(input.includeTransferred);
  const transferDate = String(input.transferDate || "").trim();
  if (includeTransferred && !/^\d{4}-\d{2}-\d{2}/.test(transferDate)) {
    return {
      ...base,
      status: "waiting_user_action",
      outcome: "pending",
      nextAction: "provide_transfer_date",
      summary: "Informe a data inicial das transferencias que devem ser consideradas.",
    };
  }

  const tokens = await loginAndGetTokens(config, fetchImpl, 2);
  const eCpf = config.credentials.eCpf;
  const preview = await callSoap({
    endpoint: config.endpoints.electronicSearch,
    operation: "ConsultaPreviaCE_v3",
    requestFields: {
      Hash: createOnrHash(config.credentials.key, tokens[0], config.hashCase),
      CPFCNPJ: digitsOnly(input.documento),
      NomePessoa: subjectName,
      IDCartorio: { int: registryOfficeIds },
      CERT_ISSUERO: eCpf.issuer,
      CERT_PUBLICKEY: eCpf.publicKey,
      CERT_SERIALNUMBER: eCpf.serialNumber,
      CERT_SUBJECTCN: eCpf.subjectCn,
      CERT_VALIDUNTIL: eCpf.validUntil,
      CERT_EMAIL: eCpf.email,
      CERT_CPF: eCpf.cpf,
      NomeRequerente: config.credentials.requesterName,
      EmailRequerente: config.credentials.requesterEmail,
      CPFRequerente: config.credentials.requesterCpf,
      Finalidade: config.credentials.purpose,
    },
    timeoutMs: config.timeoutMs,
    fetchImpl,
  });
  assertSuccessfulResult(preview, "consulta previa da Consulta Eletronica");
  const previewDetails = asArray(preview.ResultadoConsulta?.BDLightResult_WSResp).map((item) => ({
    registryOfficeId: asInteger(item?.IDCartorio),
    registryOffice: scalar(item?.NomeCartorio),
    occurrences: asInteger(item?.QtdeOcorrencias),
  }));
  const needsConfirmation = previewDetails.some((item) => item.occurrences !== 0);
  const costs = {
    search: asDecimal(preview.VlPesquisa),
    administration: asDecimal(preview.VlTaxaAdmin),
    tax: asDecimal(preview.VlTaxaISS),
    total: asDecimal(preview.VlTotal),
    currency: "BRL",
  };
  if (!needsConfirmation) {
    return {
      ...base,
      providerMode: "api",
      status: "completed",
      outcome: "nothing_found",
      providerOrderId: scalar(preview.Protocolo),
      providerRequestId: asInteger(preview.IDPesquisa),
      providerDetails: previewDetails,
      providerCosts: costs,
      assets: [],
      nextAction: "review_result",
      summary: "Nenhum cartorio consultado retornou ocorrencia para o CPF ou CNPJ.",
    };
  }

  const finalized = await callSoap({
    endpoint: config.endpoints.electronicSearch,
    operation: "FinalizarCE",
    requestFields: {
      Hash: createOnrHash(config.credentials.key, tokens[1], config.hashCase),
      IDPesquisa: asInteger(preview.IDPesquisa),
      ImoveisDireitos: includeTransferred ? 2 : 1,
      DataTransferencia: includeTransferred ? `${transferDate.slice(0, 10)}T00:00:00` : "0001-01-01T00:00:00",
    },
    timeoutMs: config.timeoutMs,
    fetchImpl,
  });
  assertSuccessfulResult(finalized, "finalizacao da Consulta Eletronica");
  const confirmations = asArray(finalized.ConfirmacaoCartorio?.FinConfRICE_WSResp).map((item) => ({
    registryOfficeId: asInteger(item?.IDCartorio),
    registryOffice: scalar(item?.Cartorio),
    status: "processing",
  }));
  return {
    ...base,
    providerMode: "api",
    status: "processing",
    outcome: "pending",
    providerOrderId: scalar(preview.Protocolo),
    providerRequestId: asInteger(preview.IDPesquisa),
    providerDetails: confirmations.length ? confirmations : previewDetails,
    providerCosts: costs,
    assets: [],
    nextAction: "poll_provider_result",
    summary: `${confirmations.length || previewDetails.filter((item) => item.occurrences !== 0).length} cartorio(s) receberam o pedido de confirmacao de titularidade.`,
  };
}

async function pollQualifiedSearch(input, base, config, fetchImpl) {
  const providerRequestId = asInteger(input.providerRequestId);
  if (!providerRequestId) {
    return { ...base, status: "failed", outcome: "inconclusive", nextAction: "review_provider_request", summary: "ID da Consulta Eletronica nao foi registrado." };
  }
  const tokens = await loginAndGetTokens(config, fetchImpl, 1);
  const result = await callSoap({
    endpoint: config.endpoints.electronicSearch,
    operation: "ListarConfirmacoesCE",
    requestFields: {
      Hash: createOnrHash(config.credentials.key, tokens[0], config.hashCase),
      IDPesquisa: providerRequestId,
    },
    timeoutMs: config.timeoutMs,
    fetchImpl,
  });
  assertSuccessfulResult(result, "listagem de confirmacoes da Consulta Eletronica");
  const providerDetails = asArray(result.ConfirmacaoCartorio?.ListConfRICE_WSResp).map((item) => ({
    registryOfficeId: asInteger(item?.IDCartorio),
    registryOffice: scalar(item?.Cartorio),
    statusId: asInteger(item?.IDStatus),
    status: qualifiedStatusLabel(asInteger(item?.IDStatus)),
    registrationNumber: scalar(item?.Matricula),
    address: scalar(item?.Endereco),
    notes: scalar(item?.Observacoes),
    confirmedAt: scalar(item?.DataConfirmacao),
  }));
  const processing = providerDetails.some((item) => item.statusId === 1) || !providerDetails.length;
  const positive = providerDetails.filter((item) => item.statusId === 2);
  const assets = positive.map((item, index) => ({
    id: `onr-ce-${item.registryOfficeId || index + 1}-${item.registrationNumber || index + 1}`,
    registrationNumber: item.registrationNumber,
    registryOffice: item.registryOffice,
    city: "",
    uf: base.uf,
    address: item.address,
    status: "titularidade_confirmada",
  }));
  return {
    ...base,
    status: processing ? "processing" : "completed",
    outcome: processing ? "pending" : positive.length ? "assets_found" : "nothing_found",
    providerOrderId: String(input.providerOrderId || ""),
    providerRequestId,
    providerDetails,
    assets,
    nextAction: processing ? "poll_provider_result" : positive.length ? "request_digital_certificate" : "review_result",
    summary: processing
      ? "Aguardando resposta de um ou mais cartorios."
      : positive.length
        ? `${positive.length} matricula(s) tiveram titularidade confirmada pelos cartorios.`
        : "Nenhum cartorio confirmou titularidade atual para o CPF ou CNPJ.",
  };
}

async function runDigitalCertificateRequest(input, base, config, fetchImpl) {
  const registryOfficeId = asInteger(input.registryOfficeId || normalizeRegistryOfficeIds(input.registryOfficeIds)[0]);
  const registrationNumber = String(input.registrationNumber || "").trim();
  const purposeId = asInteger(input.certificatePurposeId);
  if (!registryOfficeId) {
    return { ...base, status: "waiting_user_action", outcome: "pending", nextAction: "select_registry_office", summary: "Selecione o cartorio responsavel pela matricula." };
  }
  if (!registrationNumber) {
    return { ...base, status: "waiting_user_action", outcome: "pending", nextAction: "provide_registration_number", summary: "Informe a matricula ou o CNM para solicitar a certidao." };
  }
  if (purposeId < 1 || purposeId > 5) {
    return { ...base, status: "waiting_user_action", outcome: "pending", nextAction: "select_certificate_purpose", summary: "Selecione a finalidade LGPD da Certidao Digital." };
  }
  const tokens = await loginAndGetTokens(config, fetchImpl, 1);
  const result = await callSoap({
    endpoint: config.endpoints.certificates,
    operation: "RegistrarSolicitacaoMatricula_v5",
    requestElementName: "Request",
    requestFields: {
      Hash: createOnrHash(config.credentials.key, tokens[0], config.hashCase),
      IDCartorio: registryOfficeId,
      NomeRequerente: config.credentials.requesterName,
      EmailRequerente: config.credentials.requesterEmail,
      CPFRequerente: config.credentials.requesterCpf,
      Matriculas: {
        Matricula: {
          IDTipoPedido: 4,
          Numero: registrationNumber,
          Letra: String(input.registrationLetter || "").trim(),
          IdentificacaoAdicional: String(input.additionalIdentification || "").trim(),
          Observacoes: String(input.notes || "").trim(),
        },
      },
      IdTipoFinalidade: String(purposeId),
      NumeroRegistral: String(input.referenceId || "").slice(0, 100),
    },
    timeoutMs: config.timeoutMs,
    fetchImpl,
  });
  assertSuccessfulResult(result, "solicitacao de Certidao Digital");
  return {
    ...base,
    providerMode: "api",
    status: "processing",
    outcome: "pending",
    providerOrderId: scalar(result.Protocolo),
    providerRequestId: asInteger(result.IDPedidoArisp),
    providerDetails: [{
      registryOfficeId,
      registrationNumber,
      status: scalar(result.Status),
      dueAt: scalar(result.PrazoEntrega),
      registryNumber: scalar(result.NumeroRegistral),
    }],
    providerCosts: {
      registryFees: asDecimal(result.CustoEmolumentos),
      stateFees: asDecimal(result.CustoEstado),
      administration: asDecimal(result.CustoAdministracao),
      tax: asDecimal(result.CustoISS),
      total: asDecimal(result.ValorTotal),
      providerBalance: asDecimal(result.Saldo),
      currency: "BRL",
    },
    assets: [{ id: `onr-cert-${registryOfficeId}-${registrationNumber}`, registrationNumber, registryOffice: String(input.registryOffice || ""), city: String(input.city || ""), uf: base.uf, status: "certidao_solicitada" }],
    nextAction: "poll_provider_result",
    summary: `Certidao Digital solicitada ao ONR com protocolo ${scalar(result.Protocolo) || "registrado"}.`,
  };
}

async function pollDigitalCertificate(input, base, config, fetchImpl) {
  const providerRequestId = asInteger(input.providerRequestId);
  if (!providerRequestId) {
    return { ...base, status: "failed", outcome: "inconclusive", nextAction: "review_provider_request", summary: "ID do pedido de Certidao Digital nao foi registrado." };
  }
  const tokens = await loginAndGetTokens(config, fetchImpl, 1);
  const result = await callSoap({
    endpoint: config.endpoints.certificates,
    operation: "VerificarRespostaSolicitacao_v4",
    requestFields: {
      Hash: createOnrHash(config.credentials.key, tokens[0], config.hashCase),
      IDPedidoArisp: String(providerRequestId),
      ProtocoloP: String(input.providerOrderId || ""),
    },
    timeoutMs: config.timeoutMs,
    fetchImpl,
  });
  assertSuccessfulResult(result, "acompanhamento da Certidao Digital");
  const providerDetails = asArray(result.Solicitacoes?.SolicitacaoV4).map((item) => ({
    requestId: asInteger(item?.IdSolicitacao),
    status: scalar(item?.Status),
    protocol: scalar(item?.ProtocoloSolicitacao),
    registrationNumber: scalar(item?.Matricula),
    responseType: scalar(item?.TipoResposta),
    rejectionReason: scalar(item?.MotivoDevolucao),
    attachments: asArray(item?.Anexos?.string).map(scalar).filter(Boolean),
  }));
  const pending = providerDetails.some((item) => !certificateStatusCompleted(item.status) && !certificateStatusFailed(item.status)) || !providerDetails.length;
  const failed = providerDetails.length > 0 && providerDetails.every((item) => certificateStatusFailed(item.status));
  const attachments = providerDetails.flatMap((item) => item.attachments);
  return {
    ...base,
    status: pending ? "processing" : failed ? "failed" : "completed",
    outcome: pending ? "pending" : failed ? "inconclusive" : "assets_found",
    providerOrderId: scalar(result.ProtocoloP || input.providerOrderId),
    providerRequestId,
    providerDetails,
    providerAttachments: attachments,
    nextAction: pending ? "poll_provider_result" : failed ? "review_provider_result" : "download_official_certificate",
    summary: pending
      ? "A Certidao Digital ainda esta sendo processada pelo cartorio."
      : failed
        ? "O cartorio devolveu ou cancelou o pedido de Certidao Digital."
        : `Certidao Digital respondida com ${attachments.length} anexo(s) oficial(is).`,
  };
}

async function runPriorSearch(input, subjectName, base, config, fetchImpl) {
  const tokens = await loginAndGetTokens(config, fetchImpl, 2);
  const state = await getStateByUf(config, fetchImpl, tokens[0], PESQUISA_PREVIA_SERVICE_ID, base.uf);

  const searchResult = await callSoap({
    endpoint: config.endpoints.priorSearch,
    operation: "ConsultaPesquisaPrevia_v4",
    requestFields: {
      Hash: createOnrHash(config.credentials.key, tokens[1], config.hashCase),
      CPFCNPJ: digitsOnly(input.documento),
      NomePessoa: subjectName,
      IDEstado: asInteger(state.ID),
      NomeRequerente: config.credentials.requesterName,
      EmailRequerente: config.credentials.requesterEmail,
      CPFRequerente: config.credentials.requesterCpf,
      Finalidade: config.credentials.purpose,
    },
    timeoutMs: config.timeoutMs,
    fetchImpl,
  });
  assertSuccessfulResult(searchResult, "Pesquisa Previa");

  const providerDetails = asArray(searchResult.ResultadoConsulta?.PesquisaPreviaBDLightResult_WSResp).map((item) => ({
    registryOfficeId: asInteger(item?.IDCartorio),
    registryOffice: scalar(item?.NomeCartorio),
    registrationNumber: scalar(item?.Matricula),
    occurrences: asInteger(item?.QtdeOcorrencias),
    lastUpdatedAt: scalar(item?.UltimaAtualizacao),
    qualifiedSearchAvailable: asBoolean(item?.BlnPesquisaBens),
    registrationViewAvailable: asBoolean(item?.BlnMatriculaOnline),
    digitalCertificateAvailable: asBoolean(item?.BlnCertidaoDigital),
  }));
  const positive = providerDetails.filter((item) => item.occurrences > 0 || item.registrationNumber);
  const inconclusive = providerDetails.some((item) => item.occurrences < 0);
  const assets = positive.map((item, index) => ({
    id: `onr-${item.registryOfficeId || index + 1}-${item.registrationNumber || "ocorrencia"}`,
    registrationNumber: item.registrationNumber,
    registryOffice: item.registryOffice,
    registryOfficeId: item.registryOfficeId,
    city: "",
    uf: base.uf,
    status: item.registrationNumber ? "matricula_localizada" : "ocorrencia_sem_matricula",
  }));
  const outcome = positive.length ? "assets_found" : inconclusive ? "inconclusive" : "nothing_found";

  return {
    ...base,
    providerMode: "api",
    status: "completed",
    outcome,
    providerOrderId: scalar(searchResult.Protocolo),
    providerRequestId: asInteger(searchResult.IDPesquisa),
    providerDetails,
    assets,
    providerCosts: {
      search: asDecimal(searchResult.VlPesquisa),
      administration: asDecimal(searchResult.VlTaxaAdmin),
      tax: asDecimal(searchResult.VlTaxaISS),
      total: asDecimal(searchResult.VlTotal),
      currency: "BRL",
    },
    nextAction: positive.length ? "request_qualified_search" : inconclusive ? "review_provider_result" : "review_result",
    summary: positive.length
      ? `${positive.length} cartorio(s) retornaram ocorrencia para o documento pesquisado.`
      : inconclusive
        ? "A Pesquisa Previa foi concluida, mas ao menos um cartorio nao respondeu de forma conclusiva."
        : "Nenhuma ocorrencia foi localizada nos cartorios consultados pelo ONR.",
  };
}

async function loginAndGetTokens(config, fetchImpl, minimumTokens) {
  const login = await callSoap({
    endpoint: config.endpoints.login,
    operation: "LoginClienteConvenio",
    requestFields: {
      Email: config.credentials.userEmail,
      CPF: config.credentials.userCpf,
      IDParceiro: config.credentials.partnerId,
    },
    timeoutMs: config.timeoutMs,
    fetchImpl,
  });
  assertSuccessfulResult(login, "login");
  if (!asBoolean(login.Ativo)) {
    throw new OnrSoapError("Usuario conveniado inativo no ONR.", { providerCode: "USER_INACTIVE" });
  }
  const tokens = asArray(login.Tokens?.string).map(scalar).filter(Boolean);
  if (tokens.length < minimumTokens) {
    throw new OnrSoapError(`O login do ONR retornou ${tokens.length} token(s), mas a operacao exige ${minimumTokens}.`, { providerCode: "TOKENS_MISSING" });
  }
  return tokens;
}

async function getStateByUf(config, fetchImpl, token, serviceType, uf) {
  const statesResult = await callSoap({
    endpoint: config.endpoints.states,
    operation: "EstadosListar",
    requestFields: {
      TipoServico: serviceType,
      Hash: createOnrHash(config.credentials.key, token, config.hashCase),
    },
    timeoutMs: config.timeoutMs,
    fetchImpl,
  });
  assertSuccessfulResult(statesResult, "listagem de estados");
  const states = asArray(statesResult.Estados?.Estado_WSResp);
  const normalizedUf = String(uf || "").trim().toUpperCase();
  const state = states.find((item) => scalar(item?.UF).toUpperCase() === normalizedUf);
  if (!state) {
    throw new OnrSoapError(`O convenio nao retornou ${normalizedUf} entre os estados habilitados para o servico.`, {
      providerCode: "STATE_NOT_ENABLED",
    });
  }
  return state;
}

async function callSoap({ endpoint, operation, requestFields, requestElementName = "oRequest", timeoutMs, fetchImpl }) {
  if (typeof fetchImpl !== "function") throw new OnrSoapError("Cliente HTTP indisponivel.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        accept: "text/xml",
        "content-type": "text/xml; charset=utf-8",
        soapaction: `"${SOAP_NAMESPACE}/${operation}"`,
        "user-agent": "Audita/0.1 WSRIDIGITAL",
      },
      body: buildSoapEnvelope(operation, requestFields, requestElementName),
    });
    const responseText = await response.text();
    if (!response.ok) {
      try {
        parseSoapOperationResult(responseText, operation);
      } catch (error) {
        if (error instanceof OnrSoapError) throw error;
      }
      throw new OnrSoapError(`WSRIDIGITAL retornou HTTP ${response.status}.`, { httpStatus: response.status });
    }
    return parseSoapOperationResult(responseText, operation);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new OnrSoapError("Tempo limite ao consultar o WSRIDIGITAL.", { providerCode: "TIMEOUT" });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function assertSuccessfulResult(result, stage) {
  if (asBoolean(result?.RETORNO)) return;
  throw new OnrSoapError(scalar(result?.ERRODESCRICAO) || `O ONR recusou a etapa de ${stage}.`, {
    providerCode: scalar(result?.CODIGOERRO || "ONR_ERROR"),
  });
}

function normalizeOnrFailure(error, base) {
  const providerCode = scalar(error?.providerCode || "");
  const message = String(error?.message || "Falha ao consultar o WSRIDIGITAL.").slice(0, 500);
  const insufficientBalance = providerCode === "32" || /saldo insuficiente/i.test(message);
  const credentialFailure = ["11", "13", "28", "29", "31", "45", "50", "51", "75", "USER_INACTIVE"].includes(providerCode)
    || /hash|parceiro|conveniad|credencial|usuario.*inativ/i.test(message);

  if (insufficientBalance) {
    return {
      ...base,
      status: "waiting_user_action",
      outcome: "pending",
      nextAction: "fund_onr_account",
      summary: "O convenio ONR nao possui saldo suficiente para executar a Pesquisa Previa.",
      providerError: { code: providerCode, message },
    };
  }
  return {
    ...base,
    status: credentialFailure ? "unavailable" : "failed",
    outcome: "inconclusive",
    nextAction: credentialFailure ? "review_provider_credentials" : "retry_provider",
    summary: credentialFailure ? "O ONR recusou as credenciais ou a habilitacao do convenio." : "A Pesquisa Previa nao foi concluida pelo ONR.",
    providerError: { code: providerCode || "ONR_ERROR", message },
  };
}

function officialRequestRequired(base, operation, reason) {
  return {
    ...base,
    providerMode: "official_manual",
    status: "waiting_user_action",
    outcome: "pending",
    nextAction: "complete_official_request",
    summary: `${reason} Enquanto isso, o pedido pode ser concluido diretamente no ${operation.label} oficial e o protocolo ou PDF registrado no Audita.`,
  };
}

export function normalizePropertyAssets(value) {
  const items = Array.isArray(value) ? value : [];
  return items.slice(0, 100).map((item, index) => ({
    id: String(item?.id || item?.propertyId || `imovel-${index + 1}`).slice(0, 160),
    registryOfficeId: asInteger(item?.registryOfficeId || item?.idCartorio),
    registrationNumber: String(item?.registrationNumber || item?.matricula || item?.numeroMatricula || "").slice(0, 120),
    registryOffice: String(item?.registryOffice || item?.cartorio || item?.serventia || "").slice(0, 300),
    city: String(item?.city || item?.municipio || "").slice(0, 160),
    uf: String(item?.uf || item?.state || "").trim().toUpperCase().slice(0, 2),
    address: String(item?.address || item?.endereco || "").slice(0, 1000),
    status: String(item?.status || item?.situacao || "localizado").slice(0, 120),
  }));
}

class OnrSoapError extends Error {
  constructor(message, { providerCode = "", httpStatus = 0, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "OnrSoapError";
    this.providerCode = String(providerCode || "");
    this.httpStatus = Number(httpStatus || 0);
  }
}

function scalar(value) {
  if (value === null || value === undefined || typeof value === "object") return "";
  return String(value).trim();
}

function asArray(value) {
  if (value === null || value === undefined || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

function asBoolean(value) {
  return /^(true|1)$/i.test(scalar(value));
}

function asInteger(value) {
  const parsed = Number.parseInt(scalar(value), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asDecimal(value) {
  const parsed = Number.parseFloat(scalar(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeRegistryOfficeIds(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(values.map(asInteger).filter((item) => item > 0))].slice(0, 200);
}

function qualifiedStatusLabel(statusId) {
  return {
    1: "processing",
    2: "owner_confirmed",
    3: "not_current_owner",
    4: "negative",
  }[statusId] || "unknown";
}

function certificateStatusCompleted(status) {
  return /^(respondido|respondido1|entregue|entregue_parcial)$/i.test(String(status || "").trim());
}

function certificateStatusFailed(status) {
  return /^(devolvido|cancelado|cancelado_pelo_solicitante|problema)$/i.test(String(status || "").trim());
}

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function envBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).trim().toLowerCase() === "true";
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}
