import { failedResult, successResult, unavailableResult, SOURCE_RESULT, withRetry } from "./base.collector.mjs";

export const fonte = "cnib";

export const CNIB_NATURE_CODES = Object.freeze(["IBI", "IBG", "IBC", "IBM", "IBF", "IBS", "IBP", "IBT"]);

const CNIB_NATURE_CODE_SET = new Set(CNIB_NATURE_CODES);
const BIGDATACORP_MARKETPLACE_URL = "https://plataforma.bigdatacorp.com.br/marketplace";
const DATASETS_BY_DOCUMENT_TYPE = {
  cpf: "partner_quod_credit_risk_details_person",
  cnpj: "partner_quod_credit_risk_details_company",
};

export function discoverIntegrationStrategy() {
  return [
    "1. Integracao DaaS: BigDataCorp Marketplace, sem scraping do portal CNIB/ONR.",
    "2. Endpoint HTTP/JSON: POST /marketplace com headers AccessToken e TokenId.",
    "3. Dataset PF: partner_quod_credit_risk_details_person.",
    "4. Dataset PJ: partner_quod_credit_risk_details_company.",
    "5. Naturezas IBI, IBG, IBC, IBM, IBF, IBS, IBP e IBT sao tratadas como indicador de indisponibilidade de bens.",
  ];
}

export function selectDatasetForDocumentType(tipoDocumento) {
  return DATASETS_BY_DOCUMENT_TYPE[String(tipoDocumento || "").toLowerCase()] || "";
}

export function buildMarketplacePayload({ tipoDocumento, documento }) {
  const dataset = selectDatasetForDocumentType(tipoDocumento);
  return {
    q: `doc{${digitsOnly(documento)}}`,
    Datasets: dataset,
    Limit: 1,
  };
}

export async function collect(input) {
  const enabled = String(process.env.BIGDATACORP_CNIB_ENABLED || "false").toLowerCase() === "true";
  const accessToken = String(process.env.BIGDATACORP_ACCESS_TOKEN || "").trim();
  const tokenId = String(process.env.BIGDATACORP_TOKEN_ID || "").trim();
  const endpoint = String(process.env.BIGDATACORP_MARKETPLACE_URL || BIGDATACORP_MARKETPLACE_URL).trim();
  const dataset = selectDatasetForDocumentType(input.tipoDocumento);

  if (!dataset) {
    return unavailableResult(fonte, "Informe CPF ou CNPJ para consultar indisponibilidade de bens.", {
      integrationStrategy: discoverIntegrationStrategy(),
    });
  }

  if (!enabled || !accessToken || !tokenId) {
    return unavailableResult(
      fonte,
      "Consulta BigDataCorp/CNIB ainda nao configurada. Defina BIGDATACORP_CNIB_ENABLED=true, BIGDATACORP_ACCESS_TOKEN e BIGDATACORP_TOKEN_ID.",
      {
        provider: "BigDataCorp",
        dataset,
        enabled,
        hasAccessToken: Boolean(accessToken),
        hasTokenId: Boolean(tokenId),
        integrationStrategy: discoverIntegrationStrategy(),
        docs: {
          pessoa: "https://docs.bigdatacorp.com.br/plataforma/reference/marketplace-dados-restritivos-quod-pessoa",
          empresa: "https://docs.bigdatacorp.com.br/plataforma/reference/marketplace-dados-restritivos-quod-empresa",
          tokens: "https://docs.bigdatacorp.com.br/plataforma/reference/api-tokens-gerar",
        },
      },
    );
  }

  const payload = buildMarketplacePayload({ tipoDocumento: input.tipoDocumento, documento: input.documento });

  try {
    const data = await withRetry(
      ({ timeoutMs }) =>
        fetchMarketplace(endpoint, {
          accessToken,
          tokenId,
          payload,
          timeoutMs,
        }),
      { retries: input.retries, timeoutMs: input.timeoutMs || 12000 },
    );

    if (!data || typeof data !== "object") {
      await recordMarketplaceUsage(input, dataset, "failed");
      return failedResult(fonte, "BigDataCorp retornou uma resposta vazia ou invalida.", {
        provider: "BigDataCorp",
        dataset,
      });
    }

    await recordMarketplaceUsage(input, dataset, "success");

    const ocorrencias = extractCnibOccurrences(data);
    const naturezaCodes = [...new Set(ocorrencias.map((item) => item.natureza).filter(Boolean))];
    const hasOccurrence = naturezaCodes.length > 0;
    const observacaoJuridica =
      "Resultado via provedor de dados; validar se substitui ou complementa a certidao oficial CNIB conforme contrato/fonte habilitada.";

    return successResult(
      fonte,
      hasOccurrence ? SOURCE_RESULT.CONSTA : SOURCE_RESULT.NADA_CONSTA,
      {
        provider: "BigDataCorp",
        dataset,
        totalOcorrencias: ocorrencias.length,
        naturezaCodes,
        ocorrencias: ocorrencias.slice(0, 20),
        resumo: hasOccurrence
          ? "BigDataCorp retornou indicador de indisponibilidade de bens."
          : "BigDataCorp nao retornou indicador de indisponibilidade de bens.",
        observacaoJuridica,
        classificacaoFonte: "indicador_provedor_dados",
        docs: {
          pessoa: "https://docs.bigdatacorp.com.br/plataforma/reference/marketplace-dados-restritivos-quod-pessoa",
          empresa: "https://docs.bigdatacorp.com.br/plataforma/reference/marketplace-dados-restritivos-quod-empresa",
        },
      },
      {
        rawText: sanitizeRawResponse(data, input.documento),
      },
    );
  } catch (error) {
    await recordMarketplaceUsage(input, dataset, error?.name === "AbortError" ? "cancelled" : "failed", {
      httpStatus: error?.status || null,
    });
    return failedResult(fonte, `Falha ao consultar BigDataCorp: ${normalizeErrorMessage(error)}.`, {
      provider: "BigDataCorp",
      dataset,
      httpStatus: error?.status || null,
      errorData: sanitizeErrorData(error?.data),
    });
  }
}

async function recordMarketplaceUsage(input, dataset, status, metadata = {}) {
  if (typeof input?.recordApiUsage !== "function") return;
  try {
    await input.recordApiUsage(input.usageContext || {}, {
      provider: "bigdatacorp",
      service: "marketplace",
      operation: "asset_unavailability",
      model: dataset,
      status,
      requestCount: 1,
      quantity: 1,
      unitName: "consulta",
      referenceId: `${input.consultaId || "cnib"}:bigdatacorp`,
      metadata: { dataset, ...metadata },
    });
  } catch (error) {
    console.error("[audita] failed to record BigDataCorp usage", error);
  }
}

async function fetchMarketplace(endpoint, { accessToken, tokenId, payload, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "Audita/0.1 cnib-bigdatacorp-collector",
        AccessToken: accessToken,
        TokenId: tokenId,
      },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text.slice(0, 2000) };
    }
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export function extractCnibOccurrences(data) {
  const occurrences = [];
  walkValue(data, (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return;
    }

    const natureza = findNatureCode(value);
    if (!natureza) {
      return;
    }

    occurrences.push(compactObject({
      natureza,
      tipo: readFirst(value, ["Tipo", "tipo", "Type", "type", "Descricao", "descricao", "Description", "description"]),
      origem: readFirst(value, ["Origem", "origem", "Source", "source", "Fonte", "fonte"]),
      data: readFirst(value, ["Data", "data", "Date", "date", "DataOcorrencia", "dataOcorrencia"]),
      valor: readFirst(value, ["Valor", "valor", "Amount", "amount"]),
      rawKeys: Object.keys(value).slice(0, 20),
    }));
  });
  return occurrences;
}

function findNatureCode(record) {
  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = normalizeText(key);
    if (!/(nature|natureza|codigo|code|tipo)/i.test(normalizedKey)) {
      continue;
    }
    const code = normalizeNatureCode(value);
    if (code) {
      return code;
    }
  }
  return "";
}

function normalizeNatureCode(value) {
  const text = String(value || "").trim().toUpperCase();
  if (CNIB_NATURE_CODE_SET.has(text)) {
    return text;
  }
  const match = text.match(/\bIB[IGCMFSPT]\b/);
  return match && CNIB_NATURE_CODE_SET.has(match[0]) ? match[0] : "";
}

function walkValue(value, visitor, seen = new Set()) {
  if (!value || typeof value !== "object") {
    return;
  }
  if (seen.has(value)) {
    return;
  }
  seen.add(value);
  visitor(value);
  if (Array.isArray(value)) {
    value.forEach((item) => walkValue(item, visitor, seen));
    return;
  }
  Object.values(value).forEach((item) => walkValue(item, visitor, seen));
}

function readFirst(record, keys) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && String(record[key]).trim()) {
      return String(record[key]).trim();
    }
  }
  return "";
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== "" && item !== null && item !== undefined));
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function sanitizeRawResponse(data, documento) {
  const raw = JSON.stringify(data || {}).slice(0, 10000);
  const documentDigits = digitsOnly(documento);
  let sanitized = raw;
  if (documentDigits) {
    sanitized = sanitized.replaceAll(documentDigits, maskDocumentDigits(documentDigits));
  }
  return sanitized.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "***.***.***-**").replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "**.***.***/****-**");
}

function sanitizeErrorData(data) {
  if (!data) {
    return null;
  }
  return JSON.parse(sanitizeRawResponse(data, ""));
}

function maskDocumentDigits(digits) {
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}********${digits.slice(-2)}`;
  }
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}************${digits.slice(-2)}`;
  }
  return "***";
}

function normalizeErrorMessage(error) {
  if (error?.name === "AbortError") {
    return "timeout";
  }
  return error?.message || "erro desconhecido";
}
