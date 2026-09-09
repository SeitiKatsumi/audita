import { createHash } from "node:crypto";

export function queueError(status, message) {
  return Object.assign(new Error(message), { status });
}

export function requireLawyer(user) {
  if (!user) throw queueError(401, "Entre na Audita para continuar.");
  if (user.role !== "lawyer") throw queueError(403, "Acesso exclusivo para advogados autorizados pela Audita.");
}

export function createLawyerQueueService({ getDb }) {
  function db() {
    const { pool, dbReady } = getDb();
    if (!pool || !dbReady) throw queueError(503, "A fila está indisponível. Tente novamente; sua solicitação ainda não foi enviada.");
    return pool;
  }

  async function submit(user, { key, claimant, documents, acceptance, sources = [] }) {
    if (!user) throw queueError(401, "Entre na Audita para concluir sua solicitação.");
    if (!key || !claimant?.fullName || !claimant?.uf || !acceptance?.id ||
        !["report", "powerOfAttorney", "agreement"].every(name => Buffer.isBuffer(documents?.[name]) && documents[name].length)) {
      throw queueError(422, "Documentos e assinatura precisam estar completos.");
    }
    // ponytail: PDFs ficam no PostgreSQL para salvar o conjunto atomicamente; mover para armazenamento privado se o volume exigir.
    const result = await db().query(`INSERT INTO audita_lawyer_jobs
      (tenant_id, user_id, submission_key, claimant, acceptance, report_pdf, power_of_attorney_pdf, agreement_pdf, source_documents)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (user_id, submission_key) DO UPDATE SET submission_key = EXCLUDED.submission_key
      RETURNING id, status, created_at`, [user.tenant_id, user.id,
      createHash("sha256").update(key).digest("hex"), claimant, acceptance,
      documents.report, documents.powerOfAttorney, documents.agreement, JSON.stringify(sources)]);
    return result.rows[0];
  }

  async function list(user) {
    requireLawyer(user);
    // ponytail: listagem integral; paginar quando o volume de atendimentos exigir.
    // A fila central mostra apenas localização até o advogado assumir o atendimento.
    return (await db().query(`SELECT id, status, created_at, claimed_at, filed_at, protocol_number,
      claimant->>'uf' AS uf, claimant->>'city' AS city,
      CASE WHEN lawyer_id = $1 THEN claimant->>'fullName' END AS client_name,
      CASE WHEN lawyer_id = $1 THEN (SELECT jsonb_agg(item->>'name') FROM jsonb_array_elements(source_documents) item) END AS sources,
      lawyer_id = $1 AS mine
      FROM audita_lawyer_jobs WHERE status = 'queued' OR lawyer_id = $1
      ORDER BY created_at DESC`, [user.id])).rows;
  }

  async function claim(user, id) {
    requireLawyer(user);
    const result = await db().query(`UPDATE audita_lawyer_jobs
      SET lawyer_id = $2, status = 'claimed', claimed_at = NOW()
      WHERE id = $1 AND status = 'queued' AND lawyer_id IS NULL RETURNING id, status`, [id, user.id]);
    if (!result.rows[0]) throw queueError(409, "Esta solicitação já foi assumida. Atualize a fila.");
    return result.rows[0];
  }

  async function document(user, id, name) {
    requireLawyer(user);
    const columns = { report: "report_pdf", powerOfAttorney: "power_of_attorney_pdf", agreement: "agreement_pdf" };
    if (/^source-\d+$/.test(name)) {
      const result = await db().query(`SELECT source_documents->$3::int AS document FROM audita_lawyer_jobs WHERE id = $1 AND lawyer_id = $2`, [id, user.id, Number(name.slice(7))]);
      const source = result.rows[0]?.document;
      if (!source) throw queueError(404, "Documento não encontrado.");
      return { bytes: Buffer.from(source.base64, "base64"), name: source.name, type: source.type };
    }
    if (!Object.hasOwn(columns, name)) throw queueError(404, "Documento não encontrado.");
    const result = await db().query(`SELECT ${columns[name]} AS pdf FROM audita_lawyer_jobs
      WHERE id = $1 AND lawyer_id = $2`, [id, user.id]);
    if (!result.rows[0]) throw queueError(404, "Solicitação não encontrada entre seus casos.");
    return { bytes: result.rows[0].pdf, name: `${name}.pdf`, type: "application/pdf" };
  }

  async function complete(user, id, protocol) {
    requireLawyer(user);
    const number = String(protocol || "").trim();
    if (number.length < 5 || number.length > 100 || /[\x00-\x1f]/.test(number)) throw queueError(422, "Informe o número do protocolo fornecido pelo tribunal.");
    const result = await db().query(`UPDATE audita_lawyer_jobs SET status = 'filed', protocol_number = $3, filed_at = NOW()
      WHERE id = $1 AND lawyer_id = $2 AND status = 'claimed' RETURNING id, status`, [id, user.id, number]);
    if (!result.rows[0]) throw queueError(409, "O caso não está disponível para conclusão por sua conta.");
    return result.rows[0];
  }
  return { submit, list, claim, document, complete };
}
