# Modulo De Auditoria CPF/CNPJ

## Endpoints

### Iniciar consulta

```http
POST /audit
Content-Type: application/json
```

```json
{
  "documento": "04252011000110",
  "tipoDocumento": "cnpj",
  "fontes": ["receita_federal", "pgfn", "cndt", "trf1", "tjdft", "fgts", "portal_transparencia"]
}
```

Resposta:

```json
{
  "consultaId": "uuid",
  "status": "pending"
}
```

### Consultar resultado

```http
GET /audit/:consultaId
```

Retorna documento mascarado, status geral, resultados por fonte e score de risco.

## Fontes Do MVP

- `receita_federal`: real para CNPJ cadastral usando API publica; Conecta Gov fica preparado por env.
- `portal_transparencia`: real quando `PORTAL_TRANSPARENCIA_API_KEY` estiver configurada.
- `pgfn`: skeleton para API oficial Conecta Gov CND.
- `cndt`: collector real de investigacao do portal oficial. Preenche CPF/CNPJ e para ao detectar captcha/reCAPTCHA; nao burla validacao humana.
- `trf1`: collector Playwright para a Certidão Unificada/CJF. Preenche tipo de certidão, órgãos, CPF/CNPJ, e-mail e nome social opcional; depende do portal estar acessível pela rede de execução.
- `tjdft`: real via wizard oficial, com download de PDFs quando o portal permite.
- `fgts`: real via portal oficial da Caixa quando o acesso nao estiver bloqueado por protecao anti-bot.

## Variaveis De Ambiente

```text
AUDIT_CACHE_TTL_SECONDS=900
AUDIT_COLLECTOR_TIMEOUT_MS=12000
AUDIT_COLLECTOR_RETRIES=1
CNDT_HEADLESS=true
CNDT_COLLECTOR_TIMEOUT_MS=60000
CNDT_STEP_TIMEOUT_MS=30000
TRF1_HEADLESS=true
TRF1_COLLECTOR_TIMEOUT_MS=120000
TRF1_STEP_TIMEOUT_MS=45000
TRF1_NETWORK_IDLE_TIMEOUT_MS=20000
PORTAL_TRANSPARENCIA_API_KEY=...
CONECTA_GOV_CNPJ_TOKEN=...
CONECTA_GOV_CND_TOKEN=...
```

Nunca versionar credenciais reais.

## Como Adicionar Nova Fonte

1. Criar um arquivo em `collectors/*.collector.mjs`.
2. Exportar `fonte`, `discoverIntegrationStrategy()` e `collect(input)`.
3. Priorizar API oficial documentada.
4. Usar endpoint HTTP/JSON publico somente se acessivel sem burlar autenticacao.
5. Usar HTML/PDF direto apenas quando permitido.
6. Usar Playwright somente como fallback controlado.
7. Atualizar o mapa de collectors em `services/audit.service.mjs`.

## Limitações E Riscos

- Captcha, login gov.br, certificado digital e pagamento impedem automacao direta confiavel.
- CNDT/TST exige captcha/reCAPTCHA no portal de emissao; a evolucao correta e uma etapa assistida para o usuario resolver a validacao e o app continuar o download na mesma sessao.
- Mudancas de layout e bloqueio de IP podem quebrar fluxos baseados em portal.
- Consultas por CPF/CNPJ exigem base legal, rastreabilidade e cuidado com LGPD.
- Fontes skeleton devem retornar `unavailable` em vez de simular sucesso.

