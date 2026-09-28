import test from "node:test";
import assert from "node:assert/strict";
import { collectPeFiscalCertificate } from "../services/pe-fiscal-certificate.service.mjs";

const DOCUMENT = "52998224725";
const ENDPOINT = "https://efisco.sefaz.pe.gov.br/sfi_trb_gcc/PREmitirCertidaoRegularidadeFiscalMovel";
const PDF = Buffer.from("%PDF-1.4\nFixture ficticia de certidao\n%%EOF");
function form(context, extra = "") {
  return `<form name="frm_principal"><input type="hidden" name="id_contexto_sessao" value="${context}"><input type="hidden" name="evento" value=""><input type="hidden" name="id_sessao" value="session-test">${extra}</form>`;
}
function html(body, cookie) {
  return new Response(body, { headers: { "Content-Type": "text/html", ...(cookie ? { "Set-Cookie": cookie } : {}) } });
}
function fixture(final = new Response(PDF)) {
  const calls = [];
  const responses = [
    html(form("step-1"), "JSESSIONID=test-session; Path=/; Secure; HttpOnly"),
    html(form("step-2", "Nenhum registro encontrado<input type='hidden' name='escaped' value='a&amp;b'>")),
    html(form("step-3", `<input type="hidden" name="NuDocumentoIdentificacaoCertidaoRegularidade" value="${DOCUMENT}">`), "FLOW=test-flow; Path=/; Secure"),
    final,
  ];
  return { calls, fetchImpl: async (url, options) => { calls.push({ url, ...options }); return responses.shift(); } };
}

test("PE percorre fluxo publico, preserva contexto/cookies e aceita contribuinte sem cadastro", async () => {
  const stub = fixture();
  const result = await collectPeFiscalCertificate({ documento: "529.982.247-25", fetchImpl: stub.fetchImpl });
  assert.deepEqual(result.buffer, PDF);
  assert.equal(result.provider, "SEFAZ-PE");
  assert.ok(Number.isFinite(Date.parse(result.queriedAt)));
  assert.equal(stub.calls.length, 4);
  assert.ok(stub.calls.every((call) => call.url === ENDPOINT && call.redirect === "manual"));
  assert.equal(stub.calls[0].method, "GET");
  const parameters = stub.calls.slice(1).map((call) => new URLSearchParams(call.body));
  assert.deepEqual(parameters.map((p) => p.get("evento")), ["processarFiltroConsulta", "exibirConfirmacaoRegularidadeFiscal", "exibirDocumento"]);
  assert.deepEqual(parameters.map((p) => p.get("id_contexto_sessao")), ["step-1", "step-2", "step-3"]);
  assert.ok(parameters.every((p) => p.get("NuDocumentoIdentificacaoCertidaoRegularidade") === DOCUMENT));
  assert.equal(parameters[1].get("escaped"), "a&b");
  assert.equal(parameters[2].get("parametro_metodo_botao"), "in_content_type_app_octetstream");
  assert.equal(stub.calls[1].headers.Cookie, "JSESSIONID=test-session");
  assert.equal(stub.calls[3].headers.Cookie, "JSESSIONID=test-session; FLOW=test-flow");
});

test("PE rejeita CPF invalido antes de qualquer consulta", async () => {
  for (const documento of [undefined, "11111111111", "52998224724", "text52998224725", "11222333000181"]) {
    await assert.rejects(collectPeFiscalCertificate({ documento, fetchImpl: () => assert.fail("não deve consultar") }), { code: "pe_fiscal_invalid_cpf" });
  }
});

test("PE interrompe se o portal passar a exigir CAPTCHA", async () => {
  let calls = 0;
  await assert.rejects(collectPeFiscalCertificate({ documento: DOCUMENT, fetchImpl: async () => {
    calls++;
    return html(form("test", '<div class="g-recaptcha"></div>'));
  } }), { code: "pe_fiscal_captcha_required" });
  assert.equal(calls, 1);
});

test("PE rejeita HTML ou arquivo incompleto no lugar do PDF", async () => {
  for (const content of ["<html>Sessão expirada</html>", "%PDF-1.4\ntruncated"]) {
    const stub = fixture(new Response(content));
    await assert.rejects(collectPeFiscalCertificate({ documento: DOCUMENT, fetchImpl: stub.fetchImpl }), { code: "pe_fiscal_invalid_pdf" });
  }
});

test("PE bloqueia redirecionamento externo antes de encaminhar CPF ou cookie", async () => {
  let calls = 0;
  await assert.rejects(collectPeFiscalCertificate({ documento: DOCUMENT, fetchImpl: async () => {
    calls++;
    return new Response(null, { status: 302, headers: { Location: "https://example.test/collect", "Set-Cookie": "private=test" } });
  } }), { code: "pe_fiscal_invalid_redirect" });
  assert.equal(calls, 1);
});

test("PE preserva cookie em redirecionamento no mesmo host", async () => {
  const stub = fixture();
  let redirected = false;
  const result = await collectPeFiscalCertificate({ documento: DOCUMENT, fetchImpl: async (url, options) => {
    if (!redirected) {
      redirected = true;
      return new Response(null, { status: 302, headers: { Location: ENDPOINT, "Set-Cookie": "redirect=test; Secure" } });
    }
    assert.match(options.headers.Cookie, /redirect=test/);
    return stub.fetchImpl(url, options);
  } });
  assert.deepEqual(result.buffer, PDF);
});

test("PE limita duracao total e sanitiza erros de rede", async () => {
  await assert.rejects(collectPeFiscalCertificate({ documento: DOCUMENT, timeoutMs: 5, fetchImpl: async (_url, { signal }) =>
    new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("detalhe privado")), { once: true }))
  }), { code: "pe_fiscal_timeout" });
  await assert.rejects(collectPeFiscalCertificate({ documento: DOCUMENT, fetchImpl: async () => { throw new Error(`Falha ${DOCUMENT}`); } }), (error) => {
    assert.equal(error.code, "pe_fiscal_unavailable");
    assert.ok(!error.message.includes(DOCUMENT));
    return true;
  });
});
