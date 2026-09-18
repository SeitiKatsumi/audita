import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('local shared database can disable all background jobs without disabling defaults', async () => {
 const source=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 for(const enabled of ['false',undefined]) {
  const callbacks=[];let calls=0;
  const context={process:{env:{AUDITA_BACKGROUND_JOBS_ENABLED:enabled,AUDITA_ENERGY_ENABLED:'true'}},setInterval(fn){callbacks.push(fn);return {unref(){}};},server:{on(){},listen(){}},port:3000,host:'localhost',dbReady:true,pool:{},console,irExemptionService:{async runJobs(){calls++;}},energyService:{async runJobs(){calls++;}},async refreshReferences(){calls++;}};
  vm.runInNewContext(source.slice(source.indexOf('let irJobRunning = false;')),context);
  for(const callback of callbacks) await callback();
  assert.equal(calls,enabled==='false'?0:3);
 }
});
