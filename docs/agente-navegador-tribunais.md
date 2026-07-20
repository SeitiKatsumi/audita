# Agente navegador para tribunais estaduais

Atualizado em: 2026-06-17

## Objetivo

Criar um agente assistido para emitir ou avançar consultas de certidoes nos portais dos tribunais, usando navegador controlado, dados pre-carregados do usuario e intervencao humana quando houver CAPTCHA, login, certificado ou confirmacao oficial.

## Estrategia

Usar modelo hibrido:

1. API/provider externo quando existir.
2. Adapter deterministico quando o portal for estavel.
3. Agente navegador quando o adapter falhar ou o portal exigir interpretacao visual.
4. Humano no loop para CAPTCHA, login, certificado e envio final sensivel.

## Arquitetura proposta

### Entrada

- UF/tribunal.
- Tipo de pessoa.
- Dados do usuario ja conhecidos.
- Certidoes desejadas.
- Perfil do portal.

### Prompts

Prompt geral do agente:

- Objetivo: preencher o portal oficial e capturar PDF, protocolo ou resultado textual.
- Nao burlar CAPTCHA/anti-bot.
- Parar e orientar o humano quando houver CAPTCHA, login, certificado ou acao oficial sensivel.
- Registrar cada etapa relevante.
- Solicitar ao usuario apenas dados faltantes indispensaveis.

Prompt por portal:

- URL oficial.
- Campos esperados.
- Particularidades do portal.
- Regras de clique/lookup/modal.
- Mensagens de sucesso, erro e pendencia.
- Como identificar PDF, protocolo ou resultado textual.

### Ferramentas do agente

- `browser.open(url)`
- `browser.observe()`
- `browser.click(x, y)` ou seletor quando confiavel.
- `browser.type(text)`
- `browser.press(key)`
- `browser.scroll(delta)`
- `ask_user(question)`
- `handoff_human(reason, instructions)`
- `capture_result()`
- `attach_evidence(type, value/file)`

## Interface no Audita

### Painel do agente

- Status atual.
- Ultima acao executada.
- Proximo passo.
- Tela do navegador.
- Chat lateral para dados faltantes.
- Botao `Assumir controle`.
- Botao `Devolver ao agente`.
- Botao `Salvar checkpoint`.

### Quando houver CAPTCHA

O agente deve parar e mostrar instrucao objetiva:

> Resolva o CAPTCHA no navegador exibido. Quando concluir, clique em `Devolver ao agente`.

O agente nao tenta resolver nem contornar CAPTCHA.

## Navegador

### Como funciona hoje

O Audita usa Playwright no backend e mostra a sessao no app por screenshots interativos. Cliques, texto, teclas e scroll sao enviados para a sessao mantida no backend.

Vantagem: seguro, controlavel e funciona sem iframe do tribunal.

Limite: menos fluido que um navegador real, porque a tela e atualizada por screenshots.

### Caminhos melhores

1. Curto prazo: manter screenshot interativo, mas melhorar taxa de atualizacao, foco, clique e feedback visual.
2. Medio prazo: usar streaming de navegador remoto, como CDP screencast, VNC/noVNC ou Browserless/Browserbase.
3. Longo prazo: separar o agente do renderer, permitindo trocar Playwright local, browser remoto ou Computer Use sem mudar a logica do Audita.

## MVP recomendado

### MVP 1 - Agent assisted paralelo

Estados:

- AC
- PI
- RO
- RS

Motivo:

- Estao em desenvolvimento inicial/manual guiada.
- Permite validar agente navegador sem alterar UFs funcionais.
- Fluxo fica atras de `STATE_COURT_AGENT_ASSISTED_UFS`.

Entrega:

- Perfil de portal agent-assisted.
- Prompt geral do agente.
- Prompt especifico por UF.
- Chat para dado faltante.
- Handoff humano para CAPTCHA.
- Captura de PDF/protocolo/resultado textual.

### MVP 2 - ESAJ ou portal customizado

Estados:

- AL
- AM
- MS
- BA ou CE

Motivo:

- Testa capacidade visual do agente fora do ESAJ.

### MVP 3 - Anti-bot/login

Estados:

- AP, PB, TO para anti-bot.
- MA para login/certificado.
- MG, MT, RJ, RR, SC estao liberados para rodada de agente assistido com humano no loop.

Objetivo:

- Nao resolver automaticamente, mas orientar o humano e registrar checkpoint.
- AP/TJAP: agente preencheu corretamente, porem Cloudflare/Turnstile bloqueou a validacao no navegador automatizado mesmo com acao humana. Proximo teste deve usar navegador confiavel/externo.

## Dados de configuracao por portal

Exemplo:

```json
{
  "uf": "AL",
  "tribunal": "TJAL",
  "platform": "esaj",
  "url": "https://www2.tjal.jus.br/sco/abrirCadastro.do",
  "goal": "Cadastrar pedido de certidao civel de 1 grau",
  "fields": ["nome", "cpf", "rg", "genero", "mae", "pai", "nascimento", "nacionalidade", "estadoCivil", "email"],
  "specialInstructions": [
    "Nacionalidade deve ser selecionada pela lupa; escolher Brasileira.",
    "Parar em reCAPTCHA e pedir acao humana.",
    "Se aparecer protocolo, capturar numero e data."
  ]
}
```

## Ordem de implementacao

1. Criar tabela/config de perfis do agente por portal.
2. Criar servico `agentSessions`.
3. Integrar OpenAI/agent loop com ferramentas de navegador.
4. Criar painel de chat e estado do agente no Audita.
5. Implementar MVP ESAJ para AL, AM e MS.
6. Testar com dados reais autorizados.
7. Registrar resultados no status dos tribunais.

## Criterios de sucesso

- Agente preenche AL/AM/MS ate CAPTCHA ou resultado.
- Quando faltar dado, pergunta no chat.
- Quando houver CAPTCHA, instrui o humano e pausa.
- Depois da intervencao humana, consegue continuar.
- Captura PDF, protocolo ou resultado textual quando disponivel.
- Todas as acoes ficam registradas.
