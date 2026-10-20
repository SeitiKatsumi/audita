# Homologação de certidões estaduais — 20/10/2026

Consulta real autorizada para os dois titulares previamente aprovados, com teto de R$60. Dados pessoais, respostas e PDFs ficam fora do Git e das rotas públicas. Base remota main f24c85e, novamente conferida por fetch antes de integrar.

## Combinações adicionadas

| UF | Perfil | Tipo |
| --- | --- | --- |
| PA | CNPJ | Cível |
| PI | CNPJ | Cível |
| PI | CNPJ | Criminal |
| AP | CNPJ | Falência e recuperação judicial |
| BA | CNPJ | Falência e recuperação judicial |
| MT | CPF | Criminal |
| SE | CNPJ | Cível |

Cobertura resultante: **36 opções CPF em 13 UFs** e **20 opções CNPJ em 9 UFs**. Os módulos vendedor, certidões e segmentos comerciais usam o mesmo catálogo. Isso não comprova todos os tipos/instâncias de cada UF.

## Evidência e limites

- Novos PDFs passaram pela leitura real de texto e conferência de documento, razão social/nome, UF e título. Os sete PDFs foram reproduzidos pelo coletor integrado sem novas chamadas ao fornecedor. PA/PI cíveis vieram com emissão de16/10; novos tipos AP/BA/PI criminal e MT tiveram retorno desta rodada. Data de consulta não substitui a data de emissão/validade do PDF.
- AP/BA falência receberam títulos específicos no catálogo para não aceitar um PDF cível que apenas mencione falência nas observações. CPF nessas duas novas opções continua bloqueado.
- DF falência funcionou via API para CPF/CNPJ, mas a entrega já existe pelo portal oficial: não foi adicionada uma fonte paga duplicada.
- ES família/fiscal/militar CNPJ retornaram PDFs sem identidade/escopo válidos; foram rejeitados. Sucesso HTTP ou mensagem do fornecedor não comprovam emissão.
- AC, AM, CE, PB e RN continuam sem novas emissões comprovadas: erros503 e tipos não suportados. MT foi liberado somente para CPF/criminal; cível CPF e criminal CNPJ de SE atingiram timeout. Falha nesta tentativa não prova inexistência da certidão oficial.
- As nove UFs fora do anúncio do fornecedor não foram liberadas por inferência. Portais oficiais continuam como caminhos alternativos.

Foram 109 tentativas novas. Reserva conservadora: **R$58,86** (109×R$0,54), abaixo do teto deR$60. Não é conciliação de saldo/fatura; o faturamento efetivo depende do fornecedor. Nenhuma cobrança Stripe ou chamada de IA.

Resumo de resultados (inclui duas entregas DF já cobertas):
- failed: 91.
- rejected_evidence: 9.
- validated: 9.

Evidências privadas: S:/CodexBuilds/Audita-state-homologation-20261020. Inventário sanitizado com hashes SHA256 em summary-sanitized.json. CSV por UF regenerado; planilha externa não atualizada nesta tarefa. Sem push/deploy desta rodada.
