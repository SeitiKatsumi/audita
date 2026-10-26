import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
function browser({ userAgent = 'Chrome', platform = 'Win32', maxTouchPoints = 0, standalone = false } = {}) {
  const events = new Map(), nodes = [], registered = [];
  function element(tag) {
    const listeners = new Map();
    const node = { tag, listeners, setAttribute() {}, addEventListener: (name, fn) => listeners.set(name, fn),
      showModal() { this.open = true; }, close() { this.open = false; }, replaceChildren(...children) { this.children = children; },
      querySelector() { return this.list ||= element('ol'); } };
    nodes.push(node); return node;
  }
  const media = { matches: standalone, addEventListener: (_, fn) => events.set('displaychange', fn) };
  const document = { createElement: element, body: { append() {} }, getElementById: () => null };
  const navigator = { userAgent, platform, maxTouchPoints, serviceWorker: { register: (...args) => { registered.push(args); return Promise.resolve(); } } };
  const window = { isSecureContext: true, matchMedia: () => media, addEventListener: (name, fn) => events.set(name, fn) };
  vm.runInNewContext(read('pwa-install.js'), { window, document, navigator });
  return { button: nodes[0], guide: nodes[1], events, media, registered, click: () => nodes[0].listeners.get('click')() };
}
test('install prompt is used once, cancellation permits retry and accepted install hides the button', async () => {
  const b = browser(); let prompts = 0, prevented = false;
  b.events.get('beforeinstallprompt')({ preventDefault() { prevented = true; }, prompt: async () => { prompts++; }, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
  await b.click(); assert.equal(prevented, true); assert.equal(prompts, 1); assert.equal(b.button.hidden, false);
  await b.click(); assert.equal(prompts, 1); assert.equal(b.guide.open, true);
  b.events.get('beforeinstallprompt')({ preventDefault() {}, prompt: async () => { prompts++; }, userChoice: Promise.resolve({ outcome: 'accepted' }) });
  await b.click(); assert.equal(prompts, 2); assert.equal(b.button.hidden, true); assert.equal(b.button.disabled, false);
});
test('iPhone and touch-enabled iPad guide installation through Safari without pretending to install', async () => {
  for (const device of [{ userAgent: 'iPhone Safari' }, { userAgent: 'Safari', platform: 'MacIntel', maxTouchPoints: 5 }]) {
    const b = browser(device); await b.click();
    assert.equal(b.guide.open, true); assert.match(b.guide.list.children.map(n => n.textContent).join(' '), /Safari.*Compartilhar.*Tela de Início/);
    assert.equal(b.button.hidden, false);
  }
});
test('Android fallback and failed native prompt give usable manual instructions', async () => {
  const b = browser({ userAgent: 'Android Chrome' }); await b.click();
  assert.match(b.guide.list.children.map(n => n.textContent).join(' '), /Chrome.*Instalar app/);
  b.guide.close(); b.events.get('beforeinstallprompt')({ preventDefault() {}, prompt: async () => { throw Error('Unavailable'); } });
  await b.click(); assert.equal(b.guide.open, true); assert.equal(b.button.disabled, false);
});
test('standalone and installed events hide installation UI; registration never enables private offline caching', () => {
  assert.equal(browser({ standalone: true }).button.hidden, true);
  const b = browser(); b.events.get('appinstalled')(); assert.equal(b.button.hidden, true);
  assert.equal(b.registered[0][0], '/pwa-sw.js'); assert.equal(b.registered[0][1].scope, '/');
  assert.doesNotMatch(read('pwa-sw.js'), /caches\.|CacheStorage|respondWith|addEventListener\(['"]fetch/);
});
test('manifest, PNG sizes, server MIME type and Docker packaging agree', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.display, 'standalone'); assert.equal(manifest.scope, '/'); assert.equal(manifest.start_url, '/#home');
  for (const icon of manifest.icons) {
    const png = readFileSync(new URL('..' + icon.src, import.meta.url));
    const size = Number(icon.sizes.split('x')[0]); assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
  }
  for (const name of ['manifest.webmanifest', 'pwa-install.js', 'pwa-sw.js']) {
    assert.ok(read('server.mjs').includes("publicRootFiles.add('" + name + "')")); assert.ok(read('Dockerfile').includes(name));
  }
  assert.match(read('server.mjs'), /application\/manifest\+json/);
  assert.match(read('index.html'), /rel="apple-touch-icon"/);
});
