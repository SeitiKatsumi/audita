import assert from "node:assert/strict";
import test from "node:test";

import { createCreditsService } from "../services/credits.service.mjs";

const AUTH = {
  tenantId: "billing-test-tenant",
  user: { id: "billing-test-user" },
};

test("credit grants are positive and idempotent by tenant and reference", async () => {
  const previousEnabled = process.env.AUDITA_CREDITS_ENABLED;
  const previousInitial = process.env.AUDITA_INITIAL_CREDITS;
  process.env.AUDITA_CREDITS_ENABLED = "true";
  process.env.AUDITA_INITIAL_CREDITS = "0";
  try {
    const service = createCreditsService();
    const first = await service.grant(AUTH, {
      amount: 100,
      referenceId: "stripe:invoice:test-1",
      operation: "stripe_subscription_allowance",
    });
    const duplicate = await service.grant(AUTH, {
      amount: 100,
      referenceId: "stripe:invoice:test-1",
      operation: "stripe_subscription_allowance",
    });

    assert.equal(first.state, "granted");
    assert.equal(first.wallet.balance, 100);
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.wallet.balance, 100);
  } finally {
    if (previousEnabled === undefined) delete process.env.AUDITA_CREDITS_ENABLED;
    else process.env.AUDITA_CREDITS_ENABLED = previousEnabled;
    if (previousInitial === undefined) delete process.env.AUDITA_INITIAL_CREDITS;
    else process.env.AUDITA_INITIAL_CREDITS = previousInitial;
  }
});

test("disabled credit accounting never mutates a wallet", async () => {
  const previousEnabled = process.env.AUDITA_CREDITS_ENABLED;
  process.env.AUDITA_CREDITS_ENABLED = "false";
  try {
    const service = createCreditsService();
    const result = await service.grant(AUTH, {
      amount: 25,
      referenceId: "manual:test",
      operation: "test",
    });

    assert.equal(result.state, "not_granted");
    assert.equal(result.wallet.enabled, false);
    assert.equal(result.wallet.balance, 0);
  } finally {
    if (previousEnabled === undefined) delete process.env.AUDITA_CREDITS_ENABLED;
    else process.env.AUDITA_CREDITS_ENABLED = previousEnabled;
  }
});
