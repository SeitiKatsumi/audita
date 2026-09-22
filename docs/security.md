# Seguranca

## Principios

- Menor privilegio.
- Segregacao de ambientes.
- Secrets fora do codigo.
- Banco privado.
- Logs sem dados sensiveis.
- Deploy rastreavel.
- Backups testados.
- Acesso administrativo individual, nunca compartilhado.

## VPS

Checklist inicial:

- Criar usuario nao-root com sudo.
- Usar SSH por chave.
- Desabilitar login root por SSH.
- Desabilitar senha por SSH.
- Configurar firewall.
- Liberar apenas portas necessarias.
- Instalar atualizacoes de seguranca.
- Configurar fail2ban ou equivalente.
- Monitorar disco.
- Configurar rotacao de logs.

## CapRover

- Usar HTTPS.
- Senha forte.
- Painel com acesso restrito.
- Apps separados por ambiente.
- Volumes documentados.
- Variaveis por ambiente.
- Nao expor portas internas sem necessidade.

## Docker

- Nao rodar containers como root quando evitavel.
- Usar imagens oficiais ou confiaveis.
- Fixar versoes quando possivel.
- Nao colocar secrets no Dockerfile.
- Usar health checks.
- Evitar containers privilegiados.

## GitHub

- Proteger `main` e `develop`.
- Exigir PR.
- Exigir CI verde.
- Usar reviewers.
- Usar secrets por ambiente.
- Ativar alertas de dependencias quando disponivel.
- Revogar tokens antigos.

## Dados e logs

- Nao registrar tokens, senhas, documentos ou dados pessoais desnecessarios.
- Mascarar identificadores sensiveis.
- Registrar eventos de seguranca relevantes.
- Definir retencao de logs.

## Perfil cadastral

- CPF, RG, telefone e endereco reutilizaveis ficam em payload AES-256-GCM.
- A chave `AUDITA_PROFILE_ENCRYPTION_KEY` deve ter pelo menos 32 caracteres e
  existir somente no secret manager/CapRover.
- A chave nao pode ser rotacionada sem uma migracao de descriptografia e
  recriptografia dos perfis existentes.
- Valores juridicos, respostas do chat e documentos anexados nao pertencem ao
  perfil cadastral.
- Endpoints de perfil exigem sessao autenticada e sempre usam `tenant_id` e
  `user_id` do servidor, nunca os enviados pelo cliente.

## Autenticacao

- Opcao "Manter conectado por 30 dias" no login, desmarcada por padrao. Somente
  rememberMe booleano true estende cookie e sessao para 30 dias a partir do login;
  demais valores e cadastro mantem 12 horas. Sem renovacao automatica nem extensao
  retroativa de sessoes. Logout revoga a sessao atual e troca de senha revoga todas.
  Usar somente em dispositivo pessoal; HttpOnly, SameSite e HTTPS preservados.
  Nao modifica o tratamento de indisponibilidade durante deploy.

- Meus Dados permite trocar a propria senha com confirmacao da senha atual,
  nova senha de 8 a 128 caracteres e repeticao no formulario. A API exige sessao,
  JSON de mesma origem e limita tentativas por usuario (5 a cada 15 minutos por processo).
- A troca grava o hash e revoga todas as sessoes atomicamente no PostgreSQL;
  o usuario precisa entrar novamente. Banco configurado mas indisponivel nao usa fallback.
- Bootstrap cria a conta inicial somente se ausente: nao restaura senhas antigas.
- Edicao do perfil mantem CPF/RG/contato/endereco criptografados e validacao existente.
  E-mail de contato nao altera o e-mail usado para entrar.

- Habilitar `AUDITA_AUTH_REQUIRED=true` em staging/producao.
- Criar o primeiro admin apenas por variaveis de ambiente seguras.
- Usar senha forte para `AUDITA_BOOTSTRAP_ADMIN_PASSWORD`.
- Remover ou rotacionar credenciais bootstrap apos validacao inicial.
- Sessoes usam cookie HttpOnly e devem trafegar com HTTPS.
- Toda consulta de dados deve respeitar `tenant_id`.

## Documentos de importação

Payloads e arquivos usam AES-256-GCM e chave privada existente (ou chave específica
do módulo). Autorização por tenant/usuário em cada leitura, escrita e download;
somente super_admin pode revisar. Nenhuma alíquota da IA entra automaticamente
no cálculo. Consentimento explícito para OpenAI; busca web recebe apenas códigos
NCM públicos. Detalhes e limites em [import-audit.md](import-audit.md).

## Consultas governamentais

- Validar base legal antes de consultar dados pessoais ou empresariais.
- Usar credenciais oficiais autorizadas por ambiente.
- Armazenar apenas referencias de secrets no banco, nao os valores dos tokens/certificados.
- Chaves OpenAI/ChatGPT devem ficar em variaveis de ambiente ou secret manager; a Audita deve salvar apenas `api_key_secret_ref`.
- Nao persistir identificadores sensiveis em texto puro quando um hash for suficiente.
- Respeitar limites de taxa e termos de uso das fontes oficiais.
- Registrar auditoria da consulta sem vazar o identificador bruto.
