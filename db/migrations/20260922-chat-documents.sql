-- Apply after schema.sql; never execute DDL from a document request.
CREATE TABLE IF NOT EXISTS audita_chat_documents (
  id UUID PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES audita_tenants(id),
  user_id BIGINT NOT NULL REFERENCES audita_users(id),
  pages INTEGER NOT NULL CHECK (pages BETWEEN 1 AND 20),
  encrypted_payload TEXT NOT NULL,
  encrypted_file TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audita_chat_documents_owner
  ON audita_chat_documents(tenant_id,user_id);
