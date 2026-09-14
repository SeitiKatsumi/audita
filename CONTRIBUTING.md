# Contribuicao

## Fluxo

1. Ler `AGENTS.md` e `docs/STATUS.md`; criar issue ou tarefa com responsável e escopo.
2. Buscar referências remotas e criar branch a partir de `develop`, salvo base explicitamente acordada para a tarefa. Cada pessoa usa checkout/worktree próprio.
3. Implementar mudanca com escopo claro.
4. Rodar validacoes locais.
5. Atualizar `docs/STATUS.md`, enviar a branch e abrir pull request.
6. Aguardar revisao.
7. Fazer merge apos CI verde.

## Branches

- `codex/nome-curto` para tarefas do Codex.

- `feature/nome-curto`
- `fix/nome-curto`
- `hotfix/nome-curto`
- `docs/nome-curto`

## Pull requests

Todo PR deve conter:

- objetivo;
- principais alteracoes;
- como testar;
- riscos;
- screenshots quando houver interface;
- impacto em banco, deploy ou secrets.

## Padroes

- Nao commitar secrets.
- Atualizar docs quando mudar comportamento relevante.
- Criar ADR para decisoes arquiteturais importantes.
- Preferir solucoes simples, seguras e rastreaveis.
- Manter consistencia visual com a identidade da Audita.

## Trabalho simultâneo

Registre responsável, branch, arquivos compartilhados e próximo passo em `docs/STATUS.md`. Combine sobreposições pela issue/PR ou canal da equipe. Não altere a branch no diretório usado pelo colega, não descarte mudanças alheias e não use force push para solucionar divergências. O status só chega ao outro computador após push e fetch/pull; ele não substitui a comunicação entre as pessoas.
