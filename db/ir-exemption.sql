CREATE TABLE IF NOT EXISTS audita_ir_staff (
  user_id BIGINT PRIMARY KEY REFERENCES audita_users(id),
  role TEXT NOT NULL CHECK (role IN ('manager', 'lawyer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS audita_ir_cases (
  id UUID PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES audita_tenants(id),
  user_id BIGINT NOT NULL REFERENCES audita_users(id),
  assigned_user_id BIGINT REFERENCES audita_users(id),
  status TEXT NOT NULL DEFAULT 'triage',
  revision INTEGER NOT NULL DEFAULT 1,
  encrypted_payload TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audita_ir_cases_owner ON audita_ir_cases(tenant_id,user_id);
CREATE INDEX IF NOT EXISTS audita_ir_cases_assigned ON audita_ir_cases(assigned_user_id);
CREATE TABLE IF NOT EXISTS audita_ir_documents (
  id UUID PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES audita_ir_cases(id),
  encrypted_payload TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS audita_ir_proposals (
  id UUID PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES audita_ir_cases(id),
  version INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('adm','ouro')),
  amount_cents BIGINT NOT NULL CHECK(amount_cents > 0),
  state TEXT NOT NULL DEFAULT 'published',
  encrypted_payload TEXT NOT NULL,
  checkout_id TEXT UNIQUE,
  checkout_url TEXT,
  checkout_expires_at TIMESTAMPTZ,
  checkout_attempt INTEGER NOT NULL DEFAULT 1,
  accepted_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(case_id,version)
);
CREATE TABLE IF NOT EXISTS audita_ir_events (
  id UUID PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES audita_ir_cases(id),
  actor_id BIGINT REFERENCES audita_users(id),
  kind TEXT NOT NULL,
  internal BOOLEAN NOT NULL DEFAULT FALSE,
  dedupe_key TEXT UNIQUE,
  encrypted_payload TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audita_ir_events_case ON audita_ir_events(case_id,created_at);
CREATE TABLE IF NOT EXISTS audita_ir_jobs (
  id UUID PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES audita_ir_cases(id),
  protocol_id UUID NOT NULL UNIQUE,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_until TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audita_ir_jobs_due ON audita_ir_jobs(run_at);
