# Coordenação e passagem de trabalho

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
- Codex. Publicação autorizada dos ajustes de dívidas: remoção de relato, máscara BRL e estimativa BACEN. Main remota conferida em 7e96a25; preservar coletores locais e arquivos privados. Vinte testes pertinentes passaram, um teste opcional de fila será executado com PGlite. Duas falhas de testes legados IR/PIS já documentadas não envolvem os arquivos alterados. Publicação em andamento.
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
