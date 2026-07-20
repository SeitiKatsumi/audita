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
const navLinks = document.querySelectorAll(".nav-list a[href^='#'], .nav-list a[data-app-route]");
const pageBlocks = document.querySelectorAll("[data-page]");
const chatThreadList = document.querySelector("#chatThreadList");
const chatNewButton = document.querySelector("#chatNewButton");
const chatMobileNewButton = document.querySelector("#chatMobileNewButton");
const chatToolsButton = document.querySelector("#chatToolsButton");
const chatToolsPanel = document.querySelector("#chatToolsPanel");
const chatMessages = document.querySelector("#chatMessages");
const chatEmptyState = document.querySelector("#chatEmptyState");
const chatForm = document.querySelector("#chatForm");
const chatInput = document.querySelector("#chatInput");
const chatSendButton = document.querySelector("#chatSendButton");
const chatError = document.querySelector("#chatError");
const chatSuggestionButtons = document.querySelectorAll("[data-chat-prompt]");
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
const stateCourtAssistPanel = document.querySelector("#stateCourtAssistPanel");
const stateCourtDynamicFields = document.querySelector("#stateCourtDynamicFields");
const tjdftPersonTypeLabel = document.querySelector("#tjdftPersonTypeLabel");
const tjdftCourtUf = document.querySelector("#tjdftCourtUf");
const tjdftPfFields = document.querySelectorAll(".tjdft-pf-field");
const tjdftPjFields = document.querySelectorAll(".tjdft-pj-field");
const tjdftCertificateOptions = document.querySelector(".tjdft-certificate-options");
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
const cnibForm = document.querySelector("#cnibForm");
const cnibDocumentType = document.querySelector("#cnibDocumentType");
const cnibDocument = document.querySelector("#cnibDocument");
const cnibSubjectName = document.querySelector("#cnibSubjectName");
const cnibAuthorization = document.querySelector("#cnibAuthorization");
const cnibSubmitButton = document.querySelector("#cnibSubmitButton");
const cnibError = document.querySelector("#cnibError");
const cnibResult = document.querySelector("#cnibResult");
const cnibStatusLabel = document.querySelector("#cnibStatusLabel");
const propertySearchForm = document.querySelector("#propertySearchForm");
const propertyOperation = document.querySelector("#propertyOperation");
const propertyDocumentType = document.querySelector("#propertyDocumentType");
const propertyDocument = document.querySelector("#propertyDocument");
const propertySubjectName = document.querySelector("#propertySubjectName");
const propertyUfField = document.querySelector("#propertyUfField");
const propertyUf = document.querySelector("#propertyUf");
const propertyRegistrationField = document.querySelector("#propertyRegistrationField");
const propertyRegistrationNumber = document.querySelector("#propertyRegistrationNumber");
const propertyRegistryField = document.querySelector("#propertyRegistryField");
const propertyRegistryLabel = document.querySelector("#propertyRegistryLabel");
const propertyRegistryOfficeIds = document.querySelector("#propertyRegistryOfficeIds");
const propertyRegistryHelp = document.querySelector("#propertyRegistryHelp");
const propertyCityField = document.querySelector("#propertyCityField");
const propertyCity = document.querySelector("#propertyCity");
const propertyCertificatePurposeField = document.querySelector("#propertyCertificatePurposeField");
const propertyCertificatePurpose = document.querySelector("#propertyCertificatePurpose");
const propertyTransferredField = document.querySelector("#propertyTransferredField");
const propertyIncludeTransferred = document.querySelector("#propertyIncludeTransferred");
const propertyTransferDateField = document.querySelector("#propertyTransferDateField");
const propertyTransferDate = document.querySelector("#propertyTransferDate");
const propertyOperationSummary = document.querySelector("#propertyOperationSummary");
const propertyCreditQuote = document.querySelector("#propertyCreditQuote");
const propertyAuthorization = document.querySelector("#propertyAuthorization");
const propertySubmitButton = document.querySelector("#propertySubmitButton");
const propertySearchError = document.querySelector("#propertySearchError");
const propertySearchResult = document.querySelector("#propertySearchResult");
const propertyProviderStatus = document.querySelector("#propertyProviderStatus");
const propertyWalletStatus = document.querySelector("#propertyWalletStatus");
const propertyHistoryList = document.querySelector("#propertyHistoryList");
const propertyHistoryCount = document.querySelector("#propertyHistoryCount");
let selectedAuditViews = [];
let currentDocumentAiContext = null;
let currentPropertySearch = null;
const assistedRemoteSessions = new Map();
const assistedRemoteRefreshTimers = new Map();
const auditDraftStorageKey = "audita:auditFormDraft:v1";
const assistedRemoteTypeBuffers = new Map();
const assistedRemoteTypeTimers = new Map();
let assistedRemoteDragState = null;
let assistedRemoteSkipNextClick = false;
const stateCourtAgentSessions = new Map();
const stateCourtAgentRefreshTimers = new Map();
let propertySearchConfig = null;
let currentPropertySearchId = sessionStorage.getItem("audita:lastPropertySearchId") || "";

let stateCourtDirectory = [
  {
    uf: "AC",
    court: "TJAC",
    name: "Acre",
    url: "https://certidoes.tjac.jus.br/",
    platform: "agent_assisted",
    automationStatus: "agent_assisted",
    captchaMode: "assisted",
    requiredFields: ["document", "fullName"],
    optionalFields: ["motherName", "fatherName", "birthDate", "email"],
    certificateTypes: ["civil", "criminal"],
  },
  { uf: "AL", court: "TJAL", name: "Alagoas", url: "https://www.tjal.jus.br/certidoes/" },
  {
    uf: "AP",
    court: "TJAP",
    name: "Amapá",
    url: "https://tucujuris.tjap.jus.br/pages/certidao-publica/certidao-publica.html",
    platform: "tucujuris",
    automationStatus: "blocked",
    captchaMode: "assisted",
    blocker: "cloudflare",
    requiredFields: ["document", "fullName", "gender", "birthDate", "motherName", "rg", "email"],
    optionalFields: ["fatherName"],
    certificateTypes: ["civil", "criminal", "especial", "falencia"],
  },
  {
    uf: "AM",
    court: "TJAM",
    name: "Amazonas",
    url: "https://consultasaj.tjam.jus.br/sco/abrirCadastro.do",
    platform: "esaj",
    automationStatus: "active",
    captchaMode: "none",
    automatic: true,
    requiredFields: [
      "document",
      "comarca",
      "fullName",
      "gender",
      "birthDate",
      "nationality",
      "naturality",
      "civilStatus",
      "profession",
      "address",
      "addressComplement",
      "cep",
      "neighborhood",
      "city",
      "email",
    ],
    optionalFields: ["motherName", "fatherName", "rg"],
    certificateTypes: ["civil", "criminal", "falencia"],
  },
  {
    uf: "BA",
    court: "TJBA",
    name: "Bahia",
    url: "https://portalcertidoes.tjba.jus.br/#/primeirograu",
    platform: "custom",
    automationStatus: "mapped",
    captchaMode: "assisted",
    requiredFields: ["document", "participation", "fullName", "nationality", "civilStatus", "rg", "issuingAuthority", "address", "motherName"],
    optionalFields: ["fatherName"],
    certificateTypes: ["civil", "criminal", "inventario", "insolvencia", "interdicao"],
  },
  {
    uf: "CE",
    court: "TJCE",
    name: "Ceará",
    url: "https://sirece.tjce.jus.br/sirece-web/nova/solicitacao.jsf?certidao=pf1cijudicial",
    platform: "sirece",
    automationStatus: "mapped",
    captchaMode: "assisted",
    requiredFields: ["document", "fullName", "motherName", "fatherName", "birthDate", "email"],
    optionalFields: ["phone", "mobile"],
    certificateTypes: ["civil", "criminal"],
  },
  { uf: "DF", court: "TJDFT", name: "Distrito Federal", url: "https://cnc.tjdft.jus.br/solicitacao-externa", automatic: true },
  { uf: "ES", court: "TJES", name: "Espírito Santo", url: "https://sistemas.tjes.jus.br/certidaonegativa/" },
  { uf: "GO", court: "TJGO", name: "Goiás", url: "https://projudi.tjgo.jus.br/CertidaoNegativaPositivaPublica" },
  {
    uf: "MA",
    court: "TJMA",
    name: "Maranhão",
    url: "https://jurisconsult.tjma.jus.br/#/certidao-generate-state-certificate-form",
    platform: "custom",
    automationStatus: "mapped",
    captchaMode: "assisted",
    requiredFields: ["document", "fullName", "birthDate", "motherName"],
    optionalFields: ["fatherName", "email", "comarca"],
    certificateTypes: ["civil", "criminal"],
  },
  {
    uf: "MT",
    court: "TJMT",
    name: "Mato Grosso",
    url: "https://sec.tjmt.jus.br/primeiro-grau",
    platform: "agent_assisted",
    automationStatus: "agent_assisted",
    captchaMode: "assisted",
    blocker: "recaptcha_quota",
    requiredFields: ["document", "fullName", "birthDate"],
    optionalFields: ["motherName", "fatherName", "email"],
    certificateTypes: ["civil", "criminal"],
  },
  {
    uf: "MS",
    court: "TJMS",
    name: "Mato Grosso do Sul",
    url: "https://esaj.tjms.jus.br/sco/abrirCadastro.do",
    platform: "esaj",
    automationStatus: "mapped",
    captchaMode: "assisted",
    requiredFields: ["document", "comarca", "certificateKind", "fullName", "rg", "gender", "email"],
    optionalFields: ["motherName", "fatherName", "birthDate"],
    certificateTypes: ["civil", "criminal", "falencia"],
  },
  {
    uf: "MG",
    court: "TJMG",
    name: "Minas Gerais",
    url: "https://rupe.tjmg.jus.br/rupe/justica/publico/certidoes/criarSolicitacaoCertidao.rupe?solicitacaoPublica=true",
    platform: "agent_assisted",
    automationStatus: "agent_assisted",
    captchaMode: "assisted",
    requiredFields: ["document", "fullName", "email", "comarca"],
    optionalFields: ["instance", "certificateKind", "motherName", "fatherName", "birthDate"],
    certificateTypes: ["civil", "criminal", "falencia"],
  },
  {
    uf: "PA",
    court: "TJPA",
    name: "Pará",
    url: "https://portal-certidao.tjpa.jus.br/solicitacao-certidao",
    platform: "agent_assisted",
    automationStatus: "agent_assisted",
    captchaMode: "assisted",
    requiredFields: ["document", "birthDate", "fullName", "motherName", "naturality", "civilStatus", "nationality"],
    optionalFields: ["fatherName", "email", "cep", "address", "addressNumber", "addressComplement", "neighborhood", "stateUf", "city"],
    certificateTypes: ["civil", "criminal"],
  },
  {
    uf: "PB",
    court: "TJPB",
    name: "Paraíba",
    url: "https://app.tjpb.jus.br/certo/paginas/publico/solicitarCertidao.jsf",
    platform: "custom",
    automationStatus: "mapped",
    captchaMode: "assisted",
    requiredFields: ["document", "fullName"],
    optionalFields: ["motherName", "fatherName", "birthDate", "email"],
    certificateTypes: ["civil", "criminal"],
  },
  { uf: "PR", court: "TJPR", name: "Paraná", url: "https://www.tjpr.jus.br/certidoes" },
  {
    uf: "PE",
    court: "TJPE",
    name: "Pernambuco",
    url: "https://certidoesunificadas.app.tjpe.jus.br/",
    platform: "tjpe",
    automationStatus: "mapped",
    captchaMode: "assisted",
    documentTypes: ["cpf"],
    requiredFields: ["document", "fullName", "birthDate", "motherName"],
    optionalFields: ["fatherName"],
    certificateTypes: ["civil", "criminal"],
  },
  {
    uf: "PI",
    court: "TJPI",
    name: "Piauí",
    url: "https://europa.tjpi.jus.br/certidao/unificada",
    platform: "agent_assisted",
    automationStatus: "agent_assisted",
    captchaMode: "assisted",
    requiredFields: [
      "document",
      "fullName",
      "rg",
      "issuingAuthority",
      "civilStatus",
      "motherName",
      "cep",
      "address",
      "addressNumber",
      "neighborhood",
      "stateUf",
      "city",
    ],
    optionalFields: ["fatherName", "birthDate", "email", "addressComplement"],
    certificateTypes: ["civil", "criminal"],
  },
  {
    uf: "RJ",
    court: "TJRJ",
    name: "Rio de Janeiro",
    url: "https://www3.tjrj.jus.br/CJE/certidao/judicial/solicitarCapital?comarca=Capital",
    platform: "agent_assisted",
    automationStatus: "agent_assisted",
    captchaMode: "assisted",
    requiredFields: ["document", "fullName", "email"],
    optionalFields: ["phone", "motherName", "fatherName", "birthDate", "rg"],
    certificateTypes: ["civil", "criminal", "falencia"],
  },
  {
    uf: "RN",
    court: "TJRN",
    name: "Rio Grande do Norte",
    url: "https://certidao.tjrn.jus.br/",
    platform: "agent_assisted",
    automationStatus: "agent_assisted",
    captchaMode: "assisted",
    requiredFields: ["document", "fullName"],
    optionalFields: ["motherName", "fatherName", "birthDate", "email"],
    certificateTypes: ["civil", "criminal"],
  },
  {
    uf: "RS",
    court: "TJRS",
    name: "Rio Grande do Sul",
    url: "https://www.tjrs.jus.br/novo/processos-e-servicos/servicos-processuais/emissao-de-antecedentes-e-certidoes/",
    platform: "agent_assisted",
    automationStatus: "agent_assisted",
    captchaMode: "assisted",
    requiredFields: ["document", "fullName"],
    optionalFields: ["motherName", "fatherName", "birthDate", "email"],
    certificateTypes: ["civil", "criminal"],
  },
  {
    uf: "RO",
    court: "TJRO",
    name: "Rondônia",
    url: "https://www.tjro.jus.br/certidao-unificada/",
    platform: "agent_assisted",
    automationStatus: "agent_assisted",
    captchaMode: "assisted",
    requiredFields: ["document", "fullName"],
    optionalFields: ["motherName", "fatherName", "birthDate", "email"],
    certificateTypes: ["civil", "criminal"],
  },
  {
    uf: "RR",
    court: "TJRR",
    name: "Roraima",
    url: "https://projudi.tjrr.jus.br/projudi/certidao",
    platform: "agent_assisted",
    automationStatus: "agent_assisted",
    captchaMode: "assisted",
    requiredFields: ["document", "fullName"],
    optionalFields: ["motherName", "fatherName", "birthDate", "email"],
    certificateTypes: ["civil", "criminal"],
  },
  {
    uf: "SC",
    court: "TJSC",
    name: "Santa Catarina",
    url: "https://certidoes.tjsc.jus.br/",
    platform: "agent_assisted",
    automationStatus: "agent_assisted",
    captchaMode: "assisted",
    frameMode: "new_tab",
    blocker: "captcha",
    requiredFields: ["document", "fullName"],
    optionalFields: ["motherName", "fatherName", "birthDate", "email"],
    certificateTypes: ["civil", "criminal"],
  },
  {
    uf: "SP",
    court: "TJSP",
    name: "São Paulo",
    url: "https://esaj.tjsp.jus.br/sco/abrirCadastro.do",
    platform: "esaj",
    automationStatus: "active",
    captchaMode: "assisted",
    automatic: true,
    requiredFields: [
      "document",
      "fullName",
      "rg",
      "motherName",
      "fatherName",
      "birthDate",
      "gender",
      "nationality",
      "naturality",
      "civilStatus",
      "profession",
      "address",
      "addressComplement",
      "cep",
      "neighborhood",
      "city",
      "email",
    ],
    certificateTypes: ["civil", "criminal", "falencia"],
  },
  { uf: "SE", court: "TJSE", name: "Sergipe", url: "https://www.tjse.jus.br/portal/servicos/certidao-online" },
  {
    uf: "TO",
    court: "TJTO",
    name: "Tocantins",
    url: "https://eproc1.tjto.jus.br/eprocV2_prod_1grau/externo_controlador.php?acao=cj_online&acao_origem=&acao_retorno=cj",
    platform: "eproc",
    automationStatus: "mapped",
    captchaMode: "none",
    requiredFields: ["document", "fullName"],
    optionalFields: ["motherName", "fatherName", "birthDate", "email"],
    certificateTypes: ["civil", "criminal"],
  },
];
const stateCourtFieldLabels = {
  document: "CPF/CNPJ",
  instance: "Instância",
  certificateKind: "Tipo de certidão",
  participation: "Tipo de participação",
  domicile: "Domicílio",
  nature: "Natureza",
  fullName: "Nome completo / razão social",
  firstName: "Primeiro nome",
  motherName: "Nome da mãe",
  fatherName: "Nome do pai",
  birthDate: "Data de nascimento",
  rg: "RG",
  issuingAuthority: "Órgão expedidor",
  voterTitle: "Título de eleitor",
  ctpsNumber: "CTPS número",
  ctpsSeries: "CTPS série",
  gender: "Gênero",
  nationality: "Nacionalidade",
  naturality: "Naturalidade",
  civilStatus: "Estado civil",
  profession: "Profissão",
  address: "Endereço",
  addressNumber: "Número",
  addressComplement: "Complemento",
  cep: "CEP",
  neighborhood: "Bairro",
  stateUf: "UF",
  city: "Município",
  email: "E-mail",
  phone: "Telefone fixo",
  mobile: "Telefone celular",
  comarca: "Comarca",
  companyName: "Razão social",
};
const stateCourtFieldOptions = {
  participation: [
    { value: "Ambas", label: "Ambas (ativa e passiva)" },
    { value: "Passiva", label: "Passiva" },
    { value: "Ativa", label: "Ativa" },
  ],
  instance: [
    { value: "", label: ".: Escolha uma opção :." },
    { value: "1ª instância (Fóruns)", label: "1ª instância (Fóruns)" },
    { value: "2ª instância (Tribunal)", label: "2ª instância (Tribunal)" },
  ],
  nature: [
    { value: "", label: ".: Escolha uma opção :." },
    { value: "Todas exceto família", label: "Todas exceto família" },
    { value: "Cível", label: "Cível" },
    { value: "Criminal", label: "Criminal" },
    { value: "Auditoria Militar", label: "Auditoria Militar" },
    { value: "Execuções Fiscais", label: "Execuções Fiscais" },
    { value: "Família", label: "Família" },
    { value: "Recuperação Judicial e Extrajudicial (Falência e Concordata)", label: "Recuperação Judicial e Extrajudicial (Falência e Concordata)" },
  ],
  certificateKind: [
    { value: "WEB - Ação Cível", label: "WEB - Ação Cível" },
    { value: "WEB - Ação Criminal", label: "WEB - Ação Criminal" },
    { value: "WEB - Ação de Crime Militar", label: "WEB - Ação de Crime Militar" },
    { value: "WEB - Falência, Concordata, Recup. Judicial e Extrajudicial", label: "WEB - Falência, Concordata, Recup. Judicial e Extrajudicial" },
    { value: "WEB - Inventários e Arrolamento", label: "WEB - Inventários e Arrolamento" },
  ],
  gender: [
    { value: "Masculino", label: "Masculino" },
    { value: "Feminino", label: "Feminino" },
  ],
  nationality: [
    { value: "", label: "Selecione" },
    { value: "BRASILEIRO", label: "BRASILEIRO" },
    { value: "NATURALIZADO BRASILEIRO", label: "NATURALIZADO BRASILEIRO" },
    { value: "ARGENTINO", label: "ARGENTINO" },
    { value: "BOLIVIANO", label: "BOLIVIANO" },
    { value: "CHILENO", label: "CHILENO" },
    { value: "PARAGUAIO", label: "PARAGUAIO" },
    { value: "URUGUAIO", label: "URUGUAIO" },
    { value: "PORTUGUES", label: "PORTUGUÊS" },
    { value: "JAPONES", label: "JAPONÊS" },
    { value: "OUTROS", label: "OUTROS" },
  ],
  civilStatus: [
    { value: "", label: "Selecione" },
    { value: "Solteiro", label: "Solteiro" },
    { value: "Casado", label: "Casado" },
    { value: "Divorciado", label: "Divorciado" },
    { value: "Separado", label: "Separado" },
    { value: "Viúvo", label: "Viúvo" },
  ],
  stateUf: [
    { value: "", label: "Selecione" },
    { value: "AC", label: "AC" },
    { value: "AL", label: "AL" },
    { value: "AP", label: "AP" },
    { value: "AM", label: "AM" },
    { value: "BA", label: "BA" },
    { value: "CE", label: "CE" },
    { value: "DF", label: "DF" },
    { value: "ES", label: "ES" },
    { value: "GO", label: "GO" },
    { value: "MA", label: "MA" },
    { value: "MT", label: "MT" },
    { value: "MS", label: "MS" },
    { value: "MG", label: "MG" },
    { value: "PA", label: "PA" },
    { value: "PB", label: "PB" },
    { value: "PR", label: "PR" },
    { value: "PE", label: "PE" },
    { value: "PI", label: "PI" },
    { value: "RJ", label: "RJ" },
    { value: "RN", label: "RN" },
    { value: "RS", label: "RS" },
    { value: "RO", label: "RO" },
    { value: "RR", label: "RR" },
    { value: "SC", label: "SC" },
    { value: "SP", label: "SP" },
    { value: "SE", label: "SE" },
    { value: "TO", label: "TO" },
  ],
  comarca: [
    { value: "Campo Grande", label: "Campo Grande" },
    { value: "Água Clara", label: "Água Clara" },
    { value: "Amambai", label: "Amambai" },
    { value: "Anastácio", label: "Anastácio" },
    { value: "Anaurilândia", label: "Anaurilândia" },
    { value: "Angélica", label: "Angélica" },
    { value: "Aparecida do Taboado", label: "Aparecida do Taboado" },
    { value: "Aquidauana", label: "Aquidauana" },
    { value: "Bandeirantes", label: "Bandeirantes" },
    { value: "Bataguassu", label: "Bataguassu" },
    { value: "Batayporã", label: "Batayporã" },
    { value: "Bela Vista", label: "Bela Vista" },
    { value: "Bonito", label: "Bonito" },
    { value: "Brasilândia", label: "Brasilândia" },
    { value: "Caarapó", label: "Caarapó" },
    { value: "Camapuã", label: "Camapuã" },
    { value: "Cassilândia", label: "Cassilândia" },
    { value: "Chapadão do Sul", label: "Chapadão do Sul" },
    { value: "Coronel Sapucaia", label: "Coronel Sapucaia" },
    { value: "Corumbá", label: "Corumbá" },
    { value: "Costa Rica", label: "Costa Rica" },
    { value: "Coxim", label: "Coxim" },
    { value: "Deodápolis", label: "Deodápolis" },
    { value: "Dois Irmãos do Buriti", label: "Dois Irmãos do Buriti" },
    { value: "Dourados", label: "Dourados" },
    { value: "Eldorado", label: "Eldorado" },
    { value: "Fátima do Sul", label: "Fátima do Sul" },
    { value: "Glória de Dourados", label: "Glória de Dourados" },
    { value: "Iguatemi", label: "Iguatemi" },
    { value: "Inocência", label: "Inocência" },
    { value: "Itaporã", label: "Itaporã" },
    { value: "Itaquiraí", label: "Itaquiraí" },
    { value: "Ivinhema", label: "Ivinhema" },
    { value: "Jardim", label: "Jardim" },
    { value: "Justiça Itinerante do Estado de MS", label: "Justiça Itinerante do Estado de MS" },
    { value: "Maracaju", label: "Maracaju" },
    { value: "Miranda", label: "Miranda" },
    { value: "Mundo Novo", label: "Mundo Novo" },
    { value: "Naviraí", label: "Naviraí" },
    { value: "Nioaque", label: "Nioaque" },
    { value: "Nova Alvorada do Sul", label: "Nova Alvorada do Sul" },
    { value: "Nova Andradina", label: "Nova Andradina" },
    { value: "Paranaíba", label: "Paranaíba" },
    { value: "Pedro Gomes", label: "Pedro Gomes" },
    { value: "Ponta Porã", label: "Ponta Porã" },
    { value: "Porto Murtinho", label: "Porto Murtinho" },
    { value: "Ribas do Rio Pardo", label: "Ribas do Rio Pardo" },
    { value: "Rio Brilhante", label: "Rio Brilhante" },
    { value: "Rio Negro", label: "Rio Negro" },
    { value: "Rio Verde de Mato Grosso", label: "Rio Verde de Mato Grosso" },
    { value: "São Gabriel do Oeste", label: "São Gabriel do Oeste" },
    { value: "Sete Quedas", label: "Sete Quedas" },
    { value: "Sidrolândia", label: "Sidrolândia" },
    { value: "Sonora", label: "Sonora" },
    { value: "Terenos", label: "Terenos" },
    { value: "Três Lagoas", label: "Três Lagoas" },
    { value: "Manaus", label: "Manaus" },
  ],
};
const stateCourtCertificateLabels = {
  criminal: "Criminal",
  civil: "Cível",
  falencia: "Falência e Recuperação Judicial",
  especial: "Especial (Cível e Criminal)",
  inventario: "Inventário / Arrolamento",
  insolvencia: "Insolvência",
  interdicao: "Interdição / Curatela",
};
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
  cnib: {
    appliesTo: ["cpf", "cnpj"],
    documentTypes: ["cpf", "cnpj"],
    automatic: true,
    badge: "DaaS",
    note: "Consulta BigDataCorp por CPF/CNPJ quando BIGDATACORP_CNIB_ENABLED e tokens estiverem configurados.",
  },
  imoveis_onr: {
    appliesTo: ["cpf", "cnpj"],
    documentTypes: ["cpf", "cnpj"],
    automatic: false,
    badge: "ONR",
    note: "Pesquisa oficial pelo RI Digital, com importacao de protocolo e resultado sem scraping.",
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
  tjdft: "Tribunais estaduais",
  fgts: "FGTS/CEF",
  cnib: "Indisponibilidade de bens",
  imoveis_onr: "Busca de imoveis / ONR",
};

const pageMeta = {
  chat: {
    title: "Audita IA",
    eyebrow: "Intelig\u00eancia jur\u00eddica conversacional",
  },
  home: {
    title: "Audita",
    eyebrow: "Plataforma de certidões inteligentes",
  },
  consultas: {
    title: "Assistente de Consultas",
    eyebrow: "Certidões e documentações oficiais",
  },
  "consulta-tjdft": {
    title: "Certid\u00f5es estaduais",
    eyebrow: "Assistente de Consultas",
  },
  "consulta-tjdft-pf": {
    title: "Certid\u00f5es estaduais",
    eyebrow: "Assistente de Consultas",
  },
  "consulta-tjdft-pj": {
    title: "Certid\u00f5es estaduais",
    eyebrow: "Assistente de Consultas",
  },
  "consulta-cnib": {
    title: "Indisponibilidade de bens",
    eyebrow: "Assistente de Consultas",
  },
  "consulta-imoveis": {
    title: "Busca de im\u00f3veis",
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
  if (pageMeta[hash]) {
    return hash;
  }
  return window.location.pathname.replace(/\/$/, "") === "/chat" ? "chat" : "home";
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
    const linkedPage = link.dataset.appRoute || (link.getAttribute("href") || "").replace("#", "");
    const groupedPages = (link.dataset.navPages || "").split(/\s+/).filter(Boolean);
    link.classList.toggle("active", linkedPage === activePage || groupedPages.includes(activePage));
  });

  applyAuditRouteDefaults(activePage);
  document.body.classList.remove("menu-open");
  mobileMenuButton?.setAttribute("aria-expanded", "false");
  if (activePage === "chat") {
    renderChatWorkspace();
    requestAnimationFrame(() => chatInput?.focus());
  }
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

function getAuditDocumentValidationError(documentState = syncAuditPrimaryDocument()) {
  const cpfDigits = String(documentState.cpfValue || "").replace(/\D/g, "");
  const cnpjDigits = String(documentState.cnpjValue || "").replace(/\D/g, "");
  if (documentState.needsCpf && cpfDigits.length !== 11) {
    return {
      field: auditCpfDocument,
      message: cpfDigits.length ? "Informe um CPF com 11 digitos." : "Informe o CPF antes de consultar.",
    };
  }
  if (documentState.needsCnpj && cnpjDigits.length !== 14) {
    return {
      field: auditCnpjDocument,
      message: cnpjDigits.length ? "Informe um CNPJ com 14 digitos." : "Informe o CNPJ antes de consultar.",
    };
  }
  return null;
}

function getTjdftPersonType() {
  const routeDocumentType = auditRouteDocumentType[getActivePage()];
  return routeDocumentType === "cnpj" ? "pj" : "pf";
}

function getSelectedStateCourtUf() {
  return tjdftCourtUf?.value || stateCourtUf?.value || "DF";
}

function getSelectedStateCourt() {
  const selectedUf = getSelectedStateCourtUf();
  return stateCourtDirectory.find((court) => court.uf === selectedUf) || stateCourtDirectory.find((court) => court.uf === "DF");
}

function clearAuditResultPreview() {
  auditResultStatus.textContent = "Aguardando";
  auditSummary.innerHTML = `<p class="empty-state">Informe CPF/CNPJ e escolha o que deseja visualizar.</p>`;
  auditSourceList.innerHTML = "";
  stopAllAssistedRemoteAutoRefresh();
  assistedRemoteSessions.clear();
  stateCourtAgentSessions.clear();
  renderDocumentAiPanel(null, []);
}

function getStateCourtStateName(court) {
  return court?.stateName || court?.name || "";
}

function isStateCourtActive(court) {
  if (court?.automationStatus === "blocked") {
    return false;
  }
  return Boolean(
    court?.automatic ||
      court?.automationStatus === "active" ||
      court?.automationStatus === "agent_assisted" ||
      (court?.automationStatus === "mapped" && court?.captchaMode === "assisted"),
  );
}

function getStateCourtAutomationLabel(court) {
  if (!court) {
    return "manual";
  }
  if (court.automationStatus === "blocked") {
    return court.blocker === "cloudflare" ? "bloqueado por Cloudflare" : "bloqueado";
  }
  if (court.automationStatus === "agent_assisted") {
    return "agente assistido";
  }
  if ((court.automatic || court.automationStatus === "active") && court.captchaMode === "none") {
    return "automático";
  }
  if (isStateCourtActive(court)) {
    return "automático assistido";
  }
  return court.captchaMode === "assisted" ? "assistido" : "manual";
}

function usesLegacyTjdftAdapter(court) {
  return court?.platform === "tjdft" || court?.uf === "DF";
}

function formatStateCourtFieldLabel(fieldId) {
  return stateCourtFieldLabels[fieldId] || fieldId;
}

function formatStateCourtCertificateLabel(certificateId) {
  return stateCourtCertificateLabels[certificateId] || certificateId;
}

async function loadStateCourtCatalog() {
  try {
    const response = await fetch(`/data/state-courts.json?v=${Date.now()}`, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    if (Array.isArray(data.profiles) && data.profiles.length) {
      stateCourtDirectory = data.profiles;
    }
  } catch {
    // Keep the embedded fallback directory when the catalog cannot be loaded.
  }
}

function stateCourtOptionsHtml() {
  return stateCourtDirectory
    .map((court) => `<option value="${escapeHtml(court.uf)}">${escapeHtml(court.uf)} - ${escapeHtml(court.court)} (${escapeHtml(getStateCourtStateName(court))})</option>`)
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
  const automationLabel = getStateCourtAutomationLabel(selectedCourt);
  if (stateCourtHint && selectedCourt) {
    stateCourtHint.textContent = selectedCourt.automationStatus === "blocked"
      ? `${selectedCourt.court} está ${automationLabel}.`
      : isStateCourtActive(selectedCourt)
      ? `${selectedCourt.court} está em modo ${automationLabel}.`
      : `${selectedCourt.court} está em modo ${selectedCourt.captchaMode === "assisted" ? "assistido" : "portal oficial"}.`;
  }
  renderStateCourtAssistPanel(selectedCourt);
  renderStateCourtDynamicFields();
  updateTjdftPersonFields();
}

function shouldShowStateCourtAssistPanel(court) {
  if (!court || usesLegacyTjdftAdapter(court)) {
    return false;
  }
  if (court.remoteAssisted) {
    return false;
  }
  return court.frameMode === "new_tab" || ["cloudflare", "azion"].includes(court.blocker || "");
}

function renderStateCourtAssistPanel(court = getSelectedStateCourt()) {
  if (!stateCourtAssistPanel) {
    return;
  }
  if (!shouldShowStateCourtAssistPanel(court)) {
    stateCourtAssistPanel.classList.add("hidden");
    stateCourtAssistPanel.innerHTML = "";
    return;
  }
  const title = `Portal oficial ${court.court}`;
  const url = court.url || "";
  const blocker = court.blocker || "";
  const requiresExternal = court.frameMode === "new_tab" || ["cloudflare", "azion"].includes(blocker);
  stateCourtAssistPanel.classList.remove("hidden");
  stateCourtAssistPanel.innerHTML = requiresExternal
    ? `
      <section class="assisted-portal-frame assisted-portal-frame--external">
        <div class="assisted-portal-head">
          <div>
            <strong>Validação antes da consulta</strong>
            <small>Este portal usa proteção ${escapeHtml(blocker || "anti-bot")} e deve abrir como página principal. Abra em nova aba para confirmar a verificação antes de enviar a consulta.</small>
          </div>
          <a class="audit-official-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Abrir em nova aba</a>
        </div>
        <div class="assisted-portal-placeholder">
          <strong>${escapeHtml(title)}</strong>
          <span>Por segurança do tribunal, esta verificação não aparece dentro de iframe. Depois de confirmar, volte ao Audita e continue a consulta.</span>
        </div>
      </section>
    `
    : `
      <section class="assisted-portal-frame assisted-portal-frame--external">
        <div class="assisted-portal-head">
          <div>
            <strong>Validação após o preenchimento</strong>
            <small>O Audita vai preencher o portal oficial depois que você criar a consulta. Se aparecer reCAPTCHA/captcha, uma sessão oficial já preenchida ficará aberta para confirmação.</small>
          </div>
          <a class="audit-official-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Abrir em nova aba</a>
        </div>
        <div class="assisted-portal-placeholder">
          <strong>${escapeHtml(title)}</strong>
          <span>Preencha os campos abaixo e crie a consulta. A validação humana aparece somente quando o portal chegar nessa etapa.</span>
        </div>
      </section>
    `;
}

function getStateCourtDynamicFieldIds(court = getSelectedStateCourt()) {
  if (!court || usesLegacyTjdftAdapter(court)) {
    return [];
  }
  const fields = [...(court.requiredFields || []), ...(court.optionalFields || [])];
  return [...new Set(fields)].filter((field) => field !== "document");
}

function maskStateCourtPhone(value, field) {
  const limit = field === "mobile" ? 11 : 10;
  const digits = String(value || "").replace(/\D/g, "").slice(0, limit);
  if (digits.length <= 2) {
    return digits ? `(${digits}` : "";
  }
  if (field === "mobile") {
    if (digits.length <= 7) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
}

function applyStateCourtFieldMask(input) {
  const field = input?.dataset?.stateCourtField;
  if (field === "phone" || field === "mobile") {
    input.value = maskStateCourtPhone(input.value, field);
  }
}

function renderStateCourtDynamicInput(field, required) {
  const label = formatStateCourtFieldLabel(field);
  const options = stateCourtFieldOptions[field];
  const requiredText = required ? "Obrigatório" : "Opcional";
  const requiredAttr = required ? "required" : "";
  if (Array.isArray(options)) {
    return `
      <label class="state-court-field ${required ? "is-required" : "is-optional"}">
        <span>
          ${escapeHtml(label)}
          <small>${requiredText}</small>
        </span>
        <select data-state-court-field="${escapeHtml(field)}" ${requiredAttr}>
          ${options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </label>
    `;
  }
  const type = field === "email" ? "email" : field === "birthDate" ? "date" : "text";
  const phoneAttrs =
    field === "phone"
      ? ` inputmode="numeric" maxlength="14" placeholder="(DD) 0000-0000"`
      : field === "mobile"
        ? ` inputmode="numeric" maxlength="15" placeholder="(DD) 00000-0000"`
        : "";
  return `
    <label class="state-court-field ${required ? "is-required" : "is-optional"}">
      <span>
        ${escapeHtml(label)}
        <small>${requiredText}</small>
      </span>
      <input data-state-court-field="${escapeHtml(field)}" type="${type}" autocomplete="off"${phoneAttrs} ${requiredAttr} />
    </label>
  `;
}

function renderStateCourtDynamicFields() {
  if (!stateCourtDynamicFields) {
    return;
  }
  const selectedCourt = getSelectedStateCourt();
  const fields = getStateCourtDynamicFieldIds(selectedCourt);
  if (!fields.length) {
    stateCourtDynamicFields.innerHTML = "";
    stateCourtDynamicFields.classList.add("hidden");
    return;
  }

  const required = new Set(selectedCourt.requiredFields || []);
  const requiredFields = fields.filter((field) => required.has(field));
  const optionalFields = fields.filter((field) => !required.has(field));
  stateCourtDynamicFields.classList.remove("hidden");
  stateCourtDynamicFields.innerHTML = `
    <fieldset class="state-court-profile-fields">
      <legend>Campos</legend>
      ${
        requiredFields.length
          ? `<div class="state-court-field-group">
              <strong>Obrigatórios</strong>
              <div class="state-court-field-grid">
                ${requiredFields.map((field) => renderStateCourtDynamicInput(field, true)).join("")}
              </div>
            </div>`
          : ""
      }
      ${
        optionalFields.length
          ? `<div class="state-court-field-group">
              <strong>Opcionais</strong>
              <div class="state-court-field-grid">
                ${optionalFields.map((field) => renderStateCourtDynamicInput(field, false)).join("")}
              </div>
            </div>`
          : ""
      }
    </fieldset>
  `;
  restoreAuditFormDraft();
}

function getStateCourtFieldsPayload() {
  const fields = {};
  stateCourtDynamicFields?.querySelectorAll("[data-state-court-field]").forEach((input) => {
    fields[input.dataset.stateCourtField] = input.value || "";
  });
  return fields;
}

function readAuditFormDraft() {
  try {
    return JSON.parse(localStorage.getItem(auditDraftStorageKey) || "{}");
  } catch {
    return {};
  }
}

function writeAuditFormDraft(draft) {
  try {
    localStorage.setItem(auditDraftStorageKey, JSON.stringify(draft));
  } catch {
    // Local storage can be disabled; the form still works without drafts.
  }
}

function saveAuditFormDraft() {
  const selectedUf = getSelectedStateCourtUf();
  const draft = readAuditFormDraft();
  draft.primary = {
    cpf: auditCpfDocument?.value || "",
    cnpj: auditCnpjDocument?.value || "",
  };
  draft.stateCourtUf = selectedUf;
  draft.stateCourts = draft.stateCourts || {};
  draft.stateCourts[selectedUf] = {
    fields: getStateCourtFieldsPayload(),
  };
  writeAuditFormDraft(draft);
}

function restoreAuditFormDraft() {
  const draft = readAuditFormDraft();
  if (draft.primary?.cpf && auditCpfDocument && !auditCpfDocument.value) {
    auditCpfDocument.value = draft.primary.cpf;
  }
  if (draft.primary?.cnpj && auditCnpjDocument && !auditCnpjDocument.value) {
    auditCnpjDocument.value = draft.primary.cnpj;
  }
  const selectedUf = getSelectedStateCourtUf();
  const directFields = draft.stateCourts?.[selectedUf]?.fields || {};
  const fallbackFields =
    Object.values(draft.stateCourts || {})
      .map((item) => item?.fields || {})
      .find((item) => Object.values(item).some(Boolean)) || {};
  stateCourtDynamicFields?.querySelectorAll("[data-state-court-field]").forEach((input) => {
    const value = directFields[input.dataset.stateCourtField] || fallbackFields[input.dataset.stateCourtField];
    if (value && !input.value) {
      input.value = value;
    }
    applyStateCourtFieldMask(input);
  });
  syncAuditPrimaryDocument();
}

function getStateCourtCertificateTypesPayload() {
  const selectedCourt = getSelectedStateCourt();
  if (!selectedCourt || usesLegacyTjdftAdapter(selectedCourt)) {
    return [...tjdftCertificateTypeInputs].filter((input) => input.checked).map((input) => input.value);
  }
  const available = Array.isArray(selectedCourt.certificateTypes) ? selectedCourt.certificateTypes : [];
  return available.length ? available : ["civil", "criminal"];
}

function updateTjdftPersonFields() {
  const isTjdftSelected = selectedAuditViews.includes("tjdft");
  const personType = getTjdftPersonType();
  const isPf = personType === "pf";
  const selectedCourt = getSelectedStateCourt();
  const useTjdftAdapter = usesLegacyTjdftAdapter(selectedCourt);
  tjdftPersonTypeLabel.textContent = isPf ? "Pessoa f\u00edsica" : "Pessoa jur\u00eddica";
  tjdftCertificateOptions?.classList.toggle("hidden", !useTjdftAdapter);
  tjdftPfFields.forEach((field) => field.classList.toggle("hidden", !useTjdftAdapter || !isPf));
  tjdftPjFields.forEach((field) => field.classList.toggle("hidden", !useTjdftAdapter || isPf));
  [auditFirstName, auditMotherName, auditFatherName].forEach((input) => {
    if (input) {
      input.required = isTjdftSelected && useTjdftAdapter && isPf;
      if (!isTjdftSelected || !useTjdftAdapter || !isPf) {
        input.value = "";
      }
    }
  });
  if (tjdftCompanyName) {
    tjdftCompanyName.required = false;
    if (!isTjdftSelected || !useTjdftAdapter || isPf) {
      tjdftCompanyName.value = "";
    }
  }
  const hasSelectedCertificate = [...tjdftCertificateTypeInputs].some((input) => input.checked);
  tjdftCertificateTypeInputs.forEach((input) => {
    if (isTjdftSelected && useTjdftAdapter && !hasSelectedCertificate) {
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
    const documentState = syncAuditPrimaryDocument();
    const { needsCpf, needsCnpj } = getAuditDocumentRequirements();
    const requiredFields = [auditAuthorization];
    if (needsCpf) {
      requiredFields.push(auditCpfDocument);
    }
    if (needsCnpj) {
      requiredFields.push(auditCnpjDocument);
    }
    if (selectedAuditViews.includes("tjdft")) {
      const selectedCourt = getSelectedStateCourt();
      if (usesLegacyTjdftAdapter(selectedCourt)) {
        const selectedTjdftCertificates = [...tjdftCertificateTypeInputs].filter((input) => input.checked);
        if (!selectedTjdftCertificates.length) {
          auditError.textContent = "Selecione pelo menos uma certidao estadual.";
          return false;
        }
        if (getTjdftPersonType() === "pf") {
          requiredFields.push(auditFirstName, auditMotherName, auditFatherName);
        }
      } else {
        requiredFields.push(...[...(stateCourtDynamicFields?.querySelectorAll("[data-state-court-field][required]") || [])]);
      }
    }    if (selectedAuditViews.includes("trf1")) {
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
    const documentValidationError = getAuditDocumentValidationError(documentState);
    if (documentValidationError) {
      auditError.textContent = documentValidationError.message;
      documentValidationError.field?.focus();
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
    agent_assisted: "Agente assistido",
    waiting_user_action: "Aguardando acao",
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

const chatStorageKey = "audita.chat.threads.v1";
let chatSending = false;
let chatSendingThreadId = "";

function createChatId() {
  return globalThis.crypto?.randomUUID?.() || `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createChatThread() {
  const now = new Date().toISOString();
  return {
    id: createChatId(),
    title: "Nova conversa",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function loadChatState() {
  try {
    const stored = JSON.parse(localStorage.getItem(chatStorageKey) || "{}");
    const threads = Array.isArray(stored.threads)
      ? stored.threads
          .filter((thread) => thread?.id && Array.isArray(thread.messages))
          .slice(0, 16)
          .map((thread) => ({ ...thread, messages: thread.messages.slice(-50) }))
      : [];
    if (!threads.length) {
      const initialThread = createChatThread();
      return { currentThreadId: initialThread.id, threads: [initialThread] };
    }
    const currentThreadId = threads.some((thread) => thread.id === stored.currentThreadId)
      ? stored.currentThreadId
      : threads[0].id;
    return { currentThreadId, threads };
  } catch {
    const initialThread = createChatThread();
    return { currentThreadId: initialThread.id, threads: [initialThread] };
  }
}

let chatState = loadChatState();

function saveChatState() {
  try {
    const threads = [...chatState.threads]
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
      .slice(0, 16);
    threads.forEach((thread) => {
      thread.messages = thread.messages.slice(-50);
    });
    chatState = { ...chatState, threads };
    localStorage.setItem(chatStorageKey, JSON.stringify(chatState));
  } catch {
    // The conversation remains available for the current page even if storage is blocked.
  }
}

function getCurrentChatThread() {
  return chatState.threads.find((thread) => thread.id === chatState.currentThreadId) || chatState.threads[0];
}

function formatChatText(value) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br />");
}

function renderChatActions(actions) {
  const availableActions = Array.isArray(actions)
    ? actions.filter((action) => action?.route && String(action.route).startsWith("/"))
    : [];
  if (!availableActions.length) return "";

  return `
    <div class="chat-message-actions">
      ${availableActions
        .map(
          (action) => `
            <article>
              <div>
                <strong>${escapeHtml(action.title || "Continuar no Audita")}</strong>
                <small>${escapeHtml(action.description || "Abra o modulo para continuar com seguranca.")}</small>
              </div>
              <button type="button" data-chat-route="${escapeHtml(action.route)}">${escapeHtml(action.label || "Abrir")}</button>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderChatSources(sources) {
  const availableSources = Array.isArray(sources)
    ? sources.filter((source) => source?.url && /^https:\/\//.test(String(source.url)))
    : [];
  if (!availableSources.length) return "";
  return `
    <div class="chat-message-sources">
      ${availableSources
        .map(
          (source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.name || "Fonte consultada")}</a>`,
        )
        .join("")}
    </div>
  `;
}

function renderChatThreads() {
  if (!chatThreadList) return;
  const threads = [...chatState.threads].sort((a, b) =>
    String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")),
  );
  chatThreadList.innerHTML = threads
    .map(
      (thread) => `
        <div class="chat-thread-item ${thread.id === chatState.currentThreadId ? "active" : ""}">
          <button type="button" data-chat-thread="${escapeHtml(thread.id)}" title="${escapeHtml(thread.title)}">
            <span>${escapeHtml(thread.title)}</span>
          </button>
          <button class="chat-thread-delete" type="button" data-chat-delete="${escapeHtml(thread.id)}" aria-label="Excluir conversa" title="Excluir conversa">&times;</button>
        </div>
      `,
    )
    .join("");
}

function renderChatMessages() {
  if (!chatMessages || !chatEmptyState) return;
  const thread = getCurrentChatThread();
  const messages = Array.isArray(thread?.messages) ? thread.messages : [];
  chatEmptyState.classList.toggle("hidden", messages.length > 0);
  chatMessages.querySelectorAll(".chat-message-row").forEach((element) => element.remove());

  const messageHtml = messages
    .map(
      (message) => `
        <article class="chat-message-row ${message.role === "user" ? "user" : "assistant"}">
          ${
            message.role === "assistant"
              ? `<span class="chat-message-avatar"><img src="assets/audita-logo-white.svg" alt="" /></span>`
              : ""
          }
          <div class="chat-message-content">
            ${message.role === "assistant" ? "<strong>Audita IA</strong>" : ""}
            <div class="chat-message-body">${formatChatText(message.content)}</div>
            ${renderChatActions(message.actions)}
            ${renderChatSources(message.sources)}
          </div>
        </article>
      `,
    )
    .join("");
  chatMessages.insertAdjacentHTML("beforeend", messageHtml);

  if (chatSending && chatSendingThreadId === thread?.id) {
    chatMessages.insertAdjacentHTML(
      "beforeend",
      `
        <article class="chat-message-row assistant chat-message-loading">
          <span class="chat-message-avatar"><img src="assets/audita-logo-white.svg" alt="" /></span>
          <div class="chat-message-content">
            <strong>Audita IA</strong>
            <div class="chat-thinking" aria-label="Analisando"><i></i><i></i><i></i></div>
          </div>
        </article>
      `,
    );
  }

  requestAnimationFrame(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

function renderChatWorkspace() {
  renderChatThreads();
  renderChatMessages();
}

function setChatError(message = "") {
  if (!chatError) return;
  chatError.textContent = message;
  chatError.classList.toggle("hidden", !message);
}

function startNewChat() {
  const blankThread = chatState.threads.find((thread) => thread.messages.length === 0);
  const thread = blankThread || createChatThread();
  if (!blankThread) chatState.threads.unshift(thread);
  chatState.currentThreadId = thread.id;
  saveChatState();
  setChatError();
  renderChatWorkspace();
  chatInput?.focus();
}

function resizeChatInput() {
  if (!chatInput) return;
  chatInput.style.height = "auto";
  chatInput.style.height = `${Math.min(chatInput.scrollHeight, 176)}px`;
}

async function sendChatMessage(rawMessage) {
  const content = String(rawMessage || "").trim();
  if (!content || chatSending) return;

  const thread = getCurrentChatThread();
  if (!thread) return;
  const now = new Date().toISOString();
  thread.messages.push({ id: createChatId(), role: "user", content, createdAt: now });
  if (thread.title === "Nova conversa") {
    thread.title = content.length > 46 ? `${content.slice(0, 43)}...` : content;
  }
  thread.updatedAt = now;
  chatSending = true;
  chatSendingThreadId = thread.id;
  if (chatSendButton) chatSendButton.disabled = true;
  setChatError();
  saveChatState();
  renderChatWorkspace();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        messages: thread.messages.map(({ role, content: messageContent }) => ({ role, content: messageContent })),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      showLogin("Entre para conversar com a Audita IA.");
      return;
    }
    if (!response.ok) {
      const errorMessages = {
        openai_not_configured: "A conexao com a IA ainda nao esta configurada neste ambiente.",
        chat_timeout: "A analise demorou mais que o esperado. Tente novamente em instantes.",
      };
      setChatError(errorMessages[data.error] || "Nao foi possivel concluir esta resposta agora.");
      return;
    }

    thread.messages.push({
      id: createChatId(),
      role: "assistant",
      content: data.answer || "Nao consegui concluir a resposta.",
      actions: Array.isArray(data.actions) ? data.actions : [],
      sources: Array.isArray(data.sources) ? data.sources : [],
      createdAt: new Date().toISOString(),
    });
    thread.updatedAt = new Date().toISOString();
  } catch {
    setChatError("Falha de comunicacao com a Audita IA. Verifique sua conexao e tente novamente.");
  } finally {
    chatSending = false;
    chatSendingThreadId = "";
    if (chatSendButton) chatSendButton.disabled = false;
    saveChatState();
    renderChatWorkspace();
    chatInput?.focus();
  }
}

chatForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const content = chatInput?.value || "";
  if (chatInput) chatInput.value = "";
  resizeChatInput();
  sendChatMessage(content);
});

chatInput?.addEventListener("input", resizeChatInput);
chatInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm?.requestSubmit();
  }
});

chatSuggestionButtons.forEach((button) => {
  button.addEventListener("click", () => sendChatMessage(button.dataset.chatPrompt || ""));
});

chatNewButton?.addEventListener("click", startNewChat);
chatMobileNewButton?.addEventListener("click", startNewChat);

chatToolsButton?.addEventListener("click", () => {
  const expanded = chatToolsButton.getAttribute("aria-expanded") === "true";
  chatToolsButton.setAttribute("aria-expanded", String(!expanded));
  chatToolsPanel?.classList.toggle("hidden", expanded);
});

document.addEventListener("click", (event) => {
  if (!chatToolsPanel || chatToolsPanel.classList.contains("hidden")) return;
  if (chatToolsPanel.contains(event.target) || chatToolsButton?.contains(event.target)) return;
  chatToolsPanel.classList.add("hidden");
  chatToolsButton?.setAttribute("aria-expanded", "false");
});

chatThreadList?.addEventListener("click", (event) => {
  const threadButton = event.target.closest("[data-chat-thread]");
  const deleteButton = event.target.closest("[data-chat-delete]");
  if (deleteButton) {
    const threadId = deleteButton.dataset.chatDelete;
    chatState.threads = chatState.threads.filter((thread) => thread.id !== threadId);
    if (!chatState.threads.length) chatState.threads.push(createChatThread());
    if (!chatState.threads.some((thread) => thread.id === chatState.currentThreadId)) {
      chatState.currentThreadId = chatState.threads[0].id;
    }
    saveChatState();
    renderChatWorkspace();
    return;
  }
  if (threadButton) {
    chatState.currentThreadId = threadButton.dataset.chatThread;
    saveChatState();
    setChatError();
    renderChatWorkspace();
  }
});

chatMessages?.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-chat-route]");
  const route = actionButton?.dataset.chatRoute || "";
  if (route.startsWith("/")) window.location.assign(route);
});

renderChatWorkspace();

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
  stopAllAssistedRemoteAutoRefresh();
  if (!audit) {
    auditResultStatus.textContent = "Aguardando";
    auditSummary.innerHTML = `<p class="empty-state">Informe CPF/CNPJ e escolha o que deseja visualizar.</p>`;
    auditSourceList.innerHTML = "";
    assistedRemoteSessions.clear();
    renderDocumentAiPanel(null, []);
    return;
  }

  const contractMode = Array.isArray(audit.resultados);
  const executions = contractMode
    ? audit.resultados.map((result) => ({
        id: result.fonte,
        sourceId: result.fonte,
        sourceName:
          result.fonte === "tjdft" && result.dados?.tribunal
            ? `${result.dados.tribunal} / Certidões`
            : formatAuditSourceName(result.fonte),
        category: "audit",
        mode: "collector",
        status: result.status,
        resultado: result.resultado,
        summary: result.erro || result.dados?.resumo || summarizeAuditResult(result),
        officialUrl: result.dados?.officialUrl || getAuditOfficialUrl(result.fonte),
        data: result.dados || {},
        rawText: result.rawText || "",
        missingFields: [],
        evidence: [...buildAuditEvidence(result), ...(Array.isArray(result.evidence) ? result.evidence : [])],
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
      <span><strong>${visibleExecutions.filter((item) => ["manual_required", "waiting_user_action", "blocked"].includes(item.status)).length}</strong><small>pendentes</small></span>
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
          ${renderAssistedPortalFrame(execution)}
          ${renderAuditEvidenceForm(audit, execution)}
          ${
            missingFields.length
              ? `<small class="audit-warning">Campos pendentes: ${escapeHtml(missingFields.map(formatAuditFieldLabel).join(", "))}</small>`
              : ""
          }
          ${["pending", "running"].includes(execution.status) ? `<div class="audit-loading" aria-label="Consulta em andamento"><span></span><span></span><span></span><small>Consultando fonte...</small></div>` : ""}
          ${
            normalizedEvidence.length
              ? `<div class="audit-evidence-list">${normalizedEvidence
                  .map((item) => {
                    const evidenceHref = item.href || evidenceDownloadHref(item);
                    return `
                      <span>
                        <strong>${escapeHtml(item.title || formatStatusLabel(item.type))}</strong>
                        ${item.value ? `<small>${escapeHtml(item.value)}</small>` : ""}
                        ${evidenceHref ? `<a href="${escapeHtml(evidenceHref)}" target="_blank" rel="noreferrer">Abrir PDF</a>` : ""}
                      </span>
                    `;
                  })
                  .join("")}</div>`
              : ""
          }
        </article>
      `;
    })
    .join("");
  renderDocumentAiPanel(audit, visibleExecutions);
  hydrateAssistedRemoteBrowsers();
}

function renderAuditEvidenceForm(audit, execution) {
  const pending = ["manual_required", "waiting_user_action", "blocked"].includes(execution?.status);
  if (!pending) {
    return "";
  }
  const auditId = audit?.consultaId || audit?.id || "";
  const executionId = execution?.id || execution?.sourceId || "";
  if (!auditId || !executionId) {
    return "";
  }
  const isAssistedRemote = Boolean(execution?.data?.assistedSession && execution.data.assistedSession !== "external_browser");
  const form = `
    <div class="audit-evidence-form" data-audit-id="${escapeHtml(auditId)}" data-execution-id="${escapeHtml(executionId)}">
      <label>
        Evidência
        <select name="evidenceType">
          <option value="pdf">PDF da certidão</option>
          <option value="official_url">Link oficial</option>
          <option value="protocol">Protocolo</option>
          <option value="summary">Resultado textual</option>
          <option value="manual_step">Checkpoint oficial</option>
        </select>
      </label>
      <label>
        Título
        <input name="title" type="text" value="Certidão emitida" required />
      </label>
      <label>
        Protocolo ou resumo
        <input name="value" type="text" placeholder="Ex: nada consta, protocolo, observação" />
      </label>
      <label>
        Arquivo
        <input name="file" type="file" accept="application/pdf,image/*" />
      </label>
      <input name="generatedFileName" type="hidden" value="" />
      <input name="generatedContentBase64" type="hidden" value="" />
      <button class="primary-action" type="button" data-evidence-submit>Trazer para o Audita</button>
    </div>
  `;
  if (!isAssistedRemote) {
    return form;
  }
  return `
    <details class="audit-evidence-disclosure">
      <summary>Adicionar PDF, protocolo ou resultado manualmente</summary>
      ${form}
    </details>
  `;
}

function renderAssistedCheckpointPanel(execution) {
  const data = execution?.data || {};
  const certificates = Array.isArray(data.certidoes) ? data.certidoes : [];
  const lab = data.captchaLab || {};
  const checkpoints = Array.isArray(lab.checkpoints) ? lab.checkpoints : [];
  const requiresRecaptcha = Boolean(
    lab.reachedCaptcha ||
      data.requiresRecaptcha ||
      data.requiresCaptcha ||
      certificates.some((certificate) => certificate.requiresRecaptcha || certificate.requiresCaptcha),
  );
  const blockedByProtection = Boolean(
    lab.reachedAntiBot ||
      data.blockedByProtection ||
      certificates.some((certificate) => certificate.blockedByProtection || certificate.requiresCloudflare),
  );
  const needsConfirmation = Boolean(
    lab.reachedConfirmation ||
      data.requiresConfirmation ||
      certificates.some((certificate) => certificate.requiresConfirmation),
  );
  const firstCheckpoint = blockedByProtection
    ? "anti_bot_block"
    : requiresRecaptcha
      ? "captcha_or_recaptcha"
      : needsConfirmation
        ? "official_confirmation"
        : checkpoints[0] || certificates.find((certificate) => certificate.humanCheckpoint)?.humanCheckpoint || "";
  if (!firstCheckpoint && !requiresRecaptcha && !blockedByProtection && !needsConfirmation) {
    return "";
  }

  const checkpointLabels = {
    anti_bot_block: "Protecao anti-bot",
    captcha_or_recaptcha: "reCAPTCHA/CAPTCHA oficial",
    login_or_certificate: "Login ou certificado",
    official_confirmation: "Confirmacao oficial",
    manual_review: "Revisao manual",
  };
  const filledFields = Array.isArray(lab.filledFields) ? lab.filledFields : [];
  const actionText = requiresRecaptcha
    ? "Dados preenchidos. Envie no portal e conclua a validação oficial quando ela aparecer."
    : blockedByProtection
      ? "Proteção oficial detectada. Conclua a verificação na tela do portal."
      : "Revise a tela oficial e conclua a etapa solicitada pelo tribunal.";

  return `
    <div class="assisted-checkpoint-panel">
      <span>${escapeHtml(checkpointLabels[firstCheckpoint] || "Validação oficial")}</span>
      <p>${escapeHtml(actionText)}</p>
      <div>
        <small>${filledFields.length ? `${filledFields.length} campos reconhecidos` : "Campos tratados"}</small>
        <small>${data.sessionOpen === false ? "Sessão externa" : "Sessão incorporada"}</small>
      </div>
    </div>
  `;
}

function renderAssistedOutcomePanel(outcome) {
  if (!outcome || !["request_registered", "portal_error", "captcha_pending"].includes(outcome.status)) {
    return "";
  }
  if (outcome.status === "captcha_pending") {
    return `
      <div class="assisted-checkpoint-panel">
        <span>Validação oficial pendente</span>
        <p>Conclua a validação humana no portal. Depois use Inspecionar resultado.</p>
        <div>
          <small>Validação humana</small>
          <small>Sem PDF/protocolo ainda</small>
        </div>
      </div>
    `;
  }
  if (outcome.status === "portal_error") {
    return `
      <div class="assisted-checkpoint-panel assisted-portal-error">
        <span>Erro oficial do portal</span>
        <p>O tribunal retornou falha oficial. Tente recuperar o portal ou repetir mais tarde.</p>
        <div>
          <small>Portal respondeu erro</small>
          <small>Sem protocolo/PDF</small>
        </div>
      </div>
    `;
  }
  const protocolText = outcome.protocol ? ` Protocolo/pedido: ${outcome.protocol}.` : "";
  return `
    <div class="assisted-checkpoint-panel assisted-request-registered">
      <span>Pedido registrado no tribunal</span>
      <p>${escapeHtml(`Pedido cadastrado com sucesso.${protocolText} O tribunal informa prazo e instruções por e-mail.`)}</p>
      <div>
        <small>Fluxo funcionando</small>
        <small>Aguardar e-mail</small>
      </div>
    </div>
  `;
}

function renderStateCourtAgentPanel(agentSessionId, initial = {}) {
  if (!agentSessionId) {
    return "";
  }
  const cached = stateCourtAgentSessions.get(agentSessionId) || {
    id: agentSessionId,
    status: initial.agentStatus || "ready",
    messages: initial.agentMessages || [],
    nextAction: initial.agentNextAction || "",
  };
  const messages = Array.isArray(cached.messages) ? cached.messages.slice(-8) : [];
  const statusLabels = {
    ready: "Pronto",
    running: "Executando",
    waiting_user_action: "Aguardando acao humana",
    waiting_user_input: "Aguardando dado",
    blocked: "Bloqueado",
    completed: "Concluido",
    stopped: "Parado",
  };
  return `
    <div class="state-court-agent-panel" data-state-court-agent-session="${escapeHtml(agentSessionId)}">
      <div class="state-court-agent-head">
        <div>
          <strong>Agente navegador</strong>
          <small data-state-court-agent-status>${escapeHtml(statusLabels[cached.status] || cached.status || "Pronto")}</small>
        </div>
        <div class="state-court-agent-actions">
          <button class="secondary-action" type="button" data-state-court-agent-action="continue">Devolver ao agente</button>
          <button class="secondary-action" type="button" data-state-court-agent-action="stop">Parar agente</button>
        </div>
      </div>
      <div class="state-court-agent-messages" data-state-court-agent-messages>
        ${
          messages.length
            ? messages.map((message) => `<p><strong>${escapeHtml(message.role || "agente")}:</strong> ${escapeHtml(message.content || "")}</p>`).join("")
            : "<p>Agente aguardando inicio.</p>"
        }
      </div>
      <div class="state-court-agent-chat">
        <input type="text" name="stateCourtAgentMessage" autocomplete="off" placeholder="Responder ao agente ou informar dado faltante" />
        <button class="primary-action" type="button" data-state-court-agent-action="message">Enviar ao agente</button>
      </div>
      <small data-state-court-agent-next>${escapeHtml(cached.nextAction || "Revise a tela oficial e devolva ao agente quando desejar.")}</small>
    </div>
  `;
}

function renderAssistedPortalFrame(execution) {
  const url = execution?.data?.validationFrameUrl || execution?.data?.assistedPortalUrl || execution?.officialUrl || "";
  const needsUserAction = ["manual_required", "waiting_user_action", "blocked"].includes(execution?.status);
  if (!url || !needsUserAction) {
    return "";
  }
  const title = execution?.data?.tribunal
    ? `Portal oficial ${execution.data.tribunal}`
    : `Portal oficial ${execution.sourceName || "da fonte"}`;
  const frameMode = execution?.data?.frameMode || "";
  const blocker = execution?.data?.blocker || "";
  const assistedSession = execution?.data?.assistedSession || "";
  const sessionOpen = execution?.data?.sessionOpen;
  if (assistedSession && assistedSession !== "external_browser" && sessionOpen !== false) {
    const cachedSession = assistedRemoteSessions.get(assistedSession);
    const cachedScreenshot = cachedSession?.screenshot || "";
    const cachedStatus = cachedSession?.title || cachedSession?.url || "";
    const cachedFormState = cachedSession?.formState;
    const agentSessionId = execution?.data?.agentSession || "";
    const activeOutcome = cachedSession?.outcome;
    const shouldShowCheckpoint = !activeOutcome || !["request_registered", "portal_error", "captcha_pending"].includes(activeOutcome.status);
    return `
      <section class="assisted-remote-browser" data-assisted-session="${escapeHtml(assistedSession)}">
        <div class="assisted-portal-head">
          <div>
            <strong>Navegador remoto assistido</strong>
            <small>Portal oficial aberto pelo Audita. Conclua a validação humana quando aparecer.</small>
          </div>
          <div class="assisted-remote-actions">
            <button class="primary-action" type="button" data-assisted-action="submit">Enviar no portal</button>
            <button class="secondary-action" type="button" data-assisted-action="inspect">Inspecionar resultado</button>
            <details class="assisted-more-actions">
              <summary>Mais opções</summary>
              <div>
                <button class="secondary-action assisted-refresh" type="button" data-assisted-action="refresh">Atualizar tela</button>
                <button class="secondary-action" type="button" data-assisted-action="recover">Recuperar portal</button>
                <button class="secondary-action assisted-close" type="button" data-assisted-action="close">Fechar sessão</button>
              </div>
            </details>
          </div>
        </div>
        <div class="assisted-remote-meta">
          <span>${escapeHtml(execution?.data?.tribunal || execution?.sourceName || "")}</span>
          ${execution?.data?.tribunal === "TJSP" ? "<span>reCAPTCHA no canto inferior direito</span>" : ""}
          <span data-assisted-form-state>${cachedFormState?.filledCount ? `${escapeHtml(String(cachedFormState.filledCount))} campos preenchidos` : "Lendo campos"}</span>
        </div>
        ${renderStateCourtAgentPanel(agentSessionId, execution?.data || {})}
        <div data-assisted-outcome>${renderAssistedOutcomePanel(activeOutcome)}</div>
        <div data-assisted-checkpoint>${shouldShowCheckpoint ? renderAssistedCheckpointPanel(execution) : ""}</div>
        <button class="assisted-remote-screen" type="button" data-assisted-action="click" aria-label="Tela remota do portal oficial">
          <span>${escapeHtml(cachedStatus || "Carregando tela remota...")}</span>
          <img alt="Tela remota do portal oficial" draggable="false" ${cachedScreenshot ? `src="${escapeHtml(cachedScreenshot)}" data-remote-screenshot="${escapeHtml(cachedScreenshot)}"` : ""} />
        </button>
        <div class="assisted-result-inspection hidden" data-assisted-result></div>
        <details class="assisted-manual-controls">
          <summary>Controles manuais</summary>
          <div class="assisted-remote-type">
            <input name="remoteText" type="text" autocomplete="off" placeholder="Texto para o campo focado ou CAPTCHA" />
            <button class="primary-action" type="button" data-assisted-send-text>Enviar texto</button>
          </div>
          <div class="assisted-remote-keys">
            <button class="secondary-action" type="button" data-assisted-key="Enter">Enter</button>
            <button class="secondary-action" type="button" data-assisted-key="Tab">Tab</button>
            <button class="secondary-action" type="button" data-assisted-key="Backspace">Backspace</button>
            <button class="secondary-action" type="button" data-assisted-scroll="-520">Rolar acima</button>
            <button class="secondary-action" type="button" data-assisted-scroll="520">Rolar abaixo</button>
          </div>
          <small>Clique na tela do portal para focar campos. O teclado é enviado para a sessão remota.</small>
        </details>
      </section>
    `;
  }

  if (assistedSession || frameMode === "new_tab" || ["cloudflare", "azion"].includes(blocker)) {
    return `
      <div class="audit-result-action">
        <small class="audit-warning">${
          assistedSession
            ? escapeHtml(sessionOpen === false
              ? "A sessão oficial não ficou aberta neste ambiente. Use o portal oficial ou reexecute com navegador assistido habilitado."
              : "O portal foi preenchido em uma sessão oficial aberta. Resolva a validação nessa janela e traga o PDF/protocolo para o Audita.")
            : "Validação protegida tratada em janela oficial."
        }</small>
      </div>
    `;
  }
  return `
    <section class="assisted-portal-frame" data-portal-url="${escapeHtml(url)}">
      <div class="assisted-portal-head">
        <div>
          <strong>Validação no portal oficial</strong>
          <small>Resolva reCAPTCHA, captcha, login ou confirmação diretamente na página oficial quando aparecer.</small>
        </div>
        <a class="audit-official-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Abrir em nova aba</a>
      </div>
      <iframe
        title="${escapeHtml(title)}"
        src="${escapeHtml(url)}"
        loading="lazy"
        referrerpolicy="no-referrer"
      ></iframe>
      <small class="audit-warning">Se o tribunal bloquear iframe, use "Abrir em nova aba". Alguns portais impedem incorporação por segurança.</small>
    </section>
  `;
}

function hydrateAssistedRemoteBrowsers() {
  document.querySelectorAll("[data-assisted-session]").forEach((element) => {
    loadAssistedRemoteSession(element.dataset.assistedSession, { force: true });
    startAssistedRemoteAutoRefresh(element.dataset.assistedSession);
  });
  document.querySelectorAll("[data-state-court-agent-session]").forEach((element) => {
    loadStateCourtAgentSession(element.dataset.stateCourtAgentSession, { force: true });
    startStateCourtAgentAutoRefresh(element.dataset.stateCourtAgentSession);
  });
}

function stopStateCourtAgentAutoRefresh(sessionId) {
  const timer = stateCourtAgentRefreshTimers.get(sessionId);
  if (timer) {
    window.clearInterval(timer);
    stateCourtAgentRefreshTimers.delete(sessionId);
  }
}

function stopAssistedRemoteAutoRefresh(sessionId) {
  const timer = assistedRemoteRefreshTimers.get(sessionId);
  if (timer) {
    window.clearInterval(timer);
    assistedRemoteRefreshTimers.delete(sessionId);
  }
}

function stopAllAssistedRemoteAutoRefresh() {
  assistedRemoteRefreshTimers.forEach((timer) => window.clearInterval(timer));
  assistedRemoteRefreshTimers.clear();
  stateCourtAgentRefreshTimers.forEach((timer) => window.clearInterval(timer));
  stateCourtAgentRefreshTimers.clear();
  assistedRemoteTypeTimers.forEach((timer) => window.clearTimeout(timer));
  assistedRemoteTypeTimers.clear();
  assistedRemoteTypeBuffers.clear();
}

function startStateCourtAgentAutoRefresh(sessionId) {
  if (!sessionId || stateCourtAgentRefreshTimers.has(sessionId)) {
    return;
  }
  const timer = window.setInterval(() => {
    const panel = document.querySelector(`[data-state-court-agent-session="${CSS.escape(sessionId)}"]`);
    if (!panel) {
      stopStateCourtAgentAutoRefresh(sessionId);
      return;
    }
    loadStateCourtAgentSession(sessionId, { force: true });
  }, 2500);
  stateCourtAgentRefreshTimers.set(sessionId, timer);
}

function startAssistedRemoteAutoRefresh(sessionId) {
  if (!sessionId || assistedRemoteRefreshTimers.has(sessionId)) {
    return;
  }
  const timer = window.setInterval(() => {
    const panel = document.querySelector(`[data-assisted-session="${CSS.escape(sessionId)}"]`);
    const cached = assistedRemoteSessions.get(sessionId);
    if (!panel || panel.classList.contains("assisted-remote-closed") || cached?.closed) {
      stopAssistedRemoteAutoRefresh(sessionId);
      return;
    }
    loadAssistedRemoteSession(sessionId, { force: true, silent: true });
  }, 2500);
  assistedRemoteRefreshTimers.set(sessionId, timer);
}

function setAssistedRemoteImage(image, screenshot) {
  if (!image || !screenshot || image.dataset.remoteScreenshot === screenshot) {
    return;
  }
  const preload = new Image();
  preload.onload = () => {
    image.src = screenshot;
    image.dataset.remoteScreenshot = screenshot;
    image.classList.remove("hidden");
  };
  preload.src = screenshot;
}

async function loadAssistedRemoteSession(sessionId, { force = false, silent = false } = {}) {
  if (!sessionId) return;
  const panel = document.querySelector(`[data-assisted-session="${CSS.escape(sessionId)}"]`);
  if (!panel) return;
  const screen = panel.querySelector(".assisted-remote-screen");
  const image = panel.querySelector("img");
  const status = screen?.querySelector("span");
  const cached = assistedRemoteSessions.get(sessionId);
  if (!force && cached?.loading) {
    return;
  }
  assistedRemoteSessions.set(sessionId, { ...(cached || {}), loading: true });
  if (status && !cached?.screenshot && !silent) status.textContent = "Atualizando tela remota...";

  try {
    const response = await fetch(`/api/assisted-sessions/${encodeURIComponent(sessionId)}`, {
      headers: { accept: "application/json" },
    });
    if (response.status === 401) {
      showLogin("Entre para controlar a sessao assistida.");
      return;
    }
    if (response.status === 404) {
      updateAssistedRemotePanel(sessionId, { id: sessionId, closed: true });
      return;
    }
    if (!response.ok) {
      if (status) status.textContent = "Sessao remota indisponivel.";
      return;
    }
    const data = await response.json();
    updateAssistedRemotePanel(sessionId, data.session);
  } catch {
    if (status) status.textContent = "Falha ao carregar tela remota.";
    assistedRemoteSessions.set(sessionId, { ...(cached || {}), loading: false });
  }
}

function updateAssistedRemotePanel(sessionId, session) {
  const panel = document.querySelector(`[data-assisted-session="${CSS.escape(sessionId)}"]`);
  if (!panel) return;
  const previousSession = assistedRemoteSessions.get(sessionId) || {};
  const screen = panel.querySelector(".assisted-remote-screen");
  const image = panel.querySelector("img");
  const status = screen?.querySelector("span");
  const formState = panel.querySelector("[data-assisted-form-state]");
  const outcomeTarget = panel.querySelector("[data-assisted-outcome]");
  const checkpointTarget = panel.querySelector("[data-assisted-checkpoint]");
  const mergedSession = { ...previousSession, ...(session || {}), loading: false };
  assistedRemoteSessions.set(sessionId, mergedSession);

  if (session?.closed) {
    if (status) status.textContent = "Sessao fechada.";
    if (image && !image.src) image.removeAttribute("src");
    panel.classList.add("assisted-remote-closed");
    stopAssistedRemoteAutoRefresh(sessionId);
    return;
  }

  panel.classList.remove("assisted-remote-closed");
  if (image && session?.screenshot) {
    setAssistedRemoteImage(image, session.screenshot);
  }
  if (status) {
    status.textContent = session?.title || session?.url || "Tela remota pronta.";
  }
  if (formState && session?.formState) {
    formState.textContent = session.formState.filledCount
      ? `${session.formState.filledCount} campos preenchidos`
      : "Nenhum campo preenchido detectado";
  }
  if (outcomeTarget) {
    outcomeTarget.innerHTML = renderAssistedOutcomePanel(session?.outcome);
  }
  if (checkpointTarget && ["request_registered", "portal_error"].includes(session?.outcome?.status)) {
    checkpointTarget.innerHTML = "";
  }
  if (
    ["result_available", "request_registered"].includes(session?.outcome?.status) &&
    !mergedSession.autoInspectionAttempted &&
    !mergedSession.autoAttachedPdf
  ) {
    assistedRemoteSessions.set(sessionId, { ...mergedSession, autoInspectionAttempted: true });
    window.setTimeout(() => inspectAssistedRemoteResult(sessionId), 250);
  }
}

async function loadStateCourtAgentSession(sessionId, { force = false } = {}) {
  if (!sessionId) return;
  const cached = stateCourtAgentSessions.get(sessionId);
  if (!force && cached?.loading) return;
  stateCourtAgentSessions.set(sessionId, { ...(cached || {}), loading: true });
  try {
    const response = await fetch(`/api/state-court-agent-sessions/${encodeURIComponent(sessionId)}`, {
      headers: { accept: "application/json" },
    });
    if (response.status === 401) {
      showLogin("Entre para acompanhar o agente.");
      return;
    }
    if (!response.ok) {
      updateStateCourtAgentPanel(sessionId, { id: sessionId, status: "blocked", messages: [{ role: "system", content: "Sessao do agente indisponivel." }] });
      return;
    }
    const data = await response.json();
    updateStateCourtAgentPanel(sessionId, data.session);
  } catch {
    updateStateCourtAgentPanel(sessionId, { id: sessionId, status: "blocked", messages: [{ role: "system", content: "Falha ao consultar agente." }] });
  }
}

function updateStateCourtAgentPanel(sessionId, session) {
  const panel = document.querySelector(`[data-state-court-agent-session="${CSS.escape(sessionId)}"]`);
  const merged = { ...(stateCourtAgentSessions.get(sessionId) || {}), ...(session || {}), loading: false };
  stateCourtAgentSessions.set(sessionId, merged);
  if (!panel) return;
  const status = panel.querySelector("[data-state-court-agent-status]");
  const messagesTarget = panel.querySelector("[data-state-court-agent-messages]");
  const nextTarget = panel.querySelector("[data-state-court-agent-next]");
  const statusLabels = {
    ready: "Pronto",
    running: "Executando",
    waiting_user_action: "Aguardando acao humana",
    waiting_user_input: "Aguardando dado",
    blocked: "Bloqueado",
    completed: "Concluido",
    stopped: "Parado",
  };
  if (status) status.textContent = statusLabels[merged.status] || merged.status || "Pronto";
  if (messagesTarget) {
    const messages = Array.isArray(merged.messages) ? merged.messages.slice(-8) : [];
    messagesTarget.innerHTML = messages.length
      ? messages.map((message) => `<p><strong>${escapeHtml(message.role || "agente")}:</strong> ${escapeHtml(message.content || "")}</p>`).join("")
      : "<p>Agente aguardando inicio.</p>";
  }
  if (nextTarget) {
    nextTarget.textContent = merged.nextAction || "Revise a tela oficial e devolva ao agente quando desejar.";
  }
  if (["waiting_user_action", "waiting_user_input", "blocked", "completed", "stopped"].includes(merged.status)) {
    stopStateCourtAgentAutoRefresh(sessionId);
  }
}

async function sendStateCourtAgentAction(sessionId, action) {
  if (!sessionId) return;
  updateStateCourtAgentPanel(sessionId, {
    ...(stateCourtAgentSessions.get(sessionId) || {}),
    status: action.type === "stop" ? "stopped" : "running",
  });
  try {
    const response = await fetch(`/api/state-court-agent-sessions/${encodeURIComponent(sessionId)}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(action),
    });
    if (response.status === 401) {
      showLogin("Entre para controlar o agente.");
      return;
    }
    if (!response.ok) {
      updateStateCourtAgentPanel(sessionId, {
        id: sessionId,
        status: "blocked",
        messages: [{ role: "system", content: "Comando do agente nao executado." }],
      });
      return;
    }
    const data = await response.json();
    updateStateCourtAgentPanel(sessionId, data.session);
    if (["continue", "message"].includes(action.type)) {
      startStateCourtAgentAutoRefresh(sessionId);
    }
    const assistedSession = data.session?.assistedSession;
    if (assistedSession) {
      await loadAssistedRemoteSession(assistedSession, { force: true, silent: true });
    }
  } catch {
    updateStateCourtAgentPanel(sessionId, {
      id: sessionId,
      status: "blocked",
      messages: [{ role: "system", content: "Falha ao comunicar com o agente." }],
    });
  }
}

async function sendAssistedRemoteAction(sessionId, action) {
  if (!sessionId) return;
  const panel = document.querySelector(`[data-assisted-session="${CSS.escape(sessionId)}"]`);
  const status = panel?.querySelector(".assisted-remote-screen span");
  const cached = assistedRemoteSessions.get(sessionId);
  if (status && !cached?.screenshot) status.textContent = "Enviando comando...";
  try {
    const response = await fetch(`/api/assisted-sessions/${encodeURIComponent(sessionId)}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(action),
    });
    if (response.status === 401) {
      showLogin("Entre para controlar a sessao assistida.");
      return;
    }
    if (!response.ok) {
      if (status) {
        status.textContent =
          action.type === "submit"
            ? "Botao oficial nao encontrado."
            : action.type === "recover"
              ? "Nao foi possivel recuperar o portal."
              : "Comando nao executado.";
      }
      return;
    }
    const data = await response.json();
    updateAssistedRemotePanel(sessionId, data.session);
  } catch {
    if (status) status.textContent = "Falha ao enviar comando.";
  }
}

function setActiveAssistedRemotePanel(panel) {
  document.querySelectorAll("[data-assisted-session].is-keyboard-active").forEach((element) => {
    if (element !== panel) element.classList.remove("is-keyboard-active");
  });
  panel?.classList.add("is-keyboard-active");
}

function getActiveAssistedRemotePanel(target) {
  return target?.closest?.("[data-assisted-session]") || document.querySelector("[data-assisted-session].is-keyboard-active");
}

function getAssistedRemotePoint(button, event) {
  const image = button?.querySelector("img");
  const sessionId = button?.closest("[data-assisted-session]")?.dataset.assistedSession || "";
  const viewport = (assistedRemoteSessions.get(sessionId) || {}).viewport || {};
  if (!image?.src || !viewport.width || !viewport.height) return null;
  const rect = image.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(viewport.width, Math.round(((event.clientX - rect.left) / rect.width) * viewport.width))),
    y: Math.max(0, Math.min(viewport.height, Math.round(((event.clientY - rect.top) / rect.height) * viewport.height))),
  };
}

function queueAssistedRemoteTyping(sessionId, text) {
  const value = String(text || "");
  if (!sessionId || !value) return;
  const previous = assistedRemoteTypeBuffers.get(sessionId) || "";
  assistedRemoteTypeBuffers.set(sessionId, `${previous}${value}`);
  const existingTimer = assistedRemoteTypeTimers.get(sessionId);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }
  const timer = window.setTimeout(async () => {
    const buffered = assistedRemoteTypeBuffers.get(sessionId) || "";
    assistedRemoteTypeBuffers.delete(sessionId);
    assistedRemoteTypeTimers.delete(sessionId);
    if (buffered) {
      await sendAssistedRemoteAction(sessionId, { type: "type", text: buffered });
    }
  }, 180);
  assistedRemoteTypeTimers.set(sessionId, timer);
}

async function flushAssistedRemoteTyping(sessionId) {
  const existingTimer = assistedRemoteTypeTimers.get(sessionId);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
    assistedRemoteTypeTimers.delete(sessionId);
  }
  const buffered = assistedRemoteTypeBuffers.get(sessionId) || "";
  assistedRemoteTypeBuffers.delete(sessionId);
  if (buffered) {
    await sendAssistedRemoteAction(sessionId, { type: "type", text: buffered });
  }
}

async function sendAssistedRemoteTextFromControl(control) {
  const remotePanel = control?.closest("[data-assisted-session]");
  const input = remotePanel?.querySelector("input[name='remoteText']");
  const text = input?.value || "";
  if (!remotePanel?.dataset.assistedSession || !text.trim()) {
    return;
  }
  input.value = "";
  await sendAssistedRemoteAction(remotePanel.dataset.assistedSession, { type: "type", text });
}

function renderAssistedInspection(result) {
  const labels = {
    result_available: "Resultado encontrado",
    request_registered: "Pedido registrado",
    captcha_pending: "Validação pendente",
    portal_error: "Erro no portal",
    no_result_yet: "Sem resultado ainda",
  };
  const pdfLinks = Array.isArray(result?.pdfLinks) ? result.pdfLinks : [];
  return `
    <strong>${escapeHtml(labels[result?.status] || "Inspecao concluida")}</strong>
    ${result?.status === "request_registered" ? `<p>Solicitacao cadastrada. A certidao nao foi emitida na hora; acompanhe pelo e-mail informado pelo cliente.</p>` : ""}
    ${result?.status === "portal_error" ? `<p>O portal oficial retornou erro apos a validacao. Registre como instabilidade e tente novamente mais tarde.</p>` : ""}
    ${result?.protocol ? `<p>Protocolo: ${escapeHtml(result.protocol)}</p>` : ""}
    ${result?.textSample ? `<small>${escapeHtml(result.textSample)}</small>` : ""}
    ${result?.pdfDownloaded ? `<small>${result?.pdfGeneratedFromPage ? "PDF gerado a partir da tela oficial e pronto para anexar." : "PDF oficial baixado e pronto para anexar."}</small>` : ""}
    ${result?.pdfDownloadError ? `<small>PDF localizado, mas o download automatico falhou: ${escapeHtml(result.pdfDownloadError)}</small>` : ""}
    ${
      pdfLinks.length
        ? `<div class="assisted-result-links">${pdfLinks
            .map((link) => `<a href="${escapeHtml(link.href)}" target="_blank" rel="noreferrer">${escapeHtml(link.text || "Abrir PDF")}</a>`)
            .join("")}</div>`
        : ""
    }
    ${result?.evidenceScreenshot ? `<small>Captura da tela oficial pronta para anexar.</small>` : ""}
    ${["result_available", "request_registered"].includes(result?.status) || result?.pdfDownloaded || result?.evidenceScreenshot ? `<button class="secondary-action" type="button" data-assisted-action="use-inspection">Usar como evidencia</button>` : ""}
  `;
}

async function inspectAssistedRemoteResult(sessionId) {
  if (!sessionId) return;
  const panel = document.querySelector(`[data-assisted-session="${CSS.escape(sessionId)}"]`);
  const target = panel?.querySelector("[data-assisted-result]");
  if (!target) return;
  target.classList.remove("hidden");
  target.innerHTML = `<span>Inspecionando pagina oficial...</span>`;
  try {
    const response = await fetch(`/api/assisted-sessions/${encodeURIComponent(sessionId)}/result`, {
      headers: { accept: "application/json" },
    });
    if (response.status === 401) {
      showLogin("Entre para inspecionar a sessao assistida.");
      return;
    }
    if (!response.ok) {
      target.innerHTML = `<span>Nao foi possivel inspecionar a sessao agora.</span>`;
      return;
    }
    const data = await response.json();
    const cached = assistedRemoteSessions.get(sessionId) || {};
    const updatedSession = { ...cached, inspection: data.result };
    assistedRemoteSessions.set(sessionId, updatedSession);
    target.innerHTML = renderAssistedInspection(data.result);
    if (data.result?.pdfDownloaded && !updatedSession.autoAttachedPdf) {
      const attached = await useAssistedInspectionAsEvidence(sessionId, { autoSubmit: true });
      if (attached) {
        assistedRemoteSessions.set(sessionId, { ...updatedSession, autoAttachedPdf: true });
      }
    }
  } catch {
    target.innerHTML = `<span>Falha ao inspecionar a sessao.</span>`;
  }
}

async function useAssistedInspectionAsEvidence(sessionId, { autoSubmit = false } = {}) {
  const panel = document.querySelector(`[data-assisted-session="${CSS.escape(sessionId)}"]`);
  const form = panel?.closest(".audit-source-item")?.querySelector(".audit-evidence-form");
  const inspection = assistedRemoteSessions.get(sessionId)?.inspection;
  if (!form || !inspection) return false;
  const evidenceTypeField = getAuditEvidenceField(form, "evidenceType");
  const titleField = getAuditEvidenceField(form, "title");
  const valueField = getAuditEvidenceField(form, "value");
  const generatedFileNameField = getAuditEvidenceField(form, "generatedFileName");
  const generatedContentBase64Field = getAuditEvidenceField(form, "generatedContentBase64");
  if (!evidenceTypeField || !titleField || !valueField) return false;
  const firstPdf = Array.isArray(inspection.pdfLinks) ? inspection.pdfLinks[0] : null;
  const downloadedPdf = Boolean(inspection.pdfDownloaded && inspection.pdfContentBase64);
  const pending = inspection.status === "captcha_pending";
  const requestRegistered = inspection.status === "request_registered";
  const evidenceType = downloadedPdf ? "pdf" : firstPdf ? "official_url" : inspection.protocol || requestRegistered ? "protocol" : pending ? "manual_step" : "summary";
  evidenceTypeField.value = evidenceType;
  titleField.value = downloadedPdf
    ? "PDF da certidao baixado"
    : firstPdf
    ? "PDF da certidao localizado"
    : requestRegistered
      ? "Pedido cadastrado no tribunal"
    : inspection.protocol
      ? "Protocolo localizado"
      : pending
        ? "Checkpoint de validacao oficial"
        : "Resultado inspecionado";
  valueField.value = downloadedPdf
    ? inspection.pdfRawText || inspection.textSample || "PDF oficial baixado da sessao assistida."
    : firstPdf?.href ||
      (requestRegistered
        ? `${inspection.protocol ? `Pedido ${inspection.protocol}. ` : ""}Solicitacao cadastrada; certidao aguardando liberacao/envio por e-mail.`
        : inspection.protocol || (pending ? "Validacao oficial pendente na sessao assistida." : inspection.textSample || ""));
  if (generatedFileNameField && generatedContentBase64Field) {
    if (downloadedPdf) {
      generatedFileNameField.value = inspection.pdfFileName || "certidao-assistida.pdf";
      generatedContentBase64Field.value = inspection.pdfContentBase64;
    } else if (inspection.evidenceScreenshot) {
      generatedFileNameField.value = inspection.evidenceFileName || "audita-sessao-assistida.jpg";
      generatedContentBase64Field.value = String(inspection.evidenceScreenshot).split(",")[1] || "";
    }
  }
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  valueField.focus();
  if (autoSubmit && downloadedPdf) {
    return submitAuditEvidenceForm(form, { silent: true });
  }
  return true;
}

function getAuditEvidenceField(form, name) {
  return form?.elements?.[name] || form?.querySelector?.(`[name="${CSS.escape(name)}"]`) || null;
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
  if (!hasGeneratedDocumentEvidence(tjdftExecution)) {
    return null;
  }
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
    return certificates
      .filter((certificate) => hasCertificateDocumentEvidence(certificate))
      .map((certificate) => ({
        tipo: certificate.tipo || "Certidão estadual",
        status: certificate.pdfPath || certificate.pdfDownloaded ? "PDF baixado" : certificate.errorMessage || "texto disponível",
        rawText: certificate.rawText || certificate.pageText || "",
      }));
  }
  return (execution.evidence || [])
    .filter((item) => item.type === "pdf")
    .map((item) => ({
      tipo: item.title || "Certidão estadual",
      status: item.value || "PDF disponível",
      rawText: "",
    }));
}

function hasGeneratedDocumentEvidence(execution) {
  const data = execution?.data || {};
  if (execution?.pdfPath || data.pdfPath || data.pdfDownloaded) {
    return true;
  }
  const certificates = Array.isArray(data.certidoes) ? data.certidoes : [];
  if (certificates.some((certificate) => hasCertificateDocumentEvidence(certificate))) {
    return true;
  }
  return Array.isArray(execution?.evidence) && execution.evidence.some((item) => item.type === "pdf" && (item.href || item.contentBase64 || item.value));
}

function hasCertificateDocumentEvidence(certificate) {
  if (!certificate) {
    return false;
  }
  if (certificate.pdfPath || certificate.pdfDownloaded) {
    return true;
  }
  return false;
  const text = `${certificate.rawText || ""} ${certificate.pageText || ""}`;
  return /certid[aã]o\s+(negativa|positiva)|nada\s+consta|dados da certid[aã]o|n[°º]?\s*da certid[aã]o|pedido\s+(cadastrado|registrado)/i.test(text);
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
    const isOfficialPortalMode = dados.modo === "portal_oficial";
    const certificates = Array.isArray(dados.certidoes) ? dados.certidoes : [];
    const downloadedCertificates = certificates.filter((certificate) => certificate.pdfPath || certificate.pdfDownloaded);
    const evidencePdfs = Array.isArray(result.evidence)
      ? result.evidence.filter((item) => item?.type === "pdf" && (item.href || item.contentBase64 || item.value))
      : [];
    const totalCertificates = certificates.length || dados.totalCertidoes || 4;
    const items = [
      {
        type: "summary",
        title: "Certid?es",
        value: isOfficialPortalMode
          ? `${totalCertificates} certid?es no portal oficial`
          : evidencePdfs.length && !downloadedCertificates.length
            ? `${evidencePdfs.length} PDF anexado como evidência`
          : `${downloadedCertificates.length}/${totalCertificates} PDFs baixados`,
      },
    ];

    items.push(
      ...certificates.map((certificate) => ({
        type: "pdf",
        title: certificate.tipo || "Certidão",
        value: isOfficialPortalMode
          ? "Emitir no portal oficial"
          : certificate.pdfPath || certificate.pdfDownloaded
            ? "PDF baixado"
            : certificate.errorMessage || "PDF não disponível",
        href: toPdfPublicUrl(certificate.pdfPath) || certificate.downloadUrl,
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

function evidenceDownloadHref(item) {
  const contentBase64 = String(item?.contentBase64 || "").trim();
  if (!contentBase64 || item?.type !== "pdf") {
    return "";
  }
  return `data:application/pdf;base64,${contentBase64}`;
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
    cnib: "https://docs.bigdatacorp.com.br/plataforma/reference/marketplace-dados-restritivos-quod-pessoa",
  };
  return urls[sourceId] || "";
}

function formatAuditSourceName(sourceId) {
  const names = {
    receita_federal: "Receita Federal / CNPJ",
    pgfn: "PGFN / Certidão Conjunta",
    cndt: "CNDT / TST",
    trf1: "TRF1/CJF / Certidão Unificada",
    tjdft: "Tribunal estadual / Certid?es",
    fgts: "CEF / Regularidade FGTS",
    portal_transparencia: "Portal da Transparência / CGU",
    cnib: "Indisponibilidade de bens / BigDataCorp",
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

function getResumeAuditId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("audit") || params.get("consultaId") || "";
}

function hasOpenAssistedUserAction(audit) {
  return (audit?.resultados || []).some((result) => {
    const data = result?.dados || {};
    return (
      result?.status === "waiting_user_action" &&
      data.assistedSession &&
      data.assistedSession !== "external_browser" &&
      data.sessionOpen !== false
    );
  });
}

async function loadAuditResult(consultaId, attempts = 180) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(`/audit/${consultaId}`, { headers: { accept: "application/json" } });
    if (!response.ok) {
      return;
    }
    const audit = await response.json();
    renderAudit(audit);
    if (hasOpenAssistedUserAction(audit)) {
      auditResultStatus.textContent = "Aguardando ação";
      await loadAuditHistory();
      return;
    }
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

function validateCnibDocument(tipoDocumento, value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (tipoDocumento === "cpf") {
    return digits.length === 11 && !/^(\d)\1+$/.test(digits);
  }
  return digits.length === 14 && !/^(\d)\1+$/.test(digits);
}

function getCnibStatusView(result) {
  if (!result) {
    return { label: "Aguardando", className: "pending", description: "Consulta ainda nao iniciada." };
  }
  if (["pending", "running"].includes(result.status)) {
    return { label: "Consultando", className: "running", description: "Consulta em andamento na BigDataCorp." };
  }
  if (result.status === "unavailable") {
    return { label: "Indisponivel", className: "unavailable", description: result.erro || "Configuracao do provedor pendente." };
  }
  if (result.status === "failed" || result.resultado === "erro") {
    return { label: "Erro", className: "failed", description: result.erro || "Falha ao consultar o provedor." };
  }
  if (result.resultado === "consta") {
    return { label: "Ocorrencia encontrada", className: "failed", description: "Ha indicador de indisponibilidade de bens para o documento consultado." };
  }
  if (result.resultado === "nada_consta") {
    return { label: "Nada encontrado", className: "success", description: "Nao foi retornado indicador de indisponibilidade de bens." };
  }
  return { label: "Indisponivel", className: "unavailable", description: "Resposta sem conclusao automatica." };
}

function renderCnibResult(audit) {
  if (!cnibResult) {
    return;
  }
  const result = (audit?.resultados || []).find((item) => item.fonte === "cnib");
  const data = result?.dados || {};
  const status = getCnibStatusView(result);
  const naturezas = Array.isArray(data.naturezaCodes) ? data.naturezaCodes : [];
  const ocorrencias = Array.isArray(data.ocorrencias) ? data.ocorrencias : [];
  if (cnibStatusLabel) {
    cnibStatusLabel.textContent = status.label;
  }

  cnibResult.innerHTML = `
    <div class="cnib-result-card ${escapeHtml(status.className)}">
      <div class="cnib-result-head">
        <div>
          <small>Status</small>
          <strong>${escapeHtml(status.label)}</strong>
        </div>
        <span class="module-status ${escapeHtml(result?.status || "pending")}">${escapeHtml(formatStatusLabel(result?.status || "pending"))}</span>
      </div>
      <p>${escapeHtml(status.description)}</p>
      <div class="cnib-result-grid">
        <span><strong>${escapeHtml((audit?.tipoDocumento || audit?.documentType || "").toUpperCase())}</strong><small>${escapeHtml(audit?.documento || audit?.documentMasked || "***")}</small></span>
        <span><strong>${escapeHtml(audit?.scoreRisco?.nivel || "indefinido")}</strong><small>Nivel de risco</small></span>
        <span><strong>${escapeHtml(data.provider || "BigDataCorp")}</strong><small>Provedor</small></span>
        <span><strong>${escapeHtml(formatDateTime(result?.finishedAt || audit?.updatedAt || audit?.createdAt || ""))}</strong><small>Atualizacao</small></span>
      </div>
      ${
        naturezas.length
          ? `<div class="cnib-nature-list"><strong>Naturezas encontradas</strong>${naturezas.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
          : ""
      }
      ${
        ocorrencias.length
          ? `<div class="cnib-occurrences">${ocorrencias
              .map(
                (item) => `
                  <span>
                    <strong>${escapeHtml(item.natureza || "IB")}</strong>
                    <small>${escapeHtml([item.tipo, item.origem, item.data].filter(Boolean).join(" | ") || "Ocorrencia retornada pelo provedor")}</small>
                  </span>
                `,
              )
              .join("")}</div>`
          : ""
      }
      <small class="consultation-note">${escapeHtml(
        data.observacaoJuridica ||
          "Resultado via provedor de dados; validar se substitui ou complementa a certidao oficial CNIB conforme contrato/fonte habilitada.",
      )}</small>
    </div>
  `;
}

async function loadCnibResult(consultaId, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(`/audit/${consultaId}`, { headers: { accept: "application/json" } });
    if (!response.ok) {
      if (cnibError) {
        cnibError.textContent = "Nao foi possivel acompanhar a consulta CNIB.";
      }
      return;
    }
    const audit = await response.json();
    renderCnibResult(audit);
    const result = (audit?.resultados || []).find((item) => item.fonte === "cnib");
    if (result && !["pending", "running"].includes(result.status)) {
      await loadAuditHistory();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  if (cnibStatusLabel) {
    cnibStatusLabel.textContent = "Ainda processando";
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
    await loadPropertyModule();
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
  sidebarToggle.textContent = collapsed ? "\u203a" : "\u2039";
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
    documentAiAnswer.innerHTML = `<p>Execute uma consulta estadual para liberar a intelig?ncia documental.</p>`;
    return;
  }
  documentAiAnswer.innerHTML = `<p>${escapeHtml(answerDocumentQuestion(question, currentDocumentAiContext))}</p>`;
});

function getPropertyOperationConfig(operationId = propertyOperation?.value) {
  const operations = propertySearchConfig?.operations || [
    {
      id: "pesquisa_previa",
      label: "Pesquisa Prévia",
      description: "Localiza referências de matrículas por CPF/CNPJ nas bases participantes.",
      creditCost: 1,
    },
    {
      id: "pesquisa_qualificada",
      label: "Pesquisa Qualificada",
      description: "Confirma a relação atual do pesquisado com a matrícula.",
      creditCost: 2,
    },
    {
      id: "certidao_digital",
      label: "Certidão Digital",
      description: "Solicita a certidão oficial assinada digitalmente pelo cartório.",
      creditCost: 2,
    },
    {
      id: "indisponibilidade",
      label: "Indisponibilidade de Bens",
      description: "Consulta o relatório oficial de indisponibilidades judiciais.",
      creditCost: 1,
    },
  ];
  return operations.find((item) => item.id === operationId) || operations[0];
}

function getSelectedPropertyRegistryOfficeIds() {
  return propertyRegistryOfficeIds
    ? [...propertyRegistryOfficeIds.selectedOptions].map((option) => Number(option.value)).filter((value) => value > 0)
    : [];
}

function syncPropertyProviderStatus(operationId = propertyOperation?.value) {
  if (!propertyProviderStatus) return;
  const provider = propertySearchConfig?.provider;
  if (!provider) {
    propertyProviderStatus.textContent = "Verificando ONR";
    return;
  }
  if (provider.operationReadiness?.[operationId]) {
    propertyProviderStatus.textContent = provider.environment === "production" ? "ONR produção conectado" : "ONR homologação conectado";
    return;
  }
  propertyProviderStatus.textContent = provider.mode === "official_manual" ? "Credenciamento ONR pendente" : "Credenciais ONR incompletas";
}

async function loadPropertyRegistryOffices(preferredIds = []) {
  const operation = propertyOperation?.value || "";
  const uf = propertyUf?.value || "";
  if (!propertyRegistryOfficeIds || !["pesquisa_qualificada", "certidao_digital"].includes(operation)) return;
  if (!uf) {
    propertyRegistryOfficeIds.innerHTML = '<option value="">Selecione o estado primeiro</option>';
    return;
  }
  propertyRegistryOfficeIds.disabled = true;
  propertyRegistryOfficeIds.innerHTML = '<option value="">Carregando cartórios oficiais...</option>';
  if (propertyRegistryHelp) propertyRegistryHelp.textContent = "Consultando o diretório WSRIDIGITAL.";
  try {
    const response = await fetch(`/api/property-search/registry-offices?uf=${encodeURIComponent(uf)}&operation=${encodeURIComponent(operation)}`, {
      headers: { accept: "application/json" },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      propertyRegistryOfficeIds.innerHTML = '<option value="">Diretório indisponível até concluir o credenciamento</option>';
      if (propertyRegistryHelp) {
        propertyRegistryHelp.textContent = Array.isArray(data.missingRequirements) && data.missingRequirements.length
          ? `Pendente: ${data.missingRequirements.join(", ")}.`
          : "O ONR ainda não liberou o diretório de cartórios para este convênio.";
      }
      return;
    }
    const offices = Array.isArray(data.registryOffices) ? data.registryOffices : [];
    propertyRegistryOfficeIds.innerHTML = offices.length
      ? offices.map((office) => `<option value="${escapeHtml(String(office.id))}">${escapeHtml([office.name, office.city, office.cns ? `CNS ${office.cns}` : ""].filter(Boolean).join(" | "))}</option>`).join("")
      : '<option value="">Nenhum cartório habilitado para este serviço</option>';
    const selected = new Set(preferredIds.map(Number));
    [...propertyRegistryOfficeIds.options].forEach((option) => { option.selected = selected.has(Number(option.value)); });
    if (propertyRegistryHelp) propertyRegistryHelp.textContent = `${offices.length} cartório${offices.length === 1 ? "" : "s"} habilitado${offices.length === 1 ? "" : "s"} pelo ONR.`;
  } catch {
    propertyRegistryOfficeIds.innerHTML = '<option value="">Falha ao consultar o diretório oficial</option>';
    if (propertyRegistryHelp) propertyRegistryHelp.textContent = "Não foi possível consultar o WSRIDIGITAL agora.";
  } finally {
    propertyRegistryOfficeIds.disabled = false;
  }
}

function syncPropertyOperation() {
  if (!propertyOperation) return;
  const operation = getPropertyOperationConfig();
  const needsRegistration = operation.id === "certidao_digital";
  const showsPropertyDetails = ["pesquisa_qualificada", "certidao_digital"].includes(operation.id);
  const needsName = ["pesquisa_previa", "pesquisa_qualificada"].includes(operation.id);
  const isQualified = operation.id === "pesquisa_qualificada";
  const isCertificate = operation.id === "certidao_digital";
  const operationReady = Boolean(propertySearchConfig?.provider?.operationReadiness?.[operation.id]);
  const needsUf = operation.id !== "indisponibilidade";
  propertyUfField?.classList.toggle("hidden", !needsUf);
  if (propertyUf) propertyUf.required = needsUf;
  if (propertySubjectName) propertySubjectName.required = needsName;
  propertyRegistrationField?.classList.toggle("hidden", !needsRegistration);
  propertyRegistryField?.classList.toggle("hidden", !showsPropertyDetails);
  propertyCityField?.classList.add("hidden");
  propertyCertificatePurposeField?.classList.toggle("hidden", !isCertificate);
  propertyTransferredField?.classList.toggle("hidden", !isQualified);
  propertyTransferDateField?.classList.toggle("hidden", !isQualified || !propertyIncludeTransferred?.checked);
  if (propertyRegistryOfficeIds) {
    propertyRegistryOfficeIds.multiple = isQualified;
    propertyRegistryOfficeIds.required = showsPropertyDetails && operationReady;
    propertyRegistryOfficeIds.size = isQualified ? 5 : 1;
  }
  if (propertyRegistryLabel) propertyRegistryLabel.textContent = isQualified ? "Cartórios a consultar" : "Cartório de Registro de Imóveis";
  if (propertyCertificatePurpose) propertyCertificatePurpose.required = isCertificate && operationReady;
  if (propertyTransferDate) propertyTransferDate.required = isQualified && operationReady && Boolean(propertyIncludeTransferred?.checked);
  if (propertyRegistrationNumber) propertyRegistrationNumber.required = needsRegistration && operationReady;
  syncPropertyProviderStatus(operation.id);
  if (propertyOperationSummary) {
    propertyOperationSummary.innerHTML = `
      <strong>${escapeHtml(operation.label)}</strong>
      <span>${escapeHtml(operation.description)}</span>
      <small id="propertyCreditQuote">${escapeHtml(String(operation.creditCost || 0))} crédito${Number(operation.creditCost || 0) === 1 ? "" : "s"} após registrar o pedido ou resultado</small>
    `;
  }
  if (showsPropertyDetails) loadPropertyRegistryOffices();
}

function renderPropertyWallet(wallet) {
  if (!propertyWalletStatus) return;
  if (!wallet?.enabled) {
    propertyWalletStatus.textContent = "Créditos desativados";
    return;
  }
  propertyWalletStatus.textContent = `${Number(wallet.balance || 0)} créditos disponíveis`;
}

function propertyStatusView(search) {
  const views = {
    waiting_user_action: { label: "Aguardando pedido", className: "waiting" },
    processing: { label: "Em processamento", className: "processing" },
    completed: { label: "Concluída", className: "success" },
    failed: { label: "Falhou", className: "failed" },
    unavailable: { label: "Indisponível", className: "unavailable" },
    cancelled: { label: "Cancelada", className: "cancelled" },
  };
  return views[search?.status] || { label: "Pendente", className: "waiting" };
}

function propertyOutcomeLabel(value) {
  return {
    pending: "Resultado pendente",
    nothing_found: "Nada localizado",
    assets_found: "Imóveis localizados",
    restriction_found: "Indisponibilidade localizada",
    inconclusive: "Inconclusivo",
  }[value] || "Resultado pendente";
}

function parsePropertyAssets(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 100)
    .map((line, index) => {
      const [registrationNumber = "", registryOffice = "", city = "", uf = ""] = line.split("|").map((item) => item.trim());
      return {
        id: `imovel-${index + 1}`,
        registrationNumber,
        registryOffice,
        city,
        uf: uf.toUpperCase(),
        status: "localizado",
      };
    })
    .filter((item) => item.registrationNumber);
}

function renderPropertySearch(search) {
  if (!propertySearchResult || !search) return;
  currentPropertySearch = search;
  currentPropertySearchId = search.id;
  sessionStorage.setItem("audita:lastPropertySearchId", search.id);
  const status = propertyStatusView(search);
  const assets = Array.isArray(search.assets) ? search.assets : [];
  const evidence = Array.isArray(search.evidence) ? search.evidence : [];
  const timeline = Array.isArray(search.timeline) ? search.timeline : [];
  const canAct = ["waiting_user_action", "processing"].includes(search.status);
  const canRefreshProvider = search.providerMode === "api" && search.status === "processing";
  const canUseManualContingency = canAct && search.providerMode !== "api";
  const canQualify = search.status === "completed" && search.outcome === "assets_found" && search.operation === "pesquisa_previa";
  const resultControls = canUseManualContingency
    ? `
      <div class="property-action-zone">
        ${search.providerOrderId ? "" : `
          <form class="property-protocol-form" data-property-protocol-form>
            <label>Protocolo do pedido
              <input name="protocol" type="text" autocomplete="off" placeholder="Número informado pelo RI Digital" required />
            </label>
            <button class="secondary-action" type="submit">Registrar protocolo</button>
          </form>
        `}
        <details class="property-result-disclosure">
          <summary>Registrar resultado oficial</summary>
          <form class="property-result-form" data-property-result-form>
            <label>Resultado
              <select name="outcome" required>
                <option value="nothing_found">Nada localizado</option>
                <option value="assets_found">Imóveis localizados</option>
                <option value="restriction_found">Indisponibilidade localizada</option>
                <option value="inconclusive">Inconclusivo</option>
              </select>
            </label>
            <label class="property-assets-input hidden" data-property-assets-field>Matrículas localizadas
              <textarea name="assets" rows="3" placeholder="matrícula | cartório | município | UF&#10;uma matrícula por linha"></textarea>
            </label>
            <label>Resumo
              <textarea name="summary" rows="3" placeholder="Síntese do resultado oficial"></textarea>
            </label>
            <label>Protocolo
              <input name="protocol" type="text" value="${escapeHtml(search.providerOrderId || "")}" autocomplete="off" />
            </label>
            <label>Tipo de evidência
              <select name="evidenceType">
                <option value="onr_report">Relatório ONR</option>
                <option value="qualified_report">Pesquisa Qualificada</option>
                <option value="certificate">Certidão Digital</option>
                <option value="note">Registro textual</option>
              </select>
            </label>
            <label>Título
              <input name="evidenceTitle" type="text" value="Resultado oficial registrado" />
            </label>
            <label>Arquivo PDF
              <input name="evidenceFile" type="file" accept="application/pdf,.pdf" />
            </label>
            <button class="primary-action" type="submit">Concluir registro</button>
          </form>
        </details>
      </div>
    `
    : "";

  propertySearchResult.innerHTML = `
    <div class="property-result-head">
      <div>
        <small>${escapeHtml(search.operationLabel || "Consulta imobiliária")}</small>
        <strong>${escapeHtml(propertyOutcomeLabel(search.outcome))}</strong>
      </div>
      <span class="property-status ${escapeHtml(status.className)}">${escapeHtml(status.label)}</span>
    </div>
    <div class="property-result-meta">
      <span><small>Documento</small><strong>${escapeHtml(search.subjectMasked || "***")}</strong></span>
      <span><small>Estado</small><strong>${escapeHtml(search.uf || "Nacional")}</strong></span>
      <span><small>Provedor</small><strong>${escapeHtml(search.provider || "ONR / RI Digital")}</strong></span>
      <span><small>Créditos</small><strong>${escapeHtml(search.credit?.state === "consumed" ? String(search.credit.cost) + " consumido(s)" : "não cobrados")}</strong></span>
    </div>
    <p class="property-result-summary">${escapeHtml(search.summary || "Consulta preparada.")}</p>
    ${Array.isArray(search.missingRequirements) && search.missingRequirements.length ? `<p class="property-legal-note"><strong>Para automatizar:</strong> ${escapeHtml(search.missingRequirements.join(", "))}.</p>` : ""}
    ${search.operation === "pesquisa_previa" ? '<small class="property-legal-note">A Pesquisa Prévia aponta referências de matrícula; confirme a titularidade atual com Pesquisa Qualificada ou Certidão Digital.</small>' : ""}
    <div class="property-primary-actions">
      ${search.providerMode === "api" ? "" : `<a class="primary-action property-official-link" href="${escapeHtml(search.officialUrl || "#")}" target="_blank" rel="noreferrer">Continuar no RI Digital</a>`}
      ${canRefreshProvider ? '<button class="primary-action" type="button" data-property-refresh-provider>Atualizar no ONR</button>' : ""}
      ${canQualify ? '<button class="secondary-action" type="button" data-property-next-operation="pesquisa_qualificada">Iniciar Pesquisa Qualificada</button>' : ""}
      ${canAct ? '<button class="quiet-action" type="button" data-property-cancel>Cancelar</button>' : ""}
    </div>
    ${search.providerCosts?.total ? `<div class="property-result-meta"><span><small>Custo ONR</small><strong>${Number(search.providerCosts.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></span><span><small>Protocolo</small><strong>${escapeHtml(search.providerOrderId || "Pendente")}</strong></span></div>` : ""}
    ${assets.length ? `
      <section class="property-assets-result">
        <div class="property-section-heading"><strong>Imóveis localizados</strong><span>${assets.length}</span></div>
        <div class="property-assets-list">
          ${assets.map((asset) => `
            <article>
              <strong>Matrícula ${escapeHtml(asset.registrationNumber || "não informada")}</strong>
              <span>${escapeHtml([asset.registryOffice, asset.city, asset.uf].filter(Boolean).join(" | ") || "Dados registrais não informados")}</span>
            </article>
          `).join("")}
        </div>
      </section>
    ` : ""}
    ${evidence.length ? `
      <section class="property-evidence-list">
        <div class="property-section-heading"><strong>Evidências</strong><span>${evidence.length}</span></div>
        ${evidence.map((item) => `
          <span>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.value || item.fileName || "")}</small>
            ${item.fileUrl ? `<a href="${escapeHtml(item.fileUrl)}" target="_blank" rel="noreferrer">Abrir PDF</a>` : ""}
          </span>
        `).join("")}
      </section>
    ` : ""}
    ${timeline.length ? `
      <div class="property-timeline">
        ${timeline.map((item) => `<span><i></i><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(formatDateTime(item.at))}</small></span>`).join("")}
      </div>
    ` : ""}
    ${resultControls}
    <small class="login-error" data-property-action-error role="alert"></small>
  `;
}

function renderPropertyHistory(searches) {
  if (!propertyHistoryList) return;
  const items = Array.isArray(searches) ? searches : [];
  if (propertyHistoryCount) propertyHistoryCount.textContent = `${items.length} registro${items.length === 1 ? "" : "s"}`;
  propertyHistoryList.innerHTML = items.length
    ? items.map((search) => {
        const status = propertyStatusView(search);
        return `
          <button type="button" data-property-search-id="${escapeHtml(search.id)}">
            <span><strong>${escapeHtml(search.operationLabel)}</strong><small>${escapeHtml(search.subjectMasked)} | ${escapeHtml(search.uf || "Nacional")}</small></span>
            <span class="property-status ${escapeHtml(status.className)}">${escapeHtml(status.label)}</span>
          </button>
        `;
      }).join("")
    : '<p class="empty-state">Nenhuma busca de imóveis registrada.</p>';
}

async function loadPropertyModule() {
  if (!propertySearchForm) return;
  try {
    const [configResponse, historyResponse] = await Promise.all([
      fetch("/api/property-search/config", { headers: { accept: "application/json" } }),
      fetch("/api/property-searches", { headers: { accept: "application/json" } }),
    ]);
    if (configResponse.status === 401 || historyResponse.status === 401) return;
    if (configResponse.ok) {
      propertySearchConfig = await configResponse.json();
      renderPropertyWallet(propertySearchConfig.wallet);
      syncPropertyOperation();
    }
    if (historyResponse.ok) {
      const history = await historyResponse.json();
      renderPropertyHistory(history.searches || []);
    }
    if (currentPropertySearchId) await loadPropertySearch(currentPropertySearchId);
  } catch {
    if (propertySearchError) propertySearchError.textContent = "Não foi possível carregar o módulo de imóveis.";
  }
}

async function loadPropertySearch(id) {
  if (!id) return;
  const response = await fetch(`/api/property-searches/${encodeURIComponent(id)}`, { headers: { accept: "application/json" } });
  if (!response.ok) return;
  const data = await response.json();
  renderPropertySearch(data.search);
}

async function refreshPropertyHistory() {
  const response = await fetch("/api/property-searches", { headers: { accept: "application/json" } });
  if (!response.ok) return;
  const data = await response.json();
  renderPropertyHistory(data.searches || []);
}

async function sendPropertyAction(action, payload = {}) {
  if (!currentPropertySearchId) return null;
  const response = await fetch(`/api/property-searches/${encodeURIComponent(currentPropertySearchId)}/actions`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = propertySearchResult?.querySelector("[data-property-action-error]");
    if (error) {
      error.textContent = response.status === 402 ? "Saldo de créditos insuficiente." : "Não foi possível registrar esta etapa.";
    }
    return null;
  }
  renderPropertySearch(data.search);
  renderPropertyWallet(data.wallet);
  await refreshPropertyHistory();
  return data.search;
}

propertyOperation?.addEventListener("change", syncPropertyOperation);
propertyUf?.addEventListener("change", () => {
  if (["pesquisa_qualificada", "certidao_digital"].includes(propertyOperation?.value || "")) loadPropertyRegistryOffices();
});
propertyIncludeTransferred?.addEventListener("change", syncPropertyOperation);

propertySearchForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const tipoDocumento = propertyDocumentType?.value || "cpf";
  const documento = propertyDocument?.value || "";
  const operation = propertyOperation?.value || "pesquisa_previa";
  const operationReady = Boolean(propertySearchConfig?.provider?.operationReadiness?.[operation]);
  if (propertySearchError) propertySearchError.textContent = "";
  if (!validateCnibDocument(tipoDocumento, documento)) {
    if (propertySearchError) propertySearchError.textContent = tipoDocumento === "cpf" ? "Informe um CPF válido." : "Informe um CNPJ válido.";
    propertyDocument?.focus();
    return;
  }
  if (operation !== "indisponibilidade" && !propertyUf?.value) {
    if (propertySearchError) propertySearchError.textContent = "Selecione o estado da consulta.";
    propertyUf?.focus();
    return;
  }
  if (["pesquisa_previa", "pesquisa_qualificada"].includes(operation) && !propertySubjectName?.value.trim()) {
    if (propertySearchError) propertySearchError.textContent = "Informe o nome completo ou a razão social exigida pelo ONR.";
    propertySubjectName?.focus();
    return;
  }
  const registryOfficeIds = getSelectedPropertyRegistryOfficeIds();
  if (operationReady && ["pesquisa_qualificada", "certidao_digital"].includes(operation) && !registryOfficeIds.length) {
    if (propertySearchError) propertySearchError.textContent = "Selecione ao menos um cartório habilitado pelo ONR.";
    propertyRegistryOfficeIds?.focus();
    return;
  }
  if (operationReady && operation === "pesquisa_qualificada" && propertyIncludeTransferred?.checked && !propertyTransferDate?.value) {
    if (propertySearchError) propertySearchError.textContent = "Informe a data inicial das transferências.";
    propertyTransferDate?.focus();
    return;
  }
  if (operationReady && operation === "certidao_digital" && !propertyRegistrationNumber?.value.trim()) {
    if (propertySearchError) propertySearchError.textContent = "Informe a matrícula para solicitar a Certidão Digital.";
    propertyRegistrationNumber?.focus();
    return;
  }
  if (operationReady && operation === "certidao_digital" && !propertyCertificatePurpose?.value) {
    if (propertySearchError) propertySearchError.textContent = "Selecione a finalidade LGPD da certidão.";
    propertyCertificatePurpose?.focus();
    return;
  }
  if (!propertyAuthorization?.checked) {
    propertyAuthorization?.reportValidity();
    return;
  }

  if (propertySubmitButton) {
    propertySubmitButton.disabled = true;
    propertySubmitButton.textContent = "Preparando";
  }
  if (propertySearchResult) {
    propertySearchResult.innerHTML = '<div class="audit-loading" aria-label="Consulta em andamento"><span></span><span></span><span></span><small>Preparando solicitação oficial...</small></div>';
  }

  try {
    const response = await fetch("/api/property-searches", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        tipoDocumento,
        documento,
        subjectName: propertySubjectName?.value || "",
        uf: propertyUf?.value || "",
        operation,
        registryOfficeId: registryOfficeIds[0] || 0,
        registryOfficeIds,
        certificatePurposeId: propertyCertificatePurpose?.value || "",
        includeTransferred: Boolean(propertyIncludeTransferred?.checked),
        transferDate: propertyTransferDate?.value || "",
        registrationNumber: propertyRegistrationNumber?.value || "",
        registryOffice: propertyRegistryOfficeIds?.selectedOptions?.[0]?.textContent || "",
        city: propertyCity?.value || "",
        authorizationConfirmed: true,
      }),
    });
    if (response.status === 401) {
      showLogin("Entre para iniciar a busca de imóveis.");
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (propertySearchError) {
        const messages = {
          registration_number_required: "Informe a matrícula para solicitar a Certidão Digital.",
          uf_required: "Selecione o estado da consulta.",
          subject_name_required: "Informe o nome completo ou a razão social.",
          registry_office_required: "Selecione ao menos um cartório oficial.",
          transfer_date_required: "Informe a data inicial das transferências.",
          certificate_purpose_required: "Selecione a finalidade LGPD da certidão.",
          document_or_authorization: "Confira o documento e a autorização.",
        };
        propertySearchError.textContent =
          response.status === 402 ? "Saldo de créditos insuficiente." : messages[data.reason] || "Não foi possível iniciar a consulta.";
      }
      return;
    }
    renderPropertySearch(data.search);
    renderPropertyWallet(data.wallet);
    await refreshPropertyHistory();
  } catch {
    if (propertySearchError) propertySearchError.textContent = "Falha ao comunicar com o serviço de imóveis.";
  } finally {
    if (propertySubmitButton) {
      propertySubmitButton.disabled = false;
      propertySubmitButton.textContent = "Iniciar consulta";
    }
  }
});

propertySearchResult?.addEventListener("change", (event) => {
  const outcomeField = event.target.closest("select[name='outcome']");
  if (!outcomeField) return;
  const resultForm = outcomeField.closest("[data-property-result-form]");
  resultForm?.querySelector("[data-property-assets-field]")?.classList.toggle("hidden", outcomeField.value !== "assets_found");
});

propertySearchResult?.addEventListener("submit", async (event) => {
  const protocolForm = event.target.closest("[data-property-protocol-form]");
  if (protocolForm) {
    event.preventDefault();
    const button = protocolForm.querySelector("button[type='submit']");
    if (button) button.disabled = true;
    await sendPropertyAction("record_protocol", { protocol: new FormData(protocolForm).get("protocol") || "" });
    if (button) button.disabled = false;
    return;
  }

  const resultForm = event.target.closest("[data-property-result-form]");
  if (!resultForm) return;
  event.preventDefault();
  const fields = new FormData(resultForm);
  const outcome = String(fields.get("outcome") || "");
  const assets = parsePropertyAssets(fields.get("assets"));
  const actionError = propertySearchResult.querySelector("[data-property-action-error]");
  if (outcome === "assets_found" && !assets.length) {
    if (actionError) actionError.textContent = "Informe ao menos uma matrícula localizada.";
    return;
  }
  const file = fields.get("evidenceFile");
  const button = resultForm.querySelector("button[type='submit']");
  if (button) button.disabled = true;
  try {
    const contentBase64 = file instanceof File && file.size ? await readFileAsBase64(file) : "";
    await sendPropertyAction("record_result", {
      outcome,
      assets,
      summary: fields.get("summary") || "",
      protocol: fields.get("protocol") || "",
      evidenceType: fields.get("evidenceType") || "note",
      evidenceTitle: fields.get("evidenceTitle") || "Resultado oficial registrado",
      fileName: file instanceof File ? file.name : "",
      contentBase64,
    });
  } finally {
    if (button) button.disabled = false;
  }
});

propertySearchResult?.addEventListener("click", async (event) => {
  const refreshButton = event.target.closest("[data-property-refresh-provider]");
  if (refreshButton) {
    refreshButton.disabled = true;
    refreshButton.textContent = "Consultando ONR";
    await sendPropertyAction("refresh_provider");
    return;
  }
  const cancelButton = event.target.closest("[data-property-cancel]");
  if (cancelButton) {
    cancelButton.disabled = true;
    await sendPropertyAction("cancel");
    return;
  }
  const nextOperation = event.target.closest("[data-property-next-operation]")?.dataset.propertyNextOperation;
  if (nextOperation && propertyOperation) {
    propertyOperation.value = nextOperation;
    syncPropertyOperation();
    if (currentPropertySearch?.uf && propertyUf) propertyUf.value = currentPropertySearch.uf;
    const preferredIds = (currentPropertySearch?.providerDetails || [])
      .filter((item) => item.qualifiedSearchAvailable !== false && Number(item.registryOfficeId) > 0)
      .map((item) => Number(item.registryOfficeId));
    await loadPropertyRegistryOffices(preferredIds);
    propertySearchForm?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

propertyHistoryList?.addEventListener("click", async (event) => {
  const id = event.target.closest("[data-property-search-id]")?.dataset.propertySearchId;
  if (id) await loadPropertySearch(id);
});

cnibForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const tipoDocumento = cnibDocumentType?.value || "cpf";
  const documento = cnibDocument?.value || "";
  if (cnibError) {
    cnibError.textContent = "";
  }
  if (!validateCnibDocument(tipoDocumento, documento)) {
    if (cnibError) {
      cnibError.textContent = tipoDocumento === "cpf" ? "Informe um CPF valido." : "Informe um CNPJ valido.";
    }
    cnibDocument?.focus();
    return;
  }
  if (!cnibAuthorization?.checked) {
    cnibAuthorization?.reportValidity();
    return;
  }

  if (cnibSubmitButton) {
    cnibSubmitButton.disabled = true;
    cnibSubmitButton.textContent = "Consultando";
  }
  if (cnibStatusLabel) {
    cnibStatusLabel.textContent = "Consultando";
  }
  if (cnibResult) {
    cnibResult.innerHTML = `<div class="audit-loading" aria-label="Consulta em andamento"><span></span><span></span><span></span><small>Consultando BigDataCorp...</small></div>`;
  }

  try {
    const response = await fetch("/audit", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        tipoDocumento,
        documento,
        fontes: ["cnib"],
        extraFields: {
          cnibSubjectName: cnibSubjectName?.value || "",
        },
      }),
    });

    if (response.status === 401) {
      showLogin("Entre para consultar indisponibilidade de bens.");
      return;
    }
    if (!response.ok) {
      if (cnibError) {
        cnibError.textContent = "Confira CPF/CNPJ e tente novamente.";
      }
      if (cnibStatusLabel) {
        cnibStatusLabel.textContent = "Erro";
      }
      return;
    }

    const data = await response.json();
    if (!data.consultaId) {
      if (cnibError) {
        cnibError.textContent = "A API nao retornou o ID da consulta.";
      }
      return;
    }
    sessionStorage.setItem("audita:lastCnibAuditId", data.consultaId);
    await loadCnibResult(data.consultaId);
  } catch {
    if (cnibError) {
      cnibError.textContent = "Falha ao comunicar com a API de auditoria.";
    }
    if (cnibStatusLabel) {
      cnibStatusLabel.textContent = "Erro";
    }
  } finally {
    if (cnibSubmitButton) {
      cnibSubmitButton.disabled = false;
      cnibSubmitButton.textContent = "Consultar";
    }
  }
});

auditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateAuditStep(2)) {
    clearAuditResultPreview();
    return;
  }

  auditError.textContent = "";
  auditResultStatus.textContent = "Criando";
  assistedRemoteSessions.clear();
  auditSourceList.innerHTML = "";
  renderDocumentAiPanel(null, []);
  setAuditWizardStep(3);

  try {
    const documentState = syncAuditPrimaryDocument();
    const documentValidationError = getAuditDocumentValidationError(documentState);
    if (documentValidationError) {
      auditError.textContent = documentValidationError.message;
      auditResultStatus.textContent = "Aguardando";
      setAuditWizardStep(2);
      documentValidationError.field?.focus();
      return;
    }
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
          stateCourtUf: getSelectedStateCourtUf(),
          stateCourtName: getSelectedStateCourt()?.court || "TJDFT",
          stateCourtUrl: getSelectedStateCourt()?.url || "",
          stateCourtProfileId: getSelectedStateCourt()?.uf || "DF",
          stateCourtFrameMode: getSelectedStateCourt()?.frameMode || "",
          stateCourtBlocker: getSelectedStateCourt()?.blocker || "",
          stateCourtFields: getStateCourtFieldsPayload(),
          stateCourtCertificateTypes: getStateCourtCertificateTypesPayload(),
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
    if (!data.consultaId) {
      auditError.textContent = "A API criou uma resposta sem ID de consulta. Recarregue o ambiente local e tente novamente.";
      auditResultStatus.textContent = "Falhou";
      auditSummary.innerHTML = `<p class="empty-state">A consulta não pôde ser acompanhada porque o servidor não retornou um identificador.</p>`;
      return;
    }
    sessionStorage.setItem("audita:lastAuditId", data.consultaId);
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
    saveAuditFormDraft();
    if (input === auditCnpjDocument && fgtsRegistration && selectedAuditViews.includes("fgts")) {
      fgtsRegistration.value = input.value.replace(/\D/g, "");
    }
  });
});

stateCourtDynamicFields?.addEventListener("input", (event) => {
  const field = event.target.closest("[data-state-court-field]");
  if (field) {
    applyStateCourtFieldMask(field);
    saveAuditFormDraft();
  }
});

stateCourtDynamicFields?.addEventListener("change", (event) => {
  const field = event.target.closest("[data-state-court-field]");
  if (field) {
    applyStateCourtFieldMask(field);
    saveAuditFormDraft();
  }
});

tjdftCourtUf?.addEventListener("change", () => {
  syncStateCourtSelection(tjdftCourtUf);
  updateTjdftPersonFields();
  restoreAuditFormDraft();
  clearAuditResultPreview();
});

stateCourtUf?.addEventListener("change", () => {
  syncStateCourtSelection(stateCourtUf);
  updateTjdftPersonFields();
  restoreAuditFormDraft();
  clearAuditResultPreview();
});

auditSourceList.addEventListener("click", async (event) => {
  const remotePanel = event.target.closest("[data-assisted-session]");
  if (!remotePanel) {
    return;
  }
  const sessionId = remotePanel.dataset.assistedSession;
  const agentButton = event.target.closest("[data-state-court-agent-action]");
  if (agentButton) {
    const agentPanel = agentButton.closest("[data-state-court-agent-session]");
    const agentSessionId = agentPanel?.dataset.stateCourtAgentSession;
    const action = agentButton.dataset.stateCourtAgentAction;
    if (action === "message") {
      const input = agentPanel?.querySelector("input[name='stateCourtAgentMessage']");
      const message = input?.value || "";
      if (!message.trim()) return;
      input.value = "";
      await sendStateCourtAgentAction(agentSessionId, { type: "message", message });
      return;
    }
    await sendStateCourtAgentAction(agentSessionId, { type: action });
    return;
  }
  const keyButton = event.target.closest("[data-assisted-key]");
  if (keyButton) {
    await sendAssistedRemoteAction(sessionId, { type: "press", key: keyButton.dataset.assistedKey });
    return;
  }

  const scrollButton = event.target.closest("[data-assisted-scroll]");
  if (scrollButton) {
    await sendAssistedRemoteAction(sessionId, { type: "scroll", deltaY: Number(scrollButton.dataset.assistedScroll || 0) });
    return;
  }

  const sendTextButton = event.target.closest("[data-assisted-send-text]");
  if (sendTextButton) {
    await sendAssistedRemoteTextFromControl(sendTextButton);
    return;
  }

  const evidenceSubmitButton = event.target.closest("[data-evidence-submit]");
  if (evidenceSubmitButton) {
    const evidenceForm = evidenceSubmitButton.closest(".audit-evidence-form");
    if (evidenceForm) {
      await submitAuditEvidenceForm(evidenceForm);
    }
    return;
  }

  const actionButton = event.target.closest("[data-assisted-action]");
  if (!actionButton) {
    return;
  }

  const action = actionButton.dataset.assistedAction;
  if (action === "refresh") {
    await loadAssistedRemoteSession(sessionId, { force: true });
    await inspectAssistedRemoteResult(sessionId);
    return;
  }
  if (action === "submit") {
    await sendAssistedRemoteAction(sessionId, { type: "submit" });
    return;
  }
  if (action === "recover") {
    await sendAssistedRemoteAction(sessionId, { type: "recover" });
    return;
  }
  if (action === "inspect") {
    await inspectAssistedRemoteResult(sessionId);
    return;
  }
  if (action === "use-inspection") {
    await useAssistedInspectionAsEvidence(sessionId, { autoSubmit: true });
    return;
  }
  if (action === "close") {
    await sendAssistedRemoteAction(sessionId, { type: "close" });
    return;
  }
  if (action === "click") {
    if (assistedRemoteSkipNextClick) {
      assistedRemoteSkipNextClick = false;
      return;
    }
    const point = getAssistedRemotePoint(actionButton, event);
    if (!point) {
      return;
    }
    setActiveAssistedRemotePanel(remotePanel);
    actionButton.focus({ preventScroll: true });
    await sendAssistedRemoteAction(sessionId, { type: "click", x: point.x, y: point.y });
    actionButton.focus({ preventScroll: true });
    return;
  }
});

auditSourceList.addEventListener("pointerdown", (event) => {
  const button = event.target.closest("[data-assisted-action='click']");
  const panel = button?.closest("[data-assisted-session]");
  if (!button || !panel || event.button !== 0) return;
  const point = getAssistedRemotePoint(button, event);
  if (!point) return;
  assistedRemoteDragState = {
    button,
    panel,
    sessionId: panel.dataset.assistedSession,
    pointerId: event.pointerId,
    path: [point],
    moved: false,
  };
  setActiveAssistedRemotePanel(panel);
  button.focus({ preventScroll: true });
  button.setPointerCapture?.(event.pointerId);
  event.preventDefault();
});

auditSourceList.addEventListener("pointermove", (event) => {
  const state = assistedRemoteDragState;
  if (!state || state.pointerId !== event.pointerId) return;
  const point = getAssistedRemotePoint(state.button, event);
  const last = state.path[state.path.length - 1];
  if (!point || !last) return;
  if (Math.hypot(point.x - last.x, point.y - last.y) < 3) return;
  state.path.push(point);
  state.moved = state.moved || Math.hypot(point.x - state.path[0].x, point.y - state.path[0].y) > 8;
  event.preventDefault();
});

auditSourceList.addEventListener("pointerup", async (event) => {
  const state = assistedRemoteDragState;
  if (!state || state.pointerId !== event.pointerId) return;
  assistedRemoteDragState = null;
  state.button.releasePointerCapture?.(event.pointerId);
  assistedRemoteSkipNextClick = true;
  window.setTimeout(() => {
    assistedRemoteSkipNextClick = false;
  }, 300);
  event.preventDefault();
  if (state.moved && state.path.length > 1) {
    await sendAssistedRemoteAction(state.sessionId, { type: "drag", path: state.path.slice(0, 80) });
  } else {
    const point = state.path[0];
    await sendAssistedRemoteAction(state.sessionId, { type: "click", x: point.x, y: point.y });
  }
  state.button.focus({ preventScroll: true });
});

auditSourceList.addEventListener("pointercancel", (event) => {
  const state = assistedRemoteDragState;
  if (!state || state.pointerId !== event.pointerId) return;
  assistedRemoteDragState = null;
  state.button.releasePointerCapture?.(event.pointerId);
});

auditSourceList.addEventListener("keydown", async (event) => {
  const editableSelector = "input, textarea, select, [contenteditable='true']";
  if (event.target.closest(editableSelector)) {
    const agentPanel = event.target.closest("[data-state-court-agent-session]");
    if (agentPanel && event.key === "Enter") {
      event.preventDefault();
      const input = agentPanel.querySelector("input[name='stateCourtAgentMessage']");
      const message = input?.value || "";
      if (message.trim()) {
        input.value = "";
        await sendStateCourtAgentAction(agentPanel.dataset.stateCourtAgentSession, { type: "message", message });
      }
      return;
    }
    const typeBox = event.target.closest(".assisted-remote-type");
    if (typeBox && event.key === "Enter") {
      event.preventDefault();
      await sendAssistedRemoteTextFromControl(typeBox);
    }
    return;
  }

  const remotePanel = getActiveAssistedRemotePanel(event.target);
  const sessionId = remotePanel?.dataset.assistedSession;
  if (!sessionId) return;

  if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    setActiveAssistedRemotePanel(remotePanel);
    queueAssistedRemoteTyping(sessionId, event.key);
    return;
  }

  const supportedKeys = new Set(["Enter", "Tab", "Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);
  if (supportedKeys.has(event.key)) {
    event.preventDefault();
    setActiveAssistedRemotePanel(remotePanel);
    await flushAssistedRemoteTyping(sessionId);
    await sendAssistedRemoteAction(sessionId, { type: "press", key: event.key });
  }
});

auditSourceList.addEventListener("submit", async (event) => {
  const form = event.target.closest(".audit-evidence-form");
  if (!form) {
    return;
  }

  event.preventDefault();
  await submitAuditEvidenceForm(form);
});

async function submitAuditEvidenceForm(form, { silent = false } = {}) {
  auditError.textContent = "";

  const fileField = getAuditEvidenceField(form, "file");
  const evidenceTypeField = getAuditEvidenceField(form, "evidenceType");
  const titleField = getAuditEvidenceField(form, "title");
  const valueField = getAuditEvidenceField(form, "value");
  const generatedFileNameField = getAuditEvidenceField(form, "generatedFileName");
  const generatedContentBase64Field = getAuditEvidenceField(form, "generatedContentBase64");
  const file = fileField?.files?.[0];
  const contentBase64 = await readFileAsBase64(file);
  const generatedFileName = generatedFileNameField?.value || "";
  const generatedContentBase64 = generatedContentBase64Field?.value || "";
  const evidenceEndpoint = /^[0-9a-f-]{36}$/i.test(form.dataset.auditId || "")
    ? `/audit/${form.dataset.auditId}/evidence`
    : `/api/audits/${form.dataset.auditId}/evidence`;

  try {
    const response = await fetch(evidenceEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        executionId: form.dataset.executionId,
        evidenceType: evidenceTypeField?.value || "",
        title: titleField?.value || "",
        value: valueField?.value || "",
        fileName: file?.name || generatedFileName,
        contentBase64: contentBase64 || generatedContentBase64,
      }),
    });

    if (response.status === 401) {
      showLogin("Entre para anexar evidencias.");
      return false;
    }

    if (!response.ok) {
      if (!silent) auditError.textContent = "Nao foi possivel anexar a evidencia.";
      return false;
    }

    const data = await response.json();
    renderAudit(data.audit);
    return true;
  } catch {
    if (!silent) auditError.textContent = "Falha ao anexar evidencia.";
    return false;
  }
}
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
  window.location.assign("/chat");
});

window.addEventListener("hashchange", () => {
  setActivePage(getActivePage());
  if (getActivePage() === "consulta-imoveis") {
    loadPropertyModule();
  }
});

setInterval(rotateRisk, 1400);
drawSignal();

moveEcosystemModules();
await loadStateCourtCatalog();
populateStateCourtSelect();
const savedAuditDraft = readAuditFormDraft();
const requestedStateCourtUf = new URLSearchParams(window.location.search).get("uf")?.toUpperCase();
if (/^[A-Z]{2}$/.test(requestedStateCourtUf || "")) {
  savedAuditDraft.stateCourtUf = requestedStateCourtUf;
}
if (savedAuditDraft.stateCourtUf) {
  if (stateCourtUf) stateCourtUf.value = savedAuditDraft.stateCourtUf;
  if (tjdftCourtUf) tjdftCourtUf.value = savedAuditDraft.stateCourtUf;
}
syncStateCourtSelection(stateCourtUf || tjdftCourtUf);
restoreAuditFormDraft();
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
  const resumeAuditId = getResumeAuditId();
  if (resumeAuditId) {
    setAuditWizardStep(3);
    await loadAuditResult(resumeAuditId, 1);
  }
  await loadAuditHistory();
  await loadPropertyModule();
  await loadConsultations();
  await loadSources();
  await loadAgentSettings();
  await loadAssistantSources();
}
