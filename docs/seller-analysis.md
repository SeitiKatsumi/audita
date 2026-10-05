# Análise documental do vendedor

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

Sem nova tabela/migração. `audita_audits.request_payload.sellerReview` armazena estado, checkpoints e relatório, com consentimento em `sellerAiConsent`; `subject_name` guarda o nome já fornecido. O padrão de acesso privado dos resultados existentes é preservado. `seller-documents.service.mjs` conserva o retorno estruturado relevante (limitado), removendo chaves de credenciais, comprovantes/base64 e documentoConsultado; validação de identidade precede armazenamento.

GET/POST `/api/seller-analysis/:id/review` e GET `/api/seller-analysis/:id/report.pdf` exigem tenant e usuário exatos. POST exige JSON de mesma origem. Não aceita texto, caminho ou relatório arbitrário enviado pelo navegador. PDFs lidos devem estar no diretório privado e pertencer a uma consulta do mesmo usuário/tenant, inclusive em cache. Download usa `private, no-store`. PDFs gerados a partir do relatório salvo, sem rota estática ou arquivo público.

Uma atualização atômica no PostgreSQL concede a execução por consulta, com token e heartbeat. Duas fontes por análise são processadas simultaneamente; o limite é por análise, não global. Após 3 minutos sem heartbeat, a interface permite retomada explícita. Leituras concluídas são reaproveitadas; uma retomada não executa coletores nem cobra consultas novamente. A guarda global de throughput pode ser adicionada se houver volume concorrente que justifique uma fila.

## Validação reproduzível

- `node --test test/seller-review.test.mjs test/seller-analysis-api.test.mjs test/seller-analysis-ui.test.mjs test/seller-documents.test.mjs`.
- `AUDITA_BASE_URL=http://localhost:3000 node scripts/check-seller-review-ui.mjs`: interface e assets locais, rotas reais extraídas do servidor, serviços reais e PostgreSQL PGlite isolado; provedores fictícios. Não usa banco nem consultas de produção. Testa entrada, coleta, progresso, análise, lacunas, PDF, recarga, histórico e retorno em desktop/celular.
- PDF fictício em `output/pdf/analise-vendedor-ficticio.pdf`; capturas e download da interface em `output/playwright/`. Artefatos de teste privados/ignorados.
- A validação com fontes reais pagas é separada da validação do fluxo. O teste real de OpenAI usa somente dados fictícios e não valida precisão sobre todos os modelos de certidão.

## Emissão de certidões diversas

A Central organiza Análise de Vendedor, Consulta de imóveis e Indisponibilidade de bens em **Imóveis**. **Emissão de certidões** abre `#emissao-certidoes`, reutilizando os coletores e controles de custo e autorização. Esse fluxo oferece somente as fontes de tipo certidão, entrega os PDFs e não inclui a etapa 3, consentimento OpenAI ou relatório de IA.

A seleção é enviada com `flow: certificates`; o servidor força `sellerAiConsent=false`, restringe as fontes e persiste `sellerFlow` no JSON da consulta, sem migração. O início da análise de IA é recusado para uma emissão mesmo que solicitado diretamente à API. Históricos e retomadas do navegador são separados; consultas antigas sem marcador continuam no histórico de análise do vendedor. Não houve novas consultas pagas na validação.
