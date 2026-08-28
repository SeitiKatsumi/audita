import assert from "node:assert/strict";
import test from "node:test";

import {
  createDirectusLawyerKitService,
  DirectusLawyerKitError,
} from "../services/directus-lawyer-kit.service.mjs";

const ENV = {
  DIRECTUS_URL: "https://directus.example",
  DIRECTUS_TOKEN: "service-token",
  DIRECTUS_LAWYER_KIT_FOLDER_ID: "folder-1",
};

test("Directus lawyer kit returns and downloads exactly two PDFs for the selected state", async () => {
  const calls = [];
  const service = createDirectusLawyerKitService({
    env: ENV,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      if (String(url).includes("/files?")) {
        return Response.json({
          data: [1, 2].map((order) => ({
            id: `file-${order}`,
            title: `Jurisprudência SP 0${order}`,
            filename_download: `jurisprudencia-sp-0${order}.pdf`,
            type: "application/pdf",
            folder: "folder-1",
          })),
        });
      }
      return new Response(Buffer.from("%PDF-1.7\nexample"), {
        headers: { "content-type": "application/pdf" },
      });
    },
  });

  const result = await service.listJurisprudence("sp");
  const bytes = await service.download(result.files[0].id);

  assert.equal(result.uf, "SP");
  assert.deepEqual(result.files.map((file) => file.fileName), [
    "jurisprudencia-sp-01.pdf",
    "jurisprudencia-sp-02.pdf",
  ]);
  assert.match(calls[0].url, /filter%5Bfolder%5D%5B_eq%5D=folder-1/);
  assert.match(calls[0].url, /jurisprudencia-sp-/);
  assert.equal(calls[0].options.headers.authorization, "Bearer service-token");
  assert.equal(bytes.subarray(0, 5).toString("ascii"), "%PDF-");
});

test("Directus lawyer kit rejects invalid states and incomplete folders", async () => {
  const service = createDirectusLawyerKitService({
    env: ENV,
    fetchImpl: async () => Response.json({ data: [] }),
  });

  await assert.rejects(
    service.listJurisprudence("XX"),
    (error) => error instanceof DirectusLawyerKitError && error.code === "invalid_lawyer_kit_uf",
  );
  await assert.rejects(
    service.listJurisprudence("RJ"),
    (error) => error instanceof DirectusLawyerKitError && error.code === "directus_lawyer_kit_incomplete",
  );
});
