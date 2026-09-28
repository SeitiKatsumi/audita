# Cobertura trabalhista da análise do vendedor

Validação em 28/09/2026. Este documento registra emissões reais da API Direct Data e os limites escritos nos PDFs. A liberação no produto é controlada pelo [catálogo](../data/seller-document-coverage.json) e pelo [relatório geral](seller-document-coverage.md). Emissão validada, inclusão no catálogo e publicação são etapas distintas.

## Resultado e critério de validação

- A rodada `TIPO=Eletrônico` consultou as 24 regiões: **22 retornaram PDF válido**, abrangendo **25 UFs**; TRT18/GO e TRT21/RN retornaram manutenção.
- Dos 22 PDFs, **21 consultam o PJe**. O **TRT22/PI retornou uma CEAT que já inclui processos físicos e eletrônicos**.
- A rodada `TIPO=Físico` terminou com 23 combinações consultadas: TRT2/SP e TRT7/CE retornaram PDFs complementares ao PJe; 20 regiões rejeitaram a combinação. TRT1/RJ permaneceu HTTP 202, resultado 23, sem PDF ao atingir o limite de espera de 259 segundos. TRT22/PI não foi novamente consultado porque a CEAT recebida já cobre o físico. Portanto, há **24 PDFs validados**, sem somar duas vezes a cobertura mista do Piauí.
- Cada sucesso exige HTTP 200, resultado de sucesso do fornecedor, conteúdo PDF, CPF integral correspondente e título/região/abrangência conferidos no texto. O nome do JSON coincide com a pessoa consultada nos retornos eletrônicos válidos. A ausência de nome no PDF padrão PJe não invalida a correspondência por CPF.
- São testes autorizados de pessoa física. Não homologam pessoa jurídica, resultados positivos, homônimos, todos os períodos históricos ou disponibilidade permanente.

Não se deve interpretar uma certidão de distribuição negativa como ausência de qualquer obrigação trabalhista. A [CNDT do TST](https://www.tst.jus.br/certidao) consulta o BNDT e continua sendo um documento separado.

## Matriz das 24 regiões

As UFs seguem o [diretório de tribunais do CNJ](https://www.cnj.jus.br/tribunais/). São Paulo é dividido entre TRT2 e TRT15; uma única região não cobre todo o estado.

**Legenda:** `PJe` = PDF do PJe, processos em tramitação ou arquivados provisoriamente, nas classes e polos discriminados. Todos os 21 PDFs PJe excluem arquivados definitivamente e classes não listadas. `Não suportado` = HTTP 400, resultado 8 da Direct Data; não significa inexistência de serviço oficial. `Manutenção` = HTTP 503, resultado 30; não significa certidão negativa.

| TRT | UF / jurisdição | `Eletrônico` | `Físico` | Limitação ou diferença do PDF eletrônico |
| --- | --- | --- | --- | --- |
| 1 | RJ | PDF PJe validado | Assíncrono pendente após limite de espera; sem PDF | Exclui físicos; inclui classes específicas do polo ativo em 1º e 2º graus. |
| 2 | SP — Grande São Paulo e Baixada Santista | PDF PJe validado | PDF físico validado | Exclui físicos e BNDT; inclui classes específicas do polo ativo em 1º e 2º graus. Os dois PDFs são complementares. |
| 3 | MG | PDF PJe validado | Não suportado | Exclui físicos e BNDT; a CEAT oficial possui abrangência diferente, ainda não obtida por esta opção da API. |
| 4 | RS | PDF PJe validado | Não suportado | Declara fonte PJe; não há exclusão expressa de físicos, mas isso não comprova cobertura deles. Inclui classes específicas do polo ativo no 2º grau. |
| 5 | BA | PDF PJe validado | Não suportado | Exclui físicos; polos/classes indicados no documento. |
| 6 | PE | PDF PJe validado | Não suportado | Exclui físicos; polos/classes indicados no documento. |
| 7 | CE | PDF PJe validado | PDF físico validado | Exclui físicos e BNDT. PDF físico SPT1/SPT2 complementa o PJe. |
| 8 | PA e AP | PDF PJe validado | Não suportado | Exclui físicos e BNDT. |
| 9 | PR | PDF PJe validado | Não suportado | Declara fonte PJe; físicos não comprovados por este PDF. Exclui BNDT. |
| 10 | DF e TO | PDF PJe validado | Não suportado | Exclui físicos e BNDT; inclui classes específicas do polo ativo no 2º grau. |
| 11 | AM e RR | PDF PJe validado | Não suportado | Exclui físicos; polos/classes indicados no documento. |
| 12 | SC | PDF PJe validado | Não suportado | Exclui físicos e BNDT; inclui classes específicas do polo ativo em 1º e 2º graus. |
| 13 | PB | PDF PJe validado | Não suportado | Declara fonte PJe; físicos não comprovados por este PDF. |
| 14 | RO e AC | PDF PJe validado | Não suportado | Exclui físicos; polos/classes indicados no documento. |
| 15 | SP — jurisdição de Campinas/interior | PDF PJe validado | Não suportado | Exclui físicos e BNDT; complementa a jurisdição paulista do TRT2. |
| 16 | MA | PDF PJe validado | Não suportado | Exclui físicos; diversas classes do polo ativo em ambos os graus, incluindo ações trabalhistas. |
| 17 | ES | PDF PJe validado | Não suportado | Exclui físicos; polos/classes indicados no documento. |
| 18 | GO | Manutenção — sem PDF | Não suportado | Consulta eletrônica em manutenção no fornecedor; região ainda sem emissão validada. |
| 19 | AL | PDF PJe validado | Não suportado | Exclui físicos; inclui ação civil coletiva no polo ativo em 1º grau. |
| 20 | SE | PDF PJe validado | Não suportado | Exclui físicos e BNDT. |
| 21 | RN | Manutenção — sem PDF | Não suportado | Consulta eletrônica em manutenção no fornecedor; região ainda sem emissão validada. |
| 22 | PI | PDF CEAT misto validado | Já abrangido pela CEAT; sem nova consulta | APT físico + APTv + PJe, 1º e 2º graus; exclui definitivos e várias classes. |
| 23 | MT | PDF PJe validado | Não suportado | Exclui físicos; polos/classes indicados no documento. |
| 24 | MS | PDF PJe validado | Não suportado | Exclui físicos e BNDT. |

### Polos e classes: cuidado com um rótulo único

Os PDFs PJe do lote não têm uma abrangência uniforme. O conjunto predominante é o polo passivo, mas há exceções explícitas no polo ativo:

- TRT1: cumprimento de sentença de ações coletivas no 1º grau; ação anulatória de cláusulas convencionais e dissídios coletivos no 2º.
- TRT2 e TRT12: consignação em pagamento e petição cível no 1º grau; dissídio coletivo de greve, petição cível e recurso de multa no 2º.
- TRT4: classes específicas no 2º grau, como ação rescisória, dissídios coletivos, protestos e tutelas antecedentes.
- TRT10: ação anulatória de cláusulas convencionais, protesto e suspensão de liminar/antecipação de tutela no 2º grau.
- TRT16: lista extensa em ambos os graus, que inclui ritos ordinário, sumaríssimo e sumário no 1º grau e recursos no 2º.
- TRT19: ação civil coletiva no 1º grau.

O texto de cada certidão é a fonte para sua lista completa. O rótulo recomendado é **ações trabalhistas no PJe, conforme classes e polos da certidão**. O resultado no polo ativo, por si só, não é evidência de dívida do vendedor.

### Eletrônico e físico são produtos diferentes?

**No TRT2, sim:** o PDF físico consulta os sistemas de acompanhamento de processos físicos e exclui expressamente o PJe. O portal oficial também oferece caminhos separados para [processos eletrônicos e físicos](https://ww2.trt2.jus.br/servicos/certidoes/certidao-de-acao-trabalhista). Ambos podem acrescentar cobertura ao mesmo vendedor.

**No TRT7, sim:** o PDF físico consulta SPT1/SPT2, em 1ª e 2ª instâncias, no polo passivo e apenas nas classes enumeradas. Declara busca em base com processos a partir de 10/05/1967 e exclui débitos do BNDT. Não substitui o PJe.

**No TRT22, o parâmetro não define sozinho a abrangência:** a opção eletrônica já retornou a CEAT mista. O documento recebido cita APT, APTv e PJe nos dois graus, busca por CPF e exata grafia do nome cadastral, exclusão dos definitivamente arquivados e lista própria de classes excluídas. A [descrição oficial do serviço](https://servicosaocidadao.trt22.jus.br/servi%C3%A7os/certid%C3%A3o-eletr%C3%B4nica-de-a%C3%A7%C3%B5es-trabalhistas) confirma as bases físicas e eletrônicas; para os limites e validade da emissão, prevalece o PDF recebido.

**No TRT3 existe oportunidade adicional fora desta combinação da API:** a [CEAT oficial](https://certidao.trt3.jus.br/certidao/feitosTrabalhistas/aba0.informacoesGerais.htm) declara consulta a processos físicos e PJe e busca complementar em cadastros sem CPF/CNPJ pelo nome. A opção eletrônica da Direct Data retornou apenas o modelo PJe; a opção física foi rejeitada como parâmetro não suportado. A existência desse serviço oficial não equivale a fluxo autônomo validado.

O [OpenAPI da Direct Data](https://apiv3.directd.com.br/) aceita `REGIAO=1..24` e enumera `TIPO=Eletrônico|Físico`, mas não fornece uma matriz de suporte por região. O enum, sozinho, não autoriza habilitar as 48 combinações no catálogo. Tampouco se deve contar duas opções como dois tipos documentais quando ambas consultarem as mesmas bases.

## Identidade, evidência e atualização

- Os PDFs PJe recebidos mostram o CPF pesquisado integralmente, sem máscara, e omitem o nome da pessoa. A validação deve usar o documento integral e a região/título; um nome ausente não deve virar divergência de identidade.
- As CEATs e certidões físicas podem trazer nome. Normalizar caixa, acentos e espaços antes de comparar. Um nome diferente continua sendo motivo de rejeição; nome existente apenas no JSON não prova que aparece no PDF.
- Os resumos do probe têm `nameMatches` sensível a caixa; esse campo isolado não é o critério final. No TRT22 eletrônico, por exemplo, o PDF traz o nome em maiúsculas e o indicador bruto aparece falso.
- Respostas de manutenção e parâmetro não suportado devem permanecer falhas, sem `nada_consta` e sem PDF inventado. Não converter falta de processos no JSON em certidão negativa sem conferir o escopo do documento.
- A presença de PDF e CPF não substitui validação criptográfica da assinatura digital. Esta rodada conferiu identidade, estrutura e texto; não atesta cadeia de assinatura ICP-Brasil.

Evidências privadas: `output/seller-expansion/trt{1..24}-{eletronico|fisico}.summary.json`, respostas `.private.json`, PDFs e textos `.private.txt`. Esses arquivos ficam fora do Git e das rotas públicas. Esta matriz não contém identificadores pessoais, números de certidão, códigos de autenticação ou URLs privadas de comprovantes.

Para atualizar: consultar apenas a combinação necessária, aguardar o retorno final assíncrono, conferir o PDF e seus limites, registrar data/status nesta matriz e só então alterar o catálogo. Recuperar TRT1 físico pelo identificador da consulta já aberta, sem nova emissão enquanto pendente. Retentar TRT18/GO e TRT21/RN quando a manutenção encerrar. Nenhuma conclusão desta matriz implica publicação no GitHub ou implantação.
