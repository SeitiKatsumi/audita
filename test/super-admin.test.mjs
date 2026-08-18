import assert from "node:assert/strict";
import test from "node:test";

import { createSuperAdminService } from "../services/super-admin.service.mjs";

test("super admin service rejects tenant admins", async () => {
  const service = createSuperAdminService();
  const result = await service.updateUser(
    { user: { id: "1", role: "admin" } },
    "2",
    { status: "suspended" },
  );
  assert.equal(result.forbidden, true);
});

test("super admin service prevents self-demotion or suspension", async () => {
  const service = createSuperAdminService();
  const result = await service.updateUser(
    { user: { id: "1", role: "super_admin" } },
    "1",
    { role: "member" },
  );
  assert.equal(result.invalid, true);
  assert.equal(result.reason, "cannot_modify_current_super_admin");
});

test("super admin service updates a fallback user", async () => {
  let update;
  const service = createSuperAdminService({
    getDb: () => ({ pool: null, dbReady: false }),
    updateFallbackUser: (id, changes) => {
      update = { id, changes };
      return { id, ...changes };
    },
  });
  const result = await service.updateUser(
    { user: { id: "1", role: "super_admin" } },
    "2",
    { status: "suspended", role: "analyst" },
  );
  assert.deepEqual(update, {
    id: "2",
    changes: { status: "suspended", role: "analyst" },
  });
  assert.equal(result.user.status, "suspended");
});
