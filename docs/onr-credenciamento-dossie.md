# Dossie de credenciamento ONR / WSRIDIGITAL

## Identificacao ja confirmada

- Produto: Audita
- E-mail de contato: elevenmindbusiness@gmail.com
- Telefone: +55 11 93377-2911
- Uso pretendido: auditoria documental, due diligence imobiliaria e pesquisa patrimonial com base legal e autorizacao registradas.
- Integracao: WSRIDIGITAL SOAP, sem scraping.
- Ambiente inicial: homologacao.

## Tramites iniciados em 14/07/2026

- `13:15`: pedido de credenciamento empresarial e API somente leitura da CNIB 2.0 enviado por `elevenmindbusiness@gmail.com` para `suporte@indisponibilidade.org.br` e `faleconosco@onr.org.br`.
- `13:21`: pedido de convenio RI Digital / WSRIDIGITAL enviado por `elevenmindbusiness@gmail.com` para `convenio@onr.org.br`.
- `15:05`: ONR Suporte (`onrsuporte@service-now.com`) confirmou o recebimento do pedido RI Digital / WSRIDIGITAL e informou que a solicitacao esta em analise. Referencia da mensagem: `MSG1139874`.
- `16:05`: ONR respondeu na frente RI Digital / WSRIDIGITAL que os servicos de Pesquisa Previa e Pesquisa Qualificada nao estao disponiveis para integracao via Web Service. Para analisar outras possibilidades, solicitou CNPJ, site, finalidade, uso dos dados, eventual revenda/repasse e monetizacao, publico-alvo, forma de disponibilizacao, servicos desejados e volume mensal estimado. Referencia: `MSG1140912`.
- `16/07/2026 09:54`: ONR respondeu ao pedido especifico da CNIB 2.0. Informou que o acesso ao portal CNIB esta atualmente limitado ao Poder Judiciario, Orgaos Publicos e Cartorios Extrajudiciais, conforme o Provimento CNJ n. 188/2024. Tambem informou que nao existe modulo adicional que permita repassar essas demandas a Audita. Referencia: `MSG1157615`.
- Remetente utilizado: Vicente Zippinotti, em nome da Audita / ElevenMind Business.
- Status: acesso direto empresarial da Audita a CNIB 2.0 nao esta disponivel no modelo atual. Pesquisa Previa e Pesquisa Qualificada tambem nao estao disponiveis via WSRIDIGITAL. O chamado CNIB sera encerrado em 48 horas se nao houver nova manifestacao.
- Proxima acao: priorizar integrador privado que possa contratar e entregar resultado oficial/rastreavel, mantendo a CBRdoc em avaliacao. Nao estruturar o produto principal sobre certificado digital do usuario final.

## Dados empresariais pendentes

Preencher antes do envio ao ONR:

- Razao social: `[PENDENTE]`
- Nome fantasia: `Audita`
- CNPJ: `[PENDENTE]`
- Representante legal: `[PENDENTE]`
- CPF do representante legal: `[PENDENTE - enviar apenas pelo canal seguro indicado pelo ONR]`
- Endereco completo: `[PENDENTE]`
- Estimativa de consultas mensais: `[PENDENTE]`
- Modalidade desejada: `[PENDENTE - pre-paga ou pos-paga]`
- Disponibilidade de e-CPF para Consulta Eletronica: `[PENDENTE]`

### Candidato publico a confirmar

Uma pesquisa publica em 14/07/2026 associou o nome fantasia Elevenmind aos dados abaixo. Eles nao devem ser enviados ao ONR sem confirmacao do responsavel legal, pois as fontes consultadas divergiram sobre a situacao cadastral:

- Razao social candidata: `K & U Rebrain Marketing Ltda`
- CNPJ candidato: `12.478.572/0001-60`
- Endereco candidato: `Rua Rui Barbosa, 520, Centro, Itatiba - SP, 13250-280`
- Socio-administrador apontado: `Aparecido Seiti Katsumi`
- Fontes de referencia: Econodata/CNPJ.biz indicaram situacao ativa; Open CNPJa retornou situacao inapta na mesma data.

Acao obrigatoria: confirmar os dados no comprovante oficial de inscricao e situacao cadastral da Receita Federal ou com o contador antes do envio.

## Habilitacoes a solicitar

1. Cadastro da pessoa juridica como conveniada.
2. Administrador Master do convenio.
3. Modulo `Chave de Acesso / WSRIDIGITAL`.
4. `IDParceiro` e usuario de homologacao.
5. Pesquisa Previa por CPF/CNPJ.
6. Consulta Eletronica, a confirmar como canal da Pesquisa Qualificada.
7. Certidao Digital por matricula.
8. Diretorios `EstadosListar` e `CartoriosListar`.
9. Consulta de saldo e regras de pre-pagamento/pos-pagamento.
10. Endpoints, IPs, limites e procedimento de passagem para producao.

## Mensagem pronta

Destinatario: `convenio@onr.org.br`

Assunto: `Credenciamento WSRIDIGITAL - Audita`

> Prezados,
>
> Somos a Audita, plataforma de auditoria documental e due diligence imobiliaria. Solicitamos o credenciamento da pessoa juridica abaixo como conveniada do RI Digital e a habilitacao do modulo Chave de Acesso / WSRIDIGITAL.
>
> Pretendemos integrar, em homologacao e posteriormente em producao, Pesquisa Previa por CPF/CNPJ, Consulta Eletronica/Pesquisa Qualificada, Certidao Digital por matricula, listagem de estados/cartorios e consulta de saldo. Toda consulta sera vinculada a autorizacao ou base legal, requerente identificado, finalidade registrada, trilha de auditoria e controle de creditos. Nao utilizaremos scraping.
>
> Dados da empresa: [RAZAO SOCIAL], CNPJ [CNPJ], endereco [ENDERECO]. Representante legal: [NOME]. Contatos: elevenmindbusiness@gmail.com e +55 11 93377-2911. Volume inicial estimado: [VOLUME] consultas/mes.
>
> Pedimos orientacoes e liberacao para: Administrador Master, IDParceiro, usuario de homologacao, chave de integracao, modalidade financeira, requisitos de e-CPF, limites, custos, endpoints de producao e criterios de homologacao. Solicitamos tambem confirmacao de que `ConsultaPreviaCE_v3`, `FinalizarCE` e `ListarConfirmacoesCE` correspondem ao canal de integracao atualmente utilizado para Pesquisa Qualificada.
>
> Atenciosamente,
> Audita

## Canais oficiais

- Convenios: convenio@onr.org.br
- Telefone: (11) 3195-2293, opcao 2
- Suporte: servicedesk@onr.org.br
- Portal conveniado: <https://ridigital.org.br/Convenios/DefaultConvenio.aspx>
