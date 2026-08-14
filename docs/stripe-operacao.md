# Stripe: operacao e ativacao

Status em 2026-08-14: integracao validada ponta a ponta no Stripe Test Mode.
A ativacao em producao depende da conclusao cadastral, bancaria e contratual da
conta Stripe pelo responsavel legal da Audita.

## Catalogo validado em teste

| Oferta | Cobranca | Valor | Variavel |
| --- | --- | ---: | --- |
| Audita Standard | Mensal | R$ 199,00 | `STRIPE_PRICE_STANDARD_MONTHLY` |
| Audita Standard | Anual | R$ 1.188,00 | `STRIPE_PRICE_STANDARD_ANNUAL` |
| Audita Creditos 25 | Avulsa | R$ 39,00 | `STRIPE_PRICE_CREDITS_25` |
| Audita Creditos 100 | Avulsa | R$ 129,00 | `STRIPE_PRICE_CREDITS_100` |
| Audita Creditos 500 | Avulsa | R$ 499,00 | `STRIPE_PRICE_CREDITS_500` |

Os Price IDs de teste foram conferidos diretamente no catalogo Stripe. Os IDs
de producao devem ser criados somente depois da ativacao da conta e configurados
como secrets do ambiente; nunca devem ser confundidos com os IDs de teste.

## Credencial de servidor

Use uma chave restrita separada por ambiente. Permissoes minimas:

- `Customers`: gravacao.
- `Checkout Sessions`: gravacao.
- `Customer Portal`: gravacao.

Nao conceda acesso a saldos, reembolsos, transferencias ou chaves da conta. A
chave e o segredo do webhook devem existir apenas no gerenciador de secrets do
ambiente. Nenhuma credencial Stripe deve ser gravada no repositorio.

## Checkout e Portal do Cliente

- O checkout usa Stripe Checkout hospedado, metodos de pagamento dinamicos e
  endereco de cobranca obrigatorio.
- O Portal do Cliente permite atualizar forma de pagamento e dados cadastrais,
  acessar faturas e cancelar ao fim do periodo.
- URL de retorno: `https://app.auditainteligente.com.br/planos`.
- O identificador da integracao e `audita_checkout_kmqrvzdp`.
- A versao de API fixada e `2026-06-24.dahlia`.

## Webhook

Endpoint da aplicacao:

`POST https://app.auditainteligente.com.br/api/billing/webhook`

Eventos necessarios:

- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

O endpoint valida a assinatura sobre o corpo bruto, registra o ID do evento e
processa repeticoes de forma idempotente. Pacotes de credito usam o ID da sessao
como referencia unica para evitar concessao duplicada.

## Variaveis de producao

```text
APP_URL=https://app.auditainteligente.com.br
AUDITA_BILLING_ENABLED=true
AUDITA_BILLING_DEMO_MODE=false
AUDITA_CREDITS_ENABLED=true
STRIPE_SECRET_KEY=<restricted live key>
STRIPE_WEBHOOK_SECRET=<live endpoint signing secret>
STRIPE_API_VERSION=2026-06-24.dahlia
STRIPE_INTEGRATION_IDENTIFIER=audita_checkout_kmqrvzdp
STRIPE_PRICE_STANDARD_MONTHLY=<live price id>
STRIPE_PRICE_STANDARD_ANNUAL=<live price id>
STRIPE_PRICE_CREDITS_25=<live price id>
STRIPE_PRICE_CREDITS_100=<live price id>
STRIPE_PRICE_CREDITS_500=<live price id>
```

## Evidencias de teste

- Checkout mensal de R$ 199,00 concluido com cartao de teste.
- Assinatura `active` e fatura `paid` exibidas no Portal do Cliente.
- Compra avulsa de 25 creditos por R$ 39,00 concluida em teste.
- Metadados de tenant, usuario, plano/pacote e quantidade confirmados na API.
- Webhook assinado processado; repeticao do mesmo evento foi marcada como
  duplicada e concedeu os 25 creditos uma unica vez.
- Chave restrita validada contra a API oficial da Stripe.

## Checklist de ativacao em producao

1. Responsavel legal conclui perfil empresarial, conta bancaria, verificacoes e
   aceita os termos no Dashboard Stripe.
2. Duplicar o catalogo aprovado no modo de producao.
3. Criar chave restrita live com as tres permissoes minimas.
4. Criar endpoint live com os seis eventos acima e copiar seu signing secret.
5. Configurar todos os secrets no ambiente de producao.
6. Aplicar migracoes PostgreSQL e confirmar `dbReady=true`.
7. Publicar a versao validada e confirmar hash/health.
8. Fazer uma compra real de baixo risco, confirmar webhook, assinatura, Portal
   do Cliente, cancelamento e conciliacao antes de abrir vendas.
