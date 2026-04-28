CREATE TABLE IF NOT EXISTS audita_sources (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audita_audit_events (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  source_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audita_reports (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audita_app_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO audita_sources (name, category, status, last_sync_at)
SELECT *
FROM (
  VALUES
    ('Tribunais', 'judicial', 'active', NOW() - INTERVAL '14 minutes'),
    ('Receita e fiscal', 'fiscal', 'active', NOW() - INTERVAL '8 minutes'),
    ('Registro imobiliario', 'imobiliario', 'active', NOW() - INTERVAL '27 minutes'),
    ('APIs externas', 'integracao', 'active', NOW() - INTERVAL '4 minutes')
) AS seed(name, category, status, last_sync_at)
WHERE NOT EXISTS (SELECT 1 FROM audita_sources);

INSERT INTO audita_audit_events (title, description, severity, source_name)
SELECT *
FROM (
  VALUES
    ('Inconsistencia fiscal recorrente', 'Cliente ACME | 2 fontes divergentes', 'high', 'Receita e fiscal'),
    ('Processo judicial com mudanca recente', 'Atualizacao detectada ha poucos minutos', 'medium', 'Tribunais'),
    ('Imovel com pendencia documental', 'Recomendacao pronta para revisao', 'low', 'Registro imobiliario')
) AS seed(title, description, severity, source_name)
WHERE NOT EXISTS (SELECT 1 FROM audita_audit_events);

INSERT INTO audita_reports (title, summary, status)
SELECT 'Resumo executivo inicial',
       '9 alertas consolidados, 3 prioridades criticas, 4 fontes verificadas e recomendacao de revisao fiscal imediata.',
       'draft'
WHERE NOT EXISTS (SELECT 1 FROM audita_reports);
