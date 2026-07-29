import crypto from "node:crypto";

const VALID_UFS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
]);

const MARITAL_STATUS = new Map([
  ["solteiro", "Solteiro(a)"],
  ["solteira", "Solteiro(a)"],
  ["solteiro(a)", "Solteiro(a)"],
  ["casado", "Casado(a)"],
  ["casada", "Casado(a)"],
  ["casado(a)", "Casado(a)"],
  ["divorciado", "Divorciado(a)"],
  ["divorciada", "Divorciado(a)"],
  ["divorciado(a)", "Divorciado(a)"],
  ["viuvo", "Viúvo(a)"],
  ["viuva", "Viúvo(a)"],
  ["viúvo", "Viúvo(a)"],
  ["viúva", "Viúvo(a)"],
  ["viuvo(a)", "Viúvo(a)"],
  ["viúvo(a)", "Viúvo(a)"],
  ["separado", "Separado(a)"],
  ["separada", "Separado(a)"],
  ["separado(a)", "Separado(a)"],
  ["uniao estavel", "União estável"],
  ["união estável", "União estável"],
]);

const NATIONALITIES = new Map([
  ["brasileiro", "Brasileiro(a)"],
  ["brasileira", "Brasileiro(a)"],
  ["brasileiro(a)", "Brasileiro(a)"],
  ["estrangeiro", "Estrangeiro(a)"],
  ["estrangeira", "Estrangeiro(a)"],
  ["estrangeiro(a)", "Estrangeiro(a)"],
]);

export class UserProfileValidationError extends Error {
  constructor(errors) {
    super("Perfil cadastral inválido.");
    this.name = "UserProfileValidationError";
    this.code = "invalid_user_profile";
    this.errors = errors;
  }
}

function cleanText(value, maxLength) {
  return String(value || "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function plainKey(value) {
  return cleanText(value, 80)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
}

function digits(value, maxLength = 32) {
  return String(value || "").replace(/\D/g, "").slice(0, maxLength);
}

export function validateProfileCpf(value) {
  const cpf = digits(value, 11);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  const calculateDigit = (base) => {
    const total = base
      .split("")
      .map(Number)
      .reduce((sum, digit, index) => sum + digit * (base.length + 1 - index), 0);
    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return (
    calculateDigit(cpf.slice(0, 9)) === Number(cpf[9]) &&
    calculateDigit(cpf.slice(0, 10)) === Number(cpf[10])
  );
}

export function formatProfileCpf(value) {
  const cpf = digits(value, 11);
  if (cpf.length !== 11) return cpf;
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

export function formatProfilePhone(value) {
  const phone = digits(value, 11);
  if (phone.length === 11) {
    return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`;
  }
  if (phone.length === 10) {
    return `(${phone.slice(0, 2)}) ${phone.slice(2, 6)}-${phone.slice(6)}`;
  }
  return phone;
}

export function formatProfilePostalCode(value) {
  const postalCode = digits(value, 8);
  return postalCode.length === 8
    ? `${postalCode.slice(0, 5)}-${postalCode.slice(5)}`
    : postalCode;
}

function normalizeRg(value) {
  return cleanText(value, 20)
    .replace(/[^\p{L}\p{N}./ -]/gu, "")
    .toLocaleUpperCase("pt-BR");
}

function normalizeOption(value, options) {
  const cleaned = cleanText(value, 80);
  return options.get(plainKey(cleaned)) || cleaned;
}

export function buildProfileAddress(profile = {}) {
  const streetLine = [profile.street, profile.addressNumber]
    .map((value) => cleanText(value, 160))
    .filter(Boolean)
    .join(", ");
  return [
    streetLine,
    cleanText(profile.addressComplement, 80),
    cleanText(profile.district, 80),
    [cleanText(profile.city, 100), cleanText(profile.uf, 2)]
      .filter(Boolean)
      .join("/"),
    formatProfilePostalCode(profile.postalCode),
  ]
    .filter(Boolean)
    .join(" - ")
    .slice(0, 300);
}

export function normalizeUserProfile(input = {}) {
  const profile = {
    fullName: cleanText(input.fullName, 160),
    document: digits(input.document, 11),
    rg: normalizeRg(input.rg),
    nationality: normalizeOption(input.nationality, NATIONALITIES),
    maritalStatus: normalizeOption(input.maritalStatus, MARITAL_STATUS),
    profession: cleanText(input.profession, 120),
    email: cleanText(input.email, 160).toLocaleLowerCase("pt-BR"),
    phone: digits(input.phone, 11),
    postalCode: digits(input.postalCode, 8),
    street: cleanText(input.street, 160),
    addressNumber: cleanText(input.addressNumber, 20),
    addressComplement: cleanText(input.addressComplement, 80),
    district: cleanText(input.district, 80),
    city: cleanText(input.city, 100),
    uf: cleanText(input.uf, 2).toUpperCase(),
  };
  const errors = {};

  if (profile.fullName && profile.fullName.length < 2) errors.fullName = "Nome inválido.";
  if (profile.document && !validateProfileCpf(profile.document)) errors.document = "CPF inválido.";
  if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
    errors.email = "E-mail inválido.";
  }
  if (profile.phone && ![10, 11].includes(profile.phone.length)) {
    errors.phone = "Telefone deve conter DDD e 10 ou 11 dígitos.";
  }
  if (profile.postalCode && profile.postalCode.length !== 8) {
    errors.postalCode = "CEP deve conter 8 dígitos.";
  }
  if (profile.uf && !VALID_UFS.has(profile.uf)) errors.uf = "UF inválida.";
  if (Object.keys(errors).length) throw new UserProfileValidationError(errors);

  return {
    ...profile,
    address: buildProfileAddress(profile) || cleanText(input.address, 300),
  };
}

export function profileForClient(profile = {}, account = {}) {
  const normalized = normalizeUserProfile({
    ...profile,
    fullName: profile.fullName || account.name,
    email: profile.email || account.email,
  });
  return {
    ...normalized,
    document: formatProfileCpf(normalized.document),
    phone: formatProfilePhone(normalized.phone),
    postalCode: formatProfilePostalCode(normalized.postalCode),
  };
}

export function resolveProfileEncryptionKey(value) {
  const secret = String(value || "").trim();
  if (!secret || secret === "change-me" || secret.length < 32) return null;
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

export function encryptUserProfile(profile, key, context) {
  if (!key) throw new Error("profile_encryption_not_configured");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(String(context || ""), "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(profile), "utf8"),
    cipher.final(),
  ]);
  return JSON.stringify({
    v: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: ciphertext.toString("base64"),
  });
}

export function decryptUserProfile(payload, key, context) {
  if (!payload) return {};
  if (!key) throw new Error("profile_encryption_not_configured");
  const envelope = typeof payload === "string" ? JSON.parse(payload) : payload;
  if (envelope?.v !== 1) throw new Error("unsupported_profile_encryption_version");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(envelope.iv, "base64"),
  );
  decipher.setAAD(Buffer.from(String(context || ""), "utf8"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.data, "base64")),
    decipher.final(),
  ]);
  return normalizeUserProfile(JSON.parse(plaintext.toString("utf8")));
}
