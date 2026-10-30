import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateRecoveryForm } from '../charge-analysis.js';

function formFixture() {
  const node = () => ({ children: [], addEventListener() {}, appendChild(child) { this.children.push(child); }, replaceChildren() { this.children = []; } });
  const sections = [0, 1, 2].map(index => ({ hidden: index !== 0, dataset: { recoveryStep: String(index) }, querySelector: () => ({ focus() {} }) }));
  const fields = [];
  for (const [name, step, type] of [['fullName',0], ['nationality',0], ['maritalStatus',0], ['email',0,'email'], ['identityDocument',2,'file'], ['proofOfResidence',2,'file'], ['powerOfAttorneyAccepted',2,'checkbox'], ['powerOfAttorneySignerName',2]]) {
    const attributes = {};
    const label = node(); label.querySelector = () => ({ textContent: name });
    const field = { name, type: type || 'text', value: type === 'email' ? 'cliente@example.test' : 'Cliente Teste', files: [], required: true, checked: true,
      validity: { valid: true }, closest: selector => selector === 'label' ? label : sections[step],
      setAttribute: (key,value) => { attributes[key] = value; }, getAttribute: key => attributes[key] || null,
      removeAttribute: key => { delete attributes[key]; }, focus() { form.focused = name; } };
    fields.push(field);
  }
  const elements = Object.fromEntries(fields.map(field => [field.name,field]));
  elements.namedItem = name => elements[name];
  const nodes = Object.fromEntries(['[data-recovery-errors]','[data-recovery-step-status]','[data-recovery-previous]','[data-recovery-next]','[data-recovery-submit]'].map(key => [key,node()]));
  const form = { elements, dataset: {}, querySelectorAll: selector => selector === '[data-recovery-step]' ? sections : fields, querySelector: selector => nodes[selector] || null };
  return { form, elements, sections, node };
}

test('missing nationality and marital status identify both fields and focus the first without clearing input', () => {
  const {form,elements,node} = formFixture();
  const previous = globalThis.document;
  globalThis.document = { createElement: node };
  try {
    for (const name of ['nationality','maritalStatus']) { elements[name].value = ''; elements[name].validity = { valueMissing: true, valid: false }; }
    assert.equal(validateRecoveryForm(form, false), false);
    for (const name of ['nationality','maritalStatus']) assert.equal(elements[name].getAttribute('aria-invalid'), 'true');
    assert.equal(form.focused, 'nationality');
    assert.equal(form.dataset.step, '0');
    assert.equal(elements.fullName.value, 'Cliente Teste');
    assert.equal(form.querySelector('[data-recovery-errors]').hidden, false);
    elements.nationality.value = 'Brasileiro(a)'; elements.nationality.validity = {valid:true};
    validateRecoveryForm(form, false, false);
    assert.equal(elements.nationality.getAttribute('aria-invalid'), null);
    assert.equal(form.focused, 'nationality', 'typing must not steal focus');
  } finally { globalThis.document = previous; }
});

test('email, attachments and signing errors are field-specific; hidden steps are checked on final submit', () => {
  const {form,elements,sections,node} = formFixture();
  const previous = globalThis.document;
  globalThis.document = { createElement: node };
  try {
    elements.email.validity = { typeMismatch:true, valid:false };
    elements.identityDocument.validity = { valueMissing:true, valid:false };
    elements.proofOfResidence.files = [{size:13 * 1024 * 1024}];
    elements.powerOfAttorneyAccepted.checked = false;
    elements.powerOfAttorneySignerName.value = 'Outro Nome';
    sections[0].hidden = true; sections[2].hidden = false;
    assert.equal(validateRecoveryForm(form), false);
    for (const name of ['email','identityDocument','proofOfResidence','powerOfAttorneyAccepted','powerOfAttorneySignerName']) assert.equal(elements[name].getAttribute('aria-invalid'), 'true', name);
    assert.equal(form.focused, 'email');
    assert.equal(sections[0].hidden, false);
  } finally { globalThis.document = previous; }
});

test('draft capture keeps entered data and the first attachment when the second is missing', () => {
  const source = readFileSync(new URL('../charge-analysis.js', import.meta.url), 'utf8');
  const captureSource = source.slice(source.indexOf('  function captureRecoveryDraft(form)'),source.indexOf('  async function prepareRecoveryReport(form)'));
  const state = { recovery: { attachments: { proofOfResidence: {size:10,name:'already-selected.pdf'} } } };
  const capture = new Function('state','readRecoveryClaimant','normalizeRecoveryText',`${captureSource};return captureRecoveryDraft;`)(state, () => ({fullName:'Cliente Teste'}),value=>value?.trim()||'');
  const file = { size: 10, name: 'identidade.pdf' };
  capture({dataset:{step:'2'},elements:{ identityDocument:{files:[file]},proofOfResidence:{files:[]}, powerOfAttorneyAccepted:{checked:true},powerOfAttorneySignerName:{value:' Cliente Teste '} }});
  assert.equal(state.recovery.claimant.fullName, 'Cliente Teste');
  assert.equal(state.recovery.attachments.identityDocument, file);
  assert.equal(state.recovery.attachments.proofOfResidence.name, 'already-selected.pdf');
  assert.equal(state.recovery.formStep, 2);
  assert.equal(state.recovery.powerOfAttorneyAcceptance.signerName, 'Cliente Teste');
});

 test('step one blocks an email without a domain suffix even when native email validity accepts it', () => {
  const {form,elements,node} = formFixture();
  const previous = globalThis.document;
  globalThis.document = { createElement: node };
  try {
    elements.email.value = 'cliente@example';
    elements.email.validity = { valid: true };
    const attachment = { name: 'identidade.pdf', size: 10 };
    elements.identityDocument.files = [attachment];
    assert.equal(validateRecoveryForm(form, false), false);
    assert.equal(elements.email.getAttribute('aria-invalid'), 'true');
    assert.equal(form.focused, 'email');
    assert.equal(form.dataset.step, '0');
    assert.equal(elements.fullName.value, 'Cliente Teste');
    assert.equal(elements.identityDocument.files[0], attachment);
    elements.email.value = 'cliente@example.com.br';
    assert.equal(validateRecoveryForm(form, false), true);
    assert.equal(elements.email.getAttribute('aria-invalid'), null);
  } finally { globalThis.document = previous; }
});
