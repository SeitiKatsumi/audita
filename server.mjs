import http from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const root = resolve(".");
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || "0.0.0.0";
const databaseUrl = process.env.DATABASE_URL;
const autoMigrate = process.env.AUDITA_AUTO_MIGRATE !== "false";
const appVersion = process.env.APP_VERSION || "local";
let pool;
let dbReady = false;
let dbError = null;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
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
    dbReady = true;
  } catch (error) {
    dbReady = false;
    dbError = error instanceof Error ? error.message : "Unknown database error";
    console.error("[audita] database initialization failed:", dbError);
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function getDashboard() {
  if (!pool || !dbReady) {
    return fallbackDashboard;
  }

  const [sources, alerts, latestSignals, report] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS total FROM audita_sources WHERE status = 'active'"),
    pool.query("SELECT COUNT(*)::int AS total FROM audita_audit_events WHERE status = 'open' AND severity IN ('high', 'critical')"),
    pool.query(
      "SELECT title, description, severity FROM audita_audit_events WHERE status = 'open' ORDER BY created_at DESC LIMIT 3",
    ),
    pool.query("SELECT summary FROM audita_reports ORDER BY created_at DESC LIMIT 1"),
  ]);

  return {
    mode: "database",
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

async function handleApi(request, response, pathname) {
  if (pathname === "/api/health") {
    sendJson(response, 200, {
      status: "ok",
      version: appVersion,
      database: {
        configured: Boolean(databaseUrl),
        ready: dbReady,
        error: dbReady ? null : dbError,
      },
    });
    return true;
  }

  if (pathname === "/api/dashboard") {
    try {
      sendJson(response, 200, await getDashboard());
    } catch (error) {
      sendJson(response, 500, {
        error: "dashboard_query_failed",
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
