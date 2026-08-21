import { ITAU_FAQ_ITEMS, ITAU_FAQ_LEGAL_NOTICE } from "./itau-faq.js";
import { buildChargeCalculationSnapshot } from "./charge-calculation.js";

export { buildChargeCalculationSnapshot } from "./charge-calculation.js";

export const CHARGE_ANALYSIS_BRAND_GROUPS = Object.freeze([
  {
    name: "Varejo e departamentos",
    brands: [
      "Casas Bahia (FIC)",
      "Ponto Frio (FIC)",
      "LuizaCred / Magalu",
      "Marisa Itaucard",
      "Extra Hipermercados",
      "Pão de Açúcar (Mais)",
      "Assaí Atacadista",
      "Walmart / Big",
      "Sam's Club",
      "Bompreço",
      "TodoDia",
      "Maxxi Atacado",
      "Hipercard",
      "Passarela Calçados",
      "Polishop",
      "Pernambucanas",
      "C&A (parceria histórica)",
      "Lojas Americanas",
      "Shoptime",
      "Submarino",
      "Netshoes",
      "Zattini",
      "Dafiti",
      "Centauro",
      "Decathlon",
      "Riachuelo (FIC)",
      "Renner (co-branded)",
      "Leader Magazine",
      "Lojas Besni",
      "Lojas Koerich",
    ],
  },
  {
    name: "Automotivo e combustível",
    brands: [
      "Ipiranga / Km Vantagens",
      "Frotas Ipiranga",
      "Porto Seguro Cartões",
      "Fiat Itaucard",
      "Volkswagen Itaucard",
      "Mitsubishi Itaucard",
      "Ford Itaucard",
      "Chevrolet Itaucard",
      "Toyota Itaucard",
      "Hyundai Itaucard",
      "Renault Itaucard",
      "Nissan Itaucard",
      "Honda Itaucard",
      "Mercedes-Benz Itaucard",
      "BMW / Mini Itaucard",
      "Shell / Raízen",
      "BR Mania / Petrobras",
      "Localiza Rent a Car",
      "Unidas Aluguel",
      "Movida Aluguel",
      "Autozone",
      "DPaschoal",
      "Della Via Pneus",
      "Nokian Tyres",
      "Ticket Log / Fleet",
      "Sem Parar (Itaucard)",
      "ConectCar (Itaucard)",
      "Veloe (parceria)",
    ],
  },
  {
    name: "Aéreas, viagem e cartões Itaú",
    brands: [
      "Azul Linhas Aéreas",
      "Azul Internacional",
      "LATAM Pass Itaucard",
      "LATAM Pass Black",
      "Smiles / Gol",
      "TAP Miles&Go",
      "American Airlines",
      "United MileagePlus",
      "CVC Viagens",
      "Decolar.com Itaucard",
      "Booking.com",
      "Hoteis.com",
      "Hotel Urbano / Hurb",
      "Accor Live Limitless",
      "Mastercard Black",
      "Visa Infinite co-brand",
      "Amex Itaucard",
      "Diners Club Itaucard",
      "Credicard Zero",
      "Credicard Black",
      "Credicard Use",
      "Credicard Hall / Citi",
      "Citi Platinum",
      "Itaú Private Banking",
      "Itaú Personnalité",
      "Itaú Uniclass",
      "Itaú Agência (varejo)",
    ],
  },
  {
    name: "Supermercados, tecnologia e serviços",
    brands: [
      "Carrefour (FIC)",
      "Atacadão",
      "Angeloni",
      "Guanabara",
      "DB Supermercados",
      "Supermercado Condor",
      "Festval Supermercados",
      "Barbosa Supermercados",
      "Savegnago",
      "Zona Sul",
      "Super Nosso",
      "Yoki / General Mills",
      "Vivo Itaucard",
      "TIM Itaucard",
      "Claro / NET Itaucard",
      "Samsung Itaucard",
      "Apple / iPlace",
      "Sony Itaucard",
      "Uber / Uber Eats",
      "iFood Itaucard",
      "Rappi Itaucard",
      "Mercado Livre",
      "Shopee Itaucard",
      "PayPal Itaucard",
      "PagBank / PagSeguro",
      "Cartão Unik (FIC)",
      "BMG Itaucard",
      "Cartão Universitário",
    ],
  },
]);

export const CHARGE_ANALYSIS_BRANDS = Object.freeze(
  CHARGE_ANALYSIS_BRAND_GROUPS.flatMap((group) => group.brands),
);

export function mergeChargeAnalysisFiles(currentFiles = [], incomingFiles = []) {
  const uniqueFiles = new Map();
  [...currentFiles, ...incomingFiles].forEach((file) => {
    if (!file) return;
    const identity = [file.name, file.size, file.lastModified, file.type].join(":");
    if (!uniqueFiles.has(identity)) uniqueFiles.set(identity, file);
  });
  return [...uniqueFiles.values()];
}

const ITAU_INVOICE_CHANNELS_URL =
  "https://www.itau.com.br/atendimento-itau/para-voce/cartao-de-credito/onde-consigo-a-segunda-via-da-fatura-do-meu-cartao";
const ITAU_PHONE_CHANNELS_URL =
  "https://www.itau.com.br/atendimento-itau/para-voce/telefones";
const ITAU_OMBUDSMAN_URL =
  "https://www.itau.com.br/atendimento-itau/para-voce/ouvidoria";
const JEC_LAW_URL = "https://www.planalto.gov.br/ccivil_03/leis/l9099.htm";
const CDC_ARTICLE_42_URL = "https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm#art42";
const BCB_IPCA_URL =
  "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json&dataInicial=01/01/2011";
const BCB_IPCA_SOURCE_URL = "https://www.bcb.gov.br/controleinflacao/indicepreco";

export const ITAU_DOCUMENT_REQUEST_TEMPLATE = `SOLICITAÇÃO DE DOCUMENTOS, EXTRATOS E COMPROVAÇÃO DE AUTORIZAÇÃO

À ITAÚ UNIBANCO S.A. / instituição responsável pelo cartão

SOLICITANTE
Nome: [NOME COMPLETO]
CPF: [CPF]
RG: [RG]
Endereço: [ENDEREÇO COMPLETO]
Telefone: [TELEFONE]
E-mail: [E-MAIL]
Cartão: final [4 ÚLTIMOS DÍGITOS]
Bandeira ou emissor: [BANDEIRA OU EMISSOR]
Início aproximado da relação: [MÊS/ANO]

Solicito, para conferência da relação contratual e dos lançamentos:

1. cópia do contrato, proposta ou termo de adesão original do cartão;
2. cópia de proposta, termo, apólice ou registro que comprove minha autorização prévia e expressa para seguros, assistências, proteções, tarifas ou serviços vinculados;
3. cópia das faturas e/ou extratos completos de [MÊS/ANO INICIAL] a [MÊS/ANO FINAL], com todos os lançamentos;
4. número do protocolo, confirmação do período disponibilizado e indicação do canal de entrega.

Peço que os documentos sejam enviados para [E-MAIL] ou disponibilizados pelo canal oficial do atendimento.

[CIDADE/UF], [DATA]

[NOME COMPLETO]`;

const RECOVERY_UFS = Object.freeze([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

const RECOVERY_FIELD_LABELS = Object.freeze({
  fullName: "nome completo",
  document: "CPF válido",
  rg: "RG",
  nationality: "nacionalidade",
  maritalStatus: "estado civil",
  profession: "profissão",
  email: "e-mail válido",
  phone: "telefone",
  postalCode: "CEP",
  street: "logradouro",
  addressNumber: "número",
  district: "bairro",
  city: "cidade",
  uf: "UF do endereço",
  address: "endereço completo",
  doubleRefundAmount: "valor estimado para restituição",
  caseValue: "valor da causa",
  disputedCharge: "cobrança não reconhecida",
  historicalDocumentsAvailable: "disponibilidade dos extratos",
});

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function escapeChargeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatChargeCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Não identificado";
  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function buildChargeAuditSnapshot(caseData = {}) {
  const candidates = Array.isArray(caseData.candidates) ? caseData.candidates : [];
  const totalDetected = candidates.reduce(
    (total, candidate) =>
      total + (Number.isFinite(Number(candidate.amount)) ? Number(candidate.amount) : 0),
    0,
  );
  const disputed = candidates.filter(
    (candidate) => candidate.answer === "not_recognized",
  );
  const totalDisputed = disputed.reduce(
    (total, candidate) =>
      total + (Number.isFinite(Number(candidate.amount)) ? Number(candidate.amount) : 0),
    0,
  );
  const pendingCount = candidates.filter(
    (candidate) => !candidate.answer || candidate.answer === "pending",
  ).length;

  return {
    candidateCount: candidates.length,
    disputedCount: disputed.length,
    pendingCount,
    totalDetected: Number(totalDetected.toFixed(2)),
    totalDisputed: Number(totalDisputed.toFixed(2)),
    hypotheticalDouble: Number((totalDisputed * 2).toFixed(2)),
  };
}

export function buildChargeProgressSnapshot(flowState = {}) {
  const screen = String(flowState.screen || "triage");
  const documentAvailability = String(flowState.documentAvailability || "");
  const selectedFileCount = Array.isArray(flowState.selectedFiles)
    ? flowState.selectedFiles.filter(Boolean).length
    : flowState.selectedFile
      ? 1
      : 0;
  const caseData = flowState.caseData && typeof flowState.caseData === "object"
    ? flowState.caseData
    : null;
  const recovery = flowState.recovery && typeof flowState.recovery === "object"
    ? flowState.recovery
    : {};
  const audit = buildChargeAuditSnapshot(caseData || {});
  const calculation = buildChargeCalculationSnapshot(caseData || {});
  const authorizationComplete = Boolean(flowState.authorizationAnswer);
  const documentChoiceComplete = ["complete", "partial", "none"].includes(
    documentAvailability,
  );
  const analysisComplete = Boolean(caseData);
  const reviewComplete = analysisComplete && audit.candidateCount > 0 && audit.pendingCount === 0;
  const calculationOpened = ["paywall", "result", "recovery"].includes(screen) && reviewComplete;
  const recoveryStarted = Boolean(recovery.handoff);
  const documentPrepared = Boolean(recovery.prepared?.ready);
  const testimonyReviewed = Boolean(recovery.testimony?.reviewed);
  const documentGenerated = Boolean(recovery.pdfGeneratedAt);

  let percent = 0;
  if (authorizationComplete) percent = 10;
  if (documentChoiceComplete) percent = 20;
  if (selectedFileCount > 0) percent = 30;
  if (analysisComplete) percent = 45;
  if (reviewComplete) percent = 55;
  if (calculationOpened) percent = 65;
  if (recoveryStarted) percent = 72;
  if (documentPrepared) percent = 80;
  if (testimonyReviewed) percent = 86;
  if (documentGenerated) percent = 90;

  if (documentAvailability === "none") {
    percent = Math.min(percent, 20);
  }

  let activeStep = "authorization";
  if (["documents", "no-documents", "upload"].includes(screen)) {
    activeStep = "statements";
  } else if (["analyzing", "paywall"].includes(screen)) {
    activeStep = "analysis";
  } else if (screen === "review") {
    activeStep = "result";
  } else if (screen === "result") {
    activeStep = "recovery";
  } else if (screen === "recovery") {
    activeStep = recovery.phase === "guide"
      ? "tribunal"
      : recovery.phase === "testimony"
        ? "report"
      : recovery.phase === "report"
        ? "report"
        : "recovery";
  }

  let message = "Responda à triagem inicial para começar.";
  if (authorizationComplete) message = "Triagem registrada. Informe quais documentos estão disponíveis.";
  if (documentAvailability === "none") {
    message = "Faltam faturas ou extratos. Sem documentos, a análise e a preparação jurídica não avançam.";
  } else if (documentChoiceComplete && selectedFileCount === 0) {
    message = "Selecione e autorize o processamento dos documentos para continuar.";
  } else if (screen === "paywall") {
    message = "A análise localizou cobranças a revisar. Assine o Standard para acessar os detalhes e a simulação.";
  } else if (selectedFileCount > 0 && !analysisComplete) {
    message = "Documentos selecionados. Falta concluir a análise dos anexos.";
  } else if (analysisComplete && !audit.candidateCount) {
    message = "Análise concluída, mas nenhuma ocorrência foi localizada. Refine a busca ou envie mais documentos.";
  } else if (analysisComplete && audit.pendingCount > 0) {
    message = `Falta revisar ${audit.pendingCount} ${audit.pendingCount === 1 ? "ocorrência" : "ocorrências"}.`;
  } else if (reviewComplete && !calculationOpened) {
    message = "Revisão concluída. Confirme para abrir o cálculo documental.";
  } else if (calculationOpened && !calculation.itemCount) {
    message = "Revisão concluída, mas nenhuma cobrança não reconhecida foi confirmada para cálculo.";
  } else if (calculationOpened && !recoveryStarted) {
    message = "Cálculo documental concluído. Falta iniciar e revisar a preparação dos documentos.";
  } else if (recoveryStarted && !documentPrepared) {
    message = "Preparação iniciada. Complete e revise os dados necessários para gerar o documento.";
  } else if (documentGenerated) {
    message = "Documento gerado. O protocolo final continua pendente e deve ser concluído por uma pessoa.";
  } else if (documentPrepared && !testimonyReviewed) {
    message = "Documento preparado. Falta incluir e revisar o seu depoimento pessoal.";
  } else if (testimonyReviewed && !documentGenerated) {
    message = "Depoimento revisado. Falta gerar o PDF.";
  }

  if (documentAvailability === "partial" && selectedFileCount > 0) {
    message = `${message} A cobertura é parcial e ainda faltam documentos do período completo.`;
  }

  if (screen === "brands") {
    message = "Confira as referências e informe se já teve um dos cartões apresentados.";
  }

  if (screen === "ended") {
    message = "Triagem encerrada. Esta hipótese específica tem baixa aderência à situação informada.";
  }

  return {
    percent,
    activeStep,
    message,
    evidenceCoverage:
      documentAvailability === "complete"
        ? "complete"
        : documentAvailability === "partial"
          ? "partial"
          : documentAvailability === "none"
            ? "absent"
            : "unknown",
    protocolStatus: "human_pending",
  };
}

export function buildChargeEstimate(input = {}) {
  const monthlyAmount = Math.max(0, Number(input.monthlyAmount) || 0);
  const durationValue = Math.max(0, Math.floor(Number(input.durationValue) || 0));
  const durationUnit = input.durationUnit === "years" ? "years" : "months";
  const months = durationUnit === "years" ? durationValue * 12 : durationValue;
  const estimatedPaid = monthlyAmount * months;

  return {
    monthlyAmount: Number(monthlyAmount.toFixed(2)),
    durationValue,
    durationUnit,
    months,
    estimatedPaid: Number(estimatedPaid.toFixed(2)),
    hypotheticalDouble: Number((estimatedPaid * 2).toFixed(2)),
  };
}

function formatChargeAmountInput(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function buildChargeJecHandoff({
  caseData = {},
  documentAvailability = "",
  authorizationAnswer = "",
  selectedBrand = "",
  handoffId = "",
  calculation = null,
} = {}) {
  const historicalDocumentsAvailable = documentAvailability === "complete" ? "yes" : "no";
  const sourceCandidates = Array.isArray(caseData?.candidates)
    ? caseData.candidates
        .filter((candidate) => candidate.answer === "not_recognized")
        .map((candidate) => ({ ...candidate }))
    : [];
  const audit = buildChargeAuditSnapshot({ candidates: sourceCandidates });
  const candidates = sourceCandidates;
  const disputedCount = candidates.length;
  const pendingCount = (Array.isArray(caseData?.candidates) ? caseData.candidates : []).filter(
    (candidate) => !candidate.answer || candidate.answer === "pending",
  ).length;
  const hasRequiredDocuments = documentAvailability !== "none";
  const ready = hasRequiredDocuments && disputedCount > 0 && pendingCount === 0;
  const suggestedDouble =
    audit.totalDisputed > 0
      ? audit.hypotheticalDouble
      : 0;
  const suggestedCaseValue = Number(calculation?.estimatedMaterialClaim) > 0
    ? Number(calculation.estimatedMaterialClaim)
    : suggestedDouble;
  const normalizedId = String(handoffId || caseData?.id || "estimate")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 120);
  const historicalEvidence =
    historicalDocumentsAvailable === "yes"
      ? "yes"
      : String(caseData?.answers?.historicalEvidence || "unknown");
  const suggestionSource = !hasRequiredDocuments
    ? "charge_analysis_documents_required"
    : "charge_analysis_documentary_evidence";

  return {
    ready,
    reason:
      !hasRequiredDocuments
        ? "Anexe ao menos uma fatura ou extrato antes de preparar a documentação jurídica."
        : disputedCount === 0
        ? "Confirme ao menos uma cobrança não reconhecida antes de preparar a documentação."
        : pendingCount > 0
          ? "Revise todos os lançamentos encontrados antes de preparar a documentação."
          : "",
    caseData: {
      ...caseData,
      id: `guided-jec-${normalizedId}`,
      status: ready ? "evaluated" : caseData?.status || "review_required",
      candidates,
      answers: {
        ...(caseData?.answers || {}),
        historicalDocumentsAvailable,
        historicalEvidence,
        wantsJec: "yes",
        authorizationAnswer,
        selectedBrand,
        documentAvailability,
      },
    },
    suggestion: {
      source: suggestionSource,
      reviewRequired: true,
      evidencedPrincipal: audit.totalDisputed,
      disputedCount,
      knownAmountCount: audit.totalDisputed > 0 ? audit.disputedCount : 0,
      values: {
        doubleRefundAmount: formatChargeAmountInput(suggestedDouble),
        lostProfitsAmount: "",
        moralDamagesAmount: "",
        caseValue: formatChargeAmountInput(suggestedCaseValue),
      },
      notes: [
        !hasRequiredDocuments
          ? "Nenhum cálculo ou encaminhamento jurídico deve ser preparado sem ao menos uma fatura ou extrato."
          : "A apuração usa somente cobranças documentadas e marcadas como não reconhecidas.",
      ],
      disclaimer:
        "A repetição em dobro, os danos e o valor da causa dependem de revisão jurídica e decisão judicial.",
    },
    journey:
      historicalDocumentsAvailable === "yes"
        ? "with_historical_documents"
        : "without_historical_documents",
  };
}

const stage =
  typeof document === "undefined"
    ? null
    : document.querySelector("#chargeAnalysisStage");

if (stage) {
  const shell = stage.closest(".charge-analysis-shell");
  const faqButton = document.querySelector("#chargeAnalysisHelpButton");
  const faqDialog = document.querySelector("#chargeAnalysisFaqDialog");
  const faqSearch = document.querySelector("#chargeFaqSearch");
  const faqList = document.querySelector("#chargeFaqList");
  const faqCount = document.querySelector("#chargeFaqCount");
  const faqNotice = document.querySelector("#chargeFaqNotice");
  const status = document.querySelector("#chargeAnalysisStatus");
  const errorBox = document.querySelector("#chargeAnalysisError");
  const progressItems = document.querySelectorAll("[data-charge-progress]");
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  let messageSequenceId = 0;
  let triageStarted = false;

  function renderFaq(query = "") {
    if (!faqList || !faqCount) return;
    const normalizedQuery = String(query).trim().toLocaleLowerCase("pt-BR");
    const visibleItems = ITAU_FAQ_ITEMS.filter((item) => {
      if (!normalizedQuery) return true;
      const decoder = document.createElement("div");
      decoder.innerHTML = `${item.question} ${item.answer}`;
      return decoder.textContent.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
    });

    faqList.innerHTML = visibleItems.length
      ? visibleItems.map((item, index) => `
          <details class="charge-faq-item">
            <summary>
              <span>${item.question}</span>
              <span class="charge-faq-chevron" aria-hidden="true">+</span>
            </summary>
            <div class="charge-faq-answer">${item.answer}</div>
          </details>
        `).join("")
      : `<div class="charge-faq-empty"><strong>Nenhuma pergunta encontrada.</strong><p>Tente buscar por outra palavra.</p></div>`;
    faqCount.textContent = `${visibleItems.length} ${visibleItems.length === 1 ? "pergunta encontrada" : "perguntas encontradas"}`;
  }

  function openFaq() {
    if (!faqDialog) return;
    renderFaq("");
    if (faqSearch) faqSearch.value = "";
    if (faqNotice) faqNotice.innerHTML = ITAU_FAQ_LEGAL_NOTICE;
    if (typeof faqDialog.showModal === "function") faqDialog.showModal();
    else faqDialog.setAttribute("open", "");
    window.requestAnimationFrame(() => faqSearch?.focus());
  }

  function closeFaq() {
    if (!faqDialog) return;
    if (typeof faqDialog.close === "function") faqDialog.close();
    else faqDialog.removeAttribute("open");
    faqButton?.focus();
  }

  faqButton?.addEventListener("click", openFaq);
  faqSearch?.addEventListener("input", () => renderFaq(faqSearch.value));
  faqDialog?.addEventListener("click", (event) => {
    if (event.target === faqDialog || event.target.closest("[data-charge-faq-close]")) closeFaq();
  });
  faqDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeFaq();
  });
  faqDialog?.addEventListener("close", () => faqButton?.focus());

  const state = {
    screen: "triage",
    route: "consumer",
    authorizationAnswer: "",
    selectedBrand: "",
    brandHistoryAnswer: "",
    brandSearch: "",
    documentAvailability: "",
    selectedFile: null,
    selectedFiles: [],
    consent: false,
    caseData: null,
    caseBatches: [],
    access: null,
    billingCatalog: null,
    ipcaRates: [],
    calculationAsOf: "",
    calculationWarning: "",
    lawyerKit: {
      loading: false,
      access: { entitled: false, source: "none" },
      documents: [],
      checkoutStatus: "",
      error: "",
    },
    directedSearch: {
      open: false,
      query: "",
      busy: false,
      message: "",
      error: "",
    },
    recovery: {
      phase: "intro",
      handoff: null,
      claimant: {},
      prepared: null,
      testimony: {
        original: "",
        refined: "",
        reviewed: false,
      },
      portals: [],
      guideUf: "",
      loading: false,
      busy: false,
      pdfGeneratedAt: "",
      error: "",
    },
    busy: false,
    error: "",
  };

  function resetRecovery() {
    state.recovery = {
      phase: "intro",
      handoff: null,
      claimant: {},
      prepared: null,
      testimony: {
        original: "",
        refined: "",
        reviewed: false,
      },
      portals: [],
      guideUf: "",
      loading: false,
      busy: false,
      pdfGeneratedAt: "",
      error: "",
    };
  }

  const assistantAvatarAsset = "assets/audita-profile-assistant.png";
  const assistantAvatarPreload = new Image();
  assistantAvatarPreload.src = assistantAvatarAsset;
  let floatingAssistantAvatar = null;

  function assistantAvatarAnchor() {
    return '<span class="charge-analysis-avatar-anchor" aria-hidden="true"></span>';
  }

  function ensureFloatingAssistantAvatar() {
    if (!floatingAssistantAvatar) {
      floatingAssistantAvatar = document.createElement("span");
      floatingAssistantAvatar.className = "charge-analysis-avatar charge-analysis-floating-avatar";
      floatingAssistantAvatar.setAttribute("aria-hidden", "true");
      floatingAssistantAvatar.innerHTML = `<img src="${assistantAvatarAsset}" alt="" loading="eager" decoding="async" />`;
    }
    if (!stage.contains(floatingAssistantAvatar)) stage.appendChild(floatingAssistantAvatar);
    return floatingAssistantAvatar;
  }

  function moveAssistantAvatar(conversation, { immediate = false } = {}) {
    const avatar = ensureFloatingAssistantAvatar();
    const assistantMessages = conversation?.querySelectorAll(".charge-analysis-message.assistant");
    const target = assistantMessages?.[assistantMessages.length - 1];
    const anchor = target?.querySelector(".charge-analysis-avatar-anchor");
    if (!anchor) {
      avatar.classList.remove("is-ready");
      return;
    }

    const positionAvatar = () => {
      const stageRect = stage.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      avatar.style.setProperty("--charge-avatar-x", `${Math.round(anchorRect.left - stageRect.left + stage.scrollLeft)}px`);
      avatar.style.setProperty("--charge-avatar-y", `${Math.round(anchorRect.top - stageRect.top + stage.scrollTop)}px`);
      avatar.classList.add("is-ready");
    };

    if (immediate || !avatar.classList.contains("is-ready")) {
      avatar.classList.add("is-positioning");
      positionAvatar();
      avatar.getBoundingClientRect();
      avatar.classList.remove("is-positioning");
      return;
    }
    window.requestAnimationFrame(positionAvatar);
  }

  function syncFloatingAssistantAvatar({ immediate = false } = {}) {
    const conversation = stage.querySelector(".charge-analysis-conversation");
    moveAssistantAvatar(conversation, { immediate });
  }

  function assistantMessage(content, label = "IA AUDITA · Triagem guiada", className = "") {
    return `
      <div class="charge-analysis-message assistant ${className}">
        ${assistantAvatarAnchor()}
        <div class="charge-analysis-bubble">
          <small>${escapeChargeHtml(label)}</small>
          ${content}
        </div>
      </div>
    `;
  }

  function userMessage(content) {
    return `
      <div class="charge-analysis-message user">
        <div class="charge-analysis-bubble"><p>${escapeChargeHtml(content)}</p></div>
      </div>
    `;
  }

  function typingMessage() {
    return `
      <div class="charge-analysis-message assistant charge-analysis-message-typing" role="status">
        ${assistantAvatarAnchor()}
        <div class="charge-analysis-typing">IA AUDITA est&aacute; digitando&hellip;</div>
      </div>
    `;
  }

  function messageDelay(milliseconds) {
    if (prefersReducedMotion) return Promise.resolve();
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  function typingDelayFor(message) {
    const visibleLength = String(message || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim().length;
    return Math.min(2800, Math.max(1500, visibleLength * 8));
  }

  function scrollLatestMessage(container) {
    if (!window.matchMedia?.("(max-width: 820px)")?.matches) return;
    container?.lastElementChild?.scrollIntoView?.({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "nearest",
    });
  }

  async function revealTriageMessages(sequenceId, conversation, messages) {
    if (!conversation) return;
    conversation.insertAdjacentHTML("beforeend", messages[0]);
    moveAssistantAvatar(conversation, { immediate: true });

    for (const message of messages.slice(1)) {
      await messageDelay(1000);
      if (sequenceId !== messageSequenceId) return;
      conversation.insertAdjacentHTML("beforeend", typingMessage());
      moveAssistantAvatar(conversation);
      scrollLatestMessage(conversation);
      await messageDelay(typingDelayFor(message));
      if (sequenceId !== messageSequenceId) return;
      conversation.lastElementChild?.remove();
      conversation.insertAdjacentHTML("beforeend", message);
      moveAssistantAvatar(conversation);
      scrollLatestMessage(conversation);
    }
  }

  async function continueFromTriage(reply, updateState) {
    const sequenceId = ++messageSequenceId;
    const conversation = stage.querySelector(".charge-analysis-conversation");
    stage.querySelectorAll("[data-charge-action]").forEach((action) => {
      action.disabled = true;
    });
    conversation?.querySelectorAll(".charge-analysis-actions").forEach((actions) => {
      actions.hidden = true;
      actions.setAttribute("aria-hidden", "true");
    });
    conversation?.insertAdjacentHTML("beforeend", userMessage(reply));
    scrollLatestMessage(conversation);
    await messageDelay(900);
    if (sequenceId !== messageSequenceId) return;
    conversation?.insertAdjacentHTML("beforeend", typingMessage());
    moveAssistantAvatar(conversation);
    scrollLatestMessage(conversation);
    await messageDelay(1500);
    if (sequenceId !== messageSequenceId) return;
    updateState();
    render();
  }

  function setError(message = "") {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.classList.toggle("hidden", !message);
  }

  function currentJecHandoff() {
    return buildChargeJecHandoff({
      caseData: state.caseData || {},
      documentAvailability: state.documentAvailability,
      authorizationAnswer: state.authorizationAnswer,
      selectedBrand: state.selectedBrand,
      calculation: currentCalculation(),
    });
  }

  function documentationActionMarkup() {
    const handoff = currentJecHandoff();
    return `
      <button
        type="button"
        class="primary-action"
        data-charge-action="start-recovery"
        ${handoff.ready ? "" : "disabled"}
        ${handoff.reason ? `title="${escapeChargeHtml(handoff.reason)}"` : ""}
      >Prosseguir para recupera&ccedil;&atilde;o</button>
    `;
  }

  async function loadRecoveryDependencies() {
    if (state.recovery.loading) return;
    state.recovery.loading = true;
    render();

    try {
      const [profileResponse, portalsResponse] = await Promise.all([
        fetch("/api/user/profile", { headers: { accept: "application/json" } }),
        fetch("/api/jec/portals", { headers: { accept: "application/json" } }),
      ]);
      if (profileResponse.ok) {
        const profileData = await profileResponse.json().catch(() => ({}));
        state.recovery.claimant = {
          ...(profileData.profile || {}),
          ...state.recovery.claimant,
        };
      }
      if (portalsResponse.ok) {
        const portalsData = await portalsResponse.json().catch(() => ({}));
        state.recovery.portals = Array.isArray(portalsData.portals)
          ? portalsData.portals
          : [];
      }
    } catch {
      // O preenchimento manual continua disponivel se perfil ou catalogo falharem.
    } finally {
      state.recovery.loading = false;
      render();
    }
  }

  function startRecoveryFlow() {
    const handoff = buildChargeJecHandoff({
      caseData: state.caseData || {},
      documentAvailability: state.documentAvailability,
      authorizationAnswer: state.authorizationAnswer,
      selectedBrand: state.selectedBrand,
      calculation: currentCalculation(),
      handoffId:
        globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    });
    if (!handoff.ready) {
      setError(handoff.reason);
      return;
    }
    resetRecovery();
    state.recovery.handoff = handoff;
    state.recovery.claimant = {
      historicalDocumentsAvailable:
        handoff.caseData.answers?.historicalDocumentsAvailable || "",
      ...(handoff.suggestion?.values || {}),
    };
    state.recovery.phase = "intro";
    state.screen = "recovery";
    void loadRecoveryDependencies();
  }

  function syncProgress() {
    const order = [
      "authorization",
      "statements",
      "analysis",
      "result",
      "recovery",
      "report",
      "tribunal",
    ];
    const labels = {
      authorization: "Identificação",
      statements: "Anexos",
      analysis: "Análise",
      result: "Revisão",
      recovery: "Cálculo",
      report: "Documento",
      tribunal: "Protocolo",
    };
    const snapshot = buildChargeProgressSnapshot(state);
    const progressState = snapshot.activeStep;
    const currentIndex = order.indexOf(progressState);

    progressItems.forEach((item) => {
      const index = order.indexOf(item.dataset.chargeProgress);
      item.classList.toggle("active", index === currentIndex);
      item.classList.toggle("complete", index < currentIndex);
      item.classList.toggle("locked", index > currentIndex);
      if (index === currentIndex) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });

    if (status) {
      status.textContent = `${snapshot.percent}% concluído · Etapa ${currentIndex + 1} de ${order.length} · ${labels[progressState]}. ${snapshot.message}`;
    }
    if (shell) {
      shell.dataset.flowStage = progressState;
      shell.dataset.evidenceCoverage = snapshot.evidenceCoverage;
      shell.dataset.protocolStatus = snapshot.protocolStatus;
    }
  }

  function chargeAnalysisIntroMarkup() {
    return `
      <p>Ol&aacute;! Sou a IA AUDITA. Vou conduzir uma verifica&ccedil;&atilde;o inicial de poss&iacute;veis cobran&ccedil;as de seguros ou servi&ccedil;os (Prestamista, Cartão/Bolsa Protegida, Perda e Roubo, Proteção Financeira / Perda de Renda, Acidentes Pessoais / Vida, Tarifas e Pacotes de Terceiros). Válido para cartões Itaú, Itaucard e <button type="button" class="charge-analysis-inline-link" data-charge-action="open-brand-references" aria-label="Abrir 113 refer&ecirc;ncias nominais das 133 bandeiras de cart&otilde;es de parceiras">133 parceiras</button> (Casas Bahia, Magalu, Ponto, Marisa etc.).</p>
    `;
  }

  function renderTriage() {
    const sequenceId = ++messageSequenceId;
    const responseButtons = `
      <div class="charge-analysis-actions" aria-label="Respostas da primeira etapa">
        <button type="button" data-charge-action="not-authorized">
          <strong>Sim, tenho um desses cart&otilde;es</strong>
        </button>
        <button type="button" data-charge-action="verify-statement">
          <strong>N&atilde;o sei, quais s&atilde;o todas as bandeiras?</strong>
        </button>
        <button type="button" data-charge-action="lawyer">
          <strong>Sou advogado(a)</strong>
        </button>
      </div>
    `;
    const messages = [
      assistantMessage(`
        ${chargeAnalysisIntroMarkup()}
        <p class="charge-analysis-intro-question"><strong>Voc&ecirc; possui ou possuiu algum cart&atilde;o dessas bandeiras?</strong></p>
        ${responseButtons}
      `, "IA AUDITA", "charge-analysis-intro-message"),
    ];

    stage.innerHTML = `
      <div class="charge-analysis-conversation" data-charge-conversation></div>
    `;
    revealTriageMessages(
      sequenceId,
      stage.querySelector("[data-charge-conversation]"),
      messages,
    );
  }

  function renderBrands() {
    const query = normalizeSearch(state.brandSearch);
    const groups = CHARGE_ANALYSIS_BRAND_GROUPS.map((group) => ({
      ...group,
      brands: group.brands.filter((brand) => normalizeSearch(brand).includes(query)),
    })).filter((group) => group.brands.length);
    const resultCount = groups.reduce((total, group) => total + group.brands.length, 0);
    const selected = state.selectedBrand;

    stage.innerHTML = `
      <div class="charge-analysis-conversation compact">
        ${userMessage("Não sei, gostaria de mais informações.")}
        ${assistantMessage(`
          <p><strong>Para investigarmos melhor, confira a lista de bandeiras e cartões parceiros do Itaú.</strong></p>
          <p>Se você teve um desses cartões entre 2011 e 2026, pode haver cobranças de seguros ou serviços que mereçam investigação. Esse tema foi levantado na Ação Civil Coletiva promovida pelo Ministério Público contra o Itaú, no TJMG.</p>
          <p>Você pode pesquisar pelo nome que aparece na fatura ou no cartão. A lista serve como apoio à triagem: encontrar uma referência não comprova, por si só, que houve cobrança indevida.</p>
        `, "Lista de referência")}
      </div>

      <section class="charge-brand-panel" aria-label="Lista ampliada de marcas">
        <label class="charge-brand-search">
          <span>Buscar entre 113 referências</span>
          <input
            id="chargeBrandSearch"
            type="search"
            value="${escapeChargeHtml(state.brandSearch)}"
            placeholder="Ex.: Magalu, Hipercard, Azul"
            autocomplete="off"
          />
        </label>
        <div class="charge-brand-summary">
          <span>${resultCount} ${resultCount === 1 ? "resultado" : "resultados"}</span>
          ${selected ? `<strong>Selecionado: ${escapeChargeHtml(selected)}</strong>` : ""}
        </div>
        <div class="charge-brand-list" id="chargeBrandList">
          ${
            groups.length
              ? groups
                  .map(
                    (group) => `
                      <section>
                        <h3>${escapeChargeHtml(group.name)}</h3>
                        <div>
                          ${group.brands
                            .map(
                              (brand) => `
                                <button
                                  type="button"
                                  class="${selected === brand ? "selected" : ""}"
                                  data-charge-action="select-brand"
                                  data-charge-brand="${escapeChargeHtml(brand)}"
                                >${escapeChargeHtml(brand)}</button>
                              `,
                            )
                            .join("")}
                        </div>
                      </section>
                    `,
                  )
                  .join("")
              : `<p class="charge-analysis-empty">Nenhuma referência encontrada. Ajuste a busca ou responda abaixo considerando os cartões que já teve.</p>`
          }
        </div>
        <div class="charge-brand-actions">
          <button type="button" class="secondary-action" data-charge-action="back-triage">Voltar</button>
          <button type="button" class="secondary-action" data-charge-action="brand-history-no">Não, nunca tive um desses cartões</button>
          <button type="button" class="primary-action" data-charge-action="brand-history-yes">Sim, já tive ou tenho um desses cartões</button>
        </div>
      </section>
    `;
    requestAnimationFrame(() => document.querySelector("#chargeBrandSearch")?.focus());
  }

  function routeIdentityMessage() {
    if (state.route === "lawyer") {
      return "Sou advogado(a) e quero auditar para um cliente.";
    }
    if (state.authorizationAnswer === "denied") {
      return "Acredito que tenho alguma cobrança indevida no meu cartão ou conta Itaú.";
    }
    if (state.authorizationAnswer === "confirmed") {
      return "Acredito que não tenho nenhuma cobrança indevida.";
    }
    if (state.authorizationAnswer === "uncertain") {
      if (state.brandHistoryAnswer === "yes") {
        return state.selectedBrand
          ? `Sim, já tive ou tenho um desses cartões. Selecionei ${state.selectedBrand} como referência.`
          : "Sim, já tive ou tenho um desses cartões.";
      }
      return state.selectedBrand
        ? `Não sei se há cobrança indevida; selecionei ${state.selectedBrand} apenas como referência para a triagem.`
        : "Não sei se há cobrança indevida e gostaria de mais informações.";
    }
    if (state.selectedBrand) return `Meu cartão pode ser ${state.selectedBrand}.`;
    return "Possuo ou já possuí cartão Itaú ou de marca parceira.";
  }

  function earlyJourneyMarkup({ documentChoice = false, documentSelected = false } = {}) {
    const isCompleteHistory = state.documentAvailability === "complete";
    const documentReply = isCompleteHistory
      ? "Tenho todos ou a maior parte dos extratos."
      : "Tenho apenas alguns documentos ou um print recente.";
    const documentPrompt = isCompleteHistory
      ? "Anexe todas as faturas ou extratos dispon&iacute;veis para uma an&aacute;lise documental mais completa."
      : "Envie uma ou mais faturas, extratos ou prints recentes para localizar a poss&iacute;vel cobran&ccedil;a.";
    const documentDetail = isCompleteHistory
      ? "Os documentos ser&atilde;o analisados individualmente e reunidos em uma &uacute;nica vis&atilde;o, preservando a origem de cada lan&ccedil;amento."
      : "A triagem considerar&aacute; somente os arquivos enviados. Documentos parciais n&atilde;o comprovam integralmente o per&iacute;odo e n&atilde;o ser&atilde;o apresentados como hist&oacute;rico completo.";
    const routeCopy = state.route === "lawyer"
      ? "Voc&ecirc; est&aacute; auditando para um cliente. Confirme que possui autoriza&ccedil;&atilde;o para processar o documento."
      : state.selectedBrand
        ? `Marca informada: ${escapeChargeHtml(state.selectedBrand)}.`
        : "A pr&oacute;pria fatura ser&aacute; usada para confirmar o emissor e os lan&ccedil;amentos.";

    return `
      <div class="charge-analysis-conversation compact" data-charge-conversation>
        ${assistantMessage(chargeAnalysisIntroMarkup(), "IA AUDITA", "charge-analysis-intro-message")}
        ${userMessage(routeIdentityMessage())}
        ${assistantMessage(`
          <p><strong>Voc&ecirc; possui as faturas ou os extratos de todo o per&iacute;odo em que acredita ter recebido essa cobran&ccedil;a?</strong></p>
          <p class="charge-analysis-choice-hint">Documentos parciais permitem uma triagem inicial, mas n&atilde;o comprovam integralmente todo o per&iacute;odo.</p>
          ${documentChoice ? `
            <div class="charge-analysis-actions charge-document-actions" aria-label="Disponibilidade dos extratos">
              <button type="button" data-charge-action="documents-complete"><strong>Tenho todos ou a maior parte</strong></button>
              <button type="button" data-charge-action="documents-partial"><strong>Tenho apenas alguns ou um print recente</strong></button>
              <button type="button" class="secondary" data-charge-action="documents-none"><strong>N&atilde;o tenho nenhum extrato</strong></button>
            </div>
          ` : ""}
        `, "Disponibilidade dos documentos", documentChoice ? "question" : "")}
        ${documentSelected ? userMessage(documentReply) : ""}
        ${documentSelected ? assistantMessage(`
          <p><strong>${documentPrompt}</strong></p>
          <p>${documentDetail}</p>
          <p>${routeCopy}</p>
        `, "IA AUDITA &middot; An&aacute;lise", "question") : ""}
      </div>
    `;
  }

  function renderDocumentAvailability() {
    stage.innerHTML = earlyJourneyMarkup({ documentChoice: true });
  }

  function resetDirectedSearch() {
    state.directedSearch = {
      open: false,
      query: "",
      busy: false,
      message: "",
      error: "",
    };
  }

  function renderNoDocuments() {
    stage.innerHTML = `
      <div class="charge-analysis-conversation compact">
        ${userMessage("Não tenho nenhum extrato disponível.")}
        ${assistantMessage(`
          <p><strong>As faturas ou os extratos são necessários para continuar.</strong></p>
          <p>A IA AUDITA não consegue substituir documentos por estimativas. Sem ao menos um documento, não há base para calcular valores, gerar relatório técnico ou preparar uma eventual medida jurídica.</p>
          <p>Solicite os documentos ao Itaú pelos canais oficiais e retorne quando receber ao menos parte do período.</p>
        `, "Documentos necessários")}
      </div>
      <section class="charge-no-documents" aria-labelledby="chargeNoDocumentsTitle">
        <header>
          <p class="eyebrow">Como solicitar ao Itaú</p>
          <h3 id="chargeNoDocumentsTitle">Peça os extratos, o contrato e as autorizações</h3>
          <p>Além das faturas, solicite o contrato do cartão e os registros que comprovem a autorização de seguros ou serviços. Comece pelos canais digitais e peça o protocolo quando precisar registrar o atendimento.</p>
        </header>
        <ol class="charge-no-documents-channels">
          <li>
            <strong>App Itaú, app Itaú Cartões ou Itaú na internet</strong>
            <span>Consulte e baixe as faturas disponíveis na área de cartões.</span>
            <a href="${ITAU_INVOICE_CHANNELS_URL}" target="_blank" rel="noreferrer">Ver orientação oficial do Itaú</a>
          </li>
          <li>
            <strong>WhatsApp Itaú: 11 4004-4828</strong>
            <span>Envie a palavra “fatura” e confirme quais meses podem ser fornecidos.</span>
            <a href="${ITAU_INVOICE_CHANNELS_URL}" target="_blank" rel="noreferrer">Confirmar canal oficial</a>
          </li>
          <li>
            <strong>SAC Itaú: 0800 728 0728</strong>
            <span>Use o atendimento para solicitar o período que não estiver disponível nos canais digitais e anote o protocolo.</span>
            <a href="${ITAU_PHONE_CHANNELS_URL}" target="_blank" rel="noreferrer">Consultar telefones oficiais</a>
          </li>
          <li>
            <strong>Ouvidoria: 0800 570 0011</strong>
            <span>Use somente se uma solicitação anterior não tiver sido resolvida; tenha o protocolo em mãos.</span>
            <a href="${ITAU_OMBUDSMAN_URL}" target="_blank" rel="noreferrer">Abrir página oficial da Ouvidoria</a>
          </li>
        </ol>
        <div class="charge-document-request">
          <label for="chargeDocumentRequestTemplate">Carta completa para copiar e preencher</label>
          <textarea id="chargeDocumentRequestTemplate" rows="18" readonly>${escapeChargeHtml(ITAU_DOCUMENT_REQUEST_TEMPLATE)}</textarea>
          <p>Preencha apenas no canal oficial escolhido. A IA AUDITA não envia esta solicitação em seu nome.</p>
          <button type="button" class="secondary-action" data-charge-action="copy-document-request">Copiar carta</button>
          <span id="chargeDocumentRequestCopyStatus" role="status" aria-live="polite"></span>
        </div>
        <p class="charge-no-documents-warning"><strong>Guarde os protocolos e os arquivos recebidos.</strong> Esta orientação não promete restituição nem define uma tese jurídica.</p>
      </section>
      <div class="charge-result-actions charge-no-documents-actions">
        <button type="button" class="secondary-action" data-charge-action="back-documents">Voltar e revisar</button>
        <button type="button" class="primary-action" data-charge-action="resume-document-upload">Já tenho documentos para anexar</button>
      </div>
    `;
  }

  async function copyDocumentRequestTemplate() {
    const field = document.querySelector("#chargeDocumentRequestTemplate");
    const statusElement = document.querySelector("#chargeDocumentRequestCopyStatus");
    if (!field || !statusElement) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(ITAU_DOCUMENT_REQUEST_TEMPLATE);
      } else {
        field.focus();
        field.select();
        if (!document.execCommand("copy")) throw new Error("copy_failed");
      }
      statusElement.textContent = "Carta copiada.";
    } catch {
      field.focus();
      field.select();
      statusElement.textContent = "Selecione o texto e copie manualmente.";
    }
  }

  function renderUpload() {
    const files = state.selectedFiles.length
      ? state.selectedFiles
      : state.selectedFile
        ? [state.selectedFile]
        : [];
    const fileName = files.length === 1
      ? files[0].name
      : files.length > 1
        ? `${files.length} documentos selecionados`
        : "";
    const isCompleteHistory = state.documentAvailability === "complete";

    stage.innerHTML = `
      ${earlyJourneyMarkup({ documentSelected: true })}
      <form class="charge-upload-panel" id="chargeAnalysisUploadForm">
        <input
          class="hidden"
          id="chargeAnalysisFile"
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.csv,.txt,application/pdf,image/png,image/jpeg,text/csv,text/plain"
        />
        <label class="charge-upload-dropzone ${fileName ? "has-file" : ""}" for="chargeAnalysisFile" data-charge-upload-drop>
          <span class="charge-upload-icon" aria-hidden="true">
            <img src="assets/audita-logo-original.png" alt="" />
          </span>
          <strong>${fileName ? escapeChargeHtml(fileName) : isCompleteHistory ? "Anexar faturas ou extratos" : "Anexar documentos ou prints"}</strong>
          <small>${fileName ? "Clique para adicionar mais documentos" : "PDF, imagem, CSV ou TXT · até 12 MB por arquivo · seleção múltipla"}</small>
        </label>

        ${
          files.length
            ? `<ul class="charge-upload-file-list">${files
                .map((file, index) => `
                  <li>
                    <span>${escapeChargeHtml(file.name)}</span>
                    <small>${Math.max(1, Math.round(file.size / 1024))} KB</small>
                    <button
                      type="button"
                      data-charge-action="remove-upload-file"
                      data-charge-file-index="${index}"
                      aria-label="Remover ${escapeChargeHtml(file.name)}"
                    >Remover</button>
                  </li>
                `)
                .join("")}</ul>`
            : ""
        }

        <label class="charge-upload-consent">
          <input id="chargeAnalysisConsent" type="checkbox" ${state.consent ? "checked" : ""} />
          <span>Confirmo que sou titular do documento ou possuo autorização para realizar esta análise.</span>
        </label>

        <p class="charge-upload-privacy">Os arquivos são processados para esta análise e não ficam armazenados por este módulo. Dados sensíveis são mascarados antes da leitura automatizada quando aplicável.</p>

        <div class="charge-upload-actions">
          <button type="button" class="secondary-action" data-charge-action="back-documents">Voltar</button>
          <button type="submit" class="primary-action" ${!fileName || !state.consent ? "disabled" : ""}>
            ${files.length > 1 ? `Analisar ${files.length} documentos` : "Analisar documento"}
          </button>
        </div>
      </form>
    `;
  }

  function renderAnalyzing() {
    const files = state.selectedFiles.length ? state.selectedFiles : [state.selectedFile].filter(Boolean);
    stage.innerHTML = `
      ${earlyJourneyMarkup({ documentSelected: true })}
      <div class="charge-analysis-processing" role="status">
        <span class="charge-analysis-mark" aria-hidden="true">
          <img src="assets/audita-logo-original.png" alt="" />
        </span>
        <p class="eyebrow">Leitura em andamento</p>
        <h3>${files.length > 1 ? `Analisando ${files.length} documentos` : `Analisando ${escapeChargeHtml(files[0]?.name || "o documento")}`}</h3>
        <p>Estamos procurando lançamentos que merecem confirmação e organizando a base documental. Nenhuma conclusão jurídica será presumida.</p>
      </div>
    `;
  }

  function currentCalculation() {
    return buildChargeCalculationSnapshot(state.caseData || {}, {
      ipcaRates: state.ipcaRates,
      asOf: state.calculationAsOf,
    });
  }

  async function loadCalculationIndices() {
    if (state.ipcaRates.length) return;
    const response = await fetch(BCB_IPCA_URL, { headers: { accept: "application/json" } });
    const rates = await response.json().catch(() => []);
    if (!response.ok || !Array.isArray(rates) || !rates.length) {
      throw new Error("O índice IPCA não pôde ser consultado agora.");
    }
    state.ipcaRates = rates;
    state.calculationAsOf = new Date().toISOString().slice(0, 10);
  }

  async function openCalculation() {
    if (state.busy) return;
    state.busy = true;
    state.error = "";
    state.calculationWarning = "";
    renderReview();
    try {
      await loadCalculationIndices();
    } catch (error) {
      state.calculationWarning = error?.message || "Não foi possível calcular a correção monetária.";
    } finally {
      state.busy = false;
      const calculation = currentCalculation();
      state.screen = state.access?.entitled || !calculation.itemCount ? "result" : "paywall";
      render();
    }
  }

  function itauServiceTiers() {
    return state.billingCatalog?.itauChargeService?.tiers || [];
  }

  function selectedItauServiceTier(calculation) {
    const claimCents = Math.round(Number(calculation?.estimatedMaterialClaim || 0) * 100);
    return itauServiceTiers().find(
      (tier) => claimCents >= tier.minimumClaimCents && claimCents <= tier.maximumClaimCents,
    ) || null;
  }

  function tierRangeLabel(tier) {
    if (tier?.id === "itau-cobrancas-faixa-1") return "R$ 5 mil e R$ 10 mil";
    if (tier?.id === "itau-cobrancas-faixa-2") return "R$ 10 mil e R$ 20 mil";
    if (tier?.id === "itau-cobrancas-faixa-3") return "R$ 20 mil e R$ 32 mil";
    const minimum = Number(tier.minimumClaimCents || 0) / 100;
    const maximum = Number(tier.maximumClaimCents || 0) / 100;
    return minimum > 0
      ? `${formatChargeCurrency(minimum)} a ${formatChargeCurrency(maximum)}`
      : `Até ${formatChargeCurrency(maximum)}`;
  }

  function renderPaywall() {
    const calculation = currentCalculation();
    const tiers = itauServiceTiers();
    const selectedTier = selectedItauServiceTier(calculation);
    const claimCents = Math.round(Number(calculation.estimatedMaterialClaim || 0) * 100);
    const minimumClaimCents = Math.min(...tiers.map((tier) => Number(tier.minimumClaimCents || 0)));
    const belowMinimum = Number.isFinite(minimumClaimCents) && claimCents < minimumClaimCents;
    const checkoutReady = Boolean(selectedTier?.checkoutAvailable);
    stage.innerHTML = `
      <div class="charge-paywall">
        <section class="charge-paywall-result" role="status">
          <span class="charge-analysis-mark" aria-hidden="true"><img src="assets/audita-logo-original.png" alt="" /></span>
          <div>
            <p class="eyebrow">Simulação preliminar concluída</p>
            <h3>${selectedTier ? `Você pode ter entre ${escapeChargeHtml(tierRangeLabel(selectedTier))} para receber.` : belowMinimum ? "Esta simulação ficou abaixo da faixa atendida pela IA AUDITA." : "Esta simulação ficou fora das faixas atendidas automaticamente."}</h3>
            <p>${selectedTier ? "Contrate este caso para continuar com o relatório técnico e os próximos passos." : belowMinimum ? "No momento, atendemos casos a partir de R$ 4.999,99." : "O contato com o time IA AUDITA será disponibilizado em breve."}</p>
          </div>
        </section>

        ${selectedTier ? `
          <div class="charge-paywall-section-heading">
            <p class="eyebrow">Contratação única por caso</p>
            <h3>Continue seu caso com a IA AUDITA</h3>
            <p>Não é assinatura: você paga uma única vez para continuar este caso.</p>
          </div>
          <section id="chargePaywallPlans" class="charge-paywall-plans charge-paywall-tiers" aria-label="Oferta do serviço de cobranças indevidas">
              <article class="recommended selected">
                <div>
                  <span>${escapeChargeHtml(selectedTier.name)} <em>Sua faixa</em></span>
                  <p>Simulação entre ${escapeChargeHtml(tierRangeLabel(selectedTier))}</p>
                  <small class="charge-tier-full-price">De ${escapeChargeHtml(formatChargeCurrency(Number(selectedTier.fullPrice?.cents || 0) / 100))}</small>
                  <strong>${escapeChargeHtml(formatChargeCurrency(Number(selectedTier.price?.cents || 0) / 100))}</strong>
                  <b>${escapeChargeHtml(String(selectedTier.discountPercent))}% de desconto · pagamento único</b>
                </div>
                <button type="button" class="primary-action" data-charge-action="purchase-itau-service" ${state.busy || !checkoutReady ? "disabled" : ""}>${state.busy ? "Abrindo checkout..." : "Contratar e continuar"}</button>
              </article>
          </section>` : ""}
        ${selectedTier && !checkoutReady ? `<p class="charge-paywall-demo" role="note">A contratação está temporariamente indisponível. Tente novamente mais tarde.</p>` : ""}
        <p class="charge-paywall-legal-note">A simulação é preliminar e não garante restituição, indenização ou êxito judicial. Custas, consultas de terceiros e representação jurídica não estão incluídas, salvo informação expressa.</p>
        <div class="charge-result-actions"><button type="button" class="secondary-action" data-charge-action="new-document">Voltar aos documentos</button></div>
      </div>
    `;
  }

  async function purchaseItauService() {
    if (state.busy) return;
    state.busy = true;
    state.error = "";
    renderPaywall();
    try {
      const caseIds = state.caseBatches.map((item) => item.id).filter(Boolean);
      const response = await fetch("/api/itau-refund/checkout", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ caseIds, requestId: crypto.randomUUID() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "A contratação ainda não está disponível.");
      if (data.url) {
        sessionStorage.setItem("audita:itau-checkout-cases", JSON.stringify({
          caseIds,
          documentAvailability: state.documentAvailability,
          authorizationAnswer: state.authorizationAnswer,
          selectedBrand: state.selectedBrand,
          brandHistoryAnswer: state.brandHistoryAnswer,
        }));
        window.location.assign(data.url);
        return;
      }
    } catch (error) {
      state.error = error?.message || "Não foi possível contratar o serviço.";
    } finally {
      state.busy = false;
      render();
    }
  }

  function renderLawyerKit() {
    const product = state.billingCatalog?.itauLawyerKit;
    const documents = state.lawyerKit.documents.length
      ? state.lawyerKit.documents
      : [
          { title: "Processo completo", available: true },
          { title: "Sentença", available: true },
          { title: "Homologação do acordo", available: true },
          { title: "Decisão de suspensão por 24 meses", available: true },
        ];
    const entitled = Boolean(state.lawyerKit.access?.entitled);
    const price = Number(product?.price?.cents || 39999) / 100;
    stage.innerHTML = `
      <div class="charge-analysis-conversation compact">
        ${userMessage("Sou advogado(a).")}
        ${assistantMessage(`
          <p><strong>Kit profissional do caso Itaú</strong></p>
          <p>Acesse as peças judiciais reunidas para estudo do processo nº 5085307-63.2016.8.13.0024.</p>
        `, "IA AUDITA")}
      </div>
      <section class="charge-lawyer-kit" aria-labelledby="chargeLawyerKitTitle">
        <div class="charge-lawyer-kit-heading">
          <div>
            <p class="eyebrow">Pagamento único</p>
            <h3 id="chargeLawyerKitTitle">Kit profissional Itaú</h3>
            <p>Material documental para consulta e apoio à análise jurídica.</p>
          </div>
          <strong>${formatChargeCurrency(price)}</strong>
        </div>
        <ul class="charge-lawyer-kit-documents">
          ${documents.map((document) => `
            <li>
              <div>
                <strong>${escapeChargeHtml(document.title)}</strong>
                <small>${document.included === false ? "Não incluído" : "Documento incluído"}</small>
              </div>
              ${entitled && document.downloadUrl
                ? `<a class="secondary-action" href="${escapeChargeHtml(document.downloadUrl)}">Baixar PDF</a>`
                : `<span class="${document.included === false ? "pending" : "ready"}">${document.included === false ? "Não incluído" : "Incluído"}</span>`}
            </li>
          `).join("")}
        </ul>
        <p class="charge-lawyer-kit-note">O processo completo foi otimizado para carregamento progressivo sem reduzir a resolução. O material não substitui a conferência das peças no processo oficial.</p>
        ${state.lawyerKit.checkoutStatus === "success" && entitled
          ? `<p class="charge-lawyer-kit-success" role="status">Pagamento confirmado. Seus documentos estão liberados.</p>`
          : ""}
        ${state.lawyerKit.checkoutStatus === "cancelled"
          ? `<p class="charge-paywall-demo" role="status">Compra cancelada. Nenhum pagamento foi concluído.</p>`
          : ""}
        ${state.lawyerKit.error
          ? `<p class="charge-analysis-error" role="alert">${escapeChargeHtml(state.lawyerKit.error)}</p>`
          : ""}
        <div class="charge-result-actions">
          <button type="button" class="secondary-action" data-charge-action="back-triage">Voltar</button>
          ${entitled
            ? ""
            : `<button type="button" class="primary-action" data-charge-action="purchase-lawyer-kit" ${state.lawyerKit.loading || !product?.checkoutAvailable ? "disabled" : ""}>${state.lawyerKit.loading ? "Carregando..." : "Comprar kit"}</button>`}
        </div>
        ${!entitled && product && !product.checkoutAvailable
          ? `<p class="charge-paywall-demo" role="note">O checkout está temporariamente indisponível.</p>`
          : ""}
      </section>
    `;
  }

  async function loadLawyerKit() {
    state.lawyerKit.loading = true;
    state.lawyerKit.error = "";
    renderLawyerKit();
    try {
      const [catalogResponse, kitResponse] = await Promise.all([
        fetch("/api/billing/plans", { headers: { accept: "application/json" } }),
        fetch("/api/itau-lawyer-kit", { headers: { accept: "application/json" } }),
      ]);
      const catalog = await catalogResponse.json().catch(() => ({}));
      const kit = await kitResponse.json().catch(() => ({}));
      if (!catalogResponse.ok || !kitResponse.ok) {
        throw new Error("Não foi possível carregar o kit agora.");
      }
      state.billingCatalog = catalog;
      state.lawyerKit.access = kit.access || { entitled: false, source: "none" };
      state.lawyerKit.documents = Array.isArray(kit.documents) ? kit.documents : [];
    } catch (error) {
      state.lawyerKit.error = error?.message || "Não foi possível carregar o kit agora.";
    } finally {
      state.lawyerKit.loading = false;
      renderLawyerKit();
    }
  }

  async function purchaseLawyerKit() {
    if (state.lawyerKit.loading) return;
    state.lawyerKit.loading = true;
    state.lawyerKit.error = "";
    renderLawyerKit();
    try {
      const response = await fetch("/api/itau-lawyer-kit/checkout", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ requestId: crypto.randomUUID() }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        document.querySelector("#loginButton")?.click();
        throw new Error("Entre na IA AUDITA para comprar o kit.");
      }
      if (!response.ok || !data.url) {
        throw new Error(data.message || "A compra ainda não está disponível.");
      }
      window.location.assign(data.url);
    } catch (error) {
      state.lawyerKit.error = error?.message || "Não foi possível iniciar a compra.";
      state.lawyerKit.loading = false;
      renderLawyerKit();
    }
  }

  function clearLawyerKitCheckoutQuery() {
    const url = new URL(window.location.href);
    url.searchParams.delete("lawyer_kit_checkout");
    url.searchParams.delete("session_id");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  async function resumeLawyerKitCheckout() {
    const checkoutStatus = new URLSearchParams(window.location.search).get("lawyer_kit_checkout");
    if (!checkoutStatus) return false;
    triageStarted = true;
    state.route = "lawyer";
    state.authorizationAnswer = "professional";
    state.screen = "lawyer-kit";
    state.lawyerKit.checkoutStatus = checkoutStatus;
    clearLawyerKitCheckoutQuery();
    await loadLawyerKit();
    return true;
  }

  function clearItauCheckoutQuery() {
    const url = new URL(window.location.href);
    url.searchParams.delete("itau_checkout");
    url.searchParams.delete("session_id");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  async function resumeItauCheckout() {
    const checkoutStatus = new URLSearchParams(window.location.search).get("itau_checkout");
    if (!checkoutStatus) return false;
    triageStarted = true;
    if (checkoutStatus === "cancelled") {
      sessionStorage.removeItem("audita:itau-checkout-cases");
      clearItauCheckoutQuery();
      state.error = "A contratação foi cancelada. Nenhum pagamento foi concluído.";
      state.screen = "triage";
      render();
      return true;
    }

    let saved = {};
    try {
      const parsed = JSON.parse(sessionStorage.getItem("audita:itau-checkout-cases") || "{}");
      saved = Array.isArray(parsed) ? { caseIds: parsed } : parsed;
    } catch {
      saved = {};
    }
    const caseIds = Array.isArray(saved.caseIds) ? saved.caseIds.map(String).filter(Boolean) : [];
    if (!caseIds.length) {
      state.error = "Não foi possível localizar o caso desta contratação. Retome a análise pelos documentos.";
      state.screen = "triage";
      render();
      return true;
    }

    Object.assign(state, {
      documentAvailability: String(saved.documentAvailability || ""),
      authorizationAnswer: String(saved.authorizationAnswer || ""),
      selectedBrand: String(saved.selectedBrand || ""),
      brandHistoryAnswer: String(saved.brandHistoryAnswer || ""),
      busy: true,
      screen: "analyzing",
      error: "",
    });
    render();

    try {
      let cases = [];
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const responses = await Promise.all(
          caseIds.map(async (caseId) => {
            const response = await fetch(`/api/itau-refund/cases/${encodeURIComponent(caseId)}`, {
              headers: { accept: "application/json" },
            });
            return { response, data: await response.json().catch(() => ({})) };
          }),
        );
        if (responses.every(({ response, data }) => response.ok && data.case)) {
          cases = responses.map(({ data }) => data.case);
          break;
        }
        if (!responses.every(({ response }) => response.status === 402)) {
          throw new Error("Não foi possível reabrir a análise contratada.");
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
      if (!cases.length) {
        throw new Error("O pagamento foi recebido pela Stripe, mas a liberação ainda está sendo confirmada. Atualize esta página em alguns instantes.");
      }
      state.caseBatches = cases;
      state.caseData = aggregateChargeCases(cases);
      state.access = { entitled: true, source: "itau_charge_service", caseIds };
      try {
        await loadCalculationIndices();
      } catch (error) {
        state.calculationWarning = error?.message || "Não foi possível atualizar a correção monetária.";
      }
      state.screen = "result";
      sessionStorage.removeItem("audita:itau-checkout-cases");
      clearItauCheckoutQuery();
    } catch (error) {
      state.screen = "triage";
      state.error = error?.message || "Não foi possível confirmar a contratação agora.";
    } finally {
      state.busy = false;
      render();
    }
    return true;
  }

  function candidateMarkup(candidate, caseId) {
    const answer = String(candidate.answer || "pending");
    const date = String(candidate.date || "");
    const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))
      : "Data não identificada";
    const directed = candidate.origin === "directed_search";
    return `
      <article class="charge-result-candidate ${directed ? "directed" : "automatic"}">
        <div>
          <span class="charge-candidate-origin">${directed ? "Localizada por busca dirigida" : "Detectada automaticamente"}</span>
          <strong>${escapeChargeHtml(candidate.label || candidate.description || "Cobrança a revisar")}</strong>
          <small>${escapeChargeHtml(dateLabel)} · ${escapeChargeHtml(candidate.category || "lançamento")}</small>
          <small class="charge-candidate-evidence">Evidência: ${escapeChargeHtml(candidate.evidence || candidate.reason || "Descrição compatível encontrada no documento.")}</small>
        </div>
        <b>${candidate.amount == null ? "Valor não identificado" : formatChargeCurrency(candidate.amount)}</b>
        <div class="charge-result-answer" role="group" aria-label="Você reconhece esta contratação?">
          <small>Você reconhece esta contratação?</small>
          ${[
            ["recognized", "Reconheço"],
            ["not_recognized", "Não reconheço"],
            ["unknown", "Não sei"],
          ]
            .map(
              ([value, label]) => `
                <button
                  type="button"
                  class="${answer === value ? "active" : ""} ${value === "not_recognized" && answer === value ? "danger" : ""}"
                  data-charge-action="answer-candidate"
                  data-charge-case="${escapeChargeHtml(candidate.sourceCaseId || caseId)}"
                  data-charge-candidate="${escapeChargeHtml(candidate.id)}"
                  data-charge-answer="${value}"
                  ${state.busy ? "disabled" : ""}
                >${label}</button>
              `,
            )
            .join("")}
        </div>
      </article>
    `;
  }

  function candidateGroupsMarkup(candidates = [], caseId = "") {
    const groups = new Map();
    for (const candidate of candidates) {
      const source = candidate.sourceFileName || "Documento sem nome";
      if (!groups.has(source)) groups.set(source, []);
      groups.get(source).push(candidate);
    }
    return [...groups.entries()]
      .map(([source, items]) => `
        <section class="charge-review-file" aria-label="Lançamentos de ${escapeChargeHtml(source)}">
          <header>
            <div><small>Arquivo de origem</small><strong>${escapeChargeHtml(source)}</strong></div>
            <span>${items.length} ${items.length === 1 ? "ocorrência" : "ocorrências"}</span>
          </header>
          ${items.map((candidate) => candidateMarkup(candidate, caseId)).join("")}
        </section>
      `)
      .join("");
  }

  function directedSearchMarkup() {
    const search = state.directedSearch;
    return `
      <section class="charge-directed-search" aria-label="Busca dirigida nos anexos">
        <div>
          <strong>Não encontrou a cobrança que suspeita?</strong>
          <p>Informe apenas como ela aparece ou uma variação do nome. A IA AUDITA procurará nos documentos já enviados; você não informa valor nem data.</p>
        </div>
        ${
          search.open
            ? `<form id="chargeDirectedSearchForm">
                <label for="chargeDirectedSearchQuery">Nome ou descrição da cobrança</label>
                <div>
                  <input id="chargeDirectedSearchQuery" name="query" maxlength="120" minlength="3" value="${escapeChargeHtml(search.query)}" placeholder="Ex.: StreamPlay, proteção horizonte" required />
                  <button type="submit" class="primary-action" ${search.busy ? "disabled" : ""}>${search.busy ? "Procurando..." : "Procurar nos anexos"}</button>
                </div>
              </form>`
            : `<button type="button" class="secondary-action" data-charge-action="open-directed-search">Indicar uma cobrança para procurar nos meus anexos</button>`
        }
        ${search.message ? `<p class="charge-directed-search-message" role="status">${escapeChargeHtml(search.message)}</p>` : ""}
        ${search.error ? `<p class="charge-directed-search-error" role="alert">${escapeChargeHtml(search.error)}</p>` : ""}
      </section>
    `;
  }

  function aggregateChargeCases(cases = []) {
    const validCases = cases.filter(Boolean);
    const candidates = validCases.flatMap((caseData) =>
      (Array.isArray(caseData.candidates) ? caseData.candidates : []).map((candidate) => ({
        ...candidate,
        sourceCaseId: caseData.id,
        sourceFileName: caseData.document?.fileName || "",
      })),
    );
    const pending = candidates.some(
      (candidate) => !candidate.answer || candidate.answer === "pending",
    );
    const disputed = candidates.some((candidate) => candidate.answer === "not_recognized");
    const recognized = candidates.length > 0 && candidates.every(
      (candidate) => candidate.answer === "recognized",
    );
    const classification = !candidates.length
      ? "no_candidate_found"
      : pending
        ? "review_required"
        : disputed
          ? "possible_unauthorized"
          : recognized
            ? "recognized_charges"
            : "review_required";

    return {
      id: validCases[0]?.id || "",
      cases: validCases,
      candidates,
      document: {
        fileName: validCases.length > 1
          ? `${validCases.length} documentos analisados`
          : validCases[0]?.document?.fileName || "Documento analisado",
      },
      evaluation: { classification },
    };
  }

  function renderReview() {
    const caseData = state.caseData || {};
    const candidates = Array.isArray(caseData.candidates) ? caseData.candidates : [];
    const audit = buildChargeAuditSnapshot(caseData);

    stage.innerHTML = `
      <div class="charge-result-heading">
        <div>
          <p class="eyebrow">Revisão dos documentos</p>
          <h3>Confirme cada ocorrência localizada</h3>
          <p>Revise descrição, data, valor, evidência e arquivo de origem. O cálculo só será aberto depois desta confirmação.</p>
        </div>
        <span>${audit.pendingCount} pendente${audit.pendingCount === 1 ? "" : "s"}</span>
      </div>

      <section class="charge-result-candidates" aria-label="Lançamentos encontrados">
        ${
          candidates.length
            ? candidateGroupsMarkup(candidates, caseData.id)
            : `
              <div class="charge-analysis-empty">
                <strong>Nenhuma descrição conhecida foi localizada.</strong>
                <p>Isso não certifica que os documentos estejam corretos. Você pode indicar um nome para a IA AUDITA procurar nos próprios anexos.</p>
              </div>
            `
        }
      </section>

      ${directedSearchMarkup()}

      <div class="charge-result-actions">
        <button type="button" class="secondary-action" data-charge-action="new-document">Revisar documentos</button>
        <button type="button" class="primary-action" data-charge-action="confirm-review" ${!candidates.length || audit.pendingCount ? "disabled" : ""}>Confirmar revisão e calcular</button>
      </div>
    `;
  }

  function renderResult() {
    const calculation = currentCalculation();
    const tiers = itauServiceTiers();
    const selectedTier = selectedItauServiceTier(calculation);
    const claimCents = Math.round(Number(calculation.estimatedMaterialClaim || 0) * 100);
    const minimumClaimCents = Math.min(...tiers.map((tier) => Number(tier.minimumClaimCents || 0)));
    const belowMinimum = Number.isFinite(minimumClaimCents) && claimCents < minimumClaimCents;
    const isPartialHistory = state.documentAvailability === "partial";
    const reportFooter = isPartialHistory
      ? "Esta apuração é parcial e limitada aos documentos enviados. Ela não comprova integralmente períodos ausentes e não contém estimativas."
      : "Esta apuração usa somente os lançamentos presentes nos documentos enviados e confirmados como não reconhecidos.";

    stage.innerHTML = `
      <div class="charge-result-heading">
        <div>
          <p class="eyebrow">Simulação concluída</p>
          <h3>${selectedTier ? `Você pode ter entre ${escapeChargeHtml(tierRangeLabel(selectedTier))} para receber.` : belowMinimum ? "Esta simulação ficou abaixo da faixa atendida pela IA AUDITA." : "Esta simulação ficou fora das faixas atendidas automaticamente."}</h3>
          <p>${selectedTier ? "A faixa considera somente cobranças encontradas nos anexos e confirmadas por você como não reconhecidas." : belowMinimum ? "No momento, atendemos casos a partir de R$ 4.999,99." : "O contato com o time IA AUDITA será disponibilizado em breve."}</p>
        </div>
      </div>

      <section class="charge-audit-report" aria-label="Resumo da simulação">
        <footer>
          <p>${reportFooter} O valor exato e a memória de cálculo permanecem no relatório técnico para revisão. A faixa não garante restituição, indenização ou êxito judicial.</p>
          ${state.calculationWarning ? `<p>${escapeChargeHtml(state.calculationWarning)}</p>` : ""}
        </footer>
      </section>

      <div class="charge-result-actions">
        <button type="button" class="secondary-action" data-charge-action="back-to-review">Voltar à revisão</button>
        ${selectedTier ? documentationActionMarkup() : ""}
      </div>
    `;
  }

  function formatRecoveryCpf(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }

  function formatRecoveryPhone(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits ? `(${digits}` : "";
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  function formatRecoveryPostalCode(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
    return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
  }

  function normalizeRecoveryText(value) {
    return String(value || "").normalize("NFC").replace(/\s+/g, " ").trim();
  }

  function renderRecoveryIntro() {
    const loadingCopy = state.recovery.loading
      ? "Carregando seus dados seguros..."
      : "Preparar Relatório Técnico";
    stage.innerHTML = `
      <div class="charge-analysis-conversation charge-recovery-conversation">
        ${assistantMessage(`
          <p><strong>A análise terminou. Agora vamos organizar o caminho para buscar a restituição.</strong></p>
          <p>A IA AUDITA não libera o dinheiro automaticamente. Ela ajuda você a reunir a prova, documentar o caso e chegar ao canal adequado com as informações organizadas.</p>
        `, "IA AUDITA · Recuperação")}
        ${assistantMessage(`
          <p><strong>Agora você pode preparar a documentação para avaliar o Juizado Especial Cível.</strong></p>
          <p>O Relatório Técnico de Auditoria reúne os dados da análise e organiza uma minuta para revisão. Depois do PDF, você escolhe o estado e recebe o passo a passo do tribunal. O protocolo final continua sendo feito por você.</p>
        `, "IA AUDITA · Próxima etapa")}
      </div>
      <div class="charge-recovery-actions">
        <button type="button" class="secondary-action" data-charge-action="back-to-result">Voltar à análise</button>
        <button type="button" class="primary-action" data-charge-action="open-recovery-report" ${state.recovery.loading ? "disabled" : ""}>${loadingCopy}</button>
      </div>
    `;
  }

  function recoveryUfOptions(selectedUf = "") {
    return RECOVERY_UFS.map(
      (uf) => `<option value="${uf}" ${selectedUf === uf ? "selected" : ""}>${uf}</option>`,
    ).join("");
  }

  function recoveryMissingFieldsMarkup(prepared) {
    const missingFields = Array.isArray(prepared?.missingFields)
      ? prepared.missingFields
      : [];
    if (!missingFields.length) return "";
    return `
      <p class="charge-recovery-form-error" role="alert">
        Revise: ${missingFields
          .map((field) => RECOVERY_FIELD_LABELS[field] || field)
          .map(escapeChargeHtml)
          .join(", ")}.
      </p>
    `;
  }

  function recoveryReportFormMarkup() {
    const claimant = state.recovery.claimant || {};
    const prepared = state.recovery.prepared;
    const calculatedValues = state.recovery.handoff?.suggestion?.values || {};
    const historicalDocumentsAvailable =
      claimant.historicalDocumentsAvailable ||
      state.recovery.handoff?.caseData?.answers?.historicalDocumentsAvailable ||
      "";
    const reportButtonLabel = prepared ? "Atualizar relatório" : "Preparar relatório";
    return `
      <form class="charge-recovery-form" id="chargeRecoveryForm" aria-busy="${state.recovery.busy}">
        ${state.recovery.error ? `<p class="charge-recovery-form-error" role="alert">${escapeChargeHtml(state.recovery.error)}</p>` : ""}
        <div class="charge-recovery-form-heading">
          <div>
            <p class="eyebrow">Relatório Técnico de Auditoria</p>
            <h3>Confira os dados que entrarão no PDF</h3>
          </div>
          <span>${state.recovery.handoff?.journey === "with_historical_documents" ? "Modelo 1" : "Modelo 2"}</span>
        </div>
        <p class="charge-recovery-form-intro">Esses dados são usados somente para montar o documento. A UF e a cidade abaixo correspondem ao seu endereço e ajudam a preparar a minuta; o tribunal será confirmado na etapa seguinte.</p>

        <div class="charge-recovery-form-grid">
          <label class="wide"><span>Nome completo</span><input name="fullName" required maxlength="160" autocomplete="name" value="${escapeChargeHtml(claimant.fullName || "")}" /></label>
          <label><span>CPF</span><input name="document" required inputmode="numeric" maxlength="14" autocomplete="off" data-recovery-mask="cpf" placeholder="000.000.000-00" value="${escapeChargeHtml(formatRecoveryCpf(claimant.document || ""))}" /></label>
          <label><span>RG</span><input name="rg" required maxlength="40" autocomplete="off" value="${escapeChargeHtml(claimant.rg || "")}" /></label>
          <label><span>Nacionalidade</span><select name="nationality" required><option value="">Selecione</option><option value="Brasileiro(a)" ${String(claimant.nationality || "").toLowerCase().startsWith("brasileir") ? "selected" : ""}>Brasileiro(a)</option><option value="Estrangeiro(a)" ${String(claimant.nationality || "").toLowerCase().startsWith("estrangeir") ? "selected" : ""}>Estrangeiro(a)</option></select></label>
          <label><span>Estado civil</span><select name="maritalStatus" required><option value="">Selecione</option>${["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "Separado(a)", "União estável"].map((value) => `<option value="${value}" ${String(claimant.maritalStatus || "").toLowerCase().startsWith(value.replace("(a)", "").slice(0, 5).toLowerCase()) ? "selected" : ""}>${value}</option>`).join("")}</select></label>
          <label><span>Profissão</span><input name="profession" required maxlength="120" autocomplete="organization-title" value="${escapeChargeHtml(claimant.profession || "")}" /></label>
          <label><span>E-mail</span><input name="email" required type="email" maxlength="160" autocomplete="email" value="${escapeChargeHtml(claimant.email || "")}" /></label>
          <label><span>Telefone</span><input name="phone" required inputmode="tel" maxlength="15" autocomplete="tel" data-recovery-mask="phone" placeholder="(00) 00000-0000" value="${escapeChargeHtml(formatRecoveryPhone(claimant.phone || ""))}" /></label>
          <label><span>Agência Itaú <small>opcional</small></span><input name="bankAgency" inputmode="numeric" maxlength="20" autocomplete="off" placeholder="Ex.: 1234" value="${escapeChargeHtml(claimant.bankAgency || "")}" /></label>
        </div>

        <div class="charge-recovery-section-title"><strong>Endereço</strong><span>Usado para identificar o consumidor e a competência territorial.</span></div>
        <div class="charge-recovery-form-grid">
          <label><span>CEP</span><input name="postalCode" required inputmode="numeric" maxlength="9" autocomplete="postal-code" data-recovery-mask="postalCode" placeholder="00000-000" value="${escapeChargeHtml(formatRecoveryPostalCode(claimant.postalCode || ""))}" /></label>
          <label><span>Bairro</span><input name="district" required maxlength="80" autocomplete="address-level3" value="${escapeChargeHtml(claimant.district || "")}" /></label>
          <label class="wide"><span>Logradouro</span><input name="street" required maxlength="160" autocomplete="address-line1" value="${escapeChargeHtml(claimant.street || "")}" /></label>
          <label><span>Número</span><input name="addressNumber" required maxlength="20" autocomplete="address-line2" value="${escapeChargeHtml(claimant.addressNumber || "")}" /></label>
          <label><span>Complemento <small>opcional</small></span><input name="addressComplement" maxlength="80" autocomplete="address-line3" value="${escapeChargeHtml(claimant.addressComplement || "")}" /></label>
          <label><span>UF do seu endereço</span><select name="uf" required><option value="">Selecione</option>${recoveryUfOptions(String(claimant.uf || "").toUpperCase())}</select></label>
          <label><span>Cidade</span><input name="city" required maxlength="100" autocomplete="address-level2" value="${escapeChargeHtml(claimant.city || "")}" /></label>
        </div>

        <input type="hidden" name="historicalDocumentsAvailable" value="${escapeChargeHtml(historicalDocumentsAvailable)}" />
        <input type="hidden" name="doubleRefundAmount" value="${escapeChargeHtml(calculatedValues.doubleRefundAmount ?? claimant.doubleRefundAmount ?? "")}" />
        <input type="hidden" name="caseValue" value="${escapeChargeHtml(calculatedValues.caseValue ?? claimant.caseValue ?? "")}" />
        <input type="hidden" name="lostProfitsAmount" value="${escapeChargeHtml(calculatedValues.lostProfitsAmount ?? claimant.lostProfitsAmount ?? "")}" />
        <input type="hidden" name="moralDamagesAmount" value="${escapeChargeHtml(calculatedValues.moralDamagesAmount ?? claimant.moralDamagesAmount ?? "")}" />

        ${recoveryMissingFieldsMarkup(prepared)}
        ${prepared ? `
          <section class="charge-recovery-preview" aria-label="Prévia do Relatório Técnico">
            <div><strong>${prepared.ready ? "Relatório pronto para revisão" : "Relatório incompleto"}</strong><span>${escapeChargeHtml(prepared.template?.label || "")}</span></div>
            <details><summary>Revisar conteúdo do PDF</summary><pre>${escapeChargeHtml(prepared.draft || "")}</pre></details>
            ${Array.isArray(prepared.warnings) && prepared.warnings.length ? `<details><summary>Avisos importantes</summary><ul>${prepared.warnings.map((warning) => `<li>${escapeChargeHtml(warning)}</li>`).join("")}</ul></details>` : ""}
          </section>
        ` : ""}

        <div class="charge-recovery-form-actions">
          <button type="button" class="secondary-action" data-charge-action="back-to-recovery-intro">Voltar</button>
          <button type="submit" class="secondary-action" data-recovery-submit="prepare" ${state.recovery.busy ? "disabled" : ""}>${state.recovery.busy ? "Processando..." : reportButtonLabel}</button>
          ${prepared?.ready ? `<button type="button" class="primary-action" data-charge-action="open-recovery-testimony" ${state.recovery.busy ? "disabled" : ""}>Continuar para o depoimento</button>` : ""}
        </div>
      </form>
    `;
  }

  function renderRecoveryReport() {
    stage.innerHTML = `
      <div class="charge-analysis-conversation charge-recovery-conversation compact">
        ${assistantMessage(`
          <p><strong>Agora vou montar o seu Relatório Técnico de Auditoria.</strong></p>
          <p>Confira seus dados pessoais e o endereço. Os valores calculados na análise serão incluídos automaticamente. O documento organiza a análise e a minuta, mas ainda deve ser revisado por você ou por um profissional antes do protocolo.</p>
        `, "IA AUDITA · Relatório")}
      </div>
      ${recoveryReportFormMarkup()}
    `;
  }

  function recoveryTestimonyMarkup() {
    const testimony = state.recovery.testimony || {};
    const hasRefinedText = Boolean(testimony.refined);
    return `
      <form class="charge-recovery-form charge-recovery-testimony" id="chargeRecoveryTestimonyForm" aria-busy="${state.recovery.busy}">
        ${state.recovery.error ? `<p class="charge-recovery-form-error" role="alert">${escapeChargeHtml(state.recovery.error)}</p>` : ""}
        <div class="charge-recovery-form-heading">
          <div>
            <p class="eyebrow">Relato pessoal</p>
            <h3>Conte o que aconteceu com suas palavras</h3>
          </div>
          <span>Etapa obrigatória</span>
        </div>
        <p class="charge-recovery-form-intro">Descreva somente fatos que você conhece. A IA vai organizar a redação, sem criar informações, e você poderá revisar tudo antes do PDF.</p>
        <div class="charge-testimony-prompts" aria-label="Pontos que podem ajudar no relato">
          <span>O que foi cobrado</span>
          <span>Quando você percebeu</span>
          <span>Desde quando ocorre</span>
          <span>Por que não reconhece a contratação</span>
        </div>
        <label class="charge-testimony-field">
          <span>Seu depoimento</span>
          <textarea name="originalTestimony" required minlength="40" maxlength="5000" rows="8" placeholder="Ex.: Percebi na minha fatura uma cobrança mensal identificada como...">${escapeChargeHtml(testimony.original || "")}</textarea>
          <small>Não inclua senhas, dados do cartão ou informações que não queira inserir no documento.</small>
        </label>
        ${hasRefinedText ? `
          <div class="charge-recovery-section-title"><strong>Texto ajustado pela IA</strong><span>Edite qualquer trecho que não corresponda exatamente ao seu relato.</span></div>
          <label class="charge-testimony-field">
            <span>Versão que entrará no documento</span>
            <textarea name="refinedTestimony" required minlength="40" maxlength="5000" rows="8">${escapeChargeHtml(testimony.refined)}</textarea>
          </label>
          <label class="charge-testimony-confirmation">
            <input type="checkbox" name="testimonyReviewed" ${testimony.reviewed ? "checked" : ""} />
            <span>Revisei o texto e confirmo que ele corresponde aos fatos que relatei.</span>
          </label>
        ` : ""}
        <div class="charge-recovery-form-actions">
          <button type="button" class="secondary-action" data-charge-action="back-to-recovery-report">Voltar</button>
          <button type="submit" class="${hasRefinedText ? "secondary-action" : "primary-action"}" data-testimony-submit="refine" ${state.recovery.busy ? "disabled" : ""}>${state.recovery.busy ? "Ajustando..." : hasRefinedText ? "Ajustar novamente" : "Ajustar texto com IA"}</button>
          ${hasRefinedText ? `<button type="submit" class="primary-action" data-testimony-submit="pdf" ${state.recovery.busy ? "disabled" : ""}>${state.recovery.busy ? "Gerando..." : "Gerar Relatório Técnico em PDF"}</button>` : ""}
        </div>
      </form>
    `;
  }

  function renderRecoveryTestimony() {
    stage.innerHTML = `
      <div class="charge-analysis-conversation charge-recovery-conversation compact">
        ${assistantMessage(`
          <p><strong>Agora quero registrar a sua versão dos fatos.</strong></p>
          <p>Esse relato torna o documento individual. Escreva do seu jeito; eu vou apenas melhorar a clareza e a organização, sem acrescentar informações.</p>
        `, "IA AUDITA · Depoimento")}
      </div>
      ${recoveryTestimonyMarkup()}
    `;
  }

  function selectedRecoveryPortal() {
    const selectedUf = state.recovery.guideUf || state.recovery.claimant?.uf || "";
    const portals = state.recovery.portals || [];
    const selected = portals.find((portal) => portal.uf === selectedUf);
    if (selected) return selected;
    const preparedPortal = state.recovery.prepared?.portal;
    return preparedPortal?.uf === selectedUf ? preparedPortal : null;
  }

  function recoveryGuideSteps(portal) {
    const manualSteps = portal?.manualFiling?.steps;
    if (Array.isArray(manualSteps) && manualSteps.length) return manualSteps;
    return [
      `Acesse o canal oficial do ${portal?.tribunal || "tribunal"}.`,
      "Confirme a comarca, a unidade e se o caso deve seguir pelo Juizado Especial Cível.",
      "Faça o login, cadastro ou atendimento somente no ambiente oficial quando solicitado.",
      "Apresente os dados do consumidor, do banco e o relato conforme o relatório revisado.",
      "Anexe o Relatório Técnico, documento pessoal, comprovante de residência e as provas disponíveis.",
      "Revise todas as informações e conclua pessoalmente o protocolo ou atendimento.",
    ];
  }

  function recoveryGuideMarkup() {
    const portal = selectedRecoveryPortal();
    if (!state.recovery.guideUf) {
      return `<div class="charge-recovery-guide-empty"><strong>Selecione o estado</strong><p>O roteiro correspondente aparecerá aqui.</p></div>`;
    }
    if (!portal) {
      return `<div class="charge-recovery-guide-empty"><strong>Guia indisponível</strong><p>Não foi possível carregar o tribunal desta UF agora.</p></div>`;
    }
    const steps = recoveryGuideSteps(portal);
    const requirements = Array.isArray(portal.requirements) ? portal.requirements : [];
    const humanOnly = Array.isArray(portal.guide?.humanOnly) ? portal.guide.humanOnly : [];
    const notes = Array.isArray(portal.guide?.caseNotes) ? portal.guide.caseNotes : [];
    const eligibility = state.recovery.prepared?.smallClaimsEligibility || portal.manualFiling?.smallClaims || null;
    const aboveLimit = eligibility?.status === "above_limit";
    const limitLabel = eligibility?.maximumCaseValueBrl
      ? formatChargeCurrency(eligibility.maximumCaseValueBrl)
      : "20 salários mínimos";
    const caseValueLabel = eligibility?.caseValue
      ? formatChargeCurrency(eligibility.caseValue)
      : "valor ainda não confirmado";
    return `
      <section class="charge-recovery-guide" aria-label="Passo a passo do ${escapeChargeHtml(portal.tribunal || "tribunal")}">
        <header><div><p class="eyebrow">${escapeChargeHtml(portal.uf)}</p><h3>${escapeChargeHtml(portal.name || portal.tribunal)}</h3></div><span>${escapeChargeHtml(portal.tribunal || "")}</span></header>
        <div class="charge-small-claims-explainer ${aboveLimit ? "is-blocked" : "is-eligible"}" role="note">
          <strong>${aboveLimit ? "Este caso ultrapassa o limite atendido pela IA AUDITA" : "O que são pequenas causas?"}</strong>
          <p>Pequenas causas são tratadas no Juizado Especial Cível. A IA AUDITA orienta, por enquanto, somente casos de até 20 salários mínimos. Nessa faixa, o advogado é facultativo na primeira instância. Em 2026, esse limite corresponde a ${escapeChargeHtml(limitLabel)}.</p>
          ${eligibility?.known ? `<span>Valor da causa nesta simulação: ${escapeChargeHtml(caseValueLabel)}.</span>` : ""}
          ${aboveLimit ? "" : `
            <details>
              <summary>Entenda advogado, custos e recursos</summary>
              <ul>
                <li>O ingresso no Juizado Especial não exige pagamento antecipado de custas, taxas ou despesas em primeiro grau.</li>
                <li>A sentença de primeiro grau não condena o vencido em custas e honorários, salvo litigância de má-fé.</li>
                <li>Em recurso, a representação por advogado é obrigatória e pode haver preparo, custas e honorários conforme o resultado e eventual gratuidade.</li>
                <li>Ausência em audiência e outras situações processuais podem gerar consequências. Por isso, não existe garantia de “risco zero”.</li>
              </ul>
              <a href="${JEC_LAW_URL}" target="_blank" rel="noreferrer">Consultar a Lei 9.099/1995</a>
            </details>
          `}
        </div>
        ${aboveLimit ? `
          <div class="charge-recovery-contact-placeholder">
            <strong>Este caso precisa de atendimento profissional</strong>
            <p>Como o valor ultrapassa 20 salários mínimos, não vamos direcionar você ao protocolo de pequenas causas. O contato com o time IA AUDITA será disponibilizado em breve.</p>
            <button type="button" class="secondary-action" disabled>Falar com o time IA AUDITA · em breve</button>
          </div>
        ` : `
          <ol>${steps.map((step) => `<li><span>${escapeChargeHtml(step)}</span></li>`).join("")}</ol>
          ${requirements.length ? `<details><summary>O que separar antes de começar</summary><ul>${requirements.map((item) => `<li>${escapeChargeHtml(item)}</li>`).join("")}</ul></details>` : ""}
          ${humanOnly.length ? `<details><summary>Etapas que dependem de você</summary><ul>${humanOnly.map((item) => `<li>${escapeChargeHtml(item)}</li>`).join("")}</ul></details>` : ""}
          ${notes.length ? `<p class="charge-recovery-guide-note">${escapeChargeHtml(notes.join(" "))}</p>` : ""}
          <div class="charge-recovery-guide-actions">
            <a class="primary-action" href="${escapeChargeHtml(portal.startUrl || portal.officialUrl || "#")}" target="_blank" rel="noreferrer">Abrir portal oficial</a>
            ${portal.officialUrl && portal.officialUrl !== portal.startUrl ? `<a class="secondary-action" href="${escapeChargeHtml(portal.officialUrl)}" target="_blank" rel="noreferrer">Ver orientações do tribunal</a>` : ""}
          </div>
          <small>O login, a escolha da unidade, os anexos e o protocolo final são realizados pelo usuário. A IA AUDITA não envia o processo automaticamente.</small>
        `}
      </section>
    `;
  }

  function renderRecoveryGuide() {
    const selectedUf = state.recovery.guideUf || "";
    stage.innerHTML = `
      <div class="charge-analysis-conversation charge-recovery-conversation compact">
        ${assistantMessage(`
          <p><strong>Seu Relatório Técnico foi gerado.</strong></p>
          <p>Agora selecione o estado onde pretende iniciar a pequena causa. A IA AUDITA mostrará o caminho oficial conhecido para o tribunal, mas você ainda deve confirmar a comarca e a competência territorial.</p>
        `, "IA AUDITA · Tribunal")}
      </div>
      <section class="charge-recovery-tribunal-picker">
        <label><span>Estado do tribunal</span><select id="chargeRecoveryGuideUf"><option value="">Selecione</option>${recoveryUfOptions(selectedUf)}</select></label>
        <p>Normalmente o consumidor inicia o pedido no local do seu domicílio. Confirme essa informação antes de protocolar.</p>
      </section>
      ${recoveryGuideMarkup()}
      <div class="charge-recovery-actions">
        <button type="button" class="secondary-action" data-charge-action="back-to-recovery-report">Revisar relatório</button>
        <button type="button" class="secondary-action" data-charge-action="download-report-again" ${state.recovery.busy ? "disabled" : ""}>${state.recovery.busy ? "Gerando..." : "Baixar relatório novamente"}</button>
        <button type="button" class="primary-action" data-charge-action="restart">Iniciar nova análise</button>
      </div>
    `;
  }

  function renderRecovery() {
    if (state.recovery.phase === "guide") renderRecoveryGuide();
    else if (state.recovery.phase === "testimony") renderRecoveryTestimony();
    else if (state.recovery.phase === "report") renderRecoveryReport();
    else renderRecoveryIntro();
  }

  function readRecoveryClaimant(form) {
    const data = new FormData(form);
    return {
      uf: String(data.get("uf") || "").trim().toUpperCase(),
      city: normalizeRecoveryText(data.get("city")),
      fullName: normalizeRecoveryText(data.get("fullName")),
      document: String(data.get("document") || "").replace(/\D/g, "").slice(0, 11),
      rg: normalizeRecoveryText(data.get("rg")).toLocaleUpperCase("pt-BR"),
      nationality: normalizeRecoveryText(data.get("nationality")),
      maritalStatus: normalizeRecoveryText(data.get("maritalStatus")),
      profession: normalizeRecoveryText(data.get("profession")),
      email: normalizeRecoveryText(data.get("email")).toLocaleLowerCase("pt-BR"),
      phone: String(data.get("phone") || "").replace(/\D/g, "").slice(0, 11),
      bankAgency: normalizeRecoveryText(data.get("bankAgency")),
      postalCode: String(data.get("postalCode") || "").replace(/\D/g, "").slice(0, 8),
      street: normalizeRecoveryText(data.get("street")),
      addressNumber: normalizeRecoveryText(data.get("addressNumber")),
      addressComplement: normalizeRecoveryText(data.get("addressComplement")),
      district: normalizeRecoveryText(data.get("district")),
      historicalDocumentsAvailable: String(data.get("historicalDocumentsAvailable") || "").trim(),
      doubleRefundAmount: String(data.get("doubleRefundAmount") || "").trim(),
      lostProfitsAmount: String(data.get("lostProfitsAmount") || "").trim(),
      moralDamagesAmount: String(data.get("moralDamagesAmount") || "").trim(),
      caseValue: String(data.get("caseValue") || "").trim(),
    };
  }

  function recoveryPayload(claimant = state.recovery.claimant) {
    const caseData = state.recovery.handoff?.caseData || {};
    const reviewedTestimony = String(state.recovery.testimony?.refined || "").trim();
    return {
      caseData: {
        ...caseData,
        answers: {
          ...(caseData.answers || {}),
          ...(reviewedTestimony
            ? {
                consumerTestimony: {
                  original: String(state.recovery.testimony?.original || "").trim(),
                  refined: reviewedTestimony,
                  reviewed: true,
                },
              }
            : {}),
        },
      },
      claimant,
      uf: claimant?.uf || "",
      city: claimant?.city || "",
    };
  }

  function recoveryApiError(data = {}, fallback = "Não foi possível concluir esta etapa.") {
    if (Array.isArray(data.missingFields) && data.missingFields.length) {
      return `Revise: ${data.missingFields
        .map((field) => RECOVERY_FIELD_LABELS[field] || field)
        .join(", ")}.`;
    }
    return data.message || fallback;
  }

  function readRecoveryTestimony(form) {
    const data = new FormData(form);
    return {
      original: String(data.get("originalTestimony") || "").normalize("NFC").trim().slice(0, 5000),
      refined: String(data.get("refinedTestimony") || "").normalize("NFC").trim().slice(0, 5000),
      reviewed: data.get("testimonyReviewed") === "on",
    };
  }

  async function refineRecoveryTestimony(form) {
    if (state.recovery.busy) return;
    const testimony = readRecoveryTestimony(form);
    state.recovery.testimony = { ...testimony, reviewed: false };
    state.recovery.busy = true;
    state.recovery.error = "";
    render();

    try {
      const response = await fetch("/api/jec/testimony/refine", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ testimony: testimony.original }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        document.querySelector("#loginButton")?.click();
        throw new Error("Entre na IA AUDITA para ajustar o seu depoimento.");
      }
      if (!response.ok || !data.testimony?.refined) {
        throw new Error(recoveryApiError(data, "Não foi possível ajustar o depoimento agora."));
      }
      state.recovery.testimony = {
        original: data.testimony.original || testimony.original,
        refined: data.testimony.refined,
        reviewed: false,
      };
    } catch (error) {
      state.recovery.error = error?.message || "Falha ao ajustar o depoimento.";
    } finally {
      state.recovery.busy = false;
      state.recovery.phase = "testimony";
      render();
    }
  }

  async function prepareRecoveryReport(form) {
    if (state.recovery.busy) return;
    const claimant = readRecoveryClaimant(form);
    state.recovery.claimant = claimant;
    state.recovery.busy = true;
    state.recovery.error = "";
    render();

    try {
      const response = await fetch("/api/jec/petitions/prepare", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(recoveryPayload(claimant)),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        document.querySelector("#loginButton")?.click();
        throw new Error("Entre na IA AUDITA para preparar o Relatório Técnico.");
      }
      if (!response.ok || !data.prepared) {
        throw new Error(recoveryApiError(data, "Não foi possível preparar o relatório agora."));
      }
      state.recovery.prepared = data.prepared;
      state.recovery.error = data.prepared.ready
        ? ""
        : recoveryApiError(data.prepared, "Revise os campos indicados.");
    } catch (error) {
      state.recovery.error = error?.message || "Falha ao preparar o Relatório Técnico.";
    } finally {
      state.recovery.busy = false;
      state.recovery.phase = "report";
      render();
    }
  }

  async function downloadRecoveryReport(claimant = state.recovery.claimant) {
    if (
      state.recovery.busy ||
      !state.recovery.prepared?.ready ||
      !state.recovery.testimony?.reviewed
    ) return;
    state.recovery.busy = true;
    state.recovery.error = "";
    render();

    try {
      const response = await fetch("/api/jec/petitions/pdf", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/pdf" },
        body: JSON.stringify({
          ...recoveryPayload(claimant),
          reviewConfirmed: true,
          testimonyReviewed: true,
        }),
      });
      if (response.status === 401) {
        document.querySelector("#loginButton")?.click();
        throw new Error("Entre na IA AUDITA para gerar o Relatório Técnico.");
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(recoveryApiError(data, "Não foi possível gerar o PDF agora."));
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const fileName =
        disposition.match(/filename="([^"]+)"/i)?.[1] ||
        "relatorio-tecnico-auditoria-itau.pdf";
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      state.recovery.pdfGeneratedAt = new Date().toISOString();
      state.recovery.guideUf = claimant.uf || state.recovery.guideUf || "";
      state.recovery.phase = "guide";
    } catch (error) {
      state.recovery.error = error?.message || "Falha ao gerar o Relatório Técnico.";
      state.recovery.phase = "testimony";
    } finally {
      state.recovery.busy = false;
      render();
    }
  }

  function renderEnded() {
    stage.innerHTML = `
      <div class="charge-analysis-finish">
        <span class="charge-analysis-mark" aria-hidden="true">
          <img src="assets/audita-logo-original.png" alt="" />
        </span>
        <p class="eyebrow">Triagem encerrada</p>
        <h3>Este fluxo é específico para cartões Itaú, Itaucard e possíveis marcas parceiras.</h3>
        <p>Como você informou que nunca teve nenhum dos cartões apresentados, é pouco provável que a hipótese investigada neste fluxo explique cobranças indevidas nas suas faturas.</p>
        <p>Não é necessário enviar extratos agora. Esta triagem não exclui outras cobranças ou problemas com instituições financeiras, que devem ser analisados em um fluxo apropriado.</p>
        <button type="button" class="secondary-action" data-charge-action="restart">Revisar minha resposta</button>
      </div>
    `;
  }

  function render() {
    syncProgress();
    if (state.screen !== "triage") messageSequenceId += 1;
    if (state.screen === "brands") renderBrands();
    else if (state.screen === "documents") renderDocumentAvailability();
    else if (state.screen === "no-documents") renderNoDocuments();
    else if (state.screen === "upload") renderUpload();
    else if (state.screen === "analyzing") renderAnalyzing();
    else if (state.screen === "paywall") renderPaywall();
    else if (state.screen === "lawyer-kit") renderLawyerKit();
    else if (state.screen === "review") renderReview();
    else if (state.screen === "result") renderResult();
    else if (state.screen === "recovery") renderRecovery();
    else if (state.screen === "ended") renderEnded();
    else if (triageStarted) renderTriage();
    else stage.innerHTML = '<div class="charge-analysis-conversation" data-charge-conversation></div>';
    syncFloatingAssistantAvatar();
    setError(state.error);
  }

  function startTriageWhenOpened() {
    if (triageStarted || state.screen !== "triage") return;
    if (document.body.dataset.activePage !== "analise-cobrancas") return;
    triageStarted = true;
    render();
  }

  function inferDocumentType(file) {
    if (file?.type) return file.type;
    const extension = String(file?.name || "").toLocaleLowerCase("pt-BR").split(".").pop();
    return {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      csv: "text/csv",
      txt: "text/plain",
    }[extension] || "application/octet-stream";
  }

  async function analyzeDocuments() {
    const files = state.selectedFiles.length
      ? state.selectedFiles
      : state.selectedFile
        ? [state.selectedFile]
        : [];
    if (!files.length || !state.consent || state.busy) return;
    state.busy = true;
    state.error = "";
    state.screen = "analyzing";
    render();

    try {
      const analyzedCases = [];
      for (const file of files) {
        const params = new URLSearchParams({ filename: file.name });
        const response = await fetch(`/api/itau-refund/analyze?${params.toString()}`, {
          method: "POST",
          headers: {
            "content-type": inferDocumentType(file),
            accept: "application/json",
          },
          body: file,
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
          state.screen = "upload";
          document.querySelector("#loginButton")?.click();
          throw new Error("Entre na IA AUDITA para analisar os documentos.");
        }
        if (!response.ok) {
          const messages = {
            document_too_large: `${file.name} excede o limite de 12 MB.`,
            unsupported_document_type: `${file.name} não está em um formato aceito.`,
            empty_document: `${file.name} está vazio.`,
          };
          throw new Error(messages[data.error] || data.message || `Não foi possível analisar ${file.name}.`);
        }
        if (data.case) analyzedCases.push(data.case);
        if (data.access) state.access = data.access;
        if (data.billing) state.billingCatalog = data.billing;
      }
      state.caseBatches = analyzedCases;
      state.caseData = aggregateChargeCases(analyzedCases);
      resetDirectedSearch();
      state.screen = "review";
    } catch (error) {
      state.screen = "upload";
      state.error = error?.message || "Falha ao analisar o documento.";
    } finally {
      state.busy = false;
      render();
    }
  }

  async function updateCandidate(button) {
    const sourceCaseId = button.dataset.chargeCase;
    const sourceCase = state.caseBatches.find((item) => item.id === sourceCaseId);
    const candidate = sourceCase?.candidates?.find(
      (item) => item.id === button.dataset.chargeCandidate,
    ) || state.caseData?.candidates?.find((item) => item.id === button.dataset.chargeCandidate);
    if (!candidate || state.busy) return;

    candidate.answer = button.dataset.chargeAnswer;
    state.busy = true;
    state.error = "";
    render();
    try {
      const response = await fetch(
        `/api/itau-refund/cases/${encodeURIComponent(sourceCaseId || state.caseData.id)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            candidateAnswers: Object.fromEntries(
              (sourceCase?.candidates || state.caseData.candidates).map((item) => [item.id, item.answer]),
            ),
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        document.querySelector("#loginButton")?.click();
        throw new Error("Entre na IA AUDITA para continuar a análise.");
      }
      if (!response.ok || !data.case) {
        throw new Error("A resposta não pôde ser sincronizada agora.");
      }
      if (sourceCase) {
        const index = state.caseBatches.findIndex((item) => item.id === data.case.id);
        if (index >= 0) state.caseBatches[index] = data.case;
        state.caseData = aggregateChargeCases(state.caseBatches);
      } else {
        state.caseBatches = [data.case];
        state.caseData = aggregateChargeCases(state.caseBatches);
      }
    } catch (error) {
      state.error = error?.message || "Falha ao atualizar a análise.";
    } finally {
      state.busy = false;
      render();
    }
  }

  async function searchDirectedCharge(form) {
    if (state.directedSearch.busy) return;
    const query = String(new FormData(form).get("query") || "").replace(/\s+/g, " ").trim();
    if (query.length < 3) {
      state.directedSearch.error = "Informe ao menos 3 caracteres para procurar nos anexos.";
      renderReview();
      return;
    }
    state.directedSearch = {
      ...state.directedSearch,
      query,
      busy: true,
      message: "",
      error: "",
    };
    renderReview();
    try {
      const response = await fetch("/api/itau-refund/cases/search", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          caseIds: state.caseBatches.map((item) => item.id),
          query,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        document.querySelector("#loginButton")?.click();
        throw new Error("Entre na IA AUDITA para procurar nos documentos.");
      }
      if (!response.ok || !Array.isArray(data.cases)) {
        throw new Error(data.message || "Não foi possível procurar nos documentos agora.");
      }
      state.caseBatches = data.cases;
      state.caseData = aggregateChargeCases(data.cases);
      const count = Array.isArray(data.matches) ? data.matches.length : 0;
      state.directedSearch.message = count
        ? `${count} ${count === 1 ? "ocorrência localizada" : "ocorrências localizadas"} nos documentos enviados. Revise abaixo antes de confirmar.`
        : `“${query}” não localizada nos documentos enviados. Refine a descrição ou anexe mais extratos.`;
      state.directedSearch.error = "";
    } catch (error) {
      state.directedSearch.error = error?.message || "Falha ao procurar nos documentos.";
    } finally {
      state.directedSearch.busy = false;
      renderReview();
    }
  }

  stage.addEventListener("click", (event) => {
    const button = event.target.closest("[data-charge-action]");
    if (!button) return;
    const action = button.dataset.chargeAction;
    state.error = "";

    if (action === "open-brand-references") {
      event.preventDefault();
      state.route = "consumer";
      state.authorizationAnswer = "uncertain";
      state.screen = "brands";
      render();
      return;
    } else if (action === "not-authorized") {
      continueFromTriage("Sim, tenho um desses cartões.", () => {
        state.route = "consumer";
        state.authorizationAnswer = "denied";
        state.screen = "documents";
      });
      return;
    } else if (action === "authorized") {
      continueFromTriage("Acredito que não tenho nenhuma cobrança indevida.", () => {
        state.route = "consumer";
        state.authorizationAnswer = "confirmed";
        state.screen = "documents";
      });
      return;
    } else if (action === "verify-statement") {
      continueFromTriage("Não sei, quais são todas as bandeiras?", () => {
        state.route = "consumer";
        state.authorizationAnswer = "uncertain";
        state.screen = "brands";
      });
      return;
    } else if (action === "lawyer") {
      continueFromTriage("Sou advogado(a).", () => {
        state.route = "lawyer";
        state.authorizationAnswer = "professional";
        state.screen = "lawyer-kit";
        void loadLawyerKit();
      });
      return;
    } else if (action === "back-triage" || action === "restart") {
      state.screen = "triage";
      state.route = "consumer";
      state.authorizationAnswer = "";
      state.selectedBrand = "";
      state.brandHistoryAnswer = "";
      state.documentAvailability = "";
      state.selectedFile = null;
      state.selectedFiles = [];
      state.consent = false;
      state.caseData = null;
      state.caseBatches = [];
      resetDirectedSearch();
      resetRecovery();
    } else if (action === "select-brand") {
      state.selectedBrand = button.dataset.chargeBrand || "";
      render();
      return;
    } else if (action === "brand-history-yes") {
      state.brandHistoryAnswer = "yes";
      state.screen = "documents";
    } else if (action === "brand-history-no") {
      state.brandHistoryAnswer = "no";
      state.screen = "ended";
    } else if (action === "documents-complete") {
      continueFromTriage("Tenho todos ou a maior parte dos extratos.", () => {
        state.documentAvailability = "complete";
        state.screen = "upload";
      });
      return;
    } else if (action === "documents-partial") {
      continueFromTriage("Tenho apenas alguns documentos ou um print recente.", () => {
        state.documentAvailability = "partial";
        state.screen = "upload";
      });
      return;
    } else if (action === "documents-none") {
      continueFromTriage("Não tenho nenhum extrato.", () => {
        state.documentAvailability = "none";
        state.screen = "no-documents";
      });
      return;
    } else if (action === "copy-document-request") {
      void copyDocumentRequestTemplate();
      return;
    } else if (action === "resume-document-upload") {
      state.selectedFile = null;
      state.selectedFiles = [];
      state.consent = false;
      state.caseData = null;
      state.caseBatches = [];
      resetDirectedSearch();
      resetRecovery();
      state.documentAvailability = "partial";
      state.screen = "upload";
    } else if (action === "back-documents") {
      state.selectedFile = null;
      state.selectedFiles = [];
      state.consent = false;
      state.caseData = null;
      state.caseBatches = [];
      resetDirectedSearch();
      resetRecovery();
      state.documentAvailability = "";
      state.screen = "documents";
    } else if (action === "remove-upload-file") {
      const fileIndex = Number(button.dataset.chargeFileIndex);
      if (Number.isInteger(fileIndex) && fileIndex >= 0) {
        state.selectedFiles.splice(fileIndex, 1);
        state.selectedFile = state.selectedFiles[0] || null;
      }
      renderUpload();
      return;
    } else if (action === "new-document") {
      state.selectedFile = null;
      state.selectedFiles = [];
      state.consent = false;
      state.caseData = null;
      state.caseBatches = [];
      resetDirectedSearch();
      resetRecovery();
      state.documentAvailability = "";
      state.screen = "documents";
    } else if (action === "purchase-itau-service") {
      void purchaseItauService();
      return;
    } else if (action === "purchase-lawyer-kit") {
      void purchaseLawyerKit();
      return;
    } else if (action === "start-recovery") {
      startRecoveryFlow();
      return;
    } else if (action === "open-directed-search") {
      state.directedSearch.open = true;
      state.directedSearch.message = "";
      state.directedSearch.error = "";
      renderReview();
      return;
    } else if (action === "confirm-review") {
      const audit = buildChargeAuditSnapshot(state.caseData || {});
      if (!audit.candidateCount || audit.pendingCount) {
        state.error = "Revise todas as ocorrências antes de abrir o cálculo.";
        render();
        return;
      }
      void openCalculation();
      return;
    } else if (action === "back-to-review") {
      state.screen = "review";
    } else if (action === "back-to-result") {
      state.screen = "result";
    } else if (action === "open-recovery-report") {
      state.recovery.phase = "report";
    } else if (action === "open-recovery-testimony") {
      const form = button.closest("form");
      if (form) state.recovery.claimant = readRecoveryClaimant(form);
      state.recovery.error = "";
      state.recovery.phase = "testimony";
    } else if (action === "back-to-recovery-intro") {
      state.recovery.phase = "intro";
    } else if (action === "back-to-recovery-report") {
      state.recovery.phase = "report";
    } else if (action === "download-report-again") {
      void downloadRecoveryReport();
      return;
    } else if (action === "answer-candidate") {
      updateCandidate(button);
      return;
    }

    render();
  });

  stage.addEventListener("input", (event) => {
    if (event.target.id === "chargeBrandSearch") {
      state.brandSearch = event.target.value;
      renderBrands();
    }
    if (event.target.matches("[data-recovery-mask]")) {
      const formatters = {
        cpf: formatRecoveryCpf,
        phone: formatRecoveryPhone,
        postalCode: formatRecoveryPostalCode,
      };
      const formatter = formatters[event.target.dataset.recoveryMask];
      if (formatter) event.target.value = formatter(event.target.value);
    }
  });

  stage.addEventListener("change", (event) => {
    if (event.target.id === "chargeAnalysisFile") {
      const files = Array.from(event.target.files || []);
      state.selectedFiles = mergeChargeAnalysisFiles(state.selectedFiles, files);
      state.selectedFile = state.selectedFiles[0] || null;
      renderUpload();
    }
    if (event.target.id === "chargeAnalysisConsent") {
      state.consent = event.target.checked;
      renderUpload();
    }
    if (event.target.id === "chargeRecoveryGuideUf") {
      state.recovery.guideUf = event.target.value;
      renderRecoveryGuide();
    }
  });

  stage.addEventListener("submit", (event) => {
    if (event.target.id === "chargeDirectedSearchForm") {
      event.preventDefault();
      void searchDirectedCharge(event.target);
      return;
    }

    if (event.target.id === "chargeRecoveryForm") {
      event.preventDefault();
      void prepareRecoveryReport(event.target);
      return;
    }

    if (event.target.id === "chargeRecoveryTestimonyForm") {
      event.preventDefault();
      const action = event.submitter?.dataset.testimonySubmit || "refine";
      if (action === "pdf") {
        const testimony = readRecoveryTestimony(event.target);
        if (!testimony.reviewed || testimony.refined.length < 40) {
          state.recovery.error = "Revise o texto e confirme que ele corresponde aos fatos relatados.";
          state.recovery.testimony = testimony;
          renderRecoveryTestimony();
          return;
        }
        state.recovery.testimony = testimony;
        void downloadRecoveryReport();
      } else {
        void refineRecoveryTestimony(event.target);
      }
      return;
    }

    if (event.target.id !== "chargeAnalysisUploadForm") return;
    event.preventDefault();
    if (!state.selectedFiles.length && !state.selectedFile) {
      setError("Selecione pelo menos um documento para continuar.");
      return;
    }
    if (!state.consent) {
      setError("Confirme a titularidade ou autorização para processar o documento.");
      return;
    }
    analyzeDocuments();
  });

  stage.addEventListener("dragover", (event) => {
    const dropzone = event.target.closest("[data-charge-upload-drop]");
    if (!dropzone) return;
    event.preventDefault();
    dropzone.classList.add("dragover");
  });

  stage.addEventListener("dragleave", (event) => {
    event.target.closest("[data-charge-upload-drop]")?.classList.remove("dragover");
  });

  stage.addEventListener("drop", (event) => {
    const dropzone = event.target.closest("[data-charge-upload-drop]");
    if (!dropzone) return;
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files || []);
    state.selectedFiles = mergeChargeAnalysisFiles(state.selectedFiles, files);
    state.selectedFile = state.selectedFiles[0] || null;
    renderUpload();
  });

  document.addEventListener("audita:pagechange", (event) => {
    if (event.detail?.page === "analise-cobrancas") {
      startTriageWhenOpened();
      return;
    }
    messageSequenceId += 1;
  });

  window.queueMicrotask(async () => {
    if (!(await resumeItauCheckout()) && !(await resumeLawyerKitCheckout())) {
      startTriageWhenOpened();
    }
  });
  render();
}
