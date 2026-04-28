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
