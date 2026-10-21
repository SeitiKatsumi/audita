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
export function initProcessOnline({ container, fetchImpl = globalThis.fetch, onAuthRequired = () => {} } = {}) {
  if (!container?.ownerDocument) throw new TypeError('Informe o contêiner do módulo de processos.');
  const doc = container.ownerDocument;
  const state = { active: false, config: null, busy: false, requests: [], selected: null,
    parentAuditId: null, pending: null, timer: null, refreshAt: new Map(), analysis: null, generation: 0, activation: 0 };
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
    el('p', '', 'Informe um número CNJ ou busque processos por CPF/CNPJ. A cópia integral é solicitada individualmente, após sua autorização.'),
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
  const copyButton = el('button', 'primary-action', 'Solicitar cópia integral'); copyButton.type = 'submit';
  copyForm.append(cnjField, copyConsent.label, copyButton);
  cnjSection.append(copyForm);

  const searchSection = el('section', 'process-online-section');
  searchSection.append(el('h3', '', 'Localizar por CPF ou CNPJ'), el('p', 'process-online-muted', 'A busca retorna uma lista de processos. Ela não solicita cópias automaticamente.'));
  const searchForm = el('form', 'process-online-form');
  const documento = input('documento', 'CPF ou CNPJ do titular', 22); documento.inputMode = 'numeric';
  const searchConsent = consent('searchConsent', 'Tenho autorização para consultar este documento e autorizo esta busca.');
  const searchButton = el('button', 'primary-action', 'Buscar processos'); searchButton.type = 'submit';
  searchForm.append(field('CPF ou CNPJ', documento), searchConsent.label, searchButton);
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
  root.append(intro, configPanel, notice, pendingPanel, forms, history, details);
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
  function updateControls() {
    const paidDisabled = state.busy || !ready() || Boolean(state.pending);
    searchButton.disabled = paidDisabled || state.config?.searchReady === false || !searchConsent.check.checked;
    copyButton.disabled = paidDisabled || !copyConsent.check.checked;
    historyButton.disabled = state.busy;
    retryButton.disabled = state.busy || !ready();
    retryButton.hidden = Boolean(state.pending?.review);
    retryButton.textContent = state.pending?.canRecover ? 'Retomar a mesma cópia' : 'Retomar a mesma operação';
    reconcileButton.disabled = state.busy;
    for (const control of [cnj, documento, copyConsent.check, searchConsent.check]) {
      control.disabled = state.busy || Boolean(state.pending);
    }
    if (state.config?.searchReady === false) { documento.disabled = true; searchConsent.check.disabled = true; }
    root.setAttribute('aria-busy', String(state.busy));
    pendingPanel.hidden = !state.pending;
    if (state.pending) pendingText.textContent = `${state.pending.review ? 'A operação está salva e aguarda conferência.' : `O envio da ${state.pending.kind === 'search' ? 'busca' : 'cópia'} ainda não foi confirmado.`} Referência: ${state.pending.body.operationId}.`;
  }
  function renderConfig() {
    configPanel.replaceChildren();
    if (ready()) {
      configPanel.append(el('strong', '', sandbox() ? 'Testes gratuitos ativos' : 'Integração disponível'),
        el('p', '', sandbox() ? 'Use somente os canários fornecidos pelo parceiro. Todo PDF deste ambiente é demonstrativo.' : 'O saldo e a autorização são conferidos no servidor antes de cada operação.'));
      if (sandbox()) {
        configPanel.append(button('Usar processo de exemplo', () => {
          if (state.busy || state.pending) return;
          cnj.value = '0701379-18.2025.8.01.0013'; copyConsent.check.checked = false; updateControls(); cnj.focus();
        }));
        if (state.config?.searchReady === false) configPanel.append(el('p', 'process-online-muted',
          'A busca por CPF/CNPJ ainda não está homologada no sandbox. Para testar gratuitamente, use o número de processo de exemplo.'));
      }
    } else {
      configPanel.append(el('strong', '', 'Integração em ativação'), el('p', '', state.config?.storageReady === false
        ? 'O armazenamento privado precisa estar disponível antes de novas solicitações.'
        : state.config?.billingReady === false && state.config?.mode === 'live'
          ? 'A carteira de créditos Audita precisa estar disponível antes de novas solicitações.'
        : 'O acesso à API depende de cadastro e aprovação como parceiro B2B, além da chave de integração. A assinatura comum do site não libera a API.'));
      const link = el('a', '', 'Cadastro de parceiro e testes gratuitos');
      link.href = 'https://processonline.com.br/seja-parceiro/'; link.target = '_blank'; link.rel = 'noopener noreferrer';
      configPanel.append(link);
    }
    copyConsent.label.lastChild.textContent = sandbox()
      ? 'Autorizo uma cópia demonstrativa no ambiente de testes, sem pagamento real.'
      : 'Autorizo a solicitação desta cópia e confirmo meu interesse legítimo.';
    searchConsent.label.lastChild.textContent = sandbox()
      ? 'Tenho autorização e quero testar a busca com um documento canário, sem pagamento real.'
      : 'Tenho autorização para consultar este documento e autorizo esta busca.';
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
        row.append(button('Preparar solicitação de cópia', () => {
          cnj.value = resultCnj; copyConsent.check.checked = false;
          updateControls(); cnj.focus(); cnjSection.scrollIntoView?.({ block: 'nearest' });
          showNotice('Confira o número e autorize esta cópia individualmente.');
        }), rawDetails('Metadados informados pelo parceiro', result));
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
    area.append(el('h4', '', 'Análise dos autos com IA'), el('p', 'process-online-muted', 'A IA pode cometer erros. Confira as referências nos autos antes de tomar decisões. A análise não substitui a revisão de um profissional.'));
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
  function stopPoll() { if (state.timer) clearTimeout(state.timer); state.timer = null; }
  function schedulePoll() {
    stopPoll();
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
      const request = unwrap(await api(pending.kind === 'search' ? '/search' : '/requests',
        pending.body));
      assertCurrent(generation);
      if (!request?.id) { const error = new Error('O servidor recebeu a operação, mas a confirmação ainda precisa ser conferida no histórico.'); error.uncertain = true; throw error; }
      if (!request.operationId) request.operationId = pending.body.operationId;
      state.selected = request; state.analysis = null; mergeRequest(request); renderDetails(true);
      searchConsent.check.checked = false; copyConsent.check.checked = false;
      showNotice(request.status === 'review_required' ? 'Solicitação salva e aguardando conferência. Não inicie outra operação para o mesmo conteúdo.' : 'Solicitação salva. O histórico permite retomar o mesmo pedido sem solicitar outra cópia.');
    } catch (error) {
      if (generation === state.generation && !error.uncertain) state.pending = null;
      throw error;
    }
  }
  async function startOperation(kind) {
    if (!ready() || state.pending) return;
    if (kind === 'search' && state.config?.searchReady === false) return;
    const check = kind === 'search' ? searchConsent.check : copyConsent.check;
    if (!check.checked) throw new Error('Confirme a autorização antes de continuar.');
    const value = kind === 'search' ? documento.value.trim() : cnj.value.trim();
    if (!/^[\d.\-/\s]+$/.test(value) || !(kind === 'search' ? [11, 14].includes(digits(value).length) : digits(value).length === 20)) {
      throw new Error(kind === 'search' ? 'Informe um CPF ou CNPJ válido.' : 'Informe o número CNJ completo, com 20 dígitos.');
    }
    if (kind === 'copy' && state.requests.some(item => item.kind === 'copy' && ['review_required', 'submitting'].includes(item.status) && digits(item.cnj) === digits(value))) {
      throw new Error('Já existe uma solicitação deste processo aguardando conferência. Abra o pedido salvo no histórico antes de iniciar outra operação.');
    }
    const body = { operationId: operationId(), consent: true, approvedCredits: 0,
      ...(state.parentAuditId ? { parentAuditId: state.parentAuditId } : {}),
      ...(kind === 'search' ? { documento: value } : { cnj: value, interesse: 'outro', interesseDetalhe: '' }) };
    state.pending = { kind, body }; updateControls(); await submitPending();
  }
  copyForm.addEventListener('submit', event => { event.preventDefault(); run(() => startOperation('copy')); });
  searchForm.addEventListener('submit', event => { event.preventDefault(); run(() => startOperation('search')); });
  for (const check of [copyConsent.check, searchConsent.check]) check.addEventListener('change', updateControls);
  cnj.addEventListener('input', () => { copyConsent.check.checked = false; updateControls(); });
  documento.addEventListener('input', () => { searchConsent.check.checked = false; updateControls(); });
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) stopPoll(); else schedulePoll(); });
  renderHistory(); renderConfig();

  function reset() {
    stopPoll(); state.generation++; state.activation++;
    state.active = false; state.config = null; state.busy = false;
    state.requests = []; state.selected = null; state.analysis = null; state.pending = null;
    state.parentAuditId = null; state.refreshAt.clear();
    cnj.value = ''; documento.value = '';
    copyConsent.check.checked = false; searchConsent.check.checked = false;
    pendingText.textContent = '';
    showNotice(); renderHistory(); renderDetails(); renderConfig();
  }

  return {
    reset,
    async activate(options = {}) {
      state.active = true;
      if (options.parentAuditId !== undefined) state.parentAuditId = options.parentAuditId || null;
      if (!state.pending && options.cnj) { cnj.value = String(options.cnj); copyConsent.check.checked = false; }
      if (!state.pending && options.documento) { documento.value = String(options.documento); searchConsent.check.checked = false; }
      const generation = state.generation, activation = ++state.activation;
      const results = await Promise.allSettled([api('/config'), loadHistory()]);
      if (generation !== state.generation || activation !== state.activation) return;
      if (results[0].status === 'fulfilled') state.config = results[0].value;
      else { state.config = null; showNotice(results[0].reason.message, true); }
      if (results[1].status === 'rejected' && results[0].status === 'fulfilled') showNotice(results[1].reason.message, true);
      renderConfig(); schedulePoll();
    },
    deactivate() { state.active = false; stopPoll(); },
  };
}
