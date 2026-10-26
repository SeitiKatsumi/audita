# Preparacao live — 22/10/2026

Parceiro aprovado, chave live exclusiva e segredo do webhook salvos na configuracao privada de producao; nenhum segredo neste documento. api-verify gratuito autenticou com sucesso e webhook.test assinado foi aceito pela Audita200. Stripe de producao tem destino ativo e os quatro eventos de Checkout necessarios; nao foi realizado pagamento real de teste.

Saldo observado:0creditos. PROCESS_ONLINE_ENABLED continuafalse ate confirmacao de recarga, porque o checkout atual nao consulta o saldo do fornecedor antes de cobrar o cliente. A recarga nao altera esse flag automaticamente: confirmar o saldo e habilitar o provedor antes de oferecer novas vendas. Primeira copia paga, autos reais/partes e entrega de evento real continuam pendentes de homologacao autorizada. Nenhum credito comprado ou consumido nesta preparacao.

# Atualização de interface e carteira — 21/10/2026

## Sandbox funcional no app local

`npm run dev:process-online` inicia a Audita em http://localhost:3000 com o
PostgreSQL local persistente do helper existente (porta54329), autenticação
obrigatória e a chave test da configuração privada. Instalação única do runtime
dev: `npm install --prefix storage/dev-tools embedded-postgres` (pasta ignorada).
O helper usa overrides somente no processo: preserva `.env.local`, sua URL
original de banco e as chaves. Não conecta ao PostgreSQL de produção, não
habilita jobs, não aceita chave live e mantém a IA desligada para custo zero.

No módulo `/#processos-judiciais`, Usar processo de exemplo apenas preenche o
CNJ oficial do sandbox e exige novo aceite antes de solicitar. A busca por
documento é indicada como não homologada e fica desabilitada neste ambiente.
Em live essa restrição do sandbox não se aplica. Nada é solicitado ao abrir
a tela ou carregar o exemplo. O histórico e o PDF privado persistem no banco
local; não são consultas de produção. Chrome confirmou login, solicitação,
conclusão, download e reabertura após reload. PDF demonstrativo435bytes/1página.

## Estimativa de custo operacional

| Pacote | Compra | Cópia com CNJ conhecido | Busca + uma cópia |
|---|---|---|---|
| 1 crédito | R$24,99 | R$24,99 | R$49,98 (duas unidades) |
| 10 créditos | R$210,00 | R$21,00 | R$42,00 |
| 30 créditos | R$507,00 | R$16,90 | R$33,80 |
| 50 créditos | R$747,00 | R$14,94 | R$29,88 |

Uma busca pode localizar vários processos: pedir N cópias após uma busca
consome 1+N créditos, não N buscas. Cada pessoa/empresa e cache são tratados
conforme o contrato do fornecedor. Exemplo de100buscas+100cópias:200créditos,
R$2.988,00 comprando quatro pacotes de50. Não inclui IA, armazenamento,
tributos, meio de pagamento ou novas consultas futuras.

O modelo atual deste módulo é gpt-5-mini: US$0,25/1M tokens de entrada e
US$2,00/1M tokens de saída, segundo a página oficial consultada em21/10/2026:
https://developers.openai.com/api/docs/models/gpt-5-mini . Cenário de100mil
tokens de entrada e20mil de saída (incluindo raciocínio faturado):US$0,065.
Com dólar apenas de planejamento aR$5,50, equivale aR$0,36. Não é medição de
autos reais nem custo fixo por processo/página; scans, resumos adicionais,
retomadas com novo objetivo e volume grande alteram o total. Nenhuma chamada
OpenAI paga foi feita nesta homologação. Antes de definir franquia/preço de IA,
medir uso real de documentos autorizados. O PDF mínimo do sandbox não serve
como benchmark de custo de autos completos.

Para dados reais ainda faltam chave live autorizada, compra de saldo API,
homologação live e configuração/teste do webhook. Nenhuma dessas etapas foi
executada pelo comando local ou pelos testes gratuitos.

Painel de parceiro aprovado conferido no Chrome em 21/10/2026: saldo API zero,
sem chaves e webhook não configurado. O botão Comprar créditos do painel exibiu:

| Créditos | Total | Por crédito |
|---|---|---|
| 1 | R$ 24,99 | R$ 24,99 |
| 10 | R$ 210,00 | R$ 21,00 |
| 30 | R$ 507,00 | R$ 16,90 |
| 50 | R$ 747,00 | R$ 14,94 |

Valores apenas observados, sem compra ou comprovação de crédito em carteira.
Na tarifa por crédito documentada, buscar CPF/CNPJ com sucesso consome um crédito
e pedir uma cópia consome outro. Assim, busca + uma cópia custa dois créditos;
com CNJ já conhecido, a cópia custa um. IA e custos Audita não estão incluídos.
Planos comuns de cópias/monitoramento não comprovam franquia API B2B.

Homologação gratuita executada em 21/10/2026 com chave test autorizada e salva
somente na configuração privada local. Nenhuma compra, chave live ou ativação
de produção. Verificação por CNJ, solicitação e PDF oficial de exemplo passaram:
435 bytes, uma página, zero créditos cobrados. Fluxo compartilhado com PGlite
isolado confirmou arquivo privado, isolamento por dono e reabertura sem nova
chamada ao fornecedor. Os 54 testes pertinentes passaram.

Duas diferenças do sandbox foram comprovadas: as buscas sintéticas CPF/CNPJ
devolvem `0801234-56.2023.8.19.0001`, cujo dígito CNJ é inválido; a integração
mantém essa rejeição, sem corrigir identificador nem relaxar produção. É uma
pendência do fornecedor para homologar busca > seleção > cópia. Já o download
test retorna `application/pdf` diretamente, sem o manifesto JSON documentado.
O transporte agora aceita essa amostra pequena somente com chave test, no
endpoint de download, e reutiliza as validações/armazenamento privado. O modo
live continua exigindo JSON, origem permitida e manifesto completo. Webhook
entregue pelo fornecedor, documentos reais, múltiplas partes reais e IA real
continuam sem homologação; não foram apresentados como concluídos.

Verificador gratuito em `scripts/check-process-online-sandbox.mjs`.
O script recusa chaves live, usa somente os documentos sintéticos e um CNJ
canário publicados no painel, verifica os contratos do transporte compartilhado,
créditos zero, manifesto/amostra direta, tamanho, SHA256 e abertura dos PDFs. Não chama IA,
não altera banco/configuração e não salva chaves, URLs assinadas ou autos.
`node scripts/check-process-online-sandbox.mjs --self-check` não acessa a rede.
Após criar e guardar a chave de teste na configuração privada local, executar
`node --env-file=.env.local scripts/check-process-online-sandbox.mjs --execute`.
Uma busca inválida é registrada como pendência e o verificador continua com o
canário independente de cópia; termina com código1 para não ocultar a falha.
Executar uma vez e inspecionar eventual falha antes de repetir; sandbox não
substitui homologação de cobertura real, múltiplas partes ou webhook entregue.

A interface simplificada envia `approvedCredits: 0`: novas buscas e cópias nesse fluxo não debitam a carteira Audita nem dependem dela. O crédito do fornecedor continua sendo responsabilidade interna da integração. Operações legadas com aprovação de 1 mantêm conciliação e estorno existentes. O vínculo enviado é `outro`, com confirmação de interesse legítimo no aceite, sem declarar que o usuário é parte ou advogado. Verificação gratuita permanece apenas na API; não aparece na tela.

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
| `AUDITA_CREDITS_ENABLED=true` | Carteira apenas para operações legadas; novas cópias pagas no Stripe não debitam créditos Audita |

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

## Histórico: busca CPF/CNPJ — Checkout Stripe (substituído em22/10/2026)
A busca custa R$ 49,90, fixado no servidor em centavos, sem carteira Audita. `POST /api/process-online/search/checkout` valida consentimento/documento e cria um pedido privado criptografado; o número do documento não vai para metadata Stripe. O checkout é hospedado, em BRL, com métodos dinâmicos. Pix e cartão precisam estar habilitados/disponíveis na conta Stripe; a oferta efetiva é determinada pelo Stripe. A cópia integral por CNJ também custa R$49,90 e usa POST /api/process-online/requests/checkout. O tipo é vinculado ao pedido persistido; pagamento da busca não libera uma cópia.

A migração aditiva `db/process-online-payments.sql` é aplicada pela inicialização do servidor. Requer banco, `AUDITA_PROFILE_ENCRYPTION_KEY`, billing/Stripe e webhook configurados, além de fornecedor pronto e busca homologada. Sandbox de busca não homologado continua bloqueado; nunca habilitar o provedor live para testar pagamentos.

Assinar no webhook Stripe os eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` e `checkout.session.expired`. Apenas `payment_status=paid`, moeda BRL, total4990, sessão e dono correspondentes liberam execução. Retorno/cancelamento do checkout apenas consultam estado privado e não liberam serviço. Os endpoints diretos `/search` e POST `/requests` respondem402. Pedidos existentes continuam disponíveis, inclusive retomada da mesma cópia. Pedidos em aberto reaparecem para retomar o mesmo checkout; repetição de webhook usa a mesma operação persistida pelo workflow.

Se a execução falhar ou ficar em conferência depois do pagamento, o histórico mantém o pedido e a referência; não cobrar nem reenviar automaticamente. A equipe deve conciliar o pedido e eventual reembolso no Stripe. Não há reembolso automático novo. Esta integração foi testada com transporte fictício e PGlite; checkout/Pix reais e webhook externo aguardam homologação. A conexão do conector Stripe exige reautenticação.

## Fluxo atual: Direct Data → seleção → ProcessOnline

Administradores autenticados e contas com gratuidade individual autorizada podem solicitar cópias sem Stripe ou débito da carteira. A configuração informa `copyPayment.complimentary:true` e preço zero; consentimento e fornecedores prontos continuam obrigatórios. Pedidos pendentes anteriores oferecem autorização explícita por `POST /api/process-online/requests/checkout` com `orderId` próprio e `consent:true`. A dispensa cifrada preserva preço e sessão anteriores para conciliação, com `paymentStatus:'complimentary'` e sem `paid_at` fictício. Webhook real tardio após dispensa registra necessidade de conciliação sem repetir a solicitação. GET nunca inicia coleta; revogar o perfil bloqueia novas dispensas. Sem migração ou ativação de fornecedor.

O fluxo acima é mantido somente para pedidos legados. Novas buscas CPF/CNPJ vão ao serviço nacional de consultas Direct Data; a Completa retorna CNJs e a Agrupada somente estatísticas. Resultados de certidões e análises oferecem a cópia quando um CNJ válido estiver disponível. Sem nova busca paga ao preparar a oferta.

`POST /api/process-online/requests/checkout` aceita um `cnj` ou `cnjs` de1–20números distintos, consentimento e total aprovado. O preço vem de Super Admin > Preços e margens, com snapshot no pedido; o webhook valida o total persistido, sem valor fixo4990. O mesmo pagamento de um lote gera operações determinísticas por CNJ e não repete cópias após replay. Busca ProcessOnline nova responde410; pedidos antigos pagos continuam válidos. A migração existente foi estendida de forma aditiva, sem apagar pedidos.

Detalhes, campos das fontes, critérios de oferta e valores iniciais: [produto de processos completos](process-complete-product.md). Testes simulados não constituem publicação ou homologação live.
