# Arquitetura

## Visao geral

A Audita deve ser organizada como uma plataforma modular, com separacao clara entre interface, API, processamento de dados, integracoes, banco e observabilidade.

```text
Usuario / Cliente
  -> Portal Web
  -> WhatsApp Oficial

Portal Web
  -> API da Audita
  -> Servicos de autenticacao e permissoes

API da Audita
  -> Banco transacional
  -> Filas/jobs de coleta
  -> Servicos de IA
  -> Directus / AppCenter / OneDash / SkillShift

Workers
  -> Scraping controlado
  -> Integracoes externas
  -> Normalizacao JSON
  -> Analises e relatorios

Observabilidade
  -> Logs estruturados
  -> Metricas
  -> Alertas
  -> Backups
```

## Modulos principais

- Portal web: experiencia principal do usuario.
- API: regras de negocio, autenticacao, permissoes e integracoes.
- Coleta: scraping, APIs externas, agendamentos e importacoes.
- Consultas governamentais: catalogo de fontes oficiais, API interna de pedidos, rastreabilidade por tenant e adapters isolados por fonte.
- Normalizacao: padronizacao dos dados coletados.
- IA: analises, explicacoes, alertas, predicoes e recomendacoes.
- Relatorios: geracao de documentos, dashboards e historico.
- WhatsApp: consulta rapida, notificacoes e acompanhamento.
- Administracao: usuarios, clientes, permissoes, fontes, logs e auditoria.

## Principios

- Aplicacao stateless sempre que possivel.
- Banco e volumes com persistencia controlada.
- Segregacao por ambiente.
- Permissoes minimas.
- Auditoria de acoes sensiveis.
- Dados reais protegidos por LGPD.
- Deploy rastreavel por commit.

## Decisoes pendentes

- Framework frontend.
- Framework backend.
- Banco principal.
- Estrategia de fila/jobs.
- Provedor de IA.
- Estrategia de armazenamento de arquivos.
- Formato de multi-tenancy.
