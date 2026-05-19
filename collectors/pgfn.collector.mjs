import { unavailableResult } from "./base.collector.mjs";

export const fonte = "pgfn";

export function discoverIntegrationStrategy() {
  return [
    "1. API oficial documentada: Consulta CND via Conecta Gov existe e pode emitir/consultar certidao RFB/PGFN.",
    "2. Endpoint HTTP/JSON publico: nao usar endpoints privados sem autorizacao.",
    "3. Request HTTP normal: nao aplicavel sem credencial oficial.",
    "4. Playwright: somente apos analise autorizada, pois fluxo publico pode envolver validacoes/captcha.",
    "5. PDF/OCR: extrair texto quando a API oficial retornar PDF.",
  ];
}

export async function collect(input) {
  if (process.env.CONECTA_GOV_CND_TOKEN) {
    return unavailableResult(fonte, "Credencial Conecta Gov CND detectada, mas chamada oficial ainda precisa ser implementada.", {
      todo: "Usar endpoint /api-cnd/v1/ConsultaCnd/certidao com TipoContribuinte, ContribuinteConsulta e GerarCertidaoPdf.",
      documentoTipo: input.tipoDocumento,
    });
  }

  return unavailableResult(fonte, "API oficial CND/RFB/PGFN exige adesao Conecta Gov, chave, certificado e termo de responsabilidade.", {
    integrationStrategy: discoverIntegrationStrategy(),
  });
}

