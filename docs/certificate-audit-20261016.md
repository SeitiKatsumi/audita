# Auditoria de certidoes estaduais e fontes processuais

## Atualizacao local — 16/10/2026

Apos a auditoria inicial, o usuario autorizou a implementacao e a homologacao real para CPF e CNPJ. A cobertura homologada no checkout de trabalho passou a **35 opcoes CPF em 12 UFs** e **14 opcoes CNPJ em seis UFs**. A fotografia inicial da producao, abaixo, foi preservada como historico; estes novos resultados sao locais, **sem push ou deploy**.

| UF | CPF homologadas | CNPJ homologadas |
| --- | ---: | ---: |
| AP | 2 | 2 |
| BA | 2 | 2 |
| DF | 4 | 4 |
| ES | 6 | 3 |
| GO | 2 | 0 |
| PA | 2 | 0 |
| PE | 3 | 2 |
| PI | 3 | 0 |
| RR | 3 | 0 |
| RS | 2 | 1 |
| SE | 2 | 0 |
| TO | 4 | 0 |
| Total | 35 | 14 |

- CPF: novas certidoes civeis e criminais de BA e SE, duas por UF, e civel do RS, alem das 30 opcoes historicas. RS conserva o alvara de folha corrida como produto separado.
- CNPJ: quatro certidoes do DF e tres do ES obtidas pelo portal oficial; civel/criminal de AP, BA e PE, mais civel do RS, pela Direct Data. As tres do ES sao civel, criminal e falencia/recuperacao. Foram conferidos PDF, identidade do titular, titulo e UF; isso nao prova todas as instancias, comarcas, naturezas ou respostas positivas.
- O catalogo distingue `documentTypes` e `validatedDocumentTypes`. Selecao, planos, custos e worker utilizam somente combinacoes homologadas. Candidatos exigem opt-in interno de homologacao; flags publicas nao os liberam. CNPJ nao exige nascimento, filiacao, RG ou outros campos exclusivos de PF. A interface oferece os 27 portais oficiais como caminhos alternativos, sem afirmar emissao automatica nessas UFs.
- ES: URL oficial atualizada e conferencia por cabecalho especifico de cada natureza. A palavra da natureza em observacoes nao era prova suficiente. Um PDF da Direct Data com a mensagem `Found The document has moved` foi rejeitado, sem ser contado como certidao.
- Processos por CNPJ: `ProcessosJudiciaisAgrupada` e `ProcessosJudiciaisCompleta` retornaram HTTP200 em testes reais, com `documentoConsultado` correspondente. Foram liberadas no catalogo como consultas de dados, a R$1,10 e R$3,30 de custo-base, respectivamente; nao sao certidoes nem copias dos autos.

### Validacao e tentativas desta rodada

**611/612 testes Node/PGlite aprovados.** No Chrome, uma jornada CNPJ ficticia confirmou selecao de R$16,20, checkout antes da coleta, webhook assinado simulado, um PDF privado, HTTP200 para o proprietario, 401 sem sessao e 404 para outro tenant. Houve zero chamadas de IA e zero buscas cadastrais CPF; reload nao repetiu a coleta. Mobile de390px sem overflow e links dos 27 portais conferidos. O teste integrado com provedores ficticios e separado da homologacao real dos PDFs acima; nao houve cobranca real na Stripe como teste.

Resultados de novas tentativas nao liberadas, limitados ao tipo/perfil consultado:

| Perfil/tipo | Resultado observado em 16/10 |
| --- | --- |
| CPF civel | AC, AM, CE, PB e RN:503; MT:tempo limite |
| CNPJ civel | AC, AM, CE, PB e RN:503; GO, MT e RR:400; PA, PI e SE:tempo limite; TO:500 |
| CPF falencia BA | 400 |
| CNPJ criminal RS | 400 |

Falha ou tempo limite nao demonstram inexistencia de certidao oficial. Os demais estados conservam a evidencia historica da auditoria, sem nova homologacao presumida. Algumas respostas/links PF da rodada nao ficaram gravados apos uma falha de disco; as consultas nao foram repetidas para evitar novo custo. Nao tratar metadados perdidos como comprovante recuperado.

Estimativa conservadora da rodada: **R$24,02 = 35 tentativas de certidoes x R$0,54 + duas consultas cadastrais/societarias x R$0,36 + R$4,40 de consultas processuais**. E uma estimativa operacional, nao uma fatura conciliada nem prova de cobranca por cada falha. Custos efetivos dependem do historico/faturamento do provedor.

ProcessOnline permanece desativado sem aprovacao B2B, chave e contrato. DataJud nao foi incorporado ao produto comercial, em razao dos termos examinados; Jusbrasil/Judit dependem de contratacao. Nenhum fornecedor foi contatado, nenhuma compra foi feita e nenhuma credencial foi substituida.

**Entrega/publicacao pendente:** a consolidacao em localhost:3000 esta sendo conduzida na tarefa principal. O tunel de banco local15432 esta indisponivel, condicao preexistente; `.env` e demais configuracoes privadas foram preservados. Implementacao e testes locais nao comprovam publicacao das ampliacoes em producao.

## Fotografia inicial da producao — antes da implementacao

Data: 16/10/2026. Codigo local e producao observados no inicio: `5067c8bc0fcff5b708a49dcc257a8e8332b8ea3e`.

Nessa fotografia, o Audita oferecia 30 opcoes de documentos dos tribunais estaduais para CPF em dez UFs e nenhuma opcao equivalente para CNPJ. A restricao PJ estava no catalogo, interface, servidor e coletor autonomo, apesar de o conector da Direct Data aceitar CNPJ. Eduardo estava correto sobre a existencia de certidoes judiciais para empresas. A ampliacao exigiu homologacao por UF, tipo, perfil e sistema; mudar apenas o filtro visual nao resolveria.

## Escopo e evidencia da auditoria inicial

- GET gratuito de [cobertura em producao](https://app.auditainteligente.com.br/api/seller-analysis/coverage), health, codigo e catalogos locais; documentacao oficial dos fornecedores e tribunais. Producao retornou health200, banco pronto e autenticacao obrigatoria.
- A matriz servida declara homologacao de **28/09/2026**. Foram conferidos metadados dos arquivos historicos, sem reproduzir conteudo pessoal. A existencia de um produto no catalogo nao prova nova emissao bem-sucedida hoje.
- Na etapa inicial, somente leitura: nenhuma nova consulta de CPF/CNPJ, emissao paga, compra, mensagem a fornecedor, alteracao funcional, configuracao privada, banco ou deploy. A implementacao e os testes reais autorizados posteriores estao registrados na atualizacao local acima.
- Tribunal estadual/TJ, Fazenda estadual/SEFAZ, TRF e TRT sao grupos diferentes. Os totais gerais de consultas por UF nao representam quantidade de certidoes do TJ.
- [CSV das 27 UFs](certificate-audit-20261016.csv): catalogo CPF/CNPJ, fonte por tipo, oferta atual da Direct Data, evidencia historica e proximo passo.

## Cobertura oferecida em producao na fotografia inicial

| UF | Opcoes CPF | Documentos e fonte |
| --- | ---: | --- |
| AP | 2 | Civel e criminal: Direct Data |
| DF | 4 | Civel, criminal, falencia/recuperacao e especial civel/criminal: portal oficial |
| ES | 6 | Civel, criminal e falencia/recuperacao: portal; familia, fiscal e militar: Direct Data |
| GO | 2 | Civel e criminal: Direct Data |
| PA | 2 | Civel e criminal: Direct Data |
| PE | 3 | Civel, criminal e judicial para fins eleitorais: Direct Data |
| PI | 3 | Civel/execucao civel, criminal/auditoria militar e unificada para fins eleitorais: Direct Data |
| RR | 3 | Criminal, militar e concordata/falencias: Direct Data |
| RS | 1 | Alvara de folha corrida: Direct Data |
| TO | 4 | Civel e criminal: portal; fiscal e falencia/recuperacao: Direct Data |
| Total | 30 | 9 opcoes de portal, 21 de Direct Data |

Sem certidao TJ autonoma habilitada: **AC, AL, AM, BA, CE, MA, MG, MS, MT, PB, PR, RJ, RN, RO, SC, SE e SP**. Isso nao significa inexistencia do servico oficial nessas UFs.

Na homologacao de setembro, AC/AM/BA/CE/MT/PB/RN/SP retornaram503; AL500; MA/MG/PR/RJ/RO/SC400; MS/SE excederam prazo. Sao resultados historicos, nao diagnosticos atuais dos fornecedores.

Na fotografia inicial, RS oferecia apenas alvara, nao certidao civel ou pesquisa criminal integral. Em RR houve divergencia entre parametros solicitados e titulos recebidos; o catalogo reflete os PDFs efetivamente validados e o coletor verifica o titulo. A certidao judicial para fins eleitorais nao equivale a quitacao eleitoral do TSE. Nenhuma UF deve ser descrita como integralmente coberta apenas por ter uma linha nesta tabela.

## Direct Data atual

O [catalogo tecnico](https://www.directd.com.br/central-de-ajuda/apis/catalogo/TJCertidaoCivelCriminalFiscal) anuncia17UFs e o [produto comercial](https://www.directd.com.br/apis/tj-certidao-civel-criminal-fiscal) anuncia18. A divergencia e AP: ha PDFs historicos no app e oferta comercial, mas AP nao consta na lista tecnica atual. E uma inconsistencia documental, nao falha de emissao comprovada.

- Na fotografia inicial, anunciadas e ainda nao liberadas no app: **AC, AM, BA, CE, MT, PB, RN e SE**. BA e SE tiveram ampliacao local posterior, conforme o inicio deste documento.
- Nao anunciadas nas duas listas: **AL, MA, MG, MS, PR, RJ, RO, SC e SP**.
- Rota de emissao: `GET /api/TJCertidaoCivelCriminalFiscal`, com CPF ou CNPJ, UF e TIPO. Os sete tipos do schema nao garantem disponibilidade de cada combinacao PJ/UF.
- A pagina comercial confirma PJ para falencia, recuperacao e execucoes fiscais. Nascimento/filiacao/RG opcionais no schema global nao dispensam requisitos especificos do tribunal.

O [OpenAPI publico](https://apiv3.directd.com.br/swagger/v3-scalar/swagger.json), HTTP200 com158rotas, possui um unico endpoint de emissao TJ. O enum generico de27UFs nao comprova atendimento nacional. Nao foi encontrada outra rota de certidao TJ que feche as nove lacunas acima.

`TribunalJustica` retorna dados de processos, sem comprovante, para PE/PI/SC/SP. `ProcessosJudiciaisAgrupada`, `Completa` e `Simplificada` aceitam CPF/CNPJ no schema; na fotografia inicial, as duas primeiras estavam limitadas a CPF no catalogo Audita. A homologacao PJ posterior das consultas agrupada/completa esta registrada no inicio; nao substituem certidao oficial ou autos.

Preco publico da certidao: R$0,36 por consulta. A estimativa interna R$0,54 com PDF usa sobretaxa de50% registrada em setembro; a sobretaxa nao foi reconfirmada publicamente hoje. `GERARCOMPROVANTE` solicita um arquivo; o aceite continua dependendo de conferir documento, identidade, titulo e alcance.

A validade deve vir do PDF e do tribunal. Os90dias genericos do anuncio nao substituem o prazo de30dias informado pelo TJDFT.

## Historico: por que o CNPJ nao tinha certidoes TJ

| Camada | Restricao observada no inicio |
| --- | --- |
| `services/seller-state-plan.mjs:27` | Plano PJ recebe `certificates=[]` |
| `certificate-selection.js:16` | Selecao de tribunais somente CPF |
| `app.js:6693` | Selecao estadual vazia para PJ |
| `server.mjs:3993` | Rejeita selecao de tribunal para empresa |
| `services/state-court-autonomous.service.mjs:57` | Coletor rejeita tipo diferente de CPF |
| Mesmo coletor, linha76 | Chamada ao provedor fixa CPF |
| `data/state-court-autonomous.json` | Homologacao exclusiva CPF |

O conector `services/direct-data-certificates.service.mjs` ja validava e enviava CNPJ. Na etapa inicial, o teste de envio PJ era simulado e nao provava emissao real; a homologacao real posterior esta registrada no inicio. O catalogo generico de portais declara CNPJ em24UFs, mas adapters e fluxo autonomo tem restricoes adicionais, portanto esse numero nao e cobertura comercial.

O [TJDFT](https://www.tjdft.jus.br/carta-de-servicos/servicos/certidoes/emitir-nada-consta) documenta CNPJ nas certidoes civel, criminal, especial e falencia. Foi escolhido para o piloto PJ por ja haver adapter proprio e teve os quatro tipos homologados nesta rodada. Certidoes nao emitidas automaticamente podem depender de analise humana.

O [TJSP](https://www.tjsp.jus.br/Certidoes/Certidoes/CertidoesDuvidasFrequentes) tambem documenta nome empresarial/CNPJ. O [portal atual](https://www.tjsp.jus.br/certidoes) exige considerar a complementaridade SAJSGC/eproc; a existencia de um PDF de um sistema nao assegura cobertura de todos os processos aplicaveis.

## DataJud CNJ

A API publica possui chave publicada, endpoints dos27TJs e metadados de processos. O [glossario](https://datajud-wiki.cnj.jus.br/api-publica/glossario/) nao expoe identificacao de partes por CPF/CNPJ nem autos em PDF. Pode enriquecer um numero CNJ conhecido, mas nao resolve descoberta por documento nem emissao de certidoes.

O [termo atualmente ligado pela wiki](https://datajud-wiki.cnj.jus.br/api-publica/termo-uso/) e o [PDF V1.2 de27/11/2023](https://formularios.cnj.jus.br/wp-content/uploads/2023/11/Termos-de-uso-api-publica-V1.2.pdf). Pagina1, itens3.3/3.8 restringem uso comercial e exploracao de informacoes derivadas;3.6 nao garante precisao, integridade ou atualidade. O limite120requisicoes/minuto e a ressalva de autorizacao escrita do item3.13, pagina2, nao constituem permissao comercial.

Nao incorporar essa API ao produto pago sem esclarecer formalmente o enquadramento com o CNJ. Ser publica/gratuita nao autoriza automaticamente sua revenda dentro da Audita.

## Jusbrasil e Judit

| Fonte | Uso potencial | Condicao importante |
| --- | --- | --- |
| Jusbrasil Consulta PRO | Descobrir processos por CPF/CNPJ, consultar movimentacoes e aprofundar casos | API comercial por contrato/token; limite padrao100processos mais recentes, com total informado e expansao comercial a negociar |
| Autos Jusbrasil | Baixar pecas/arquivos dos casos selecionados | Modulo, custo e cobertura adicionais; salvar arquivos privadamente antes de expirar URL |
| Judit | Historico por documento, coleta atualizada e captura de anexos | API comercial; base historica e captura no tribunal sao entregas diferentes; cobranca de captura e limites devem entrar na proposta |

Fontes: Jusbrasil [contratacao](https://api.jusbrasil.com.br/docs/introducao/como_contratar.html), [CPF/CNPJ](https://api.jusbrasil.com.br/docs/consulta_processual_por_cpf_cnpj/como_consultar.html), [autos](https://api.jusbrasil.com.br/docs/autos_processuais/index.html), [cobertura](https://api.jusbrasil.com.br/docs/referencias/cobertura_fontes.html); Judit [introducao](https://docs.judit.io/introduction/introduction), [consultas/anexos](https://docs.judit.io/requests/requests), [cobertura](https://docs.judit.io/resource/courtCoverage).

Nenhuma dessas documentacoes comprova servico de certidao oficial negativa por27UFs. Descoberta ordinaria nao equivale a acesso livre a processos sigilosos; acesso restrito exige autorizacao e recursos especificos do fornecedor. Precos contratuais nao foram obtidos nesta auditoria.

## ProcessOnline como parceiro

O [programa B2B](https://processonline.com.br/parceiros) oferece integracao para entregar copias integrais, sandbox e preco por volume. E candidato a piloto para aprofundar processos encontrados, sujeito a aprovacao e homologacao da entrega.

A [API](https://processonline.com.br/api) documenta busca CPF/CNPJ, verificacao CNJ gratuita, pedido de copia e webhook. Busca bem-sucedida custa1credito; cada copia custa outro. Download expira, retencao e7dias e processos grandes podem vir divididos em partes de ate200MB. Sandbox usa exemplos; acesso B2B depende de aprovacao.

Os [termos](https://processonline.com.br/terms) descrevem copias de fontes publicas, exclusao de segredo de justica e devolucao como saldo quando falha. Prazos dependem do tribunal e podem levar horas, sem garantia universal de entrega imediata.

Na [tabela publica de varejo](https://processonline.com.br/),1credito custaR$24,99;10custamR$210;30custamR$507;50custamR$747. Por inferencia de consumo, busca mais uma copia usam2creditos: R$49,98 na compra avulsa ou R$29,88 ao custo unitario do pacote50. Nao sao precos B2B confirmados e nao incluem IA, armazenamento ou outros fornecedores.

Sua documentacao de API nao comprova emissao de certidao oficial de objeto e pe. O [TJDFT descreve essa certidao](https://www.tjdft.jus.br/carta-de-servicos/servicos/certidoes/objeto-e-pe) como documento emitido pela unidade judicial. Copia dos autos, resumo da IA e certidao oficial devem aparecer como entregas distintas.

Aplicacao proposta: identificar os processos relevantes, deixar o cliente escolher quais aprofundar, obter todas as partes dos autos, verificar integridade/atualizacao e gerar analise financeira/juridica documental pela Audita. A consulta de regularidade por certidao oficial continua no fluxo proprio. Os arquivos de ate200MB por parte ultrapassam o limite atual de anexo comum do chat; uma integracao exige processamento dedicado em lotes e armazenamento privado, nao upload ao chat como atalho.

## Ordem de trabalho recomendada

1. Ampliar a homologacao PJ alem das seis UFs comprovadas nesta rodada, por tipo. Verificar CNPJ/razao social, titulo, instancia, assinatura/codigo, prazo e alcance. Liberar somente combinacoes comprovadas, preservando autenticacao, isolamento e consentimento.
2. Retestar as oito UFs ofertadas mas nao habilitadas; esclarecer AP. Para as outras nove, mapear emissao oficial e alternativas de certidao, sem substituir por JSON processual.
3. Homologar dados processuais por CNPJ. Comparar a expansao da Direct Data com propostas Jusbrasil/Judit, incluindo total, paginacao, atraso, registros sigilosos e custo de falha.
4. Solicitar sandbox/proposta ProcessOnline e validar processo simples, volumoso/multipartes, indisponivel e restrito; identidade, webhook, idempotencia, saldo, prazo e retencao. Nenhuma conta foi criada nem fornecedor contatado nesta etapa.
5. Fechar custo por entrega e tratamento da coleta parcial antes de escalar a venda. Reaproveitar a carteira existente requer regra idempotente especifica para valor nao entregue.

## Verificacoes da auditoria inicial somente leitura

- Producao e catalogo lidos sem sessao:30opcoes,10UFs,9portal/21DirectData,0TJparaPJ. Correspondencia com o catalogo local conferida por assertions.
- OpenAPI Direct Data consultado sem token e sem CPF/CNPJ:HTTP200,158rotas. Metadados publicos de evidencia em `tmp/certificate-audit-public-snapshot.json` e `tmp/direct-data-openapi-audit.json` no worktree.
- Termo CNJ V1.2 obtidoHTTP200 e lido em memoria; tres paginas.
-36testes existentes de coletor autonomo, conector Direct Data, API e documentos do vendedor passaram com provedores simulados/PGlite. Eles conferem contratos e isolamento; nao substituem homologacao real de emissao.
- Auditoria documental, sem mudanca de comportamento ou publicacao.

Verificação final: as três certidões nativas ES/CPF também retornaram PDFs oficiais com identidade e título/UF conferidos. O dado materno inicialmente extraído de um documento histórico era um placeholder; foi resolvido a partir da certidão AP do mesmo titular. O adaptador agora informa campos rejeitados pelo tribunal imediatamente, sem alterar nomes nem aguardar o prazo de resultado. Evidências nativas preservadas no armazenamento privado principal.
