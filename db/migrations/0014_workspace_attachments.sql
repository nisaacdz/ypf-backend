CREATE TABLE IF NOT EXISTS logs.workspace_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id UUID NOT NULL REFERENCES core.committees(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES logs.workspace_notes(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES core.documents(id) ON DELETE CASCADE,
  label TEXT,
  original_file_name TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES core.constituents(id) ON DELETE RESTRICT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workspace_attachments_note
  ON logs.workspace_attachments(committee_id, note_id);
