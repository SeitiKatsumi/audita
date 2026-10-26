import { normalizedCnj } from './judicial-processes.js';

const API = '/api/process-online';
const REFRESH_MS = 30_000;
const COMPLETE = new Set(['ready', 'completed']);
const PENDING = new Set(['submitting', 'processing', 'pending', 'queued', 'downloading']);
const STATUS = {
  submitting: 'Aguardando confirmação do envio', processing: 'Em processamento', pending: 'Aguardando processamento', queued: 'Na fila',
  downloading: 'Preparando arquivos privados', ready: 'Cópia disponível', completed: 'Concluído',
  failed: 'Não concluído', secret: 'Acesso restrito / segredo de justiça', expired: 'Arquivo expirado',
  review_required: 'Aguardando conferência', empty: 'Nenhum processo encontrado',
};

function digits(value) { return String(value || '').replace(/\D/g, ''); }
function formatCnj(value) {
  const number = digits(value);
  return number.length === 20 ? number.replace(/^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/, '$1-$2.$3.$4.$5.$6') : String(value || '');
}
function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR');
}
function jsonText(value) {
  try { return JSON.stringify(value, null, 2); } catch { return 'Dados indisponíveis.'; }
}
function privateUrl(value, requestId, suffix) {
  const prefix = `${API}/requests/${encodeURIComponent(requestId)}/`;
  if (typeof value !== 'string' || !value.startsWith(prefix) || /[\\?#\s]/.test(value)) return null;
  return value === `${prefix}${suffix}` ? value : null;
}

/** This module never starts a search, copy request or AI analysis when activated. */
export function initProcessOnline({ container, fetchImpl = globalThis.fetch, onAuthRequired = () => {}, onDocumentSearch, location = globalThis.location, navigate = url => globalThis.location.assign(url) } = {}) {
  if (!container?.ownerDocument) throw new TypeError('Informe o contêiner do módulo de processos.');
  const doc = container.ownerDocument;
  const state = { active: false, config: null, busy: false, requests: [], selected: null,
    parentAuditId: null, available: [], chosen: new Set(), pending: null, payment: null, timer: null, refreshAt: new Map(), analysis: null, generation: 0, activation: 0 };
  const el = (tag, className, text) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };
  const button = (text, handler, primary = false) => {
    const node = el('button', primary ? 'primary-action' : 'secondary-action', text);
    node.type = 'button';
    node.addEventListener('click', handler);
    return node;
  };
  const field = (label, input) => {
    const node = el('label', 'process-online-field');
    node.append(el('span', '', label), input);
    return node;
  };
  const input = (name, placeholder, maxLength) => {
    const node = el('input');
    node.name = name; node.type = 'text'; node.autocomplete = 'off'; node.required = true;
    node.placeholder = placeholder; node.maxLength = maxLength;
    return node;
  };
  const consent = (name, text) => {
    const check = el('input'); check.type = 'checkbox'; check.name = name; check.required = true;
    const label = el('label', 'process-online-consent'); label.append(check, el('span', '', text));
    return { check, label };
  };
  const root = el('div', 'process-online');
  const intro = el('header', 'process-online-intro');
  intro.append(el('span', 'process-online-eyebrow', 'Processos judiciais'),
    el('h2', '', 'Localize processos e solicite os autos'),
    el('p', '', 'Informe um número CNJ ou localize processos por CPF/CNPJ. Escolha os processos desejados e autorize o pagamento das cópias integrais.'),
    el('p', 'process-online-muted', 'As cópias não são certidões oficiais e não incluem monitoramento contínuo. Processos restritos dependem das permissões do tribunal.'));
  const configPanel = el('div', 'process-online-config'); configPanel.setAttribute('role', 'status');
  const notice = el('div', 'process-online-notice'); notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite'); notice.hidden = true;
  const pendingPanel = el('div', 'process-online-pending'); pendingPanel.hidden = true;
  const pendingText = el('p');
  const retryButton = button('Retomar a mesma operação', () => run(() => submitPending()));
  const reconcileButton = button('Conferir histórico', () => run(() => loadHistory()));
  pendingPanel.append(pendingText, el('p', 'process-online-muted', 'Não inicie outra solicitação para o mesmo conteúdo. Confira o histórico antes de retomar; a retomada mantém a referência original.'), reconcileButton, retryButton);

  const forms = el('div', 'process-online-forms');
  const cnjSection = el('section', 'process-online-section');
  cnjSection.append(el('h3', '', 'Já tenho o número do processo'));
  const cnj = input('cnj', '0000000-00.0000.0.00.0000', 30); cnj.inputMode = 'numeric';
  const cnjField = field('Número CNJ', cnj);
  const copyForm = el('form', 'process-online-form');
  const copyConsent = consent('copyConsent', 'Autorizo a solicitação desta cópia e confirmo meu interesse legítimo.');
  const selections = el('fieldset', 'process-online-selection'); selections.hidden = true;
  const selectionList = el('div', 'process-online-selection-list');
  const selectionLegend = el('legend', '', 'Escolha os processos para obter a cópia integral');
  selections.append(selectionLegend, el('p', 'process-online-muted', 'Nenhum processo é selecionado automaticamente. Você pode solicitar até 20 cópias por pagamento.'), selectionList);
  const copyPrice = el('p', 'process-online-price'); copyPrice.setAttribute('aria-live', 'polite');
  const copyButton = el('button', 'primary-action', 'Pagamento em configuração'); copyButton.type = 'submit';
  copyButton.name = 'copyCheckout';
  copyForm.append(selections, cnjField, copyPrice, copyConsent.label, copyButton);
  cnjSection.append(copyForm);

  const searchSection = el('section', 'process-online-section');
  searchSection.append(el('h3', '', 'Localizar por CPF ou CNPJ'), el('p', 'process-online-muted', 'Escolha a consulta detalhada na próxima tela, onde o valor será apresentado antes da contratação. Depois, selecione os processos para solicitar as cópias completas separadamente.'));
  const searchForm = el('form', 'process-online-form');
  const documento = input('documento', 'CPF ou CNPJ do titular', 22); documento.inputMode = 'numeric';
  const searchConsent = consent('searchConsent', 'Tenho autorização para consultar este documento e autorizo esta busca.');
  const searchButton = el('button', 'primary-action', 'Localizar processos'); searchButton.type = 'submit';
  searchForm.append(field('CPF ou CNPJ', documento), searchConsent.label, searchButton);
  const paymentPanel = el('div', 'process-online-payment'); paymentPanel.setAttribute('role', 'status'); paymentPanel.hidden = true;

  searchSection.append(searchForm);
  forms.append(cnjSection, searchSection);

  const history = el('section', 'process-online-history');
  const historyHeading = el('div', 'process-online-heading');
  const historyButton = button('Atualizar histórico', () => run(() => loadHistory()));
  historyHeading.append(el('h3', '', 'Minhas solicitações'), historyButton);
  const historyList = el('div', 'process-online-history-list');
  historyList.setAttribute('aria-live', 'polite');
  history.append(historyHeading, historyList);
  const details = el('section', 'process-online-details'); details.hidden = true;
  details.tabIndex = -1;
  root.append(intro, configPanel, notice, pendingPanel, forms, paymentPanel, history, details);
  container.replaceChildren(root);

  function showNotice(message = '', error = false) {
    notice.hidden = !message; notice.textContent = message;
    notice.classList.toggle('is-error', error);
  }
  function assertCurrent(generation) {
    if (generation !== state.generation) throw Object.assign(new Error('Sessão alterada.'), { silent: true });
  }
  function ready() { return state.config?.enabled === true && state.config?.ready === true && state.config?.storageReady !== false; }
  function sandbox() { return ['test', 'sandbox'].includes(state.config?.mode); }
  function complimentary() { return state.config?.copyPayment?.complimentary === true; }
  function unitAmount() {
    const value = state.config?.copyPayment?.unitAmountCents;
    return Number.isSafeInteger(value) && (value > 0 || value === 0 && complimentary()) ? value : null;
  }
  function maxQuantity() { return Math.min(20, Math.max(1, Number(state.config?.copyPayment?.maxQuantity) || 20)); }
  function selectedNumbers() { return state.chosen.size ? [...state.chosen] : [normalizedCnj(cnj.value)].filter(Boolean); }
  function money(cents) { return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' '); }
  function renderSelection() {
    selections.hidden = !state.available.length; selectionList.replaceChildren();
    cnjField.childNodes[0].textContent = state.available.length ? 'Ou informe diretamente um número CNJ' : 'Número CNJ';
    for (const process of state.available) {
      const check = el('input'); check.type = 'checkbox'; check.name = `process-${process.cnj}`;
      check.checked = state.chosen.has(process.cnj); check.disabled = state.busy || Boolean(state.pending);
      const text = el('span'); text.append(el('strong', '', formatCnj(process.cnj)));
      const summary = [process.tribunal, process.classe, process.assunto, process.situacao].filter(value => typeof value === 'string' && value).join(' · ');
      if (summary) text.append(el('span', 'process-online-muted', summary));
      const label = el('label', 'process-online-choice'); label.append(check, text); selectionList.append(label);
      check.addEventListener('change', () => {
        if (state.busy || state.pending) { check.checked = state.chosen.has(process.cnj); return; }
        if (check.checked && state.chosen.size >= maxQuantity()) {
          check.checked = false; showNotice(`Selecione até ${maxQuantity()} processos por pagamento.`, true); return;
        }
        if (check.checked) state.chosen.add(process.cnj); else state.chosen.delete(process.cnj);
        cnj.value = ''; copyConsent.check.checked = false; updateControls();
      });
    }
  }
  function updateControls() {
    const paidDisabled = state.busy || !ready() || Boolean(state.pending);
    const quantity = selectedNumbers().length, unit = unitAmount();
    cnj.required = state.chosen.size === 0;
    copyPrice.textContent = complimentary() ? `Acesso sem cobrança · ${quantity} cópia(s) selecionada(s).` : unit !== null ? `${money(unit)} por cópia · ${quantity} selecionada(s) · Total: ${money(unit * quantity)}. Pagamento no Stripe; cópias solicitadas após a confirmação.` : 'O valor das cópias ainda não está disponível. Aguarde a configuração do pagamento.';
    copyButton.textContent = unit !== null && quantity ? complimentary() ? 'Solicitar cópias sem pagar' : `Pagar ${money(unit * quantity)} e solicitar ${quantity === 1 ? 'cópia' : `${quantity} cópias`}` : 'Selecione um processo para continuar';
    searchButton.disabled = state.busy || Boolean(state.pending) || typeof onDocumentSearch !== 'function' || !searchConsent.check.checked;
    copyButton.disabled = paidDisabled || !state.config?.copyPayment?.checkoutReady || unit === null || !quantity || quantity > maxQuantity() || Boolean(state.payment && ['pending','paid'].includes(state.payment.status)) || !copyConsent.check.checked;
    historyButton.disabled = state.busy;
    retryButton.disabled = state.busy || !ready();
    retryButton.hidden = Boolean(state.pending?.review);
    retryButton.textContent = state.pending?.canRecover ? 'Retomar a mesma cópia' : 'Retomar a mesma operação';
    reconcileButton.disabled = state.busy;
    for (const control of [cnj, documento, copyConsent.check, searchConsent.check]) {
      control.disabled = state.busy || Boolean(state.pending);
    }
    for (const check of selectionList.childNodes) check.childNodes[0].disabled = state.busy || Boolean(state.pending);
    root.setAttribute('aria-busy', String(state.busy));
    pendingPanel.hidden = !state.pending;
    if (state.pending) pendingText.textContent = `${state.pending.review ? 'A operação está salva e aguarda conferência.' : `O envio da ${state.pending.kind === 'search' ? 'busca' : 'cópia'} ainda não foi confirmado.`} Referência: ${state.pending.body.operationId}.`;
  }
  function renderConfig() {
    configPanel.replaceChildren();
    if (ready()) {
      configPanel.append(el('strong', '', sandbox() ? 'Testes gratuitos ativos' : 'Integração disponível'),
        el('p', '', complimentary() ? 'Seu acesso permite solicitar cópias sem pagamento. A autorização de consulta continua obrigatória.' : sandbox() ? 'Use somente os canários fornecidos pelo parceiro. Todo PDF deste ambiente é demonstrativo.' : 'As cópias são solicitadas após a confirmação do pagamento pelo Stripe. A busca por CPF/CNPJ é feita separadamente.'));
      if (sandbox()) {
        configPanel.append(button('Usar processo de exemplo', () => {
          if (state.busy || state.pending) return;
          cnj.value = '0701379-18.2025.8.01.0013'; state.chosen.clear(); renderSelection(); copyConsent.check.checked = false; updateControls(); cnj.focus();
        }));
      }
    }
    configPanel.hidden = !ready();
    if (ready() && (!state.config?.copyPayment?.checkoutReady || unitAmount() === null)) configPanel.append(el('p', 'process-online-muted', 'O pagamento está em configuração. Tente novamente mais tarde.'));
    copyConsent.label.lastChild.textContent = sandbox()
      ? 'Autorizo uma cópia demonstrativa no ambiente de testes, sem pagamento real.'
      : 'Autorizo a solicitação desta cópia e confirmo meu interesse legítimo.';
    searchConsent.label.lastChild.textContent = 'Tenho autorização para consultar este documento. Nenhuma consulta é contratada nesta tela.';
    updateControls();
  }
  async function api(path, body) {
    const generation = state.generation;
    let response;
    try {
      response = await fetchImpl(`${API}${path}`, { credentials: 'same-origin', cache: 'no-store',
        ...(body !== undefined ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    } catch {
      assertCurrent(generation);
      const error = new Error('A conexão foi interrompida. Confira o histórico antes de retomar a mesma operação.');
      error.uncertain = true; throw error;
    }
    const data = await response.json().catch(() => ({}));
    assertCurrent(generation);
    if (response.status === 401) {
      reset(); onAuthRequired();
      throw Object.assign(new Error('Entre na sua conta para consultar suas solicitações.'), { status: 401, silent: true });
    }
    if (!response.ok) {
      const errors = {
        process_online_checkout_unavailable: 'O pagamento está temporariamente indisponível. Tente novamente mais tarde.',
        process_online_payment_mode_mismatch: 'O pagamento de teste ainda não foi configurado.',
        process_online_checkout_needs_review: 'Este pagamento precisa de conferência. Não faça outro pagamento para a mesma busca.',
        process_online_insufficient_credits: 'Saldo insuficiente na carteira Audita. Recarregue os créditos antes de autorizar uma nova operação.',
        process_online_billing_unavailable: 'A carteira de créditos Audita ainda está em configuração.',
        process_online_invalid_document: 'Confira o CPF ou CNPJ informado.',
        process_online_invalid_cnj: 'Confira os 20 dígitos e a validação do número CNJ.',
        process_online_not_configured: 'A integração ainda está em ativação. Aguarde a configuração do acesso B2B.',
        process_online_operation_conflict: 'Esta referência já pertence a outra operação. Confira as solicitações salvas.',
      };
      const error = new Error(typeof data.message === 'string' ? data.message : errors[data.error] || 'Não foi possível concluir esta ação. Confira o histórico e tente novamente.');
      error.status = response.status; error.code = data.error; error.uncertain = response.status >= 500;
      throw error;
    }
    return data;
  }
  async function run(action) {
    if (state.busy) return;
    const generation = state.generation;
    state.busy = true; updateControls(); showNotice();
    try { await action(); }
    catch (error) { if (generation === state.generation && !error.silent) showNotice(error.message || 'Não foi possível concluir esta ação.', true); }
    finally { if (generation === state.generation) { state.busy = false; updateControls(); schedulePoll(); } }
  }
  function unwrap(data) { return data?.request || data; }
  function reconcilePending(request) {
    if (!state.pending || request?.operationId !== state.pending.body.operationId) return;
    if (['review_required', 'submitting'].includes(request.status)) {
      state.pending.review = true; state.pending.canRecover = request.canRecover === true;
    } else state.pending = null;
  }
  function mergeRequest(request) {
    if (!request?.id) return;
    const index = state.requests.findIndex(item => item.id === request.id);
    if (index < 0) state.requests.unshift(request); else state.requests[index] = request;
    reconcilePending(request);
    renderHistory();
  }
  async function loadHistory() {
    const generation = state.generation;
    const result = await api('/requests');
    assertCurrent(generation);
    state.requests = Array.isArray(result) ? result : (result.requests || result.items || []);
    if (!Array.isArray(state.requests)) state.requests = [];
    if (state.pending) reconcilePending(state.requests.find(item => item.operationId === state.pending.body.operationId));
    renderHistory(); updateControls();
    if (state.selected) {
      const current = state.requests.find(item => item.id === state.selected.id);
      if (current) state.selected = { ...state.selected, ...current };
      else { state.selected = null; state.analysis = null; stopPoll(); }
      renderDetails();
    }
  }
  function renderHistory() {
    historyList.replaceChildren();
    if (!state.requests.length) { historyList.append(el('p', 'process-online-muted', 'Nenhuma solicitação salva nesta conta.')); return; }
    for (const request of state.requests) {
      const row = el('article', 'process-online-history-item');
      const label = request.kind === 'search' ? 'Busca por documento' : `Cópia ${formatCnj(request.cnj)}`;
      const text = el('div');
      text.append(el('strong', '', label), el('span', 'process-online-muted', [STATUS[request.status] || 'Estado em conferência', dateLabel(request.createdAt)].filter(Boolean).join(' · ')));
      row.append(text, button('Abrir', () => run(() => openRequest(request.id, true))));
      historyList.append(row);
    }
  }
  function rawDetails(label, value) {
    const disclosure = el('details', 'process-online-raw');
    disclosure.append(el('summary', '', label), el('pre', '', jsonText(value)));
    return disclosure;
  }
  function renderDetails(focus = false) {
    const request = state.selected;
    details.replaceChildren(); details.hidden = !request;
    if (!request) return;
    const heading = el('div', 'process-online-heading');
    heading.append(el('h3', '', request.kind === 'search' ? 'Processos localizados' : `Autos do processo ${formatCnj(request.cnj)}`));
    const refresh = button('Conferir andamento', () => run(() => refreshRequest(request.id)));
    heading.append(refresh); details.append(heading);
    const status = el('p', 'process-online-status', STATUS[request.status] || 'Estado em conferência');
    status.setAttribute('role', 'status'); details.append(status);
    if (request.billing && request.billing.auditaCredits > 0) {
      const billing = request.billing;
      const message = request.mode === 'test' || sandbox() ? 'Ambiente de testes: nenhum crédito Audita cobrado.'
        : billing.refunded ? 'Crédito Audita devolvido à carteira.'
          : billing.state === 'refund_pending' ? 'Devolução do crédito Audita em conciliação.'
            : billing.state === 'charged' ? `${billing.auditaCredits || 1} crédito Audita utilizado nesta operação.`
              : billing.state === 'reserved' ? 'Crédito Audita reservado para esta operação.' : 'Consumo de crédito Audita: confira o estado da operação.';
      details.append(el('p', 'process-online-muted', message));

    }
    if (request.status === 'review_required' && request.canRecover === true) renderRecovery(request);
    if (request.mode === 'test' || sandbox()) details.append(el('p', 'process-online-sandbox', 'Demonstração: estes dados e PDFs pertencem ao ambiente de testes.'));
    if (request.kind === 'search') {
      const results = Array.isArray(request.results) ? request.results : request.resultData?.results || [];
      details.append(el('p', 'process-online-muted', `${request.total ?? results.length} processo(s) informado(s) pelo parceiro. Selecione um processo para revisar e autorizar sua cópia.`));
      if (request.partialResults || request.total > results.length) details.append(el('p', 'process-online-sandbox', `Resultado parcial: ${results.length} de ${request.total} processos recebidos. O parceiro ainda não disponibilizou todos os registros nesta resposta.`));
      const list = el('div', 'process-online-results');
      for (const result of results) {
        const resultCnj = String(result.numero_cnj || result.cnj || '');
        const row = el('article', 'process-online-result');
        row.append(el('strong', '', formatCnj(resultCnj)));
        const summary = [result.tribunal, result.classe, result.assunto, result.situacao].filter(value => typeof value === 'string').join(' · ');
        if (summary) row.append(el('p', 'process-online-muted', summary));
        const number = normalizedCnj(resultCnj);
        const prepare = button('Preparar solicitação de cópia', () => {
          if (!number) return;
          cnj.value = formatCnj(number); state.chosen.clear(); renderSelection(); copyConsent.check.checked = false;
          updateControls(); cnj.focus(); cnjSection.scrollIntoView?.({ block: 'nearest' });
          showNotice('Confira o número e autorize esta cópia individualmente.');
        });
        prepare.disabled = !number;
        row.append(prepare, rawDetails('Metadados informados pelo parceiro', result));
        list.append(row);
      }
      if (!results.length) list.append(el('p', '', 'Nenhum processo disponível neste resultado.'));
      details.append(list);
    } else if (COMPLETE.has(request.status)) {
      const parts = Array.isArray(request.parts) ? request.parts : [];
      const downloads = el('div', 'process-online-downloads');
      for (const part of parts) {
        const index = Number(part.index);
        const href = Number.isSafeInteger(index) && index >= 1 ? privateUrl(part.url, request.id, `files/${index}`) : null;
        if (!href) continue;
        const link = el('a', 'secondary-action', `Baixar PDF · parte ${index}${parts.length > 1 ? ` de ${parts.length}` : ''}`);
        link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; downloads.append(link);
      }
      if (!downloads.childNodes.length) downloads.append(el('p', '', 'Os arquivos privados ainda estão sendo preparados. Confira o andamento para atualizar.'));
      details.append(downloads);
      renderAnalysis(request);
    } else {
      const message = PENDING.has(request.status)
        ? 'A solicitação está salva. O andamento é conferido a cada 30 segundos enquanto esta tela estiver aberta, sem solicitar outra cópia.'
        : request.status === 'review_required'
          ? 'A operação precisa de conferência. Use a referência salva e aguarde a conciliação antes de iniciar outra solicitação.'
          : 'O parceiro não disponibilizou os autos. Consulte o estado e os registros desta solicitação antes de iniciar uma nova operação.';
      details.append(el('p', 'process-online-muted', message));
    }
    details.append(el('p', 'process-online-reference', `Referência Audita: ${request.id}`));
    if (request.resultData) details.append(rawDetails('Dados originais recebidos do parceiro', request.resultData));
    if (focus) details.focus({ preventScroll: true });
  }
  function renderRecovery(request) {
    const area = el('section', 'process-online-recovery');
    area.append(el('h4', '', 'Retomar esta solicitação de cópia'),
      el('p', 'process-online-muted', 'O servidor reutiliza os dados privados, a referência e a autorização desta solicitação salva. A retomada não inicia outro pedido.'));
    const form = el('form', 'process-online-form');
    const approval = consent('recoveryConsent', sandbox()
      ? 'Autorizo retomar esta mesma cópia demonstrativa, sem pagamento real.'
      : 'Autorizo retomar esta mesma solicitação de cópia.');
    const submit = el('button', 'primary-action', 'Retomar cópia salva'); submit.type = 'submit'; submit.disabled = true;
    approval.check.addEventListener('change', () => { submit.disabled = !approval.check.checked || state.busy || !ready(); });
    form.append(approval.label, submit);
    form.addEventListener('submit', event => {
      event.preventDefault(); if (!approval.check.checked || !ready()) return;
      run(async () => {
        const generation = state.generation;
        const result = unwrap(await api(`/requests/${encodeURIComponent(request.id)}/recover`, { consent: true, approvedCredits: 0 }));
        assertCurrent(generation);
        if (!result?.id || result.id !== request.id) throw new Error('A retomada ainda não foi confirmada. Confira este pedido salvo antes de tentar novamente.');
        if (!result.operationId && request.operationId) result.operationId = request.operationId;
        state.selected = result; mergeRequest(result); renderDetails();
        showNotice(result.status === 'review_required' ? 'A mesma solicitação continua aguardando conferência. Nenhum novo pedido foi iniciado.' : 'A solicitação salva foi retomada com a mesma referência.');
      });
    });
    area.append(form); details.append(area);
  }
  function analysisReady() { return state.config?.analysisReady === true || state.config?.aiReady === true || state.config?.analysis?.ready === true; }
  function renderAnalysis(request) {
    const area = el('section', 'process-online-analysis');
    area.append(el('h4', '', 'Resumo e análise dos autos com IA'), el('p', 'process-online-muted', 'O resumo gerado pela IA não é uma certidão oficial de objeto e pé. A IA pode cometer erros. Confira as referências nos autos antes de tomar decisões. A análise não substitui a revisão de um profissional.'));
    const analysis = state.analysis;
    if (analysis?.coverage) {
      const coverage = analysis.coverage;
      const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
      const coverageList = el('dl', 'process-online-coverage');
      for (const [label, value] of [
        ['Partes conferidas', `${count(coverage.inspectedParts)} de ${count(coverage.totalParts)}`],
        ['Páginas com leitura validada', `${count(coverage.analyzedPages)} de ${count(coverage.totalPages)} identificadas`],
        ['Blocos com leitura validada', `${count(coverage.analyzedChunks)} de ${count(coverage.totalChunks)} identificados`],
        ['Blocos visuais para conferência', count(coverage.visualChunks)],
      ]) coverageList.append(el('dt', '', label), el('dd', '', value));
      area.append(coverageList);
      if (coverage.inventoryComplete === false) area.append(el('p', 'process-online-muted', 'A contagem de páginas e blocos ainda está sendo identificada; os totais podem aumentar.'));
    }
    const limitations = Array.isArray(analysis?.limitations) ? analysis.limitations
      : Array.isArray(analysis?.report?.limitations) ? analysis.report.limitations : [];
    if (limitations.length) {
      const list = el('ul', 'process-online-limitations');
      for (const limitation of limitations) list.append(el('li', '', limitation));
      area.append(el('h5', '', 'Limites da leitura'), list);
    }
    const complete = analysis?.status === 'completed' && analysis?.report?.complete === true;
    if (analysis?.status === 'partial') area.append(el('p', 'process-online-sandbox', 'Análise parcial: a leitura de todos os autos ainda não foi validada. Nenhum relatório completo está disponível.'));
    else if (analysis?.status === 'interrupted') area.append(el('p', 'process-online-sandbox', 'A análise foi interrompida. Os blocos salvos podem ser retomados sem solicitar outra cópia ao parceiro.'));
    else if (analysis?.status === 'failed') area.append(el('p', 'process-online-sandbox', 'A análise não foi concluída. Confira os limites da leitura antes de retomar.'));
    else if (analysis?.status === 'completed' && !complete) area.append(el('p', 'process-online-sandbox', 'O relatório completo ainda não foi validado. Confira o estado da análise antes de continuar.'));
    if (complete) {
      const report = analysis.report;
      area.append(rawDetails('Ler análise', report));
      const download = el('a', 'secondary-action', 'Baixar relatório da análise');
      download.href = `${API}/requests/${encodeURIComponent(request.id)}/analysis.pdf`; download.target = '_blank'; download.rel = 'noopener noreferrer';
      area.append(download);
    } else if (analysis && (PENDING.has(analysis.status) || analysis.status === 'running')) {
      area.append(el('p', '', analysis.current || 'A análise está em processamento.'));
      area.append(button('Conferir análise', () => run(async () => {
        const generation = state.generation;
        await loadAnalysis(request.id); assertCurrent(generation); renderDetails();
      })));
    } else if (analysisReady()) {
      const resume = ['partial', 'interrupted', 'failed'].includes(analysis?.status);
      const form = el('form', 'process-online-form');
      const purpose = el('textarea'); purpose.name = 'purpose'; purpose.rows = 2; purpose.maxLength = 2000;
      if (typeof analysis?.purpose === 'string') purpose.value = analysis.purpose;
      purpose.placeholder = 'Ex.: riscos e obrigações relacionados à aquisição de um imóvel.';
      if (resume) area.append(el('p', 'process-online-muted', 'Mantenha o objetivo salvo para reaproveitar a leitura já concluída. Alterar o objetivo inicia uma nova análise dos arquivos recebidos.'));
      const approval = consent('analysisConsent', 'Autorizo o envio dos autos privados ao serviço de IA para esta análise.');
      const submit = el('button', 'primary-action', resume ? 'Retomar análise dos autos' : 'Analisar cópia com IA'); submit.type = 'submit'; submit.disabled = true;
      approval.check.addEventListener('change', () => { submit.disabled = !approval.check.checked || state.busy; });
      form.append(field('Objetivo da análise (opcional)', purpose), approval.label, submit);
      form.addEventListener('submit', event => {
        event.preventDefault(); if (!approval.check.checked) return;
        run(async () => {
          const generation = state.generation;
          await api(`/requests/${encodeURIComponent(request.id)}/analysis`, { consent: true, purpose: purpose.value.trim() });
          assertCurrent(generation); await loadAnalysis(request.id); assertCurrent(generation); renderDetails();
        });
      });
      area.append(form);
    } else area.append(el('p', 'process-online-muted', sandbox()
      ? 'A análise por IA está desativada neste ambiente de testes.'
      : 'A análise por IA será liberada quando a configuração estiver pronta.'));
    details.append(area);
  }
  async function loadAnalysis(id) {
    const generation = state.generation;
    try { const data = await api(`/requests/${encodeURIComponent(id)}/analysis`); assertCurrent(generation); state.analysis = data.analysis || data; }
    catch (error) { assertCurrent(generation); if (error.status !== 404 && error.status !== 503) throw error; state.analysis = null; }
  }
  async function openRequest(id, focus = false) {
    const generation = state.generation;
    const request = unwrap(await api(`/requests/${encodeURIComponent(id)}`)); assertCurrent(generation);
    state.selected = request; state.analysis = null;
    mergeRequest(state.selected);
    if (state.selected.kind !== 'search' && COMPLETE.has(state.selected.status)) await loadAnalysis(id);
    assertCurrent(generation); renderDetails(focus);
  }
  async function refreshRequest(id) {
    const generation = state.generation;
    const last = state.refreshAt.get(id) || 0;
    if (Date.now() - last < REFRESH_MS) {
      showNotice('O andamento foi conferido há pouco. Aguarde 30 segundos entre atualizações.'); return;
    }
    state.refreshAt.set(id, Date.now());
    const request = state.requests.find(item => item.id === id) || state.selected;
    const result = unwrap(await api(`/requests/${encodeURIComponent(id)}${request?.kind === 'search' ? '' : '/refresh'}`, request?.kind === 'search' ? undefined : {}));
    assertCurrent(generation); state.selected = result;
    mergeRequest(state.selected); renderDetails();
  }
  function checkoutUrl(value) {
    try { const url = new URL(value); return url.origin === 'https://checkout.stripe.com' ? url.href : null; } catch { return null; }
  }
  function renderPayment() {
    paymentPanel.replaceChildren(); paymentPanel.hidden = !state.payment;
    if (!state.payment) return;
    const order = state.payment;
    const waiverAvailable=order.status==='pending'&&order.complimentaryAvailable===true;
    const messages = { pending: 'Pagamento ainda não confirmado. Conclua o pagamento no Stripe ou confira o status abaixo.', paid: 'Pagamento confirmado. Estamos preparando sua solicitação. Não é necessário pagar novamente.', fulfilled: 'Pagamento confirmado e solicitação registrada. Confira o resultado nas suas solicitações.', expired: 'O checkout expirou. Você pode iniciar um novo pagamento.', failed: 'O pagamento não foi concluído. Você pode tentar novamente.' };
    paymentPanel.append(el('p', '', waiverAvailable ? 'Seu perfil permite autorizar este pedido sem pagamento.' : order.complimentary ? order.status === 'fulfilled' ? 'Solicitação registrada sem cobrança. Confira o resultado nas suas solicitações.' : 'Acesso sem cobrança. Preparando sua solicitação.' : messages[order.status] || 'Confira o estado do pagamento.'), el('p', 'process-online-muted', `Referência: ${order.id}`));
    if (waiverAvailable) paymentPanel.append(button('Autorizar e continuar sem pagar', () => run(async () => {
      const generation=state.generation;
      const released=await api('/requests/checkout',{orderId:order.id,consent:true}); assertCurrent(generation);
      state.payment=released; await loadPayment(released.id);
    }), true));
    if (!order.complimentary && !waiverAvailable && order.status === 'pending' && checkoutUrl(order.checkoutUrl)) {
      const link = el('a', 'primary-action', 'Continuar pagamento no Stripe'); link.href = checkoutUrl(order.checkoutUrl); paymentPanel.append(link);
    }
    if (['pending', 'paid'].includes(order.status)) paymentPanel.append(button('Atualizar pagamento', () => run(() => loadPayment(order.id))));
  }
  async function loadPayment(id) {
    const generation = state.generation;
    const order = await api(`/search/orders/${encodeURIComponent(id)}`); assertCurrent(generation);
    state.payment = order;
    if (Array.isArray(order.requests)) for (const request of order.requests) if (request?.id) mergeRequest(request);
    const selected = order.request?.id ? order.request : order.requests?.[0];
    if (selected?.id) {
      if (state.selected?.id !== selected.id) state.analysis = null;
      state.selected = selected; mergeRequest(selected);
      if (selected.kind !== 'search' && COMPLETE.has(selected.status)) await loadAnalysis(selected.id);
      assertCurrent(generation); renderDetails();
    }
    renderPayment(); updateControls();
  }
  function stopPoll() { if (state.timer) clearTimeout(state.timer); state.timer = null; }
  function schedulePoll() {
    stopPoll();
    if (state.active && !doc.hidden && state.payment && ['pending', 'paid'].includes(state.payment.status)) {
      state.timer = setTimeout(() => run(() => loadPayment(state.payment.id)), 5000); return;
    }
    if (!state.active || doc.hidden || !state.selected || state.selected.kind === 'search') return;
    const copyPending = PENDING.has(state.selected.status);
    const analysisPending = COMPLETE.has(state.selected.status) && state.analysis?.status === 'running';
    if (!copyPending && !analysisPending) return;
    state.timer = setTimeout(() => {
      state.timer = null;
      if (!state.active || doc.hidden) return;
      run(async () => {
        const generation = state.generation;
        if (copyPending) await refreshRequest(state.selected.id);
        else { await loadAnalysis(state.selected.id); assertCurrent(generation); renderDetails(); }
      });
    }, REFRESH_MS);
  }
  function operationId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    throw new Error('Seu navegador precisa oferecer geração segura de identificadores para iniciar a operação.');
  }
  async function submitPending() {
    const generation = state.generation;
    const pending = state.pending;
    if (!pending || !ready()) return;
    try {
      if (pending) {
        const order = await api('/requests/checkout', pending.body); assertCurrent(generation);
        if (!order?.id) throw Object.assign(new Error('Não foi possível confirmar o checkout. Retome a mesma operação.'), { uncertain: true });
        state.payment = order; state.pending = null; searchConsent.check.checked = false; copyConsent.check.checked = false; renderPayment();
        if (order.status === 'pending' && !order.complimentary) {
          const url = checkoutUrl(order.checkoutUrl);
          if (!url) throw new Error('O link do pagamento não está disponível. Confira o pagamento antes de tentar novamente.');
          navigate(url);
        } else await loadPayment(order.id);
        return;
      }
    } catch (error) {
      if (generation === state.generation && !error.uncertain) state.pending = null;
      throw error;
    }
  }
  async function startOperation() {
    if (!ready() || state.pending) return;
    const unit = unitAmount(), numbers = selectedNumbers();
    if (!state.config?.copyPayment?.checkoutReady || unit === null || state.payment && ['pending','paid'].includes(state.payment.status)) return;
    if (!copyConsent.check.checked) throw new Error('Confirme a autorização antes de continuar.');
    if (!numbers.length) throw new Error('Informe um número CNJ válido ou selecione um processo localizado.');
    if (numbers.length > maxQuantity()) throw new Error(`Selecione até ${maxQuantity()} processos por pagamento.`);
    if (state.requests.some(item => item.kind === 'copy' && ['review_required', 'submitting'].includes(item.status) && numbers.includes(digits(item.cnj)))) {
      throw new Error('Já existe uma solicitação deste processo aguardando conferência. Abra o pedido salvo no histórico antes de iniciar outra operação.');
    }
    const amount = unit * numbers.length;
    if (!Number.isSafeInteger(amount)) throw new Error('Não foi possível confirmar o valor. Atualize a página.');
    const body = { operationId: operationId(), consent: true, approvedAmountCents: amount,
      ...(state.parentAuditId ? { parentAuditId: state.parentAuditId } : {}),
      ...(numbers.length === 1 ? { cnj: formatCnj(numbers[0]) } : { cnjs: numbers.map(formatCnj) }) };
    state.pending = { kind: 'copy', body }; updateControls(); await submitPending();
  }
  copyForm.addEventListener('submit', event => { event.preventDefault(); run(() => startOperation()); });
  searchForm.addEventListener('submit', event => {
    event.preventDefault();
    if (state.busy || state.pending || !searchConsent.check.checked || typeof onDocumentSearch !== 'function') return;
    const value = documento.value.trim();
    if (!/^[\d.\-/\s]+$/.test(value) || ![11, 14].includes(digits(value).length)) { showNotice('Informe um CPF ou CNPJ válido.', true); return; }
    onDocumentSearch({ documento: digits(value) });
  });
  for (const check of [copyConsent.check, searchConsent.check]) check.addEventListener('change', updateControls);
  cnj.addEventListener('input', () => { state.chosen.clear(); renderSelection(); copyConsent.check.checked = false; updateControls(); });
  documento.addEventListener('input', () => { searchConsent.check.checked = false; updateControls(); });
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) stopPoll(); else schedulePoll(); });
  renderHistory(); renderConfig();

  function reset() {
    stopPoll(); state.generation++; state.activation++;
    state.active = false; state.config = null; state.busy = false;
    state.payment = null; renderPayment();
    state.requests = []; state.selected = null; state.analysis = null; state.pending = null;
    state.parentAuditId = null; state.available = []; state.chosen.clear(); renderSelection(); state.refreshAt.clear();
    cnj.value = ''; documento.value = '';
    copyConsent.check.checked = false; searchConsent.check.checked = false;
    pendingText.textContent = '';
    showNotice(); renderHistory(); renderDetails(); renderConfig();
  }

  return {
    reset,
    async activate(options = {}) {
      state.active = true;
      state.parentAuditId = options.parentAuditId || null;
      state.chosen.clear(); state.available = [];
      const candidates = [...(Array.isArray(options.processes) ? options.processes : []), ...(Array.isArray(options.cnjs) ? options.cnjs : [])];
      const seen = new Set();
      for (const value of candidates.slice(0, 400)) {
        const raw = typeof value === 'string' ? value : value?.cnj || value?.numero_cnj || value?.numeroProcesso;
        const number = normalizedCnj(raw);
        if (!number || seen.has(number) || seen.size >= 200) continue;
        seen.add(number); state.available.push({ ...(value && typeof value === 'object' ? value : {}), cnj: number });
      }
      cnj.value = !candidates.length && normalizedCnj(options.cnj) ? formatCnj(normalizedCnj(options.cnj)) : '';
      documento.value = options.documento ? String(options.documento) : '';
      copyConsent.check.checked = false; searchConsent.check.checked = false; renderSelection(); updateControls();
      const generation = state.generation, activation = ++state.activation;
      const results = await Promise.allSettled([api('/config'), loadHistory(), api('/search/orders')]);
      if (generation !== state.generation || activation !== state.activation) return;
      if (results[0].status === 'fulfilled') state.config = results[0].value;
      else { state.config = null; showNotice(results[0].reason.message, true); }
      if (results[1].status === 'rejected' && results[0].status === 'fulfilled') showNotice(results[1].reason.message, true);
      if (results[2].status === 'fulfilled' && !state.payment) { state.payment = results[2].value.orders?.[0] || null; renderPayment(); }
      renderConfig();
      const orderId = new URLSearchParams(location?.search || '').get('process_search_order');
      if (/^[0-9a-f-]{36}$/i.test(orderId || '')) {
        try { await loadPayment(orderId); } catch (error) { if (generation === state.generation && !error.silent) showNotice(error.message, true); }
      }
      schedulePoll();
    },
    deactivate() {
      state.active = false; stopPoll(); state.chosen.clear(); state.available = []; cnj.value = ''; documento.value = '';
      copyConsent.check.checked = false; searchConsent.check.checked = false; renderSelection(); updateControls();
    },
  };
}
