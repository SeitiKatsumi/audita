CREATE TABLE IF NOT EXISTS audita_pis_cases (
  id UUID PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES audita_tenants(id),
  user_id BIGINT NOT NULL REFERENCES audita_users(id),
  assigned_user_id BIGINT REFERENCES audita_users(id),
  status TEXT NOT NULL DEFAULT 'triage' CHECK(status IN ('triage','assistance','ready','queued','review','preparation','filed','requirement','decision','received','closed')),
  revision INTEGER NOT NULL DEFAULT 1,
  encrypted_payload TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audita_pis_owner ON audita_pis_cases(tenant_id,user_id);
CREATE INDEX IF NOT EXISTS audita_pis_queue ON audita_pis_cases(status,assigned_user_id);
CREATE TABLE IF NOT EXISTS audita_pis_documents (
  id UUID PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES audita_pis_cases(id),
  encrypted_payload TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audita_pis_documents_case ON audita_pis_documents(case_id);
CREATE TABLE IF NOT EXISTS audita_pis_events (
  id BIGSERIAL PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES audita_pis_cases(id),
  actor_id BIGINT NOT NULL REFERENCES audita_users(id),
  internal BOOLEAN NOT NULL DEFAULT FALSE,
  kind TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audita_pis_events_case ON audita_pis_events(case_id,id);
