import { existsSync } from "node:fs";
import { join } from "node:path";

import { PDFDocument } from "pdf-lib";
import { chromium } from "playwright";

export function resolveJecPdfBrowserExecutable({
  env = process.env,
  fileExists = existsSync,
  bundledExecutable = "",
} = {}) {
  let playwrightExecutable = bundledExecutable;
  if (!playwrightExecutable) {
    try {
      playwrightExecutable = chromium.executablePath();
    } catch {
      playwrightExecutable = "";
    }
  }
  const candidates = [
    env.JEC_PDF_BROWSER_EXECUTABLE_PATH,
    playwrightExecutable,
    env.LOCALAPPDATA && join(env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
    env.ProgramFiles && join(env.ProgramFiles, "Google", "Chrome", "Application", "chrome.exe"),
    env["ProgramFiles(x86)"] && join(env["ProgramFiles(x86)"], "Google", "Chrome", "Application", "chrome.exe"),
    env.ProgramFiles && join(env.ProgramFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    env["ProgramFiles(x86)"] && join(env["ProgramFiles(x86)"], "Microsoft", "Edge", "Application", "msedge.exe"),
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ].filter(Boolean);
  return candidates.find((candidate) => fileExists(candidate)) || "";
}

function launchJecPdfBrowser(options = {}) {
  const executablePath = resolveJecPdfBrowserExecutable();
  return chromium.launch({
    ...options,
    ...(executablePath ? { executablePath } : {}),
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export const POWER_OF_ATTORNEY_ACCEPTANCE_TEXT =
  "Declaro que li e aceito integralmente a Procuração Ad Judicia et Extra e o Contrato de Prestação de Serviços Jurídicos e Honorários Advocatícios, e que a digitação do meu nome completo representa minha assinatura eletrônica e manifestação de vontade.";
export const POWER_OF_ATTORNEY_ACCEPTANCE_VERSION = "2026-08-28-contract-1";

function normalizedSignerName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
}

export function validatePowerOfAttorneyAcceptance({
  claimant = {},
  powerOfAttorneyAcceptance = {},
} = {}) {
  const signerName = String(powerOfAttorneyAcceptance.signerName || "")
    .trim()
    .replace(/\s+/g, " ");
  const claimantName = String(claimant.fullName || "").trim().replace(/\s+/g, " ");
  if (powerOfAttorneyAcceptance.accepted !== true || !signerName) {
    const error = new Error("Aceite a procuração e o contrato e digite seu nome completo para continuar.");
    error.code = "JEC_POWER_OF_ATTORNEY_ACCEPTANCE_REQUIRED";
    throw error;
  }
  if (!claimantName || normalizedSignerName(signerName) !== normalizedSignerName(claimantName)) {
    const error = new Error("O nome digitado na assinatura deve ser igual ao nome completo informado acima.");
    error.code = "JEC_POWER_OF_ATTORNEY_NAME_MISMATCH";
    throw error;
  }
  return {
    accepted: true,
    signerName,
    statement: POWER_OF_ATTORNEY_ACCEPTANCE_TEXT,
    version: POWER_OF_ATTORNEY_ACCEPTANCE_VERSION,
  };
}

function formatPowerOfAttorneyCpf(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
  return digits.length === 11
    ? digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    : digits || "Não informado";
}

function powerOfAttorneyAddress(claimant = {}) {
  return [
    claimant.street,
    claimant.addressNumber,
    claimant.addressComplement,
  ].filter(Boolean).join(", ") || claimant.address || "Não informado";
}

function formatPowerOfAttorneyDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Data não informada"
    : new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "long",
        timeStyle: "long",
        timeZone: "America/Sao_Paulo",
      }).format(date);
}

function formatPowerOfAttorneyStampDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Data não informada"
    : new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(date);
}

export function buildPowerOfAttorneyHtml({ claimant = {}, acceptance = {} } = {}) {
  const signedAt = formatPowerOfAttorneyDate(acceptance.acceptedAt);
  const stampDate = formatPowerOfAttorneyStampDate(acceptance.acceptedAt);
  const signerName = acceptance.signerName || claimant.fullName || "Não informado";
  const cpf = formatPowerOfAttorneyCpf(claimant.document);
  const cityUf = [claimant.city, claimant.uf].filter(Boolean).join(" - ") || "Local não informado";
  const shortAcceptanceId = String(acceptance.id || "Não informado").slice(0, 8);
  const field = (label, value, wide = false) => `
    <div class="field${wide ? " wide" : ""}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "Não informado")}</strong>
    </div>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 14mm 16mm 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #101820; font: 9.5pt/1.28 Arial, Helvetica, sans-serif; }
    h1 { margin: 0 0 13px; font-size: 14pt; letter-spacing: .02em; }
    h2 { margin: 12px 0 6px; font-size: 10.5pt; letter-spacing: .02em; }
    p { margin: 5px 0; text-align: justify; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 14px; }
    .field { min-width: 0; }
    .field.wide { grid-column: 1 / -1; }
    .field span { display: block; margin-bottom: 1px; font-size: 7.8pt; font-weight: 700; color: #405263; }
    .field strong { display: block; min-height: 16px; padding: 1px 0 3px; border-bottom: 1px solid #71808c; overflow-wrap: anywhere; }
    .blank { color: #71808c; font-style: italic; }
    .signature { width: 58%; margin: 9px 0 0 auto; padding: 5px 8px; border: 1px solid #1d8393; border-radius: 3px; break-inside: avoid; }
    .signature small { display: block; margin-bottom: 1px; color: #405263; font-size: 6.7pt; }
    .signature strong { display: block; font-size: 9.2pt; }
    .signature p { margin: 1px 0 0; color: #405263; font-size: 6.5pt; text-align: left; }
  </style>
</head>
<body>
  <main>
    <h1>PROCURAÇÃO <em>AD JUDICIA ET EXTRA</em></h1>
    <h2>OUTORGANTE (CLIENTE)</h2>
    <div class="grid">
      ${field("Nome completo", claimant.fullName, true)}
      ${field("Nacionalidade", claimant.nationality)}
      ${field("Estado civil", claimant.maritalStatus)}
      ${field("Profissão", claimant.profession, true)}
      ${field("RG", claimant.rg)}
      ${field("CPF", cpf)}
      ${field("Endereço residencial", powerOfAttorneyAddress(claimant), true)}
      ${field("Bairro", claimant.district)}
      ${field("CEP", claimant.postalCode)}
      ${field("Cidade", claimant.city)}
      ${field("Estado", claimant.uf)}
      ${field("E-mail", claimant.email)}
      ${field("Telefone/WhatsApp", claimant.phone)}
    </div>

    <h2>OUTORGADO (ADVOGADO)</h2>
    <p class="blank">Dados do advogado responsável pendentes de vinculação antes do protocolo.</p>

    <h2>PODERES DE REPRESENTAÇÃO</h2>
    <p>Pelo presente instrumento privado de procuração, o(a) OUTORGANTE nomeia e constitui o(a) OUTORGADO(A) como seu(sua) bastante procurador(a), concedendo-lhe os poderes gerais da cláusula <em>Ad Judicia</em> para representá-lo(a) perante o Juizado Especial Cível (Pequenas Causas), bem como em grau recursal perante a Turma Recursal (Câmara Recursal), podendo propor ações, acompanhar processos em qualquer instância ou tribunal, apresentar defesas, interpor e arrazoar recursos, realizar sustentação oral e praticar todos os atos necessários ao bom e fiel cumprimento deste mandato.</p>

    <h2>PODERES ESPECIAIS</h2>
    <p>Concedem-se, ainda, os poderes especiais para confessar, reconhecer a procedência do pedido, transigir, firmar acordos, desistir, renunciar ao direito sobre o qual se funda a ação, receber citações, intimações e notificações, dar e receber quitação, substabelecer (com ou sem reservas de iguais poderes), bem como praticar demais atos inerentes à defesa dos interesses do(a) OUTORGANTE.</p>

    <p>${escapeHtml(cityUf)}, ${escapeHtml(signedAt)}.</p>
    <section class="signature" aria-label="Assinatura eletrônica do outorgante">
      <small>Assinado eletronicamente por</small>
      <strong>${escapeHtml(signerName)}</strong>
      <p>${escapeHtml(stampDate)} · ID ${escapeHtml(shortAcceptanceId)}</p>
    </section>
  </main>
</body>
</html>`;
}

export function buildLegalServicesAgreementHtml({
  claimant = {},
  acceptance = {},
  legalProvider = {},
} = {}) {
  const isAccepted = acceptance.accepted === true;
  const signedAt = formatPowerOfAttorneyDate(acceptance.acceptedAt);
  const stampDate = formatPowerOfAttorneyStampDate(acceptance.acceptedAt);
  const signerName = acceptance.signerName || claimant.fullName || "Não informado";
  const cpf = formatPowerOfAttorneyCpf(claimant.document);
  const cityUf = [claimant.city, claimant.uf].filter(Boolean).join(" - ") || "Local não informado";
  const shortAcceptanceId = String(acceptance.id || "Não informado").slice(0, 8);
  const providerName = legalProvider.fullName || "Advogado responsável pendente de vinculação";
  const providerOab = [legalProvider.oabNumber, legalProvider.oabUf]
    .filter(Boolean)
    .join(" / ") || "Pendente de vinculação";
  const field = (label, value, wide = false) => `
    <div class="field${wide ? " wide" : ""}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "Será preenchido no aceite")}</strong>
    </div>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 13mm 15mm 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #101820; font: 8.7pt/1.3 Arial, Helvetica, sans-serif; }
    h1 { margin: 0 0 10px; font-size: 13pt; line-height: 1.2; text-align: center; }
    h2 { margin: 10px 0 4px; font-size: 9.4pt; line-height: 1.2; break-after: avoid; }
    p { margin: 4px 0; text-align: justify; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 13px; }
    .field { min-width: 0; }
    .field.wide { grid-column: 1 / -1; }
    .field span { display: block; margin-bottom: 1px; font-size: 7.2pt; font-weight: 700; color: #405263; }
    .field strong { display: block; min-height: 14px; padding: 1px 0 2px; border-bottom: 1px solid #71808c; overflow-wrap: anywhere; }
    .clause { break-inside: avoid; }
    .signatures { display: grid; grid-template-columns: 1.25fr 1fr; gap: 12px; margin-top: 9px; align-items: start; break-inside: avoid; }
    .signature, .pending-signature { min-height: 43px; padding: 5px 8px; border: 1px solid #1d8393; border-radius: 3px; }
    .signature small, .pending-signature small { display: block; margin-bottom: 1px; color: #405263; font-size: 6.7pt; }
    .signature strong, .pending-signature strong { display: block; font-size: 8.8pt; }
    .signature p, .pending-signature p { margin: 1px 0 0; color: #405263; font-size: 6.5pt; text-align: left; }
    .pending-signature { border-color: #aab4bc; color: #52616d; }
  </style>
</head>
<body>
  <main>
    <h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS JURÍDICOS E HONORÁRIOS ADVOCATÍCIOS</h1>

    <h2>CONTRATANTE (CLIENTE)</h2>
    <div class="grid">
      ${field("Nome completo", claimant.fullName, true)}
      ${field("Nacionalidade", claimant.nationality)}
      ${field("Estado civil", claimant.maritalStatus)}
      ${field("Profissão", claimant.profession, true)}
      ${field("RG", claimant.rg)}
      ${field("CPF", cpf)}
      ${field("Endereço residencial", powerOfAttorneyAddress(claimant), true)}
      ${field("Bairro", claimant.district)}
      ${field("CEP", claimant.postalCode)}
      ${field("Cidade", claimant.city)}
      ${field("Estado", claimant.uf)}
    </div>

    <h2>CONTRATADO (ADVOGADO)</h2>
    <div class="grid">
      ${field("Nome completo", providerName, true)}
      ${field("Nacionalidade", legalProvider.nationality || "Pendente de vinculação")}
      ${field("Estado civil", legalProvider.maritalStatus || "Pendente de vinculação")}
      ${field("Inscrição na OAB", providerOab, true)}
      ${field("Endereço profissional", legalProvider.address || "Pendente de vinculação", true)}
      ${field("Bairro", legalProvider.district || "Pendente de vinculação")}
      ${field("CEP", legalProvider.postalCode || "Pendente de vinculação")}
      ${field("Cidade", legalProvider.city || "Pendente de vinculação")}
      ${field("Estado", legalProvider.uf || "Pendente de vinculação")}
    </div>

    <section class="clause">
      <h2>CLÁUSULA PRIMEIRA - DO OBJETO</h2>
      <p>O presente contrato tem por objeto a prestação de serviços advocatícios para o ajuizamento e acompanhamento de ação judicial em face do BANCO ITAÚ UNIBANCO S.A., perante o Juizado Especial Cível (1ª Instância) e eventual acompanhamento em grau recursal perante a Turma Recursal / Câmara Recursal (2ª Instância), caso o Itaú recorra da decisão proferida em primeiro grau.</p>
    </section>

    <section class="clause">
      <h2>CLÁUSULA SEGUNDA - ISENÇÃO DE CUSTAS E DESPESAS JUDICIAIS</h2>
      <p>Por se tratar de demanda ajuizada no Juizado Especial Cível (Pequenas Causas) em valor inferior a 20 (vinte) salários mínimos, o(a) CONTRATANTE fica totalmente isento(a) do pagamento de taxas judiciárias, custas operacionais e despesas processuais em 1ª Instância, conforme expressamente prevê o art. 54 da Lei nº 9.099/95.</p>
    </section>

    <section class="clause">
      <h2>CLÁUSULA TERCEIRA - DOS HONORÁRIOS ADVOCATÍCIOS CONTRATUAIS (ÊXITO)</h2>
      <p>As partes pactuam a remuneração dos serviços advocatícios nas seguintes condições:</p>
      <p><strong>Procedência em 1ª Instância (Sem Recurso do Banco):</strong> Caso a ação seja julgada procedente em 1ª Instância e a instituição financeira não interponha recurso, o(a) CONTRATANTE ficará ISENTO(A) do pagamento de qualquer percentual a título de honorários de êxito, recebendo a integralidade do valor apurado na condenação.</p>
      <p><strong>Vitória em 2ª Instância (Fase Recursal):</strong> Caso o réu (Itaú) recorra da decisão e o CONTRATADO elabore a defesa em grau recursal (Contrarrazões ao Recurso Inominado) obtendo a manutenção da vitória ou êxito perante a Turma Recursal / Câmara Recursal, o(a) CONTRATANTE pagará ao CONTRATADO o percentual de 10% (dez por cento) sobre o valor líquido final obtido na condenação ou no acordo.</p>
    </section>

    <section class="clause">
      <h2>CLÁUSULA QUARTA - DOS HONORÁRIOS DE SUCUMBÊNCIA</h2>
      <p>Fica expressamente acordado que quaisquer honorários de sucumbência que venham a ser arbitrados pela Turma Recursal / Câmara Recursal em caso de improvimento do recurso interposto pelo banco pertencem exclusivamente ao CONTRATADO (ADVOGADO), nos termos do art. 23 da Lei nº 8.906/94 (Estatuto da OAB), não se confundindo nem se abatendo do percentual de êxito estabelecido na Cláusula Terceira.</p>
    </section>

    <section class="clause">
      <h2>CLÁUSULA QUINTA - DA NÃO INTERPOSIÇÃO DE RECURSO EM CASO DE IMPROCEDÊNCIA EM 1ª INSTÂNCIA</h2>
      <p>Caso os pedidos do(a) CONTRATANTE sejam julgados improcedentes na 1ª Instância, o CONTRATADO NÃO interporá recurso perante a Turma Recursal / Câmara Recursal.</p>
      <p><strong>Parágrafo único:</strong> A decisão de não recorrer justifica-se pelo fato de que a interposição de recurso pelo autor geraria a obrigação de recolhimento prévio do preparo (custas recursais) e o risco de condenação ao pagamento de honorários de sucumbência ao Banco Itaú em caso de novo julgamento desfavorável, o que feriria a premissa de isenção de custos para o cliente.</p>
    </section>

    <section class="clause">
      <h2>CLÁUSULA SEXTA - DA PROVA DOCUMENTAL E MOTIVAÇÃO DA IMPROCEDÊNCIA</h2>
      <p>Fica esclarecido ao(à) CONTRATANTE que a probabilidade de improcedência da demanda reside na hipótese de a instituição financeira (Itaú) apresentar em juízo prova documental idônea da efetiva autorização, contratação do seguro ou do débito objeto da demanda, sem prejuízo de outras excludentes legais ou entendimentos diversos adotados pelo juízo competente.</p>
    </section>

    <section class="clause">
      <h2>CLÁUSULA SÉTIMA - DO RISCO ZERO AO CONTRATANTE</h2>
      <p>Diante das condições ajustadas nas Cláusulas Segunda e Quinta, o risco financeiro direto para o(a) CONTRATANTE é ZERO, assegurando-se que este(a) não desembolsará nenhum valor a título de custas, honorários operacionais ou condenações sucumbenciais em nenhuma hipótese do processo.</p>
    </section>

    <p>E, por estarem assim justos e contratados, firmam o presente instrumento em meio eletrônico.</p>
    <p>${isAccepted
      ? `${escapeHtml(cityUf)}, ${escapeHtml(signedAt)}.`
      : "Local e data serão registrados no aceite."}</p>
    <div class="signatures">
      ${isAccepted
        ? `<section class="signature" aria-label="Assinatura eletrônica do contratante">
            <small>Assinado eletronicamente pelo contratante</small>
            <strong>${escapeHtml(signerName)}</strong>
            <p>${escapeHtml(stampDate)} · ID ${escapeHtml(shortAcceptanceId)}</p>
          </section>`
        : `<section class="pending-signature" aria-label="Assinatura pendente do contratante">
            <small>Assinatura eletrônica do contratante</small>
            <strong>Será registrada após o aceite</strong>
          </section>`}
      <section class="pending-signature" aria-label="Assinatura pendente do contratado">
        <small>Assinatura do contratado (advogado)</small>
        <strong>Pendente de vinculação</strong>
        <p>Será registrada em etapa própria.</p>
      </section>
    </div>
  </main>
</body>
</html>`;
}

async function createAcceptedLegalPdf(
  document,
  { launch, buildHtml, title, keyword, footerLabel },
) {
  if (!document?.acceptance?.accepted || !document?.acceptance?.signerName) {
    const error = new Error("jec_legal_documents_acceptance_required");
    error.code = "JEC_POWER_OF_ATTORNEY_ACCEPTANCE_REQUIRED";
    throw error;
  }
  const browser = await launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(buildHtml(document), { waitUntil: "domcontentloaded" });
    await page.emulateMedia({ media: "print" });
    const rendered = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `
        <div style="width:100%;padding:0 18mm 5mm;font:8px Arial,sans-serif;color:#667085;display:flex;justify-content:space-between;">
          <span>${escapeHtml(footerLabel)}</span>
          <span><span class="pageNumber"></span>/<span class="totalPages"></span></span>
        </div>
      `,
      margin: { top: "10mm", right: "0", bottom: "18mm", left: "0" },
    });
    const pdf = await PDFDocument.load(rendered);
    pdf.setTitle(title);
    pdf.setSubject(
      `Aceite eletrônico ${document.acceptance.id || ""}; SHA-256 ${document.acceptance.fingerprint || ""}`,
    );
    pdf.setKeywords([
      "IA AUDITA",
      keyword,
      "aceite eletrônico",
      `id:${document.acceptance.id || ""}`,
      `sha256:${document.acceptance.fingerprint || ""}`,
    ]);
    pdf.setCreator("IA AUDITA");
    pdf.setProducer("IA AUDITA");
    return pdf.save();
  } finally {
    await browser.close();
  }
}

export async function createPowerOfAttorneyPdf(
  document,
  { launch = launchJecPdfBrowser } = {},
) {
  return createAcceptedLegalPdf(document, {
    launch,
    buildHtml: buildPowerOfAttorneyHtml,
    title: "Procuração Ad Judicia et Extra - IA AUDITA",
    keyword: "procuração",
    footerLabel: "Procuração gerada pela IA AUDITA",
  });
}

export async function createLegalServicesAgreementPdf(
  document,
  { launch = launchJecPdfBrowser } = {},
) {
  return createAcceptedLegalPdf(document, {
    launch,
    buildHtml: buildLegalServicesAgreementHtml,
    title: "Contrato de Prestação de Serviços Jurídicos e Honorários Advocatícios - IA AUDITA",
    keyword: "contrato de serviços jurídicos",
    footerLabel: "Contrato de serviços jurídicos gerado pela IA AUDITA",
  });
}

function formatReportMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "-";
}

function formatReportDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "Data não informada";
}

export function buildJecCalculationReportHtml(prepared) {
  const report = prepared?.calculationReport;
  if (!Array.isArray(report?.items) || !report.items.length) return "";

  const rows = report.items.map((item) => `
    <tr>
      <td>${escapeHtml(formatReportDate(item.date))}</td>
      <td>${escapeHtml(formatReportMoney(item.amount))}</td>
      <td>${escapeHtml(formatReportMoney(item.interest))}</td>
      <td>${escapeHtml(formatReportMoney(item.correction))}</td>
      <td>${escapeHtml(formatReportMoney(item.updatedPrincipal))}</td>
      <td>${escapeHtml(formatReportMoney(item.doubleWithAdjustments))}</td>
    </tr>`).join("");
  const calculationDate = formatReportDate(report.calculationAsOf);

  return `
    <section class="audit-calculation-report" aria-label="Memória de cálculo da auditoria financeira">
      <header class="audit-report-header">
        <div class="audit-report-brand">IA AUDITA</div>
        <h1>RELATÓRIO TÉCNICO DE AUDITORIA FINANCEIRA INDÉBITO E PERDAS E DANOS</h1>
        <p>Apuração de danos materiais, repetição de indébito e indenização por perdas e danos</p>
      </header>

      <div class="audit-summary-grid">
        <article><span>1. Principal atualizado</span><strong>${escapeHtml(formatReportMoney(report.updatedPrincipal))}</strong></article>
        <article><span>2. Repetição (dobro)</span><strong>${escapeHtml(formatReportMoney(report.doubleWithAdjustments))}</strong></article>
        <article><span>3. Perdas e danos</span><strong>${escapeHtml(formatReportMoney(report.damagesAmount))}</strong></article>
        <article class="audit-summary-total"><span>Soma total (1+2+3)</span><strong>${escapeHtml(formatReportMoney(report.estimatedClaimValue))}</strong></article>
      </div>

      <section class="audit-report-block">
        <h2>Resumo dos pedidos apurados</h2>
        <div class="audit-report-summary">
          <p>(+) Principal atualizado (valor original + juros + correção monetária): <strong>${escapeHtml(formatReportMoney(report.updatedPrincipal))}</strong></p>
          <p>(+) Repetição do indébito em dobro (2 x valor original + juros + correção): <strong>${escapeHtml(formatReportMoney(report.doubleWithAdjustments))}</strong></p>
          <p>(+) Perdas e danos / danos morais (parâmetro referencial): <strong>${escapeHtml(formatReportMoney(report.damagesAmount))}</strong></p>
          <p class="audit-report-grand-total">(=) Total geral apurado em auditoria: ${escapeHtml(formatReportMoney(report.estimatedClaimValue))}</p>
        </div>
      </section>

      <section class="audit-report-block audit-methodology">
        <h2>Critérios da memória de cálculo</h2>
        <p><strong>Juros:</strong> 1% ao mês sobre cada lançamento, a partir da data do débito até ${escapeHtml(calculationDate)}.</p>
        <p><strong>Correção monetária:</strong> variação mensal acumulada do IPCA disponível para o período de cada lançamento.</p>
        <p><strong>Principal atualizado:</strong> valor original acrescido dos juros e da correção monetária.</p>
        <p><strong>Repetição em dobro:</strong> duas vezes o valor original, acrescido dos juros e da correção monetária.</p>
        <p><strong>Indenização referencial:</strong> ${escapeHtml(formatReportMoney(report.damagesAmount))}, sujeita à revisão conforme os fatos e as provas do caso.</p>
      </section>

      <section class="audit-report-block audit-table-block">
        <h2>Memória de cálculo discriminada (parcela por parcela)</h2>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Valor orig.</th>
              <th>Juros (1%/mês)</th>
              <th>Correção mon.</th>
              <th>Principal atualizado</th>
              <th>Dobro atualizado</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <td colspan="5">Total geral apurado (principal atualizado + dobro + perdas e danos)</td>
              <td>${escapeHtml(formatReportMoney(report.estimatedClaimValue))}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <p class="audit-report-disclaimer">Memória técnica estimativa elaborada a partir dos lançamentos documentados e classificados pelo consumidor como não reconhecidos. A incidência jurídica, os valores finais e eventual indenização dependem de revisão e decisão judicial.</p>
    </section>`;
}

function paragraphClass(text, index, paragraphs, claimantName) {
  if (index === 0 && text.startsWith("EXCELENTÍSSIMO")) return "court-address";
  if (text.startsWith("AÇÃO ")) return "action-title";
  if (
    /^(?:DA LIMITAÇÃO TEMPORAL|[IVX]+\.\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]|[1-5]\.\s+(?:Da|Do|Dos|DAS|DA))/u.test(
      text,
    )
  ) {
    return "section-title";
  }
  const remaining = paragraphs.length - index;
  if (
    remaining <= 4 ||
    text === claimantName ||
    text.startsWith("CPF nº") ||
    text.startsWith("(Jus Postulandi")
  ) {
    return "signature";
  }
  return "body";
}

export function buildJecPetitionHtml(prepared) {
  if (!prepared?.draft) throw new Error("jec_petition_draft_required");
  const paragraphs = String(prepared.draft)
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  const claimantName = String(prepared.claimant?.fullName || "").trim();
  const renderedParagraphs = paragraphs.map((paragraph, index) => {
    const className = paragraphClass(
      paragraph,
      index,
      paragraphs,
      claimantName,
    );
    return {
      className,
      html: `<p class="${className}">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
    };
  });
  const signatureStart = renderedParagraphs.findIndex(
    ({ className }) => className === "signature",
  );
  const content = signatureStart < 0
    ? renderedParagraphs.map(({ html }) => html).join("\n")
    : [
        ...renderedParagraphs.slice(0, signatureStart).map(({ html }) => html),
        `<section class="signature-block">${renderedParagraphs
          .slice(signatureStart)
          .map(({ html }) => html)
          .join("\n")}</section>`,
      ].join("\n");
  const modelLabel = escapeHtml(
    prepared.template?.label || "Relatório Técnico de Auditoria",
  );
  const calculationReport = buildJecCalculationReportHtml(prepared);

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <title>${modelLabel}</title>
    <style>
      @page {
        size: A4;
        margin: 25mm 22mm 24mm 30mm;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: #111;
        font-family: "Times New Roman", Times, serif;
        font-size: 12pt;
        line-height: 1.5;
      }
      p {
        margin: 0 0 12pt;
        orphans: 3;
        widows: 3;
      }
      .body {
        text-align: justify;
        text-indent: 1.25cm;
      }
      .court-address,
      .action-title {
        margin-bottom: 18pt;
        font-weight: 700;
        text-align: center;
      }
      .action-title {
        text-transform: uppercase;
      }
      .section-title {
        margin-top: 18pt;
        margin-bottom: 12pt;
        font-weight: 700;
        page-break-after: avoid;
      }
      .signature {
        margin: 4pt 0;
        text-align: center;
      }
      .signature-block {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .audit-calculation-report {
        break-before: page;
        page-break-before: always;
        color: #13283d;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 8.5pt;
        line-height: 1.3;
      }
      .audit-report-header {
        margin: 0 0 16pt;
        padding: 16pt 18pt;
        border-bottom: 4pt solid #2c6ca3;
        background: #10283f;
        color: #fff;
      }
      .audit-report-header h1 {
        margin: 0 0 5pt;
        font-size: 13pt;
        letter-spacing: .2pt;
      }
      .audit-report-brand {
        margin: 0 0 3pt;
        color: #7cc7d0;
        font-size: 10pt;
        font-weight: 700;
        letter-spacing: .4pt;
      }
      .audit-report-header p {
        margin: 0;
        color: #c7d6e7;
        font-size: 10pt;
      }
      .audit-summary-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8pt;
        margin-bottom: 16pt;
      }
      .audit-summary-grid article {
        min-height: 62pt;
        padding: 10pt 8pt;
        border: 1px solid #d4dce5;
        border-radius: 4pt;
        background: #f5f7fa;
        text-align: center;
      }
      .audit-summary-grid span {
        display: block;
        min-height: 24pt;
        color: #536274;
        font-size: 7.5pt;
        font-weight: 700;
        text-transform: uppercase;
      }
      .audit-summary-grid strong {
        display: block;
        margin-top: 5pt;
        color: #13283d;
        font-size: 14pt;
      }
      .audit-summary-grid .audit-summary-total {
        border-color: #10283f;
        background: #10283f;
      }
      .audit-summary-grid .audit-summary-total span { color: #c7d6e7; }
      .audit-summary-grid .audit-summary-total strong { color: #fff; }
      .audit-report-block {
        margin: 0 0 14pt;
      }
      .audit-report-block h2 {
        margin: 0 0 8pt;
        padding-bottom: 5pt;
        border-bottom: 2px solid #13283d;
        font-size: 12pt;
        text-transform: uppercase;
      }
      .audit-report-summary {
        padding: 8pt 10pt;
        border: 1px solid #d4dce5;
        border-radius: 4pt;
        background: #f9fafb;
      }
      .audit-report-summary p,
      .audit-methodology p {
        margin: 0 0 4pt;
      }
      .audit-report-summary p:last-child,
      .audit-methodology p:last-child {
        margin-bottom: 0;
      }
      .audit-report-grand-total {
        margin-top: 6pt !important;
        padding-top: 6pt;
        border-top: 1px dashed #536274;
        font-size: 10pt;
        font-weight: 700;
        text-transform: uppercase;
      }
      .audit-table-block table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        font-size: 7.2pt;
      }
      .audit-table-block thead { display: table-header-group; }
      .audit-table-block tfoot { display: table-row-group; }
      .audit-table-block tr {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .audit-table-block th,
      .audit-table-block td {
        padding: 4pt 3pt;
        border: 1px solid #d4dce5;
        text-align: right;
        white-space: nowrap;
      }
      .audit-table-block th:first-child,
      .audit-table-block td:first-child { text-align: left; }
      .audit-table-block th {
        border-color: #10283f;
        background: #10283f;
        color: #fff;
        font-weight: 700;
      }
      .audit-table-block tbody tr:nth-child(even) { background: #f5f7fa; }
      .audit-table-block tfoot td {
        border-top: 2px solid #10283f;
        background: #e8eef5;
        font-weight: 700;
      }
      .audit-table-block tfoot td:first-child {
        text-align: right;
        text-transform: uppercase;
      }
      .audit-report-disclaimer {
        margin: 10pt 0 0;
        padding: 8pt;
        border-left: 3px solid #2c6ca3;
        background: #eef4fa;
        color: #405267;
        font-size: 7.5pt;
      }
    </style>
  </head>
  <body>
    <main>${content}</main>
    ${calculationReport}
  </body>
</html>`;
}

export async function createJecPetitionPdf(
  prepared,
  { launch = launchJecPdfBrowser } = {},
) {
  if (!prepared?.ready) {
    const error = new Error("jec_petition_incomplete");
    error.code = "jec_petition_incomplete";
    error.missingFields = Array.isArray(prepared?.missingFields)
      ? prepared.missingFields
      : [];
    throw error;
  }

  const browser = await launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(buildJecPetitionHtml(prepared), {
      waitUntil: "domcontentloaded",
    });
    await page.emulateMedia({ media: "print" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `
        <div style="width:100%;padding:0 22mm 6mm 30mm;font:8px Arial,sans-serif;color:#667085;display:flex;justify-content:space-between;">
          <span>Relatório Técnico gerado pela IA AUDITA - revisar antes do protocolo</span>
          <span><span class="pageNumber"></span>/<span class="totalPages"></span></span>
        </div>
      `,
      margin: {
        top: "25mm",
        right: "22mm",
        bottom: "24mm",
        left: "30mm",
      },
    });
  } finally {
    await browser.close();
  }
}

function invalidPdf(code, label = "") {
  const error = new Error(code);
  error.code = code;
  if (label) error.attachment = label;
  return error;
}

async function loadPdf(bytes, code, label = "") {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
    throw invalidPdf(code, label);
  }
  try {
    const pdf = await PDFDocument.load(bytes);
    if (pdf.getPageCount() === 0) throw invalidPdf(code, label);
    return pdf;
  } catch (error) {
    if (error?.code === code) throw error;
    throw invalidPdf(code, label);
  }
}

export async function appendJecPetitionAttachments(basePdf, attachments = []) {
  const output = await loadPdf(basePdf, "jec_petition_pdf_invalid");
  if (!Array.isArray(attachments)) {
    throw invalidPdf("jec_petition_attachment_invalid");
  }

  for (const attachment of attachments) {
    const label = String(attachment?.label || "").trim();
    const source = await loadPdf(
      attachment?.bytes,
      "jec_petition_attachment_invalid",
      label,
    );
    const pages = await output.copyPages(source, source.getPageIndices());
    for (const page of pages) output.addPage(page);
  }

  return output.save();
}
