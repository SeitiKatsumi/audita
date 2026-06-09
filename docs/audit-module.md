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
AUDITA_CAPTCHA_LAB_MODE=false
AUDITA_REMOTE_ASSISTED_BROWSER=true
STATE_COURT_ASSISTED_HEADLESS=true
STATE_COURT_KEEP_ASSISTED_OPEN=true
STATE_COURT_ASSISTED_SLOW_MO_MS=150
STATE_COURT_STEP_TIMEOUT_MS=30000
STATE_COURT_NAV_TIMEOUT_MS=45000
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

## Laboratorio Local De Validacao Humana

Para validar localmente ate onde um portal oficial permite avancar, use:

```text
AUDITA_CAPTCHA_LAB_MODE=true
AUDITA_REMOTE_ASSISTED_BROWSER=true
STATE_COURT_ASSISTED_HEADLESS=true
STATE_COURT_KEEP_ASSISTED_OPEN=true
STATE_COURT_ASSISTED_SLOW_MO_MS=150
```

Esse modo abre o navegador assistido no backend, preenche os campos reconhecidos e registra `captchaLab` no resultado da fonte com:

- politica `no_bypass`;
- checkpoint humano detectado;
- campos preenchidos;
- se a sessao ficou aberta;
- se houve indicio de CAPTCHA/reCAPTCHA, login, confirmacao oficial ou bloqueio anti-bot.

Com `AUDITA_REMOTE_ASSISTED_BROWSER=true`, o Chromium nao abre janela na maquina do operador; ele roda no backend e aparece no Audita por screenshots interativos. Para depuracao local com janela fisica, use `AUDITA_REMOTE_ASSISTED_BROWSER=false` e `STATE_COURT_ASSISTED_HEADLESS=false`.

O laboratorio nao deve usar solver, automacao para resolver CAPTCHA, proxy rotativo ou ocultacao de origem para contornar validacoes oficiais. Quando houver CAPTCHA/reCAPTCHA, Cloudflare/Turnstile, login, certificado digital ou confirmacao equivalente, a execucao deve pausar para acao humana no portal oficial.

### Navegador Remoto Assistido

Quando uma fonte retorna `assistedSession`, o Audita pode mostrar a sessao Playwright dentro da propria interface sem iframe. O app busca screenshots do navegador remoto e envia cliques, texto, teclas e scroll para a sessao mantida no backend.

O retorno da sessao inclui um resumo seguro do formulario (`formState`) com quantidade de controles preenchidos e previews mascarados. Isso serve para validar se a tela oficial continua preenchida depois de atualizar ou recuperar a sessao, sem expor os valores completos na interface.

Endpoints internos:

```http
GET /api/assisted-sessions/:sessionId
POST /api/assisted-sessions/:sessionId
GET /api/assisted-sessions/:sessionId/result
```

Acoes aceitas no `POST`:

```json
{ "type": "click", "x": 100, "y": 200 }
{ "type": "type", "text": "texto" }
{ "type": "press", "key": "Enter" }
{ "type": "scroll", "deltaY": 520 }
{ "type": "submit" }
{ "type": "recover" }
{ "type": "close" }
```

`submit` aciona o botao oficial visivel do portal quando o formulario ja foi preenchido. `recover` tenta voltar para a pagina anterior ou reabrir a URL oficial e, em sessoes ESAJ, re-preenche os campos conhecidos da consulta. A rota `/result` inspeciona a pagina atual para identificar PDF, protocolo, erro oficial ou validacao pendente e pode gerar captura para evidencia.

Esse recurso foi desenhado para mobile e operacao remota: o usuario interage pelo Audita, enquanto o Chromium roda no backend. A validacao humana continua sendo feita pelo usuario no portal oficial exibido na sessao remota.

