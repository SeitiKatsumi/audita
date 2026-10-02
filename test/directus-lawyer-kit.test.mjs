import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createDirectusLawyerKitService,
  createLocalJurisprudenceService,
  createSubscriberJurisprudenceService,
  DirectusLawyerKitError,
} from "../services/directus-lawyer-kit.service.mjs";

const ENV = {
  DIRECTUS_URL: "https://directus.example",
  DIRECTUS_TOKEN: "service-token",
  DIRECTUS_LAWYER_KIT_FOLDER_ID: "folder-1",
};

test('subscriber jurisprudence checks access on every list/download and never exposes Directus IDs', async () => {
  const auth = { tenantId: '1', user: { id: '1' } };
  let allowed = true, reads = 0, downloads = 0;
  const read = createSubscriberJurisprudenceService({
    accessService: { async getAccess(owner, options) {
      assert.deepEqual(options, { includeTestAccess: false });
      return { allowed: allowed && owner.tenantId === '1' && owner.user.id === '1' };
    } },
    documents: {
      async listJurisprudence(uf) {
        reads++;
        assert.equal(uf, 'SP');
        return { files: [{ id: 'private-id', order: 1, title: 'Decisão fictícia', fileName: 'jurisprudencia-sp-01.pdf' }] };
      },
      async download(id) { downloads++; assert.equal(id, 'private-id'); return Buffer.from('%PDF-fixture'); },
    },
  });
  for (const input of [{}, { uf: 'SP' }, { uf: 'SP', order: '1' }]) {
    await assert.rejects(read({}, input), { statusCode: 401 });
    await assert.rejects(read({ tenantId: '2', user: { id: '1' } }, input), { statusCode: 403 });
    await assert.rejects(read({ tenantId: '1', user: { id: '2' } }, input), { statusCode: 403 });
  }
  assert.equal(reads, 0);
  assert.equal((await read(auth)).states.length, 27);
  const result = await read(auth, { uf: 'sp' });
  assert.deepEqual(result.files, [{ title: 'Decisão fictícia', fileName: 'jurisprudencia-sp-01.pdf', format: 'PDF', downloadUrl: '/api/jurisprudence?uf=SP&order=1' }]);
  assert.equal((await read(auth, { uf: 'SP', order: '1' })).bytes.toString(), '%PDF-fixture');
  for (const input of [{ uf: 'XX' }, { order: '1' }, { uf: 'SP', order: '../private-id' }, { uf: 'SP', order: '3' }]) {
    await assert.rejects(read(auth, input), { statusCode: 400 });
  }
  allowed = false; // Expired/revoked subscription after listing.
  await assert.rejects(read(auth, { uf: 'SP', order: '1' }), { statusCode: 403 });
  assert.equal(reads, 2);
  assert.equal(downloads, 1);
});

test('private local corpus preserves bytes, formats, availability and subscriber protection', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'audita-jurisprudence-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const documents = createLocalJurisprudenceService(directory);
  await assert.rejects(documents.listStates(), { statusCode: 503 });
  const word = Buffer.from([0x50, 0x4b, 3, 4, 10]);
  const excel = Buffer.from([0x50, 0x4b, 3, 4, 20]);
  await writeFile(join(directory, 'jurisprudencia-ac.docx'), word);
  await writeFile(join(directory, 'jurisprudencia-base-geral.xlsx'), excel);
  assert.deepEqual(await documents.listStates(), ['AC']);
  let allowed = true;
  const read = createSubscriberJurisprudenceService({ documents, accessService: { getAccess: async () => ({ allowed }) } });
  const auth = { tenantId: 'fixture', user: { id: 'subscriber' } };
  const list = await read(auth, { uf: 'AC' });
  assert.deepEqual(list.files.map(file => file.format), ['Word (DOCX)', 'Excel (XLSX)']);
  const report = await read(auth, { uf: 'AC', order: '1' });
  assert.deepEqual(report.bytes, word);
  assert.match(report.contentType, /wordprocessingml/);
  const base = await read(auth, { uf: 'AC', order: '2' });
  assert.deepEqual(base.bytes, excel);
  assert.match(base.contentType, /spreadsheetml/);
  const content = { version: 1, uf: 'AC', records: [{ row: 2, process: 'FICTICIO', decision: '<script>untrusted</script>' }], report: [{ type: 'paragraph', text: 'Texto original fictício.' }] };
  await assert.rejects(read(auth, { uf: 'AC', view: 'read' }), { statusCode: 503 });
  await writeFile(join(directory, 'jurisprudencia-ac.json'), JSON.stringify(content));
  assert.deepEqual(await read(auth, { uf: 'AC', view: 'read' }), content);
  for (const query of [{ view: 'read' }, { uf: 'AC', view: 'raw' }, { uf: 'AC', view: 'read', order: '1' }, { uf: '../AC', view: 'read' }]) {
    await assert.rejects(read(auth, query), { statusCode: 400 });
  }
  await assert.rejects(read({}, { uf: 'AC', view: 'read' }), { statusCode: 401 });
  await writeFile(join(directory, 'jurisprudencia-ac.json'), JSON.stringify({ ...content, uf: 'SP' }));
  await assert.rejects(read(auth, { uf: 'AC', view: 'read' }), { statusCode: 503 });
  await assert.rejects(documents.download('../private.key'), { statusCode: 400 });
  await assert.rejects(read(auth, { uf: 'SP' }), { statusCode: 503 });
  await assert.rejects(read({}, { uf: 'AC', order: '1' }), { statusCode: 401 });
  allowed = false;
  await assert.rejects(read(auth, { uf: 'AC', order: '2' }), { statusCode: 403 });
  await assert.rejects(read(auth, { uf: 'AC', view: 'read' }), { statusCode: 403 });
  await writeFile(join(directory, 'jurisprudencia-ac.docx'), 'invalid');
  await assert.rejects(documents.download('jurisprudencia-ac.docx'), { statusCode: 503 });
});

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
