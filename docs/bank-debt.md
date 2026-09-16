# Dívidas bancárias — entrada por documentos

Atualização local em 15/09/2026. O cliente começa enviando PDFs, imagens ou prints e autorizando a leitura. Não responde à triagem ou ao formulário técnico de taxas. O servidor salva os arquivos privados, lê todas as páginas com a integração OpenAI existente e exige nova revisão se os arquivos mudarem durante a análise. Documento é dado não confiável; a IA não escolhe preço, taxa BACEN ou decisão judicial.

O envio usa uma única área, orientada por: “Anexe abaixo os extratos bancários desde o início do saldo devedor até a presente data.” Enviar e analisar é uma só ação. Durante a leitura, a tela mostra o andamento e os arquivos salvos; novos anexos ficam bloqueados até terminar. Complementos reutilizam a autorização registrada. Arquivos idênticos do mesmo tipo não são inseridos novamente nem invalidam a análise; cópias históricas continuam armazenadas, mas apenas uma participa da lista, leitura e pacote documental. Os achados ficam recolhidos e distinguem juros identificados de redução confirmada.

A extração valida datas, centavos, sinal, categoria, saldo e referência à página. A conferência aritmética bloqueia a oferta em caso de lacunas, contas divergentes, mora não decomposta, transferências, duplicatas possíveis ou valores não reconciliados. A tela apresenta um aviso e retorna ao envio inicial. Contas e documentos históricos continuam preservados.

## Extrato insuficiente

O cliente retorna ao envio inicial com aviso quando a leitura falha ou não permite calcular a oferta. Não há pedido de revisão nem espera pela equipe. Novo envio cria outro atendimento, preservando documentos e histórico anteriores. Pedidos antigos de revisão também retornam ao início ao serem abertos pelo proprietário. Com dados suficientes, a oferta mostra os juros extraídos e a contratação; pagamento confirmado libera o laudo de renegociação.

A análise versão 3 concilia saldo anterior zero com o fechamento impresso do documento anterior apenas quando banco, conta, modalidade, titularidade PF/PJ/MEI e data de fronteira coincidem, não há sobreposição e todos os saldos intermediários e o fechamento do documento seguinte conferem. Registra o saldo original e a origem da conciliação; mantém linhas e auditoria. Não infere o primeiro principal ausente. Aplicações/resgates explicitamente identificados de investimento automático são mantidos como movimentações; outros créditos/transferências e mora continuam exigindo conferência. A diferença inicial é quantificada, sem presumir que seja dívida ou juros. Extratos antigos não são tratados como saldo atual.

A leitura ocorre página a página: a IA transcreve a coluna numérica literal e todos os saldos intermediários; o código converte centavos e classifica depois. O sinal impresso prevalece sobre a descrição da rubrica. Cada página com divergência aritmética recebe uma releitura, aceita somente se reduzir divergências sem aumentar pendências. A análise privada conserva linhas, páginas, saldos e tentativas para conferência. Não inventa saldo inicial nem presume quitação a partir de um crédito. O processamento continua em segundo plano; após reinício do servidor, uma leitura interrompida pode ser repetida depois de 15 minutos, sem retomada automática.

Usa `AUDITA_DEBT_MODEL` (padrão `gpt-5.4`, raciocínio médio), separado do modelo do chat geral. Complementos sem coluna de valor não constituem novos lançamentos. Releituras não podem remover linhas financeiras ou saldos para aparentar reconciliação. Mantém as chaves e o registro de consumo da integração existente; não adiciona dependências.

## Leitura paralela, reaproveitamento e progresso

Até três páginas são lidas simultaneamente por instância do extrator, inclusive
entre atendimentos concorrentes. A ordem física é preservada na conferência.
Datas ausentes recebem releitura com contexto da página anterior; só são aceitas
se os valores, tipos, descrições e datas já conhecidas permanecerem iguais.
As releituras aritméticas e os bloqueios financeiros continuam ativos.

`audita_debt_documents.extraction_cache` guarda páginas concluídas e extração final
no banco privado, vinculadas ao arquivo (SHA-256), versão da leitura e modelo.
Tentativas após falha e documentos complementares reaproveitam essas páginas.
Não compartilha cache entre atendimentos nem retorna seu conteúdo pela API do
cliente. Mudança de arquivo, modelo ou versão exige nova leitura. A comparação
financeira é refeita; o cache não confirma redução nem reaproveita uma oferta.
A coluna é adicionada de forma idempotente, sem alterar documentos existentes.

`analysisProgress` persiste páginas concluídas, total e etapa sem mudar a revisão
otimista do atendimento. A UI consulta a cada 3 segundos durante a análise e
preserva a área de documentos aberta. Até 90% representa páginas lidas; 95% é a
conferência final/cálculo; 100% só aparece depois de salvar o resultado. A barra
não avança por tempo decorrido. Não há percentual de aceleração real prometido:
testes usam respostas sintéticas, sem enviar extratos de clientes ou consumir IA.

## Comparação e contratação

Quando a consulta BACEN falha, a análise usa a última taxa válida da mesma modalidade obtida nessa execução. Para cheque especial PF/MEI, há também uma reserva de 7,4% a.m., SGS 25463 de janeiro/2025, consultada em 16/09/2026. Após a primeira falha não repete chamadas nos demais meses dessa análise. Uma nova análise tenta a fonte oficial novamente. PJ sem nenhuma referência consultada permanece bloqueado: a reserva PF não é aplicada a PJ.

O fallback é uma hipótese provisória, não a taxa oficial dos meses ausentes. A oferta mostra o aviso, valor e mês de origem antes da contratação; a memória e o PDF registram os meses substituídos. A contratação pode avançar com estimativa positiva e documentos reconciliados, sem afirmar abusividade nem redução garantida. Divergências documentais continuam bloqueando o cálculo. Não altera a estimativa manual legada.

O cálculo automático inicial cobre cheque especial PF/MEI e PJ identificado. Consulta SGS 25463 ou 25446 para cada mês do período. Mantém IOF, tarifas e movimentações, substitui apenas juros remuneratórios no cenário comparativo. Usa dias/30, movimentações ao fim do dia, arredondamento diário e apresenta faixa entre simples diário e composto diário. A média BACEN é referência comparativa, não taxa máxima legal nem determinação do valor judicialmente devido. Outras modalidades exigem metodologia própria; não são enquadradas como cheque especial.

Sem diferença positiva nos dois cenários, não libera contratação automática. A porcentagem é (cobrança menos saldo estimado)/cobrança, nunca maior que 100%. Exibe a data da cobrança documentada. Nenhuma faixa artificial é adicionada ao resultado.

Preços reutilizados do catálogo Itaú por autorização do usuário: R$ 199,00, R$ 399,99 e R$ 599,00. Seleção pela redução conservadora: até R$ 10 mil; até R$ 20 mil; acima. Os limites de elegibilidade de restituição do Itaú não são aplicados às dívidas. Checkout e confirmação permanecem vinculados ao usuário, organização, análise, moeda, preço e webhook Stripe.

## Após o pagamento

Disponibiliza PDF com relatório comparativo, referências e passo a passo para negociar com canal oficial do cobrador. O próprio cliente conduz a negociação. Pode solicitar o advogado se não resolver; isso registra a solicitação, sem criar processo nem afirmar acordo. A equipe confere dados e publica a revisão jurídica com advogado identificado. Depois seguem cadastro, procuração, assinatura e fila de protocolo manual existentes. Pessoa jurídica requer avaliação da representação e documentação específica antes dessa etapa.

## Limites de validação

PDFs reais nunca são versionados, colocados em rotas públicas ou usados como fixtures. Testes automatizados usam documentos fictícios e cobrem fechamento de saldo, tarifas, ambiguidades, isolamento, contratação, webhook e download após pagamento. Não há cobrança ou protocolo real nos testes.

Fonte PJ: https://dadosabertos.bcb.gov.br/dataset/groups/25446-taxa-media-mensal-de-juros-das-operacoes-de-credito-com-recursos-livres---pessoas-juridicas--
O limite legal de cheque especial não se aplica indistintamente a PJ: https://www.bcb.gov.br/meubc/faqs/s/cheque-especial

---
Documentação do fluxo anterior (para compatibilidade dos atendimentos existentes):

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
