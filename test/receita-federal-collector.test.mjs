import test from "node:test";
import assert from "node:assert/strict";
import { collect } from "../collectors/receita-federal.collector.mjs";

const cnpj = "11222333000181";
const input = { tipoDocumento: "cnpj", documento: cnpj, retries: 0, timeoutMs: 100 };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });

test("cadastro inapto preserva QSA e regime tributario sem atestar debitos", async (t) => {
  t.mock.method(globalThis, "fetch", async () => json({
    cnpj, razao_social: "EMPRESA FICTICIA TESTE LTDA", descricao_situacao_cadastral: "INAPTA",
    capital_social: 15000, porte: "MICRO EMPRESA", natureza_juridica: "Sociedade Empresaria Limitada",
    data_inicio_atividade: "2020-01-02", data_situacao_cadastral: "2026-01-02",
    cnaes_secundarios: [{ codigo: 6201501, descricao: "Atividade ficticia" }],
    opcao_pelo_simples: false, opcao_pelo_mei: false,
    qsa: [{ nome_socio: "SOCIO FICTICIO", cnpj_cpf_do_socio: "***000000**",
      qualificacao_socio: "Socio-Administrador", data_entrada_sociedade: "2020-01-02", pais: "BRASIL" }],
  }));
  const result = await collect(input);
  assert.equal(result.status, "success");
  assert.equal(result.resultado, "indisponivel");
  assert.equal(result.dados.regularidadeFiscal, "nao_avaliada");
  assert.equal(result.dados.natureza, "consulta_cadastral_cnpj");
  assert.equal(result.dados.situacao, "INAPTA");
  assert.equal(result.dados.capitalSocial, 15000);
  assert.equal(result.dados.simplesNacional.optant, false);
  assert.equal(result.dados.mei.optant, false);
  assert.equal(result.dados.cnaesSecundarios.length, 1);
  assert.deepEqual(result.dados.qsa, [{ nome: "SOCIO FICTICIO", documento: "***000000**",
    qualificacao: "Socio-Administrador", dataEntrada: "2020-01-02", pais: "BRASIL" }]);
});

test("fallback Open CNPJa preserva QSA e atualizacao sem interpretar cadastro ativo como nada consta", async (t) => {
  const urls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    urls.push(url);
    if (new URL(url).hostname === "brasilapi.com.br") return json({ error: "Forbidden" }, 403);
    return json({
      taxId: cnpj, updated: "2026-09-01T00:00:00Z", founded: "2020-01-02", status: { text: "Ativa" },
      company: { name: "EMPRESA FICTICIA TESTE LTDA", equity: 0, size: { text: "Microempresa" },
        nature: { text: "Sociedade Empresaria Limitada" }, simples: { optant: true, since: "2020-01-02" },
        simei: { optant: false }, members: [{ since: "2020-01-02", role: { text: "Socio-Administrador" },
          person: { name: "SOCIO FICTICIO", taxId: "***000000**", country: { name: "Brasil" } } }] },
      mainActivity: { text: "Atividade principal ficticia" }, sideActivities: [{ id: 6201501, text: "Atividade ficticia" }],
      address: { city: "Cidade Ficticia", state: "SP" },
    });
  });
  const result = await collect(input);
  assert.equal(urls.length, 2);
  assert.equal(result.status, "success");
  assert.equal(result.resultado, "indisponivel");
  assert.equal(result.dados.fonte, "open.cnpja.com");
  assert.equal(result.dados.atualizadoEm, "2026-09-01T00:00:00Z");
  assert.equal(result.dados.capitalSocial, 0);
  assert.equal(result.dados.simplesNacional.optant, true);
  assert.equal(result.dados.mei.optant, false);
  assert.deepEqual(result.dados.qsa, [{ nome: "SOCIO FICTICIO", documento: "***000000**",
    qualificacao: "Socio-Administrador", dataEntrada: "2020-01-02", pais: "Brasil" }]);
  assert.match(result.dados.observacao, /nao comprova ausencia de debitos/);
});

test("resposta sem CNPJ ou de outra empresa nunca vira cadastro valido", async (t) => {
  for (const payload of [{}, { cnpj: "99999999000199", razao_social: "OUTRA EMPRESA FICTICIA" }]) {
    const fetchMock = t.mock.method(globalThis, "fetch", async () => json(payload));
    const result = await collect(input);
    assert.equal(result.status, "failed");
    assert.equal(result.resultado, "erro");
    assert.equal(fetchMock.mock.callCount(), 2);
    fetchMock.mock.restore();
  }
});

test("QSA e regime ausentes continuam desconhecidos, sem presumir socios ou adesao", async (t) => {
  t.mock.method(globalThis, "fetch", async () => json({ cnpj, razao_social: "EMPRESA FICTICIA TESTE LTDA" }));
  const result = await collect(input);
  assert.equal(result.status, "success");
  assert.equal(result.dados.qsa, null);
  assert.equal(result.dados.simplesNacional, null);
  assert.equal(result.dados.mei, null);
});

test("CPF sem empresa e CNPJ incompleto nao disparam consulta", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => assert.fail("Nao deveria consultar"));
  assert.equal((await collect({ tipoDocumento: "cpf", documento: "00000000000" })).status, "unavailable");
  assert.equal((await collect({ tipoDocumento: "cnpj", documento: "123" })).status, "unavailable");
  assert.equal(fetchMock.mock.callCount(), 0);
});
