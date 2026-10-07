# Auditoria de glosas - automacao assistida

Pesquisa em 05/10/2026. Modulo local de conferencia administrativa e financeira,
nao auditoria medica automatica. Sem chamadas pagas, protocolo ou deploy.

## Fontes e correcoes dos modelos recebidos

- RN ANS 501/2022 trata do TISS. Consultar a versao de cada componente,
  nao presumir que todos os componentes usam a mesma versao:
  https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss
- RN ANS 503/2022 trata dos contratos. Art. 14 exige rotinas de glosa,
  contestacao e pagamento; os prazos acordados de contestacao e resposta sao
  iguais. Nao fixar automaticamente 30 dias:
  https://bvsms.saude.gov.br/bvs/saudelegis/ans/2022/res0503_04_04_2022.html
- CFM 1.614/2001 foi revogada pela 2.448/2025, que tem dispositivos com
  suspensao judicial anotada. Nao copiar a fundamentacao do modelo:
  https://sistemas.cfm.org.br/normas/arquivos/resolucoes/BR/2025/2448_2025.pdf
- CID isolado nao permite concluir que uma glosa e procedente. Ausencia de
  evidencia exige revisao, nao mudanca de prontuario para obter pagamento.
- CBHPM e tabelas comerciais dependem de licenciamento:
  https://amb.org.br/adquirir-cbhpm-2/
- Dados de saude sao sensiveis: finalidade, base legal, minimizacao e controles
  de acesso devem ser definidos antes de receber prontuarios reais:
  https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes

## Fluxo implementado

Interface em conversa guiada: introducao publica e pergunta inicial; a primeira
resposta aciona o modal de autenticacao compartilhado. Fechar o modal nao avanca.
Depois do login: autorizacao de processamento, upload, extracao, conferencia,
analise/minutas e exportacao. O rascunho de correcoes permanece em memoria.
Retomada de lotes salvos e exclusao permanecem disponiveis para o dono.

PDF e XML: demonstrativo de glosas (obrigatorio), faturamento, contrato e
autorizacoes. A Responses API extrai dados estruturados, trechos e paginas/caminhos
XML. Campo ausente permanece null, nao zero. Linhas sao vinculadas somente por
guia+sequencia exatas; valores conflitantes ficam pendentes. Multiplas linhas da
mesma chave em um documento interrompem a extracao em vez de somar/deduplicar.
Nao ha suporte automatico a todos os layouts TISS, validacao XSD ou reembolso ANS.

Apos conferencia explicita dos itens e evidencias, uma segunda chamada gera
observacoes, pendencias, prevencao e minutas condicionais para revisao. Referencias
nao pertencentes ao item/fatos sao rejeitadas. Relatorio TXT/PDF preliminar com
fontes. Nao decide procedencia, necessidade medica ou direito a pagamento; nao
inventa fundamentacao normativa, nao altera prontuarios e nao protocola recurso.
Totais calculados no servidor; saldo nao conciliado nao vira glosa automaticamente.
Atendimentos manuais anteriores continuam acessiveis, sem migracao destrutiva.

## Integracao e limites

- Reutiliza AUDITA_CHAT_API_KEY_SECRET / AUDITA_OPENAI_API_KEY / OPENAI_API_KEY e
  AUDITA_CHAT_MODEL (padrao gpt-5-mini). store:false; sem ferramentas/web search.
- 4 documentos, 20 MB/40 paginas por lote; PDF ate10 MB/20 paginas; XML UTF-8 ate
  250 KB, sem DTD/entidades. PDF invalido/protegido e truncamento sao recusados.
- Extracao: ate50 linhas por documento,100 itens por lote. Analise: contexto70k
  caracteres, saida12k tokens, timeout120s por chamada, sem retries do SDK.
- Reserva CAS persistente antes de chamar IA; busy com lease15min, requestId
  idempotente para sucesso,10 processamentos por lote. Falhas preservam dados.
- Upload invalida extracao/confirmacao/minutas atomically com a insercao. Alterar
  itens invalida minutas. Nenhum resultado parcial aplicado em falha.
- Eventos de consumo enviados ao apiUsageService, sem documentos em logs.
- Falta de chave bloqueia extracao; nao substitui respostas reais por simulacao.

Persistencia criptografada no PostgreSQL, segregada por tenant E usuario.
AUDITA_GLOSAS_ENCRYPTION_KEY (32 bytes, formato aceito por irKey) ou chave IR
existente; AAD proprio do modulo. Nao trocar a chave apos salvar dados.
Configuracao ausente bloqueia o backend. Revisao otimista evita sobrescrita
silenciosa. Exclusao definitiva disponivel ao dono. Nao gravar em localStorage.
Migracao aditiva db/glosas.sql, sem alteracoes nas tabelas dos outros modulos.

## Validacao e pendencias antes de producao

1. Amostras anonimizadas de demonstrativos/TISS de operadoras e contratos.
2. Parser XML com XSD/versionamento, conciliacao por guia e sequencia, duplicatas
   e varias glosas por item; nao inferir significados dos codigos do exemplo.
3. Homologar qualidade/custo com OpenAI real e arquivos anonimizados: os testes
   atuais usam AI simulada, handler real, PGlite e PDFs ficticios.
4. Workflow de revisao profissional identificada/assinatura ainda externo ao
   sistema. Prazos precisam de clausula e marco inicial, nao sao calculados.
5. LGPD: responsabilidades, retencao, descarte/backups, acesso da equipe,
   transferencia de dados ao fornecedor e habilitacao comercial do servico.

Nao oferece integracao ERP/PEP, protocolo ou exportacao de recurso XML TISS.
Nao promete recuperacao ou reducao percentual de glosas. Chave ausente no
localhost em05/10/2026: caminho real nao foi executado. Sem deploy em producao.
