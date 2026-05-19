import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const storageRoot = resolve("storage");
const pdfRoot = join(storageRoot, "pdfs");

export async function savePdf({ consultaId, fonte, fileName, contentBase64 }) {
  if (!contentBase64) {
    return "";
  }

  await mkdir(pdfRoot, { recursive: true });
  const safeFileName = String(fileName || `${fonte}.pdf`).replace(/[^a-zA-Z0-9_.-]/g, "_");
  const path = join(pdfRoot, `${consultaId}-${fonte}-${safeFileName}`);
  await writeFile(path, Buffer.from(contentBase64, "base64"));
  return path;
}

export async function savePdfBuffer({ consultaId, fonte, fileName, buffer }) {
  if (!buffer?.length) {
    return "";
  }

  await mkdir(pdfRoot, { recursive: true });
  const safeFileName = String(fileName || `${fonte}.pdf`).replace(/[^a-zA-Z0-9_.-]/g, "_");
  const path = join(pdfRoot, `${consultaId}-${fonte}-${safeFileName}`);
  await writeFile(path, buffer);
  return path;
}

export function getPdfRoot() {
  return pdfRoot;
}
