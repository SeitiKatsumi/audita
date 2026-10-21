# Entrada e calculadora de IR

Referência testada em21/10/2026: https://liberius.com.br/calculadora-liberius/ e entrada https://liberius.com.br/ . Dados inteiramente fictícios.

- Nascimento01/1970, diagnóstico01/2026, benefício01/2026, descontoR$1000: referência mostrou9meses, subtotalR$9000, projeçãoR$12000, acréscimoR$2100, totalR$23100.
- Cenário antigo (nascimento01/1960, diagnóstico01/2020 e benefício01/2018): referência mostrou65meses e totalR$84700. A Audita não replica esse período superior a60meses; aplica limite explícito de60meses completos e explica as hipóteses.
- Campos de datas, desconto atual e desconto anterior aos 65 anos quando aplicável e resultado detalhado, com identidade da Audita. Sem copiar promessas de isenção vitalícia, índices de êxito, prazo médio ou valor médio recuperado de outra empresa.
- Início mais recente entre diagnóstico, benefício e60meses antes do mês atual. Mês atual excluído;13º não presumido. Quando o titular já completou 65 anos e há meses anteriores a essa idade na janela, exige desconto histórico (zero permitido) e aplica-o somente a esses meses. A partir do mês do aniversário de 65 anos usa o desconto atual. Para menores de 65 anos usa o atual. Parcelas de12meses futuros e10% ilustrativos são opcionais e não representam crédito já pago nem Selic.
- Não determina direito; o fluxo já existente faz triagem e conferência documental. Datas/valores não são enviados nem persistidos pela calculadora.
- Fundamentação de escopo: https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/preenchimento/molestia-grave . A simulação não substitui apuração a partir de retenções efetivas, declarações, restituições prévias e marcos temporais aplicáveis.

Validação visual local bloqueada pela política salva do navegador. Testes de lógica e fluxo sem navegador executados separadamente.
