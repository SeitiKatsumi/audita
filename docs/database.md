# Banco De Dados

## Estrategia

Cada ambiente deve possuir banco separado:

- banco local;
- banco staging;
- banco producao.

O banco de producao nao deve ter porta exposta publicamente. O acesso deve acontecer pela rede interna do CapRover/Docker ou por tunel SSH temporario e controlado.

## Usuarios

Criar usuarios separados por finalidade:

- `audita_app`: usado pela aplicacao.
- `audita_migration`: usado para migracoes controladas.
- `audita_readonly`: usado para diagnostico excepcional.
- usuario administrativo: uso restrito.

## Regras

- Nunca usar credencial administrativa na aplicacao.
- Nunca commitar dumps.
- Nunca usar dados reais em desenvolvimento sem anonimizacao.
- Nunca compartilhar credenciais em conversa, issue ou README.
- Toda mudanca de schema deve ser versionada por migracao.
- Backups devem ser criptografados e testados periodicamente.

## Backups

Rotina minima recomendada:

- Backup diario automatico.
- Retencao curta diaria.
- Retencao semanal.
- Copia fora da VPS.
- Teste mensal de restore.

## LGPD

O projeto pode lidar com dados sensiveis. Qualquer dado pessoal deve ter base legal, finalidade documentada, controle de acesso, retencao definida e rastreabilidade.
