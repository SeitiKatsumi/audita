# Consultas Governamentais

## Objetivo

Esta camada organiza os modulos de consulta a fontes governamentais e oficiais da Audita.

O MVP atual cria:

- catalogo de modulos governamentais;
- cadastro administravel de fontes/API por tenant;
- historico de consultas por tenant;
- endpoint para registrar pedidos de consulta;
- mascaramento do identificador visivel;
- hash do identificador para rastreabilidade sem persistir o valor bruto.

## Modulos iniciais

- Receita Federal / CNPJ.
- CNJ e tribunais.
- CADIN.
- Registro imobiliario.
- Diarios oficiais.

## Regras de seguranca

- Nao salvar CPF, CNPJ, numero de processo ou matricula em texto puro quando nao for estritamente necessario.
- Usar `subject_identifier_hash` para correlacao.
- Mostrar apenas `subject_identifier_masked` na interface.
- Toda consulta deve estar vinculada a `tenant_id`.
- Toda integracao real deve usar credenciais de ambiente, nunca valores no codigo.
- A tabela `audita_api_sources` armazena apenas metadados da fonte e `secret_ref`; tokens, certificados e senhas ficam no CapRover/secrets.
- Respeitar termos de uso, limites de taxa e base legal/LGPD.

## Fontes configuraveis

Administradores podem cadastrar fontes de orgaos com:

- nome da fonte;
- orgao/provedor;
- categoria;
- URL base;
- metodo de acesso;
- tipo de autenticacao;
- referencia do secret;
- status operacional;
- observacoes de normalizacao.

Essas fontes serao usadas por adapters especificos e pelo pipeline de normalizacao.

## Estado atual

Os modulos estao como `planned` ou `sandbox`. A API registra a consulta e cria rastreabilidade.

Tambem existe uma primeira versao do Agente Audita em `/api/agent/query`, capaz de responder perguntas em linguagem natural usando APIs abertas do IBGE:

- Localidades: estados e municipios por UF.
- CNAE: classes de atividades economicas.
- Populacao estimada: ranking de maiores municipios via SIDRA.

Essa camada nao usa LLM externo ainda; ela interpreta perguntas simples, consulta a fonte oficial e responde de forma humanizada.

## Aba Assistente

A aba **Assistente** permite selecionar uma fonte/orgao e executar uma consulta por codigo/identificador.

Fontes internas disponiveis no MVP:

- `IBGE Localidades`: aceita UF como `SP` para listar municipios, ou sem codigo para listar UFs.
- `IBGE CNAE`: aceita codigo de classe CNAE, ou sem codigo para listar exemplos.
- `IBGE Populacao estimada`: usa a pergunta para definir o limite do ranking, por exemplo "liste os 5 maiores municipios".

Fontes cadastradas em **Integracoes de orgaos** tambem aparecem no Assistente quando estiverem com status `testing` ou `active` e acesso `api` ou `hybrid`.

Para APIs que dependem de identificador no endpoint, cadastre a URL usando o placeholder:

```text
https://api.orgao.gov.br/recurso/{codigo}
```

Se a URL nao tiver `{codigo}`, o assistente anexa o codigo ao final do endpoint. Por seguranca, URLs locais ou privadas sao bloqueadas para evitar consultas indevidas a servicos internos da VPS.

## Configuracao OpenAI/ChatGPT

Administradores podem configurar o provedor OpenAI na interface da Audita informando:

- modelo;
- referencia do secret da API key;
- status;
- prompt base do agente.

A chave real da OpenAI nao deve ser salva no banco. Ela deve ficar no CapRover como variavel de ambiente, por exemplo:

```text
OPENAI_API_KEY=sk-...
```

Na Audita, o campo `Secret da API key` deve receber apenas:

```text
OPENAI_API_KEY
```

De acordo com a documentacao oficial da OpenAI, API keys devem ser carregadas com seguranca por variavel de ambiente ou servico de gerenciamento de chaves no servidor.

## Proximos passos

1. Definir quais APIs oficiais serao usadas primeiro.
2. Documentar credenciais necessarias por modulo.
3. Criar adapters isolados por fonte.
4. Implementar fila de jobs para consultas demoradas.
5. Registrar logs tecnicos sem dados sensiveis.
6. Adicionar rate limit por tenant e usuario.
7. Criar mapeamentos de normalizacao por fonte.
