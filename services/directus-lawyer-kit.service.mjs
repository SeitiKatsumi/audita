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
