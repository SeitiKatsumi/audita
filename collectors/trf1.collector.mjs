import { unavailableResult } from "./base.collector.mjs";

export const fonte = "trf1";

export function discoverIntegrationStrategy() {
  return [
    "1. API oficial documentada: TODO confirmar se a certidao TRF1 possui API publica.",
    "2. Endpoint HTTP/JSON publico: TODO inspecionar formulario oficial e chamadas de rede.",
    "3. Request HTTP normal: usar apenas se houver endpoint publico sem captcha/autenticacao.",
    "4. Playwright: fallback para formulario dinamico/download quando permitido.",
    "5. PDF/OCR: extrair texto da certidao PDF emitida.",
  ];
}

export async function collect() {
  return unavailableResult(fonte, "TRF1/certidao de distribuicao ainda precisa de mapeamento do endpoint oficial.", {
    integrationStrategy: discoverIntegrationStrategy(),
  });
}

