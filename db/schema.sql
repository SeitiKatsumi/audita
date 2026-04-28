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
  role TEXT NOT NULL DEFAULT 'member',
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audita_users DROP CONSTRAINT IF EXISTS audita_users_role_check;
ALTER TABLE audita_users
  ADD CONSTRAINT audita_users_role_check
  CHECK (role IN ('super_admin', 'owner', 'admin', 'analyst', 'member'));

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

CREATE TABLE IF NOT EXISTS audita_government_modules (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  provider TEXT NOT NULL,
  access_method TEXT NOT NULL CHECK (access_method IN ('api', 'scraping', 'manual', 'hybrid')),
  auth_type TEXT NOT NULL DEFAULT 'none',
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'sandbox', 'active', 'paused')),
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audita_api_sources (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT,
  name TEXT NOT NULL,
  agency TEXT NOT NULL,
  category TEXT NOT NULL,
  base_url TEXT NOT NULL,
  access_method TEXT NOT NULL CHECK (access_method IN ('api', 'scraping', 'manual', 'hybrid')),
  auth_type TEXT NOT NULL DEFAULT 'none',
  secret_ref TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'testing', 'active', 'paused')),
  normalization_status TEXT NOT NULL DEFAULT 'pending' CHECK (normalization_status IN ('pending', 'mapped', 'validated')),
  schema_notes TEXT,
  created_by_user_id BIGINT REFERENCES audita_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audita_agent_settings (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT,
  provider TEXT NOT NULL DEFAULT 'openai',
  model TEXT NOT NULL DEFAULT 'gpt-5-mini',
  api_key_secret_ref TEXT NOT NULL DEFAULT 'OPENAI_API_KEY',
  system_prompt TEXT NOT NULL DEFAULT 'Voce e o Agente Audita. Responda de forma clara, objetiva, humanizada e sempre cite a fonte dos dados consultados.',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'testing', 'active', 'paused')),
  created_by_user_id BIGINT REFERENCES audita_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audita_consultation_requests (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT,
  module_id BIGINT NOT NULL REFERENCES audita_government_modules(id) ON DELETE RESTRICT,
  requested_by_user_id BIGINT REFERENCES audita_users(id) ON DELETE SET NULL,
  subject_type TEXT NOT NULL,
  subject_identifier_hash TEXT NOT NULL,
  subject_identifier_masked TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'blocked')),
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE audita_sources ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
ALTER TABLE audita_audit_events ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
ALTER TABLE audita_reports ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
ALTER TABLE audita_app_events ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
ALTER TABLE audita_api_sources ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
ALTER TABLE audita_agent_settings ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
ALTER TABLE audita_consultation_requests ADD COLUMN IF NOT EXISTS tenant_id BIGINT;

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

UPDATE audita_api_sources
SET tenant_id = (SELECT id FROM audita_tenants WHERE slug = 'elevenmind-staging')
WHERE tenant_id IS NULL;

UPDATE audita_agent_settings
SET tenant_id = (SELECT id FROM audita_tenants WHERE slug = 'elevenmind-staging')
WHERE tenant_id IS NULL;

UPDATE audita_consultation_requests
SET tenant_id = (SELECT id FROM audita_tenants WHERE slug = 'elevenmind-staging')
WHERE tenant_id IS NULL;

ALTER TABLE audita_sources ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audita_audit_events ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audita_reports ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audita_app_events ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audita_api_sources ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audita_agent_settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audita_consultation_requests ALTER COLUMN tenant_id SET NOT NULL;

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

DO $$
BEGIN
  ALTER TABLE audita_consultation_requests
    ADD CONSTRAINT audita_consultation_requests_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES audita_tenants(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE audita_api_sources
    ADD CONSTRAINT audita_api_sources_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES audita_tenants(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE audita_agent_settings
    ADD CONSTRAINT audita_agent_settings_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES audita_tenants(id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS audita_sources_tenant_idx ON audita_sources(tenant_id);
CREATE INDEX IF NOT EXISTS audita_audit_events_tenant_idx ON audita_audit_events(tenant_id, status, severity);
CREATE INDEX IF NOT EXISTS audita_reports_tenant_idx ON audita_reports(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audita_sessions_token_hash_idx ON audita_sessions(token_hash);
CREATE INDEX IF NOT EXISTS audita_consultation_requests_tenant_idx ON audita_consultation_requests(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audita_consultation_requests_subject_idx ON audita_consultation_requests(tenant_id, subject_identifier_hash);
CREATE INDEX IF NOT EXISTS audita_api_sources_tenant_idx ON audita_api_sources(tenant_id, status, category);
CREATE INDEX IF NOT EXISTS audita_agent_settings_tenant_idx ON audita_agent_settings(tenant_id, status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audita_api_sources_tenant_name_unique'
  ) THEN
    ALTER TABLE audita_api_sources
      ADD CONSTRAINT audita_api_sources_tenant_name_unique UNIQUE (tenant_id, name);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audita_agent_settings_tenant_provider_unique'
  ) THEN
    ALTER TABLE audita_agent_settings
      ADD CONSTRAINT audita_agent_settings_tenant_provider_unique UNIQUE (tenant_id, provider);
  END IF;
END $$;

INSERT INTO audita_government_modules (slug, name, category, provider, access_method, auth_type, status, description)
VALUES
  ('receita-cnpj', 'Consulta CNPJ Receita Federal', 'fiscal', 'Receita Federal', 'api', 'certificate_or_token', 'planned', 'Consulta cadastral e fiscal de pessoa juridica quando houver credencial autorizada.'),
  ('cnj-processos', 'Consulta Processual CNJ/Tribunais', 'judicial', 'CNJ e tribunais', 'hybrid', 'token_or_public', 'planned', 'Consulta e acompanhamento de processos judiciais em fontes oficiais.'),
  ('cadin', 'Consulta CADIN', 'fiscal', 'Governo Federal', 'api', 'token', 'planned', 'Verificacao de pendencias e registros restritivos quando houver permissao legal.'),
  ('imoveis-registro', 'Registro Imobiliario', 'imobiliario', 'Registradores e cartorios', 'hybrid', 'credential', 'planned', 'Consulta de matriculas, pendencias e situacao documental de imoveis.'),
  ('diarios-oficiais', 'Diarios Oficiais', 'juridico', 'Fontes oficiais', 'scraping', 'none', 'sandbox', 'Monitoramento de publicacoes oficiais e mencoes relevantes.')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  provider = EXCLUDED.provider,
  access_method = EXCLUDED.access_method,
  auth_type = EXCLUDED.auth_type,
  status = EXCLUDED.status,
  description = EXCLUDED.description;

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
