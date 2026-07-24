# Navegador Copiloto para protocolo no JEC

## Estado atual do MVP

O MVP local esta funcional com Chromium/Playwright executado no backend e
renderizado dentro do Audita por screenshots interativos. O agente pode
observar, preencher por rotulo, selecionar opcoes, clicar por texto, rolar e
pedir intervencao humana.

Validacao real realizada em 24/07/2026, com dados sinteticos e sem protocolo:

| UF | Portal oficial | Ponto validado |
| --- | --- | --- |
| SP | `portal.tjsp.jus.br/PeticionamentoEletronico` | Portal aberto, foro do JEC localizado e etapa reversivel iniciada. |
| RJ | `www3.tjrj.jus.br/peticao-cidada/` | Fluxo iniciado e agente parado antes de escolher assunto juridico ambiguo. |
| MG | formulario oficial de pre-atermacao de Belo Horizonte | Portal aberto e handoff realizado no login Google. |
| PR | formulario virtual do TJPR para Curitiba | Portal aberto e pergunta inicial reversivel respondida com dados sinteticos. |

Para os quatro portais, a API recusou a acao automatizada de envio final com
`final_submission_requires_human`. Nenhuma peticao real foi protocolada.

O controle compartilhado tambem foi validado em execucao: `Parar agente`
cancela a rodada ativa sem novas acoes, `Devolver ao agente` retoma a
observacao da tela real e qualquer clique, texto ou rolagem manual pausa o
agente antes de liberar o controle ao usuario.

O browser atual e funcional, mas ainda nao tem a fluidez de um navegador WebRTC.
A arquitetura abaixo descreve a evolucao recomendada para essa experiencia.

## Objetivo

Criar uma experiência em que a Audita prepara e preenche o protocolo no portal oficial do tribunal, enquanto o usuário acompanha a navegação ao vivo e pode assumir o controle instantaneamente. CAPTCHA, autenticação, certificado digital, pagamento e envio final permanecem com o humano.

O problema do navegador assistido atual não é o Playwright isoladamente. O desconforto vem do transporte por screenshots periódicos. Playwright ou CDP ainda podem controlar o navegador nos bastidores, desde que a tela seja transmitida continuamente e o controle tenha um único proprietário por vez.

## Arquitetura recomendada

### 1. Navegador remoto

Usar uma sessão Chromium isolada por atendimento, inicialmente no Steel Cloud:

- transmissão ao vivo por WebRTC;
- visualização incorporada na interface da Audita;
- conexão do agente por Chrome DevTools Protocol;
- gravação e trilha da sessão;
- possibilidade futura de usar a versão open source em infraestrutura própria.

O embed transmite o navegador executado no servidor. Ele não tenta colocar o portal do tribunal diretamente em um iframe e, portanto, não depende das permissões de incorporação do próprio portal.

Alternativa gerenciada: Browserbase Live View, que também permite assistir, clicar, digitar e rolar em tempo real e foi desenhado para incorporação e intervenção humana.

### 2. Agente

Usar a ferramenta `computer` da OpenAI Responses API em um loop controlado pela Audita:

1. Capturar a tela atual.
2. Enviar a tarefa e a tela ao modelo.
3. Validar a ação proposta contra a allowlist.
4. Executar clique, texto, tecla ou rolagem.
5. Registrar a ação.
6. Repetir até concluir a etapa ou pedir intervenção humana.

Playwright/CDP continuam úteis como executor e para operações determinísticas. O modelo visual entra quando a página muda, os seletores não são confiáveis ou o fluxo exige interpretação.

### 3. Arbitragem de controle

Cada sessão deve ter apenas um controlador:

- `agent`: a IA pode agir e o humano apenas acompanha;
- `human`: a IA fica pausada e o usuário controla teclado e mouse;
- `confirming`: a IA aguarda autorização para uma ação sensível;
- `stopped`: sessão encerrada.

Ao clicar em `Assumir controle`, o backend cancela a ação pendente antes de liberar teclado e mouse. `Devolver à Audita` captura uma nova tela e reinicia o agente a partir do estado real deixado pelo usuário.

### 4. Guardrails

- Allowlist por UF e domínio oficial.
- CAPTCHA sempre resolvido pelo humano, sem bypass.
- Confirmação no momento de inserir ou transmitir CPF, endereço, documentos e dados financeiros.
- Login, certificado digital e código de autenticação tratados pelo humano.
- Petição e anexos podem ser preparados pela IA, mas o usuário revisa.
- O clique final de protocolar é sempre humano.
- Conteúdo do portal e documentos são dados não confiáveis, nunca novas instruções para o agente.
- Todas as ações, confirmações, arquivos e mudanças de controle entram no log de auditoria.

## Fluxo do produto

1. A conversa confirma que há evidência suficiente para avançar.
2. A Audita organiza fatos, valores, período, provas e versão revisável da petição.
3. O usuário escolhe a UF e confirma os dados que serão transmitidos.
4. A Audita abre a sessão remota e navega até o portal correto.
5. A IA preenche os campos seguros e anexa os arquivos aprovados.
6. O usuário assume em CAPTCHA, login, certificado ou ambiguidade.
7. A IA confere o resumo, mas o usuário realiza o protocolo final.
8. A Audita captura número, recibo e data do protocolo.

## Fases

### Fase 1 - Prova técnica

- Steel Cloud com Live Session.
- Um portal JEC escolhido por prevalência entre os primeiros usuários.
- Chat e navegador lado a lado.
- Assumir/devolver controle.
- Somente navegação e preenchimento até a tela anterior ao envio.

### Fase 2 - Dossiê e petição

- Estrutura persistente do caso.
- Linha do tempo das cobranças.
- Petição versionada e revisável.
- Pacote de anexos com nomes e ordem definidos.
- Validação obrigatória dos campos antes de abrir o portal.

### Fase 3 - Catálogo por estado

- Registro de portal, domínio, sistema, documentos, autenticação e pontos de handoff.
- Prompt específico por portal.
- Testes de regressão por UF.
- Captura do protocolo e do recibo.

### Fase 4 - Escala

- Filas e limites de concorrência.
- Retomada de sessão.
- Métricas de abandono, intervenção humana e sucesso.
- Política de retenção e exclusão de documentos.
- Avaliações automáticas do comportamento do agente.

## Decisao para a proxima etapa

Manter o MVP atual para validar regras e portais. Para o piloto de experiencia
fluida, avaliar **Steel Cloud + OpenAI Computer Use**, mantendo Playwright/CDP
como executor auxiliar. Essa combinacao adiciona tela WebRTC e controle
compartilhado sem descartar o catalogo e os guardrails ja implementados.

Se o piloto mostrar necessidade de uma operação totalmente gerenciada e menor manutenção, comparar com Browserbase antes da fase de escala. Se residência de dados ou custo justificar, avaliar o Steel open source apenas depois da prova técnica.

## Referências

- Steel, sessões incorporadas e transmissão WebRTC: https://docs.steel.dev/overview/sessions-api/embed-sessions
- Steel, controles human-in-the-loop: https://docs.steel.dev/overview/sessions-api/human-in-the-loop
- Steel, versão self-hosted com Docker: https://docs.steel.dev/overview/self-hosting/docker
- Browserbase, Session Live View: https://docs.browserbase.com/platform/browser/observability/session-live-view
- OpenAI, Computer use: https://developers.openai.com/api/docs/guides/tools-computer-use
