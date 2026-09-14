# Auditoria de contas de luz — piloto

Entrada pública na Central, categoria Energia, `/#contas-de-luz`. Salvar um caso exige conta e consentimento. Sem cobrança ou envio automático à distribuidora. O cliente confirma o resumo, baixa o requerimento e registra o protocolo no módulo. Equipe em `/#advogados`, filtro Contas de luz; a fila expõe apenas referências até a atribuição.

## Configuração

- `AUDITA_ENERGY_ENABLED=true`: habilitação explícita, inicialmente só em homologação.
- PostgreSQL existente: `db/energy-audit.sql` é uma migração aditiva, aplicada pelo servidor. Nenhum fallback em memória.
- `AUDITA_ENERGY_ENCRYPTION_KEY` ou a chave existente `AUDITA_IR_ENCRYPTION_KEY`: AES-256-GCM com contextos próprios. Não trocar a chave sem recriptografar os dados.
- `AUDITA_ENERGY_STORAGE_PATH`: volume privado persistente; padrão `private-documents/energy`. Não publicar em rotas estáticas. Em homologação, usar o volume persistente do serviço e backups consistentes de banco e arquivos.
- Leitura usa a mesma infraestrutura OpenAI: variável apontada por `AUDITA_CHAT_API_KEY_SECRET`, `AUDITA_OPENAI_API_KEY` ou `OPENAI_API_KEY`, nessa ordem. Modelo `AUDITA_CHAT_MODEL`, padrão `gpt-5-mini`. Segredos somente no ambiente privado. Consumo registrado no serviço existente.
- A configuração pública informa separadamente habilitação, armazenamento e leitor disponíveis. Credencial presente não garante disponibilidade futura do provedor; falhas durante leitura geram pendências.

## Extração e validação

PDF textual primeiro; PDF sem texto e imagens usam leitura visual. PDF, PNG e JPEG até 10 MB. Enviar uma fatura por arquivo: arquivos com várias faturas pedem separação. O conteúdo dos documentos é dado não confiável para a IA. Campos ausentes ficam nulos. A extração registra páginas e não decide direito a restituição.

Revisão manual dos campos está disponível. Valores monetários de entrada são mostrados em reais e convertidos em centavos para cálculos. Contrato, pagamento e representação precisam de anexos do próprio caso. Correções invalidam resumo/pedido anteriores; versões anteriores ficam criptografadas no banco. Depois do protocolo, as faturas ficam preservadas; novos períodos devem ser tratados em outro caso, iniciado pela apresentação do módulo.

O resumo exige confirmação única do titular, representação, faturas, pagamentos, divergências e canal oficial antes do pedido. Nenhuma senha gov.br ou da distribuidora é solicitada. Canal não cadastrado é informado e confirmado pelo cliente conforme a fatura; a Audita não inventa links.

## Regras versão 2026-09-14.1

| Regra | Pré-requisitos e resultado |
| --- | --- |
| Soma | Total e todos os itens legíveis, créditos/descontos sinalizados. Tolerância de 2 centavos. |
| Item | Quantidade, preço por unidade e valor, sem substituir dados ausentes por zero. |
| Leituras | Leitura anterior/atual, multiplicador e consumo compatíveis. Não comprova consumo real. |
| Tarifa | Distribuidora/CNPJ, classe, subclasse, detalhe, subgrupo, modalidade, posto, agente acessante, unidade, componentes, tributos e vigência compatíveis. Referências conflitantes impedem comparação. |
| Bandeira | Mês integral, bandeira identificada, unidade no SIN, kWh e preço sem tributos compatíveis com a fonte. Ciclos atravessando meses, solar e mercado livre ficam sem esta comparação no piloto. |
| Contrato | Grandes consumidores/mercado livre: arquivo, parâmetros e vigência confirmados; fornecimento e distribuição separados. |
| Solar | Saldos inicial/final, créditos, utilização, expiração e transferências completos, em kWh. Sem conversão automática em dinheiro. |
| Tributos | Somente aritmética de base × alíquota declaradas. Validade jurídica e tese residual PIS/Cofins dependem de especialista. |

Exemplos executáveis em `test/energy-audit.test.mjs`. Não há corte de R$500, projeção de 60 meses, Selic automática, devolução em dobro, danos morais ou promessa de recuperação. Resultados não somam achados sobre a mesma cobrança. Valores cobrados, pagos, diferenças estimadas, devolução aprovada e recebimento são registros distintos.

## Referências ANEEL

Importador diário via CKAN, persistido e coordenado no PostgreSQL. Fontes:

- [Tarifas homologadas](https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica/resource/fcf2906c-7c32-4b9b-a637-054e7a5234f4).
- [Acionamento das bandeiras](https://dadosabertos.aneel.gov.br/dataset/bandeiras-tarifarias/resource/0591b8f6-fe54-437b-b72b-1aa2efd46e42).
- [Adicionais e vigências](https://dadosabertos.aneel.gov.br/dataset/bandeiras-tarifarias/resource/5879ca80-b3bd-45b1-a135-d9b77c1d5b36).

O importador converte R$/MWh para R$/kWh e preserva valores R$/kW. Não aplica tarifa sem tributos a valor que os inclui. Importação sem linhas reconhecidas é falha explícita. Cache anterior só é usado quando a vigência cobre integralmente a fatura. Erros e última consulta constam no resultado. Atualizar conferência refaz o cálculo e exige novo aceite antes de gerar outro pedido.

Na validação local de 14/09/2026, o acesso direto ao CKAN não respondeu. Não foram inseridas tarifas inventadas. O parser e os casos de indisponibilidade foram testados com referências controladas. A coleta real de tarifas e bandeiras continua pendente de validação no ambiente de homologação com acesso à ANEEL.

## Persistência, tarefas e acompanhamento

Documentos privados criptografados, acesso autenticado e auditado. Isolamento entre usuários, organizações e atribuições; notas internas não são enviadas ao cliente. Casos, versões, extrações, tarefas e eventos ficam no PostgreSQL. Nenhum conteúdo de fatura em localStorage.

Tarefas de extração retomam após reinício, usam lease, três tentativas máximas em falhas transitórias e proteção contra conclusão de tentativa antiga. Falha em uma fatura não bloqueia as demais. Arquivos idênticos são deduplicados por hash no caso; períodos sobrepostos exigem identificar o documento válido antes de serem calculados.

O requerimento PDF contém achados, memória de cálculo, fontes, cobertura não executada e anexos. Pedido de devolução fica condicionado a pagamento comprovado; sem comprovante, pede esclarecimento/revisão. Download não significa envio.

Para o cliente, acompanhamento e histórico aparecem somente após preparar o pedido. A equipe mantém acesso às notas e tarefas desde a triagem. Cliente registra protocolo/data, envia resposta e confirma a classificação sugerida. Aprovação/negativa exigem resposta anexada; recebimento exige comprovante, valor e forma (crédito na fatura ou depósito). Não há botão de saque. Equipe atribui casos, adiciona tarefas com prazo e separa notas internas de atualizações públicas.

## Validação

`node --test test/energy-audit.test.mjs` cobre regras, datas, arredondamento, classes de consumidor, versões, duplicatas/retificações, várias unidades, falhas, retomada, referências indisponíveis, consentimento, isolamento e jornada até PDF/protocolo/resposta/recebimento.

Teste integrado local com fatura fictícia em PDF e imagem confirmou acesso ao leitor OpenAI. Dados reais e cobrança/protocolo externos não foram usados. Configuração de produção e deploy não foram alterados.
