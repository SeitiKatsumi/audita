# Cotas antigas PIS/PASEP — atendimento assistido

Entrada `/#pis-pasep`. Trata das cotas do período 1971–1988; não inclui abono anual, revisão judicial de desfalques, genealogia ou pesquisa patrimonial. A apresentação é pública; criar um caso e guardar respostas/documentos exige a conta existente da Audita.

## Operação

- Uma pergunta por mensagem, Voltar e retomada por `?pisCase=<uuid>#pis-pasep`. O parâmetro é apenas uma referência: o servidor exige permissão. Respostas e documentos não são guardados no localStorage.
- Cliente abre o REPIS em outra aba. Não há API, automação de login, captura de credenciais ou consulta automática. Para falecidos, consulta pela conta do solicitante. Fonte: https://www.gov.br/pt-br/servicos/consultar-saldo-de-cotas-pis-pasep.
- Resultado informado pelo cliente é pendente de conferência. Ausência de saldo não representa conclusão definitiva. Dificuldades e informações desconhecidas geram orientações de complementação.
- Ao solicitar apoio, o caso entra na fila PIS/PASEP de `/advogados`. O perfil `lawyer`, atribuído pelo superadministrador existente, permite assumir um atendimento atomicamente. A fila mostra somente referência, situação e datas. Documentos e respostas são liberados apenas ao cliente, responsável atribuído e superadministrador; membros da mesma organização não recebem acesso automático.
- A equipe confere identificação e representação; conferência positiva da consulta exige comprovante. Sucessão aceita documentação aplicável, sem exigir simultaneamente todas as alternativas oficiais. Registra pendências, prazos e notas internas ou atualizações ao cliente.
- Consulta gratuita. A equipe publica escopo, percentual, base de cálculo e condições de êxito por caso. O cliente aceita exatamente a versão publicada; mudanças antes do aceite substituem a versão. Contrato aceito exige anexo assinado e conferência da equipe para preparação. Depois do aceite, alterações contratuais ficam fora desta versão, sem alteração ou cobrança automática.
- Cliente e equipe podem registrar protocolo, exigência, decisão e recebimento com comprovantes. Registros do cliente aguardam conferência; a situação operacional só avança com a equipe. Honorários são registrados manualmente após contrato assinado e recebimento conferido, com comprovante próprio; sem Stripe e sem alteração da assinatura Standard.
- Não há monitoramento automático. Orientações e calendário ficam vinculados ao canal oficial do FGTS/CAIXA; prazos registrados pela equipe não são intimações automáticas.

## Implantação

1. Aplicar `db/pis-pasep.sql` após `db/schema.sql`. A migração é aditiva e idempotente; o servidor também a executa quando `AUDITA_AUTO_MIGRATE` está habilitado.
2. Configurar `AUDITA_PIS_ENCRYPTION_KEY` com segredo de pelo menos 32 caracteres. Se omitido, reutiliza `AUDITA_IR_ENCRYPTION_KEY`, com contexto criptográfico separado. Preservar a chave nos backups; mudar o segredo sem migração torna os dados anteriores ilegíveis.
3. Montar volume privado persistente em `AUDITA_PIS_STORAGE_PATH` (padrão `private-documents/pis`). Incluir banco, volume e chave no procedimento de backup existente. Arquivos são criptografados com AES-GCM e não são servidos por rotas estáticas.
4. Habilitar `AUDITA_PIS_ENABLED=true` primeiro em homologação com dados fictícios. O padrão é desabilitado. Sem banco/migração/chave, endpoints falham explicitamente e o chat não cria casos temporários.

## Interfaces

`GET /api/pis-pasep/config` é público. Rotas restantes exigem sessão, configuração e armazenamento prontos. Mutações validam origem, permissões e revisão do caso.

- `GET/POST /cases`: listar próprios casos ou iniciar.
- `GET /cases/:id`: conversa, checklist, documentos, contratos, registros e histórico autorizado.
- `POST /cases/:id/actions`: `answer`, `review`, `contract`, `accept`, `activate`, `record`, `confirm_record`, `note`, `task`, `close`; todas incluem `revision`.
- `POST /cases/:id/documents?type=...&name=...`: conteúdo binário PDF/PNG/JPEG até 10 MB. `GET /cases/:id/documents/:documentId`: download autorizado e auditado.
- `GET /queue`, `POST /cases/:id/claim`: fila e atribuição da equipe.

Todas as rotas acima usam o prefixo `/api/pis-pasep`. A mudança de uma resposta anterior invalida respostas posteriores, revisão e condições não aceitas. Após contratação ou registro operacional, correções seguem por atualização à equipe para preservar o histórico.

## Verificação

`node --test test/pis-pasep.test.mjs test/pis-pasep-panel.test.mjs test/ir-exemption-chat.test.mjs` usa PostgreSQL isolado em PGlite e diretório temporário, sem dados de produção. Cobre titulares, representantes, herdeiros, respostas desconhecidas, datas, criptografia, permissões, fila, versões contratuais, comprovantes, recebimento e reabertura do banco. O teste de chat valida os tempos e a rolagem compartilhados com IR.

Para executar também o teste SQL existente do Itaú: `TEST_PGLITE_MODULE="file://$PWD/node_modules/@electric-sql/pglite/dist/index.js" node --test`.
