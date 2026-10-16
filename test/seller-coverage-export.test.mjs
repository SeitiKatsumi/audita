import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

test('UF export counts only homologated courts for each subject and preserves legacy CPF evidence',()=>{
  const queries=Array.from({length:6},(_,i)=>['civil','criminal'].map(type=>({id:`trf${i+1}-${type}`,category:'Federal',label:type,kind:'certificate',endpoint:'TribunalRegionalFederal',params:{REGIAO:`TRF${i+1}`},documentTypes:['cpf','cnpj']}))).flat();
  const certificates=[
    {uf:'DF',type:'Legado CPF'},
    {uf:'DF',type:'Candidato ambos',documentTypes:['cpf','cnpj'],validatedDocumentTypes:[]},
    {uf:'DF',type:'Homologado só CPF',documentTypes:['cpf','cnpj'],validatedDocumentTypes:['cpf']},
    {uf:'DF',type:'Homologado só CNPJ',documentTypes:['cpf','cnpj'],validatedDocumentTypes:['cnpj']},
    {uf:'SP',type:'Candidato CNPJ',documentTypes:['cnpj'],validatedDocumentTypes:[]},
  ];
  const written=new Map(),source=readFileSync(new URL('../scripts/export-seller-uf-coverage.mjs',import.meta.url),'utf8');
  const fs={readFileSync:file=>JSON.stringify(path.basename(file)==='seller-document-coverage.json'?{queries,validatedAt:'fixture'}:{certificates}),writeFileSync:(file,data)=>written.set(path.basename(file),data),mkdirSync:()=>{}};
  vm.runInNewContext(source.replace(/^import .*;\r?$/gm,'').replaceAll('import.meta.url',JSON.stringify(import.meta.url)),{assert,fs,path,fileURLToPath,URL,console:{log:()=>{}}});
  const {records}=JSON.parse(written.get('summary.json')),df=records.find(r=>r.uf==='DF'),sp=records.find(r=>r.uf==='SP');
  assert.deepEqual(df.seller.filter(s=>s.category==='TJ').map(s=>s.label),['Legado CPF','Homologado só CPF']);
  assert.deepEqual(df.company.filter(s=>s.category==='TJ').map(s=>s.label),['Homologado só CNPJ']);
  assert.equal(df.official,4);assert.equal(df.company.length,4);
  assert.equal(sp.company.filter(s=>s.category==='TJ').length,0);assert.match(sp.limits,/CNPJ ainda sem emissão validada/);
  assert(!written.get('seller-uf-coverage.csv').includes('Candidato'));
});
