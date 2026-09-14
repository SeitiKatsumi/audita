CREATE TABLE IF NOT EXISTS audita_energy_cases (
 id UUID PRIMARY KEY, tenant_id BIGINT NOT NULL REFERENCES audita_tenants(id), user_id BIGINT NOT NULL REFERENCES audita_users(id),
 assigned_user_id BIGINT REFERENCES audita_users(id), queued BOOLEAN NOT NULL DEFAULT FALSE,
 status TEXT NOT NULL DEFAULT 'collecting', revision INTEGER NOT NULL DEFAULT 0, encrypted_payload TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS audita_energy_documents (
 id UUID PRIMARY KEY,case_id UUID NOT NULL REFERENCES audita_energy_cases(id), hash TEXT NOT NULL, type TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'queued',encrypted_payload TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(case_id,hash)
);
CREATE TABLE IF NOT EXISTS audita_energy_jobs (
 id UUID PRIMARY KEY,document_id UUID UNIQUE NOT NULL REFERENCES audita_energy_documents(id),state TEXT NOT NULL DEFAULT 'queued',attempts INTEGER NOT NULL DEFAULT 0,
 lease_until TIMESTAMPTZ,run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),error TEXT
);
CREATE TABLE IF NOT EXISTS audita_energy_events (
 id BIGSERIAL PRIMARY KEY,case_id UUID NOT NULL REFERENCES audita_energy_cases(id),actor_id BIGINT REFERENCES audita_users(id), internal BOOLEAN NOT NULL DEFAULT FALSE,
 encrypted_payload TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS audita_energy_references (
 kind TEXT PRIMARY KEY,payload JSONB NOT NULL, fetched_at TIMESTAMPTZ, error TEXT, next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audita_energy_owner ON audita_energy_cases(tenant_id,user_id);
CREATE INDEX IF NOT EXISTS audita_energy_due ON audita_energy_jobs(state,run_at);

CREATE TABLE IF NOT EXISTS audita_energy_versions (
 case_id UUID NOT NULL REFERENCES audita_energy_cases(id), revision INTEGER NOT NULL, encrypted_payload TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(case_id,revision)
);
ALTER TABLE audita_energy_references ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE audita_energy_references ALTER COLUMN fetched_at DROP NOT NULL;

CREATE TABLE IF NOT EXISTS audita_energy_document_versions (
 id BIGSERIAL PRIMARY KEY,document_id UUID NOT NULL REFERENCES audita_energy_documents(id),
 encrypted_payload TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
