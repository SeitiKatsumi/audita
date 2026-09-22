import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.AUDITA_BASE_URL || 'http://localhost:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    let signedIn = false;
    let failLogin = true;
    const writes = [];
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === '/api/auth/me') return route.fulfill({ json: {
        authRequired: true, user: signedIn ? { id: 'guest-test', name: 'Teste', role: 'member' } : null,
      } });
      if (path === '/api/ir-exemption/config') {
        if (signedIn) await new Promise(resolve => setTimeout(resolve, 500));
        return route.fulfill({ json: { enabled: true, ready: true } });
      }
      if (['/api/auth/login', '/api/auth/register'].includes(path)) {
        if (failLogin) return route.fulfill({ status: 401, json: { error: 'invalid_credentials' } });
        signedIn = true;
        return route.fulfill({ json: { ok: true } });
      }
      if (request.method() !== 'GET') {
        writes.push({ path, signedIn, body: request.postData() });
        return route.fulfill({ status: 503, json: { error: 'test_only' } });
      }
      // Preserve public configuration; do not load or mutate real private records.
      if (path.endsWith('/config') || ['/api/health', '/api/modules', '/api/state-courts'].includes(path)) {
        return route.continue();
      }
      return route.fulfill({ status: 404, json: {} });
    });
    const go = async path => {
      await page.goto('about:blank');
      await page.goto(base + path);
      await page.waitForFunction(() => !document.documentElement.classList.contains('app-booting'));
    };
    const modal = page.locator('#loginScreen');
    await go('/#central-servicos');
    assert.equal(await modal.evaluate(el => el.open), false);
    await page.locator('[data-service-category=bancario]').click();
    assert.equal(await page.locator('[data-service-card]:visible').count(), 2);
    const card = page.locator('[data-service-card]').filter({ has: page.locator('[href="#analise-cobrancas"]') });
    await card.locator('summary').click();
    assert.equal(await modal.evaluate(el => el.open), false);
    await card.locator('.service-card-entry strong').click();
    const yes = page.getByRole('button', { name: 'Sim, tenho um desses cartões', exact: true });
    await yes.click();
    assert.ok(await modal.evaluate(el => el.open));
    assert.equal(writes.length, 0);
    await page.screenshot({ path: process.env.TEMP + '/audita-guest-' + width + '.png' });
    await page.keyboard.press('Escape');
    assert.equal(await modal.evaluate(el => el.open), false);
    await yes.click();
    await page.locator('#loginEmail').fill('guest-test@example.com');
    await page.locator('#loginPassword').fill('test-password-only');
    await page.locator('#loginSubmitButton').click();
    await page.waitForFunction(() => document.querySelector('#loginError').textContent.length > 0);
    assert.ok(await modal.evaluate(el => el.open));
    failLogin = false;
    await page.locator('#loginSubmitButton').click();
    await page.waitForFunction(() => !document.querySelector('#loginScreen').open);
    await page.waitForFunction(() => ![...document.querySelectorAll('[data-charge-action]')].some(el =>
      el.textContent.trim() === 'Sim, tenho um desses cartões' && el.getClientRects().length));

    signedIn = false;
    for (const selector of width > 600
      ? ['.chat-home-link', '.chat-back-sidebar', '.chat-assistant-identity']
      : ['.chat-header .chat-back-home', '.chat-assistant-identity']) {
      await go('/chat');
      await page.locator(selector).click();
      await page.waitForURL(base + '/#home');
      await page.locator('#home:not(.page-hidden)').waitFor();
      assert.equal(await modal.evaluate(el => el.open), false, selector + ' must not ask for login');
    }
    for (const path of ['/chat', '/#home']) {
      await go(path);
      if (path === '/chat') await page.locator('#chatAttachmentButton').click();
      else await page.locator('#loginButton').click();
      assert.ok(await modal.evaluate(el => el.open));
      await modal.getByRole('link', { name: 'Voltar para a Home', exact: true }).click();
      await page.waitForURL(base + '/#home');
      await page.locator('#home:not(.page-hidden)').waitFor();
      assert.equal(await modal.evaluate(el => el.open), false);
    }
    await go('/chat');
    await page.locator('#chatInput').fill('Mensagem fictícia para teste');
    assert.equal(await modal.evaluate(el => el.open), false);
    await page.locator('#chatInput').press('Enter');
    assert.ok(await modal.evaluate(el => el.open));
    const homeLinks = page.locator('.chat-back-home, .chat-home-link, .chat-assistant-identity');
    assert.ok((await homeLinks.evaluateAll(els => els.map(el => getComputedStyle(el).visibility))).every(value => value === 'visible'));
    assert.equal(await modal.evaluate(el => getComputedStyle(el).animationName), 'login-enter');
    assert.equal(await modal.evaluate(el => getComputedStyle(el, '::backdrop').animationName), 'login-backdrop-enter');
    await page.waitForFunction(() => document.querySelector('#loginScreen').getAnimations().length === 0);
    await page.screenshot({ path: process.env.TEMP + '/audita-login-motion-' + width + '.png' });
    assert.equal(writes.length, 0);
    await page.locator('#loginClose').click();
    assert.ok((await homeLinks.evaluateAll(els => els.map(el => getComputedStyle(el).visibility))).every(value => value === 'visible'));
    assert.equal(await page.locator('#chatInput').inputValue(), 'Mensagem fictícia para teste');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#chatAttachmentButton').click();
    assert.ok(await modal.evaluate(el => el.open));
    assert.equal(await modal.evaluate(el => getComputedStyle(el).animationName), 'none');
    assert.equal(await modal.evaluate(el => getComputedStyle(el, '::backdrop').animationName), 'none');
    await page.keyboard.press('Escape');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('#chatSendButton').click();
    await page.locator('#loginModeToggle').click();
    await page.locator('#loginName').fill('Pessoa Teste');
    await page.locator('#loginEmail').fill('guest-test@example.com');
    await page.locator('#loginPassword').fill('test-password-only');
    await page.locator('#loginSubmitButton').click();
    await page.waitForFunction(() => !document.querySelector('#loginScreen').open);
    await page.waitForTimeout(300);
    assert.equal(writes.filter(r => r.path === '/api/chat').length, 1);
    assert.ok(writes.every(r => r.signedIn));

    signedIn = false;
    await go('/#isencao-ir');
    await page.locator('[data-start-role=self]').click();
    assert.ok(await modal.evaluate(el => el.open));
    const countBeforeIr = writes.length;
    await page.locator('#loginEmail').fill('guest-test@example.com');
    await page.locator('#loginPassword').fill('test-password-only');
    await page.locator('#loginSubmitButton').click();
    await page.waitForFunction(() => !document.querySelector('#loginScreen').open);
    await page.waitForTimeout(1000);
    assert.equal(writes.length, countBeforeIr + 1);
    assert.equal(writes.at(-1).path, '/api/ir-exemption/cases');
    assert.ok(writes.at(-1).signedIn);

    signedIn = false;
    await go('/#meus-dados');
    assert.ok(await modal.evaluate(el => el.open));
    assert.equal(await page.locator('#meus-dados').isVisible(), false);
    await page.keyboard.press('Escape');
    assert.ok(await page.locator('#home').isVisible());
    assert.deepEqual(errors, []);
    console.log(width + ': guest navigation, login/register, resume, private route and keyboard OK');
    await page.close();
  }
} finally {
  await browser.close();
}
