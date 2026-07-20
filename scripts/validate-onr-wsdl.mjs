import { XMLParser } from "fast-xml-parser";

const CONTRACTS = Object.freeze({
  login: {
    url: "https://hml3-ws.onr.org.br/logincliente.asmx?wsdl",
    operations: ["LoginClienteConvenio"],
  },
  states: {
    url: "https://hml3-ws.onr.org.br/estados.asmx?wsdl",
    operations: ["EstadosListar"],
  },
  registryOffices: {
    url: "https://hml3-ws.onr.org.br/cartorios.asmx?wsdl",
    operations: ["CartoriosListar"],
  },
  priorSearch: {
    url: "https://hml3-ws.onr.org.br/pesquisaprevia.asmx?wsdl",
    operations: ["ConsultaPesquisaPrevia_v4"],
  },
  electronicSearch: {
    url: "https://hml3-ws.onr.org.br/consultaeletronica.asmx?wsdl",
    operations: ["ConsultaPreviaCE_v3", "FinalizarCE", "ListarConfirmacoesCE"],
  },
  certificates: {
    url: "https://hml3-ws.onr.org.br/certidoes.asmx?wsdl",
    operations: ["RegistrarSolicitacaoMatricula_v5", "VerificarRespostaSolicitacao_v4"],
  },
  credits: {
    url: "https://hml3-ws.onr.org.br/creditos.asmx?wsdl",
    operations: ["ObterSaldo"],
  },
});

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
});

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

async function readContract(name, contract) {
  const response = await fetch(contract.url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${name}: WSDL retornou HTTP ${response.status}`);
  const document = parser.parse(await response.text());
  const definitions = document?.definitions;
  if (!definitions) throw new Error(`${name}: XML nao contem definitions`);
  const operations = asArray(definitions.portType)
    .flatMap((portType) => asArray(portType?.operation))
    .map((operation) => String(operation?.["@_name"] || ""))
    .filter(Boolean);
  const missing = contract.operations.filter((operation) => !operations.includes(operation));
  if (missing.length) throw new Error(`${name}: operacoes ausentes: ${missing.join(", ")}`);
  return { name, status: response.status, operations: contract.operations };
}

const results = [];
for (const [name, contract] of Object.entries(CONTRACTS)) {
  results.push(await readContract(name, contract));
}

for (const result of results) {
  console.log(`OK ${result.name}: HTTP ${result.status} - ${result.operations.join(", ")}`);
}
console.log(`Contratos ONR validados: ${results.length}/${Object.keys(CONTRACTS).length}`);
