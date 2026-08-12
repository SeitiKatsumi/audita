const planGrid = document.querySelector("#planGrid");
const creditPackList = document.querySelector("#creditPackList");
const monthlyButton = document.querySelector("#monthlyButton");
const annualButton = document.querySelector("#annualButton");
const pageStatus = document.querySelector("#pageStatus");
const accountButton = document.querySelector("#accountButton");
const manageSubscriptionButton = document.querySelector("#manageSubscriptionButton");
const accountSummary = document.querySelector("#accountSummary");
const currentPlanValue = document.querySelector("#currentPlanValue");
const subscriptionStatusValue = document.querySelector("#subscriptionStatusValue");
const creditBalanceValue = document.querySelector("#creditBalanceValue");
const renewalValue = document.querySelector("#renewalValue");
const authDialog = document.querySelector("#authDialog");
const loginTab = document.querySelector("#loginTab");
const registerTab = document.querySelector("#registerTab");
const authTitle = document.querySelector("#authTitle");
const authForm = document.querySelector("#authForm");
const authName = document.querySelector("#authName");
const authEmail = document.querySelector("#authEmail");
const authPassword = document.querySelector("#authPassword");
const nameField = document.querySelector("#nameField");
const authError = document.querySelector("#authError");
const authSubmitButton = document.querySelector("#authSubmitButton");

const state = {
  interval: "monthly",
  catalog: null,
  user: null,
  billing: null,
  authMode: "login",
  pendingPurchase: null,
  busy: false,
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(price) {
  if (!price) return "Sob consulta";
  if (!price.cents) return "Gr\u00e1tis";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: price.currency || "BRL",
    minimumFractionDigits: 2,
  }).format(price.cents / 100);
}

function formatDate(value) {
  if (!value) return "N\u00e3o se aplica";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "N\u00e3o informado"
    : new Intl.DateTimeFormat("pt-BR").format(date);
}

function statusLabel(status) {
  return {
    active: "Ativa",
    trialing: "Em teste",
    past_due: "Pagamento pendente",
    canceled: "Cancelada",
    incomplete: "Incompleta",
    unpaid: "N\u00e3o paga",
  }[status] || "Sem assinatura";
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || "N\u00e3o foi poss\u00edvel concluir a opera\u00e7\u00e3o.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function showStatus(message, type = "") {
  pageStatus.textContent = message;
  pageStatus.className = `page-status ${type}`.trim();
}

function clearStatus() {
  pageStatus.textContent = "";
  pageStatus.className = "page-status hidden";
}

function setBusy(busy) {
  state.busy = busy;
  document.querySelectorAll("[data-purchase]").forEach((button) => {
    if (!button.dataset.permanentDisabled) button.disabled = busy;
  });
  manageSubscriptionButton.disabled = busy;
}

function billingConfigured() {
  return Boolean(
    state.catalog?.billing?.checkoutReady || state.catalog?.billing?.demoMode,
  );
}

function currentSubscription() {
  return state.billing?.subscription || null;
}

function currentPlanId() {
  if (state.billing?.access?.entitled) return state.billing.access.planId || "standard";
  return currentSubscription()?.active ? currentSubscription().planId : "";
}

function planPriceMarkup(plan) {
  if (plan.kind === "contact") {
    return `<div class="plan-price"><strong>Sob consulta</strong><span>Contrato personalizado</span></div>`;
  }
  const selectedPrice = plan.prices?.[state.interval];
  if (!selectedPrice?.cents) {
    return `<div class="plan-price"><strong>Gr\u00e1tis</strong><span>Para come\u00e7ar</span></div>`;
  }
  const annual = state.interval === "annual";
  const displayAmount = annual
    ? { ...selectedPrice, cents: Math.round(selectedPrice.cents / 12) }
    : selectedPrice;
  return `
    <div class="plan-price">
      <strong>${escapeHtml(formatMoney(displayAmount))}</strong>
      <span>${annual ? `por m\u00eas; ${formatMoney(selectedPrice)} cobrados anualmente` : "por m\u00eas"}</span>
    </div>
  `;
}

function planButton(plan) {
  const selectedPrice = plan.prices?.[state.interval];
  const isCurrent = plan.id === currentPlanId();
  if (plan.kind === "contact") {
    return `
      <a class="plan-action" href="mailto:elevenmindbusiness@gmail.com?subject=Audita%20Enterprise">
        Falar com o comercial
      </a>
    `;
  }
  if (plan.kind === "free") {
    return `
      <button
        class="plan-action"
        type="button"
        data-auth-action
        ${state.user ? "disabled data-permanent-disabled=\"true\"" : ""}
      >
        ${state.user ? (isCurrent ? "Plano atual" : "Inclu\u00eddo na conta") : "Criar conta gr\u00e1tis"}
      </button>
    `;
  }

  let label = isCurrent ? "Plano atual" : `Assinar ${plan.name}`;
  let disabled = isCurrent;
  if (!billingConfigured() || !selectedPrice?.checkoutAvailable) {
    label = "Contrata\u00e7\u00e3o em configura\u00e7\u00e3o";
    disabled = true;
  } else if (state.user && state.billing && !state.billing.canManage) {
    label = "Solicite ao administrador";
    disabled = true;
  }
  return `
    <button
      class="plan-action"
      type="button"
      data-purchase="subscription"
      data-plan-id="${escapeHtml(plan.id)}"
      ${disabled ? "disabled data-permanent-disabled=\"true\"" : ""}
    >
      ${escapeHtml(label)}
    </button>
  `;
}

function renderPlans() {
  if (!state.catalog) {
    planGrid.innerHTML = "<p>Carregando planos...</p>";
    return;
  }
  planGrid.innerHTML = state.catalog.plans
    .map(
      (plan) => `
        <article class="plan-card ${plan.recommended ? "recommended" : ""}">
          ${plan.recommended ? '<span class="plan-badge">Mais escolhido</span>' : ""}
          <h3>${escapeHtml(plan.name)}</h3>
          <p class="plan-audience">${escapeHtml(plan.audience)}</p>
          ${planPriceMarkup(plan)}
          <p class="plan-description">${escapeHtml(plan.description)}</p>
          <ul>
            ${plan.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}
            ${state.interval === "annual" ? (plan.annualBenefits || []).map((feature) => `<li class="annual-benefit">${escapeHtml(feature)}</li>`).join("") : ""}
          </ul>
          ${planButton(plan)}
        </article>
      `,
    )
    .join("");

  planGrid.querySelectorAll("[data-purchase]").forEach((button) => {
    button.addEventListener("click", () => {
      beginPurchase({
        kind: "subscription",
        planId: button.dataset.planId,
        interval: state.interval,
      });
    });
  });
  planGrid.querySelector("[data-auth-action]")?.addEventListener("click", () => {
    openAuth("register");
  });
}

function renderCreditPacks() {
  if (!state.catalog) {
    creditPackList.innerHTML = "";
    return;
  }
  creditPackList.innerHTML = state.catalog.creditPacks
    .map((pack) => {
      let label = `Comprar por ${formatMoney(pack.price)}`;
      let disabled = false;
      if (!billingConfigured() || !pack.checkoutAvailable) {
        label = "Em configura\u00e7\u00e3o";
        disabled = true;
      } else if (state.user && state.billing && !state.billing.canManage) {
        label = "Apenas administrador";
        disabled = true;
      }
      return `
        <article class="credit-pack">
          <h3>${escapeHtml(pack.name)}</h3>
          <p>Uso adicional na carteira da organiza\u00e7\u00e3o</p>
          <button
            class="pack-action"
            type="button"
            data-purchase="credit_pack"
            data-pack-id="${escapeHtml(pack.id)}"
            ${disabled ? "disabled data-permanent-disabled=\"true\"" : ""}
          >
            ${escapeHtml(label)}
          </button>
        </article>
      `;
    })
    .join("");
  creditPackList.querySelectorAll("[data-purchase]").forEach((button) => {
    button.addEventListener("click", () => {
      beginPurchase({
        kind: "credit_pack",
        packId: button.dataset.packId,
      });
    });
  });
}

function renderAccount() {
  accountButton.textContent = state.user ? state.user.name || "Minha conta" : "Entrar";
  accountSummary.classList.toggle("hidden", !state.user);
  const subscription = currentSubscription();
  const plan = state.catalog?.plans?.find((item) => item.id === currentPlanId());
  currentPlanValue.textContent = plan?.name || "Sem plano";
  subscriptionStatusValue.textContent = state.billing?.access?.source === "tester"
    ? "Tester liberado"
    : statusLabel(subscription?.status);
  creditBalanceValue.textContent = String(state.billing?.wallet?.balance || 0);
  renewalValue.textContent = formatDate(subscription?.currentPeriodEnd);
  manageSubscriptionButton.classList.toggle(
    "hidden",
    !state.user || !state.billing?.canManage || !subscription,
  );
}

function render() {
  monthlyButton.classList.toggle("active", state.interval === "monthly");
  annualButton.classList.toggle("active", state.interval === "annual");
  monthlyButton.setAttribute("aria-pressed", String(state.interval === "monthly"));
  annualButton.setAttribute("aria-pressed", String(state.interval === "annual"));
  renderAccount();
  renderPlans();
  renderCreditPacks();
}

function setAuthMode(mode) {
  state.authMode = mode;
  const registering = mode === "register";
  loginTab.classList.toggle("active", !registering);
  registerTab.classList.toggle("active", registering);
  loginTab.setAttribute("aria-selected", String(!registering));
  registerTab.setAttribute("aria-selected", String(registering));
  nameField.classList.toggle("hidden", !registering);
  authName.required = registering;
  authPassword.autocomplete = registering ? "new-password" : "current-password";
  authTitle.textContent = registering ? "Crie sua conta" : "Entre para continuar";
  authSubmitButton.textContent = registering ? "Criar conta" : "Entrar";
  authError.classList.add("hidden");
}

function openAuth(mode = "login") {
  setAuthMode(mode);
  if (!authDialog.open) authDialog.showModal();
  window.setTimeout(() => {
    (mode === "register" ? authName : authEmail).focus();
  }, 0);
}

async function submitAuth(event) {
  event.preventDefault();
  authError.classList.add("hidden");
  authSubmitButton.disabled = true;
  authSubmitButton.textContent =
    state.authMode === "register" ? "Criando conta..." : "Entrando...";
  try {
    const payload = {
      email: authEmail.value.trim(),
      password: authPassword.value,
      ...(state.authMode === "register" ? { name: authName.value.trim() } : {}),
    };
    await fetchJson(
      state.authMode === "register" ? "/api/auth/register" : "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    authForm.reset();
    authDialog.close();
    await loadAccount();
    render();
    if (state.pendingPurchase) {
      const pending = state.pendingPurchase;
      state.pendingPurchase = null;
      await beginPurchase(pending);
    }
  } catch (error) {
    authError.textContent =
      error.status === 401
        ? "E-mail ou senha incorretos."
        : error.payload?.error === "email_already_registered"
          ? "Este e-mail j\u00e1 possui uma conta."
          : error.message;
    authError.classList.remove("hidden");
  } finally {
    authSubmitButton.disabled = false;
    authSubmitButton.textContent =
      state.authMode === "register" ? "Criar conta" : "Entrar";
  }
}

async function beginPurchase(selection) {
  if (state.busy) return;
  if (!state.user) {
    state.pendingPurchase = selection;
    openAuth("register");
    return;
  }
  setBusy(true);
  clearStatus();
  try {
    const demoMode = Boolean(state.catalog?.billing?.demoMode);
    const payload = await fetchJson(
      demoMode ? "/api/billing/demo-subscription" : "/api/billing/checkout",
      {
      method: "POST",
      body: JSON.stringify(demoMode
        ? { interval: selection.interval }
        : { ...selection, requestId: crypto.randomUUID() }),
      },
    );
    if (demoMode) {
      await loadAccount();
      render();
      showStatus("Demonstração ativada. Nenhuma cobrança foi realizada.", "success");
      setBusy(false);
      return;
    }
    if (!payload.url) throw new Error("Checkout indispon\u00edvel.");
    window.location.assign(payload.url);
  } catch (error) {
    const message =
      error.status === 403
        ? "Somente o administrador da organiza\u00e7\u00e3o pode alterar a assinatura."
        : error.message;
    showStatus(message, "error");
    setBusy(false);
  }
}

async function openBillingPortal() {
  if (state.busy) return;
  setBusy(true);
  clearStatus();
  try {
    const payload = await fetchJson("/api/billing/portal", {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (!payload.url) throw new Error("Portal de assinatura indispon\u00edvel.");
    window.location.assign(payload.url);
  } catch (error) {
    showStatus(error.message, "error");
    setBusy(false);
  }
}

async function loadAccount() {
  const auth = await fetchJson("/api/auth/me");
  state.user = auth.user || null;
  state.billing = null;
  if (state.user) {
    try {
      state.billing = await fetchJson("/api/billing/subscription");
    } catch (error) {
      if (error.status !== 401) throw error;
    }
  }
}

function checkoutMessage() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("checkout") === "success") {
    showStatus(
      "Pagamento recebido. A assinatura e os cr\u00e9ditos ser\u00e3o atualizados assim que a Stripe confirmar o evento.",
      "success",
    );
  } else if (params.get("checkout") === "cancelled") {
    showStatus("Checkout cancelado. Nenhuma cobran\u00e7a foi conclu\u00edda.");
  }
}

async function initialize() {
  planGrid.innerHTML = "<p>Carregando planos...</p>";
  try {
    const [catalog] = await Promise.all([
      fetchJson("/api/billing/plans"),
      loadAccount(),
    ]);
    state.catalog = catalog;
    render();
    checkoutMessage();
    if (!catalog.billing.checkoutReady && !catalog.billing.demoMode) {
      showStatus(
        "Os planos est\u00e3o definidos, mas o checkout ainda aguarda a configura\u00e7\u00e3o segura da Stripe.",
      );
    }
  } catch (error) {
    showStatus(error.message, "error");
    planGrid.innerHTML = "";
  }
}

monthlyButton.addEventListener("click", () => {
  state.interval = "monthly";
  render();
});

annualButton.addEventListener("click", () => {
  state.interval = "annual";
  render();
});

accountButton.addEventListener("click", () => {
  if (state.user) {
    window.location.assign("/chat");
  } else {
    openAuth("login");
  }
});

manageSubscriptionButton.addEventListener("click", openBillingPortal);
loginTab.addEventListener("click", () => setAuthMode("login"));
registerTab.addEventListener("click", () => setAuthMode("register"));
authForm.addEventListener("submit", submitAuth);

initialize();
