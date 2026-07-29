import assert from "node:assert/strict";
import test from "node:test";

import {
  decryptUserProfile,
  encryptUserProfile,
  formatProfileCpf,
  formatProfilePhone,
  normalizeUserProfile,
  profileForClient,
  resolveProfileEncryptionKey,
  UserProfileValidationError,
} from "../services/user-profile.service.mjs";

const rawProfile = {
  fullName: "  Cliente   Teste ",
  document: "529.982.247-25",
  rg: "mg-12.345.678",
  nationality: "brasileiro",
  maritalStatus: "solteira",
  profession: "Analista",
  email: "CLIENTE@EXAMPLE.COM",
  phone: "(11) 99999-9999",
  postalCode: "01310-100",
  street: "Avenida Paulista",
  addressNumber: "1000",
  addressComplement: "Conjunto 10",
  district: "Bela Vista",
  city: "São Paulo",
  uf: "sp",
};

test("normalizes and formats reusable profile fields", () => {
  const profile = normalizeUserProfile(rawProfile);

  assert.equal(profile.fullName, "Cliente Teste");
  assert.equal(profile.document, "52998224725");
  assert.equal(profile.rg, "MG-12.345.678");
  assert.equal(profile.nationality, "Brasileiro(a)");
  assert.equal(profile.maritalStatus, "Solteiro(a)");
  assert.equal(profile.email, "cliente@example.com");
  assert.equal(profile.phone, "11999999999");
  assert.equal(profile.postalCode, "01310100");
  assert.equal(
    profile.address,
    "Avenida Paulista, 1000 - Conjunto 10 - Bela Vista - São Paulo/SP - 01310-100",
  );

  const client = profileForClient(profile);
  assert.equal(client.document, "529.982.247-25");
  assert.equal(client.phone, "(11) 99999-9999");
  assert.equal(client.postalCode, "01310-100");
});

test("rejects invalid CPF, phone, postal code and UF before persistence", () => {
  assert.throws(
    () =>
      normalizeUserProfile({
        document: "111.111.111-11",
        phone: "123",
        postalCode: "123",
        uf: "XX",
      }),
    (error) => {
      assert.ok(error instanceof UserProfileValidationError);
      assert.deepEqual(Object.keys(error.errors).sort(), [
        "document",
        "phone",
        "postalCode",
        "uf",
      ]);
      return true;
    },
  );
});

test("encrypts profile data with tenant and user bound authenticated encryption", () => {
  const key = resolveProfileEncryptionKey("a-secure-profile-key-with-more-than-32-characters");
  const normalized = normalizeUserProfile(rawProfile);
  const encrypted = encryptUserProfile(normalized, key, "tenant-1:user-9");

  assert.doesNotMatch(encrypted, /52998224725|Avenida Paulista|Cliente Teste/);
  assert.deepEqual(
    decryptUserProfile(encrypted, key, "tenant-1:user-9"),
    normalized,
  );
  assert.throws(() => decryptUserProfile(encrypted, key, "tenant-2:user-9"));
});

test("formatters never add digits that were not supplied", () => {
  assert.equal(formatProfileCpf("52998224725"), "529.982.247-25");
  assert.equal(formatProfilePhone("1133334444"), "(11) 3333-4444");
});
