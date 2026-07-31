import { validateCpf } from "./audit.service.mjs";

export const DF_SELLER_CERTIFICATE_TYPES = ["criminal", "civil", "falencia", "especial"];

export function normalizeDfSellerInput(value = {}) {
  const cpf = String(value.cpf || value.documento || "").replace(/\D/g, "");
  const fullName = String(value.fullName || value.firstName || "").replace(/\s+/g, " ").trim();
  const motherName = String(value.motherName || "").replace(/\s+/g, " ").trim();
  const missingFields = [];

  if (!validateCpf(cpf)) missingFields.push("cpf");
  if (!fullName) missingFields.push("fullName");
  if (value.authorizationConfirmed !== true) missingFields.push("authorizationConfirmed");

  return {
    invalid: missingFields.length > 0,
    missingFields,
    cpf,
    fullName,
    motherName,
    authorizationConfirmed: value.authorizationConfirmed === true,
  };
}

export function buildDfSellerAuditRequest(value = {}) {
  const normalized = normalizeDfSellerInput(value);
  const { cpf, fullName, motherName } = normalized;
  const firstName = fullName.split(/\s+/)[0] || "";
  const missingFields = [...normalized.missingFields];
  if (!motherName) missingFields.push("motherName");

  if (missingFields.length) {
    return { invalid: true, missingFields };
  }

  return {
    invalid: false,
    requestBody: {
      tipoDocumento: "cpf",
      documento: cpf,
      fontes: ["tjdft"],
      authorizationConfirmed: true,
      extraFields: {
        cpfDocument: cpf,
        stateCourtUf: "DF",
        stateCourtName: "TJDFT",
        stateCourtUrl: "https://cnc.tjdft.jus.br/solicitacao-externa",
        stateCourtProfileId: "DF",
        tjdftPersonType: "pf",
        tjdftCertificateTypes: [...DF_SELLER_CERTIFICATE_TYPES],
        firstName,
        fullName,
        motherName,
        stateCourtFields: {
          firstName,
          fullName,
          motherName,
        },
      },
    },
  };
}
