CREATE TABLE IF NOT EXISTS audita_tenants (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audita_users (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES audita_tenants(id) ON DELETE RESTRICT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'analyst', 'member')),
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audita_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES audita_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO audita_tenants (name, slug)
VALUES ('Elevenmind Staging', 'elevenmind-staging')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS audita_sources (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audita_audit_events (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  source_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audita_reports (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audita_app_events (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audita_sources ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
ALTER TABLE audita_audit_events ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
ALTER TABLE audita_reports ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
ALTER TABLE audita_app_events ADD COLUMN IF NOT EXISTS tenant_id BIGINT;

UPDATE audita_sources
SET tenant_id = (SELECT id FROM audita_tenants WHERE slug = 'elevenmind-staging')
WHERE tenant_id IS NULL;

UPDATE audita_audit_events
SET tenant_id = (SELECT id FROM audita_tenants WHERE slug = 'elevenmind-staging')
WHERE tenant_id IS NULL;

UPDATE audita_reports
SET tenant_id = (SELECT id FROM audita_tenants WHERE slug = 'elevenmind-staging')
WHERE tenant_id IS NULL;

UPDATE audita_app_events
SET tenant_id = (SELECT id FROM audita_tenants WHERE slug = 'elevenmind-staging')
WHERE tenant_id IS NULL;

ALTER TABLE audita_sources ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audita_audit_events ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audita_reports ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audita_app_events ALTER COLUMN tenant_id SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE audita_sources
    ADD CONSTRAINT audita_sources_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES audita_tenants(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE audita_audit_events
    ADD CONSTRAINT audita_audit_events_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES audita_tenants(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE audita_reports
    ADD CONSTRAINT audita_reports_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES audita_tenants(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE audita_app_events
    ADD CONSTRAINT audita_app_events_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES audita_tenants(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS audita_sources_tenant_idx ON audita_sources(tenant_id);
CREATE INDEX IF NOT EXISTS audita_audit_events_tenant_idx ON audita_audit_events(tenant_id, status, severity);
CREATE INDEX IF NOT EXISTS audita_reports_tenant_idx ON audita_reports(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audita_sessions_token_hash_idx ON audita_sessions(token_hash);

INSERT INTO audita_sources (tenant_id, name, category, status, last_sync_at)
SELECT (SELECT id FROM audita_tenants WHERE slug = 'elevenmind-staging'), *
FROM (
  VALUES
    ('Tribunais', 'judicial', 'active', NOW() - INTERVAL '14 minutes'),
    ('Receita e fiscal', 'fiscal', 'active', NOW() - INTERVAL '8 minutes'),
    ('Registro imobiliario', 'imobiliario', 'active', NOW() - INTERVAL '27 minutes'),
    ('APIs externas', 'integracao', 'active', NOW() - INTERVAL '4 minutes')
) AS seed(name, category, status, last_sync_at)
WHERE NOT EXISTS (
  SELECT 1
  FROM audita_sources
  WHERE tenant_id = (SELECT id FROM audita_tenants WHERE slug = 'elevenmind-staging')
);

INSERT INTO audita_audit_events (tenant_id, title, description, severity, source_name)
SELECT (SELECT id FROM audita_tenants WHERE slug = 'elevenmind-staging'), *
FROM (
  VALUES
    ('Inconsistencia fiscal recorrente', 'Cliente ACME | 2 fontes divergentes', 'high', 'Receita e fiscal'),
    ('Processo judicial com mudanca recente', 'Atualizacao detectada ha poucos minutos', 'medium', 'Tribunais'),
    ('Imovel com pendencia documental', 'Recomendacao pronta para revisao', 'low', 'Registro imobiliario')
) AS seed(title, description, severity, source_name)
WHERE NOT EXISTS (
  SELECT 1
  FROM audita_audit_events
  WHERE tenant_id = (SELECT id FROM audita_tenants WHERE slug = 'elevenmind-staging')
);

INSERT INTO audita_reports (tenant_id, title, summary, status)
SELECT (SELECT id FROM audita_tenants WHERE slug = 'elevenmind-staging'),
       'Resumo executivo inicial',
       '9 alertas consolidados, 3 prioridades criticas, 4 fontes verificadas e recomendacao de revisao fiscal imediata.',
       'draft'
WHERE NOT EXISTS (
  SELECT 1
  FROM audita_reports
  WHERE tenant_id = (SELECT id FROM audita_tenants WHERE slug = 'elevenmind-staging')
);
