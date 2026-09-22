# 2026-09-23 - Envio autorizado dos ajustes de assinatura e conta
- Usuario solicitou commit/push: cotas percentuais, Assinatura IA, remocao do atalho antigo, separacao Planos/Meus Dados e categorias IA/Central. Origin atualizado sem divergencia. Check-account-ui e 43 testes de charge-analysis-ui passaram; check-chat-subscription-ui reexecutado com sucesso antes do commit. Deploy nao verificado.

# 2026-09-23 - Categorias de assinatura
- Planos dividido em Assinaturas de IA (catalogo atual) e Assinaturas da Central de Servicos (estado explicito de indisponibilidade, link para Central). Nenhum preco/plano inventado; contratos Standard e cobranca preservados.
- Check-account-ui passou na porta 3000, incluindo os dois titulos, navegacao, desktop/celular e fluxos existentes. Diff check sem erros; apenas local, sem push/deploy.

# 2026-09-23 - Separacao de Planos e Meus Dados
- Codex, main local consolidado: #planos contem assinatura/cotas; #meus-dados mantem perfil, seguranca e saida da conta. Menu desktop e celular com Meus Dados apos Planos. Retorno /planos de checkout/portal aponta para #planos preservando parametros. Autenticacao e formularios existentes preservados.
- Validacao na porta 3000: check-account-ui passou com navegacao separada, perfil/senha, checkout simulado, desktop/celular e ausencia de overflow; 43 testes de charge-analysis-ui passaram. Sem commit/push ou deploy.

# 2026-09-23 - Porcentagem de cotas restantes
- Codex, main local consolidado: indicadores de mensagens e paginas no chat, modal e Planos, usando limites/saldo do servidor. Sem percentuais inventados para visitantes, contratos sem limites ou acesso inativo. Atualizacao pelo fluxo existente, sem novas APIs.
- Validacao: check-chat-subscription-ui passou, incluindo 88%/85%, cotas 0%/100% e contrato legado sem limite; git diff --check passou. Asset confirmado na porta 3000. Sem commit/push ou cobranca real.

# 2026-09-23 - Rotulo Assinatura IA
- Removido atalho Planos e acesso ao chat acima do compositor. Consumo permanece no modal e na pagina Planos; botao do topo e bloqueios de acesso preservados.
- Botao do topo do chat renomeado de Assinatura para Assinatura IA, mantendo identificador, acessibilidade e abertura do modal. Alteracao local, sem commit/push.

# 2026-09-23 - Commit e push consolidado autorizado
- Usuario solicitou envio da versao local consolidada: assinatura unificada, animacao acessivel, rotulo Planos e conferencia documental de importacao. Referencias origin atualizadas, main sem divergencia antes do commit. Configuracoes privadas Stripe permanecem fora do Git.
- Validacao pre-envio: 452 testes passaram, zero ignorados, PGlite isolado; checks de chat-subscription, account (localhost:3000) e importacao desktop/celular passaram com APIs simuladas. Sem pagamento real. Push da main aciona deploy automatico; conclusao do deploy exige verificacao separada.

# 2026-09-22 - Meus Dados renomeado para Planos
- Codex, codex/plans-label, integrado ao main local/localhost:3000. Rotulos desktop/celular e titulo da pagina alterados para Planos; rota #meus-dados, perfil, senha e assinaturas preservados. Mudancas pontuais em index.html/app.js e expectativas de testes, sem substituir alteracoes paralelas.
- 43 testes de interface passaram; check-account-ui passou na porta 3000 com APIs/pagamentos simulados, perfil/senha, navegacao desktop/celular e teclado. diff --check sem erros; sem commit, push ou deploy.

# 2026-09-22 - Conferencia documental de importacao (consolidada localmente)
- Codex, implementacao em codex/import-document-check e integrada ao main local/localhost:3000. Preservadas as alteracoes paralelas de assinaturas e animacao do modal; index.html recebeu somente os dois versionadores dos assets de importacao.
- Payload criptografado v2, extracao original separada das correcoes, totais separados, associacao explicita Invoice/Packing, comparacao decimal sem float/conversao, justificativas e reconhecimento de pendencias. Chat por produto em duas colunas/empilhado, exclusao e reinclusao, retomada e PDF com rastreabilidade/historico. Acao products e rotas existentes; revisao fiscal e calculos inalterados. Legados acessiveis, sem reinterpretar value como preco unitario.
- Validacao: 452 testes passaram em banco isolado (PGlite), sem ignorados; 10 testes direcionados reexecutados apos os ajustes finais. Check de importacao passou na porta 3000 em 1440/390 com login, upload, associacao sugerida/manual, desvinculo, correcao, exclusao/reinclusao, retomada, pesquisa, revisao e PDF, com IA simulada. Texto do PDF verificado; capturas e ausencia de overflow horizontal conferidas. git diff --check sem erros.
- Servidor main reiniciado na 3000 com auto-migracao desativada. HTML/JS/CSS atualizados respondem 200; cases sem sessao responde 401 e codigo interno permanece 404. storageReady/aiReady=false: processamento real depende da configuracao privada autorizada existente; precisao da extracao real ainda requer amostras autorizadas. Nenhuma chamada paga, nova dependencia, tabela ou API paralela; sem commit, push, deploy ou migracao compartilhada.

# 2026-09-22 - Preparacao Stripe live (ainda nao liberado)
- Apos usuario salvar/reiniciar: /api/health HTTP 200, banco ready, versao 0a35f45; /api/billing/plans HTTP 200 e quatro chatPlans checkoutAvailable=true. Navegador autenticado abriu checkout LIVE Essencial, valor BRL 49.90/mes conferido; retorno sem pagamento manteve Nenhum plano de chat ativo. Nenhum pagamento submetido. Sessao de checkout nao paga criada na conta usada pelo usuario; nao equivale a assinatura ativa. Webhook pago, renovacao, portal com assinante e processamento documental real ainda nao validados. Checkout ofereceu conversao automatica para JPY pela localizacao; foi selecionado BRL apenas para esta validacao. Compatibilidade de Adaptive Pricing e antigos Price IDs Itau com chave live permanece pendente. Sem novo push/deploy de codigo.
- Usuario informou ter preenchido segredo do webhook; formato whsec_ conferido sem registrar valor. Autorizou gerar e armazenar chave documental no CapRover: AUDITA_CHAT_DOCUMENTS_ENCRYPTION_KEY de 32 bytes aleatorios em base64 preenchida somente no formulario, sem logs/arquivo. Portal live salvo com payment methods habilitado, cancelamento no fim do ciclo e troca de plano/quantidade desabilitadas. Save & Restart ainda depende do usuario (submissao de credenciais); nao recarregar aba CapRover nem perder formulario. Validacao real de checkout/webhook ainda pendente, sem cobranca executada.
- Continuidade: usuario criou chave restrita live e preencheu STRIPE_SECRET_KEY no formulario CapRover (prefixo conferido sem exposicao do valor). Quatro STRIPE_PRICE_CHAT_* preenchidos pelo Codex no mesmo formulario, ainda sem Save & Restart. Usuario autorizou explicitamente envio de eventos Stripe ao endpoint da Audita.
- Webhook live criado: we_1UIUkkEOXILRmCWM3C0WM3WA, https://app.auditainteligente.com.br/api/billing/webhook, Snapshot, API 2026-07-29.dahlia (versao atual oferecida pelo painel). Onze eventos: checkout.session.completed/async_payment_succeeded, invoice.paid/payment_failed, customer.subscription.created/updated/deleted, charge.refunded/dispute.created, refund.created/updated. Painel confirma Active e zero entregas; processamento ainda nao validado. Usuario deve inserir Signing secret diretamente no CapRover antes de salvar.
- Conta Audita autenticada no navegador. Quatro produtos/precos live criados e conferidos no painel: Experimente BRL 9.90 unico; Essencial 49.90, Profissional 99.90 e Premium 199.90 mensais. Nenhuma cobranca executada.
- IDs para configuracao autorizada: STRIPE_PRICE_CHAT_EXPERIMENT=price_1UIUXjEOXILRmCWMworrco2X; STRIPE_PRICE_CHAT_ESSENTIAL=price_1UIUYBEOXILRmCWMQLwKQnEZ; STRIPE_PRICE_CHAT_PROFESSIONAL=price_1UIUYZEOXILRmCWMW7Rh5JvB; STRIPE_PRICE_CHAT_PREMIUM=price_1UIUYqEOXILRmCWMHfKpyhBA. Nao recriar esses produtos.
- Servidor continua com chave de teste; nenhum env alterado nesta etapa. Painel Stripe nao mostra destinos live, apenas importacao de um webhook de teste. Pendente autorizacao para envio de eventos ao endpoint da Audita, chave restrita live inserida pelo usuario, segredo do webhook, chave de criptografia documental, portal e validacao antes de liberar vendas. Sem Stripe Tax automatico, push ou deploy.

# 2026-09-22 - Animacao do modal de assinatura
- Codex, main local: entrada de 240ms com fade, deslocamento e escala discretos; backdrop com fade. Somente modal de assinatura, sem alterar documentos ou pagamentos. Movimento reduzido desativa as animacoes. Check de assinatura passou com reabertura, movimento reduzido, teclado e desktop/celular; CSS atualizado confirmado na porta 3000. Sem push/deploy.

# 2026-09-22 - Assinatura unificada em Meus Dados e chat
- Meus Dados usa o mesmo controlador, catalogo, cotas e checkout do modal do chat. Removida a oferta Standard mensal/anual para novas compras nessa tela; contratos existentes continuam visiveis com beneficios e gerenciamento legado, sem migracao ou mudanca de preco.
- Removido controlador comercial duplicado de plans.js; /planos continua redirecionando para Meus Dados. 446 testes passaram, mais checks de assinatura e conta com pagamento simulado, Standard existente, teclado e celular. Capturas conferidas; sem cobranca, commit, push ou deploy nesta etapa.

# 2026-09-22 - Assinaturas do chat (local, sem venda)
- Quatro planos pagos separados do Standard; modal no chat, bloqueio por recurso, checkout/webhooks e reservas persistentes por usuario. Documentos PDF/PNG/JPEG com confirmacao, criptografia e resumo sem consumir mensagem. Migracoes aditivas preparadas, nao aplicadas ao banco compartilhado.
- Testes usam PGlite e Stripe/IA simuladas. Chave de IA existente reutilizada com autorizacao, sem chamadas pagas. Catalogo local sem prices configurados permanece indisponivel para compra. Sem commit, push, cobranca ou deploy.
- Simulador de custos em scripts/estimate-chat-plan-costs.mjs: cenario ilustrativo dentro de 25%, estresse excede. Nao equivale a medicao real; venda depende de homologacao e validacao de margem. Operacao e recuperacao documentadas em docs/chat-subscriptions.md.
- Validacao final: 446 testes passaram, sem ignorados (PGlite isolado); checks de assinatura e visitante passaram em desktop/celular. Capturas do modal conferidas e sem overflow horizontal. Localhost:3000 reiniciado, saude/chat/assets HTTP 200; APIs privadas bloqueiam visitante. Historico local isolado por tenant/usuario e clientes Stripe individuais separados do legado.

# 2026-09-22 - Categoria Imposto de Importacao
- Continuidade: titulo do card alterado para Auditoria do Imposto de Importacao conforme solicitado. Sete testes do catalogo passaram e texto servido na porta 3000 conferido. Apenas local.
- Codex; codex/import-category, base main, integrado na main local/3000. Grupo e rotulo alterados para Imposto de Importacao; filtro superior adicionado usando o mecanismo existente, com palavras-chave e destino preservado. Sete testes do catalogo passaram; navegador em 1440/390 validou filtro, grupo, unico card, retorno a Todos e ausencia de overflow horizontal; captura mobile conferida. Alteracoes anteriores preservadas. Sem commit, push ou deploy.

# 2026-09-22 - Manter conectado
- Codex; codex/remember-login, base main, integrado na main local/3000. Opcao Manter conectado por 30 dias no login, desmarcada por padrao; demais logins e cadastro mantem 12 horas. Cookie, PostgreSQL e armazenamento local usam o mesmo prazo; logout e troca de senha preservados. Sem renovacao automatica ou mudanca na recuperacao durante deploy.
- Validacao: 403 testes passaram, zero ignorados, incluindo PostgreSQL isolado, validade, novo contexto de servidor, expiracao, logout, senha e booleano estrito. Check-guest-ui passou em 1440/390 com teclado, payload, erro/reenvio e cadastro; captura mobile conferida. Servidor 3000 reiniciado e saude HTTP 200; banco local continua sem configuracao. Alteracao anterior Central de Servicos preservada. Sem commit, push, deploy, migracao ou mudanca de secrets.

# 2026-09-22 - Rotulo do atalho no chat
- Codex; codex/chat-services-label, base main, integrado na main local. index.html: Servicos alterado para Central de Servicos somente no topo do chat; destino e estilos preservados. Dois testes de entrada passaram; novo rotulo e destino conferidos no HTML servido por localhost:3000/chat, diff sem erros. Sem commit, push ou deploy.

# 2026-09-22 - Publicacao consolidada autorizada
- Usuario solicitou commit e push da versao consolidada: auditoria de importacao, chat por etapas e altura compacta, apresentacoes dos servicos e navegacao/login sob demanda. Main conferida com origin/main, sem divergencia antes do commit; preservar todos os arquivos privados fora do Git.
- Validacao imediatamente anterior: 401 testes Node aprovados, zero ignorados, PostgreSQL isolado e IA simulada; diff sem erros. Verificacoes de interface/viewport documentadas abaixo. Sem deploy ou migracao em banco compartilhado. Configuracao privada e migracao autorizada continuam necessarias para processamento real da importacao.

# 2026-09-22 - Altura do chat de importacao
- Codex, continuidade codex/import-audit. Corrigido min-height herdado do shell (844px somados ao cabecalho em viewport de 900px); cabecalho/espacos compactos e somente etapa atual visivel. Conversa anterior, documentos e fontes preservados em dialog nativo com Escape e retorno de foco. Limites da analise e historico acessiveis em detalhes. Formularios longos/zoom mantem rolagem natural para nao cortar conteudo.
- Integrado na main local/3000, estaticos tambem na 3002: import-audit.js/css, cache index.html, scripts/check-import-ui.mjs e docs/import-audit.md. Entrada real sem rolagem em 1271x900, 1366x768 e 390x844; screenshots conferidas. Check-import-ui passou em 1440/390, com assertions de altura na entrada, documentos, produtos e pesquisa desktop, alem de dialog/Escape/foco e fluxo completo simulado. Dez testes Node pertinentes e diff passaram. Sem backend, configuracao, commit/push/deploy; pendencia operacional anterior inalterada.

# 2026-09-22 - Importacao em chat guiado
- Codex; continuidade codex/import-audit, worktree audita-import-audit. Interface convertida para chat guiado por etapas com os baloes/avatar e helper de movimento existentes. Documentos, conferência de um produto por vez (anterior/proximo/remocao), pesquisa, fontes em detalhes e revisao/relatorio. Correcoes e retomada preservadas; sem conversa livre ou novas chamadas de IA para navegacao.
- Alterados import-audit.js/css, cache de index.html, scripts/check-import-ui.mjs e docs/import-audit.md. Backend, banco, permissoes e configuracao inalterados. Integrado na main local/porta 3000 (estaticos tambem na 3002); fetch sem divergencia remota, sem commit/push/deploy.
- Validado: 401 testes Node passaram na main, PostgreSQL isolado; fluxo desktop/celular com tres produtos ficticios, remocao de duplicado, anterior/proximo, correcao, complementar/cancelar, login, retomada, papeis, PDF, calculo e movimento reduzido. Capturas de entrada, produtos e resultados conferidas. JS servido na 3000 comparado ao arquivo local; avatar e bloqueio sem armazenamento verificados no servidor real. IA continua simulada nos testes; configuracao privada e migracao autorizada seguem pendentes para processamento real, conforme registro anterior.

# 2026-09-22 - Auditoria assistida de importacao
- Codex, codex/import-audit, worktree audita-import-audit; base main com alteracoes locais anteriores preservadas. Novo modulo TIPI/NCM: documentos, sugestoes com fontes, revisao humana e simulacao limitada a II/IPI. Reuso da chave OpenAI existente autorizado pelo usuario. Sem DI/Duimp, monitoramento diario, cobranca, push ou deploy.
- Arquivos compartilhados: server.mjs, app.js, index.html, Dockerfile e documentacao. Modulo, tabela e testes separados. Migracao aditiva somente em banco de teste; nao aplicar ao banco compartilhado sem autorizacao especifica.
- Integrado na main local, portas 3000/3002 ativas. Fetch confirmou main sem divergencia de origin/main; alteracoes anteriores preservadas. Sem commit, push ou deploy.
- Validacao: 401 testes Node passaram nos dois checkouts, incluindo PostgreSQL embarcado, criptografia, isolamento, revisao exclusiva, centavos, falhas e protecao contra resultado atrasado. check-import-ui passou em 1440/390 na 3012 e 3000 (IA simulada, banco isolado); capturas desktop/mobile conferidas. Na 3000 tambem passaram check-guest-ui e as 44 combinacoes de check-service-intros. Endpoints reais 3000/3002 conferidos: configuracao publica, casos 401 sem sessao e codigo privado 404.
- Download real da tabela NCM oficial verificado, sem credenciais. Chamadas OpenAI reais nao foram executadas: nao ha .env/.env.local, chave OpenAI ou DATABASE_URL configurados neste ambiente. O modulo reutiliza os mesmos secrets/modelo da Audita quando carregados, sem criar/trocar chave. Interface informa indisponibilidade e bloqueia novos documentos. Migracao nova executada somente no banco isolado dos testes.
- Proximo passo: disponibilizar a configuracao privada existente no ambiente autorizado e aplicar db/import-audit.sql de forma controlada antes de receber documentos reais. Producao e banco compartilhado nao alterados. Operacao e limites em docs/import-audit.md.

# 2026-09-22 - Apresentacao dos nove servicos
- Codex; branch codex/service-intros, worktree audita-service-intros, base main local com as alteracoes anteriores de visitante/login preservadas. Escopo: textos iniciais em index.html, bank-debt.js, charge-analysis.js, pis-pasep.js, ir-exemption.js e energy-audit.js; testes e este registro.
- Apresentacoes antes dos campos/perguntas, com finalidade, documentos e limites. Componentes e estilos atuais preservados. Sem novas etapas, API, banco, precos, permissoes ou habilitacao dos laudos em desenvolvimento. Itaú nao repete a apresentacao na etapa de documentos; dividas apresenta contexto somente na entrada sem atendimento.
- Validado no worktree: 397 testes Node passaram, incluindo PostgreSQL embarcado; 44 combinacoes de rotas (nove servicos e variantes PF/PJ), viewport 1440/390 e visitante/sessao sintetica passaram. Conferidos ordem dos textos, ausencia de duplicacao/overflow, selecao de arquivo, login sob demanda; check-guest-ui validou login/cadastro e retomada de IR/Itaú/chat. Sem dados reais ou chamadas de processamento aos provedores. Ajuste de espacamento reutiliza o padrao existente na introducao de imoveis.
- Integrado na main local: repetidos os 397 testes, as 44 combinacoes de entrada e check-guest-ui na porta 3000, todos aprovados. Aba existente na porta 3002 recarregada e nova introducao confirmada visualmente. Fetch sem divergencia de origin/main; alteracoes locais anteriores preservadas. Sem commit, push ou deploy. Proximo passo: revisao dos textos pelo usuario.

# 2026-09-22 - Correcao do retorno a Home
- Codex; continuidade codex/login-visual. Corrige guardGuestInteraction: links Home/Voltar da lateral real do chat nao exigem autenticacao. Ocultacao anterior desfeita; logo do dialog permite fechar o login e navegar a Home. Animacao preservada. Testes de visitante ampliados para links desktop/mobile e retorno pela logo do login.
- Integrado na main local. Tres testes de navegacao passaram; scripts/check-guest-ui.mjs passou em 1440px/390px nas portas 3012 e 3000, incluindo retorno sem login, retorno pelo dialog, login/cadastro e retomada de atendimento. Sintaxe e diff verificados. Sem commit, push ou deploy.

# 2026-09-22 - Apresentacao do login
- Codex; codex/login-visual, integrada na main local com navegacao visitante preservada. styles.css e index.html: atalhos de Home/Voltar do chat ficam invisiveis durante o modal e reaparecem ao fechar; abertura com fade/deslocamento de 220 ms, desativada com movimento reduzido. Sem alterar autenticacao.
- Validacao: 46 testes pertinentes passaram; scripts/check-guest-ui.mjs passou em 1440px/390px nas portas 3012 e 3000, verificando visibilidade/restauracao dos atalhos, animacao, movimento reduzido, Escape e fluxos existentes. Captura mobile conferida; disponivel localmente, sem commit, push ou deploy.

# 2026-09-22 - Navegacao visitante e login sob demanda
- Codex; main local consolidada. Home, chat, Central e apresentacoes dos servicos publicas; interacoes de atendimento interceptadas antes dos handlers, com login/cadastro em dialog acessivel e retomada da acao escolhida. Conta, historico e administracao exigem sessao. Falha ao consultar autenticacao permanece restritiva; visitante nao le/grava historico local do chat. Logout recarrega a Home para descartar dados privados da tela.
- Backend, permissoes e configuracao de autenticacao inalterados. Sem habilitar servicos indisponiveis. IR aguarda reconfiguracao da sessao antes da retomada; energia recebe o evento de autenticacao no mesmo alvo dos outros modulos. Anexos precisam de um novo clique apos login por exigencia de gesto do navegador.
- Validacao: suite com 396 aprovados e um ignorado; scripts/check-guest-ui.mjs testa 1440px/390px, navegacao publica, filtros/detalhes, login invalido, cadastro, envio por teclado, retomada em cobrancas/chat/IR, modal e rota privada. Captura mobile conferida. APIs reais locais de perfil/auditorias/chat retornaram 401 sem sessao. Porta 3000 atualizada; sem commit, push ou deploy.

# 2026-09-22 - Atalho de servicos no chat
- Removido Meus Dados somente do topo do chat; Servicos centralizado e sem sublinhado. Playwright 1440px/390px confirmou estilo computado e destino na porta 3000. Acessos de conta fora do chat preservados.
- Botao Ferramentas substituido por link Servicos para /#central-servicos. Removidos painel antigo, contador e eventos exclusivos. Oito testes passaram; Playwright confirmou navegacao em 1440px e 390px na porta 3000. Apenas local, sem push/deploy.

# 2026-09-22 - Publicacao GitHub autorizada
- Codex; consolidacao na main local de Meus Dados, perfil editavel, troca de senha, assinatura simplificada e navegacao da Central. npm test: 396 aprovados, um teste opcional ignorado, zero falhas; diff verificado. Remoto sincronizado antes do commit. Commit e push solicitados pelo usuario; sem deploy ou mudanca de banco/secrets. Os registros abaixo descrevem as validacoes locais anteriores.

# 2026-09-22 - Edicao de conta
- Codex; continuidade em codex/meus-dados, integrada na main local. app.js, index.html, plans.css e server.mjs: edicao do perfil pelo armazenamento criptografado existente, validacao, salvar/cancelar e troca de senha com senha atual, limite de tentativas e revogacao de sessoes. E-mail de contato separado do login; bootstrap nao sobrescreve mais contas existentes. Documentacao de seguranca e README atualizados; nenhuma migracao ou nova dependencia.
- Validacao: 71 testes pertinentes passaram, incluindo PostgreSQL embarcado, isolamento, concorrencia, falhas, limites e endpoint. scripts/check-account-ui.mjs passou em 3012 e 3000 com APIs simuladas (perfil, senha, assinatura, teclado e celular); capturas conferidas. Servidores 3000/3002 atualizados, endpoint sem sessao retorna 401 e formulario real visivel na aba do usuario. Nenhuma credencial ou dado real foi alterado nos testes; sem commit, push ou deploy.

# 2026-09-22 - Meus Dados
- Codex; branch codex/meus-dados, continuidade da main local com ajustes da Central preservados. Navegacao desktop/mobile direta para Meus Dados; perfil cadastral real e assinatura Standard mensal/anual na mesma tela. Historico e consumo de APIs retirados dos acessos comuns; dados, rotas administrativas e permissoes do servidor preservados.
- /planos conserva os retornos de checkout e portal e encaminha para Meus Dados. Oferta mostra beneficios, valor recorrente e total anual, assinatura existente, pendencia, cancelamento e tentativa apos falha. Sem alteracao de precos, backend, banco ou configuracao de pagamentos.
- Validacao: 98 testes pertinentes aprovados; scripts/check-account-ui.mjs verifica perfil, precos, checkout/portal simulados, assinatura ativa/pendente, erro/repeticao, permissoes, desktop/celular, teclado e logout. Capturas conferidas; nenhum pagamento real. Integrado e verificado na main local (portas 3000/3002), com Meus Dados aberto no navegador. Checkout real permanece indisponivel na configuracao local existente; sem commit, push ou deploy.

# 2026-09-22 - Navegacao centralizada
- Card de IR: botao Doencas abaixo do publico abre dialog nativo com os 17 itens fornecidos e ressalva de enquadramento individual. Seis testes passaram; Playwright desktop/mobile validou lista, fechamento por botao/Escape, retorno de foco e ausencia de overflow horizontal. Sem backend ou publicacao.
- Removido o campo Buscar servico da Central; botoes de categoria e limpeza preservados sem dependencia do input. Seis testes passaram; Playwright na porta 3000 confirmou ausencia da busca e filtros Bancario/Todos. Apenas local.
- Removido o grupo Ferramentas de Consulta (Dev) da lateral. Certidoes estaduais e indisponibilidade de bens adicionadas a Central; consulta de imoveis existente preservada. Rotas, provedores e permissoes inalterados. 49 testes passaram; Playwright validou links e retorno na porta 3000 em desktop e celular. Alteracao local, sem publicacao.

# 2026-09-21 - Catalogo local
- Publicacao GitHub autorizada: textos fornecidos pelo usuario nos cards, acesso direto a bandeiras, simplificacao do chat, retorno a Home e dois destinos na Home. Suite final: 392 aprovados, um ignorado. Primeira execucao teve falso positivo preexistente em chat-assistant (UUID com 11 digitos); repeticao sem alteracoes passou. Textos promocionais foram transcritos, sem validacao juridica. Sem migracoes ou deploy CapRover nesta entrega.
- Home sem atalhos individuais: duas acoes, Conversar com a IA AUDITA (/chat) e Explorar a Central de Servicos. Botoes responsivos; 43 testes de interface passaram e Playwright validou ambos os destinos em desktop/celular. Botao Voltar no chat mantido no rodape lateral, com seta, fonte normal e tamanho de Conversas; topo como alternativa mobile. Apenas local.
- Chat: titulo alterado para Inteligencia artificial, subtitulo Especialista juridica removido e seta acessivel Voltar para a Home adicionada ao cabecalho. Layout permite quebra no celular. Testes de entrada passaram; Playwright 1440px/390px confirmou retorno por teclado e ausencia de overflow. Apenas local.
- Chat inicial: removidos os quatro atalhos de sugestoes solicitados; boas-vindas, historico, ferramentas e campo de conversa preservados. Teste de regressao e Playwright conferiram ausencia dos atalhos e campo visivel em /chat. Apenas local, sem publicacao.
- Link Confira as 133 bandeiras no chat abaixo de Para quem e no card de cobrancas. Parametro bandeiras=1 abre a tela existente de referencias no chat e e consumido sem afetar navegacao normal. Lista existente preservada (113 referencias nominais); nenhuma marca inventada. 49 testes aprovados; Playwright desktop/mobile validou link direto e busca Azul. Apenas local.
- Experimento local solicitado no card de cobrancas: chamada sobre 133 bandeiras e periodo 2011 a 2026, seguida de Veja se voce tem valores a receber. Mantidos detalhes qualificadores, rota e expansao independente. Seis testes aprovados; Playwright desktop/mobile validou encaixe e cliques. Sem nova publicacao.
- Publicacao solicitada: cards compactos com detalhes e navegacao separados, visibilidade dos modulos e testes. Suite completa: 390 aprovados, um ignorado, zero falhas. Teste de estrutura do vendedor atualizado para o link interno. Sem migracao ou alteracao de segredos. Preparado para commit/push; deploy CapRover pendente de endereco e sessao autenticada nesta maquina. Nao houve publicacao em producao nesta etapa.
- Padrao compacto/expansivel aplicado aos nove cards da Central. Sete destinos mantidos; dois laudos continuam explicitamente em desenvolvimento, sem links ficticios. Textos baseados nos modulos locais, incluindo limite DF e homologacao ONR. Cinco testes passaram; Playwright 1440px/390px validou nove expansoes, teclado, sete rotas, busca, categorias e overflow. Sem backend, commit, push ou deploy.
- Correcao de navegacao: card volta a ser clicavel por link nativo expandido sobre a area; details/summary independente para Mais/Menos informacoes. Cinco testes passaram e Playwright verificou clique no titulo e borda, expansao sem navegacao e teclado em 1440px/390px. Apenas local.
- Ajuste solicitado: tres cards compactos com details/summary nativo, Mais/Menos informacoes e link de atendimento separado na expansao. Grade original restaurada. Cinco testes aprovados; Playwright em desktop/celular conferiu estado fechado, expansao, recolhimento por teclado, links e overflow. Sem alteracoes no backend ou publicacao.
- Cards explicativos implementados apenas para PIS/Pasep, contas de luz e IR: publico, ajuda, limites e acao. Alteracoes em index.html, styles.css e testes; demais cards e backend preservados. Cinco testes aprovados. Playwright em 1440px/390px validou busca, categorias, teclado, destinos e ausencia de overflow com autenticacao ficticia apenas no navegador isolado. Disponivel na porta 3000; sem publicacao.
- Codex; main local. PIS/PASEP, IR e contas de luz permanecem no catalogo independentemente da configuracao dos atendimentos. Nenhuma permissao, banco ou flag do backend alterada.
- Escopo: services-catalog.js e teste. Quatro testes passaram; Playwright confirmou hidden=false nos tres links servidos em localhost:3000. Sem commit, push ou deploy.

# 2026-09-18 — Publicação das orientações de extratos
- Publicação autorizada. 389 testes aprovados. Escopo: orientação Itaú e ajuda em dívidas; sem migrações/configuração. Rollback: audita:118 / 1d6603e. Publicado: GitHub/main e3e0dbb, CI 35384268161 aprovado, CapRover audita:119. Backup verificado; smoke de produção aprovado e ambos os arquivos JS servidos idênticos ao código validado. Container atual Running. Teste visual mobile realizado antes do deploy com APIs simuladas; não repetido autenticado em produção.

# 2026-09-18 — Orientações para obter extratos
- Codex, codex/statement-guidance, continuidade main. Itaú: aplicativo, internet banking mês a mês e agência/conta encerrada; carta e retorno existentes preservados. Dívidas: ajuda nativa expansível junto ao envio, com canais do banco do cliente e preservação dos arquivos selecionados. 44 testes pertinentes aprovados, sintaxe e diff verificados. Navegador isolado em 3012 com APIs simuladas validou ambos os caminhos em 390 px, retorno ao upload e preservação do arquivo selecionado ao abrir/fechar ajuda; capturas conferidas. Nenhum documento enviado ou dado real alterado. Integrado na main local; sem commit, push ou deploy. Verificação na porta 3000 bloqueada: ela está servindo o site institucional (Next.js), não este app; processo preservado. Falta disponibilizar e conferir a interface nessa porta.

# 2026-09-18 — Publicação das alterações de 17/09
- Codex. Publicação autorizada de agrupamento, navegação mobile, configurações recolhidas, login sem menu e opção de desativar jobs locais (padrão de produção mantido). 389 testes passaram; sem migrações ou alteração de secrets remotos. Rollback: audita:117 / 9743a96. Publicado: GitHub/main 1d6603e, CI 35374272493 aprovado, CapRover audita:118. Backup verificado antes do deploy. Smoke aprovado, banco pronto/autenticação obrigatória e HTML/JS/CSS servidos conferidos. Navegador em produção a 390px confirmou login sem menu e sem overflow; fluxo autenticado previamente validado localmente, não repetido em produção.

# 2026-09-17 — Login sem menu inferior
- Codex, codex/login-hide-nav. CSS oculta a navegação mobile enquanto login/cadastro estiver visível; mantém a navegação após fechar a autenticação. Integrado na main local, sem publicação.

# 2026-09-17 — Banco compartilhado para teste local
- Codex, codex/local-production-db. A pedido explícito do usuário, localhost:3000 conectado ao mesmo banco usado pelo app publicado (nome interno audita_staging), por túnel SSH somente em 127.0.0.1:15432. Configuração privada anterior preservada fora do Git. Autenticação exigida; migrações, bootstrap e jobs automáticos locais desativados. Dois testes passaram e health confirmou database.ready=true; auth/me exige login. Arquivos dos volumes remotos não foram copiados/montados. Túnel temporário precisa estar ativo. Nenhum deploy ou alteração de configuração remota.

# 2026-09-17 — Configurações recolhidas
- Codex, codex/settings-collapsed, continuidade da main local. Removido open inicial do grupo Configurações; demais alterações preservadas. Integrado localmente; sem publicação.

# 2026-09-17 — Navegação inferior mobile
- Codex, codex/mobile-bottom-nav, continuidade da main local com agrupamento preservado. Escopo: index.html, app.js e styles.css; barra inferior mobile, configurações e margens. Concluído na main local e localhost:3000, sem publicação. 56 testes pertinentes aprovados. Navegador conferiu larguras 390/620/845, margem lateral zero mesmo com sidebar recolhida, configurações/histórico, Escape, restauração do desktop 1440, IA e campo de mensagem acima da barra. Ícones e capturas conferidos. Fetch confirmou main local=origin/main 67b8519; nenhuma atualização remota pendente.

# 2026-09-17 — Agrupamento da Central de Serviços
- Codex, codex/service-groups, base origin/develop conciliada com main. Escopo: index.html, styles.css e services-catalog.js; grupos por categoria preservando busca, filtros e disponibilidade. Concluído e integrado na main local/localhost:3000. Três testes do catálogo, sintaxe e diff aprovados; navegador validou agrupamento, filtro cruzado Imóveis, busca, estado vazio, limpar filtros e layout 390 px sem overflow. Disponibilidade de Energia/PIS preservada conforme configuração local. Sem commit, push ou deploy.

# Coordenação e passagem de trabalho

### 2026-09-16 — Publicação dos ajustes de interface
- Codex. Publicação autorizada dos textos, envio sem checkbox, retorno no padrão Itaú e filtros alfabéticos. 387 testes aprovados. Sem migrações/configurações; rollback audita:115 / 0878549. Publicado em GitHub/main d3a3bc6, CI 35140589642 aprovado, CapRover audita:116. Smoke de produção aprovado, versão servida d3a3bc6; JS idêntico ao local e ordem dos filtros conferida no HTML servido.

### 2026-09-16 — Ordem dos filtros da Central
- Codex, codex/service-filter-order, base main. Categorias em ordem alfabética, mantendo Todos primeiro; somente ordem dos botões em index.html. Integrado localmente e conferido na porta 3000. Sem publicação.

### 2026-09-16 — Envio sem checkbox e botão de voltar
- Codex, codex/debt-upload-ui, base main com texto local preservado. Escopo: bank-debt.js e teste da interface. Remover checkbox do envio, vincular autorização à ação explícita de analisar e usar secondary-action do Itaú no retorno. Concluído e integrado na porta 3000. Teste da interface validou ausência da checkbox, envio/reenvio da autorização pela ação de analisar e classes de retorno do Itaú; sintaxe e diff aprovados. Sem publicação.

### 2026-09-16 — Explicação do relatório
- Codex, codex/debt-audit-copy, base main. Troca do parágrafo de envio pelo texto solicitado sobre perícia e Relatório Técnico, corrigindo Perdas e destacando o título. Integrado localmente na porta 3000; sintaxe e texto servido verificados. Sem push/deploy.

### 2026-09-16 — Texto dos extratos
- Codex, codex/debt-account-opening, base main. Alteração cancelada pelo usuário: restaurado o texto desde o início do saldo devedor até a presente data. Main local e worktree conciliados; texto confirmado na porta 3000. Produção já mantinha o texto original.

### 2026-09-16 — Publicação da contratação e retorno aos documentos
- Publicação autorizada pelo usuário. Codex; origem codex/debt-back-documents e codex/debt-checkout-layout, integradas na main local. Suíte completa: 387 testes aprovados; diff verificado. Sem migrações ou mudanças de configuração privada; rollback para audita:114 / b3ad461. Publicado: commit 0878549 em GitHub/main, CI 35138954591 aprovado e CapRover audita:115. Health 200, banco pronto, autenticação obrigatória e smoke aprovados; JS/CSS servidos conferidos contra o checkout. Interface de produção com atendimento fictício: novo paywall, Voltar aos documentos, arquivo original preservado e retorno à contratação com mesmos valores. Nenhum pagamento efetuado.

### 2026-09-16 — Voltar aos documentos
- Codex, codex/debt-back-documents, main com layout local preservado. Escopo: navegação de anexos no mesmo atendimento e upload antes da contratação; preservar documentos, invalidar oferta após complemento e manter bloqueios durante análise/pagamento. Concluído e integrado ao main local, disponível na porta 3000. Seis testes pertinentes passaram (navegação, preservação de arquivos, duplicados, invalidação de oferta e bloqueio durante pagamento), sintaxe e diff verificados. Servidor reiniciado e JS servido conferido. Sem push ou deploy nesta tarefa.

### 2026-09-16 — Layout da contratação de dívidas
- Codex, codex/debt-checkout-layout, continuidade main. Escopo: bank-debt.js/css, apresentação da oferta por documentos com classes existentes do paywall Itaú; preservar cálculo, fallback, aceite e checkout. Validação desktop/mobile e integração na porta 3000 pendentes. Sem publicação solicitada nesta tarefa.
- Concluído localmente: resumo separado com saldo cobrado, saldo estimado, economia em reais e data legível; card/faixa/preço/entregas/CTA reutilizam o paywall Itaú. Fallback e condições preservados, sem copiar promoção/parcelamento ou liberação de pagamento do Itaú. Cinco testes pertinentes passaram; navegador isolado validou desktop e 390 px, ausência de overflow, aceite obrigatório e criação do checkout fictício. Integrado na main e porta 3000 reiniciada, JS/CSS e saúde conferidos; banco local continua sem configuração, persistência validada no ambiente isolado. Sem commit/push/deploy.

### 2026-09-16 — Fallback de taxa na análise de extratos
- Publicação e teste via interface autorizados. Suíte completa: 387 testes aprovados, nenhum ignorado. Sem migração, alteração de configuração privada ou dados existentes; rollback para release 113 / d25e627. Backup anterior registrado em 14/09; esta entrega altera apenas código. Deploy e teste com extrato fictício em andamento.
- Publicado e verificado: GitHub/main b3ad461, CI 35135302392 aprovado, CapRover audita:114. Smoke aprovado, health 200/banco pronto/autenticação obrigatória e JS servido idêntico. Pela interface de produção, upload do extrato fictício completo, IA real, progresso 95% e conclusão 100%; juros R$ 2.597,12, saldo entre R$ 12.205,23 e R$ 12.370,32, redução 1,80–3,11%, plano R$ 199 e botão Contratar e continuar. Resultado preservado após reload. BACEN respondeu nessa execução; não foi necessário fallback.
- Interface isolada com o mesmo código: upload do PDF fictício, extração fictícia previamente salva, BACEN offline e aviso de 7,4%; contratação pelo botão, webhook simulado, download do laudo, pedido de advogado, revisão fictícia, cadastro, anexos de identificação/residência, assinatura e conclusão na fila. Downloads de petição, procuração e contrato disparados com sucesso. Não houve pagamento real, aceitação de contratação em produção nem protocolo judicial. Servidor temporário de QA encerrado após validação; versão principal mantida na porta 3000.
- Codex, branch codex/debt-rate-fallback, base main. Escopo: análise de extratos, aviso na oferta e referência no relatório. Usar última referência da mesma modalidade disponível na análise; reserva PF de janeiro/2025 (7,4% a.m.). Preservar validações financeiras e distinguir taxa substituta de taxa oficial do mês. Concluído e integrado na porta 3000. Teste da interface validou ausência da checkbox, envio/reenvio da autorização pela ação de analisar e classes de retorno do Itaú; sintaxe e diff aprovados. Sem publicação.
- Concluído localmente: fallback auditável na oferta e no PDF, sem consultas repetidas após falha nessa execução; uma nova análise tenta BACEN novamente. Nove testes passaram, incluindo contratação fictícia com BACEN offline, recuperação, modalidade incompatível e bloqueios documentais. Extração já salva do extrato fictício completo concluiu com faixa de R$ 12.195,63 a R$ 12.358,98 e redução estimada de 1,89% a 3,18%, sem nova chamada de IA. Integrado na main local; porta 3000 reiniciada e saúde/JS servido conferidos. Banco principal local não configurado; persistência validada com PGlite. Sem commit, push ou deploy. PJ sem taxa válida consultada continua sem reserva; não se aplica taxa PF a PJ.

Registro compartilhado, não histórico de conversas nem bloqueio de arquivos. Cada pessoa deve buscar a versão remota antes de iniciar e publicar sua atualização pelo fluxo de branch/PR. Trabalho não enviado ainda é invisível no outro computador. Para acompanhar trabalho simultâneo, use também a issue/PR ou canal da equipe.

## Em andamento

Central de Serviços integrada à main local por solicitação do usuário; versão unificada em `http://localhost:3000/#central-servicos`. Origem preservada em `codex/central-servicos`. Integração ainda sem commit/push; 362 testes passaram. O trabalho da segunda pessoa não foi informado; isto não significa que esteja parada.

Para uma nova tarefa, acrescente uma entrada sem apagar a do colega:

| Tarefa | Responsável | Branch/base | Escopo e arquivos compartilhados | Estado / próximo passo |
| --- | --- | --- | --- | --- |
| Preencher ao iniciar | Nome informado | Branch / base | Módulo, arquivos, issue/PR | Em andamento, bloqueada ou pronta para revisão |

## Pendências de integração — fotografia em 2026-09-14

- No último fetch, `origin/main` apontava para `f66f4b9`: módulo de dívidas bancárias e entrada do chat geral com conversa vazia.
- A `main` local foi conciliada com essa versão em `b20c8c9`, preservando `9f2dd2f` (PIS/PASEP e chats assistidos) e `5f5e227` (apresentação e rolagem dos chats).
- No início desta documentação, a `main` local estava 3 commits à frente da referência remota. Os pushes anteriores falharam por falta de autenticação HTTPS no Git local. Verificar novamente antes de integrar; não presumir que esses commits chegaram ao colega.
- Próximo passo: configurar a autenticação local do GitHub e enviar os commits pelo fluxo acordado com a equipe, após novo fetch e revisão de eventual divergência. Nunca colocar token neste arquivo.
- Implantação e homologação das integrações externas não foram verificadas nesta atualização. Consulte a documentação de cada módulo para configuração e migrações.

## Últimas entregas

### 2026-09-14 — Integração da versão remota

- Resultado: conciliados os módulos locais de IR/PIS e ajustes de chat com dívidas bancárias, incluindo rotas, migrações, arquivos públicos e imagem Docker.
- Validação: 359 testes passaram, sem falhas nem testes ignorados, com `TEST_PGLITE_MODULE` apontando para o PGlite instalado.
- Ajustes de teste: contexto de autenticação no teste de entrada do chat e reconhecimento de versão variável do CSS.
- Evidência: commit local `b20c8c9`. Envio e implantação pendentes de confirmação.

### 2026-09-14 — Coordenação entre colaboradores

- Resultado: `AGENTS.md` reúne orientações de execução; este arquivo registra a passagem de trabalho; `CONTRIBUTING.md` e `docs/ai-context.md` apontam para ambos.
- Validação: revisão dos caminhos, comandos e consistência das orientações; `git diff --check`.
- Publicação: documentação criada localmente nesta tarefa; ainda sem commit/push próprio.

## Modelo de passagem

Copie uma seção curta por entrega ou interrupção. Mantenha o histórico completo no Git/PR e retenha aqui apenas o contexto útil para a próxima pessoa.

- Data, tarefa, responsável e branch:
- Objetivo e resultado atual:
- Arquivos/contratos afetados e decisões relevantes:
- Validação executada e resultado (ou motivo de não executar):
- Pendências, bloqueio e próximo passo:
- Commit/PR e situação: local, enviado, integrado, homologado ou implantado:

Não incluir dados reais de clientes, links de casos privados, credenciais ou transcrições completas.

## Correção de sobreposição do menu móvel

- Branch de trabalho: `codex/menu-mobile-spacing`; regras CSS compartilhadas sincronizadas também nos checkouts locais Audita (porta 3000) e Central de Serviços (3002), sem substituir outras alterações.
- Reserva de 80px em toda a faixa até 960px; rolagem respeita a área do menu e cabeçalho sticky fica abaixo dela. Abrange os módulos que compartilham o cabeçalho.
- Validado no navegador: IR, PIS/PASEP, Itaú e dívidas bancárias a 845px; IR também a 390px. Menu termina em 56px e cabeçalho começa em 80px, sem sobreposição. `git diff --check` passou. Sem commit/push.

### Complemento — navegação por âncoras

- Responsável: Codex. Ajuste compartilhado em `app.js`, preservando as diferenças dos checkouts.
- Causa reproduzida na Home: a navegação por hash rolava 46,5px e colocava o cabeçalho sob o botão Menu apesar do padding de 80px. A troca de página agora restaura o topo após a rolagem nativa.
- Validação: Home e navegação pela Central a 845px, Home e IR a 390px; Home começa em 80px, abaixo do menu que termina em 56px. Recarregamento e retorno à Home conferidos. 49 testes de interface/catálogo passaram e `git diff --check` passou. Alteração local, sem commit/push.

### 2026-09-14 — Unificação local autorizada

- Responsável: Codex. Integração da branch `codex/central-servicos` na `main` local a pedido do usuário, incluindo IR na Central e ajustes de menu/PIS. Arquivos compartilhados: app.js, index.html, styles.css, server.mjs e Dockerfile. Validação em andamento; sem push/deploy.

- Resultado da unificação: Central com seis entradas, incluindo IR; ajustes existentes de menu, rolagem e encerramento PIS preservados. Referências remotas atualizadas: main local 3 commits à frente, nenhum commit remoto pendente. Servidor reiniciado na porta 3000 com configuração local existente. Suíte completa: 362 testes passaram, nenhum ignorado; git diff --check passou. Sem commit, push ou deploy desta integração.
- Navegador isolado confirmou catálogo com seis entradas, arquivo público e filtro de IR; navegação por clique ficou bloqueada pela tela de login, sem sessão autenticada de teste. Não houve alteração de autenticação.

### Superadmin — identidade visual
- Codex, branch `codex/superadmin-visual`, base main conforme unificação solicitada. Escopo: super-admin.html e super-admin.css; preservar autenticação e ações. Validação em andamento.
- Concluído: tema escuro Audita, marca original, fonte nativa, navegação e formulários, tabelas e indicadores responsivos; foco visível e redução de movimento. Integrado localmente à porta 3000. Dez testes passaram; navegador com dados fictícios validou abas, busca, imagens e ausência de overflow da página a 390px; capturas desktop/celular revisadas. Sem mudanças em autenticação/banco. Sem commit/push.

### Superadmin — celular e janela estreita
- Codex, `codex/superadmin-mobile`, base main local com tema existente. Escopo: super-admin.css/html; tabelas legíveis e navegação compacta, sem mudar ações. Em andamento.
- Concluído e aplicado na porta 3000: menu compacto, registros das três tabelas empilhados com rótulos até 980px, ações visíveis sem rolagem horizontal, campos de 16px no celular. Validado com dados fictícios nas três abas a 320/390/768/980/1100px, captura móvel revisada; 10 testes passaram e diff sem erros. Sem commit/push.

### Superadmin — edição de usuários
- Codex, `codex/superadmin-edit-users`, base main local. Escopo: nome/e-mail da conta em super-admin.js/html/css e serviço, validação e teste; preservar demais dados e permissões. Em andamento.
- Concluído e aplicado na porta 3000: Editar dados abre formulário de nome/e-mail de acesso; servidor valida limites, formato e duplicidade, preservando organização, perfil e status. Restrições existentes para contas superadmin preservadas. Edição exige PostgreSQL disponível. 11 testes passaram, incluindo persistência e autorização; navegador móvel com dados fictícios validou cancelar por Escape, erro de duplicidade, salvar e atualizar lista. Captura revisada; diff sem erros. Sem migração, commit/push ou deploy.

### Superadmin — alteração de senha
- Codex, `codex/superadmin-password`, base main local com edições anteriores. Campo opcional no formulário, hash compatível com login e revogação atômica das sessões; testes com dados fictícios. Em andamento.
- Concluído na porta 3000: nova senha opcional em Editar dados, 8–128 caracteres, campo limpo ao fechar; vazio conserva senha. Hash compatível com login; atualização e exclusão de sessões em uma operação SQL. Sem expor senha/hash na resposta. 11 testes passaram incluindo hash, revogação e preservação das sessões de terceiros; navegador móvel validou envio, limpeza e campo vazio. Sem migração/commit/push.

### Área dos Advogados — layout aprovado
- Codex, `codex/lawyer-workspace`, base main com alterações locais preservadas. Escopo: advogados.html/js/css, menu app.js/index.html, lista da equipe e testes. Layout da primeira imagem; filtros reais, IR respeitando credenciamento, sem inventar prazos ou eventos. Em andamento.

### Correção — Área dos Advogados no shell original
- Codex, mesma tarefa `codex/lawyer-workspace`: usuário corrigiu o alvo visual; imagem orienta organização, não substitui estilo. Página incorporada ao index.html, menu/topbar/auth originais e estilos globais. CSS agora apenas escopado ao módulo; rotas antigas redirecionam para /#advogados. Validação em andamento.
- Concluído: módulo em /#advogados reutiliza diretamente sidebar, topbar, login, classes module/metrics/secondary-action e tokens originais; /advogados redireciona. CSS exclusivo de estrutura e estados, sem body/menu/fontes próprios. Navegador integrado confirmou menu e página; automação com dados fictícios validou busca/filtro/detalhes, bloqueio de cliente, visibilidade do menu e larguras 320/390/768/1100 após transição responsiva. 363 testes passaram, diff sem erros. Origem visual corrigida conforme usuário; imagem apenas organiza conteúdo. Local na porta 3000, sem commit/push/deploy.

### Integração de contas de luz na main local
- Codex: integração autorizada da branch codex/contas-de-luz na porta 3000. Preservar módulo de advogados dentro da estrutura atual, superadmin e Central; migração aditiva e volume privado existente. Validação em andamento.
- Concluído: contas de luz integrado à main local/porta 3000; categoria Energia na Central e fila no módulo atual dos advogados, sem restaurar painel antigo. Banco, chave e volume privado da prévia preservados. Configuração retorna enabled/ready/storageReady=true. Navegador conferiu categoria, abertura e retomada de caso fictício existente com fatura e protocolo; 372 testes passaram, nenhum ignorado, diff sem erros. Referências remotas conferidas (3 commits locais à frente, nenhum remoto pendente). Sem commit/push/deploy; coleta real ANEEL ainda depende de homologação, conforme docs/energy-audit.md.

### Preferência permanente — porta 3000
- Codex, codex/local-preview-policy: registrada em AGENTS.md a entrega de todas as atualizações na main local/porta 3000, preservando trabalho concorrente, dados e configuração. Outras portas são apenas internas. Validação documental e git diff --check; sem alterações na aplicação, commit/push/deploy.

### Porta local padrão — preferência do usuário
- Codex, branch `codex/porta-3000`: todas as entregas locais devem ser disponibilizadas em `http://localhost:3000`. Escopo: comando de desenvolvimento e instruções; preservar as alterações existentes.
- Concluído: `npm run dev` agora usa 3000 por padrão; preferência registrada em `AGENTS.md`. API de energia pronta e arquivos servidos de energia, advogados e aplicação conferidos contra o checkout atual. `git diff --check` passou. Processo 3000 existente preservado; sem commit/push/deploy.

### Contas de luz — acompanhamento após o pedido
- Codex, `codex/energia-acompanhamento`: acompanhamento, mensagem e histórico do cliente agora aparecem somente após preparar o pedido; equipe mantém acesso operacional desde a triagem. Aplicado na porta 3000. Verificados estados antes/depois, retomada com protocolo e equipe; sintaxe JS e diff sem erros. Sem commit/push/deploy.

### Publicação consolidada — 2026-09-14
- Usuário autorizou commit e push da main. Inclui Central, contas de luz, Área dos Advogados no shell original, edição de usuários/senhas do superadmin, ajustes de chat e porta 3000.
- Fetch confirmou ausência de commits remotos pendentes; 372 testes passaram, nenhum ignorado, e git diff --check passou. Configuração privada, credenciais e documentos excluídos. Publicado na main pelo conector GitHub: `545a2c9`, confirmado por fetch e comparação integral sem diferenças. Histórico local anterior preservado em `codex/local-before-publication-20260914`; main local alinhada ao remoto. Deploy não executado nesta tarefa.

### 2026-09-14 — Remover relato opcional de dívidas
- Codex, branch codex/remover-relato-divida, base main atualizada a pedido do usuário. Escopo: bank-debt.js e documentação. Retirar o campo de relato, preservar dados anteriores; validação em andamento.
- Concluído na main local/porta 3000: campo removido; relatos anteriores preservados ao salvar. Teste do fluxo bancário, sintaxe e arquivo servido conferidos. Sem commit/push/deploy. Substituição anterior do texto sobre a proposta ainda aguarda definição do trecho.

### 2026-09-14 — Máscara monetária de dívidas
- Codex, codex/remover-relato-divida, continuação dos ajustes solicitados. Escopo: bank-debt.js e teste de moeda. Formatação BRL nos valores, preservando centavos e limites do servidor.
- Concluído na main local/porta 3000: máscara R$ com milhares e centavos em valores da dívida e revisão. Envio em centavos, limites mínimo/máximo e dados anteriores preservados. Dois testes passaram; sintaxe, diff e correspondência do arquivo servido conferidos. Sem commit/push/deploy.

### 2026-09-14 — Estimativa bancária com BACEN
- Codex, codex/estimativa-bacen, base main atualizada pelo usuário. Escopo: cálculo, serviço bancário, interface, PDF e testes. Taxa oficial mensal, evolução do saldo e pagamentos, premissas explícitas; revisão continua obrigatória. Em andamento.
- Integrado à main local; servidor reiniciado na porta 3000. Cinco testes do módulo passaram; suíte geral 374/376, com duas falhas preexistentes nos testes de IR/PIS (imports no VM), reproduzidas com arquivos inalterados. Navegador com API de atendimento simulada e taxa BACEN real validou formulário, máscara, pagamentos e resultado em desktop/celular; PDF de memória renderizado e conferido. PostgreSQL isolado validou persistência, invalidação e bloqueio de checkout sem revisão. Na porta 3000, interface servida e health ok, mas configuração local não tem banco pronto (ready=false); fluxo autenticado com persistência não validado nesse servidor. Sem commit/push/deploy.

### 2026-09-14 — Publicação da estimativa BACEN
- Codex. Publicação autorizada dos ajustes de dívidas: remoção de relato, máscara BRL e estimativa BACEN. Main remota conferida em 7e96a25; preservar coletores locais e arquivos privados. Vinte testes pertinentes passaram, um teste opcional de fila será executado com PGlite. Duas falhas de testes legados IR/PIS já documentadas não envolvem os arquivos alterados. Publicado: GitHub/main 1d6603e, CI 35374272493 aprovado, CapRover audita:118. Backup verificado antes do deploy. Smoke aprovado, banco pronto/autenticação obrigatória e HTML/JS/CSS servidos conferidos. Navegador em produção a 390px confirmou login sem menu e sem overflow; fluxo autenticado previamente validado localmente, não repetido em produção.
- Publicação concluída: commit f4f3c18 no GitHub/main e imagem CapRover audita:107 em produção. Backup do banco verificado antes do deploy. Smoke de produção passou com banco pronto; index.html e assets bancários conferidos byte a byte com o commit. Consulta BACEN executada dentro do container com cenário fictício, sem persistência, confirmou SGS 25463/03-2025 = 7,27% a.m., saldo R$ 9.691,28 e diferença R$ 5.308,72. API de casos sem login retorna 401. Revisão obrigatória preservada; não houve pagamento nem protocolo real. Teste opcional da fila também passou com PGlite.

### 2026-09-14 — Remover pergunta sobre notificações
- Codex, codex/remover-notificacoes, base main consolidada. Escopo: triagem, compatibilidade com atendimentos antigos, texto da minuta e testes. Preservar respostas históricas. Em andamento.
- Concluído na main local/porta 3000, servidor reiniciado e arquivo servido conferido. Triagem passa de dívida em aberto para juros excessivos; casos antigos aguardando notificações e encerrados por resposta negativa retomam sem perder histórico. Minuta não afirma recebimento de notificações. Cinco testes passaram, incluindo retomada e persistência; sintaxe e diff conferidos. Sem commit/push/deploy.

### 2026-09-14 — Simplificar triagem para dívida em aberto
- Codex, continuação em codex/remover-notificacoes. Remover também percepção de juros excessivos; preservar respostas antigas e retomar casos para detalhes.
- Concluído localmente: confirmação de dívida em aberto avança diretamente para detalhes. Casos antigos aguardando ou recusados pelos critérios removidos retomam sem apagar respostas; ausência de dívida continua encerrando a triagem. Cinco testes passaram; sintaxe/diff e arquivo servido na porta 3000 conferidos após reinício. Sem commit/push/deploy.

### 2026-09-14 — Retirar proposta pessoal
- Codex, continuação em codex/remover-notificacoes. Remover pergunta e texto auxiliar da proposta, resumo e menção na nova minuta; campo histórico opcional, sem apagar registros anteriores.
- Concluído na main local/porta 3000: pergunta, texto auxiliar, resumo da proposta e menção em novas minutas removidos; API aceita ausência do campo e conserva propostas históricas. Cinco testes passaram; sintaxe, diff e arquivo servido conferidos após reinício. Sem commit/push/deploy.
- Publicação autorizada em 14/09/2026: triagem somente com dívida em aberto, remoção da proposta pessoal e compatibilidade com históricos. Cinco testes pertinentes passaram; publicação em andamento.
- Publicado e verificado: commit 52e7d3d no GitHub/main e imagem audita:108 em produção. Backup verificado antes do deploy; atualização concluída, smoke passou com banco pronto, index.html e bank-debt.js conferidos byte a byte com o commit. Sem pagamentos ou protocolos reais.

### 2026-09-15 — Atualização local do GitHub
- Codex, main: recebidos quatro commits por fast-forward, de 7e96a25 até be6d0eb, conforme solicitação do usuário. Sem conflitos ou alterações locais anteriores.
- Servidor reiniciado na porta 3000; HTTP 200. Cinco testes de dívidas bancárias passaram, nenhum ignorado. Código alinhado ao GitHub; apenas este registro é local, sem novo commit/push/deploy.

### 2026-09-15 — Ativação PIS/PASEP e energia em produção
- Codex, configuração CapRover da aplicação audita, autorizada pelo usuário. Habilitados ambos os módulos, chaves próprias de módulo configuradas sem alterar segredos existentes; volume nomeado audita-private-documents montado em /audita-private, com subdiretórios pis e energy. Sem mudança de código ou imagem.
- Após salvar e reiniciar: APIs de ambos com enabled/ready=true; energia com storageReady=true. Safari autenticado confirmou sete serviços na Central. APIs de casos sem sessão retornam 401. Não houve criação de casos, cobrança ou protocolo de teste em produção. Disponibilidade real do leitor e coleta ANEEL não foram exercitadas nesta ativação; backup do novo volume/chaves ainda precisa ser incorporado ao procedimento operacional. Registro local, sem commit/push.

### 2026-09-15 — Sessão ao navegar
- Codex, codex/login-navigation, base main. Corrigir atualização do estado autenticado após login/cadastro e saída; arquivos app.js e teste de regressão. Validação em andamento.
- Concluído localmente na porta 3000: login/cadastro atualizam usuário e permissões antes de liberar navegação; logout limpa estado após sucesso. Dois testes passaram (regressão login/cadastro/navegação/logout e entrada do chat); sintaxe, diff e arquivo servido conferidos. Sem commit/push/deploy; produção ainda requer publicação desta correção.

### 2026-09-15 — Ocultar acompanhamento de energia
- Codex, codex/energy-hide-tracking, base main. Escopo: remover bloco de acompanhamento/providências da interface para cliente e equipe, preservando APIs, dados e restrições. Validação em andamento.
- Concluído na porta 3000: bloco removido da renderização, sem mudanças no servidor. Seis cenários de renderização passaram (cliente/equipe × novo/preparado/protocolado), incluindo ausência dos formulários, análise/PDF preservados e faturas protocoladas sem edição. Sintaxe e arquivo servido conferidos; diff sem erros. Sem commit/push/deploy.

### 2026-09-15 — Publicação das correções de navegação e energia
- Commit e push na main autorizados pelo usuário. Inclui estado de login/cadastro/logout, ocultação do acompanhamento de energia e registros operacionais anteriores. Onze testes pertinentes passaram; sem divergência remota e diff sem erros. Publicação preparada para verificação por fetch; nenhum novo deploy solicitado ou executado nesta tarefa.

### 2026-09-15 — Dívidas: análise documental por IA
- Responsável: Codex; branch codex/dividas-extratos-ia, base main 6912d48. Escopo: entrada por documentos, extração, cálculo rastreável e negociação pós-pagamento. Arquivos compartilhados: bank-debt.js, server.mjs, serviços e testes do módulo. Em desenvolvimento local; sem publicação.

- Resultado: entrada por anexos sem questionário técnico; leitura por IA em segundo plano, validação do JSON e conferência financeira; oferta comparativa com faixa/percentual e preços Itaú autorizados; PDF de negociação após webhook e solicitação judicial para revisão da equipe.
- Validação: sete testes do módulo passaram, incluindo fluxo novo em PostgreSQL isolado, pagamento simulado e isolamento. Leitura real dos dois PDFs executada; os arquivos contêm inconsistências e não liberaram oferta automática. Imagem testada com classificação PJ e taxas impressas. Interface conferida no navegador.
- Integração: arquivos conciliados na main local, porta 3000; sem commit, push ou deploy. Configuração privada preservada. O banco local continua não configurado: a integração persistente foi testada em PostgreSQL isolado, não com atendimentos reais na porta 3000.
- Pendência financeira dos exemplos: confirmar enquadramento da conta, saldo inicial e evolução da dívida/mora; não foi apurado valor definitivo a pagar. Produção permanece na versão anterior.

- Continuação autorizada: separar transcrição visual de classificação, exigir saldos intermediários e reler páginas divergentes. Validar novamente os dois extratos; sem publicação solicitada.
- Melhorias concluídas: transcrição literal por página, classificação determinística pelo sinal, conferência dos saldos intermediários e uma releitura auditável por página divergente. Complementos sem valor não duplicam movimentos; leitura usa modelo próprio do módulo. A releitura não pode reduzir a quantidade de linhas para aparentar reconciliação.
- Validação real: ambos os PDFs reprocessados; crédito anteriormente confundido com juros agora identificado corretamente, juros e mora separados. Cada documento conserva uma divergência no saldo inicial impresso; demais conferências intermediárias fecharam. Oferta permanece bloqueada por lacunas e encargos a esclarecer. Documentos e respostas reais ficam somente em arquivos privados locais, fora do versionamento.
- Entrega local: oito testes pertinentes passaram, incluindo regressão de sinais/omissões e integração em PostgreSQL isolado; diff sem erros. Alterações conciliadas na main local e servidor da porta 3000 reiniciado e respondendo HTTP 200. Banco da porta 3000 ainda não configurado. Sem commit, push ou deploy nesta continuação.

### 2026-09-15 — Publicação da análise documental de dívidas
- Codex; publicação de todo o trabalho consolidado autorizada pelo usuário. Suíte completa: 380 testes passaram, nenhum ignorado; corrigida compatibilidade CRLF dos testes IR/PIS. Inclui navegação/energia já na main. Sem migração nova de banco. Imagem anterior de produção 108, commit 52e7d3d; backup verificado documentado em 14/09. GitHub e implantação em andamento.
- Publicado: GitHub/main 0a6ddda, CI 35011157217 concluído com sucesso; CapRover audita:109. Smoke passou com banco pronto, autenticação exigida e versão correta; bank-debt.js, app.js e energy-audit.js conferidos contra o commit. API de atendimentos sem sessão retorna 401. Porta 3000 reiniciada na mesma versão. Nenhuma cobrança ou protocolo real executado.

### 2026-09-15 — Validação de interface de dívidas
- Codex, codex/debt-ui-validation, base main 5e514a8. Teste de upload dos dois PDFs em produção e jornada pós-pagamento em banco isolado, sem cobrança/protocolo real. Em andamento.
- Concluído: upload pela interface dos dois PDFs em produção, análise concluída e recuperada após reload; downloads dos originais com hashes idênticos. Juros/mora e crédito conferidos; oferta bloqueada pelas lacunas documentais esperadas. No banco isolado, interface validou oferta, aceite, confirmação fictícia, negociação/PDF, pedido de advogado, cadastro, assinatura, bloqueio por anexos faltantes e conclusão/fila com três PDFs finais. Checkout Stripe real e protocolo judicial não executados. Pendências de apresentação: moeda no PDF de negociação, texto de pagamento pendente e identificação do arquivo nos avisos de página. Sem mudanças de aplicação ou novo deploy.

### 2026-09-15 — Simplificação do envio de extratos
- Codex, codex/debt-simple-upload, base main 5e514a8. Escopo: bank-debt.js, serviço/testes de dívidas e documentação. Orientação aprovada para extratos desde o início do saldo devedor até a presente data; envio/análise em uma ação, estados de processamento/complemento separados, autorização reaproveitada e arquivos repetidos tratados sem apagar histórico.
- Contratação conferida: independe da assinatura geral; só aparece com faixa de cálculo disponível ou revisão da equipe. Falta de dados explica a pendência e mostra a ação para complementar. Achados distinguem juros identificados de redução e identificam o arquivo de origem.
- Validação: nove testes de dívidas passaram; interface isolada com dados fictícios validou envio, processamento sem outro campo de anexo, complemento, reenvio do mesmo arquivo e passagem automática ao plano Faixa 1 / botão Contratar e continuar. git diff --check passou. Integrado ao checkout principal/main, porta 3000 reiniciada, saúde OK, arquivo servido conferido e API protegida (401). Jornada persistente testada com PostgreSQL isolado; banco local da 3000 não está configurado. Sem cobrança real, commit/push ou novo deploy nesta alteração; produção permanece na publicação anterior.

- Publicação autorizada em 15/09: envio das melhorias consolidadas ao GitHub/main e CapRover audita. Suíte geral com 380 aprovações e teste opcional da fila executado separadamente com PostgreSQL embarcado. Sem alteração de esquema ou configuração privada; rollback pela imagem anterior 109. Backup recente registrado em 14/09. Implantação em andamento.
- Publicado e verificado: código 3698f7e no GitHub/main; CI 35017745449 concluído com sucesso. CapRover concluiu o build; produção responde com o SHA completo desse commit, banco configured/ready=true, smoke aprovado, API de casos protegida (401) e bank-debt.js idêntico ao publicado. Navegador confirmou o novo texto e o botão Enviar extratos e analisar. Os 381 testes foram cobertos somando suíte geral e execução do teste opcional. Checkout persistente autenticado não foi repetido em produção nesta publicação; jornada validada anteriormente em ambiente isolado. Configuração e dados preservados.

### 2026-09-15 — Texto de início da perícia
- Codex, codex/debt-report-copy, base main. Escopo: substituir a orientação de cobrança recente em bank-debt.js pelo texto solicitado para perícia e emissão de relatório. Ajuste textual local em andamento.
- Concluído: texto substituído conforme solicitado, sem mudar cálculo ou regras de contratação. Sintaxe e diff verificados; integrado à main local e arquivo servido na porta 3000 conferido. Sem commit/push/deploy nesta alteração.

### 2026-09-15 — Central de Serviços em ordem alfabética
- Codex, codex/catalog-alphabetical, base main. Escopo: index.html e services-catalog.js; ordenar cards e incluir dois laudos em desenvolvimento. Preservar ajuste local de bank-debt.js. Em andamento.
- Concluído localmente: nove cards ordenados alfabeticamente; laudos de análise de exames e atualização de processos judiciais exibidos como Em desenvolvimento, sem link de contratação. Filtro Laudos e contador de resultados incluídos. Três testes existentes passaram; ordem, quantidade e status conferidos no HTML servido em localhost:3000. Diff sem erros. Sem commit/push/deploy; ajuste anterior de bank-debt.js preservado.

### 2026-09-15 — Indicador de análise em andamento
- Codex, codex/debt-loading, base main com texto local preservado. Escopo: bank-debt.js, bank-debt.css e teste de apresentação. Reutilizar loading do Itaú apenas durante análise, respeitando redução de movimento.
- Concluído: indicador circular do Itaú exibido enquanto analysisPending estiver ativo e removido no resultado; sem porcentagem simulada. Animação desativada com prefers-reduced-motion. Teste de apresentação passou e assets na porta 3000 conferidos. Integrado à main local, preservando catálogo e texto anteriores. Sem commit/push/deploy.

### 2026-09-15 — Conciliação dos extratos e revisão assistida
- Codex, codex/debt-review-fallback, base main com texto/loading locais preservados. Escopo: análise e serviço de dívidas, bank-debt.js e testes; conciliar continuidade comprovável entre documentos e disponibilizar solicitação de revisão antes da contratação. Sem mudança de esquema. Em andamento.
- Implementado: conciliação de fronteira com evidência e auditoria, identificação do valor divergente e revisão assistida persistente priorizada na lista da equipe. Cliente avança sem anexo novo; equipe preserva extração ao conferir dados e publica revisão para liberar contratação. Complementos opcionais, consulta automática e loading preservados.
- Validação: dez testes de dívidas passaram, incluindo isolamento, idempotência, bloqueio de cobrança antes da revisão e revisão seguida de checkout fictício. Reexecução local das extrações reais conciliou o saldo entre documentos, manteve juros/mora e não inventou redução. Interface isolada confirmou avanço sem novo anexo e solicitação persistida. Integração na main local, preservando catálogo e texto anteriores; sem commit/push/deploy.
- Porta 3000 reiniciada com o código integrado e saúde OK; bank-debt.js servido confere com o arquivo local. Banco local permanece sem configuração, portanto a persistência e o avanço completo foram validados em PostgreSQL isolado, não em atendimentos reais locais ou de produção.

### 2026-09-15 — Publicação consolidada de catálogo e revisão
- Codex; publicação de todas as alterações funcionais pendentes autorizada pelo usuário. Inclui cards alfabéticos e dois laudos em desenvolvimento, texto de perícia, loading, conciliação e revisão assistida. 382 testes aprovados, nenhum ignorado. Sem migração ou mudança de configuração privada. Rollback para código 3698f7e; backup recente registrado em 14/09. Push e deploy em andamento.
- Publicado e verificado: código 7a25f62 no GitHub/main, CI 35031308599 concluído com sucesso e CapRover audita:111. Smoke aprovado com banco pronto e autenticação exigida; index.html, bank-debt.js, bank-debt.css e services-catalog.js conferidos contra os arquivos publicados. Navegador autenticado confirmou nove cards alfabéticos, dois laudos em desenvolvimento, texto novo e botão Avançar para revisão da Audita no atendimento existente. Nenhuma cobrança, reanálise ou solicitação real foi criada como teste. Versão consolidada continua disponível na porta 3000. Backup anterior preservado e sem migração.

## 2026-09-16 — Recuperação do banco (em andamento)
- Responsável: Codex; branch: codex/database-recovery; base: main (correção de produção).
- Escopo: server.mjs, teste de recuperação e saúde; investigar DNS do banco sem alterar dados.
- Evidência: produção retornava ENOTFOUND no banco e health 200 incorreto. Nenhuma publicação desta correção ainda.
- Validação local: 383 testes passaram (incluindo queda DNS, recuperação, nova queda e health 503/200).
- Logs do PostgreSQL: reinício 2026-09-16 00:29 UTC, aceitando conexões em seguida; causa externa do reinício ainda não identificada.
- Concluído: correção 2834f28 enviada ao GitHub/main; CI 35129132422 concluído com sucesso.
- Produção: CapRover audita release 112, versão 2834f28748567b6fa3d4d966c31b6ce05b276564; health 200 com database.ready=true, auth obrigatória e smoke-production aprovado.
- A restauração inicial por reinício somente da aplicação confirmou que o banco já estava disponível. Nenhum volume, dado ou credencial alterado. Motivo do reinício externo do PostgreSQL não identificado pelos logs disponíveis.
- Local: main conciliada e servidor reiniciado em localhost:3000; configuração local continua sem DATABASE_URL. Interface de produção carrega e solicita login; fluxo autenticado de envio não foi repetido nesta correção.

## 2026-09-16 — Velocidade e progresso da análise (concluído localmente)
- Responsável: Codex; branch codex/debt-analysis-speed, continuidade da versão main do módulo.
- Escopo: extração com concorrência limitada, cache privado por documento/página, progresso persistido e porcentagem na UI; arquivos bank-debt e testes do módulo.
- Preservar datas entre páginas, sinais, reconciliação e bloqueios financeiros. Validar em documentos fictícios e conciliar na main local/porta 3000. Publicação separada.
- Implementado: três chamadas simultâneas por instância, prompt reduzido, cache privado de páginas/resultados por SHA/modelo/versão e progresso persistido. Datas dependentes de outra página recebem releitura restrita. UI mostra páginas, porcentagem e conferência, atualizando a cada 3 segundos.
- Validação: 386 testes passaram. Concorrência global limitada a três, ordem preservada, zero chamadas extras com cache completo e somente página faltante após falha. Cache não aparece na API do cliente; isolamento e revisão otimista mantidos. Navegador com documento/IA fictícios confirmou conclusão e contratação, sem consumo de tokens reais.
- Interface: porcentagens intermediárias 20% e 40% confirmadas com a barra visível; recarregar preserva o progresso. Alterações conciliadas na main local, preservando mudanças dos coletores. Sem commit, push ou deploy desta melhoria. Migração aditiva pendente em produção; banco local principal continua sem DATABASE_URL.
- Porta 3000 reiniciada; JavaScript e CSS servidos conferem com os arquivos integrados. Fluxo persistente validado em PostgreSQL isolado com dados fictícios, não com atendimentos reais.

### 2026-09-16 — Fluxo direto de extratos
- Codex, codex/dividas-fluxo-direto: retirada a tela de revisão do cliente. Insuficiência retorna ao envio inicial com aviso; históricos preservados. Oferta exibe juros extraídos. Integração local preserva o progresso da análise da tarefa paralela. Validação em andamento.

- Concluído na main local/porta 3000: aviso e retorno automático ao envio inicial, juros visíveis na oferta e laudo após pagamento. Alterações de progresso/cache da tarefa paralela preservadas. Nove testes passaram; navegador isolado com API fictícia validou os três estados usando o JS servido pela porta 3000. Arquivo servido confere com o checkout; diff sem erros.
- PDFs fictícios completo/incompleto em output/pdf, renderizados e conferidos. Leitor OpenAI real extraiu R$ 2.597,12 em juros; extrato completo conciliou, incompleto bloqueou. BACEN real retornou HTTP 503; comparação positiva validada apenas com taxa fictícia de teste. Local segue sem banco configurado; nenhum pagamento real, push ou deploy.

### 2026-09-16 — Publicação de velocidade e fluxo consolidado
- Codex; publicação completa autorizada pelo usuário. Inclui leitura paralela/cache/progresso e fluxo direto integrado. 386 testes passaram no conjunto, diff verificado. Coluna extraction_cache aditiva e idempotente; documentos e configurações privadas preservados. Push e deploy em andamento; rollback de código disponível na release 112.
- Publicado: GitHub/main d25e627, CI 35132696243 aprovado, CapRover audita:113. Saúde HTTP 200 com banco pronto e autenticação obrigatória; smoke-production aprovado. bank-debt.js e bank-debt.css servidos em produção conferem com o checkout consolidado. Nenhum documento de cliente, pagamento ou nova análise real foi enviado nesta publicação.

### 2026-09-16 — Saldo devedor e contratação livre
- Codex, codex/debt-free-flow, base main. Saldo explicitamente devedor normalizado sem alterar sinais de transações; cache de extração renovado. Contratação de dívidas liberada sem Stripe, evento específico e valor pago zero; demais módulos preservados. Concluído localmente: 388 testes aprovados, incluindo saldo textual, sinal contraditório, contratação sem chamada Stripe e download liberado. Integrado na main e porta 3000; sem push/deploy.
- Publicação autorizada. Sem migração; rollback para audita:116 / d3a3bc6. GitHub e deploy em andamento.
- Publicado: GitHub/main 9743a96, CI 35142522371 aprovado e CapRover audita:117. Smoke, banco e JS servido conferidos. Reanálise real do PDF fictício de juros elevados concluiu e abriu contratação: saldo cobrado 30.925,80; estimado 12.205,23–12.370,32; redução 60–60,53%. Tela informa sem cobrança nesta etapa. Liberação sem Stripe validada por teste integrado; não houve aceite contratual nem pagamento real pela interface de produção.
