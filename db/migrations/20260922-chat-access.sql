-- Apply after schema.sql; include this migration in the application's schema bootstrap.
CREATE TABLE IF NOT EXISTS audita_chat_accounts (
  tenant_id BIGINT NOT NULL REFERENCES audita_tenants(id),
  user_id BIGINT NOT NULL REFERENCES audita_users(id),
  trial_used BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS audita_chat_entitlements (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('chat-experiment','chat-essential','chat-professional','chat-premium')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL CHECK (period_end > period_start),
  payment_id TEXT NOT NULL,
  subscription_id TEXT,
  revoked_at TIMESTAMPTZ,
  FOREIGN KEY (tenant_id, user_id) REFERENCES audita_chat_accounts(tenant_id, user_id),
  UNIQUE (payment_id)
);
CREATE INDEX IF NOT EXISTS audita_chat_current_idx
  ON audita_chat_entitlements(tenant_id, user_id, period_start, period_end);

CREATE TABLE IF NOT EXISTS audita_chat_revocations (
  tenant_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('payment', 'subscription')),
  reference_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, user_id, kind, reference_id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES audita_chat_accounts(tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS audita_chat_reservations (
  tenant_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  request_id TEXT NOT NULL,
  entitlement_id BIGINT REFERENCES audita_chat_entitlements(id),
  kind TEXT NOT NULL CHECK (kind IN ('messages', 'pages')),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','completed','released')),
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, user_id, request_id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES audita_chat_accounts(tenant_id, user_id)
);
CREATE INDEX IF NOT EXISTS audita_chat_usage_idx
  ON audita_chat_reservations(entitlement_id, kind) WHERE status <> 'released';
