import test from "node:test";
import assert from "node:assert/strict";
import { fillSeTjseCertificate } from "../collectors/tjdft.collector.mjs";

test("TJSE preserva erro original e encerra somente a pagina que nao ficou assistida", async () => {
  for (const keepPageOpen of [false, true]) {
    let closed = false;
    const page = {
      setDefaultTimeout() {},
      async goto() { throw new Error("Portal indisponivel no teste"); },
      async close() { closed = true; },
      off() { assert.fail("TJSE nao registrou listener requestfailed"); },
    };
    const result = await fillSeTjseCertificate({
      context: { async newPage() { return page; } },
      input: { tipoDocumento: "cpf", documento: "00000000000", extraFields: {} },
      profile: { url: "https://example.test/certidao" },
      certificateType: { id: "civil", label: "Civel" },
      keepPageOpen,
    });
    assert.equal(result.status, "failed");
    assert.equal(result.errorMessage, "Portal indisponivel no teste");
    assert.equal(closed, !keepPageOpen);
  }
});
