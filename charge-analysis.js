import { ITAU_FAQ_ITEMS, ITAU_FAQ_LEGAL_NOTICE } from "./itau-faq.js";

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

export function buildChargeCalculationSnapshot(caseData = {}) {
  const candidates = Array.isArray(caseData.candidates) ? caseData.candidates : [];
  const items = candidates
    .filter((candidate) => candidate.answer === "not_recognized")
    .map((candidate) => ({ ...candidate }))
    .filter((candidate) => Number.isFinite(Number(candidate.amount)) && Number(candidate.amount) > 0);
  const principal = items.reduce((total, candidate) => total + Number(candidate.amount), 0);
  return {
    items,
    itemCount: items.length,
    principal: Number(principal.toFixed(2)),
    hypotheticalDouble: Number((principal * 2).toFixed(2)),
    excludedWithoutAmount: candidates.filter(
      (candidate) =>
        candidate.answer === "not_recognized" &&
        (!Number.isFinite(Number(candidate.amount)) || Number(candidate.amount) <= 0),
    ).length,
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
  const calculationOpened = ["result", "recovery"].includes(screen) && reviewComplete;
  const recoveryStarted = Boolean(recovery.handoff);
  const documentPrepared = Boolean(recovery.prepared?.ready);
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
  } else if (documentPrepared && !documentGenerated) {
    message = "Documento preparado. Falta revisar o conteúdo e gerar o PDF.";
  } else if (documentGenerated) {
    message = "Documento gerado. O protocolo final continua pendente e deve ser concluído por uma pessoa.";
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
        caseValue: formatChargeAmountInput(suggestedDouble),
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
  const progressPercent = document.querySelector("#chargeAnalysisProgressPercent");
  const progressMeter = document.querySelector("#chargeAnalysisProgressMeter");
  const progressMessage = document.querySelector("#chargeAnalysisProgressMessage");
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
      portals: [],
      guideUf: "",
      loading: false,
      busy: false,
      pdfGeneratedAt: "",
      error: "",
    };
  }

  function assistantAvatar() {
    return `
      <span class="charge-analysis-avatar" aria-hidden="true">
        <img src="assets/audita-profile-assistant.png" alt="" />
      </span>
    `;
  }

  function assistantMessage(content, label = "Audita · Triagem guiada", className = "") {
    return `
      <div class="charge-analysis-message assistant ${className}">
        ${assistantAvatar()}
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
        ${assistantAvatar()}
        <div class="charge-analysis-typing">Audita est&aacute; digitando&hellip;</div>
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

    for (const message of messages.slice(1)) {
      await messageDelay(1000);
      if (sequenceId !== messageSequenceId) return;
      conversation.insertAdjacentHTML("beforeend", typingMessage());
      scrollLatestMessage(conversation);
      await messageDelay(typingDelayFor(message));
      if (sequenceId !== messageSequenceId) return;
      conversation.lastElementChild?.remove();
      conversation.insertAdjacentHTML("beforeend", message);
      scrollLatestMessage(conversation);
    }
  }

  async function continueFromTriage(reply, updateState) {
    const sequenceId = ++messageSequenceId;
    const conversation = stage.querySelector(".charge-analysis-conversation");
    stage.querySelectorAll("[data-charge-action]").forEach((action) => {
      action.disabled = true;
    });
    conversation?.querySelector(".charge-analysis-message.question")?.remove();
    conversation?.insertAdjacentHTML("beforeend", userMessage(reply));
    scrollLatestMessage(conversation);
    await messageDelay(900);
    if (sequenceId !== messageSequenceId) return;
    conversation?.insertAdjacentHTML("beforeend", typingMessage());
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
    if (progressPercent) progressPercent.textContent = `${snapshot.percent}%`;
    if (progressMeter) {
      progressMeter.value = snapshot.percent;
      progressMeter.setAttribute("aria-valuenow", String(snapshot.percent));
    }
    if (progressMessage) progressMessage.textContent = snapshot.message;
    if (shell) {
      shell.dataset.flowStage = progressState;
      shell.dataset.evidenceCoverage = snapshot.evidenceCoverage;
      shell.dataset.protocolStatus = snapshot.protocolStatus;
    }
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
      </div>
    `;
    const messages = [
      assistantMessage(`
        <p>Ol&aacute;! Sou a Audita. Vou conduzir uma verifica&ccedil;&atilde;o inicial de poss&iacute;veis cobran&ccedil;as de seguros ou servi&ccedil;os n&atilde;o autorizados em cart&otilde;es Ita&uacute;, Itaucard ou nos <button type="button" class="charge-analysis-inline-link" data-charge-action="open-brand-references" aria-label="Abrir 113 refer&ecirc;ncias nominais das 133 bandeiras de cart&otilde;es de parceiras">133 bandeiras de cart&otilde;es de parceiras</button>, como Casas Bahia e Magazine Luiza.</p>
        <p class="charge-analysis-intro-question"><strong>Voc&ecirc; possui ou possuiu algum cart&atilde;o dessas bandeiras?</strong></p>
        <details class="charge-analysis-disclosure charge-analysis-insurance-details">
          <summary>
            <span>Seguros e servi&ccedil;os considerados</span>
            <img class="charge-analysis-dropdown-chevron" src="assets/nav-icons/chevron-right.svg" alt="" aria-hidden="true" />
          </summary>
          <div class="charge-analysis-insurance-list">
            <p><strong>Seguro Perda e Roubo / Cart&atilde;o Protegido / Prote&ccedil;&atilde;o Premiada:</strong> cobertura para transa&ccedil;&otilde;es sob coa&ccedil;&atilde;o ou furto do cart&atilde;o.</p>
            <p><strong>Seguro Bolsa Protegida:</strong> cobertura de pertences levados junto com o cart&atilde;o.</p>
            <p><strong>Seguro Prote&ccedil;&atilde;o Financeira / Perda de Renda:</strong> quita&ccedil;&atilde;o tempor&aacute;ria de faturas em caso de demiss&atilde;o ou incapacidade.</p>
            <p><strong>Seguro Acidentes Pessoais / Vida Associado:</strong> ap&oacute;lices vinculadas diretamente ao lan&ccedil;amento autom&aacute;tico na fatura/conta.</p>
            <p><strong>Seguro Prestamista:</strong> vinculado a contratos de empr&eacute;stimo pessoal, consignado ou financiamento de ve&iacute;culo.</p>
          </div>
        </details>
        <p class="charge-analysis-choice-hint">Se n&atilde;o tiver certeza, consulte todas as bandeiras antes de continuar.</p>
        ${responseButtons}
      `, "Audita", "charge-analysis-intro-message"),
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

  function renderDocumentAvailability() {
    stage.innerHTML = `
      <div class="charge-analysis-conversation compact" data-charge-conversation>
        ${userMessage(routeIdentityMessage())}
        ${assistantMessage(`
          <p><strong>Você possui as faturas ou os extratos de todo o período em que acredita ter recebido essa cobrança?</strong></p>
          <p class="charge-analysis-choice-hint">Documentos parciais permitem uma triagem inicial, mas não comprovam integralmente todo o período.</p>
          <div class="charge-analysis-actions charge-document-actions" aria-label="Disponibilidade dos extratos">
            <button type="button" data-charge-action="documents-complete">
              <strong>Tenho todos ou a maior parte</strong>
            </button>
            <button type="button" data-charge-action="documents-partial">
              <strong>Tenho apenas alguns ou um print recente</strong>
            </button>
            <button type="button" class="secondary" data-charge-action="documents-none">
              <strong>Não tenho nenhum extrato</strong>
            </button>
          </div>
        `, "Disponibilidade dos documentos", "question")}
      </div>
    `;
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
          <p>A Audita não consegue substituir documentos por estimativas. Sem ao menos um documento, não há base para calcular valores, gerar relatório técnico ou preparar uma eventual medida jurídica.</p>
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
          <p>Preencha apenas no canal oficial escolhido. A Audita não envia esta solicitação em seu nome.</p>
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
    const routeCopy =
      state.route === "lawyer"
        ? "Você está auditando para um cliente. Confirme que possui autorização para processar o documento."
        : state.selectedBrand
          ? `Marca informada: ${escapeChargeHtml(state.selectedBrand)}.`
          : "A própria fatura será usada para confirmar o emissor e os lançamentos.";
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
    const documentPrompt = isCompleteHistory
      ? "Anexe todas as faturas ou extratos disponíveis para uma análise documental mais completa."
      : "Envie uma ou mais faturas, extratos ou prints recentes para localizar a possível cobrança.";
    const documentDetail = isCompleteHistory
      ? "Os documentos serão analisados individualmente e reunidos em uma única visão, preservando a origem de cada lançamento."
      : "A triagem considerará somente os arquivos enviados. Documentos parciais não comprovam integralmente o período e não serão apresentados como histórico completo.";

    stage.innerHTML = `
      <div class="charge-analysis-conversation compact">
        ${userMessage(
          isCompleteHistory
            ? "Tenho todos ou a maior parte dos extratos."
            : "Tenho apenas alguns documentos ou um print recente.",
        )}
        ${assistantMessage(`
          <p><strong>${documentPrompt}</strong></p>
          <p>${documentDetail}</p>
          <p>${routeCopy}</p>
        `, "Audita · Análise", "question")}
      </div>

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

  function standardPlan() {
    return state.billingCatalog?.plans?.find((plan) => plan.id === "standard") || null;
  }

  function paywallPrice(interval) {
    const plan = standardPlan();
    const cents = Number(
      plan?.prices?.[interval]?.cents || (interval === "annual" ? 118800 : 19900),
    );
    if (interval === "annual") {
      return {
        headline: formatChargeCurrency(cents / 100 / 12),
        detail: `${formatChargeCurrency(cents / 100)} cobrados uma vez por ano`,
      };
    }
    return {
      headline: formatChargeCurrency(cents / 100),
      detail: "cobrança mensal, cancele para o próximo ciclo",
    };
  }

  function renderPaywall() {
    const monthly = paywallPrice("monthly");
    const annual = paywallPrice("annual");
    const demoMode = Boolean(state.billingCatalog?.billing?.demoMode);
    stage.innerHTML = `
      <div class="charge-paywall">
        <section class="charge-paywall-result" role="status">
          <span class="charge-analysis-mark" aria-hidden="true"><img src="assets/audita-logo-original.png" alt="" /></span>
          <div>
            <p class="eyebrow">Análise concluída</p>
            <h3>Sim, encontramos cobranças que podem ser indevidas nos seus extratos.</h3>
            <p>A Audita já concluiu a triagem inicial. Ative o Standard para abrir os achados, revisar cada lançamento e transformar os documentos enviados em uma análise organizada. Os detalhes, valores e a simulação permanecem protegidos até a ativação do plano.</p>
          </div>
        </section>

        <section class="charge-paywall-value" aria-labelledby="chargePaywallValueTitle">
          <div class="charge-paywall-section-heading charge-paywall-value-heading">
            <p class="eyebrow">Por que seguir com a Audita</p>
            <h3 id="chargePaywallValueTitle">Da cobran&ccedil;a suspeita a um caso documentado</h3>
            <p>A Audita organiza as provas. Voc&ecirc; continua no controle.</p>
          </div>

          <ol class="charge-paywall-proof-journey" aria-label="Etapas liberadas pela Audita">
            <li><span aria-hidden="true">1</span><strong>Cobran&ccedil;a localizada</strong><p>Identificamos lan&ccedil;amentos com comportamentos at&iacute;picos nos documentos enviados.</p></li>
            <li><span aria-hidden="true">2</span><strong>Evid&ecirc;ncia no extrato</strong><p>Ligamos descri&ccedil;&atilde;o, data, valor e arquivo de origem de cada ocorr&ecirc;ncia.</p></li>
            <li><span aria-hidden="true">3</span><strong>C&aacute;lculo rastre&aacute;vel</strong><p>Calculamos somente cobran&ccedil;as encontradas nos anexos e n&atilde;o reconhecidas por voc&ecirc;.</p></li>
            <li><span aria-hidden="true">4</span><strong>Relat&oacute;rio t&eacute;cnico</strong><p>Consolidamos evid&ecirc;ncias e mem&oacute;ria de c&aacute;lculo em um documento revis&aacute;vel.</p></li>
            <li><span aria-hidden="true">5</span><strong>Orienta&ccedil;&atilde;o para o JEC</strong><p>Apresentamos o passo a passo para o protocolo final, que permanece humano.</p></li>
          </ol>

          <div class="charge-paywall-reference" role="group" aria-label="Compara&ccedil;&atilde;o ilustrativa entre o acordo extrajudicial e a pretens&atilde;o simulada no material de refer&ecirc;ncia">
            <div class="charge-paywall-reference-bars">
              <h4>Comparativo ilustrativo <small>material de refer&ecirc;ncia</small></h4>
              <label for="chargeAgreementReference">Acordo extrajudicial</label>
              <meter id="chargeAgreementReference" min="0" max="100" value="15" aria-label="Propor&ccedil;&atilde;o ilustrativa do acordo extrajudicial"></meter>
              <label for="chargeClaimReference">Pretens&atilde;o simulada no exemplo</label>
              <meter id="chargeClaimReference" class="highlight" min="0" max="100" value="100" aria-label="Propor&ccedil;&atilde;o ilustrativa da pretens&atilde;o simulada"></meter>
            </div>

            <div class="charge-paywall-reference-callout">
              <span>Neste exemplo, a pretens&atilde;o simulada foi cerca de</span>
              <strong>552%</strong>
              <b>superior ao acordo</b>
              <p>O potencial n&atilde;o vem apenas do estorno: outros componentes podem ser avaliados conforme as provas e a decis&atilde;o judicial.</p>
            </div>

            <div class="charge-paywall-reference-components">
              <h4>Composi&ccedil;&atilde;o da pretens&atilde;o simulada</h4>
              <ul>
                <li>Repeti&ccedil;&atilde;o em dobro, se cab&iacute;vel</li>
                <li>Corre&ccedil;&atilde;o monet&aacute;ria</li>
                <li>Juros legais</li>
                <li>Eventual indeniza&ccedil;&atilde;o, quando fundamentada</li>
              </ul>
            </div>
          </div>

          <p class="charge-paywall-value-disclaimer"><strong>Importante:</strong> percentual calculado a partir de um &uacute;nico cen&aacute;rio do material de refer&ecirc;ncia. O resultado de cada caso varia e n&atilde;o h&aacute; garantia de recebimento, devolu&ccedil;&atilde;o em dobro, indeniza&ccedil;&atilde;o ou &ecirc;xito judicial. A composi&ccedil;&atilde;o depende das provas, dos requisitos do <a href="${CDC_ARTICLE_42_URL}" target="_blank" rel="noreferrer">art. 42 do CDC</a> e da decis&atilde;o do Judici&aacute;rio.</p>

          <div class="charge-paywall-value-actions">
            <a class="primary-action charge-paywall-value-cta" href="#chargePaywallPlans">Continuar com a Audita</a>
            <ul aria-label="Compromissos da Audita">
              <li>Voc&ecirc; revisa cada cobran&ccedil;a</li>
              <li>Sem promessa de resultado</li>
              <li>Protocolo final feito pelo usu&aacute;rio</li>
            </ul>
          </div>
        </section>

        <section class="charge-paywall-explainer" aria-labelledby="chargePaywallInfoTitle">
          <div><p class="eyebrow">Transparência antes de contratar</p><h3 id="chargePaywallInfoTitle">Você continua no controle</h3></div>
          <ul>
            <li>Documentos parciais produzem uma análise limitada ao período enviado; não estimamos meses ausentes.</li>
            <li>Devolução em dobro, indenização e êxito judicial não são automáticos e dependem das provas e da avaliação jurídica.</li>
            <li>Consultas pagas de terceiros, custas, protocolo e representação jurídica não estão incluídos, salvo quando informados expressamente.</li>
          </ul>
        </section>

        <section id="chargePaywallPlans" class="charge-paywall-plans" aria-label="Planos Standard">
          <article>
            <div><span>Standard mensal</span><strong>${escapeChargeHtml(monthly.headline)}<small>/mês</small></strong><p>${escapeChargeHtml(monthly.detail)}</p></div>
            <ul><li>Acesso imediato aos achados da análise</li><li>Revisão guiada e cálculo baseado nos anexos</li><li>Relatório técnico em PDF e próximos passos</li><li>Plataforma, chat e IA Audita</li></ul>
            <button type="button" class="secondary-action" data-charge-action="subscribe-standard" data-charge-interval="monthly" ${state.busy ? "disabled" : ""}>${demoMode ? "Ativar demonstração mensal" : "Assinar mensal"}</button>
          </article>
          <article class="recommended">
            <div><span>Standard anual <em>Melhor custo-benefício</em></span><strong>${escapeChargeHtml(annual.headline)}<small>/mês</small></strong><p>${escapeChargeHtml(annual.detail)}</p></div>
            <ul><li>Todos os recursos do Standard mensal</li><li>Economia de ${formatChargeCurrency(1200)} por ano</li><li>Suporte de advogado parceiro para o caso Itaú incluído</li></ul>
            <p class="charge-paywall-legal-note">O suporte jurídico não significa garantia de resultado. Representação, protocolo e despesas externas exigem aceite específico quando aplicáveis.</p>
            <button type="button" class="primary-action" data-charge-action="subscribe-standard" data-charge-interval="annual" ${state.busy ? "disabled" : ""}>${demoMode ? "Ativar demonstração anual" : "Assinar anual"}</button>
          </article>
        </section>
        ${demoMode ? `<p class="charge-paywall-demo" role="note">Ambiente demonstrativo: nenhum valor será cobrado e nenhuma transação será enviada à Stripe.</p>` : ""}
        <div class="charge-result-actions"><button type="button" class="secondary-action" data-charge-action="new-document">Voltar aos documentos</button></div>
      </div>
    `;
  }

  async function unlockAnalyzedCases() {
    const cases = [];
    for (const lockedCase of state.caseBatches) {
      const response = await fetch(`/api/itau-refund/cases/${encodeURIComponent(lockedCase.id)}`, {
        headers: { accept: "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.case) {
        throw new Error(data.message || "Não foi possível liberar a análise agora.");
      }
      cases.push(data.case);
    }
    state.caseBatches = cases;
    state.caseData = aggregateChargeCases(cases);
    state.screen = "review";
  }

  async function subscribeStandard(interval) {
    if (state.busy) return;
    state.busy = true;
    state.error = "";
    renderPaywall();
    try {
      const demoMode = Boolean(state.billingCatalog?.billing?.demoMode);
      const response = await fetch(
        demoMode ? "/api/billing/demo-subscription" : "/api/billing/checkout",
        {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(
            demoMode
              ? { interval }
              : { kind: "subscription", planId: "standard", interval, requestId: crypto.randomUUID() },
          ),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "A contratação ainda não está disponível.");
      if (!demoMode && data.url) {
        window.location.assign(data.url);
        return;
      }
      state.access = data.access || { entitled: true, source: "subscription" };
      await unlockAnalyzedCases();
    } catch (error) {
      state.error = error?.message || "Não foi possível ativar o plano.";
    } finally {
      state.busy = false;
      render();
    }
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
          <p>Informe apenas como ela aparece ou uma variação do nome. A Audita procurará nos documentos já enviados; você não informa valor nem data.</p>
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
                <p>Isso não certifica que os documentos estejam corretos. Você pode indicar um nome para a Audita procurar nos próprios anexos.</p>
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
    const caseData = state.caseData || {};
    const calculation = buildChargeCalculationSnapshot(caseData);
    const isPartialHistory = state.documentAvailability === "partial";
    const reportFooter = isPartialHistory
      ? "Esta apuração é parcial e limitada aos documentos enviados. Ela não comprova integralmente períodos ausentes e não contém estimativas."
      : "Esta apuração usa somente os lançamentos presentes nos documentos enviados e confirmados como não reconhecidos.";

    stage.innerHTML = `
      <div class="charge-result-heading">
        <div>
          <p class="eyebrow">Cálculo documental</p>
          <h3>${calculation.itemCount ? "Cobranças não reconhecidas confirmadas" : "Nenhuma cobrança confirmada para cálculo"}</h3>
          <p>Somente ocorrências encontradas nos anexos e marcadas por você como “Não reconheço” aparecem nesta etapa.</p>
        </div>
        <span>${calculation.itemCount} ${calculation.itemCount === 1 ? "item" : "itens"}</span>
      </div>

      ${
        calculation.itemCount
          ? `<section class="charge-calculation-items" aria-label="Itens usados no cálculo">
              ${calculation.items.map((candidate) => `
                <article>
                  <div>
                    <strong>${escapeChargeHtml(candidate.label || candidate.description || "Cobrança")}</strong>
                    <small>${escapeChargeHtml(candidate.date || "Data não identificada")} · ${escapeChargeHtml(candidate.sourceFileName || "Arquivo de origem não informado")}</small>
                    <small>${candidate.origin === "directed_search" ? "Localizada após busca dirigida pelo usuário; a origem não representa conclusão jurídica da IA." : "Detectada automaticamente e confirmada pelo usuário."}</small>
                  </div>
                  <b>${formatChargeCurrency(candidate.amount)}</b>
                </article>
              `).join("")}
            </section>`
          : `<div class="charge-analysis-empty"><strong>Nenhum valor será calculado.</strong><p>Volte à revisão para marcar uma ocorrência documentada como não reconhecida ou procure outra descrição nos anexos.</p></div>`
      }

      <section class="charge-audit-report" aria-label="Cálculo documental preliminar">
        <header>
          <div>
            <p class="eyebrow">Base documental confirmada</p>
            <h3>Apuração limitada à prova enviada</h3>
          </div>
          <span>Sem estimativas</span>
        </header>
        <div class="charge-audit-table-wrap">
          <table>
            <thead>
              <tr><th>Rubrica</th><th>Base da apuração</th><th>Valor / status</th></tr>
            </thead>
            <tbody>
              <tr>
                <th>Valores não reconhecidos</th>
                <td>${calculation.itemCount} lançamento(s) documentado(s) e confirmado(s)</td>
                <td>${formatChargeCurrency(calculation.principal)}</td>
              </tr>
              <tr>
                <th>Cenário matemático em dobro</th>
                <td>Art. 42 do CDC, condicionado à análise jurídica e ao caso concreto</td>
                <td>${calculation.itemCount ? formatChargeCurrency(calculation.hypotheticalDouble) : "Sem base"}</td>
              </tr>
              <tr>
                <th>Correção monetária e juros</th>
                <td>Exige datas, histórico completo e critério jurídico revisado</td>
                <td>Pendente</td>
              </tr>
              <tr>
                <th>Perdas e danos / dano moral</th>
                <td>Não é presumido pela triagem automática</td>
                <td>Revisão jurídica</td>
              </tr>
              <tr class="total">
                <th colspan="2">Valor da causa</th>
                <td>A definir</td>
              </tr>
            </tbody>
          </table>
        </div>
        <footer>
          <p>${reportFooter} O cenário em dobro é matemático e não representa garantia de restituição, indenização ou êxito judicial.</p>
        </footer>
      </section>

      <div class="charge-result-actions">
        <button type="button" class="secondary-action" data-charge-action="back-to-review">Voltar à revisão</button>
        ${documentationActionMarkup()}
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
          <p>A Audita não libera o dinheiro automaticamente. Ela ajuda você a reunir a prova, documentar o caso e chegar ao canal adequado com as informações organizadas.</p>
        `, "Audita · Recuperação")}
        ${assistantMessage(`
          <p><strong>Agora você pode preparar a documentação para avaliar o Juizado Especial Cível.</strong></p>
          <p>O Relatório Técnico de Auditoria reúne os dados da análise e organiza uma minuta para revisão. Depois do PDF, você escolhe o estado e recebe o passo a passo do tribunal. O protocolo final continua sendo feito por você.</p>
        `, "Audita · Próxima etapa")}
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
          ${prepared?.ready ? `<button type="submit" class="primary-action" data-recovery-submit="pdf" ${state.recovery.busy ? "disabled" : ""}>${state.recovery.busy ? "Gerando..." : "Gerar Relatório Técnico em PDF"}</button>` : ""}
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
        `, "Audita · Relatório")}
      </div>
      ${recoveryReportFormMarkup()}
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
          <strong>${aboveLimit ? "Este caso ultrapassa o limite atendido pela Audita" : "O que são pequenas causas?"}</strong>
          <p>Pequenas causas são tratadas no Juizado Especial Cível. A Audita orienta, por enquanto, somente casos de até 20 salários mínimos. Nessa faixa, o advogado é facultativo na primeira instância. Em 2026, esse limite corresponde a ${escapeChargeHtml(limitLabel)}.</p>
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
            <p>Como o valor ultrapassa 20 salários mínimos, não vamos direcionar você ao protocolo de pequenas causas. O contato com o time Audita será disponibilizado em breve.</p>
            <button type="button" class="secondary-action" disabled>Falar com o time Audita · em breve</button>
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
          <small>O login, a escolha da unidade, os anexos e o protocolo final são realizados pelo usuário. A Audita não envia o processo automaticamente.</small>
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
          <p>Agora selecione o estado onde pretende iniciar a pequena causa. A Audita mostrará o caminho oficial conhecido para o tribunal, mas você ainda deve confirmar a comarca e a competência territorial.</p>
        `, "Audita · Tribunal")}
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
    return {
      caseData: state.recovery.handoff?.caseData || {},
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
        throw new Error("Entre na Audita para preparar o Relatório Técnico.");
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
    if (state.recovery.busy || !state.recovery.prepared?.ready) return;
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
        }),
      });
      if (response.status === 401) {
        document.querySelector("#loginButton")?.click();
        throw new Error("Entre na Audita para gerar o Relatório Técnico.");
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
      state.recovery.phase = "report";
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
    else if (state.screen === "review") renderReview();
    else if (state.screen === "result") renderResult();
    else if (state.screen === "recovery") renderRecovery();
    else if (state.screen === "ended") renderEnded();
    else if (triageStarted) renderTriage();
    else stage.innerHTML = '<div class="charge-analysis-conversation" data-charge-conversation></div>';
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
      let lockedPositiveResult = false;
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
          throw new Error("Entre na Audita para analisar os documentos.");
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
        if (data.finding?.positive && !data.finding?.detailsAvailable) {
          lockedPositiveResult = true;
        }
        if (data.access) state.access = data.access;
        if (data.billing) state.billingCatalog = data.billing;
      }
      state.caseBatches = analyzedCases;
      state.caseData = aggregateChargeCases(analyzedCases);
      resetDirectedSearch();
      state.screen = lockedPositiveResult ? "paywall" : "review";
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
        throw new Error("Entre na Audita para continuar a análise.");
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
        throw new Error("Entre na Audita para procurar nos documentos.");
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
        state.screen = "documents";
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
    } else if (action === "subscribe-standard") {
      void subscribeStandard(button.dataset.chargeInterval || "monthly");
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
      state.screen = "result";
    } else if (action === "back-to-review") {
      state.screen = "review";
    } else if (action === "back-to-result") {
      state.screen = "result";
    } else if (action === "open-recovery-report") {
      state.recovery.phase = "report";
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
      const action = event.submitter?.dataset.recoverySubmit || "prepare";
      if (action === "pdf") {
        const claimant = readRecoveryClaimant(event.target);
        state.recovery.claimant = claimant;
        void downloadRecoveryReport(claimant);
      } else {
        void prepareRecoveryReport(event.target);
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

  window.queueMicrotask(startTriageWhenOpened);
  render();
}
