# Dívidas Bancárias Abusivas

Entrada na aplicação: `/#dividas-bancarias`. Implementação local, sem publicação automática.

## Fluxo

1. Uma pergunta com botões: existência de dívida bancária em aberto. Resposta positiva segue diretamente para os dados da dívida. Notificações e percepção de juros excessivos não são requisitos de enquadramento. Resposta negativa encerra o enquadramento inicial, sem afirmar ausência de direitos.
2. Coleta do credor, modalidade, data da inadimplência, principal informado, cobrança atual.
3. Anexos da cobrança e atendimento salvo aguardando cálculo Audita.
4. Análise validada, resultado, memória de cálculo e contratação em pagamento único pela Stripe.
5. Após webhook de pagamento confirmado: dados pessoais, endereço/UF e interesse em conciliação.
6. Procuração com advogado identificado e contrato apresentados ao cliente; assinatura pelo nome completo, aceite, versão, hash, usuário, data do servidor, IP observado e navegador. Corrigir o cadastro invalida a assinatura.
7. PDF da minuta da petição, relatório, procuração, contrato e anexos; inserção atômica e idempotente na fila `/advogados`. Apenas o advogado indicado na procuração pode assumir este caso. O usuário baixa o PDF e acompanha o protocolo registrado pelo advogado.

## Estimativa com referência BACEN

A estimativa está disponível na etapa de análise, antes da contratação. Consulta a API oficial SGS para o mês exato da contratação, sem usar médias anuais do documento nem substituir por mês vizinho em caso de ausência de dados.

Modalidades confirmadas: pessoa física, cheque especial (25463), crédito pessoal não consignado (25464), aquisição de veículos (25471), cartão rotativo (25477). Outras modalidades seguem para revisão manual. Os códigos do documento de referência foram corrigidos a partir do catálogo oficial.

O cliente informa contratação, data e valor do saldo inicial, data da cobrança, taxa mensal contratada (opcional), premissa simples/composta e cada pagamento com data/valor. Confirma ausência de novas utilizações. Usa dias corridos/30: compostos por saldo × ((1 + taxa mensal)^(dias/30) − 1), ou simples por principal remanescente × taxa mensal × dias/30. Arredondamento a centavos em cada evento, pagamentos primeiro em juros e depois em principal. Pagamentos acima do saldo simulado exigem revisão manual, sem saldo negativo presumido.

Resultado: saldo estimado BACEN, cenário à taxa contratada quando informada, diferença entre taxas em pontos percentuais e máximo entre zero e cobrança menos saldo BACEN. A proposta pessoal foi retirada do fluxo; valores históricos permanecem armazenados e não participam do cálculo. Persiste taxa, série, mês, observação original, URL, data da consulta, entradas, evolução e premissas. O PDF final inclui essa memória como estimativa preliminar separada da análise validada.

Limitações explícitas: cenário do saldo em aberto; não reconstrói Price/SAC, renegociações ou limites legais específicos. Não acrescenta mora, multa, IOF, seguros, tarifas ou correção, nem remove encargos já embutidos no saldo-base. A diferença pode refletir esses componentes e dados divergentes; não equivale automaticamente a abusividade, redução garantida ou restituição. O advogado valida a metodologia antes da petição.

Somente um super_admin publica a análise validada com preço, fundamentação, memória e advogado cadastrado. A estimativa permanece em calculation_pending; não cria review nem checkout. Alterar detalhes invalida a estimativa. Consulta externa ocorre antes da transação; revisão otimista impede publicar cálculo sobre dados alterados durante a consulta. Em falha BACEN, conserva o caso e permite nova tentativa ou revisão manual.

Fontes verificadas em 14/09/2026:
- https://www3.bcb.gov.br/sgspub/consultarvalores/consultarValoresSeries.do?hdOidSeriesSelecionadas=25463&method=consultarGraficoPorId
- https://dadosabertos.bcb.gov.br/dataset/25464-taxa-media-mensal-de-juros-das-operacoes-de-credito-com-recursos-livres---pessoas-fisicas---c
- https://www3.bcb.gov.br/sgspub/consultarvalores/consultarValoresSeries.do?hdOidSeriesSelecionadas=25471&method=consultarGraficoPorId
- https://www3.bcb.gov.br/sgspub/consultarvalores/consultarValoresSeries.do?hdOidSeriesSelecionadas=25477&method=consultarGraficoPorId

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
