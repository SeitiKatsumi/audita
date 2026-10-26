import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeReportProcesses,processMoneyCents} from '../services/seller-process-summary.mjs';
import {sellerReportPdf} from '../services/seller-review-pdf.mjs';
import {extractPdfText} from '../services/pdf.service.mjs';
const doc='52998224725';
const record=(n,role,value,uf='SP')=>({numeroProcesso:String(n).padStart(20,'0'),uf,valorCausa:value,partes:[{documento:doc,posicaoProcessual:role}]});
async function summary(records){return summarizeReportProcesses([{title:'Consulta nacional',details:{'Total de processos':'100'},processCollection:{auditId:'fixture',reportedTotal:100,total:records.length,batches:[{count:records.length}]}}],{readBatch:async()=>({documentoConsultado:doc,processos:records})});}
test('separate sums deduplicate proceedings and exclude contradictory amounts, lawyers and missing evidence',async()=>{
 const rows=[record(1,'Executada','1.234,56'),record(1,'Réu','1.234,56'),record(2,'Exequente',200,'RJ'),record(3,'Advogado',999),record(4,'Réu',10),record(4,'Réu',20),record(5,'Réu',null),record(6,'Autor',0,'DF')];
 const result=await summary(rows);
 assert.equal(result.total,6);assert.deepEqual(result.defendant,{cents:123456,count:1});assert.deepEqual(result.claimant,{cents:20000,count:2});assert.equal(result.excluded,3);
 assert.deepEqual(result.byState,{SP:4,RJ:1,DF:1});assert.equal(result.totals[0].total,100);
 assert.equal(processMoneyCents('R$ 0,00'),0);assert.equal(processMoneyCents('1.234.567,89'),123456789);assert.equal(processMoneyCents('R$ 2 milhões'),null);
});
test('foreign subject, restricted records and failed authorization never enter the totals',async()=>{
 const src={title:'Dados',subject:{document:'company'},processCollection:{auditId:'x',total:5,batches:[]}};
 let reads=0;const result=await summarizeReportProcesses([src,{...src,subject:null}],{authorize:async()=>{throw Error('denied');},readBatch:async()=>{reads++;}});
 assert.equal(reads,0);assert.equal(result.unavailable,5);assert.equal(result.total,0);
 const r=await summary([{segredoJustica:true},record(1,'Réu',100,'XX'),{numeroProcesso:'sem numero'}]);assert.equal(r.restricted,1);assert.equal(r.withoutNumber,1);assert.equal(r.unknownState,1);
});
test('PDF includes source counts, state distribution and two distinct final subtotals',async()=>{
 const processSummary=await summary([record(1,'Réu','1.234,56'),record(2,'Exequente',200,'RJ')]);
 const report={id:'fixture',title:'Análise das certidões',purpose:'Conferência documental fictícia',subject:{name:'Titular Fictício',document:'***'},generatedAt:'2026-10-26T12:00:00Z',findings:[],analyzed:1,total:1,scopeNotice:'Dados fictícios.',processSummary};
 const pdf=await sellerReportPdf(report),text=await extractPdfText(pdf);
 for(const fragment of ['Como réu / polo passivo','Como autor / exequente','1.234,56','200,00','SP: 1','RJ: 1','100 processos'])assert.ok(text.includes(fragment),fragment);
});
