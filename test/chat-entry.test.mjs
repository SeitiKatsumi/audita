import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

test('entering AI starts blank while history selection survives renders', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const extract = (name, next) => source.slice(source.indexOf(`function ${name}(`), source.indexOf(`function ${next}(`));
  const old = { id: 'old', messages: [{ role: 'user', content: 'Histórico' }] };
  const context = vm.createContext({
    chatState: { currentThreadId: 'old', threads: [old] },
    pageMeta: { chat: {}, home: {} }, document: { body: { dataset: {} }, dispatchEvent() {}, querySelector() { return null; } },
    pageTitle: {}, pageEyebrow: {}, pageBlocks: [], operationsPages: null, navGroups: [], navLinks: [],
    applyAuditRouteDefaults() {}, setMobileMenu() {}, renderChatWorkspace() {},
    requestAnimationFrame() {}, CustomEvent: class {}, chatInput: { focus() {} },
    createChatThread: () => ({ id: 'new', messages: [] }), saveChatState() {}, setChatError() {},
    initializeChatEntryContext() {}, currentAuthState: { authRequired: false, user: null },
  });
  vm.runInContext(extract('setActivePage', 'finishAppBoot') + extract('startNewChat', 'resizeChatInput'), context);
  vm.runInContext('setActivePage("chat")', context);
  assert.equal(context.chatState.currentThreadId, 'new');
  assert.equal(context.chatState.threads.find(t => t.id === 'new').messages.length, 0);
  assert.equal(context.chatState.threads.find(t => t.id === 'old'), old);
  context.chatState.currentThreadId = 'old';
  vm.runInContext('setActivePage("chat")', context);
  assert.equal(context.chatState.currentThreadId, 'old');
  vm.runInContext('setActivePage("home"); setActivePage("chat")', context);
  assert.equal(context.chatState.currentThreadId, 'new');
  assert.equal(context.chatState.threads.length, 2);
});
