# Contexto Para IA

Este arquivo deve ser lido por Codex, ChatGPT ou qualquer assistente de desenvolvimento antes de executar mudancas relevantes no projeto Audita.

## Resumo do projeto

Audita e uma plataforma de consulta e auditoria com foco em coleta de dados, integracao por APIs, analise com IA, dashboards, relatorios e comunicacao via portal web e WhatsApp.

O escopo original esta em:

https://ecossistema.elevenmind.com.br/propostas/audita-2/

## Diretrizes do produto

- Produto SaaS/DaaS com possibilidade de operacao multi-cliente.
- Coleta de dados de fontes judiciais, fiscais, imobiliarias, publicas, privadas e APIs.
- Dados estruturados em JSON para analise, rastreabilidade e relatorios.
- IA deve explicar dados brutos em linguagem clara, apontar riscos, recomendacoes e proximas acoes.
- Portal web deve ser operacional, rapido, seguro e intuitivo.
- WhatsApp deve ser canal complementar, nao substituto do portal.
- Dashboards devem destacar KPIs em tempo real, riscos, status de coletas e insights relevantes.

## Diretrizes visuais

- Usar tons de azul esverdeado.
- Estilo futurista, tecnologico, confiavel e limpo.
- Priorizar legibilidade, densidade informacional e operacao recorrente.
- Evitar landing page como primeira tela da aplicacao.
- Evitar visual generico de template corporativo.
- Usar cards apenas quando representarem entidades ou metricas, nao como decoracao excessiva.

## Regras de seguranca para IA

- Nunca criar ou commitar secrets reais.
- Nunca inserir credenciais em exemplos.
- Nunca expor dados reais de clientes.
- Nunca orientar banco de producao exposto publicamente.
- Antes de mexer em deploy, banco ou autenticacao, atualizar a documentacao correspondente.
- Se houver duvida sobre producao, preferir staging ou pedir confirmacao.

## Ao iniciar uma tarefa

1. Ler README.md.
2. Ler este arquivo.
3. Ler docs/architecture.md e docs/security.md quando a tarefa envolver backend, infraestrutura, banco ou autenticacao.
4. Verificar o estado do git.
5. Evitar reverter alteracoes de terceiros.
6. Implementar com escopo pequeno e validacao clara.

## Entrega esperada

Toda entrega deve informar:

- arquivos alterados;
- comandos de validacao executados;
- testes que passaram ou nao puderam ser rodados;
- riscos restantes;
- proximos passos objetivos.
