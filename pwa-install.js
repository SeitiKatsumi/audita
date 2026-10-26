const standalone = window.matchMedia('(display-mode: standalone)');
const installed = () => standalone.matches || navigator.standalone === true;
let installPrompt;
let installing = false;
let installedHere = false;
const button = document.createElement('button');
button.type = 'button';
button.className = 'pwa-install';
button.title = 'Instalar app';
button.setAttribute('aria-label', 'Instalar app IA Audita');
button.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5"/></svg><span>Instalar app</span>';
const guide = document.createElement('dialog');
guide.className = 'pwa-install-guide';
guide.setAttribute('aria-labelledby', 'pwaInstallTitle');
guide.innerHTML = '<form method="dialog"><h2 id="pwaInstallTitle">Instalar IA Audita</h2><ol></ol><p>O app precisa de conexão à internet.</p><button type="submit" autofocus>Entendi</button></form>';
document.body.append(button, guide);
const login = document.getElementById('loginScreen');
if (login) {
  const placeButton = () => (login.open ? login : document.body).append(button);
  new MutationObserver(placeButton).observe(login, { attributes: true, attributeFilter: ['open'] });
  placeButton();
}
function updateButton() { button.hidden = installedHere || installed(); }
function showGuide() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const android = /Android/.test(navigator.userAgent);
  const safari = /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Edg|OPR/.test(navigator.userAgent);
  const steps = ios
    ? ['Abra esta página no Safari.', 'Toque em Compartilhar (quadrado com uma seta para cima).', 'Escolha “Adicionar à Tela de Início” e confirme em “Adicionar”.']
    : android
      ? ['Abra esta página no Chrome.', 'Toque no menu ⋮ do navegador.', 'Escolha “Adicionar à tela inicial” ou “Instalar app” e confirme.']
      : safari
        ? ['Abra o menu Arquivo do Safari.', 'Escolha “Adicionar ao Dock” e confirme. Se a opção não aparecer, atualize o navegador ou use Chrome/Edge.']
        : ['No Chrome ou Edge, abra o menu ⋮ ou ⋯.', 'Procure “Instalar IA Audita” ou “Instalar esta página como aplicativo”. A opção também pode aparecer na barra de endereço.'];
  guide.querySelector('ol').replaceChildren(...steps.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
  if (!guide.open) guide.showModal();
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  updateButton();
});
window.addEventListener('appinstalled', () => {
  installedHere = true;
  installPrompt = undefined;
  guide.close();
  updateButton();
});
standalone.addEventListener?.('change', updateButton);
button.addEventListener('click', async () => {
  if (installing) return;
  if (!installPrompt) { showGuide(); return; }
  const prompt = installPrompt;
  installPrompt = undefined;
  installing = true;
  button.disabled = true;
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === 'accepted') installedHere = true;
  } catch { showGuide(); }
  finally { installing = false; button.disabled = false; updateButton(); }
});
updateButton();
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('/pwa-sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {});
}
