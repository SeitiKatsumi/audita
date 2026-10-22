CREATE TABLE IF NOT EXISTS audita_process_search_orders (
 id UUID PRIMARY KEY,
 tenant_id BIGINT NOT NULL REFERENCES audita_tenants(id) ON DELETE RESTRICT,
 user_id BIGINT NOT NULL REFERENCES audita_users(id) ON DELETE RESTRICT,
 operation_id UUID NOT NULL,
 fingerprint TEXT NOT NULL,
 encrypted_input TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK (amount_cents = 4990),
 provider_mode TEXT NOT NULL CHECK (provider_mode IN ('test','live')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','fulfilled','expired','failed')),
 checkout_session TEXT UNIQUE,
 checkout_url TEXT,
 request_id UUID REFERENCES audita_process_online_requests(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 paid_at TIMESTAMPTZ,
 UNIQUE(tenant_id,user_id,operation_id)
);

ALTER TABLE audita_process_search_orders ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'search' CHECK (kind IN ('search','copy'));
