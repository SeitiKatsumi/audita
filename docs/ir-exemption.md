# Isenção e restituição de IR

Módulo independente em `/chat?tool=ir-exemption`. A apresentação é pública;
casos exigem sessão, PostgreSQL e criptografia. Nunca há fallback em memória.

## Configuração e implantação

- `AUDITA_IR_ENABLED=true` habilita o módulo (padrão: desabilitado).
- `AUDITA_IR_ENCRYPTION_KEY`: segredo com pelo menos 32 caracteres, mantido no
  gerenciador de segredos. Não rotacionar sem recriptografar registros e arquivos.
- `AUDITA_IR_STORAGE_PATH`: volume privado persistente (padrão
  `private-documents/ir`). Arquivos são criptografados, acessados somente pela API.
- `AUDITA_IR_AI_ENABLED=true` habilita extração opcional, com confirmação do cliente;
  reutiliza `AUDITA_CHAT_API_KEY_SECRET`, `AUDITA_OPENAI_API_KEY` ou `OPENAI_API_KEY`.
- `DATAJUD_API_KEY`: chave pública vigente publicada pelo CNJ. Nunca presumir
  disponibilidade de um processo sigiloso. Consulta diária não substitui intimações.
- Stripe reutiliza configuração existente e `/api/billing/webhook`. Habilitar
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed` e `checkout.session.expired`.

Aplicar `db/ir-exemption.sql` depois de `db/schema.sql`; o boot com
`AUDITA_AUTO_MIGRATE=true` executa ambos. Fazer backup antes da migração. A migração
é aditiva; desligar a flag preserva os dados e o processamento de pagamentos já
iniciados. Validar em homologação antes de habilitar produção.

## Acesso e operação

O superadministrador credencia operadores no painel. `manager` gerencia casos da
sua organização; `lawyer` vê apenas casos explicitamente atribuídos, inclusive de
outras organizações. Proprietários de contas comerciais não são operadores.
O titular da conta vê seus próprios casos; advogado não aceita nem paga em seu lugar.

Propostas são imutáveis após publicação. Novas versões substituem propostas ainda
não aceitas; propostas aceitas devem terminar seu ciclo de pagamento antes de nova
publicação. Upgrade é nova proposta com valor adicional explícito. Comprovantes,
contratos e procurações são anexados; equipe revisa e protocola fora do Audita.
Nenhuma decisão de direito ou concessão é automática. Datas, cálculos e enquadramento
jurídico são revisados antes da publicação da proposta.

## Privacidade, persistência e tarefas

Respostas, análises, propostas e eventos têm payload AES-256-GCM contextualizado.
Anexos não são servidos por rota estática. O navegador não salva dados do módulo em
localStorage. Logs operacionais contêm apenas identificadores e códigos de erro.
Guardar somente documentos necessários, conforme autorização registrada no caso.
Gestão de retenção deve seguir a política contratual da organização; não há exclusão
automática de documentos em um processo ativo.

Jobs DataJud persistem com lease, tentativas limitadas e reagendamento diário.
Erros de configuração, ausência de processo e indisponibilidade são visíveis no
painel. Eventos de movimentação são deduplicados. O responsável mantém prazos
oficiais manualmente e registra evidências de concessão e restituição separadas.

Fontes: Receita Federal (moléstia grave, termo inicial e retificação), Lei 7.713/88,
orientações PGFN e API pública DataJud. A triagem indica pendências e necessidade de
revisão, não substitui diagnóstico médico ou decisão jurídica.

## Interface integrada

O módulo abre em `/#isencao-ir` ou `/chat?tool=ir-exemption`, dentro de `index.html`. Reutiliza a navegação, autenticação, avatar, balões e botões do fluxo Itaú (`charge-analysis-*`). Os eventos e estilos complementares de IR ficam restritos a `#isencao-ir`; não há página ou login separados.
