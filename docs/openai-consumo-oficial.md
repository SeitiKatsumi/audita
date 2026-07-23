# OpenAI: consumo oficial da Audita

O painel `#admin-consumo` consulta diretamente as APIs administrativas de **Usage** e **Costs** da OpenAI. O custo oficial e filtrado pelo projeto e pela chave usados exclusivamente pela Audita. A tabela por usuario continua sendo uma atribuicao interna, pois todos os usuarios do aplicativo compartilham a credencial backend da Audita.

## Credenciais necessarias

Um proprietario da organizacao OpenAI deve:

1. Criar um projeto chamado `Audita` na plataforma OpenAI.
2. Criar nesse projeto uma conta de servico ou chave exclusiva para as chamadas da Audita.
3. Guardar o segredo da chave e tambem o identificador `key_...` retornado pela plataforma.
4. Anotar o identificador `proj_...` do projeto.
5. Criar uma **Admin API Key** da organizacao. Ela serve apenas para consultar Usage/Costs e nunca deve ser usada para inferencia nem enviada ao frontend.

Configure no `.env.local` ou nos secrets do CapRover:

```dotenv
AUDITA_OPENAI_API_KEY=sk-proj-...
OPENAI_AUDITA_API_KEY_SECRET=AUDITA_OPENAI_API_KEY
AUDITA_CHAT_API_KEY_SECRET=AUDITA_OPENAI_API_KEY
STATE_COURT_AGENT_API_KEY_SECRET=AUDITA_OPENAI_API_KEY

OPENAI_ADMIN_KEY=sk-admin-...
OPENAI_PROJECT_ID=proj_...
OPENAI_AUDITA_API_KEY_ID=key_...
OPENAI_USAGE_SYNC_ENABLED=true
```

Reinicie a aplicacao depois de alterar os secrets. O painel deve exibir `Conectado`, o ID mascarado da chave, o projeto mascarado, requisicoes/tokens da Usage API e o custo faturado da Costs API.

## Regras de seguranca

- Nao colocar nenhuma dessas chaves no `app.js`, HTML, banco ou resposta da API.
- Nao reutilizar a chave de inferencia da Audita em outros sistemas.
- Restringir o acesso ao painel a `super_admin`, `owner` e `admin`.
- Rotacionar imediatamente qualquer chave enviada por chat, e-mail ou commit.

## Fontes oficiais

- Usage por projeto e chave: https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/completions
- Costs por projeto e chave: https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/costs
- Projetos: https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform
