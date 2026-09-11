CREATE TABLE IF NOT EXISTS audita_debt_cases (
  id UUID PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES audita_tenants(id),
  user_id BIGINT NOT NULL REFERENCES audita_users(id),
  revision INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'triage',
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audita_debt_owner ON audita_debt_cases(tenant_id,user_id,updated_at);
CREATE TABLE IF NOT EXISTS audita_debt_documents (
  id UUID PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES audita_debt_cases(id),
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes BYTEA NOT NULL,
  sha256 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audita_debt_documents_case ON audita_debt_documents(case_id);
CREATE TABLE IF NOT EXISTS audita_debt_events (
  id TEXT PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES audita_debt_cases(id),
  actor_id BIGINT,
  kind TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
