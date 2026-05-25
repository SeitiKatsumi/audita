const canvas = document.querySelector("#signalCanvas");
const ctx = canvas?.getContext("2d");
const riskScore = document.querySelector("#riskScore");
const assistantText = document.querySelector("#assistantText");
const reportButton = document.querySelector("#generateReport");
const metricCards = document.querySelectorAll(".metrics article");
const signalList = document.querySelector(".signal-list");
const loginScreen = document.querySelector("#loginScreen");
const loginForm = document.querySelector("#loginForm");
const loginNameField = document.querySelector("#loginNameField");
const loginName = document.querySelector("#loginName");
const loginEmail = document.querySelector("#loginEmail");
const loginPassword = document.querySelector("#loginPassword");
const loginError = document.querySelector("#loginError");
const loginSubmitButton = document.querySelector("#loginSubmitButton");
const loginModeToggle = document.querySelector("#loginModeToggle");
const loginEyebrow = document.querySelector("#loginEyebrow");
const loginTitle = document.querySelector("#loginTitle");
const logoutButton = document.querySelector("#logoutButton");
const loginButton = document.querySelector("#loginButton");
const sidebarToggle = document.querySelector("#sidebarToggle");
const mobileMenuButton = document.querySelector("#mobileMenuButton");
const newQueryButton = document.querySelector("#newQueryButton");
const environmentName = document.querySelector("#environmentName");
const environmentDetail = document.querySelector("#environmentDetail");
const deployVersion = document.querySelector("#deployVersion");
const pageTitle = document.querySelector("#pageTitle");
const pageEyebrow = document.querySelector("#pageEyebrow");
const profileName = document.querySelector("#profileName");
const profileEmail = document.querySelector("#profileEmail");
const profilePlan = document.querySelector("#profilePlan");
const navLinks = document.querySelectorAll(".nav-list a[href^='#']");
const pageBlocks = document.querySelectorAll("[data-page]");
const operationsPages = document.querySelector("#operationsPages");
const consultationForm = document.querySelector("#consultationForm");
const consultationModule = document.querySelector("#consultationModule");
const subjectType = document.querySelector("#subjectType");
const subjectIdentifier = document.querySelector("#subjectIdentifier");
const consultationError = document.querySelector("#consultationError");
const moduleList = document.querySelector("#moduleList");
const consultationHistory = document.querySelector("#consultationHistory");
const auditHistoryList = document.querySelector("#auditHistoryList");
const sourceForm = document.querySelector("#sourceForm");
const sourceName = document.querySelector("#sourceName");
const sourceAgency = document.querySelector("#sourceAgency");
const sourceCategory = document.querySelector("#sourceCategory");
const sourceBaseUrl = document.querySelector("#sourceBaseUrl");
const sourceAccessMethod = document.querySelector("#sourceAccessMethod");
const sourceAuthType = document.querySelector("#sourceAuthType");
const sourceSecretRef = document.querySelector("#sourceSecretRef");
const sourceStatus = document.querySelector("#sourceStatus");
const sourceSchemaNotes = document.querySelector("#sourceSchemaNotes");
const sourceError = document.querySelector("#sourceError");
const sourceList = document.querySelector("#sourceList");
const agentForm = document.querySelector("#agentForm");
const agentQuestion = document.querySelector("#agentQuestion");
const agentAnswer = document.querySelector("#agentAnswer");
const promptSuggestions = document.querySelectorAll("[data-question]");
const agentSettingsForm = document.querySelector("#agentSettingsForm");
const agentModel = document.querySelector("#agentModel");
const agentApiKeySecretRef = document.querySelector("#agentApiKeySecretRef");
const agentProviderStatus = document.querySelector("#agentProviderStatus");
const agentSystemPrompt = document.querySelector("#agentSystemPrompt");
const agentSettingsStatus = document.querySelector("#agentSettingsStatus");
const agentSettingsError = document.querySelector("#agentSettingsError");
const auditForm = document.querySelector("#auditForm");
const auditDocumentType = document.querySelector("#auditDocumentType");
const auditDocument = document.querySelector("#auditDocument");
const auditDocumentLabel = document.querySelector("#auditDocumentLabel");
const auditCpfField = document.querySelector("#auditCpfField");
const auditCpfDocument = document.querySelector("#auditCpfDocument");
const auditCnpjField = document.querySelector("#auditCnpjField");
const auditCnpjDocument = document.querySelector("#auditCnpjDocument");
const tjdftFields = document.querySelector("#tjdftFields");
const stateCourtPicker = document.querySelector("#stateCourtPicker");
const stateCourtUf = document.querySelector("#stateCourtUf");
const stateCourtHint = document.querySelector("#stateCourtHint");
const tjdftPersonTypeLabel = document.querySelector("#tjdftPersonTypeLabel");
const tjdftCourtUf = document.querySelector("#tjdftCourtUf");
const tjdftCourtLabel = document.querySelector("#tjdftCourtLabel");
const tjdftPfFields = document.querySelectorAll(".tjdft-pf-field");
const tjdftPjFields = document.querySelectorAll(".tjdft-pj-field");
const tjdftCompanyName = document.querySelector("#tjdftCompanyName");
const tjdftCertificateTypeInputs = document.querySelectorAll("input[name='tjdftCertificateType']");
const auditFirstName = document.querySelector("#auditFirstName");
const auditMotherName = document.querySelector("#auditMotherName");
const auditFatherName = document.querySelector("#auditFatherName");
const trf1Fields = document.querySelector("#trf1Fields");
const trf1CertificateType = document.querySelector("#trf1CertificateType");
const trf1Orgaos = document.querySelector("#trf1Orgaos");
const trf1Email = document.querySelector("#trf1Email");
const trf1SocialName = document.querySelector("#trf1SocialName");
const fgtsFields = document.querySelector("#fgtsFields");
const fgtsRegistrationType = document.querySelector("#fgtsRegistrationType");
const fgtsRegistration = document.querySelector("#fgtsRegistration");
const fgtsUf = document.querySelector("#fgtsUf");
const auditAuthorization = document.querySelector("#auditAuthorization");
const auditError = document.querySelector("#auditError");
const auditSummary = document.querySelector("#auditSummary");
const auditSourceList = document.querySelector("#auditSourceList");
const documentAiPanel = document.querySelector("#documentAiPanel");
const documentAiRisk = document.querySelector("#documentAiRisk");
const documentAiContent = document.querySelector("#documentAiContent");
const documentAiQuestionForm = document.querySelector("#documentAiQuestionForm");
const documentAiQuestion = document.querySelector("#documentAiQuestion");
const documentAiQuestionButton = document.querySelector("#documentAiQuestionButton");
const documentAiAnswer = document.querySelector("#documentAiAnswer");
const auditPanelTitle = document.querySelector("#auditPanelTitle");
const auditResultStatus = document.querySelector("#auditResultStatus");
const auditStatusLabel = document.querySelector("#auditStatusLabel");
const auditResultsPanel = document.querySelector(".audit-results-panel");
const auditStepButtons = document.querySelectorAll("[data-audit-step-button]");
const auditStepPanels = document.querySelectorAll("[data-audit-step-panel]");
const auditBackButton = document.querySelector("#auditBackButton");
const auditNextButton = document.querySelector("#auditNextButton");
const auditSubmitButton = document.querySelector("#auditSubmitButton");
let selectedAuditViews = [];
let currentDocumentAiContext = null;

const stateCourtDirectory = [
  { uf: "AC", court: "TJAC", name: "Acre", url: "https://www.tjac.jus.br/servicos/certidoes/" },
  { uf: "AL", court: "TJAL", name: "Alagoas", url: "https://www.tjal.jus.br/certidoes/" },
  { uf: "AP", court: "TJAP", name: "Amapá", url: "https://www.tjap.jus.br/portal/servicos/certidoes.html" },
  { uf: "AM", court: "TJAM", name: "Amazonas", url: "https://consultasaj.tjam.jus.br/sco/abrirCadastro.do" },
  { uf: "BA", court: "TJBA", name: "Bahia", url: "https://esaj.tjba.jus.br/sco/abrirCadastro.do" },
  { uf: "CE", court: "TJCE", name: "Ceará", url: "https://esaj.tjce.jus.br/sco/abrirCadastro.do" },
  { uf: "DF", court: "TJDFT", name: "Distrito Federal", url: "https://cnc.tjdft.jus.br/solicitacao-externa", automatic: true },
  { uf: "ES", court: "TJES", name: "Espírito Santo", url: "https://sistemas.tjes.jus.br/certidaonegativa/" },
  { uf: "GO", court: "TJGO", name: "Goiás", url: "https://projudi.tjgo.jus.br/CertidaoNegativaPositivaPublica" },
  { uf: "MA", court: "TJMA", name: "Maranhão", url: "https://jurisconsult.tjma.jus.br/#/certidao-negativa" },
  { uf: "MT", court: "TJMT", name: "Mato Grosso", url: "https://sec.tjmt.jus.br/" },
  { uf: "MS", court: "TJMS", name: "Mato Grosso do Sul", url: "https://esaj.tjms.jus.br/sco/abrirCadastro.do" },
  { uf: "MG", court: "TJMG", name: "Minas Gerais", url: "https://www.tjmg.jus.br/portal-tjmg/processos/certidao-judicial/" },
  { uf: "PA", court: "TJPA", name: "Pará", url: "https://www.tjpa.jus.br/PortalExterno/institucional/Certidoes.xhtml" },
  { uf: "PB", court: "TJPB", name: "Paraíba", url: "https://app.tjpb.jus.br/certo/" },
  { uf: "PR", court: "TJPR", name: "Paraná", url: "https://www.tjpr.jus.br/certidoes" },
  { uf: "PE", court: "TJPE", name: "Pernambuco", url: "https://www.tjpe.jus.br/certidaopje/xhtml/main.xhtml" },
  { uf: "PI", court: "TJPI", name: "Piauí", url: "https://www.tjpi.jus.br/certidao-negativa/" },
  { uf: "RJ", court: "TJRJ", name: "Rio de Janeiro", url: "https://www4.tjrj.jus.br/Portal-Extrajudicial/certidao/judicial/solicitar" },
  { uf: "RN", court: "TJRN", name: "Rio Grande do Norte", url: "https://certidao.tjrn.jus.br/" },
  { uf: "RS", court: "TJRS", name: "Rio Grande do Sul", url: "https://www.tjrs.jus.br/novo/processos-e-servicos/servicos-processuais/emissao-de-certidoes/" },
  { uf: "RO", court: "TJRO", name: "Rondônia", url: "https://www.tjro.jus.br/certidaoonline/" },
  { uf: "RR", court: "TJRR", name: "Roraima", url: "https://projudi.tjrr.jus.br/projudi/certidao" },
  { uf: "SC", court: "TJSC", name: "Santa Catarina", url: "https://certidoes.tjsc.jus.br/" },
  { uf: "SP", court: "TJSP", name: "São Paulo", url: "https://esaj.tjsp.jus.br/sco/abrirCadastro.do" },
  { uf: "SE", court: "TJSE", name: "Sergipe", url: "https://www.tjse.jus.br/portal/servicos/certidao-online" },
  { uf: "TO", court: "TJTO", name: "Tocantins", url: "https://eproc1.tjto.jus.br/eprocV2_prod_1grau/externo_controlador.php?acao=certidao_negativa" },
];
const assistantQueryForm = document.querySelector("#assistantQueryForm");
const assistantSource = document.querySelector("#assistantSource");
const assistantCode = document.querySelector("#assistantCode");
const assistantPrompt = document.querySelector("#assistantPrompt");
const assistantResult = document.querySelector("#assistantResult");
const assistantSourceStatus = document.querySelector("#assistantSourceStatus");

let phase = 0;
let auditWizardStep = 1;
let loginMode = "login";

const auditSourceConfig = {
  receita_federal: {
    appliesTo: ["cnpj"],
    documentTypes: ["cnpj"],
    automatic: true,
    badge: "auto CNPJ",
    note: "Automático para dados cadastrais de CNPJ via APIs públicas.",
  },
  portal_transparencia: {
    appliesTo: ["cpf", "cnpj"],
    documentTypes: ["cpf", "cnpj"],
    automatic: true,
    badge: "auto com chave",
    note: "Automático por CPF/CNPJ quando PORTAL_TRANSPARENCIA_API_KEY estiver configurada.",
  },
  pgfn: {
    appliesTo: ["cpf", "cnpj"],
    documentTypes: ["cpf", "cnpj"],
    automatic: false,
    badge: "credencial",
    note: "Exige adesão/credenciais Conecta Gov antes de automatizar.",
  },
  cndt: {
    appliesTo: ["cpf", "cnpj"],
    documentTypes: ["cpf", "cnpj"],
    automatic: false,
    badge: "manual",
    note: "Fluxo oficial possui captcha/formulário; não está automático neste MVP.",
  },
  trf1: {
    appliesTo: ["cpf", "cnpj"],
    documentTypes: ["cpf", "cnpj"],
    automatic: false,
    badge: "mapear",
    note: "Precisa mapear endpoint oficial da certidão antes de automatizar.",
  },
  tjdft: {
    appliesTo: ["cpf", "cnpj"],
    documentTypes: ["cpf", "cnpj"],
    automatic: true,
    badge: "auto",
    note: "Usa o wizard oficial cnc.tjdft.jus.br para baixar certidões Criminal, Cível, Falência/Recuperação Judicial e Especial.",
  },
  fgts: {
    appliesTo: ["cnpj"],
    documentTypes: ["cnpj"],
    automatic: true,
    badge: "auto portal",
    note: "Usa o portal oficial da Caixa CRF/FGTS quando o acesso não estiver bloqueado.",
  },
};

const auditRouteSources = {
  "consulta-tjdft": "tjdft",
  "consulta-tjdft-pf": "tjdft",
  "consulta-tjdft-pj": "tjdft",
  "consulta-receita": "receita_federal",
  "consulta-pgfn": "pgfn",
  "consulta-cndt": "cndt",
  "consulta-trf1": "trf1",
  "consulta-fgts": "fgts",
};

const auditRouteDocumentType = {
  "consulta-tjdft": "cpf",
  "consulta-tjdft-pf": "cpf",
  "consulta-tjdft-pj": "cnpj",
};

const auditSourceLabels = {
  receita_federal: "Receita/CNPJ",
  pgfn: "PGFN/CND",
  cndt: "CNDT/TST",
  trf1: "TRF1",
  tjdft: "TJDFT",
  fgts: "FGTS/CEF",
};

const pageMeta = {
  home: {
    title: "Audita",
    eyebrow: "Plataforma de certidões inteligentes",
  },
  consultas: {
    title: "Assistente de Consultas",
    eyebrow: "Certidões e documentações oficiais",
  },
  "consulta-tjdft": {
    title: "Tribunal estadual PF",
    eyebrow: "Assistente de Consultas",
  },
  "consulta-tjdft-pf": {
    title: "Tribunal estadual PF",
    eyebrow: "Assistente de Consultas",
  },
  "consulta-tjdft-pj": {
    title: "Tribunal estadual PJ",
    eyebrow: "Assistente de Consultas",
  },
  "consulta-receita": {
    title: "Receita/CNPJ",
    eyebrow: "Assistente de Consultas",
  },
  "consulta-pgfn": {
    title: "PGFN/CND",
    eyebrow: "Assistente de Consultas",
  },
  "consulta-cndt": {
    title: "CNDT/TST",
    eyebrow: "Assistente de Consultas",
  },
  "consulta-trf1": {
    title: "TRF1",
    eyebrow: "Assistente de Consultas",
  },
  "consulta-fgts": {
    title: "FGTS/CEF",
    eyebrow: "Assistente de Consultas",
  },
  historico: {
    title: "Histórico de consultas",
    eyebrow: "Execuções anteriores do usuário",
  },
  "meu-painel": {
    title: "Meu painel",
    eyebrow: "Dados da conta",
  },
};

function getActivePage() {
  const hash = window.location.hash.replace("#", "");
  if (hash === "overview") {
    return "home";
  }
  return pageMeta[hash] ? hash : "home";
}

function setActivePage(page) {
  const activePage = pageMeta[page] ? page : "home";
  document.body.dataset.activePage = activePage;
  const activeMeta = pageMeta[activePage];

  pageTitle.textContent = activeMeta.title;
  pageEyebrow.textContent = activeMeta.eyebrow;

  pageBlocks.forEach((block) => {
    const pages = (block.dataset.page || "").split(/\s+/).filter(Boolean);
    block.classList.toggle("page-hidden", !pages.includes(activePage));
  });

  if (operationsPages) {
    operationsPages.classList.add("page-hidden");
  }

  navLinks.forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === `#${activePage}`);
  });

  applyAuditRouteDefaults(activePage);
  document.body.classList.remove("menu-open");
  mobileMenuButton?.setAttribute("aria-expanded", "false");
}

function moveEcosystemModules() {
  const ecosystemPanel = document.querySelector("#integracoes");
  const parent = ecosystemPanel?.parentElement;
  if (!parent) {
    return;
  }

  const modules = [
    document.querySelector(".agent-panel"),
    document.querySelector(".consultation-builder"),
    document.querySelector(".agent-settings-panel"),
  ].filter(Boolean);

  for (const module of modules.reverse()) {
    parent.insertBefore(module, ecosystemPanel);
  }
}

function setAuditWizardStep(step) {
  auditWizardStep = Math.min(3, Math.max(1, step));
  auditStepPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.auditStepPanel !== String(auditWizardStep));
  });
  auditStepButtons.forEach((button) => {
    const buttonStep = Number(button.dataset.auditStepButton);
    button.classList.toggle("active", buttonStep === auditWizardStep);
    button.classList.toggle("done", buttonStep < auditWizardStep);
  });

  auditBackButton?.classList.toggle("hidden", auditWizardStep === 1);
  auditNextButton?.classList.toggle("hidden", auditWizardStep !== 1);
  auditSubmitButton?.classList.toggle("hidden", auditWizardStep !== 2);
  auditResultsPanel?.classList.toggle("hidden", auditWizardStep !== 3);
}

function getSelectedAuditDocumentTypes() {
  const selectedInputs = [...auditForm.querySelectorAll("input[name='auditView']:checked")];
  const types = new Set();
  selectedInputs.forEach((input) => {
    const config = auditSourceConfig[input.value];
    (config?.documentTypes || config?.appliesTo || ["cpf", "cnpj"]).forEach((type) => types.add(type));
  });
  return [...types];
}

function getAuditDocumentRequirements() {
  const selectedInputs = [...auditForm.querySelectorAll("input[name='auditView']:checked")];
  const routeDocumentType = auditRouteDocumentType[getActivePage()];
  if (routeDocumentType) {
    return {
      needsCpf: routeDocumentType === "cpf",
      needsCnpj: routeDocumentType === "cnpj",
    };
  }

  const requiredTypes = new Set();
  let hasFlexibleSource = false;
  selectedInputs.forEach((input) => {
    const config = auditSourceConfig[input.value];
    const sourceTypes = config?.documentTypes || config?.appliesTo || ["cpf", "cnpj"];
    if (sourceTypes.length === 1) {
      requiredTypes.add(sourceTypes[0]);
    } else {
      hasFlexibleSource = true;
    }
  });

  if (requiredTypes.size === 0 && hasFlexibleSource) {
    requiredTypes.add("cpf");
  }

  return {
    needsCpf: selectedInputs.length === 0 || requiredTypes.has("cpf"),
    needsCnpj: requiredTypes.has("cnpj"),
  };
}

function syncAuditPrimaryDocument() {
  const { needsCpf, needsCnpj } = getAuditDocumentRequirements();
  const cpfValue = auditCpfDocument?.value || "";
  const cnpjValue = auditCnpjDocument?.value || "";
  const primaryType = needsCpf ? "cpf" : "cnpj";
  const primaryValue = primaryType === "cpf" ? cpfValue : cnpjValue;

  if (auditDocumentType) {
    auditDocumentType.value = primaryType;
  }
  if (auditDocument) {
    auditDocument.value = primaryValue;
  }

  if (needsCnpj && fgtsRegistration && !fgtsRegistration.value) {
    fgtsRegistration.value = cnpjValue.replace(/\D/g, "");
  }

  return { primaryType, primaryValue, cpfValue, cnpjValue, needsCpf, needsCnpj };
}

function getTjdftPersonType() {
  const routeDocumentType = auditRouteDocumentType[getActivePage()];
  return routeDocumentType === "cnpj" ? "pj" : "pf";
}

function getSelectedStateCourt() {
  const selectedUf = stateCourtUf?.value || tjdftCourtUf?.value;
  return stateCourtDirectory.find((court) => court.uf === selectedUf) || stateCourtDirectory.find((court) => court.uf === "DF");
}

function stateCourtOptionsHtml() {
  return stateCourtDirectory
    .map((court) => `<option value="${escapeHtml(court.uf)}">${escapeHtml(court.uf)} - ${escapeHtml(court.court)} (${escapeHtml(court.name)})</option>`)
    .join("");
}

function populateStateCourtSelect() {
  const options = stateCourtOptionsHtml();
  if (stateCourtUf) {
    stateCourtUf.innerHTML = options;
    stateCourtUf.value = "DF";
  }
  if (tjdftCourtUf) {
    tjdftCourtUf.innerHTML = options;
    tjdftCourtUf.value = "DF";
  }
}

function syncStateCourtSelection(source) {
  const value = source?.value || "DF";
  if (stateCourtUf && stateCourtUf !== source) {
    stateCourtUf.value = value;
  }
  if (tjdftCourtUf && tjdftCourtUf !== source) {
    tjdftCourtUf.value = value;
  }
  const selectedCourt = getSelectedStateCourt();
  if (stateCourtHint && selectedCourt) {
    stateCourtHint.textContent = selectedCourt.automatic
      ? `${selectedCourt.court} está com automação ativa.`
      : `${selectedCourt.court} está em modo portal oficial enquanto o collector automático é implementado.`;
  }
}

function updateTjdftPersonFields() {
  const isTjdftSelected = selectedAuditViews.includes("tjdft");
  const personType = getTjdftPersonType();
  const isPf = personType === "pf";
  const selectedCourt = getSelectedStateCourt();
  if (tjdftCourtLabel && selectedCourt) {
    tjdftCourtLabel.textContent = `${selectedCourt.court} - ${selectedCourt.name}${selectedCourt.automatic ? " (automático)" : " (portal oficial)"}`;
  }
  tjdftPersonTypeLabel.textContent = isPf ? "Pessoa física" : "Pessoa jurídica";
  tjdftPfFields.forEach((field) => field.classList.toggle("hidden", !isPf));
  tjdftPjFields.forEach((field) => field.classList.toggle("hidden", isPf));
  [auditFirstName, auditMotherName, auditFatherName].forEach((input) => {
    if (input) {
      input.required = isTjdftSelected && isPf;
      if (!isTjdftSelected || !isPf) {
        input.value = "";
      }
    }
  });
  if (tjdftCompanyName) {
    tjdftCompanyName.required = false;
    if (!isTjdftSelected || isPf) {
      tjdftCompanyName.value = "";
    }
  }
  const hasSelectedCertificate = [...tjdftCertificateTypeInputs].some((input) => input.checked);
  tjdftCertificateTypeInputs.forEach((input) => {
    if (isTjdftSelected && !hasSelectedCertificate) {
      input.checked = true;
    }
  });
}

function getExclusiveAuditDocumentType(sourceId) {
  const config = auditSourceConfig[sourceId];
  const types = config?.documentTypes || config?.appliesTo || ["cpf", "cnpj"];
  return types.length === 1 ? types[0] : null;
}

function keepCompatibleAuditSelection(changedInput) {
  return changedInput;
}

function applyAuditRouteDefaults(page) {
  if (!auditForm) {
    return;
  }

  const routeSource = auditRouteSources[page] || "";
  const routeDocumentType = auditRouteDocumentType[page] || "";
  const inputs = [...auditForm.querySelectorAll("input[name='auditView']")];
  auditForm.classList.toggle("audit-single-source", Boolean(routeSource));
  if (auditPanelTitle) {
    auditPanelTitle.textContent = routeSource ? `Consulta ${auditSourceLabels[routeSource]}` : "CPF/CNPJ completo";
  }

  inputs.forEach((input) => {
    const isRouteSource = input.value === routeSource;
    const label = input.closest("label");
    label?.classList.toggle("audit-option-hidden", Boolean(routeSource) && !isRouteSource);
    if (routeSource) {
      input.checked = isRouteSource;
    }
  });

  if (routeSource) {
    selectedAuditViews = [routeSource];
    if (routeDocumentType && auditDocumentType) {
      auditDocumentType.value = routeDocumentType;
    }
    setAuditWizardStep(1);
  }

  updateAuditDocumentTypeOptions();
  updateAuditSourceAvailability({ resetSelection: false });
}

function updateAuditDocumentTypeOptions() {
  const selectedTypes = getSelectedAuditDocumentTypes();
  [...auditDocumentType.options].forEach((option) => {
    option.hidden = false;
    option.disabled = false;
  });
  if (selectedTypes.length && !selectedTypes.includes(auditDocumentType.value)) {
    auditDocumentType.value = selectedTypes[0];
  }
  if (selectedTypes.length === 1) {
    auditDocumentType.value = selectedTypes[0];
  }
}

function validateAuditStep(step) {
  auditError.textContent = "";
  updateAuditSourceAvailability({ resetSelection: false });

  if (step === 1) {
    if (!selectedAuditViews.length) {
      auditError.textContent = "Selecione pelo menos um documento para continuar.";
      return false;
    }
    updateAuditDocumentTypeOptions();
    return true;
  }

  if (step === 2) {
    syncAuditPrimaryDocument();
    const { needsCpf, needsCnpj } = getAuditDocumentRequirements();
    const requiredFields = [auditAuthorization];
    if (needsCpf) {
      requiredFields.push(auditCpfDocument);
    }
    if (needsCnpj) {
      requiredFields.push(auditCnpjDocument);
    }
    if (selectedAuditViews.includes("tjdft")) {
      const selectedTjdftCertificates = [...tjdftCertificateTypeInputs].filter((input) => input.checked);
      if (!selectedTjdftCertificates.length) {
        auditError.textContent = "Selecione pelo menos uma certidão do TJDFT.";
        return false;
      }
      if (getTjdftPersonType() === "pf") {
        requiredFields.push(auditFirstName, auditMotherName, auditFatherName);
      }
    }
    if (selectedAuditViews.includes("trf1")) {
      requiredFields.push(trf1CertificateType, trf1Orgaos, trf1Email);
    }
    if (selectedAuditViews.includes("fgts")) {
      requiredFields.push(fgtsRegistrationType, fgtsRegistration, fgtsUf);
    }
    const invalidField = requiredFields.find((field) => field && !field.checkValidity());
    if (invalidField) {
      invalidField.reportValidity();
      return false;
    }
  }

  return true;
}

function updateAuditSourceAvailability({ resetSelection = true } = {}) {
  if (!auditForm || !auditDocumentType) {
    return;
  }

  const { needsCpf, needsCnpj } = getAuditDocumentRequirements();
  const tipoDocumento = needsCpf ? "cpf" : "cnpj";
  if (auditDocumentType) {
    auditDocumentType.value = tipoDocumento;
  }
  updateAuditDocumentTypeOptions();
  auditCpfField?.classList.toggle("hidden", !needsCpf);
  auditCnpjField?.classList.toggle("hidden", !needsCnpj);
  if (auditCpfDocument) {
    auditCpfDocument.required = needsCpf;
    if (!needsCpf) {
      auditCpfDocument.value = "";
    }
  }
  if (auditCnpjDocument) {
    auditCnpjDocument.required = needsCnpj;
    if (!needsCnpj) {
      auditCnpjDocument.value = "";
    }
  }
  syncAuditPrimaryDocument();

  const inputs = [...auditForm.querySelectorAll("input[name='auditView']")];
  const activeRouteSource = auditRouteSources[getActivePage()] || "";
  inputs.forEach((input) => {
    const config = auditSourceConfig[input.value] || {
      appliesTo: ["cpf", "cnpj"],
      documentTypes: ["cpf", "cnpj"],
      automatic: false,
      badge: "manual",
      note: "Fonte ainda não está automática.",
    };
    const label = input.closest("label");
    const sourceDocumentTypes = config.documentTypes || config.appliesTo;
    const documentCompatible = sourceDocumentTypes.includes(tipoDocumento);
    const selectableInCurrentStep = true;

    input.disabled = false;
    const outsideRouteSource = Boolean(activeRouteSource) && input.value !== activeRouteSource;
    label?.classList.toggle("audit-option-hidden", outsideRouteSource || (auditWizardStep === 2 && !input.checked));
    label?.classList.toggle("audit-option-disabled", false);
    label?.classList.toggle("audit-option-auto", input.checked);
    if (label) {
      label.title = documentCompatible
        ? config.note
        : `${config.note} O Audita pedirá o documento compatível quando necessário.`;
      label.querySelector(".audit-option-badge")?.remove();
    }

  });

  selectedAuditViews = inputs.filter((input) => input.checked).map((input) => input.value);
  const needsTjdftFields = selectedAuditViews.includes("tjdft");
  const needsStateCourtPicker = needsTjdftFields || activeRouteSource === "tjdft";
  const needsTrf1Fields = selectedAuditViews.includes("trf1");
  const needsFgtsFields = selectedAuditViews.includes("fgts");
  tjdftFields?.classList.toggle("hidden", !needsTjdftFields);
  stateCourtPicker?.classList.toggle("hidden", !needsStateCourtPicker);
  updateTjdftPersonFields();
  trf1Fields?.classList.toggle("hidden", !needsTrf1Fields);
  [trf1CertificateType, trf1Orgaos, trf1Email].forEach((input) => {
    if (input) {
      input.required = needsTrf1Fields;
      if (!needsTrf1Fields) {
        input.value = input === trf1CertificateType ? "Criminal" : input === trf1Orgaos ? "Todos os 4 órgãos selecionados" : "";
      }
    }
  });
  if (trf1SocialName && !needsTrf1Fields) {
    trf1SocialName.value = "";
  }
  fgtsFields?.classList.toggle("hidden", !needsFgtsFields);
  [fgtsRegistrationType, fgtsRegistration, fgtsUf].forEach((input) => {
    if (input) {
      input.required = needsFgtsFields;
      if (!needsFgtsFields) {
        input.value = input === fgtsRegistrationType ? "CNPJ" : "";
      }
    }
  });
  if (needsFgtsFields && fgtsRegistration && !fgtsRegistration.value) {
    fgtsRegistration.value = String(auditCnpjDocument?.value || auditDocument?.value || "").replace(/\D/g, "");
  }

  if (auditStatusLabel) {
    auditStatusLabel.textContent =
      selectedAuditViews.length === 1 ? "1 selecionado" : `${selectedAuditViews.length} selecionados`;
  }
}

function drawSignal() {
  if (!canvas || !ctx) {
    return;
  }

  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const gridColor = "rgba(88, 232, 224, 0.14)";
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;

  for (let x = 0; x < width; x += 38) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y < height; y += 38) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const gradients = [
    ["rgba(51, 204, 255, 0.95)", 64, 0.9],
    ["rgba(116, 255, 154, 0.84)", 104, 0.7],
    ["rgba(41, 119, 255, 0.74)", 145, 0.54],
  ];

  gradients.forEach(([color, offset, amp], index) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = index === 0 ? 3 : 2;

    for (let x = 0; x < width; x += 6) {
      const y =
        height * 0.58 +
        Math.sin((x + phase * (1.5 + index)) / offset) * 46 * amp +
        Math.cos((x - phase * 1.2) / (offset * 0.42)) * 18;

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  });

  for (let i = 0; i < 22; i += 1) {
    const x = (i * 73 + phase * 1.8) % width;
    const y = height * 0.52 + Math.sin((i + phase / 18) * 1.7) * 112;
    const radius = 2 + ((i + Math.floor(phase / 10)) % 3);

    ctx.beginPath();
    ctx.fillStyle =
      i % 7 === 0
        ? "rgba(116, 255, 154, 0.9)"
        : i % 5 === 0
          ? "rgba(255, 99, 125, 0.86)"
          : "rgba(143, 215, 255, 0.84)";
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  phase += 1;
  requestAnimationFrame(drawSignal);
}

function rotateRisk() {
  if (!riskScore) {
    return;
  }
  const base = 68 + Math.round(Math.sin(Date.now() / 1800) * 6);
  riskScore.textContent = String(base);
}

reportButton?.addEventListener("click", () => {
  assistantText.textContent =
    "Relatório executivo preparado: 9 alertas consolidados, 3 prioridades críticas, 4 fontes verificadas e recomendação de revisão fiscal imediata antes da aprovação final.";
});

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatStatusLabel(value) {
  const labels = {
    active: "Ativa",
    draft: "Rascunho",
    testing: "Teste",
    paused: "Pausada",
    pending: "Pendente",
    ready: "Pronta",
    failed: "Falhou",
    completed: "Concluída",
    planned: "Planejada",
    sandbox: "Sandbox",
    manual_required: "Manual guiada",
    not_applicable: "Não aplicável",
    blocked: "Bloqueada",
    pending: "Pendente",
    running: "Consultando",
    success: "Concluída",
    failed: "Falhou",
    unavailable: "Indisponível",
    api: "Automática",
    manual_guided: "Manual guiada",
    restricted: "Restrita",
    summary: "Resumo",
    official_url: "Fonte",
    protocol: "Protocolo",
    pdf: "PDF",
    manual_step: "Passo manual",
  };

  return labels[value] || value;
}

function formatAuditFieldLabel(field) {
  const labels = {
    name: "nome/razão social",
    motherName: "nome da mãe",
    birthDate: "data de nascimento",
    email: "e-mail",
    uf: "UF/TRT",
    ceiCaepf: "CEI/CAEPF",
  };
  return labels[field] || field;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderDashboard(data) {
  const metrics = data.metrics || {};
  const values = [
    formatNumber(metrics.consultationsToday || 0),
    formatNumber(metrics.connectedSources || 0),
    formatNumber(metrics.criticalAlerts || 0),
    metrics.averageAnalysisTime || "0s",
  ];

  metricCards.forEach((card, index) => {
    const value = card.querySelector("strong");
    if (value && values[index]) {
      value.textContent = values[index];
    }
  });

  if (Array.isArray(data.signals) && data.signals.length > 0) {
    signalList.innerHTML = data.signals
      .map(
        (signal) => `
          <li>
            <span class="severity ${escapeHtml(signal.severity)}"></span>
            <div>
              <strong>${escapeHtml(signal.title)}</strong>
              <small>${escapeHtml(signal.description)}</small>
            </div>
          </li>
        `,
      )
      .join("");
  }

  if (data.assistantSummary) {
    assistantText.textContent = data.assistantSummary;
  }
}

function renderModules(modules) {
  consultationModule.innerHTML = modules
    .map((module) => `<option value="${escapeHtml(module.slug)}">${escapeHtml(module.name)}</option>`)
    .join("");

  if (!moduleList) {
    return;
  }

  moduleList.innerHTML = modules
    .map(
      (module) => `
        <article class="module-item">
          <div>
            <strong>${escapeHtml(module.name)}</strong>
            <small>${escapeHtml(module.provider)} | ${escapeHtml(module.accessMethod)}</small>
          </div>
          <span class="module-status ${escapeHtml(module.status)}">${escapeHtml(formatStatusLabel(module.status))}</span>
          <p>${escapeHtml(module.description)}</p>
        </article>
      `,
    )
    .join("");
}

function renderConsultations(consultations) {
  if (!Array.isArray(consultations) || consultations.length === 0) {
    consultationHistory.innerHTML = `<p class="empty-state">Nenhuma consulta registrada ainda.</p>`;
    return;
  }

  consultationHistory.innerHTML = consultations
    .map(
      (consultation) => `
        <article class="history-item">
          <div>
            <strong>${escapeHtml(consultation.moduleName)}</strong>
            <small>${escapeHtml(consultation.subjectType)} | ${escapeHtml(consultation.subjectIdentifierMasked)}</small>
          </div>
          <span class="module-status ${escapeHtml(consultation.status)}">${escapeHtml(formatStatusLabel(consultation.status))}</span>
          <p>${escapeHtml(consultation.resultSummary || "Consulta registrada.")}</p>
        </article>
      `,
    )
    .join("");
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function renderAuditHistory(audits) {
  if (!auditHistoryList) {
    return;
  }
  if (!Array.isArray(audits) || audits.length === 0) {
    auditHistoryList.innerHTML = `<p class="empty-state">Nenhuma auditoria solicitada ainda.</p>`;
    return;
  }

  auditHistoryList.innerHTML = audits
    .map((audit) => {
      const pdfs = Array.isArray(audit.pdfs) ? audit.pdfs.filter((pdf) => pdf.url) : [];
      const sourceCount = Array.isArray(audit.fontes) ? audit.fontes.length : 0;
      return `
        <article class="history-item audit-history-item">
          <div>
            <strong>${escapeHtml((audit.tipoDocumento || "").toUpperCase())} ${escapeHtml(audit.documento || "")}</strong>
            <small>${escapeHtml(formatDateTime(audit.createdAt))} | ${sourceCount} fonte${sourceCount === 1 ? "" : "s"}</small>
          </div>
          <span class="module-status ${escapeHtml(audit.status || "")}">${escapeHtml(formatStatusLabel(audit.status || ""))}</span>
          <p>Risco: ${escapeHtml(audit.scoreRisco?.nivel || "indefinido")}</p>
          ${
            pdfs.length
              ? `<div class="history-pdf-list">${pdfs
                  .map(
                    (pdf) =>
                      `<a href="${escapeHtml(pdf.url)}" target="_blank" rel="noreferrer">${escapeHtml(pdf.titulo || "PDF")}</a>`,
                  )
                  .join("")}</div>`
              : `<small class="audit-warning">Nenhum PDF disponível ainda para esta consulta.</small>`
          }
        </article>
      `;
    })
    .join("");
}

async function loadAuditHistory() {
  if (!auditHistoryList) {
    return;
  }
  try {
    const response = await fetch("/audit", { headers: { accept: "application/json" } });
    if (response.status === 401) {
      renderAuditHistory([]);
      return;
    }
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    renderAuditHistory(data.audits || []);
  } catch {
    renderAuditHistory([]);
  }
}

function renderAudit(audit) {
  if (!audit) {
    auditResultStatus.textContent = "Aguardando";
    auditSummary.innerHTML = `<p class="empty-state">Informe CPF/CNPJ e escolha o que deseja visualizar.</p>`;
    auditSourceList.innerHTML = "";
    renderDocumentAiPanel(null, []);
    return;
  }

  const contractMode = Array.isArray(audit.resultados);
  const executions = contractMode
    ? audit.resultados.map((result) => ({
        id: result.fonte,
        sourceId: result.fonte,
        sourceName: formatAuditSourceName(result.fonte),
        category: "audit",
        mode: "collector",
        status: result.status,
        resultado: result.resultado,
        summary: result.erro || result.dados?.resumo || summarizeAuditResult(result),
        officialUrl: result.dados?.officialUrl || getAuditOfficialUrl(result.fonte),
        data: result.dados || {},
        rawText: result.rawText || "",
        missingFields: [],
        evidence: buildAuditEvidence(result),
      }))
    : Array.isArray(audit.executions)
      ? audit.executions
      : [];
  const documentType = audit.documentType || audit.tipoDocumento;
  const documentMasked = audit.documentMasked || audit.documento;
  const visibleExecutions = executions.filter((execution) => shouldShowAuditExecution(execution, documentType));
  const totals = executions.reduce(
    (counts, execution) => {
      counts[execution.status] = (counts[execution.status] || 0) + 1;
      return counts;
    },
    {},
  );
  auditResultStatus.textContent = visibleExecutions.some((execution) => ["completed", "success"].includes(execution.status))
    ? "Resultado"
    : formatStatusLabel(audit.status);
  auditSummary.innerHTML = `
    <div class="audit-summary-grid">
      <span><strong>${escapeHtml(documentType?.toUpperCase() || "")}</strong><small>${escapeHtml(documentMasked || "")}</small></span>
      <span><strong>${visibleExecutions.length}</strong><small>blocos selecionados</small></span>
      <span><strong>${visibleExecutions.filter((item) => ["completed", "success"].includes(item.status)).length}</strong><small>automáticos</small></span>
      <span><strong>${visibleExecutions.filter((item) => ["manual_required", "blocked"].includes(item.status)).length}</strong><small>pendentes</small></span>
      <span><strong>${totals.not_applicable || 0}</strong><small>não aplicáveis</small></span>
    </div>
  `;

  if (!visibleExecutions.length) {
    auditSourceList.innerHTML = `<p class="empty-state">Nenhum bloco selecionado para este documento.</p>`;
    renderDocumentAiPanel(audit, visibleExecutions);
    return;
  }

  auditSourceList.innerHTML = visibleExecutions
    .map((execution) => {
      const missingFields = Array.isArray(execution.missingFields) ? execution.missingFields : [];
      const evidence = Array.isArray(execution.evidence) ? execution.evidence : [];
      const normalizedEvidence = evidence
        .filter((item) => item.type !== "official_url")
        .filter((item) => item.type !== "manual_step" || !["completed", "success"].includes(execution.status));
      return `
        <article class="audit-source-item">
          <div class="audit-source-head">
            <div>
              <strong>${escapeHtml(execution.sourceName)}</strong>
              <small>${escapeHtml(execution.category)} | ${escapeHtml(formatStatusLabel(execution.mode))}</small>
            </div>
            <span class="module-status ${escapeHtml(execution.status)}">${escapeHtml(formatStatusLabel(execution.status))}</span>
          </div>
          <p>${escapeHtml(execution.summary || "")}</p>
          ${execution.officialUrl ? `<a class="audit-official-link" href="${escapeHtml(execution.officialUrl)}" target="_blank" rel="noreferrer">Abrir portal oficial</a>` : ""}
          ${
            missingFields.length
              ? `<small class="audit-warning">Campos pendentes: ${escapeHtml(missingFields.map(formatAuditFieldLabel).join(", "))}</small>`
              : ""
          }
          ${["pending", "running"].includes(execution.status) ? `<div class="audit-loading" aria-label="Consulta em andamento"><span></span><span></span><span></span><small>Consultando fonte...</small></div>` : ""}
          ${
            normalizedEvidence.length
              ? `<div class="audit-evidence-list">${normalizedEvidence
                  .map(
                    (item) => `
                      <span>
                        <strong>${escapeHtml(item.title || formatStatusLabel(item.type))}</strong>
                        ${item.value ? `<small>${escapeHtml(item.value)}</small>` : ""}
                        ${item.href ? `<a href="${escapeHtml(item.href)}" target="_blank" rel="noreferrer">Baixar PDF</a>` : ""}
                      </span>
                    `,
                  )
                  .join("")}</div>`
              : ""
          }
        </article>
      `;
    })
    .join("");
  renderDocumentAiPanel(audit, visibleExecutions);
}

function renderDocumentAiPanel(audit, executions) {
  if (!documentAiPanel) {
    return;
  }
  const context = buildDocumentAiContext(audit, executions);
  currentDocumentAiContext = context;
  documentAiPanel.classList.toggle("hidden", !context);
  if (!context) {
    documentAiContent.innerHTML = `<p class="empty-state">Após a análise dos PDFs, o parecer aparecerá aqui.</p>`;
    documentAiAnswer.innerHTML = `<p>Faça uma pergunta para cruzar o conteúdo das certidões com o parecer e os riscos.</p>`;
    if (documentAiRisk) {
      documentAiRisk.textContent = "Aguardando PDFs";
    }
    return;
  }

  if (documentAiRisk) {
    documentAiRisk.textContent = `Risco ${context.riskLevel}`;
  }
  documentAiContent.innerHTML = `
    <div class="document-ai-grid">
      <article>
        <small>Parecer preliminar</small>
        <p>${escapeHtml(context.opinion)}</p>
      </article>
      <article>
        <small>Riscos identificados</small>
        <ul>${context.risks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join("")}</ul>
      </article>
      <article>
        <small>Certidões analisadas</small>
        <div class="document-ai-chips">
          ${context.certificates
            .map(
              (certificate) =>
                `<span>${escapeHtml(certificate.tipo)}<small>${escapeHtml(certificate.status)}</small></span>`,
            )
            .join("")}
        </div>
      </article>
    </div>
    <small class="consultation-note">${escapeHtml(context.disclaimer)}</small>
  `;
  documentAiAnswer.innerHTML = `<p>Use o campo acima para perguntar sobre riscos, apontamentos, certidões específicas ou próximos passos.</p>`;
}

function buildDocumentAiContext(audit, executions) {
  const tjdftExecution = executions.find((execution) => (execution.sourceId || execution.id) === "tjdft");
  if (!audit || !tjdftExecution) {
    return null;
  }

  const data = tjdftExecution.data || {};
  const rawText = [tjdftExecution.rawText, data.rawText]
    .concat(Array.isArray(data.certidoes) ? data.certidoes.map((certificate) => certificate.rawText || certificate.pageText || "") : [])
    .filter(Boolean)
    .join("\n\n");
  const certificates = normalizeTjdftCertificates(tjdftExecution);
  const hasPendingText = Array.isArray(data.certidoesComAnalisePendente) && data.certidoesComAnalisePendente.length > 0;
  const hasFailure = Array.isArray(data.certidoesComFalha) && data.certidoesComFalha.length > 0;
  const hasFinding =
    tjdftExecution.resultado === "consta" ||
    (Array.isArray(data.certidoesComApontamento) && data.certidoesComApontamento.length > 0) ||
    /consta(m)?\s+(registro|apontamento|distribui[?c][?a]o|processo)|certid[?a]o\s+positiva|apontamento\s+encontrado|exist(e|em)\s+(a[?c][?a]o|processo|distribui[?c][?a]o)/i.test(rawText);
  const riskLevel = hasFinding ? "alto" : hasFailure || hasPendingText || !rawText ? "médio" : "baixo";
  const risks = [];
  if (hasFinding) {
    risks.push("Há indicação de apontamento ou termo sensível nas certidões. Recomenda-se revisão humana antes de qualquer decisão.");
  }
  if (hasFailure) {
    risks.push(`Nem todas as certidões foram emitidas ou baixadas: ${data.certidoesComFalha.join(", ")}.`);
  }
  if (hasPendingText || !rawText) {
    risks.push("A leitura automática do PDF ainda está limitada. O parecer usa metadados, status e textos extraídos disponíveis.");
  }
  if (!risks.length) {
    risks.push("Nenhum apontamento relevante foi identificado nos textos disponíveis das certidões analisadas.");
  }

  const opinion = createDocumentOpinion({ riskLevel, certificates, rawText, data });
  return {
    auditId: audit.consultaId || audit.id,
    document: audit.documento || audit.documentMasked || "",
    documentType: audit.tipoDocumento || audit.documentType || "",
    riskLevel,
    risks,
    certificates,
    rawText,
    opinion,
    disclaimer: "Parecer automatizado de apoio. Use a certidão oficial em PDF como evidência principal e valide pontos sensíveis manualmente.",
  };
}

function normalizeTjdftCertificates(execution) {
  const data = execution.data || {};
  const certificates = Array.isArray(data.certidoes) ? data.certidoes : [];
  if (certificates.length) {
    return certificates.map((certificate) => ({
      tipo: certificate.tipo || "Certidão TJDFT",
      status: certificate.pdfPath ? "PDF baixado" : certificate.errorMessage || "pendente",
      rawText: certificate.rawText || certificate.pageText || "",
    }));
  }
  return (execution.evidence || [])
    .filter((item) => item.type === "pdf")
    .map((item) => ({
      tipo: item.title || "Certidão TJDFT",
      status: item.value || "PDF disponível",
      rawText: "",
    }));
}

function createDocumentOpinion({ riskLevel, certificates, rawText, data }) {
  const analyzed = certificates.length ? certificates.map((certificate) => certificate.tipo).join(", ") : "certidões TJDFT";
  if (riskLevel === "alto") {
    return `Foram analisados os blocos ${analyzed}. O conjunto indica risco alto porque há possível apontamento, termo sensível ou inconsistência que exige revisão humana antes de liberar o caso.`;
  }
  if (riskLevel === "médio") {
    return `Foram analisados os blocos ${analyzed}. O risco é médio porque a análise depende de PDFs/textos incompletos ou de certidões com falha de leitura. Baixe os PDFs e valide manualmente os itens pendentes.`;
  }
  const summary = data.resumo || (rawText ? "Os textos extraídos não indicaram apontamentos relevantes." : "");
  return `Foram analisados os blocos ${analyzed}. O risco preliminar é baixo. ${summary}`;
}

function answerDocumentQuestion(question, context) {
  const normalized = question.toLowerCase();
  const rawText = context.rawText || "";
  const matchingCertificates = context.certificates.filter((certificate) =>
    normalized.includes(certificate.tipo.toLowerCase().split(" ")[0]),
  );

  if (/risco|perigo|problema|apontamento|restri[çc][ãa]o/.test(normalized)) {
    return `${context.opinion} Principais riscos: ${context.risks.join(" ")}`;
  }
  if (/pdf|baixar|download|certid[ãa]o|certidoes|certidões/.test(normalized)) {
    return `Foram considerados estes documentos: ${context.certificates
      .map((certificate) => `${certificate.tipo} (${certificate.status})`)
      .join("; ")}. Use os PDFs oficiais baixados como evidência primária.`;
  }
  if (matchingCertificates.length) {
    return matchingCertificates
      .map((certificate) => `${certificate.tipo}: ${certificate.rawText ? summarizeTextForAnswer(certificate.rawText) : certificate.status}`)
      .join(" ");
  }
  if (/cliente|explicar|parecer|resumo|conclus[ãa]o/.test(normalized)) {
    return `${context.opinion} Em linguagem simples: o usuário deve considerar o risco ${context.riskLevel} e revisar os documentos oficiais quando houver pendência, falha ou apontamento.`;
  }
  if (!rawText) {
    return "Ainda não há texto extraído suficiente dos PDFs para responder com profundidade. O parecer atual usa status, metadados e links dos documentos baixados.";
  }
  return `Com base nos textos disponíveis: ${summarizeTextForAnswer(rawText)} Para uma conclusão formal, confira o PDF oficial anexado ao resultado.`;
}

function summarizeTextForAnswer(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 520);
}

function buildAuditEvidence(result) {
  const dados = result.dados || {};
  if (result.fonte === "tjdft") {
    const items = [
      {
        type: "summary",
        title: "Certidões",
        value: `${dados.certidoesBaixadas || 0}/${dados.totalCertidoes || 4} PDFs baixados`,
      },
    ];

    const certificates = Array.isArray(dados.certidoes) ? dados.certidoes : [];
    items.push(
      ...certificates.map((certificate) => ({
        type: "pdf",
        title: certificate.tipo || "Certidão TJDFT",
        value: certificate.pdfPath ? "PDF baixado" : certificate.errorMessage || "PDF não disponível",
        href: toPdfPublicUrl(certificate.pdfPath),
      })),
    );

    if (Array.isArray(dados.certidoesComAnalisePendente) && dados.certidoesComAnalisePendente.length) {
      items.push({
        type: "summary",
        title: "Análise",
        value: "OCR/leitura do PDF pendente",
      });
    }

    if (Array.isArray(dados.certidoesComApontamento) && dados.certidoesComApontamento.length) {
      items.push({
        type: "summary",
        title: "Apontamentos",
        value: dados.certidoesComApontamento.join(", "),
      });
    }

    if (Array.isArray(dados.certidoesComFalha) && dados.certidoesComFalha.length) {
      items.push({
        type: "summary",
        title: "Falhas",
        value: dados.certidoesComFalha.join(", "),
      });
    }

    return items;
  }

  return Object.entries(dados)
    .filter(([key]) => key !== "officialUrl")
    .slice(0, 4)
    .map(([key, value]) => ({
      type: "summary",
      title: formatAuditDataKey(key),
      value: typeof value === "object" ? JSON.stringify(value).slice(0, 220) : String(value),
    }));
}

function formatAuditDataKey(key) {
  const labels = {
    totalCertidoes: "Certidões",
    certidoesBaixadas: "PDFs baixados",
    certidoesComAnalisePendente: "Análise pendente",
    certidoesComApontamento: "Apontamentos",
    certidoesComFalha: "Falhas",
    resumo: "Resumo",
  };
  return labels[key] || key;
}

function toPdfPublicUrl(pdfPath) {
  if (!pdfPath) {
    return "";
  }
  const fileName = String(pdfPath).split(/[\\/]/).pop();
  return fileName ? `/storage/pdfs/${encodeURIComponent(fileName)}` : "";
}

function getAuditOfficialUrl(sourceId) {
  const urls = {
    receita_federal: "https://brasilapi.com.br/docs#tag/CNPJ",
    pgfn: "https://www.gov.br/receitafederal/pt-br/servicos/certidoes/consultar-certidoes-emitidas",
    cndt: "https://www.tst.jus.br/certidao1",
    trf1: "https://certidao-unificada.cjf.jus.br/#/solicitacao-certidao",
    tjdft: "https://cnc.tjdft.jus.br/solicitacao-externa",
    fgts: "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf",
    portal_transparencia: "https://www.portaltransparencia.gov.br/sancoes",
  };
  return urls[sourceId] || "";
}

function formatAuditSourceName(sourceId) {
  const names = {
    receita_federal: "Receita Federal / CNPJ",
    pgfn: "PGFN / Certidão Conjunta",
    cndt: "CNDT / TST",
    trf1: "TRF1/CJF / Certidão Unificada",
    tjdft: "TJDFT / Certidões",
    fgts: "CEF / Regularidade FGTS",
    portal_transparencia: "Portal da Transparência / CGU",
  };
  return names[sourceId] || sourceId;
}

function summarizeAuditResult(result) {
  if (result.status === "pending" || result.status === "running") {
    return "Consulta em andamento.";
  }
  if (result.resultado === "consta") {
    return "Foram encontrados registros nesta fonte.";
  }
  if (result.resultado === "nada_consta") {
    return "Nada consta nesta fonte.";
  }
  if (result.status === "success" && result.resultado === "indisponivel") {
    return "Consulta concluída; análise automática do conteúdo pendente.";
  }
  return "Fonte indisponível ou pendente de integração real.";
}

function shouldShowAuditExecution(execution, documentType) {
  if (!selectedAuditViews.length) {
    return false;
  }

  const sourceId = execution.sourceId || "";
  const legacyMap = {
    "brasilapi-cnpj": "receita_federal",
    "portal-transparencia": "portal_transparencia",
    "receita-pgfn": "pgfn",
    "tst-cndt": "cndt",
    "fgts-crf": "fgts",
  };
  return selectedAuditViews.includes(sourceId) || selectedAuditViews.includes(legacyMap[sourceId]);
}

async function loadAudits() {
  if (!auditSourceList) {
    return;
  }

  try {
    const response = await fetch("/api/audits", { headers: { accept: "application/json" } });
    if (response.status === 401) {
      renderAudit(null);
      return;
    }
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    const latest = Array.isArray(data.audits) ? data.audits[0] : null;
    if (!latest) {
      renderAudit(null);
      return;
    }

    const detail = await fetch(`/api/audits/${latest.id}`, { headers: { accept: "application/json" } });
    if (!detail.ok) {
      renderAudit(latest);
      return;
    }
    const detailData = await detail.json();
    renderAudit(detailData.audit);
  } catch {
    renderAudit(null);
  }
}

async function loadAuditResult(consultaId, attempts = 180) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(`/audit/${consultaId}`, { headers: { accept: "application/json" } });
    if (!response.ok) {
      return;
    }
    const audit = await response.json();
    renderAudit(audit);
    if (!["pending", "running", "partial"].includes(audit.status)) {
      await loadAuditHistory();
      return;
    }
    if (attempt === attempts - 1) {
      auditResultStatus.textContent = "Ainda processando";
      await loadAuditHistory();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function renderSources(sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    sourceList.innerHTML = `<p class="empty-state">Nenhuma fonte configurada ainda.</p>`;
    return;
  }

  sourceList.innerHTML = sources
    .map(
      (source) => `
        <article class="source-item">
          <div>
            <strong>${escapeHtml(source.name)}</strong>
            <small>${escapeHtml(source.agency)} | ${escapeHtml(source.category)} | ${escapeHtml(source.accessMethod)}</small>
          </div>
          <span class="module-status ${escapeHtml(source.status)}">${escapeHtml(formatStatusLabel(source.status))}</span>
          <p>${escapeHtml(source.baseUrl)}</p>
          <small>Normalização: ${escapeHtml(formatStatusLabel(source.normalizationStatus))}${source.secretRef ? " | Secret referenciado" : ""}</small>
        </article>
      `,
    )
    .join("");
}

function renderAgentAnswer(result) {
  const records = Array.isArray(result.records) ? result.records.slice(0, 8) : [];
  agentAnswer.innerHTML = `
    <strong>${escapeHtml(result.source)}</strong>
    <p>${escapeHtml(result.answer)}</p>
    ${
      records.length
        ? `<div class="agent-records">${records
            .map(
              (record) => `
                <span>${escapeHtml(
                  record.sigla
                    ? `${record.sigla} - ${record.nome}`
                    : record.populacao
                      ? `${record.nome}/${record.uf} - ${Number(record.populacao).toLocaleString("pt-BR")} hab.`
                    : record.descricao
                      ? `${record.id} - ${record.descricao}`
                      : record.nome || record.id,
                )}</span>
              `,
            )
            .join("")}</div>`
        : ""
    }
  `;
}

function renderAssistantSources(sources) {
  if (!assistantSource) {
    return;
  }

  const availableSources = Array.isArray(sources) ? sources : [];
  assistantSource.innerHTML = availableSources
    .map(
      (source) =>
        `<option value="${escapeHtml(source.id)}">${escapeHtml(source.name)} | ${escapeHtml(source.agency)}</option>`,
    )
    .join("");

  assistantSourceStatus.textContent = availableSources.length
    ? `${availableSources.length} fontes`
    : "Sem fontes";
}

function formatRecord(record) {
  if (!record || typeof record !== "object") {
    return String(record || "");
  }

  if (record.sigla) {
    return `${record.sigla} - ${record.nome}`;
  }
  if (record.populacao) {
    return `${record.nome}/${record.uf} - ${Number(record.populacao).toLocaleString("pt-BR")} hab.`;
  }
  if (record.descricao) {
    return `${record.id || ""} - ${record.descricao}`.trim();
  }
  if (record.nome) {
    return record.nome;
  }
  if (record.id) {
    return String(record.id);
  }

  return JSON.stringify(record).slice(0, 180);
}

function renderAssistantResult(result) {
  const records = Array.isArray(result.records) ? result.records.slice(0, 10) : [];
  assistantResult.innerHTML = `
    <strong>${escapeHtml(result.source || "Fonte consultada")}</strong>
    <p>${escapeHtml(result.answer || "Consulta concluída.")}</p>
    ${
      records.length
        ? `<div class="agent-records">${records
            .map((record) => `<span>${escapeHtml(formatRecord(record))}</span>`)
            .join("")}</div>`
        : ""
    }
  `;
}

async function loadAssistantSources() {
  if (!assistantSource) {
    return;
  }

  try {
    const response = await fetch("/api/assistant/sources", { headers: { accept: "application/json" } });
    if (response.status === 401) {
      renderAssistantSources([]);
      return;
    }
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    renderAssistantSources(data.sources || []);
  } catch {
    renderAssistantSources([]);
  }
}

async function loadModules() {
  try {
    const response = await fetch("/api/modules", { headers: { accept: "application/json" } });
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    renderModules(data.modules || []);
  } catch {
    if (moduleList) {
      moduleList.innerHTML = `<p class="empty-state">Não foi possível carregar os módulos.</p>`;
    }
  }
}

async function loadConsultations() {
  try {
    const response = await fetch("/api/consultations", { headers: { accept: "application/json" } });
    if (response.status === 401) {
      renderConsultations([]);
      return;
    }
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    renderConsultations(data.consultations || []);
  } catch {
    renderConsultations([]);
  }
}

async function loadSources() {
  try {
    const response = await fetch("/api/integrations/sources", { headers: { accept: "application/json" } });
    if (response.status === 401) {
      renderSources([]);
      return;
    }
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    renderSources(data.sources || []);
  } catch {
    renderSources([]);
  }
}

function setLoginMode(mode) {
  loginMode = mode === "register" ? "register" : "login";
  const isRegister = loginMode === "register";
  loginNameField?.classList.toggle("hidden", !isRegister);
  if (loginName) {
    loginName.required = isRegister;
  }
  if (loginPassword) {
    loginPassword.autocomplete = isRegister ? "new-password" : "current-password";
  }
  if (loginEyebrow) {
    loginEyebrow.textContent = isRegister ? "Cadastro seguro" : "Acesso seguro";
  }
  if (loginTitle) {
    loginTitle.textContent = isRegister ? "Criar conta" : "Audita";
  }
  if (loginSubmitButton) {
    loginSubmitButton.textContent = isRegister ? "Cadastrar e entrar" : "Entrar";
  }
  if (loginModeToggle) {
    loginModeToggle.textContent = isRegister ? "Já tenho uma conta" : "Criar uma conta";
  }
}

function showLogin(message = "", mode = loginMode) {
  setLoginMode(mode);
  loginScreen.classList.remove("hidden");
  loginError.textContent = message;
  loginButton?.classList.add("hidden");
  logoutButton.classList.add("hidden");
  (loginMode === "register" ? loginName : loginEmail)?.focus();
}

function hideLogin() {
  loginScreen.classList.add("hidden");
  loginError.textContent = "";
  loginButton?.classList.add("hidden");
}

function renderAgentSettings(settings) {
  if (!settings) {
    return;
  }

  agentModel.value = settings.model || "gpt-5-mini";
  agentApiKeySecretRef.value = settings.apiKeySecretRef || "OPENAI_API_KEY";
  agentProviderStatus.value = settings.status || "draft";
  agentSystemPrompt.value =
    settings.systemPrompt ||
    "Você é o Agente Audita. Responda de forma clara, objetiva, humanizada e sempre cite a fonte dos dados consultados.";
  agentSettingsStatus.textContent = settings.configured ? "Secret detectado" : "Aguardando secret";
}

async function loadAgentSettings() {
  try {
    const response = await fetch("/api/agent/settings", { headers: { accept: "application/json" } });
    if (response.status === 401) {
      return;
    }
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    renderAgentSettings(data.settings);
  } catch {
    agentSettingsStatus.textContent = "Indisponível";
  }
}

async function loadAuthState() {
  try {
    const response = await fetch("/api/auth/me", { headers: { accept: "application/json" } });
    if (!response.ok) {
      return { authRequired: false, user: null };
    }
    return response.json();
  } catch {
    return { authRequired: false, user: null };
  }
}

function renderProfile(user) {
  if (profileName) {
    profileName.textContent = user?.name || "Super Admin";
  }
  if (profileEmail) {
    profileEmail.textContent = user?.email || "Não informado";
  }
  if (profilePlan) {
    profilePlan.textContent = "Ilimitado";
  }
}

function formatEnvironmentName(environment) {
  const names = {
    local: "Local",
    development: "Desenvolvimento",
    staging: "Staging",
    production: "Produção",
  };

  return names[environment] || environment;
}

async function loadAppConfig() {
  try {
    const response = await fetch("/api/config", { headers: { accept: "application/json" } });
    if (!response.ok) {
      return;
    }

    const config = await response.json();
    environmentName.textContent = formatEnvironmentName(config.environment || "local");
    environmentDetail.textContent = config.appUrl ? new URL(config.appUrl).hostname : "Ambiente Audita";
  } catch {
    environmentName.textContent = "Local";
    environmentDetail.textContent = "Ambiente Audita";
  }
}

async function loadDeployVersion() {
  try {
    const response = await fetch("/api/health", { headers: { accept: "application/json" } });
    if (!response.ok) {
      return;
    }

    const health = await response.json();
    const version = String(health.version || "local");
    deployVersion.textContent = version.length > 12 ? `versão ${version.slice(0, 7)}` : `versão ${version}`;
  } catch {
    deployVersion.textContent = "versão local";
  }
}

async function loadDashboard() {
  try {
    const response = await fetch("/api/dashboard", { headers: { accept: "application/json" } });
    if (response.status === 401) {
      showLogin("Entre para acessar o dashboard.");
      return;
    }
    if (!response.ok) {
      return;
    }
    renderDashboard(await response.json());
  } catch {
    // The static demo remains available when the API is not reachable.
  }
}

loginModeToggle?.addEventListener("click", () => {
  loginError.textContent = "";
  setLoginMode(loginMode === "register" ? "login" : "register");
});

loginButton?.addEventListener("click", () => {
  showLogin("", "login");
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";

  try {
    const payload = {
      email: loginEmail.value,
      password: loginPassword.value,
    };
    if (loginMode === "register") {
      payload.name = loginName.value;
    }

    const response = await fetch(loginMode === "register" ? "/api/auth/register" : "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const messages = {
        invalid_name: "Informe seu nome para criar a conta.",
        invalid_email: "Informe um e-mail valido.",
        weak_password: "Use uma senha com pelo menos 8 caracteres.",
        email_already_registered: "Este e-mail ja tem cadastro. Entre com sua senha.",
      };
      let message = loginMode === "register" ? "Não foi possível criar a conta." : "E-mail ou senha inválidos.";
      try {
        const data = await response.json();
        message = messages[data.error] || message;
      } catch {
        // Keep the friendly default message.
      }
      showLogin(message, loginMode);
      return;
    }

    loginName.value = "";
    loginPassword.value = "";
    hideLogin();
    logoutButton.classList.remove("hidden");
    await loadDashboard();
    await loadAudits();
    await loadAuditHistory();
    await loadConsultations();
    await loadSources();
    await loadAgentSettings();
    await loadAssistantSources();
  } catch {
    showLogin("Não foi possível autenticar agora.");
  }
});

sourceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  sourceError.textContent = "";

  try {
    const response = await fetch("/api/integrations/sources", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        name: sourceName.value,
        agency: sourceAgency.value,
        category: sourceCategory.value,
        baseUrl: sourceBaseUrl.value,
        accessMethod: sourceAccessMethod.value,
        authType: sourceAuthType.value,
        secretRef: sourceSecretRef.value,
        status: sourceStatus.value,
        schemaNotes: sourceSchemaNotes.value,
      }),
    });

    if (response.status === 401) {
      showLogin("Entre para gerenciar integrações.");
      return;
    }
    if (response.status === 403) {
      sourceError.textContent = "Seu usuário não tem permissão para gerenciar fontes.";
      return;
    }
    if (!response.ok) {
      sourceError.textContent = "Não foi possível salvar a fonte.";
      return;
    }

    sourceForm.reset();
    await loadSources();
    await loadAssistantSources();
  } catch {
    sourceError.textContent = "Falha ao comunicar com a API.";
  }
});

agentSettingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  agentSettingsError.textContent = "";

  try {
    const response = await fetch("/api/agent/settings", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        model: agentModel.value,
        apiKeySecretRef: agentApiKeySecretRef.value,
        status: agentProviderStatus.value,
        systemPrompt: agentSystemPrompt.value,
      }),
    });

    if (response.status === 401) {
      showLogin("Entre para configurar a IA.");
      return;
    }
    if (response.status === 403) {
      agentSettingsError.textContent = "Seu usuário não tem permissão para configurar a IA.";
      return;
    }
    if (!response.ok) {
      agentSettingsError.textContent = "Não foi possível salvar a configuração.";
      return;
    }

    const data = await response.json();
    renderAgentSettings(data.settings);
  } catch {
    agentSettingsError.textContent = "Falha ao comunicar com a API.";
  }
});

promptSuggestions.forEach((button) => {
  button.addEventListener("click", () => {
    agentQuestion.value = button.dataset.question || "";
    agentQuestion.focus();
  });
});

sidebarToggle?.addEventListener("click", () => {
  const collapsed = document.body.classList.toggle("sidebar-collapsed");
  sidebarToggle.textContent = collapsed ? "›" : "‹";
  sidebarToggle.setAttribute("aria-label", collapsed ? "Expandir menu" : "Recolher menu");
  sidebarToggle.title = collapsed ? "Expandir menu" : "Recolher menu";
});

mobileMenuButton?.addEventListener("click", () => {
  const open = document.body.classList.toggle("menu-open");
  mobileMenuButton.setAttribute("aria-expanded", String(open));
});

agentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  agentAnswer.innerHTML = `<p>Consultando a fonte oficial...</p>`;

  try {
    const response = await fetch("/api/agent/query", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ question: agentQuestion.value }),
    });

    if (response.status === 401) {
      showLogin("Entre para usar o agente.");
      return;
    }

    if (!response.ok) {
      agentAnswer.innerHTML = `<p>Não consegui consultar essa fonte agora. Tente outra pergunta.</p>`;
      return;
    }

    renderAgentAnswer(await response.json());
  } catch {
    agentAnswer.innerHTML = `<p>Falha ao comunicar com o agente.</p>`;
  }
});

assistantQueryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const prompt = assistantPrompt.value.trim();
  const code = assistantCode.value.trim();

  if (!prompt) {
    assistantResult.innerHTML = `<p>Digite a pergunta para orientar a consulta.</p>`;
    assistantPrompt.focus();
    return;
  }

  assistantResult.innerHTML = `<p>Consultando a fonte selecionada...</p>`;

  try {
    const response = await fetch("/api/assistant/query", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sourceId: assistantSource.value,
        code,
        prompt,
      }),
    });

    if (response.status === 401) {
      showLogin("Entre para usar o assistente.");
      return;
    }

    if (!response.ok) {
      assistantResult.innerHTML = `<p>Não consegui concluir essa consulta. Verifique a fonte, o código e as credenciais.</p>`;
      return;
    }

    renderAssistantResult(await response.json());
  } catch {
    assistantResult.innerHTML = `<p>Falha ao comunicar com o assistente.</p>`;
  }
});

documentAiQuestionButton?.addEventListener("click", () => {
  const question = documentAiQuestion?.value.trim() || "";
  if (!question) {
    documentAiAnswer.innerHTML = `<p>Digite uma pergunta sobre as certidões ou os riscos encontrados.</p>`;
    documentAiQuestion?.focus();
    return;
  }
  if (!currentDocumentAiContext) {
    documentAiAnswer.innerHTML = `<p>Execute uma consulta TJDFT para liberar a inteligência documental.</p>`;
    return;
  }
  documentAiAnswer.innerHTML = `<p>${escapeHtml(answerDocumentQuestion(question, currentDocumentAiContext))}</p>`;
});

auditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateAuditStep(2)) {
    return;
  }

  auditError.textContent = "";
  auditResultStatus.textContent = "Criando";
  setAuditWizardStep(3);

  try {
    const documentState = syncAuditPrimaryDocument();
    selectedAuditViews = [...auditForm.querySelectorAll("input[name='auditView']:checked")].map((input) => input.value);
    if (selectedAuditViews.length === 0) {
      auditError.textContent = "Nenhuma fonte automática aplicável foi selecionada para este documento.";
      auditResultStatus.textContent = "Aguardando";
      return;
    }

    const response = await fetch("/audit", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        tipoDocumento: documentState.primaryType,
        documento: documentState.primaryValue,
        fontes: selectedAuditViews,
        extraFields: {
          cpfDocument: documentState.cpfValue,
          cnpjDocument: documentState.cnpjValue,
          stateCourtUf: stateCourtUf?.value || tjdftCourtUf?.value || "DF",
          stateCourtName: getSelectedStateCourt()?.court || "TJDFT",
          stateCourtUrl: getSelectedStateCourt()?.url || "",
          tjdftPersonType: getTjdftPersonType(),
          tjdftCompanyName: tjdftCompanyName?.value || "",
          tjdftCertificateTypes: [...tjdftCertificateTypeInputs]
            .filter((input) => input.checked)
            .map((input) => input.value),
          firstName: auditFirstName?.value || "",
          motherName: auditMotherName?.value || "",
          fatherName: auditFatherName?.value || "",
          trf1CertificateType: trf1CertificateType?.value || "",
          trf1Orgaos: trf1Orgaos?.value || "",
          trf1Email: trf1Email?.value || "",
          trf1SocialName: trf1SocialName?.value || "",
          fgtsRegistrationType: fgtsRegistrationType?.value || "",
          fgtsRegistration: fgtsRegistration?.value || "",
          fgtsUf: fgtsUf?.value || "",
        },
      }),
    });

    if (response.status === 401) {
      showLogin("Entre para criar auditorias.");
      return;
    }

    if (!response.ok) {
      auditError.textContent = "Confira CPF/CNPJ e tente novamente.";
      auditResultStatus.textContent = "Falhou";
      return;
    }

    const data = await response.json();
    auditSummary.innerHTML = `<p class="empty-state">Consulta ${escapeHtml(data.consultaId)} criada. Coletando fontes selecionadas...</p>`;
    await loadAuditResult(data.consultaId);
  } catch {
    auditError.textContent = "Falha ao comunicar com a API de auditoria.";
    auditResultStatus.textContent = "Falhou";
  }
});

auditNextButton?.addEventListener("click", () => {
  if (validateAuditStep(1)) {
    setAuditWizardStep(2);
  }
});

auditBackButton?.addEventListener("click", () => {
  setAuditWizardStep(Math.max(1, auditWizardStep - 1));
});

auditStepButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const targetStep = Number(button.dataset.auditStepButton);
    if (targetStep === 3) {
      setAuditWizardStep(3);
      return;
    }
    if (targetStep <= auditWizardStep || validateAuditStep(auditWizardStep)) {
      setAuditWizardStep(targetStep);
    }
  });
});

auditForm.querySelectorAll("input[name='auditView']").forEach((input) => {
  input.addEventListener("change", () => {
    keepCompatibleAuditSelection(input);
    updateAuditDocumentTypeOptions();
    updateAuditSourceAvailability({ resetSelection: false });
  });
});

auditDocumentType?.addEventListener("change", () => {
  if (auditDocument) {
    auditDocument.value = "";
  }
  auditError.textContent = "";
  renderAudit(null);
  updateAuditSourceAvailability();
  setAuditWizardStep(1);
});

[auditCpfDocument, auditCnpjDocument].forEach((input) => {
  input?.addEventListener("input", () => {
    syncAuditPrimaryDocument();
    if (input === auditCnpjDocument && fgtsRegistration && selectedAuditViews.includes("fgts")) {
      fgtsRegistration.value = input.value.replace(/\D/g, "");
    }
  });
});

tjdftCourtUf?.addEventListener("change", () => {
  syncStateCourtSelection(tjdftCourtUf);
  updateTjdftPersonFields();
});

stateCourtUf?.addEventListener("change", () => {
  syncStateCourtSelection(stateCourtUf);
  updateTjdftPersonFields();
});

auditSourceList.addEventListener("submit", async (event) => {
  const form = event.target.closest(".audit-evidence-form");
  if (!form) {
    return;
  }

  event.preventDefault();
  auditError.textContent = "";

  const file = form.elements.file.files[0];
  const contentBase64 = await readFileAsBase64(file);

  try {
    const response = await fetch(`/api/audits/${form.dataset.auditId}/evidence`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        executionId: form.dataset.executionId,
        evidenceType: form.elements.evidenceType.value,
        title: form.elements.title.value,
        value: form.elements.value.value,
        fileName: file?.name || "",
        contentBase64,
      }),
    });

    if (response.status === 401) {
      showLogin("Entre para anexar evidências.");
      return;
    }

    if (!response.ok) {
      auditError.textContent = "Não foi possível anexar a evidência.";
      return;
    }

    const data = await response.json();
    renderAudit(data.audit);
  } catch {
    auditError.textContent = "Falha ao anexar evidência.";
  }
});

consultationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  consultationError.textContent = "";

  try {
    const response = await fetch("/api/consultations", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        moduleSlug: consultationModule.value,
        subjectType: subjectType.value,
        subjectIdentifier: subjectIdentifier.value,
      }),
    });

    if (response.status === 401) {
      showLogin("Entre para registrar consultas.");
      return;
    }

    if (!response.ok) {
      consultationError.textContent = "Não foi possível registrar a consulta.";
      return;
    }

    subjectIdentifier.value = "";
    await loadConsultations();
  } catch {
    consultationError.textContent = "Falha ao comunicar com a API.";
  }
});

logoutButton.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  showLogin("Sessão encerrada.");
});

newQueryButton?.addEventListener("click", () => {
  window.location.hash = "assistente";
});

window.addEventListener("hashchange", () => {
  setActivePage(getActivePage());
});

setInterval(rotateRisk, 1400);
drawSignal();

moveEcosystemModules();
populateStateCourtSelect();
syncStateCourtSelection(stateCourtUf || tjdftCourtUf);
setActivePage(getActivePage());
updateAuditSourceAvailability();
setAuditWizardStep(1);
await loadAppConfig();
await loadDeployVersion();
await loadModules();
const authState = await loadAuthState();
renderProfile(authState.user);
if (authState.authRequired && !authState.user) {
  showLogin();
} else {
  if (authState.user) {
    logoutButton.classList.remove("hidden");
    loginButton?.classList.add("hidden");
  } else {
    loginButton?.classList.remove("hidden");
  }
  await loadDashboard();
  await loadAudits();
  await loadAuditHistory();
  await loadConsultations();
  await loadSources();
  await loadAgentSettings();
  await loadAssistantSources();
}
