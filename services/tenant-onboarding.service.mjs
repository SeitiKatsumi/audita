function normalizedText(value) {
  return String(value ?? "").trim();
}

function slugPart(value) {
  return normalizedText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
}

export function buildSelfServeTenantIdentity({ name, email, nonce }) {
  const accountName = normalizedText(name) || "Cliente Audita";
  const emailPrefix = normalizedText(email).split("@")[0];
  const base = slugPart(accountName) || slugPart(emailPrefix) || "cliente";
  const suffix = slugPart(nonce).slice(0, 12) || "conta";
  return {
    name: `Conta ${accountName}`,
    slug: `conta-${base}-${suffix}`.slice(0, 63),
  };
}

export async function createSelfServeAccount(
  pool,
  { name, email, passwordHash, nonce },
) {
  if (!pool?.connect) throw new Error("database_unavailable");
  const tenant = buildSelfServeTenantIdentity({ name, email, nonce });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tenantResult = await client.query(
      `INSERT INTO audita_tenants (name, slug, status)
       VALUES ($1, $2, 'active')
       RETURNING id, name, slug`,
      [tenant.name, tenant.slug],
    );
    const tenantRow = tenantResult.rows[0];
    const userResult = await client.query(
      `INSERT INTO audita_users (
         tenant_id, email, name, role, password_hash, status
       )
       VALUES ($1, $2, $3, 'owner', $4, 'active')
       RETURNING id`,
      [tenantRow.id, email, name, passwordHash],
    );
    await client.query("COMMIT");
    return {
      userId: userResult.rows[0].id,
      tenantId: tenantRow.id,
      tenantName: tenantRow.name,
      tenantSlug: tenantRow.slug,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
