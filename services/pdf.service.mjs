import { savePdf, savePdfBuffer } from "./storage.service.mjs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const PDF_PARSE_NOISE_PATTERNS = [/Ignoring invalid character/i, /Indexing all PDF objects/i];

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
    const parsed = await withPdfParseWarningFilter(() => parser(buffer));
    return String(parsed.text || "").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

async function withPdfParseWarningFilter(runParser) {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  const shouldSuppress = (message) => PDF_PARSE_NOISE_PATTERNS.some((pattern) => pattern.test(message));
  const stringifyArgs = (args) => args.map((arg) => String(arg)).join(" ");

  console.log = (...args) => {
    const message = stringifyArgs(args);
    if (shouldSuppress(message)) {
      return;
    }
    originalLog(...args);
  };

  console.warn = (...args) => {
    const message = stringifyArgs(args);
    if (shouldSuppress(message)) {
      return;
    }
    originalWarn(...args);
  };

  process.stderr.write = (chunk, ...args) => {
    const message = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    if (shouldSuppress(message)) {
      return true;
    }
    return originalStderrWrite(chunk, ...args);
  };

  try {
    return await runParser();
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    process.stderr.write = originalStderrWrite;
  }
}
