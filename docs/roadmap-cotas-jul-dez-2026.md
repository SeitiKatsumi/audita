# Roadmap de cotas - julho a dezembro de 2026

Atualizado em: 2026-07-16

## 1. Decisao de escopo

Este plano considera como compromisso ate dezembro os oito modulos priorizados no cronograma "IA Audita Imovel Corporate":

1. Auditoria de imobilizados e certidoes.
2. Gestao e auditoria de locacoes.
3. Itau - ressarcimento de cobrancas indevidas.
4. Dinheiro esquecido PIS/PASEP.
5. Credito de ICMS - energia eletrica e TUST/TUSD.
6. Imposto de Renda - devolucao e isencao.
7. Analise automatica de decisoes e sentencas.
8. Tabela de incidencia de processos / GDF.

O documento de origem tambem inclui outros produtos completos: SVR, Open Finance, arvore familiar, data lake de 5 milhoes de CPFs, peticoes, album infantil, engenharia de plantas, pericias, NBR 14653 e ambiente de curso. Esses itens nao estao incluidos no compromisso de dezembro. Eles formam uma carteira de 2027 e precisam de estimativa propria.

## 2. Premissas da estimativa

- Uma cota equivale a uma hora de trabalho produtivo.
- Cada pacote tem entre 16 e 64 cotas.
- A estimativa cobre MVPs operacionais, integracoes reais quando houver acesso e validacao em producao.
- Espera por contrato, credencial, resposta de orgao ou homologacao nao consome cota, mas pode bloquear a data de entrega.
- A estimativa base e de 1.904 cotas.
- Recomenda-se uma reserva de risco de 384 cotas, liberada apenas quando usada.
- Teto recomendado: 2.288 cotas ate dezembro.
- Para cumprir o calendario, recomenda-se uma equipe de tres pessoas, com competencias de backend/dados, frontend/produto e IA/QA. Uma unica pessoa nao consegue concluir os oito modulos ate dezembro.

## 3. Diagnostico tecnico das APIs

| Modulo | Caminho de integracao | Dificuldade | Principal risco |
| --- | --- | --- | --- |
| Imobilizados e certidoes | Collectors atuais, DataJud, Serasa/Quod ou integrador contratado, fontes oficiais | Alta | DataJud entrega metadados, nao certidoes; CNIB/ONR nao esta aberta diretamente para a Audita; captchas e portais mudam |
| Locacoes | Upload de contrato, OCR/LLM, regras, IPCA via IBGE e indices licenciados quando necessario | Media | Contratos heterogeneos, IGP-M/licenciamento e necessidade de validacao juridica |
| Itau/cobrancas | PDF, OFX e CSV no MVP; Open Finance apenas por parceiro regulado | Media-alta | Audita nao pode receber dados diretamente do Open Finance sem instituicao/parceiro autorizado |
| PIS/PASEP | Jornada assistida no Repis Cidadao e captura de evidencia autorizada | Media-alta | Login gov.br e ausencia de API publica para consulta automatica do cidadao |
| ICMS energia | XML/PDF NF3e fornecido pelo cliente, parser, OCR e motor tributario | Alta | Variacao estadual, tese tributaria, historico de faturas e validacao contabil |
| IR devolucao/isencao | Upload de informes, declaracoes e laudos; regras Lei 7.713/88; calculadora SELIC | Media-alta | Dados de saude sensiveis, e-CAC sem API privada aberta e necessidade de revisao profissional |
| Decisoes/sentencas | DataJud para metadados e corpus publico/fornecido para inteiro teor | Alta | DataJud nao entrega todo o teor decisorio; risco de conclusao juridica sem evidencia ou avaliacao |
| Incidencia/GDF | Dados abertos PGFN, fontes TJDFT/GDF, normalizacao e matching | Alta | Dados incompletos, identificadores mascarados e viabilidade juridica da compensacao |

## 4. Cotas por modulo

| Bloco | Cotas base | Entrega de dezembro |
| --- | ---: | --- |
| Fundacao compartilhada | 192 | Banco duravel, jobs, creditos, auditoria, secrets, normalizacao e criterios de aceite |
| 1. Imobilizados e certidoes | 256 | Consulta consolidada, fontes atuais estabilizadas, DataJud como metadado e provedor comercial plugavel |
| 2. Locacoes | 240 | Upload, extracao, reajustes, alertas contratuais, revisao humana e relatorio |
| 3. Itau/cobrancas | 192 | Analise por PDF/OFX/CSV, classificacao de cobrancas, calculo e relatorio; Open Finance fica plugavel |
| 4. PIS/PASEP | 144 | Consulta assistida, evidencia, elegibilidade e relatorio; sem bypass de gov.br |
| 5. ICMS energia | 224 | Ingestao NF3e/PDF, normalizacao, calculo delimitado e relatorio validado |
| 6. IR | 160 | Triagem Lei 7.713/88, calculadora, laudo preliminar e controles de privacidade |
| 7. Decisoes/sentencas | 240 | MVP para tribunal e tese selecionados, com citacoes, avaliacao e incerteza explicita |
| 8. Incidencia/GDF | 192 | Pipeline PGFN/TJDFT/GDF, matching, calculadora e painel piloto |
| Hardening final | 64 | Regressao, seguranca, carga, observabilidade, runbook e deploy |
| **Total base** | **1.904** | |
| Reserva de risco (20%) | 384 | Uso condicionado a mudanca de API, homologacao e retrabalho |
| **Teto recomendado** | **2.288** | |

## 5. Distribuicao mensal

### Julho - fundacao e congelamento de escopo

| Pacote | Cotas |
| --- | ---: |
| Banco, filas/jobs, ledger de creditos e idempotencia | 64 |
| LGPD, autorizacao, auditoria, retencao e segregacao | 48 |
| Contrato comum de connectors, secrets e JSON normalizado | 32 |
| Spikes de API e criterios de aceite dos oito modulos | 32 |
| **Base julho** | **176** |
| Reserva mensal sugerida | 32 |
| **Teto julho** | **208** |

### Agosto - concluir o nucleo imobiliario e iniciar locacoes

| Pacote | Cotas |
| --- | ---: |
| Estabilizar certidoes atuais e regressao dos tribunais | 64 |
| Adapter DataJud e normalizacao de metadados processuais | 48 |
| Adapter Serasa/bureau de credito contratado | 48 |
| Adapter de indisponibilidade via provedor contratado | 48 |
| Ingestao e OCR de contratos de locacao | 48 |
| Extracao estruturada de contratos com IA | 48 |
| Apoio tecnico a contrato, credenciais e homologacao | 16 |
| **Base agosto** | **320** |
| Reserva mensal sugerida | 64 |
| **Teto agosto** | **384** |

### Setembro - locacoes, Itau e preparacao das fontes bloqueadas

| Pacote | Cotas |
| --- | ---: |
| Relatorio consolidado, risco e testes do modulo imobiliario | 48 |
| Motor de reajustes e indices de locacao | 48 |
| Regras de garantia, prazo, renovacao e passivos | 48 |
| Interface de revisao e testes de locacoes | 48 |
| Ingestao de extratos PDF, OFX e CSV | 48 |
| Taxonomia e deteccao de cobrancas indevidas | 48 |
| Descoberta e UX oficial do Repis Cidadao | 32 |
| Inventario inicial de fontes PGFN/TJDFT/GDF | 16 |
| **Base setembro** | **336** |
| Reserva mensal sugerida | 64 |
| **Teto setembro** | **400** |

### Outubro - cobrancas, PIS/PASEP e energia

| Pacote | Cotas |
| --- | ---: |
| Calculo e relatorio de ressarcimento Itau | 48 |
| Workflow, interface e testes do modulo Itau | 48 |
| Sessao assistida gov.br/Repis, sem bypass | 48 |
| Captura e validacao de evidencia PIS/PASEP | 32 |
| Elegibilidade, relatorio e testes PIS/PASEP | 32 |
| Ingestao NF3e/XML/PDF de energia | 48 |
| Normalizacao de faturas e componentes tarifarios | 48 |
| Ingestao segura de documentos medicos e tributarios | 32 |
| **Base outubro** | **336** |
| Reserva mensal sugerida | 64 |
| **Teto outubro** | **400** |

### Novembro - ICMS, IR e corpus judicial

| Pacote | Cotas |
| --- | ---: |
| Motor de calculo ICMS/TUST/TUSD delimitado | 64 |
| Relatorio, validacao contabil e testes de ICMS | 64 |
| Motor de regras da Lei 7.713/88 | 48 |
| Calculadora de retroativo e SELIC | 32 |
| Relatorio, privacidade e testes do modulo IR | 48 |
| Selecao e ingestao do corpus judicial piloto | 48 |
| Loader inicial de dados PGFN/TJDFT/GDF | 32 |
| **Base novembro** | **336** |
| Reserva mensal sugerida | 64 |
| **Teto novembro** | **400** |

### Dezembro - inteligencia processual, GDF e producao

| Pacote | Cotas |
| --- | ---: |
| Segmentacao de decisoes e citacoes verificaveis | 48 |
| RAG/classificador de resultado do piloto | 64 |
| Benchmark e avaliacao por especialista juridico | 48 |
| Interface e relatorio da analise de decisoes | 32 |
| Complemento dos loaders GDF | 16 |
| Normalizacao e matching divida ativa x precatorio | 48 |
| Calculadora de desagio | 32 |
| Dashboard e testes do piloto GDF | 48 |
| Hardening transversal e deploy final | 64 |
| **Base dezembro** | **400** |
| Reserva mensal sugerida, em dois pacotes de 48 | 96 |
| **Teto dezembro** | **496** |

## 6. Caminho critico e prazos de decisao

| Data limite | Entrada necessaria | Consequencia se faltar |
| --- | --- | --- |
| 24/07 | Congelar os oito MVPs e excluir os aditivos paralelos | O cronograma deixa de ter linha de chegada |
| 31/07 | Escolher e contratar bureau/Serasa e provedor de indisponibilidade | Os adapters de agosto ficam apenas prontos para credenciais, sem consulta real |
| 07/08 | Entregar 20 a 30 contratos de locacao anonimizados e regras juridicas | Extracao e regras nao podem ser avaliadas |
| 01/09 | Entregar amostras Itau em PDF/OFX/CSV e matriz de cobrancas | O modulo so tera importador, sem decisao confiavel |
| 15/09 | Aceitar que Repis sera assistido enquanto nao existir API contratada | PIS/PASEP nao podera ser prometido como automatico |
| 01/10 | Entregar faturas NF3e/XML/PDF e contador responsavel | Motor de ICMS nao pode ser homologado |
| 15/10 | Entregar casos IR anonimizados e advogado/revisor | Laudo fica demonstrativo, nao validado |
| 01/11 | Definir tribunal, tema e conjunto rotulado do piloto judicial | Nao existe analise nacional confiavel ate dezembro |
| 15/11 | Validar fontes e regra juridica para GDF/precatorios | Matching vira apenas exploracao de dados |

## 7. Criterios de conclusao

Um modulo so sera marcado como concluido quando tiver:

1. Fonte real ou documento real autorizado; nenhum mock.
2. Contrato JSON versionado e rastreavel.
3. Estado explicito para sucesso, nada encontrado, pendencia, indisponibilidade e erro.
4. Evidencia de origem, data/hora e identificador mascarado.
5. Testes unitarios e de integracao.
6. Validacao por especialista quando houver calculo juridico, contabil, tributario ou medico.
7. Controle de creditos e trilha de auditoria.
8. Teste de producao e runbook operacional.

## 8. O que nao pode ser prometido como API simples

- DataJud nao emite certidao e nao substitui os portais dos tribunais.
- CNIB/ONR nao esta disponivel diretamente para a Audita no modelo empresarial solicitado; um integrador privado precisa ser contratado.
- Codigos de indisponibilidade de bureau sao indicadores e nao devem ser vendidos como certidao oficial CNIB sem confirmacao contratual.
- SVR e Repis exigem autenticacao gov.br; nao ha base para prometer extracao autonoma de dados privados.
- Open Finance direto exige uma instituicao participante autorizada ou parceiro regulado.
- e-CAC, historico de IR e dados medicos devem entrar por jornada autorizada e controles reforcados.
- DataJud publico oferece metadados. Analise de sentencas exige inteiro teor licito, corpus definido e avaliacao.

## 9. Capacidade

- Uma pessoa ate dezembro: aproximadamente 880 cotas. Entrega realista: fundacao e modulos 1, 2 e 3.
- Duas pessoas: aproximadamente 1.760 cotas brutas. Ainda faltaria margem para fechar os oito modulos.
- Tres pessoas: aproximadamente 2.640 cotas brutas. E a configuracao minima recomendada para executar 1.904 cotas e absorver parte da reserva.

## 10. Backlog separado para 2027

Os itens abaixo sao produtos independentes e nao devem ser escondidos dentro das estimativas dos oito modulos:

- SVR completo e Open Finance por parceiro regulado.
- Data lake nacional e pre-carga de milhoes de CPFs.
- Arvore familiar e investigacao sucessoria em cascata.
- Peticoes juridicas automatizadas.
- Album infantil e validacao de atividades.
- Engenharia de plantas, quantitativos e acompanhamento de obras.
- Pericias por visao computacional e NBR 14653.
- Ambiente de curso, sandbox de alunos e certificacao.

Estimativa preliminar desse backlog adicional: 2.400 a 4.000 cotas, fora custos de dados, licencas, especialistas e homologacoes. A faixa so deve ser refinada depois de cada produto ter usuario, entrada, saida, fonte de dados e criterio de aceite definidos.

## Referencias tecnicas

- [Documento de escopo](https://docs.google.com/document/d/1TBqnWDWQ0t9HGwpvFStwzjJ87gQYVsDe9QCbj_rdxSY/edit?tab=t.0)
- [API Publica DataJud](https://datajud-wiki.cnj.jus.br/api-publica/acesso/)
- [Sistema de Valores a Receber](https://www.bcb.gov.br/meubc/valores-a-receber)
- [Repis Cidadao](https://www.gov.br/pt-br/servicos/consultar-saldo-de-cotas-pis-pasep)
- [Participacao no Open Finance](https://www.bcb.gov.br/estabilidadefinanceira/openfinance_participantes)
- [Portal de Integracao Serasa](https://www.serasaexperian.com.br/portal-integracao/)
- [Dados abertos PGFN](https://www.gov.br/pgfn/pt-br/assuntos/divida-ativa-da-uniao/transparencia-fiscal-1/arquivos-dados-abertos)
- [API de agregados IBGE](https://servicodados.ibge.gov.br/api/docs/agregados?versao=3)
- [NF3e](https://dfe-portal.svrs.rs.gov.br/NF3E)
- [Isencao de IR por molestia grave](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/preenchimento/molestia-grave)
