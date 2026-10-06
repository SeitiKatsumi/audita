import { analysisSegments } from './analysis-segments.js';

function addAnalysisServices(root) {
  for (const segment of analysisSegments.filter(s => s.id !== 'analise-vendedor')) {
    if (root.querySelector(`a[href="#${segment.id}"]`)) continue;
    let heading = root.querySelector(`#services-${segment.category}`);
    if (!heading) {
      const group = document.createElement('section');
      group.className = 'services-group'; group.dataset.serviceGroup = '';
      group.setAttribute('aria-labelledby', `services-${segment.category}`);
      group.innerHTML = `<h3 id="services-${segment.category}">${segment.categoryLabel}</h3><div class="services-grid"></div>`;
      root.querySelector('#servicesGrid').append(group);
      heading = group.querySelector('h3');
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'secondary-action'; button.dataset.serviceCategory = segment.category;
      button.setAttribute('aria-pressed', 'false'); button.textContent = segment.categoryLabel;
      root.querySelector('[data-service-category="all"]').parentElement.append(button);
    }
    const card = document.createElement('article');
    card.className = 'home-module-action service-card service-card-explained';
    card.dataset.serviceCard = ''; card.dataset.categories = segment.category;
    card.innerHTML = `<a class="service-card-entry" href="#${segment.id}"><span class="home-module-icon"><img src="assets/nav-icons/building.svg" alt="" /></span><span class="home-module-copy"><small class="service-category-label">${segment.categoryLabel}</small><strong>${segment.title}</strong><small>${segment.description}</small></span></a>
      <details class="service-disclosure"><summary class="service-toggle"><span class="service-more">Mais informações</span><span class="service-less">Menos informações</span><img class="home-module-chevron" src="assets/nav-icons/chevron-right.svg" alt="" aria-hidden="true" /></summary><div class="service-expanded"><span class="service-detail"><b>Como podemos ajudar</b><span>Coleta de documentos e dados, análise por IA com foco neste serviço, score documental e relatório completo em PDF.</span></span><small class="service-note">${segment.scope}</small><a class="service-action" href="#${segment.id}">Iniciar análise<img class="home-module-chevron" src="assets/nav-icons/chevron-right.svg" alt="" aria-hidden="true" /></a></div></details>`;
    heading.parentElement.querySelector('.services-grid').append(card);
  }
  const compare = (a, b) => a.localeCompare(b, 'pt-BR');
  const groups = [...root.querySelectorAll('[data-service-group]')];
  groups.sort((a,b) => compare(a.querySelector('h3').textContent,b.querySelector('h3').textContent)).forEach(g => root.querySelector('#servicesGrid').append(g));
  for (const group of groups) [...group.querySelectorAll('[data-service-card]')].sort((a,b)=>compare(a.querySelector('strong').textContent,b.querySelector('strong').textContent)).forEach(card=>group.querySelector('.services-grid').append(card));
  [...root.querySelectorAll('[data-service-category]')].filter(b=>b.dataset.serviceCategory !== 'all').sort((a,b)=>compare(a.textContent,b.textContent)).forEach(b=>root.querySelector('[data-service-category="all"]').parentElement.append(b));
}

export function matchesService(service, query, category) {
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return service.enabled !== false && (category === 'all' || service.categories.includes(category)) &&
    normalize(query).trim().split(/\s+/).every(word => normalize(service.text).includes(word));
}

export function initServicesCatalog(root = document.querySelector('#central-servicos'), { openPlans } = {}) {
  if (!root) return;
  addAnalysisServices(root);
  if (openPlans) initJurisprudence(root, openPlans);
  root.querySelector('[data-ir-diseases-open]')?.addEventListener('click', () => {
    document.querySelector('#irDiseasesDialog').showModal();
  });
  const buttons = [...root.querySelectorAll('[data-service-category]')];
  const cards = [...root.querySelectorAll('[data-service-card]')];
  let category = 'all';
  function render() {
    let count = 0;
    for (const card of cards) {
      card.hidden = !matchesService({text: card.textContent + ' ' + (card.dataset.keywords || ''),
        categories: card.dataset.categories.split(' ')}, '', category);
      if (!card.hidden) count++;
    }
    root.querySelectorAll('[data-service-group]').forEach(group => {
      group.hidden = ![...group.querySelectorAll('[data-service-card]')].some(card => !card.hidden);
    });
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.serviceCategory === category)));
    root.querySelector('[data-service-count]').textContent = `${count} ${count === 1 ? 'serviço encontrado' : 'serviços encontrados'}`;
    root.querySelector('[data-service-empty]').hidden = count !== 0;
  }
  buttons.forEach(button => button.addEventListener('click', () => { category = button.dataset.serviceCategory; render(); }));
  root.querySelector('[data-service-clear]').addEventListener('click', () => { category = 'all'; render(); buttons.find(button => button.dataset.serviceCategory === 'all')?.focus(); });
  render();
}

export function filterJurisprudence(records, query) {
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const words = normalize(query).trim().split(/\s+/);
  return records.filter(record => words.every(word => normalize([record.process, record.tribunal, record.decision, record.outcome, record.notes, record.amount].join(' ')).includes(word)));
}

function initJurisprudence(root, openPlans) {
  const button = root.querySelector('[data-jurisprudence-open]');
  if (!button) return;
  const dialog = document.querySelector('#jurisprudenceDialog');
  if (!dialog) return;
  const notice = root.querySelector('[data-jurisprudence-notice]');
  const select = dialog.querySelector('select');
  const status = dialog.querySelector('[data-jurisprudence-status]');
  const results = dialog.querySelector('[data-jurisprudence-records]');
  const report = dialog.querySelector('[data-jurisprudence-report]');
  const search = dialog.querySelector('#jurisprudenceSearch');
  let records = [];
  let revision = 0;
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function renderRecords() {
    const matches = filterJurisprudence(records, search.value);
    results.replaceChildren();
    for (const record of matches) {
      const detail = element('details', undefined, 'jurisprudence-record');
      const summary = element('summary');
      summary.append(element('strong', record.process || 'Processo não informado'), element('span', record.tribunal));
      detail.append(summary);
      for (const [label, key] of [['Recurso / decisão', 'decision'], ['Resultado informado', 'outcome'], ['Observação', 'notes'], ['Valor indenizado informado', 'amount']]) {
        const field = element('p');
        field.append(element('strong', `${label}: `), element('span', record[key] || 'Não informado no acervo.'));
        detail.append(field);
      }
      detail.append(element('p', `Fonte: Base Geral Jurisprudencia Seguros Bancos · linha ${record.row}.`, 'muted'));
      results.append(detail);
    }
    status.textContent = matches.length ? `${matches.length} de ${records.length} registros em ${select.value}. Abra um registro para ler os detalhes.` : 'Nenhum registro encontrado. Tente outro termo.';
  }
  function renderReport(data) {
    const details = element('details', undefined, 'jurisprudence-report');
    details.append(element('summary', `Ler relatório completo de ${data.uf}`));
    // Build the longer original only when opened; do not interpret document markup as HTML.
    details.addEventListener('toggle', () => {
      if (!details.open || details.childElementCount > 1) return;
      details.append(element('p', `Fonte: ${data.reportSource}`, 'muted'));
      for (const block of data.report) {
        if (block.type === 'paragraph') details.append(element('p', block.text));
        if (block.type === 'table') {
          const wrapper = element('div', undefined, 'jurisprudence-table');
          wrapper.tabIndex = 0;
          wrapper.setAttribute('role', 'region');
          wrapper.setAttribute('aria-label', 'Tabela do relatório — role horizontalmente para ler todas as colunas');
          const table = element('table');
          for (const [index, cells] of block.rows.entries()) {
            const row = element('tr');
            for (const text of cells) {
              const cell = element(index === 0 ? 'th' : 'td', text);
              if (index === 0) cell.scope = 'col';
              row.append(cell);
            }
            table.append(row);
          }
          wrapper.append(table); details.append(wrapper);
        }
      }
    });
    report.replaceChildren(details);
  }
  async function request(url) {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw Object.assign(new Error('Jurisprudências indisponíveis no momento. Tente novamente mais tarde.'), { status: response.status });
    return response;
  }
  function failure(error, target) {
    if ([401, 403].includes(error.status)) {
      dialog.close();
      button.disabled = false;
      button.focus();
      openPlans();
    } else target.textContent = error.message;
  }
  button.addEventListener('click', async () => {
    const version = ++revision;
    button.disabled = true;
    notice.textContent = 'Verificando acesso...';
    try {
      const data = await (await request('/api/jurisprudence')).json();
      if (version !== revision) return;
      select.replaceChildren(new Option('Selecione um estado', ''), ...data.states.map(uf => new Option(uf, uf)));
      results.replaceChildren(); report.replaceChildren();
      search.value = ''; search.disabled = true;
      status.textContent = 'Escolha o estado para ler as jurisprudências.';
      button.disabled = false;
      button.focus();
      dialog.showModal();
    } catch (error) {
      if (version === revision) failure(error, notice);
    } finally {
      button.disabled = false;
      if (notice.textContent === 'Verificando acesso...') notice.textContent = '';
    }
  });
  select.addEventListener('change', async () => {
    const version = ++revision;
    records = []; results.replaceChildren(); report.replaceChildren();
    search.value = ''; search.disabled = true;
    status.textContent = select.value ? 'Carregando jurisprudências...' : 'Selecione um estado.';
    if (!select.value) return;
    try {
      const data = await (await request(`/api/jurisprudence?uf=${encodeURIComponent(select.value)}&view=read`)).json();
      if (version !== revision) return;
      records = data.records;
      search.disabled = false;
      renderRecords(); renderReport(data);
    } catch (error) {
      if (version === revision) failure(error, status);
    }
  });
  search.addEventListener('input', renderRecords);
  function clear() { revision++; records = []; results.replaceChildren(); report.replaceChildren(); search.value = ''; search.disabled = true; status.textContent = ''; select.value = ''; }
  dialog.addEventListener('close', clear);
  window.addEventListener('audita:auth-changed', () => { clear(); dialog.close(); });
}
