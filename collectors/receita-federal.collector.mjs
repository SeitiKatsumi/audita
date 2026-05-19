import { fetchJson, failedResult, successResult, unavailableResult, SOURCE_RESULT, withRetry } from "./base.collector.mjs";

export const fonte = "receita_federal";

export function discoverIntegrationStrategy() {
  return [
    "1. API oficial documentada: Consulta CNPJ via Conecta Gov existe, mas exige adesao, OAuth, IP liberado e credenciais.",
    "2. Endpoint HTTP/JSON publico: usar bases publicas/espelhadas de CNPJ quando o documento for CNPJ.",
    "3. Request HTTP normal: fallback entre BrasilAPI e Open CNPJa.",
    "4. Playwright: nao usado neste collector.",
    "5. PDF/OCR: nao necessario para dados cadastrais CNPJ.",
  ];
}

function summarize(data) {
  if (data.company || data.taxId) {
    return {
      razaoSocial: data.company?.name || "",
      nomeFantasia: data.alias || "",
      situacao: data.status?.text || "",
      cnaePrincipal: data.mainActivity?.text || "",
      municipio: data.address?.city || "",
      uf: data.address?.state || "",
      endereco: [data.address?.street, data.address?.number, data.address?.district, data.address?.city, data.address?.state]
        .filter(Boolean)
        .join(", "),
    };
  }

  return {
    razaoSocial: data.razao_social || "",
    nomeFantasia: data.nome_fantasia || "",
    situacao: data.descricao_situacao_cadastral || "",
    cnaePrincipal: data.cnae_fiscal_descricao || "",
    municipio: data.municipio || "",
    uf: data.uf || "",
    endereco: [data.descricao_tipo_de_logradouro, data.logradouro, data.numero, data.bairro, data.municipio, data.uf]
      .filter(Boolean)
      .join(", "),
  };
}

export async function collect(input) {
  const cnpj = String(input.extraFields?.cnpjDocument || input.documento || "").replace(/\D/g, "");
  if (input.tipoDocumento !== "cnpj" && !input.extraFields?.cnpjDocument) {
    return unavailableResult(fonte, "Consulta cadastral da Receita/CNPJ nao se aplica a CPF neste MVP.");
  }

  const endpoints = [
    `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
    `https://open.cnpja.com/office/${cnpj}`,
  ];

  let lastError;
  for (const endpoint of endpoints) {
    try {
      const data = await withRetry(
        ({ timeoutMs }) => fetchJson(endpoint, {}, timeoutMs),
        { retries: input.retries, timeoutMs: input.timeoutMs },
      );
      const dados = summarize(data);
      return successResult(fonte, SOURCE_RESULT.NADA_CONSTA, {
        ...dados,
        endpoint,
        observacao: "Consulta cadastral publica. Nao equivale a certidao fiscal PGFN/RFB.",
      });
    } catch (error) {
      lastError = error;
    }
  }

  if (process.env.CONECTA_GOV_CNPJ_TOKEN) {
    return unavailableResult(fonte, "Credencial Conecta Gov CNPJ detectada, mas integracao oficial ainda nao foi ativada neste collector.", {
      todo: "Implementar chamada ao endpoint oficial Conecta Gov Consulta CNPJ com OAuth/token e IP autorizado.",
    });
  }

  return failedResult(fonte, `Nao foi possivel consultar APIs publicas de CNPJ: ${lastError?.message || "erro desconhecido"}.`);
}

