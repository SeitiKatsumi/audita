import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('activated test access authorizes saved certificate analysis but never paid collection benefits', async () => {
  const code = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  let enabled = true, granted = true;
  const auth = {user:{id:1},tenantId:1};
  const context = vm.createContext({chatAccessService:{getAccess:async (owner, options = {}) => {
    const active = enabled && granted && owner.user.id === 1 && owner.tenantId === 1 && options.includeTestAccess !== false;
    return {source:active?'test':'none',allowed:active,active,testBypassAvailable:enabled};
  }}});
  vm.runInContext(code.slice(code.indexOf('async function certificateBenefits('), code.indexOf('const chatDocumentsService =')),context);
  assert.equal(await context.certificateAnalysisAccess(auth),true);
  const benefits = await context.certificateBenefits(auth);
  assert.equal(benefits.subscriber,false);
  assert.equal(benefits.complimentary,false);
  assert.equal(await context.certificateAnalysisAccess({user:{id:2},tenantId:1}),false);
  assert.equal(await context.certificateAnalysisAccess({user:{id:1},tenantId:2}),false);
  assert.equal(await context.certificateAnalysisAccess({unauthorized:true}),false);
  granted=false;
  assert.equal(await context.certificateAnalysisAccess(auth),false);
  granted=true;enabled=false;
  assert.equal(await context.certificateAnalysisAccess(auth),false);
  assert.match(code,/getAnalysisAccess: auth => certificateAnalysisAccess\(auth\)/);
});
