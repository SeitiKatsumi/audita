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
8. gerar um pedido administrativo de revisao e restituicao.

O modulo nao presta servico de advocacia e nao decide que uma cobranca e ilegal. A peticao e o protocolo no JEC pertencem a uma fase posterior, com revisao e envio final pelo usuario.

## Jornada conversacional

- `suspeita`: uma pergunta curta identifica nome, valor ou recorrencia que chamou a atencao.
- `evidencia_recente`: a Audita analisa apenas um documento pequeno para decidir se vale investigar.
- `confirmacao`: o consumidor confirma se reconhece a contratacao encontrada.
- `historico`: somente se houver sinal, a Audita pede os meses necessarios e cria uma linha do tempo consolidada.
- `contexto`: reclamacao previa, cancelamento e estorno sao perguntados um por vez.
- `saida`: resumo, evidencias e pedido administrativo; o caminho judicial fica separado.

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

## Proximas fases

- persistencia criptografada e politica formal de retencao;
- OCR dedicado para documentos de baixa qualidade;
- multiplas faturas por caso, eliminacao de duplicatas e calculo cronologico;
- upload em lote processado de forma assincrona, enviando ao modelo apenas lancamentos normalizados em vez dos PDFs completos;
- exportacao do dossie administrativo em PDF;
- integracao com protocolo oficial do banco, se houver canal contratado;
- geracao revisavel da peticao para JEC;
- navegador copiloto com transmissao ao vivo, handoff humano e protocolo final feito pelo usuario;
- modulo juridico separado, condicionado a revisao profissional e definicao regulatoria.
