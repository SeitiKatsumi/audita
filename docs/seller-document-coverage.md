# Documentos e consultas da análise do vendedor

Validação em 28/09/2026. Registro da ampliação solicitada após a [reunião Audita de 25/09/2026](https://docs.google.com/document/d/1FhORlCTOSrDy76PkURCpbzE00o-TtZgzhvAowStRYEQ/edit).

**Integrado e verificado na main local, em `localhost:3000`.** A conferência registrou saúde HTTP 200, banco pronto, autenticação exigida e cobertura de 100 consultas da ampliação, além das 30 certidões estaduais anteriores. A suíte completa registrou 500 testes aprovados; outros 45 testes pertinentes passaram após a correção final de concorrência nas consultas pagas. Esta entrega é local; publicação no GitHub e implantação em produção são etapas separadas.

Pesquisa aberta sobre o vendedor na internet, Jusbrasil e redes sociais estão fora desta rodada. A consulta à documentação oficial dos provedores e órgãos serve para validar as integrações.

## Visão principal por UF

A aba [Cobertura por UF](https://docs.google.com/spreadsheets/d/1myQG7FETZWMqPXPcaDNkYYPEWU3KJRRkX0QketehcnY/edit?gid=1830460901#gid=1830460901) é a visão principal consolidada: reúne, nas 27 UFs, os documentos e consultas disponíveis para CPF e para cada CNPJ, com totais separados e limitações. A aba [Cobertura de documentos](https://docs.google.com/spreadsheets/d/1myQG7FETZWMqPXPcaDNkYYPEWU3KJRRkX0QketehcnY/edit?gid=1989173279#gid=1989173279) conserva o detalhe por fonte, produto e resultado de validação.

A exportação da visão principal foi conferida: 27 linhas de UFs, 13 colunas e fórmulas de total, com filtro em A1:M28 e congelamento em C2. Os valores das outras cinco abas foram preservados.

O [CSV por UF](seller-uf-coverage.csv) é gerado por [`scripts/export-seller-uf-coverage.mjs`](../scripts/export-seller-uf-coverage.mjs) a partir dos dois catálogos validados. A contagem segue estes critérios:

- Cada opção nacional conta uma vez em cada UF e perfil aplicável. TRFs e TRTs contam somente nas UFs de sua jurisdição; TRT2 e TRT15 atendem áreas diferentes de SP.
- CPF e CNPJ ficam separados. O total por CNPJ inclui cadastro/QSA gratuito e representa as opções para cada empresa selecionada; a validação de CPF não habilita automaticamente CNPJ.
- Produtos municipais só se aplicam às cidades nomeadas na linha: Aracaju, Goiânia, Lajes e São Bento do Norte para CPF; São Paulo para CNPJ. A presença na UF não estende a cobertura aos demais municípios nem comprova quitação do imóvel.
- A soma das linhas representa **301 ocorrências de cobertura para CPF e 152 para CNPJ**, incluindo a repetição geográfica das opções nacionais e regionais. **Esses números não são produtos distintos**, nem a quantidade a executar para qualquer vendedor. O catálogo da ampliação continua com 100 opções, além das 30 certidões anteriores dos TJs e do cadastro/QSA gratuito.

## Resultado da validação das fontes

O [catálogo da ampliação](../data/seller-document-coverage.json) contém **100 consultas homologadas: 69 para CPF e 31 para CNPJ**. São **90 certidões oficiais em PDF**, **três comprovantes de consulta em PDF** e **sete consultas de dados sem PDF liberado**. Os produtos de CNPJ são executados por empresa selecionada; não são automaticamente consultas adicionais ao CPF do vendedor.

| Público | Certidões oficiais em PDF | Comprovantes de consulta em PDF | Dados sem PDF liberado | Total de consultas |
| --- | ---: | ---: | ---: | ---: |
| CPF do vendedor | 59 | 3 | 7 | 69 |
| Cada CNPJ selecionado | 31 | 0 | 0 | 31 |
| Catálogo da ampliação | 90 | 3 | 7 | 100 |

As **30 certidões anteriores dos tribunais estaduais em 10 UFs** permanecem no catálogo próprio, para CPF. A consulta gratuita de cadastro/QSA dos CNPJs informados também permanece disponível, fora das 100 opções acima. Homologação significa que a emissão/consulta e o alcance foram conferidos com dados autorizados; não garante resposta permanente, resultado negativo ou investigação completa.

A certidão fiscal do Acre e as duas certidões do TRF5 foram recuperadas pelo histórico da consulta após o tempo limite inicial, sem tratar a ausência de resposta imediata como falha definitiva. As fontes homologadas estão na versão consolidada de `localhost:3000`, conforme o catálogo e as limitações deste documento.

## Escopo solicitado e evidência

| Ponto da reunião | Caminho e evidência atual | Limites e pendências |
| --- | --- | --- |
| Certidões dos tribunais estaduais | Integração existente: portais oficiais e Direct Data, com PDFs conferidos. Matriz em [Certidões estaduais autônomas](state-court-autonomous.md). | Cobertura por UF e tipo; não equivale à pesquisa de todos os processos. |
| Fiscal e tributário estadual | Para CPF, PDFs aceitos em **18 UFs**: 17 via Direct Data e PE pelo portal oficial. Para CNPJ, **16 UFs** homologadas em produtos separados. | Cada documento tem alcance próprio; a consulta ao CPF não cobre automaticamente dívidas dos CNPJs relacionados. |
| Receita Federal / débitos com a União | `CertidaoConjuntaDebitosPessoaFisica`: a primeira tentativa excedeu o tempo limite; histórico registrou falha e custo zero. Nova tentativa assíncrona retornou HTTP 500. | Sem PDF validado; não liberada. A consulta cadastral de CNPJ não substitui a CND conjunta RFB/PGFN. |
| Justiça do Trabalho / TST | `TSTCertidaoNegativaDebitosTrabalhistas`: CNDT em PDF, com identidade conferida. | Consulta ao Banco Nacional de Devedores Trabalhistas; não substitui as certidões de distribuição de todos os TRTs. |
| Justiça do Trabalho / TRTs | As 24 regiões foram consultadas para processos eletrônicos. A [matriz trabalhista](seller-labor-coverage.md) registra 22 regiões com PDF e complementos físicos. | Os PDFs têm classes, polos, instâncias e bases próprias. TRT18/GO e TRT21/RN retornaram manutenção; faltas de resposta não equivalem a certidão negativa. |
| Fiscal municipal | Varredura de 31 municípios para CPF: PDFs aceitos em **Aracaju/SE, Goiânia/GO, Lajes/RN e São Bento do Norte/RN**. Para CNPJ, **São Paulo/SP** homologado. [Matriz municipal](seller-municipal-status.csv). | São Paulo retornou sem PDF para CPF; o sucesso de CNPJ não amplia automaticamente a cobertura de CPF. Consulta do contribuinte não comprova IPTU ou quitação do imóvel. |
| Justiça Federal / TRFs | `TribunalRegionalFederal`: PDFs cíveis e criminais dos seis TRFs, **12 para CPF e 12 para CNPJ**. | Conferir sistemas, instâncias e seções incluídos em cada PDF. Não tratar uma certidão regional como certidão nacional irrestrita. |
| FGTS de empresas | Certificado de regularidade do empregador em PDF homologado para CNPJ. | Não substitui CNDT nem distribuição de ações trabalhistas. Respeitar a validade do documento. |
| Protestos nacionais | `ProtestosOnline`: retorno estruturado com identidade da consulta conferida. | Consulta de dados; não foi obtida certidão cartorária em PDF. Abrangência limitada à base consultada pelo provedor. |
| Crédito / Serasa | `DetalhamentoNegativo`: retorno de crédito **QUOD** validado, com identidade conferida no JSON. | Produto QUOD; não é consulta Serasa nem certidão oficial. O alcance é o informado pelo provedor. |
| Vínculos empresariais do vendedor | `VinculosSocietarios`: retorno estruturado validado, com identidade conferida. | Localizar uma empresa não caracteriza dívida, irregularidade ou risco por si só. A pesquisa das dívidas de cada CNPJ é uma consulta adicional. |
| Processos judiciais como complemento | `ProcessosJudiciaisAgrupada` e `ProcessosJudiciaisCompleta`: retornos estruturados homologados para CPF. A tela mostra até 20 detalhes no produto completo e omite segredo de justiça. | Consulta da API contratada; não envolve Jusbrasil ou pesquisa aberta na internet. Não substitui as certidões dos tribunais nem comprova cobertura integral de processos. |
| Cadastro de CNPJ e quadro societário | Consulta pública dos CNPJs informados, sem tarifa da Direct Data. As certidões pagas da empresa são selecionadas à parte, por produto e CNPJ. | Dados cadastrais e QSA não comprovam regularidade fiscal e não são certidão da Junta Comercial. Não há busca automática de empresas nesse caminho gratuito. |
| Certidões de juntas comerciais | Sem documento oficial validado nesta rodada. | Cadastro/QSA são informações complementares; certidões simplificadas, específicas e de inteiro teor exigem homologação própria. |
| Matrícula e consultas ONR / registro de imóveis | Adapter e documentação preexistentes; sem nova emissão validada nesta rodada. | Dependência de acesso contratado e produto autorizado. O [dossiê ONR](onr-credenciamento-dossie.md) registra restrições de acesso; existência de código/WSDL não comprova disponibilidade comercial. |
| Indisponibilidade de bens / CNIB | Fluxo e fornecedores já investigados; sem nova certidão oficial validada nesta rodada. | Na reunião, discutiu-se obtenção externa e envio para análise. Não apresentar cadastro, protesto ou consulta patrimonial como certidão CNIB. |
| Situação do condomínio | Sem integração ou documento validado nesta rodada. | Depende de documentação específica do imóvel/condomínio. |

Eduardo mencionou quatro consultas fiscais por referência ao item 2 de outro relatório, sem dizer os quatro nomes na transcrição. Esta matriz registra os produtos efetivamente testados; não atribui nomes presumidos àquela lista.

## Fiscal estadual: varredura das 27 UFs

Fonte: arquivos privados `output/seller-expansion/cnd-<uf>.summary.json` e, para o caminho oficial de PE, `output/fiscal-official.private/pe-collector.summary.json`, com conferência do texto dos PDFs. Todos os testes desta tabela são de pessoa física. Os códigos HTTP e metadados descrevem a tentativa, não impossibilidade definitiva de integração.

| UF | Estado | Resultado observado | Liberação fiscal nesta rodada / próximo passo |
| --- | --- | --- | --- |
| AC | Acre | PDF recuperado pelo histórico após tempo limite; CPF conferido. | Aceito para débitos da SEFAZ, **excetuada dívida ativa**. Exige complemento próprio para dívida ativa. |
| AL | Alagoas | Direct Data: HTTP 200, metadado 2, sem PDF. Alternativa oficial inspecionada exige hCaptcha. | Pendente. Não houve emissão pelo portal; o CAPTCHA impede liberar o fluxo autônomo testado. |
| AM | Amazonas | PDF obtido e CPF conferido. | Aceito dentro do alcance declarado na certidão. |
| AP | Amapá | PDF obtido e CPF conferido. | Aceito dentro do alcance declarado na certidão. |
| BA | Bahia | PDF obtido e CPF conferido. | Aceito dentro do alcance declarado na certidão. |
| CE | Ceará | PDF obtido e CPF conferido. | Aceito dentro do alcance declarado na certidão. |
| DF | Distrito Federal | HTTP 200; operação sem sucesso, metadado 6; sem PDF. | Pendente. Não interpretar HTTP 200 como emissão. |
| ES | Espírito Santo | PDF obtido e CPF conferido. | Aceito dentro do alcance declarado na certidão. |
| GO | Goiás | PDF de dívida ativa, CPF conferido. | Aceito como consulta de dívida ativa. Não estender automaticamente a outros débitos estaduais. |
| MA | Maranhão | PDF obtido e CPF conferido. | Aceito dentro do alcance declarado na certidão. |
| MG | Minas Gerais | HTTP 503; sem PDF. | Pendente por indisponibilidade nesta tentativa. |
| MS | Mato Grosso do Sul | PDF obtido e CPF conferido. | Aceito dentro do alcance declarado na certidão. |
| MT | Mato Grosso | PDF obtido e CPF conferido. | Aceito dentro do alcance declarado na certidão. |
| PA | Pará | HTTP 503; sem PDF. | Pendente por indisponibilidade nesta tentativa. |
| PB | Paraíba | PDF obtido e CPF conferido. | Aceito dentro do alcance declarado na certidão. |
| PE | Pernambuco | Direct Data retornou HTTP 503. Caminho pelo portal oficial SEFAZ-PE emitiu PDF fiscal válido. | Aceito para CPF, sem tarifa da Direct Data. Não compreende débitos com exigibilidade suspensa; preserva a ressalva de valores apurados posteriormente. |
| PI | Piauí | API entregou PDF do Tribunal de Contas. | **Excluído da cobertura fiscal.** O documento recebido não corresponde à CND fiscal solicitada. |
| PR | Paraná | HTTP 503; sem PDF. | Pendente por indisponibilidade nesta tentativa. |
| RJ | Rio de Janeiro | PDF obtido e CPF conferido. | Aceito com ressalva: a documentação fiscal exige complementar a consulta com a PGE para dívida ativa. |
| RN | Rio Grande do Norte | HTTP 200; operação sem sucesso, metadado 6; sem PDF. | Pendente. Não interpretar HTTP 200 como emissão. |
| RO | Rondônia | HTTP 200; retorno estruturado, metadado 2; sem PDF. | Pendente. Recuperar documento oficial ou confirmar o motivo de não emissão. |
| RR | Roraima | PDF obtido e CPF conferido. | Aceito dentro do alcance declarado na certidão. |
| RS | Rio Grande do Sul | PDF obtido e CPF conferido. | Aceito dentro do alcance declarado na certidão. |
| SC | Santa Catarina | PDF obtido e CPF conferido. | Aceito dentro do alcance declarado na certidão. |
| SE | Sergipe | HTTP 503; sem PDF. | Pendente por indisponibilidade nesta tentativa. |
| SP | São Paulo | PDF de débitos tributários não inscritos em dívida ativa, CPF conferido. | Aceito apenas para débitos **não inscritos**. Dívida ativa precisa de consulta complementar. |
| TO | Tocantins | PDF de dívida ativa, CPF conferido. | Aceito como consulta de dívida ativa. Não estender automaticamente a outros débitos estaduais. |

UFs com PDF fiscal aceito para CPF: **AC, AP, AM, BA, CE, ES, GO, MA, MS, MT, PB, PE, RJ, RR, RS, SC, SP e TO**. São **18 aceitas e nove pendentes/excluídas**. Isso não modifica a matriz de certidões dos tribunais estaduais: uma UF pode ter certidão fiscal disponível e continuar pendente no TJ.

A tabela fiscal também está disponível em [CSV para planilha](seller-fiscal-uf-status.csv), sem dados pessoais. O CSV é um espelho documental; não habilita consultas no sistema.

## Justiça Federal

| Região | Cível | Criminal | Observação |
| --- | --- | --- | --- |
| TRF1 | PDF validado | PDF validado | Identidade conferida; respeitar o alcance e as bases descritas no documento. |
| TRF2 | PDF validado | PDF validado | Identidade conferida; respeitar o alcance e as bases descritas no documento. |
| TRF3 | PDF validado | PDF validado | Identidade conferida; respeitar o alcance e as bases descritas no documento. |
| TRF4 | PDF validado | PDF validado | Identidade conferida; respeitar o alcance e as bases descritas no documento. |
| TRF5 | PDF validado | PDF validado | Ambos recuperados pelo histórico após o tempo limite inicial; identidade conferida no PDF. |
| TRF6 | PDF validado | PDF validado | O texto cita bases/sistemas específicos e consultas complementares. O PDF recebido não permite declarar cobertura irrestrita de todos os sistemas, incluindo PJe/eproc. |

Esta matriz foi validada tanto para CPF quanto para CNPJ, em consultas separadas. Evidências privadas: `trf<regiao>-civel.summary.json`, `trf<regiao>-criminal.summary.json`, variantes `-company` e respectivos PDFs/textos. Os documentos cíveis e criminais não equivalem a certidão de quitação eleitoral.

## Empresas relacionadas ao vendedor

As 31 opções para CNPJ compreendem **16 certidões fiscais estaduais, 12 certidões de TRFs, CNDT, FGTS e a certidão municipal de tributos mobiliários de São Paulo**. A seleção é explícita: cada produto escolhido é consultado para cada CNPJ informado, com custo proporcional. O vínculo societário por si só não caracteriza dívida ou irregularidade, e não dispara automaticamente certidões pagas.

UFs fiscais homologadas para CNPJ: **AC, AM, AP, BA, CE, ES, GO, MA, MS, MT, PB, RJ, RR, RS, SC e TO**. SP estadual terminou sem PDF para CNPJ; PE pelo portal foi homologado apenas para CPF. Não ampliar essas coberturas sem nova validação.

SP municipal, RJ estadual e RS estadual identificam a empresa pela raiz do CNPJ no PDF. O aceite exige CNPJ completo correspondente no retorno estruturado e um campo de raiz associado de forma inequívoca por rótulo e posição no documento. O modelo do RS também declara a abrangência de todos os estabelecimentos pela raiz. Um conjunto de oito dígitos encontrado solto no texto não é prova de identidade.

A certidão municipal de São Paulo vale para os estabelecimentos no município, conforme os tributos mobiliários descritos. Não comprova quitação do IPTU nem inscrição no CPOM; a emissão usada na validação declara ausência de estabelecimento inscrito. A [orientação da Prefeitura de São Paulo](https://prefeitura.sp.gov.br/fazenda/w/servicos/certidoes/2394) descreve o uso do CNPJ raiz.

## Complementos fiscais documentados

Estes caminhos foram conferidos na documentação em 28/09/2026. Os resultados aceitos abaixo foram incorporados ao catálogo; as demais possibilidades permanecem pendentes.

| Lacuna | Caminho documentado | Escopo e requisito de validação |
| --- | --- | --- |
| CADIN estadual | Direct Data, [`CADINSecretariaFazendaEstaduais`](https://www.directd.com.br/central-de-ajuda/apis/catalogo/CADINSecretariaFazendaEstaduais). | O catálogo lista **BA, GO, MG, MT, PA, RN e RS**. Recebe CPF/CNPJ e UF, com comprovante opcional. O enum genérico de UF no OpenAPI não comprova disponibilidade nos demais estados. |
| CADIN de São Paulo | Direct Data, [`CADINSecretariaFazendaSP`](https://www.directd.com.br/central-de-ajuda/apis/catalogo/CADINSecretariaFazendaSP). | Endpoint separado, por CPF/CNPJ. CADIN informa pendências na base consultada; não deve ser apresentado automaticamente como certidão de dívida ativa da PGE. |
| Dívida ativa da União | Direct Data, [`PGFNListaDevedoresUniao`](https://www.directd.com.br/central-de-ajuda/apis/catalogo/PGFNListaDevedoresUniao). | A estrutura de retorno lista dívidas, inscrições e totais. Exige validar o resultado concreto; não substitui a certidão conjunta RFB/PGFN apenas porque a descrição comercial menciona CND. |
| Dívida ativa de SP | Não foi localizado endpoint PGE-SP específico no OpenAPI/catalog consultado da Direct Data. A Infosimples documenta emissão de [e-CRDA](https://infosimples.com/consultas/pge-sp-cndt/). | Alternativa ainda não contratada ou testada nesta rodada. Lista CPF/CNPJ e parâmetros de login/certificado; é necessário confirmar quais são exigidos e a emissão efetiva antes de integrar. |
| Dívida ativa do RJ | A [PGE-RJ documenta a Certidão de Regularidade Fiscal](https://www.pge.rj.gov.br/divida-ativa-certidao-de-regularidade-fiscal) de débitos tributários e não tributários inscritos. | O órgão informa prazo de até dez dias para CND; casos de CPEN podem exigir documentos e análise. Não foi localizado endpoint PGE-RJ específico na Direct Data. A [consulta alternativa da Infosimples](https://infosimples.com/consultas/pge-rj-divida-ativa/) descreve dívidas de veículo e não comprova cobertura de CRF geral. |

Os três produtos Direct Data acima têm preço-base documentado de R$ 0,36 por consulta; o comprovante pode acrescentar tarifa. O preço do produto contratado deve ser reconferido no momento da seleção.

Resultado do CADIN nesta rodada: **GO, RS e SP** aceitos como consultas com comprovante; **MG e PA** aceitos apenas como dados estruturados, porque o PDF recebido não teve identidade comprovada. **BA, MT e RN** ficaram sem produto liberado. Nenhum desses resultados equivale a certidão de regularidade fiscal. A tentativa de `PGFNListaDevedoresUniao` terminou sem evidência homologada e continua fora do catálogo.

## Matrículas, ONR e CNIB

Na inspeção desta rodada, a integração ONR estava desabilitada e não havia credenciais operacionais disponíveis para ONR, CBRdoc, BDC ou Juntas. Sete WSDLs responderam HTTP 200, o que confirma a presença das descrições técnicas, mas não a autorização para consultar nem a emissão de documentos.

- O RI Digital documenta a [geração de chave de integração](https://ridigital.org.br/Downloads/GeracaoChavedeIntegracaows.pdf). O próximo passo é habilitar acesso ao produto necessário e testar pesquisa/matrícula com a chave autorizada; o [dossiê de credenciamento](onr-credenciamento-dossie.md) conserva o histórico das restrições comerciais.
- A CNIB oferece [relatório gratuito pessoal](https://indisponibilidade.onr.org.br/home/relatoriogratuito). Esse caminho não comprova consulta autônoma de terceiros pelo módulo.
- A [apresentação oficial da CNIB 2.0](https://www.onr.org.br/onr-anuncia-a-implementacao-da-nova-versao-da-central-nacional-de-indisponibilidade-de-bens-cnib-2-0/) descreve integração com os registradores. O [Swagger SAS](https://api-sas.onr.org.br/swagger/v1/swagger.json) inspecionado trata atualizações por cartórios; não foi identificada ali uma API pública equivalente à pesquisa de vendedor.

Não houve nova emissão ou consulta autorizada por esses acessos nesta rodada. É uma pendência de habilitação e validação do produto, sem conclusão de impossibilidade para todas as UFs.

## Juntas Comerciais: caminhos oficiais identificados

| UF | Serviço oficial | Requisito observado / próximo passo |
| --- | --- | --- |
| SP | [Certidão simplificada JUCESP](https://servicos.sp.gov.br/fcarta/45719f85-04e8-40ab-b179-201459e43b52) | A carta informa gratuidade e emissão imediata, com login da Nota Fiscal Paulista ou certificado digital. O portal de entrada também oferece gov.br. Validar o acesso aceito no fluxo atual e a emissão antes de automatizar. |
| MG | [Solicitar certidões](https://www.mg.gov.br/servico/solicitar-certidoes) | Serviço identificado; autenticação, pagamento e emissão autônoma ainda não homologados nesta rodada. |
| PR | [Certidão simplificada JUCEPAR](https://www.juntacomercial.pr.gov.br/servicos/Servicos/Certidoes/Solicitar-Certidao-Simplificada-de-empresas-nQ3x9zr2) | Requer conta gov.br e pagamento. O órgão informa prazo de até quatro dias úteis; não tratar como emissão instantânea garantida. |
| SC | [Certidão simplificada JUCESC](https://cop.jucesc.sc.gov.br/externo/servicos/certidoes/simplificada.php) | Emissão automática após compensação da guia DARE. Falta homologar o fluxo com acesso autorizado. |
| DF | [Certidões JUCIS-DF](https://www.agenciabrasilia.df.gov.br/web/jucis/certidoes) | A inspeção do fluxo encontrou gov.br, CAPTCHA e pagamento. Ainda sem emissão autônoma validada. |

As demais Juntas não foram investigadas nesta etapa. Cadastro de CNPJ, QSA e vínculos societários complementam a análise, mas não substituem certidões simplificadas, específicas ou de inteiro teor da Junta.

## Custos de referência da ampliação

Valores usados pelo catálogo desta validação; não são conciliação financeira de todas as tentativas.

| Consulta | Valor por item |
| --- | ---: |
| Certidão Direct Data homologada: fiscal, TRF, TRT, municipal, CNDT ou FGTS | R$ 0,54 |
| Regularidade fiscal de PE pelo portal oficial, para CPF | Sem tarifa da Direct Data |
| CADIN GO, RS ou SP, com comprovante | R$ 0,54 |
| CADIN MG ou PA, dados sem PDF liberado | R$ 0,36 |
| Protestos nacionais | R$ 3,50 |
| Vínculos societários | R$ 1,84 |
| Crédito QUOD | R$ 2,38 |
| Processos judiciais agrupados | R$ 1,10 |
| Processos judiciais completos | R$ 3,30 |
| Cadastro e QSA público dos CNPJs informados | Sem tarifa de consulta da Direct Data |

Selecionar todas as **69 opções de CPF** da ampliação soma **R$ 45,78**. Selecionar todas as **31 opções de empresa** soma **R$ 16,74 por CNPJ**. Para um CPF e um CNPJ, as 100 opções somam **R$ 62,52**. São estimativas da seleção, não o total gasto na homologação nem uma cobrança obrigatória de pacote.

Esses valores não incluem as 30 certidões estaduais anteriores: nove usam portais oficiais e 21 usam Direct Data, somando até R$ 11,34 quando todas forem selecionadas. A consulta cadastral para obter filiação, quando necessária, pode acrescentar R$ 0,36. O último saldo observado no painel da Direct Data ao fechar a rodada foi **R$ 4,22**. Preços e saldo devem ser reconferidos no momento de uso.

As estimativas dos arquivos de teste não conciliam a cobrança efetiva do provedor. Falhas, consultas sem documento e respostas HTTP 200 com resultado 6 podem ter cobrança. O custo zero foi confirmado no histórico apenas para a primeira tentativa da CND conjunta de pessoa física citada acima; esse resultado não se estende às outras tentativas.

## Evidência, integração e entrega

- Certidão só é contada como obtida após download, leitura do PDF e conferência da identidade e do escopo. CPF no JSON sem PDF não basta para declarar emissão.
- Alguns documentos fiscais identificam o contribuinte apenas pelo CPF; ausência de nome impresso é distinta de nome divergente. O CPF e o tipo de documento devem corresponder à consulta.
- Consultas de dados são exibidas com fonte, data e alcance. Os três PDFs de CADIN são comprovantes de consulta, contabilizados separadamente das certidões oficiais. Os sete produtos sem PDF liberado permanecem como dados estruturados.
- Falha ou resultado ambíguo permanece individualmente pendente; os demais documentos são preservados. Ausência de documento não significa “nada consta”.
- O catálogo de novas consultas é `data/seller-document-coverage.json`; o catálogo estadual anterior continua em `data/state-court-autonomous.json`. Um teste bem-sucedido não habilita uma opção por si só.
- A interface mantém seleção explícita, estimativa de custo, autorização e histórico. Downloads exigem usuário/tenant proprietário da auditoria; o diretório de PDFs continua privado.
- Os arquivos de evidência ficam em diretório privado ignorado pelo Git. Este documento não contém identidades, números de certidão, tokens ou URLs privadas de comprovantes.
- A cobertura foi conferida na main local/porta 3000. Os PDFs de homologação e a reprodução dos coletores demonstram as fontes aceitas; os testes da interface usam dados e respostas simulados para verificar seleção, custo, resultados e downloads sem repetir cobranças. A matriz não é prova de implantação em produção.

## Limites operacionais restantes

A emissão foi validada com os dados autorizados desta rodada. Variações cadastrais, documentos positivos, indisponibilidade do órgão e casos que exigem análise manual podem impedir uma nova emissão. O módulo coleta documentos e apresenta os retornos; a análise jurídica consolidada de risco por IA continua pendente.

A proteção contra reemissão e a fila de saldo funcionam dentro de um processo do serviço. Antes de operar múltiplas réplicas ou compartilhar cobrança concorrente com outros serviços, é necessária reserva de créditos no banco. Após reinício ou resultado inconclusivo, conferir o histórico do fornecedor antes de repetir uma consulta paga.

Pacote privado de homologação: `output/documentos-vendedor-validados-2026-09-28.zip`, com 123 PDFs (120 certidões e três comprovantes). Esse pacote contém os documentos reais dos testes e não é publicado no Git ou em rota estática.

## Atualização da matriz

Após cada validação, registrar data, produto/UF, resultado da API, presença do documento, identidade, escopo e limitação. Atualizar o catálogo somente para os produtos aceitos e repetir o fluxo de seleção, coleta, histórico e download. Conferir os preços antes de alterar a estimativa exibida ao usuário. Em seguida, gerar novamente o [CSV por UF](seller-uf-coverage.csv) com [`scripts/export-seller-uf-coverage.mjs`](../scripts/export-seller-uf-coverage.mjs) e atualizar a visão principal **Cobertura por UF**, preservando as distinções entre TJ, fiscal, federal, trabalhista, municipal e dados complementares. Editar a planilha não habilita consultas no sistema.

O detalhe por fonte permanece no [CSV de documentos](seller-document-status.csv), [TSV de documentos](seller-document-status.tsv), [matriz fiscal das 27 UFs](seller-fiscal-uf-status.csv) e [matriz municipal com CPF/CNPJ separados](seller-municipal-status.csv). A aba secundária [Cobertura de documentos](https://docs.google.com/spreadsheets/d/1myQG7FETZWMqPXPcaDNkYYPEWU3KJRRkX0QketehcnY/edit?gid=1989173279#gid=1989173279) foi atualizada: 179 registros, oito colunas, filtro e cabeçalho fixo. A exportação dessa aba do Google Sheets foi comparada campo a campo ao CSV e corresponde integralmente; abas anteriores preservadas.
