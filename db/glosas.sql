CREATE TABLE IF NOT EXISTS audita_glosas (
 id UUID PRIMARY KEY,
 tenant_id BIGINT NOT NULL REFERENCES audita_tenants(id),
 user_id BIGINT NOT NULL REFERENCES audita_users(id),
 revision INTEGER NOT NULL DEFAULT 1,
 encrypted_payload TEXT NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audita_glosas_owner ON audita_glosas(tenant_id,user_id,updated_at);
CREATE TABLE IF NOT EXISTS audita_glosas_documents (
 id UUID PRIMARY KEY,
 case_id UUID NOT NULL REFERENCES audita_glosas(id) ON DELETE CASCADE,
 hash TEXT NOT NULL,
 size INTEGER NOT NULL CHECK(size > 0 AND size <= 10485760),
 pages INTEGER NOT NULL CHECK(pages >= 0 AND pages <= 20),
 encrypted_metadata TEXT NOT NULL,
 encrypted_file TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(case_id,hash)
);
