// Run against a local Audita server: AUDITA_BASE_URL=http://localhost:3000 node scripts/check-account-ui.mjs
// All API responses and external navigations are intercepted; no real account or payment is changed.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { getPublicBillingCatalog } from '../services/billing-catalog.service.mjs';
import { profileForClient, normalizeUserProfile } from '../services/user-profile.service.mjs';

const base = process.env.AUDITA_BASE_URL || 'http://127.0.0.1:3012';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const catalog = getPublicBillingCatalog({
  APP_URL: base, AUDITA_BILLING_ENABLED: 'true',
  STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
  STRIPE_PRICE_STANDARD_MONTHLY: 'price_monthly', STRIPE_PRICE_STANDARD_ANNUAL: 'price_annual',
});
let user = { id: 'fixture', name: 'Pessoa de Teste', email: 'teste@example.com', role: 'owner' };
let subscription = null;
let billingFailure = false;
let canManage = true;
let profile = { fullName: 'Pessoa de Teste', email: 'teste@example.com', document: '529.982.247-25', rg: 'RG fictício', phone: '(11) 99999-0000', address: 'Rua de Teste, 123 - Cidade/UF', profession: 'Analista' };
let profileFailure = false;
const posts = [];
const errors = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
await context.route('**/*', async route => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.origin !== new URL(base).origin) return route.fulfill({ contentType: 'text/html', body: '<h1>Pagamento simulado</h1>' });
  if (!url.pathname.startsWith('/api/')) return route.continue();
  if (request.method() !== 'GET') posts.push({ path: url.pathname, data: request.postDataJSON() });
  let body = {};
  let status = 200;
  switch (url.pathname) {
    case '/api/auth/me': body = { authRequired: true, user }; break;
    case '/api/auth/logout': user = null; break;
    case '/api/user/profile':
      if (request.method() === 'PUT') {
        try { profile = profileForClient(normalizeUserProfile(request.postDataJSON().profile)); }
        catch (error) { status = 400; body = { fields: error.errors }; break; }
      }
      status = profileFailure ? 503 : 200;
      body = { profile, storageConfigured: true }; break;
    case '/api/auth/password':
      status = request.postDataJSON().currentPassword === 'Senha-atual-ficticia!' ? 200 : 400;
      body = status === 200 ? { ok: true } : { error: 'incorrect_password' }; break;
    case '/api/billing/plans': body = catalog; break;
    case '/api/billing/subscription':
      status = billingFailure ? 503 : 200;
      body = { subscription, canManage, access: { entitled: Boolean(subscription?.active) } }; break;
    case '/api/billing/checkout': body = { url: 'https://checkout.stripe.com/fixture' }; break;
    case '/api/billing/portal': body = { url: 'https://billing.stripe.com/fixture' }; break;
  }
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
});
const waitOffer = () => page.locator('[data-subscription-action]').waitFor();
const normalized = text => text.replace(/\s+/g, ' ');
const noOverflow = async () => {
  const sizes = await page.evaluate(() => ({ width: innerWidth, html: document.documentElement.scrollWidth, body: document.body.scrollWidth,
    overflow: [...document.querySelectorAll('body *')].filter(element => element.clientWidth && element.scrollWidth > element.clientWidth + 2).map(element => `${element.tagName}#${element.id}.${element.className}: ${element.clientWidth}/${element.scrollWidth}`).slice(0, 12) }));
  assert.ok(Math.max(sizes.html, sizes.body) <= sizes.width, JSON.stringify(sizes));
};

try {
  await page.goto(`${base}/#home`);
  await page.reload();
  await page.locator('html:not(.app-booting)').waitFor();
  const sidebar = page.locator('.sidebar .nav-list');
  assert.doesNotMatch(await sidebar.innerText(), /Configurações|Histórico|Planos e assinaturas|Consumo de APIs/);
  await sidebar.getByRole('link', { name: 'Meus Dados' }).click();
  await waitOffer();
  assert.equal(await page.locator('#pageTitle').innerText(), 'Meus Dados');
  await page.waitForFunction(() => document.querySelector('#profileDocument').textContent === '529.982.247-25');
  assert.equal(await page.locator('#profileName').innerText(), 'Pessoa de Teste');
  const profileForm = page.locator('#accountProfileForm');
  await page.getByRole('button', { name: 'Editar dados', exact: true }).click();
  await profileForm.getByLabel('Nome completo').fill('Pessoa Editada');
  await profileForm.getByLabel('CPF', { exact: true }).fill('111.111.111-11');
  await profileForm.getByRole('button', { name: 'Salvar dados', exact: true }).click();
  await page.getByText('CPF inválido.', { exact: true }).waitFor();
  assert.equal(await profileForm.getByLabel('Nome completo').inputValue(), 'Pessoa Editada');
  await profileForm.getByLabel('CPF', { exact: true }).fill('529.982.247-25');
  await profileForm.getByLabel('E-mail de contato').fill('contato@example.test');
  await profileForm.getByLabel('Rua / avenida').fill('Rua Fictícia');
  await profileForm.getByLabel('Número', { exact: true }).fill('42');
  await profileForm.getByRole('button', { name: 'Salvar dados', exact: true }).click();
  await page.getByText('Dados pessoais atualizados.', { exact: true }).waitFor();
  assert.equal(await page.locator('#profileName').innerText(), 'Pessoa Editada');
  assert.equal(await page.locator('#profileEmail').innerText(), 'contato@example.test');
  assert.equal(await page.locator('#accountLoginEmail').innerText(), 'teste@example.com');
  assert.equal(profile.profession, 'Analista');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#profileName').textContent === 'Pessoa Editada');
  await page.getByRole('button', { name: 'Editar dados', exact: true }).click();
  await profileForm.getByLabel('Nome completo').fill('Descartar');
  await profileForm.getByRole('button', { name: 'Cancelar', exact: true }).click();
  assert.equal(await page.locator('#profileName').innerText(), 'Pessoa Editada');
  profileFailure = true;
  await page.getByRole('button', { name: 'Editar dados', exact: true }).click();
  await page.getByText('Não foi possível carregar seus dados. Tente novamente.', { exact: true }).waitFor();
  assert.equal(await profileForm.isVisible(), false);
  profileFailure = false;
  await page.getByRole('button', { name: 'Editar dados', exact: true }).click();
  await profileForm.getByRole('button', { name: 'Cancelar', exact: true }).click();
  assert.match(normalized(await page.locator('.account-charge').innerText()), /199,00.*cada mês/);
  await noOverflow();
  await page.getByRole('button', { name: /^Anual/ }).click();
  assert.match(normalized(await page.locator('.account-price').innerText()), /99,00/);
  assert.match(normalized(await page.locator('.account-charge').innerText()), /1\.188,00.*uma vez por ano/);
  assert.match(await page.locator('.account-benefits').innerText(), /advogado parceiro/);
  await mkdir(new URL('../output/account/', import.meta.url), { recursive: true });
  await page.screenshot({ path: fileURLToPath(new URL('../output/account/desktop.png', import.meta.url)), fullPage: true });
  await page.getByRole('button', { name: 'Assinar anual', exact: true }).click();
  await page.waitForURL('https://checkout.stripe.com/fixture');
  const purchase = posts.find(item => item.path === '/api/billing/checkout');
  assert.equal(purchase.data.kind, 'subscription');
  assert.equal(purchase.data.planId, 'standard');
  assert.equal(purchase.data.interval, 'annual');
  assert.ok(purchase.data.requestId);

  subscription = { provider: 'stripe', planId: 'standard', interval: 'annual', status: 'active', active: true, currentPeriodEnd: '2027-09-22T12:00:00Z', cancelAtPeriodEnd: true };
  await page.goto(`${base}/planos?checkout=success`);
  await page.waitForURL(`${base}/?checkout=success#meus-dados`);
  await page.locator('html:not(.app-booting)').waitFor();
  await waitOffer();
  assert.match(await page.locator('#subscriptionSummary').innerText(), /Assinatura ativa.*Acesso até/);
  assert.equal(await page.locator('#subscriptionCycle').isVisible(), false);
  await page.getByRole('button', { name: 'Gerenciar assinatura', exact: true }).click();
  await page.waitForURL('https://billing.stripe.com/fixture');
  assert.ok(posts.some(item => item.path === '/api/billing/portal'));

  subscription = { ...subscription, status: 'past_due', active: false, cancelAtPeriodEnd: false };
  await page.goto(`${base}/#meus-dados`);
  await page.locator('html:not(.app-booting)').waitFor();
  await waitOffer();
  assert.match(await page.locator('#subscriptionSummary').innerText(), /Pagamento pendente/);
  assert.equal(await page.getByRole('button', { name: /Assinar/ }).count(), 0);

  subscription = null;
  billingFailure = true;
  await page.reload();
  await page.locator('#subscriptionRetry:not(.hidden)').waitFor();
  assert.equal(await page.locator('[data-subscription-action]').count(), 0);
  billingFailure = false;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await waitOffer();

  canManage = false;
  user.role = 'member';
  await page.reload();
  await page.locator('html:not(.app-booting)').waitFor();
  await waitOffer();
  assert.equal(await page.locator('[data-subscription-action]').isDisabled(), true);
  assert.match(await page.locator('[data-subscription-action]').innerText(), /responsável/);

  canManage = true;
  user.role = 'owner';
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/#home`);
  await page.reload();
  await page.locator('html:not(.app-booting)').waitFor();
  await page.locator('.mobile-bottom-nav').getByRole('link', { name: 'Meus Dados' }).click();
  await waitOffer();
  await page.getByRole('button', { name: /^Anual/ }).focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.getByRole('button', { name: /^Anual/ }).getAttribute('aria-pressed'), 'true');
  await noOverflow();
  await page.screenshot({ path: fileURLToPath(new URL('../output/account/mobile.png', import.meta.url)), fullPage: true });
  await page.getByRole('button', { name: 'Editar dados', exact: true }).click();
  await profileForm.getByLabel('Nome completo').waitFor();
  await noOverflow();
  await page.screenshot({ path: fileURLToPath(new URL('../output/account/mobile-edit.png', import.meta.url)), fullPage: true });
  await profileForm.getByRole('button', { name: 'Cancelar', exact: true }).click();
  const passwordForm = page.locator('#accountPasswordForm');
  await page.getByRole('button', { name: 'Alterar senha', exact: true }).click();
  await passwordForm.getByLabel('Senha atual', { exact: true }).fill('wrong-password');
  await passwordForm.getByLabel('Nova senha', { exact: true }).fill('Senha-nova-ficticia!');
  await passwordForm.getByLabel('Confirmar nova senha', { exact: true }).fill('Not-the-same-password');
  await passwordForm.getByRole('button', { name: 'Salvar nova senha', exact: true }).click();
  await page.getByText('A confirmação deve ser igual à nova senha.', { exact: true }).waitFor();
  assert.equal(posts.filter(item => item.path === '/api/auth/password').length, 0);
  await passwordForm.getByLabel('Confirmar nova senha', { exact: true }).fill('Senha-nova-ficticia!');
  await passwordForm.getByRole('button', { name: 'Salvar nova senha', exact: true }).click();
  await page.getByText('A senha atual está incorreta.', { exact: true }).waitFor();
  assert.equal(await passwordForm.getByLabel('Senha atual', { exact: true }).inputValue(), '');
  await passwordForm.getByLabel('Senha atual', { exact: true }).fill('to-be-cleared');
  await page.locator('.mobile-bottom-nav').getByRole('link', { name: 'Home', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#accountPasswordForm').classList.contains('hidden'));
  assert.equal(await passwordForm.getByLabel('Senha atual', { exact: true }).inputValue(), '');
  await page.locator('.mobile-bottom-nav').getByRole('link', { name: 'Meus Dados' }).click();
  await page.getByRole('button', { name: 'Alterar senha', exact: true }).click();
  await passwordForm.getByLabel('Senha atual', { exact: true }).fill('Senha-atual-ficticia!');
  await passwordForm.getByLabel('Nova senha', { exact: true }).fill('Senha-nova-ficticia!');
  await passwordForm.getByLabel('Confirmar nova senha', { exact: true }).fill('Senha-nova-ficticia!');
  await noOverflow();
  await passwordForm.getByRole('button', { name: 'Salvar nova senha', exact: true }).click();
  await page.locator('#loginScreen:not(.hidden)').waitFor();
  assert.match(await page.locator('#loginError').innerText(), /Senha alterada/);
  assert.equal(await passwordForm.getByLabel('Nova senha', { exact: true }).inputValue(), '');
  await page.reload(); // Mock user remains signed in; real API session revocation is covered in account-password.test.mjs.
  await page.locator('html:not(.app-booting)').waitFor();
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await page.locator('#loginScreen:not(.hidden)').waitFor();
  assert.equal(await page.locator('#profileDocument').innerText(), 'Não informado');
  assert.equal(posts.filter(item => item.path === '/api/billing/checkout').length, 1);
  assert.deepEqual(errors, []);
  console.log('PASS: account navigation, profile edit/validation/reload/cancel/failure, password mismatch/current password/change/session cleanup, subscription flows, permissions, mobile keyboard, layout and logout.');
} finally {
  await browser.close();
}
