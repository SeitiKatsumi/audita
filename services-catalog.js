export function matchesService(service, query, category) {
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return service.enabled !== false && (category === 'all' || service.categories.includes(category)) &&
    normalize(query).trim().split(/\s+/).every(word => normalize(service.text).includes(word));
}

export function initServicesCatalog(root = document.querySelector('#central-servicos')) {
  if (!root) return;
  const input = root.querySelector('input[type="search"]');
  const buttons = [...root.querySelectorAll('[data-service-category]')];
  const cards = [...root.querySelectorAll('[data-service-card]')];
  let category = 'all', pisEnabled = false, energyEnabled = false;
  function render() {
    let count = 0;
    for (const card of cards) {
      card.hidden = !matchesService({text: card.textContent + ' ' + (card.dataset.keywords || ''),
        categories: card.dataset.categories.split(' '), enabled: (!card.hasAttribute('data-service-pis') || pisEnabled) && (!card.hasAttribute('data-service-energy') || energyEnabled)}, input.value, category);
      if (!card.hidden) count++;
    }
    root.querySelectorAll('[data-service-group]').forEach(group => {
      group.hidden = ![...group.querySelectorAll('[data-service-card]')].some(card => !card.hidden);
    });
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.serviceCategory === category)));
    root.querySelector('[data-service-count]').textContent = `${count} ${count === 1 ? 'serviço encontrado' : 'serviços encontrados'}`;
    root.querySelector('[data-service-empty]').hidden = count !== 0;
  }
  input.addEventListener('input', render);
  buttons.forEach(button => button.addEventListener('click', () => { category = button.dataset.serviceCategory; render(); }));
  root.querySelector('[data-service-clear]').addEventListener('click', () => { input.value = ''; category = 'all'; render(); input.focus(); });
  render();
  fetch('/api/energy-audit/config', {credentials: 'same-origin'}).then(r => r.ok ? r.json() : {}).then(c => { energyEnabled = c.enabled === true; render(); }).catch(() => {});
  fetch('/api/pis-pasep/config', {credentials: 'same-origin'}).then(response => {
    if (!response.ok) throw new Error('Configuração indisponível');
    return response.json();
  }).then(config => { pisEnabled = config.enabled === true; render(); }).catch(() => {});
}
