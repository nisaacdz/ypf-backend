-- Certificate types
CREATE TYPE activities.certificate_type AS ENUM ('COMPLETION', 'PARTICIPATION', 'ACHIEVEMENT', 'LEADERSHIP');
CREATE TYPE activities.certificate_status AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- Certificates table
CREATE TABLE IF NOT EXISTS activities.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_number TEXT NOT NULL UNIQUE DEFAULT 'YPFC-' || generate_alphanumeric_combination(8),
  constituent_id UUID NOT NULL REFERENCES core.constituents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  program_name TEXT NOT NULL,
  project_id UUID REFERENCES activities.projects(id) ON DELETE SET NULL,
  type activities.certificate_type NOT NULL DEFAULT 'COMPLETION',
  status activities.certificate_status NOT NULL DEFAULT 'ACTIVE',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  issued_by UUID REFERENCES core.constituents(id) ON DELETE SET NULL,
  description TEXT
);

-- Index for fast lookup by constituent
CREATE INDEX IF NOT EXISTS idx_certificates_constituent ON activities.certificates(constituent_id);
