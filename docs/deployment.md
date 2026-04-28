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

- `Dockerfile`
- `captain-definition`
- `nginx.conf`
- `.dockerignore`

O container usa Nginx unprivileged e escuta internamente na porta `8080`.

No CapRover, configurar o app para usar:

- Repository: `https://github.com/SeitiKatsumi/audita`
- Branch de staging: `develop`
- Branch de producao: `main`
- Container HTTP Port: `8080`

Enquanto o projeto estiver como app estatico, nao ha variaveis obrigatorias em producao. Quando backend, Directus, banco ou IA forem adicionados, as variaveis devem ser criadas por ambiente no CapRover/GitHub e documentadas em `.env.example`.

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
