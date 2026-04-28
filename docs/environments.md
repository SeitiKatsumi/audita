# Ambientes

## Desenvolvimento local

Usado por desenvolvedores e Codex.

- Banco local ou container Docker.
- Dados ficticios ou anonimizados.
- `.env.local` nao versionado.
- Seed controlado para reproduzir cenarios.
- Sem acesso padrao a dados de producao.

## Staging

Ambiente de homologacao no CapRover, proximo da producao.

- App separado de producao.
- Banco separado.
- Dominio separado.
- Secrets separados.
- Deploy automatico a partir de `develop`.
- Dados ficticios, sanitizados ou amostra autorizada.

## Producao

Ambiente real no CapRover.

- Deploy a partir de `main` ou tags de release.
- Aprovacao manual recomendada.
- Banco privado, sem porta publica.
- Backups automaticos.
- Monitoramento e alertas ativos.
- Acesso restrito a pessoas autorizadas.

## Branches sugeridas

- `main`: producao.
- `develop`: staging.
- `feature/*`: novas funcionalidades.
- `fix/*`: correcoes.
- `hotfix/*`: correcoes urgentes de producao.

## Dominios sugeridos

- `audita.elevenmind.com.br`: producao.
- `staging-audita.elevenmind.com.br`: staging.
- `localhost`: desenvolvimento.
