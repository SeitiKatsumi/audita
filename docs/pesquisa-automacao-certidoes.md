# Pesquisa: automacao de certidoes judiciais

Atualizado em: 2026-06-17

## Conclusao curta

Nao encontrei um projeto open source pronto que faca emissao ponta a ponta de certidoes estaduais brasileiras em escala nacional. O que existe se divide em:

- bibliotecas de scraping/consulta processual, principalmente e-SAJ, DataJud e PJe;
- fornecedores comerciais que ja encapsulam varios portais em APIs JSON;
- frameworks de agente navegador com human-in-the-loop, que validam a arquitetura experimental do Audita.

## Caminhos mais uteis

### 1. APIs comerciais de certidoes

Maior valor pratico imediato. Infosimples, Monitorador e Exato mostram catalogos com consultas/certidoes de tribunais.

Achados relevantes:

- Infosimples tem API para TJPA Certidao Criminal.
- Infosimples tem issue/API planejada para TJPA Certidao Civel.
- Infosimples lista TJSP Visualizar Certidao via numero do pedido + CPF/CNPJ + data.
- Monitorador lista TJMS cadastro/conferencia, TJMT, TJPA, TJRJ, TJRS, TJSP e outros.
- Exato expõe endpoints em Swagger para certidoes de tribunais, incluindo TJSP/TJRS.

Uso recomendado:

- avaliar custo e SLA para usar como fallback ou acelerador;
- comparar retorno JSON/PDF/protocolo contra nosso modelo de evidencias;
- usar como benchmark para quais campos cada tribunal realmente exige.

### 2. APIs oficiais e bases publicas

DataJud/CNJ e util para metadados e movimentacoes processuais, mas nao substitui certidao oficial emitida pelo tribunal.

Uso recomendado:

- fallback analitico para parecer de risco;
- enriquecimento de inteligencia documental;
- validacao cruzada quando a certidao oficial estiver pendente.

Nao usar como substituto juridico automatico da certidao, salvo se o cliente aceitar explicitamente evidencia complementar.

### 3. Open source juridico brasileiro

Achados:

- courtsbr/esaj: pacote R para baixar/parsear processos, consultas e decisoes em portais e-SAJ.
- courtsbr/tjsp e jjesusfilho/tjsp: foco em decisoes/processos, nao emissao de certidao.
- jespimentel/api_cnj e outros exemplos DataJud: clientes/notebooks para API publica do CNJ.
- pje-mcp-server: MCP para PJe com certificado digital A1/A3.

Uso recomendado:

- reaproveitar ideias de normalizacao por tribunal;
- estudar seletores/rotas dos portais e-SAJ;
- nao esperar emissao de certidao pronta.

### 4. Agente navegador e HITL

Frameworks relevantes:

- Browserbase Stagehand: mistura codigo deterministico com linguagem natural; bom para tornar automacoes menos frageis.
- Browser Use: agente navegador open source com runtime/harness proprio.
- Vercel agent-browser: CLI Rust orientada a agentes, usa snapshots e referencias de elementos, reduzindo custo de contexto.
- Browserbase human-in-the-loop template: fluxo completo com live view, logs, input humano e retomada.

Uso recomendado no Audita:

- manter arquitetura hibrida: adapters deterministicos onde ja conhecemos o portal, agente IA para UFs novas, humano para CAPTCHA/login/certificado;
- substituir gradualmente screenshots pesados por arvore de acessibilidade/referencias de elementos;
- cachear acoes bem-sucedidas por portal para reduzir custo e instabilidade;
- implementar resume robusto apos handoff humano.

## Estrategia recomendada para o Audita

1. Criar uma matriz "fonte por UF":
   - oficial/API publica;
   - fornecedor comercial;
   - adapter deterministico;
   - agente IA;
   - manual/humano.

2. Para cada portal novo:
   - verificar se existe API comercial pronta;
   - verificar DataJud apenas como complemento;
   - mapear chamadas XHR/JSON legitimas do proprio portal;
   - se nao houver rota clara, usar agente IA com prompt por portal;
   - parar em CAPTCHA, login, certificado ou anti-bot.

3. Melhorias tecnicas no agente:
   - snapshots sem imagem/base64 por padrao;
   - controles por referencia;
   - prompts por portal versionados;
   - memoria de escolhas por UF;
   - fila de pendencias humanas;
   - retomar do ponto atual apos intervencao.

## Pontos de atencao

- DataJud nao emite certidao; ele consulta dados processuais publicos.
- Bibliotecas e-SAJ antigas podem quebrar em portais atuais com CAPTCHA.
- APIs comerciais provavelmente usam RPA/scraping proprietario; validar compliance, logs, evidencias e custo.
- Qualquer caminho de CAPTCHA deve continuar human-in-the-loop, sem bypass.
