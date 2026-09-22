import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.env.AUDITA_BASE_URL || 'http://localhost:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const services = [
  ['dividas-bancarias', 'Entenda como sua dívida bancária chegou ao valor atual', '#debtStage input[type=file]'],
  ['analise-cobrancas', 'Entenda as cobranças de seguros e serviços no seu cartão', '[data-charge-action=not-authorized]'],
  ['pis-pasep', 'Saiba como consultar possíveis cotas antigas do PIS/PASEP', '[data-pis-start]'],
  ['isencao-ir', 'Entenda se o seu caso pode seguir para análise de isenção e restituição de IR', '[data-start-role=self]'],
  ['contas-de-luz', 'Entenda os valores cobrados na sua conta de luz', '#energyApp button'],
  ['consulta-tjdft', 'Encontre as certidões judiciais para a sua consulta', '#stateCourtUf'],
  ['consulta-tjdft-pf', 'Encontre as certidões judiciais para a sua consulta', '#stateCourtUf'],
  ['consulta-tjdft-pj', 'Encontre as certidões judiciais para a sua consulta', '#stateCourtUf'],
  ['consulta-cnib', 'Confira possíveis restrições associadas ao vendedor', '#cnibDocumentType'],
  ['analise-vendedor', 'Está comprando um imóvel no Distrito Federal?', '#sellerAnalysisForm input'],
  ['consulta-imoveis', 'Pesquise informações de imóveis nos serviços disponíveis', '#propertyOperation'],
];
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) for (const signedIn of [false, true]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const errors = [], writes = [];
    page.on('pageerror', error => errors.push(error.message));
    // Synthetic sessions only; never read private cases or send documents to providers.
    await page.route('**/api/**', async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (path === '/api/auth/me') return route.fulfill({ json: {
        authRequired: true, user: signedIn ? { id: 'intro-test', name: 'Pessoa Teste', role: 'member' } : null,
      } });
      if (request.method() !== 'GET') {
        writes.push(path);
        return route.fulfill({ status: 503, json: { error: 'test_only' } });
      }
      if (/\/api\/(pis-pasep|ir-exemption|energy-audit)\/config$/.test(path)) {
        return route.fulfill({ json: { enabled: true, ready: true, storageReady: true } });
      }
      if (path.endsWith('/cases')) return route.fulfill({ json: { cases: [] } });
      if (path.endsWith('/config') || ['/api/health', '/api/modules', '/api/state-courts'].includes(path)) return route.continue();
      return route.fulfill({ status: 404, json: {} });
    });
    for (const [route, text, control] of services) {
      await page.goto('about:blank');
      await page.goto(base + '/#' + route);
      await page.waitForFunction(() => !document.documentElement.classList.contains('app-booting'));
      const intro = page.getByText(text, { exact: route !== 'analise-vendedor' });
      await intro.waitFor();
      assert.equal(await intro.count(), 1, route + ': duplicate intro');
      assert.equal(await page.locator('#loginScreen').evaluate(el => el.open), false, route + ': premature login');
      const field = page.locator(control).first();
      await field.waitFor();
      const introBox = await intro.boundingBox(), fieldBox = await field.boundingBox();
      assert.ok(introBox.y + introBox.height <= fieldBox.y, route + ': intro must precede controls');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), route + ': horizontal overflow');
      if (!signedIn) await page.screenshot({ path: join(tmpdir(), `audita-intro-${route}-${width}.png`), fullPage: true });
      if (route === 'dividas-bancarias') {
        await field.setInputFiles({ name: 'extrato-ficticio.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nDocumento fictício: não enviar ao servidor.') });
        assert.equal(await field.evaluate(el => el.files.length), 1);
        if (!signedIn) {
          await page.getByRole('button', { name: 'Enviar extratos e analisar', exact: true }).click();
          assert.ok(await page.locator('#loginScreen').evaluate(el => el.open));
        }
      }
      console.log(`${width} ${signedIn ? 'member' : 'guest'} ${route}: intro, order, navigation and layout OK`);
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(writes, []);
    await page.close();
  }
} finally {
  await browser.close();
}
