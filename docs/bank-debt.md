# Dívidas Bancárias Abusivas

Entrada na aplicação: `/#dividas-bancarias`. Implementação local, sem publicação automática.

## Fluxo

1. Três perguntas com botões: dívida em aberto, notificações de cobrança e percepção de juros excessivos. Resposta negativa encerra o enquadramento inicial, sem afirmar ausência de direitos.
2. Coleta do credor, modalidade, data da inadimplência, principal informado, cobrança atual, proposta pessoal do cliente e relato opcional.
3. Anexos da cobrança e atendimento salvo aguardando cálculo Audita.
4. Análise validada, resultado, memória de cálculo e contratação em pagamento único pela Stripe.
5. Após webhook de pagamento confirmado: dados pessoais, endereço/UF e interesse em conciliação.
6. Procuração com advogado identificado e contrato apresentados ao cliente; assinatura pelo nome completo, aceite, versão, hash, usuário, data do servidor, IP observado e navegador. Corrigir o cadastro invalida a assinatura.
7. PDF da minuta da petição, relatório, procuração, contrato e anexos; inserção atômica e idempotente na fila `/advogados`. Apenas o advogado indicado na procuração pode assumir este caso. O usuário baixa o PDF e acompanha o protocolo registrado pelo advogado.

## Cálculo ainda não definido

Não foi criada fórmula automática, taxa fixa ou percentual de redução presumido. A proposta do cliente nunca vira cálculo. Sem revisão, não há checkout nem documento processual final.

Enquanto a metodologia não é definida, um **super_admin** abre o módulo, seleciona o atendimento na lista e usa “Equipe Audita · publicar análise validada”. Deve informar saldo revisado, memória com períodos/taxas/fontes, fundamentação específica, preço do serviço, identificação do credor e selecionar um advogado ativo cadastrado na Audita, informando sua OAB. A análise exige documento de cobrança. O nome do advogado vem do cadastro. Esse caminho permite usar um cálculo humano validado, sem simular um motor automático inexistente.

O preço é publicado pela equipe por atendimento; não se inferiu uma tabela de preços de dívida a partir das faixas de restituição do Itaú. A experiência de contratação segue pagamento único, análise anterior ao pagamento e preparação documental posterior ao pagamento.

## Operação

- PostgreSQL: aplicar `db/bank-debt.sql` depois de `db/schema.sql`. O servidor faz isso automaticamente quando `AUDITA_AUTO_MIGRATE` está habilitado, como nos módulos existentes.
- Usa autenticação existente e PostgreSQL persistente. Sem banco, falha explicitamente; não armazena casos financeiros só na memória do servidor.
- Usa configuração Stripe existente (`AUDITA_BILLING_ENABLED`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL`). O webhook existente deve receber `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` e `checkout.session.expired`.
- Pagamentos vinculados ao usuário, organização, atendimento, versão da revisão, sessão, moeda e preço; retorno do navegador não libera acesso. Nenhuma chamada real à Stripe foi usada nos testes.
- Documentos privados em PostgreSQL, com controle por proprietário/equipe e advogado designado. Limites por atendimento: 15 arquivos, 10 MB por arquivo, 40 MB no conjunto; PDF, PNG e JPG.
- Petição é **minuta para conferência do advogado**: unidade competente, via, fundamentação, pedidos e assinatura processual devem ser revistos antes do protocolo. Não declara depósito já realizado, resultado garantido ou processo automaticamente protocolado.
- O registro da assinatura eletrônica não é apresentado como certificado ICP-Brasil. Dados do signatário e documentos assinados permanecem no caso.

## Validação local

`npm ci` instala as dependências já declaradas na versão recebida.

`node --test test/bank-debt.test.mjs test/stripe-billing.test.mjs` verifica isolamento, validação, bloqueio sem revisão/pagamento, assinatura, anexos, idempotência, PDF e fila do advogado, além do checkout e webhook assinado.

`node scripts/preview-bank-debt.mjs` abre uma prévia em `http://127.0.0.1:3087`. Os dados são fictícios, o PostgreSQL é isolado em memória e não há chamadas externas. A lista contém exemplos de análise pendente, contratação, cadastro, assinatura e conclusão. O checkout é bloqueado nessa prévia. Não usar para atendimentos reais; tudo desaparece ao encerrar.

## Referências para os limites do produto

- [STJ — juros acima de patamar predeterminado não são, por si sós, abusivos](https://www.stj.jus.br/sites/portalp/Paginas/Comunicacao/Noticias/2023/24032023-Para-Terceira-Turma--contrato-de-mutuo-com-juros-acima-de-niveis-predefinidos--por-si-so--nao-e-abusivo.aspx).
- [Código de Processo Civil — requisitos da inicial e consignação](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm).

A documentação técnica e os testes não substituem a validação da metodologia financeira e dos modelos pelo responsável jurídico.
