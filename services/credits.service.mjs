const memoryWallets = new Map();
const memoryLedger = new Map();

function integerEnv(name, fallback = 0) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function creditsEnabled() {
  return String(process.env.AUDITA_CREDITS_ENABLED || "false").toLowerCase() === "true";
}

function walletKey(authContext) {
  return String(authContext?.tenantId || "public");
}

function publicWallet(wallet, enabled = creditsEnabled()) {
  return {
    enabled,
    balance: Number(wallet?.balance || 0),
    consumed: Number(wallet?.consumed || 0),
    reserved: Number(wallet?.reserved || 0),
    unit: "crédito",
  };
}

export function createCreditsService({ getDb } = {}) {
  async function getWallet(authContext) {
    const enabled = creditsEnabled();
    const initialBalance = integerEnv("AUDITA_INITIAL_CREDITS", 0);
    if (!enabled) {
      return publicWallet({ balance: 0, consumed: 0, reserved: 0 }, false);
    }

    const { pool, dbReady } = getDb ? getDb() : {};
    if (!pool || !dbReady || !authContext?.tenantId) {
      const key = walletKey(authContext);
      if (!memoryWallets.has(key)) {
        memoryWallets.set(key, { balance: initialBalance, consumed: 0, reserved: 0 });
      }
      return publicWallet(memoryWallets.get(key), true);
    }

    await pool.query(
      `INSERT INTO audita_credit_wallets (tenant_id, balance)
       VALUES ($1, $2)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [authContext.tenantId, initialBalance],
    );
    const result = await pool.query(
      `SELECT balance, consumed, reserved
       FROM audita_credit_wallets
       WHERE tenant_id = $1
       LIMIT 1`,
      [authContext.tenantId],
    );
    return publicWallet(result.rows[0], true);
  }

  async function consume(authContext, { amount, referenceId, operation, metadata = {} }) {
    const cost = Number(amount);
    if (!creditsEnabled() || !Number.isInteger(cost) || cost <= 0) {
      return { ok: true, state: "not_charged", wallet: await getWallet(authContext), amount: Math.max(0, cost || 0) };
    }

    const reference = String(referenceId || "").trim();
    if (!reference) {
      return { ok: false, state: "invalid_reference", wallet: await getWallet(authContext), amount: cost };
    }

    const { pool, dbReady } = getDb ? getDb() : {};
    if (!pool || !dbReady || !authContext?.tenantId) {
      const key = walletKey(authContext);
      const ledgerKey = `${key}:${reference}:consume`;
      if (memoryLedger.has(ledgerKey)) {
        return { ok: true, state: "consumed", wallet: await getWallet(authContext), amount: cost, duplicate: true };
      }
      const wallet = await getWallet(authContext);
      if (wallet.balance < cost) {
        return { ok: false, state: "insufficient", wallet, amount: cost };
      }
      const next = {
        balance: wallet.balance - cost,
        consumed: wallet.consumed + cost,
        reserved: wallet.reserved,
      };
      memoryWallets.set(key, next);
      memoryLedger.set(ledgerKey, { amount: -cost, operation, metadata, createdAt: new Date().toISOString() });
      return { ok: true, state: "consumed", wallet: publicWallet(next, true), amount: cost };
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const duplicate = await client.query(
        `SELECT id
         FROM audita_credit_ledger
         WHERE tenant_id = $1 AND reference_id = $2 AND entry_type = 'consume'
         LIMIT 1`,
        [authContext.tenantId, reference],
      );
      if (duplicate.rows[0]) {
        await client.query("COMMIT");
        return { ok: true, state: "consumed", wallet: await getWallet(authContext), amount: cost, duplicate: true };
      }

      await client.query(
        `INSERT INTO audita_credit_wallets (tenant_id, balance)
         VALUES ($1, $2)
         ON CONFLICT (tenant_id) DO NOTHING`,
        [authContext.tenantId, integerEnv("AUDITA_INITIAL_CREDITS", 0)],
      );
      const walletResult = await client.query(
        `SELECT balance, consumed, reserved
         FROM audita_credit_wallets
         WHERE tenant_id = $1
         FOR UPDATE`,
        [authContext.tenantId],
      );
      const wallet = walletResult.rows[0];
      if (Number(wallet.balance) < cost) {
        await client.query("ROLLBACK");
        return { ok: false, state: "insufficient", wallet: publicWallet(wallet, true), amount: cost };
      }

      await client.query(
        `UPDATE audita_credit_wallets
         SET balance = balance - $2, consumed = consumed + $2, updated_at = NOW()
         WHERE tenant_id = $1`,
        [authContext.tenantId, cost],
      );
      await client.query(
        `INSERT INTO audita_credit_ledger (
           tenant_id, user_id, entry_type, amount, operation, reference_id, metadata
         ) VALUES ($1, $2, 'consume', $3, $4, $5, $6)`,
        [
          authContext.tenantId,
          authContext.user?.id || null,
          -cost,
          String(operation || "property_search"),
          reference,
          JSON.stringify(metadata || {}),
        ],
      );
      await client.query("COMMIT");
      return { ok: true, state: "consumed", wallet: await getWallet(authContext), amount: cost };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function grant(authContext, { amount, referenceId, operation, metadata = {} }) {
    const value = Number(amount);
    if (!creditsEnabled() || !Number.isInteger(value) || value <= 0) {
      return {
        ok: true,
        state: "not_granted",
        wallet: await getWallet(authContext),
        amount: Math.max(0, value || 0),
      };
    }

    const reference = String(referenceId || "").trim();
    if (!reference) {
      return {
        ok: false,
        state: "invalid_reference",
        wallet: await getWallet(authContext),
        amount: value,
      };
    }

    const { pool, dbReady } = getDb ? getDb() : {};
    if (!pool || !dbReady || !authContext?.tenantId) {
      const key = walletKey(authContext);
      const ledgerKey = `${key}:${reference}:grant`;
      if (memoryLedger.has(ledgerKey)) {
        return {
          ok: true,
          state: "granted",
          wallet: await getWallet(authContext),
          amount: value,
          duplicate: true,
        };
      }
      const wallet = await getWallet(authContext);
      const next = {
        balance: wallet.balance + value,
        consumed: wallet.consumed,
        reserved: wallet.reserved,
      };
      memoryWallets.set(key, next);
      memoryLedger.set(ledgerKey, {
        amount: value,
        operation,
        metadata,
        createdAt: new Date().toISOString(),
      });
      return {
        ok: true,
        state: "granted",
        wallet: publicWallet(next, true),
        amount: value,
      };
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const duplicate = await client.query(
        `SELECT id
         FROM audita_credit_ledger
         WHERE tenant_id = $1 AND reference_id = $2 AND entry_type = 'grant'
         LIMIT 1`,
        [authContext.tenantId, reference],
      );
      if (duplicate.rows[0]) {
        await client.query("COMMIT");
        return {
          ok: true,
          state: "granted",
          wallet: await getWallet(authContext),
          amount: value,
          duplicate: true,
        };
      }

      await client.query(
        `INSERT INTO audita_credit_wallets (tenant_id, balance)
         VALUES ($1, $2)
         ON CONFLICT (tenant_id) DO NOTHING`,
        [authContext.tenantId, integerEnv("AUDITA_INITIAL_CREDITS", 0)],
      );
      await client.query(
        `UPDATE audita_credit_wallets
         SET balance = balance + $2, updated_at = NOW()
         WHERE tenant_id = $1`,
        [authContext.tenantId, value],
      );
      await client.query(
        `INSERT INTO audita_credit_ledger (
           tenant_id, user_id, entry_type, amount, operation, reference_id, metadata
         ) VALUES ($1, $2, 'grant', $3, $4, $5, $6)`,
        [
          authContext.tenantId,
          authContext.user?.id || null,
          value,
          String(operation || "billing_grant"),
          reference,
          JSON.stringify(metadata || {}),
        ],
      );
      await client.query("COMMIT");
      return {
        ok: true,
        state: "granted",
        wallet: await getWallet(authContext),
        amount: value,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return { getWallet, consume, grant };
}
