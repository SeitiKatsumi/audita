# Deploy

## Reunião de 08/10 — publicada em 09/10/2026

PR19, código/runtime `8fffb98`, CapRover `audita:152`; imagem anterior `151`. 575 testes Node/PGlite aprovados, CI da branch/main verde, Chrome com provedores fictícios até relatório/PDF e mobile sem overflow. Smoke, banco pronto, nove assets iguais ao Git e endpoints privados401 sem sessão. Main local/localhost3000 consolidada. Website68 preservado.

Sem dependências ou migração. Backup PostgreSQL/config validado antes do deploy em diretório privado do servidor, manifest `meeting-20261009-manifest.json`; comparação posterior confirmou env/volumes preservados. Padrões opcionais: `AUDITA_CHAT_AUDIO_MODEL=gpt-transcribe`, `AUDITA_CHAT_USD_BRL=6`; configuração existente não substituída. Nginx suporta corpo de 68 MB. Retorno: selecionar imagem151, preservando banco/chaves/volume.

O primeiro task do Swarm repetiu `No such container`, enquanto o substituto152 já estava healthy. Retomada nativa com `docker service update srv-captain--audita`, sem force, terminou em completed; 502 transitório resolvido e smoke aprovado. Causa recorrente da falha de task ainda merece investigação na infraestrutura; não foi feita alteração global de Docker, rede ou outros apps.

Decisões, orçamento estimado e dependências administrativas/VPS/documento real para custo em [meeting-20261008.md](meeting-20261008.md). Evidência de interface, apenas dados fictícios: [mobile](qa/meeting-certificates-mobile.png).

## Publicacao da reuniao de07/10 -08/10/2026

Publicacao autorizada de app/site: conciliar main6847c3 e trabalho local preservado. Regras30x/10x porfonte, zero10/gratis assinante, desconto30%, dois protestos/dossie, analisesmultiUF com checkout e retorno ao segmento. Reusa JSON criptografado, assinatura/acesso e checkout; sem migracao, novas dependencias, chaves ou volumes. Pedidos antigos mantem preco salvo. Antes/depois: backup PostgreSQL/config, env/volumes, CI, testes/PGlite, Chrome ficticio ate PDF, SHA/assets/health/autenticacao. Sem cobranca/emissao real como teste. Fonte gratuita somente para beneficio vigente validado no servidor, bypass nao qualifica; acesso individual existente preservado. Custos de empresas vinculadas inclusos no pacote, nao adicionar cobranca silenciosa. Sponsor/chaves Audita e franquia cincoCPF dependem de especificacao.

## Publicacao dos encaminhamentos de 06/10 - 07/10/2026

Usuario autorizou publicar app e site consolidados. Codigo77d53d4: selecao de certidoes por UF/Brasil, custo configurado20x, checkout Stripe antes da coleta e retorno com PDF privado; nenhuma migracao, dependencia, chave ou volume novo. Site bcc719e: CTAs das dez paginas encaminham aos modulos correspondentes. Validacao previa:560 testes Node/PGlite,15 do site, typecheck/build e Chrome ficticio ate PDF. Registrar backup, imagens anteriores, CI, SHA/health/assets e paginas publicas depois do deploy. Conferir eventos checkout.session.async_payment_succeeded, async_payment_failed e expired no endpoint existente; nao efetuar cobranca real para teste. Desconto40/50 e recarga Direct Data continuam sem regra/integracao confirmada.


## Publicacao dos segmentos comerciais - 06/10/2026

Usuario autorizou publicar todos os oito novos segmentos e a versao consolidada.
Reutilizam o fluxo de vendedor, com catalogo publico analysis-segments.js incluído
no Dockerfile e na lista publica, finalidade da IA salva por consulta e historicos
separados. Sem migracao, dependencia nova ou alteracao de chaves/volumes. Suite
completa:540 testes aprovados em PGlite; Chrome validou CPF/CNPJ ate PDF com
provedores ficticios. Conferir SHA servido, saude, catalogo/filtros e oito destinos
em producao, preservando o acesso autenticado dos resultados. Imagem anterior
audita:141 (5b7c0d1); rollback pela imagem anterior, sem restaurar banco.

## Publicacao de vendedor CPF/CNPJ - 05/10/2026

Usuario autorizou publicar a entrada por CNPJ e o enriquecimento cadastral por
CPF. Preservar a correcao ca214fd do checkout de teste, configuracao de provedores,
autenticacao e volumes privados. Sem nova dependencia ou migracao. Validar a
versao servida, cobertura empresarial, formulario e acesso privado apos deploy;
os testes completos usam dados e provedores ficticios, sem consultas pagas.

## Publicacao da analise documental - 29/09/2026

Usuario autorizou publicar o fluxo consolidado de IA e PDF do vendedor. Reutiliza
chave/modelo OpenAI existentes e volume privado de PDFs; nenhuma migracao nova.
Conferir `aiReady`, acesso autenticado ao historico e botao de analise das consultas
anteriores, sem repetir consultas pagas. Preservar banco, chaves e volumes; registrar
backup verificado, imagem anterior, SHA servido e validacao apos deploy no STATUS.
Testes de IA usam dados ficticios; publicar nao autoriza iniciar analise externa dos
documentos reais de uma consulta que ainda nao tem consentimento registrado.

## Publicacao da analise do vendedor - 28/09/2026

Publicacao autorizada pelo usuario. O app de producao existente e `audita`, em
`https://app.auditainteligente.com.br`. Preservar banco, chaves, autenticacao e
volumes. Nao ha migracao nova nesta entrega. Configurar
`DIRECT_DATA_SELLER_ENABLED` e conferir `DIRECT_DATA_TOKEN` no ambiente privado,
sem registrar seus valores. Confirmar armazenamento persistente de `storage/pdfs`.

Registrar backup e imagem anterior antes do deploy. Validar saude, versao servida,
catalogo de cobertura e o fluxo autenticado SP ate resultados, PDFs e historico.
Os 13 itens de SP sao sete certidoes, um comprovante PDF e cinco consultas de
dados. A analise consolidada por IA permanece pendente.

Publicado em 28/09: commit8d26f395, CapRover release129, imagem anterior128.
Health/banco/autenticacao verificados. O volume captain--audita-pdfs preserva
/app/storage/pdfs. Uma CNDT real passou pelo app, download e restauracao apos
recarregar; arquivo conferido no volume. O lote completo SP continua pendente
de saldo Direct Data. Consultar docs/STATUS.md antes de anunciar homologacao.

## Plataforma

O deploy sera realizado via CapRover/Docker em VPS propria.

Para portais governamentais que bloqueiam acessos fora do Brasil, o backend e o
Playwright devem rodar em uma VPS com IP brasileiro. O operador pode acessar a
interface de qualquer pais, mas as consultas saem do Chromium do servidor. Veja
o runbook completo em [Deploy Brasil](deployment-brasil.md).

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

O painel administrativo de dados usa um app Directus separado, com imagem
oficial fixada por versao, porta interna `8055`, HTTPS e volumes persistentes
para `/directus/uploads` e `/directus/extensions`. Ele se conecta ao mesmo
PostgreSQL somente pela rede interna do CapRover e com credencial propria de
menor privilegio.

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
AUDITA_AUTH_REQUIRED=true
AUDITA_BOOTSTRAP_ADMIN_EMAIL=admin@seudominio.com
AUDITA_BOOTSTRAP_ADMIN_PASSWORD=SENHA_FORTE
AUDITA_BOOTSTRAP_ADMIN_NAME=Audita Admin
COOKIE_SECURE=true
```

O valor real de `DATABASE_URL` deve ficar somente no CapRover/GitHub secrets, nunca no repositorio.

As variaveis `AUDITA_BOOTSTRAP_ADMIN_*` criam o primeiro usuario administrador. Elas nao devem ser versionadas e precisam usar uma senha forte.

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

Smoke test recomendado:

```bash
AUDITA_BASE_URL=https://audita.seudominio.com.br npm run smoke:production
```

Depois de provisionar ou atualizar o Directus, validar tambem:

- `GET /server/health` retorna estado operacional;
- login administrativo funciona via HTTPS;
- as colecoes `audita_*` aparecem sem expor acesso publico anonimo;
- reiniciar o app preserva metadados e uploads;
- nenhuma porta PostgreSQL foi publicada.

## Arquivos esperados

- `Dockerfile`
- `captain-definition`
- `.env.example`
- workflow GitHub Actions em `.github/workflows`

Esses arquivos devem ser criados quando a stack tecnica for definida.
