import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { extractPdfText } from "../services/pdf.service.mjs";

test("extracts only the PDF view when buffers share a larger allocation", async () => {
  for (const text of ["Certidao primeiro documento", "Certidao segundo documento"]) {
    const pdf = await PDFDocument.create();
    pdf.addPage().drawText(text);
    const bytes = await pdf.save();
    const allocation = Buffer.alloc(bytes.length + 512, 0x78);
    Buffer.from(bytes).copy(allocation, 256);
    const view = allocation.subarray(256, 256 + bytes.length);
    assert.equal(await extractPdfText(view), text);
  }
});
