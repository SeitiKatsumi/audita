const PLANS = [
  { id: "chat-experiment", name: "Experimente", cents: 990, messages: 20, pages: 5 },
  { id: "chat-essential", name: "Essencial", cents: 4990, messages: 100, pages: 20 },
  { id: "chat-professional", name: "Profissional", cents: 9990, messages: 300, pages: 80 },
  { id: "chat-premium", name: "Premium", cents: 19990, messages: 700, pages: 200 },
];
const money = cents => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const DRAFT_PREFIX = "audita:chat-checkout:";

// requestLogin(message, resume) must call resume after getAuthState() reflects login.
// prepareDocument resolves the server's analyzed document, or null on cancellation.
export function initChatSubscription({ getAuthState, requestLogin }) {
  const input = document.querySelector("#chatInput");
  const form = document.querySelector("#chatForm");
  if (!input || !form) throw new Error("Chat DOM unavailable");
  if (document.querySelector("#chatSubscriptionDialog")) throw new Error("Chat subscription already initialized");
  const events = new AbortController();
  const dialog = document.createElement("dialog");
  dialog.id = "chatSubscriptionDialog";
  dialog.className = "chat-subscription-dialog";
  dialog.setAttribute("aria-labelledby", "chatSubscriptionTitle");
  dialog.innerHTML = `<header><div><p class="chat-subscription-eyebrow">IA AUDITA</p><h2 id="chatSubscriptionTitle">Planos do chat</h2></div><button type="button" data-close aria-label="Fechar planos" title="Fechar">&#215;</button></header>
    <p data-access role="status"></p><section class="chat-quota" data-quota hidden aria-label="Cotas restantes"></section><p data-notice role="status" aria-live="polite"></p>
    <p data-payment-status role="status"></p><section data-legacy hidden></section><div class="chat-subscription-plans"></div>
    <section class="chat-subscription-rules" aria-label="O que o plano inclui e regras de uso">
      <p><strong>Inclui:</strong> conversa com a IA e leitura de PDF, PNG e JPEG. A an\u00e1lise inicial gera um resumo e consome p\u00e1ginas; perguntas posteriores consomem mensagens.</p>
      <p><strong>N\u00e3o inclui:</strong> consultas externas, certid\u00f5es, servi\u00e7os especializados ou honor\u00e1rios profissionais.</p>
      <p><strong>Uso individual, sem compartilhamento.</strong> Planos mensais renovam no anivers\u00e1rio da contrata\u00e7\u00e3o. Saldos n\u00e3o acumulam entre per\u00edodos e n\u00e3o h\u00e1 cobran\u00e7a autom\u00e1tica por excedentes. Experimente: compra \u00fanica, sem renova\u00e7\u00e3o.</p>
    </section>
    <footer><button type="button" data-refresh>Atualizar acesso</button><button type="button" data-manage hidden>Gerenciar assinatura</button></footer>`;
  const documentDialog = document.createElement("dialog");
  documentDialog.id = "chatDocumentDialog";
  documentDialog.className = "chat-subscription-dialog chat-document-dialog";
  documentDialog.setAttribute("aria-labelledby", "chatDocumentTitle");
  documentDialog.innerHTML = `<header><h2 id="chatDocumentTitle">Confirmar an\u00e1lise</h2><button type="button" data-close aria-label="Fechar documento" title="Fechar">&#215;</button></header>
    <p data-document-name></p><p data-document-pages></p><p data-document-error role="alert"></p>
    <footer><button type="button" data-cancel>Cancelar</button><button type="button" data-analyze>Analisar documento</button></footer>`;
  document.body.append(dialog, documentDialog);
  const quota = document.createElement("section");
  quota.className = "chat-quota chat-quota-inline";
  quota.setAttribute("aria-label", "Cotas restantes");
  quota.hidden = true;
  form.before(quota);
  const accountView = document.querySelector("#accountSubscription");
  if (accountView) {
    accountView.replaceChildren(...[...dialog.children].filter(node => node.tagName !== "HEADER").map(node => node.cloneNode(true)));
  }
  const notice = dialog.querySelector("[data-notice]");
  const manage = dialog.querySelector("[data-manage]");
  const cards = dialog.querySelector(".chat-subscription-plans");
  let access = null, catalog = null, billing = null;
  let owner = userId(), revision = 0, loaded = false, busy = false, loading = null;
  let pendingPlan = null, checkoutRequest = null, documentBusy = false, documentResolve = null;
  let prepared = null, analysisRequestId = null, destroyed = false;

  function userId() {
    const auth = getAuthState(), user = auth?.user;
    return user?.id ? `${encodeURIComponent(user.tenant?.id || auth.tenantId || "")}:${encodeURIComponent(user.id)}` : "";
  }
  function allowed(kind = "messages") {
    return Boolean(owner && owner === userId() && loaded && access?.active === true &&
      (Number(access.remaining?.[kind]) > 0 || (access.legacy === true && access.remaining?.[kind] == null)));
  }
  async function request(url, body) {
    const response = await fetch(url, { method: body === undefined ? "GET" : "POST", credentials: "same-origin",
      cache: "no-store", headers: { accept: "application/json", ...(body === undefined ? {} : { "content-type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(response.status === 401 ? "Entre novamente para continuar." : response.status === 413
        ? "O arquivo excede o limite de 12 MB." : [402, 429].includes(response.status)
          ? "Saldo insuficiente. Confira seu plano e o consumo." : "N\u00e3o foi poss\u00edvel concluir. Tente novamente.");
      error.status = response.status;
      throw error;
    }
    return data;
  }
  function catalogPlan(id) { return catalog?.chatPlans?.find(plan => plan.id === id); }
  function priceFor(id) { return catalogPlan(id)?.price; }
  function available(id) {
    const price = priceFor(id);
    return Boolean(catalogPlan(id)?.checkoutAvailable && price?.currency === "BRL" && Number.isFinite(price.cents) && price.cents > 0);
  }
  function accessText() {
    if (!owner) return "Escolha um plano para conversar e analisar documentos.";
    if (!loaded) return "Consultando acesso...";
    if (!access?.active) return "Nenhum plano de chat ativo.";
    const plan = PLANS.find(item => item.id === access.planId);
    const remaining = access.remaining;
    let text = `${plan?.name || (access.legacy ? "Acesso legado" : "Chat ativo")} \u00b7 ${remaining?.messages ?? "-"} mensagens e ${remaining?.pages ?? "-"} p\u00e1ginas restantes`;
    for (const [kind, label] of [["messages", "Mensagens"], ["pages", "P\u00e1ginas"]]) {
      if (Number.isFinite(access.used?.[kind]) && Number.isFinite(access.limits?.[kind])) {
        text += ` \u00b7 ${label}: ${access.used[kind]}/${access.limits[kind]} usadas`;
      }
    }
    if (access.periodEnd && Number.isFinite(new Date(access.periodEnd).getTime())) {
      const end = new Intl.DateTimeFormat("pt-BR").format(new Date(access.periodEnd));
      text += ` \u00b7 ${access.planId === "chat-experiment" || billing?.subscription?.cancelAtPeriodEnd ? "Acesso at\u00e9" : "Fim do per\u00edodo"} ${end}`;
    }
    return text;
  }
  function render() {
    const focusedPlan = cards.contains(document.activeElement) ? document.activeElement.dataset.plan : null;
    const text = accessText();
    dialog.querySelector("[data-access]").textContent = text;
    const quotaHtml = owner && owner === userId() && loaded && access?.active ? [["messages", "Mensagens"], ["pages", "P\u00e1ginas"]].map(([kind, label]) => {
      const limit = access.limits?.[kind], remaining = access.remaining?.[kind];
      if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(remaining)) return "";
      const balance = Math.max(0, Math.min(limit, remaining));
      const percent = Math.floor(balance / limit * 100);
      return `<div class="chat-quota-item" data-quota-kind="${kind}"><div><span>${label}</span><span>${percent}% restante</span></div><meter min="0" max="${limit}" value="${balance}" aria-label="${label} restantes">${percent}%</meter><small>${balance} de ${limit} restantes</small></div>`;
    }).join("") : "";
    for (const target of [quota, dialog.querySelector("[data-quota]")]) {
      target.innerHTML = quotaHtml;
      target.hidden = !quotaHtml;
    }
    dialog.querySelector("[data-payment-status]").textContent = !catalog
      ? loaded ? "Pagamentos indispon\u00edveis: n\u00e3o foi poss\u00edvel verificar a configura\u00e7\u00e3o deste ambiente." : "Consultando disponibilidade dos pagamentos."
      : `${catalog.billing?.demoMode || catalog.billing?.mode === "test" ? "Ambiente de testes: sem cobran\u00e7a real. " : ""}${!PLANS.some(plan => available(plan.id)) ? "Pagamentos indispon\u00edveis neste ambiente: a configura\u00e7\u00e3o de cobran\u00e7a n\u00e3o est\u00e1 habilitada. Nenhuma compra pode ser conclu\u00edda." : ""}`;
    manage.hidden = !(owner && (access?.active && !access.legacy || billing?.canManage && billing?.subscription?.provider === "stripe"));
    manage.disabled = busy;
    const legacy = billing?.subscription?.planId === "standard" ? billing.subscription : null;
    const legacyPlan = catalog?.plans?.find(plan => plan.id === "standard");
    const legacyView = dialog.querySelector("[data-legacy]");
    legacyView.hidden = !legacy;
    const legacyPrice = legacyPlan?.prices?.[legacy?.interval];
    const legacyStatus = { active: "Ativo", past_due: "Pagamento pendente", unpaid: "Pagamento pendente", canceled: "Cancelado", trialing: "Em teste" }[legacy?.status] || "Verifique o contrato";
    legacyView.innerHTML = legacy ? `<h3>Seu contrato Standard</h3><p>${legacyStatus} · ${legacy.interval === "annual" ? "Anual" : "Mensal"}${legacyPrice ? ` · ${escape(money(legacyPrice.cents))}` : ""}. Contrato existente, sem migra\u00e7\u00e3o autom\u00e1tica.</p><ul>${[...(legacyPlan?.features || []), ...(legacy.interval === "annual" ? legacyPlan?.annualBenefits || [] : [])].map(feature => `<li>${escape(feature)}</li>`).join("")}</ul>` : "";
    dialog.querySelector("[data-refresh]").disabled = busy || Boolean(loading);
    cards.innerHTML = PLANS.map(plan => {
      const experiment = plan.id === "chat-experiment";
      const recommended = plan.id === "chat-professional";
      const price = priceFor(plan.id);
      const cents = Number.isFinite(price?.cents) && price.cents > 0 ? price.cents : plan.cents;
      const current = access?.active && access.planId === plan.id;
      const disabled = busy || !available(plan.id) || current || (experiment && access?.trialUsed);
      return `<article class="chat-subscription-plan${recommended ? " is-recommended" : ""}">
        <span class="chat-subscription-badge">${recommended ? "Recomendado" : current ? "Plano atual" : "&nbsp;"}</span>
        <h3>${plan.name}</h3><p class="chat-subscription-price"><strong>${escape(money(cents))}</strong><span>${experiment ? " / 30 dias" : " / m\u00eas"}</span></p>
        <ul><li>${plan.messages} mensagens</li><li>${plan.pages} p\u00e1ginas de documentos</li></ul>
        <p class="chat-subscription-terms">${experiment ? "Compra \u00fanica por conta. V\u00e1lido por 30 dias, sem renova\u00e7\u00e3o autom\u00e1tica." : "Renova\u00e7\u00e3o mensal autom\u00e1tica. Gerencie ou cancele no portal de pagamento."}</p>
        <button type="button" data-plan="${plan.id}" ${disabled ? "disabled" : ""}>${current ? "Plano atual" : busy ? "Aguarde..." : !available(plan.id) ? "Indispon\u00edvel" : experiment ? "Experimentar" : `Escolher ${plan.name}`}</button></article>`;
    }).join("");
    if (accountView) {
      const focused = accountView.contains(document.activeElement) ? document.activeElement.dataset.plan : null;
      accountView.querySelector(".chat-subscription-plans").innerHTML = cards.innerHTML;
      for (const selector of ["[data-access]", "[data-quota]", "[data-notice]", "[data-payment-status]", "[data-legacy]"]) {
        const source = dialog.querySelector(selector), target = accountView.querySelector(selector);
        target.innerHTML = source.innerHTML;
        target.hidden = source.hidden;
      }
      for (const selector of ["[data-manage]", "[data-refresh]"]) {
        const source = dialog.querySelector(selector), target = accountView.querySelector(selector);
        target.hidden = source.hidden;
        target.disabled = source.disabled;
      }
      if (focused) {
        const button = [...accountView.querySelectorAll("[data-plan]")].find(item => item.dataset.plan === focused);
        (button && !button.disabled ? button : accountView.querySelector("[data-refresh]")).focus();
      }
    }
    if (focusedPlan && dialog.open) {
      const button = [...cards.querySelectorAll("[data-plan]")].find(item => item.dataset.plan === focusedPlan);
      (button && !button.disabled ? button : dialog.querySelector("[data-close]")).focus();
    }
  }
  function purgeDrafts(except = "") {
    try {
      for (const key of Object.keys(sessionStorage)) {
        if (key.startsWith(DRAFT_PREFIX) && key !== except) sessionStorage.removeItem(key);
      }
    } catch { /* Storage can be disabled by the browser. */ }
  }
  function saveDraft() {
    if (!owner || owner !== userId()) return;
    try { sessionStorage.setItem(DRAFT_PREFIX + owner, JSON.stringify({ text: input.value.slice(0, 5000), expires: Date.now() + 30 * 60 * 1000 })); }
    catch { /* Checkout still works without optional draft persistence. */ }
  }
  function restoreDraft() {
    if (!owner) return;
    const key = DRAFT_PREFIX + owner;
    purgeDrafts(key);
    try {
      const draft = JSON.parse(sessionStorage.getItem(key) || "null");
      sessionStorage.removeItem(key);
      if (draft?.expires > Date.now() && typeof draft.text === "string" && !input.value) {
        input.value = draft.text.slice(0, 5000);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } catch { /* Malformed or unavailable storage must not block the chat. */ }
  }
  async function refresh() {
    if (destroyed) return null;
    if (owner !== userId()) return onAuthChanged();
    if (loading) return loading;
    const version = revision;
    loading = (async () => {
      try {
        const nextCatalog = await request("/api/billing/plans");
        if (version !== revision || owner !== userId()) return null;
        catalog = nextCatalog;
        if (owner) {
          const data = await request("/api/chat/access");
          if (version !== revision || owner !== userId()) return null;
          access = data.access || null;
          const nextBilling = await request("/api/billing/subscription").catch(() => null);
          if (version !== revision || owner !== userId()) return null;
          billing = nextBilling;
        } else access = null;
        loaded = true;
        const checkout = new URLSearchParams(location.search).get("checkout");
        notice.textContent = checkout === "success" ? access?.active
          ? "Acesso confirmado pelo servidor." : "Pagamento ainda n\u00e3o confirmado. Atualize o acesso em instantes."
          : ["cancelled", "canceled"].includes(checkout) ? "Pagamento n\u00e3o conclu\u00eddo. Seu rascunho foi preservado." : "";
        return access;
      } catch (error) {
        if (version === revision && owner === userId()) { access = catalog = null; loaded = true; notice.textContent = error.message; }
        return null;
      } finally {
        if (version === revision) { loading = null; render(); }
      }
    })();
    render();
    return loading;
  }
  function open() {
    if (destroyed) return;
    render();
    if (!dialog.open) dialog.showModal();
    void refresh();
  }
  async function ensureAccess(kind = "messages") {
    await refresh();
    if (allowed(kind)) return true;
    open();
    return false;
  }
  function handleAccessError(status) {
    if (![402, 429].includes(Number(status))) return false;
    access = null;
    loaded = false;
    open();
    notice.textContent = "Saldo insuficiente. Confira seu plano e o consumo.";
    return true;
  }
  async function onAuthChanged() {
    const next = userId();
    if (next !== owner) {
      const previous = owner;
      revision++;
      loading = null;
      owner = next;
      access = billing = null;
      loaded = false;
      checkoutRequest = null;
      if (previous) { input.value = ""; pendingPlan = null; purgeDrafts(); }
      finishDocument(null);
      if (documentDialog.open) documentDialog.close();
      restoreDraft();
    }
    await refresh();
    if (pendingPlan && owner) {
      const selected = pendingPlan;
      pendingPlan = null;
      open();
      await checkout(selected);
    }
  }
  async function checkout(planId, portal = false) {
    if (busy || (!portal && !available(planId))) return;
    if (!userId()) {
      pendingPlan = planId;
      dialog.close();
      requestLogin("Entre para contratar seu plano do chat.", onAuthChanged);
      return;
    }
    const version = revision, account = userId();
    busy = true;
    notice.textContent = "";
    render();
    try {
      if (!checkoutRequest || checkoutRequest.planId !== planId) checkoutRequest = { planId, requestId: crypto.randomUUID() };
      const legacyPortal = access?.legacy || (!access?.active && billing?.subscription?.planId === "standard");
      const data = await request(portal ? "/api/billing/portal" : "/api/billing/checkout", portal ? (legacyPortal ? {} : { kind: "chat" }) : {
        kind: planId === "chat-experiment" ? "chat_experiment" : "chat_subscription", planId,
        interval: planId === "chat-experiment" ? "once" : "monthly", requestId: checkoutRequest.requestId,
      });
      if (version !== revision || account !== userId()) return;
      const url = new URL(data.url);
      if (url.protocol !== "https:" || url.username || url.password) throw new Error("Endere\u00e7o de pagamento inv\u00e1lido.");
      saveDraft();
      location.assign(url.href);
    } catch (error) {
      if (version !== revision || account !== userId()) return;
      notice.textContent = error.message;
      if (error.status === 401) {
        access = null;
        pendingPlan = portal ? null : planId;
        dialog.close();
        requestLogin(error.message, onAuthChanged);
      }
    } finally { busy = false; render(); }
  }
  function finishDocument(value) {
    const resolve = documentResolve;
    documentResolve = null;
    prepared = null;
    documentBusy = false;
    resolve?.(value);
  }
  async function prepareDocument(file) {
    if (documentBusy || documentResolve) throw new Error("Aguarde o documento atual.");
    if (!file || !["application/pdf", "image/png", "image/jpeg"].includes(file.type)) throw new Error("Use PDF, PNG ou JPEG.");
    if (!file.size || file.size > 12 * 1024 * 1024) throw new Error(file.size ? "O arquivo excede o limite de 12 MB." : "O arquivo est\u00e1 vazio.");
    documentBusy = true;
    const version = revision, account = userId();
    try {
      if (!await ensureAccess("pages")) return null;
      const contentBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("N\u00e3o foi poss\u00edvel ler o arquivo."));
        reader.readAsDataURL(file);
      });
      if (version !== revision || account !== userId()) return null;
      const result = await request("/api/chat/documents/prepare", { fileName: file.name, mimeType: file.type, contentBase64 });
      if (version !== revision || account !== userId()) return null;
      prepared = result.document;
      if (!prepared?.id || !Number.isInteger(prepared.pages) || prepared.pages <= 0) throw new Error("Contagem de p\u00e1ginas indispon\u00edvel. Nenhuma an\u00e1lise foi solicitada.");
      analysisRequestId = crypto.randomUUID();
      documentDialog.querySelector("[data-document-name]").textContent = file.name;
      documentDialog.querySelector("[data-document-pages]").textContent = `${prepared.pages} p\u00e1gina(s) ser\u00e3o descontadas do saldo ao analisar. Saldo atual: ${access.remaining?.pages ?? "-"}.`;
      const insufficient = !(access.legacy && access.remaining?.pages == null) && prepared.pages > Number(access.remaining?.pages ?? 0);
      documentDialog.querySelector("[data-document-error]").textContent = insufficient ? "Saldo de p\u00e1ginas insuficiente para este documento." : "";
      documentDialog.querySelector("[data-analyze]").disabled = insufficient;
      documentDialog.querySelector("[data-analyze]").textContent = "Analisar documento";
      documentDialog.removeAttribute("aria-busy");
      for (const button of documentDialog.querySelectorAll("[data-close], [data-cancel]")) button.disabled = false;
      if (dialog.open) dialog.close();
      documentDialog.showModal();
      return new Promise(resolve => { documentResolve = resolve; });
    } catch (error) {
      if (version !== revision || account !== userId()) return null;
      if (handleAccessError(error.status)) return null;
      throw error;
    } finally { if (version === revision) documentBusy = false; }
  }
  async function analyze() {
    if (documentBusy || !prepared || !documentResolve) return;
    documentBusy = true;
    const version = revision, account = userId();
    const button = documentDialog.querySelector("[data-analyze]");
    button.disabled = true;
    button.textContent = "Analisando...";
    documentDialog.setAttribute("aria-busy", "true");
    for (const cancel of documentDialog.querySelectorAll("[data-close], [data-cancel]")) cancel.disabled = true;
    documentDialog.querySelector("[data-document-error]").textContent = "";
    try {
      const result = await request(`/api/chat/documents/${encodeURIComponent(prepared.id)}/analyze`, { confirmed: true, requestId: analysisRequestId });
      if (version !== revision || account !== userId()) return;
      if (!result.document?.id) throw new Error("Resultado da an\u00e1lise indispon\u00edvel. Tente novamente.");
      finishDocument(result.document);
      documentDialog.close();
      await refresh();
    } catch (error) {
      if (version !== revision || account !== userId()) return;
      documentDialog.querySelector("[data-document-error]").textContent = error.message;
      if ([402, 429].includes(error.status)) {
        finishDocument(null);
        documentDialog.close();
        handleAccessError(error.status);
      } else if ([401, 403].includes(error.status)) { access = null; void refresh(); }
    } finally {
      if (version === revision) {
        documentBusy = false;
        button.disabled = false;
        button.textContent = "Analisar documento";
        documentDialog.removeAttribute("aria-busy");
        for (const cancel of documentDialog.querySelectorAll("[data-close], [data-cancel]")) cancel.disabled = false;
      }
    }
  }
  function gate(event) {
    const target = event.target;
    const attachment = target.closest?.("#chatAttachment, #chatAttachmentButton");
    const matched = (target === input && ["beforeinput", "paste"].includes(event.type)) ||
      (event.type === "keydown" && target === input && event.key === "Enter" && !event.shiftKey) ||
      (event.type === "submit" && target === form) || (event.type === "click" && (attachment || target.closest?.("#chatSendButton, [data-chat-prompt]")));
    if (!matched || allowed(attachment ? "pages" : "messages")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open();
  }
  function listen(target, name, callback, capture = false) { target.addEventListener(name, callback, { capture, signal: events.signal }); }
  for (const modal of [dialog, documentDialog]) listen(modal, "keydown", event => {
    if (event.key !== "Tab") return;
    const buttons = [...modal.querySelectorAll("button:not(:disabled)")].filter(button => button.getClientRects().length);
    const first = buttons[0], last = buttons.at(-1);
    if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    }
  });
  for (const name of ["beforeinput", "paste", "keydown", "submit", "click"]) listen(window, name, gate, true);
  if (accountView) listen(accountView, "click", event => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    if (button.matches("[data-refresh]")) { void refresh(); return; }
    open();
    if (button.dataset.plan) void checkout(button.dataset.plan);
    else if (button.matches("[data-manage]")) void checkout(null, true);
  });
  listen(dialog.querySelector("[data-close]"), "click", () => dialog.close());
  listen(dialog.querySelector("[data-refresh]"), "click", () => void refresh());
  listen(manage, "click", () => void checkout(null, true));
  listen(cards, "click", event => { const button = event.target.closest("[data-plan]"); if (button && !button.disabled) void checkout(button.dataset.plan); });
  listen(documentDialog.querySelector("[data-analyze]"), "click", () => void analyze());
  for (const selector of ["[data-close]", "[data-cancel]"]) listen(documentDialog.querySelector(selector), "click", () => { if (!documentBusy) documentDialog.close(); });
  listen(documentDialog, "cancel", event => { if (documentBusy) event.preventDefault(); });
  listen(documentDialog, "close", () => finishDocument(null));
  listen(window, "audita:auth-changed", () => void onAuthChanged());
  listen(window, "pageshow", () => void refresh());
  listen(document, "visibilitychange", () => { if (!document.hidden) void refresh(); });
  restoreDraft();
  render();
  void refresh();
  return { open, refresh, ensureAccess, onAuthChanged, handleAccessError, prepareDocument, analyzeDocument: prepareDocument,
    getAccess: () => owner === userId() ? access : null,
    destroy() { destroyed = true; revision++; events.abort(); finishDocument(null); dialog.remove(); documentDialog.remove(); quota.remove(); },
  };
}
