# Revisao de cobrancas Itau

## Objetivo desta fase

O modulo ajuda o consumidor a:

1. explicar em conversa qual cobranca despertou a suspeita;
2. enviar somente uma evidencia recente, como print, foto, fatura ou trecho do extrato;
3. localizar seguros, protecoes, garantias e servicos que precisam de confirmacao;
4. informar se reconhece cada contratacao;
5. quando houver sinal concreto, coletar extratos de um periodo maior para medir recorrencia e duracao;
6. registrar sinais adicionais, como cobranca posterior ao cancelamento;
7. verificar um possivel enquadramento no acordo coletivo divulgado pelo MPMG;
8. gerar um pedido administrativo de revisao e restituicao;
9. quando a reclamacao nao resolver o caso, preparar um rascunho para o JEC e
   abrir o portal oficial do estado em uma sessao assistida.

O modulo nao presta servico de advocacia e nao decide que uma cobranca e ilegal.
O rascunho judicial e apoio para revisao. A IA nao assina nem protocola; o envio
final permanece com o usuario.

## Jornada conversacional

- `suspeita`: uma pergunta curta identifica nome, valor ou recorrencia que chamou a atencao.
- `evidencia_recente`: a Audita analisa apenas um documento pequeno para decidir se vale investigar.
- `confirmacao`: o consumidor confirma se reconhece a contratacao encontrada.
- `historico`: somente se houver sinal, a Audita pede os meses necessarios e cria uma linha do tempo consolidada.
- `contexto`: reclamacao previa, cancelamento e estorno sao perguntados um por vez.
- `saida`: resumo, evidencias e pedido administrativo; o caminho judicial fica separado.
- `resposta_banco`: registra resposta, rejeicao, solucao parcial ou ausencia de
  resposta sem repetir perguntas anteriores.
- `jec`: com confirmacao do usuario, coleta os dados em formulario seguro,
  prepara o rascunho e abre o portal oficial em sessao assistida.

A resposta conversacional deve mostrar apenas o proximo passo. Regras completas, fontes e formulario de contexto ficam recolhidos e sao exibidos quando solicitados.

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

Casos fora do acordo coletivo ainda podem justificar reclamacao administrativa ou avaliacao juridica individual, mas o Audita nao deve prometer resultado.

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
3. reclamacao administrativa;
4. registro de data e protocolo;
5. ausencia de resposta do banco;
6. decisao de seguir ao JEC;
7. exibicao do formulario seguro do JEC.

## JEC entregue no MVP

Estao catalogados e testados, sem envio real:

- SP: peticionamento eletronico do TJSP;
- RJ: Peticao Cidada do TJRJ;
- MG: pre-atermacao de Belo Horizonte e entrada oficial do TJMG para o interior;
- PR: formulario de Curitiba e catalogo oficial para as demais cidades.

Em todos os estados, login, gov.br, conta Google, CAPTCHA, escolha juridica
ambigua, anexos sensiveis e protocolo final causam parada ou handoff humano. O
backend rejeita comandos automatizados de envio final.

## Proximas fases

- persistencia criptografada e politica formal de retencao;
- OCR dedicado para documentos de baixa qualidade;
- multiplas faturas por caso, eliminacao de duplicatas e calculo cronologico;
- upload em lote processado de forma assincrona, enviando ao modelo apenas lancamentos normalizados em vez dos PDFs completos;
- exportacao do dossie administrativo em PDF;
- integracao com protocolo oficial do banco, se houver canal contratado;
- ampliacao do catalogo JEC para outras UFs;
- navegador copiloto com transmissao WebRTC fluida e retomada de sessao;
- modulo juridico separado, condicionado a revisao profissional e definicao regulatoria.
