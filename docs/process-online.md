# ProcessOnline: transporte preparado, integracao ainda nao habilitada

Responsavel Codex, branch `codex/processonline-provider`, base `main5067c8b`.
Referencia consultada em 16/10/2026: [API oficial](https://processonline.com.br/api),
[parceria](https://processonline.com.br/parceiros) e [termos](https://processonline.com.br/terms).

O cliente `services/process-online.service.mjs` implementa somente o contrato de
transporte no servidor. Nao cria rotas, botoes, conta, cobranca, armazenamento ou
consultas automaticas. Nenhum dado ou token real foi usado nos testes.

## Configuracao privada

- `PROCESS_ONLINE_ENABLED=true`: habilita o transporte; padrao desativado.
- `PROCESS_ONLINE_API_KEY`: chave aprovada B2B `po_test_...` ou `po_live_...`.
- O consumidor do webhook passa o secret privado para `verifyProcessOnlineWebhook`.
  Nenhum secret deve chegar ao navegador ou aos logs.

Ter a chave sem habilitar explicitamente nao inicia chamadas. O cliente informa
`getStatus()` sem revelar o segredo. Base/host sao fixos; redirecionamentos sao
bloqueados. JSON limitado a2MB e cada chamada a20s por padrao; nao ha retries pagos.

## Contrato implementado

| Metodo | API | Entrega |
|---|---|---|
| `searchDocumento({documento,approval})` | POST api-search-documento | CPF/CNPJ valido, lista de CNJs e consumo informado |
| `verifyCNJ({cnj})` | POST api-verify | Verificacao gratuita do CNJ com DV valido |
| `requestCopy({cnj,interesse,interesseDetalhe,approval})` | POST api-create-request | Pedido da copia e chave de idempotencia |
| `getRequest({requestId})` | GET api-get-request | Processing/completed/failed/secret/expired e devolucao informada |
| `getDownload({requestId})` | GET api-download | Todas as URLs privadas ordenadas, sem baixar os PDFs |

`approval` usa `{tenantId,userId,operationId,credits}`: valores de identidade do
servidor e ID da operacao persistida. Em modo live, exige ao menos1credito
previamente autorizado. Isso e uma precondicao, NAO uma carteira/limite de gastos.
O consumidor precisa reservar/debitar atomicamente antes da chamada, guardar o
resultado e contabilizar/reconciliar `credits_charged` e `refunded`.

A chave idempotente de64caracteres deriva do tenant, usuario, operacao e pedido,
sem CPF/CNPJ exposto no header. A garantia de nao duplicar cobranca publicada e
para copia integral; para busca por documento o fornecedor documenta cache24h e
um header de exemplo, mas a garantia de idempotencia precisa ser homologada.
Nao repetir busca/copia automaticamente se a rede falhar depois do envio.

Webhooks exigem os bytes originais antes de JSON.parse, HMAC-SHA256 em
X-PO-Signature, digest de64hex e janela5min. O verificador nao grava eventos.
O consumidor deve persistir unicidade de `request_id`+`event`, verificar se o pedido
pertence ao tenant/usuario e reconciliar o estado pelo GET autenticado. Nao usar
download_url recebido no webhook como destino de fetch sem nova validacao.

## Homologacao e integracao pendentes

1. Acesso B2B/aprovacao do titular e chave sandbox; nao foram provisionados.
2. Testar canarios e schemas reais, inclusive paginacao da busca (a visao publica
   mostra `paginator`, mas nao define como pedir paginas seguintes).
3. Persistencia privada por tenant/usuario e pedido, autorizacao por sessao, custo
   aprovado, auditoria e idempotencia duraveis antes de expor qualquer rota/UI.
4. Download privado em stream, todas as partes e limite por arquivo: a API anuncia
   ate200MB por parte e7dias de retencao. O cliente apenas valida manifestos atuais,
   host/path e bytes declarados. A etapa seguinte deve verificar bytes reais,
   assinatura PDF, integridade e identidade; nao enviar URL assinada ao chat.
5. Homologar o manifesto de parte unica, todos os estados e atrasos, falha/segredo
   com devolucao, replay e entrega repetida. Se faltar `parts`/`parts_count`, falha
   fechada: nao presumir que download_url representa todos os autos.
6. Ativar operacao comercial somente apos precos B2B, SLA, cobertura e direito de
   reutilizar/revender a analise estarem confirmados.

Busca nao vazia custa1credito e cada copia custa outro, segundo a documentacao;
verificacao e gratuita. Esses creditos sao do fornecedor, nao creditos Audita.
Os autos sao copias de fontes publicas; nao comprovam certidao oficial de
distribuicao, nada consta ou objeto e pe. Segredo de justica nao e fornecido.
DataJud nao e fallback comercial: o termo publico V1.2 restringe esse uso.

## Verificacao local

`node --test test/process-online.test.mjs`

Fetch simulado: configuracao, validacao, preautorizacao, idempotencia por dono,
contratos, multiplas partes, host/tamanho, erros, timeout e HMAC/replay.
Os testes nao comprovam entrega real, cobertura nem disponibilidade do parceiro.
