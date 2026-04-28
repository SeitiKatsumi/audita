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

## Autenticacao

- Habilitar `AUDITA_AUTH_REQUIRED=true` em staging/producao.
- Criar o primeiro admin apenas por variaveis de ambiente seguras.
- Usar senha forte para `AUDITA_BOOTSTRAP_ADMIN_PASSWORD`.
- Remover ou rotacionar credenciais bootstrap apos validacao inicial.
- Sessoes usam cookie HttpOnly e devem trafegar com HTTPS.
- Toda consulta de dados deve respeitar `tenant_id`.

## Consultas governamentais

- Validar base legal antes de consultar dados pessoais ou empresariais.
- Usar credenciais oficiais autorizadas por ambiente.
- Nao persistir identificadores sensiveis em texto puro quando um hash for suficiente.
- Respeitar limites de taxa e termos de uso das fontes oficiais.
- Registrar auditoria da consulta sem vazar o identificador bruto.
