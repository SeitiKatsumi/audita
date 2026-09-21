// Preserve existing checkout and portal return URLs.
if (typeof document !== "undefined" && !document.querySelector("#meus-dados")) {
  window.location.replace(`/${window.location.search}#meus-dados`);
}

export function initAccountPlans({ getAuthState, showLogin }) {
  const root = document.querySelector("#meus-dados");
  if (!root) return;
  const offer = root.querySelector("#subscriptionOffer");
  const summary = root.querySelector("#subscriptionSummary");
  const message = root.querySelector("#subscriptionMessage");
  const retry = root.querySelector("#subscriptionRetry");
  const cycle = root.querySelector("#subscriptionCycle");
  const savings = root.querySelector("#subscriptionSavings");
  const cycleButtons = [...root.querySelectorAll("[data-subscription-interval]")];
  let catalog = null;
  let billing = null;
  let interval = "monthly";
  let busy = false;
  let revision = 0;

  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
  const money = cents => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  const date = value => value && Number.isFinite(new Date(value).getTime())
    ? new Intl.DateTimeFormat("pt-BR").format(new Date(value)) : "";

  function notice(text = "", error = false) {
    message.textContent = text;
    message.classList.toggle("hidden", !text);
    message.classList.toggle("is-error", error);
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { accept: "application/json", ...(options.body ? { "content-type": "application/json" } : {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(response.status === 403
        ? "Sua conta não tem permissão para gerenciar a assinatura. Fale com o responsável pela sua organização."
        : response.status === 401 ? "Entre novamente para continuar."
          : "Não foi possível carregar ou atualizar sua assinatura. Tente novamente.");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function existingSubscription() {
    const subscription = billing?.subscription;
    return subscription && (subscription.provider !== "demo" || catalog?.billing?.demoMode)
      && !["canceled", "incomplete_expired", "inactive"].includes(subscription.status)
      ? subscription : null;
  }

  function render() {
    const plan = catalog?.plans?.find(item => item.id === "standard");
    if (!plan) throw new Error("O plano está indisponível no momento. Tente novamente mais tarde.");
    const subscription = existingSubscription();
    const selectedInterval = subscription?.interval || interval;
    const price = plan.prices?.[selectedInterval];
    if (!Number.isFinite(price?.cents) || price.cents <= 0) throw new Error("O valor da assinatura está indisponível. Tente novamente mais tarde.");
    const annual = selectedInterval === "annual";
    const demo = Boolean(catalog.billing?.demoMode);
    const user = getAuthState().user;
    const canManage = Boolean(billing?.canManage);
    const checkoutReady = Boolean((catalog.billing?.checkoutReady || demo) && price.checkoutAvailable);
    const canUsePortal = canManage && billing?.subscription?.provider === "stripe";
    const disabled = busy || (user && (!billing || !canManage)) || (subscription ? !canUsePortal : !checkoutReady);
    const yearlySavings = plan.prices?.monthly?.cents * 12 - plan.prices?.annual?.cents;
    savings.textContent = yearlySavings > 0 ? `Economize ${money(yearlySavings)}/ano` : "";
    cycle.hidden = Boolean(subscription);
    cycleButtons.forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.subscriptionInterval === selectedInterval));
      button.disabled = busy;
    });
    const labels = { active: "Assinatura ativa", trialing: "Período de teste", past_due: "Pagamento pendente", unpaid: "Pagamento pendente", incomplete: "Pagamento não concluído", paused: "Assinatura pausada" };
    const renewal = date(subscription?.currentPeriodEnd);
    summary.textContent = subscription
      ? `${labels[subscription.status] || "Sua assinatura"}${renewal ? ` · ${subscription.cancelAtPeriodEnd ? "Acesso até" : "Próxima renovação em"} ${renewal}` : ""}.`
      : billing?.access?.source === "tester" && billing.access.entitled
        ? "Você tem um acesso temporário. Conheça também a assinatura Standard."
        : "Escolha o período e conheça os benefícios do Standard.";
    let label = subscription ? "Gerenciar assinatura" : `Assinar ${annual ? "anual" : "mensal"}`;
    if (!user) label = "Entrar para assinar";
    else if (!canManage) label = "Fale com o responsável pela conta";
    else if (subscription && !canUsePortal) label = demo ? "Demonstração ativa" : "Assinatura atual";
    else if (!subscription && !checkoutReady) label = "Assinatura indisponível no momento";
    else if (demo && !subscription) label = "Experimentar demonstração";
    if (busy) label = "Aguarde...";
    offer.innerHTML = `
      <div class="account-plan">
        <div class="account-benefits">
          <h3>${escape(plan.name)}</h3>
          <p>${escape(plan.description)}</p>
          <ul>${[...(plan.features || []), ...(annual ? plan.annualBenefits || [] : [])].map(feature => `<li>${escape(feature)}</li>`).join("")}</ul>
        </div>
        <div class="account-checkout">
          <span>${annual ? "Assinatura anual" : "Assinatura mensal"}</span>
          <p class="account-price"><strong>${escape(money(annual ? price.cents / 12 : price.cents))}</strong><span>/mês</span></p>
          <p class="account-charge">${annual ? `${escape(money(price.cents))} cobrados uma vez por ano.` : `${escape(money(price.cents))} cobrados a cada mês.`}</p>
          <button class="primary-action" type="button" data-subscription-action ${disabled ? "disabled" : ""}>${escape(label)}</button>
          <small>${demo ? "Ambiente de demonstração. Nenhuma cobrança real." : "Renovação automática. Gerencie ou cancele sua assinatura no portal de pagamento."}</small>
          ${!subscription && canUsePortal ? '<button class="secondary-action" type="button" data-subscription-portal>Gerenciar pagamentos anteriores</button>' : ""}
        </div>
      </div>`;
    offer.querySelector("[data-subscription-action]").addEventListener("click", () => purchaseOrManage(Boolean(subscription)));
    offer.querySelector("[data-subscription-portal]")?.addEventListener("click", () => purchaseOrManage(true));
  }

  async function load() {
    const currentRevision = ++revision;
    billing = null;
    offer.innerHTML = "<p>Carregando assinatura...</p>";
    cycle.hidden = true;
    retry.classList.add("hidden");
    notice();
    try {
      const [nextCatalog, nextBilling] = await Promise.all([
        request("/api/billing/plans"),
        getAuthState().user ? request("/api/billing/subscription") : null,
      ]);
      if (currentRevision !== revision) return;
      catalog = nextCatalog;
      billing = nextBilling;
      render();
      const checkout = new URLSearchParams(window.location.search).get("checkout");
      if (checkout === "success") notice(existingSubscription()?.active
        ? "Sua assinatura está ativa. Aproveite os benefícios!"
        : "Recebemos seu retorno do pagamento. A assinatura será liberada após a confirmação. Use Tentar novamente para atualizar.");
      if (checkout === "success" && !existingSubscription()?.active) retry.classList.remove("hidden");
      if (checkout === "cancelled") notice("Você voltou sem concluir a contratação. Pode escolher seu plano quando quiser.");
    } catch (error) {
      if (currentRevision !== revision) return;
      offer.replaceChildren();
      cycle.hidden = true;
      summary.textContent = "Não foi possível consultar sua assinatura agora.";
      notice(error.message, true);
      retry.classList.remove("hidden");
    }
  }

  async function purchaseOrManage(portal) {
    if (busy) return;
    if (!getAuthState().user) { showLogin("Entre para escolher sua assinatura."); return; }
    if (!billing?.canManage) return;
    const currentRevision = revision;
    busy = true;
    notice();
    render();
    try {
      const demo = !portal && catalog.billing?.demoMode;
      const data = await request(portal ? "/api/billing/portal" : demo ? "/api/billing/demo-subscription" : "/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify(portal ? {} : demo ? { interval } : { kind: "subscription", planId: "standard", interval, requestId: crypto.randomUUID() }),
      });
      if (currentRevision !== revision) return;
      if (demo) {
        await load();
        notice("Demonstração ativada. Nenhuma cobrança foi realizada.");
      } else {
        const url = new URL(data.url);
        if (url.protocol !== "https:") throw new Error("O pagamento está indisponível no momento. Tente novamente.");
        window.location.assign(url.href);
      }
    } catch (error) {
      if (currentRevision === revision) notice(error.message, true);
      if (error.status === 401) showLogin("Entre novamente para continuar.");
    } finally {
      busy = false;
      if (billing && catalog) render();
    }
  }

  cycleButtons.forEach(button => button.addEventListener("click", () => {
    if (busy || !catalog) return;
    interval = button.dataset.subscriptionInterval;
    render();
  }));
  retry.addEventListener("click", load);
  document.addEventListener("audita:pagechange", event => { if (event.detail.page === "meus-dados") void load(); });
  window.addEventListener("audita:auth-changed", () => {
    revision++;
    billing = null;
    offer.replaceChildren();
    if (document.body.dataset.activePage === "meus-dados") void load();
  });
}
