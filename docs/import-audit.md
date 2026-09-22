# Auditoria assistida de importação

Entrada pública: `/#auditoria-importacao`, na Central de Serviços. Login sob demanda;
retomada pelo identificador `?importCase=UUID#auditoria-importacao`.

Interface em chat guiado: mensagens da assistente, respostas do solicitante e
somente a etapa atual aberta. Produtos conferidos um por vez, com Invoice e
Packing List lado a lado (empilhados no celular), associação explícita,
correções e exclusão justificada de itens não pertinentes.
NCMs/fontes ficam em detalhes, com revisão fiscal e relatório preservados.
Não é conversa livre: as respostas usam os campos e ações da etapa, sem nova
chamada de IA para mensagens de navegação. Salvar, anterior e próximo persistem
o rascunho documental. Recarregar recupera a última gravação; edições ainda não
salvas ficam somente na tela. A confirmação final reconhece as pendências.

Somente a mensagem atual fica no chat principal. “Ver conversa anterior” abre
um dialog nativo com respostas, documentos e fontes anteriores (Escape fecha
e devolve o foco). Cabecalho compacto e altura natural eliminam a altura minima
extra do shell. Limites e historico permanecem acessiveis em detalhes.
Em telas pequenas, zoom ou formularios extensos, a rolagem necessaria continua
permitida para nao cortar campos; a barra nao e simplesmente escondida.

## Fluxo e limites

1. Solicitante autoriza o processamento pela OpenAI/equipe e envia Invoice,
   Packing List ou ficha técnica (PDF, PNG, JPEG, XML). Limite: quatro arquivos,
   10 MB cada, 20 MB por atendimento e 30 produtos na leitura conjunta.
2. A integração existente transcreve/traduz cada linha com documento, página e
   linha quando identificáveis. Originais são imutáveis; correções ficam à parte.
   Código único coincidente, sem fabricante/modelo conflitante, apenas sugere
   um vínculo; o usuário confirma ou associa manualmente. Não há busca por
   semelhança, soma de embalagens ou conversão de unidades/moedas. Ausências e
   separadores ambíguos são não verificáveis. Decimais são comparados como strings
   canônicas, sem ponto flutuante. O formato confirmado é por linha, sem separador
   de milhares. Totais do documento nunca são distribuídos entre produtos.
   Valores conflitantes exigem escolha de origem e justificativa; ausência de
   preço no Packing List não é erro. Ficha técnica só complementa características.
   O resumo antecede a pesquisa e não chama pendências reconhecidas de verificadas.
3. NCMs sugeridas são confrontadas com o download público do Classif/Siscomex.
   A descrição inclui a hierarquia; a tabela é a vigente na consulta, não uma
   validação histórica. Pesquisa de benefícios usa fontes oficiais citadas;
   falha na pesquisa não significa inexistência de benefício.
4. Somente `super_admin` pode revisar: selecionar candidatos, informar fontes,
   atos, condições, data da operação, valor aduaneiro e alíquotas de II/IPI.
   Esse papel já existente não é concedido automaticamente a outros usuários.
   Candidatos insuficientes exigem corrigir os dados e refazer a pesquisa;
   não se deve escolher uma classificação inadequada para liberar o cálculo.
5. Cálculo determinístico em centavos: II = valor aduaneiro × taxa;
   IPI = (valor aduaneiro + II + demais parcelas informadas pelo revisor) × taxa.
   Referência e cenário possuem taxas independentes. Arredondamento comercial.
   Não cobre tributos específicos, regimes especiais, ICMS, PIS/Cofins, taxas
   ou custo total. Diferença simulada não é economia garantida.

PDF preliminar/revisado, fontes e histórico são recuperados do atendimento.
Descrições originais permanecem no atendimento/documentos; o PDF com fonte
padrão substitui caracteres não latinos por `?` e informa essa limitação.
Alteração de produtos/documentos invalida sugestões e revisão atuais, preservando
o histórico das extrações, conferências, pesquisas e revisões. Não há registro DI/Duimp, monitoramento diário,
pagamento, integração Siscomex autenticada ou classificação fiscal definitiva.

## Configuração e persistência

- Reutiliza `AUDITA_CHAT_API_KEY_SECRET` / `AUDITA_OPENAI_API_KEY` / `OPENAI_API_KEY`
  e `AUDITA_CHAT_MODEL`, como a integração existente. Sem nova chave ou provedor.
- `DATABASE_URL` do ambiente e migração aditiva `db/import-audit.sql`.
  O inicializador existente a executa apenas com `AUDITA_AUTO_MIGRATE=true`.
  Banco compartilhado/produção requer aprovação e migração controlada;
  não habilitar auto-migração em localhost ligado à produção.
- Criptografia AES-256-GCM com `AUDITA_IMPORT_ENCRYPTION_KEY`, ou a chave
  `AUDITA_IR_ENCRYPTION_KEY` existente quando omitida. Não trocar a chave após
  criar atendimentos sem recriptografar os registros. Nunca colocar segredo no Git.
- Duas tabelas: `audita_import_cases` e `audita_import_documents`. Payload e
  arquivos criptografados no PostgreSQL, sem diretório público de documentos.
  IDs, titular, tenant, status, tamanho, hash e datas são metadados em claro.
- Conferência documental usa `payloadVersion: 2`, `extraction` (originais e totais),
  `documentCheck` (linhas corrigidas, vínculos, exclusões, comparações, escolhas e
  justificativas), `previousDocumentChecks` e `previousResearch` no mesmo payload
  criptografado. A ação existente `products` recebe `documentCheck` e `confirmed`.
  Não há rota paralela, tabela nova ou migração nesta etapa. Atendimentos antigos
  mantêm a ação/formulário anterior e são identificados como “sem comparação
  documental”; `value` legado não vira preço unitário. Só uma nova extração
  explícita habilita comparação documental em um atendimento anterior.
- `/api/import-audit/config` informa disponibilidade sem expor segredos.
  Interface bloqueia recebimento se o armazenamento seguro não estiver pronto;
  leitura e pesquisa requerem também a configuração OpenAI no processo.

Solicitante acessa somente seus atendimentos (tenant **e** usuário); equipe
super_admin tem acesso global explícito e fila de revisão. Downloads exigem
sessão e a mesma autorização. Escritas verificam origem e revisão otimista;
processamentos têm reserva de 15 minutos, evitando resultado antigo sobrescrever
uma operação mais recente. Sem worker novo: chamadas OpenAI executam fora da
transação, com timeout e sem retries automáticos; interrupção libera nova
tentativa depois de expirar a reserva. Arquivos não relacionados devem ser evitados.

Documentos são enviados à OpenAI somente após consentimento e ação explícita,
com `store:false`. Apenas códigos NCM públicos entram na pesquisa web, não
documentos ou dados de clientes. Conteúdo de documentos é tratado como dado
não confiável; resposta validada antes de persistir e texto escapado na tela.
Não há rotina automática de exclusão: definir retenção com a operação antes
de uso real. Exclusão deve ser controlada e incluir documentos, caso e backups.

## Verificação isolada

`node --test test/import-audit.test.mjs test/import-document-check.test.mjs` usa PostgreSQL embarcado e IA simulada,
sem credenciais ou documentos reais. Com o servidor local ativo,
`node scripts/check-import-ui.mjs` testa visitante/login/retomada, upload,
conferência, pesquisa, revisão, relatório e layout 1440/390 com o serviço real
em banco isolado e IA simulada. `AUDITA_BASE_URL` seleciona a porta local.
Inclui precisão decimal, códigos duplicados, campos ausentes, vínculos manuais,
origens inválidas, falha de IA sem perda, isolamento e compatibilidade legada.
A precisão da extração real não é validada por mocks: requer amostras autorizadas
e configuração privada existente. Os testes não chamam OpenAI nem banco compartilhado.

Fontes de referência: [download oficial NCM](https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias/download-ncm-nomenclatura-comum-do-mercosul),
[legislação Ex-tarifário](https://www.gov.br/mdic/pt-br/assuntos/sdic/ex-tarifario/legislacao).
