# Auditoria Direct Data — 23/10/2026

Responsável: Codex. Branch codex/auditoria-direct-20261023, base main1dc74cf. Consultas reais expressamente autorizadas, com teto de R$150; evidências privadas e planilha fora do Git.

## Resultado da rodada

- 20 endpoints integrados testados; 122 submissões reais e 151 variações inventariadas.
- 95 resultados validados pelos coletores, dos quais 82 com PDF validado. 23 variações falharam e quatro permaneceram pendentes na última conferência gratuita do histórico. Outras29 não foram submetidas para respeitar o orçamento. Isso não comprova toda UF/tipo/instância de cada API.
- Custo-base estimado R$99,46; reserva conservadora R$149,20, inclusive falhas. Não é fatura conciliada. TribunalJustica foi provisionado em R$3,30 por chamada sem preço atual confirmado; demais valores são do catálogo.
- Espera inicial da ferramenta de auditoria limitada a60s; resultados demorados foram recuperados no histórico gratuito sem repetir a emissão. Não atribuir esses timeouts ao prazo padrão maior do app.
- Cadastro CPF é enriquecimento do formulário, não oferta de um dossiê cadastral bruto. Endpoints antigos sem oferta ativa foram identificados e não consultados sem utilidade.

## Correções da Audita

- Dados estruturados recebidos passam a ficar disponíveis também junto aos PDFs. Mantidos resumo, navegação e paginação dos processos. Credenciais, URLs privadas e processos restritos são omitidos. Retornos acima do limite de armazenamento continuam sinalizados como parciais.
- Certidões estaduais preservam também emissão, validade, número, código de validação, situação, observações e demais campos seguros do retorno. A identidade e o escopo do PDF continuam obrigatórios.
- SP: título fiscal novo era rejeitado pela expectativa antiga. Aceitos título antigo ou novo, mantendo titular/estado. PDF real revalidado sem cobrança adicional; testes negativos asseguram rejeição de outro titular ou escopo.
- Falhas ganham explicações seguras, sem repassar mensagens brutas ou credenciais do fornecedor.

## Falhas do fornecedor/fonte

- TRF2/3/6 e outras variações retornaram503/instabilidade ou erro de processamento. FGTS retornou erro de sistema remoto. Acre CPF informou certidão válida já existente; não disponibilizou nova emissão.
- Consulta de processos do TJ-SP não trouxe informações para os parâmetros testados; não é prova de inexistência de processos.
- MT retornou ressalvas e informação textual sem PDF obrigatório. Não validar isso como certidão emitida.
- ES Família/Fiscal/Militar: HTTP200/resultado de sucesso, mas os PDFs contêm somente403Forbidden. Texto confirmado por dois extratores e imagem renderizada. O bloqueio da Audita está correto; não enfraquecer identidade/escopo para aceitar esses arquivos.
- Pendências finais: ver planilha e consultaUid; conferir histórico antes de novas emissões.

## Validação e entrega

69 testes pertinentes aprovados. Suíte final na main local728/729; falha preexistente de charge-analysis-ui reproduzida também antes destas alterações. Nenhum ajuste alheio ao escopo feito para ocultá-la. Sintaxe e diff check aprovados. Main local/localhost3000 consolidados, banco local persistente e autenticação preservados, configuração privada com hash inalterado. Sem push/deploy, cobrança Stripe, IA paga ou alteração de credenciais/cobertura.

Evidências privadas e arquivo Auditoria-Direct-Data-2026-10-23.xlsx em S:/CodexBuilds/Audita-direct-audit-20261023. A planilha não contém os documentos pessoais nem os PDFs. Reproduzir os retornos já salvos não gera novas chamadas aos fornecedores.
