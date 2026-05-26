import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(".");
const catalogPath = join(root, "data", "state-courts.json");

let cachedCatalog = null;

export const STATE_COURT_FIELD_LABELS = {
  document: "CPF/CNPJ",
  instance: "Instância",
  certificateKind: "Tipo de certidão",
  participation: "Tipo de participação",
  fullName: "Nome completo / razão social",
  firstName: "Primeiro nome",
  motherName: "Nome da mãe",
  fatherName: "Nome do pai",
  birthDate: "Data de nascimento",
  rg: "RG",
  voterTitle: "Título de eleitor",
  ctpsNumber: "CTPS número",
  ctpsSeries: "CTPS série",
  gender: "Gênero",
  nationality: "Nacionalidade",
  naturality: "Naturalidade",
  civilStatus: "Estado civil",
  profession: "Profissão",
  address: "Endereço",
  addressNumber: "Número",
  addressComplement: "Complemento",
  cep: "CEP",
  neighborhood: "Bairro",
  city: "Município",
  email: "E-mail",
  phone: "Telefone fixo",
  mobile: "Telefone celular",
  comarca: "Comarca",
  companyName: "Razão social",
};

export const STATE_COURT_CERTIFICATE_LABELS = {
  criminal: "Criminal",
  civil: "Cível",
  falencia: "Falência e Recuperação Judicial",
  especial: "Especial (Cível e Criminal)",
  inventario: "Inventário / Arrolamento",
  insolvencia: "Insolvência",
  interdicao: "Interdição / Curatela",
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
