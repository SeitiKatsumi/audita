# ADR 0001: Modelo Operacional Do Projeto

## Status

Aceita inicialmente.

## Contexto

A Audita sera desenvolvida com apoio do Codex, versionada no GitHub e implantada em CapRover/Docker em VPS propria. O projeto precisa ser continuavel por multiplos desenvolvedores e por diferentes contas de IA sem depender do historico de conversas.

## Decisao

O repositorio sera a fonte principal de contexto tecnico, contendo documentacao de arquitetura, seguranca, deploy, banco, operacoes, runbooks, contribuicao e contexto para IA.

O fluxo recomendado sera:

- `develop` para staging;
- `main` para producao;
- Pull Requests obrigatorios;
- CI antes de merge;
- deploy rastreavel por commit;
- secrets fora do codigo;
- banco separado por ambiente.

## Consequencias

Beneficios:

- Continuidade entre desenvolvedores.
- Menor dependencia de conversas.
- Melhor rastreabilidade de decisoes.
- Base reutilizavel como padrao Elevenmind.

Custos:

- Mais disciplina documental.
- Necessidade de manter docs atualizadas.
- Mais etapas antes de deploy em producao.
