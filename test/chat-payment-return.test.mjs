import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const js = await readFile(new URL('../chat-subscription.js', import.meta.url), 'utf8');
function fixture() {
  let next = { active: true, test: true }, fail = false, queued = null, reads = 0;
  const context = {
    destroyed: false, owner: 'one', revision: 0, loading: null, loaded: false,
    checkoutReturn: 'success', confirmationTimer: null, confirmationAttempts: 0,
    catalog: null, access: null, billing: null, notice: { textContent: '' },
    PLANS: [{ id: 'chat-essential' }], document: { hidden: false },
    userId: () => 'one', onAuthChanged: () => { throw Error('unexpected owner'); }, render() {},
    clearTimeout() { queued = null; }, setTimeout(fn) { queued = fn; return 1; },
    request: async url => {
      if (fail) throw Error('Temporariamente indisponível');
      if (url === '/api/chat/access') { reads++; return { access: next }; }
      return {};
    },
  };
  runInNewContext(js.slice(js.indexOf('  async function refresh()'), js.indexOf('  function open()')) + '\nthis.refresh = refresh;', context);
  return { context, setAccess: value => next = value, setFailure: value => fail = value,
    pending: () => Boolean(queued), reads: () => reads,
    tick: async () => { assert.ok(queued); queued(); await context.loading; } };
}

test('return automatically waits for paid access, never confirms a free test, and stops when confirmed', async () => {
  const f = fixture();
  await f.context.refresh();
  assert.match(f.context.notice.textContent, /Aguardando/);
  assert.ok(f.pending());
  f.setFailure(true);
  await f.tick();
  assert.ok(f.pending(), 'temporary API failure is retried');
  f.setFailure(false);
  f.setAccess({ active: true, planId: 'chat-essential', test: false });
  await f.tick();
  assert.match(f.context.notice.textContent, /Plano ativo confirmado/);
  assert.equal(f.pending(), false);
  assert.equal(f.context.checkoutReturn, null);
});

test('pending confirmation is bounded; manual refresh can still discover delayed payment', async () => {
  const f = fixture();
  await f.context.refresh();
  for (let i = 0; i < 24; i++) await f.tick();
  assert.equal(f.pending(), false);
  assert.match(f.context.notice.textContent, /Não refaça a compra/);
  f.setAccess({ active: true, planId: 'chat-essential' });
  await f.context.refresh();
  assert.match(f.context.notice.textContent, /Plano ativo confirmado/);
});

test('cancelled, unrelated, logged-out and destroyed returns do not poll', async () => {
  for (const status of ['cancelled', null]) {
    const f = fixture(); f.context.checkoutReturn = status;
    await f.context.refresh(); assert.equal(f.pending(), false);
    if (status) assert.match(f.context.notice.textContent, /não concluído/);
  }
  const f = fixture(); f.context.owner = ''; f.context.userId = () => '';
  await f.context.refresh(); assert.equal(f.pending(), false);
  assert.equal(f.reads(), 0);
  assert.match(f.context.notice.textContent, /Entre na conta/);
  f.context.destroyed = true;
  await f.context.refresh(); assert.equal(f.pending(), false);
});

test('only the chat-specific return parameter opens confirmation; cleanup cancels timers', () => {
  assert.match(js, /get\("chat_checkout"\)/);
  assert.doesNotMatch(js, /get\("checkout"\)/);
  assert.match(js, /if \(checkoutReturn\) open\(\)/);
  assert.match(js, /destroy\(\) \{ destroyed = true; clearTimeout\(confirmationTimer\)/);
  assert.match(js, /if \(previous\) checkoutReturn = null/);
});
