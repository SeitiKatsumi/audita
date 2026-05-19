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
