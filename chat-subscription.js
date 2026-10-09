const PLANS = [
  { id: "chat-experiment", name: "Experimente", cents: 990, messages: 20, pages: null },
  { id: "chat-essential", name: "Essencial", cents: 4990, messages: 100, pages: null },
  { id: "chat-professional", name: "Profissional", cents: 9990, messages: 300, pages: null },
  { id: "chat-premium", name: "Premium", cents: 19990, messages: 700, pages: null },
];
const money = cents => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const DRAFT_PREFIX = "audita:chat-checkout:";

// requestLogin(message, resume) must call resume after getAuthState() reflects login.
// Sending a message authorizes the initial reading; no per-file confirmation.
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
      <p><strong>Inclui:</strong> conversa, pesquisa na web, análise de documentos e fotos, geração de imagens e arquivos. Documentos sem limite de páginas ou quantidade; perguntas consomem mensagens.</p>
      <p><strong>N\u00e3o inclui:</strong> consultas externas, certid\u00f5es, servi\u00e7os especializados ou honor\u00e1rios profissionais.</p>
      <p><strong>Uso individual, sem compartilhamento.</strong> Planos mensais renovam no anivers\u00e1rio da contrata\u00e7\u00e3o. Saldos n\u00e3o acumulam entre per\u00edodos e n\u00e3o h\u00e1 cobran\u00e7a autom\u00e1tica por excedentes. Experimente: compra \u00fanica, sem renova\u00e7\u00e3o.</p>
    </section>
    <footer><button type="button" data-test-access hidden>Liberar acesso de teste (sem cobrança)</button><button type="button" data-refresh>Atualizar acesso</button><button type="button" data-manage hidden>Gerenciar assinatura</button></footer>`;
  document.body.append(dialog);
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
  let pendingPlan = null, checkoutRequest = null, documentBusy = false, destroyed = false;
  let checkoutReturn = new URLSearchParams(location.search).get("chat_checkout");
  let confirmationTimer = null, confirmationAttempts = 0;

  function userId() {
    const auth = getAuthState(), user = auth?.user;
    return user?.id ? `${encodeURIComponent(user.tenant?.id || auth.tenantId || "")}:${encodeURIComponent(user.id)}` : "";
  }
  function allowed(kind = "messages") {
    return Boolean(owner && owner === userId() && loaded && access?.active === true &&
      (!access.cost || (!access.cost.unpriced && access.cost.remainingCents > 0)) &&
      (kind === "pages" || Number(access.remaining?.[kind]) > 0 || ((access.legacy === true || access.test === true || access.unlimited === true) && access.remaining?.[kind] == null)));
  }
  async function request(url, body) {
    const response = await fetch(url, { method: body === undefined ? "GET" : "POST", credentials: "same-origin",
      cache: "no-store", headers: { accept: "application/json", ...(body === undefined ? {} : { "content-type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const checkoutMessage = url === "/api/billing/checkout" ? {
        chat_plan_already_active: "Você já tem um plano de chat ativo. Atualize o acesso ou gerencie sua assinatura.",
        chat_experiment_already_used: "O plano Experimente já foi utilizado nesta conta. Escolha um plano mensal.",
        chat_checkout_pending: "Existe um checkout pendente. Retome o plano escolhido ou tente novamente após a expiração.",
      }[data.error] : null;
      const costMessage = {chat_cost_budget_exceeded:'Limite de processamento do período atingido. Aguarde a renovação ou contate o suporte.',chat_cost_unavailable:'Não foi possível conferir o consumo. Atualize o acesso ou contate o suporte.'}[data.error];
      const error = new Error(checkoutMessage || costMessage || (response.status === 401 ? "Entre novamente para continuar." : response.status === 413
        ? "O arquivo excede o limite de 50 MB." : [402, 429].includes(response.status)
          ? "Saldo insuficiente. Confira seu plano e o consumo." : "N\u00e3o foi poss\u00edvel concluir. Tente novamente."));
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
    if (access.unlimited) return "Acesso ilimitado liberado · sem vencimento e sem cobrança de cotas.";
    if (access.test) return "Acesso de teste liberado · sem cobrança do plano.";
    const plan = PLANS.find(item => item.id === access.planId);
    const remaining = access.remaining;
    let text = `${plan?.name || (access.legacy ? "Acesso legado" : "Chat ativo")} \u00b7 ${remaining?.messages ?? "-"} mensagens restantes · documentos sem limite de páginas`;
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
    if(access?.cost?.remainingCents===0) dialog.querySelector("[data-access]").textContent += " · Limite de processamento do período atingido. Aguarde a renovação ou contate o suporte.";
    if(access?.cost?.unpriced) dialog.querySelector("[data-access]").textContent += " · Não foi possível conferir o consumo. Atualize o acesso ou contate o suporte.";
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
    const testButton = dialog.querySelector('[data-test-access]');
    testButton.hidden = access?.unlimited || (access?.active && !access.test && !access.legacy) || !(access?.testBypassAvailable || catalog?.chatTestBypassAvailable);
    testButton.disabled = busy || Boolean(loading) || access?.test === true;
    testButton.textContent = access?.test ? 'Acesso de teste liberado' : 'Liberar acesso de teste (sem cobrança)';
    manage.hidden = !(owner && (access?.active && !access.legacy && !access.test && !access.unlimited || billing?.canManage && billing?.subscription?.provider === "stripe"));
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
      const disabled = busy || access?.unlimited || (access?.active && !access.test && !access.legacy) || !available(plan.id) || (experiment && access?.trialUsed);
      return `<article class="chat-subscription-plan${recommended ? " is-recommended" : ""}">
        <span class="chat-subscription-badge">${recommended ? "Recomendado" : current ? "Plano atual" : "&nbsp;"}</span>
        <h3>${plan.name}</h3><p class="chat-subscription-price"><strong>${escape(money(cents))}</strong><span>${experiment ? " / 30 dias" : " / m\u00eas"}</span></p>
        <ul><li>${plan.messages} mensagens</li><li>Documentos sem limite de páginas ou quantidade</li></ul>
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
      for (const selector of ["[data-manage]", "[data-refresh]", "[data-test-access]"]) {
        const source = dialog.querySelector(selector), target = accountView.querySelector(selector);
        target.hidden = source.hidden;
        target.disabled = source.disabled;
        target.textContent = source.textContent;
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
    clearTimeout(confirmationTimer);
    confirmationTimer = null;
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
        const confirmed = access?.active && PLANS.some(plan => plan.id === access.planId) && !access.test && !access.legacy && !access.unlimited;
        notice.textContent = checkoutReturn === "success"
          ? confirmed ? "Plano ativo confirmado pelo servidor. Seu acesso foi atualizado."
            : !owner ? "Entre na conta usada na compra para verificar o pagamento."
            : confirmationAttempts < 24 ? "Aguardando confirmação do pagamento. O acesso será atualizado automaticamente."
            : "A confirmação está demorando. Não refaça a compra. Use Atualizar acesso ou contate o suporte."
          : ["cancelled", "canceled"].includes(checkoutReturn) ? "Pagamento não concluído. Seu rascunho foi preservado." : "";
        if (confirmed && checkoutReturn === "success") checkoutReturn = null;
        return access;
      } catch (error) {
        if (version === revision && owner === userId()) { access = catalog = null; loaded = true; notice.textContent = error.message; }
        return null;
      } finally {
        if (version === revision) {
          loading = null;
          render();
          if (!destroyed && owner && checkoutReturn === "success" && confirmationAttempts < 24 && !document.hidden) {
            confirmationAttempts++;
            confirmationTimer = setTimeout(() => void refresh(), 5000);
          }
        }
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
    if(access?.cost?.unpriced) notice.textContent="Não foi possível conferir o consumo de processamento. Atualize o acesso ou contate o suporte.";
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
      clearTimeout(confirmationTimer);
      confirmationTimer = null;
      if (previous) checkoutReturn = null;
      revision++;
      loading = null;
      owner = next;
      access = billing = null;
      loaded = false;
      checkoutRequest = null;
      if (previous) { input.value = ""; pendingPlan = null; purgeDrafts(); }
      documentBusy = false;
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
  async function enableTestAccess() {
    if (busy || !(access?.testBypassAvailable || catalog?.chatTestBypassAvailable)) return;
    if (!userId()) {
      dialog.close();
      requestLogin('Entre para liberar o chat sem cobrança durante os testes.', async () => {
        await onAuthChanged();
        open();
        await enableTestAccess();
      });
      return;
    }
    const version = revision, account = userId();
    busy = true;
    notice.textContent = '';
    render();
    try {
      if (loading) await loading;
      if (version !== revision || account !== userId()) return;
      await request('/api/chat/test-access', {});
      if (version !== revision || account !== userId()) return;
      await refresh();
      if (version !== revision || account !== userId()) return;
      if (!allowed()) throw new Error('Não foi possível confirmar a liberação. Atualize o acesso.');
      if (dialog.open) dialog.close();
      input.focus();
    } catch (error) {
      if (version === revision && account === userId()) notice.textContent = error.message;
    } finally { busy = false; render(); }
  }
  async function prepareDocument(file) {
    if (documentBusy) throw new Error("Aguarde o documento atual.");
    if (!file || !(/\.(pdf|png|jpe?g|txt|md|csv|json|html|docx|xlsx|wav|mp3|webm|m4a|mp4)$/i.test(file.name))) throw new Error("Use PDF, fotos, texto, Word, Excel ou áudio.");
    if (!file.size || file.size > 50 * 1024 * 1024) throw new Error(file.size ? "O arquivo excede o limite de 50 MB." : "O arquivo está vazio.");
    documentBusy = true;
    const version = revision, account = userId();
    try {
      if (!await ensureAccess("pages")) return null;
      const contentBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
        reader.readAsDataURL(file);
      });
      if (version !== revision || account !== userId()) return null;
      const result = await request("/api/chat/documents/prepare", { fileName: file.name, mimeType: file.type, contentBase64 });
      if (version !== revision || account !== userId()) return null;
      const prepared = result.document;
      if (!prepared?.id || !Number.isInteger(prepared.pages) || prepared.pages <= 0) throw new Error("Contagem de páginas indisponível.");
      const analyzed = await request(`/api/chat/documents/${encodeURIComponent(prepared.id)}/analyze`, { confirmed: true, requestId: crypto.randomUUID() });
      if (version !== revision || account !== userId()) return null;
      if (!analyzed.document?.id) throw new Error("Resultado da análise indisponível.");
      return analyzed.document;
    } catch (error) {
      if (version !== revision || account !== userId()) return null;
      if (handleAccessError(error.status)) return null;
      throw error;
    } finally { if (version === revision) documentBusy = false; }
  }
  function gate(event) {
    const target = event.target;
    const attachment = target.closest?.("#chatAttachment, #chatAttachmentButton");
    const matched = (target === input && ["beforeinput", "paste"].includes(event.type)) ||
      (event.type === "keydown" && target === input && event.key === "Enter" && !event.shiftKey) ||
      (event.type === "submit" && target === form) || (event.type === "click" && (attachment || target.closest?.("#chatSendButton, [data-chat-prompt]")));
    if (!matched || !loaded || loading || allowed(attachment ? "pages" : "messages")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open();
  }
  function listen(target, name, callback, capture = false) { target.addEventListener(name, callback, { capture, signal: events.signal }); }
  for (const modal of [dialog]) listen(modal, "keydown", event => {
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
    else if (button.matches("[data-test-access]")) void enableTestAccess();
  });
  listen(dialog.querySelector("[data-close]"), "click", () => dialog.close());
  listen(dialog.querySelector("[data-refresh]"), "click", () => void refresh());
  listen(manage, "click", () => void checkout(null, true));
  listen(dialog.querySelector('[data-test-access]'), 'click', () => void enableTestAccess());
  listen(cards, "click", event => { const button = event.target.closest("[data-plan]"); if (button && !button.disabled) void checkout(button.dataset.plan); });
  listen(window, "audita:auth-changed", () => void onAuthChanged());
  listen(window, "pageshow", () => void refresh());
  listen(document, "visibilitychange", () => { if (!document.hidden) void refresh(); });
  restoreDraft();
  render();
  if (checkoutReturn) void refresh().then(() => { if (checkoutReturn && !destroyed) open(); });
  else void refresh();
  return { open, refresh, ensureAccess, onAuthChanged, handleAccessError, prepareDocument, analyzeDocument: prepareDocument,
    getAccess: () => owner === userId() ? access : null,
    destroy() { destroyed = true; clearTimeout(confirmationTimer); revision++; events.abort(); dialog.remove(); quota.remove(); },
  };
}
