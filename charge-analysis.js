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

const OFFICIAL_CONTEXT_URL =
  "https://www.mpmg.mp.br/portal/menu/comunicacao/noticias/acordo-do-procon-mpmg-com-o-itau-beneficia-consumidores-de-cartoes-de-diversas-redes-varejistas-parceiras-do-banco.shtml";

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

function parseChargeAmount(value) {
  const normalized = String(value || "").trim().replace(/\s/g, "");
  if (!normalized) return Number.NaN;
  if (normalized.includes(",")) {
    return Number(normalized.replace(/\./g, "").replace(",", "."));
  }
  return Number(normalized);
}

function chargeClassificationLabel(evaluation = {}) {
  return (
    {
      review_required: "Revisão do cliente necessária",
      no_candidate_found: "Nenhuma cobrança conhecida foi localizada",
      possible_unauthorized: "Possível cobrança não autorizada",
      strong_indication: "Forte indício para revisão",
      recognized_charges: "Cobranças reconhecidas pelo cliente",
    }[evaluation.classification] ||
    evaluation.classificationLabel ||
    "Análise preliminar concluída"
  );
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

const stage =
  typeof document === "undefined"
    ? null
    : document.querySelector("#chargeAnalysisStage");

if (stage) {
  const shell = stage.closest(".charge-analysis-shell");
  const status = document.querySelector("#chargeAnalysisStatus");
  const errorBox = document.querySelector("#chargeAnalysisError");
  const progressItems = document.querySelectorAll("[data-charge-progress]");
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  let messageSequenceId = 0;

  const state = {
    screen: "triage",
    route: "consumer",
    selectedBrand: "",
    brandSearch: "",
    documentAvailability: "",
    selectedFile: null,
    selectedFiles: [],
    consent: false,
    caseData: null,
    caseBatches: [],
    estimate: null,
    estimateDraft: {
      description: "",
      monthlyAmount: "",
      durationValue: "",
      durationUnit: "months",
      confirmed: false,
    },
    busy: false,
    error: "",
  };

  function resetEstimateDraft() {
    state.estimateDraft = {
      description: "",
      monthlyAmount: "",
      durationValue: "",
      durationUnit: "months",
      confirmed: false,
    };
  }

  function assistantAvatar() {
    return `
      <span class="charge-analysis-avatar" aria-hidden="true">
        <img src="assets/audita-logo-white.svg" alt="" />
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
      await messageDelay(340);
      if (sequenceId !== messageSequenceId) return;
      conversation.insertAdjacentHTML("beforeend", typingMessage());
      scrollLatestMessage(conversation);
      await messageDelay(520);
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
    await messageDelay(280);
    if (sequenceId !== messageSequenceId) return;
    conversation?.insertAdjacentHTML("beforeend", typingMessage());
    scrollLatestMessage(conversation);
    await messageDelay(620);
    if (sequenceId !== messageSequenceId) return;
    updateState();
    render();
  }

  function setError(message = "") {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.classList.toggle("hidden", !message);
  }

  function syncProgress() {
    const progressState =
      state.screen === "triage" || state.screen === "brands" || state.screen === "documents" || state.screen === "ended"
        ? "triage"
        : state.screen === "upload" || state.screen === "analyzing" || state.screen === "result" || state.screen === "estimate" || state.screen === "estimate-result"
          ? "document"
          : "plans";
    const order = ["triage", "document", "plans"];
    const currentIndex = order.indexOf(progressState);

    progressItems.forEach((item) => {
      const index = order.indexOf(item.dataset.chargeProgress);
      item.classList.toggle("active", index === currentIndex);
      item.classList.toggle("complete", index < currentIndex || (state.screen === "result" && index === 1));
      item.classList.toggle("locked", item.dataset.chargeProgress === "plans");
    });

    if (status) {
      status.textContent =
        progressState === "triage"
          ? "Etapa 1 de 3"
          : state.screen === "result" || state.screen === "estimate-result"
            ? state.documentAvailability === "complete" ? "Auditoria documental" : "Simulação preliminar"
            : "Etapa 2 de 3";
    }
    if (shell) shell.dataset.flowStage = progressState;
  }

  function renderTriage() {
    const sequenceId = ++messageSequenceId;
    const responseButtons = `
      <div class="charge-analysis-actions" aria-label="Respostas da primeira etapa">
        <button type="button" data-charge-action="has-card" aria-label="Sim, possuo ou possu&iacute;a cart&atilde;o entre 2011 e hoje">
          <strong>Sim</strong>
        </button>
        <button type="button" data-charge-action="show-brands" aria-label="N&atilde;o tenho certeza, consultar a lista ampliada de marcas">
          <strong>N&atilde;o tenho certeza</strong>
        </button>
        <button type="button" data-charge-action="lawyer" aria-label="Sou advogado ou advogada e quero auditar o documento de um cliente">
          <strong>Sou advogado(a)</strong>
        </button>
        <button type="button" class="secondary" data-charge-action="no-card" aria-label="N&atilde;o tenho e nunca tive, encerrar esta triagem">
          <strong>N&atilde;o tenho e nunca tive</strong>
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
        <details class="charge-analysis-context">
          <summary>Entenda o contexto antes de come&ccedil;ar</summary>
          <p>O acordo coletivo possui crit&eacute;rios de documentos e reclama&ccedil;&atilde;o pr&eacute;via e prev&ecirc; restitui&ccedil;&atilde;o simples. Eventuais pedidos de devolu&ccedil;&atilde;o em dobro, perdas e danos ou indeniza&ccedil;&atilde;o dependem das provas e de revis&atilde;o jur&iacute;dica individual.</p>
          <a href="${OFFICIAL_CONTEXT_URL}" target="_blank" rel="noreferrer">Consultar publica&ccedil;&atilde;o oficial do MPMG</a>
        </details>
      `, "Contexto verificado"),
      assistantMessage(`<p>Para entender melhor o seu caso, vou fazer algumas perguntas r&aacute;pidas.</p>`),
      assistantMessage(`
        <p><strong>Voc&ecirc; possui ou j&aacute; possuiu cart&atilde;o Ita&uacute;, Itaucard ou de alguma marca parceira desde 2011?</strong></p>
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
        ${userMessage("Não tenho certeza sobre a marca do cartão.")}
        ${assistantMessage(`
          <p><strong>Pesquise pelo nome que aparece na fatura ou no cartão.</strong></p>
          <p>Esta é uma lista ampliada de referências para triagem. A presença de uma marca não confirma, por si só, vínculo com o Itaú no período analisado; a fatura será a fonte principal.</p>
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
    if (state.selectedBrand) return `Meu cartão pode ser ${state.selectedBrand}.`;
    return "Possuo ou já possuí cartão Itaú ou de marca parceira.";
  }

  function renderDocumentAvailability() {
    stage.innerHTML = `
      <div class="charge-analysis-conversation compact" data-charge-conversation>
        ${userMessage(routeIdentityMessage())}
        ${assistantMessage(`
          <p><strong>Você possui as faturas ou os extratos de todo o período em que acredita ter recebido essa cobrança?</strong></p>
          <p class="charge-analysis-choice-hint">Escolha a situação mais próxima da sua. A falta do histórico completo não impede a simulação.</p>
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

  function estimateFormMarkup({ inline = false } = {}) {
    const draft = state.estimateDraft;
    const audit = buildChargeAuditSnapshot(state.caseData || {});
    const detectedAmount = audit.totalDisputed || audit.totalDetected || 0;
    const detectedDescription = state.caseData?.candidates?.find(
      (candidate) => candidate.answer === "not_recognized",
    )?.label || state.caseData?.candidates?.[0]?.label || "";
    const descriptionValue = draft.description || (inline ? detectedDescription : "");
    const monthlyValue = draft.monthlyAmount || (inline && detectedAmount ? String(detectedAmount) : "");

    return `
      <form class="charge-estimate-panel ${inline ? "inline" : ""}" id="chargeEstimateForm">
        <div class="charge-estimate-heading">
          <div>
            <p class="eyebrow">Simulação estimada</p>
            <h3>Informe o que você lembra sobre a cobrança</h3>
          </div>
          <span>${inline ? "Complemento do documento" : "Sem extrato histórico"}</span>
        </div>

        <div class="charge-estimate-grid">
          <label class="wide">
            <span>Nome ou descrição aproximada da cobrança</span>
            <input
              id="chargeEstimateDescription"
              name="description"
              type="text"
              maxlength="120"
              value="${escapeChargeHtml(descriptionValue)}"
              placeholder="Ex.: seguro, proteção do cartão, assistência"
              required
            />
          </label>
          <label>
            <span>Valor cobrado por mês</span>
            <div class="charge-money-input">
              <small>R$</small>
              <input
                id="chargeEstimateMonthlyAmount"
                name="monthlyAmount"
                type="text"
                inputmode="decimal"
                value="${escapeChargeHtml(monthlyValue)}"
                placeholder="19,90"
                required
              />
            </div>
          </label>
          <label>
            <span>Por quanto tempo lembra de ter pago?</span>
            <div class="charge-duration-input">
              <input
                id="chargeEstimateDurationValue"
                name="durationValue"
                type="number"
                min="1"
                max="600"
                value="${escapeChargeHtml(draft.durationValue)}"
                placeholder="12"
                required
              />
              <select id="chargeEstimateDurationUnit" name="durationUnit">
                <option value="months" ${draft.durationUnit === "months" ? "selected" : ""}>meses</option>
                <option value="years" ${draft.durationUnit === "years" ? "selected" : ""}>anos</option>
              </select>
            </div>
          </label>
        </div>

        <label class="charge-upload-consent">
          <input id="chargeEstimateConfirmed" name="confirmed" type="checkbox" ${draft.confirmed ? "checked" : ""} />
          <span>Confirmo que esses dados são aproximados e foram informados com base no que consigo recordar.</span>
        </label>

        <p class="charge-upload-privacy">A simulação não substitui a análise dos extratos. O relatório e a minuta devem identificar esses valores como declarados e estimados.</p>

        <div class="charge-upload-actions">
          <button type="button" class="secondary-action" data-charge-action="${inline ? "new-document" : "back-documents"}">${inline ? "Revisar documento" : "Voltar"}</button>
          <button type="submit" class="primary-action">Calcular simulação</button>
        </div>
      </form>
    `;
  }

  function estimateReportMarkup() {
    const estimate = state.estimate;
    if (!estimate) return "";

    return `
      <section class="charge-audit-report charge-estimate-report" aria-label="Relatório de simulação estimada">
        <header>
          <div>
            <p class="eyebrow">Relatório preliminar</p>
            <h3>Simulação baseada na declaração do cliente</h3>
          </div>
          <span>Valores estimados</span>
        </header>
        <div class="charge-audit-table-wrap">
          <table>
            <thead>
              <tr><th>Rubrica</th><th>Base da simulação</th><th>Valor estimado</th></tr>
            </thead>
            <tbody>
              <tr>
                <th>Cobrança informada</th>
                <td>${escapeChargeHtml(estimate.description)}</td>
                <td>${formatChargeCurrency(estimate.monthlyAmount)} / mês</td>
              </tr>
              <tr>
                <th>Período aproximado</th>
                <td>${estimate.months} mês(es) declarados</td>
                <td>${estimate.months} parcelas</td>
              </tr>
              <tr>
                <th>Total estimado pago</th>
                <td>${formatChargeCurrency(estimate.monthlyAmount)} × ${estimate.months} meses</td>
                <td>${formatChargeCurrency(estimate.estimatedPaid)}</td>
              </tr>
              <tr>
                <th>Cenário matemático em dobro</th>
                <td>Simulação sujeita à prova e à revisão jurídica do caso concreto</td>
                <td>${formatChargeCurrency(estimate.hypotheticalDouble)}</td>
              </tr>
              <tr>
                <th>Correção, juros e demais pedidos</th>
                <td>Dependem de datas, documentos e definição jurídica</td>
                <td>Pendente</td>
              </tr>
              <tr class="total">
                <th colspan="2">Valor da causa</th>
                <td>A definir na revisão</td>
              </tr>
            </tbody>
          </table>
        </div>
        <footer>
          <p>Este cálculo usa informações aproximadas fornecidas pelo cliente. A minuta deverá registrar a ausência de extratos históricos e poderá indicar a necessidade de apresentação dos documentos pelo banco, quando juridicamente cabível.</p>
        </footer>
      </section>
    `;
  }

  function renderEstimate() {
    stage.innerHTML = `
      <div class="charge-analysis-conversation compact">
        ${userMessage("Não tenho nenhum extrato disponível.")}
        ${assistantMessage(`
          <p><strong>Tudo bem. Você ainda pode fazer uma simulação aproximada.</strong></p>
          <p>Informe o valor mensal e por quanto tempo lembra de ter recebido a cobrança. Esses dados ficarão claramente marcados como declarados, não comprovados por extratos.</p>
        `, "Caminho sem documentos")}
      </div>
      ${estimateFormMarkup()}
    `;
  }

  function renderEstimateResult() {
    stage.innerHTML = `
      <div class="charge-result-heading">
        <div>
          <p class="eyebrow">Simulação concluída</p>
          <h3>Base estimada para relatório e minuta</h3>
          <p>Sem extratos históricos · valores declarados pelo cliente</p>
        </div>
        <span>Estimativa</span>
      </div>
      ${estimateReportMarkup()}
      <section class="charge-petition-note" aria-label="Próxima etapa da petição">
        <strong>Como esta informação será utilizada</strong>
        <p>A simulação poderá compor o relatório e a minuta da petição, sempre identificada como estimativa. A geração do PDF continua condicionada aos dados pessoais, à revisão do texto e à etapa de liberação.</p>
      </section>
      <div class="charge-result-actions">
        <button type="button" class="secondary-action" data-charge-action="edit-estimate">Editar informações</button>
        <button type="button" class="primary-action" disabled>Relatório e petição · próxima etapa</button>
      </div>
    `;
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
      : "Envie uma fatura, um extrato ou um print recente para localizar a possível cobrança.";
    const documentDetail = isCompleteHistory
      ? "Os documentos serão analisados individualmente e reunidos em uma única visão, preservando a origem de cada lançamento."
      : "Depois da leitura, você poderá informar há quanto tempo lembra de receber a cobrança para gerar a simulação.";

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
        `, "Etapa 2 · Documento", "question")}
      </div>

      <form class="charge-upload-panel" id="chargeAnalysisUploadForm">
        <input
          class="hidden"
          id="chargeAnalysisFile"
          type="file"
          ${isCompleteHistory ? "multiple" : ""}
          accept=".pdf,.png,.jpg,.jpeg,.csv,.txt,application/pdf,image/png,image/jpeg,text/csv,text/plain"
        />
        <label class="charge-upload-dropzone ${fileName ? "has-file" : ""}" for="chargeAnalysisFile" data-charge-upload-drop>
          <span class="charge-upload-icon" aria-hidden="true">
            <img src="assets/audita-logo-white.svg" alt="" />
          </span>
          <strong>${fileName ? escapeChargeHtml(fileName) : isCompleteHistory ? "Anexar faturas ou extratos" : "Anexar documento ou print"}</strong>
          <small>${fileName ? "Clique para trocar a seleção" : `PDF, imagem, CSV ou TXT · até 12 MB por arquivo${isCompleteHistory ? " · seleção múltipla" : ""}`}</small>
        </label>

        ${
          files.length > 1
            ? `<ul class="charge-upload-file-list">${files
                .map((file) => `<li><span>${escapeChargeHtml(file.name)}</span><small>${Math.max(1, Math.round(file.size / 1024))} KB</small></li>`)
                .join("")}</ul>`
            : ""
        }

        <label class="charge-upload-consent">
          <input id="chargeAnalysisConsent" type="checkbox" ${state.consent ? "checked" : ""} />
          <span>Confirmo que sou titular do documento ou possuo autorização para realizar esta análise.</span>
        </label>

        <p class="charge-upload-privacy">O arquivo é processado para esta análise e não fica armazenado por este módulo. Dados sensíveis são mascarados antes da leitura automatizada quando aplicável.</p>

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
          <img src="assets/audita-logo-white.svg" alt="" />
        </span>
        <p class="eyebrow">Leitura em andamento</p>
        <h3>${files.length > 1 ? `Analisando ${files.length} documentos` : `Analisando ${escapeChargeHtml(files[0]?.name || "o documento")}`}</h3>
        <p>Estamos procurando lançamentos que merecem confirmação e organizando a base documental. Nenhuma conclusão jurídica será presumida.</p>
      </div>
    `;
  }

  function candidateMarkup(candidate, caseId) {
    const answer = String(candidate.answer || "pending");
    return `
      <article class="charge-result-candidate">
        <div>
          <span>${escapeChargeHtml(candidate.category || "lançamento")}</span>
          <strong>${escapeChargeHtml(candidate.label || candidate.description || "Cobrança a revisar")}</strong>
          <small>${escapeChargeHtml(candidate.reason || "Descrição compatível encontrada no documento.")}</small>
          ${candidate.sourceFileName ? `<small class="charge-candidate-source">Fonte: ${escapeChargeHtml(candidate.sourceFileName)}</small>` : ""}
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

  function renderResult() {
    const caseData = state.caseData || {};
    const candidates = Array.isArray(caseData.candidates) ? caseData.candidates : [];
    const audit = buildChargeAuditSnapshot(caseData);
    const analysisLabel = chargeClassificationLabel(caseData.evaluation || {});
    const hypotheticalDouble = audit.disputedCount
      ? formatChargeCurrency(audit.hypotheticalDouble)
      : "Aguardando confirmação";

    const isCompleteHistory = state.documentAvailability === "complete";
    const isPartialHistory = state.documentAvailability === "partial";
    const resultEyebrow = isCompleteHistory ? "Auditoria documental" : "Análise parcial";
    const reportTitle = isCompleteHistory
      ? "Apuração dos documentos enviados"
      : "Apuração da evidência recente";
    const reportFooter = isCompleteHistory
      ? "Os valores usam somente os documentos enviados. Meses ausentes, correção, juros, indenizações e aplicação jurídica dependem de revisão do caso."
      : "Os valores desta seção usam apenas o documento recente. Para estimar o período sem extratos, complete a simulação abaixo; ela ficará separada da base documental.";

    stage.innerHTML = `
      <div class="charge-result-heading">
        <div>
          <p class="eyebrow">${resultEyebrow}</p>
          <h3>${escapeChargeHtml(analysisLabel)}</h3>
          <p>${escapeChargeHtml(caseData.document?.fileName || "Documento analisado")} · leitura automatizada e regras verificáveis</p>
        </div>
        <span>${audit.candidateCount} ${audit.candidateCount === 1 ? "sinal" : "sinais"}</span>
      </div>

      <section class="charge-result-candidates" aria-label="Lançamentos encontrados">
        ${
          candidates.length
            ? candidates.map((candidate) => candidateMarkup(candidate, caseData.id)).join("")
            : `
              <div class="charge-analysis-empty">
                <strong>Nenhuma descrição conhecida foi localizada.</strong>
                <p>Isso não certifica que a fatura esteja correta. A qualidade do documento e descrições não catalogadas podem exigir revisão humana.</p>
              </div>
            `
        }
      </section>

      <section class="charge-audit-report" aria-label="Relatório técnico preliminar">
        <header>
          <div>
            <p class="eyebrow">Relatório técnico preliminar</p>
            <h3>${reportTitle}</h3>
          </div>
          <span>Não é decisão jurídica</span>
        </header>
        <div class="charge-audit-table-wrap">
          <table>
            <thead>
              <tr><th>Rubrica</th><th>Base da apuração</th><th>Valor / status</th></tr>
            </thead>
            <tbody>
              <tr>
                <th>Cobranças sinalizadas</th>
                <td>${audit.candidateCount} lançamento(s) localizado(s) no documento</td>
                <td>${formatChargeCurrency(audit.totalDetected)}</td>
              </tr>
              <tr>
                <th>Valores não reconhecidos</th>
                <td>${audit.disputedCount} lançamento(s) marcado(s) pelo usuário</td>
                <td>${formatChargeCurrency(audit.totalDisputed)}</td>
              </tr>
              <tr>
                <th>Cenário matemático em dobro</th>
                <td>Art. 42 do CDC, condicionado à análise jurídica e ao caso concreto</td>
                <td>${hypotheticalDouble}</td>
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

      ${isPartialHistory ? (state.estimate ? estimateReportMarkup() : estimateFormMarkup({ inline: true })) : ""}

      ${
        state.estimate
          ? `<section class="charge-petition-note" aria-label="Próxima etapa da petição">
              <strong>Base documental e estimativa separadas</strong>
              <p>O relatório e a minuta poderão usar a evidência recente e a simulação declaratória em seções distintas, sem apresentar o período estimado como comprovado.</p>
            </section>`
          : ""
      }

      <div class="charge-result-actions">
        <button type="button" class="secondary-action" data-charge-action="new-document">Revisar documentos</button>
        <button type="button" class="primary-action" disabled>Relatório e petição · próxima etapa</button>
      </div>
    `;
  }

  function renderEnded() {
    stage.innerHTML = `
      <div class="charge-analysis-finish">
        <span class="charge-analysis-mark" aria-hidden="true">
          <img src="assets/audita-logo-white.svg" alt="" />
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
    else if (state.screen === "upload") renderUpload();
    else if (state.screen === "analyzing") renderAnalyzing();
    else if (state.screen === "result") renderResult();
    else if (state.screen === "estimate") renderEstimate();
    else if (state.screen === "estimate-result") renderEstimateResult();
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
      state.screen = "result";
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

  stage.addEventListener("click", (event) => {
    const button = event.target.closest("[data-charge-action]");
    if (!button) return;
    const action = button.dataset.chargeAction;
    state.error = "";

    if (action === "has-card") {
      continueFromTriage("Possuo ou já possuí um desses cartões.", () => {
        state.route = "consumer";
        state.screen = "documents";
      });
      return;
    } else if (action === "show-brands") {
      continueFromTriage("Não tenho certeza.", () => {
        state.route = "consumer";
        state.screen = "brands";
      });
      return;
    } else if (action === "lawyer") {
      continueFromTriage("Sou advogado(a).", () => {
        state.route = "lawyer";
        state.screen = "documents";
      });
      return;
    } else if (action === "no-card") {
      continueFromTriage("Não tenho e nunca tive.", () => {
        state.screen = "ended";
      });
      return;
    } else if (action === "back-triage" || action === "restart") {
      state.screen = "triage";
      state.route = "consumer";
      state.selectedBrand = "";
      state.documentAvailability = "";
      state.selectedFile = null;
      state.selectedFiles = [];
      state.consent = false;
      state.caseData = null;
      state.caseBatches = [];
      state.estimate = null;
      state.estimateDraft = {
        description: "",
        monthlyAmount: "",
        durationValue: "",
        durationUnit: "months",
        confirmed: false,
      };
    } else if (action === "select-brand") {
      state.selectedBrand = button.dataset.chargeBrand || "";
      render();
      return;
    } else if (action === "continue-brand") {
      state.screen = "documents";
    } else if (action === "documents-complete") {
      continueFromTriage("Tenho todos ou a maior parte dos extratos.", () => {
        resetEstimateDraft();
        state.documentAvailability = "complete";
        state.screen = "upload";
      });
      return;
    } else if (action === "documents-partial") {
      continueFromTriage("Tenho apenas alguns documentos ou um print recente.", () => {
        resetEstimateDraft();
        state.documentAvailability = "partial";
        state.screen = "upload";
      });
      return;
    } else if (action === "documents-none") {
      continueFromTriage("Não tenho nenhum extrato.", () => {
        resetEstimateDraft();
        state.documentAvailability = "none";
        state.screen = "estimate";
      });
      return;
    } else if (action === "back-documents") {
      state.selectedFile = null;
      state.selectedFiles = [];
      state.consent = false;
      state.caseData = null;
      state.caseBatches = [];
      state.estimate = null;
      resetEstimateDraft();
      state.documentAvailability = "";
      state.screen = "documents";
    } else if (action === "new-document") {
      state.selectedFile = null;
      state.selectedFiles = [];
      state.consent = false;
      state.caseData = null;
      state.caseBatches = [];
      state.estimate = null;
      resetEstimateDraft();
      state.documentAvailability = "";
      state.screen = "documents";
    } else if (action === "edit-estimate") {
      state.estimate = null;
      state.screen = "estimate";
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
    if (event.target.id === "chargeEstimateDescription") {
      state.estimateDraft.description = event.target.value;
    }
    if (event.target.id === "chargeEstimateMonthlyAmount") {
      state.estimateDraft.monthlyAmount = event.target.value;
    }
    if (event.target.id === "chargeEstimateDurationValue") {
      state.estimateDraft.durationValue = event.target.value;
    }
  });

  stage.addEventListener("change", (event) => {
    if (event.target.id === "chargeAnalysisFile") {
      const files = Array.from(event.target.files || []);
      state.selectedFiles = state.documentAvailability === "complete" ? files : files.slice(0, 1);
      state.selectedFile = state.selectedFiles[0] || null;
      renderUpload();
    }
    if (event.target.id === "chargeAnalysisConsent") {
      state.consent = event.target.checked;
      renderUpload();
    }
    if (event.target.id === "chargeEstimateDurationUnit") {
      state.estimateDraft.durationUnit = event.target.value === "years" ? "years" : "months";
    }
    if (event.target.id === "chargeEstimateConfirmed") {
      state.estimateDraft.confirmed = event.target.checked;
    }
  });

  stage.addEventListener("submit", (event) => {
    if (event.target.id === "chargeEstimateForm") {
      event.preventDefault();
      const formData = new FormData(event.target);
      const monthlyAmount = parseChargeAmount(formData.get("monthlyAmount"));
      const durationValue = Number(formData.get("durationValue"));
      const description = String(formData.get("description") || "").trim();
      const confirmed = formData.get("confirmed") === "on";

      if (!description) {
        setError("Informe como a cobrança aparece ou como você se recorda dela.");
        return;
      }
      if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) {
        setError("Informe um valor mensal maior que zero.");
        return;
      }
      if (!Number.isInteger(durationValue) || durationValue <= 0) {
        setError("Informe por quantos meses ou anos a cobrança ocorreu.");
        return;
      }
      if (!confirmed) {
        setError("Confirme que os dados informados são aproximados.");
        return;
      }

      state.estimateDraft = {
        description,
        monthlyAmount: String(formData.get("monthlyAmount") || ""),
        durationValue: String(durationValue),
        durationUnit: formData.get("durationUnit") === "years" ? "years" : "months",
        confirmed: true,
      };
      state.estimate = {
        description,
        ...buildChargeEstimate({
          monthlyAmount,
          durationValue,
          durationUnit: state.estimateDraft.durationUnit,
        }),
      };
      state.screen = state.documentAvailability === "partial" ? "result" : "estimate-result";
      render();
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
    state.selectedFiles = state.documentAvailability === "complete" ? files : files.slice(0, 1);
    state.selectedFile = state.selectedFiles[0] || null;
    renderUpload();
  });

  render();
}
