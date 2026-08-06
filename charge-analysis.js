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

const OFFICIAL_CONTEXT_URL =
  "https://www.mpmg.mp.br/portal/menu/comunicacao/noticias/acordo-do-procon-mpmg-com-o-itau-beneficia-consumidores-de-cartoes-de-diversas-redes-varejistas-parceiras-do-banco.shtml";
const EXPLANATORY_VIDEO_URL =
  "https://youtube.com/shorts/rzxDS0cbdlc?is=G23u_WrPjxUIQTug";
const EXPLANATORY_VIDEO_EMBED_URL =
  "https://www.youtube-nocookie.com/embed/rzxDS0cbdlc";
const ITAU_INVOICE_CHANNELS_URL =
  "https://www.itau.com.br/atendimento-itau/para-voce/cartao-de-credito/onde-consigo-a-segunda-via-da-fatura-do-meu-cartao";
const ITAU_PHONE_CHANNELS_URL =
  "https://www.itau.com.br/atendimento-itau/para-voce/telefones";
const ITAU_OMBUDSMAN_URL =
  "https://www.itau.com.br/atendimento-itau/para-voce/ouvidoria";

export const ITAU_DOCUMENT_REQUEST_TEMPLATE = `Solicito cópia das faturas e/ou extratos referentes ao período de [MÊS/ANO INICIAL] a [MÊS/ANO FINAL], incluindo os lançamentos detalhados de seguros, assistências, tarifas e serviços vinculados ao cartão ou à conta.

Peço também o número do protocolo deste atendimento e a confirmação do período efetivamente disponibilizado.`;

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
  } else if (screen === "analyzing") {
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
  const status = document.querySelector("#chargeAnalysisStatus");
  const errorBox = document.querySelector("#chargeAnalysisError");
  const progressPercent = document.querySelector("#chargeAnalysisProgressPercent");
  const progressMeter = document.querySelector("#chargeAnalysisProgressMeter");
  const progressMessage = document.querySelector("#chargeAnalysisProgressMessage");
  const progressItems = document.querySelectorAll("[data-charge-progress]");
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  let messageSequenceId = 0;

  const state = {
    screen: "triage",
    route: "consumer",
    authorizationAnswer: "",
    selectedBrand: "",
    brandSearch: "",
    documentAvailability: "",
    selectedFile: null,
    selectedFiles: [],
    consent: false,
    caseData: null,
    caseBatches: [],
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
        <img src="assets/audita-logo-original.png" alt="" />
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
    return Math.min(1700, Math.max(900, visibleLength * 4));
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
      await messageDelay(520);
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
    await messageDelay(420);
    if (sequenceId !== messageSequenceId) return;
    conversation?.insertAdjacentHTML("beforeend", typingMessage());
    scrollLatestMessage(conversation);
    await messageDelay(900);
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
          <strong>Acredito que tenho alguma cobran&ccedil;a indevida no meu cart&atilde;o ou conta Ita&uacute;</strong>
        </button>
        <button type="button" data-charge-action="authorized">
          <strong>Acredito que n&atilde;o tenho nenhuma cobran&ccedil;a indevida</strong>
        </button>
        <button type="button" data-charge-action="verify-statement">
          <strong>N&atilde;o sei, gostaria de mais informa&ccedil;&otilde;es</strong>
        </button>
        <button type="button" class="secondary" data-charge-action="lawyer" aria-label="Sou advogado ou advogada e quero auditar o documento de um cliente">
          <strong>Sou advogado(a)</strong>
        </button>
      </div>
    `;
    const messages = [
      assistantMessage(`
        <p>Ol&aacute;! Sou a Audita. Vou conduzir uma verifica&ccedil;&atilde;o inicial de poss&iacute;veis cobran&ccedil;as de seguros ou servi&ccedil;os n&atilde;o autorizados em cart&otilde;es Ita&uacute;, Itaucard e marcas parceiras.</p>
        <p class="charge-analysis-date">Conte&uacute;do atualizado em julho de 2026</p>
      `),
      assistantMessage(`
        <p>Em 2026, o MPMG e o Idec divulgaram um acordo com o Ita&uacute; relacionado a cobran&ccedil;as de seguros ou servi&ccedil;os sem consentimento entre 2011 e 2025.</p>
        <details class="charge-analysis-disclosure charge-analysis-transaction">
          <summary>
            <span>Instrumento de Transa&ccedil;&atilde;o</span>
            <img class="charge-analysis-dropdown-chevron" src="assets/nav-icons/chevron-right.svg" alt="" aria-hidden="true" />
          </summary>
          <ul>
            <li><strong>Data de celebra&ccedil;&atilde;o:</strong> 17/12/2025</li>
            <li><strong>A&ccedil;&atilde;o Civil Coletiva n&ordm;:</strong> 5085307-63.2016.8.13.0024 <small>(5&ordf; Vara C&iacute;vel de Belo Horizonte/MG)</small></li>
            <li><strong>Apela&ccedil;&atilde;o C&iacute;vel n&ordm;:</strong> 1.0000.17.021376-3/010 <small>(9&ordf; C&acirc;mara C&iacute;vel do TJMG)</small></li>
          </ul>
        </details>
        <details class="charge-analysis-disclosure charge-analysis-context">
          <summary>
            <span>Memorando explicativo e v&iacute;deo</span>
            <img class="charge-analysis-dropdown-chevron" src="assets/nav-icons/chevron-right.svg" alt="" aria-hidden="true" />
          </summary>
          <div class="charge-analysis-context-body">
            <p><strong>Como interpretar este instrumento</strong></p>
            <p>O acordo coletivo possui crit&eacute;rios de documentos e reclama&ccedil;&atilde;o pr&eacute;via e prev&ecirc; restitui&ccedil;&atilde;o simples. Ele n&atilde;o torna automaticamente indevida toda cobran&ccedil;a vinculada ao Ita&uacute;.</p>
            <p>Eventuais pedidos de devolu&ccedil;&atilde;o em dobro, perdas e danos ou indeniza&ccedil;&atilde;o dependem das provas do caso e de revis&atilde;o jur&iacute;dica individual.</p>
            <div class="charge-analysis-video">
              <iframe
                src="${EXPLANATORY_VIDEO_EMBED_URL}"
                title="V&iacute;deo explicativo sobre o Instrumento de Transa&ccedil;&atilde;o"
                loading="lazy"
                referrerpolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen
              ></iframe>
            </div>
            <div class="charge-analysis-context-links">
              <a href="${EXPLANATORY_VIDEO_URL}" target="_blank" rel="noreferrer">Abrir v&iacute;deo no YouTube</a>
              <a href="${OFFICIAL_CONTEXT_URL}" target="_blank" rel="noreferrer">Consultar fonte oficial do MPMG</a>
            </div>
          </div>
        </details>
      `, "Contexto verificado"),
      assistantMessage(`<p>Para entender melhor o seu caso, vou fazer algumas perguntas r&aacute;pidas.</p>`),
      assistantMessage(`
        <p><strong>Qual destas op&ccedil;&otilde;es descreve melhor a sua situa&ccedil;&atilde;o?</strong></p>
        <p class="charge-analysis-choice-hint">Se ainda n&atilde;o souber, a Audita pode mostrar mais informa&ccedil;&otilde;es e refer&ecirc;ncias para ajudar na triagem.</p>
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
        <p class="charge-analysis-choice-hint">Escolha uma op&ccedil;&atilde;o para continuar.</p>
        ${responseButtons}
      `, "Primeira pergunta", "question"),
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
          <p><strong>Você pode pesquisar pelo nome que aparece na fatura ou no cartão.</strong></p>
          <p>As 113 referências abaixo servem apenas como apoio à triagem. Selecionar uma delas não confirma vínculo com o Itaú nem impede a análise; você também pode continuar sem selecionar.</p>
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
              : `<p class="charge-analysis-empty">Nenhuma referência encontrada. Você ainda pode continuar e enviar a fatura.</p>`
          }
        </div>
        <div class="charge-brand-actions">
          <button type="button" class="secondary-action" data-charge-action="back-triage">Voltar</button>
          <button type="button" class="primary-action" data-charge-action="continue-brand">
            ${selected ? "Continuar com esta marca" : "Continuar sem localizar a marca"}
          </button>
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
          <h3 id="chargeNoDocumentsTitle">Peça as faturas e os extratos do período relevante</h3>
          <p>Comece pelos canais digitais. Se o período não estiver disponível, registre a solicitação no atendimento e peça o protocolo.</p>
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
          <label for="chargeDocumentRequestTemplate">Modelo para copiar e preencher</label>
          <textarea id="chargeDocumentRequestTemplate" rows="6" readonly>${escapeChargeHtml(ITAU_DOCUMENT_REQUEST_TEMPLATE)}</textarea>
          <p>Preencha apenas no canal oficial escolhido. A Audita não envia esta solicitação em seu nome.</p>
          <button type="button" class="secondary-action" data-charge-action="copy-document-request">Copiar modelo</button>
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
      statusElement.textContent = "Modelo copiado.";
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
            <label class="charge-recovery-confirmation"><input name="reviewConfirmed" type="checkbox" /><span>Revisei os dados e o conteúdo do relatório antes de gerar o PDF.</span></label>
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
    return `
      <section class="charge-recovery-guide" aria-label="Passo a passo do ${escapeChargeHtml(portal.tribunal || "tribunal")}">
        <header><div><p class="eyebrow">${escapeChargeHtml(portal.uf)}</p><h3>${escapeChargeHtml(portal.name || portal.tribunal)}</h3></div><span>${escapeChargeHtml(portal.tribunal || "")}</span></header>
        <ol>${steps.map((step) => `<li><span>${escapeChargeHtml(step)}</span></li>`).join("")}</ol>
        ${requirements.length ? `<details><summary>O que separar antes de começar</summary><ul>${requirements.map((item) => `<li>${escapeChargeHtml(item)}</li>`).join("")}</ul></details>` : ""}
        ${humanOnly.length ? `<details><summary>Etapas que dependem de você</summary><ul>${humanOnly.map((item) => `<li>${escapeChargeHtml(item)}</li>`).join("")}</ul></details>` : ""}
        ${notes.length ? `<p class="charge-recovery-guide-note">${escapeChargeHtml(notes.join(" "))}</p>` : ""}
        <div class="charge-recovery-guide-actions">
          <a class="primary-action" href="${escapeChargeHtml(portal.startUrl || portal.officialUrl || "#")}" target="_blank" rel="noreferrer">Abrir portal oficial</a>
          ${portal.officialUrl && portal.officialUrl !== portal.startUrl ? `<a class="secondary-action" href="${escapeChargeHtml(portal.officialUrl)}" target="_blank" rel="noreferrer">Ver orientações do tribunal</a>` : ""}
        </div>
        <small>O login, a escolha da unidade, os anexos e o protocolo final são realizados pelo usuário. A Audita não envia o processo automaticamente.</small>
      </section>
    `;
  }

  function renderRecoveryGuide() {
    const selectedUf = state.recovery.guideUf || "";
    stage.innerHTML = `
      <div class="charge-analysis-conversation charge-recovery-conversation compact">
        ${assistantMessage(`
          <p><strong>Seu Relatório Técnico foi gerado.</strong></p>
          <p>Agora selecione o estado onde pretende iniciar o pedido. A Audita mostrará o caminho oficial conhecido para o tribunal, mas você ainda deve confirmar a comarca e a competência territorial.</p>
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
        <p>Como você informou que nunca teve um desses cartões, não é necessário enviar documentos agora. Isso não impede a análise de outra instituição em um fluxo apropriado.</p>
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
    else if (state.screen === "review") renderReview();
    else if (state.screen === "result") renderResult();
    else if (state.screen === "recovery") renderRecovery();
    else if (state.screen === "ended") renderEnded();
    else renderTriage();
    setError(state.error);
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

    if (action === "not-authorized") {
      continueFromTriage("Acredito que tenho alguma cobrança indevida no meu cartão ou conta Itaú.", () => {
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
      continueFromTriage("Não sei, gostaria de mais informações.", () => {
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
    } else if (action === "continue-brand") {
      state.screen = "documents";
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
        if (!event.target.elements.reviewConfirmed?.checked) {
          state.recovery.error = "Confirme a revisão do relatório antes de gerar o PDF.";
          renderRecoveryReport();
          return;
        }
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

  render();
}
