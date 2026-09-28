import { validateCpf } from "./audit.service.mjs";

const ORIGIN = "https://efisco.sefaz.pe.gov.br";
const ENDPOINT = `${ORIGIN}/sfi_trb_gcc/PREmitirCertidaoRegularidadeFiscalMovel`;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

function failure(code) {
  const error = new Error("Não foi possível obter a certidão fiscal de Pernambuco por este fluxo.");
  error.code = `pe_fiscal_${code}`;
  return error;
}

function decodeAttribute(value) {
  return value.replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&amp;/gi, "&");
}

function formParameters(buffer) {
  const html = new TextDecoder("windows-1252").decode(buffer);
  if (/captcha|turnstile/i.test(html)) throw failure("captcha_required");
  if (!/<form\b/i.test(html)) throw failure("invalid_form");
  const parameters = new URLSearchParams();
  for (const input of html.matchAll(/<input\b[^>]*>/gi)) {
    const attributes = Object.fromEntries([...input[0].matchAll(/([\w_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
      .map((match) => [match[1].toLowerCase(), decodeAttribute(match[2] ?? match[3])]));
    if (attributes.name && ["hidden", "text"].includes(attributes.type?.toLowerCase())) {
      parameters.set(attributes.name, attributes.value || "");
    }
  }
  if (!parameters.has("id_contexto_sessao") || !parameters.has("evento")) throw failure("invalid_form");
  return parameters;
}

/** Public e-Fisco flow. The caller must verify PDF identity/scope before accepting it. */
export async function collectPeFiscalCertificate({ documento, timeoutMs = 90_000, fetchImpl = globalThis.fetch } = {}) {
  if (typeof documento !== "string" || !/^[\d.\-\s]+$/.test(documento) || !validateCpf(documento)) {
    throw failure("invalid_cpf");
  }
  const cpf = documento.replace(/\D/g, "");
  const duration = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, 120_000) : 90_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), duration);
  const cookies = new Map();

  async function request(parameters) {
    let url = ENDPOINT;
    let method = parameters ? "POST" : "GET";
    let body = parameters?.toString();
    for (let redirects = 0; redirects <= 3; redirects++) {
      const response = await fetchImpl(url, {
        method,
        body,
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/pdf",
          Referer: ENDPOINT,
          ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
          ...(cookies.size ? { Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; ") } : {}),
        },
      });
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(";", 1)[0];
        const separator = pair.indexOf("=");
        if (separator > 0) cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1));
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirects === 3) throw failure("invalid_redirect");
        const next = new URL(location, url);
        if (next.origin !== ORIGIN || next.username || next.password) throw failure("invalid_redirect");
        url = next.href;
        if (response.status === 303 || ([301, 302].includes(response.status) && method === "POST")) {
          method = "GET";
          body = undefined;
        }
        await response.body?.cancel();
        continue;
      }
      if (!response.ok || Number(response.headers.get("content-length")) > MAX_RESPONSE_BYTES) {
        await response.body?.cancel();
        throw failure(response.ok ? "response_too_large" : "unavailable");
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of response.body || []) {
        size += chunk.length;
        if (size > MAX_RESPONSE_BYTES) throw failure("response_too_large");
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    }
    throw failure("invalid_redirect");
  }

  try {
    let parameters = formParameters(await request());
    parameters.set("evento", "processarFiltroConsulta");
    parameters.set("TpDocumentoIdentificacaoCertidaoRegularidade", "3");
    parameters.set("NuDocumentoIdentificacaoCertidaoRegularidade", cpf);
    parameters.set("qt_registros_pagina", "20");
    parameters.set("btt_localizar", "Localizar (l)");
    parameters.set("in_formulario_submetido", "true");

    parameters = formParameters(await request(parameters));
    parameters.set("evento", "exibirConfirmacaoRegularidadeFiscal");
    parameters.set("TpDocumentoIdentificacaoCertidaoRegularidade", "3");
    parameters.set("NuDocumentoIdentificacaoCertidaoRegularidade", cpf);
    parameters.set("qt_registros_pagina", "20");
    parameters.set("in_formulario_submetido", "true");

    parameters = formParameters(await request(parameters));
    parameters.set("evento", "exibirDocumento");
    parameters.set("parametro_metodo_botao", "in_content_type_app_octetstream");
    parameters.set("in_formulario_submetido", "true");
    const buffer = await request(parameters);
    if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-" || !buffer.subarray(-1024).includes(Buffer.from("%%EOF"))) {
      throw failure("invalid_pdf");
    }
    return { buffer, queriedAt: new Date().toISOString(), provider: "SEFAZ-PE" };
  } catch (error) {
    if (typeof error?.code === "string" && error.code.startsWith("pe_fiscal_")) throw error;
    throw failure(controller.signal.aborted ? "timeout" : "unavailable");
  } finally {
    clearTimeout(timer);
  }
}
