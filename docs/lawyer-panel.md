# Painel de advogados

- `/advogados` usa o login existente. O superadministrador atribui o perfil **Advogado** a uma conta cadastrada; cadastro público não concede esse acesso.
- A fila central abrange clientes de diferentes contas. Antes de assumir, o advogado vê somente identificador, cidade, UF e data. Após assumir, somente ele acessa os PDFs e os documentos de origem daquele caso.
- `POST /api/jec/petitions/submit` valida cadastro, revisão, aceite eletrônico, identidade, residência e presença dos documentos de origem indicados na análise. Gera e salva o conjunto em uma única operação no PostgreSQL antes de confirmar ao cliente.
- Repetir o mesmo envio pelo mesmo usuário conserva a solicitação e seus documentos originais. O número exibido ao cliente é o identificador interno; ainda não é protocolo judicial.
- Estados: `queued` → `claimed` → `filed`. A atribuição é atômica. A conclusão registra o número informado pelo advogado, sem verificação automática no tribunal.
- Aplicar `db/schema.sql` antes de ativar a interface. Sem PostgreSQL disponível, o envio falha explicitamente; não há fila temporária em memória. PDFs, aceites e anexos ficam na tabela `audita_lawyer_jobs` e devem integrar o backup do banco.
- A representação nos documentos e o protocolo continuam sujeitos à revisão do advogado. Esta alteração não automatiza acesso, assinatura ou envio nos tribunais.

## Verificação

`node --test` executa os testes existentes e as regras de acesso. O teste SQL de `test/lawyer-queue.test.mjs` também roda quando `TEST_PGLITE_MODULE` aponta para a URL de arquivo de `@electric-sql/pglite/dist/index.js`, instalado em um diretório temporário fora do projeto. Ele verifica persistência após reabertura, idempotência, disputa pela atribuição e acesso aos documentos. Não usar banco de produção para testes.
