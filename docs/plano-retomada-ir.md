# Plano de retomada — Isenção e restituição de IR na Audita

Registro em 10/09/2026. Este documento preserva o escopo solicitado, as decisões e o trabalho local antes da atualização do GitHub.

## Base e preservação

- O trabalho de IR começou no commit `8fcfe4e` (28/08/2026).
- A atualização identificada na `main` é `99736e3` (09/09/2026): fila de protocolos para advogados e encaminhamento assinado do cliente.
- O trabalho local de IR fica preservado na branch `codex/ir-preservado-20260910`, com este plano. Nenhum envio ao GitHub é necessário para esta preservação.
- Atualizar a `main` com avanço direto para a origem, sem reaplicar automaticamente a implementação antiga. Reintegrar depois sobre a base atual, conforme este plano.
- Banco local, anexos, credenciais e configuração local continuam fora do Git. A branch não substitui um backup desses dados e depende da chave local para ler os dados criptografados.

## Objetivo e referências

Adicionar um módulo próprio de isenção e restituição de Imposto de Renda dentro da Audita, reutilizando a interface e a interação do módulo Itaú.

- Projeto: https://github.com/SeitiKatsumi/audita
- Documento de escopo: https://docs.google.com/document/d/1UkJgNt_-lU0g4hsxoUF0ztwuCw4fElZ8/edit
- Referência de perguntas: https://chat.liberius.com.br/fique-isento/
- Liberius é apenas referência de interação; não haverá conexão com seus sistemas.

## Decisões de experiência confirmadas

1. Usar a própria Audita: menu, autenticação, fundo escuro, identidade visual, assistente, balões e botões do Itaú. A interface clara e separada criada inicialmente foi rejeitada e removida.
2. A conversa deve ser contínua. Perguntas e respostas ficam no histórico; não apresentar um assistente em páginas numeradas nem abas como fluxo principal.
3. Apresentar perguntas curtas, escolhas fáceis, opção “Não sei” onde aplicável e possibilidade de retomar um caso salvo.
4. Reutilizar a interação real do Itaú: resposta do usuário, pausa de 900 ms, avatar único deslocando-se para “IA AUDITA está digitando…”, espera de 1500 ms e nova pergunta. Respeitar movimento reduzido sem eliminar a pausa mínima solicitada.
5. Rolar automaticamente para a interação mais recente ao responder e ao revelar a pergunta, inclusive no computador. Evitar que o foco de teclado reverta a rolagem.
6. Usar “Voltar” no lugar de “Editar”, permitindo responder novamente à pergunta; “Retomar conversa” cancela essa revisão.
7. Entrada planejada: `/chat?tool=ir-exemption`; a integração local também oferece `/#isencao-ir`.
8. Apresentação pública; conta obrigatória para criar e persistir o caso.

### Último ponto discutido, ainda pendente

O usuário questionou os atalhos “Enviar documentos”, “Ver propostas” e “Acompanhar pedido” exibidos durante as perguntas iniciais. Foi explicado que pertencem às fases posteriores da operação. A sugestão apresentada foi oferecê-los no momento adequado da conversa, em vez de botões fixos desde o início. Essa alteração ainda não foi implementada nem houve confirmação específica após a explicação; preservar a discussão na retomada.

## Jornada e escopo funcional

- Solicitante: titular, representante de pessoa viva ou herdeiro; separar solicitante e titular e registrar autorização/representação.
- Benefícios: aposentadoria, pensão, reforma/reserva e previdência complementar, com múltiplas fontes pagadoras e início do benefício. Distinguir renda de trabalho.
- Condição médica: condições previstas no escopo legal, diagnóstico, datas aproximadas e disponibilidade de laudo. Remissão não encerra automaticamente a análise.
- Imposto: descontos, períodos, valores conhecidos, restituições anteriores, pedidos já feitos, negativas e eventual isenção já concedida.
- Herdeiros: óbito, vínculo, inventário e representação do espólio; sem projetar economia futura para titular falecido.
- Documentos: checklist por caso; identificação, representação, laudos, benefícios, informes, declarações e documentos de espólio quando aplicáveis.
- Resultado: indícios, pendências e próximos passos. Não prometer decisão, retorno garantido, isenção imediata ou valor definitivo com dados incompletos.
- Proposta e execução: revisão da equipe, contratação, pagamento, preparação, protocolo registrado pela equipe e acompanhamento.

## Regras, equipe e contratação

- Regras versionadas e fontes oficiais; IA auxilia explicação/extração, mas não decide elegibilidade. Confirmar dados extraídos antes de incorporá-los ao caso.
- Separar economia futura, estimativa preliminar e cálculo revisado. Considerar períodos, início do direito, fonte pagadora e restituições anteriores; não multiplicar desconto atual por 60.
- Não direcionar automaticamente todo retroativo à via judicial. Definir a via após revisão e orientação aplicável.
- Revisão especializada para herdeiros, previdência complementar e enquadramentos duvidosos.
- ADM/Ouro por proposta de caso, preço/escopo/condições definidos pela equipe. Não alterar assinatura Standard.
- Aceite da versão exata; Stripe existente; pagamento confirmado por webhook idempotente. Upgrade ADM → Ouro requer proposta adicional explícita e novo aceite, sem cobrança automática.
- Minutas e dossiês a partir de modelos versionados; revisão e protocolo manual nos canais oficiais. Registrar número, data e comprovante.
- Contratos e procurações assinados por anexo na primeira versão; nenhum novo fornecedor de assinatura exigido. Nunca pedir senha gov.br no chat.
- Inventarium dentro da Audita: casos atribuídos, documentos, propostas, responsável, tarefas, prazos e histórico. Separar notas internas de atualizações ao cliente.
- Situação operacional separada da financeira: triagem, pendências, revisão, preparação, protocolado, exigência, decisão e encerramento.
- Isenção concedida e restituição recebida são resultados separados, com evidências.
- DataJud como apoio diário ao acompanhamento de processos públicos ativos por CNJ/tribunal; mostrar fonte e última consulta. Falhas e ausência de resultados não significam inexistência de movimentação. Prazos oficiais continuam sob responsabilidade da equipe.

## O que foi construído e está na branch preservada

- Serviços próprios de domínio, questionário, casos, documentos, extração opcional por IA, propostas, execução e DataJud.
- Endpoints `/api/ir-exemption` e migração PostgreSQL aditiva.
- Casos/respostas/documentos/propostas/eventos/tarefas persistentes; dados sensíveis criptografados e documentos privados com autorização de acesso.
- Papéis de equipe específicos e atribuição de casos; proprietário de conta não recebe automaticamente permissão operacional de IR.
- Checkout por proposta integrado ao serviço Stripe existente e tratamento de eventos de pagamento.
- Interface `ir-exemption.js` e estilos complementares integrados em `index.html`, com histórico contínuo, Voltar, avatar móvel e digitação.
- Entradas no menu e nas ferramentas do assistente, configuração de ativação e documentação.
- PostgreSQL local de desenvolvimento e migração dos usuários locais para permitir testes persistentes; dados e segredos não estão versionados.
- Última suíte completa executada antes desta atualização: 342 testes passaram. Isso valida o estado local preservado, não constitui homologação da integração futura.

## Limitações e revisão necessária

- O módulo não foi publicado. Stripe real, DataJud real e IA externa não foram homologados; testes de integrações usaram simulações. Nenhuma cobrança real foi executada.
- A operação completa solicitada ainda não deve ser considerada concluída ou pronta para produção.
- Rever persistência de versões completas de análise, validação de datas operacionais e transições antes de homologar.
- Há grupos de campos ainda apresentados juntos em formulários na conversa; avaliar fidelidade à intenção de uma pergunta por vez ao reintegrar.
- A nova base introduz papel `lawyer`, painel `/advogados`, fila de protocolos e contratos/procurações. Examinar esses recursos antes de restaurar serviços ou telas paralelos de equipe.
- Não copiar indiscriminadamente `server.mjs`, `app.js`, `index.html`, esquema ou Stripe antigos sobre a nova base.

## Plano de execução sobre a versão atualizada

1. **Validar a base atual:** conferir login, módulo Itaú, painel de advogados, encaminhamento assinado, protocolo, testes e localhost 3000.
2. **Mapear reaproveitamento:** comparar a branch preservada com a nova base; usar os componentes atuais de chat, autenticação, equipe, assinatura e cobrança sempre que cobrirem o requisito.
3. **Integrar primeiro a conversa:** adicionar o IR dentro da Audita com o mesmo comportamento do Itaú atualizado; validar visual e navegação antes de avançar. Reavaliar os atalhos fixos discutidos acima.
4. **Reaplicar persistência e regras:** migração aditiva, serviços próprios, autorização por organização/usuário/atribuição, consentimentos, histórico e documentos privados. Preservar dados existentes.
5. **Reintegrar a operação:** revisão, propostas ADM/Ouro versionadas, aceite, checkout/webhook, minutas, anexos assinados e protocolo. Reutilizar a nova fila quando compatível e manter isolamento dos casos de IR.
6. **Acompanhamento e homologação:** tarefa durável DataJud, tentativas limitadas, deduplicação e pendências de integração. Ativação por configuração em homologação com dados fictícios.
7. **Validação final:** percorrer um caso de teste chat → revisão → proposta → pagamento de teste → requerimento → protocolo → acompanhamento, com histórico persistente e acesso correto da Inventarium. Só então considerar a entrega funcional concluída.

## Critérios de teste preservados

- Titular, representante e herdeiro; múltiplos benefícios; remissão; falta de laudo; negativa e isenção prévia; dados insuficientes.
- Voltar, confirmação de extração e retomada após reiniciar servidor.
- Datas/períodos/cálculos, renda de trabalho e valores já restituídos.
- Proposta versionada, pagamento recusado, webhook duplicado e upgrade sem cobrança indevida.
- Isolamento entre clientes/equipe e bloqueio de downloads sem autorização.
- DataJud indisponível, processo não encontrado e movimentos repetidos.
- Celular, teclado, movimento reduzido, rolagem automática e regressão do Itaú atualizado.

## Fontes oficiais registradas no planejamento

- Receita: https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/preenchimento/molestia-grave
- DataJud: https://www.cnj.jus.br/sistemas/datajud/api-publica/

## Reintegração realizada em 10/09/2026

A pedido do usuário, o trabalho preservado foi reaplicado sobre `99736e3` na branch `codex/ir-integrado-20260910`. Os conflitos de imports e carregamento de scripts foram resolvidos mantendo os recursos atuais do GitHub. A lista de arquivos públicos também contempla `advogados.html` e `advogados.js`.

O código atualizado do Itaú, a fila de advogados, os modelos de documentos assinados e o esquema base permaneceram intactos. O módulo de IR mantém suas próprias permissões, dados e operação, sem conceder acesso automático aos seus documentos pelo novo papel de advogado.

Validação da integração: 346 testes passaram, sem falhas ou testes ignorados, incluindo o teste SQL da fila de advogados com PGlite. Rotas do IR e do painel de advogados responderam; um atendimento de IR salvo foi retomado no navegador. As limitações de homologação externa descritas acima continuam válidas.
