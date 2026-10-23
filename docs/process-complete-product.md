# Produto: consulta e cópia completa de processos — 22/10/2026

Base: [reunião Audita de 21/10/2026, 16h03](https://docs.google.com/document/d/1_bxGthpKnhezbOHzlf6QSY5rEFah2hXkq2PmvLYOlVg/edit), especialmente25–35min. A consulta por documento usa a Direct Data; a cópia dos autos é uma contratação adicional via ProcessOnline. O resumo/análise da IA Audita não é certidão oficial de objeto e pé.

## Jornada

1. Com CNJ: informar número válido, conferir preço, autorizar e pagar a cópia.
2. Com CPF/CNPJ: abrir o serviço nacional existente com documento preenchido em memória, escolher a consulta detalhada, pagar pela regra existente e consultar resultados salvos.
3. Nos resultados de emissão ou de qualquer um dos nove segmentos de análise: quando houver CNJ válido, oferecer autos completos sem repetir a consulta de origem. A Completa conserva paginação de50; o usuário pode encaminhar os processos da página para seleção.
4. Selecionar até20processos por pagamento, sem pré-seleção; conferir quantidade e total, autorizar e pagar. Cada cópia mantém uma solicitação privada própria, download, andamento e histórico. Não há monitoramento contínuo.
5. A análise de autos continua sujeita ao acesso IA e consentimento existentes; não é incluída automaticamente como parecer oficial. PDFs não legíveis ou parciais conservam os avisos de cobertura existentes.

O retorno do Stripe não libera o serviço sozinho. Webhook validado confere total congelado, moeda, sessão, dono e ambiente. Repetição retoma as mesmas operações por CNJ; alteração de preço exige nova conferência antes de criar pedido. Pedidos antigos conservam seus valores e fornecedor. Nova busca CPF/CNPJ no endpoint ProcessOnline é descontinuada410; buscas antigas pagas continuam recuperáveis.

## APIs que podem trazer CNJs

Contrato conferido no [OpenAPI oficial Direct Data](https://apiv3.directd.com.br/swagger/v3-scalar/swagger.json), sem consulta paga.

| API | Campo ou evidência |
|---|---|
| ProcessosJudiciaisCompleta | retorno.processos[].numeroProcesso; processosRelacionados[] quando válidos |
| ProcessosJudiciaisAgrupada | Totais e distribuições; **não lista números** e não permite selecionar autos sozinha |
| TribunalRegionalFederal | retorno.processos[].numero |
| TribunalRegionalTrabalho | retorno.processos[].processo[] |
| TSTCertidaoNegativaDebitosTrabalhistas | retorno.processos[].codigo, apenas se for CNJ válido |
| DetalhamentoNegativo (QUOD) | pessoaFisica/pessoaJuridica.pendenciaFinanceira.acoesJudiciais/recuperacoesJudiciaisFalencia[].numeroProcessoPrincipal |
| DossieCreditoCompleto (QUOD) | Mesma estrutura sob entidadeFisica/entidadeJuridica |
| TJCertidaoCivelCriminalFiscal | Sem CNJ estruturado: extrair apenas do PDF com identidade e escopo já validados |

ProcessosJudiciaisSimplificada também possui números no contrato, mas não foi adicionada como nova fonte comercial nesta alteração. Contagens, números de certidão e códigos de autenticação nunca geram oferta. O helper compartilhado exige dígito verificador CNJ, deduplica e omite registros estruturados com sinalização de sigilo. Não extrai texto novo via OCR nem faz chamada de fornecedor só para preparar uma oferta. Históricos sem CNJ legível não são reconsultados automaticamente.

## Preços e custos iniciais

| Operação | Custo-base estimado | Venda inicial |
|---|---:|---:|
| Direct Data Agrupada | R$1,10 | R$199,00 |
| Direct Data Completa | R$3,30 | R$199,00 |
| Cópia ProcessOnline por CNJ | R$24,99 | R$49,90 |

Super Admin > Preços e margens centraliza custo por fonte, preço fixo/acréscimo, lucro e margem bruta estimados. Configuração JSON existente recebe campos opcionais compatíveis com registros antigos; custos alterados afetam apenas novas cotações, não pedidos já pagos. Cópias usam o mesmo cadastro de preços e congelam custo/preço/quantidade no pedido privado.

Margens não incluem taxas Stripe, tributos, armazenamento nem gasto variável da IA. A análise usa o modelo e registro de consumo existentes; não foi criada tarifa fictícia por página. As condições deR$5/R$4 por cópia discutidas na reunião são intenções de negociação, não preços contratados. Tarifas reais devem ser ajustadas após confirmação do parceiro.

## Validação e ativação

Testes com dados fictícios, PDFs de teste e pagamentos simulados não comprovam acesso a autos reais ou webhook externo. Nenhuma consulta paga foi autorizada como parte desta implementação. ProcessOnline live, créditos, Stripe e disponibilidade dos tribunais continuam dependências reais; não foram ativados nem modificados automaticamente. Publicação em produção é separada da entrega local.
