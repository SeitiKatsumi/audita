-- Apply after schema.sql; never execute DDL from a document request.
CREATE TABLE IF NOT EXISTS audita_chat_documents (
  id UUID PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES audita_tenants(id),
  user_id BIGINT NOT NULL REFERENCES audita_users(id),
  pages INTEGER NOT NULL CHECK (pages >= 1),
  encrypted_payload TEXT NOT NULL,
  encrypted_file TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audita_chat_documents_owner
  ON audita_chat_documents(tenant_id,user_id);
-- Upgrade existing installations without changing their encrypted documents.
ALTER TABLE audita_chat_documents DROP CONSTRAINT IF EXISTS audita_chat_documents_pages_check;
ALTER TABLE audita_chat_documents ADD CONSTRAINT audita_chat_documents_pages_check CHECK (pages >= 1);
