-- Additive, private workflow state. Subject/provider payloads are AES-GCM encrypted.
CREATE TABLE IF NOT EXISTS audita_process_online_requests (
  id UUID PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES audita_tenants(id) ON DELETE RESTRICT,
  user_id BIGINT NOT NULL REFERENCES audita_users(id) ON DELETE RESTRICT,
  operation_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('search', 'copy')),
  mode TEXT NOT NULL CHECK (mode IN ('test', 'live')),
  status TEXT NOT NULL CHECK (status IN ('submitting', 'processing', 'ready', 'completed', 'failed', 'secret', 'expired', 'review_required')),
  request_hash TEXT NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  provider_request_id UUID UNIQUE,
  encrypted_payload TEXT NOT NULL,
  billing_state TEXT NOT NULL DEFAULT 'none' CHECK (billing_state IN ('none', 'debit_pending', 'charged', 'refund_pending', 'refunded')),
  error_code TEXT,
  refresh_claim UUID,
  claim_until TIMESTAMPTZ,
  refund_claim UUID,
  refund_claim_until TIMESTAMPTZ,
  analysis_status TEXT NOT NULL DEFAULT 'not_started',
  analysis_token UUID,
  analysis_updated_at TIMESTAMPTZ,
  analysis_payload JSONB,
  next_refresh_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id, operation_id)
);
CREATE INDEX IF NOT EXISTS audita_process_online_owner_idx
  ON audita_process_online_requests (tenant_id, user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audita_process_online_events (
  request_id UUID NOT NULL REFERENCES audita_process_online_requests(id) ON DELETE CASCADE,
  event TEXT NOT NULL CHECK (event IN ('request.completed', 'request.failed', 'request.secret')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (request_id, event)
);
