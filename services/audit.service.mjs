import crypto from "node:crypto";
import * as receitaFederal from "../collectors/receita-federal.collector.mjs";
import * as pgfn from "../collectors/pgfn.collector.mjs";
import * as cndt from "../collectors/cndt.collector.mjs";
import * as trf1 from "../collectors/trf1.collector.mjs";
import * as tjdft from "../collectors/tjdft.collector.mjs";
import * as fgts from "../collectors/fgts.collector.mjs";
import * as portalTransparencia from "../collectors/portal-transparencia.collector.mjs";
import { calculateRiskScore } from "./risk-score.service.mjs";

const collectors = {
  receita_federal: receitaFederal,
  pgfn,
  cndt,
  trf1,
  tjdft,
  fgts,
  portal_transparencia: portalTransparencia,
};

const memoryQueries = new Map();
const resultCache = new Map();

export function normalizeDocument(value) {
  return String(value || "").replace(/\D/g, "");
}

export function validateCpf(value) {
  const cpf = normalizeDocument(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) {
    return false;
  }
  const digit = (base) => {
    const sum = base
      .split("")
      .map(Number)
      .reduce((total, number, index) => total + number * (base.length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(cpf.slice(0, 9)) === Number(cpf[9]) && digit(cpf.slice(0, 10)) === Number(cpf[10]);
}

export function validateCnpj(value) {
  const cnpj = normalizeDocument(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) {
    return false;
  }
  const digit = (base, weights) => {
    const sum = base
      .split("")
      .map(Number)
      .reduce((total, number, index) => total + number * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondWeights = [6, ...firstWeights];
  return digit(cnpj.slice(0, 12), firstWeights) === Number(cnpj[12]) && digit(cnpj.slice(0, 13), secondWeights) === Number(cnpj[13]);
}

export function isValidDocument(tipoDocumento, documento) {
  return tipoDocumento === "cpf" ? validateCpf(documento) : validateCnpj(documento);
}

export function maskDocument(tipoDocumento, documento) {
  const digits = normalizeDocument(documento);
  if (tipoDocumento === "cpf" && digits.length === 11) {
    return `${digits.slice(0, 3)}********${digits.slice(-2)}`;
  }
  if (tipoDocumento === "cnpj" && digits.length === 14) {
    return `${digits.slice(0, 2)}.************${digits.slice(-2)}`;
  }
  return "***";
}

export function hashDocument(tenantId, documento) {
  return crypto.createHash("sha256").update(`${tenantId || "public"}:${normalizeDocument(documento)}`).digest("hex");
}

function envNumber(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeExtraFields(value) {
  return {
    firstName: String(value.firstName || value.primeiroNome || "").trim(),
    motherName: String(value.motherName || value.nomeMae || "").trim(),
    fatherName: String(value.fatherName || value.nomePai || "").trim(),
  };
}

function toApiResult(row) {
  return {
    fonte: row.fonte,
    status: row.status,
    resultado: row.resultado,
    dados: row.dados || row.dadosJson || {},
    pdfUrl: row.pdfUrl || row.pdfPath || "",
    rawText: row.rawText || "",
    erro: row.erro ?? row.errorMessage ?? null,
    startedAt: row.startedAt || "",
    finishedAt: row.finishedAt || "",
  };
}

function toPublicPdfUrl(pdfPath) {
  if (!pdfPath) {
    return "";
  }
  const fileName = String(pdfPath).split(/[\\/]/).pop();
  return fileName ? `/storage/pdfs/${encodeURIComponent(fileName)}` : "";
}

function extractPdfEvidence(result) {
  const items = [];
  if (result.pdfUrl || result.pdfPath) {
    items.push({
      fonte: result.fonte,
      titulo: "PDF da certidao",
      url: toPublicPdfUrl(result.pdfUrl || result.pdfPath),
    });
  }

  const dados = result.dados || result.dadosJson || {};
  const certidoes = Array.isArray(dados.certidoes) ? dados.certidoes : [];
  for (const certidao of certidoes) {
    if (!certidao?.pdfPath) {
      continue;
    }
    items.push({
      fonte: result.fonte,
      titulo: certidao.tipo || "Certidao",
      url: toPublicPdfUrl(certidao.pdfPath),
    });
  }

  return items.filter((item) => item.url);
}

function aggregateStatus(results) {
  if (!results.length || results.some((result) => ["pending", "running"].includes(result.status))) {
    return results.some((result) => ["success", "failed", "unavailable"].includes(result.status)) ? "partial" : "pending";
  }
  if (results.every((result) => result.status === "success")) {
    return "success";
  }
  if (results.every((result) => result.status === "failed")) {
    return "failed";
  }
  return "partial";
}

function cacheKey({ tenantId, documentoHash, fonte }) {
  return `${tenantId || "public"}:${documentoHash}:${fonte}`;
}

async function runCollectorWithCache({ collector, fonte, input, documentoHash, tenantId }) {
  const ttlMs = envNumber("AUDIT_CACHE_TTL_SECONDS", 900) * 1000;
  const key = cacheKey({ tenantId, documentoHash, fonte });
  const cached = resultCache.get(key);
  if (cached && Date.now() - cached.createdAt < ttlMs) {
    return { ...cached.result, dados: { ...cached.result.dados, cacheHit: true } };
  }

  const result = await collector.collect(input);
  resultCache.set(key, { createdAt: Date.now(), result });
  return result;
}

export function createAuditService({ getDb, getAuthContext, logError = console.error, customCollectors = collectors } = {}) {
  async function persistQuery(query, authContext) {
    const { pool, dbReady } = getDb ? getDb() : {};
    if (!pool || !dbReady) {
      memoryQueries.set(query.consultaId, query);
      return;
    }

    await pool.query(
      `INSERT INTO audita_audits (
         public_id, tenant_id, requested_by_user_id, document_type, tipo_documento,
         document_hash, documento_hash, document_masked, status, score_nivel,
         score_motivos, authorization_confirmed, request_payload
       )
       VALUES ($1, $2, $3, $4, $4, $5, $5, $6, $7, $8, $9, true, $10)`,
      [
        query.consultaId,
        authContext.tenantId,
        authContext.user?.id || null,
        query.tipoDocumento,
        query.documentoHash,
        query.documento,
        query.status,
        query.scoreRisco.nivel,
        JSON.stringify(query.scoreRisco.motivos),
        JSON.stringify({
          fontes: query.fontes,
          extraFieldsProvided: Object.fromEntries(Object.keys(query.extraFields || {}).map((key) => [key, Boolean(query.extraFields[key])])),
        }),
      ],
    );

    for (const result of query.resultados) {
      await pool.query(
        `INSERT INTO audita_audit_executions (
           audit_id, source_id, fonte, source_name, category, mode, status,
           resultado, dados_json, summary, error_message, started_at, finished_at
         )
         SELECT id, $2, $2, $2, 'audit', 'collector', $3, $4, $5, '', $6, $7, $8
         FROM audita_audits
         WHERE public_id = $1`,
        [
          query.consultaId,
          result.fonte,
          result.status,
          result.resultado,
          JSON.stringify(result.dados || {}),
          result.erro,
          result.startedAt || null,
          result.finishedAt || null,
        ],
      );
    }
  }

  async function updateResult(consultaId, nextResult) {
    const existing = memoryQueries.get(consultaId);
    if (existing) {
      existing.resultados = existing.resultados.map((result) => (result.fonte === nextResult.fonte ? nextResult : result));
      existing.status = aggregateStatus(existing.resultados);
      existing.scoreRisco = calculateRiskScore(existing.resultados);
    }

    const { pool, dbReady } = getDb ? getDb() : {};
    if (!pool || !dbReady) {
      return;
    }

    await pool.query(
      `UPDATE audita_audit_executions ae
       SET status = $3,
           resultado = $4,
           dados_json = $5,
           pdf_path = $6,
           raw_text = $7,
           error_message = $8,
           started_at = $9,
           finished_at = $10,
           updated_at = NOW()
       FROM audita_audits aq
       WHERE ae.audit_id = aq.id
         AND aq.public_id = $1
         AND ae.fonte = $2`,
      [
        consultaId,
        nextResult.fonte,
        nextResult.status,
        nextResult.resultado,
        JSON.stringify(nextResult.dados || {}),
        nextResult.pdfUrl || "",
        nextResult.rawText || "",
        nextResult.erro || "",
        nextResult.startedAt || null,
        nextResult.finishedAt || null,
      ],
    );

    const query = await findAudit(consultaId);
    await pool.query(
      `UPDATE audita_audits
       SET status = $2,
           score_nivel = $3,
           score_motivos = $4,
           updated_at = NOW()
       WHERE public_id = $1`,
      [consultaId, query.status, query.scoreRisco.nivel, JSON.stringify(query.scoreRisco.motivos)],
    );
  }

  async function appendJobLog({ consultaId, fonte, level, message, meta = {} }) {
    const { pool, dbReady } = getDb ? getDb() : {};
    if (!pool || !dbReady) {
      return;
    }
    await pool.query(
      `INSERT INTO audita_job_logs (audit_query_id, fonte, level, message, meta_json)
       SELECT id, $2, $3, $4, $5
       FROM audita_audits
       WHERE public_id = $1`,
      [consultaId, fonte, level, message, JSON.stringify(meta)],
    );
  }

  async function executeCollector(query, fonte) {
    const collector = customCollectors[fonte];
    if (!collector) {
      await updateResult(query.consultaId, {
        fonte,
        status: "failed",
        resultado: "erro",
        dados: {},
        pdfUrl: "",
        rawText: "",
        erro: "Fonte nao suportada.",
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      });
      return;
    }

    const startedAt = new Date().toISOString();
    await updateResult(query.consultaId, { ...query.resultados.find((result) => result.fonte === fonte), status: "running", startedAt });
    try {
      const result = await runCollectorWithCache({
        collector,
        fonte,
        input: {
          documento: query.documentoNormalizado,
          tipoDocumento: query.tipoDocumento,
          consultaId: query.consultaId,
          extraFields: query.extraFields || {},
          timeoutMs: envNumber("AUDIT_COLLECTOR_TIMEOUT_MS", 12000),
          retries: envNumber("AUDIT_COLLECTOR_RETRIES", 1),
        },
        documentoHash: query.documentoHash,
        tenantId: query.tenantId,
      });
      await updateResult(query.consultaId, {
        fonte,
        status: result.status,
        resultado: result.resultado,
        dados: result.dados || {},
        pdfUrl: result.pdfPath || "",
        rawText: result.rawText || "",
        erro: result.errorMessage || null,
        startedAt,
        finishedAt: new Date().toISOString(),
      });
    } catch (error) {
      await appendJobLog({ consultaId: query.consultaId, fonte, level: "error", message: error.message });
      await updateResult(query.consultaId, {
        fonte,
        status: "failed",
        resultado: "erro",
        dados: {},
        pdfUrl: "",
        rawText: "",
        erro: error.message,
        startedAt,
        finishedAt: new Date().toISOString(),
      });
      logError("[audita] collector failed", fonte, error);
    }
  }

  async function startAudit(request) {
    const authContext = await getAuthContext(request);
    if (authContext.unauthorized) {
      return { unauthorized: true };
    }

    const body = request.body;
    const tipoDocumento = String(body.tipoDocumento || "").toLowerCase();
    const documentoNormalizado = normalizeDocument(body.documento);
    const fontes = Array.isArray(body.fontes) && body.fontes.length ? body.fontes : Object.keys(customCollectors);
    const extraFields = normalizeExtraFields(body.extraFields || body.dadosExtras || {});

    if (!["cpf", "cnpj"].includes(tipoDocumento) || !isValidDocument(tipoDocumento, documentoNormalizado)) {
      return { invalid: true };
    }

    const documentoHash = hashDocument(authContext.tenantId, documentoNormalizado);
    const consultaId = crypto.randomUUID();
    const resultados = fontes.map((fonte) => ({
      fonte,
      status: "pending",
      resultado: "indisponivel",
      dados: {},
      pdfUrl: "",
      rawText: "",
      erro: null,
      startedAt: "",
      finishedAt: "",
    }));
    const query = {
      consultaId,
      documento: maskDocument(tipoDocumento, documentoNormalizado),
      documentoNormalizado,
      documentoHash,
      tipoDocumento,
      status: "pending",
      fontes,
      extraFields,
      tenantId: authContext.tenantId,
      userId: authContext.user?.id || null,
      resultados,
      scoreRisco: { nivel: "indefinido", motivos: ["Consulta ainda nao concluida."] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    memoryQueries.set(consultaId, query);
    await persistQuery(query, authContext);
    setTimeout(() => {
      Promise.all(fontes.map((fonte) => executeCollector(query, fonte))).catch((error) => {
        logError("[audita] audit execution failed", error);
      });
    }, 0);

    return { consultaId, status: "pending" };
  }

  function toHistoryItem(query) {
    const resultados = query.resultados || [];
    return {
      consultaId: query.consultaId,
      documento: query.documento,
      tipoDocumento: query.tipoDocumento,
      status: aggregateStatus(resultados),
      createdAt: query.createdAt || "",
      updatedAt: query.updatedAt || "",
      scoreRisco: query.scoreRisco || calculateRiskScore(resultados),
      fontes: resultados.map((result) => ({
        fonte: result.fonte,
        status: result.status,
        resultado: result.resultado,
      })),
      pdfs: resultados.flatMap(extractPdfEvidence),
    };
  }

  async function listAuditHistory(request, { limit = 20 } = {}) {
    const authContext = request ? await getAuthContext(request) : { tenantId: null, user: null, unauthorized: false };
    if (authContext.unauthorized) {
      return { unauthorized: true };
    }

    const { pool, dbReady } = getDb ? getDb() : {};
    if (!pool || !dbReady) {
      const audits = [...memoryQueries.values()]
        .filter((query) => !authContext.tenantId || query.tenantId === authContext.tenantId)
        .filter((query) => !authContext.user?.id || query.userId === authContext.user.id)
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
        .slice(0, limit)
        .map(toHistoryItem);
      return { audits };
    }

    const params = [authContext.tenantId, limit];
    const userFilter = authContext.user?.id ? "AND aq.requested_by_user_id = $3" : "";
    if (authContext.user?.id) {
      params.push(authContext.user.id);
    }

    const auditsResult = await pool.query(
      `SELECT
         aq.id,
         aq.public_id,
         aq.document_masked,
         aq.tipo_documento,
         aq.document_type,
         aq.status,
         aq.score_nivel,
         aq.score_motivos,
         aq.created_at,
         aq.updated_at
       FROM audita_audits aq
       WHERE aq.tenant_id = $1
         ${userFilter}
       ORDER BY aq.created_at DESC
       LIMIT $2`,
      params,
    );

    const audits = [];
    for (const row of auditsResult.rows) {
      const results = await pool.query(
        `SELECT fonte, status, resultado, dados_json, pdf_path, raw_text, error_message, started_at, finished_at
         FROM audita_audit_executions
         WHERE audit_id = $1
         ORDER BY id`,
        [row.id],
      );
      const resultados = results.rows.map((resultRow) =>
        toApiResult({
          fonte: resultRow.fonte,
          status: resultRow.status,
          resultado: resultRow.resultado,
          dados: resultRow.dados_json || {},
          pdfPath: resultRow.pdf_path,
          rawText: resultRow.raw_text,
          errorMessage: resultRow.error_message,
          startedAt: resultRow.started_at,
          finishedAt: resultRow.finished_at,
        }),
      );
      audits.push({
        consultaId: row.public_id,
        documento: row.document_masked,
        tipoDocumento: row.tipo_documento || row.document_type,
        status: aggregateStatus(resultados),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        scoreRisco: {
          nivel: row.score_nivel || "indefinido",
          motivos: Array.isArray(row.score_motivos) ? row.score_motivos : JSON.parse(row.score_motivos || "[]"),
        },
        fontes: resultados.map((result) => ({
          fonte: result.fonte,
          status: result.status,
          resultado: result.resultado,
        })),
        pdfs: resultados.flatMap(extractPdfEvidence),
      });
    }

    return { audits };
  }

  async function findAudit(consultaId, request) {
    const authContext = request ? await getAuthContext(request) : null;
    if (authContext?.unauthorized) {
      return { unauthorized: true };
    }

    const memory = memoryQueries.get(consultaId);
    if (memory) {
      if (authContext?.tenantId && memory.tenantId !== authContext.tenantId) {
        return null;
      }
      if (authContext?.user?.id && memory.userId !== authContext.user.id) {
        return null;
      }
      return {
        consultaId: memory.consultaId,
        documento: memory.documento,
        tipoDocumento: memory.tipoDocumento,
        status: aggregateStatus(memory.resultados),
        resultados: memory.resultados.map(toApiResult),
        scoreRisco: calculateRiskScore(memory.resultados),
      };
    }

    const { pool, dbReady } = getDb ? getDb() : {};
    if (!pool || !dbReady) {
      return null;
    }

    const params = [consultaId];
    const tenantFilter = authContext?.tenantId ? "AND tenant_id = $2" : "";
    const userFilter = authContext?.user?.id ? "AND requested_by_user_id = $3" : "";
    if (authContext?.tenantId) {
      params.push(authContext.tenantId);
    }
    if (authContext?.user?.id) {
      params.push(authContext.user.id);
    }

    const auditResult = await pool.query(
      `SELECT public_id, document_masked, tipo_documento, document_type, status, score_nivel, score_motivos
       FROM audita_audits
       WHERE public_id = $1
         ${tenantFilter}
         ${userFilter}
       LIMIT 1`,
      params,
    );
    const audit = auditResult.rows[0];
    if (!audit) {
      return null;
    }
    const results = await pool.query(
      `SELECT fonte, status, resultado, dados_json, pdf_path, raw_text, error_message, started_at, finished_at
       FROM audita_audit_executions ae
       JOIN audita_audits aq ON aq.id = ae.audit_id
       WHERE aq.public_id = $1
       ORDER BY ae.id`,
      [consultaId],
    );
    const resultados = results.rows.map((row) =>
      toApiResult({
        fonte: row.fonte,
        status: row.status,
        resultado: row.resultado,
        dados: row.dados_json || {},
        pdfPath: row.pdf_path,
        rawText: row.raw_text,
        errorMessage: row.error_message,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
      }),
    );
    return {
      consultaId: audit.public_id,
      documento: audit.document_masked,
      tipoDocumento: audit.tipo_documento || audit.document_type,
      status: aggregateStatus(resultados),
      resultados,
      scoreRisco: {
        nivel: audit.score_nivel || "indefinido",
        motivos: Array.isArray(audit.score_motivos) ? audit.score_motivos : JSON.parse(audit.score_motivos || "[]"),
      },
    };
  }

  return { startAudit, findAudit, listAuditHistory };
}

export const supportedAuditSources = Object.keys(collectors);
