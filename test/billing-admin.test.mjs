import assert from "node:assert/strict";
import test from "node:test";

import {
  createBillingAdminService,
  getCommercialOperations,
} from "../services/billing-admin.service.mjs";

test("billing admin exposes the suggested commercial model without fake customers", async () => {
  const service = createBillingAdminService({
    env: {},
    getDb: () => ({ pool: null, dbReady: false }),
  });

  const dashboard = await service.getDashboard();

  assert.equal(dashboard.databaseReady, false);
  assert.equal(dashboard.summary.activeSubscriptions, 0);
  assert.equal(dashboard.summary.mrr.cents, 0);
  assert.equal(dashboard.subscriptions.length, 0);
  assert.ok(dashboard.catalog.plans.some((plan) => plan.id === "standard"));
  assert.equal(dashboard.users.length, 0);
  assert.ok(dashboard.operations.some((operation) => operation.id === "state_certificate"));
  assert.equal(dashboard.configuration.stripeMode, "not_configured");
});

test("billing admin reports configured per-query credit costs", () => {
  const operations = getCommercialOperations({
    DIRECT_DATA_CERTIFICATE_ENABLED: "true",
    DIRECT_DATA_CERTIFICATE_CREDIT_COST: "3",
    DIRECT_DATA_TJ_CREDIT_COST: "2",
  });

  const certificate = operations.find(
    (operation) => operation.id === "state_certificate",
  );
  const monitoring = operations.find(
    (operation) => operation.id === "court_monitoring",
  );

  assert.equal(certificate.enabled, true);
  assert.equal(certificate.credits, 3);
  assert.equal(monitoring.credits, 2);
});

test("billing admin recognizes restricted live Stripe keys", async () => {
  const service = createBillingAdminService({
    env: {
      AUDITA_BILLING_ENABLED: "true",
      APP_URL: "https://audita.example",
      STRIPE_SECRET_KEY: "rk_live_example",
      STRIPE_WEBHOOK_SECRET: "whsec_example",
    },
    getDb: () => ({ pool: null, dbReady: false }),
  });

  const dashboard = await service.getDashboard();

  assert.equal(dashboard.configuration.stripeMode, "live");
});

test("billing admin calculates MRR from active monthly and annual subscriptions", async () => {
  const rowsByQuery = (sql) => {
    if (sql.includes("FROM audita_subscriptions")) {
      return {
        rows: [
          {
            provider_subscription_id: "sub_monthly",
            tenant_id: "1",
            tenant_name: "Cliente mensal",
            customer_email: "mensal@example.com",
            plan_id: "standard",
            billing_interval: "monthly",
            status: "active",
            monthly_credits: 0,
            credit_balance: 12,
            member_limit: 1,
          },
          {
            provider_subscription_id: "sub_annual",
            tenant_id: "2",
            tenant_name: "Cliente anual",
            customer_email: "anual@example.com",
            plan_id: "standard",
            billing_interval: "annual",
            status: "trialing",
            monthly_credits: 0,
            credit_balance: 80,
            member_limit: 3,
          },
          {
            provider_subscription_id: "sub_late",
            tenant_id: "3",
            tenant_name: "Cliente pendente",
            plan_id: "standard",
            billing_interval: "monthly",
            status: "past_due",
            monthly_credits: 0,
            member_limit: 10,
          },
        ],
      };
    }
    if (sql.includes("FROM audita_billing_events be")) return { rows: [] };
    if (sql.includes("SUM(balance)")) {
      return { rows: [{ outstanding_credits: 92 }] };
    }
    if (sql.includes("COUNT(*)")) return { rows: [{ total: 7 }] };
    throw new Error(`Unexpected query: ${sql}`);
  };
  const service = createBillingAdminService({
    env: {},
    getDb: () => ({
      dbReady: true,
      pool: { query: async (sql) => rowsByQuery(sql) },
    }),
  });

  const dashboard = await service.getDashboard();

  assert.equal(dashboard.summary.activeSubscriptions, 2);
  assert.equal(dashboard.summary.pastDueSubscriptions, 1);
  assert.equal(dashboard.summary.mrr.cents, 19900 + Math.round(118800 / 12));
  assert.equal(dashboard.summary.outstandingCredits, 92);
  assert.equal(dashboard.summary.processedEvents30d, 7);
});

test("billing admin reflects demo subscriptions in the local user list", async () => {
  const service = createBillingAdminService({
    env: { AUDITA_BILLING_DEMO_MODE: "true" },
    getDb: () => ({ pool: null, dbReady: false }),
    accessService: {
      listUsers: async () => [{
        id: "user-1",
        tenantId: "tenant-1",
        tenantName: "Local",
        name: "Tester",
        email: "tester@example.com",
      }],
    },
    getSubscription: async () => ({
      id: "demo:tenant-1",
      provider: "demo",
      planId: "standard",
      interval: "annual",
      status: "active",
    }),
  });

  const dashboard = await service.getDashboard({ tenantId: "tenant-1" });

  assert.equal(dashboard.users[0].subscription.provider, "demo");
  assert.equal(dashboard.subscriptions[0].planId, "standard");
  assert.equal(dashboard.summary.activeSubscriptions, 1);
  assert.equal(dashboard.summary.mrr.cents, Math.round(118800 / 12));
});
