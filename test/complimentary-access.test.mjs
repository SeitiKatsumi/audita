import test from 'node:test';
import assert from 'node:assert/strict';
import { hasUnlimitedAccess } from '../services/complimentary-access.mjs';
import { createCreditsService } from '../services/credits.service.mjs';
import { createBillingAccessService } from '../services/billing-access.service.mjs';
import { createStripeBillingService } from '../services/stripe-billing.service.mjs';

test('only authenticated active administrators get free services; demotion restores normal billing', async t => {
  const flag=process.env.AUDITA_CREDITS_ENABLED;
  process.env.AUDITA_CREDITS_ENABLED='true';
  t.after(()=>{if(flag===undefined)delete process.env.AUDITA_CREDITS_ENABLED;else process.env.AUDITA_CREDITS_ENABLED=flag;});
  const accessService=createBillingAccessService(),billing=createStripeBillingService({accessService}),credits=createCreditsService();
  for(const role of ['admin','super_admin']){
    const auth={tenantId:'981',user:{id:'981',email:'admin-fixture@example.test',role,status:'active'}};
    assert.equal(hasUnlimitedAccess(auth,{}),true);
    assert.equal((await accessService.getEntitlement(auth)).source,'complimentary');
    assert.equal((await billing.itauCaseAccessState(auth,['fixture'])).entitled,true);
    assert.equal((await billing.itauLawyerKitAccessState(auth)).entitled,true);
    assert.equal((await billing.itauLawyerKitAccessState(auth,'sp')).uf,'SP');
    assert.equal((await billing.itauLawyerKitAccessState(auth,'XX')).uf,'');
    assert.equal((await credits.consume(auth,{amount:100,referenceId:'admin-fixture',operation:'fixture'})).amount,0);
    for(const input of [{...auth,unauthorized:true},{...auth,tenantId:null},{...auth,user:{...auth.user,id:null}},...['disabled','suspended'].map(status=>({...auth,user:{...auth.user,status}}))])assert.equal(hasUnlimitedAccess(input,{}),false);
    auth.user.role='member';
    assert.equal((await accessService.getEntitlement(auth)).entitled,false);
    assert.equal((await credits.getWallet(auth)).enabled,true);
  }
  for(const role of ['owner','analyst','member','lawyer','manager'])assert.equal(hasUnlimitedAccess({tenantId:981,user:{id:981,role}},{}),false);
});

test('complimentary access is exact, authenticated, revocable and does not change roles or another wallet', async t => {
  const previous = process.env.AUDITA_UNLIMITED_ACCESS_EMAILS, creditsFlag = process.env.AUDITA_CREDITS_ENABLED;
  process.env.AUDITA_UNLIMITED_ACCESS_EMAILS = ' approved@example.test ';
  process.env.AUDITA_CREDITS_ENABLED = 'true';
  t.after(() => {
    for (const [key, value] of [['AUDITA_UNLIMITED_ACCESS_EMAILS', previous], ['AUDITA_CREDITS_ENABLED', creditsFlag]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const auth = {tenantId: '91', user: {id:'91',email:'Approved@example.test',role:'member'}};
  assert.equal(hasUnlimitedAccess(auth), true);
  for (const input of [null, {...auth,unauthorized:true}, {...auth,user:{...auth.user,status:'disabled'}}, {...auth,user:{id:'92',email:'approved@example.test.evil'}}, {...auth,user:{id:'92',email:'other@example.test'}}]) assert.equal(hasUnlimitedAccess(input), false);
  const credits = createCreditsService();
  assert.equal((await credits.getWallet(auth)).enabled, false);
  assert.equal((await credits.consume(auth,{amount:10,referenceId:'one',operation:'test'})).state, 'complimentary');
  assert.equal((await credits.getWallet({...auth,user:{id:'92',email:'other@example.test'}})).enabled, true);
  const accessService = createBillingAccessService();
  const billing = createStripeBillingService({accessService});
  assert.equal((await accessService.getEntitlement(auth)).unlimited, true);
  assert.equal((await billing.itauCaseAccessState(auth, ['fictional'])).entitled, true);
  assert.equal((await billing.itauLawyerKitAccessState(auth)).entitled, true);
  assert.equal(auth.user.role, 'member');
  delete process.env.AUDITA_UNLIMITED_ACCESS_EMAILS;
  assert.equal((await credits.getWallet(auth)).enabled, true);
  assert.equal((await billing.itauCaseAccessState(auth, ['fictional'])).entitled, false);
});
