import crypto from "node:crypto";

import {
  isValidDocument,
  maskDocument,
  normalizeDocument,
} from "./audit.service.mjs";

const DEFAULT_BASE_URL = "https://apiv3.directd.com.br/api";
const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_SUPPORTED_UFS = Object.freeze(["PE", "PI", "SC", "SP"]);
const ALL_UFS = new Set([
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
]);

function cleanText(value, maxLength = 400) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function positiveNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseSupportedUfs(value) {
  const parsed = String(value || "")
    .split(",")
    .map((uf) => uf.trim().toUpperCase())
    .filter((uf) => ALL_UFS.has(uf));
  return parsed.length ? [...new Set(parsed)] : [...DEFAULT_SUPPORTED_UFS];
}

function normalizeProcessNumber(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 30);
}

function normalizeDegree(value) {
  const parsed = Number(value);
  return parsed === 2 ? 2 : parsed === 1 ? 1 : 0;
}

function normalizeSearch(input = {}) {
  const uf = cleanText(input.uf, 2).toUpperCase();
  const degree = normalizeDegree(input.degree);
  const processNumber = normalizeProcessNumber(input.processNumber);
  const document = normalizeDocument(input.document);
  const documentType = document.length === 11 ? "cpf" : document.length === 14 ? "cnpj" : "";
  const searchType = processNumber ? "process_number" : documentType ? "document" : "";

  return {
    authorizationConfirmed: input.authorizationConfirmed === true,
    requestId: cleanText(input.requestId, 100),
    uf,
    degree,
    processNumber,
    document,
    documentType,
    searchType,
  };
}

function validateSearch(search, supportedUfs) {
  if (!search.authorizationConfirmed) return "authorization_required";
  if (!ALL_UFS.has(search.uf)) return "invalid_uf";
  if (!supportedUfs.includes(search.uf)) return "unsupported_uf";
  if (![1, 2].includes(search.degree)) return "invalid_degree";
  if (search.searchType === "process_number" && search.processNumber.length < 10) {
    return "invalid_process_number";
  }
  if (
    search.searchType === "document" &&
    !isValidDocument(search.documentType, search.document)
  ) {
    return "invalid_document";
  }
  if (!search.searchType) return "search_identifier_required";
  return "";
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function latestMovement(movements) {
  const list = Array.isArray(movements) ? movements : [];
  const movement = list.at(-1) || null;
  if (!movement) return null;
  return {
    date: cleanText(movement.data, 40),
    title: cleanText(movement.movimento || movement.descricao, 240),
  };
}

function processNumberFrom(value) {
  if (typeof value === "string") return cleanText(value, 40);
  return cleanText(value?.numero, 40);
}

function processSummary(source = {}, context = {}) {
  const number = processNumberFrom(source.numeroProcesso || source.numero);
  if (!number) return null;
  return {
    processNumber: number,
    degree: Number(context.degree || 1),
    courtUnit: cleanText(
      source.vara || source.orgaoJulgador || context.courtUnit,
      180,
    ),
    courtLocation: cleanText(context.courtLocation, 160),
    className: cleanText(source.classe, 180),
    subject: cleanText(source.assunto, 240),
    distributionDate: cleanText(source.distribuicao?.data, 40),
    status: cleanText(context.status, 120),
    lastMovement: latestMovement(source.movimentacoes),
  };
}

function appendProcess(target, seen, process) {
  if (!process?.processNumber || seen.has(process.processNumber)) return;
  seen.add(process.processNumber);
  target.push(process);
}

export function normalizeDirectDataCourtResponse(payload = {}, search = {}) {
  const metadata = payload.metaDados || payload.metadados || {};
  const result = payload.retorno || payload.resultado || {};
  const processes = [];
  const seen = new Set();

  appendProcess(
    processes,
    seen,
    processSummary(
      {
        numeroProcesso: result.numeroProcesso,
        classe: result.classe,
        assunto: result.assunto,
        movimentacoes: result.movimentacoes,
      },
      { degree: result.grau || search.degree, status: result.status },
    ),
  );

  for (const forum of result.primeiroGrau?.foros || []) {
    appendProcess(
      processes,
      seen,
      processSummary(forum.dadosProcesso, {
        degree: 1,
        courtLocation: forum.foro,
        status: result.status,
      }),
    );
    for (const summary of forum.resumoProcessos || []) {
      appendProcess(
        processes,
        seen,
        processSummary(
          {
            numeroProcesso: summary.numero,
            classe: summary.classe,
            assunto: summary.assunto,
            distribuicao: summary.distribuicao,
          },
          {
            degree: 1,
            courtLocation: forum.foro,
            status: result.status,
          },
        ),
      );
    }
  }

  for (const session of result.segundoGrau?.sessoes || []) {
    appendProcess(
      processes,
      seen,
      processSummary(session.dadosProcesso, {
        degree: 2,
        courtLocation: session.sessao,
        status: result.status,
      }),
    );
    for (const summary of session.resumoProcessos || []) {
      appendProcess(
        processes,
        seen,
        processSummary(
          {
            numeroProcesso: summary.numero,
            classe: summary.classe,
            assunto: summary.assunto,
            distribuicao: summary.distribuicao,
          },
          {
            degree: 2,
            courtLocation: session.sessao,
            status: result.status,
          },
        ),
      );
    }
  }

  return {
    status: processes.length ? "found" : "not_found",
    provider: "Direct Data",
    source: "TJ - Tribunal de Justica - Processos",
    uf: cleanText(result.uf || search.uf, 2).toUpperCase(),
    degree: Number(result.grau || search.degree || 1),
    searchedBy: search.searchType,
    subjectMasked:
      search.searchType === "document"
        ? maskDocument(search.documentType, search.document)
        : search.processNumber.replace(/.(?=.{6})/g, "*"),
    count: processes.length,
    processes: processes.slice(0, 30),
    queriedAt: new Date().toISOString(),
    providerReference: cleanText(metadata.consultaUid, 100),
    providerMessage: cleanText(metadata.mensagem, 240),
    disclaimer:
      "Consulta de acompanhamento via provedor de dados. Confirme prazos e atos no portal oficial do tribunal.",
  };
}

function providerFailure(status) {
  if (status === 401) return "provider_authentication_failed";
  if (status === 403) return "provider_permission_or_balance_required";
  if ([408, 503].includes(status)) return "provider_temporarily_unavailable";
  if (status === 400) return "provider_rejected_parameters";
  return "provider_request_failed";
}

export function createDirectDataCourtService({
  env = process.env,
  fetchImpl = globalThis.fetch,
  creditsService = null,
  recordApiUsage = null,
  now = () => new Date(),
} = {}) {
  const token = cleanText(env.DIRECT_DATA_TOKEN, 500);
  const enabled = String(env.DIRECT_DATA_TJ_ENABLED || "false").toLowerCase() === "true";
  const baseUrl = cleanText(env.DIRECT_DATA_API_BASE_URL, 500) || DEFAULT_BASE_URL;
  const supportedUfs = parseSupportedUfs(env.DIRECT_DATA_TJ_SUPPORTED_UFS);
  const timeoutMs = positiveInteger(env.DIRECT_DATA_TJ_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const creditCost = positiveInteger(env.DIRECT_DATA_TJ_CREDIT_COST, 1);
  const queryCostBrl = positiveNumber(env.DIRECT_DATA_TJ_QUERY_COST_BRL, 0);
  const requestCache = new Map();

  function getStatus() {
    const configured = Boolean(
      enabled && token && token !== "change-me" && /^https:\/\//i.test(baseUrl),
    );
    return {
      enabled,
      configured,
      provider: "Direct Data",
      source: "TJ - Tribunal de Justica - Processos",
      supportedUfs: [...supportedUfs],
      creditCost,
      queryCostBrl: queryCostBrl || null,
      docsUrl: "https://apiv3.directd.com.br/swagger/index.html",
      mode: "read_only",
    };
  }

  async function recordUsage(authContext, result, search, referenceId) {
    if (typeof recordApiUsage !== "function") return;
    try {
      await recordApiUsage(authContext, {
        provider: "directdata",
        service: "tribunal_justica",
        operation: "process_search",
        status: result.status === "failed" ? "failed" : "success",
        requestCount: 1,
        quantity: result.status === "found" ? 1 : 0,
        unitName: "consulta",
        referenceId:
          result.providerReference || referenceId || crypto.randomUUID(),
        actualCost:
          result.status === "found" && queryCostBrl > 0 ? queryCostBrl : null,
        currency: "BRL",
        metadata: {
          uf: search.uf,
          degree: search.degree,
          searchedBy: search.searchType,
          resultStatus: result.status,
          processCount: Number(result.count || 0),
        },
      });
    } catch {
      // Usage telemetry must never change the provider result.
    }
  }

  async function executeSearch(input, authContext) {
    const configuration = getStatus();
    if (!configuration.configured) {
      return {
        unavailable: true,
        reason: enabled ? "direct_data_token_missing" : "direct_data_disabled",
        configuration,
      };
    }

    const search = normalizeSearch(input);
    const validationError = validateSearch(search, supportedUfs);
    if (validationError === "unsupported_uf") {
      return {
        unsupported: true,
        reason: validationError,
        supportedUfs: [...supportedUfs],
        configuration,
      };
    }
    if (validationError) {
      return { invalid: true, reason: validationError, configuration };
    }

    if (creditsService) {
      const wallet = await creditsService.getWallet(authContext);
      if (wallet.enabled && wallet.balance < creditCost) {
        return {
          insufficientCredits: true,
          creditCost,
          wallet,
          configuration,
        };
      }
    }

    const url = new URL(`${baseUrl.replace(/\/+$/, "")}/TribunalJustica`);
    url.searchParams.set("TOKEN", token);
    url.searchParams.set("UF", search.uf);
    url.searchParams.set("GRAU", String(search.degree));
    if (search.searchType === "process_number") {
      url.searchParams.set("NUMEROPROCESSO", search.processNumber);
    } else {
      url.searchParams.set(search.documentType.toUpperCase(), search.document);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(url, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
    } catch (error) {
      const result = {
        failed: true,
        status: "failed",
        reason:
          error?.name === "AbortError"
            ? "provider_timeout"
            : "provider_connection_failed",
        configuration,
      };
      await recordUsage(authContext, result, search, search.requestId);
      return result;
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 404) {
      const result = {
        ...normalizeDirectDataCourtResponse({}, search),
        status: "not_found",
        count: 0,
        processes: [],
        queriedAt: now().toISOString(),
        configuration,
      };
      await recordUsage(authContext, result, search, search.requestId);
      return { result, configuration };
    }

    const payload = parseJson(await response.text());
    if (!response.ok) {
      const result = {
        failed: true,
        status: "failed",
        reason: providerFailure(response.status),
        providerStatus: response.status,
        configuration,
      };
      await recordUsage(authContext, result, search, search.requestId);
      return result;
    }

    const result = {
      ...normalizeDirectDataCourtResponse(payload, search),
      queriedAt: now().toISOString(),
      configuration,
    };

    if (result.status === "found" && creditsService) {
      const charge = await creditsService.consume(authContext, {
        amount: creditCost,
        referenceId:
          result.providerReference || search.requestId || crypto.randomUUID(),
        operation: "direct_data_tj_process_search",
        metadata: {
          provider: "directdata",
          uf: search.uf,
          degree: search.degree,
          searchedBy: search.searchType,
        },
      });
      if (!charge.ok) {
        await recordUsage(authContext, result, search, search.requestId);
        return {
          insufficientCredits: true,
          creditCost,
          wallet: charge.wallet,
          configuration,
        };
      }
      result.wallet = charge.wallet;
    }

    await recordUsage(authContext, result, search, search.requestId);
    return { result, configuration };
  }

  async function search(input = {}, authContext = {}) {
    const requestId = cleanText(input.requestId, 100);
    const tenantId = cleanText(authContext?.tenantId, 100) || "public";
    if (!requestId) return executeSearch(input, authContext);

    const cacheKey = `${tenantId}:${requestId}`;
    if (requestCache.has(cacheKey)) return requestCache.get(cacheKey);

    const task = executeSearch(input, authContext).then((result) => {
      if (
        result?.failed ||
        result?.unavailable ||
        result?.invalid ||
        result?.unsupported ||
        result?.insufficientCredits
      ) {
        requestCache.delete(cacheKey);
      }
      return result;
    });
    requestCache.set(cacheKey, task);
    if (requestCache.size > 200) {
      requestCache.delete(requestCache.keys().next().value);
    }
    return task;
  }

  return { getStatus, search };
}
