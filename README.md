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

Projeto em fase inicial de estruturacao tecnica, com uma primeira interface web estatica e artefatos Docker para deploy no CapRover.

## Execucao local

Com Node.js disponivel:

```bash
node server.mjs
```

Acesse:

```text
http://localhost:3001
```

## Deploy CapRover

O projeto inclui:

- `Dockerfile`
- `captain-definition`
- `nginx.conf`
- `.dockerignore`

No CapRover, configure o app para usar a porta interna `8080`.
