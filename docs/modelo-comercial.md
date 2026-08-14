# Modelo comercial da Audita

Status: oferta Standard validada em Stripe Test Mode; producao aguarda a ativacao
juridica e bancaria da conta Stripe da Audita.

## Decisao recomendada

A Audita deve combinar:

1. Assinatura recorrente para acesso ao chat, historico, equipe e uma franquia mensal.
2. Creditos para consultas que geram custo variavel em APIs de terceiros.
3. Pacotes adicionais para excedentes, sem prometer consultas pagas ilimitadas.
4. Contrato Enterprise para alto volume, API, SLA e necessidades de governanca.

Esse desenho deixa o valor do produto compreensivel para o cliente e protege a
margem quando Direct Data, OpenAI, ONR ou outro provedor alterar precos.

## Oferta inicial

| Plano | Mensal | Anual | Usuarios | Publico |
| --- | ---: | ---: | ---: | --- |
| Standard | R$ 199/mes | R$ 1.188/ano (equivalente a R$ 99/mes) | 1 | Pessoa fisica e uso individual |

O Standard inclui acesso a plataforma, chat com a IA Audita, analise de
documentos e cobrancas Itau, simulacao, relatorio e orientacao de proximos
passos. O anual inclui suporte de advogado parceiro para o caso Itau. Esse
suporte nao representa automaticamente contratacao para representacao,
protocolo, custas ou garantia de resultado.

O modo demonstrativo deve permanecer desligado quando a integracao Stripe for
ativada. Assinaturas antigas com `provider=demo` nao concedem acesso quando
`AUDITA_BILLING_DEMO_MODE=false`.

## Pacotes adicionais

| Pacote | Preco | Receita por credito |
| --- | ---: | ---: |
| 25 creditos | R$ 39,00 | R$ 1,56 |
| 100 creditos | R$ 129,00 | R$ 1,29 |
| 500 creditos | R$ 499,00 | R$ 1,00 |

O pacote de 100 creditos serve como referencia para exibir o valor aproximado
de cada consulta no painel administrativo.

## Regras de consumo

- Chat, orientacao e historico fazem parte da assinatura Standard.
- O fluxo Itau permanece aberto ate a analise dos anexos.
- Quando houver achado positivo sem acesso Standard, descricoes, valores,
  calculo e simulacao ficam bloqueados pelo backend ate a contratacao ou uma
  liberacao tester valida.
- Acesso tester e temporario/administrativo, auditavel e revogavel; nao e uma
  assinatura Stripe.
- Uma operacao paga deve mostrar o custo em creditos antes da confirmacao.
- Creditos incluidos renovam a cada ciclo e nao acumulam.
- Creditos adicionais entram na carteira da organizacao.
- Falha tecnica sem entrega nao deve consumir saldo.
- Reprocessamento idempotente nao deve cobrar novamente.
- Atendimento juridico profissional nao esta incluido nos planos de software.

## Criterio de margem

Antes de ativar uma consulta:

`creditos cobrados x receita liquida por credito >= 3 x custo variavel esperado`

O custo variavel esperado deve considerar API do provedor, OpenAI, pagamento,
armazenamento e uma reserva para falhas/reprocessamento. A meta inicial e margem
bruta minima de 65% por operacao.

## Etapas de lancamento

### 1. Beta comercial

- Standard mensal e anual em modo demonstrativo ou Stripe Test Mode.
- Liberacoes tester controladas no painel administrativo.
- Validacao do paywall positivo no fluxo Itau.
- Convite para um grupo pequeno de clientes.
- Medir ativacao, consumo e suporte por consulta.

### 2. Venda aberta

- Checkout em producao.
- Webhooks e portal do cliente validados.
- Plano Equipe.
- Politica de cancelamento, termos e privacidade publicados.
- Alertas de saldo baixo e pagamento pendente.

### 3. Escala

- Enterprise.
- Limites por usuario e centro de custo.
- Faturamento B2B e negociacao por volume.
- Margem por ferramenta e por fornecedor no painel.

## Indicadores

- Receita recorrente mensal (MRR).
- Assinaturas ativas, novas e canceladas.
- Receita media por cliente.
- Creditos comprados e consumidos.
- Margem bruta por consulta.
- Conversao Explorar -> pago.
- Retencao em 30, 60 e 90 dias.
- Clientes com pagamento pendente.

## Dependencias para cobrar de verdade

- Conta Stripe da Audita.
- Chave secreta somente no servidor.
- Produtos e Price IDs mensais, anuais e avulsos.
- Webhook assinado e acessivel pela Stripe.
- Banco PostgreSQL com as tabelas de billing.
- Termos de uso, politica de privacidade e regra de cancelamento.
- Validacao contabil e fiscal da emissao de nota.

O procedimento tecnico e o mapa do catalogo estao em `docs/stripe-operacao.md`.

## Referencias

- Stripe Brasil: https://stripe.com/br/pricing
- Stripe Checkout para assinaturas:
  https://docs.stripe.com/payments/checkout/build-subscriptions
- Portal do cliente: https://docs.stripe.com/customer-management
- Assinatura de webhooks: https://docs.stripe.com/webhooks/signature
