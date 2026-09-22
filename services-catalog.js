export function matchesService(service, query, category) {
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return service.enabled !== false && (category === 'all' || service.categories.includes(category)) &&
    normalize(query).trim().split(/\s+/).every(word => normalize(service.text).includes(word));
}

export function initServicesCatalog(root = document.querySelector('#central-servicos')) {
  if (!root) return;
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
