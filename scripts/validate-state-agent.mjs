import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { collect, closeAssistedSession, getAssistedSessionView } from "../collectors/tjdft.collector.mjs";
import { findStateCourtProfile } from "../services/state-courts.service.mjs";
import { getStateCourtAgentSession } from "../services/state-court-agent.service.mjs";

function loadEnvFile(fileName) {
  const filePath = join(process.cwd(), fileName);
  if (!existsSync(filePath)) return;
  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [name, ...rest] = line.split("=");
    if (!process.env[name]) {
      process.env[name] = rest.join("=");
    }
  }
}

function maskDocument(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length <= 4) return "*".repeat(digits.length);
  return `${digits.slice(0, 3)}${"*".repeat(Math.max(0, digits.length - 5))}${digits.slice(-2)}`;
}

function envList(name, fallback) {
  return String(process.env[name] || fallback)
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

async function waitForAgent(agentSessionId, timeoutMs) {
  const start = Date.now();
  let session = null;
  while (Date.now() - start < timeoutMs) {
    session = getStateCourtAgentSession(agentSessionId);
    if (!session) return null;
    if (!["ready", "running"].includes(session.status)) {
      return session;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return getStateCourtAgentSession(agentSessionId) || session;
}

loadEnvFile(".env.local");
loadEnvFile(".env");

process.env.AUDITA_REMOTE_ASSISTED_BROWSER ??= "true";
process.env.STATE_COURT_AGENT_RUN_TIMEOUT_MS ??= "180000";
process.env.STATE_COURT_AGENT_MAX_TURNS ??= "24";

const ufs = envList("STATE_COURT_AGENT_VALIDATE_UFS", process.argv.slice(2).join(",") || "AC,PI,RO,RS");
const timeoutMs = Number(process.env.STATE_COURT_AGENT_VALIDATE_TIMEOUT_MS || 210000);
const documentValue = String(process.env.STATE_COURT_AGENT_VALIDATE_CPF || "49532724800").replace(/\D/g, "");
const stateCourtFields = {
  fullName: process.env.STATE_COURT_AGENT_VALIDATE_FULL_NAME || "Vicente Costa Zippinotti",
  rg: process.env.STATE_COURT_AGENT_VALIDATE_RG || "596907047",
  issuingAuthority: process.env.STATE_COURT_AGENT_VALIDATE_ISSUING_AUTHORITY || "SSP",
  civilStatus: process.env.STATE_COURT_AGENT_VALIDATE_CIVIL_STATUS || "Solteiro",
  motherName: process.env.STATE_COURT_AGENT_VALIDATE_MOTHER || "Suzana Costa Zippinotti",
  fatherName: process.env.STATE_COURT_AGENT_VALIDATE_FATHER || "Marcus Gualberto Zippinotti",
  birthDate: process.env.STATE_COURT_AGENT_VALIDATE_BIRTH_DATE || "2002-07-01",
  address: process.env.STATE_COURT_AGENT_VALIDATE_ADDRESS || "Rua Benedito Ralph Janel Cissini",
  addressNumber: process.env.STATE_COURT_AGENT_VALIDATE_ADDRESS_NUMBER || "23",
  addressComplement: process.env.STATE_COURT_AGENT_VALIDATE_ADDRESS_COMPLEMENT || "",
  cep: process.env.STATE_COURT_AGENT_VALIDATE_CEP || "13212163",
  neighborhood: process.env.STATE_COURT_AGENT_VALIDATE_NEIGHBORHOOD || "Condomínio Reserva da Serra",
  city: process.env.STATE_COURT_AGENT_VALIDATE_CITY || "Jundiaí",
  stateUf: process.env.STATE_COURT_AGENT_VALIDATE_STATE_UF || "SP",
  email: process.env.STATE_COURT_AGENT_VALIDATE_EMAIL || "vicentezipp@hotmail.com",
};

const report = [];

for (const uf of ufs) {
  const profile = findStateCourtProfile(uf);
  if (!profile) {
    report.push({ uf, status: "profile_not_found" });
    continue;
  }

  const startedAt = Date.now();
  let assistedSession = "";
  try {
    const result = await collect({
      consultaId: `agent-validation-${uf.toLowerCase()}-${Date.now()}`,
      documento: documentValue,
      tipoDocumento: "cpf",
      extraFields: {
        cpfDocument: documentValue,
        stateCourtUf: profile.uf,
        stateCourtName: profile.court,
        stateCourtUrl: profile.url,
        stateCourtFields,
        stateCourtCertificateTypes: ["civil", "criminal"],
      },
      timeoutMs: Number(process.env.STATE_COURT_AGENT_VALIDATE_NAV_TIMEOUT_MS || 30000),
    });

    const data = result.dados || {};
    assistedSession = data.assistedSession || "";
    const agentSessionId = data.agentSession || "";
    const agentSession = agentSessionId ? await waitForAgent(agentSessionId, timeoutMs) : null;
    const view = assistedSession ? await getAssistedSessionView(assistedSession).catch(() => null) : null;
    const messages = Array.isArray(agentSession?.messages) ? agentSession.messages : [];

    report.push({
      uf,
      tribunal: profile.court,
      url: profile.url,
      collectorStatus: result.status,
      collectorMode: data.modo || "",
      agentSession: agentSessionId,
      agentStatus: agentSession?.status || data.agentStatus || "",
      nextAction: agentSession?.nextAction || data.agentNextAction || "",
      assistedSession,
      portalUrl: view?.url || "",
      portalTitle: view?.title || "",
      outcomeStatus: view?.outcome?.status || "",
      visibleControls: view?.formState?.controls?.slice(0, 12).map(({ label, type, filled, options }) => ({ label, type, filled, options })) || [],
      visibleActions: view?.formState?.actions?.slice(0, 12) || [],
      messages: messages.slice(-8).map((message) => ({
        role: message.role,
        content: String(message.content || "").replaceAll(documentValue, maskDocument(documentValue)).slice(0, 700),
      })),
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    report.push({
      uf,
      tribunal: profile.court,
      url: profile.url,
      status: "error",
      errorMessage: error instanceof Error ? error.message : "unknown_error",
      durationMs: Date.now() - startedAt,
    });
  } finally {
    if (assistedSession) {
      await closeAssistedSession(assistedSession).catch(() => {});
    }
  }
}

const output = {
  checkedAt: new Date().toISOString(),
  document: maskDocument(documentValue),
  ufs,
  report,
};

mkdirSync("output", { recursive: true });
mkdirSync(join("output", "state-agent"), { recursive: true });
const outputPath = join("output", "state-agent", `latest-${Date.now()}.json`);
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, ...output }, null, 2));
