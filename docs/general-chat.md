# Chat geral generativo

Implementação local de 30/09/2026. O chat conversa e usa ferramentas gerais; serviços Audita são apenas links para seus módulos. Não coleta dados para atendimento, emite certidões, cria casos ou contrata serviços. Voz fora do escopo.

## Modelos e ferramentas

- Escolha sempre automática: `gpt-6-luna` para mensagens simples, `gpt-6.1-sol` para documentos, cálculos, pesquisa e criação. Não há seletor; a API também normaliza o modo para automático.
- Variáveis opcionais: `AUDITA_CHAT_MAIN_MODEL`, `AUDITA_CHAT_QUICK_MODEL`, `AUDITA_CHAT_DOCUMENT_MODEL`, `AUDITA_CHAT_IMAGE_MODEL`. Padrão de imagens: `gpt-image-2.5-flare`.
- Responses API com `web_search`, `code_interpreter` em contêiner hospedado e `image_generation`. Nenhuma ferramenta executa código ou fluxo no servidor Audita. Saudações e pedidos simples de tradução/revisão dispensam ferramentas.
- Respostas transmitidas por SSE, com indicação animada da atividade real e fontes. Copiar e tentar novamente usam icones discretos com rotulos acessiveis; nao ha editar mensagem nem nome do modelo. Durante a execucao, parar substitui enviar no compositor, inclusive ao retomar uma conversa em andamento. A animacao respeita reducao de movimento. Geração de PDF, HTML, CSV, XLSX, DOCX, PPTX e imagens conforme pedido; só há download quando a ferramenta efetivamente entrega um arquivo.
- Anexos sem limite de quantidade ou páginas: PDF, PNG/JPEG, TXT/MD/CSV/JSON/HTML, DOCX, XLSX e áudio WAV/MP3/WEBM/M4A/MP4 (25 MB por áudio, transcrito para resposta textual). O envio inicia a leitura sem confirmação adicional por arquivo. Mantida validação de conteúdo e 50 MB/arquivo; texto até 2 MB e Office expandido até 128 MB. PDFs são lidos integralmente em partes de até 20 páginas, com numeração original preservada e validação de completude de cada parte. Páginas são registradas como uso, sem cota ou desconto; mensagens continuam vinculadas ao plano. PDFs com mais de 20 páginas e lotes acima de 40 MB usam originais no code_interpreter hospedado, sem inflar o input de arquivos da resposta. Falha em qualquer parte não publica leitura completa.

## Persistência e segurança

`general-chat.js` usa APIs autenticadas de conversa, documento e arquivo. Histórico/artefatos ficam sob `getPdfRoot()/chat`, no volume privado de PDFs existente, com criptografia autenticada vinculada a tenant, usuário e identificador. Resultados de reserva também são criptografados, preservando replay sem outra chamada. A migração documental existente remove o teto de 20 páginas da restrição SQL, preservando os registros criptografados. Em instalações com migração automática desativada, aplicar essa migração antes da publicação.

Chave: `AUDITA_CHAT_DOCUMENTS_ENCRYPTION_KEY`, com fallback para IR, importação e perfil. Preservar a chave e o volume nos reinícios/deploys. A ausência de chave bloqueia armazenamento; não há fallback em texto puro. Anexos originais continuam criptografados na tabela documental existente. Arquivos Office enviados temporariamente à OpenAI são removidos após a resposta; `store:false` é usado em Responses.

Anexos e páginas web são tratados como dados não confiáveis. HTML da resposta é escapado; prévias HTML usam iframe com sandbox e scripts/envios/rede desabilitados. Artefatos são acessíveis apenas ao dono, com `no-store`, `nosniff` e download de conteúdos ativos. Arquivos privados não entram na lista estática.

Histórico acessível em desktop e celular, incluindo importação do histórico local vinculado à conta. Excluir conversa remove o histórico e os artefatos gerados ligados às mensagens retidas; não equivale a apagar anexos originais ou registros contábeis de consumo.

## Limites e recuperação

Máximo de 100 mensagens salvas/conversa; últimas 40 enviadas ao modelo, com até 12.000 caracteres por mensagem histórica. Nova mensagem até 5.000 caracteres. Texto anexo até 80.000 caracteres por arquivo no contexto. Resposta até 10.000 tokens, oito chamadas de ferramenta e oito artefatos de até 20 MB.

Reservas e cotas de mensagens permanecem. Uma resposta concluída consome uma mensagem; páginas da leitura inicial são registradas sem limite ou desconto de saldo. Documentos textuais têm leitura local; PDF/imagem/Office têm leitura inicial Luna e o original é disponibilizado ao modelo para a tarefa. Prompts estáveis aproveitam cache do provedor; tokens e tipos de ferramenta entram no registro de uso. As tarifas novas e as cobranças específicas de ferramentas precisam de cadastro no painel para apuração financeira completa; mensagens não representam custo fixo de inferência.

Sair/recarregar não cancela a tarefa: ela continua neste processo e o histórico permite acompanhar o resultado. Parar cancela explicitamente apenas a tarefa do dono. Falhas conhecidas liberam a reserva; resultado persistido com conclusão contábil incerta permanece reservado para reconciliação, sem repetir automaticamente. Após reinício do servidor, tarefa em execução aparece interrompida; não há fila durável que retome chamadas automaticamente. Exclusão de conversa em execução é bloqueada.

Uma instância de aplicação é o limite atual do controle de tarefas em memória e do volume. Para múltiplas réplicas, usar armazenamento compartilhado e coordenação durável antes de escalar.

## Validação

`node --test test/general-chat.test.mjs test/chat-documents.test.mjs test/chat-request.test.mjs` e `node scripts/check-general-chat-ui.mjs` usam armazenamento temporário/PGlite e SDK fictício. O segundo serve a interface e os handlers reais; valida desktop/mobile, modelos, SSE, anexos, downloads, sandbox, fontes, imagem, links sem fluxo, cancelamento, retomada e isolamento. `AUDITA_UI_ASSET_ROOT` permite repetir com os arquivos consolidados da main; `--serve` disponibiliza a mesma fixture para validacao pelo navegador conectado, sem lancar outro navegador.

Chamadas reais de teste, com dados fictícios e sem banco de produção: modelos Sol/Luna, busca web, geração/edição de imagem, Word/Excel, cálculo e PDF/HTML/CSV. PDF comparativo renderizado e conferido. Publicação no GitHub/produção é uma etapa separada.

## Entrega da reunião de 08/10

Consulte [meeting-20261008.md](meeting-20261008.md) para decisões, testes, limite estimado de processamento e dependências externas. Transcrição usa AUDITA_CHAT_AUDIO_MODEL (padrão gpt-transcribe), com registro de duração e custo. Sem voz em tempo real.
