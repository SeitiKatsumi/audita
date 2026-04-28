# Deploy

## Plataforma

O deploy sera realizado via CapRover/Docker em VPS propria.

## Estrategia recomendada

```text
feature/* -> Pull Request
develop   -> staging
main      -> producao
```

## CapRover

Criar apps separados:

- `audita-staging`
- `audita-production`

Cada app deve ter:

- variaveis proprias;
- dominio proprio;
- banco proprio;
- logs separados;
- health check;
- deploy rastreavel por commit.

## Deploy Docker atual

O projeto possui uma primeira versao estatica pronta para build Docker via CapRover:
O projeto possui uma primeira versao web com API Node.js e PostgreSQL pronta para build Docker via CapRover:

- `Dockerfile`
- `captain-definition`
- `.dockerignore`

O container usa Node.js e escuta internamente na porta `8080`.

No CapRover, configurar o app para usar:

- Repository: `https://github.com/SeitiKatsumi/audita`
- Branch de staging: `develop`
- Branch de producao: `main`
- Container HTTP Port: `8080`

Variaveis de staging recomendadas:

```text
APP_ENV=staging
APP_URL=https://SEU_DOMINIO_DE_STAGING
PORT=8080
HOST=0.0.0.0
DATABASE_URL=postgres://audita_app_staging:SENHA@srv-captain--audita-db-staging:5432/audita_staging
AUDITA_AUTO_MIGRATE=true
DB_POOL_MAX=5
DB_SSL=false
```

O valor real de `DATABASE_URL` deve ficar somente no CapRover/GitHub secrets, nunca no repositorio.

## CI/CD

Pipeline minima:

1. instalar dependencias;
2. validar formatacao;
3. rodar lint;
4. rodar testes;
5. buildar imagem Docker;
6. publicar/deployar conforme ambiente.

## Rollback

Antes de cada deploy em producao:

- confirmar backup recente;
- registrar versao atual;
- validar migracoes;
- definir caminho de rollback;
- executar smoke test pos-deploy.

## Arquivos esperados

- `Dockerfile`
- `captain-definition`
- `.env.example`
- workflow GitHub Actions em `.github/workflows`

Esses arquivos devem ser criados quando a stack tecnica for definida.
