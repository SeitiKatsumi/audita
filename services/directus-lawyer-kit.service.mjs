import { readFile, realpath, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const UFS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

export function normalizeLawyerKitUf(value) {
  const uf = String(value || "").trim().toUpperCase();
  return UFS.has(uf) ? uf : "";
}

export class DirectusLawyerKitError extends Error {
  constructor(code, statusCode = 503) {
    super(code);
    this.name = "DirectusLawyerKitError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

// Subscriber access is independent of the separately purchased lawyer kit.
export function createSubscriberJurisprudenceService({ accessService, documents }) {
  return async function read(auth, { uf = '', order = '', view = '' } = {}) {
    if (auth?.unauthorized || !auth?.user?.id || !auth?.tenantId) {
      throw new DirectusLawyerKitError('authentication_required', 401);
    }
    const access = await accessService.getAccess(auth, { includeTestAccess: false });
    if (!access.allowed) throw new DirectusLawyerKitError('subscription_required', 403);
    if (!['', 'read'].includes(view) || (view && (!uf || order))) {
      throw new DirectusLawyerKitError('invalid_jurisprudence_selection', 400);
    }
    if (!uf && !order) return { states: documents.listStates ? await documents.listStates() : [...UFS] };
    const state = normalizeLawyerKitUf(uf);
    if (!state || !['', '1', '2'].includes(order)) {
      throw new DirectusLawyerKitError('invalid_jurisprudence_selection', 400);
    }
    if (view === 'read') {
      if (!documents.readContent) throw new DirectusLawyerKitError('jurisprudence_reader_unavailable');
      return documents.readContent(state);
    }
    const result = await documents.listJurisprudence(state);
    if (order) {
      const file = result.files.find(file => String(file.order) === order);
      if (!file) throw new DirectusLawyerKitError('jurisprudence_not_found', 404);
      return { fileName: file.fileName, contentType: file.contentType || 'application/pdf', bytes: await documents.download(file.id) };
    }
    return { uf: state, files: result.files.map(file => ({ title: file.title, fileName: file.fileName,
      format: file.format || 'PDF',
      downloadUrl: `/api/jurisprudence?uf=${state}&order=${file.order}` })) };
  };
}

// Original reports stay outside the public static surface; access is checked by read().
export function createLocalJurisprudenceService(directory) {
  const root = resolve(directory);
  async function pathFor(fileName) {
    if (!/^jurisprudencia-(?:[a-z]{2}\.(?:docx|json)|base-geral\.xlsx)$/.test(fileName)) {
      throw new DirectusLawyerKitError('invalid_jurisprudence_file', 400);
    }
    const path = join(root, fileName);
    try {
      if (await realpath(path) !== join(await realpath(root), fileName)) throw new Error('symlink');
      const info = await stat(path);
      if (!info.isFile() || info.size > 10_000_000) throw new Error('invalid file');
      return path;
    } catch { throw new DirectusLawyerKitError('jurisprudence_file_unavailable'); }
  }
  async function listStates() {
    const states = [];
    for (const uf of UFS) {
      try { await pathFor(`jurisprudencia-${uf.toLowerCase()}.docx`); states.push(uf); }
      catch { /* Missing states are not advertised. */ }
    }
    if (!states.length) throw new DirectusLawyerKitError('jurisprudence_unavailable');
    return states;
  }
  async function listJurisprudence(value) {
    const uf = normalizeLawyerKitUf(value);
    if (!uf) throw new DirectusLawyerKitError('invalid_lawyer_kit_uf', 400);
    const files = [
      { order: 1, fileName: `jurisprudencia-${uf.toLowerCase()}.docx`, title: `Relatório ${uf}`, format: 'Word (DOCX)', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { order: 2, fileName: 'jurisprudencia-base-geral.xlsx', title: 'Base geral — todos os estados', format: 'Excel (XLSX)', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    ];
    for (const file of files) await pathFor(file.fileName);
    return { uf, files: files.map(file => ({ ...file, id: file.fileName })) };
  }
  async function download(fileName) {
    const bytes = await readFile(await pathFor(fileName));
    if (!bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 3, 4]))) {
      throw new DirectusLawyerKitError('jurisprudence_invalid_document');
    }
    return bytes;
  }
  async function readContent(value) {
    const uf = normalizeLawyerKitUf(value);
    if (!uf) throw new DirectusLawyerKitError('invalid_lawyer_kit_uf', 400);
    try {
      const data = JSON.parse(await readFile(await pathFor(`jurisprudencia-${uf.toLowerCase()}.json`), 'utf8'));
      if (data.version !== 1 || data.uf !== uf || !Array.isArray(data.records) || !Array.isArray(data.report)) throw new Error('invalid index');
      return data;
    } catch { throw new DirectusLawyerKitError('jurisprudence_reader_unavailable'); }
  }
  return { listStates, listJurisprudence, download, readContent };
}

export function createDirectusLawyerKitService({
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const baseUrl = String(env.DIRECTUS_URL || "").trim().replace(/\/$/, "");
  const token = String(env.DIRECTUS_TOKEN || "").trim();
  const folderId = String(env.DIRECTUS_LAWYER_KIT_FOLDER_ID || "").trim();

  function headers() {
    return { authorization: `Bearer ${token}`, accept: "application/json" };
  }

  function requireConfiguration() {
    if (!baseUrl || !token || !folderId) {
      throw new DirectusLawyerKitError("directus_lawyer_kit_not_configured");
    }
  }

  async function listJurisprudence(ufValue) {
    const uf = normalizeLawyerKitUf(ufValue);
    if (!uf) throw new DirectusLawyerKitError("invalid_lawyer_kit_uf", 400);
    requireConfiguration();

    const url = new URL(`${baseUrl}/files`);
    url.searchParams.set("fields", "id,title,filename_download,type,filesize,folder");
    url.searchParams.set("filter[folder][_eq]", folderId);
    url.searchParams.set("filter[filename_download][_starts_with]", `jurisprudencia-${uf.toLowerCase()}-`);
    url.searchParams.set("sort", "filename_download");
    url.searchParams.set("limit", "3");
    const response = await fetchImpl(url, { headers: headers() });
    if (!response.ok) throw new DirectusLawyerKitError("directus_lawyer_kit_unavailable");

    const payload = await response.json().catch(() => ({}));
    const byName = new Map(
      (Array.isArray(payload.data) ? payload.data : []).map((file) => [file.filename_download, file]),
    );
    const files = [1, 2].map((order) => {
      const fileName = `jurisprudencia-${uf.toLowerCase()}-${String(order).padStart(2, "0")}.pdf`;
      const file = byName.get(fileName);
      if (!file?.id || file.type !== "application/pdf") {
        throw new DirectusLawyerKitError("directus_lawyer_kit_incomplete");
      }
      return {
        id: String(file.id),
        order,
        title: String(file.title || `Jurisprudência ${uf} ${String(order).padStart(2, "0")}`),
        fileName,
      };
    });
    return { uf, files };
  }

  async function download(fileId) {
    requireConfiguration();
    const response = await fetchImpl(`${baseUrl}/assets/${encodeURIComponent(fileId)}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/pdf" },
    });
    if (!response.ok) throw new DirectusLawyerKitError("directus_lawyer_kit_file_unavailable");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new DirectusLawyerKitError("directus_lawyer_kit_invalid_pdf");
    }
    return bytes;
  }

  return { listJurisprudence, download };
}
