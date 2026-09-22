CREATE TABLE IF NOT EXISTS audita_chat_customers (
  tenant_id BIGINT NOT NULL REFERENCES audita_tenants(id),
  user_id BIGINT NOT NULL REFERENCES audita_users(id),
  stripe_customer_id TEXT UNIQUE,
  customer_params JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  checkout_key TEXT,
  checkout_plan TEXT,
  checkout_params JSONB,
  checkout_session JSONB,
  PRIMARY KEY (tenant_id, user_id)
);
