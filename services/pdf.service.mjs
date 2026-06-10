import { savePdf, savePdfBuffer } from "./storage.service.mjs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export async function saveAndExtractPdf({ consultaId, fonte, fileName, contentBase64 }) {
  const pdfPath = await savePdf({ consultaId, fonte, fileName, contentBase64 });
  const buffer = contentBase64 ? Buffer.from(contentBase64, "base64") : null;
  const rawText = buffer ? await extractPdfText(buffer) : "";
  return {
    pdfPath,
    rawText,
    todo: rawText ? "" : "Adicionar OCR quando o PDF vier como imagem ou quando o parser nao estiver disponivel.",
  };
}

export async function saveAndExtractPdfBuffer({ consultaId, fonte, fileName, buffer }) {
  const pdfPath = await savePdfBuffer({ consultaId, fonte, fileName, buffer });
  const rawText = await extractPdfText(buffer);
  return {
    pdfPath,
    rawText,
    todo: rawText ? "" : "Adicionar OCR quando o PDF vier como imagem ou quando o parser nao estiver disponivel.",
  };
}

export async function extractPdfText(buffer) {
  if (!buffer?.length) {
    return "";
  }

  try {
    const parser = require("pdf-parse/lib/pdf-parse.js");
    const parsed = await parser(buffer);
    return String(parsed.text || "").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}
