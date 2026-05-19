import { fetchJson, failedResult, successResult, unavailableResult, SOURCE_RESULT, withRetry } from "./base.collector.mjs";

export const fonte = "portal_transparencia";

const PORTAL_API_BASE_URL = "https://api.portaldatransparencia.gov.br";

const BASES = [
  {
    nome: "CEIS",
    slug: "ceis",
    path: "/api-de-dados/ceis",
    documentParamByType: {
      cpf: "codigoSancionado",
      cnpj: "codigoSancionado",
    },
  },
  {
    nome: "CNEP",
    slug: "cnep",
    path: "/api-de-dados/cnep",
    documentParamByType: {
      cpf: "codigoSancionado",
      cnpj: "codigoSancionado",
    },
  },
  {
    nome: "CEAF",
    slug: "ceaf",
    path: "/api-de-dados/ceaf",
    documentParamByType: {
      cpf: "cpfSancionado",
    },
  },
  {
    nome: "Acordos de Leniencia",
    slug: "acordos_leniencia",
    path: "/api-de-dados/acordos-leniencia",
    documentParamByType: {
      cnpj: "cnpjSancionado",
    },
  },
];

export function discoverIntegrationStrategy() {
  return [
    "1. API oficial documentada: OpenAPI v3 do Portal da Transparencia, usando header chave-api-dados.",
    "2. Endpoint HTTP/JSON publico: /api-de-dados/ceis, /cnep, /ceaf e /acordos-leniencia.",
    "3. Request HTTP normal: GET com pagina=1 e parametro oficial por base: codigoSancionado, cpfSancionado ou cnpjSancionado.",
    "4. Playwright: nao necessario para esta fonte.",
    "5. PDF/OCR: nao necessario porque a resposta oficial e JSON.",
  ];
}

export async function collect(input) {
  const apiKey = process.env.PORTAL_TRANSPARENCIA_API_KEY || process.env.CGU_API_KEY || "";
  if (!apiKey) {
    return unavailableResult(
      fonte,
      "Configure PORTAL_TRANSPARENCIA_API_KEY para consultar CEIS, CNEP, CEAF e acordos de leniencia automaticamente.",
      {
        integrationStrategy: discoverIntegrationStrategy(),
        officialDocs: "https://api.portaldatransparencia.gov.br/v3/api-docs",
      },
    );
  }

  const documento = digitsOnly(input.documento);
  const bases = BASES.map((base) => buildBaseQuery(base, input.tipoDocumento, documento));
  const consultas = [];

  for (const base of bases) {
    if (!base.aplicavel) {
      consultas.push({
        nome: base.nome,
        slug: base.slug,
        status: "nao_aplicavel",
        total: 0,
        registros: [],
        observacao: base.observacao,
      });
      continue;
    }

    try {
      const data = await withRetry(
        ({ timeoutMs }) =>
          fetchJson(
            base.endpoint,
            {
              headers: {
                "chave-api-dados": apiKey,
              },
            },
            timeoutMs,
          ),
        { retries: input.retries, timeoutMs: input.timeoutMs },
      );

      const registros = normalizeResponse(data, base.slug);
      consultas.push({
        nome: base.nome,
        slug: base.slug,
        status: "success",
        endpoint: removeSensitiveQuery(base.endpoint),
        parametroDocumento: base.documentParam,
        total: registros.length,
        registros: registros.slice(0, 20),
      });
    } catch (error) {
      consultas.push({
        nome: base.nome,
        slug: base.slug,
        status: "failed",
        endpoint: removeSensitiveQuery(base.endpoint),
        parametroDocumento: base.documentParam,
        total: 0,
        registros: [],
        erro: normalizeError(error),
      });
    }
  }

  const aplicaveis = consultas.filter((consulta) => consulta.status !== "nao_aplicavel");
  const todasFalharam = aplicaveis.length > 0 && aplicaveis.every((consulta) => consulta.status === "failed");
  if (todasFalharam) {
    return failedResult(fonte, "Todas as consultas aplicaveis ao Portal da Transparencia falharam.", {
      integrationStrategy: discoverIntegrationStrategy(),
      consultas,
    });
  }

  const totalRegistros = consultas.reduce((sum, consulta) => sum + consulta.total, 0);
  const basesComFalha = consultas.filter((consulta) => consulta.status === "failed").map((consulta) => consulta.nome);

  return successResult(fonte, totalRegistros > 0 ? SOURCE_RESULT.CONSTA : SOURCE_RESULT.NADA_CONSTA, {
    totalRegistros,
    basesConsultadas: consultas.filter((consulta) => consulta.status === "success").map((consulta) => consulta.nome),
    basesNaoAplicaveis: consultas.filter((consulta) => consulta.status === "nao_aplicavel").map((consulta) => consulta.nome),
    basesComFalha,
    consultas,
  });
}

function buildBaseQuery(base, tipoDocumento, documento) {
  const documentParam = base.documentParamByType[tipoDocumento];
  if (!documentParam) {
    return {
      ...base,
      aplicavel: false,
      observacao: `${base.nome} nao possui consulta por ${tipoDocumento.toUpperCase()} na API oficial mapeada.`,
    };
  }

  const endpoint = new URL(base.path, PORTAL_API_BASE_URL);
  endpoint.searchParams.set(documentParam, documento);
  endpoint.searchParams.set("pagina", "1");

  return {
    ...base,
    aplicavel: true,
    documentParam,
    endpoint: endpoint.toString(),
  };
}

function normalizeResponse(data, slug) {
  const records = Array.isArray(data) ? data : data ? [data] : [];
  return records.map((record) => normalizeRecord(record, slug));
}

function normalizeRecord(record, slug) {
  if (slug === "ceaf") {
    const punicao = record.punicao || record;
    return compactObject({
      id: record.id,
      base: "CEAF",
      nome: punicao.nomePunido || record.nomePunido,
      documento: punicao.cpfPunidoFormatado || record.cpfPunidoFormatado,
      orgao: record.orgaoLotacao?.nome || record.orgaoLotacao,
      tipo: punicao.descricaoPunicao || record.descricaoPunicao,
      dataPublicacao: record.dataPublicacao || punicao.dataPublicacao,
      raw: record,
    });
  }

  if (slug === "acordos_leniencia") {
    return compactObject({
      id: record.id,
      base: "Acordos de Leniencia",
      nome: record.sancionado?.nome || record.nomeSancionado || record.razaoSocial,
      documento: record.sancionado?.codigoFormatado || record.cnpjSancionadoFormatado || record.cnpjSancionado,
      situacao: record.situacao?.descricao || record.situacaoAcordo || record.situacao,
      dataInicio: record.dataInicioSancao || record.dataInicioAcordo,
      dataFim: record.dataFimSancao || record.dataFimAcordo,
      orgao: record.orgaoSancionador?.nome || record.orgaoResponsavel?.nome,
      raw: record,
    });
  }

  return compactObject({
    id: record.id,
    base: slug.toUpperCase(),
    nome: record.sancionado?.nome || record.pessoa?.nome || record.nomeSancionado,
    documento: record.sancionado?.codigoFormatado || record.pessoa?.codigoFormatado || record.codigoSancionado,
    tipo: record.tipoSancao?.descricao || record.tipoSancao?.descricaoResumida || record.tipoSancao,
    orgao: record.orgaoSancionador?.nome || record.orgaoSancionador,
    dataInicio: record.dataInicioSancao,
    dataFim: record.dataFimSancao,
    publicacao: record.dataPublicacao,
    raw: record,
  });
}

function removeSensitiveQuery(endpoint) {
  const url = new URL(endpoint);
  for (const key of [...url.searchParams.keys()]) {
    if (key !== "pagina") {
      url.searchParams.set(key, "***");
    }
  }
  return url.toString();
}

function normalizeError(error) {
  const parts = [error.message];
  if (error.status === 401 || error.status === 403) {
    parts.push("verifique PORTAL_TRANSPARENCIA_API_KEY");
  }
  if (error.status === 429) {
    parts.push("rate limit da API oficial");
  }
  return parts.filter(Boolean).join("; ");
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ""));
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}
