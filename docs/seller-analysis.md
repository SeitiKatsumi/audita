# Análise documental do vendedor

## Aplicações comerciais compartilhadas

`analysis-segments.js` é o catálogo único de rotas, textos, categorias e foco confiável da IA. As nove aplicações usam o mesmo formulário CPF/CNPJ, coletores por UF, enriquecimento, progresso, score, persistência e PDF. A Central organiza futuros sócios, fornecedores, parceiros, aquisição e reavaliação em **Empresas e parcerias**; diagnóstico em **Diagnóstico documental**; vendedor e locação em **Imóveis**; documentos para concorrências em **Licitações**. Os demais serviços permanecem disponíveis.

O início da consulta aceita somente `segment` do catálogo. O servidor salva `sellerSegment` na consulta e inclui essa finalidade na leitura de cada fonte e no resumo consolidado; o PDF recebe título e alcance correspondentes. O navegador não envia um prompt próprio. O histórico e a retomada ficam separados por segmento. Consultas antigas sem marcador continuam como `analise-vendedor`, preservando o cache dos relatórios anteriores. Não há tabela nova, migração ou chamada extra de IA por causa da segmentação.

O levantamento conserva a mesma cobertura documental disponível; o foco comercial não adiciona fontes ou comprova fatos fora dela. A análise para locação organiza documentos e esclarecimentos, sem decidir aprovação de locatários; a análise para licitações não substitui edital ou comprova habilitação; reavaliação é uma nova consulta, sem monitoramento ou comparação histórica automática. Emissão de certidões continua sem etapa de IA.

Testes: `node --test test/analysis-segments.test.mjs test/seller-review.test.mjs test/seller-analysis-api.test.mjs test/seller-analysis-ui.test.mjs test/services-catalog.test.mjs`. Exercitam as nove finalidades, CPF/CNPJ, rejeição de segmentos arbitrários antes de chamadas, persistência, histórico, retomada sem reconsulta e PDF privado.

## Fluxo

1. Tipo de vendedor (CPF ou CNPJ), documento e UF, sem seleção de documentos. A consulta cadastral preenche nome, data de nascimento, gênero e nome da mãe quando disponíveis; razão social vem do cadastro empresarial. Somente dados exigidos pelas fontes e não encontrados são pedidos manualmente. O RG não consta no contrato documentado da consulta básica: não se repete a consulta paga apenas por falta dele. Município é opcional nas UFs com consultas municipais validadas. Estimativa dos provedores junto ao botão; IA apurada separadamente por uso. Uma confirmação reúne base legal e processamento pela OpenAI.
2. A UF determina todas as fontes estaduais, nacionais e TRF/TRT aplicáveis do catálogo validado. Municipais exigem cidade correspondente. A extração tem percentual e lista recolhida de status/PDFs; falhas não são resultados negativos. A consulta de vínculos pelo CPF expande automaticamente até cinco CNPJs distintos e válidos: cadastro/QSA e documentos nacionais/regionais conforme a UF cadastral de cada empresa. Sem UF empresarial confirmada, consulta somente fontes nacionais. Mais de cinco vínculos ficam sinalizados nos detalhes; o teto adicional estimado considera cinco empresas.
3. Ao encerrar a coleta, a análise inicia no servidor, com percentual próprio. Cada fonte é lida separadamente; texto digital evita reenviar PDF. PDF sem texto suficiente aciona leitura visual. Limites existentes: 20 MB/PDF, 180 mil caracteres por fonte e 300 fontes. Uma leitura adicional consolida os resultados por assunto, com referências e citações validadas; se falhar, o relatório conserva as leituras e apontamentos já obtidos. PDF em destaque com resumo, pendências e providências; os status/originais permanecem acessíveis sem catálogo de lacunas no relatório. Histórico e retorno aos dados preservam a consulta anterior.

Para CNPJ, a cobertura usa somente entradas empresariais validadas do catálogo, cadastro e QSA do vendedor. Não inclui os emissores estaduais exclusivos de pessoa física nem faz consultas pessoais dos sócios. Se o cadastro não trouxer razão social, ela é solicitada antes de iniciar a extração. A consulta CPF mantém cache por tenant, usuário e documento; campos resolvidos são preservados ao complementar um dado faltante.

## Leitura e limites

Reutiliza a chave privada OpenAI e o modelo já configurado (`AUDITA_SELLER_AI_MODEL` pode sobrescrever `AUDITA_CHAT_MODEL`). `AUDITA_SELLER_AI_ENABLED=false` desliga novas leituras sem apagar relatórios. A API de cobertura informa `aiReady`; indisponibilidade é detectada antes de iniciar consultas com análise solicitada.

Usa [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), validação Zod e verificação literal de citações, valores e datas em textos/JSON. O resumo consolidado valida referências existentes e trechos das leituras. Respostas truncadas, recusadas ou sem evidência não são publicadas como leitura concluída. Leituras visuais precisam de conferência do original; falhas continuam registradas na consulta, e o PDF informa o alcance do material analisado. Processo não implica dívida ou culpa, e vínculo societário não transfere automaticamente dívida empresarial à pessoa física.

Não há score de crédito, decisão automática de aprovar compra ou soma de valores entre fontes. Matrícula, ônus, IPTU/condomínio do imóvel, poderes de representação e demais diligências fora do levantamento ficam no aviso de alcance. Cada apontamento informa a fonte; o PDF não é certidão oficial.

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

A Central organiza Análise de Vendedor e Consulta de imóveis em **Imóveis**. **Emissão de certidões** abre `#emissao-certidoes`, reutilizando os coletores e controles de custo e autorização. Esse fluxo oferece somente as fontes de tipo certidão, entrega os PDFs e não inclui a etapa 3, consentimento OpenAI ou relatório de IA.

A seleção é enviada com `flow: certificates`; o servidor força `sellerAiConsent=false`, restringe as fontes e persiste `sellerFlow` no JSON da consulta, sem migração. O início da análise de IA é recusado para uma emissão mesmo que solicitado diretamente à API. Históricos e retomadas do navegador são separados; consultas antigas sem marcador continuam no histórico de análise do vendedor. Não houve novas consultas pagas na validação.


## Encaminhamentos da reunião de 06/10/2026, 16h13

- Emissão: CPF/CNPJ, um ou vários estados ou pacote Brasil inteiro. A lista mostra apenas fontes habilitadas e aplicáveis, com seleção individual de tribunais estaduais e demais certidões; nacionais não se repetem. TRF/TRT informam estados de abrangência. Municípios são limitados aos endpoints publicados no catálogo, sem promessa de cobertura completa.
- Preço ao cliente em centavos = custo configurado da seleção ×20. Exemplo: R$0,54 → R$10,80. O servidor recalcula a seleção; valores e flags de pagamento enviados pelo cliente não concedem acesso. Portais com custo configurado zero seguem gratuitamente. Análises por IA mantêm a cobrança anterior.
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
