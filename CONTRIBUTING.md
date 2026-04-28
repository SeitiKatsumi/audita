# Contribuicao

## Fluxo

1. Criar issue ou tarefa.
2. Criar branch a partir de `develop`.
3. Implementar mudanca com escopo claro.
4. Rodar validacoes locais.
5. Abrir pull request.
6. Aguardar revisao.
7. Fazer merge apos CI verde.

## Branches

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
