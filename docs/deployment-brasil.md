# Deploy Brasil Para Consultas Governamentais

Este runbook coloca o backend e o Chromium/Playwright do Audita em uma VPS com IP brasileiro. O operador pode continuar usando o sistema de fora do Brasil; as consultas aos portais oficiais saem do servidor brasileiro.

## Decisao Padrao

- Infra: VPS Ubuntu LTS no Brasil, preferencialmente Sao Paulo.
- Tamanho inicial: 2 vCPU, 4 GB RAM, 40 GB SSD.
- PaaS: CapRover + Docker.
- App: `audita-production`.
- Porta interna: `8080`.
- Banco: PostgreSQL interno no CapRover ou banco gerenciado no Brasil.
- Browser assistido: habilitado, sem solver de CAPTCHA.

## Provedores Aceitos

Use qualquer provedor que entregue IP brasileiro estavel, acesso root e Docker:

- Oracle Cloud: Sao Paulo ou Vinhedo.
- AWS: `sa-east-1`.
- Google Cloud: `southamerica-east1`.
- VPS brasileira: Locaweb, Hostini, TurboCloud, Mettric ou equivalente.

Evite proxy rotativo, IP compartilhado de baixa reputacao e servicos que prometem "burlar" CAPTCHA. Se um portal exigir CAPTCHA, Cloudflare, Turnstile, login ou certificado digital, o Audita deve pausar para validacao humana.

## Preparar A VPS

1. Criar uma VPS Ubuntu 22.04 ou 24.04 no Brasil.
2. Liberar portas no firewall do provedor:
   - `22/tcp` para SSH.
   - `80/tcp` para HTTP.
   - `443/tcp` para HTTPS.
   - `3000/tcp` temporariamente para painel inicial do CapRover.
3. Apontar DNS:
   - `captain.seudominio.com.br` para o IP da VPS.
   - `*.captain.seudominio.com.br` para o mesmo IP.
   - opcional: `audita.seudominio.com.br` para o mesmo IP.
4. Conectar por SSH e rodar:

```bash
curl -fsSL https://raw.githubusercontent.com/SeitiKatsumi/audita/main/scripts/bootstrap-br-vps.sh -o bootstrap-br-vps.sh
chmod +x bootstrap-br-vps.sh
sudo ./bootstrap-br-vps.sh
```

5. Abrir `http://IP_DA_VPS:3000` e finalizar o setup do CapRover.
6. Configurar o root domain no CapRover, por exemplo:

```text
captain.seudominio.com.br
```

7. Ativar HTTPS no CapRover.
8. Depois que o CapRover estiver acessivel por HTTPS, fechar a porta `3000/tcp`
   no firewall do provedor e na VPS.

## Criar Apps No CapRover

Criar:

- `audita-production`
- `audita-db-production` ou PostgreSQL gerenciado equivalente

No app `audita-production`:

- Container HTTP Port: `8080`
- Repository: `https://github.com/SeitiKatsumi/audita`
- Branch: `main`
- Build: usar o `captain-definition` do repo
- HTTPS: ativo

## Variaveis De Ambiente

Configurar no CapRover, nunca no Git:

```text
APP_ENV=production
APP_URL=https://audita.seudominio.com.br
PORT=8080
HOST=0.0.0.0

DATABASE_URL=postgres://audita_app_production:SENHA@srv-captain--audita-db-production:5432/audita_production
AUDITA_AUTO_MIGRATE=true
DB_POOL_MAX=5
DB_SSL=false

AUDITA_AUTH_REQUIRED=true
AUDITA_BOOTSTRAP_ADMIN_EMAIL=admin@seudominio.com
AUDITA_BOOTSTRAP_ADMIN_PASSWORD=SENHA_FORTE
AUDITA_BOOTSTRAP_ADMIN_NAME=Audita Admin
COOKIE_SECURE=true
AUTH_SECRET=VALOR_ALEATORIO_FORTE

AUDIT_CACHE_TTL_SECONDS=900
AUDIT_COLLECTOR_TIMEOUT_MS=12000
AUDIT_COLLECTOR_RETRIES=1

AUDITA_CAPTCHA_LAB_MODE=false
AUDITA_REMOTE_ASSISTED_BROWSER=true
STATE_COURT_ASSISTED_HEADLESS=true
STATE_COURT_KEEP_ASSISTED_OPEN=true
STATE_COURT_ASSISTED_SLOW_MO_MS=150
STATE_COURT_STEP_TIMEOUT_MS=30000
STATE_COURT_NAV_TIMEOUT_MS=45000

TJDFT_HEADLESS=true
FGTS_HEADLESS=true
FGTS_COLLECTOR_TIMEOUT_MS=90000
FGTS_STEP_TIMEOUT_MS=30000
CNDT_HEADLESS=true
CNDT_COLLECTOR_TIMEOUT_MS=60000
CNDT_STEP_TIMEOUT_MS=30000
TRF1_HEADLESS=true
TRF1_COLLECTOR_TIMEOUT_MS=120000
TRF1_STEP_TIMEOUT_MS=45000
TRF1_NETWORK_IDLE_TIMEOUT_MS=20000

OPENAI_API_KEY=...
PORTAL_TRANSPARENCIA_API_KEY=...
CONECTA_GOV_CNPJ_TOKEN=...
CONECTA_GOV_CND_TOKEN=...
LOG_LEVEL=info
```

Depois do primeiro login em producao, rotacione ou remova `AUDITA_BOOTSTRAP_ADMIN_PASSWORD`.

## Deploy

Opcao CLI:

```bash
npx caprover deploy \
  -h https://captain.seudominio.com.br \
  -p SENHA_CAPROVER \
  -a audita-production \
  -b main
```

Opcao Dashboard:

1. Entrar no painel CapRover.
2. Abrir `audita-production`.
3. Usar deploy via GitHub ou upload tar.
4. Confirmar que o build usou o `Dockerfile`.

## Smoke Test Pos-Deploy

Rodar localmente:

```bash
AUDITA_BASE_URL=https://audita.seudominio.com.br npm run smoke:production
```

O smoke test valida:

- `/api/health`
- `/api/config`
- carregamento do HTML principal
- se o app esta em `production`
- se o banco esta pronto quando `DATABASE_URL` esta configurado

## Validacao Dos Portais

1. Executar uma consulta simples que falhava no Japao.
2. Verificar que o portal abre pelo navegador remoto assistido.
3. Resolver CAPTCHA/Cloudflare manualmente quando aparecer.
4. Confirmar que o PDF ou protocolo aparece no resultado.
5. Conferir logs do CapRover se algum portal continuar bloqueado.

## Rollback

1. No CapRover, usar One Click Rollback para voltar ao deploy anterior.
2. Confirmar `/api/health`.
3. Validar login e uma consulta simples.
4. Registrar a versao que falhou e o motivo.
