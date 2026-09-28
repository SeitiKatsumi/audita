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
      cnpj: data.taxId || "",
      razaoSocial: data.company?.name || "",
      nomeFantasia: data.alias || "",
      situacao: data.status?.text || "",
      cnaePrincipal: data.mainActivity?.text || "",
      municipio: data.address?.city || "",
      uf: data.address?.state || "",
      endereco: [data.address?.street, data.address?.number, data.address?.district, data.address?.city, data.address?.state]
        .filter(Boolean)
        .join(", "),
      dataAbertura: data.founded || null,
      dataSituacao: data.statusDate || null,
      atualizadoEm: data.updated || null,
      capitalSocial: data.company?.equity ?? null,
      porte: data.company?.size?.text || "",
      naturezaJuridica: data.company?.nature?.text || "",
      cnaesSecundarios: data.sideActivities || [],
      simplesNacional: data.company?.simples || null,
      mei: data.company?.simei || null,
      qsa: Array.isArray(data.company?.members) ? data.company.members.map((member) => ({
        nome: member.person?.name || "",
        documento: member.person?.taxId || "",
        qualificacao: member.role?.text || "",
        dataEntrada: member.since || null,
        pais: member.person?.country?.name || "",
      })) : null,
    };
  }

  return {
    cnpj: data.cnpj || "",
    razaoSocial: data.razao_social || "",
    nomeFantasia: data.nome_fantasia || "",
    situacao: data.descricao_situacao_cadastral || "",
    cnaePrincipal: data.cnae_fiscal_descricao || "",
    municipio: data.municipio || "",
    uf: data.uf || "",
    endereco: [data.descricao_tipo_de_logradouro, data.logradouro, data.numero, data.bairro, data.municipio, data.uf]
      .filter(Boolean)
      .join(", "),
    dataAbertura: data.data_inicio_atividade || null,
    dataSituacao: data.data_situacao_cadastral || null,
    atualizadoEm: null,
    capitalSocial: data.capital_social ?? null,
    porte: data.porte || "",
    naturezaJuridica: data.natureza_juridica || "",
    cnaesSecundarios: data.cnaes_secundarios || [],
    simplesNacional: typeof data.opcao_pelo_simples === "boolean" ? {
      optant: data.opcao_pelo_simples,
      since: data.data_opcao_pelo_simples || null,
      until: data.data_exclusao_do_simples || null,
    } : null,
    mei: typeof data.opcao_pelo_mei === "boolean" ? {
      optant: data.opcao_pelo_mei,
      since: data.data_opcao_pelo_mei || null,
      until: data.data_exclusao_do_mei || null,
    } : null,
    qsa: Array.isArray(data.qsa) ? data.qsa.map((member) => ({
      nome: member.nome_socio || "",
      documento: member.cnpj_cpf_do_socio || "",
      qualificacao: member.qualificacao_socio || "",
      dataEntrada: member.data_entrada_sociedade || null,
      pais: member.pais || "",
    })) : null,
  };
}

export async function collect(input) {
  const cnpj = String(input.extraFields?.cnpjDocument || input.documento || "").replace(/\D/g, "");
  if (input.tipoDocumento !== "cnpj" && !input.extraFields?.cnpjDocument) {
    return unavailableResult(fonte, "Consulta cadastral da Receita/CNPJ nao se aplica a CPF neste MVP.");
  }
  if (!/^\d{14}$/.test(cnpj)) {
    return unavailableResult(fonte, "Informe um CNPJ com 14 digitos para consultar o cadastro empresarial.");
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
      if (String(dados.cnpj).replace(/\D/g, "") !== cnpj || !dados.razaoSocial) {
        throw new Error("Resposta cadastral sem identificacao correspondente ao CNPJ consultado");
      }
      return successResult(fonte, SOURCE_RESULT.INDISPONIVEL, {
        ...dados,
        endpoint,
        natureza: "consulta_cadastral_cnpj",
        regularidadeFiscal: "nao_avaliada",
        fonte: new URL(endpoint).hostname,
        observacao: "Dados cadastrais e societarios de base publica espelhada, sujeitos a defasagem. Situacao cadastral nao comprova ausencia de debitos nem substitui certidao fiscal RFB/PGFN ou certidao da Junta Comercial.",
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

