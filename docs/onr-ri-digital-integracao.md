# Integracao real ONR / RI Digital

## Status verificado em 14/07/2026

O ONR possui uma API para instituicoes conveniadas, chamada WSRIDIGITAL. O acesso nao e obtido por um cadastro comum nem pela compra isolada de creditos. A empresa precisa ser credenciada como conveniada e ter o modulo de integracao habilitado pelo ONR.

Nao existe mock, gateway generico ou endpoint inventado autorizado para producao neste projeto. A integracao real deve usar o contrato SOAP/WSDL oficial e so pode ser ativada depois da entrega das credenciais de convenio.

Evidencias oficiais:

- Acesso conveniado: <https://ridigital.org.br/Convenios/DefaultConvenio.aspx>
- Geracao da chave de integracao: <https://ridigital.org.br/Downloads/GeracaoChavedeIntegracaows.pdf>
- Especificacao WSRIDIGITAL: <https://ridigital.org.br/downloads/Especificacao_wssaec_dev.pdf>
- Manual da Pesquisa Previa para conveniados: <https://ridigital.org.br/downloads/MANUALPESQUISAPREVIACONV.pdf>
- Status da API RI Digital - Conveniados: <https://status.onr.org.br/>

## Caminho para obter acesso

1. Enviar os dados da pessoa juridica e o CNPJ para `convenio@onr.org.br`.
2. Solicitar convenio empresarial com acesso ao WSRIDIGITAL para Pesquisa Previa, Consulta Eletronica/Pesquisa Qualificada, Certidao Digital e consulta de saldo/creditos.
3. Definir a modalidade financeira do departamento: pre-paga ou pos-paga, conforme aprovacao do ONR.
4. O ONR cadastra a instituicao e designa um Administrador Master.
5. O Administrador Master acessa `Usuarios > Chave de Acesso` no portal conveniado.
6. Se o menu nao aparecer, solicitar ao ONR a habilitacao do modulo `Chave de Acesso / WSRIDIGITAL`.
7. Gerar a chave do departamento e solicitar ao ONR o `IDParceiro`.
8. Receber liberacao para homologacao, testar os servicos e solicitar os enderecos/parametros de producao.

Contatos oficiais para convenio:

- E-mail: `convenio@onr.org.br`
- Telefone: `(11) 3195-2293`, opcao 2
- Suporte operacional: `servicedesk@onr.org.br`

## Dados necessarios da Audita

Para iniciar o pedido:

- razao social;
- CNPJ;
- nome do representante legal;
- e-mail e telefone de contato;
- endereco completo da pessoa juridica;
- descricao da finalidade: auditoria documental, due diligence imobiliaria e pesquisa patrimonial autorizada;
- estimativa de consultas mensais;
- servicos pretendidos;
- preferencia inicial por convenio pre-pago ou pos-pago;
- confirmacao de disponibilidade de certificado digital e-CPF para os fluxos que o exigirem.

Os termos atuais do RI Digital tambem preveem CPF do representante legal no cadastro da pessoa juridica. Esse dado deve ser informado diretamente no canal seguro indicado pelo ONR.

## Contrato tecnico oficial confirmado

O WSRIDIGITAL usa SOAP. A autenticacao funciona assim:

1. `LoginClienteConvenio` recebe e-mail do usuario, CPF do usuario e `IDParceiro`.
2. O login retorna tokens dinamicos de uso unico, validos por oito horas.
3. Cada chamada usa `SHA-1(chave + token)`, com texto em UTF-8, como campo `Hash`.
4. A chave do departamento nunca deve trafegar na mensagem.

WSDLs de homologacao verificados com HTTP 200 em 14/07/2026:

- Login: <https://hml3-ws.onr.org.br/logincliente.asmx?wsdl>
- Estados: <https://hml3-ws.onr.org.br/estados.asmx?wsdl>
- Cartorios: <https://hml3-ws.onr.org.br/cartorios.asmx?wsdl>
- Pesquisa Previa: <https://hml3-ws.onr.org.br/pesquisaprevia.asmx?wsdl>
- Certidoes: <https://hml3-ws.onr.org.br/certidoes.asmx?wsdl>
- Consulta Eletronica: <https://hml3-ws.onr.org.br/consultaeletronica.asmx?wsdl>
- Creditos: <https://hml3-ws.onr.org.br/creditos.asmx?wsdl>

O metodo atual publicado para a pesquisa imediata e `ConsultaPesquisaPrevia_v4`. Ele exige:

- `Hash`;
- CPF/CNPJ e nome da pessoa pesquisada;
- identificador do estado;
- nome, e-mail e CPF do requerente;
- finalidade da pesquisa;
- saldo suficiente no convenio.

O retorno inclui protocolo, custos e ocorrencias por cartorio, incluindo matricula quando disponibilizada. A especificacao tambem impede repetir a pesquisa do mesmo CPF/CNPJ no mesmo dia.

A Consulta Eletronica esta implementada no Audita com `ConsultaPreviaCE_v3`, `FinalizarCE` e `ListarConfirmacoesCE`. O fluxo exige os dados tecnicos de um e-CPF valido e os codigos dos cartorios retornados por `CartoriosListar`. O pedido de credenciamento deve pedir confirmacao formal de que esse contrato e o canal de integracao do produto atualmente exibido como Pesquisa Qualificada.

A Certidao Digital por matricula esta implementada com `RegistrarSolicitacaoMatricula_v5` e acompanhamento por `VerificarRespostaSolicitacao_v4`. A ativacao real depende de o convenio estar habilitado para o servico, saldo e finalidade LGPD valida.

O comando `npm.cmd run validate:onr-wsdl` confere ao vivo os sete WSDLs e as operacoes utilizadas, sem executar pesquisa nem consumir saldo.

## O que ainda bloqueia a primeira consulta real

- CNPJ e razao social da empresa contratante;
- abertura e aprovacao do convenio;
- criacao do Administrador Master;
- habilitacao do modulo WSRIDIGITAL;
- chave de acesso e `IDParceiro`;
- usuario conveniado habilitado em homologacao;
- saldo ou modalidade financeira aprovada;
- confirmacao dos endpoints e regras de producao.

Sem esses itens, o Audita nao deve apresentar o modulo como consulta automatica funcional nem simular resposta do ONR.

## Texto para o pedido de credenciamento

Assunto: `Credenciamento WSRIDIGITAL - Audita`

> Somos a Audita, plataforma de auditoria documental e due diligence. Solicitamos credenciamento como pessoa juridica conveniada e habilitacao do modulo Chave de Acesso / WSRIDIGITAL. Pretendemos integrar Pesquisa Previa por CPF/CNPJ, Consulta Eletronica/Pesquisa Qualificada, Certidao Digital e consulta de saldo/creditos, sempre com autorizacao e finalidade registral documentadas. Pedimos orientacoes sobre cadastro, Admin Master, modalidade pre-paga ou pos-paga, IDParceiro, homologacao, producao, limites, custos e requisitos de certificado digital/LGPD.

O envio deve incluir os dados empresariais e a estimativa de volume listados acima.
