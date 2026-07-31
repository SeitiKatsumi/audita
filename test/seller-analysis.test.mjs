import assert from "node:assert/strict";
import test from "node:test";

import {
  DF_SELLER_CERTIFICATE_TYPES,
  buildDfSellerAuditRequest,
  normalizeDfSellerInput,
} from "../services/seller-analysis.service.mjs";

const validInput = {
  cpf: "529.982.247-25",
  fullName: "Maria da Silva",
  motherName: "Ana da Silva",
  authorizationConfirmed: true,
};

test("DF seller analysis always requests every supported TJDFT certificate", () => {
  const result = buildDfSellerAuditRequest({
    ...validInput,
    fontes: ["portal_transparencia"],
    certificateTypes: ["criminal"],
  });

  assert.equal(result.invalid, false);
  assert.equal(result.requestBody.tipoDocumento, "cpf");
  assert.deepEqual(result.requestBody.fontes, ["tjdft"]);
  assert.deepEqual(
    result.requestBody.extraFields.tjdftCertificateTypes,
    DF_SELLER_CERTIFICATE_TYPES,
  );
  assert.equal(result.requestBody.extraFields.stateCourtUf, "DF");
  assert.equal(result.requestBody.extraFields.firstName, "Maria");
  assert.equal(result.requestBody.extraFields.fatherName, undefined);
});

test("DF seller input initially requires only valid CPF, full name and authorization", () => {
  const result = normalizeDfSellerInput({
    cpf: "529.982.247-25",
    fullName: "Maria da Silva",
    authorizationConfirmed: true,
  });

  assert.equal(result.invalid, false);
  assert.equal(result.motherName, "");
});

test("DF seller audit request requires the mother name resolved by enrichment or fallback", () => {
  const result = buildDfSellerAuditRequest({
    cpf: "111.111.111-11",
    fullName: "",
    motherName: "",
    authorizationConfirmed: false,
  });

  assert.equal(result.invalid, true);
  assert.deepEqual(result.missingFields, [
    "cpf",
    "fullName",
    "authorizationConfirmed",
    "motherName",
  ]);
});
