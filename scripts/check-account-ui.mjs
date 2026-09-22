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
  STRIPE_PRICE_CHAT_EXPERIMENT: 'price_experiment', STRIPE_PRICE_CHAT_ESSENTIAL: 'price_essential',
  STRIPE_PRICE_CHAT_PROFESSIONAL: 'price_professional', STRIPE_PRICE_CHAT_PREMIUM: 'price_premium',
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
    case '/api/chat/access':
      status = billingFailure ? 503 : 200;
      body = { access: { active: Boolean(subscription?.active), legacy: Boolean(subscription?.active),
        planId: subscription?.planId, periodEnd: subscription?.currentPeriodEnd, trialUsed: false } }; break;
    case '/api/billing/subscription':
      status = billingFailure ? 503 : 200;
      body = { subscription, canManage, access: { entitled: Boolean(subscription?.active) } }; break;
    case '/api/billing/checkout': body = { url: 'https://checkout.stripe.com/fixture' }; break;
    case '/api/billing/portal': body = { url: 'https://billing.stripe.com/fixture' }; break;
  }
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
});
const account = page.locator('#accountSubscription');
const waitOffer = () => account.locator('[data-plan="chat-professional"]').waitFor();
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
  await sidebar.getByRole('link', { name: 'Planos' }).click();
  await waitOffer();
  assert.equal(await page.locator('#pageTitle').innerText(), 'Planos');
  assert.equal(await page.getByRole('heading', { name: 'Assinaturas de IA', exact: true }).isVisible(), true);
  assert.equal(await page.getByRole('heading', { name: 'Assinaturas da Central de Serviços', exact: true }).isVisible(), true);
  assert.equal(await page.getByRole('link', { name: 'Ver Central de Serviços', exact: true }).getAttribute('href'), '#central-servicos');
  assert.equal(await page.locator('#editProfileButton').isVisible(), false);
  await sidebar.getByRole('link', { name: 'Meus Dados' }).click();
  await page.waitForFunction(() => document.body.dataset.activePage === 'meus-dados');
  assert.equal(await page.locator('#pageTitle').innerText(), 'Meus Dados');
  assert.equal(await account.isVisible(), false);
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
  assert.equal(await account.locator('[data-plan]').count(), 4);
  assert.equal(await account.locator('.chat-subscription-plans').innerHTML(),
    await page.locator('#chatSubscriptionDialog .chat-subscription-plans').innerHTML());
  assert.equal(await page.locator('#subscriptionCycle').count(), 0);
  await sidebar.getByRole('link', { name: 'Planos' }).click();
  await noOverflow();
  await mkdir(new URL('../output/account/', import.meta.url), { recursive: true });
  await account.screenshot({ path: fileURLToPath(new URL('../output/account/desktop.png', import.meta.url)) });
  await account.locator('[data-plan="chat-professional"]').click();
  await page.waitForURL('https://checkout.stripe.com/fixture');
  const purchase = posts.find(item => item.path === '/api/billing/checkout');
  assert.equal(purchase.data.kind, 'chat_subscription');
  assert.equal(purchase.data.planId, 'chat-professional');
  assert.equal(purchase.data.interval, 'monthly');
  subscription = { provider: 'stripe', planId: 'standard', interval: 'annual', status: 'active', active: true, currentPeriodEnd: '2027-09-22T12:00:00Z', cancelAtPeriodEnd: true };
  await page.goto(`${base}/planos?checkout=success`);
  await page.waitForURL(`${base}/?checkout=success#planos`);
  await page.locator('html:not(.app-booting)').waitFor();
  await waitOffer();
  await account.locator('[data-legacy]:not([hidden])').waitFor();
  assert.match(await account.locator('[data-legacy]').innerText(), /Standard.*Ativo/s);
  assert.match(await account.locator('[data-legacy]').innerText(), /advogado parceiro/);
  await account.getByRole('button', { name: 'Gerenciar assinatura', exact: true }).click();
  await page.waitForURL('https://billing.stripe.com/fixture');
  assert.deepEqual(posts.find(item => item.path === '/api/billing/portal').data, {});
  subscription = { ...subscription, status: 'past_due', active: false };
  await page.goto(`${base}/#planos`);
  await account.locator('[data-legacy]:not([hidden])').waitFor();
  assert.match(await account.locator('[data-legacy]').innerText(), /Pagamento pendente/);
  subscription = null;
  billingFailure = true;
  await page.reload();
  await account.locator('[data-notice]').filter({ hasText: 'concluir' }).waitFor();
  billingFailure = false;
  await account.getByRole('button', { name: 'Atualizar acesso' }).click();
  await page.waitForFunction(() => !document.querySelector('#accountSubscription [data-plan="chat-professional"]').disabled);
  canManage = false;
  user.role = 'member';
  await page.reload();
  await waitOffer();
  await page.waitForFunction(() => !document.querySelector('#accountSubscription [data-plan="chat-professional"]').disabled);

  canManage = true;
  user.role = 'owner';
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/#home`);
  await page.reload();
  await page.locator('html:not(.app-booting)').waitFor();
  await page.locator('.mobile-bottom-nav').getByRole('link', { name: 'Planos' }).click();
  await waitOffer();
  await account.getByRole('button', { name: 'Atualizar acesso' }).focus();
  await page.keyboard.press('Enter');
  assert.equal(await account.locator('[data-plan]').count(), 4);
  await noOverflow();
  await page.screenshot({ path: fileURLToPath(new URL('../output/account/mobile.png', import.meta.url)), fullPage: true });
  await page.locator('.mobile-bottom-nav').getByRole('link', { name: 'Meus Dados' }).click();
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
  await page.waitForURL(`${base}/#home`);
  await page.waitForFunction(() => document.querySelector('#profileDocument').textContent === 'Não informado');
  assert.equal(await page.locator('#profileDocument').innerText(), 'Não informado');
  assert.equal(posts.filter(item => item.path === '/api/billing/checkout').length, 1);
  assert.deepEqual(errors, []);
  console.log('PASS: account navigation, profile edit/validation/reload/cancel/failure, password mismatch/current password/change/session cleanup, subscription flows, permissions, mobile keyboard, layout and logout.');
} finally {
  await browser.close();
}
