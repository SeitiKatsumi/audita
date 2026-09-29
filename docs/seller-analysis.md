# Análise documental do vendedor

## Fluxo

1. CPF, nome, dados exigidos pelos portais e até cinco CNPJs relacionados. Seleção de fontes, estimativa de custo e confirmações de base legal e processamento pela OpenAI.
2. Coletores existentes reúnem PDFs e dados, mantendo a identificação, alcance e status de cada fonte. Falhas não são resultados negativos. Os coletores e seus limites continuam descritos em `seller-document-coverage.md`.
3. Ao encerrar a coleta, a análise inicia no servidor. Cada fonte é lida separadamente; texto digital evita reenviar PDF. Uma página sem texto suficiente aciona leitura visual do arquivo inteiro. Limites: 20 MB/PDF, 180 mil caracteres por fonte e 300 fontes; excedentes são lacunas explícitas.
4. Resultado com apontamentos, citações, providências, lacunas e PDF. A consulta pode ser retomada pelo histórico do módulo, inclusive após fechar a sessão do navegador. O botão de retorno permite nova consulta sem apagar a anterior.

## Leitura e limites

Reutiliza a chave privada OpenAI e o modelo já configurado (`AUDITA_SELLER_AI_MODEL` pode sobrescrever `AUDITA_CHAT_MODEL`). `AUDITA_SELLER_AI_ENABLED=false` desliga novas leituras sem apagar relatórios. A API de cobertura informa `aiReady`; indisponibilidade é detectada antes de iniciar consultas com análise solicitada.

Usa [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), validação Zod e verificação literal de citações, valores e datas em textos/JSON. Respostas truncadas, recusadas ou sem evidência não são publicadas como leitura concluída. Leituras visuais são identificadas e precisam de conferência do original. A IA não garante descoberta de toda pendência, autenticidade ou interpretação jurídica: falhas, homônimos, divergência de identidade e fontes não consultadas permanecem explícitos. Processo não implica dívida ou culpa, e vínculo societário não transfere automaticamente dívida empresarial à pessoa física.

Não há score de crédito, decisão automática de aprovar compra ou soma de valores entre fontes. Matrícula, ônus, IPTU/condomínio do imóvel, poderes de representação e demais diligências fora do levantamento ficam no aviso de alcance. Cada apontamento informa a fonte; o PDF não é certidão oficial.

## Persistência e proteção

Sem nova tabela/migração. `audita_audits.request_payload.sellerReview` armazena estado, checkpoints e relatório, com consentimento em `sellerAiConsent`; `subject_name` guarda o nome já fornecido. O padrão de acesso privado dos resultados existentes é preservado. `seller-documents.service.mjs` conserva o retorno estruturado relevante (limitado), removendo chaves de credenciais, comprovantes/base64 e documentoConsultado; validação de identidade precede armazenamento.

GET/POST `/api/seller-analysis/:id/review` e GET `/api/seller-analysis/:id/report.pdf` exigem tenant e usuário exatos. POST exige JSON de mesma origem. Não aceita texto, caminho ou relatório arbitrário enviado pelo navegador. PDFs lidos devem estar no diretório privado e pertencer a uma consulta do mesmo usuário/tenant, inclusive em cache. Download usa `private, no-store`. PDFs gerados a partir do relatório salvo, sem rota estática ou arquivo público.

Uma atualização atômica no PostgreSQL concede a execução por consulta, com token e heartbeat. Duas fontes por análise são processadas simultaneamente; o limite é por análise, não global. Após 3 minutos sem heartbeat, a interface permite retomada explícita. Leituras concluídas são reaproveitadas; uma retomada não executa coletores nem cobra consultas novamente. A guarda global de throughput pode ser adicionada se houver volume concorrente que justifique uma fila.

## Validação reproduzível

- `node --test test/seller-review.test.mjs test/seller-analysis-api.test.mjs test/seller-analysis-ui.test.mjs test/seller-documents.test.mjs`.
- `AUDITA_BASE_URL=http://localhost:3000 node scripts/check-seller-review-ui.mjs`: interface e assets locais, rotas reais extraídas do servidor, serviços reais e PostgreSQL PGlite isolado; provedores fictícios. Não usa banco nem consultas de produção. Testa entrada, coleta, progresso, análise, lacunas, PDF, recarga, histórico e retorno em desktop/celular.
- PDF fictício em `output/pdf/analise-vendedor-ficticio.pdf`; capturas e download da interface em `output/playwright/`. Artefatos de teste privados/ignorados.
- A validação com fontes reais pagas é separada da validação do fluxo. O teste real de OpenAI usa somente dados fictícios e não valida precisão sobre todos os modelos de certidão.
