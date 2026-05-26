import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(".");
const catalogPath = join(root, "data", "state-courts.json");

let cachedCatalog = null;

export const STATE_COURT_FIELD_LABELS = {
  document: "CPF/CNPJ",
  fullName: "Nome completo / Razao social",
  firstName: "Primeiro nome",
  motherName: "Nome da mae",
  fatherName: "Nome do pai",
  birthDate: "Data de nascimento",
  rg: "RG",
  email: "E-mail",
  comarca: "Comarca",
  companyName: "Razao social",
};

export const STATE_COURT_CERTIFICATE_LABELS = {
  criminal: "Criminal",
  civil: "Civel",
  falencia: "Falencia e Recuperacao Judicial",
  especial: "Especial (Civel e Criminal)",
};

export function getStateCourtCatalog() {
  if (!cachedCatalog) {
    cachedCatalog = JSON.parse(readFileSync(catalogPath, "utf-8"));
  }
  return cachedCatalog;
}

export function listStateCourtProfiles() {
  return getStateCourtCatalog().profiles || [];
}

export function findStateCourtProfile(uf) {
  const normalizedUf = String(uf || "DF").trim().toUpperCase();
  return listStateCourtProfiles().find((profile) => profile.uf === normalizedUf) || listStateCourtProfiles().find((profile) => profile.uf === "DF");
}

export function getStateCourtFieldLabel(fieldId) {
  return STATE_COURT_FIELD_LABELS[fieldId] || fieldId;
}

export function getStateCourtCertificateLabel(certificateId) {
  return STATE_COURT_CERTIFICATE_LABELS[certificateId] || certificateId;
}
