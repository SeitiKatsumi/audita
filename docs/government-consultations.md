# Consultas Governamentais

## Objetivo

Esta camada organiza os modulos de consulta a fontes governamentais e oficiais da Audita.

O MVP atual cria:

- catalogo de modulos governamentais;
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
- Respeitar termos de uso, limites de taxa e base legal/LGPD.

## Estado atual

Os modulos estao como `planned` ou `sandbox`. A API registra a consulta e cria rastreabilidade, mas ainda nao chama servicos governamentais externos.

## Proximos passos

1. Definir quais APIs oficiais serao usadas primeiro.
2. Documentar credenciais necessarias por modulo.
3. Criar adapters isolados por fonte.
4. Implementar fila de jobs para consultas demoradas.
5. Registrar logs tecnicos sem dados sensiveis.
6. Adicionar rate limit por tenant e usuario.
