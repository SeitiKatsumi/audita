# Operacoes

## Monitoramento minimo

- Containers ativos.
- Reinicios inesperados.
- CPU.
- RAM.
- Disco.
- Uso de volumes.
- Erros HTTP 4xx/5xx.
- Latencia.
- Falhas em jobs.
- Falhas de backup.
- Certificados TLS.

## Rotina operacional

Diaria:

- verificar containers;
- verificar logs de erro;
- conferir uso de disco.

Semanal:

- revisar atualizacoes;
- verificar backups;
- revisar alertas recorrentes.

Mensal:

- testar restore;
- revisar acessos;
- revisar custos e capacidade;
- atualizar documentacao operacional.

## Incidentes

Todo incidente relevante deve registrar:

- data e hora;
- impacto;
- causa provavel;
- correcao aplicada;
- prevencao futura;
- links para PRs, commits e logs relevantes.
