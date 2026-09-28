import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { createDirectDataCertificatesService, DIRECT_DATA_CERTIFICATE_ALL_UFS } from "../services/direct-data-certificates.service.mjs";
import { extractPdfText } from "../services/pdf.service.mjs";

// Real queries require an explicitly supplied private subject and budget. Never commit these files.
if (process.env.VALIDATION_ENV_FILE) process.loadEnvFile(process.env.VALIDATION_ENV_FILE);
const subjectPath = process.env.CERTIFICATE_SUBJECT_FILE;
const maxQueries = Number(process.env.CERTIFICATE_MAX_QUERIES);
if (!subjectPath || !Number.isInteger(maxQueries) || maxQueries < 1) {
  throw new Error("Set CERTIFICATE_SUBJECT_FILE and CERTIFICATE_MAX_QUERIES; each successful PDF query can incur provider fees.");
}
const subject = JSON.parse(readFileSync(subjectPath, "utf8"));
if (subject.authorizationConfirmed !== true || subject.paidQueryConfirmed !== true) throw new Error("Explicit subject and paid query authorization required");
const outputDir = resolve(process.env.CERTIFICATE_OUTPUT_DIR || "output/autonomous-certificates");
mkdirSync(outputDir, { recursive: true });
const ufs = (process.env.CERTIFICATE_UFS || DIRECT_DATA_CERTIFICATE_ALL_UFS.join(",")).split(",");
const types = (process.env.CERTIFICATE_TYPES || "Cível,Criminal").split(",");
const normalize = (value) => String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const service = createDirectDataCertificatesService({ env: { ...process.env, DIRECT_DATA_CERTIFICATE_ENABLED: "true" } });
let submitted = 0;
for (const uf of ufs) {
  for (const certificateType of types) {
    const key = `${uf.toLowerCase()}-${normalize(certificateType)}`;
    const resultPath = join(outputDir, `${key}.private.json`);
    let response;
    if (existsSync(resultPath)) response = JSON.parse(readFileSync(resultPath, "utf8"));
    else {
      if (submitted >= maxQueries) break;
      submitted++;
      response = await service.query({ ...subject, uf, certificateType, generatePdf: true });
      writeFileSync(resultPath, JSON.stringify(response, null, 2));
    }
    const result = response.result;
    const row = { uf, certificateType, checkedAt: new Date().toISOString(), success: Boolean(result), reason: response.reason || "", providerStatus: response.providerStatus, pdf: false, subjectMatches: false, sha256: "" };
    if (result?.certificate?.evidenceUrl) {
      try {
        const path = join(outputDir, `${key}.pdf`);
        let buffer;
        if (existsSync(path)) buffer = readFileSync(path);
        else {
          const download = await fetch(result.certificate.evidenceUrl, { signal: AbortSignal.timeout(45000) });
          if (!download.ok) throw new Error(`HTTP ${download.status}`);
          buffer = Buffer.from(await download.arrayBuffer());
        }
        row.pdf = buffer.subarray(0, 5).toString() === "%PDF-";
        if (row.pdf) {
          writeFileSync(path, buffer);
          const text = await extractPdfText(buffer);
          writeFileSync(join(outputDir, `${key}.private.txt`), text);
          row.subjectMatches = normalize(text).includes(normalize(subject.fullName)) && text.replace(/\D/g, "").includes(subject.document.replace(/\D/g, ""));
          row.sha256 = createHash("sha256").update(buffer).digest("hex");
          row.textLength = text.length;
          row.certificateStatus = result.certificate.status;
          row.hasValidationCode = Boolean(result.certificate.validationCode);
          row.hasCertificateNumber = Boolean(result.certificate.number);
        }
      } catch { row.reason = "evidence_download_or_read_failed"; }
    }
    writeFileSync(join(outputDir, `${key}.summary.json`), JSON.stringify(row, null, 2));
    console.log(JSON.stringify(row));
    if ([401, 403, 429].includes(response.providerStatus)) process.exit(2);
  }
}
