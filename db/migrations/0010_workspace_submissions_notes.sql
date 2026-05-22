DO $$ BEGIN
  CREATE TYPE logs.workspace_submission_kind AS ENUM ('PLAN', 'REPORT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE logs.workspace_note_entity_type AS ENUM ('program', 'event', 'workspace');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS logs.workspace_monthly_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id UUID NOT NULL REFERENCES core.committees(id) ON DELETE CASCADE,
  month TIMESTAMPTZ NOT NULL,
  kind logs.workspace_submission_kind NOT NULL,
  body TEXT NOT NULL,
  submitted_by UUID NOT NULL REFERENCES core.constituents(id) ON DELETE RESTRICT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (committee_id, month, kind)
);

CREATE INDEX IF NOT EXISTS idx_workspace_submissions_committee_month
  ON logs.workspace_monthly_submissions(committee_id, month);

CREATE TABLE IF NOT EXISTS logs.workspace_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id UUID NOT NULL REFERENCES core.committees(id) ON DELETE CASCADE,
  entity_type logs.workspace_note_entity_type NOT NULL,
  entity_id UUID,
  body TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES core.constituents(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workspace_notes_entity
  ON logs.workspace_notes(committee_id, entity_type, entity_id);
