> Atualizacao 2026-10-15: IEPTB Basica removida do catalogo de novas consultas a pedido do usuario. Mantida IEPTB Online. Referencias abaixo a Basica registram a integracao anterior.

# Análise documental do vendedor

## Atualização local de 16/10/2026 — certidões CPF/CNPJ

A homologação real autorizada nesta rodada ampliou os TJs para **35 opções CPF em 12 UFs** e **14 opções CNPJ em seis UFs**. Quantidade de documentos não significa cobertura jurídica integral de uma UF. São resultados do checkout local; **push e publicação em produção permanecem pendentes**. A fotografia inicial de produção (`5067c8b`) tinha 30 opções CPF/10UFs e zero TJ para CNPJ; detalhes e histórico em [Auditoria de16/10](certificate-audit-20261016.md).

| UF | CPF homologadas | CNPJ homologadas |
| --- | ---: | ---: |
| AP | 2 | 2 |
| BA | 2 | 2 |
| DF | 4 | 4 |
| ES | 6 | 3 |
| GO | 2 | 0 |
| PA | 2 | 0 |
| PE | 3 | 2 |
| PI | 3 | 0 |
| RR | 3 | 0 |
| RS | 2 | 1 |
| SE | 2 | 0 |
| TO | 4 | 0 |
| Total | 35 | 14 |

As cinco novas opções CPF são cível/criminal de BA e SE e cível do RS; o alvará do RS permanece uma entrega distinta. Para CNPJ, os portais oficiais emitiram quatro tipos no DF e cível/criminal/falência no ES. A Direct Data emitiu cível/criminal de AP, BA e PE, mais cível do RS. PDF, identidade, título e UF foram conferidos em cada combinação liberada; outras naturezas, instâncias, resultados positivos e comarcas não são presumidos a partir dessa amostra.

`documentTypes` informa os perfis suportados pelo item; `validatedDocumentTypes` define os perfis homologados. Seleção, plano, custo e worker filtram esses perfis antes de coletar/cobrar. Candidatos ficam fora da oferta e somente a homologação interna pode habilitá-los; flags públicas não liberam candidatos. CNPJ não pede nascimento, RG, gênero ou filiação de pessoa física. A cobertura informa links dos 27 portais oficiais para os caminhos ainda não automatizados.

O portal ES usa a URL atualizada e exige conferir o cabeçalho específico da natureza: menção a outra natureza nas observações não basta. A resposta PDF da Direct Data contendo `Found The document has moved` foi rejeitada. As consultas `ProcessosJudiciaisAgrupada` e `ProcessosJudiciaisCompleta` foram homologadas também por CNPJ, com HTTP200 e identidade no campo `documentoConsultado`; custo-base R$1,10/R$3,30. Entregam dados processuais, sem se tornarem certidão ou cópia integral dos autos.

Validação: **611/611 testes Node/PGlite aprovados**. Chrome com CNPJ/fornecedores fictícios confirmou preço R$16,20, checkout antes da coleta, webhook assinado simulado, um PDF privado (200 para proprietário, 401 sem sessão e 404 para outro tenant), zero IA e zero lookup CPF. Reload não repetiu coleta; mobile390px sem overflow; 27 links oficiais conferidos. A jornada simulada não é teste de cobrança real Stripe; a emissão real dos documentos foi homologada separadamente.

Tentativas não liberadas em16/10: cível CPF AC/AM/CE/PB/RN503 e MTtimeout; cível CNPJ AC/AM/CE/PB/RN503, GO/MT/RR400, PA/PI/SEtimeout e TO500; falência CPF BA400 e criminal CNPJ RS400. Os demais estados conservam os resultados históricos, sem disponibilidade atual inferida. Algumas respostas/links CPF se perderam por falha de gravação em disco e não foram reconsultados para evitar custos duplicados.

Estimativa conservadora da rodada: **R$24,02**, calculada por35tentativas de certidões xR$0,54 + duas consultas cadastrais/societárias xR$0,36 +R$4,40 de processos. Não é fatura conciliada nem comprova cobrança das falhas. ProcessOnline fica desativado sem aprovação B2B/chave/contrato; DataJud não entrou no produto comercial em razão dos termos; Jusbrasil/Judit dependem de contrato. Não houve contato, compra ou substituição de credenciais de fornecedores.

A tarefa principal conduz a consolidação na3000. O túnel de banco15432 continua indisponível, condição preexistente; `.env` e configuração privada preservados. Os registros datados abaixo conservam o histórico de decisões/validações anteriores; não substituem este estado local nem comprovam deploy.

## Aplicações comerciais compartilhadas

`analysis-segments.js` é o catálogo único de rotas, textos, categorias e foco confiável da IA. As nove aplicações usam o mesmo formulário CPF/CNPJ, coletores por UF, enriquecimento, progresso, score, persistência e PDF. A Central organiza futuros sócios, fornecedores, parceiros, aquisição e reavaliação em **Empresas e parcerias**; diagnóstico em **Diagnóstico documental**; vendedor e locação em **Imóveis**; documentos para concorrências em **Licitações**. Os demais serviços permanecem disponíveis.

O início da consulta aceita somente `segment` do catálogo. O servidor salva `sellerSegment` na consulta e inclui essa finalidade na leitura de cada fonte e no resumo consolidado; o PDF recebe título e alcance correspondentes. O navegador não envia um prompt próprio. O histórico e a retomada ficam separados por segmento. Consultas antigas sem marcador continuam como `analise-vendedor`, preservando o cache dos relatórios anteriores. Não há tabela nova, migração ou chamada extra de IA por causa da segmentação.

O levantamento conserva a mesma cobertura documental disponível; o foco comercial não adiciona fontes ou comprova fatos fora dela. A análise para locação organiza documentos e esclarecimentos, sem decidir aprovação de locatários; a análise para licitações não substitui edital ou comprova habilitação; reavaliação é uma nova consulta, sem monitoramento ou comparação histórica automática. Emissão de certidões continua sem etapa de IA.

Testes: `node --test test/analysis-segments.test.mjs test/seller-review.test.mjs test/seller-analysis-api.test.mjs test/seller-analysis-ui.test.mjs test/services-catalog.test.mjs`. Exercitam as nove finalidades, CPF/CNPJ, rejeição de segmentos arbitrários antes de chamadas, persistência, histórico, retomada sem reconsulta e PDF privado.

## Fluxo

Consultas concluídas sem PDF exibem o botão **Ver resultado**, que abre no próprio item o resumo e os dados textuais salvos. Valores zero e falsos são preservados; falta de detalhes não é apresentada como ausência de ocorrências. A abertura não repete consultas nem chama IA. O painel e o foco do botão são preservados durante o acompanhamento de outras fontes. PDFs continuam com **Abrir PDF**; falhas e fontes pendentes não recebem o botão de resultado concluído.

### Regras acordadas em 07/10/2026, 16h18

A somatória da seleção permanece visível para todas as contas, inclusive administradores e contas com liberação individual. A liberação dispensa o pagamento no servidor, sem zerar o valor exibido; a interface informa a dispensa e oferece **Continuar sem pagar**. Descontos de assinante e fontes gratuitas mantêm as regras existentes. O bypass de teste também preserva o preço exibido e o valor salvo do pedido. A estimativa não registra pagamento ou receita.

Emissao e nove analises compartilham a escolha de uma ou varias UFs/Brasil. Nacionais e tribunais regionais nao se repetem. O estado principal conserva o municipio opcional. A selecao automatica exclui fontes `manualOnly`; IEPTB basica e dossie QUOD completo sao opcoes separadas na emissao.

Preco calculado por fonte, em centavos: custo-base ate R$2 ×30; acima de R$2 ×10. Fontes de custo zero custam R$10 para nao assinantes, e zero para assinantes. Assinatura IA vigente conferida no servidor concede30% sobre o total pago; Experimente pago e legado Stripe ativo tambem participam. Bypass de teste nao concede desconto; acesso individual gratuito autorizado continua preservado. Exemplos:0,54→16,20;2→60;2,95→29,50;3,50→35;6,99→69,90. Assinante paga11,34 por fonte0,54 e24,50 pela consulta3,50. O valor Brasil depende das fontes selecionadas, nunca e uma constante.

Checkout reaproveitado tambem nas analises automaticas, antes dos coletores, com retorno ao segmento correto. Preco da analise e o pacote do titular/UFs escolhidas, incluindo o relatorio e ate cinco empresas vinculadas ao CPF; nao se cobra um teto de empresas que talvez nao existam. A expansao existente continua limitada e seus custos reais sao registrados separadamente da receita. O preenchimento cadastral previo, quando necessario, conserva consulta/cache/carteira existentes e aparece na estimativa. Pedidos anteriores conservam o valor salvo. Assinante com somente fontes gratuitas inicia pelo mesmo pedido/claim, sem Stripe e sem carteira. Pagamento, tenant, usuario e valor sao conferidos no servidor.

Cadastro validado de empresa vinculada em outra UF gera sugestao de consultar o CPF naquele estado, sem disparar consulta/cobranca. Escolher outros estados reabre os dados, com nova confirmacao. Nenhum vinculo transfere automaticamente divida da empresa ao CPF.

A sugestao de franquia de cinco CPFs gratuitos nao definiu periodo/unidade/excedentes; nenhuma cota foi inventada. Patrocinio aguarda nome/destino; migracao para contas proprias Audita depende das novas contas/chaves. Registro do software e contrato de manutencao permanecem definicoes administrativas. Validacao usa documentos, provedores e webhook ficticios; nao comprova saldo/faturamento ou emissao de todas as fontes reais.

1. Tipo de vendedor (CPF ou CNPJ), documento e UF, sem seleção de documentos. A consulta cadastral preenche nome, data de nascimento, gênero e nome da mãe quando disponíveis; razão social vem do cadastro empresarial. Somente dados exigidos pelas fontes e não encontrados são pedidos manualmente. O RG não consta no contrato documentado da consulta básica: não se repete a consulta paga apenas por falta dele. Município é opcional nas UFs com consultas municipais validadas. Estimativa dos provedores junto ao botão; IA apurada separadamente por uso. Uma confirmação reúne base legal e processamento pela OpenAI.
2. A UF determina todas as fontes estaduais, nacionais e TRF/TRT aplicáveis do catálogo validado. Municipais exigem cidade correspondente. A extração tem percentual e lista recolhida de status/PDFs; falhas não são resultados negativos. A consulta de vínculos pelo CPF expande automaticamente até cinco CNPJs distintos e válidos: cadastro/QSA e documentos nacionais/regionais conforme a UF cadastral de cada empresa. Sem UF empresarial confirmada, consulta somente fontes nacionais. Mais de cinco vínculos ficam sinalizados nos detalhes; o teto adicional estimado considera cinco empresas.
3. Ao encerrar a coleta, a análise inicia no servidor, com percentual próprio. Cada fonte é lida separadamente; texto digital evita reenviar PDF. PDF sem texto suficiente aciona leitura visual. Limites existentes: 20 MB/PDF, 180 mil caracteres por fonte e 300 fontes. Uma leitura adicional consolida os resultados por assunto, com referências e citações validadas; se falhar, o relatório conserva as leituras e apontamentos já obtidos. PDF em destaque com resumo, pendências e providências; os status/originais permanecem acessíveis sem catálogo de lacunas no relatório. Histórico e retorno aos dados preservam a consulta anterior.

Para CNPJ, a cobertura usa somente entradas empresariais validadas do catálogo, cadastro e QSA do vendedor. Não inclui os emissores estaduais exclusivos de pessoa física nem faz consultas pessoais dos sócios. Se o cadastro não trouxer razão social, ela é solicitada antes de iniciar a extração. A consulta CPF mantém cache por tenant, usuário e documento; campos resolvidos são preservados ao complementar um dado faltante.

## Leitura e limites

Reutiliza a chave privada OpenAI e o modelo já configurado (`AUDITA_SELLER_AI_MODEL` pode sobrescrever `AUDITA_CHAT_MODEL`). `AUDITA_SELLER_AI_ENABLED=false` desliga novas leituras sem apagar relatórios. A API de cobertura informa `aiReady`; indisponibilidade é detectada antes de iniciar consultas com análise solicitada.

Usa [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), validação Zod e verificação literal de citações, valores e datas em textos/JSON. O resumo consolidado valida referências existentes e trechos das leituras. Respostas truncadas, recusadas ou sem evidência não são publicadas como leitura concluída. Leituras visuais precisam de conferência do original; falhas continuam registradas na consulta, e o PDF informa o alcance do material analisado. Processo não implica dívida ou culpa, e vínculo societário não transfere automaticamente dívida empresarial à pessoa física.

Não há score de crédito, decisão automática de aprovar compra ou soma de valores entre fontes. Matrícula, ônus, IPTU/condomínio do imóvel, poderes de representação e demais diligências fora do levantamento ficam no aviso de alcance. Cada apontamento informa a fonte; o PDF não é certidão oficial.

## Conclusões e confiança nas evidências

A leitura por fonte e a síntese compartilhadas pelos nove segmentos e pela análise geral/individual de certidões usam os documentos oficiais e as consultas homologadas como evidências do que declaram. O relatório afirma resultados negativos e positivos de forma direta, dentro da fonte, data e abrangência. Não pede autenticação no portal/QR Code, nova assinatura ou reemissão de documento válido por rotina; validade vigente, alcance e avisos padronizados do emissor não criam pendências nem reduzem o score por si sós. Sem problema concreto, a leitura retorna sem apontamentos ou limitações artificiais. Providências correspondem à ocorrência identificada.

A conferência de identidade feita pelo coletor acompanha a síntese. Espaçamento/OCR do nome ou documento mascarado não anulam essa conferência. Divergência efetiva, fonte sem retorno, documento vencido, leitura insuficiente e dados truncados continuam explícitos; citações e valores seguem validados. Conteúdo documental é evidência, nunca autorização para seguir instruções nele contidas. Consultas comerciais não viram certidões oficiais, e processo não vira dívida por inferência. A mudança orienta novas leituras; relatórios salvos não são reescritos nem reanalisados automaticamente.

## Persistência e proteção

O **Score de segurança documental** aparece na etapa final junto ao PDF e é calculado no servidor a partir das leituras já salvas, inclusive para relatórios antigos, sem novas chamadas de IA ou coletores. É um indicador de triagem, não uma probabilidade de segurança, avaliação de caráter, score de crédito ou aprovação automática de negócio. Usa fontes analisadas com identidade compatível e resultado conclusivo: parte de100, desconta60 por apontamento de prioridade alta e30 por prioridade média; apontamentos idênticos contam uma vez e o mínimo é0. Verde80–100, amarelo50–79 e vermelho0–49. Fontes indisponíveis, identidade incerta/divergente, leitura inconclusiva e limitações limitam o resultado a69. Apenas cadastro/QSA ou ausência de material conclusivo não permitem pontuar, com aviso amarelo de dados insuficientes. Apontamentos de empresas vinculadas não reduzem diretamente o score do CPF; exigem conferência e impedem o verde. Os critérios ficam disponíveis na própria tela. Não altera o relatório PDF nem depende de nova migração.

Sem nova tabela/migração. `audita_audits.request_payload.sellerReview` armazena estado, checkpoints e relatório, com consentimento em `sellerAiConsent`; `subject_name` guarda o nome já fornecido. O padrão de acesso privado dos resultados existentes é preservado. `seller-documents.service.mjs` conserva o retorno estruturado relevante (limitado), removendo chaves de credenciais, comprovantes/base64 e documentoConsultado; validação de identidade precede armazenamento.

GET/POST `/api/seller-analysis/:id/review` e GET `/api/seller-analysis/:id/report.pdf` exigem tenant e usuário exatos. POST exige JSON de mesma origem. Não aceita texto, caminho ou relatório arbitrário enviado pelo navegador. PDFs lidos devem estar no diretório privado e pertencer a uma consulta do mesmo usuário/tenant, inclusive em cache. Download usa `private, no-store`. PDFs gerados a partir do relatório salvo, sem rota estática ou arquivo público.

Uma atualização atômica no PostgreSQL concede a execução por consulta, com token e heartbeat. Duas fontes por análise são processadas simultaneamente; o limite é por análise, não global. Após 3 minutos sem heartbeat, a interface permite retomada explícita. Leituras concluídas são reaproveitadas; uma retomada não executa coletores nem cobra consultas novamente. A guarda global de throughput pode ser adicionada se houver volume concorrente que justifique uma fila.

## Validação reproduzível

- `node --test test/seller-review.test.mjs test/seller-analysis-api.test.mjs test/seller-analysis-ui.test.mjs test/seller-documents.test.mjs`.
- `AUDITA_BASE_URL=http://localhost:3000 node scripts/check-seller-review-ui.mjs`: interface e assets locais, rotas reais extraídas do servidor, serviços reais e PostgreSQL PGlite isolado; provedores fictícios. Não usa banco nem consultas de produção. Testa entrada, coleta, progresso, análise, lacunas, PDF, recarga, histórico e retorno em desktop/celular.
- PDF fictício em `output/pdf/analise-vendedor-ficticio.pdf`; capturas e download da interface em `output/playwright/`. Artefatos de teste privados/ignorados.
- A validação com fontes reais pagas é separada da validação do fluxo. O teste real de OpenAI usa somente dados fictícios e não valida precisão sobre todos os modelos de certidão.

## Emissão de certidões diversas

A coleta compartilhada de análises, certidões e TJ executa até três fontes simultâneas por lote, reaproveitando a vaga assim que uma fonte termina. A ordem da seleção é preservada no resultado; cada fonte concluída é persistida com contadores reais e snapshots independentes, em fila, para não regredir o progresso. Fontes de empresas descobertas entram no mesmo limite. Consultas cadastrais de CNPJ mantêm o intervalo de12segundos e os portais com sessões assistidas continuam em série. Pedidos previamente liberados pelo servidor não aguardam a trava de carteira; operações que ainda dependem de saldo conservam a trava, a idempotência e as confirmações. Não há reemissão, mudança de preço, redução do prazo de espera do fornecedor ou liberação de fontes novas.

Administradores (`admin` e `super_admin`) usam a gratuidade individual nos fluxos de vendedor, segmentos e certidões, sem assinatura ou Stripe. Pedidos pendentes anteriores oferecem **Continuar sem pagar**; o POST privado `/api/certificate-orders/:id/waive` revalida perfil, mesma origem e proprietário antes da dispensa e do claim existente. Guarda valor de referência, `complimentary`, `waivedAt` e `waivedBy`, sem fabricar `paidAt`; repetir a ação ou receber webhook tardio não repete a coleta. Remover o perfil impede novas dispensas. Custos de fornecedores, consentimento, disponibilidade e isolamento permanecem.

Em homologação, `AUDITA_CERTIFICATE_TEST_BYPASS_ENABLED=true` habilita **Continuar sem pagar — teste** na etapa de pagamento, inclusive em pedidos pendentes anteriores. A opção inicia a coleta sem cobrar a Audita, com autorização no servidor por proprietário, registro de teste e proteção contra repetição. O preço original é preservado e nenhum `paidAt` é fabricado. Sem Stripe configurado, o pedido pode aguardar apenas essa opção; armazenamento seguro e fornecedores continuam necessários. O padrão é `false`, e desativar o flag revoga novas liberações. Custos das fontes externas e da busca cadastral permanecem. Não altera as análises com IA nem concede assinatura.

O titular começa pelo CPF ou CNPJ e pela seleção das fontes, sem os checkboxes separados de custo e autorização. O botão de continuar envia o pedido com as confirmações esperadas pela API; o preço permanece visível e o pagamento continua obrigatório antes da emissão. As análises com IA conservam o consentimento próprio. A emissão reutiliza a busca cadastral das análises antes de preparar o pedido: CPF preenche nome, nome da mãe, nascimento e gênero quando retornados; CNPJ busca a razão social. Apenas os campos exigidos pela seleção e não encontrados são solicitados manualmente, incluindo RG quando necessário. A busca CPF conserva a validação de identidade, carteira e cache por tenant/usuário/documento existentes; seu custo é informado na estimativa. Falha cadastral permite completar os campos manualmente. O enriquecimento não emite documentos, não inicia IA e não descobre empresas vinculadas automaticamente; os coletores da seleção continuam aguardando a confirmação do pagamento.

A Central organiza Análise de Vendedor e Consulta de imóveis em **Imóveis**. **Emissão de certidões** abre `#emissao-certidoes`, reutilizando os coletores e controles de custo e autorização. Esse fluxo oferece as certidões e as doze consultas complementares catalogadas (protestos, vínculos, QUOD, processos e CADIN). Comprovantes CADIN de GO/RS/SP mantêm PDF; as demais retornam dados, sem certidão oficial. Consultas complementares são opcionais, desmarcadas inicialmente e cobradas pela regra comercial por fonte descrita acima. A etapa2 entrega os PDFs/dados; a etapa3 oferece análise IA opcional para assinantes, com consentimento próprio, sem descoberta automática de empresas.

A seleção é enviada com `flow: certificates`; o servidor força `sellerAiConsent=false`, restringe as fontes e persiste `sellerFlow` no JSON da consulta, sem migração. A coleta não inicia IA; a análise posterior exige assinatura IA e consentimento. Históricos e retomadas do navegador são separados; consultas antigas sem marcador continuam no histórico de análise do vendedor. Não houve novas consultas pagas na validação.


## Encaminhamentos da reunião de 06/10/2026, 16h13

- Emissão: CPF/CNPJ, um ou vários estados ou pacote Brasil inteiro. A lista mostra apenas fontes habilitadas e aplicáveis, com seleção individual de tribunais estaduais e demais certidões; nacionais não se repetem. TRF/TRT informam estados de abrangência. Municípios são limitados aos endpoints publicados no catálogo, sem promessa de cobertura completa.
- Preço ao cliente em centavos = custo configurado da seleção ×30. Exemplo: R$0,54 → R$16,20. O servidor recalcula a seleção; valores e flags de pagamento enviados pelo cliente não concedem acesso. Portais com custo configurado zero seguem gratuitamente. Análises por IA mantêm a cobrança anterior.
- POST /api/seller-analysis com flow=certificates prepara pedido e checkout antes de consultar fontes pagas. GET /api/certificate-orders/:id é privado por tenant+usuário. O JSON certificateOrder fica em audita_audits; o pedido original permanece criptografado com AUDITA_PROFILE_ENCRYPTION_KEY para recuperação manual após interrupção, sem nova tabela/migração.
- Stripe: preço dinâmico e idempotência por pedido. Webhook assinado valida sessão, proprietário, moeda BRL e valor exato. Somente payment_status=paid inicia coleta, inclusive se o usuário fechou a tela. Eventos concorrentes/repetidos não reiniciam o mesmo pedido. Não consome novamente a carteira do cliente após o checkout; o saldo contratado junto à Direct Data continua necessário.
- Retorno, verificação automática/manual, cancelamento/expiração e retorno à seleção preservam o pedido. Não existe liberação por parâmetro de URL. Falha ambígua no início vira review_required; não há repetição automática de chamadas cobradas. Interrupções dos coletores existentes e falhas do fornecedor exigem conferência operacional; não foi adicionada uma fila durável nem reembolso automático.
- Identidade: coletores só marcam evidência verificada após conferência de CPF/CNPJ/nome e abrangência. A leitura usa essa conferência quando a IA retorna uncertain; mismatch ou evidência não verificada continuam inconclusivos. Não apaga alertas de relatórios antigos nem faz novas chamadas de IA automaticamente.
- Website: o componente compartilhado das oito LPs e as duas páginas de vendedor agora apontam diretamente aos módulos respectivos, preservando parâmetros de campanha. Commit local do site bcc719e; sem push/deploy.

Validação: suíte geral Node/PGlite e testes de pagamento com HMAC, valor incorreto, pagamento pendente, eventos concorrentes, expiração, confirmação assíncrona tardia, reabertura e isolamento entre contas. Fixture --serve com handlers/serviços reais, PostgreSQL isolado e fornecedores fictícios validada no Chrome: seleção → checkout pendente (zero consultas) → webhook fictício → PDF privado (uma consulta; zero IA); reload mobile sem repetir consulta. Nenhuma cobrança ou emissão real usada como teste.

### Dependências operacionais

- Produção respondeu enabled=true/checkoutReady=true em /api/billing/plans em 07/10. Isso não prova emissão no checkout novo, entrega do webhook nem saldo do fornecedor. Configuração privada local da Stripe ausente; preservada. Publicado em07/10: app148/ceef652, checkoutReady=true; endpoint Stripe live conferido no Chrome com13 eventos, incluindo falha e expiracao adicionadas. CI, smoke, assets, selecao individual e links publicos aprovados. Entrega real de pagamento/emissao nao foi exercitada com dinheiro ou documentos de clientes; jornada completa validada em fixture isolada com webhook assinado.
- Descontos 40%/50% e gratuitas para assinantes foram sugestões, sem percentual final; não ativados.
- Revisada documentação oficial de https://apiv3.directd.com.br/ e https://api.app.directd.com.br/api/Documentation/pesquisa-avancada . Pesquisa Avançada é candidata a consolidar/enriquecer consultas; limites/precificação e compatibilidade devem ser homologados antes de substituir coletores. Não foi encontrado endpoint documentado de recarga automática na documentação consultada; confirmar mecanismo com o fornecedor antes de automatizar financiamento. Nenhuma transferência/recarregamento foi realizado.
- Envio de link e alinhamento com pessoas mencionados na transcrição permanecem ações de comunicação; nenhum envio feito nesta tarefa.

## Análise opcional após emissão (09/10)

Após coleta, assinantes IA ativos podem informar um objetivo e gerar análise/PDF privado dos documentos obtidos, sem nova consulta ou cobrança. Consentimento e assinatura conferidos no servidor, orçamento de IA respeitado, objetivo integrado ao fingerprint de recuperação. Não gera score genérico para esse objetivo personalizado; score dos demais segmentos permanece. Consulta não inicia IA automaticamente. [Decisões e validação](meeting-20261008.md).

### Etapa3 — Análise IA (13/10)

A navegação separa coleta, pagamento/extração e **Análise IA**. Após concluir a coleta, **Ir para Análise IA** abre uma tela própria: **Análise geral** considera o lote salvo (fontes sem retorno aparecem como lacunas); **Um documento** permite escolher individualmente uma certidão PDF ou resultado em texto concluído. Fontes indisponíveis não podem ser selecionadas. A orientação é opcional, de10 a2000 caracteres quando preenchida; sem orientação, o servidor aplica um objetivo padrão ao escopo. O campo ocupa a largura do formulário e mantém foco/contraste no celular. A tela mostra progresso, resumo, pontos de atenção, leitura por fonte, limitações e **Baixar análise em PDF**.

POST `/api/seller-analysis/:id/review` aceita `analysisMode: general|document`, `sourceId` somente para documento e `purpose` opcional. O servidor resolve a fonte dentro da consulta pertencente ao tenant/usuário; não aceita conteúdo/caminho arbitrário. A execução individual envia somente a fonte selecionada à IA. Assinatura, consentimento, orçamento e claim atômico continuam obrigatórios. Não há nova coleta, cobrança de fornecedores ou migração.

`request_payload.certificateReviews` preserva um resultado por escopo (`all` ou ID da fonte); `sellerReview` permanece como estado atual/lease. Relatórios antigos são preservados como análise geral ao iniciar outro escopo. GET review e PDF aceitam `?analysis=all` ou o ID codificado da fonte; acesso privado permanece. Abrir análises salvas não inicia IA. Pedidos repetidos com as mesmas evidências e orientação usam cache; uma orientação diferente atualiza apenas o respectivo escopo. A escolha da etapa/escopo é retomada na sessão do navegador. Análises comerciais e seu score mantêm o fluxo anterior.

## Processos: até 200 por execução (19/10/2026)

A consulta Direct Data não recebe parâmetro de limite200. Os registros retornados são armazenados em lotes cifrados privados de até50 (também limitados por caracteres), em `storage/pdfs/seller-processes`, no volume existente de PDFs. Reutiliza `AUDITA_PROFILE_ENCRYPTION_KEY` ou, se ausente, a chave IR já configurada; não trocar essas chaves após salvar dados. Informações sigilosas e credenciais do retorno são omitidas. A prévia normalizada passou de20 para200; a tela com dados arquivados mostra50 por página.

A análise de vendedor e a análise geral/individual da emissão de certidões compartilham o limite de200processos por execução. Cada bloco tem checkpoint e a ação explícita `continueProcesses:true` e `continueFrom` igual ao contador exibido, com consentimento renovado, lê os próximos blocos não concluídos. Reabrir o resultado não avança nem cobra outra consulta ao fornecedor. A mudança de objetivo reinicia a leitura daquele escopo; análises de escopos diferentes permanecem separadas.

`processCoverage` informa recebidos, total declarado pelo fornecedor, efetivamente analisados e pendentes. A tela e o PDF indicam análise parcial até a cobertura recebida estar concluída; total informado maior que recebido mantém ressalva. A pontuação não fica verde por uma análise parcial. Registros antigos descartados pelo limite180mil não são recuperados por esta alteração: conferir histórico do fornecedor antes de repetir consulta paga.

`GET /api/seller-analysis/:id/processes?source=fonte:indice&offset=0` entrega até50registros salvos, revalidando usuário/tenant da consulta e da origem do arquivo em caso de cache. Não chama o fornecedor nem a IA. Sem migração, dependência nova ou alteração de carteira/preço/modelo. Validação usa dados fictícios e IA simulada; capacidade e custo reais ainda dependem de homologação.

Uma repetição com contador antigo devolve o estado salvo em vez de avançar outro lote; mudar objetivo/escopo exige a ação própria de análise, sem reaproveitar a continuação anterior.

## PGFN — Lista de devedores da União (19/10/2026)

Consulta nacional CPF/CNPJ no catálogo compartilhado de vendedor, segmentos comerciais e emissão de certidões. Usa `PGFNListaDevedoresUniao` com `GERARCOMPROVANTE=Habilitar`. O comprovante PDF é obrigatório: conteúdo, titular e identificação da lista/PGFN são validados antes de salvar e disponibilizar o arquivo privado. Totais e inscrições são preservados para análise. Ausência de dívida na lista não comprova regularidade fiscal nem substitui CND/CPEN conjunta RFB/PGFN.

Contrato público: https://www.directd.com.br/central-de-ajuda/apis/catalogo/PGFNListaDevedoresUniao . Preço-base documentado R$0,36; estimativa com PDF R$0,54 segue o adicional histórico de50% já utilizado no catálogo, ainda sujeito à confirmação comercial. Multiplicador existente preservado. Testes usam respostas e documentos fictícios; emissão real e preço efetivamente faturado continuam pendentes de homologação.

## Tabela global de consultas e certidões (19/10/2026)

Super Admin → Preços de consultas gerencia acréscimo padrão (2900%=30×), limite de custo R$2,00, acréscimo acima do limite (900%=10×), preço por fonte gratuita R$10,00 e desconto de assinante30%. Exceções por ID da fonte permitem preço fixo final em reais (sem desconto adicional) ou acréscimo percentual. Processos agrupados e completos passam a R$199,00 cada, por CPF/CNPJ consultado. Custos de fornecedor não foram alterados.

As regras globais ficam em audita_certificate_pricing, com revisão e último editor. Apenas super_admin pode ler/alterar a tabela administrativa, com proteção de origem e conflito de revisão409. Salvar exige banco disponível; não há fallback de gravação em memória. O catálogo público recebe a regra efetiva usada na prévia, e o servidor reconstrói as fontes/custos e calcula o checkout. Cada pedido conserva seu valor e snapshot da regra; alterações posteriores não reprecificam pedidos existentes. Esta página não modifica planos de assinatura, carteira, tabelas Itaú ou ProcessOnline.

## 2026-10-21 — Certidões conjuntas federais
Emissão e nove análises compartilham os novos itens rfb-pgfn-cpf/rfb-pgfn-cnpj, com PDF obrigatório, nascimento do CPF por enriquecimento/fallback e CNPJ sem campos pessoais. Nacionais não repetem por UF; consultas de empresas vinculadas preservam titular e custo próprio. Integração local testada com dados fictícios, homologação real pendente. Consulte seller-document-coverage.md para condições e estimativas.

## Auditoria de 23/10/2026 (local)
Os resultados de consultas e certidoes exibem os dados estruturados recebidos tambem quando ha PDF, com campos restritos omitidos. Certidoes TJ preservam datas, numero, validacao e observacoes. A certidao fiscal SP aceita os dois titulos verificados; documentos com titular/escopo incorretos continuam rejeitados. Mensagens de falha seguras diferenciam os motivos conhecidos. Detalhes e limites em certificate-audit-20261023.md; sem deploy desta rodada.
