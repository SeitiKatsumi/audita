# ProcessOnline — busca, autos privados e análise assistida

Implementação local em `codex/processonline-integracao`, com transporte, fluxo
persistente, rotas privadas, interface, downloads e análise dos autos. A integração
permanece desativada até que o titular obtenha acesso B2B e configure a chave
adequada. Testes simulados não equivalem a homologação ou entrega real.

## Acesso e contratação pendentes

A API exige cadastro de parceiro aprovado. Inicie pelo
[cadastro oficial](https://processonline.com.br/seja-parceiro); o
[painel do parceiro](https://processonline.com.br/app/parceiro) concentra aprovação,
chaves e compra de créditos. O sandbox `po_test_` usa canários e PDF de amostra,
sem cobrança. Os preços dos créditos API devem ser conferidos no painel aprovado;
planos do site para consumidor não estabelecem a tarifa B2B.
Referência: [documentação oficial](https://processonline.com.br/api), consultada em
19/10/2026.

O fornecedor informa verificação CNJ gratuita, um crédito por busca bem-sucedida
e outro por cópia. Créditos do fornecedor e da carteira Audita são distintos.
Confirmar preço, cobertura e direito de uso antes da ativação.
[Contrato público](https://processonline.com.br/api).

## Configuração privada

| Variável | Uso |
|---|---|
| `PROCESS_ONLINE_ENABLED=true` | Habilitação explícita; desativado por padrão |
| `PROCESS_ONLINE_API_KEY` | Chave B2B aprovada, `po_test_...` ou `po_live_...` |
| `PROCESS_ONLINE_WEBHOOK_SECRET` | Secret do webhook configurado no painel |
| `AUDITA_PROFILE_ENCRYPTION_KEY` | Chave existente dos pedidos e checkpoints |
| `AUDITA_CREDITS_ENABLED=true` | Carteira Audita obrigatória para operações live |

A IA reutiliza a configuração e os modelos existentes em `createSellerReviewAI`;
não exige nova chave ou provedor. A autorização revalida assinatura/liberação
individual e orçamento antes de cada chamada. Configurar uma chave não realiza
uma busca: buscas, cópias e IA dependem de ações e consentimentos separados.

Sem configuração, `/api/process-online/config` informa indisponibilidade sem
devolver credenciais. O frontend mantém os controles de consulta desabilitados.
Não habilitar produção apenas para testar se uma chave funciona.

## Fluxo e cobrança

1. Usuário autenticado verifica gratuitamente um CNJ ou autoriza uma busca por
   CPF/CNPJ. A busca não pede cópias automaticamente.
2. Cada cópia exige CNJ, interesse declarado e autorização específica de um
   crédito Audita. Para advogado, informar UF e inscrição OAB.
3. O pedido é persistido antes do envio. Em live, o débito Audita deve estar
   confirmado antes da chamada paga. Em sandbox não há débito Audita.
4. O andamento usa GET autenticado do fornecedor e webhook. A Audita prepara a
   cópia privada somente depois de receber e conferir todas as partes.
5. A análise por IA é opcional, exige consentimento próprio e usa somente os
   autos armazenados. Reabrir o histórico ou baixar o PDF não chama a IA.

`operationId` é um UUID para uma única operação. O banco restringe sua unicidade
por tenant e usuário; reenviar a operação com outro conteúdo retorna conflito.
A chave enviada ao fornecedor deriva do dono, operação e pedido, sem CPF/CNPJ no
header. A carteira usa uma referência persistente para impedir débito repetido.

Timeout após envio deixa o pedido em conferência. Não se repete uma busca paga
automaticamente: sua garantia de idempotência ainda exige homologação. Recuperar
uma cópia usa a operação original, após autorização explícita. Falha comprovada e
confirmação de estorno permitem conciliar o crédito Audita; `refund_pending` não
significa que o estorno terminou. Esses estados não comprovam reembolso financeiro
externo. A autorização do custo não comprova o consumo efetivo do parceiro.

## Persistência e arquivos

`db/process-online.sql` cria `audita_process_online_requests` e
`audita_process_online_events`. O servidor inclui o script na inicialização
somente quando `AUDITA_AUTO_MIGRATE` permite migração. Com migração automática
desativada, aplicar o script em janela autorizada antes de habilitar o provedor.
A implementação não aplica o schema a um banco remoto durante os testes.

Pedidos, resultados, finalidade e manifestos ficam em `encrypted_payload`, com
AES-256-GCM e AAD `process-online:<id>`. A análise usa colunas independentes:
`analysis_status`, `analysis_token`, `analysis_updated_at` e `analysis_payload`.
O JSONB guarda `{encrypted: "..."}`, com AAD `process-online-analysis:<id>`.
O coletor não sobrescreve checkpoints da IA. Consultas operacionais públicas
exigem o mesmo `id`, `tenant_id` e `user_id`. O webhook usa o identificador interno
do fornecedor após validar sua assinatura.

Os PDFs ficam na raiz privada do armazenamento Audita, com nomes aleatórios e
permissão restrita. O servidor fornece links autenticados da própria Audita, sem
expor paths locais, chaves ou URLs assinadas. O download sequencial e em stream
confere origem HTTPS permitida, assinatura `%PDF-`, bytes declarados e recebidos e
SHA256; não segue redirecionamentos. Falha em qualquer parte impede `ready` e
remove os arquivos incompletos daquele download.

Limites locais: 200 MiB por parte, até 20 partes e 1 GiB no conjunto. Manifesto
incompleto, índices ausentes ou excesso de tamanho falham explicitamente; a parte
1 não representa os autos completos. O parceiro entrega arquivos grandes em
partes, com retenção remota de sete dias e URLs temporárias.
[Referência oficial](https://processonline.com.br/api).

Os autos são cópias de fontes públicas; processos em segredo não são entregues.
Não são certidão oficial de distribuição, nada consta ou objeto e pé.
[Escopo do fornecedor](https://processonline.com.br/api).

## Análise dos autos

O serviço processa um arquivo por vez, com fila de leitura única por processo
Node. A extração registra todas as páginas; cada chamada de texto abrange até dez
páginas e aproximadamente 100 mil caracteres. Páginas longas são divididas em
mais blocos sem truncar o restante. O progresso distingue partes inspecionadas,
páginas integralmente analisadas e blocos concluídos. O total de páginas só é
definitivo quando o inventário de partes termina.

Cada leitura concluída é salva em checkpoint cifrado. Claim atômico no banco,
token e heartbeat de 30 segundos sustentam um lease de dez minutos para evitar
leituras duplicadas entre instâncias. Lease vencido aparece como `interrupted`;
retomada com os mesmos arquivos e objetivo preserva leituras e resumos concluídos.
SHA256 divergente interrompe a retomada. Alterar o objetivo representa nova
análise e pode consumir IA novamente.

Trechos, valores e datas estruturados são conferidos contra o texto de origem.
Apontamentos mantêm parte, bloco e páginas de referência; a análise não produz
pontuação de pessoa, não deduz dívida pela existência do processo e não executa
instruções encontradas nos documentos. Resumos grandes usam grupos limitados,
com citações conferidas, preservando todas as fontes no relatório.

Página sem texto extraível vai para leitura visual em subconjunto PDF de uma
página, com teto de 20 MiB. A API de leitura compartilhada não fornece OCR integral
independente para conferir essas transcrições. Por isso o resultado permanece
`partial`, com limitação explícita e sem PDF completo. Retomar não repete leitura
visual salva nem converte essa limitação em conclusão integral.

`partial`, `failed` e `interrupted` não oferecem relatório completo. Somente
`completed`, com todas as partes/páginas/blocos contabilizados e consolidação
validada, libera o JSON e o PDF privado. O PDF é gerado pela Audita, identificado
como análise dos autos; não é emitido por cartório ou tribunal. O uso decisório
exige conferência profissional do original.

## Rotas privadas e webhook

| Método e rota | Operação |
|---|---|
| `GET /api/process-online/config` | Configuração segura para a sessão |
| `POST /api/process-online/verify` | Verificação CNJ gratuita |
| `POST /api/process-online/search` | Busca autorizada por CPF/CNPJ |
| `GET /api/process-online/requests` | Histórico do dono |
| `POST /api/process-online/requests` | Solicitação individual de cópia |
| `GET /api/process-online/requests/:id` | Estado salvo; não inicia consulta |
| `POST /api/process-online/requests/:id/recover` | Retomada autorizada da mesma cópia |
| `POST /api/process-online/requests/:id/refresh` | Conciliação do andamento |
| `GET /api/process-online/requests/:id/files/:parte` | PDF original privado |
| `GET /api/process-online/requests/:id/analysis` | Estado/relatório salvo da IA |
| `POST /api/process-online/requests/:id/analysis` | Análise consentida ou retomada |
| `GET /api/process-online/requests/:id/analysis.pdf` | PDF Audita concluído |
| `POST /api/process-online/webhook` | Eventos assinados do fornecedor |

As rotas do usuário exigem sessão e propriedade por tenant/usuário. POSTs do
navegador exigem mesma origem e JSON. Respostas privadas usam `no-store`;
downloads não tornam o armazenamento acessível por rotas estáticas.

Configurar no painel o webhook HTTPS da instalação Audita em
`/api/process-online/webhook`. O endpoint preserva o corpo bruto e valida
HMAC-SHA256 de `X-PO-Signature`, com janela de cinco minutos. Não exige sessão de
usuário: a autenticação é a assinatura do fornecedor. Eventos `request.completed`,
`request.failed` e `request.secret` são deduplicados por pedido/evento; estado e
downloads são confirmados pela API autenticada, sem confiar na URL do evento.
`webhook.test` permite conferência assinada no painel.

## Validação e homologação

Testes com PGlite, provedor/IA simulados e PDFs fictícios:

```powershell
node --test test/process-online.test.mjs test/process-online-workflow.test.mjs test/process-online-analysis.test.mjs test/process-online-routes.test.mjs
```

Verificam contratos, isolamento, consentimento, débito/estorno simulados,
idempotência, múltiplas partes, limites, webhook/replay, citações, checkpoints,
retomada e PDF privado. Não comprovam disponibilidade de tribunal, cobertura,
tarifa, precisão em autos reais, estorno financeiro ou entrega externa.

Antes da ativação comercial: aprovação B2B, condições de preço/uso, chave e
canários reais do painel, homologação dos schemas e estados, paginação efetiva da
busca, manifesto de uma e múltiplas partes, eventos/estornos e limites negociados.
Não houve cadastro, compra, chamada paga ou documento de cliente nos testes desta
implementação. Publicação e migração de produção são etapas separadas.
