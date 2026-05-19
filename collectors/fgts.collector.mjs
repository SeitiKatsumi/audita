import { unavailableResult } from "./base.collector.mjs";

export const fonte = "fgts";

export function discoverIntegrationStrategy() {
  return [
    "1. API oficial documentada: nao localizada para CRF aberta.",
    "2. Endpoint HTTP/JSON publico: TODO mapear consulta CRF Caixa se existir sem captcha.",
    "3. Request HTTP normal: usar somente se houver endpoint publico permitido.",
    "4. Playwright: fallback para fluxo de portal, sem burlar captcha/autenticacao.",
    "5. PDF/OCR: extrair texto do CRF emitido.",
  ];
}

export async function collect(input) {
  if (input.tipoDocumento !== "cnpj") {
    return unavailableResult(fonte, "CRF/FGTS e voltado a empregador por CNPJ/CEI/CAEPF; nao se aplica a CPF neste MVP.");
  }

  return unavailableResult(fonte, "CRF/FGTS depende de mapeamento seguro do portal Caixa ou API autorizada.", {
    officialUrl: "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf",
    integrationStrategy: discoverIntegrationStrategy(),
  });
}

