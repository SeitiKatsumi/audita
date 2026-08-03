# Revisao de cobrancas Itau

## Objetivo desta fase

O modulo ajuda o consumidor a:

1. explicar em conversa qual cobranca despertou a suspeita;
2. enviar somente uma evidencia recente, como print, foto, fatura ou trecho do extrato;
3. localizar seguros, protecoes, garantias e servicos que precisam de confirmacao;
4. informar se reconhece cada contratacao;
5. quando houver sinal concreto, coletar extratos de um periodo maior para medir recorrencia e duracao;
6. registrar sinais adicionais, como cobranca posterior ao cancelamento;
7. usar o acordo coletivo divulgado pelo MPMG apenas como contexto juridico historico;
8. escolher a jornada judicial com ou sem extratos historicos;
9. preparar o Relatorio Tecnico de Auditoria no Modelo 1 ou Modelo 2 e gerar o PDF;
10. informar a UF, abrir o link oficial e seguir o protocolo manual orientado;
11. depois do protocolo, consultar opcionalmente o andamento processual.

O modulo nao decide que uma cobranca e ilegal. O suporte profissional de um
advogado da Audita e uma opcao separada, apresentada somente quando o consumidor
quiser conhece-la. A IA nao contrata, encaminha ou promete atendimento sem
confirmacao expressa. O relatorio organiza a analise e uma minuta para revisao: a IA nao assina nem
protocola, e o envio final permanece com o usuario.

## Triagem guiada no painel

O painel principal tambem oferece o modulo `#analise-cobrancas`, separado do
chat aberto. A navegacao dessa tela e deterministica:

1. o usuario informa por botoes se autorizou expressamente a cobranca, se nao a
   reconhece, se deseja verificar o extrato ou se atua como advogado;
2. titular ou advogado autorizado informa se possui todo o historico, apenas
   alguns documentos/um print recente ou nenhum extrato;
3. no caminho completo, o usuario pode selecionar varias faturas ou extratos;
   no parcial, envia uma evidencia recente; sem documentos, informa descricao,
   valor mensal e duracao aproximada;
4. o modulo reutiliza `POST /api/itau-refund/analyze` para cada documento e pede confirmacao para
   cada lancamento candidato;
5. a interface apresenta uma auditoria preliminar sem inventar juros, dano moral
   ou valor da causa;
6. no caminho parcial ou sem documentos, a simulacao declaratoria fica separada
   dos valores comprovados e calcula somente `valor mensal x meses informados`;
7. ao concluir a auditoria ou a simulacao, o proprio modulo abre a jornada de
   recuperacao, explica os limites do processo, coleta os dados para o Relatorio
   Tecnico de Auditoria e seleciona o Modelo 1 (com historico documental) ou o
   Modelo 2 (sem historico documental), sem redirecionar para o chat;
8. os valores declarados sem extrato permanecem identificados como estimativas
   e nao sao convertidos em evidencia documental;
9. depois do PDF, o usuario escolhe a UF e recebe o passo a passo do tribunal,
   com links oficiais e destaque para as etapas que dependem de acao humana.

A apresentacao usa uma conversa progressiva: as mensagens da Audita sao
reveladas em sequencia, com um estado curto de digitacao, e a resposta escolhida
aparece como balao do usuario antes da proxima etapa. Em dispositivos com
`prefers-reduced-motion: reduce`, os intervalos sao eliminados sem alterar o
conteudo ou a ordem do fluxo.

A lista de 113 nomes fornecida para busca e uma referencia ampliada de triagem,
nao uma afirmacao de cobertura oficial. A presenca de uma marca nessa lista nao
substitui a verificacao do emissor/administrador na fatura e no periodo concreto.
As publicacoes oficiais citam apenas parte dessas marcas, e a peticao coletiva
historica menciona 133 tipos de cartao administrados a epoca, sem validar a lista
ampliada atual como um cadastro oficial completo.

O relatorio visual pode exibir o dobro do total marcado como nao reconhecido
somente como cenario matematico. A aplicacao do art. 42 do CDC, a correcao, os
juros, perdas e danos e o valor da causa dependem do caso concreto e de revisao
juridica. O acordo coletivo divulgado em 2026 preve restituicao simples dentro
de seus criterios proprios.

## Jornada conversacional

- `suspeita`: uma pergunta curta identifica nome, valor ou recorrencia que chamou a atencao.
- `evidencia_recente`: a Audita analisa apenas um documento pequeno para decidir se vale investigar.
- `confirmacao`: o consumidor confirma se reconhece a contratacao encontrada.
- `historico`: somente se houver sinal, a Audita pede os meses necessarios e cria uma linha do tempo consolidada.
- `contexto`: cancelamento, continuidade da cobranca e demais sinais relevantes sao perguntados um por vez.
- `saida`: resumo, evidencias e escolha direta da jornada judicial.
- `jec`: com confirmacao do usuario, coleta os dados em formulario seguro,
  prepara a peticao, gera o PDF e exibe o guia manual da UF.
- `acompanhamento`: depois que existir numero de processo, oferece consulta
  somente leitura via Direct Data quando a UF estiver coberta.

A reclamacao administrativa ao Itau nao integra esta jornada. O prazo definido
para essa frente foi encerrado e o modulo nao deve redigir uma nova reclamacao,
pedir protocolo, aguardar resposta do banco nem usar essas etapas como condicao
para preparar o caminho judicial. Se o consumidor mencionar uma reclamacao
antiga espontaneamente, ela pode ser preservada apenas como evidencia adicional.

A resposta conversacional deve mostrar apenas o proximo passo. Regras completas, fontes e formulario de contexto ficam recolhidos e sao exibidos quando solicitados.

## Duas jornadas documentais

### Com extratos historicos

- a evidencia recente inicia a triagem;
- o painel permite selecionar varias faturas ou extratos para a analise;
- cada arquivo e enviado individualmente ao analisador e os resultados sao
  consolidados na interface, preservando a origem de cada lancamento;
- as cobrancas devem ser organizadas por periodo, sem duplicar lancamentos;
- o laudo e o rascunho usam somente datas e valores comprovados;
- devolucao em dobro, juros, correcao e dano moral dependem de revisao juridica e nao sao presumidos.

### Sem extratos historicos

- a falta dos documentos antigos nao encerra a conversa nem apaga o relato de recorrencia;
- a Audita prepara um rascunho preliminar com a evidencia recente disponivel;
- se existir apenas uma evidencia recente, a interface analisa o documento e
  depois solicita o valor mensal e a duracao aproximada para uma simulacao
  separada;
- se nao existir documento, o usuario informa diretamente a descricao da
  cobranca, o valor mensal, a duracao e confirma que os dados sao aproximados;
- o total estimado e o cenario matematico em dobro nunca sao somados aos valores
  documentais como se fossem comprovados;
- o rascunho pode incluir pedido de exibicao de extratos, contratos e autorizacoes, se juridicamente cabivel;
- periodo, total pago e valor da causa permanecem como pontos a confirmar;
- valores de simulacoes comerciais nao sao copiados automaticamente para o caso.

O material de escopo menciona um paywall de `12x R$ 99,00`. Essa etapa comercial
nao faz parte do fluxo tecnico atual e so deve ser ativada depois da definicao do
produto de pagamento, das regras de credito e do momento exato de cobranca.

## Classificacao

- `review_required`: foi encontrado um lancamento candidato, mas o consumidor ainda nao respondeu.
- `possible_unauthorized`: o consumidor informou que nao reconhece a contratacao.
- `strong_indication`: alem de nao reconhecer, informou continuacao apos cancelamento, promessa de estorno descumprida ou duplicidade.
- `recognized_charges`: todos os lancamentos foram reconhecidos.
- `no_candidate_found`: a leitura nao encontrou descricoes candidatas. Isso nao equivale a certificar que a fatura esta correta.

Os rotulos conhecidos sao pistas de triagem, nunca conclusoes automaticas.

## Acordo coletivo

Segundo as publicacoes do MPMG, o acordo abrange seguros nao contratados ou cobrados depois do cancelamento em cartoes Itau e redes parceiras.

- periodo principal das cobrancas: 13/06/2011 a 18/12/2025;
- reclamacao previa: deve ser comprovada ate 18/12/2025 para o enquadramento coletivo;
- restituicao no acordo: simples;
- evidencias: faturas, comprovantes de pagamento, protocolos e pedido de cancelamento;
- canal citado: `evidenciascontratacaoseguros@correio.itau.com.br`;
- telefone citado: `3004-8428`.

Fontes:

- [MPMG - acordo nacional com o Itau](https://www.mpmg.mp.br/portal/menu/comunicacao/noticias/acordo-do-procon-mpmg-com-o-itau-beneficia-consumidores-de-cartoes-de-diversas-redes-varejistas-parceiras-do-banco.shtml)
- [MPMG - obrigacoes e multas posteriores ao acordo](https://www.mpmg.mp.br/portal/menu/comunicacao/noticias/itau-vai-pagar-multas-diarias-se-descumprir-acordo-firmado-com-o-procon-mpmg-e-idec-por-cobrancas-indevidas.shtml)

O acordo permanece como contexto para a analise juridica, mas nao cria uma
etapa administrativa no produto. A Audita segue para a preparacao judicial sem
prometer resultado.

## Dados e privacidade

- Formatos aceitos: PDF, PNG, JPG, CSV e TXT.
- Limite: 12 MB.
- O arquivo e processado em memoria e nao e salvo por este modulo.
- O caso temporario guarda somente metadados, lancamentos normalizados e respostas do consumidor.
- A sessao expira em seis horas no MVP.
- PDFs digitais passam por extracao local; a OpenAI estrutura os lancamentos quando configurada.
- Imagens e PDFs sem texto podem ser enviados ao modelo para leitura visual.
- CPF, CNPJ, e-mail e sequencias numericas longas sao mascarados quando o texto extraido localmente e enviado ao modelo.

## Configuracao

```env
ITAU_ANALYSIS_API_KEY_SECRET=AUDITA_OPENAI_API_KEY
ITAU_ANALYSIS_MODEL=gpt-5-mini
```

O consumo aparece no painel administrativo como operacao `itau_statement_analysis`.

## Validacao do MVP em 24/07/2026

O extrato visual usado na validacao detectou como candidatos:

- `StreamPlay / Assinatura mensal`, sujeito a confirmacao do titular;
- `Protecao Horizonte / Seguro de Perda e Roubo`, sujeito a confirmacao do
  titular.

O `Pacote mensal de servicos`, identificado como tarifa bancaria comum, nao foi
classificado como candidato. Quando data ou valor nao puderem ser lidos, o
modulo informa que o dado nao foi identificado; nunca converte ausencia em
`R$ 0,00`.

A conversa real foi validada ate:

1. confirmacao de cada candidato;
2. verificacao de recorrencia;
3. escolha entre a jornada com ou sem extratos historicos;
4. decisao de seguir ao JEC;
5. escolha da UF;
6. acionamento da ferramenta `preparar_peticao_jec`;
7. abertura e foco automatico do formulario seguro do JEC.

Depois da UF, o painel coleta os dados sensiveis, prepara a peticao para revisao
e gera o PDF. Depois do download, a interface apresenta o link oficial, o passo
a passo da UF e permanece disponivel para duvidas. O navegador interno e o
protocolo automatico estao desativados nesta jornada.

## JEC entregue no MVP

Estao catalogados e testados, sem envio real:

- SP: peticionamento eletronico do TJSP;
- RJ: Peticao Cidada do TJRJ;
- MG: pre-atermacao de Belo Horizonte e entrada oficial do TJMG para o interior;
- PR: formulario de Curitiba e catalogo oficial para as demais cidades.

Em todos os estados, login, gov.br, conta Google, CAPTCHA, escolhas juridicas,
anexos e protocolo final sao feitos diretamente pelo consumidor no portal
oficial. O backend mantem o endpoint de navegador antigo bloqueado por padrao
com `AUDITA_JEC_BROWSER_ENABLED=false`.

## Acompanhamento processual Direct Data

A integracao usa a API `GET /api/TribunalJustica` da Direct Data. Ela consulta um
processo existente por numero, UF e grau. Nao cria processo, nao anexa peticao,
nao protocola e nao substitui o portal oficial.

- configuracao: `DIRECT_DATA_TJ_ENABLED` e `DIRECT_DATA_TOKEN`;
- cobertura conservadora inicial: `PE,PI,SC,SP`, ajustavel apenas depois de
  confirmacao comercial;
- consumo: credito do plano Audita e custo do provedor registrados somente
  conforme a resposta contratada;
- privacidade: a UI recebe apenas resumo processual e movimentacao, sem nomes
  das partes nem o retorno bruto do provedor;
- idempotencia: a mesma solicitacao nao dispara uma segunda consulta paga.

Sem credencial ativa, a interface informa que a integracao esta pronta, mas
pendente de contratacao/configuracao. Isso nao bloqueia o PDF nem o protocolo
manual.

## Proximas fases

- persistencia criptografada e politica formal de retencao;
- OCR dedicado para documentos de baixa qualidade;
- multiplas faturas por caso, eliminacao de duplicatas e calculo cronologico;
- upload em lote processado de forma assincrona, enviando ao modelo apenas lancamentos normalizados em vez dos PDFs completos;
- ampliacao do catalogo JEC para outras UFs;
- navegador copiloto com transmissao WebRTC fluida e retomada de sessao;
- modulo juridico separado, condicionado a revisao profissional e definicao regulatoria.
- integracao de certidoes da Direct Data, tratada como Etapa 2 somente depois do
  recebimento das regras de produto, cobertura, precos e documentos desejados.
