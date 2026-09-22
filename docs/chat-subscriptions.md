# Paid chat: local implementation, not released

Four separate chat plans are defined in `services/billing-catalog.service.mjs`.
Standard prices and contracts are unchanged. Only an active, unexpired Stripe
Standard subscription is recognized as legacy chat access; login and demo grants
are not payment. New plans are individual, tenant/user scoped.

## Setup for authorized staging

Apply `db/schema.sql`, then the three `db/migrations/20260922-chat-*.sql`
files. The existing automatic migration bootstrap includes them when enabled.
Do not run these against a shared database without authorization.
Configure existing Stripe TEST secret/webhook and `APP_URL`, plus the four
`STRIPE_PRICE_CHAT_*` IDs matching the BRL catalog exactly. Experimente is one
payment, the other three recurring monthly. No annual prices or automatic tax.
Set `AUDITA_CHAT_DOCUMENTS_ENCRYPTION_KEY` to a secure 32-byte base64 key,
or reuse the configured IR/import key. Preserve that key across restarts.
Never put documents or credentials in public static paths.
Chat uses a separate Stripe customer per tenant/user, not the legacy tenant
customer. Configure the test customer portal for payment-method management and
cancellation only; plan changes/proration are not part of this first version.
An uncertain customer/checkout creation is kept pending and must be reconciled
before retrying after Stripe's idempotency retention window. Do not clear pending
records just because a browser was closed or a checkout redirect was abandoned.

Webhook events: checkout.session.completed, checkout.session.async_payment_succeeded,
invoice.paid, invoice.payment_failed, customer.subscription.created/updated/deleted,
charge.refunded, charge.dispute.created, refund.created/updated.
Only verified paid events grant quota. A checkout return or subscription.created
does not. Pending payment does not grant access. Trial validity begins at actual
successful charge time. Cancellation at period end retains the paid period;
revocation/expiry blocks future work. Renewals create a new non-overlapping period.

## Accounting and recovery

One successful reply consumes one message; the initial document summary consumes
pages only. PDF/image page counts and explicit confirmation are enforced on the
server. Limits: PDF/PNG/JPEG, 12 MB and 20 pages per upload. Documents, extracted
context and summaries are encrypted with owner-bound authenticated encryption.
External queries, certificates, specialized services and professional fees are
not included; their existing separate authorization and billing remain in place.

Database row locks serialize account quota mutations. Completed request IDs are
replayed without repeated processing; concurrent or terminal failed IDs do not
execute again. A failed operation releases its reservation. Successful work whose
final persistence is uncertain remains reserved: inspect provider usage and the
stored result before manually reconciling. Never release stale reservations by
age alone: a timed-out worker could still be processing. This first version has
no automatic reconciliation worker. Document attempts are likewise fail-closed.

Context is bounded to 24 messages / 32,000 characters, with 5,000 characters per
message and up to 24,000 document-context characters. Chat output is capped at
2,400 tokens per call, 4 initial turns and at most 2 repair turns. Document
extraction uses one bounded request. These limits are not a cost guarantee.

## Validation and release gate

Run `node --test`, `node scripts/check-chat-subscription-ui.mjs`, and
`node scripts/check-guest-ui.mjs`. Tests use isolated PGlite and mocked AI/Stripe,
not real customers or charges. `node scripts/estimate-chat-plan-costs.mjs` compares
hypothetical full-franchise scenarios using the existing pricing calculator.
It is explicitly NOT measured cost or margin validation. Stress usage may exceed
the 25% target, so do not activate real prices before representative staging
measurements (including full quota, document failures, long histories, reasoning
and internal calls). Include storage, infrastructure, support, taxes, payment and
Billing fees. Confirm invoicing/tax obligations separately; no Stripe Tax enabled.

Local development intentionally leaves checkout unavailable without configured
test prices/database. No production prices, real payment, migration or deployment
is authorized by this implementation.
