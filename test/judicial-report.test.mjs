import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {calculateJudicialReport,decimalUnits} from '../services/judicial-report.mjs';
import {judicialReportPdf} from '../services/judicial-report-pdf.mjs';
import {createJudicialReportHandler} from '../services/judicial-report-api.mjs';
import {parseDecisionFields} from '../judicial-report.js';
export const fixture={process:'0000000-00.2026.0.00.0000',court:'Vara Cível - Comarca fictícia',subject:'Execução - exemplo fictício',claimant:'Credor de teste',defendant:'Devedor de teste',decision:'Decisão fictícia de homologação. Dados exclusivos para teste.',principal:'10000.00',homologationDate:'2026-01-01',asOf:'2026-01-31',interestStart:'2026-01-01',index:'Índice acumulado informado pelo solicitante, fonte de teste',correction:'5',interest:'1',fees:'10',interestBase:'corrected'};
test('judicial calculation uses decimal cents and adds rounded components',()=>{
 const r=calculateJudicialReport(fixture);
 assert.equal(r.days,30);assert.equal(r.correction,50000);assert.equal(r.corrected,1050000);assert.equal(r.interest,10500);assert.equal(r.subtotal,1060500);assert.equal(r.fees,106050);assert.equal(r.total,1166550);
 assert.equal(calculateJudicialReport({...fixture,interestBase:'original'}).interest,10000);
 assert.equal(decimalUnits('1,2350',4,'taxa',0,100000),12350);
});
test('missing rates, invalid dates, negative fees and locale ambiguity are rejected',()=>{
 for(const change of [{asOf:'2025-01-01'},{asOf:'2026-02-30'},{principal:'1.000,00'},{fees:'-1'},{interestBase:'compound'},{court:'x'.repeat(251)}])assert.throws(()=>calculateJudicialReport({...fixture,...change}),{status:400});
 const r=calculateJudicialReport({...fixture,asOf:'2026-01-01',correction:'0',interest:'0',fees:'0'});assert.equal(r.total,r.data.principal);assert.equal(r.days,0);
 assert.equal(calculateJudicialReport({...fixture,correction:'-1'}).correction,-10000);
});
test('decision extraction only accepts allowed scalar fields without assuming rates',()=>{
 const r=parseDecisionFields('{"process":"teste","principal":"123,45","fees":null,"interest":{"injected":true},"extra":"ignore","interestBase":"compound"}');
 assert.deepEqual(r,{process:'teste',principal:'123.45'});assert.throws(()=>parseDecisionFields('not json'));
});
test('basic fields alone generate PDF without invented totals; partial optional fields are retained',async()=>{
 const basic=Object.fromEntries(Object.entries(fixture).filter(([key])=>['process','court','subject','claimant','defendant','decision','principal','homologationDate'].includes(key)));
 const result=calculateJudicialReport(basic);
 assert.equal(result.calculated,false);assert.equal(result.total,undefined);assert.equal(result.data.principal,1000000);
 const partial=calculateJudicialReport({...basic,fees:'10'});assert.equal(partial.data.optional.fees,'10');assert.equal(partial.total,undefined);
 assert.throws(()=>calculateJudicialReport({...basic,fees:'invalid'}));
 const bytes=await judicialReportPdf(result);assert.equal((await PDFDocument.load(bytes)).getPageCount(),1);
 if(process.env.AUDITA_BASIC_SAMPLE){const {writeFile}=await import('node:fs/promises');await writeFile(process.env.AUDITA_BASIC_SAMPLE,bytes);}
});
test('PDF renders multiple pages and can be reopened, including long fields',async()=>{
 const bytes=await judicialReportPdf(calculateJudicialReport(fixture));assert.equal(bytes.subarray(0,4).toString(),'%PDF');assert.equal((await PDFDocument.load(bytes)).getPageCount(),2);
 const long=await judicialReportPdf(calculateJudicialReport({...fixture,decision:'Texto para conferência. '.repeat(60)}));assert.ok((await PDFDocument.load(long)).getPageCount()>=2);
 if(process.env.AUDITA_REPORT_SAMPLE){const {writeFile}=await import('node:fs/promises');await writeFile(process.env.AUDITA_REPORT_SAMPLE,bytes);}
});
async function call({auth={user:{id:'test'}},body={data:fixture},path='/api/judicial-report/preview',headers={host:'localhost:3000',origin:'http://localhost:3000'},method='POST'}={}){
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(code,h){this.code=code;Object.assign(this.headers,h)},end(bytes){this.bytes=bytes;}};
 const handler=createJudicialReportHandler({getAuth:async()=>auth,readJson:async()=>body,sendJson:(r,code,data)=>{r.code=code;r.data=data;}});
 await handler({method,headers},res,new URL(path,'http://localhost:3000'));return res;
}
test('report API rejects anonymous, cross origin, unconfirmed and malformed input',async()=>{
 assert.equal((await call({auth:{unauthorized:true}})).code,401);
 assert.equal((await call({headers:{host:'localhost:3000',origin:'https://evil.test'}})).code,403);
 assert.equal((await call({path:'/api/judicial-report/pdf'})).code,400);
 assert.equal((await call({body:{data:{}}})).code,400);
 assert.equal((await call({method:'GET'})).code,405);
});
test('report API preview and confirmed download share the same calculation',async()=>{
 const preview=await call();assert.equal(preview.code,200);assert.equal(preview.data.total,1166550);assert.equal(preview.headers['cache-control'],'no-store');
 const pdf=await call({path:'/api/judicial-report/pdf',body:{data:fixture,confirmed:true}});assert.equal(pdf.code,200);assert.equal(pdf.headers['content-type'],'application/pdf');assert.equal(pdf.bytes.subarray(0,4).toString(),'%PDF');
});
