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
  },
  PR: {
    uf: "PR",
    tribunal: "TJPR",
    name: "Formulário Virtual dos Juizados Especiais do Paraná",
    officialUrl: "https://ateliedeinovacao.tjpr.jus.br/formulario-virtual-juizados-especiais",
    startUrl: "https://ateliedeinovacao.tjpr.jus.br/formulario-virtual-juizados-especiais",
    capitalStartUrl: "https://portal.tjpr.jus.br/portletforms/publico/frm.do?idFormulario=6953",
    mode: "formulario_virtual",
    allowedHosts: ["ateliedeinovacao.tjpr.jus.br", "portal.tjpr.jus.br"],
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

function formatCurrency(value) {
  const hasAmount = value !== null && value !== undefined && value !== "";
  const amount = hasAmount ? Number(value) : Number.NaN;
  return Number.isFinite(amount) && amount > 0
    ? amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "valor não identificado";
}

function formatChargeFact(candidate) {
  const date = cleanText(candidate?.date, 10);
  const label = cleanText(candidate?.label || candidate?.description || "cobrança", 140);
  return `${date ? `Em ${date}, ` : ""}foi identificado o lançamento "${label}", no valor de ${formatCurrency(candidate?.amount)}, que o consumidor informou não reconhecer.`;
}

function resolveJourney(caseData = {}) {
  const availability = String(
    caseData?.answers?.historicalDocumentsAvailable || "pending",
  );
  if (availability === "yes") return "with_historical_documents";
  if (availability === "no") return "without_historical_documents";
  return "undetermined";
}

function buildDraft({ caseData, claimant, portal }) {
  const disputed = (Array.isArray(caseData?.candidates) ? caseData.candidates : []).filter(
    (candidate) => candidate?.answer === "not_recognized",
  );
  const answers = caseData?.answers || {};
  const complaint = answers.priorComplaint === "yes"
    ? `O consumidor informa que apresentou reclamação ao banco${answers.priorComplaintDate ? ` em ${cleanText(answers.priorComplaintDate, 10)}` : ""}${answers.priorComplaintProtocol ? `, protocolo ${cleanText(answers.priorComplaintProtocol, 80)}` : ""}.`
    : "Ainda não foi registrada no Audita uma reclamação prévia enviada ao banco.";
  const historical = answers.historicalEvidence === "yes"
    ? "O consumidor relatou recorrência da cobrança em outros períodos."
    : "A extensão temporal da cobrança ainda precisa ser confirmada com extratos adicionais.";
  const journey = resolveJourney(caseData);
  const documentSituation =
    journey === "without_historical_documents"
      ? "O consumidor informou não possuir, neste momento, os extratos ou contratos históricos. O período e os valores anteriores ainda não estão comprovados."
      : journey === "with_historical_documents"
        ? "O consumidor informou possuir extratos históricos, que devem ser conferidos e organizados por período antes do protocolo."
        : "A disponibilidade de extratos e contratos históricos ainda precisa ser confirmada.";
  const evidenceRequest =
    journey === "without_historical_documents"
      ? "a) se juridicamente cabível, exibição dos extratos, contratos e autorizações que estejam sob posse da instituição, limitada ao período pertinente a ser revisado;"
      : "a) conferência dos extratos, contratos e autorizações anexados, com delimitação das cobranças efetivamente comprovadas;";
  const claimantName = cleanText(claimant.fullName, 160) || "[NOME DO CONSUMIDOR]";
  const claimantDocument = normalizeDocument(claimant.document) || "[CPF]";
  const claimantCity = normalizeCity(claimant.city) || "[CIDADE]";
  const claimantUf = normalizeUf(claimant.uf) || portal.uf;

  return [
    "RASCUNHO PARA REVISÃO - NÃO PROTOCOLADO",
    "",
    `AO JUIZADO ESPECIAL CÍVEL COMPETENTE DE ${claimantCity}/${claimantUf}`,
    "",
    `${claimantName}, CPF ${claimantDocument}, demais dados de qualificação a serem conferidos no formulário oficial, apresenta este relato preliminar em face da instituição financeira indicada nos documentos anexos.`,
    "",
    "1. FATOS",
    ...disputed.map((candidate) => formatChargeFact(candidate)),
    complaint,
    historical,
    documentSituation,
    "",
    "2. DOCUMENTOS A CONFERIR",
    journey === "without_historical_documents"
      ? "Fatura ou evidência recente disponível, comprovantes da contestação, resposta do banco, documento pessoal e comprovante de endereço."
      : "Extratos/faturas completos do período, comprovantes da contestação, resposta do banco, documento pessoal e comprovante de endereço.",
    "",
    "3. PEDIDOS PRELIMINARES",
    evidenceRequest,
    "b) confirmação da inexistência ou da validade da contratação, conforme as provas;",
    "c) cessação de cobranças futuras, se ainda estiverem ocorrendo;",
    "d) restituição dos valores comprovadamente cobrados sem autorização, na forma definida pelo juízo;",
    "e) demais providências que o consumidor decidir manter após revisar os fatos e documentos.",
    "",
    "O valor da causa, a incidência de devolução em dobro, juros, correção e qualquer pedido indenizatório dependem das provas e de revisão jurídica; não foram presumidos nem calculados automaticamente.",
    "",
    `Portal de referência: ${portal.name}.`,
  ].join("\n");
}

export function prepareJecPetition({ caseData = {}, claimant = {}, uf, city } = {}) {
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
  const missingFields = [];
  if (!cleanText(claimant.fullName, 160)) missingFields.push("fullName");
  if (![11, 14].includes(document.length)) missingFields.push("document");
  if (!normalizedCity) missingFields.push("city");
  if (!normalizedUf) missingFields.push("uf");
  if (!cleanText(claimant.address, 240)) missingFields.push("address");
  if (!cleanText(claimant.email, 160)) missingFields.push("email");
  if (!disputed.length) missingFields.push("disputedCharge");

  const normalizedClaimant = {
    fullName: cleanText(claimant.fullName, 160),
    document,
    email: cleanText(claimant.email, 160),
    phone: cleanText(claimant.phone, 40),
    address: cleanText(claimant.address, 240),
    city: normalizedCity,
    uf: normalizedUf,
  };

  return {
    ready: missingFields.length === 0,
    missingFields,
    portal,
    claimant: normalizedClaimant,
    draft: buildDraft({
      caseData,
      claimant: normalizedClaimant,
      portal,
    }),
    disputedCount: disputed.length,
    knownAmountCount: knownAmounts.length,
    totalDisputed: knownAmounts.reduce((total, amount) => total + amount, 0),
    journey: resolveJourney(caseData),
    warnings: [
      "Rascunho de apoio: revise fatos, competência territorial, pedidos e valor da causa.",
      "A restituição em dobro e eventual dano moral não são presumidos pelo Audita.",
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
      "Use somente os dados fornecidos no formulário seguro.",
      "Nunca escolha assunto, comarca, valor da causa ou pedido jurídico quando houver ambiguidade; peça revisão humana.",
      "Nunca clique em Enviar Formulário, Protocolar, Assinar, Ajuizar ou equivalente final.",
      "Pare em login, gov.br, CAPTCHA, upload sensível e confirmação final.",
    ].join("\n"),
  };
}
