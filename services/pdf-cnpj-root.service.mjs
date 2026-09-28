import { createRequire } from "node:module";

const parsePdf = createRequire(import.meta.url)("pdf-parse/lib/pdf-parse.js");
const normalize = (value) => String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ").trim().toUpperCase();
const labels = { sp_municipal: /^CPF\/CNPJ RAIZ:\s*(.*)$/, rj_fiscal: /^CPF\/RAIZ DO CNPJ:\s*(.*)$/, rs_fiscal: /^CNPJ:\s*(.*)$/ };
const rootValue = (value) => /^(?:\d{2}\.\d{3}\.\d{3}|\d{8})\/?$/.test(value.trim()) ? value.replace(/\D/g, "") : "";

// Identity evidence for these three reviewed templates only; the caller must validate document scope separately.
export async function pdfHasCnpjRoot(buffer, cnpj, { template } = {}) {
  const document = String(cnpj || "").replace(/\D/g, "");
  if (!labels[template] || !/^\d{14}$/.test(document) || /^(\d)\1+$/.test(document) || !Buffer.isBuffer(buffer) || buffer.length > 20 * 1024 * 1024 || buffer.subarray(0, 5).toString() !== "%PDF-") return false;
  try {
    const pages = [];
    const parsed = await parsePdf(new Uint8Array(buffer), { max: 5, pagerender: async (page) => {
      const { items } = await page.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
      pages.push(items.filter((item) => item.str?.trim() && Math.abs(item.transform[1]) < 0.01 && Math.abs(item.transform[2]) < 0.01 && item.transform[0] > 0 && item.transform[3] > 0).map((item) => ({ text: normalize(item.str), x: item.transform[4], y: item.transform[5], width: item.width })));
      return "";
    } });
    if (parsed.numpages > 5) return false;
    const fields = pages.flatMap((items) => items.filter((item) => labels[template].test(item.text)).map((label) => ({ items, label })));
    if (fields.length !== 1) return false;
    const { items, label } = fields[0];
    if (template === "rs_fiscal") {
      const text = items.map((item) => item.text).join(" ");
      if (!text.includes("CNPJ BASE COMPOSTO PELOS 8 PRIMEIROS DIGITOS") || !text.includes("TODOS OS ESTABELECIMENTOS DA EMPRESA FORAM AVALIADOS")) return false;
    }
    const inline = label.text.match(labels[template])[1];
    if (inline) return rootValue(inline) === document.slice(0, 8);
    const right = label.x + label.width;
    const adjacent = items.filter((item) => item !== label && Math.abs(item.y - label.y) <= 2 && item.x >= right - 1 && item.x - right <= 60).sort((a, b) => a.x - b.x);
    const roots = adjacent.filter((item) => rootValue(item.text));
    return roots.length === 1 && adjacent[0] === roots[0] && rootValue(roots[0].text) === document.slice(0, 8);
  } catch {
    return false;
  }
}
