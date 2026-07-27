import {
  getJecPetitionTemplate,
  renderJecPetitionTemplate,
} from "./jec-petition-templates.mjs";

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
});

const SUPPORTED_UFS = Object.freeze(Object.keys(JEC_PORTALS));

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

function formatPetitionMoney(value) {
  return Number.isFinite(value)
    ? value.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "";
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

function buildDraft({ claimant, templateId, generatedAt }) {
  return renderJecPetitionTemplate(templateId, {
    CITY_UF:
      claimant.city && claimant.uf ? `${claimant.city}/${claimant.uf}` : "",
    FULL_NAME: claimant.fullName,
    NATIONALITY: claimant.nationality,
    MARITAL_STATUS: claimant.maritalStatus,
    PROFESSION: claimant.profession,
    RG: claimant.rg,
    DOCUMENT: claimant.document,
    ADDRESS: claimant.address,
    EMAIL: claimant.email,
    PHONE: claimant.phone,
    DOUBLE_REFUND: formatPetitionMoney(claimant.doubleRefundAmount),
    LOST_PROFITS: formatPetitionMoney(claimant.lostProfitsAmount),
    MORAL_DAMAGES: formatPetitionMoney(claimant.moralDamagesAmount),
    CASE_VALUE: formatPetitionMoney(claimant.caseValue),
    DATE: formatPetitionDate(generatedAt),
  });
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
  const journey = resolveJourney(caseData, claimant);
  const templateId =
    journey === "with_historical_documents"
      ? "audited_values"
      : "document_exhibition";
  const template = getJecPetitionTemplate(templateId);
  const missingFields = [];
  if (!cleanText(claimant.fullName, 160)) missingFields.push("fullName");
  if (document.length !== 11) missingFields.push("document");
  if (!cleanText(claimant.rg, 40)) missingFields.push("rg");
  if (!cleanText(claimant.nationality, 80)) missingFields.push("nationality");
  if (!cleanText(claimant.maritalStatus, 80)) missingFields.push("maritalStatus");
  if (!cleanText(claimant.profession, 120)) missingFields.push("profession");
  if (!normalizedCity) missingFields.push("city");
  if (!normalizedUf) missingFields.push("uf");
  if (!cleanText(claimant.address, 240)) missingFields.push("address");
  if (!cleanText(claimant.email, 160)) missingFields.push("email");
  if (!cleanText(claimant.phone, 40)) missingFields.push("phone");
  if (!disputed.length) missingFields.push("disputedCharge");
  if (journey === "undetermined") missingFields.push("historicalDocumentsAvailable");

  const doubleRefundAmount = normalizeMoney(claimant.doubleRefundAmount);
  const lostProfitsAmount = normalizeMoney(claimant.lostProfitsAmount);
  const moralDamagesAmount = normalizeMoney(claimant.moralDamagesAmount);
  const caseValue = normalizeMoney(claimant.caseValue);
  if (!(doubleRefundAmount > 0)) missingFields.push("doubleRefundAmount");
  if (!(lostProfitsAmount >= 0)) missingFields.push("lostProfitsAmount");
  if (!(moralDamagesAmount >= 0)) missingFields.push("moralDamagesAmount");
  if (!(caseValue > 0)) missingFields.push("caseValue");

  const normalizedClaimant = {
    fullName: cleanText(claimant.fullName, 160),
    document,
    rg: cleanText(claimant.rg, 40),
    nationality: cleanText(claimant.nationality, 80),
    maritalStatus: cleanText(claimant.maritalStatus, 80),
    profession: cleanText(claimant.profession, 120),
    email: cleanText(claimant.email, 160),
    phone: cleanText(claimant.phone, 40),
    address: cleanText(claimant.address, 240),
    city: normalizedCity,
    uf: normalizedUf,
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
    claimant: normalizedClaimant,
    draft: buildDraft({
      claimant: normalizedClaimant,
      templateId,
      generatedAt,
    }),
    template: {
      id: template.id,
      label: template.label,
      sourceModel: template.sourceModel,
      reviewNotes: [...template.reviewNotes],
    },
    disputedCount: disputed.length,
    knownAmountCount: knownAmounts.length,
    totalDisputed: knownAmounts.reduce((total, amount) => total + amount, 0),
    journey,
    generatedAt: new Date(generatedAt).toISOString(),
    warnings: [
      "Rascunho baseado no modelo fornecido: revise fatos, competência territorial, pedidos e valor da causa.",
      "Os valores jurídicos não são calculados nem presumidos pelo Audita; devem ser informados e revisados.",
      ...template.reviewNotes,
      "A IA não assina nem protocola; a ação final exige revisão e confirmação humana.",
    ],
  };
}

export function buildJecAgentProfile(prepared) {
  const portal = prepared?.portal;
  if (!portal) return null;
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
