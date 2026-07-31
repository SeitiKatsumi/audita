const adminBillingNav = document.querySelector("#adminBillingNav");
const billingAdminRefresh = document.querySelector("#billingAdminRefresh");
const billingAdminError = document.querySelector("#billingAdminError");
const billingAdminMrr = document.querySelector("#billingAdminMrr");
const billingAdminActiveSubscriptions = document.querySelector(
  "#billingAdminActiveSubscriptions",
);
const billingAdminPastDue = document.querySelector("#billingAdminPastDue");
const billingAdminOutstandingCredits = document.querySelector(
  "#billingAdminOutstandingCredits",
);
const billingAdminEvents = document.querySelector("#billingAdminEvents");
const billingAdminStatus = document.querySelector("#billingAdminStatus");
const billingReadinessList = document.querySelector("#billingReadinessList");
const billingAdminConfigurationNote = document.querySelector(
  "#billingAdminConfigurationNote",
);
const billingAdminEventRows = document.querySelector("#billingAdminEventRows");
const billingAdminPlanGrid = document.querySelector("#billingAdminPlanGrid");
const billingAdminPackGrid = document.querySelector("#billingAdminPackGrid");
const billingAdminOperationRows = document.querySelector(
  "#billingAdminOperationRows",
);
const billingAdminSubscriptionRows = document.querySelector(
  "#billingAdminSubscriptionRows",
);
const billingSubscriptionStatus = document.querySelector(
  "#billingSubscriptionStatus",
);
const billingTabs = document.querySelectorAll("[data-billing-tab]");
const billingPanels = document.querySelectorAll("[data-billing-panel]");

let billingDashboard = null;
let billingAdminAllowed = false;
let billingAdminLoading = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatMoney(price, monthlyEquivalent = false) {
  if (!price || !Number.isFinite(Number(price.cents))) return "Sob consulta";
  const amount = Number(price.cents) / 100 / (monthlyEquivalent ? 12 : 1);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: price.currency || "BRL",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(status) {
  const labels = {
    active: "Ativa",
    trialing: "Em teste",
    past_due: "Pagamento pendente",
    canceled: "Cancelada",
    unpaid: "N\u00e3o paga",
    paused: "Pausada",
    incomplete: "Incompleta",
    inactive: "Inativa",
    processed: "Processado",
    ignored: "Ignorado",
    failed: "Falhou",
    processing: "Processando",
  };
  return labels[status] || status || "-";
}

function statusTone(status) {
  if (["active", "trialing", "processed"].includes(status)) return "positive";
  if (["past_due", "processing"].includes(status)) return "warning";
  if (["failed", "unpaid"].includes(status)) return "negative";
  return "neutral";
}

function emptyRow(message, columns) {
  return `<tr><td class="billing-empty-row" colspan="${columns}">${escapeHtml(message)}</td></tr>`;
}

function setBillingTab(tabId) {
  billingTabs.forEach((tab) => {
    const active = tab.dataset.billingTab === tabId;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  billingPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.billingPanel === tabId);
  });
}

function renderMetrics(summary = {}) {
  if (billingAdminMrr) billingAdminMrr.textContent = formatMoney(summary.mrr);
  if (billingAdminActiveSubscriptions) {
    billingAdminActiveSubscriptions.textContent = formatNumber(
      summary.activeSubscriptions,
    );
  }
  if (billingAdminPastDue) {
    const pending = Number(summary.pastDueSubscriptions || 0);
    billingAdminPastDue.textContent = pending
      ? `${formatNumber(pending)} pagamento${pending === 1 ? "" : "s"} pendente${pending === 1 ? "" : "s"}`
      : "Nenhuma pend\u00eancia";
  }
  if (billingAdminOutstandingCredits) {
    billingAdminOutstandingCredits.textContent = formatNumber(
      summary.outstandingCredits,
    );
  }
  if (billingAdminEvents) {
    billingAdminEvents.textContent = formatNumber(summary.processedEvents30d);
  }
}

function renderReadiness(configuration = {}, databaseReady = false) {
  const planPricesReady =
    Number(configuration.configuredPlanPrices || 0) ===
    Number(configuration.expectedPlanPrices || 0);
  const packsReady =
    Number(configuration.configuredCreditPacks || 0) ===
    Number(configuration.expectedCreditPacks || 0);
  const rows = [
    {
      label: "Banco de dados",
      ready: databaseReady,
      detail: databaseReady
        ? "Assinaturas e carteiras persistentes"
        : "Sem persist\u00eancia de assinaturas neste ambiente",
    },
    {
      label: "Stripe",
      ready: configuration.stripeMode !== "not_configured",
      detail:
        configuration.stripeMode === "live"
          ? "Credencial de produ\u00e7\u00e3o"
          : configuration.stripeMode === "test"
            ? "Credencial de teste"
            : "Credencial n\u00e3o configurada",
    },
    {
      label: "Checkout",
      ready: Boolean(configuration.checkoutReady && planPricesReady && packsReady),
      detail: `${configuration.configuredPlanPrices || 0}/${configuration.expectedPlanPrices || 0} pre\u00e7os de planos e ${configuration.configuredCreditPacks || 0}/${configuration.expectedCreditPacks || 0} pacotes`,
    },
    {
      label: "Webhooks",
      ready: Boolean(configuration.webhookReady),
      detail: configuration.webhookReady
        ? "Renova\u00e7\u00f5es e pagamentos sincronizados"
        : "Segredo de assinatura pendente",
    },
  ];
  if (billingReadinessList) {
    billingReadinessList.innerHTML = rows
      .map(
        (row) => `
          <div class="billing-readiness-item">
            <span class="billing-readiness-dot ${row.ready ? "ready" : ""}" aria-hidden="true"></span>
            <div>
              <strong>${escapeHtml(row.label)}</strong>
              <small>${escapeHtml(row.detail)}</small>
            </div>
          </div>
        `,
      )
      .join("");
  }

  const fullyReady = rows.every((row) => row.ready);
  if (billingAdminStatus) {
    billingAdminStatus.textContent = fullyReady
      ? "Pronto para vender"
      : "Configura\u00e7\u00e3o pendente";
    billingAdminStatus.dataset.tone = fullyReady ? "positive" : "warning";
  }
  if (billingAdminConfigurationNote) {
    const missing = Array.isArray(configuration.missing)
      ? configuration.missing
      : [];
    billingAdminConfigurationNote.textContent = fullyReady
      ? "A jornada de checkout e renova\u00e7\u00e3o est\u00e1 habilitada."
      : missing.length
        ? `Pend\u00eancias t\u00e9cnicas: ${missing.join(", ")}.`
        : "Conclua os pre\u00e7os dos produtos na Stripe antes de abrir as vendas.";
  }
}

function renderPlans(catalog = {}) {
  const plans = Array.isArray(catalog.plans) ? catalog.plans : [];
  if (billingAdminPlanGrid) {
    billingAdminPlanGrid.innerHTML = plans
      .map((plan) => {
        const monthly = plan.prices?.monthly;
        const annual = plan.prices?.annual;
        const checkoutReady =
          plan.kind === "free" ||
          plan.kind === "contact" ||
          Boolean(monthly?.checkoutAvailable && annual?.checkoutAvailable);
        return `
          <article class="billing-plan-admin-card ${plan.recommended ? "recommended" : ""}">
            <div class="billing-plan-admin-heading">
              <div>
                <span>${escapeHtml(plan.audience)}</span>
                <h3>${escapeHtml(plan.name)}</h3>
              </div>
              <span class="billing-plan-state ${checkoutReady ? "ready" : ""}">
                ${checkoutReady ? "Configurado" : "Price ID pendente"}
              </span>
            </div>
            <p>${escapeHtml(plan.description)}</p>
            <div class="billing-plan-price-row">
              <div>
                <small>Mensal</small>
                <strong>${formatMoney(monthly)}</strong>
              </div>
              <div>
                <small>Anual</small>
                <strong>${formatMoney(annual)}</strong>
              </div>
            </div>
            <dl class="billing-plan-limits">
              <div><dt>Cr&eacute;ditos/m&ecirc;s</dt><dd>${plan.monthlyCredits == null ? "Personalizado" : formatNumber(plan.monthlyCredits)}</dd></div>
              <div><dt>Usu&aacute;rios</dt><dd>${plan.memberLimit == null ? "Personalizado" : formatNumber(plan.memberLimit)}</dd></div>
            </dl>
          </article>
        `;
      })
      .join("");
  }

  const packs = Array.isArray(catalog.creditPacks) ? catalog.creditPacks : [];
  if (billingAdminPackGrid) {
    billingAdminPackGrid.innerHTML = packs
      .map(
        (pack) => `
          <article class="billing-pack-admin-card">
            <div>
              <small>${formatNumber(pack.credits)} cr&eacute;ditos</small>
              <strong>${formatMoney(pack.price)}</strong>
            </div>
            <span>${formatMoney({
              currency: pack.price?.currency || "BRL",
              cents: pack.credits
                ? Math.round(Number(pack.price?.cents || 0) / pack.credits)
                : 0,
            })} / cr&eacute;dito</span>
            <span class="billing-plan-state ${pack.checkoutAvailable ? "ready" : ""}">
              ${pack.checkoutAvailable ? "Configurado" : "Price ID pendente"}
            </span>
          </article>
        `,
      )
      .join("");
  }
}

function renderOperations(operations = [], catalog = {}) {
  if (!billingAdminOperationRows) return;
  if (!operations.length) {
    billingAdminOperationRows.innerHTML = emptyRow(
      "Nenhuma consulta comercial configurada.",
      5,
    );
    return;
  }
  const referencePack =
    (catalog.creditPacks || []).find((pack) => pack.id === "creditos-100") ||
    (catalog.creditPacks || [])[0];
  const centsPerCredit =
    referencePack?.credits > 0
      ? Number(referencePack.price?.cents || 0) / referencePack.credits
      : 0;

  billingAdminOperationRows.innerHTML = operations
    .map((operation) => {
      const estimatedCents =
        Number.isInteger(operation.credits) && centsPerCredit
          ? Math.round(operation.credits * centsPerCredit)
          : null;
      return `
        <tr>
          <td>
            <strong>${escapeHtml(operation.name)}</strong>
            <small>${escapeHtml(operation.category)}</small>
          </td>
          <td>${escapeHtml(operation.provider)}</td>
          <td>${operation.credits == null ? "A definir" : `${formatNumber(operation.credits)} cr\u00e9dito${operation.credits === 1 ? "" : "s"}`}</td>
          <td>${estimatedCents == null ? "A definir" : formatMoney({ currency: "BRL", cents: estimatedCents })}</td>
          <td>
            <span class="billing-table-status" data-tone="${operation.enabled ? "positive" : "neutral"}">
              ${operation.enabled ? "Ativa" : "Pendente"}
            </span>
            <small>${escapeHtml(operation.availability)}</small>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderSubscriptions(subscriptions = []) {
  if (!billingAdminSubscriptionRows) return;
  const status = billingSubscriptionStatus?.value || "";
  const filtered = status
    ? subscriptions.filter((subscription) => subscription.status === status)
    : subscriptions;
  if (!filtered.length) {
    billingAdminSubscriptionRows.innerHTML = emptyRow(
      status
        ? "Nenhuma assinatura com este status."
        : "Nenhuma assinatura real registrada neste ambiente.",
      5,
    );
    return;
  }
  const planNames = new Map(
    (billingDashboard?.catalog?.plans || []).map((plan) => [plan.id, plan.name]),
  );
  billingAdminSubscriptionRows.innerHTML = filtered
    .map(
      (subscription) => `
        <tr>
          <td>
            <strong>${escapeHtml(subscription.tenantName)}</strong>
            <small>${escapeHtml(subscription.customerEmail || "E-mail n\u00e3o informado")}</small>
          </td>
          <td>
            <strong>${escapeHtml(planNames.get(subscription.planId) || subscription.planId)}</strong>
            <small>${subscription.interval === "annual" ? "Anual" : "Mensal"}</small>
          </td>
          <td>
            <span class="billing-table-status" data-tone="${statusTone(subscription.status)}">
              ${escapeHtml(statusLabel(subscription.status))}
            </span>
            ${subscription.cancelAtPeriodEnd ? "<small>Cancelamento agendado</small>" : ""}
          </td>
          <td>${formatDate(subscription.currentPeriodEnd)}</td>
          <td>${formatNumber(subscription.creditBalance)} cr&eacute;ditos</td>
        </tr>
      `,
    )
    .join("");
}

function renderEvents(events = []) {
  if (!billingAdminEventRows) return;
  if (!events.length) {
    billingAdminEventRows.innerHTML = emptyRow(
      "Nenhum evento real de cobran\u00e7a registrado neste ambiente.",
      4,
    );
    return;
  }
  billingAdminEventRows.innerHTML = events
    .map(
      (event) => `
        <tr>
          <td><strong>${escapeHtml(event.type)}</strong></td>
          <td>${escapeHtml(event.tenantName)}</td>
          <td>
            <span class="billing-table-status" data-tone="${statusTone(event.status)}">
              ${escapeHtml(statusLabel(event.status))}
            </span>
          </td>
          <td>${formatDate(event.processedAt || event.eventCreatedAt)}</td>
        </tr>
      `,
    )
    .join("");
}

function renderBillingDashboard(dashboard) {
  billingDashboard = dashboard;
  renderMetrics(dashboard.summary);
  renderReadiness(dashboard.configuration, dashboard.databaseReady);
  renderPlans(dashboard.catalog);
  renderOperations(dashboard.operations, dashboard.catalog);
  renderSubscriptions(dashboard.subscriptions);
  renderEvents(dashboard.recentEvents);
}

async function loadBillingDashboard() {
  if (!billingAdminAllowed || billingAdminLoading) return;
  billingAdminLoading = true;
  billingAdminRefresh?.setAttribute("disabled", "");
  if (billingAdminError) {
    billingAdminError.classList.add("hidden");
    billingAdminError.textContent = "";
  }
  try {
    const response = await fetch("/api/admin/billing", {
      headers: { accept: "application/json" },
    });
    if (response.status === 401 || response.status === 403) {
      billingAdminAllowed = false;
      adminBillingNav?.classList.add("hidden");
      if (window.location.hash === "#admin-planos") window.location.hash = "home";
      return;
    }
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || "N\u00e3o foi poss\u00edvel carregar o painel.");
    }
    renderBillingDashboard(payload);
  } catch (error) {
    if (billingAdminError) {
      billingAdminError.textContent =
        error instanceof Error
          ? error.message
          : "N\u00e3o foi poss\u00edvel carregar o painel.";
      billingAdminError.classList.remove("hidden");
    }
  } finally {
    billingAdminLoading = false;
    billingAdminRefresh?.removeAttribute("disabled");
  }
}

async function configureBillingAdminAccess() {
  try {
    const response = await fetch("/api/auth/me", {
      headers: { accept: "application/json" },
    });
    const auth = await response.json();
    billingAdminAllowed =
      !auth.authRequired ||
      ["super_admin", "owner", "admin"].includes(auth.user?.role);
  } catch {
    billingAdminAllowed = false;
  }
  adminBillingNav?.classList.toggle("hidden", !billingAdminAllowed);
  if (!billingAdminAllowed && window.location.hash === "#admin-planos") {
    window.location.hash = "home";
  }
  if (billingAdminAllowed && window.location.hash === "#admin-planos") {
    loadBillingDashboard();
  }
}

billingTabs.forEach((tab) => {
  tab.addEventListener("click", () => setBillingTab(tab.dataset.billingTab));
});
billingAdminRefresh?.addEventListener("click", loadBillingDashboard);
billingSubscriptionStatus?.addEventListener("change", () => {
  renderSubscriptions(billingDashboard?.subscriptions || []);
});
window.addEventListener("hashchange", () => {
  if (window.location.hash === "#admin-planos") loadBillingDashboard();
});
window.addEventListener("audita:auth-changed", configureBillingAdminAccess);

configureBillingAdminAccess();
