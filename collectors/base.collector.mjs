export const SOURCE_STATUS = {
  SUCCESS: "success",
  FAILED: "failed",
  UNAVAILABLE: "unavailable",
};

export const SOURCE_RESULT = {
  NADA_CONSTA: "nada_consta",
  CONSTA: "consta",
  INDISPONIVEL: "indisponivel",
  ERRO: "erro",
};

export function unavailableResult(fonte, errorMessage, dados = {}) {
  return {
    fonte,
    status: SOURCE_STATUS.UNAVAILABLE,
    resultado: SOURCE_RESULT.INDISPONIVEL,
    dados,
    rawText: "",
    errorMessage,
  };
}

export function failedResult(fonte, errorMessage, dados = {}) {
  return {
    fonte,
    status: SOURCE_STATUS.FAILED,
    resultado: SOURCE_RESULT.ERRO,
    dados,
    rawText: "",
    errorMessage,
  };
}

export function successResult(fonte, resultado, dados = {}, extra = {}) {
  return {
    fonte,
    status: SOURCE_STATUS.SUCCESS,
    resultado,
    dados,
    rawText: extra.rawText || "",
    pdfPath: extra.pdfPath || "",
    errorMessage: "",
  };
}

export async function fetchJson(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "Audita/0.1 audit-collector",
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text.slice(0, 2000) };
    }
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function withRetry(operation, { retries = 1, timeoutMs = 12000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation({ attempt, timeoutMs });
    } catch (error) {
      lastError = error;
      if (attempt >= retries) {
        break;
      }
    }
  }
  throw lastError;
}

