CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
  api_key_secret_ref TEXT NOT NULL DEFAULT 'AUDITA_OPENAI_API_KEY',
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

CREATE TABLE IF NOT EXISTS audita_audits (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID UNIQUE,
  tenant_id BIGINT,
  requested_by_user_id BIGINT REFERENCES audita_users(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('cpf', 'cnpj')),
  tipo_documento TEXT,
  document_hash TEXT NOT NULL,
  documento_hash TEXT,
  document_masked TEXT NOT NULL,
  subject_name TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'pending', 'running', 'partial', 'manual_required', 'success', 'completed', 'failed', 'blocked')),
  score_nivel TEXT NOT NULL DEFAULT 'indefinido',
  score_motivos JSONB NOT NULL DEFAULT '[]'::jsonb,
  authorization_confirmed BOOLEAN NOT NULL DEFAULT false,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audita_audit_executions (
  id BIGSERIAL PRIMARY KEY,
  audit_id BIGINT NOT NULL REFERENCES audita_audits(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  fonte TEXT,
  source_name TEXT NOT NULL,
  category TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('api', 'manual_guided', 'restricted', 'collector')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'pending', 'running', 'manual_required', 'success', 'completed', 'failed', 'blocked', 'not_applicable', 'unavailable')),
  resultado TEXT NOT NULL DEFAULT 'indisponivel' CHECK (resultado IN ('nada_consta', 'consta', 'indisponivel', 'erro')),
  dados_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT NOT NULL,
  official_url TEXT,
  pdf_path TEXT,
  raw_text TEXT,
  error_message TEXT,
  missing_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  manual_instruction TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audita_audit_evidence (
  id BIGSERIAL PRIMARY KEY,
  audit_id BIGINT NOT NULL REFERENCES audita_audits(id) ON DELETE CASCADE,
  audit_execution_id BIGINT NOT NULL REFERENCES audita_audit_executions(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('summary', 'official_url', 'protocol', 'pdf', 'manual_step')),
  title TEXT NOT NULL,
  value TEXT,
  file_name TEXT,
  content_base64 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audita_credit_wallets (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL UNIQUE REFERENCES audita_tenants(id) ON DELETE RESTRICT,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  consumed INTEGER NOT NULL DEFAULT 0 CHECK (consumed >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audita_credit_ledger (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES audita_tenants(id) ON DELETE RESTRICT,
  user_id BIGINT REFERENCES audita_users(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('consume', 'grant', 'refund', 'reserve', 'release')),
  amount INTEGER NOT NULL,
  operation TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audita_api_pricing (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES audita_tenants(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  service TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  unit_name TEXT NOT NULL DEFAULT 'request',
  input_cost_per_million NUMERIC(20, 10) NOT NULL DEFAULT 0 CHECK (input_cost_per_million >= 0),
  cached_input_cost_per_million NUMERIC(20, 10) NOT NULL DEFAULT 0 CHECK (cached_input_cost_per_million >= 0),
  output_cost_per_million NUMERIC(20, 10) NOT NULL DEFAULT 0 CHECK (output_cost_per_million >= 0),
  request_cost NUMERIC(20, 10) NOT NULL DEFAULT 0 CHECK (request_cost >= 0),
  unit_cost NUMERIC(20, 10) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, provider, service, model)
);

CREATE TABLE IF NOT EXISTS audita_api_usage (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  tenant_id BIGINT NOT NULL REFERENCES audita_tenants(id) ON DELETE RESTRICT,
  user_id BIGINT REFERENCES audita_users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  service TEXT NOT NULL,
  operation TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'cancelled')),
  request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count >= 0),
  input_units BIGINT NOT NULL DEFAULT 0 CHECK (input_units >= 0),
  cached_input_units BIGINT NOT NULL DEFAULT 0 CHECK (cached_input_units >= 0),
  output_units BIGINT NOT NULL DEFAULT 0 CHECK (output_units >= 0),
  total_units BIGINT NOT NULL DEFAULT 0 CHECK (total_units >= 0),
  quantity NUMERIC(20, 6) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit_name TEXT NOT NULL DEFAULT 'request',
  currency TEXT NOT NULL DEFAULT 'USD',
  estimated_cost NUMERIC(20, 10),
  actual_cost NUMERIC(20, 10),
  priced BOOLEAN NOT NULL DEFAULT false,
  reference_id TEXT NOT NULL,
  pricing_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audita_property_searches (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  tenant_id BIGINT NOT NULL REFERENCES audita_tenants(id) ON DELETE RESTRICT,
  requested_by_user_id BIGINT REFERENCES audita_users(id) ON DELETE SET NULL,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('cpf', 'cnpj')),
  subject_hash TEXT NOT NULL,
  subject_masked TEXT NOT NULL,
  uf TEXT,
  operation TEXT NOT NULL CHECK (operation IN ('pesquisa_previa', 'pesquisa_qualificada', 'certidao_digital', 'indisponibilidade')),
  provider TEXT NOT NULL DEFAULT 'ONR / RI Digital',
  provider_mode TEXT NOT NULL CHECK (provider_mode IN ('api', 'official_manual')),
  status TEXT NOT NULL CHECK (status IN ('waiting_user_action', 'processing', 'completed', 'failed', 'cancelled', 'unavailable')),
  outcome TEXT NOT NULL CHECK (outcome IN ('pending', 'nothing_found', 'assets_found', 'restriction_found', 'inconclusive')),
  credit_cost INTEGER NOT NULL DEFAULT 0 CHECK (credit_cost >= 0),
  credit_state TEXT NOT NULL DEFAULT 'not_charged' CHECK (credit_state IN ('not_charged', 'reserved', 'consumed', 'refunded')),
  provider_order_id TEXT,
  request_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audita_property_evidence (
  id BIGSERIAL PRIMARY KEY,
  property_search_id BIGINT NOT NULL REFERENCES audita_property_searches(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('onr_report', 'qualified_report', 'certificate', 'protocol', 'note')),
  title TEXT NOT NULL,
  value TEXT,
  file_name TEXT,
  file_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  ALTER TABLE audita_property_searches
    DROP CONSTRAINT IF EXISTS audita_property_searches_provider_mode_check;
  ALTER TABLE audita_property_searches
    ADD CONSTRAINT audita_property_searches_provider_mode_check
    CHECK (provider_mode IN ('api', 'official_manual', 'credentialing_required'));
END $$;

CREATE TABLE IF NOT EXISTS audita_job_logs (
  id BIGSERIAL PRIMARY KEY,
  audit_query_id BIGINT REFERENCES audita_audits(id) ON DELETE CASCADE,
  fonte TEXT,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audita_sources ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
ALTER TABLE audita_audit_events ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
ALTER TABLE audita_reports ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
ALTER TABLE audita_app_events ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
ALTER TABLE audita_api_sources ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
ALTER TABLE audita_agent_settings ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
ALTER TABLE audita_consultation_requests ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
ALTER TABLE audita_audits ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
ALTER TABLE audita_audits ADD COLUMN IF NOT EXISTS public_id UUID;
ALTER TABLE audita_audits ADD COLUMN IF NOT EXISTS tipo_documento TEXT;
ALTER TABLE audita_audits ADD COLUMN IF NOT EXISTS documento_hash TEXT;
ALTER TABLE audita_audits ADD COLUMN IF NOT EXISTS score_nivel TEXT NOT NULL DEFAULT 'indefinido';
ALTER TABLE audita_audits ADD COLUMN IF NOT EXISTS score_motivos JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE audita_audit_executions ADD COLUMN IF NOT EXISTS fonte TEXT;
ALTER TABLE audita_audit_executions ADD COLUMN IF NOT EXISTS resultado TEXT NOT NULL DEFAULT 'indisponivel';
ALTER TABLE audita_audit_executions ADD COLUMN IF NOT EXISTS dados_json JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE audita_audit_executions ADD COLUMN IF NOT EXISTS pdf_path TEXT;
ALTER TABLE audita_audit_executions ADD COLUMN IF NOT EXISTS raw_text TEXT;
ALTER TABLE audita_audit_executions ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE audita_audit_executions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE audita_audit_executions ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

UPDATE audita_audits
SET public_id = gen_random_uuid()
WHERE public_id IS NULL;

UPDATE audita_audits
SET tipo_documento = document_type
WHERE tipo_documento IS NULL;

UPDATE audita_audits
SET documento_hash = document_hash
WHERE documento_hash IS NULL;

UPDATE audita_audit_executions
SET fonte = source_id
WHERE fonte IS NULL;

ALTER TABLE audita_audits DROP CONSTRAINT IF EXISTS audita_audits_status_check;
ALTER TABLE audita_audits
  ADD CONSTRAINT audita_audits_status_check
  CHECK (status IN ('queued', 'pending', 'running', 'partial', 'manual_required', 'success', 'completed', 'failed', 'blocked'));

ALTER TABLE audita_audit_executions DROP CONSTRAINT IF EXISTS audita_audit_executions_mode_check;
ALTER TABLE audita_audit_executions
  ADD CONSTRAINT audita_audit_executions_mode_check
  CHECK (mode IN ('api', 'manual_guided', 'restricted', 'collector'));

ALTER TABLE audita_audit_executions DROP CONSTRAINT IF EXISTS audita_audit_executions_status_check;
ALTER TABLE audita_audit_executions
  ADD CONSTRAINT audita_audit_executions_status_check
  CHECK (status IN ('queued', 'pending', 'running', 'manual_required', 'waiting_user_action', 'success', 'completed', 'failed', 'blocked', 'not_applicable', 'unavailable'));

ALTER TABLE audita_audit_executions DROP CONSTRAINT IF EXISTS audita_audit_executions_resultado_check;
ALTER TABLE audita_audit_executions
  ADD CONSTRAINT audita_audit_executions_resultado_check
  CHECK (resultado IN ('nada_consta', 'consta', 'indisponivel', 'erro'));

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

UPDATE audita_audits
SET tenant_id = (SELECT id FROM audita_tenants WHERE slug = 'elevenmind-staging')
WHERE tenant_id IS NULL;

ALTER TABLE audita_sources ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audita_audit_events ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audita_reports ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audita_app_events ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audita_api_sources ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audita_agent_settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audita_consultation_requests ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audita_audits ALTER COLUMN tenant_id SET NOT NULL;

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

DO $$
BEGIN
  ALTER TABLE audita_audits
    ADD CONSTRAINT audita_audits_tenant_fk
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
CREATE INDEX IF NOT EXISTS audita_audits_tenant_idx ON audita_audits(tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS audita_audits_public_id_idx ON audita_audits(public_id);
CREATE INDEX IF NOT EXISTS audita_audits_document_idx ON audita_audits(tenant_id, document_hash);
CREATE INDEX IF NOT EXISTS audita_audit_executions_audit_idx ON audita_audit_executions(audit_id, status);
CREATE INDEX IF NOT EXISTS audita_audit_evidence_audit_idx ON audita_audit_evidence(audit_id, audit_execution_id);
CREATE INDEX IF NOT EXISTS audita_job_logs_audit_idx ON audita_job_logs(audit_query_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audita_credit_ledger_tenant_idx ON audita_credit_ledger(tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS audita_credit_ledger_reference_idx ON audita_credit_ledger(tenant_id, reference_id, entry_type);
CREATE INDEX IF NOT EXISTS audita_api_pricing_tenant_idx ON audita_api_pricing(tenant_id, provider, active);
CREATE INDEX IF NOT EXISTS audita_api_usage_tenant_idx ON audita_api_usage(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audita_api_usage_user_idx ON audita_api_usage(tenant_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audita_api_usage_provider_idx ON audita_api_usage(tenant_id, provider, service, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS audita_api_usage_reference_idx ON audita_api_usage(tenant_id, provider, reference_id);
CREATE INDEX IF NOT EXISTS audita_property_searches_tenant_idx ON audita_property_searches(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audita_property_searches_subject_idx ON audita_property_searches(tenant_id, subject_hash);
CREATE INDEX IF NOT EXISTS audita_property_evidence_search_idx ON audita_property_evidence(property_search_id, created_at);

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
  ('imoveis-registro', 'Busca de Imoveis', 'imobiliario', 'ONR / RI Digital', 'hybrid', 'credential', 'sandbox', 'Pesquisa Previa, Pesquisa Qualificada e Certidao Digital com contingencia operacional oficial sem scraping.'),
  ('cnib-indisponibilidade-bens', 'Indisponibilidade de Bens', 'imobiliario', 'BigDataCorp', 'api', 'token', 'sandbox', 'Indicador de indisponibilidade de bens via provedor DaaS autorizado. Validar contrato/fonte antes de tratar como certidao oficial CNIB.'),
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
