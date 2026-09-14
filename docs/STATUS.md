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
- Fetch confirmou ausência de commits remotos pendentes; 372 testes passaram, nenhum ignorado, e git diff --check passou. Configuração privada, credenciais e documentos excluídos. Commit consolidado preparado; envio deve ser confirmado pelo hash remoto. Deploy não executado nesta tarefa.
