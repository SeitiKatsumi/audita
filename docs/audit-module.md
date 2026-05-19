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
- `cndt`: skeleton porque o fluxo oficial pode exigir captcha.
- `trf1`: skeleton aguardando mapeamento do endpoint oficial.
- `tjdft`: skeleton aguardando mapeamento do endpoint oficial.
- `fgts`: skeleton/manual para CRF Caixa.

## Variaveis De Ambiente

```text
AUDIT_CACHE_TTL_SECONDS=900
AUDIT_COLLECTOR_TIMEOUT_MS=12000
AUDIT_COLLECTOR_RETRIES=1
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
- Mudancas de layout e bloqueio de IP podem quebrar fluxos baseados em portal.
- Consultas por CPF/CNPJ exigem base legal, rastreabilidade e cuidado com LGPD.
- Fontes skeleton devem retornar `unavailable` em vez de simular sucesso.

