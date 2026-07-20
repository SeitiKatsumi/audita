# Contato BigDataCorp - CNIB / Indisponibilidade de Bens

Telefone de retorno: +55 11 93377-2911

Mensagem sugerida:

Olá, equipe BigDataCorp.

Estamos implantando no Audita um módulo de auditoria imobiliária para consulta de indisponibilidade de bens por CPF/CNPJ do vendedor, sem scraping e via API/DaaS.

Precisamos avaliar a habilitação dos datasets:

- `partner_quod_credit_risk_details_person`
- `partner_quod_credit_risk_details_company`

Pontos que precisamos confirmar:

- Se as naturezas `IBI`, `IBG`, `IBC`, `IBM`, `IBF`, `IBS`, `IBP` e `IBT` representam consulta oficial CNIB/ONR ou indicador restritivo classificado como indisponibilidade de bens.
- Se o retorno pode ser usado como evidência em relatório de auditoria imobiliária.
- Se existe hash, protocolo, fonte oficial, data de atualização ou documento validável associado ao retorno.
- Regras de cobrança por consulta, limite mensal e ambiente de teste.
- Amostra real de resposta JSON para CPF e CNPJ.
- Condições contratuais/LGPD para consulta com autorização/base legal do cliente final.

Objetivo: integrar o módulo ao fluxo de certidões e auditoria do Audita, com consumo controlado por créditos do plano do usuário.
