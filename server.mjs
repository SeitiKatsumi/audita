import http from "node:http";
import crypto from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const root = resolve(".");
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || "0.0.0.0";
const databaseUrl = process.env.DATABASE_URL;
const autoMigrate = process.env.AUDITA_AUTO_MIGRATE !== "false";
const authRequired = process.env.AUDITA_AUTH_REQUIRED === "true";
const sessionCookieName = "audita_session";
const appVersion = process.env.APP_VERSION || "local";
const appEnv = process.env.APP_ENV || "local";
const appUrl = process.env.APP_URL || "";
let pool;
let dbReady = false;
let dbError = null;
let defaultTenantId = null;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
};

const fallbackDashboard = {
  mode: "demo",
  metrics: {
    consultationsToday: 1284,
    connectedSources: 37,
    criticalAlerts: 9,
    averageAnalysisTime: "4.8s",
  },
  signals: [
    {
      title: "Inconsistencia fiscal recorrente",
      description: "Cliente ACME | 2 fontes divergentes",
      severity: "high",
    },
    {
      title: "Processo judicial com mudanca recente",
      description: "Atualizacao detectada ha 14 minutos",
      severity: "medium",
    },
    {
      title: "Imovel com pendencia documental",
      description: "Recomendacao pronta para revisao",
      severity: "low",
    },
  ],
  assistantSummary:
    "Foram encontrados sinais relevantes em 3 fontes. A recomendacao e priorizar a divergencia fiscal, validar documentos do imovel e gerar relatorio executivo para aprovacao.",
};

const fallbackGovernmentModules = [
  {
    slug: "receita-cnpj",
    name: "Consulta CNPJ Receita Federal",
    category: "fiscal",
    provider: "Receita Federal",
    accessMethod: "api",
    authType: "certificate_or_token",
    status: "planned",
    description: "Consulta cadastral e fiscal de pessoa juridica quando houver credencial autorizada.",
  },
  {
    slug: "cnj-processos",
    name: "Consulta Processual CNJ/Tribunais",
    category: "judicial",
    provider: "CNJ e tribunais",
    accessMethod: "hybrid",
    authType: "token_or_public",
    status: "planned",
    description: "Consulta e acompanhamento de processos judiciais em fontes oficiais.",
  },
  {
    slug: "diarios-oficiais",
    name: "Diarios Oficiais",
    category: "juridico",
    provider: "Fontes oficiais",
    accessMethod: "scraping",
    authType: "none",
    status: "sandbox",
    description: "Monitoramento de publicacoes oficiais e mencoes relevantes.",
  },
];

async function initializeDatabase() {
  if (!databaseUrl) {
    return;
  }

  try {
    const pg = await import("pg");
    const { Pool } = pg.default || pg;
    pool = new Pool({
      connectionString: databaseUrl,
      max: Number(process.env.DB_POOL_MAX || 5),
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
    });

    if (autoMigrate) {
      const schema = await readFile(join(root, "db", "schema.sql"), "utf8");
      await pool.query(schema);
    }

    await pool.query("SELECT 1");
    await cacheDefaultTenant();
    await bootstrapAdminUser();
    dbReady = true;
  } catch (error) {
    dbReady = false;
    dbError = error instanceof Error ? error.message : "Unknown database error";
    console.error("[audita] database initialization failed:", dbError);
  }
}

async function cacheDefaultTenant() {
  if (!pool) {
    return;
  }

  const result = await pool.query("SELECT id FROM audita_tenants WHERE slug = $1", [
    "elevenmind-staging",
  ]);
  defaultTenantId = result.rows[0]?.id || null;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 310000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedValue) {
  const [salt, storedHash] = String(storedValue || "").split(":");
  if (!salt || !storedHash) {
    return false;
  }

  const calculatedHash = crypto.pbkdf2Sync(password, salt, 310000, 32, "sha256");
  const storedBuffer = Buffer.from(storedHash, "hex");
  return storedBuffer.length === calculatedHash.length && crypto.timingSafeEqual(storedBuffer, calculatedHash);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function hashSubjectIdentifier(tenantId, identifier) {
  return crypto.createHash("sha256").update(`${tenantId}:${identifier}`).digest("hex");
}

function maskIdentifier(identifier) {
  const cleaned = String(identifier || "").replace(/\s+/g, "");
  if (cleaned.length <= 4) {
    return "*".repeat(cleaned.length);
  }

  const first = cleaned.slice(0, 3);
  const last = cleaned.slice(-2);
  return `${first}${"*".repeat(Math.min(cleaned.length - 5, 12))}${last}`;
}

async function bootstrapAdminUser() {
  if (!pool || !defaultTenantId) {
    return;
  }

  const email = process.env.AUDITA_BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.AUDITA_BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.AUDITA_BOOTSTRAP_ADMIN_NAME || "Audita Admin";

  if (!email || !password) {
    return;
  }

  await pool.query(
    `INSERT INTO audita_users (tenant_id, email, name, role, password_hash)
     VALUES ($1, LOWER($2), $3, 'owner', $4)
     ON CONFLICT (email)
     DO UPDATE SET
       tenant_id = EXCLUDED.tenant_id,
       name = EXCLUDED.name,
       role = 'owner',
       status = 'active',
       password_hash = EXCLUDED.password_hash,
       updated_at = NOW()`,
    [defaultTenantId, email, name, hashPassword(password)],
  );
}

function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || "")
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const [name, ...value] = cookie.split("=");
        return [decodeURIComponent(name), decodeURIComponent(value.join("="))];
      }),
  );
}

function cookieOptions(request, maxAgeSeconds) {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const secure = forwardedProto === "https" || process.env.COOKIE_SECURE === "true";
  return [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function setSessionCookie(request, response, token) {
  response.setHeader(
    "Set-Cookie",
    `${sessionCookieName}=${encodeURIComponent(token)}; ${cookieOptions(request, 60 * 60 * 12)}`,
  );
}

function clearSessionCookie(request, response) {
  response.setHeader(
    "Set-Cookie",
    `${sessionCookieName}=; ${cookieOptions(request, 0)}`,
  );
}

async function readJsonBody(request) {
  let body = "";

  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1024 * 20) {
      throw new Error("Request body too large");
    }
  }

  return body ? JSON.parse(body) : {};
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function getSessionUser(request) {
  if (!pool || !dbReady) {
    return null;
  }

  const cookies = parseCookies(request);
  const token = cookies[sessionCookieName];
  if (!token) {
    return null;
  }

  const result = await pool.query(
    `SELECT
       u.id,
       u.email,
       u.name,
       u.role,
       u.tenant_id,
       t.name AS tenant_name,
       t.slug AS tenant_slug
     FROM audita_sessions s
     JOIN audita_users u ON u.id = s.user_id
     JOIN audita_tenants t ON t.id = u.tenant_id
     WHERE s.token_hash = $1
       AND s.expires_at > NOW()
       AND u.status = 'active'
       AND t.status = 'active'`,
    [hashToken(token)],
  );

  return result.rows[0] || null;
}

function publicUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenant: {
      id: user.tenant_id,
      name: user.tenant_name,
      slug: user.tenant_slug,
    },
  };
}

async function createSession(response, request, userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);

  await pool.query(
    "INSERT INTO audita_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '12 hours')",
    [userId, tokenHash],
  );

  setSessionCookie(request, response, token);
}

async function getTenantIdForRequest(request) {
  const user = await getSessionUser(request);
  if (authRequired && !user) {
    return { user: null, tenantId: null, unauthorized: true };
  }

  return {
    user,
    tenantId: user?.tenant_id || defaultTenantId,
    unauthorized: false,
  };
}

async function getDashboard(request) {
  if (!pool || !dbReady) {
    return fallbackDashboard;
  }

  const authContext = await getTenantIdForRequest(request);
  if (authContext.unauthorized) {
    return { unauthorized: true };
  }

  const tenantId = authContext.tenantId;
  const [sources, alerts, latestSignals, report] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS total FROM audita_sources WHERE tenant_id = $1 AND status = 'active'", [
      tenantId,
    ]),
    pool.query(
      "SELECT COUNT(*)::int AS total FROM audita_audit_events WHERE tenant_id = $1 AND status = 'open' AND severity IN ('high', 'critical')",
      [tenantId],
    ),
    pool.query(
      "SELECT title, description, severity FROM audita_audit_events WHERE tenant_id = $1 AND status = 'open' ORDER BY created_at DESC LIMIT 3",
      [tenantId],
    ),
    pool.query("SELECT summary FROM audita_reports WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1", [
      tenantId,
    ]),
  ]);

  return {
    mode: "database",
    user: publicUser(authContext.user),
    metrics: {
      consultationsToday: 1284,
      connectedSources: sources.rows[0]?.total || 0,
      criticalAlerts: alerts.rows[0]?.total || 0,
      averageAnalysisTime: "4.8s",
    },
    signals: latestSignals.rows,
    assistantSummary: report.rows[0]?.summary || fallbackDashboard.assistantSummary,
  };
}

async function getGovernmentModules() {
  if (!pool || !dbReady) {
    return fallbackGovernmentModules;
  }

  const result = await pool.query(
    `SELECT
       slug,
       name,
       category,
       provider,
       access_method AS "accessMethod",
       auth_type AS "authType",
       status,
       description
     FROM audita_government_modules
     ORDER BY category, name`,
  );

  return result.rows;
}

async function listConsultations(request) {
  if (!pool || !dbReady) {
    return [];
  }

  const authContext = await getTenantIdForRequest(request);
  if (authContext.unauthorized) {
    return { unauthorized: true };
  }

  const result = await pool.query(
    `SELECT
       cr.id,
       gm.slug AS "moduleSlug",
       gm.name AS "moduleName",
       cr.subject_type AS "subjectType",
       cr.subject_identifier_masked AS "subjectIdentifierMasked",
       cr.status,
       cr.result_summary AS "resultSummary",
       cr.created_at AS "createdAt",
       cr.completed_at AS "completedAt"
     FROM audita_consultation_requests cr
     JOIN audita_government_modules gm ON gm.id = cr.module_id
     WHERE cr.tenant_id = $1
     ORDER BY cr.created_at DESC
     LIMIT 8`,
    [authContext.tenantId],
  );

  return result.rows;
}

async function createConsultation(request) {
  if (!pool || !dbReady) {
    return { unavailable: true };
  }

  const authContext = await getTenantIdForRequest(request);
  if (authContext.unauthorized) {
    return { unauthorized: true };
  }

  const body = await readJsonBody(request);
  const moduleSlug = String(body.moduleSlug || "").trim();
  const subjectType = String(body.subjectType || "").trim();
  const subjectIdentifier = String(body.subjectIdentifier || "").trim();

  if (!moduleSlug || !subjectType || subjectIdentifier.length < 4) {
    return { invalid: true };
  }

  const moduleResult = await pool.query(
    "SELECT id, name, status FROM audita_government_modules WHERE slug = $1 LIMIT 1",
    [moduleSlug],
  );
  const module = moduleResult.rows[0];
  if (!module) {
    return { notFound: true };
  }

  const subjectHash = hashSubjectIdentifier(authContext.tenantId, subjectIdentifier);
  const subjectMasked = maskIdentifier(subjectIdentifier);
  const simulatedSummary =
    module.status === "active"
      ? `Consulta registrada para ${module.name}.`
      : `Modulo ${module.name} esta em preparacao; consulta registrada para rastreabilidade.`;

  const result = await pool.query(
    `INSERT INTO audita_consultation_requests (
       tenant_id,
       module_id,
       requested_by_user_id,
       subject_type,
       subject_identifier_hash,
       subject_identifier_masked,
       status,
       request_payload,
       result_summary,
       completed_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     RETURNING id, status, result_summary AS "resultSummary", created_at AS "createdAt"`,
    [
      authContext.tenantId,
      module.id,
      authContext.user?.id || null,
      subjectType,
      subjectHash,
      subjectMasked,
      module.status === "active" ? "completed" : "blocked",
      JSON.stringify({ moduleSlug, subjectType }),
      simulatedSummary,
    ],
  );

  await pool.query(
    `INSERT INTO audita_app_events (tenant_id, event_type, payload)
     VALUES ($1, 'consultation.requested', $2)`,
    [
      authContext.tenantId,
      JSON.stringify({
        moduleSlug,
        subjectType,
        subjectIdentifierMasked: subjectMasked,
        status: result.rows[0].status,
      }),
    ],
  );

  return result.rows[0];
}

async function handleApi(request, response, pathname) {
  if (pathname === "/api/health") {
    sendJson(response, 200, {
      status: "ok",
      version: appVersion,
      environment: appEnv,
      database: {
        configured: Boolean(databaseUrl),
        ready: dbReady,
        error: dbReady ? null : dbError,
      },
      auth: {
        required: authRequired,
      },
    });
    return true;
  }

  if (pathname === "/api/config") {
    sendJson(response, 200, {
      environment: appEnv,
      appUrl,
      authRequired,
    });
    return true;
  }

  if (pathname === "/api/auth/me") {
    sendJson(response, 200, {
      user: publicUser(await getSessionUser(request)),
      authRequired,
    });
    return true;
  }

  if (pathname === "/api/auth/login" && request.method === "POST") {
    if (!pool || !dbReady) {
      sendJson(response, 503, { error: "database_unavailable" });
      return true;
    }

    try {
      const body = await readJsonBody(request);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const result = await pool.query(
        `SELECT id, password_hash
         FROM audita_users
         WHERE email = $1 AND status = 'active'
         LIMIT 1`,
        [email],
      );
      const user = result.rows[0];

      if (!user || !verifyPassword(password, user.password_hash)) {
        sendJson(response, 401, { error: "invalid_credentials" });
        return true;
      }

      await createSession(response, request, user.id);
      sendJson(response, 200, { ok: true });
    } catch (error) {
      sendJson(response, 400, {
        error: "login_failed",
        message: error instanceof Error ? error.message : "Invalid request",
      });
    }
    return true;
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    const cookies = parseCookies(request);
    const token = cookies[sessionCookieName];
    if (pool && token) {
      await pool.query("DELETE FROM audita_sessions WHERE token_hash = $1", [hashToken(token)]);
    }
    clearSessionCookie(request, response);
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (pathname === "/api/dashboard") {
    try {
      const dashboard = await getDashboard(request);
      if (dashboard.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      sendJson(response, 200, dashboard);
    } catch (error) {
      sendJson(response, 500, {
        error: "dashboard_query_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (pathname === "/api/modules") {
    sendJson(response, 200, { modules: await getGovernmentModules() });
    return true;
  }

  if (pathname === "/api/consultations" && request.method === "GET") {
    try {
      const consultations = await listConsultations(request);
      if (consultations.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      sendJson(response, 200, { consultations });
    } catch (error) {
      sendJson(response, 500, {
        error: "consultations_query_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (pathname === "/api/consultations" && request.method === "POST") {
    try {
      const consultation = await createConsultation(request);
      if (consultation.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      if (consultation.unavailable) {
        sendJson(response, 503, { error: "database_unavailable" });
        return true;
      }
      if (consultation.invalid) {
        sendJson(response, 400, { error: "invalid_consultation_request" });
        return true;
      }
      if (consultation.notFound) {
        sendJson(response, 404, { error: "module_not_found" });
        return true;
      }
      sendJson(response, 201, { consultation });
    } catch (error) {
      sendJson(response, 500, {
        error: "consultation_create_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  return false;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  if (await handleApi(request, response, url.pathname)) {
    return;
  }

  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = resolve(join(root, requestedPath));

  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": contentTypes[extname(filePath)] || "application/octet-stream",
    "cache-control": "no-store",
  });

  createReadStream(filePath).pipe(response);
});

await initializeDatabase();

server.listen(port, host, () => {
  console.log(`Audita web app running at http://${host}:${port}/`);
});
