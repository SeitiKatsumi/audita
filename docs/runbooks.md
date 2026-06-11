# Runbooks

## Deploy em producao

1. Confirmar PR aprovado.
2. Confirmar CI verde.
3. Confirmar staging validado.
4. Confirmar backup recente.
5. Revisar migracoes.
6. Executar deploy.
7. Rodar smoke test.
8. Monitorar logs e metricas.

## Portais bloqueados fora do Brasil

1. Confirmar que o app em producao roda em VPS brasileira.
2. Confirmar `APP_URL`, `DATABASE_URL`, `AUDITA_AUTH_REQUIRED` e cookies seguros.
3. Confirmar que `AUDITA_REMOTE_ASSISTED_BROWSER=true` esta habilitado quando houver validacao humana.
4. Rodar `AUDITA_BASE_URL=https://audita.seudominio.com.br npm run smoke:production`.
5. Executar uma consulta sem CAPTCHA e confirmar PDF/protocolo no resultado.
6. Executar uma consulta com CAPTCHA/Cloudflare e confirmar que a etapa assistida aparece no Audita.
7. Conferir logs do collector antes de concluir que o portal esta indisponivel.

## Rollback

1. Identificar versao anterior estavel.
2. Verificar se houve migracao irreversivel.
3. Restaurar versao anterior da aplicacao.
4. Restaurar backup somente se necessario.
5. Registrar incidente.

## Falha de banco

1. Verificar container/servico.
2. Verificar disco.
3. Verificar logs.
4. Verificar conexoes.
5. Avaliar restore de backup.
6. Comunicar impacto.

## Vazamento de secret

1. Revogar secret imediatamente.
2. Gerar novo secret.
3. Atualizar ambiente afetado.
4. Procurar uso indevido em logs.
5. Registrar incidente.
6. Revisar causa raiz.
