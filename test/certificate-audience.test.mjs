import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('audience link opens a native dialog without submitting or changing selection', async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
  assert.ok(html.indexOf('id="certificateAudienceOpen"')>html.indexOf('id="sellerAnalysisClearAll"'));
  assert.match(html, /id="certificateAudienceOpen" type="button"/);
  assert.match(html, /id="certificateAudienceDialog" aria-labelledby="certificateAudienceTitle"/);
  const markup=html.match(/<dialog[^>]*id="certificateAudienceDialog"[\s\S]*?<\/dialog>/)[0];
  assert.match(markup,/method="dialog"/);
  assert.match(markup,/não inclui análise por IA/);
  const events={};let focused=false,opened=0;
  const trigger={addEventListener:(event,fn)=>events[event]=fn,focus:()=>{focused=true;}};
  const dialog={open:false,showModal(){this.open=true;opened++;},addEventListener:(event,fn)=>events[event]=fn};
  const code=source.slice(source.indexOf('const certificateAudienceOpen ='),source.indexOf('for (const [id, checked] of [["sellerAnalysisSelectAll"'));
  vm.runInNewContext(code,{document:{querySelector:id=>id==='#certificateAudienceOpen'?trigger:dialog}});
  events.click();events.click();assert.equal(opened,1);
  events.close();assert.equal(focused,true);
});
