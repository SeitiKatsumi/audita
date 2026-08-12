import assert from "node:assert/strict";
import test from "node:test";

import { createBillingAccessService } from "../services/billing-access.service.mjs";

const OWNER = {
  tenantId: "tenant-1",
  user: { id: "owner-1", role: "owner" },
};
const MEMBER = {
  tenantId: "tenant-1",
  user: { id: "member-1", role: "member" },
};

function fallbackUsers() {
  return [
    { id: "owner-1", tenant_id: "tenant-1", name: "Owner", email: "owner@example.com", role: "owner" },
    { id: "member-1", tenant_id: "tenant-1", name: "Member", email: "member@example.com", role: "member" },
    { id: "other-1", tenant_id: "tenant-2", name: "Other", email: "other@example.com", role: "owner" },
  ];
}

test("active Standard subscription grants access and annual legal support", async () => {
  const service = createBillingAccessService();
  const access = await service.getEntitlement(MEMBER, {
    planId: "standard",
    interval: "annual",
    status: "active",
  });
  assert.equal(access.entitled, true);
  assert.equal(access.source, "subscription");
  assert.equal(access.annualItauLegalSupport, true);
});

test("past due subscription does not grant protected analysis access", async () => {
  const service = createBillingAccessService();
  const access = await service.getEntitlement(MEMBER, {
    planId: "standard",
    interval: "monthly",
    status: "past_due",
  });
  assert.equal(access.entitled, false);
});

test("tenant owner can grant and revoke tester access for a member", async () => {
  const service = createBillingAccessService({ listFallbackUsers: fallbackUsers });
  const granted = await service.setTesterGrant(OWNER, "member-1", { action: "grant" });
  assert.equal(granted.grant.status, "active");
  assert.equal((await service.getEntitlement(MEMBER)).source, "tester");

  const revoked = await service.setTesterGrant(OWNER, "member-1", { action: "revoke" });
  assert.equal(revoked.grant.status, "revoked");
  assert.equal((await service.getEntitlement(MEMBER)).entitled, false);
});

test("tenant owner cannot grant access to a user from another tenant", async () => {
  const service = createBillingAccessService({ listFallbackUsers: fallbackUsers });
  const result = await service.setTesterGrant(OWNER, "other-1", { action: "grant" });
  assert.equal(result.forbidden, true);
});

test("member can activate only their own Standard demo access", async () => {
  const service = createBillingAccessService({
    listFallbackUsers: fallbackUsers,
    now: () => Date.UTC(2026, 7, 12),
  });

  const result = await service.grantOwnDemoAccess(MEMBER, { interval: "monthly" });
  const access = await service.getEntitlement(MEMBER);

  assert.equal(result.grant.userId, "member-1");
  assert.equal(result.grant.tenantId, "tenant-1");
  assert.equal(result.grant.accessType, "tester");
  assert.equal(result.grant.expiresAt, "2026-09-12T00:00:00.000Z");
  assert.equal(access.entitled, true);
  assert.equal(access.source, "tester");
});

test("member cannot activate demo access without a supported interval", async () => {
  const service = createBillingAccessService({ listFallbackUsers: fallbackUsers });
  const result = await service.grantOwnDemoAccess(MEMBER, { interval: "weekly" });
  assert.equal(result.invalid, true);
  assert.equal((await service.getEntitlement(MEMBER)).entitled, false);
});
