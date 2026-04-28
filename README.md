# Audita

Audita e uma plataforma SaaS/DaaS da Elevenmind para consulta, auditoria, coleta, normalizacao, analise e apresentacao de dados complexos de fontes judiciais, fiscais, imobiliarias e sistemas externos.

O projeto combina automacao, integracao por APIs, processamento por inteligencia artificial, relatorios analiticos, portal web, dashboards e canais conversacionais como WhatsApp.

## Objetivos

- Centralizar dados de auditoria e consulta em uma plataforma segura.
- Coletar dados via scraping controlado e integracoes por API.
- Normalizar dados em formato estruturado para analise e rastreabilidade.
- Gerar insights, alertas, recomendacoes e relatorios em linguagem clara.
- Oferecer uma experiencia web tecnologica, futurista e operacionalmente eficiente.
- Manter arquitetura preparada para multi-cliente, LGPD, auditoria e escala.

## Identidade visual

A interface da Audita deve usar tons de azul esverdeado, com linguagem visual futurista, tecnologica, clara e profissional. A estetica deve transmitir confianca, precisao, inteligencia analitica e seguranca.

Diretriz inicial de paleta:

- Azul petroleo profundo para fundos e navegacao.
- Ciano/teal para destaques, estados ativos e dados em tempo real.
- Verde agua para indicadores positivos e acentos de IA.
- Branco frio e cinzas azulados para legibilidade.
- Evitar visual excessivamente roxo, bege, marrom ou generico de dashboard.

## Stack prevista

A proposta comercial cita os seguintes pilares:

- Directus para gestao de dados e operacoes.
- OneDash para dashboards e visualizacao de KPIs.
- SkillShift para automacao e agentes digitais.
- AppCenter para infraestrutura, WhatsApp oficial, APIs e operacao.

A stack final da aplicacao deve ser confirmada em ADR antes da primeira implementacao significativa.

## Documentacao

- [Contexto para IA](docs/ai-context.md)
- [Arquitetura](docs/architecture.md)
- [Ambientes](docs/environments.md)
- [Banco de dados](docs/database.md)
- [Deploy](docs/deployment.md)
- [Seguranca](docs/security.md)
- [Operacoes](docs/operations.md)
- [Runbooks](docs/runbooks.md)
- [Contribuicao](CONTRIBUTING.md)
- [ADR inicial](docs/adr/0001-project-operating-model.md)

## Status

Projeto em fase inicial de estruturacao tecnica, com uma primeira interface web, API Node.js, schema PostgreSQL inicial e artefatos Docker para deploy no CapRover.

## Execucao local

Com Node.js disponivel:

```bash
PORT=3001 HOST=127.0.0.1 node server.mjs
```

Acesse:

```text
http://localhost:3001
```

## Deploy CapRover

O projeto inclui:

- `Dockerfile`
- `captain-definition`
- `.dockerignore`

No CapRover, configure o app para usar a porta interna `8080`.

Variaveis minimas do app `audita-staging` no CapRover:

```text
APP_ENV=staging
APP_URL=https://SEU_DOMINIO_DE_STAGING
PORT=8080
HOST=0.0.0.0
DATABASE_URL=postgres://audita_app_staging:SENHA@srv-captain--audita-db-staging:5432/audita_staging
AUDITA_AUTO_MIGRATE=true
DB_POOL_MAX=5
DB_SSL=false
AUDITA_AUTH_REQUIRED=true
AUDITA_BOOTSTRAP_ADMIN_EMAIL=admin@seudominio.com
AUDITA_BOOTSTRAP_ADMIN_PASSWORD=SENHA_FORTE
AUDITA_BOOTSTRAP_ADMIN_NAME=Audita Admin
COOKIE_SECURE=true
```

Nao commite valores reais de `DATABASE_URL`.

O usuario admin inicial e criado/atualizado automaticamente quando `AUDITA_BOOTSTRAP_ADMIN_EMAIL` e `AUDITA_BOOTSTRAP_ADMIN_PASSWORD` estao configurados. Depois do primeiro acesso em producao, troque a senha e remova ou rotacione essas variaveis conforme a politica de seguranca do ambiente.
