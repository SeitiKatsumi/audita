import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/seller-document-coverage.json"), "utf8"));
const courts = JSON.parse(fs.readFileSync(path.join(root, "data/state-court-autonomous.json"), "utf8"));
const states = Object.fromEntries("AC:Acre|AL:Alagoas|AM:Amazonas|AP:Amapá|BA:Bahia|CE:Ceará|DF:Distrito Federal|ES:Espírito Santo|GO:Goiás|MA:Maranhão|MG:Minas Gerais|MS:Mato Grosso do Sul|MT:Mato Grosso|PA:Pará|PB:Paraíba|PE:Pernambuco|PI:Piauí|PR:Paraná|RJ:Rio de Janeiro|RN:Rio Grande do Norte|RO:Rondônia|RR:Roraima|RS:Rio Grande do Sul|SC:Santa Catarina|SE:Sergipe|SP:São Paulo|TO:Tocantins".split("|").map(x => x.split(":")));
// Jurisdiction: CNJ Justiça em Números 2025. Availability comes only from the validated catalogs.
const trfs = { TRF1: "AC AP AM BA DF GO MA MT PA PI RO RR TO", TRF2: "ES RJ", TRF3: "MS SP", TRF4: "PR RS SC", TRF5: "AL CE PB PE RN SE", TRF6: "MG" };
const trts = { 1: "RJ", 2: "SP", 3: "MG", 4: "RS", 5: "BA", 6: "PE", 7: "CE", 8: "PA AP", 9: "PR", 10: "DF TO", 11: "AM RR", 12: "SC", 13: "PB", 14: "RO AC", 15: "SP", 16: "MA", 17: "ES", 18: "GO", 19: "AL", 20: "SE", 21: "RN", 22: "PI", 23: "MT", 24: "MS" };
const inRegion = (mapping, region, uf) => (mapping[region] || "").split(" ").includes(uf);
function serves(item, uf) {
  if (item.endpoint === "TribunalRegionalFederal") return inRegion(trfs, item.params.REGIAO, uf);
  if (item.endpoint === "TribunalRegionalTrabalho") return inRegion(trts, item.params.REGIAO, uf);
  if (item.scope === "Brasil") return true;
  return item.scope === uf || item.params?.UF === uf || item.params?.MUNICIPIO?.endsWith(`-${uf}`);
}
const hasPdf = item => item.kind === "certificate" || item.includePdf === true;
function list(items) {
  const groups = new Map();
  for (const item of items) groups.set(item.category, [...(groups.get(item.category) || []), item]);
  return [...groups].map(([category, values]) => `${category}: ${values.map(item => item.label.replace(/ — empresa$/, "")).join("; ")}`).join("\n");
}
const headers = ["UF", "Estado", "Total CPF", "Certidões CPF", "Comprovantes CPF", "Dados sem PDF CPF", "Total por CNPJ", "Documentos e consultas do vendedor (CPF)", "Documentos e consultas por empresa (CNPJ)", "Limites e pendências", "Validação", "Integração", "Fontes"];
const records = Object.entries(states).map(([uf, name]) => {
  const selected = catalog.queries.filter(item => serves(item, uf));
  const pf = selected.filter(item => item.documentTypes.includes("cpf"));
  const pj = selected.filter(item => item.documentTypes.includes("cnpj"));
  const tj = courts.certificates.filter(item => item.uf === uf).map((item, index) => ({ id: `tj-${uf}-${index}`, category: "TJ", label: item.type, kind: "certificate" }));
  const company = [...pj, { id: "public-company-qsa", category: "Cadastro", label: "CNPJ e QSA (consulta gratuita)", kind: "data" }];
  const seller = [...tj, ...pf];
  assert.equal(new Set(seller.map(x => x.id)).size, seller.length);
  assert.equal(new Set(company.map(x => x.id)).size, company.length);
  assert.equal(pf.filter(x => x.endpoint === "TribunalRegionalFederal").length, 2);
  assert.equal(pj.filter(x => x.endpoint === "TribunalRegionalFederal").length, 2);
  const limits = [];
  if (!tj.length) limits.push("TJ estadual ainda sem emissão validada.");
  if (uf === "RR") limits.push("TJ sem cível comum; há criminal, militar e falências.");
  if (uf === "RS") limits.push("TJ limitado ao alvará de folha corrida.");
  if (!pf.some(x => x.endpoint === "CertidaoNegativaDebitos" || x.provider === "portal")) limits.push("Certidão fiscal estadual CPF pendente.");
  if (!pf.some(x => x.endpoint === "TribunalRegionalTrabalho")) limits.push("Certidão TRT pendente.");
  const towns = selected.filter(x => x.endpoint === "CertidaoNegativaDebitosMunicipal").map(x => `${x.scope} (${x.documentTypes.join("/").toUpperCase()})`);
  if (towns.length) limits.push(`Municipais somente: ${towns.join(", ")}. Não representam todos os municípios nem quitação do imóvel.`);
  const special = { AC: "Fiscal exclui dívida ativa.", GO: "Fiscal estadual cobre dívida ativa.", TO: "Fiscal estadual cobre dívida ativa.", SP: "Fiscal CPF cobre débitos não inscritos; PGE e fiscal estadual CNPJ pendentes. TRT2 e TRT15 atendem áreas diferentes.", RJ: "Fiscal SEFAZ exige complemento PGE.", PE: "Fiscal oficial somente CPF; exclui exigibilidade suspensa. Falência estadual pendente.", AP: "Falência estadual pendente.", MG: "TRF6 não cobre todos os sistemas; conferir eproc e acervo residual TRF1." };
  if (special[uf]) limits.push(special[uf]);
  limits.push("RFB/PGFN e documentos do imóvel pendentes. Quantidade não significa cobertura jurídica completa.");
  const official = seller.filter(x => x.kind === "certificate").length;
  const receipt = seller.filter(x => x.kind !== "certificate" && x.includePdf === true).length;
  const data = seller.filter(x => !hasPdf(x)).length;
  assert.equal(official + receipt + data, seller.length);
  return { uf, name, seller, company, official, receipt, data, limits: limits.join(" ") };
}).sort((a, b) => b.seller.length - a.seller.length || a.uf.localeCompare(b.uf));

assert.equal(records.length, 27);
const rows = records.map((r, index) => [r.uf, r.name, `=SUM(D${index + 2}:F${index + 2})`, r.official, r.receipt, r.data, r.company.length, list(r.seller), list(r.company), r.limits, catalog.validatedAt, "Integrado localmente; produção pendente", "https://docs.google.com/spreadsheets/d/1myQG7FETZWMqPXPcaDNkYYPEWU3KJRRkX0QketehcnY/edit?gid=1989173279#gid=1989173279"]);
const notes = [
  ["Critério", "Uma opção validada conta uma vez por UF e por perfil. Nacionais aparecem em todas as 27 UFs. CPF e CNPJ são consultados separadamente."],
  ["Regionais", "TRFs contam somente nas UFs de sua região; TRT2 e TRT15 contam em SP. TRT22 físico/eletrônico conta uma única vez."],
  ["Municipais", "Total inclui produtos dos municípios nomeados na linha. Para um vendedor específico, selecionar apenas municípios e jurisdições aplicáveis."],
  ["Tipos", "Certidões e comprovantes têm PDF. Dados sem PDF são consultas estruturadas. Processos agrupados/completos são dois produtos e podem trazer dados sobrepostos."],
  ["CNPJ", "Total por empresa inclui CNDT, FGTS, dois documentos do TRF, cadastro/QSA gratuito e opções fiscais/municipais validadas na UF."],
  ["Totais", "Não somar as UFs para obter produtos únicos nacionais: a repetição por cobertura é intencional. As quantidades não indicam completude da análise jurídica."],
  ["Jurisdição", "https://www.cnj.jus.br/wp-content/uploads/2025/11/justica-em-numeros-2025.pdf"],
  ["Trabalhista", "https://www.cnj.jus.br/tribunais/"]
];
const matrix = [headers, ...rows, [], ...notes];
const csv = matrix.map(row => Array.from({ length: headers.length }, (_, i) => `"${String(row[i] ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
fs.writeFileSync(path.join(root, "docs/seller-uf-coverage.csv"), `\uFEFF${csv}\r\n`);
fs.mkdirSync(path.join(root, "output/uf-coverage"), { recursive: true });
fs.writeFileSync(path.join(root, "output/uf-coverage/summary.json"), JSON.stringify({ matrix, records }, null, 2));
console.log(records.map(r => `${r.uf}: CPF ${r.seller.length} (${r.official} certidões + ${r.receipt} comprovantes + ${r.data} dados); CNPJ ${r.company.length}`).join("\n"));
