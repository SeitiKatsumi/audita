import {
  getJecPetitionTemplate,
  renderJecPetitionTemplate,
} from "./jec-petition-templates.mjs";
import {
  buildProfileAddress,
  formatProfileCpf,
  formatProfilePhone,
  validateProfileCpf,
} from "./user-profile.service.mjs";

export const JEC_SMALL_CLAIMS_POLICY = Object.freeze({
  salaryCount: 20,
  referenceYear: 2026,
  minimumWageBrl: 1621,
  maximumCaseValueBrl: 32420,
  lawSource: "https://www.planalto.gov.br/ccivil_03/leis/l9099.htm",
  wageSource:
    "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/d12797.htm",
});

const JEC_PORTALS = Object.freeze({
  SP: {
    uf: "SP",
    tribunal: "TJSP",
    name: "Juizado Especial Cível de São Paulo",
    officialUrl: "https://www.tjsp.jus.br/juizadosespeciais",
    startUrl: "https://portal.tjsp.jus.br/PeticionamentoEletronico",
    mode: "eproc",
    allowedHosts: ["www.tjsp.jus.br", "portal.tjsp.jus.br", "eproc1g.tjsp.jus.br"],
    checkpoint: "Login no eproc e revisão da petição inicial.",
    requirements: [
      "Conta de acesso aceita pelo eproc.",
      "Documentos pessoais, comprovante de endereço e provas da cobrança.",
      "Revisão de comarca, classe, assunto, valor da causa e pedidos.",
    ],
    instructions: [
      "Abra o peticionamento eletrônico e siga para o eproc.",
      "Após o login, escolha Petição Inicial e o rito do Juizado Especial Cível.",
      "Pare antes de assinar ou protocolar.",
    ],
    guide: {
      verifiedAt: "2026-07-27",
      sources: [
        "https://www.tjsp.jus.br/juizadosespeciais",
        "https://www.tjsp.jus.br/Download/EPROC/ManuaisPublicoExterno/2.1-EPROC-CIDADAO-EXTERNO-Ajuizamento-de-Acoes_13.04.2026.pdf",
      ],
      steps: [
        "Na tela inicial do Peticionamento Eletrônico, selecione o Foro/Comarca e depois a Competência exibida para o Juizado; use esses nomes humanos, nunca identificadores técnicos do HTML.",
        "Aguarde o usuário concluir o login no eproc; credenciais ficam somente no navegador.",
        "No menu lateral, acesse Petição inicial.",
        "Em Informações do Processo, revise comarca, Valor da Causa, Rito = Juizado Especial, Área, Classe Processual e Nível de Sigilo.",
        "Em Assunto, pesquise e inclua ao menos um assunto; o primeiro deve representar o assunto principal. Se houver dúvida jurídica, peça confirmação humana.",
        "Em Partes (Autores), consulte por CPF/CNPJ, inclua a parte, marque a parte principal e revise representação e Justiça Gratuita.",
        "Adicione obrigatoriamente endereço, e-mail e celular da parte autora.",
        "Em Partes (Réus), consulte e inclua o réu; se faltarem CPF/CNPJ ou endereço, use somente as opções oficiais de dado desconhecido após confirmação humana.",
        "Revise informações adicionais e anexe a petição e as provas nos formatos aceitos pelo eproc.",
        "Confira o resumo completo e devolva o controle ao usuário antes de qualquer confirmação de ajuizamento.",
      ],
      humanOnly: [
        "Login e autenticação.",
        "Escolha jurídica ambígua de comarca, classe, assunto, sigilo, gratuidade ou pedido.",
        "Upload de documentos pessoais e provas sensíveis.",
        "Finalizar e Confirmar ajuizamento.",
      ],
      caseNotes: [
        "Para cobrança bancária não reconhecida, a classe, o assunto e a competência territorial precisam ser confirmados pelo usuário; a IA não deve escolhê-los por inferência.",
      ],
    },
  },
  RJ: {
    uf: "RJ",
    tribunal: "TJRJ",
    name: "Petição Cidadã do Rio de Janeiro",
    officialUrl: "https://www3.tjrj.jus.br/peticao-cidada/",
    startUrl: "https://www3.tjrj.jus.br/peticao-cidada/",
    mode: "peticao_cidada",
    allowedHosts: ["www3.tjrj.jus.br", "sso.acesso.gov.br", "acesso.gov.br"],
    checkpoint: "Escolha do assunto e autenticação gov.br prata ou ouro.",
    requirements: [
      "Conta gov.br nível prata ou ouro.",
      "Documento com foto, CPF, comprovante de endereço recente e provas.",
      "Escolha correta do assunto; cobrança sem negativação pode exigir categoria diferente.",
    ],
    instructions: [
      "Não selecione automaticamente cobrança ou negativação indevida sem confirmar os fatos.",
      "Pare no gov.br e sempre que o assunto jurídico estiver ambíguo.",
      "Pare antes do envio final.",
    ],
    guide: {
      verifiedAt: "2026-07-27",
      sources: [
        "https://www3.tjrj.jus.br/peticao-cidada/",
        "https://www.tjrj.jus.br/documents/d/juizados-especiais/manual_do_usuario_sistema_de_peticao_cidada_pje_v1-1",
      ],
      steps: [
        "Na página inicial, revise com o usuário a categoria adequada. Para cobrança bancária não reconhecida, a opção visível Cobrança ou negativação indevida só deve ser usada após confirmação humana.",
        "O usuário entra com gov.br nível prata ou ouro; CPF, senha e autenticação ficam somente no navegador.",
        "Na etapa Autor, preencha e revise a qualificação e anexe o documento solicitado; depois use Salvar autor e Continuar.",
        "Na etapa Réu, informe a instituição demandada com dados conferidos em fonte oficial; nunca invente CNPJ ou endereço.",
        "Em Fatos e Fundamentos, use somente o relato e as evidências confirmadas, incluindo protocolo apenas se existir.",
        "Em Outras Provas, anexe somente arquivos escolhidos pelo usuário.",
        "Em Pedidos, confirme cada pedido e valor com o usuário antes de avançar.",
        "Na etapa Petição, revise integralmente o texto gerado e devolva o controle ao usuário.",
      ],
      humanOnly: [
        "Login gov.br e eventual validação adicional.",
        "Escolha da categoria e decisões jurídicas ambíguas.",
        "Upload de documentos pessoais e provas sensíveis.",
        "Enviar reclamação.",
      ],
      caseNotes: [
        "O Petição Cidadã exige conta gov.br prata ou ouro e informa salvamento automático periódico por prazo limitado.",
        "Não presuma que toda cobrança bancária envolve negativação; confirme a categoria exibida no portal.",
      ],
    },
  },
  MG: {
    uf: "MG",
    tribunal: "TJMG",
    name: "Pré-atermação dos Juizados Especiais de Minas Gerais",
    officialUrl: "https://www.tjmg.jus.br/portal-tjmg/institucional/juizados-especiais/",
    startUrl: "https://www.tjmg.jus.br/portal-tjmg/institucional/juizados-especiais/",
    capitalStartUrl:
      "https://docs.google.com/forms/d/e/1FAIpQLSc8QFOwlmtr6ItbFwD7UKK8ErkLPnY6MXqQUxl35-WVgT-aeg/viewform?usp=dialog",
    mode: "pre_atermacao",
    allowedHosts: ["www.tjmg.jus.br", "docs.google.com", "accounts.google.com"],
    checkpoint: "Conta Google para anexos e revisão da pré-atermação.",
    requirements: [
      "Para Belo Horizonte, formulário de pré-atermação da capital.",
      "Para o interior, escolha da unidade competente na página oficial.",
      "Documentos pessoais, endereço, provas e qualificação da parte contrária.",
    ],
    instructions: [
      "Use o formulário da capital somente quando a cidade informada for Belo Horizonte.",
      "Para outra cidade, mantenha a página oficial e peça ao usuário para confirmar a unidade.",
      "Pare antes de enviar o formulário.",
    ],
    guide: {
      verifiedAt: "2026-07-27",
      sources: [
        "https://www.tjmg.jus.br/portal-tjmg/institucional/juizados-especiais/",
      ],
      steps: [
        "Confirme a cidade e se a causa ficará no limite de até 20 salários mínimos para o fluxo sem advogado.",
        "Para Belo Horizonte, abra a pré-atermação da capital. Para o interior, localize na página oficial a unidade competente e peça confirmação ao usuário.",
        "Se o formulário solicitar conta Google, o usuário deve assumir o controle e autenticar-se no navegador.",
        "Preencha qualificação da parte autora, dados conferidos do réu, fatos, pedidos e valor da causa usando somente informações confirmadas.",
        "Anexe documentos pessoais, comprovante de endereço, rascunho e provas somente sob controle humano.",
        "Revise a unidade, o resumo e os anexos antes de devolver o controle ao usuário.",
      ],
      humanOnly: [
        "Escolha da unidade competente no interior.",
        "Login Google e autenticação.",
        "Upload de documentos pessoais e provas sensíveis.",
        "Envio da pré-atermação.",
      ],
      caseNotes: [
        "A página oficial diferencia a pré-atermação da capital dos canais do interior; não use automaticamente o formulário de Belo Horizonte para outra cidade.",
      ],
    },
  },
  PR: {
    uf: "PR",
    tribunal: "TJPR",
    name: "Formulário Virtual dos Juizados Especiais do Paraná",
    officialUrl: "https://ejud.tjpr.jus.br/web/guest/formulario-virtual-juizados-especiais",
    startUrl: "https://ejud.tjpr.jus.br/web/guest/formulario-virtual-juizados-especiais",
    capitalStartUrl: "https://portal.tjpr.jus.br/portletforms/publico/frm.do?idFormulario=6953",
    mode: "formulario_virtual",
    allowedHosts: ["ejud.tjpr.jus.br", "ateliedeinovacao.tjpr.jus.br", "portal.tjpr.jus.br"],
    checkpoint: "Revisão do formulário da unidade competente.",
    requirements: [
      "Para Curitiba, formulário central próprio para nova ação.",
      "Para outras cidades, seleção da comarca pela página oficial.",
      "Documentos pessoais, provas e dados completos da parte contrária.",
    ],
    instructions: [
      "Use o formulário direto somente quando a cidade informada for Curitiba.",
      "Confirme se há no máximo seis autores e réus quando o formulário perguntar.",
      "Pare antes de Enviar Formulário.",
    ],
    guide: {
      verifiedAt: "2026-07-27",
      sources: [
        "https://ejud.tjpr.jus.br/web/guest/formulario-virtual-juizados-especiais",
      ],
      steps: [
        "Confirme a comarca e se a causa ficará no limite de até 20 salários mínimos para o fluxo sem advogado.",
        "Em Curitiba, uma demanda contra banco deve seguir a opção BANCÁRIO, independentemente do bairro. Para outra cidade, selecione a comarca e depois Nova ação.",
        "Preencha os dados pessoais da parte autora e os dados conferidos da parte ré.",
        "Descreva fatos, pedidos e valor da causa somente com base no relato e no rascunho revisado.",
        "Anexe foto do autor com documento, documento de identificação, comprovante de residência atual e provas, conforme as instruções do formulário.",
        "Revise todos os dados e anexos e devolva o controle ao usuário antes do envio.",
      ],
      humanOnly: [
        "Escolha da comarca e confirmação da categoria BANCÁRIO.",
        "Upload da foto com documento, identificação, comprovante de residência e provas.",
        "Enviar Formulário.",
      ],
      caseNotes: [
        "Para Curitiba e matéria bancária, a página oficial orienta selecionar BANCÁRIO independentemente do bairro.",
        "Os formulários virtuais são destinados a causas de até 20 salários mínimos sem advogado; situações fora desse limite exigem outro caminho.",
      ],
    },
  },
  MT: {
    uf: "MT",
    tribunal: "TJMT",
    name: "Atermação Eletrônica dos Juizados Especiais de Mato Grosso",
    officialUrl: "https://atermacao.tjmt.jus.br/",
    startUrl: "https://atermacao.tjmt.jus.br/",
    mode: "atermacao_eletronica",
    allowedHosts: ["atermacao.tjmt.jus.br", "tjmt.jus.br"],
    checkpoint: "Primeiro campo de identificação, documento, contato, anexo ou envio.",
    requirements: [
      "Causa dentro do limite aplicável ao Juizado sem advogado.",
      "Documentos e provas revisados pelo usuário antes da atermação.",
    ],
    instructions: [
      "Abra somente a página inicial da atermação e confirme que ela carregou.",
      "Não preencha CPF/CNPJ, nome, contato, anexos ou qualquer formulário.",
      "Pare antes de qualquer campo ou avanço que inicie a solicitação.",
    ],
    guide: {
      verifiedAt: "2026-07-30",
      sources: ["https://atermacao.tjmt.jus.br/"],
      steps: ["Abra a página de atermação e confirme que o serviço está disponível."],
      humanOnly: ["Dados pessoais, documentos, triagem do servidor e envio."],
      caseNotes: ["O pedido é submetido à triagem do tribunal antes da distribuição."],
    },
  },
  DF: {
    uf: "DF",
    tribunal: "TJDFT",
    name: "Peticionamento Virtual dos Juizados Especiais do Distrito Federal",
    officialUrl: "https://www.tjdft.jus.br/servicos/distribuicao-e-atendimento/como-iniciar-um-processo-nos-juizados-especiais",
    startUrl: "https://www.tjdft.jus.br/servicos/distribuicao-e-atendimento/como-iniciar-um-processo-nos-juizados-especiais",
    mode: "triagem_remota",
    allowedHosts: ["tjdft.jus.br", "atalho.tjdft.jus.br"],
    checkpoint: "Cadastro no PJe, assinatura, envio por e-mail, agendamento ou atendimento humano.",
    requirements: [
      "Valor da causa de até 20 salários mínimos para seguir sem advogado no fluxo de pequenas causas da IA AUDITA.",
      "Petição inicial revisada, assinada e salva em PDF.",
      "RG ou CNH, CPF, comprovante de endereço e documentos que comprovem a reclamação, em arquivos separados.",
      "E-mail pessoal previamente cadastrado no PJe para usar o peticionamento por e-mail.",
    ],
    instructions: [
      "Abra a orientação oficial e identifique as opções NUPEVI, NUREVI e atendimento presencial.",
      "Não cadastre e-mail, envie documentos, agende atendimento ou entre em videoconferência.",
    ],
    guide: {
      verifiedAt: "2026-08-07",
      sources: [
        "https://www.tjdft.jus.br/servicos/distribuicao-e-atendimento/como-iniciar-um-processo-nos-juizados-especiais",
        "https://www.tjdft.jus.br/carta-de-servicos/servicos/processo-judicial-1a-instancia/iniciar-processo-juizados-especiais",
      ],
      steps: [
        "Confirme que o valor da causa é de até 20 salários mínimos e que o caso pode seguir no Juizado Especial Cível sem advogado.",
        "Confirme a competência territorial. Em regra, use o local indicado para o seu domicílio, mas confira a orientação do TJDFT para o caso concreto.",
        "Como a IA AUDITA já prepara o PDF, escolha a opção do NUPEVI para enviar uma petição pronta por e-mail.",
        "Cadastre previamente seu e-mail pessoal no PJe, caso ainda não tenha cadastro.",
        "Revise e assine a petição, com assinatura física digitalizada ou assinatura digital.",
        "Separe, em arquivos legíveis, RG ou CNH, CPF, comprovante de endereço e todas as provas da cobrança.",
        "Envie a petição assinada e os documentos a partir do e-mail cadastrado no PJe para peticionarnojuizado@tjdft.jus.br.",
        "Guarde a confirmação de distribuição, confira a data da audiência de conciliação e acompanhe pessoalmente as movimentações do processo.",
      ],
      humanOnly: [
        "Confirmar competência territorial e que o valor está dentro do limite de pequenas causas sem advogado.",
        "Cadastrar o e-mail no PJe e assinar a petição.",
        "Selecionar os anexos, enviar o e-mail e conferir o comprovante de distribuição.",
        "Acompanhar o processo e comparecer pessoalmente às audiências marcadas.",
        "Se preferir o NUREVI, agendar e participar pessoalmente das videochamadas.",
      ],
      caseNotes: [
        "O TJDFT também oferece atendimento por videochamada no NUREVI e atendimento presencial nos NAJs.",
        "O peticionamento por e-mail é gratuito e deve partir do e-mail previamente cadastrado no PJe.",
        "Depois da distribuição, o acompanhamento é responsabilidade da parte; o tribunal não avisa todas as movimentações por iniciativa própria.",
      ],
    },
  },
  GO: {
    uf: "GO",
    tribunal: "TJGO",
    name: "CEAJE do Tribunal de Justiça de Goiás",
    officialUrl: "https://orquestrador.tjgo.jus.br/",
    startUrl: "https://orquestrador.tjgo.jus.br/",
    mode: "triagem_autenticada",
    allowedHosts: ["orquestrador.tjgo.jus.br", "tjgo.jus.br"],
    checkpoint: "Tela inicial de autenticação da CEAJE.",
    requirements: ["Triagem humana e atendimento pela Central Estadual de Atermação."],
    instructions: [
      "Abra a página e confirme a existência da CEAJE.",
      "Pare na tela de e-mail e senha; não preencha nem crie cadastro.",
    ],
    guide: {
      verifiedAt: "2026-07-30",
      sources: ["https://orquestrador.tjgo.jus.br/"],
      steps: ["Confirme visualmente a entrada da CEAJE e interrompa antes da autenticação."],
      humanOnly: ["Login, cadastro, triagem, documentos e protocolo."],
      caseNotes: ["Goiânia pode utilizar canal próprio de atermação; não inferir comarca."],
    },
  },
  AC: {
    uf: "AC", tribunal: "TJAC", name: "Petição Cidadão do Acre",
    officialUrl: "https://www.tjac.jus.br/consultas/peticao-cidadao/",
    startUrl: "https://www.tjac.jus.br/consultas/peticao-cidadao/", mode: "peticao_cidada",
    allowedHosts: ["www.tjac.jus.br"],
    checkpoint: "Cadastro do cidadão, CPF, documentos, termo ou envio.",
    requirements: ["Triagem e documentos revisados pelo usuário."],
    instructions: ["Confirme o título e as instruções da Petição Cidadão.", "Pare antes de qualquer campo, termo, anexo ou envio."],
    guide: { verifiedAt: "2026-07-30", sources: ["https://www.tjac.jus.br/consultas/peticao-cidadao/"], steps: ["Confirme a página de primeiro atendimento."], humanOnly: ["Cadastro, documentos, termo e envio."], caseNotes: ["A atermação passa por análise antes da distribuição."] },
  },
  AM: {
    uf: "AM", tribunal: "TJAM", name: "Atermação Online dos Juizados de Manaus",
    officialUrl: "https://www.tjam.jus.br/index.php/juizados/atermacao",
    startUrl: "https://www.tjam.jus.br/index.php/juizados/atermacao", mode: "atermacao_online",
    allowedHosts: ["www.tjam.jus.br", "forms.gle", "docs.google.com", "accounts.google.com"],
    checkpoint: "Primeiro campo do formulário, login Google, anexo ou envio.",
    requirements: ["Pessoa física; fluxo oficial limitado à Comarca de Manaus e causas até 20 salários mínimos sem advogado."],
    instructions: ["Confirme a página e, se houver link oficial, abra apenas a primeira tela do formulário.", "Pare antes de inserir dados, autenticar no Google, anexar ou enviar."],
    guide: { verifiedAt: "2026-07-30", sources: ["https://www.tjam.jus.br/index.php/juizados/atermacao"], steps: ["Confirme a entrada oficial de atermação."], humanOnly: ["Dados, login, anexos, concordância e envio."], caseNotes: ["O tribunal revisa a solicitação antes do ajuizamento."] },
  },
  CE: {
    uf: "CE", tribunal: "TJCE", name: "SISAtermação do Ceará",
    officialUrl: "https://sisatermacao.tjce.jus.br/", startUrl: "https://sisatermacao.tjce.jus.br/", mode: "atermacao_online",
    allowedHosts: ["sisatermacao.tjce.jus.br", "sbje.tjce.jus.br"],
    checkpoint: "Dados do reclamante ou reclamado, anexos, termo ou envio.",
    requirements: ["Unidade competente, documentos e prova escolhidos pelo usuário."],
    instructions: ["Abra a tela inicial e confirme as instruções do SISAtermação.", "Não preencha campos, aceite termos, anexe ou envie."],
    guide: { verifiedAt: "2026-07-30", sources: ["https://sisatermacao.tjce.jus.br/"], steps: ["Confirme o serviço sem iniciar a solicitação."], humanOnly: ["Dados, anexos, termo e envio."], caseNotes: ["A Central de Atermação analisa antes do protocolo no PJe."] },
  },
  MA: {
    uf: "MA", tribunal: "TJMA", name: "Atermação Online do Maranhão",
    officialUrl: "https://www.tjma.jus.br/links/portal/cidadao", startUrl: "https://sistemas.tjma.jus.br/atermacao/", mode: "atermacao_online",
    allowedHosts: ["www.tjma.jus.br", "sistemas.tjma.jus.br"],
    checkpoint: "Primeiro dado do formulário, anexo ou envio.",
    requirements: ["Causa dentro do limite aplicável e documentos revisados pelo usuário."],
    instructions: ["Permita o carregamento da aplicação e abra apenas a entrada que leve ao formulário, se a ação for reversível e não iniciar envio.", "Pare no primeiro campo, escolha territorial, login, anexo ou envio; não preencha nem envie."],
    guide: { verifiedAt: "2026-07-30", sources: ["https://www.tjma.jus.br/links/portal/cidadao", "https://sistemas.tjma.jus.br/atermacao/"], steps: ["Confirme a aplicação oficial e, se houver uma entrada segura, abra somente a tela inicial do formulário."], humanOnly: ["Escolha territorial, dados, anexos e envio."], caseNotes: ["O pedido é analisado pelo tribunal antes da distribuição."] },
  },
  PA: {
    uf: "PA", tribunal: "TJPA", name: "Atermação Online do Pará",
    officialUrl: "https://www.tjpa.jus.br/PortalExterno/institucional/Atermacao-Online/1590300-atermacao-online.xhtml", startUrl: "https://www.tjpa.jus.br/PortalExterno/institucional/Atermacao-Online/1590300-atermacao-online.xhtml", mode: "atermacao_online",
    allowedHosts: ["www.tjpa.jus.br"], checkpoint: "Primeiro campo, login, CAPTCHA, anexo ou envio.",
    requirements: ["Cobertura territorial e unidade devem ser confirmadas pelo usuário."],
    instructions: ["Aguarde a landing page com JavaScript e identifique a entrada do serviço.", "Pare antes de iniciar formulário, dados, login, CAPTCHA, anexos ou envio."],
    guide: { verifiedAt: "2026-07-30", sources: ["https://www.tjpa.jus.br/PortalExterno/institucional/Atermacao-Online/1590300-atermacao-online.xhtml"], steps: ["Confirme visualmente a landing page oficial."], humanOnly: ["Dados, login, CAPTCHA, anexos e envio."], caseNotes: ["Cobertura atual deve ser confirmada antes de orientar a comarca."] },
  },
  PB: {
    uf: "PB", tribunal: "TJPB", name: "Peça Você – Juizados da Paraíba",
    officialUrl: "https://app.tjpb.jus.br/peca-voce-juizados/", startUrl: "https://app.tjpb.jus.br/peca-voce-juizados/", mode: "atermacao_online",
    allowedHosts: ["app.tjpb.jus.br", "www.tjpb.jus.br"], checkpoint: "Novo protocolo, dados da reclamação, anexo, autenticação ou envio.",
    requirements: ["Fluxo sem advogado no limite aplicável e triagem posterior pelo Juizado."],
    instructions: ["Abra a página inicial e confirme o serviço Peça Você.", "Não escolha novo protocolo nem preencha dados, anexos ou envio."],
    guide: { verifiedAt: "2026-07-30", sources: ["https://app.tjpb.jus.br/peca-voce-juizados/"], steps: ["Confirme a página inicial do serviço."], humanOnly: ["Protocolo, dados, anexos, autenticação e envio."], caseNotes: ["A triagem posterior no Juizado é obrigatória."] },
  },
  ES: {
    uf: "ES", tribunal: "TJES", name: "Balcão Virtual do Espírito Santo",
    officialUrl: "https://www.tjes.jus.br/balcao-virtual/", startUrl: "https://www.tjes.jus.br/balcao-virtual/", mode: "triagem_remota",
    allowedHosts: ["www.tjes.jus.br"], checkpoint: "Escolha da unidade, entrada na fila de videoatendimento ou identificação.",
    requirements: ["A unidade competente e a possibilidade de atermação devem ser confirmadas pelo usuário com o tribunal."],
    instructions: ["Abra somente a página oficial do Balcão Virtual.", "Pare antes de escolher unidade, entrar em fila, fornecer identificação ou iniciar atendimento."],
    guide: { verifiedAt: "2026-07-30", sources: ["https://www.tjes.jus.br/balcao-virtual/"], steps: ["Confirme que o Balcão Virtual oficial carregou."], humanOnly: ["Escolha de unidade, fila, identificação e qualquer orientação para protocolo."], caseNotes: ["É um canal de atendimento; não há protocolo autônomo presumido."] },
  },
  SC: {
    uf: "SC", tribunal: "TJSC", name: "Balcão Virtual de Santa Catarina",
    officialUrl: "https://www.tjsc.jus.br/balcao-virtual/balcao-virtual-comarcas", startUrl: "https://www.tjsc.jus.br/balcao-virtual/balcao-virtual-comarcas", mode: "triagem_remota",
    allowedHosts: ["www.tjsc.jus.br"], checkpoint: "Escolha da comarca ou unidade, entrada no atendimento ou identificação.",
    requirements: ["A comarca e a unidade de atermação precisam ser confirmadas pelo usuário."],
    instructions: ["Abra somente a lista oficial do Balcão Virtual.", "Pare antes de selecionar comarca, unidade, sala, fornecer identificação ou iniciar atendimento."],
    guide: { verifiedAt: "2026-07-30", sources: ["https://www.tjsc.jus.br/balcao-virtual/balcao-virtual-comarcas"], steps: ["Confirme que a lista oficial de comarcas carregou."], humanOnly: ["Comarca, unidade, sala de atendimento, identificação e protocolo."], caseNotes: ["É canal de atendimento e localiza unidades de atermação; não representa protocolo autônomo."] },
  },
  BA: {
    uf: "BA", tribunal: "TJBA", name: "PROJUDI dos Juizados da Bahia",
    officialUrl: "https://projudi.tjba.jus.br/projudi/", startUrl: "https://projudi.tjba.jus.br/projudi/", mode: "peticionamento_cidadao",
    allowedHosts: ["projudi.tjba.jus.br"], checkpoint: "Cadastro ou login da pessoa física no PROJUDI.",
    requirements: ["A unidade competente e o cadastro da pessoa física devem ser confirmados pelo usuário."],
    instructions: ["Abra somente a página inicial oficial do PROJUDI.", "Pare antes de cadastro, login, seleção de ação, preenchimento, anexos ou envio."],
    guide: { verifiedAt: "2026-07-30", sources: ["https://projudi.tjba.jus.br/projudi/"], steps: ["Confirme a página oficial do PROJUDI."], humanOnly: ["Cadastro, login, escolha processual, dados, anexos e envio."], caseNotes: ["O portal informa serviços para pessoa física apta a propor ação perante o Juizado." ] },
  },
  RO: {
    uf: "RO", tribunal: "TJRO", name: "AtermaJus de Rondônia",
    officialUrl: "https://atermajus.tjro.jus.br/", startUrl: "https://atermajus.tjro.jus.br/", mode: "atermacao_online",
    allowedHosts: ["atermajus.tjro.jus.br", "www.tjro.jus.br"], checkpoint: "Início da solicitação, dados do formulário ou autenticação.",
    requirements: ["Causa dentro do limite aplicável e triagem da Central de Atendimento."],
    instructions: ["Abra somente o AtermaJus oficial.", "Pare antes de iniciar solicitação, preencher dados, anexar, autenticar ou finalizar."],
    guide: { verifiedAt: "2026-07-30", sources: ["https://atermajus.tjro.jus.br/", "https://www.tjro.jus.br/noticias-cgj/mais-noticias-cgj/atermajus-tjro-lanca-plataforma-que-amplia-acesso-da-populacao-a-justica-2"], steps: ["Confirme a entrada oficial do AtermaJus."], humanOnly: ["Início da solicitação, dados, anexos, autenticação e finalização."], caseNotes: ["O pedido é recebido pelo canal oficial e passa por tratamento do tribunal."] },
  },
  RR: {
    uf: "RR", tribunal: "TJRR", name: "Balcão Virtual de Roraima",
    officialUrl: "https://balcaovirtual.tjrr.jus.br/inicio", startUrl: "https://balcaovirtual.tjrr.jus.br/inicio", mode: "triagem_remota",
    allowedHosts: ["balcaovirtual.tjrr.jus.br"], checkpoint: "Escolha de Juizados Especiais, entrada em videoconferência ou identificação.",
    requirements: ["A unidade e o meio de atermação devem ser confirmados pelo usuário com o tribunal."],
    instructions: ["Abra somente a página oficial do Balcão Virtual.", "Pare antes de selecionar o atendimento, abrir videoconferência, fornecer identificação ou relatar o caso."],
    guide: { verifiedAt: "2026-07-30", sources: ["https://balcaovirtual.tjrr.jus.br/inicio", "https://www.tjrr.jus.br/index.php/como-ingressar-com-acao-nos-juizados-civeis"], steps: ["Confirme que o Balcão Virtual oficial carregou."], humanOnly: ["Unidade, videoconferência, identificação, relato, documentos e protocolo."], caseNotes: ["É triagem e atendimento, não protocolo autônomo presumido."] },
  },
  PI: {
    uf: "PI", tribunal: "TJPI", name: "Balcão Virtual do Piauí",
    officialUrl: "https://www.tjpi.jus.br/portaltjpi/balcaovirtual/", startUrl: "https://www.tjpi.jus.br/portaltjpi/balcaovirtual/", mode: "triagem_remota",
    allowedHosts: ["www.tjpi.jus.br"], checkpoint: "Escolha da unidade, entrada no atendimento remoto ou identificação.",
    requirements: ["A unidade competente e a forma de atermação devem ser confirmadas pelo usuário com o tribunal."],
    instructions: ["Abra somente o Balcão Virtual oficial.", "Pare antes de escolher unidade, abrir atendimento, fornecer identificação ou relatar o caso."],
    guide: { verifiedAt: "2026-07-30", sources: ["https://www.tjpi.jus.br/portaltjpi/balcaovirtual/"], steps: ["Confirme que o Balcão Virtual oficial carregou."], humanOnly: ["Unidade, atendimento, identificação, relato, documentos e protocolo."], caseNotes: ["É canal de atendimento/triagem; não representa protocolo autônomo."] },
  },
  SE: {
    uf: "SE", tribunal: "TJSE", name: "Pré-Autuação dos Juizados de Sergipe",
    officialUrl: "https://www.tjse.jus.br/portal/servicos/judiciais/juizados-especiais-preatuacao", startUrl: "https://www.tjse.jus.br/portal/servicos/judiciais/juizados-especiais-preatuacao", mode: "pre_atermacao_online",
    allowedHosts: ["www.tjse.jus.br"], checkpoint: "Primeiro campo do formulário de pré-autuação, documento ou envio.",
    requirements: ["Causa no limite aplicável e confirmação posterior pelo tribunal."],
    instructions: ["Abra somente o formulário oficial de Pré-Autuação.", "Pare antes de preencher qualquer campo, enviar documentos ou encaminhar a reclamação."],
    guide: { verifiedAt: "2026-07-30", sources: ["https://www.tjse.jus.br/portal/servicos/judiciais/juizados-especiais-preatuacao"], steps: ["Confirme que o formulário oficial carregou."], humanOnly: ["Dados, documentos, confirmação da unidade e envio."], caseNotes: ["O TJSE informa pré-atermação para causas no limite do Juizado sem advogado."] },
  },
  PE: {
    uf: "PE", tribunal: "TJPE", name: "Juizado Digital de Pernambuco",
    officialUrl: "https://portal.tjpe.jus.br/web/juizados-especiais/juizado-digital", startUrl: "https://portal.tjpe.jus.br/web/juizados-especiais/juizado-digital", mode: "atermacao_online",
    allowedHosts: ["portal.tjpe.jus.br", "www.tjpe.jus.br"], checkpoint: "Iniciar nova queixa, primeiro campo do formulário ou dados da solicitação.",
    requirements: ["A competência e o tipo de queixa devem ser confirmados pelo usuário."],
    instructions: ["Abra somente o Juizado Digital oficial.", "Pare antes de iniciar nova queixa, preencher campos, anexar documentos ou enviar."],
    guide: { verifiedAt: "2026-07-30", sources: ["https://portal.tjpe.jus.br/web/juizados-especiais/juizado-digital"], steps: ["Confirme a entrada oficial do Juizado Digital."], humanOnly: ["Início de queixa, dados, documentos e envio."], caseNotes: ["O TJPE informa que a queixa virtual é continuada posteriormente pela equipe do Juizado."] },
  },
  TO: {
    uf: "TO", tribunal: "TJTO", name: "Balcão Virtual do Tocantins",
    officialUrl: "https://tjto.jus.br/balcao-virtual", startUrl: "https://tjto.jus.br/balcao-virtual", mode: "triagem_remota",
    allowedHosts: ["tjto.jus.br", "www.tjto.jus.br"], checkpoint: "Escolha da unidade/sala virtual ou identificação para atendimento.",
    requirements: ["A unidade competente e a forma de atermação devem ser confirmadas com o tribunal."],
    instructions: ["Abra somente o Balcão Virtual oficial.", "Pare antes de selecionar unidade ou sala, informar identificação ou iniciar atendimento."],
    guide: { verifiedAt: "2026-07-30", sources: ["https://tjto.jus.br/balcao-virtual"], steps: ["Confirme que o Balcão Virtual oficial carregou."], humanOnly: ["Unidade, sala, identificação, relato, documentos e protocolo."], caseNotes: ["É canal de atendimento/triagem, não protocolo autônomo presumido."] },
  },
  RN: {
    uf: "RN", tribunal: "TJRN", name: "Balcão Virtual dos Juizados do Rio Grande do Norte",
    officialUrl: "https://www.tjrn.jus.br/balcao-virtual/", startUrl: "https://www.tjrn.jus.br/balcao-virtual/", mode: "triagem_remota",
    allowedHosts: ["www.tjrn.jus.br", "tjrn.jus.br"], checkpoint: "Escolha da secretaria/unidade, sala de videoconferência ou identificação.",
    requirements: ["Comarca e unidade competente devem ser confirmadas pelo usuário."],
    instructions: ["Abra somente a lista oficial do Balcão Virtual.", "Pare antes de escolher secretaria, abrir sala, informar identificação ou relatar o caso."],
    guide: { verifiedAt: "2026-07-30", sources: ["https://www.tjrn.jus.br/balcao-virtual/"], steps: ["Confirme a lista oficial de unidades e Juizados."], humanOnly: ["Unidade, sala, identificação, relato, documentos e protocolo."], caseNotes: ["É atendimento/triagem; não representa protocolo autônomo."] },
  },
  AL: {
    uf: "AL", tribunal: "TJAL", name: "Juizados Especiais de Alagoas",
    officialUrl: "https://www.tjal.jus.br/juizado/juizados-capital", startUrl: "https://www.tjal.jus.br/juizado/juizados-capital", mode: "triagem_remota",
    allowedHosts: ["www.tjal.jus.br", "tjal.jus.br"], checkpoint: "Escolha de comarca/juizado e abertura de canal de atendimento.",
    requirements: ["A competência territorial e o canal de atermação devem ser confirmados pelo usuário."],
    instructions: ["Abra somente a lista oficial dos Juizados.", "Pare antes de escolher unidade, abrir Balcão Virtual, informar identificação ou iniciar contato."],
    guide: { verifiedAt: "2026-07-30", sources: ["https://www.tjal.jus.br/juizado/juizados-capital"], steps: ["Confirme que a lista oficial de Juizados carregou."], humanOnly: ["Unidade, atendimento, identificação, relato, documentos e protocolo."], caseNotes: ["A página expõe unidades e canais; não foi presumido protocolo autônomo."] },
  },
  AP: {
    uf: "AP", tribunal: "TJAP", name: "PJe do Amapá – entrada autenticada",
    officialUrl: "https://pje.tjap.jus.br/1gconsulta/loginOld.seam?loginComCertificado=false", startUrl: "https://pje.tjap.jus.br/1gconsulta/loginOld.seam?loginComCertificado=false", mode: "peticionamento_autenticado",
    allowedHosts: ["pje.tjap.jus.br"], checkpoint: "Login por CPF/senha ou certificado digital no PJe.",
    requirements: ["O roteiro público antigo aponta atermação no SuperFácil; a entrada online atual observada é o PJe autenticado."],
    instructions: ["Abra somente a tela de entrada do PJe de 1º grau.", "Pare antes de informar CPF/CNPJ, senha, certificado, dados, anexos ou envio."],
    guide: { verifiedAt: "2026-07-30", sources: ["https://pje.tjap.jus.br/1gconsulta/loginOld.seam?loginComCertificado=false", "https://old.tjap.jus.br/portal/images/SGPE/ouvidoria/CARTA_DE_SERVIOS_AO_CIDADO_TJAP_compressed_1.pdf"], steps: ["Confirme a tela de autenticação do PJe e interrompa antes do login."], humanOnly: ["CPF/senha ou certificado digital, definição da unidade, dados, documentos e protocolo."], caseNotes: ["Não foi localizada uma URL pública atual de Solicitar Atermação para iniciar autonomamente pelo cidadão."] },
  },
  MS: {
    uf: "MS", tribunal: "TJMS", name: "eproc de Mato Grosso do Sul",
    officialUrl: "https://www.tjms.jus.br/eproc", startUrl: "https://eproc1g.tjms.jus.br/", mode: "peticionamento_autenticado",
    allowedHosts: ["www.tjms.jus.br", "eproc1g.tjms.jus.br"], checkpoint: "Login, cadastro ou certificado digital no eproc.",
    requirements: ["A competência do Juizado e o perfil de acesso devem ser confirmados pelo usuário."],
    instructions: ["Abra somente a entrada oficial de 1º grau do eproc.", "Pare na tela de usuário, senha e certificado; não crie cadastro, não preencha nem envie."],
    guide: { verifiedAt: "2026-07-30", sources: ["https://www.tjms.jus.br/eproc", "https://eproc1g.tjms.jus.br/"], steps: ["Confirme a página institucional e a tela de login do eproc."], humanOnly: ["Login, cadastro, certificado, escolha processual, dados, anexos e protocolo."], caseNotes: ["A página institucional confirma peticionamento eletrônico, mas o primeiro passo prático exige autenticação."] },
  },
  RS: {
    uf: "RS", tribunal: "TJRS", name: "Balcão Virtual do Rio Grande do Sul",
    officialUrl: "https://www.tjrs.jus.br/novo/processos-e-servicos/servicos-processuais/balcao-virtual/", startUrl: "https://www.tjrs.jus.br/novo/processos-e-servicos/servicos-processuais/balcao-virtual/", mode: "triagem_remota",
    allowedHosts: ["www.tjrs.jus.br"], checkpoint: "Escolha de Capital ou Interior, unidade e entrada no atendimento virtual.",
    requirements: ["A comarca, a unidade e a possibilidade de atermação precisam ser confirmadas no atendimento."],
    instructions: ["Abra somente a lista oficial do Balcão Virtual.", "Pare antes de escolher unidade, entrar em sala, fornecer identificação ou relatar o caso."],
    guide: { verifiedAt: "2026-07-30", sources: ["https://www.tjrs.jus.br/novo/processos-e-servicos/servicos-processuais/balcao-virtual/"], steps: ["Confirme que a página expõe os acessos de 1º grau para Capital e Interior."], humanOnly: ["Comarca, unidade, atendimento, identificação, documentos e protocolo."], caseNotes: ["O Balcão Virtual é canal de triagem; não foi presumido protocolo autônomo."] },
  },
});

const SUPPORTED_UFS = Object.freeze(Object.keys(JEC_PORTALS));
const MANUAL_FILING_STEPS = Object.freeze({
  SP: Object.freeze([
    "Confirme que o valor da causa é de até 20 salários mínimos e que o pedido pode seguir como pequena causa sem advogado.",
    "Acesse o Peticionamento Eletrônico do TJSP e selecione o Foro/Comarca e a competência do Juizado Especial Cível.",
    "Entre no eproc com a sua própria conta e escolha Petição inicial.",
    "Revise comarca, rito, classe, assunto, valor da causa, sigilo e gratuidade antes de avançar.",
    "Cadastre autor e réu com dados conferidos. Não invente documento ou endereço ausente.",
    "Anexe o PDF da petição e as provas que você decidiu apresentar.",
    "Confira o resumo completo e finalize o protocolo pessoalmente.",
  ]),
  RJ: Object.freeze([
    "Confirme que o valor da causa é de até 20 salários mínimos e que o pedido pode seguir como pequena causa sem advogado.",
    "Acesse o Petição Cidadã do TJRJ e confirme a categoria adequada para a cobrança relatada.",
    "Entre com a sua própria conta gov.br prata ou ouro.",
    "Revise os dados do autor e do réu e anexe apenas documentos escolhidos por você.",
    "Cole ou anexe os fatos, fundamentos, pedidos e valores do PDF revisado.",
    "Confira integralmente a petição e envie pessoalmente.",
  ]),
  MG: Object.freeze([
    "Confirme que o valor da causa é de até 20 salários mínimos e que o pedido pode seguir como pequena causa sem advogado.",
    "Acesse a página oficial dos Juizados Especiais do TJMG.",
    "Para Belo Horizonte, use a pré-atermação da capital. No interior, confirme a unidade competente.",
    "Preencha autor, réu, fatos, pedidos e valor da causa com os dados revisados.",
    "Anexe o PDF, os documentos pessoais e as provas escolhidas por você.",
    "Confira a unidade e o resumo antes de enviar pessoalmente.",
  ]),
  PR: Object.freeze([
    "Confirme que o valor da causa é de até 20 salários mínimos e que o pedido pode seguir como pequena causa sem advogado.",
    "Acesse o Formulário Virtual dos Juizados Especiais do TJPR.",
    "Em Curitiba, use a opção BANCÁRIO para matéria bancária. Em outra cidade, selecione a comarca.",
    "Preencha os dados do autor e do réu e revise fatos, pedidos e valor da causa.",
    "Anexe o PDF, identificação, comprovante de residência e as provas escolhidas por você.",
    "Confira todos os dados e envie o formulário pessoalmente.",
  ]),
  DF: Object.freeze([
    "Confirme que o valor da causa é de até 20 salários mínimos e que o pedido pode seguir no Juizado Especial Cível sem advogado.",
    "Abra a orientação oficial do TJDFT, confira a competência territorial e escolha a opção de preparar a petição em casa e enviá-la por e-mail ao NUPEVI.",
    "Se ainda não tiver cadastro, cadastre seu e-mail pessoal no PJe pelos canais indicados pelo TJDFT.",
    "Revise e assine o PDF da petição, com assinatura física digitalizada ou assinatura digital.",
    "Separe em arquivos legíveis RG ou CNH, CPF, comprovante de endereço e todas as provas da cobrança.",
    "Envie a petição e os documentos, a partir do e-mail cadastrado no PJe, para peticionarnojuizado@tjdft.jus.br.",
    "Guarde a confirmação de distribuição, confira a audiência de conciliação e acompanhe pessoalmente as movimentações do processo.",
  ]),
});

function genericManualFilingSteps(portal) {
  return [
    "Confirme que o valor da causa é de até 20 salários mínimos e que o pedido pode seguir como pequena causa sem advogado.",
    `Acesse o canal oficial do ${portal.tribunal} pelo link indicado pela IA AUDITA.`,
    "Confirme a comarca, a unidade competente e o caminho do Juizado Especial Cível.",
    "Faça o login, cadastro, agendamento ou atendimento somente no ambiente oficial quando solicitado.",
    "Apresente os dados do consumidor, do Itaú e o relato conforme o Relatório Técnico revisado.",
    "Anexe o Relatório Técnico de Auditoria, documento pessoal, comprovante de residência e as provas disponíveis, se o canal permitir anexos.",
    "Confira todas as informações e conclua pessoalmente o protocolo, a atermação ou o atendimento.",
  ];
}

function cleanText(value, maxLength = 400) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeUf(value) {
  return cleanText(value, 2).toUpperCase();
}

function normalizeCity(value) {
  return cleanText(value, 100);
}

function normalizeDocument(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 14);
}

function isCapital(uf, city) {
  const normalized = normalizeCity(city)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (uf === "MG" && normalized === "belo horizonte") || (uf === "PR" && normalized === "curitiba");
}

function publicPortal(portal, city = "") {
  const capital = isCapital(portal.uf, city);
  return {
    ...portal,
    startUrl: capital && portal.capitalStartUrl ? portal.capitalStartUrl : portal.startUrl,
    locationMode: capital ? "capital" : "state_entry",
  };
}

export function listJecPortals() {
  return SUPPORTED_UFS.map((uf) => publicPortal(JEC_PORTALS[uf]));
}

export function getJecPortal(uf, { city = "" } = {}) {
  const normalizedUf = normalizeUf(uf);
  const portal = JEC_PORTALS[normalizedUf];
  return portal ? publicPortal(portal, city) : null;
}

export function getJecManualFilingGuide(uf, { city = "", caseValue = null } = {}) {
  const portal = getJecPortal(uf, { city });
  if (!portal) return null;
  const stateSteps = MANUAL_FILING_STEPS[portal.uf];
  const smallClaims = evaluateJecSmallClaims(caseValue);
  return {
    uf: portal.uf,
    tribunal: portal.tribunal,
    title: `Pequenas causas no ${portal.tribunal}`,
    portalUrl: portal.startUrl,
    informationUrl: portal.officialUrl,
    steps: [...(stateSteps || genericManualFilingSteps(portal))],
    requirements: [...(portal.requirements || [])],
    verifiedAt: portal.guide?.verifiedAt || "",
    smallClaims,
    finalActionHumanOnly: true,
    note:
      "A IA AUDITA atua, por enquanto, somente com pequenas causas de até 20 salários mínimos. Ela prepara o Relatório Técnico em PDF e orienta o caminho; login, anexos, escolhas jurídicas e protocolo final são feitos pelo usuário.",
  };
}

function resolveJourney(caseData = {}, claimant = {}) {
  const availability = String(
    claimant?.historicalDocumentsAvailable ||
      caseData?.answers?.historicalDocumentsAvailable ||
      "pending",
  );
  if (availability === "yes") return "with_historical_documents";
  if (availability === "no") return "without_historical_documents";
  return "undetermined";
}

function normalizeMoney(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? Number(value.toFixed(2)) : null;
  }
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.includes(",")
    ? raw.replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".")
    : raw.replace(/[^\d.-]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? Number(amount.toFixed(2)) : null;
}

export function evaluateJecSmallClaims(caseValue) {
  const normalizedCaseValue = normalizeMoney(caseValue);
  const known = Number.isFinite(normalizedCaseValue) && normalizedCaseValue > 0;
  const eligible = known
    ? normalizedCaseValue <= JEC_SMALL_CLAIMS_POLICY.maximumCaseValueBrl
    : null;
  return {
    status: !known ? "unknown" : eligible ? "eligible" : "above_limit",
    known,
    eligible,
    caseValue: known ? normalizedCaseValue : null,
    ...JEC_SMALL_CLAIMS_POLICY,
    explanation:
      "Pequenas causas são tratadas no Juizado Especial Cível. Em causas de até 20 salários mínimos, a assistência por advogado é facultativa na primeira instância; recursos exigem advogado e podem envolver custas e honorários. Não existe garantia de risco zero.",
    contact: {
      available: false,
      label: "Falar com o time IA AUDITA",
      message: "Canal de atendimento em preparação. Em breve você poderá solicitar uma avaliação do time IA AUDITA por aqui.",
    },
  };
}

function formatPetitionMoney(value) {
  return Number.isFinite(value)
    ? value.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "";
}

function formatSuggestedMoney(value) {
  return Number.isFinite(value) ? formatPetitionMoney(value) : "";
}

export function suggestJecClaimValues({ caseData = {}, claimant = {} } = {}) {
  const disputed = (Array.isArray(caseData?.candidates) ? caseData.candidates : []).filter(
    (candidate) => candidate?.answer === "not_recognized",
  );
  const knownAmounts = disputed
    .map((candidate) => normalizeMoney(candidate?.amount))
    .filter((amount) => Number.isFinite(amount) && amount > 0);
  const evidencedPrincipal = Number(
    knownAmounts.reduce((total, amount) => total + amount, 0).toFixed(2),
  );
  const hasEvidencedAmount = evidencedPrincipal > 0;

  const suppliedDoubleRefund = normalizeMoney(claimant.doubleRefundAmount);
  const suppliedLostProfits =
    normalizeMoney(claimant.lostProfitsAmount) ??
    normalizeMoney(caseData?.answers?.reportedLostProfitsAmount);
  const suppliedMoralDamages =
    normalizeMoney(claimant.moralDamagesAmount) ??
    normalizeMoney(caseData?.answers?.requestedMoralDamagesAmount);
  const suppliedCaseValue = normalizeMoney(claimant.caseValue);

  const doubleRefundAmount =
    suppliedDoubleRefund ??
    (hasEvidencedAmount ? Number((evidencedPrincipal * 2).toFixed(2)) : null);
  const lostProfitsAmount =
    Number.isFinite(suppliedLostProfits) && suppliedLostProfits > 0
      ? suppliedLostProfits
      : null;
  const moralDamagesAmount =
    Number.isFinite(suppliedMoralDamages) && suppliedMoralDamages > 0
      ? suppliedMoralDamages
      : null;
  const calculatedCaseValue =
    Number.isFinite(doubleRefundAmount)
      ? Number(
          (
            doubleRefundAmount +
            (lostProfitsAmount || 0) +
            (moralDamagesAmount || 0)
          ).toFixed(2),
        )
      : null;
  const caseValue = suppliedCaseValue ?? calculatedCaseValue;

  const historicalEvidence = String(caseData?.answers?.historicalEvidence || "pending");
  const historicalDocuments = String(
    caseData?.answers?.historicalDocumentsAvailable || "pending",
  );
  const notes = [];

  if (hasEvidencedAmount) {
    notes.push(
      `Repetição em dobro estimada sobre R$ ${formatSuggestedMoney(evidencedPrincipal)} em cobranças não reconhecidas com valor identificado.`,
    );
  } else {
    notes.push(
      "Não foi sugerido valor de repetição em dobro porque nenhuma cobrança não reconhecida possui valor identificado.",
    );
  }
  notes.push(
    Number.isFinite(lostProfitsAmount)
      ? "Lucros cessantes mantidos conforme o valor informado para revisão."
      : "Lucros cessantes não foram incluídos porque não há perda de renda quantificada no caso.",
  );
  notes.push(
    Number.isFinite(moralDamagesAmount)
      ? "Danos morais mantidos conforme o valor informado para revisão."
      : "Danos morais não foram incluídos porque dependem dos fatos e de revisão jurídica individual.",
  );
  if (historicalEvidence === "yes" && historicalDocuments !== "yes") {
    notes.push(
      "O relato de cobranças recorrentes não entrou no cálculo porque os extratos históricos ainda não foram apresentados.",
    );
  }

  return {
    source: "audita_case_analysis",
    reviewRequired: true,
    evidencedPrincipal,
    disputedCount: disputed.length,
    knownAmountCount: knownAmounts.length,
    values: {
      doubleRefundAmount: formatSuggestedMoney(doubleRefundAmount),
      lostProfitsAmount: formatSuggestedMoney(lostProfitsAmount),
      moralDamagesAmount: formatSuggestedMoney(moralDamagesAmount),
      caseValue: formatSuggestedMoney(caseValue),
    },
    notes,
    disclaimer:
      "Estimativa inicial baseada apenas nos fatos e valores disponíveis. A repetição em dobro, os danos e o valor da causa dependem de revisão jurídica e decisão judicial.",
  };
}

function formatPetitionDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function formatEvidenceDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || "").trim());
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

function buildEvidenceSummary(caseData = {}) {
  const disputed = (
    Array.isArray(caseData?.candidates) ? caseData.candidates : []
  ).filter((candidate) => candidate?.answer === "not_recognized");
  const items = disputed.slice(0, 5).map((candidate) => {
    const label = cleanText(candidate?.label || candidate?.description, 120);
    const date = formatEvidenceDate(candidate?.date);
    const amount = normalizeMoney(candidate?.amount);
    return [
      label ? `“${label}”` : "um lançamento contestado",
      date ? `em ${date}` : "",
      Number.isFinite(amount) && amount > 0
        ? `no valor de R$ ${formatPetitionMoney(amount)}`
        : "",
    ]
      .filter(Boolean)
      .join(", ");
  });
  if (!items.length) return "";
  return items.length === 1
    ? `a cobrança ${items[0]}`
    : `as cobranças ${items.join("; ")}`;
}

const OMIT_TEMPLATE_SECTION = "__AUDITA_OMIT_SECTION__";

function getDisputedCandidates(caseData = {}) {
  return (Array.isArray(caseData?.candidates) ? caseData.candidates : []).filter(
    (candidate) => candidate?.answer === "not_recognized",
  );
}

function resolveDocumentAvailability(caseData = {}, journey = "") {
  const explicit = String(caseData?.answers?.documentAvailability || "").trim();
  if (["complete", "partial", "none"].includes(explicit)) return explicit;
  if (journey === "with_historical_documents") return "complete";
  return getDisputedCandidates(caseData).length ? "partial" : "none";
}

function collectEvidenceFiles(caseData = {}) {
  const names = [
    ...(Array.isArray(caseData?.cases)
      ? caseData.cases.map((item) => item?.document?.fileName)
      : []),
    ...getDisputedCandidates(caseData).map((candidate) => candidate?.sourceFileName),
    caseData?.document?.fileName,
  ];
  return [...new Set(names.map((item) => cleanText(item, 120)).filter(Boolean))];
}

function firstDebitPeriod(caseData = {}) {
  const dates = getDisputedCandidates(caseData)
    .map((candidate) => cleanText(candidate?.date, 40))
    .filter(Boolean)
    .sort();
  if (dates.length) return formatEvidenceDate(dates[0]) || dates[0];
  return cleanText(
    caseData?.answers?.firstDebitPeriod ||
      caseData?.answers?.priorComplaintDateApproximate,
    80,
  ) || "período ainda sujeito a comprovação";
}

function buildBankRelationshipContext(claimant = {}) {
  const agency = cleanText(claimant.bankAgency, 20);
  return agency
    ? `O(A) Autor(a) é titular de conta e/ou cartão gerido pela instituição financeira Ré, mantido na agência ${agency}.`
    : "O(A) Autor(a) é titular de conta e/ou cartão gerido pela instituição financeira Ré. O número da agência não foi informado neste rascunho.";
}

function buildDocumentAvailabilityContext(caseData = {}, journey = "") {
  const availability = resolveDocumentAvailability(caseData, journey);
  if (availability === "complete") {
    return "O(A) Autor(a) apresentou os extratos/faturas do período indicado para auditoria, preservados como documentos de origem do relatório técnico.";
  }
  if (availability === "partial") {
    return "O(A) Autor(a) apresentou somente parte dos extratos/faturas. Os demais documentos do período permanecem em poder da instituição financeira e são necessários para completar a apuração.";
  }
  return "O(A) Autor(a) não dispõe dos extratos/faturas necessários para quantificar a cobrança. Nenhum valor foi estimado pela IA AUDITA; a apuração depende da exibição dos documentos pela instituição financeira.";
}

function buildEvidenceContext(caseData = {}, journey = "") {
  const summary = buildEvidenceSummary(caseData);
  const availability = resolveDocumentAvailability(caseData, journey);
  if (summary) {
    return `Nos documentos apresentados, a IA AUDITA localizou ${summary}. O(A) Autor(a) marcou esses lançamentos como não reconhecidos. A classificação jurídica e a regularidade da contratação permanecem sujeitas à prova e à revisão do caso concreto.`;
  }
  if (availability === "none") {
    const description = cleanText(
      caseData?.answers?.suspectedChargeDescription ||
        caseData?.answers?.selectedBrand,
      120,
    );
    return description
      ? `O(A) Autor(a) relata suspeitar da cobrança “${description}”, mas nenhum lançamento com valor e data foi comprovado por documento nesta etapa.`
      : "O(A) Autor(a) relata suspeitar de cobrança não reconhecida, mas ainda não apresentou documento que individualize descrição, valor e data.";
  }
  return "A documentação apresentada não individualizou lançamento confirmado como não reconhecido; o rascunho permanece incompleto até revisão da evidência.";
}

function buildContractConfirmationContext(caseData = {}) {
  if (!getDisputedCandidates(caseData).length) {
    return "A existência, o conteúdo e a forma de eventual contratação permanecem sujeitos à exibição do instrumento e dos registros de consentimento pela instituição financeira.";
  }
  return "O(A) Autor(a) declarou não reconhecer a contratação correspondente aos lançamentos indicados e não localizou, entre os documentos submetidos à IA AUDITA, contrato ou registro de consentimento. Cabe à instituição financeira apresentar eventual prova de adesão, sem que a ausência do documento em poder do consumidor seja tratada isoladamente como prova definitiva.";
}

function buildPriorComplaintContext(caseData = {}) {
  const answers = caseData?.answers || {};
  if (String(answers.priorComplaint || "") !== "yes") {
    return OMIT_TEMPLATE_SECTION;
  }
  const date = cleanText(
    answers.priorComplaintDate || answers.priorComplaintDateApproximate,
    80,
  );
  const protocol = cleanText(answers.priorComplaintProtocol, 80);
  const details = [
    date ? `em ${date}` : "em data não informada",
    protocol ? `sob o protocolo nº ${protocol}` : "sem protocolo disponível",
  ].join(", ");
  return `O(A) Autor(a) relata ter buscado solução diretamente com o banco ${details}. Essa informação deve ser conferida com os comprovantes disponíveis antes do protocolo.`;
}

function buildDocumentExhibitionScope(caseData = {}, journey = "") {
  const availability = resolveDocumentAvailability(caseData, journey);
  return availability === "partial"
    ? "A cópia integral e analítica dos extratos/faturas que completem os períodos não abrangidos pelos documentos apresentados, desde o início da cobrança contestada, discriminando cada lançamento pertinente;"
    : "A cópia integral e analítica dos extratos/faturas desde o início da relação ou da cobrança relatada, discriminando cada lançamento pertinente;";
}

function buildTechnicalReportSection(caseData = {}, journey = "") {
  const availability = resolveDocumentAvailability(caseData, journey);
  const files = collectEvidenceFiles(caseData);
  const attachmentText = files.length
    ? ` Os documentos de origem identificados são: ${files.join(", ")}.`
    : "";
  if (availability === "complete") {
    return `Junta-se o Relatório Técnico de Auditoria da IA AUDITA, limitado aos lançamentos extraídos dos documentos apresentados e confirmados pelo consumidor como não reconhecidos.${attachmentText}`;
  }
  if (availability === "partial") {
    return `Junta-se relatório técnico parcial, limitado aos lançamentos efetivamente localizados nos documentos apresentados. O relatório não presume cobranças nos períodos ausentes e deve ser complementado após a exibição dos documentos faltantes.${attachmentText}`;
  }
  return "Sem extratos/faturas, não há relatório financeiro de valores apurados. O pedido de exibição documental busca obter a base necessária para futura análise, sem estimativa automática pela IA AUDITA.";
}

function hasCurrentChargeRisk(caseData = {}) {
  const answers = caseData?.answers || {};
  return answers.continuedAfterCancellation === "yes" || answers.currentChargeActive === "yes";
}

function buildEmergencyGrounds(caseData = {}) {
  return hasCurrentChargeRisk(caseData)
    ? "O(A) Autor(a) relata que a cobrança permanece ativa, circunstância que poderá justificar tutela de urgência se confirmada pelos documentos e pelos requisitos do art. 300 do CPC."
    : OMIT_TEMPLATE_SECTION;
}

function buildEmergencyRequest(caseData = {}) {
  return hasCurrentChargeRisk(caseData)
    ? "A concessão da Tutela de Urgência, se presentes os requisitos legais, para suspender novos lançamentos da mesma origem até decisão judicial, sob pena de multa a ser arbitrada pelo Juízo;"
    : OMIT_TEMPLATE_SECTION;
}

function buildDoubleRefundRequest(claimant = {}, templateId = "") {
  const amount = normalizeMoney(claimant.doubleRefundAmount);
  if (!(amount > 0)) {
    return templateId === "document_exhibition"
      ? "b) Condenar a Ré à restituição, na forma definida pelo Juízo, dos valores que vierem a ser comprovados após a exibição documental, sem quantificação automática nesta etapa;"
      : OMIT_TEMPLATE_SECTION;
  }
  const scope = templateId === "document_exhibition"
    ? "dos lançamentos comprovados nesta etapa, sem prejuízo da apuração dos documentos faltantes"
    : "dos lançamentos comprovados no relatório técnico";
  return `b) Condenar a Ré à Repetição do Indébito em Dobro ${scope}, no valor revisado de R$ ${formatPetitionMoney(amount)}, acrescido de atualização e juros na forma definida pelo Juízo;`;
}

function buildActionTitle(templateId, claimant) {
  const base =
    templateId === "document_exhibition"
      ? "AÇÃO DECLARATÓRIA DE INEXISTÊNCIA DE RELAÇÃO JURÍDICA C/C EXIBIÇÃO INCIDENTAL DE DOCUMENTOS, OBRIGAÇÃO DE NÃO FAZER E REPETIÇÃO DE INDÉBITO EM DOBRO"
      : "AÇÃO DECLARATÓRIA DE INEXISTÊNCIA DE DÉBITO C/C REPETIÇÃO DE INDÉBITO EM DOBRO";
  const additions = [];
  if (claimant.lostProfitsAmount > 0) additions.push("LUCROS CESSANTES");
  if (claimant.moralDamagesAmount > 0) {
    additions.push("INDENIZAÇÃO POR DANOS MORAIS");
  }
  return additions.length ? `${base} C/C ${additions.join(" E ")}` : base;
}

function buildOptionalClaimText(claimant) {
  const omitted = OMIT_TEMPLATE_SECTION;
  let requestLetterCode = "c".charCodeAt(0);
  const lostProfitsGrounds =
    claimant.lostProfitsAmount > 0
      ? "4. Dos Lucros Cessantes e Perdas e Danos (Privação de Capital)\n\nNos termos dos Arts. 389 e 402 do Código Civil, eventual lucro cessante exige demonstração concreta do prejuízo e do nexo causal, conforme os documentos submetidos à revisão."
      : omitted;
  const lostProfitsRequest =
    claimant.lostProfitsAmount > 0
      ? `${String.fromCharCode(requestLetterCode++)}) Condenar a Ré ao pagamento de Lucros Cessantes / Perdas e Danos no valor de R$ ${formatPetitionMoney(claimant.lostProfitsAmount)}, condicionado à prova do prejuízo e do nexo causal;`
      : omitted;
  const moralDamagesRequest =
    claimant.moralDamagesAmount > 0
      ? `${String.fromCharCode(requestLetterCode)}) Condenar a Ré ao pagamento de Danos Morais no valor de R$ ${formatPetitionMoney(claimant.moralDamagesAmount)}, sujeito à apreciação do Juízo diante das circunstâncias comprovadas;`
      : omitted;
  return {
    omitted,
    lostProfitsGrounds,
    lostProfitsRequest,
    moralDamagesRequest,
  };
}

function buildCourtAddress(claimant = {}) {
  const cityUf = claimant.city && claimant.uf
    ? `${claimant.city}/${claimant.uf}`
    : "";
  if (claimant.uf !== "DF") {
    return cityUf
      ? `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DO JUIZADO ESPECIAL CÍVEL DA COMARCA DE ${cityUf}`
      : "";
  }

  const district = cleanText(claimant.district, 80).toLocaleUpperCase("pt-BR");
  return district
    ? `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DO ___º JUIZADO ESPECIAL CÍVEL DA CIRCUNSCRIÇÃO JUDICIÁRIA DE ${district} DO TRIBUNAL DE JUSTIÇA DO DISTRITO FEDERAL E DOS TERRITÓRIOS`
    : "";
}

function buildDraft({ caseData, claimant, templateId, generatedAt }) {
  const optionalClaims = buildOptionalClaimText(claimant);
  const optionalTestimony = "__AUDITA_OPTIONAL_CONSUMER_TESTIMONY__";
  const consumerTestimony = cleanText(
    caseData?.answers?.consumerTestimony?.refined ||
      caseData?.answers?.consumerTestimony?.reviewed ||
      caseData?.answers?.consumerTestimony,
    5_000,
  );
  const journey = resolveJourney(caseData, claimant);
  return renderJecPetitionTemplate(templateId, {
    ACTION_TITLE: buildActionTitle(templateId, claimant),
    COURT_ADDRESS: buildCourtAddress(claimant),
    CITY_UF:
      claimant.city && claimant.uf ? `${claimant.city}/${claimant.uf}` : "",
    FULL_NAME: claimant.fullName,
    NATIONALITY: claimant.nationality,
    MARITAL_STATUS: claimant.maritalStatus,
    PROFESSION: claimant.profession,
    RG: claimant.rg,
    DOCUMENT: formatProfileCpf(claimant.document),
    ADDRESS: claimant.address,
    EMAIL: claimant.email,
    PHONE: formatProfilePhone(claimant.phone),
    EVIDENCE_SUMMARY: buildEvidenceSummary(caseData),
    EVIDENCE_CONTEXT: buildEvidenceContext(caseData, journey),
    CONSUMER_TESTIMONY_SECTION: consumerTestimony
      ? `RELATO PESSOAL DO(A) CONSUMIDOR(A)\n\n${consumerTestimony}`
      : optionalTestimony,
    BANK_RELATIONSHIP_CONTEXT: buildBankRelationshipContext(claimant),
    DOCUMENT_AVAILABILITY_CONTEXT: buildDocumentAvailabilityContext(
      caseData,
      journey,
    ),
    CONTRACT_CONFIRMATION_CONTEXT: buildContractConfirmationContext(caseData),
    PRIOR_COMPLAINT_CONTEXT: buildPriorComplaintContext(caseData),
    DOCUMENT_EXHIBITION_SCOPE: buildDocumentExhibitionScope(caseData, journey),
    FIRST_DEBIT_PERIOD: firstDebitPeriod(caseData),
    TECHNICAL_REPORT_SECTION: buildTechnicalReportSection(caseData, journey),
    EMERGENCY_GROUNDS: buildEmergencyGrounds(caseData),
    EMERGENCY_REQUEST: buildEmergencyRequest(caseData),
    DOUBLE_REFUND: formatPetitionMoney(claimant.doubleRefundAmount),
    LOST_PROFITS: formatPetitionMoney(claimant.lostProfitsAmount),
    MORAL_DAMAGES: formatPetitionMoney(claimant.moralDamagesAmount),
    LOST_PROFITS_GROUNDS: optionalClaims.lostProfitsGrounds,
    DOUBLE_REFUND_REQUEST: buildDoubleRefundRequest(claimant, templateId),
    LOST_PROFITS_REQUEST: optionalClaims.lostProfitsRequest,
    MORAL_DAMAGES_REQUEST: optionalClaims.moralDamagesRequest,
    CASE_VALUE: formatPetitionMoney(claimant.caseValue),
    DATE: formatPetitionDate(generatedAt),
  })
    .replaceAll(optionalClaims.omitted, "")
    .replaceAll(optionalTestimony, "")
    .replace(/\n{3,}/g, "\n\n");
}

export function prepareJecPetition({
  caseData = {},
  claimant = {},
  uf,
  city,
  generatedAt = new Date(),
} = {}) {
  const normalizedUf = normalizeUf(uf || claimant.uf);
  const normalizedCity = normalizeCity(city || claimant.city);
  const portal = getJecPortal(normalizedUf, { city: normalizedCity });
  if (!portal) {
    return {
      unsupported: true,
      supportedUfs: SUPPORTED_UFS,
    };
  }

  const disputed = (Array.isArray(caseData?.candidates) ? caseData.candidates : []).filter(
    (candidate) => candidate?.answer === "not_recognized",
  );
  const knownAmounts = disputed
    .map((candidate) => Number(candidate?.amount))
    .filter((amount) => Number.isFinite(amount) && amount > 0);
  const document = normalizeDocument(claimant.document);
  const phone = normalizeDocument(claimant.phone).slice(0, 11);
  const structuredAddress = buildProfileAddress(claimant);
  const normalizedAddress = structuredAddress || cleanText(claimant.address, 300);
  const journey = resolveJourney(caseData, claimant);
  const documentAvailability = resolveDocumentAvailability(caseData, journey);
  const templateId =
    documentAvailability === "complete"
      ? "audited_values"
      : "document_exhibition";
  const template = getJecPetitionTemplate(templateId);
  const missingFields = [];
  if (!cleanText(claimant.fullName, 160)) missingFields.push("fullName");
  if (!validateProfileCpf(document)) missingFields.push("document");
  if (!cleanText(claimant.rg, 40)) missingFields.push("rg");
  if (!cleanText(claimant.nationality, 80)) missingFields.push("nationality");
  if (!cleanText(claimant.maritalStatus, 80)) missingFields.push("maritalStatus");
  if (!cleanText(claimant.profession, 120)) missingFields.push("profession");
  if (!normalizedCity) missingFields.push("city");
  if (!normalizedUf) missingFields.push("uf");
  if (normalizedUf === "DF" && !cleanText(claimant.district, 80)) {
    missingFields.push("district");
  }
  if (!normalizedAddress) missingFields.push("address");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText(claimant.email, 160))) {
    missingFields.push("email");
  }
  if (![10, 11].includes(phone.length)) missingFields.push("phone");
  if (!disputed.length) missingFields.push("disputedCharge");
  if (journey === "undetermined") missingFields.push("historicalDocumentsAvailable");

  const doubleRefundAmount = normalizeMoney(claimant.doubleRefundAmount);
  const lostProfitsAmount = normalizeMoney(claimant.lostProfitsAmount);
  const moralDamagesAmount = normalizeMoney(claimant.moralDamagesAmount);
  const caseValue = normalizeMoney(claimant.caseValue);
  const smallClaimsEligibility = evaluateJecSmallClaims(caseValue);
  if (templateId === "audited_values" && !(doubleRefundAmount > 0)) {
    missingFields.push("doubleRefundAmount");
  }
  if (!(caseValue > 0)) missingFields.push("caseValue");

  const normalizedClaimant = {
    fullName: cleanText(claimant.fullName, 160),
    document,
    rg: cleanText(claimant.rg, 40),
    nationality: cleanText(claimant.nationality, 80),
    maritalStatus: cleanText(claimant.maritalStatus, 80),
    profession: cleanText(claimant.profession, 120),
    email: cleanText(claimant.email, 160),
    phone,
    postalCode: normalizeDocument(claimant.postalCode).slice(0, 8),
    street: cleanText(claimant.street, 160),
    addressNumber: cleanText(claimant.addressNumber, 20),
    addressComplement: cleanText(claimant.addressComplement, 80),
    district: cleanText(claimant.district, 80),
    address: normalizedAddress,
    city: normalizedCity,
    uf: normalizedUf,
    bankAgency: cleanText(claimant.bankAgency, 20),
    historicalDocumentsAvailable:
      journey === "with_historical_documents"
        ? "yes"
        : journey === "without_historical_documents"
          ? "no"
          : "",
    doubleRefundAmount,
    lostProfitsAmount,
    moralDamagesAmount,
    caseValue,
  };

  return {
    ready: missingFields.length === 0,
    missingFields,
    portal,
    manualFiling: getJecManualFilingGuide(normalizedUf, {
      city: normalizedCity,
      caseValue,
    }),
    smallClaimsEligibility,
    claimant: normalizedClaimant,
    draft: buildDraft({
      caseData,
      claimant: normalizedClaimant,
      templateId,
      generatedAt,
    }),
    template: {
      id: template.id,
      label: template.label,
      sourceModel: template.sourceModel,
      sourceFile: template.sourceFile,
      evidenceMode: template.evidenceMode,
      reviewNotes: [...template.reviewNotes],
    },
    attachments: {
      evidenceFiles: collectEvidenceFiles(caseData),
      required: [
        "Documento pessoal",
        "Comprovante de endereço",
        ...(documentAvailability === "none"
          ? []
          : ["Relatório Técnico da IA AUDITA", "Extratos/faturas de origem" ]),
      ],
      documentaryCoverage: documentAvailability,
    },
    disputedCount: disputed.length,
    knownAmountCount: knownAmounts.length,
    totalDisputed: knownAmounts.reduce((total, amount) => total + amount, 0),
    journey,
    generatedAt: new Date(generatedAt).toISOString(),
    warnings: [
      "Rascunho baseado no modelo fornecido: revise fatos, competência territorial, pedidos e valor da causa.",
      `Fonte do texto-base: ${template.sourceFile}.`,
      "Os valores jurídicos não são presumidos pela IA AUDITA; a sugestão usa somente lançamentos documentados e todos os valores devem ser revisados.",
      ...(documentAvailability === "partial"
        ? ["A prova é parcial: o relatório e os valores abrangem somente os documentos enviados; o Modelo 2 pede a exibição do restante."]
        : []),
      ...(documentAvailability === "none"
        ? ["Sem extratos/faturas, nenhum valor é estimado e o rascunho não fica pronto enquanto faltarem fatos e valor da causa revisados."]
        : []),
      ...(smallClaimsEligibility.status === "above_limit"
        ? [
            `O valor da causa ultrapassa o limite operacional de R$ ${formatPetitionMoney(smallClaimsEligibility.maximumCaseValueBrl)} para o fluxo sem advogado. A IA AUDITA não abrirá o portal de pequenas causas e exibirá o contato provisório do time.`,
          ]
        : []),
      ...(templateId === "document_exhibition" && !normalizedClaimant.bankAgency
        ? ["O número da agência Itaú não foi informado e ficou identificado como ausente no rascunho."]
        : []),
      ...(!(lostProfitsAmount > 0)
        ? ["Lucros cessantes não foram incluídos porque nenhum valor positivo foi informado."]
        : []),
      ...(!(moralDamagesAmount > 0)
        ? ["Danos morais não foram incluídos porque nenhum valor positivo foi informado."]
        : []),
      ...template.reviewNotes,
      "A IA não assina nem protocola; a ação final exige revisão e confirmação humana.",
    ],
  };
}

export function buildJecAgentProfile(prepared) {
  const portal = prepared?.portal;
  if (!portal || prepared?.smallClaimsEligibility?.status === "above_limit") {
    return null;
  }
  return {
    uf: portal.uf,
    court: portal.tribunal,
    url: portal.startUrl,
    captchaMode: "assisted",
    agentPurpose: "jec_petition",
    blockAutomatedSubmit: true,
    allowedHosts: portal.allowedHosts,
    agentInstructions: [
      `Objetivo: iniciar, sem protocolar, uma petição no ${portal.name}.`,
      ...portal.instructions,
      ...(portal.guide?.steps || []).map((step, index) => `Etapa ${index + 1}: ${step}`),
      ...(portal.guide?.caseNotes || []).map((note) => `Nota do portal: ${note}`),
      "Use somente os dados fornecidos no formulário seguro.",
      "Nunca escolha assunto, comarca, valor da causa ou pedido jurídico quando houver ambiguidade; peça revisão humana.",
      ...(portal.guide?.humanOnly || []).map((item) => `Checkpoint humano obrigatório: ${item}`),
      "Nunca clique em Enviar Formulário, Protocolar, Assinar, Ajuizar ou equivalente final.",
      "Pare em login, gov.br, CAPTCHA, upload sensível e confirmação final.",
    ].join("\n"),
  };
}
