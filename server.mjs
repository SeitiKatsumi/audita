import http from "node:http";
import crypto from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import WebSocket, { WebSocketServer } from "ws";
import { resolveUiRoute } from "./services/ui-routing.service.mjs";
import { createAuditService } from "./services/audit.service.mjs";
import {
  buildDfSellerAuditRequest,
  normalizeDfSellerInput,
} from "./services/seller-analysis.service.mjs";
import { createApiUsageService } from "./services/api-usage.service.mjs";
import { createOpenAIOfficialUsageService } from "./services/openai-official-usage.service.mjs";
import {
  createChatBrowserService,
  normalizeWebSocketCloseCode,
} from "./services/chat-browser.service.mjs";
import { createCreditsService } from "./services/credits.service.mjs";
import {
  createStripeBillingService,
  StripeBillingError,
} from "./services/stripe-billing.service.mjs";
import { createBillingAdminService } from "./services/billing-admin.service.mjs";
import { createBillingAccessService } from "./services/billing-access.service.mjs";
import { resolveItauChargeServiceTier } from "./services/billing-catalog.service.mjs";
import { createSuperAdminService } from "./services/super-admin.service.mjs";
import { createDirectDataCourtService } from "./services/direct-data-court.service.mjs";
import { createDirectDataCertificatesService } from "./services/direct-data-certificates.service.mjs";
import {
  createDirectDataPersonService,
  personNamesMatch,
} from "./services/direct-data-person.service.mjs";
import { createPropertyAssetsService } from "./services/property-assets.service.mjs";
import {
  runAuditaChat,
} from "./services/chat-assistant.service.mjs";
import {
  createItauRefundService,
  updateItauCaseSnapshot,
} from "./services/itau-refund.service.mjs";
import { buildChargeCalculationSnapshot } from "./charge-calculation.js";
import {
  closeAssistedSession,
  getAssistedSessionView,
  inspectAssistedSessionResult,
  interactAssistedSession,
  openAssistedBrowserSession,
} from "./collectors/tjdft.collector.mjs";
import {
  createStateCourtAgentSession,
  getOwnedStateCourtAgentSession,
  handleStateCourtAgentAction,
  startStateCourtAgentSession,
} from "./services/state-court-agent.service.mjs";
import {
  buildJecAgentProfile,
  getJecManualFilingGuide,
  getJecPortal,
  listJecPortals,
  prepareJecPetition,
} from "./services/jec-petition.service.mjs";
import { createJecPetitionPdf } from "./services/jec-petition-pdf.service.mjs";
import {
  createJecTestimonyService,
  JecTestimonyError,
  normalizeJecTestimony,
} from "./services/jec-testimony.service.mjs";
import {
  decryptUserProfile,
  encryptUserProfile,
  normalizeUserProfile,
  profileForClient,
  resolveProfileEncryptionKey,
  UserProfileValidationError,
} from "./services/user-profile.service.mjs";
import {
  buildSelfServeTenantIdentity,
  createSelfServeAccount,
} from "./services/tenant-onboarding.service.mjs";

const root = resolve(".");
const itauLawyerKitRoot = join(root, "private-documents", "itau-lawyer-kit");
const itauLawyerKitDocuments = Object.freeze([
  {
    slug: "processo-completo",
    title: "Processo completo",
    fileName: "processo-completo.pdf",
    downloadName: "ia-audita-processo-completo-itau.pdf",
  },
  {
    slug: "processo-sentenca",
    title: "Sentença",
    fileName: "processo-sentenca.pdf",
    downloadName: "ia-audita-sentenca-itau.pdf",
  },
  {
    slug: "homologacao-acordo",
    title: "Decisão de homologação do acordo",
    fileName: "homologacao-acordo.pdf",
    downloadName: "ia-audita-homologacao-acordo-itau.pdf",
  },
  {
    slug: "suspensao-24-meses",
    title: "Despacho de suspensão do processo por 24 meses",
    fileName: "suspensao-24-meses.pdf",
    downloadName: "ia-audita-decisao-suspensao-24-meses.pdf",
  },
  {
    slug: "jurisprudencia-acordo-voto",
    title: "Jurisprudência / Acordo / Voto",
    fileName: "",
    downloadName: "",
  },
]);
loadLocalEnvFiles();
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || "0.0.0.0";
const databaseUrl = process.env.DATABASE_URL;
const autoMigrate = process.env.AUDITA_AUTO_MIGRATE !== "false";
const authRequired = process.env.AUDITA_AUTH_REQUIRED !== "false";
const sessionCookieName = "audita_session";
const appVersion = String(
  process.env.APP_VERSION || resolveGitVersion() || "local",
).trim();
const appEnv = process.env.APP_ENV || "local";
const appUrl = process.env.APP_URL || "";
let profileEncryptionKey = resolveProfileEncryptionKey(
  process.env.AUDITA_PROFILE_ENCRYPTION_KEY,
);
let pool;
let dbReady = false;
let dbError = null;
let defaultTenantId = null;
const fallbackAudits = [];
const fallbackAuthPath = join(root, "storage", "local-auth.json");
let fallbackAuthLoaded = false;
let fallbackUserId = 1;
const fallbackUsers = new Map();
const fallbackUsersByEmail = new Map();
const fallbackSessions = new Map();

function loadLocalEnvFiles() {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = join(root, fileName);
    if (!existsSync(filePath)) continue;
    const content = readFileSync(filePath, "utf-8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separatorIndex = line.indexOf("=");
      if (separatorIndex <= 0) continue;
      const key = line.slice(0, separatorIndex).trim();
      let value = line.slice(separatorIndex + 1).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) continue;
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

function resolveGitVersion() {
  try {
    const gitDir = join(root, ".git");
    const head = readFileSync(join(gitDir, "HEAD"), "utf-8").trim();
    if (!head) return "";
    if (!head.startsWith("ref:")) return head.slice(0, 7);

    const ref = head.slice(5).trim();
    const refPath = join(gitDir, ...ref.split("/"));
    if (existsSync(refPath)) {
      return readFileSync(refPath, "utf-8").trim().slice(0, 7);
    }

    const packedRefsPath = join(gitDir, "packed-refs");
    if (!existsSync(packedRefsPath)) return "";
    const packedRefs = readFileSync(packedRefsPath, "utf-8").split(/\r?\n/);
    const packedMatch = packedRefs.find((line) => line.endsWith(` ${ref}`));
    return packedMatch ? packedMatch.split(" ")[0].slice(0, 7) : "";
  } catch {
    return "";
  }
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
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
      title: "Inconsistência fiscal recorrente",
      description: "Cliente ACME | 2 fontes divergentes",
      severity: "high",
    },
    {
      title: "Processo judicial com mudança recente",
      description: "Atualização detectada há 14 minutos",
      severity: "medium",
    },
    {
      title: "Imóvel com pendência documental",
      description: "Recomendação pronta para revisão",
      severity: "low",
    },
  ],
  assistantSummary:
    "Foram encontrados sinais relevantes em 3 fontes. A recomendação é priorizar a divergência fiscal, validar documentos do imóvel e gerar relatório executivo para aprovação.",
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
    description: "Consulta cadastral e fiscal de pessoa jurídica quando houver credencial autorizada.",
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
    slug: "imoveis-registro",
    name: "Busca de Imóveis",
    category: "imobiliario",
    provider: "ONR / RI Digital",
    accessMethod: "hybrid",
    authType: "credential",
    status: "sandbox",
    description: "Pesquisa Prévia, Pesquisa Qualificada e Certidão Digital com contingência operacional oficial sem scraping.",
  },
  {
    slug: "cnib-indisponibilidade-bens",
    name: "Indisponibilidade de Bens",
    category: "imobiliario",
    provider: "BigDataCorp",
    accessMethod: "api",
    authType: "token",
    status: "sandbox",
    description:
      "Indicador de indisponibilidade de bens via provedor DaaS autorizado. Validar contrato/fonte antes de tratar como certidao oficial CNIB.",
  },
  {
    slug: "diarios-oficiais",
    name: "Diários Oficiais",
    category: "juridico",
    provider: "Fontes oficiais",
    accessMethod: "scraping",
    authType: "none",
    status: "sandbox",
    description: "Monitoramento de publicações oficiais e menções relevantes.",
  },
];

const auditSources = [
  {
    id: "brasilapi-cnpj",
    name: "CNPJ publico",
    category: "fiscal",
    scope: "cnpj",
    mode: "api",
    officialUrl: "https://brasilapi.com.br/docs#tag/CNPJ",
    requiredFields: ["document"],
    optionalFields: [],
    summary: "Consulta cadastral publica de CNPJ com razao social, CNAE, endereco e situacao cadastral.",
    manualInstruction: "Consulta automatica por API publica. Se falhar, confira o CNPJ e tente novamente.",
  },
  {
    id: "datajud-cnj",
    name: "DataJud / CNJ",
    category: "judicial",
    scope: "cpf_cnpj",
    mode: "api",
    officialUrl: "https://datajud-wiki.cnj.jus.br/api-publica/",
    requiredFields: ["document"],
    optionalFields: ["name", "uf"],
    summary:
      "API publica de metadados processuais. Nao substitui certidao nada consta e nao garante busca direta por CPF/CNPJ.",
    manualInstruction:
      "Quando nao houver numero de processo ou criterio publico consultavel, use a certidao oficial do tribunal como evidencia.",
  },
  {
    id: "tjdft",
    name: "TJDFT Nada Consta",
    category: "judicial",
    scope: "cpf_cnpj",
    mode: "manual_guided",
    officialUrl: "https://www.tjdft.jus.br/servicos/certidoes/certidao-nada-consta",
    requiredFields: ["document", "name"],
    optionalFields: ["motherName", "birthDate"],
    summary: "Certidoes civel, criminal, especial e falencia/recuperacao emitidas no portal do TJDFT.",
    manualInstruction:
      "Abra a fonte oficial, informe CPF/CNPJ e dados solicitados, resolva a validacao do portal e anexe o PDF ou protocolo emitido.",
  },
  {
    id: "justica-federal",
    name: "Justica Federal / CJF / TRFs",
    category: "judicial",
    scope: "cpf_cnpj",
    mode: "manual_guided",
    officialUrl:
      "https://www.cjf.jus.br/cjf/noticias/2024/junho/cjf-lancara-sistema-de-certidao-unificada-da-justica-federal-durante-o-encontro-nacional-das-secoes-judiciarias",
    requiredFields: ["document", "name", "email"],
    optionalFields: ["uf"],
    summary: "Certidao unificada de distribuicao da Justica Federal por CPF/CNPJ, quando disponivel.",
    manualInstruction:
      "Use a certidao unificada/TRF correspondente, preencha o e-mail quando exigido e salve o PDF ou protocolo retornado.",
  },
  {
    id: "stj",
    name: "STJ Certidao de Distribuicao",
    category: "judicial",
    scope: "cpf_cnpj",
    mode: "manual_guided",
    officialUrl: "https://www.stj.jus.br/sites/portalp/Processos/Certidoes",
    requiredFields: ["document", "name"],
    optionalFields: [],
    summary: "Certidao judicial de distribuicao nos processos do Superior Tribunal de Justica.",
    manualInstruction:
      "Acesse o portal de certidoes do STJ, informe o documento e salve a certidao emitida.",
  },
  {
    id: "stf",
    name: "STF Certidoes Judiciais",
    category: "judicial",
    scope: "cpf_cnpj",
    mode: "manual_guided",
    officialUrl: "https://portal.stf.jus.br/",
    requiredFields: ["document", "name"],
    optionalFields: [],
    summary: "Certidoes judiciais disponiveis no portal do Supremo Tribunal Federal.",
    manualInstruction:
      "Use o servico de certidoes do STF, informe os dados exigidos e anexe o PDF ou protocolo.",
  },
  {
    id: "imoveis-onr",
    name: "Busca de Imóveis / ONR",
    category: "imobiliario",
    scope: "cpf_cnpj",
    mode: "manual_guided",
    officialUrl: "https://www.ridigital.org.br/PO/DefaultPO.aspx",
    requiredFields: ["document", "uf"],
    optionalFields: ["name", "registrationNumber", "registryOffice"],
    summary: "Pesquisa de matrículas, confirmação qualificada e certidão digital pelo ecossistema oficial ONR/RI Digital.",
    manualInstruction: "Conclua o pedido oficial no RI Digital e registre protocolo, relatório ou certidão na IA AUDITA. Não há scraping.",
  },
  {
    id: "cnib",
    name: "Indisponibilidade de Bens",
    category: "imobiliario",
    scope: "cpf_cnpj",
    mode: "api",
    officialUrl: "https://docs.bigdatacorp.com.br/plataforma/reference/marketplace-dados-restritivos-quod-pessoa",
    requiredFields: ["document"],
    optionalFields: [],
    summary: "Indicador de indisponibilidade de bens via BigDataCorp Marketplace, sem scraping.",
    manualInstruction:
      "Configure BIGDATACORP_CNIB_ENABLED=true, BIGDATACORP_ACCESS_TOKEN e BIGDATACORP_TOKEN_ID para consultar o provedor.",
  },
  {
    id: "tst-cndt",
    name: "TST CNDT",
    category: "trabalhista",
    scope: "cpf_cnpj",
    mode: "manual_guided",
    officialUrl: "https://cndt-certidao.tst.jus.br/inicio.faces",
    requiredFields: ["document"],
    optionalFields: ["name"],
    summary: "Certidao Negativa de Debitos Trabalhistas para CPF ou CNPJ.",
    manualInstruction:
      "Emita a CNDT no portal do TST, resolva o captcha quando exibido e anexe a certidao.",
  },
  {
    id: "ceat-trts",
    name: "CEAT / TRTs",
    category: "trabalhista",
    scope: "cpf_cnpj",
    mode: "manual_guided",
    officialUrl: "https://www.csjt.jus.br/web/csjt/certidoes",
    requiredFields: ["document", "uf"],
    optionalFields: ["name"],
    summary: "Certidao Eletronica de Acoes Trabalhistas por TRT/UF.",
    manualInstruction:
      "Selecione o TRT/UF de interesse, informe CPF/CNPJ e anexe o PDF retornado.",
  },
  {
    id: "receita-pgfn",
    name: "Receita Federal / PGFN",
    category: "fiscal",
    scope: "cpf_cnpj",
    mode: "manual_guided",
    officialUrl: "https://www.gov.br/receitafederal/pt-br/servicos/certidoes/consultar-certidoes-emitidas",
    requiredFields: ["document"],
    optionalFields: ["name"],
    summary: "Certidao conjunta de debitos federais e divida ativa da Uniao para CPF/CNPJ.",
    manualInstruction:
      "Consulte ou emita a certidao no portal Receita/PGFN e anexe o PDF ou protocolo.",
  },
  {
    id: "fgts-crf",
    name: "Caixa FGTS / CRF",
    category: "fiscal",
    scope: "cnpj",
    mode: "manual_guided",
    officialUrl: "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf",
    requiredFields: ["document"],
    optionalFields: ["ceiCaepf"],
    summary: "Regularidade do FGTS para empregador por CNPJ, CEI ou CAEPF.",
    manualInstruction:
      "Fonte aplicavel a empresa/empregador. Use CNPJ, CEI ou CAEPF e anexe o CRF emitido.",
  },
  {
    id: "tse-crimes-eleitorais",
    name: "TSE Crimes Eleitorais",
    category: "compliance",
    scope: "cpf",
    mode: "manual_guided",
    officialUrl: "https://www.tse.jus.br/eleitor/certidoes/certidoes",
    requiredFields: ["document", "name", "motherName", "birthDate"],
    optionalFields: [],
    summary: "Certidao de crimes eleitorais para pessoa fisica.",
    manualInstruction:
      "Informe CPF, nome, data de nascimento e filiacao conforme exigido pelo TSE, depois anexe a certidao.",
  },
  {
    id: "portal-transparencia",
    name: "Portal da Transparencia / CGU",
    category: "compliance",
    scope: "cpf_cnpj",
    mode: "api",
    officialUrl: "https://www.portaltransparencia.gov.br/sancoes",
    requiredFields: ["document"],
    optionalFields: [],
    summary: "Consulta CEIS, CNEP, CEAF e acordos de leniencia por CPF/CNPJ.",
    manualInstruction:
      "Configure PORTAL_TRANSPARENCIA_API_KEY para consultar automaticamente pela API de dados da CGU.",
  },
  {
    id: "cenprot",
    name: "CENPROT Protestos",
    category: "compliance",
    scope: "cpf_cnpj",
    mode: "manual_guided",
    officialUrl: "https://www.cenprot.com/",
    requiredFields: ["document"],
    optionalFields: ["name"],
    summary: "Consulta gratuita de existencia de protestos; certidao detalhada pode ter custo.",
    manualInstruction:
      "Consulte CPF/CNPJ no CENPROT. Anexe a tela/protocolo gratuito ou certidao detalhada quando contratada.",
  },
];

const ibgeBaseUrl = "https://servicodados.ibge.gov.br/api";
const builtinAssistantSources = [
  {
    id: "builtin:ibge-localidades",
    name: "IBGE Localidades",
    agency: "IBGE",
    category: "demografico",
    status: "active",
    description: "Estados e municípios por UF/código oficial.",
  },
  {
    id: "builtin:ibge-cnae",
    name: "IBGE CNAE",
    agency: "IBGE",
    category: "economico",
    status: "active",
    description: "Classes CNAE e atividades econômicas.",
  },
  {
    id: "builtin:ibge-populacao",
    name: "IBGE População estimada",
    agency: "IBGE/SIDRA",
    category: "demografico",
    status: "active",
    description: "Ranking populacional de municípios.",
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

async function loadFallbackAuth() {
  if (fallbackAuthLoaded) {
    return;
  }
  fallbackAuthLoaded = true;
  try {
    const data = JSON.parse(await readFile(fallbackAuthPath, "utf-8"));
    fallbackUserId = Number(data.nextUserId) || 1;
    fallbackUsers.clear();
    fallbackUsersByEmail.clear();
    fallbackSessions.clear();

    for (const user of Array.isArray(data.users) ? data.users : []) {
      fallbackUsers.set(user.id, user);
      fallbackUsersByEmail.set(String(user.email || "").toLowerCase(), user.id);
    }
    for (const session of Array.isArray(data.sessions) ? data.sessions : []) {
      if (session.tokenHash && session.expiresAt > Date.now()) {
        fallbackSessions.set(session.tokenHash, {
          userId: session.userId,
          expiresAt: session.expiresAt,
        });
      }
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn("[audita] local auth fallback unavailable:", error.message);
    }
  }
}

async function saveFallbackAuth() {
  await mkdir(dirname(fallbackAuthPath), { recursive: true });
  const payload = {
    nextUserId: fallbackUserId,
    users: [...fallbackUsers.values()],
    sessions: [...fallbackSessions.entries()].map(([tokenHash, session]) => ({
      tokenHash,
      userId: session.userId,
      expiresAt: session.expiresAt,
    })),
  };
  await writeFile(fallbackAuthPath, `${JSON.stringify(payload, null, 2)}\n`);
}

function createFallbackUser({ email, name, password, role = "owner" }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (fallbackUsersByEmail.has(normalizedEmail)) {
    return null;
  }
  const userId = fallbackUserId++;
  const tenant = buildSelfServeTenantIdentity({
    name,
    email: normalizedEmail,
    nonce: `local-${userId}`,
  });
  const user = {
    id: userId,
    tenant_id: `local-${userId}`,
    tenant_name: tenant.name,
    tenant_slug: tenant.slug,
    email: normalizedEmail,
    name,
    role,
    password_hash: hashPassword(password),
    status: "active",
  };
  fallbackUsers.set(user.id, user);
  fallbackUsersByEmail.set(normalizedEmail, user.id);
  return user;
}

function getFallbackUserByEmail(email) {
  const id = fallbackUsersByEmail.get(String(email || "").trim().toLowerCase());
  return id ? fallbackUsers.get(id) : null;
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

function normalizeDocument(value) {
  return String(value || "").replace(/\D/g, "");
}

function validateCpf(value) {
  const cpf = normalizeDocument(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) {
    return false;
  }

  const calculateDigit = (base) => {
    const sum = base
      .split("")
      .map(Number)
      .reduce((total, digit, index) => total + digit * (base.length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(cpf.slice(0, 9)) === Number(cpf[9]) && calculateDigit(cpf.slice(0, 10)) === Number(cpf[10]);
}

function validateCnpj(value) {
  const cnpj = normalizeDocument(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) {
    return false;
  }

  const calculateDigit = (base, weights) => {
    const sum = base
      .split("")
      .map(Number)
      .reduce((total, digit, index) => total + digit * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondWeights = [6, ...firstWeights];
  return (
    calculateDigit(cnpj.slice(0, 12), firstWeights) === Number(cnpj[12]) &&
    calculateDigit(cnpj.slice(0, 13), secondWeights) === Number(cnpj[13])
  );
}

function isValidDocument(documentType, documentValue) {
  return documentType === "cpf" ? validateCpf(documentValue) : validateCnpj(documentValue);
}

function formatDocument(documentType, documentValue) {
  const digits = normalizeDocument(documentValue);
  if (documentType === "cpf" && digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  if (documentType === "cnpj" && digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  return documentValue;
}

function formatAuditFieldLabel(field) {
  const labels = {
    document: "documento",
    name: "nome/razao social",
    motherName: "nome da mae",
    birthDate: "data de nascimento",
    email: "e-mail",
    uf: "UF/TRT",
    ceiCaepf: "CEI/CAEPF",
  };
  return labels[field] || field;
}

function isSourceApplicable(source, documentType) {
  return source.scope === "cpf_cnpj" || source.scope === documentType;
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text.slice(0, 1000) };
    }
    if (!response.ok) {
      const error = new Error(`Fonte retornou HTTP ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function summarizeBrasilApiCnpj(data) {
  if (data.company || data.taxId) {
    const address = data.address
      ? [data.address.street, data.address.number, data.address.district, data.address.city, data.address.state].filter(Boolean).join(", ")
      : "";
    return [
      `CNPJ localizado na base publica: ${data.company?.name || data.alias || "nome nao informado"}.`,
      data.alias ? `Nome fantasia: ${data.alias}.` : "",
      `Situacao: ${data.status?.text || "nao informada"}.`,
      data.mainActivity?.text ? `Atividade principal: ${data.mainActivity.text}.` : "",
      address ? `Endereco: ${address}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  const address = [data.descricao_tipo_de_logradouro, data.logradouro, data.numero, data.bairro, data.municipio, data.uf]
    .filter(Boolean)
    .join(", ");
  const cnae = data.cnae_fiscal_descricao || data.cnae_fiscal || "CNAE nao informado";
  return [
    `CNPJ localizado na consulta cadastral publica: ${data.razao_social || data.nome_fantasia || "nome nao informado"}.`,
    `Situacao: ${data.descricao_situacao_cadastral || "nao informada"}.`,
    `CNAE: ${cnae}.`,
    address ? `Endereco: ${address}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

async function runBrasilApiCnpj(input) {
  if (input.documentType !== "cnpj") {
    return { status: "not_applicable", summary: "Consulta cadastral CNPJ nao se aplica a CPF.", evidence: [] };
  }
  const endpoints = [
    `https://brasilapi.com.br/api/cnpj/v1/${input.document}`,
    `https://open.cnpja.com/office/${input.document}`,
  ];
  let data = null;
  let endpoint = "";
  let lastError = null;
  for (const candidate of endpoints) {
    try {
      data = await fetchJsonWithTimeout(candidate, {
        headers: {
          accept: "application/json",
          "user-agent": "Audita/0.1 cnpj-public-audit",
        },
      });
      endpoint = candidate;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!data) {
    throw lastError || new Error("Nenhuma API publica de CNPJ respondeu");
  }
  const normalizedSummary = summarizeBrasilApiCnpj(data);
  return {
    status: "completed",
    summary: normalizedSummary,
    evidence: [
      { type: "summary", title: "Dados cadastrais CNPJ", value: normalizedSummary },
      { type: "official_url", title: "Endpoint consultado", value: endpoint },
      {
        type: "summary",
        title: "Campos normalizados",
        value: JSON.stringify({
          razaoSocial: data.razao_social || data.company?.name,
          nomeFantasia: data.nome_fantasia || data.alias,
          situacao: data.descricao_situacao_cadastral || data.status?.text,
          cnae: data.cnae_fiscal_descricao || data.mainActivity?.text,
          municipio: data.municipio || data.address?.city,
          uf: data.uf || data.address?.state,
        }),
      },
    ],
  };
}

async function runPortalTransparencia(input) {
  const apiKey = process.env.PORTAL_TRANSPARENCIA_API_KEY || process.env.CGU_API_KEY || "";
  if (!apiKey) {
    return {
      status: "blocked",
      summary:
        "Portal da Transparencia tem API publica, mas exige chave gratuita. Configure PORTAL_TRANSPARENCIA_API_KEY para consulta automatica.",
      evidence: [
        {
          type: "manual_step",
          title: "Chave de API pendente",
          value:
            "Cadastre uma chave no Portal da Transparencia e configure PORTAL_TRANSPARENCIA_API_KEY no ambiente do servidor.",
        },
      ],
    };
  }

  const headers = {
    accept: "application/json",
    "chave-api-dados": apiKey,
    "user-agent": "Audita/0.1 public-api-audit",
  };
  const bases = [
    ["CEIS", "https://api.portaldatransparencia.gov.br/api-de-dados/ceis"],
    ["CNEP", "https://api.portaldatransparencia.gov.br/api-de-dados/cnep"],
    ["CEAF", "https://api.portaldatransparencia.gov.br/api-de-dados/ceaf"],
    ["Acordos de leniencia", "https://api.portaldatransparencia.gov.br/api-de-dados/acordos-leniencia"],
  ];
  const results = [];
  for (const [label, baseUrl] of bases) {
    const endpoint = `${baseUrl}?cpfCnpj=${encodeURIComponent(input.document)}&pagina=1`;
    try {
      const data = await fetchJsonWithTimeout(endpoint, { headers });
      results.push({ label, endpoint, data: Array.isArray(data) ? data : data ? [data] : [] });
    } catch (error) {
      results.push({ label, endpoint, error: error.message });
    }
  }

  const total = results.reduce((sum, result) => sum + (Array.isArray(result.data) ? result.data.length : 0), 0);
  const failed = results.filter((result) => result.error);
  const summary =
    failed.length === results.length
      ? "Nao foi possivel consultar a API do Portal da Transparencia agora. Verifique a chave e tente novamente."
      : `Portal da Transparencia consultado em ${results.length - failed.length} base(s). Registros encontrados: ${total}.`;

  return {
    status: failed.length === results.length ? "failed" : "completed",
    summary,
    evidence: [
      { type: "summary", title: "Resultado CGU", value: summary },
      ...results.map((result) => ({
        type: result.error ? "manual_step" : "summary",
        title: result.label,
        value: result.error
          ? `${result.error}. Endpoint: ${result.endpoint}`
          : `${result.data.length} registro(s). Endpoint: ${result.endpoint}`,
      })),
    ],
  };
}

async function runDataJud(input) {
  const processNumber = String(input.processNumber || "").replace(/\D/g, "");
  if (!processNumber) {
    return {
      status: "blocked",
      summary:
        "DataJud/CNJ e uma API publica de metadados processuais, mas nao oferece certidao por CPF/CNPJ neste fluxo. Informe numero de processo em futura versao ou use certidao oficial como evidencia.",
      evidence: [
        {
          type: "manual_step",
          title: "Criterio publico insuficiente",
          value:
            "CPF/CNPJ nao e criterio confiavel/publico para esta consulta automatica. A API DataJud deve ser usada para metadados processuais publicos.",
        },
      ],
    };
  }

  const endpoint = "https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search";
  const apiKey =
    process.env.DATAJUD_API_KEY ||
    "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
  const data = await fetchJsonWithTimeout(endpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      Authorization: `APIKey ${apiKey}`,
      "user-agent": "Audita/0.1 datajud-audit",
    },
    body: JSON.stringify({
      query: { match: { numeroProcesso: processNumber } },
      size: 10,
    }),
  });
  const total = data?.hits?.total?.value || data?.hits?.hits?.length || 0;
  return {
    status: "completed",
    summary: `DataJud consultado para o processo informado. Registros encontrados: ${total}.`,
    evidence: [
      { type: "summary", title: "DataJud/CNJ", value: `Registros encontrados: ${total}` },
      { type: "official_url", title: "Endpoint consultado", value: endpoint },
    ],
  };
}

async function runApiAuditSource(source, input) {
  try {
    if (source.id === "brasilapi-cnpj") {
      return await runBrasilApiCnpj(input);
    }
    if (source.id === "portal-transparencia") {
      return await runPortalTransparencia(input);
    }
    if (source.id === "datajud-cnj") {
      return await runDataJud(input);
    }
  } catch (error) {
    return {
      status: error.status === 404 ? "not_applicable" : "failed",
      summary: `${source.name}: ${error.message || "falha na consulta da API"}.`,
      evidence: [
        {
          type: "manual_step",
          title: "Falha na API",
          value: "Tente novamente mais tarde ou use a fonte oficial manualmente.",
        },
      ],
    };
  }
  return null;
}

async function buildAuditExecution(source, input) {
  if (!isSourceApplicable(source, input.documentType)) {
    return {
      sourceId: source.id,
      sourceName: source.name,
      category: source.category,
      mode: source.mode,
      status: "not_applicable",
      summary: `${source.name} nao se aplica a ${input.documentType.toUpperCase()} neste fluxo.`,
      officialUrl: source.officialUrl,
      missingFields: [],
      manualInstruction: "",
      evidence: [],
    };
  }

  const apiResult = source.mode === "api" ? await runApiAuditSource(source, input) : null;
  if (apiResult) {
    return {
      sourceId: source.id,
      sourceName: source.name,
      category: source.category,
      mode: source.mode,
      status: apiResult.status,
      summary: apiResult.summary,
      officialUrl: source.officialUrl,
      missingFields: [],
      manualInstruction: apiResult.status === "completed" ? "" : source.manualInstruction,
      evidence: [
        {
          type: "summary",
          title: source.name,
          value: source.summary,
        },
        {
          type: "official_url",
          title: "Fonte oficial",
          value: source.officialUrl,
        },
        ...(apiResult.evidence || []),
      ],
    };
  }

  const missingFields = source.requiredFields
    .filter((field) => field !== "document")
    .filter((field) => !String(input[field] || "").trim());
  const status = missingFields.length || source.mode !== "api" ? "manual_required" : "completed";
  const evidence = [
    {
      type: "summary",
      title: source.name,
      value: source.summary,
    },
    {
      type: "official_url",
      title: "Fonte oficial",
      value: source.officialUrl,
    },
  ];

  if (status === "manual_required") {
    evidence.push({
      type: "manual_step",
      title: missingFields.length ? "Campos pendentes" : "Acao manual guiada",
      value: missingFields.length
        ? `Preencha antes de emitir: ${missingFields.map(formatAuditFieldLabel).join(", ")}.`
        : source.manualInstruction,
    });
  }

  return {
    sourceId: source.id,
    sourceName: source.name,
    category: source.category,
    mode: source.mode,
    status,
    summary:
      status === "completed"
        ? `${source.name} concluida pela integracao configurada.`
        : `${source.name}: ${source.manualInstruction}`,
    officialUrl: source.officialUrl,
    missingFields,
    manualInstruction: source.manualInstruction,
    evidence,
  };
}

function summarizeAuditStatus(executions) {
  const actionable = executions.filter((execution) => execution.status !== "not_applicable");
  if (actionable.some((execution) => execution.status === "failed")) {
    return "failed";
  }
  if (actionable.some((execution) => execution.status === "manual_required" || execution.status === "blocked")) {
    return "manual_required";
  }
  if (actionable.length && actionable.every((execution) => execution.status === "completed")) {
    return "completed";
  }
  return "queued";
}

function publicAudit(row, executions = []) {
  return {
    id: row.id,
    documentType: row.document_type || row.documentType,
    documentMasked: row.document_masked || row.documentMasked,
    subjectName: row.subject_name || row.subjectName,
    status: row.status,
    authorizationConfirmed: row.authorization_confirmed ?? row.authorizationConfirmed,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
    executions,
  };
}

function mapAuditExecution(row, evidence = []) {
  return {
    id: row.id,
    sourceId: row.source_id || row.sourceId,
    sourceName: row.source_name || row.sourceName,
    category: row.category,
    mode: row.mode,
    status: row.status,
    summary: row.summary,
    officialUrl: row.official_url || row.officialUrl,
    missingFields: row.missing_fields || row.missingFields || [],
    manualInstruction: row.manual_instruction || row.manualInstruction,
    evidence,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
}

async function createFallbackAudit(input, authContext) {
  const documentHash = hashSubjectIdentifier(authContext.tenantId || "demo", input.document);
  const builtExecutions = await Promise.all(auditSources.map((source) => buildAuditExecution(source, input)));
  const executions = builtExecutions.map((execution, index) => ({
      id: `${Date.now()}-${index + 1}`,
      ...execution,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  const audit = {
    id: String(Date.now()),
    tenantId: authContext.tenantId || "demo",
    userId: authContext.user?.id || null,
    documentType: input.documentType,
    documentHash,
    documentMasked: maskIdentifier(formatDocument(input.documentType, input.document)),
    subjectName: input.name,
    status: summarizeAuditStatus(executions),
    authorizationConfirmed: true,
    metadata: input,
    executions,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  fallbackAudits.unshift(audit);
  return publicAudit(audit, executions);
}

async function bootstrapAdminUser() {
  if (!pool || !defaultTenantId) {
    return;
  }

  const email = String(process.env.AUDITA_BOOTSTRAP_ADMIN_EMAIL || "").trim();
  const password = String(process.env.AUDITA_BOOTSTRAP_ADMIN_PASSWORD || "").trim();
  const name = String(process.env.AUDITA_BOOTSTRAP_ADMIN_NAME || "IA AUDITA Admin").trim();

  if (!email || !password) {
    return;
  }

  await pool.query(
    `INSERT INTO audita_users (tenant_id, email, name, role, password_hash)
     VALUES ($1, LOWER($2), $3, 'super_admin', $4)
     ON CONFLICT (email)
     DO UPDATE SET
       tenant_id = EXCLUDED.tenant_id,
       name = EXCLUDED.name,
       role = 'super_admin',
       status = 'active',
       password_hash = EXCLUDED.password_hash,
       updated_at = NOW()`,
    [defaultTenantId, email, name, hashPassword(password)],
  );
}

async function ensureBootstrapUserForLogin(email, password) {
  const bootstrapEmail = String(process.env.AUDITA_BOOTSTRAP_ADMIN_EMAIL || "").trim().toLowerCase();
  const bootstrapPassword = String(process.env.AUDITA_BOOTSTRAP_ADMIN_PASSWORD || "").trim();

  if (!bootstrapEmail || !bootstrapPassword) {
    return;
  }

  if (email === bootstrapEmail && password === bootstrapPassword) {
    if (pool && dbReady) {
      await bootstrapAdminUser();
      return;
    }
    await loadFallbackAuth();
    const existing = getFallbackUserByEmail(email);
    if (existing) {
      existing.role = "super_admin";
      existing.status = "active";
      existing.name = String(process.env.AUDITA_BOOTSTRAP_ADMIN_NAME || "Audita Super Admin").trim();
      existing.password_hash = hashPassword(password);
    } else {
      createFallbackUser({
        email,
        password,
        name: String(process.env.AUDITA_BOOTSTRAP_ADMIN_NAME || "Audita Super Admin").trim(),
        role: "super_admin",
      });
    }
    await saveFallbackAuth();
  }
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
    if (body.length > 1024 * 1024 * 3) {
      throw new Error("Request body too large");
    }
  }

  return body ? JSON.parse(body) : {};
}

async function initializeProfileEncryptionKey() {
  if (profileEncryptionKey || appEnv !== "local") return;
  const keyPath = join(root, "storage", "profile-encryption.key");
  let secret = "";
  try {
    secret = (await readFile(keyPath, "utf8")).trim();
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    secret = crypto.randomBytes(48).toString("base64");
    await mkdir(dirname(keyPath), { recursive: true });
    await writeFile(keyPath, `${secret}\n`, { encoding: "utf8", mode: 0o600 });
  }
  profileEncryptionKey = resolveProfileEncryptionKey(secret);
}

async function readBufferBody(request, maxBytes = 12 * 1024 * 1024) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) {
      const error = new Error("Request body too large");
      error.code = "BODY_TOO_LARGE";
      throw error;
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function getSessionUser(request) {
  const cookies = parseCookies(request);
  const token = cookies[sessionCookieName];

  if (!pool || !dbReady) {
    await loadFallbackAuth();
    if (!token) {
      return null;
    }
    const session = fallbackSessions.get(hashToken(token));
    if (!session || session.expiresAt <= Date.now()) {
      return null;
    }
    return fallbackUsers.get(session.userId) || null;
  }

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

function profileEncryptionContext(user) {
  return `${user?.tenant_id || "local"}:${user?.id || "anonymous"}`;
}

async function loadUserProfile(user) {
  const account = { name: user?.name || "", email: user?.email || "" };
  if (!profileEncryptionKey) {
    return {
      profile: profileForClient({}, account),
      stored: false,
      storageConfigured: false,
    };
  }

  let encryptedPayload = "";
  if (!pool || !dbReady) {
    await loadFallbackAuth();
    encryptedPayload = fallbackUsers.get(user.id)?.profile_encrypted || "";
  } else {
    const result = await pool.query(
      `SELECT encrypted_payload
       FROM audita_user_profiles
       WHERE tenant_id = $1 AND user_id = $2
       LIMIT 1`,
      [user.tenant_id, user.id],
    );
    encryptedPayload = result.rows[0]?.encrypted_payload || "";
  }

  const profile = encryptedPayload
    ? decryptUserProfile(
        encryptedPayload,
        profileEncryptionKey,
        profileEncryptionContext(user),
      )
    : {};
  return {
    profile: profileForClient(profile, account),
    stored: Boolean(encryptedPayload),
    storageConfigured: true,
  };
}

async function saveUserProfile(user, input) {
  if (!profileEncryptionKey) {
    const error = new Error("profile_encryption_not_configured");
    error.code = "profile_encryption_not_configured";
    throw error;
  }
  const profile = normalizeUserProfile(input);
  const encryptedPayload = encryptUserProfile(
    profile,
    profileEncryptionKey,
    profileEncryptionContext(user),
  );

  if (!pool || !dbReady) {
    await loadFallbackAuth();
    const fallbackUser = fallbackUsers.get(user.id);
    if (!fallbackUser) throw new Error("profile_user_not_found");
    fallbackUser.profile_encrypted = encryptedPayload;
    await saveFallbackAuth();
  } else {
    await pool.query(
      `INSERT INTO audita_user_profiles (
         tenant_id, user_id, encrypted_payload, payload_version, created_at, updated_at
       )
       VALUES ($1, $2, $3, 1, NOW(), NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         encrypted_payload = EXCLUDED.encrypted_payload,
         payload_version = EXCLUDED.payload_version,
         updated_at = NOW()`,
      [user.tenant_id, user.id, encryptedPayload],
    );
  }

  return profileForClient(profile, {
    name: user.name,
    email: user.email,
  });
}

function canManageIntegrations(user) {
  return ["super_admin", "owner", "admin"].includes(user?.role);
}

function lockedItauCase(caseData = {}) {
  return {
    id: caseData.id || "",
    status: "access_required",
    locked: true,
    document: {
      fileName: caseData.document?.fileName || "Documento analisado",
      mimeType: caseData.document?.mimeType || "",
    },
  };
}

function itauCaseHasFindings(caseData = {}) {
  return Array.isArray(caseData.candidates) && caseData.candidates.length > 0;
}

let itauCheckoutIpcaCache = { expiresAt: 0, rates: [] };

async function loadItauCheckoutIpcaRates() {
  if (itauCheckoutIpcaCache.expiresAt > Date.now()) return itauCheckoutIpcaCache.rates;
  const response = await fetch(
    "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json&dataInicial=01/01/2011",
    { signal: AbortSignal.timeout(10000) },
  );
  if (!response.ok) throw new Error("ipca_unavailable");
  const rates = await response.json();
  if (!Array.isArray(rates) || !rates.length) throw new Error("ipca_unavailable");
  itauCheckoutIpcaCache = { expiresAt: Date.now() + 6 * 60 * 60 * 1000, rates };
  return rates;
}

async function createSession(response, request, userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);

  if (!pool || !dbReady) {
    await loadFallbackAuth();
    fallbackSessions.set(tokenHash, {
      userId,
      expiresAt: Date.now() + 12 * 60 * 60 * 1000,
    });
    await saveFallbackAuth();
    setSessionCookie(request, response, token);
    return;
  }

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

const apiUsageService = createApiUsageService({ getDb: () => ({ pool, dbReady }) });
const openAIOfficialUsageService = createOpenAIOfficialUsageService();
const auditService = createAuditService({
  getDb: () => ({ pool, dbReady }),
  getAuthContext: getTenantIdForRequest,
  recordApiUsage: (usageContext, event) => apiUsageService.record(usageContext, event),
});
const creditsService = createCreditsService({ getDb: () => ({ pool, dbReady }) });
const billingAccessService = createBillingAccessService({
  getDb: () => ({ pool, dbReady }),
  listFallbackUsers: () => [...fallbackUsers.values()],
  isDemoModeEnabled: () =>
    String(process.env.AUDITA_BILLING_DEMO_MODE || "").trim().toLowerCase() === "true",
});
const stripeBillingService = createStripeBillingService({
  getDb: () => ({ pool, dbReady }),
  creditsService,
  accessService: billingAccessService,
});
const billingAdminService = createBillingAdminService({
  getDb: () => ({ pool, dbReady }),
  accessService: billingAccessService,
  getSubscription: (tenantId) => stripeBillingService.getSubscription(tenantId),
});
const superAdminService = createSuperAdminService({
  getDb: () => ({ pool, dbReady }),
  billingAdminService,
  updateFallbackUser: (userId, changes) => {
    const user = fallbackUsers.get(Number(userId)) || fallbackUsers.get(userId);
    if (!user || user.role === "super_admin") return null;
    if (changes.status) user.status = changes.status;
    if (changes.role) user.role = changes.role;
    saveFallbackAuth().catch(() => {});
    return publicUser(user);
  },
});
const directDataCourtService = createDirectDataCourtService({
  creditsService,
  recordApiUsage: (usageContext, event) =>
    apiUsageService.record(usageContext, event),
});
const directDataCertificatesService = createDirectDataCertificatesService({
  creditsService,
  recordApiUsage: (usageContext, event) =>
    apiUsageService.record(usageContext, event),
});
const directDataPersonService = createDirectDataPersonService({
  creditsService,
  recordApiUsage: (usageContext, event) =>
    apiUsageService.record(usageContext, event),
});
const propertyAssetsService = createPropertyAssetsService({
  getDb: () => ({ pool, dbReady }),
  getAuthContext: getTenantIdForRequest,
  creditsService,
});
const itauRefundService = createItauRefundService();
const chatBrowserService = createChatBrowserService();
const jecTestimonyService = createJecTestimonyService();

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
      : `Módulo ${module.name} está em preparação; consulta registrada para rastreabilidade.`;

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

async function listAudits(request) {
  const authContext = await getTenantIdForRequest(request);
  if (authContext.unauthorized) {
    return { unauthorized: true };
  }

  if (!pool || !dbReady) {
    return fallbackAudits.slice(0, 8).map((audit) => publicAudit(audit, audit.executions));
  }

  const result = await pool.query(
    `SELECT
       id,
       document_type,
       document_masked,
       subject_name,
       status,
       authorization_confirmed,
       created_at,
       updated_at
     FROM audita_audits
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT 8`,
    [authContext.tenantId],
  );

  return result.rows.map((audit) => publicAudit(audit));
}

async function getAudit(request, auditId) {
  const authContext = await getTenantIdForRequest(request);
  if (authContext.unauthorized) {
    return { unauthorized: true };
  }

  if (!pool || !dbReady) {
    const audit = fallbackAudits.find((item) => String(item.id) === String(auditId));
    return audit ? publicAudit(audit, audit.executions) : { notFound: true };
  }

  const auditResult = await pool.query(
    `SELECT
       id,
       document_type,
       document_masked,
       subject_name,
       status,
       authorization_confirmed,
       created_at,
       updated_at
     FROM audita_audits
     WHERE tenant_id = $1 AND id = $2
     LIMIT 1`,
    [authContext.tenantId, auditId],
  );
  const audit = auditResult.rows[0];
  if (!audit) {
    return { notFound: true };
  }

  const executionResult = await pool.query(
    `SELECT
       id,
       source_id,
       source_name,
       category,
       mode,
       status,
       summary,
       official_url,
       missing_fields AS "missingFields",
       manual_instruction,
       created_at,
       updated_at
     FROM audita_audit_executions
     WHERE audit_id = $1
     ORDER BY id`,
    [audit.id],
  );
  const evidenceResult = await pool.query(
    `SELECT
       id,
       audit_execution_id,
       evidence_type AS type,
       title,
       value,
       file_name AS "fileName",
       content_base64 AS "contentBase64",
       created_at AS "createdAt"
     FROM audita_audit_evidence
     WHERE audit_id = $1
     ORDER BY created_at`,
    [audit.id],
  );
  const evidenceByExecution = evidenceResult.rows.reduce((grouped, evidence) => {
    const key = String(evidence.audit_execution_id);
    grouped[key] = grouped[key] || [];
    grouped[key].push(evidence);
    return grouped;
  }, {});
  const executions = executionResult.rows.map((execution) =>
    mapAuditExecution(execution, evidenceByExecution[String(execution.id)] || []),
  );

  return publicAudit(audit, executions);
}

async function createAudit(request) {
  const authContext = await getTenantIdForRequest(request);
  if (authContext.unauthorized) {
    return { unauthorized: true };
  }

  const body = await readJsonBody(request);
  const documentType = String(body.documentType || "").trim().toLowerCase();
  const document = normalizeDocument(body.document);
  const input = {
    documentType,
    document,
    name: String(body.name || "").trim(),
    motherName: String(body.motherName || "").trim(),
    birthDate: String(body.birthDate || "").trim(),
    email: String(body.email || "").trim(),
    uf: String(body.uf || "").trim().toUpperCase(),
    ceiCaepf: String(body.ceiCaepf || "").trim(),
  };

  if (!["cpf", "cnpj"].includes(documentType) || !isValidDocument(documentType, document) || !body.authorizationConfirmed) {
    return { invalid: true };
  }

  if (!pool || !dbReady) {
    return await createFallbackAudit(input, authContext);
  }

  const documentHash = hashSubjectIdentifier(authContext.tenantId, document);
  const documentMasked = maskIdentifier(formatDocument(documentType, document));
  const executions = await Promise.all(auditSources.map((source) => buildAuditExecution(source, input)));
  const status = summarizeAuditStatus(executions);

  const auditResult = await pool.query(
    `INSERT INTO audita_audits (
       tenant_id,
       requested_by_user_id,
       document_type,
       document_hash,
       document_masked,
       subject_name,
       status,
       authorization_confirmed,
       request_payload
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
     RETURNING id, document_type, document_masked, subject_name, status, authorization_confirmed, created_at, updated_at`,
    [
      authContext.tenantId,
      authContext.user?.id || null,
      documentType,
      documentHash,
      documentMasked,
      input.name,
      status,
      JSON.stringify({
        documentType,
        nameProvided: Boolean(input.name),
        motherNameProvided: Boolean(input.motherName),
        birthDateProvided: Boolean(input.birthDate),
        emailProvided: Boolean(input.email),
        uf: input.uf,
        ceiCaepfProvided: Boolean(input.ceiCaepf),
      }),
    ],
  );
  const audit = auditResult.rows[0];
  const persistedExecutions = [];

  for (const execution of executions) {
    const executionResult = await pool.query(
      `INSERT INTO audita_audit_executions (
         audit_id,
         source_id,
         source_name,
         category,
         mode,
         status,
         summary,
         official_url,
         missing_fields,
         manual_instruction
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, source_id, source_name, category, mode, status, summary, official_url, missing_fields AS "missingFields", manual_instruction, created_at, updated_at`,
      [
        audit.id,
        execution.sourceId,
        execution.sourceName,
        execution.category,
        execution.mode,
        execution.status,
        execution.summary,
        execution.officialUrl,
        execution.missingFields,
        execution.manualInstruction,
      ],
    );
    const persistedExecution = executionResult.rows[0];
    for (const evidence of execution.evidence) {
      await pool.query(
        `INSERT INTO audita_audit_evidence (
           audit_id,
           audit_execution_id,
           evidence_type,
           title,
           value
         )
         VALUES ($1, $2, $3, $4, $5)`,
        [audit.id, persistedExecution.id, evidence.type, evidence.title, evidence.value],
      );
    }
    persistedExecutions.push(mapAuditExecution(persistedExecution, execution.evidence));
  }

  await pool.query(
    `INSERT INTO audita_app_events (tenant_id, event_type, payload)
     VALUES ($1, 'audit.created', $2)`,
    [
      authContext.tenantId,
      JSON.stringify({
        auditId: audit.id,
        documentType,
        documentMasked,
        status,
        sources: executions.length,
      }),
    ],
  );

  return publicAudit(audit, persistedExecutions);
}

async function addAuditEvidence(request, auditId) {
  const authContext = await getTenantIdForRequest(request);
  if (authContext.unauthorized) {
    return { unauthorized: true };
  }

  const body = await readJsonBody(request);
  const executionId = String(body.executionId || "").trim();
  const evidenceType = String(body.evidenceType || "").trim();
  const title = String(body.title || "").trim();
  const value = String(body.value || "").trim();
  const fileName = String(body.fileName || "").trim();
  const contentBase64 = String(body.contentBase64 || "").trim();

  if (!executionId || !["summary", "official_url", "protocol", "pdf", "manual_step"].includes(evidenceType) || !title) {
    return { invalid: true };
  }

  if (!pool || !dbReady) {
    const audit = fallbackAudits.find((item) => String(item.id) === String(auditId));
    const execution = audit?.executions.find((item) => String(item.id) === executionId);
    if (!audit || !execution) {
      return { notFound: true };
    }
    const evidence = {
      id: String(Date.now()),
      type: evidenceType,
      title,
      value,
      fileName,
      contentBase64,
      createdAt: new Date().toISOString(),
    };
    execution.evidence.push(evidence);
    execution.status = "completed";
    execution.summary = value || `${title} anexado.`;
    execution.updatedAt = new Date().toISOString();
    audit.status = summarizeAuditStatus(audit.executions);
    audit.updatedAt = new Date().toISOString();
    return { evidence, audit: publicAudit(audit, audit.executions) };
  }

  const executionResult = await pool.query(
    `SELECT ae.id, ae.audit_id
     FROM audita_audit_executions ae
     JOIN audita_audits a ON a.id = ae.audit_id
     WHERE a.tenant_id = $1 AND a.id = $2 AND ae.id = $3
     LIMIT 1`,
    [authContext.tenantId, auditId, executionId],
  );
  const execution = executionResult.rows[0];
  if (!execution) {
    return { notFound: true };
  }

  const evidenceResult = await pool.query(
    `INSERT INTO audita_audit_evidence (
       audit_id,
       audit_execution_id,
       evidence_type,
       title,
       value,
       file_name,
       content_base64
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, evidence_type AS type, title, value, file_name AS "fileName", content_base64 AS "contentBase64", created_at AS "createdAt"`,
    [auditId, executionId, evidenceType, title, value, fileName || null, contentBase64 || null],
  );

  await pool.query(
    `UPDATE audita_audit_executions
     SET status = 'completed',
         summary = COALESCE(NULLIF($2, ''), summary),
         updated_at = NOW()
     WHERE id = $1`,
    [executionId, value],
  );

  const statusResult = await pool.query(
    `SELECT status FROM audita_audit_executions WHERE audit_id = $1`,
    [auditId],
  );
  const newStatus = summarizeAuditStatus(statusResult.rows);
  await pool.query("UPDATE audita_audits SET status = $1, updated_at = NOW() WHERE id = $2", [newStatus, auditId]);

  return { evidence: evidenceResult.rows[0], audit: await getAudit(request, auditId) };
}

async function listApiSources(request) {
  if (!pool || !dbReady) {
    return [];
  }

  const authContext = await getTenantIdForRequest(request);
  if (authContext.unauthorized) {
    return { unauthorized: true };
  }

  const result = await pool.query(
    `SELECT
       id,
       name,
       agency,
       category,
       base_url AS "baseUrl",
       access_method AS "accessMethod",
       auth_type AS "authType",
       secret_ref AS "secretRef",
       status,
       normalization_status AS "normalizationStatus",
       schema_notes AS "schemaNotes",
       created_at AS "createdAt",
       updated_at AS "updatedAt"
     FROM audita_api_sources
     WHERE tenant_id = $1
     ORDER BY updated_at DESC, name`,
    [authContext.tenantId],
  );

  return result.rows;
}

async function createApiSource(request) {
  if (!pool || !dbReady) {
    return { unavailable: true };
  }

  const authContext = await getTenantIdForRequest(request);
  if (authContext.unauthorized) {
    return { unauthorized: true };
  }
  if (!canManageIntegrations(authContext.user)) {
    return { forbidden: true };
  }

  const body = await readJsonBody(request);
  const name = String(body.name || "").trim();
  const agency = String(body.agency || "").trim();
  const category = String(body.category || "").trim();
  const baseUrl = String(body.baseUrl || "").trim();
  const accessMethod = String(body.accessMethod || "api").trim();
  const authType = String(body.authType || "none").trim();
  const secretRef = String(body.secretRef || "").trim() || null;
  const status = String(body.status || "draft").trim();
  const normalizationStatus = String(body.normalizationStatus || "pending").trim();
  const schemaNotes = String(body.schemaNotes || "").trim() || null;

  if (!name || !agency || !category || !baseUrl) {
    return { invalid: true };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    return { invalid: true };
  }

  if (!["https:", "http:"].includes(parsedUrl.protocol)) {
    return { invalid: true };
  }

  const result = await pool.query(
    `INSERT INTO audita_api_sources (
       tenant_id,
       name,
       agency,
       category,
       base_url,
       access_method,
       auth_type,
       secret_ref,
       status,
       normalization_status,
       schema_notes,
       created_by_user_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (tenant_id, name)
     DO UPDATE SET
       agency = EXCLUDED.agency,
       category = EXCLUDED.category,
       base_url = EXCLUDED.base_url,
       access_method = EXCLUDED.access_method,
       auth_type = EXCLUDED.auth_type,
       secret_ref = EXCLUDED.secret_ref,
       status = EXCLUDED.status,
       normalization_status = EXCLUDED.normalization_status,
       schema_notes = EXCLUDED.schema_notes,
       updated_at = NOW()
     RETURNING
       id,
       name,
       agency,
       category,
       base_url AS "baseUrl",
       access_method AS "accessMethod",
       auth_type AS "authType",
       secret_ref AS "secretRef",
       status,
       normalization_status AS "normalizationStatus",
       schema_notes AS "schemaNotes",
       created_at AS "createdAt",
       updated_at AS "updatedAt"`,
    [
      authContext.tenantId,
      name,
      agency,
      category,
      parsedUrl.toString(),
      accessMethod,
      authType,
      secretRef,
      status,
      normalizationStatus,
      schemaNotes,
      authContext.user?.id || null,
    ],
  );

  await pool.query(
    `INSERT INTO audita_app_events (tenant_id, event_type, payload)
     VALUES ($1, 'integration.source.saved', $2)`,
    [
      authContext.tenantId,
      JSON.stringify({
        name,
        agency,
        category,
        status,
        normalizationStatus,
        secretRef: Boolean(secretRef),
      }),
    ],
  );

  return result.rows[0];
}

function normalizeQuestion(question) {
  return String(question || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Audita/0.1 government-consultation-agent",
    },
  });

  if (!response.ok) {
    throw new Error(`Fonte retornou HTTP ${response.status}`);
  }

  return response.json();
}

function isBlockedExternalUrl(parsedUrl) {
  const hostname = parsedUrl.hostname.toLowerCase();
  const privateHostPatterns = [
    /^localhost$/,
    /^0\.0\.0\.0$/,
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[0-1])\./,
    /^\[?::1\]?$/,
    /\.local$/,
  ];

  return privateHostPatterns.some((pattern) => pattern.test(hostname));
}

function buildSourceUrl(baseUrl, code) {
  const trimmedCode = String(code || "").trim();
  const rawUrl = String(baseUrl || "");
  const urlWithCode = rawUrl.includes("{codigo}")
    ? rawUrl.replaceAll("{codigo}", encodeURIComponent(trimmedCode))
    : trimmedCode
      ? `${rawUrl.replace(/\/$/, "")}/${encodeURIComponent(trimmedCode)}`
      : rawUrl;
  const parsedUrl = new URL(urlWithCode);

  if (!["https:", "http:"].includes(parsedUrl.protocol) || isBlockedExternalUrl(parsedUrl)) {
    throw new Error("Endpoint externo bloqueado por politica de seguranca");
  }

  return parsedUrl.toString();
}

function summarizeGenericApiResult(data, sourceName) {
  const records = Array.isArray(data)
    ? data.slice(0, 30)
    : Array.isArray(data?.items)
      ? data.items.slice(0, 30)
      : Array.isArray(data?.results)
        ? data.results.slice(0, 30)
        : Array.isArray(data?.data)
          ? data.data.slice(0, 30)
          : data && typeof data === "object"
            ? [data]
            : [{ value: data }];

  return {
    answer: `Consultei ${sourceName} e normalizei uma pré-visualização com ${records.length} registro(s). Verifique os campos retornados antes de usar em automações críticas.`,
    records,
  };
}

async function listAssistantSources(request) {
  const authContext = await getTenantIdForRequest(request);
  if (authContext.unauthorized) {
    return { unauthorized: true };
  }

  let configuredSources = [];
  if (pool && dbReady) {
    const result = await pool.query(
      `SELECT
         id,
         name,
         agency,
         category,
         status,
         access_method AS "accessMethod"
       FROM audita_api_sources
       WHERE tenant_id = $1
         AND status IN ('testing', 'active')
         AND access_method IN ('api', 'hybrid')
       ORDER BY name`,
      [authContext.tenantId],
    );

    configuredSources = result.rows.map((source) => ({
      id: `api:${source.id}`,
      name: source.name,
      agency: source.agency,
      category: source.category,
      status: source.status,
      accessMethod: source.accessMethod,
    }));
  }

  return [...builtinAssistantSources, ...configuredSources];
}

function summarizeStates(states) {
  const ordered = [...states].sort((a, b) => a.sigla.localeCompare(b.sigla));
  return {
    answer: `Encontrei ${ordered.length} UFs na base aberta do IBGE. As primeiras para conferência são ${ordered
      .slice(0, 8)
      .map((state) => `${state.sigla} (${state.nome})`)
      .join(", ")}. Posso detalhar por região ou buscar municípios de uma UF específica.`,
    records: ordered.map((state) => ({
      id: state.id,
      nome: state.nome,
      sigla: state.sigla,
      regiao: state.regiao?.nome,
    })),
  };
}

function summarizeMunicipalities(uf, municipalities) {
  const ordered = [...municipalities].sort((a, b) => a.nome.localeCompare(b.nome));
  return {
    answer: `Localizei ${ordered.length} municípios para ${uf.toUpperCase()} na base oficial do IBGE. Alguns exemplos: ${ordered
      .slice(0, 10)
      .map((city) => city.nome)
      .join(", ")}.`,
    records: ordered.slice(0, 80).map((city) => ({
      id: city.id,
      nome: city.nome,
      microrregiao: city.microrregiao?.nome,
      mesorregiao: city.microrregiao?.mesorregiao?.nome,
    })),
  };
}

function extractPopulationSeries(apiResult) {
  const series = apiResult?.[0]?.resultados?.[0]?.series || [];
  const period =
    series[0]?.serie && Object.keys(series[0].serie).length
      ? Object.keys(series[0].serie)[0]
      : "periodo mais recente";
  const municipalities = series
    .map((item) => {
      const population = Number(String(item.serie?.[period] || "0").replace(/\D/g, ""));
      const [name, uf] = String(item.localidade?.nome || "").split(" - ");
      return {
        id: item.localidade?.id,
        nome: name,
        uf,
        populacao: population,
      };
    })
    .filter((item) => item.populacao > 0);

  return { period, municipalities };
}

function summarizeLargestMunicipalities(apiResult, requestedLimit) {
  const { period, municipalities } = extractPopulationSeries(apiResult);
  const ranked = municipalities
    .sort((a, b) => b.populacao - a.populacao)
    .slice(0, requestedLimit);

  return {
    answer: `Interpretei "maiores" como maior população estimada. Segundo a tabela 6579 do IBGE/SIDRA (${period}), os ${ranked.length} maiores municípios são ${ranked
      .map((city, index) => `${index + 1}. ${city.nome}/${city.uf} (${city.populacao.toLocaleString("pt-BR")} habitantes)`)
      .join("; ")}.`,
    records: ranked,
  };
}

function summarizeSmallestMunicipalities(apiResult, requestedLimit) {
  const { period, municipalities } = extractPopulationSeries(apiResult);
  const ranked = municipalities
    .filter((city) => city.populacao > 0)
    .sort((a, b) => a.populacao - b.populacao)
    .slice(0, requestedLimit);

  return {
    answer: `Interpretei a pergunta como ranking de menor população estimada. Segundo a tabela 6579 do IBGE/SIDRA (${period}), os ${ranked.length} menores municípios são ${ranked
      .map((city, index) => `${index + 1}. ${city.nome}/${city.uf} (${city.populacao.toLocaleString("pt-BR")} habitantes)`)
      .join("; ")}.`,
    records: ranked,
  };
}

function summarizeMunicipalityPopulation(apiResult, code, prompt) {
  const { period, municipalities } = extractPopulationSeries(apiResult);
  const normalizedCode = normalizeQuestion(code);
  const normalizedPrompt = normalizeQuestion(prompt);
  const numericCode = String(code || "").replace(/\D/g, "");
  const candidates = municipalities.filter((city) => {
    const normalizedName = normalizeQuestion(city.nome);
    const normalizedUf = normalizeQuestion(city.uf);
    const cityWithUf = `${normalizedName} ${normalizedUf}`;
    return (
      (numericCode && String(city.id) === numericCode) ||
      (normalizedCode && (normalizedName === normalizedCode || cityWithUf === normalizedCode)) ||
      (normalizedPrompt && normalizedName.length >= 4 && normalizedPrompt.includes(normalizedName))
    );
  });

  if (!candidates.length) {
    return {
      answer:
        "A pergunta foi considerada, mas não encontrei um município específico nela. Informe o nome do município, UF ou código IBGE, ou pergunte explicitamente por um ranking como '5 maiores municípios'.",
      records: [],
    };
  }

  const selected = candidates.sort((a, b) => b.populacao - a.populacao)[0];
  return {
    answer: `Segundo a tabela 6579 do IBGE/SIDRA (${period}), ${selected.nome}/${selected.uf} tem população estimada de ${selected.populacao.toLocaleString("pt-BR")} habitantes.`,
    records: [selected],
  };
}

function summarizePopulationByPrompt(apiResult, code, prompt) {
  const normalizedPrompt = normalizeQuestion(prompt);
  const requestedLimit = Math.min(Number(normalizedPrompt.match(/\b(\d{1,2})\b/)?.[1] || 5), 20);
  const asksRanking =
    normalizedPrompt.includes("maior") ||
    normalizedPrompt.includes("ranking") ||
    normalizedPrompt.includes("top") ||
    normalizedPrompt.includes("menor");
  const asksMunicipality =
    normalizedPrompt.includes("municip") ||
    normalizedPrompt.includes("cidade") ||
    normalizedPrompt.includes("popul") ||
    String(code || "").trim();

  if (normalizedPrompt.includes("menor")) {
    return summarizeSmallestMunicipalities(apiResult, requestedLimit);
  }

  if (asksRanking && (normalizedPrompt.includes("maior") || normalizedPrompt.includes("ranking") || normalizedPrompt.includes("top"))) {
    return summarizeLargestMunicipalities(apiResult, requestedLimit);
  }

  if (asksMunicipality) {
    return summarizeMunicipalityPopulation(apiResult, code, prompt);
  }

  return {
    answer:
      "A pergunta foi considerada, mas precisa ser mais específica para esta fonte. Exemplos: 'Quais os 5 maiores municípios do Brasil?' ou 'Qual a população de Salvador?'.",
    records: [],
  };
}

function summarizeCnae(classes) {
  return {
    answer: `Consultei a classificação CNAE do IBGE e encontrei ${classes.length} classes. Exemplos: ${classes
      .slice(0, 6)
      .map((item) => `${item.id} - ${item.descricao}`)
      .join("; ")}.`,
    records: classes.slice(0, 60).map((item) => ({
      id: item.id,
      descricao: item.descricao,
      grupo: item.grupo?.descricao,
    })),
  };
}

function summarizeCnaeByCode(code, classes) {
  const normalizedCode = String(code || "").replace(/\D/g, "");
  const matched = classes.find((item) => String(item.id) === normalizedCode);

  if (!matched) {
    return {
      answer: `Não encontrei a classe CNAE ${code} na lista oficial do IBGE. Confirme se o código tem 5 digitos ou consulte sem código para ver exemplos.`,
      records: [],
    };
  }

  return {
    answer: `Encontrei a classe CNAE ${matched.id}: ${matched.descricao}. Grupo: ${matched.grupo?.descricao || "não informado"}.`,
    records: [matched],
  };
}

function summarizeCnaeByPrompt(code, prompt, classes) {
  const normalizedCode = String(code || prompt || "").replace(/\D/g, "");
  if (normalizedCode.length >= 4) {
    return summarizeCnaeByCode(normalizedCode, classes);
  }

  const terms = normalizeQuestion(`${code} ${prompt}`)
    .split(/\s+/)
    .filter((term) => term.length >= 4 && !["qual", "quais", "sobre", "classe", "cnae", "atividade"].includes(term));
  const matches = classes
    .filter((item) => {
      const description = normalizeQuestion(item.descricao);
      return terms.length && terms.some((term) => description.includes(term));
    })
    .slice(0, 12);

  if (!matches.length) {
    return summarizeCnae(classes);
  }

  return {
    answer: `Considerei sua pergunta e encontrei ${matches.length} classe(s) CNAE relacionada(s) aos termos informados. Principais resultados: ${matches
      .slice(0, 6)
      .map((item) => `${item.id} - ${item.descricao}`)
      .join("; ")}.`,
    records: matches,
  };
}

async function runBuiltinAssistantSource(sourceId, code, prompt) {
  const normalizedPrompt = normalizeQuestion(prompt);
  const normalizedCode = normalizeQuestion(code);
  const ufFromCode = normalizedCode.match(/^(ac|al|ap|am|ba|ce|df|es|go|ma|mt|ms|mg|pa|pb|pr|pe|pi|rj|rn|rs|ro|rr|sc|sp|se|to)$/);
  const ufFromPrompt = normalizedPrompt.match(/\b(ac|al|ap|am|ba|ce|df|es|go|ma|mt|ms|mg|pa|pb|pr|pe|pi|rj|rn|rs|ro|rr|sc|sp|se|to)\b/);
  const ufMatch = ufFromCode || ufFromPrompt;
  let source = "IBGE Localidades";
  let endpoint = `${ibgeBaseUrl}/v1/localidades/estados`;
  let result;

  if (sourceId === "builtin:ibge-populacao") {
    source = "IBGE SIDRA - População estimada";
    endpoint = `${ibgeBaseUrl}/v3/agregados/6579/periodos/-1/variaveis/9324?localidades=N6[all]`;
    result = summarizePopulationByPrompt(await fetchJson(endpoint), code, prompt);
  } else if (sourceId === "builtin:ibge-cnae") {
    source = "IBGE CNAE";
    endpoint = `${ibgeBaseUrl}/v2/cnae/classes`;
    const classes = await fetchJson(endpoint);
    result = summarizeCnaeByPrompt(code, prompt, classes);
  } else if ((normalizedPrompt.includes("municip") || normalizedPrompt.includes("cidade") || normalizedCode) && ufMatch) {
    endpoint = `${ibgeBaseUrl}/v1/localidades/estados/${ufMatch[1].toUpperCase()}/municipios`;
    result = summarizeMunicipalities(ufMatch[1], await fetchJson(endpoint));
  } else {
    result = summarizeStates(await fetchJson(endpoint));
  }

  return {
    source,
    endpoint,
    code,
    prompt,
    answer: result.answer,
    records: result.records,
  };
}

async function runConfiguredAssistantSource(request, authContext, numericSourceId, code, prompt) {
  if (!pool || !dbReady) {
    return { unavailable: true };
  }

  const result = await pool.query(
    `SELECT
       id,
       name,
       agency,
       base_url AS "baseUrl",
       access_method AS "accessMethod",
       auth_type AS "authType",
       secret_ref AS "secretRef",
       status
     FROM audita_api_sources
     WHERE tenant_id = $1 AND id = $2
     LIMIT 1`,
    [authContext.tenantId, numericSourceId],
  );
  const source = result.rows[0];

  if (!source || !["testing", "active"].includes(source.status) || !["api", "hybrid"].includes(source.accessMethod)) {
    return { notFound: true };
  }

  const endpoint = buildSourceUrl(source.baseUrl, code);
  const headers = {
    accept: "application/json",
    "user-agent": "Audita/0.1 assistant-query",
  };
  const secretValue = source.secretRef ? process.env[source.secretRef] : "";

  if (secretValue) {
    headers.authorization = `Bearer ${secretValue}`;
    headers["x-api-key"] = secretValue;
    headers["chave-api-dados"] = secretValue;
  }

  const response = await fetch(endpoint, { headers });
  if (!response.ok) {
    throw new Error(`Fonte retornou HTTP ${response.status}`);
  }

  const data = await response.json();
  const summary = summarizeGenericApiResult(data, source.name);

  return {
    source: source.name,
    endpoint,
    code,
    prompt,
    answer: summary.answer,
    records: summary.records,
  };
}

async function runAssistantQuery(request) {
  const authContext = await getTenantIdForRequest(request);
  if (authContext.unauthorized) {
    return { unauthorized: true };
  }

  const body = await readJsonBody(request);
  const sourceId = String(body.sourceId || "").trim();
  const code = String(body.code || "").trim();
  const prompt = String(body.prompt || "").trim();

  if (!sourceId || !prompt || prompt.length < 4) {
    return { invalid: true };
  }

  let result;
  if (sourceId.startsWith("builtin:")) {
    result = await runBuiltinAssistantSource(sourceId, code, prompt);
  } else if (sourceId.startsWith("api:")) {
    result = await runConfiguredAssistantSource(request, authContext, Number(sourceId.replace("api:", "")), code, prompt);
  } else {
    return { invalid: true };
  }

  if (result.unavailable || result.notFound) {
    return result;
  }

  if (pool && dbReady && authContext.tenantId) {
    await pool.query(
      `INSERT INTO audita_app_events (tenant_id, event_type, payload)
       VALUES ($1, 'assistant.query.executed', $2)`,
      [
        authContext.tenantId,
        JSON.stringify({
          sourceId,
          source: result.source,
          endpoint: result.endpoint,
          codeProvided: Boolean(code),
          records: Array.isArray(result.records) ? result.records.length : 0,
        }),
      ],
    );
  }

  return result;
}

async function getAgentSettings(request) {
  if (!pool || !dbReady) {
    return {
      provider: "openai",
      model: "gpt-5-mini",
      apiKeySecretRef: "AUDITA_OPENAI_API_KEY",
      systemPrompt:
        "Você é o Agente IA AUDITA. Responda de forma clara, objetiva, humanizada e sempre cite a fonte dos dados consultados.",
      status: "draft",
      configured: Boolean(process.env.AUDITA_OPENAI_API_KEY),
    };
  }

  const authContext = await getTenantIdForRequest(request);
  if (authContext.unauthorized) {
    return { unauthorized: true };
  }

  const result = await pool.query(
    `SELECT
       provider,
       model,
       api_key_secret_ref AS "apiKeySecretRef",
       system_prompt AS "systemPrompt",
       status,
       updated_at AS "updatedAt"
     FROM audita_agent_settings
     WHERE tenant_id = $1 AND provider = 'openai'
     LIMIT 1`,
    [authContext.tenantId],
  );

  const settings =
    result.rows[0] || {
      provider: "openai",
      model: "gpt-5-mini",
      apiKeySecretRef: "AUDITA_OPENAI_API_KEY",
      systemPrompt:
        "Você é o Agente IA AUDITA. Responda de forma clara, objetiva, humanizada e sempre cite a fonte dos dados consultados.",
      status: "draft",
      updatedAt: null,
    };

  return {
    ...settings,
    configured: Boolean(process.env[settings.apiKeySecretRef]),
  };
}

async function saveAgentSettings(request) {
  if (!pool || !dbReady) {
    return { unavailable: true };
  }

  const authContext = await getTenantIdForRequest(request);
  if (authContext.unauthorized) {
    return { unauthorized: true };
  }
  if (!canManageIntegrations(authContext.user)) {
    return { forbidden: true };
  }

  const body = await readJsonBody(request);
  const model = String(body.model || "gpt-5-mini").trim();
  const apiKeySecretRef = String(body.apiKeySecretRef || "AUDITA_OPENAI_API_KEY").trim();
  const systemPrompt = String(body.systemPrompt || "").trim();
  const status = String(body.status || "draft").trim();

  if (!model || !apiKeySecretRef || !systemPrompt) {
    return { invalid: true };
  }

  if (!/^[A-Z0-9_]+$/.test(apiKeySecretRef)) {
    return { invalid: true };
  }

  const result = await pool.query(
    `INSERT INTO audita_agent_settings (
       tenant_id,
       provider,
       model,
       api_key_secret_ref,
       system_prompt,
       status,
       created_by_user_id
     )
     VALUES ($1, 'openai', $2, $3, $4, $5, $6)
     ON CONFLICT (tenant_id, provider)
     DO UPDATE SET
       model = EXCLUDED.model,
       api_key_secret_ref = EXCLUDED.api_key_secret_ref,
       system_prompt = EXCLUDED.system_prompt,
       status = EXCLUDED.status,
       updated_at = NOW()
     RETURNING
       provider,
       model,
       api_key_secret_ref AS "apiKeySecretRef",
       system_prompt AS "systemPrompt",
       status,
       updated_at AS "updatedAt"`,
    [authContext.tenantId, model, apiKeySecretRef, systemPrompt, status, authContext.user?.id || null],
  );

  await pool.query(
    `INSERT INTO audita_app_events (tenant_id, event_type, payload)
     VALUES ($1, 'agent.openai_settings.saved', $2)`,
    [
      authContext.tenantId,
      JSON.stringify({
        provider: "openai",
        model,
        apiKeySecretRef,
        status,
        configured: Boolean(process.env[apiKeySecretRef]),
      }),
    ],
  );

  return {
    ...result.rows[0],
    configured: Boolean(process.env[apiKeySecretRef]),
  };
}

async function runAuditaAgent(request) {
  const authContext = await getTenantIdForRequest(request);
  if (authContext.unauthorized) {
    return { unauthorized: true };
  }

  const body = await readJsonBody(request);
  const question = String(body.question || "").trim();
  const normalized = normalizeQuestion(question);
  const ufMatch = normalized.match(/\b(ac|al|ap|am|ba|ce|df|es|go|ma|mt|ms|mg|pa|pb|pr|pe|pi|rj|rn|rs|ro|rr|sc|sp|se|to)\b/);
  const requestedLimit = Math.min(Number(normalized.match(/\b(\d{1,2})\b/)?.[1] || 5), 20);

  if (!question || question.length < 4) {
    return { invalid: true };
  }

  let source = "IBGE Localidades";
  let endpoint = `${ibgeBaseUrl}/v1/localidades/estados`;
  let result;

  if (
    (normalized.includes("maior") || normalized.includes("ranking") || normalized.includes("top")) &&
    (normalized.includes("municip") || normalized.includes("cidade")) &&
    (normalized.includes("popul") || normalized.includes("brasil") || normalized.includes("habitante"))
  ) {
    source = "IBGE SIDRA - População estimada";
    endpoint = `${ibgeBaseUrl}/v3/agregados/6579/periodos/-1/variaveis/9324?localidades=N6[all]`;
    result = summarizeLargestMunicipalities(await fetchJson(endpoint), requestedLimit);
  } else if (normalized.includes("cnae") || normalized.includes("atividade economica")) {
    source = "IBGE CNAE";
    endpoint = `${ibgeBaseUrl}/v2/cnae/classes`;
    result = summarizeCnae(await fetchJson(endpoint));
  } else if ((normalized.includes("municip") || normalized.includes("cidade")) && ufMatch) {
    endpoint = `${ibgeBaseUrl}/v1/localidades/estados/${ufMatch[1].toUpperCase()}/municipios`;
    result = summarizeMunicipalities(ufMatch[1], await fetchJson(endpoint));
  } else {
    result = summarizeStates(await fetchJson(endpoint));
  }

  if (pool && dbReady && authContext.tenantId) {
    await pool.query(
      `INSERT INTO audita_app_events (tenant_id, event_type, payload)
       VALUES ($1, 'agent.query.executed', $2)`,
      [
        authContext.tenantId,
        JSON.stringify({
          question,
          source,
          endpoint,
          records: result.records.length,
        }),
      ],
    );
  }

  return {
    source,
    endpoint,
    question,
    answer: result.answer,
    records: result.records,
  };
}

async function runChatConversation(request) {
  const authContext = await getTenantIdForRequest(request);
  if (authContext.unauthorized) {
    return { unauthorized: true };
  }

  const body = await readJsonBody(request);
  const settings = await getAgentSettings(request);
  let effectiveCaseContext = body.caseContext;
  let synchronizedCase = null;
  const itauAuth = {
    tenantId: authContext.tenantId,
    userId: authContext.user?.id || null,
  };
  const certificateStatus = directDataCertificatesService.getStatus();
  const certificateRequestId =
    String(body.requestId || "").trim() || crypto.randomUUID();
  const queryCourtCertificate = async (input = {}) => {
    if (!certificateStatus.configured) {
      return {
        unavailable: true,
        reason: certificateStatus.enabled
          ? "direct_data_token_missing"
          : "direct_data_certificates_disabled",
        configuration: certificateStatus,
      };
    }
    if (input.authorizationConfirmed !== true) {
      return {
        invalid: true,
        reason: "authorization_required",
        configuration: certificateStatus,
      };
    }
    if (input.paidQueryConfirmed !== true) {
      return {
        invalid: true,
        reason: "paid_query_confirmation_required",
        configuration: certificateStatus,
      };
    }

    const requestedSubjectType =
      String(input.subjectType || "cpf").toLowerCase() === "cnpj"
        ? "cnpj"
        : "cpf";
    const profileState = authContext.user
      ? await loadUserProfile(authContext.user)
      : { profile: {} };
    const profile = profileState.profile || {};
    if (requestedSubjectType === "cnpj" || !profile.document) {
      return {
        requiresSecureIntake: true,
        reason:
          requestedSubjectType === "cnpj"
            ? "cnpj_secure_intake_required"
            : "profile_document_required",
        configuration: certificateStatus,
      };
    }

    const idempotencyKey = crypto
      .createHash("sha256")
      .update(
        `${certificateRequestId}:${JSON.stringify({
          uf: input.uf,
          certificateType: input.certificateType,
          generatePdf: input.generatePdf === true,
          subjectType: requestedSubjectType,
        })}`,
      )
      .digest("hex")
      .slice(0, 48);

    return directDataCertificatesService.query(
      {
        ...input,
        requestId: idempotencyKey,
        document: profile.document,
        documentType: "cpf",
        fullName: profile.fullName || authContext.user?.name || "",
        rg: profile.rg || "",
      },
      authContext,
    );
  };
  let browserContext = null;
  const browserSessionId = String(body.browserSessionId || "").trim();
  const jecBrowserEnabled =
    String(process.env.AUDITA_JEC_BROWSER_ENABLED || "false").toLowerCase() ===
    "true";

  if (
    jecBrowserEnabled &&
    /^[A-Za-z0-9_-]{1,100}$/.test(browserSessionId)
  ) {
    let browserView = await chatBrowserService.getView(browserSessionId, itauAuth);
    let browserTransport = "live";
    if (browserView.notFound) {
      browserView = await getAssistedSessionView(browserSessionId, itauAuth);
      browserTransport = "assisted";
    }
    if (!browserView.notFound && !browserView.forbidden) {
      const portal = getJecPortal(browserView.courtUf || "");
      const agentSession = browserView.agentSessionId
        ? getOwnedStateCourtAgentSession(browserView.agentSessionId, itauAuth)
        : null;
      browserContext = {
        sessionId: browserSessionId,
        status: browserView.status || (browserView.closed ? "offline" : "live"),
        closed: browserView.closed === true,
        controlMode: browserView.controlMode || (browserTransport === "assisted" ? "human" : ""),
        transport: browserTransport,
        courtName: browserView.courtName,
        courtUf: browserView.courtUf,
        title: browserView.title,
        url: browserView.url,
        outcome: browserView.outcome,
        formState: browserView.formState,
        agent: agentSession && !agentSession.forbidden
          ? {
              status: agentSession.status,
              nextAction: agentSession.nextAction,
              resultStatus: agentSession.result?.status || "",
            }
          : null,
        portalGuide: portal
          ? {
              name: portal.name,
              checkpoint: portal.checkpoint,
              requirements: portal.requirements,
              steps: portal.guide?.steps || portal.instructions,
              humanOnly: portal.guide?.humanOnly || [],
              caseNotes: portal.guide?.caseNotes || [],
              sources: portal.guide?.sources || [portal.officialUrl],
            }
          : null,
      };
    }
  }

  const applyItauCaseUpdate = async (payload) => {
    const currentCase = synchronizedCase || effectiveCaseContext?.case;
    if (!currentCase?.id || !payload || typeof payload !== "object") return null;

    const updated = itauRefundService.updateCase(currentCase.id, payload, itauAuth);
    if (updated.forbidden) {
      throw new Error("itau_case_forbidden");
    }
    synchronizedCase = updated.case
      ? updated.case
      : updateItauCaseSnapshot(currentCase, payload);
    effectiveCaseContext = { type: "itau_refund", case: synchronizedCase };
    return synchronizedCase;
  };

  if (body.caseContext?.type === "itau_refund" && body.caseContext?.case?.id) {
    synchronizedCase = body.caseContext.case;
  }

  let result;
  try {
    result = await runAuditaChat({
      messages: body.messages,
      settings,
      userName: authContext.user?.name || "",
      caseContext: effectiveCaseContext,
      browserContext,
      getItauCase: () => synchronizedCase || effectiveCaseContext?.case || null,
      onItauCaseUpdate: applyItauCaseUpdate,
      onCourtCertificateQuery: queryCourtCertificate,
      courtCertificateStatus: certificateStatus,
    });
  } catch (error) {
    try {
      await apiUsageService.record(authContext, {
        provider: "openai",
        service: "responses",
        operation: "audita_chat",
        model: String(process.env.AUDITA_CHAT_MODEL || settings.model || "gpt-5-mini").trim(),
        status: error?.name === "AbortError" ? "cancelled" : "failed",
        requestCount: 1,
        referenceId: crypto.randomUUID(),
        unitName: "token",
        metadata: {
          messageCount: Array.isArray(body.messages) ? body.messages.length : 0,
        },
      });
    } catch (usageError) {
      console.error("[audita] failed to record failed chat usage", usageError);
    }
    throw error;
  }

  if (!result.invalid && !result.unavailable && result.usage) {
    try {
      await apiUsageService.record(authContext, {
        provider: "openai",
        service: "responses",
        operation: "audita_chat",
        model: result.model || "gpt-5-mini",
        referenceId: crypto.randomUUID(),
        unitName: "token",
        metadata: {
          messageCount: Array.isArray(body.messages) ? body.messages.length : 0,
          actionCount: Array.isArray(result.actions) ? result.actions.length : 0,
        },
        ...result.usage,
      });
    } catch (error) {
      console.error("[audita] failed to record chat usage", error);
    }
  }

  if (!result.invalid && !result.unavailable && pool && dbReady && authContext.tenantId) {
    await pool.query(
      `INSERT INTO audita_app_events (tenant_id, event_type, payload)
       VALUES ($1, 'chat.message.completed', $2)`,
      [
        authContext.tenantId,
        JSON.stringify({
          model: result.model,
          messageCount: Array.isArray(body.messages) ? body.messages.length : 0,
          actions: Array.isArray(result.actions) ? result.actions.map((action) => action.moduleId) : [],
          sources: Array.isArray(result.sources) ? result.sources.map((source) => source.name) : [],
        }),
      ],
    );
  }

  return synchronizedCase ? { ...result, itauCase: synchronizedCase } : result;
}

async function handleApi(request, response, pathname) {
  if (pathname === "/api/billing/plans" && request.method === "GET") {
    sendJson(response, 200, stripeBillingService.catalog());
    return true;
  }

  if (pathname === "/api/billing/webhook" && request.method === "POST") {
    try {
      const rawBody = await readBufferBody(request, 2 * 1024 * 1024);
      const result = await stripeBillingService.handleWebhook(
        rawBody,
        request.headers["stripe-signature"],
      );
      sendJson(response, 200, result);
    } catch (error) {
      const statusCode =
        error instanceof StripeBillingError ? error.statusCode : 500;
      sendJson(response, statusCode, {
        error:
          error instanceof StripeBillingError
            ? error.code
            : "billing_webhook_failed",
        message:
          error instanceof StripeBillingError
            ? error.message
            : "Nao foi possivel processar o evento de cobranca.",
      });
    }
    return true;
  }

  if (pathname === "/api/billing/subscription" && request.method === "GET") {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      sendJson(response, 200, await stripeBillingService.billingState(authContext));
    } catch (error) {
      sendJson(response, 500, {
        error: "billing_state_failed",
        message: "Nao foi possivel carregar a assinatura.",
      });
    }
    return true;
  }

  if (pathname === "/api/billing/demo-subscription" && request.method === "POST") {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      const result = await stripeBillingService.createDemoSubscription(
        authContext,
        await readJsonBody(request),
      );
      if (result.forbidden) {
        sendJson(response, 403, { error: "billing_manager_required" });
        return true;
      }
      if (result.invalid) {
        sendJson(response, 400, { error: result.reason });
        return true;
      }
      if (result.unavailable) {
        sendJson(response, 503, { error: result.reason });
        return true;
      }
      sendJson(response, 201, result);
    } catch {
      sendJson(response, 500, {
        error: "billing_demo_failed",
        message: "Nao foi possivel ativar a demonstracao.",
      });
    }
    return true;
  }

  if (pathname === "/api/billing/checkout" && request.method === "POST") {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      const result = await stripeBillingService.createCheckoutSession(
        authContext,
        await readJsonBody(request),
      );
      if (result.forbidden) {
        sendJson(response, 403, { error: "billing_manager_required" });
        return true;
      }
      if (result.invalid) {
        sendJson(response, 400, {
          error: result.reason || "invalid_billing_selection",
        });
        return true;
      }
      if (result.unavailable) {
        sendJson(response, 503, {
          error: result.reason || "billing_not_configured",
          missing: result.missing || [],
        });
        return true;
      }
      sendJson(response, 201, result);
    } catch (error) {
      const statusCode =
        error instanceof StripeBillingError ? error.statusCode : 500;
      sendJson(response, statusCode, {
        error:
          error instanceof StripeBillingError
            ? error.code
            : "billing_checkout_failed",
        message:
          error instanceof StripeBillingError
            ? error.message
            : "Nao foi possivel iniciar o checkout.",
      });
    }
    return true;
  }

  if (pathname === "/api/itau-lawyer-kit" && request.method === "GET") {
    const authContext = await getTenantIdForRequest(request);
    const access = authContext.unauthorized
      ? { entitled: false, source: "none" }
      : await stripeBillingService.itauLawyerKitAccessState(authContext);
    sendJson(response, 200, {
      access,
      documents: itauLawyerKitDocuments.map((document) => ({
        slug: document.slug,
        title: document.title,
        included: true,
        available: Boolean(document.fileName),
        downloadUrl:
          access.entitled && document.fileName
            ? `/api/itau-lawyer-kit/documents/${document.slug}`
            : null,
      })),
    });
    return true;
  }

  if (pathname === "/api/itau-lawyer-kit/checkout" && request.method === "POST") {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      const input = await readJsonBody(request);
      const result = await stripeBillingService.createCheckoutSession(authContext, {
        kind: "itau_lawyer_kit",
        requestId: String(input.requestId || ""),
      });
      if (result.invalid) {
        sendJson(response, 400, { error: result.reason });
        return true;
      }
      if (result.unavailable) {
        sendJson(response, 503, {
          error: result.reason,
          missing: result.missing || [],
        });
        return true;
      }
      sendJson(response, 201, result);
    } catch (error) {
      const statusCode = error instanceof StripeBillingError ? error.statusCode : 500;
      sendJson(response, statusCode, {
        error: error instanceof StripeBillingError ? error.code : "itau_lawyer_kit_checkout_failed",
        message:
          error instanceof StripeBillingError
            ? error.message
            : "Não foi possível iniciar a compra do kit agora.",
      });
    }
    return true;
  }

  const lawyerKitDocumentMatch = pathname.match(
    /^\/api\/itau-lawyer-kit\/documents\/([a-z0-9-]+)$/,
  );
  if (lawyerKitDocumentMatch && request.method === "GET") {
    const authContext = await getTenantIdForRequest(request);
    if (authContext.unauthorized) {
      sendJson(response, 401, { error: "authentication_required" });
      return true;
    }
    const access = await stripeBillingService.itauLawyerKitAccessState(authContext);
    if (!access.entitled) {
      sendJson(response, 403, { error: "itau_lawyer_kit_purchase_required" });
      return true;
    }
    const document = itauLawyerKitDocuments.find(
      (candidate) => candidate.slug === lawyerKitDocumentMatch[1],
    );
    if (!document?.fileName) {
      sendJson(response, 404, { error: "itau_lawyer_kit_document_not_available" });
      return true;
    }
    const filePath = join(itauLawyerKitRoot, document.fileName);
    if (!existsSync(filePath)) {
      sendJson(response, 503, { error: "itau_lawyer_kit_document_missing" });
      return true;
    }
    response.writeHead(200, {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${document.downloadName}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    });
    createReadStream(filePath).pipe(response);
    return true;
  }

  if (pathname === "/api/itau-refund/checkout" && request.method === "POST") {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      const input = await readJsonBody(request);
      const caseIds = [...new Set(
        (Array.isArray(input.caseIds) ? input.caseIds : []).map(String).filter(Boolean),
      )].slice(0, 20);
      if (!caseIds.length) {
        sendJson(response, 400, { error: "itau_case_required" });
        return true;
      }
      const cases = [];
      for (const caseId of caseIds) {
        const found = itauRefundService.getCase(caseId, {
          tenantId: authContext.tenantId,
          userId: authContext.user?.id || null,
        });
        if (found.notFound) {
          sendJson(response, 404, { error: "itau_case_not_found" });
          return true;
        }
        if (found.forbidden) {
          sendJson(response, 403, { error: "itau_case_forbidden" });
          return true;
        }
        cases.push(found.case);
      }
      const candidates = cases.flatMap((caseData) => caseData.candidates || []);
      if (!candidates.length || candidates.some((candidate) => !candidate.answer || candidate.answer === "pending")) {
        sendJson(response, 400, { error: "itau_case_review_required" });
        return true;
      }
      const calculation = buildChargeCalculationSnapshot(
        { candidates },
        { ipcaRates: await loadItauCheckoutIpcaRates() },
      );
      if (!calculation.itemCount || !calculation.correctionAvailable) {
        sendJson(response, 503, { error: "itau_calculation_unavailable" });
        return true;
      }
      const claimAmountCents = Math.round(calculation.estimatedMaterialClaim * 100);
      const tier = resolveItauChargeServiceTier(claimAmountCents);
      if (!tier) {
        sendJson(response, 422, {
          error: "itau_claim_outside_supported_range",
          claimAmountCents,
        });
        return true;
      }
      const result = await stripeBillingService.createCheckoutSession(authContext, {
        kind: "itau_charge_service",
        tierId: tier.id,
        caseIds,
        claimAmountCents,
        requestId: String(input.requestId || ""),
      });
      if (result.invalid) {
        sendJson(response, 400, { error: result.reason });
        return true;
      }
      if (result.unavailable) {
        sendJson(response, 503, { error: result.reason, missing: result.missing || [] });
        return true;
      }
      sendJson(response, 201, result);
    } catch (error) {
      const statusCode = error instanceof StripeBillingError ? error.statusCode : 500;
      sendJson(response, statusCode, {
        error: error instanceof StripeBillingError ? error.code : "itau_checkout_failed",
        message:
          error instanceof StripeBillingError
            ? error.message
            : "Não foi possível iniciar a contratação agora.",
      });
    }
    return true;
  }

  if (pathname === "/api/billing/portal" && request.method === "POST") {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      const result = await stripeBillingService.createPortalSession(authContext);
      if (result.forbidden) {
        sendJson(response, 403, { error: "billing_manager_required" });
        return true;
      }
      if (result.notFound) {
        sendJson(response, 404, {
          error: result.reason || "billing_customer_not_found",
        });
        return true;
      }
      if (result.unavailable) {
        sendJson(response, 503, {
          error: result.reason || "billing_portal_unavailable",
        });
        return true;
      }
      sendJson(response, 200, result);
    } catch (error) {
      const statusCode =
        error instanceof StripeBillingError ? error.statusCode : 500;
      sendJson(response, statusCode, {
        error:
          error instanceof StripeBillingError
            ? error.code
            : "billing_portal_failed",
        message:
          error instanceof StripeBillingError
            ? error.message
            : "Nao foi possivel abrir o portal da assinatura.",
      });
    }
    return true;
  }

  if (pathname === "/api/admin/billing" && request.method === "GET") {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      if (authRequired && !canManageIntegrations(authContext.user)) {
        sendJson(response, 403, { error: "insufficient_role" });
        return true;
      }
      sendJson(response, 200, await billingAdminService.getDashboard(authContext));
    } catch (error) {
      sendJson(response, 500, {
        error: "billing_admin_query_failed",
        message:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar a gestao comercial.",
      });
    }
    return true;
  }

  if (pathname === "/api/super-admin/dashboard" && request.method === "GET") {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (!authContext.user) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      if (authContext.user.role !== "super_admin") {
        sendJson(response, 403, { error: "super_admin_required" });
        return true;
      }
      sendJson(response, 200, await superAdminService.getDashboard(authContext));
    } catch (error) {
      sendJson(response, 500, {
        error: "super_admin_dashboard_failed",
        message: error instanceof Error ? error.message : "Nao foi possivel carregar o painel.",
      });
    }
    return true;
  }

  const superAdminUserMatch = pathname.match(/^\/api\/super-admin\/users\/([^/]+)$/);
  if (superAdminUserMatch && request.method === "PATCH") {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (!authContext.user) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      const result = await superAdminService.updateUser(
        authContext,
        decodeURIComponent(superAdminUserMatch[1]),
        await readJsonBody(request),
      );
      if (result.forbidden) sendJson(response, 403, { error: "super_admin_required" });
      else if (result.invalid) sendJson(response, 400, { error: result.reason });
      else if (result.notFound) sendJson(response, 404, { error: "user_not_found" });
      else sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 500, { error: "super_admin_user_update_failed", message: error.message });
    }
    return true;
  }

  const superAdminAccessMatch = pathname.match(/^\/api\/super-admin\/users\/([^/]+)\/access$/);
  if (superAdminAccessMatch && request.method === "POST") {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (!authContext.user) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      if (authContext.user.role !== "super_admin") {
        sendJson(response, 403, { error: "super_admin_required" });
        return true;
      }
      const result = await billingAccessService.setTesterGrant(
        authContext,
        decodeURIComponent(superAdminAccessMatch[1]),
        await readJsonBody(request),
      );
      if (result.invalid) sendJson(response, 400, { error: result.reason });
      else if (result.notFound) sendJson(response, 404, { error: "user_not_found" });
      else if (result.forbidden) sendJson(response, 403, { error: "super_admin_required" });
      else sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 500, { error: "super_admin_access_update_failed", message: error.message });
    }
    return true;
  }

  const superAdminSubscriptionMatch = pathname.match(/^\/api\/super-admin\/subscriptions\/([^/]+)$/);
  if (superAdminSubscriptionMatch && request.method === "POST") {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (!authContext.user) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      if (authContext.user.role !== "super_admin") {
        sendJson(response, 403, { error: "super_admin_required" });
        return true;
      }
      const body = await readJsonBody(request);
      const result = await stripeBillingService.setCancellationAtPeriodEnd(
        decodeURIComponent(superAdminSubscriptionMatch[1]),
        body.action,
      );
      if (result.invalid) sendJson(response, 400, { error: result.reason });
      else if (result.notFound) sendJson(response, 404, { error: result.reason });
      else if (result.unavailable) sendJson(response, 409, { error: result.reason });
      else sendJson(response, 200, result);
    } catch (error) {
      const statusCode = error instanceof StripeBillingError ? error.statusCode : 500;
      sendJson(response, statusCode, {
        error: error instanceof StripeBillingError ? error.code : "subscription_update_failed",
        message: error instanceof Error ? error.message : "Nao foi possivel atualizar a assinatura.",
      });
    }
    return true;
  }

  const billingUserAccessMatch = pathname.match(/^\/api\/admin\/billing\/users\/([^/]+)\/access$/);
  if (billingUserAccessMatch && request.method === "POST") {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      if (authRequired && !canManageIntegrations(authContext.user)) {
        sendJson(response, 403, { error: "insufficient_role" });
        return true;
      }
      const result = await billingAccessService.setTesterGrant(
        authContext,
        decodeURIComponent(billingUserAccessMatch[1]),
        await readJsonBody(request),
      );
      if (result.invalid) {
        sendJson(response, 400, { error: result.reason });
        return true;
      }
      if (result.notFound) {
        sendJson(response, 404, { error: "billing_user_not_found" });
        return true;
      }
      if (result.forbidden) {
        sendJson(response, 403, { error: "insufficient_role" });
        return true;
      }
      sendJson(response, 200, result);
    } catch {
      sendJson(response, 500, {
        error: "billing_access_update_failed",
        message: "Nao foi possivel atualizar a liberacao do usuario.",
      });
    }
    return true;
  }

  if (pathname === "/audit" && request.method === "GET") {
    try {
      const history = await auditService.listAuditHistory(request);
      if (history.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      sendJson(response, 200, history);
    } catch (error) {
      sendJson(response, 500, {
        error: "audit_history_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (pathname === "/audit" && request.method === "POST") {
    try {
      request.body = await readJsonBody(request);
      const result = await auditService.startAudit(request);
      if (result.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      if (result.invalid) {
        sendJson(response, 400, { error: "invalid_audit_request" });
        return true;
      }
      sendJson(response, 202, result);
    } catch (error) {
      sendJson(response, 500, {
        error: "audit_start_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (pathname === "/api/seller-analysis/df" && request.method === "POST") {
    try {
      const body = await readJsonBody(request);
      const sellerInput = normalizeDfSellerInput(body);
      if (sellerInput.invalid) {
        sendJson(response, 400, {
          error: "invalid_seller_analysis_request",
          missingFields: sellerInput.missingFields,
        });
        return true;
      }

      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }

      let resolvedFullName = sellerInput.fullName;
      let resolvedMotherName = sellerInput.motherName;
      let identityEnriched = false;

      if (!resolvedMotherName) {
        const enrichment = await directDataPersonService.lookup(
          {
            cpf: sellerInput.cpf,
            authorizationConfirmed: true,
            requestId: crypto.randomUUID(),
          },
          authContext,
        );

        if (enrichment.insufficientCredits) {
          sendJson(response, 402, {
            error: "insufficient_credits",
            motherNameRequired: true,
            creditCost: enrichment.creditCost,
            wallet: enrichment.wallet,
          });
          return true;
        }
        if (enrichment.unavailable || enrichment.failed || !enrichment.result) {
          sendJson(response, enrichment.unavailable ? 503 : 502, {
            error: "seller_identity_enrichment_failed",
            reason: enrichment.reason || "provider_request_failed",
            motherNameRequired: true,
            billingVerificationRequired: enrichment.billingVerificationRequired === true,
          });
          return true;
        }
        if (!personNamesMatch(sellerInput.fullName, enrichment.result.fullName)) {
          sendJson(response, 409, {
            error: "seller_name_mismatch",
            message: "O nome informado não corresponde ao cadastro retornado para o CPF.",
          });
          return true;
        }
        if (!enrichment.result.motherName) {
          sendJson(response, 422, {
            error: "seller_mother_name_not_found",
            motherNameRequired: true,
          });
          return true;
        }

        resolvedFullName = enrichment.result.fullName;
        resolvedMotherName = enrichment.result.motherName;
        identityEnriched = true;
      }

      const prepared = buildDfSellerAuditRequest({
        cpf: sellerInput.cpf,
        fullName: resolvedFullName,
        motherName: resolvedMotherName,
        authorizationConfirmed: true,
      });
      if (prepared.invalid) {
        sendJson(response, 400, {
          error: "invalid_seller_analysis_request",
          missingFields: prepared.missingFields,
        });
        return true;
      }

      request.body = prepared.requestBody;
      const result = await auditService.startAudit(request);
      if (result.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      if (result.invalid) {
        sendJson(response, 400, { error: "invalid_seller_analysis_request" });
        return true;
      }
      sendJson(response, 202, { ...result, identityEnriched });
    } catch (error) {
      sendJson(response, 500, {
        error: "seller_analysis_start_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  const publicAuditEvidenceMatch = pathname.match(/^\/audit\/([0-9a-fA-F-]{36})\/evidence$/);
  if (publicAuditEvidenceMatch && request.method === "POST") {
    try {
      request.body = await readJsonBody(request);
      const result = await auditService.addEvidence(publicAuditEvidenceMatch[1], request);
      if (result?.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      if (result?.invalid) {
        sendJson(response, 400, { error: "invalid_audit_evidence" });
        return true;
      }
      if (result?.notFound || !result) {
        sendJson(response, 404, { error: "audit_execution_not_found" });
        return true;
      }
      sendJson(response, 201, result);
    } catch (error) {
      sendJson(response, 500, {
        error: "audit_evidence_create_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  const publicAuditMatch = pathname.match(/^\/audit\/([0-9a-fA-F-]{36})$/);
  if (publicAuditMatch && request.method === "GET") {
    try {
      const audit = await auditService.findAudit(publicAuditMatch[1], request);
      if (audit?.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      if (!audit) {
        sendJson(response, 404, { error: "audit_not_found" });
        return true;
      }
      sendJson(response, 200, audit);
    } catch (error) {
      sendJson(response, 500, {
        error: "audit_query_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (pathname === "/api/property-search/config" && request.method === "GET") {
    try {
      const config = await propertyAssetsService.getConfig(request);
      if (config.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      sendJson(response, 200, config);
    } catch (error) {
      sendJson(response, 500, {
        error: "property_search_config_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (pathname === "/api/property-search/registry-offices" && request.method === "GET") {
    try {
      const requestUrl = new URL(request.url || pathname, `http://${request.headers.host || "127.0.0.1"}`);
      const result = await propertyAssetsService.listRegistryOffices(request, {
        uf: requestUrl.searchParams.get("uf"),
        operation: requestUrl.searchParams.get("operation"),
      });
      if (result.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      if (result.invalid) {
        sendJson(response, 400, { error: "invalid_registry_office_query", reason: result.reason });
        return true;
      }
      sendJson(response, result.status === "unavailable" ? 503 : 200, result);
    } catch (error) {
      sendJson(response, 500, {
        error: "registry_office_query_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (pathname === "/api/property-searches" && request.method === "GET") {
    try {
      const result = await propertyAssetsService.listSearches(request);
      if (result.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 500, {
        error: "property_search_list_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (pathname === "/api/property-searches" && request.method === "POST") {
    try {
      request.body = await readJsonBody(request);
      const result = await propertyAssetsService.createSearch(request);
      if (result.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      if (result.insufficientCredits) {
        sendJson(response, 402, { error: "insufficient_credits", ...result });
        return true;
      }
      if (result.invalid) {
        sendJson(response, 400, { error: "invalid_property_search", reason: result.reason });
        return true;
      }
      sendJson(response, 201, result);
    } catch (error) {
      sendJson(response, 500, {
        error: "property_search_create_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  const propertySearchActionMatch = pathname.match(/^\/api\/property-searches\/([0-9a-fA-F-]{36})\/actions$/);
  if (propertySearchActionMatch && request.method === "POST") {
    try {
      request.body = await readJsonBody(request);
      const result = await propertyAssetsService.handleAction(propertySearchActionMatch[1], request);
      if (result.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      if (result.insufficientCredits) {
        sendJson(response, 402, { error: "insufficient_credits", ...result });
        return true;
      }
      if (result.notFound) {
        sendJson(response, 404, { error: "property_search_not_found" });
        return true;
      }
      if (result.invalid) {
        sendJson(response, 400, { error: "invalid_property_search_action", reason: result.reason });
        return true;
      }
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 500, {
        error: "property_search_action_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  const propertySearchMatch = pathname.match(/^\/api\/property-searches\/([0-9a-fA-F-]{36})$/);
  if (propertySearchMatch && request.method === "GET") {
    try {
      const search = await propertyAssetsService.findSearch(propertySearchMatch[1], request);
      if (search?.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      if (!search) {
        sendJson(response, 404, { error: "property_search_not_found" });
        return true;
      }
      sendJson(response, 200, { search });
    } catch (error) {
      sendJson(response, 500, {
        error: "property_search_query_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (
    pathname === "/api/integrations/direct-data/tj/certificates/status" &&
    request.method === "GET"
  ) {
    const authContext = await getTenantIdForRequest(request);
    if (authContext.unauthorized) {
      sendJson(response, 401, { error: "authentication_required" });
      return true;
    }
    sendJson(response, 200, {
      configuration: directDataCertificatesService.getStatus(),
    });
    return true;
  }

  if (
    pathname === "/api/integrations/direct-data/tj/certificates" &&
    request.method === "POST"
  ) {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      const result = await directDataCertificatesService.query(
        await readJsonBody(request),
        authContext,
      );
      if (result.unavailable) {
        sendJson(response, 503, {
          error: result.reason || "direct_data_certificates_unavailable",
          configuration: result.configuration,
        });
        return true;
      }
      if (result.invalid) {
        sendJson(response, 400, {
          error: result.reason || "invalid_direct_data_certificate_query",
          configuration: result.configuration,
        });
        return true;
      }
      if (result.unsupported) {
        sendJson(response, 422, {
          error: result.reason || "direct_data_certificate_uf_unsupported",
          allowedUfs: result.allowedUfs,
          configuration: result.configuration,
        });
        return true;
      }
      if (result.insufficientCredits) {
        sendJson(response, 402, {
          error: "insufficient_credits",
          creditCost: result.creditCost,
          wallet: result.wallet,
          providerCompleted: result.providerCompleted === true,
          configuration: result.configuration,
        });
        return true;
      }
      if (result.failed) {
        sendJson(response, 502, {
          error: result.reason || "direct_data_certificate_query_failed",
          providerStatus: result.providerStatus,
          providerReference: result.providerReference,
          providerRequestSubmitted:
            result.providerRequestSubmitted === true,
          billingVerificationRequired:
            result.billingVerificationRequired === true,
          configuration: result.configuration,
        });
        return true;
      }
      sendJson(response, 200, result);
    } catch {
      sendJson(response, 500, {
        error: "direct_data_certificate_query_failed",
        message: "Não foi possível emitir a certidão estadual agora.",
      });
    }
    return true;
  }

  if (
    pathname === "/api/integrations/direct-data/tj/status" &&
    request.method === "GET"
  ) {
    const authContext = await getTenantIdForRequest(request);
    if (authContext.unauthorized) {
      sendJson(response, 401, { error: "authentication_required" });
      return true;
    }
    sendJson(response, 200, {
      configuration: directDataCourtService.getStatus(),
    });
    return true;
  }

  if (
    pathname === "/api/integrations/direct-data/tj/processes" &&
    request.method === "POST"
  ) {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      const result = await directDataCourtService.search(
        await readJsonBody(request),
        authContext,
      );
      if (result.unavailable) {
        sendJson(response, 503, {
          error: result.reason || "direct_data_unavailable",
          configuration: result.configuration,
        });
        return true;
      }
      if (result.invalid) {
        sendJson(response, 400, {
          error: result.reason || "invalid_direct_data_query",
          configuration: result.configuration,
        });
        return true;
      }
      if (result.unsupported) {
        sendJson(response, 422, {
          error: result.reason || "direct_data_uf_unsupported",
          supportedUfs: result.supportedUfs,
          configuration: result.configuration,
        });
        return true;
      }
      if (result.insufficientCredits) {
        sendJson(response, 402, {
          error: "insufficient_credits",
          creditCost: result.creditCost,
          wallet: result.wallet,
          configuration: result.configuration,
        });
        return true;
      }
      if (result.failed) {
        sendJson(response, 502, {
          error: result.reason || "direct_data_query_failed",
          configuration: result.configuration,
        });
        return true;
      }
      sendJson(response, 200, result);
    } catch {
      sendJson(response, 500, {
        error: "direct_data_query_failed",
        message: "Nao foi possivel consultar o acompanhamento processual agora.",
      });
    }
    return true;
  }

  if (pathname === "/api/jec/portals" && request.method === "GET") {
    const authContext = await getTenantIdForRequest(request);
    if (authContext.unauthorized) {
      sendJson(response, 401, { error: "authentication_required" });
      return true;
    }
    sendJson(response, 200, {
      portals: listJecPortals().map((portal) => ({
        ...portal,
        manualFiling: getJecManualFilingGuide(portal.uf),
      })),
    });
    return true;
  }

  if (pathname === "/api/jec/testimony/refine" && request.method === "POST") {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      const body = await readJsonBody(request);
      const result = await jecTestimonyService.refine(body.testimony);
      sendJson(response, 200, {
        testimony: {
          original: result.original,
          refined: result.refined,
        },
      });
    } catch (error) {
      const knownError = error instanceof JecTestimonyError;
      sendJson(response, knownError ? error.statusCode : 502, {
        error: knownError ? error.code : "jec_testimony_refine_failed",
        message: knownError
          ? error.message
          : "Não foi possível ajustar o depoimento agora. Tente novamente.",
      });
    }
    return true;
  }

  if (pathname === "/api/jec/petitions/prepare" && request.method === "POST") {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      const body = await readJsonBody(request);
      const reviewedTestimony = body.caseData?.answers?.consumerTestimony;
      let caseData = body.caseData || {};
      if (body.caseId) {
        const stored = itauRefundService.getCase(body.caseId, {
          tenantId: authContext.tenantId,
          userId: authContext.user?.id || null,
        });
        if (stored.forbidden) {
          sendJson(response, 403, { error: "itau_case_forbidden" });
          return true;
        }
        if (stored.case) {
          caseData = {
            ...stored.case,
            answers: {
              ...(stored.case.answers || {}),
              ...(reviewedTestimony ? { consumerTestimony: reviewedTestimony } : {}),
            },
          };
        }
      }
      const prepared = prepareJecPetition({
        caseData,
        claimant: body.claimant || {},
        uf: body.uf,
        city: body.city,
      });
      if (prepared.unsupported) {
        sendJson(response, 422, {
          error: "jec_state_not_supported",
          supportedUfs: prepared.supportedUfs,
        });
        return true;
      }
      sendJson(response, 200, { prepared });
    } catch (error) {
      sendJson(response, 500, {
        error: "jec_petition_prepare_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (pathname === "/api/jec/petitions/pdf" && request.method === "POST") {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      const body = await readJsonBody(request);
      if (body.reviewConfirmed !== true) {
        sendJson(response, 400, { error: "jec_review_required" });
        return true;
      }
      const reviewedTestimony = body.caseData?.answers?.consumerTestimony;
      const testimonyText = normalizeJecTestimony(
        reviewedTestimony?.refined || reviewedTestimony?.reviewed || "",
      );
      if (body.testimonyReviewed !== true || testimonyText.length < 40) {
        sendJson(response, 400, {
          error: "jec_testimony_review_required",
          message: "Revise e confirme o seu depoimento antes de gerar o PDF.",
        });
        return true;
      }
      let caseData = body.caseData || {};
      if (body.caseId) {
        const stored = itauRefundService.getCase(body.caseId, {
          tenantId: authContext.tenantId,
          userId: authContext.user?.id || null,
        });
        if (stored.forbidden) {
          sendJson(response, 403, { error: "itau_case_forbidden" });
          return true;
        }
        if (stored.case) {
          caseData = {
            ...stored.case,
            answers: {
              ...(stored.case.answers || {}),
              consumerTestimony: reviewedTestimony,
            },
          };
        }
      }
      const prepared = prepareJecPetition({
        caseData,
        claimant: body.claimant || {},
        uf: body.uf,
        city: body.city,
      });
      if (prepared.unsupported) {
        sendJson(response, 422, {
          error: "jec_state_not_supported",
          supportedUfs: prepared.supportedUfs,
        });
        return true;
      }
      if (!prepared.ready) {
        sendJson(response, 422, {
          error: "jec_petition_incomplete",
          missingFields: prepared.missingFields,
        });
        return true;
      }
      const pdf = Buffer.from(await createJecPetitionPdf(prepared));
      const modelNumber = Number(prepared.template?.sourceModel || 0) || 1;
      const fileName = `relatorio-tecnico-auditoria-itau-modelo-${modelNumber}.pdf`;
      response.writeHead(200, {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${fileName}"`,
        "content-length": pdf.length,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      response.end(pdf);
    } catch (error) {
      sendJson(response, 500, {
        error: "jec_petition_pdf_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (pathname === "/api/jec/sessions" && request.method === "POST") {
    try {
      if (
        String(process.env.AUDITA_JEC_BROWSER_ENABLED || "false").toLowerCase() !==
        "true"
      ) {
        sendJson(response, 410, {
          error: "jec_browser_temporarily_disabled",
          message:
            "O envio assistido esta temporariamente desativado. Use o PDF e o guia do portal oficial.",
        });
        return true;
      }
      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      const body = await readJsonBody(request);
      if (body.reviewConfirmed !== true || body.transmissionAuthorized !== true) {
        sendJson(response, 400, { error: "jec_review_and_authorization_required" });
        return true;
      }
      let caseData = body.caseData || {};
      if (body.caseId) {
        const stored = itauRefundService.getCase(body.caseId, {
          tenantId: authContext.tenantId,
          userId: authContext.user?.id || null,
        });
        if (stored.forbidden) {
          sendJson(response, 403, { error: "itau_case_forbidden" });
          return true;
        }
        if (stored.case) caseData = stored.case;
      }
      const prepared = prepareJecPetition({
        caseData,
        claimant: body.claimant || {},
        uf: body.uf,
        city: body.city,
      });
      if (prepared.unsupported) {
        sendJson(response, 422, {
          error: "jec_state_not_supported",
          supportedUfs: prepared.supportedUfs,
        });
        return true;
      }
      if (!prepared.ready) {
        sendJson(response, 400, {
          error: "jec_required_fields_missing",
          missingFields: prepared.missingFields,
        });
        return true;
      }
      if (prepared.smallClaimsEligibility?.status === "above_limit") {
        sendJson(response, 422, {
          error: "jec_small_claims_limit_exceeded",
          eligibility: prepared.smallClaimsEligibility,
        });
        return true;
      }

      const profile = buildJecAgentProfile(prepared);
      const owner = {
        tenantId: authContext.tenantId || null,
        userId: authContext.user?.id || null,
      };
      const claimant = prepared.claimant;
      const input = {
        tipoDocumento: claimant.document.length === 14 ? "cnpj" : "cpf",
        documento: claimant.document,
        extraFields: {
          stateCourtFields: {
            fullName: claimant.fullName,
            email: claimant.email,
            phone: claimant.phone,
            address: claimant.address,
            city: claimant.city,
            stateUf: claimant.uf,
          },
        },
        usageContext: authContext,
        recordApiUsage: (context, usage) => apiUsageService.record(context, usage),
      };
      let liveBrowserFallbackReason = "";
      let getBrowserView = getAssistedSessionView;
      let interactWithBrowser = interactAssistedSession;
      let opened = await chatBrowserService.open({
        portalUrl: prepared.portal.startUrl,
        courtName: prepared.portal.tribunal,
        courtUf: prepared.portal.uf,
        owner,
        purpose: "jec_petition",
        allowedHosts: prepared.portal.allowedHosts,
        finalSubmissionHumanOnly: true,
      });
      if (!opened.sessionId && opened.invalid) {
        sendJson(response, 400, {
          error: opened.reason || "jec_portal_url_invalid",
          message: opened.message || "",
        });
        return true;
      }
      if (!opened.sessionId) {
        liveBrowserFallbackReason = opened.reason || "live_browser_unavailable";
        opened = await openAssistedBrowserSession({
          portalUrl: prepared.portal.startUrl,
          courtName: prepared.portal.tribunal,
          courtUf: prepared.portal.uf,
          input,
          profile,
          results: [],
          owner,
          purpose: "jec_petition",
          allowedHosts: prepared.portal.allowedHosts,
          finalSubmissionHumanOnly: true,
        });
      } else {
        getBrowserView = chatBrowserService.getView;
        interactWithBrowser = chatBrowserService.interact;
      }
      if (!opened.sessionId) {
        sendJson(response, opened.invalid ? 400 : 502, {
          error: opened.reason || "jec_portal_open_failed",
          message: opened.message || "",
        });
        return true;
      }

      const agent = createStateCourtAgentSession({
        uf: prepared.portal.uf,
        tribunal: prepared.portal.tribunal,
        portalUrl: prepared.portal.startUrl,
        assistedSession: opened.sessionId,
        input,
        profile,
        requestedCertificates: [],
        getView: getBrowserView,
        interact: interactWithBrowser,
        owner,
      });
      if (opened.session?.live) {
        chatBrowserService.attachAgent(opened.sessionId, agent.id);
        opened.session = await chatBrowserService.get(opened.sessionId, authContext);
      }
      startStateCourtAgentSession(agent.id, {
        userMessage:
          "Observe o portal e avance somente por etapas reversiveis. Pare antes de login, escolha juridica ambigua ou envio final.",
      });
      sendJson(response, 201, {
        session: opened.session,
        agent,
        portal: prepared.portal,
        finalSubmissionHumanOnly: true,
        liveBrowserFallbackReason,
      });
    } catch (error) {
      sendJson(response, 500, {
        error: "jec_session_start_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (pathname === "/api/chat-browser/status" && request.method === "GET") {
    const authContext = await getTenantIdForRequest(request);
    if (authContext.unauthorized) {
      sendJson(response, 401, { error: "authentication_required" });
      return true;
    }
    sendJson(response, 200, await chatBrowserService.health());
    return true;
  }

  const chatBrowserViewerMatch = pathname.match(
    /^\/api\/chat-browser-sessions\/([A-Za-z0-9_-]+)\/view$/,
  );
  if (chatBrowserViewerMatch && request.method === "GET") {
    const authContext = await getTenantIdForRequest(request);
    if (authContext.unauthorized) {
      sendJson(response, 401, { error: "authentication_required" });
      return true;
    }
    const forwardedProtocol = String(request.headers["x-forwarded-proto"] || "")
      .split(",")[0]
      .trim()
      .toLowerCase();
    const websocketProtocol =
      forwardedProtocol === "https" || request.socket.encrypted ? "wss" : "ws";
    const websocketUrl = `${websocketProtocol}://${request.headers.host}/api/chat-browser-sessions/${encodeURIComponent(
      chatBrowserViewerMatch[1],
    )}/cast`;
    const viewer = await chatBrowserService.viewerHtml(
      chatBrowserViewerMatch[1],
      authContext,
      websocketUrl,
    );
    if (viewer.notFound) {
      sendJson(response, 404, { error: "chat_browser_session_not_found" });
      return true;
    }
    if (viewer.forbidden) {
      sendJson(response, 403, { error: "chat_browser_session_forbidden" });
      return true;
    }
    if (!viewer.html) {
      sendJson(response, 502, {
        error: viewer.reason || "chat_browser_viewer_unavailable",
      });
      return true;
    }
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-frame-options": "SAMEORIGIN",
      "content-security-policy":
        "default-src 'self' data: blob:; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' https: data: blob:; connect-src 'self' https://api.bcb.gov.br ws: wss:; font-src 'self' data:; frame-ancestors 'self';",
      "referrer-policy": "no-referrer",
    });
    response.end(viewer.html);
    return true;
  }

  const chatBrowserSessionMatch = pathname.match(
    /^\/api\/chat-browser-sessions\/([A-Za-z0-9_-]+)$/,
  );
  if (chatBrowserSessionMatch && request.method === "GET") {
    const authContext = await getTenantIdForRequest(request);
    if (authContext.unauthorized) {
      sendJson(response, 401, { error: "authentication_required" });
      return true;
    }
    const session = await chatBrowserService.get(chatBrowserSessionMatch[1], authContext);
    if (session.notFound) {
      sendJson(response, 404, { error: "chat_browser_session_not_found" });
      return true;
    }
    if (session.forbidden) {
      sendJson(response, 403, { error: "chat_browser_session_forbidden" });
      return true;
    }
    sendJson(response, 200, { session });
    return true;
  }

  if (chatBrowserSessionMatch && request.method === "POST") {
    const authContext = await getTenantIdForRequest(request);
    if (authContext.unauthorized) {
      sendJson(response, 401, { error: "authentication_required" });
      return true;
    }
    const body = await readJsonBody(request);
    const action = String(body.action || body.type || "");
    const current = await chatBrowserService.get(chatBrowserSessionMatch[1], authContext);
    if (current.notFound) {
      sendJson(response, 404, { error: "chat_browser_session_not_found" });
      return true;
    }
    if (current.forbidden) {
      sendJson(response, 403, { error: "chat_browser_session_forbidden" });
      return true;
    }
    if (action === "close") {
      const closed = await chatBrowserService.close(chatBrowserSessionMatch[1], authContext);
      if (current.agentSessionId) {
        await handleStateCourtAgentAction(current.agentSessionId, { type: "stop" }, authContext)
          .catch(() => null);
      }
      sendJson(response, 200, { session: closed });
      return true;
    }
    if (action === "takeover") {
      const session = await chatBrowserService.setControl(
        chatBrowserSessionMatch[1],
        "human",
        authContext,
      );
      if (current.agentSessionId) {
        await handleStateCourtAgentAction(current.agentSessionId, { type: "stop" }, authContext);
      }
      sendJson(response, 200, { session });
      return true;
    }
    if (action === "return") {
      const session = await chatBrowserService.setControl(
        chatBrowserSessionMatch[1],
        "agent",
        authContext,
      );
      if (current.agentSessionId) {
        await handleStateCourtAgentAction(
          current.agentSessionId,
          { type: "continue" },
          authContext,
        );
      }
      sendJson(response, 200, { session });
      return true;
    }
    sendJson(response, 400, { error: "invalid_chat_browser_action" });
    return true;
  }

  const assistedSessionResultMatch = pathname.match(/^\/api\/assisted-sessions\/([A-Za-z0-9_-]+)\/result$/);
  if (assistedSessionResultMatch && request.method === "GET") {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      const result = await inspectAssistedSessionResult(
        assistedSessionResultMatch[1],
        authContext,
      );
      if (result.notFound) {
        sendJson(response, 404, { error: "assisted_session_not_found" });
        return true;
      }
      if (result.forbidden) {
        sendJson(response, 403, { error: "assisted_session_forbidden" });
        return true;
      }
      sendJson(response, 200, { result });
    } catch (error) {
      sendJson(response, 500, {
        error: "assisted_session_result_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  const stateCourtAgentSessionMatch = pathname.match(/^\/api\/state-court-agent-sessions\/([A-Za-z0-9_-]+)$/);
  if (stateCourtAgentSessionMatch && request.method === "GET") {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      const session = getOwnedStateCourtAgentSession(
        stateCourtAgentSessionMatch[1],
        authContext,
      );
      if (!session) {
        sendJson(response, 404, { error: "state_court_agent_session_not_found" });
        return true;
      }
      if (session.forbidden) {
        sendJson(response, 403, { error: "state_court_agent_session_forbidden" });
        return true;
      }
      sendJson(response, 200, { session });
    } catch (error) {
      sendJson(response, 500, {
        error: "state_court_agent_session_view_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (stateCourtAgentSessionMatch && request.method === "POST") {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      const body = await readJsonBody(request);
      const session = await handleStateCourtAgentAction(
        stateCourtAgentSessionMatch[1],
        body,
        authContext,
      );
      if (session.notFound) {
        sendJson(response, 404, { error: "state_court_agent_session_not_found" });
        return true;
      }
      if (session.invalid) {
        sendJson(response, 400, { error: "invalid_state_court_agent_action" });
        return true;
      }
      if (session.forbidden) {
        sendJson(response, 403, { error: "state_court_agent_session_forbidden" });
        return true;
      }
      sendJson(response, 200, { session });
    } catch (error) {
      sendJson(response, 500, {
        error: "state_court_agent_session_action_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  const assistedSessionMatch = pathname.match(/^\/api\/assisted-sessions\/([A-Za-z0-9_-]+)$/);
  if (assistedSessionMatch && request.method === "GET") {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      const view = await getAssistedSessionView(assistedSessionMatch[1], authContext);
      if (view.notFound) {
        sendJson(response, 404, { error: "assisted_session_not_found" });
        return true;
      }
      if (view.forbidden) {
        sendJson(response, 403, { error: "assisted_session_forbidden" });
        return true;
      }
      sendJson(response, 200, { session: view });
    } catch (error) {
      sendJson(response, 500, {
        error: "assisted_session_view_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (assistedSessionMatch && request.method === "POST") {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      const body = await readJsonBody(request);
      const result = body?.type === "close"
        ? await closeAssistedSession(assistedSessionMatch[1], authContext)
        : await interactAssistedSession(assistedSessionMatch[1], body, authContext);
      if (result.notFound) {
        sendJson(response, 404, { error: "assisted_session_not_found" });
        return true;
      }
      if (result.invalid) {
        sendJson(response, 400, {
          error: result.reason || "invalid_assisted_session_action",
        });
        return true;
      }
      if (result.forbidden) {
        sendJson(response, 403, { error: "assisted_session_forbidden" });
        return true;
      }
      sendJson(response, 200, { session: result });
    } catch (error) {
      sendJson(response, 500, {
        error: "assisted_session_action_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

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

  if (pathname === "/api/user/profile" && request.method === "GET") {
    try {
      const user = await getSessionUser(request);
      if (!user) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      sendJson(response, 200, await loadUserProfile(user));
    } catch (error) {
      sendJson(response, 500, {
        error: "user_profile_load_failed",
        message: "Não foi possível carregar o perfil cadastral.",
      });
    }
    return true;
  }

  if (pathname === "/api/user/profile" && request.method === "PUT") {
    try {
      const user = await getSessionUser(request);
      if (!user) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      const body = await readJsonBody(request);
      const profile = await saveUserProfile(user, body.profile || body);
      sendJson(response, 200, { profile, stored: true, storageConfigured: true });
    } catch (error) {
      if (error instanceof UserProfileValidationError) {
        sendJson(response, 400, {
          error: error.code,
          message: error.message,
          fields: error.errors,
        });
        return true;
      }
      if (error?.code === "profile_encryption_not_configured") {
        sendJson(response, 503, {
          error: error.code,
          message: "O armazenamento seguro do perfil ainda não está configurado.",
        });
        return true;
      }
      sendJson(response, 500, {
        error: "user_profile_save_failed",
        message: "Não foi possível salvar o perfil cadastral.",
      });
    }
    return true;
  }

  if (pathname === "/api/auth/login" && request.method === "POST") {
    try {
      const body = await readJsonBody(request);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");

      await ensureBootstrapUserForLogin(email, password);

      if (!pool || !dbReady) {
        await loadFallbackAuth();
        const user = getFallbackUserByEmail(email);
        if (!user || !verifyPassword(password, user.password_hash)) {
          sendJson(response, 401, { error: "invalid_credentials" });
          return true;
        }
        await createSession(response, request, user.id);
        sendJson(response, 200, { ok: true, localOnly: true });
        return true;
      }

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

  if (pathname === "/api/auth/register" && request.method === "POST") {
    try {
      const body = await readJsonBody(request);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const name = String(body.name || "").trim();

      if (!name || name.length < 2) {
        sendJson(response, 400, { error: "invalid_name" });
        return true;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        sendJson(response, 400, { error: "invalid_email" });
        return true;
      }
      if (password.length < 8) {
        sendJson(response, 400, { error: "weak_password" });
        return true;
      }

      if (!pool || !dbReady) {
        await loadFallbackAuth();
        const user = createFallbackUser({ email, name, password });
        if (!user) {
          sendJson(response, 409, { error: "email_already_registered" });
          return true;
        }
        await saveFallbackAuth();
        await createSession(response, request, user.id);
        sendJson(response, 201, { ok: true, localOnly: true });
        return true;
      }

      const account = await createSelfServeAccount(pool, {
        name,
        email,
        passwordHash: hashPassword(password),
        nonce: crypto.randomBytes(6).toString("hex"),
      });
      await createSession(response, request, account.userId);
      sendJson(response, 201, { ok: true });
    } catch (error) {
      if (error?.code === "23505") {
        sendJson(response, 409, { error: "email_already_registered" });
        return true;
      }
      sendJson(response, 400, {
        error: "register_failed",
        message: error instanceof Error ? error.message : "Invalid request",
      });
    }
    return true;
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    const cookies = parseCookies(request);
    const token = cookies[sessionCookieName];
    if (pool && dbReady && token) {
      await pool.query("DELETE FROM audita_sessions WHERE token_hash = $1", [hashToken(token)]);
    }
    if (token) {
      await loadFallbackAuth();
      fallbackSessions.delete(hashToken(token));
      await saveFallbackAuth();
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

  if (pathname === "/api/integrations/sources" && request.method === "GET") {
    try {
      const sources = await listApiSources(request);
      if (sources.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      sendJson(response, 200, { sources });
    } catch (error) {
      sendJson(response, 500, {
        error: "api_sources_query_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (pathname === "/api/integrations/sources" && request.method === "POST") {
    try {
      const source = await createApiSource(request);
      if (source.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      if (source.forbidden) {
        sendJson(response, 403, { error: "insufficient_role" });
        return true;
      }
      if (source.unavailable) {
        sendJson(response, 503, { error: "database_unavailable" });
        return true;
      }
      if (source.invalid) {
        sendJson(response, 400, { error: "invalid_api_source" });
        return true;
      }
      sendJson(response, 201, { source });
    } catch (error) {
      sendJson(response, 500, {
        error: "api_source_create_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (pathname === "/api/assistant/sources" && request.method === "GET") {
    try {
      const sources = await listAssistantSources(request);
      if (sources.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      sendJson(response, 200, { sources });
    } catch (error) {
      sendJson(response, 500, {
        error: "assistant_sources_query_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (pathname === "/api/assistant/query" && request.method === "POST") {
    try {
      const result = await runAssistantQuery(request);
      if (result.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      if (result.invalid) {
        sendJson(response, 400, { error: "invalid_assistant_query" });
        return true;
      }
      if (result.unavailable) {
        sendJson(response, 503, { error: "database_unavailable" });
        return true;
      }
      if (result.notFound) {
        sendJson(response, 404, { error: "assistant_source_not_found" });
        return true;
      }
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 500, {
        error: "assistant_query_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (pathname === "/api/agent/query" && request.method === "POST") {
    try {
      const result = await runAuditaAgent(request);
      if (result.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      if (result.invalid) {
        sendJson(response, 400, { error: "invalid_agent_question" });
        return true;
      }
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 500, {
        error: "agent_query_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (pathname === "/api/itau-refund/analyze" && request.method === "POST") {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      const requestUrl = new URL(
        request.url || pathname,
        `http://${request.headers.host || "127.0.0.1"}`,
      );
      const buffer = await readBufferBody(request);
      const result = await itauRefundService.analyze({
        buffer,
        fileName: requestUrl.searchParams.get("filename") || "fatura",
        mimeType: request.headers["content-type"] || "",
        tenantId: authContext.tenantId,
        userId: authContext.user?.id || null,
      });
      if (result.invalid) {
        const statusCode = result.reason === "document_too_large" ? 413 : 400;
        sendJson(response, statusCode, {
          error: result.reason,
          maxBytes: result.maxBytes,
        });
        return true;
      }
      if (result.usage) {
        await apiUsageService.record(authContext, {
          provider: "openai",
          service: "responses",
          operation: "itau_statement_analysis",
          model: result.model || process.env.ITAU_ANALYSIS_MODEL || "gpt-5-mini",
          referenceId: result.case.id,
          unitName: "token",
          metadata: {
            candidateCount: result.case.candidates.length,
            mimeType: result.case.document.mimeType,
          },
          ...result.usage,
        });
      }
      if (pool && dbReady && authContext.tenantId) {
        await pool.query(
          `INSERT INTO audita_app_events (tenant_id, event_type, payload)
           VALUES ($1, 'itau.document.analyzed', $2)`,
          [
            authContext.tenantId,
            JSON.stringify({
              caseId: result.case.id,
              status: result.case.status,
              candidateCount: result.case.candidates.length,
              processedBy: result.case.document.processedBy,
            }),
          ],
        );
      }
      const access = await stripeBillingService.itauCaseAccessState(
        authContext,
        [result.case.id],
      );
      const locked = itauCaseHasFindings(result.case) && !access.entitled;
      sendJson(response, 200, {
        case: result.case,
        finding: {
          positive: itauCaseHasFindings(result.case),
          detailsAvailable: true,
          subscriptionRequired: locked,
        },
        access,
        billing: stripeBillingService.catalog(),
      });
    } catch (error) {
      sendJson(response, error?.code === "BODY_TOO_LARGE" ? 413 : 500, {
        error: error?.code === "BODY_TOO_LARGE" ? "document_too_large" : "itau_analysis_failed",
        message:
          error?.code === "BODY_TOO_LARGE"
            ? "O arquivo excede o limite de 12 MB."
            : "Nao foi possivel analisar o documento agora.",
      });
    }
    return true;
  }

  if (pathname === "/api/itau-refund/cases/search" && request.method === "POST") {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      const input = await readJsonBody(request);
      const result = itauRefundService.searchCases(
        input.caseIds,
        input.query,
        {
          tenantId: authContext.tenantId,
          userId: authContext.user?.id || null,
        },
      );
      if (result.invalid) {
        sendJson(response, 400, { error: result.reason });
        return true;
      }
      if (result.notFound) {
        sendJson(response, 404, { error: "itau_case_not_found" });
        return true;
      }
      if (result.forbidden) {
        sendJson(response, 403, { error: "itau_case_forbidden" });
        return true;
      }
      sendJson(response, 200, result);
    } catch {
      sendJson(response, 500, {
        error: "itau_directed_search_failed",
        message: "Nao foi possivel procurar a cobranca nos documentos agora.",
      });
    }
    return true;
  }

  const itauCaseMatch = pathname.match(/^\/api\/itau-refund\/cases\/([^/]+)$/);
  if (itauCaseMatch && ["GET", "POST"].includes(request.method)) {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      const auth = {
        tenantId: authContext.tenantId,
        userId: authContext.user?.id || null,
      };
      const caseId = decodeURIComponent(itauCaseMatch[1]);
      const current = itauRefundService.getCase(caseId, auth);
      if (current.notFound) {
        sendJson(response, 404, { error: "itau_case_not_found" });
        return true;
      }
      if (current.forbidden) {
        sendJson(response, 403, { error: "itau_case_forbidden" });
        return true;
      }
      const access = await stripeBillingService.itauCaseAccessState(authContext, [caseId]);
      const input = request.method === "POST" ? await readJsonBody(request) : null;
      const reviewOnly =
        input &&
        Object.keys(input).length === 1 &&
        input.candidateAnswers &&
        typeof input.candidateAnswers === "object";
      if (itauCaseHasFindings(current.case) && !access.entitled && !reviewOnly) {
        sendJson(response, 402, {
          error: "subscription_required",
          case: lockedItauCase(current.case),
          access,
        });
        return true;
      }
      const result =
        request.method === "POST"
          ? itauRefundService.updateCase(caseId, input, auth)
          : current;
      sendJson(response, 200, result);
    } catch {
      sendJson(response, 500, {
        error: "itau_case_update_failed",
        message: "Nao foi possivel atualizar a revisao agora.",
      });
    }
    return true;
  }

  if (pathname === "/api/chat" && request.method === "POST") {
    try {
      const result = await runChatConversation(request);
      if (result.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      if (result.invalid) {
        sendJson(response, 400, { error: "invalid_chat_messages" });
        return true;
      }
      if (result.unavailable) {
        sendJson(response, 503, {
          error: result.reason || "chat_unavailable",
          secretRef: result.secretRef || "AUDITA_OPENAI_API_KEY",
        });
        return true;
      }
      sendJson(response, 200, result);
    } catch (error) {
      const timedOut = error?.name === "AbortError" || /aborted|timeout/i.test(String(error?.message || ""));
      sendJson(response, timedOut ? 504 : 500, {
        error: timedOut ? "chat_timeout" : "chat_failed",
        message: timedOut
          ? "A IA AUDITA demorou mais que o esperado para responder."
          : "Nao foi possivel concluir esta conversa.",
      });
    }
    return true;
  }

  if (pathname === "/api/admin/api-usage" && request.method === "GET") {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      if (authRequired && !canManageIntegrations(authContext.user)) {
        sendJson(response, 403, { error: "insufficient_role" });
        return true;
      }
      const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
      const days = requestUrl.searchParams.get("days") || 30;
      const [dashboard, officialOpenAI] = await Promise.all([
        apiUsageService.getDashboard(authContext, {
          days,
          provider: requestUrl.searchParams.get("provider") || "",
        }),
        openAIOfficialUsageService.getUsage({
          days,
          force: requestUrl.searchParams.get("sync") === "1",
        }),
      ]);
      sendJson(response, 200, { ...dashboard, officialOpenAI });
    } catch (error) {
      sendJson(response, 500, {
        error: "api_usage_query_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (pathname === "/api/admin/api-pricing" && request.method === "POST") {
    try {
      const authContext = await getTenantIdForRequest(request);
      if (authContext.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      if (authRequired && !canManageIntegrations(authContext.user)) {
        sendJson(response, 403, { error: "insufficient_role" });
        return true;
      }
      const pricing = await apiUsageService.savePricing(authContext, await readJsonBody(request));
      if (pricing.invalid) {
        sendJson(response, 400, { error: "invalid_api_pricing" });
        return true;
      }
      sendJson(response, 200, { pricing });
    } catch (error) {
      sendJson(response, 500, {
        error: "api_pricing_save_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (pathname === "/api/agent/settings" && request.method === "GET") {
    try {
      const settings = await getAgentSettings(request);
      if (settings.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      sendJson(response, 200, { settings });
    } catch (error) {
      sendJson(response, 500, {
        error: "agent_settings_query_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (pathname === "/api/agent/settings" && request.method === "POST") {
    try {
      const settings = await saveAgentSettings(request);
      if (settings.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      if (settings.forbidden) {
        sendJson(response, 403, { error: "insufficient_role" });
        return true;
      }
      if (settings.unavailable) {
        sendJson(response, 503, { error: "database_unavailable" });
        return true;
      }
      if (settings.invalid) {
        sendJson(response, 400, { error: "invalid_agent_settings" });
        return true;
      }
      sendJson(response, 200, { settings });
    } catch (error) {
      sendJson(response, 500, {
        error: "agent_settings_save_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (pathname === "/api/audits" && request.method === "GET") {
    try {
      const audits = await listAudits(request);
      if (audits.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      sendJson(response, 200, { audits });
    } catch (error) {
      sendJson(response, 500, {
        error: "audits_query_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  if (pathname === "/api/audits" && request.method === "POST") {
    try {
      const audit = await createAudit(request);
      if (audit.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      if (audit.invalid) {
        sendJson(response, 400, { error: "invalid_audit_request" });
        return true;
      }
      sendJson(response, 201, { audit });
    } catch (error) {
      sendJson(response, 500, {
        error: "audit_create_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  const auditEvidenceMatch = pathname.match(/^\/api\/audits\/(\d+|[A-Za-z0-9_-]+)\/evidence$/);
  if (auditEvidenceMatch && request.method === "POST") {
    try {
      const result = await addAuditEvidence(request, auditEvidenceMatch[1]);
      if (result.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      if (result.invalid) {
        sendJson(response, 400, { error: "invalid_audit_evidence" });
        return true;
      }
      if (result.notFound) {
        sendJson(response, 404, { error: "audit_execution_not_found" });
        return true;
      }
      sendJson(response, 201, result);
    } catch (error) {
      sendJson(response, 500, {
        error: "audit_evidence_create_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return true;
  }

  const auditMatch = pathname.match(/^\/api\/audits\/(\d+|[A-Za-z0-9_-]+)$/);
  if (auditMatch && request.method === "GET") {
    try {
      const audit = await getAudit(request, auditMatch[1]);
      if (audit.unauthorized) {
        sendJson(response, 401, { error: "authentication_required" });
        return true;
      }
      if (audit.notFound) {
        sendJson(response, 404, { error: "audit_not_found" });
        return true;
      }
      sendJson(response, 200, { audit });
    } catch (error) {
      sendJson(response, 500, {
        error: "audit_query_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
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

const chatBrowserWss = new WebSocketServer({ noServer: true });
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  if (await handleApi(request, response, url.pathname)) {
    return;
  }

  const uiRoute = resolveUiRoute(url.pathname);
  if (uiRoute.type === "redirect") {
    response.writeHead(302, {
      location: uiRoute.location,
      "cache-control": "no-store",
    });
    response.end();
    return;
  }

  const requestedPath = uiRoute.path;
  if (
    String(requestedPath)
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .startsWith("private-documents/")
  ) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
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

server.on("upgrade", async (request, socket, head) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const match = url.pathname.match(
      /^\/api\/chat-browser-sessions\/([A-Za-z0-9_-]+)\/cast$/,
    );
    if (!match) {
      socket.destroy();
      return;
    }
    const authContext = await getTenantIdForRequest(request);
    if (authContext.unauthorized) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    const owned = chatBrowserService.getRawOwnedSession(match[1], authContext);
    if (owned.notFound || owned.forbidden) {
      socket.write(
        `HTTP/1.1 ${owned.forbidden ? "403 Forbidden" : "404 Not Found"}\r\nConnection: close\r\n\r\n`,
      );
      socket.destroy();
      return;
    }
    const upstreamUrl = chatBrowserService.upstreamCastUrl(match[1], request.url);
    if (!upstreamUrl) {
      socket.destroy();
      return;
    }
    chatBrowserWss.handleUpgrade(request, socket, head, (client) => {
      const upstream = new WebSocket(upstreamUrl, { perMessageDeflate: false });
      const pending = [];
      let closed = false;
      const closeBoth = (code = 1000, reason = "") => {
        if (closed) return;
        closed = true;
        const safeCode = normalizeWebSocketCloseCode(code);
        const safeClose = (websocket) => {
          if (websocket.readyState !== WebSocket.OPEN) return;
          try {
            websocket.close(safeCode);
          } catch {
            websocket.terminate();
          }
        };
        safeClose(client);
        safeClose(upstream);
        if (upstream.readyState === WebSocket.CONNECTING) upstream.terminate();
      };
      client.on("message", (data, isBinary) => {
        if (upstream.readyState === WebSocket.OPEN) {
          upstream.send(data, { binary: isBinary });
        } else if (upstream.readyState === WebSocket.CONNECTING && pending.length < 100) {
          pending.push({ data, isBinary });
        }
      });
      upstream.on("open", () => {
        for (const item of pending.splice(0)) {
          upstream.send(item.data, { binary: item.isBinary });
        }
      });
      upstream.on("message", (data, isBinary) => {
        if (client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary });
      });
      client.on("close", (code, reason) => closeBoth(code, reason.toString()));
      upstream.on("close", (code, reason) => closeBoth(code, reason.toString()));
      client.on("error", () => closeBoth(1011, "client_error"));
      upstream.on("error", () => closeBoth(1011, "upstream_error"));
    });
  } catch {
    socket.destroy();
  }
});

await initializeProfileEncryptionKey();
await initializeDatabase();

server.listen(port, host, () => {
  console.log(`Audita web app running at http://${host}:${port}/`);
});
