import crypto from "node:crypto";
import { basename } from "node:path";
import { hashDocument, isValidDocument, maskDocument, normalizeDocument } from "./audit.service.mjs";
import { savePdf } from "./storage.service.mjs";
import {
  getOnrProviderConfig,
  getOperationCreditCost,
  getPropertyOperation,
  isPriorSearchAvailable,
  listOnrRegistryOffices,
  normalizePropertyAssets,
  pollOnrRequest,
  PROPERTY_OPERATIONS,
  PROPERTY_SEARCH_UFS,
  submitOnrRequest,
} from "./onr-ri-digital.service.mjs";

const memorySearches = new Map();
const ALLOWED_OUTCOMES = new Set(["nothing_found", "assets_found", "restriction_found", "inconclusive"]);
const ALLOWED_EVIDENCE_TYPES = new Set(["onr_report", "qualified_report", "certificate", "protocol", "note"]);

function maskName(value) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  if (words.length === 1) return `${words[0].slice(0, 1)}***`;
  return `${words[0]} ${words.slice(1).map((word) => `${word.slice(0, 1)}***`).join(" ")}`;
}

function toPublicFileUrl(path) {
  return path ? `/storage/pdfs/${encodeURIComponent(basename(path))}` : "";
}

function now() {
  return new Date().toISOString();
}

function normalizeEvidence(value = {}) {
  const type = ALLOWED_EVIDENCE_TYPES.has(String(value.type || "")) ? String(value.type) : "note";
  return {
    id: String(value.id || crypto.randomUUID()),
    type,
    title: String(value.title || "Evidência do pedido").trim().slice(0, 200),
    value: String(value.value || "").trim().slice(0, 4000),
    fileName: String(value.fileName || "").trim().slice(0, 240),
    fileUrl: String(value.fileUrl || "").trim(),
    createdAt: String(value.createdAt || now()),
  };
}

function publicSearch(search) {
  if (!search) return null;
  return {
    id: search.id,
    subjectType: search.subjectType,
    subjectMasked: search.subjectMasked,
    subjectName: search.subjectNameMasked || maskName(search.subjectName),
    uf: search.uf,
    registryOfficeId: search.registryOfficeId || 0,
    registryOfficeIds: Array.isArray(search.registryOfficeIds) ? search.registryOfficeIds : [],
    certificatePurposeId: search.certificatePurposeId || 0,
    includeTransferred: Boolean(search.includeTransferred),
    transferDate: search.transferDate || "",
    registrationNumber: search.registrationNumber || "",
    registryOffice: search.registryOffice || "",
    city: search.city || "",
    operation: search.operation,
    operationLabel: search.operationLabel,
    provider: search.provider,
    providerMode: search.providerMode,
    status: search.status,
    outcome: search.outcome,
    officialUrl: search.officialUrl,
    coverageAvailable: search.coverageAvailable,
    supportedUfs: search.supportedUfs || [...PROPERTY_SEARCH_UFS],
    providerOrderId: search.providerOrderId || "",
    providerRequestId: search.providerRequestId || 0,
    providerDetails: Array.isArray(search.providerDetails) ? search.providerDetails : [],
    providerCosts: search.providerCosts || null,
    providerAttachments: Array.isArray(search.providerAttachments) ? search.providerAttachments : [],
    missingRequirements: Array.isArray(search.missingRequirements) ? search.missingRequirements : [],
    summary: search.summary || "",
    nextAction: search.nextAction || "",
    assets: normalizePropertyAssets(search.assets || []),
    evidence: (search.evidence || []).map(normalizeEvidence),
    credit: {
      cost: Number(search.creditCost || 0),
      state: search.creditState || "not_charged",
    },
    timeline: Array.isArray(search.timeline) ? search.timeline : [],
    error: search.error || "",
    createdAt: search.createdAt,
    updatedAt: search.updatedAt,
    completedAt: search.completedAt || "",
  };
}

function rowToSearch(row, evidence = []) {
  const requestData = row.request_json || {};
  const resultData = row.result_json || {};
  return {
    id: row.public_id,
    tenantId: row.tenant_id,
    userId: row.requested_by_user_id,
    subjectType: row.subject_type,
    subjectMasked: row.subject_masked,
    subjectName: requestData.subjectName || "",
    subjectNameMasked: requestData.subjectNameMasked || "",
    uf: row.uf || "",
    registryOfficeId: Number(requestData.registryOfficeId || 0),
    registryOfficeIds: Array.isArray(requestData.registryOfficeIds) ? requestData.registryOfficeIds : [],
    certificatePurposeId: Number(requestData.certificatePurposeId || 0),
    includeTransferred: Boolean(requestData.includeTransferred),
    transferDate: requestData.transferDate || "",
    registrationNumber: requestData.registrationNumber || "",
    registryOffice: requestData.registryOffice || "",
    city: requestData.city || "",
    operation: row.operation,
    operationLabel: resultData.operationLabel || getPropertyOperation(row.operation).label,
    provider: row.provider,
    providerMode: row.provider_mode,
    status: row.status,
    outcome: row.outcome,
    officialUrl: resultData.officialUrl || getPropertyOperation(row.operation).officialUrl,
    coverageAvailable: resultData.coverageAvailable !== false,
    supportedUfs: resultData.supportedUfs || [...PROPERTY_SEARCH_UFS],
    providerOrderId: row.provider_order_id || "",
    providerRequestId: resultData.providerRequestId || 0,
    providerDetails: resultData.providerDetails || [],
    providerCosts: resultData.providerCosts || null,
    providerAttachments: resultData.providerAttachments || [],
    missingRequirements: resultData.missingRequirements || [],
    summary: resultData.summary || "",
    nextAction: resultData.nextAction || "",
    assets: resultData.assets || [],
    evidence,
    creditCost: row.credit_cost,
    creditState: row.credit_state,
    timeline: resultData.timeline || [],
    error: row.error_message || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export function createPropertyAssetsService({
  getDb,
  getAuthContext,
  creditsService,
  submitProvider = submitOnrRequest,
  listRegistryOfficesProvider = listOnrRegistryOffices,
  pollProvider = pollOnrRequest,
} = {}) {
  async function getConfig(request) {
    const authContext = await getAuthContext(request);
    if (authContext.unauthorized) return { unauthorized: true };
    const provider = getOnrProviderConfig();
    const wallet = await creditsService.getWallet(authContext);
    return {
      provider: {
        name: "ONR / RI Digital",
        mode: provider.mode,
        environment: provider.environment,
        apiContractReady: provider.contractReady,
        operationReadiness: provider.readiness,
        operationRequirements: provider.operationRequirements,
        missingRequirements: provider.missingRequirements,
        apiOperations: Object.values(PROPERTY_OPERATIONS)
          .filter((operation) => operation.apiImplemented)
          .map((operation) => operation.id),
        noScraping: true,
      },
      operations: Object.values(PROPERTY_OPERATIONS).map((operation) => ({
        ...operation,
        creditCost: getOperationCreditCost(operation.id),
      })),
      priorSearchUfs: [...PROPERTY_SEARCH_UFS],
      wallet,
    };
  }

  async function listRegistryOffices(request, query = {}) {
    const authContext = await getAuthContext(request);
    if (authContext.unauthorized) return { unauthorized: true };
    const uf = String(query.uf || "").trim().toUpperCase();
    const operation = String(query.operation || "").trim().toLowerCase();
    if (!/^[A-Z]{2}$/.test(uf) || !["pesquisa_qualificada", "certidao_digital"].includes(operation)) {
      return { invalid: true, reason: "uf_or_operation_required" };
    }
    return listRegistryOfficesProvider({ uf, operation });
  }

  async function createSearch(request) {
    const authContext = await getAuthContext(request);
    if (authContext.unauthorized) return { unauthorized: true };
    const body = request.body || {};
    const subjectType = String(body.tipoDocumento || body.subjectType || "").trim().toLowerCase();
    const document = normalizeDocument(body.documento || body.subjectDocument);
    const operation = getPropertyOperation(body.operation);
    const uf = String(body.uf || "").trim().toUpperCase();
    const subjectName = String(body.subjectName || "").trim().slice(0, 240);
    const registryOfficeIds = [...new Set((Array.isArray(body.registryOfficeIds) ? body.registryOfficeIds : [body.registryOfficeId])
      .map((value) => Number.parseInt(String(value || ""), 10))
      .filter((value) => Number.isInteger(value) && value > 0))].slice(0, 200);
    const registryOfficeId = registryOfficeIds[0] || 0;
    const certificatePurposeId = Number.parseInt(String(body.certificatePurposeId || ""), 10) || 0;
    const includeTransferred = body.includeTransferred === true;
    const transferDate = String(body.transferDate || "").trim().slice(0, 10);
    const registrationNumber = String(body.registrationNumber || "").trim().slice(0, 120);
    const registryOffice = String(body.registryOffice || "").trim().slice(0, 300);
    const city = String(body.city || "").trim().slice(0, 160);
    const providerConfig = getOnrProviderConfig();
    const automaticOperationReady = Boolean(providerConfig.readiness[operation.id]);

    if (body.authorizationConfirmed !== true || !["cpf", "cnpj"].includes(subjectType) || !isValidDocument(subjectType, document)) {
      return { invalid: true, reason: "document_or_authorization" };
    }
    if (operation.id !== "indisponibilidade" && !/^[A-Z]{2}$/.test(uf)) {
      return { invalid: true, reason: "uf_required" };
    }
    if (["pesquisa_previa", "pesquisa_qualificada"].includes(operation.id) && !subjectName) {
      return { invalid: true, reason: "subject_name_required" };
    }
    if (automaticOperationReady && operation.id === "pesquisa_qualificada" && !registryOfficeIds.length) {
      return { invalid: true, reason: "registry_office_required" };
    }
    if (automaticOperationReady && operation.id === "pesquisa_qualificada" && includeTransferred && !/^\d{4}-\d{2}-\d{2}$/.test(transferDate)) {
      return { invalid: true, reason: "transfer_date_required" };
    }
    if (automaticOperationReady && operation.id === "certidao_digital" && !registrationNumber) {
      return { invalid: true, reason: "registration_number_required" };
    }
    if (automaticOperationReady && operation.id === "certidao_digital" && !registryOfficeId) {
      return { invalid: true, reason: "registry_office_required" };
    }
    if (automaticOperationReady && operation.id === "certidao_digital" && (certificatePurposeId < 1 || certificatePurposeId > 5)) {
      return { invalid: true, reason: "certificate_purpose_required" };
    }

    const id = crypto.randomUUID();
    const creditCost = getOperationCreditCost(operation.id);
    const wallet = await creditsService.getWallet(authContext);
    if (wallet.enabled && wallet.balance < creditCost) {
      return { insufficientCredits: true, wallet, creditCost };
    }

    const providerResult = await submitProvider({
      tipoDocumento: subjectType,
      documento: document,
      subjectName,
      uf,
      operation: operation.id,
      registryOfficeId,
      registryOfficeIds,
      certificatePurposeId,
      includeTransferred,
      transferDate,
      registrationNumber,
      registryOffice,
      city,
      referenceId: id,
    });
    let creditState = "not_charged";
    if (providerResult.providerOrderId || providerResult.status === "completed") {
      const charge = await creditsService.consume(authContext, {
        amount: creditCost,
        referenceId: id,
        operation: operation.id,
        metadata: { provider: "onr", providerMode: providerResult.providerMode },
      });
      if (!charge.ok) return { insufficientCredits: true, wallet: charge.wallet, creditCost };
      creditState = charge.state;
    }

    const createdAt = now();
    const search = {
      id,
      tenantId: authContext.tenantId,
      userId: authContext.user?.id || null,
      subjectType,
      subjectHash: hashDocument(authContext.tenantId, document),
      subjectMasked: maskDocument(subjectType, document),
      subjectName,
      subjectNameMasked: maskName(subjectName),
      uf,
      registryOfficeId,
      registryOfficeIds,
      certificatePurposeId,
      includeTransferred,
      transferDate,
      operation: operation.id,
      operationLabel: operation.label,
      registrationNumber,
      registryOffice,
      city,
      provider: providerResult.provider || "ONR / RI Digital",
      providerMode: providerResult.providerMode || "official_manual",
      status: providerResult.status || "waiting_user_action",
      outcome: providerResult.outcome || "pending",
      officialUrl: providerResult.officialUrl || operation.officialUrl,
      coverageAvailable: providerResult.coverageAvailable !== false,
      supportedUfs: providerResult.supportedUfs || [...PROPERTY_SEARCH_UFS],
      providerOrderId: providerResult.providerOrderId || "",
      providerRequestId: providerResult.providerRequestId || 0,
      providerDetails: providerResult.providerDetails || [],
      providerCosts: providerResult.providerCosts || null,
      providerAttachments: providerResult.providerAttachments || [],
      missingRequirements: providerResult.missingRequirements || [],
      summary: providerResult.summary || "",
      nextAction: providerResult.nextAction || "",
      assets: providerResult.assets || [],
      evidence: [],
      creditCost,
      creditState,
      timeline: [{ status: "created", label: "Consulta criada", at: createdAt }],
      error: providerResult.providerError ? JSON.stringify(providerResult.providerError).slice(0, 1000) : "",
      createdAt,
      updatedAt: createdAt,
      completedAt: providerResult.status === "completed" ? createdAt : "",
    };

    memorySearches.set(id, search);
    await persistSearch(search);
    return { search: publicSearch(search), wallet: await creditsService.getWallet(authContext) };
  }

  async function persistSearch(search) {
    const { pool, dbReady } = getDb ? getDb() : {};
    if (!pool || !dbReady || !search.tenantId) return;
    await pool.query(
      `INSERT INTO audita_property_searches (
         public_id, tenant_id, requested_by_user_id, subject_type, subject_hash, subject_masked,
         uf, operation, provider, provider_mode, status, outcome, credit_cost, credit_state,
         provider_order_id, request_json, result_json, error_message, created_at, updated_at, completed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       ON CONFLICT (public_id) DO UPDATE SET
         status = EXCLUDED.status,
         outcome = EXCLUDED.outcome,
         credit_state = EXCLUDED.credit_state,
         provider_order_id = EXCLUDED.provider_order_id,
         result_json = EXCLUDED.result_json,
         error_message = EXCLUDED.error_message,
         updated_at = EXCLUDED.updated_at,
         completed_at = EXCLUDED.completed_at`,
      [
        search.id,
        search.tenantId,
        search.userId,
        search.subjectType,
        search.subjectHash,
        search.subjectMasked,
        search.uf,
        search.operation,
        search.provider,
        search.providerMode,
        search.status,
        search.outcome,
        search.creditCost,
        search.creditState,
        search.providerOrderId || null,
        JSON.stringify({
          subjectName: search.subjectName,
          subjectNameMasked: search.subjectNameMasked,
          registryOfficeId: search.registryOfficeId,
          registryOfficeIds: search.registryOfficeIds,
          certificatePurposeId: search.certificatePurposeId,
          includeTransferred: search.includeTransferred,
          transferDate: search.transferDate,
          registrationNumber: search.registrationNumber,
          registryOffice: search.registryOffice,
          city: search.city,
        }),
        JSON.stringify({
          operationLabel: search.operationLabel,
          officialUrl: search.officialUrl,
          coverageAvailable: search.coverageAvailable,
          supportedUfs: search.supportedUfs,
          summary: search.summary,
          nextAction: search.nextAction,
          assets: search.assets,
          providerRequestId: search.providerRequestId,
          providerDetails: search.providerDetails,
          providerCosts: search.providerCosts,
          providerAttachments: search.providerAttachments,
          missingRequirements: search.missingRequirements,
          timeline: search.timeline,
        }),
        search.error || "",
        search.createdAt,
        search.updatedAt,
        search.completedAt || null,
      ],
    );
  }

  async function persistEvidence(search, evidence) {
    const { pool, dbReady } = getDb ? getDb() : {};
    if (!pool || !dbReady || !search.tenantId) return;
    await pool.query(
      `INSERT INTO audita_property_evidence (
         property_search_id, evidence_type, title, value, file_name, file_path, created_at
       )
       SELECT id, $2, $3, $4, $5, $6, $7
       FROM audita_property_searches
       WHERE public_id = $1
       ON CONFLICT DO NOTHING`,
      [search.id, evidence.type, evidence.title, evidence.value, evidence.fileName || null, evidence.fileUrl || null, evidence.createdAt],
    );
  }

  async function findSearch(id, request) {
    const authContext = request?.__authContext || (await getAuthContext(request));
    if (authContext.unauthorized) return { unauthorized: true };
    const memory = memorySearches.get(String(id));
    if (memory && memory.tenantId === authContext.tenantId && (!authContext.user?.id || memory.userId === authContext.user.id)) {
      return publicSearch(memory);
    }

    const { pool, dbReady } = getDb ? getDb() : {};
    if (!pool || !dbReady || !authContext.tenantId) return null;
    const params = [id, authContext.tenantId];
    const userFilter = authContext.user?.id ? "AND requested_by_user_id = $3" : "";
    if (authContext.user?.id) params.push(authContext.user.id);
    const result = await pool.query(
      `SELECT * FROM audita_property_searches
       WHERE public_id = $1 AND tenant_id = $2 ${userFilter}
       LIMIT 1`,
      params,
    );
    if (!result.rows[0]) return null;
    const evidenceResult = await pool.query(
      `SELECT id, evidence_type AS type, title, value, file_name AS "fileName", file_path AS "fileUrl", created_at AS "createdAt"
       FROM audita_property_evidence
       WHERE property_search_id = $1
       ORDER BY created_at`,
      [result.rows[0].id],
    );
    const search = rowToSearch(result.rows[0], evidenceResult.rows);
    memorySearches.set(search.id, search);
    return publicSearch(search);
  }

  async function listSearches(request, { limit = 20 } = {}) {
    const authContext = await getAuthContext(request);
    if (authContext.unauthorized) return { unauthorized: true };
    const { pool, dbReady } = getDb ? getDb() : {};
    if (!pool || !dbReady || !authContext.tenantId) {
      const searches = [...memorySearches.values()]
        .filter((item) => item.tenantId === authContext.tenantId)
        .filter((item) => !authContext.user?.id || item.userId === authContext.user.id)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, limit)
        .map(publicSearch);
      return { searches };
    }
    const params = [authContext.tenantId, limit];
    const userFilter = authContext.user?.id ? "AND requested_by_user_id = $3" : "";
    if (authContext.user?.id) params.push(authContext.user.id);
    const result = await pool.query(
      `SELECT * FROM audita_property_searches
       WHERE tenant_id = $1 ${userFilter}
       ORDER BY created_at DESC
       LIMIT $2`,
      params,
    );
    return { searches: result.rows.map((row) => publicSearch(rowToSearch(row))) };
  }

  async function handleAction(id, request) {
    const authContext = await getAuthContext(request);
    if (authContext.unauthorized) return { unauthorized: true };
    const existing = await getMutableSearch(id, authContext);
    if (!existing) return { notFound: true };
    const body = request.body || {};
    const action = String(body.action || "").trim();

    if (action === "refresh_provider") {
      if (existing.providerMode !== "api" || !["processing", "waiting_user_action"].includes(existing.status)) {
        return { invalid: true, reason: "provider_refresh_unavailable" };
      }
      const providerResult = await pollProvider({
        operation: existing.operation,
        uf: existing.uf,
        providerOrderId: existing.providerOrderId,
        providerRequestId: existing.providerRequestId,
        outcome: existing.outcome,
      });
      existing.status = providerResult.status || existing.status;
      existing.outcome = providerResult.outcome || existing.outcome;
      existing.summary = providerResult.summary || existing.summary;
      existing.nextAction = providerResult.nextAction || existing.nextAction;
      existing.providerDetails = providerResult.providerDetails || existing.providerDetails;
      existing.providerCosts = providerResult.providerCosts || existing.providerCosts;
      existing.providerAttachments = providerResult.providerAttachments || existing.providerAttachments;
      existing.assets = providerResult.assets || existing.assets;
      existing.error = providerResult.providerError ? JSON.stringify(providerResult.providerError).slice(0, 1000) : "";
      existing.updatedAt = now();
      if (existing.status === "completed") existing.completedAt = existing.updatedAt;
      existing.timeline.push({
        status: existing.status,
        label: existing.status === "completed" ? "Resultado oficial recebido" : "Status consultado no ONR",
        at: existing.updatedAt,
      });
      memorySearches.set(existing.id, existing);
      await persistSearch(existing);
      return { search: publicSearch(existing), wallet: await creditsService.getWallet(authContext) };
    }

    if (action === "cancel") {
      if (existing.status === "completed") return { invalid: true, reason: "already_completed" };
      existing.status = "cancelled";
      existing.nextAction = "";
      existing.summary = "Consulta cancelada antes da conclusão.";
      existing.updatedAt = now();
      existing.timeline.push({ status: "cancelled", label: "Consulta cancelada", at: existing.updatedAt });
      memorySearches.set(existing.id, existing);
      await persistSearch(existing);
      return { search: publicSearch(existing), wallet: await creditsService.getWallet(authContext) };
    }

    if (action === "record_protocol") {
      const protocol = String(body.protocol || "").trim().slice(0, 240);
      if (!protocol) return { invalid: true, reason: "protocol_required" };
      const charge = await chargeSearch(existing, authContext);
      if (!charge.ok) return { insufficientCredits: true, wallet: charge.wallet, creditCost: existing.creditCost };
      existing.providerOrderId = protocol;
      existing.creditState = charge.state;
      existing.status = "processing";
      existing.outcome = "pending";
      existing.nextAction = "wait_provider_result";
      existing.summary = "Protocolo registrado. Aguardando o resultado oficial do ONR/RI Digital.";
      existing.updatedAt = now();
      existing.timeline.push({ status: "processing", label: "Protocolo registrado", at: existing.updatedAt });
      const evidence = normalizeEvidence({ type: "protocol", title: "Protocolo RI Digital", value: protocol });
      existing.evidence.push(evidence);
      memorySearches.set(existing.id, existing);
      await persistSearch(existing);
      await persistEvidence(existing, evidence);
      return { search: publicSearch(existing), wallet: charge.wallet };
    }

    if (action === "record_result") {
      const outcome = String(body.outcome || "").trim();
      if (!ALLOWED_OUTCOMES.has(outcome)) return { invalid: true, reason: "invalid_outcome" };
      const assets = normalizePropertyAssets(body.assets || []);
      if (outcome === "assets_found" && !assets.length) return { invalid: true, reason: "asset_required" };
      const charge = await chargeSearch(existing, authContext);
      if (!charge.ok) return { insufficientCredits: true, wallet: charge.wallet, creditCost: existing.creditCost };

      let fileUrl = "";
      const fileName = String(body.fileName || "").trim().slice(0, 240);
      const contentBase64 = String(body.contentBase64 || "").trim();
      if (contentBase64 && fileName) {
        if (!/\.pdf$/i.test(fileName) || contentBase64.length > 2_800_000) {
          return { invalid: true, reason: "invalid_evidence_file" };
        }
        const path = await savePdf({ consultaId: existing.id, fonte: "imoveis-onr", fileName, contentBase64 });
        fileUrl = toPublicFileUrl(path);
      }

      const resultSummary = String(body.summary || outcomeLabel(outcome)).trim().slice(0, 2000);
      const evidence = normalizeEvidence({
        type: body.evidenceType,
        title: body.evidenceTitle || "Resultado oficial registrado",
        value: resultSummary,
        fileName,
        fileUrl,
      });
      existing.status = "completed";
      existing.outcome = outcome;
      existing.assets = assets;
      existing.providerOrderId = String(body.protocol || existing.providerOrderId || "").trim().slice(0, 240);
      existing.creditState = charge.state;
      existing.summary = resultSummary;
      existing.nextAction = outcome === "assets_found" && existing.operation === "pesquisa_previa" ? "request_qualified_search" : "review_result";
      existing.updatedAt = now();
      existing.completedAt = existing.updatedAt;
      existing.timeline.push({ status: "completed", label: "Resultado registrado", at: existing.updatedAt });
      existing.evidence.push(evidence);
      memorySearches.set(existing.id, existing);
      await persistSearch(existing);
      await persistEvidence(existing, evidence);
      return { search: publicSearch(existing), wallet: charge.wallet };
    }

    return { invalid: true, reason: "unsupported_action" };
  }

  async function chargeSearch(search, authContext) {
    if (search.creditState === "consumed") {
      return { ok: true, state: "consumed", wallet: await creditsService.getWallet(authContext) };
    }
    return creditsService.consume(authContext, {
      amount: search.creditCost,
      referenceId: search.id,
      operation: search.operation,
      metadata: { provider: "onr", providerMode: search.providerMode },
    });
  }

  async function getMutableSearch(id, authContext) {
    const memory = memorySearches.get(String(id));
    if (memory && memory.tenantId === authContext.tenantId && (!authContext.user?.id || memory.userId === authContext.user.id)) {
      return memory;
    }
    const publicValue = await findSearch(id, { __authContext: authContext });
    return publicValue ? memorySearches.get(String(id)) : null;
  }

  return { getConfig, listRegistryOffices, createSearch, findSearch, listSearches, handleAction };
}

function outcomeLabel(outcome) {
  return {
    nothing_found: "Nenhuma matrícula ou ocorrência foi localizada no resultado informado.",
    assets_found: "Foram localizadas matrículas associadas ao CPF ou CNPJ pesquisado.",
    restriction_found: "Foi localizada indisponibilidade de bens no relatório oficial.",
    inconclusive: "O resultado não permitiu uma conclusão.",
  }[outcome] || "Resultado registrado.";
}

export { isPriorSearchAvailable };
