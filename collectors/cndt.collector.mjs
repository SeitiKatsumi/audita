import { unavailableResult } from "./base.collector.mjs";

export const fonte = "cndt";

export function discoverIntegrationStrategy() {
  return [
    "1. API oficial documentada: nao localizada para emissao aberta da CNDT.",
    "2. Endpoint HTTP/JSON publico: TODO mapear se o portal usa endpoint publico sem captcha.",
    "3. Request HTTP normal: nao usar para burlar captcha.",
    "4. Playwright: somente para fluxo humano/autorizado; o TST informa preenchimento de captcha.",
    "5. PDF/OCR: extrair texto do PDF baixado quando houver emissao autorizada.",
  ];
}

export async function collect() {
  return unavailableResult(fonte, "CNDT/TST exige fluxo oficial com captcha; collector real depende de analise manual/autorizada.", {
    officialUrl: "https://www.tst.jus.br/certidao1",
    integrationStrategy: discoverIntegrationStrategy(),
  });
}

