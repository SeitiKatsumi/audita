import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { collect, closeAssistedSession, getAssistedSessionView } from "../collectors/tjdft.collector.mjs";
import { findStateCourtProfile } from "../services/state-courts.service.mjs";

function loadEnvFile(fileName) {
  const filePath = join(process.cwd(), fileName);
  if (!existsSync(filePath)) return;
  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [name, ...rest] = line.split("=");
    if (!process.env[name]) process.env[name] = rest.join("=");
  }
}

function envList(name, fallback) {
  return String(process.env[name] || fallback)
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function envIdList(name, fallback) {
  return String(process.env[name] || fallback)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function maskDocument(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length <= 4) return "*".repeat(digits.length);
  return `${digits.slice(0, 3)}${"*".repeat(Math.max(0, digits.length - 5))}${digits.slice(-2)}`;
}

function hasEvidence(data) {
  const certidoes = Array.isArray(data?.certidoes) ? data.certidoes : [];
  return Boolean(
    data?.pdfPath ||
      data?.pdfDownloaded ||
      data?.protocol ||
      data?.numeroPedido ||
      data?.numeroCertidao ||
      data?.codigoValidacao ||
      certidoes.some((item) => item?.pdfPath || item?.protocol || item?.numeroPedido || item?.numeroCertidao || item?.codigoValidacao),
  );
}

function summarizeResult(result, view) {
  const data = result?.dados || {};
  const certidoes = Array.isArray(data.certidoes) ? data.certidoes : [];
  const checkpointText = [
    result?.erro,
    data?.resumo,
    data?.proximoPasso,
    ...certidoes.map((item) => `${item?.errorMessage || ""} ${item?.resumo || ""}`),
  ].join(" ");
  return {
    status: result?.status || "",
    resultado: result?.resultado || "",
    erro: result?.erro || "",
    modo: data.modo || "",
    tribunal: data.tribunal || "",
    uf: data.uf || "",
    automationStatus: data.automationStatus || "",
    captchaMode: data.captchaMode || "",
    assistedSession: data.assistedSession || "",
    captchaRequired: Boolean(
      data.requiresCaptcha ||
        data.requiresRecaptcha ||
        data.captchaRequired ||
        data.blockedByProtection ||
        /captcha|recaptcha|hcaptcha|c[oó]digo de seguran[cç]a|valida[cç][aã]o oficial|cloudflare|turnstile/i.test(checkpointText),
    ),
    portalOutcome: view?.outcome?.status || "",
    portalUrl: view?.url || data.officialUrl || "",
    pdfEvidence: hasEvidence(data),
    totalCertidoes: data.totalCertidoes ?? certidoes.length,
    certidoesBaixadas: data.certidoesBaixadas ?? certidoes.filter((item) => item.pdfPath).length,
    certidoes: certidoes.slice(0, 8).map((item) => ({
      tipo: item.tipo || "",
      status: item.status || "",
      resultado: item.resultado || "",
      errorMessage: item.errorMessage || "",
      pdf: Boolean(item.pdfPath || item.pdfDownloaded),
      protocol: item.protocol || item.numeroPedido || item.numeroCertidao || "",
    })),
    resumo: data.resumo || data.proximoPasso || "",
  };
}

loadEnvFile(".env.local");
loadEnvFile(".env");

process.env.AUDITA_REMOTE_ASSISTED_BROWSER ??= "true";
process.env.STATE_COURT_KEEP_ASSISTED_OPEN ??= "false";
process.env.STATE_COURT_ASSISTED_HEADLESS ??= "true";
process.env.STATE_COURT_HEADLESS ??= "true";
process.env.TJDFT_HEADLESS ??= "true";

const ufs = envList("STATE_COURT_FUNCTIONAL_VALIDATE_UFS", process.argv.slice(2).join(",") || "DF,ES,GO,BA,MA,PE,SE,AL,MS,SP");
const documentValue = String(process.env.STATE_COURT_VALIDATE_CPF || "49532724800").replace(/\D/g, "");
const stateCourtFields = {
  firstName: process.env.STATE_COURT_VALIDATE_FIRST_NAME || "Vicente",
  fullName: process.env.STATE_COURT_VALIDATE_FULL_NAME || "Vicente Costa Zippinotti",
  rg: process.env.STATE_COURT_VALIDATE_RG || "596907047",
  motherName: process.env.STATE_COURT_VALIDATE_MOTHER || "Suzana Costa Zippinotti",
  fatherName: process.env.STATE_COURT_VALIDATE_FATHER || "Marcus Gualberto Zippinotti",
  birthDate: process.env.STATE_COURT_VALIDATE_BIRTH_DATE || "2002-07-01",
  gender: process.env.STATE_COURT_VALIDATE_GENDER || "Masculino",
  nationality: process.env.STATE_COURT_VALIDATE_NATIONALITY || "BRASILEIRO",
  naturality: process.env.STATE_COURT_VALIDATE_NATURALITY || "Brasileiro",
  civilStatus: process.env.STATE_COURT_VALIDATE_CIVIL_STATUS || "Solteiro",
  profession: process.env.STATE_COURT_VALIDATE_PROFESSION || "Publicitário",
  address: process.env.STATE_COURT_VALIDATE_ADDRESS || "Rua Benedito Ralph Janel Cissini",
  addressComplement: process.env.STATE_COURT_VALIDATE_ADDRESS_COMPLEMENT || "23",
  addressNumber: process.env.STATE_COURT_VALIDATE_ADDRESS_NUMBER || "23",
  cep: process.env.STATE_COURT_VALIDATE_CEP || "13212163",
  neighborhood: process.env.STATE_COURT_VALIDATE_NEIGHBORHOOD || "Condomínio Reserva da Serra",
  city: process.env.STATE_COURT_VALIDATE_CITY || "Jundiaí",
  email: process.env.STATE_COURT_VALIDATE_EMAIL || "vicentezipp@hotmail.com",
  participation: process.env.STATE_COURT_VALIDATE_PARTICIPATION || "Parte",
  issuingAuthority: process.env.STATE_COURT_VALIDATE_ISSUING_AUTHORITY || "SSP",
  instance: process.env.STATE_COURT_VALIDATE_INSTANCE || "1",
  nature: process.env.STATE_COURT_VALIDATE_NATURE || "civil",
  domicile: process.env.STATE_COURT_VALIDATE_DOMICILE || "Jundiaí",
  comarca: process.env.STATE_COURT_VALIDATE_COMARCA || "Campo Grande",
  certificateKind: process.env.STATE_COURT_VALIDATE_CERTIFICATE_KIND || "civil",
};

const checkedAt = new Date().toISOString();
const report = [];

for (const uf of ufs) {
  const profile = findStateCourtProfile(uf);
  if (!profile) {
    report.push({ uf, status: "profile_not_found" });
    continue;
  }

  let assistedSession = "";
  const startedAt = Date.now();
  try {
    const result = await collect({
      consultaId: `functional-validation-${uf.toLowerCase()}-${Date.now()}`,
      documento: documentValue,
      tipoDocumento: "cpf",
      extraFields: {
        firstName: stateCourtFields.firstName,
        motherName: stateCourtFields.motherName,
        fatherName: stateCourtFields.fatherName,
        cpfDocument: documentValue,
        stateCourtUf: profile.uf,
        stateCourtName: profile.court,
        stateCourtUrl: profile.url,
        stateCourtFields,
        stateCourtCertificateTypes: envIdList("STATE_COURT_FUNCTIONAL_CERT_TYPES", "civil"),
      },
      timeoutMs: Number(process.env.STATE_COURT_FUNCTIONAL_NAV_TIMEOUT_MS || 45000),
    });
    assistedSession = result?.dados?.assistedSession || "";
    const view = assistedSession ? await getAssistedSessionView(assistedSession).catch(() => null) : null;
    report.push({
      uf,
      profile: {
        court: profile.court,
        platform: profile.platform,
        automationStatus: profile.automationStatus,
        captchaMode: profile.captchaMode,
      },
      ...summarizeResult(result, view),
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    report.push({
      uf,
      profile: {
        court: profile.court,
        platform: profile.platform,
        automationStatus: profile.automationStatus,
        captchaMode: profile.captchaMode,
      },
      status: "exception",
      erro: error instanceof Error ? error.message : "erro desconhecido",
      durationMs: Date.now() - startedAt,
    });
  } finally {
    if (assistedSession) await closeAssistedSession(assistedSession).catch(() => {});
  }
}

const outputDir = join(process.cwd(), "output", "state-functional");
mkdirSync(outputDir, { recursive: true });
const outputPath = join(outputDir, `latest-${Date.now()}.json`);
const payload = {
  checkedAt,
  document: maskDocument(documentValue),
  ufs,
  report,
};
writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");
console.log(JSON.stringify({ outputPath, checkedAt, document: payload.document, ufs, report }, null, 2));
