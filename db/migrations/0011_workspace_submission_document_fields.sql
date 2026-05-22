ALTER TABLE logs.workspace_monthly_submissions
ADD COLUMN IF NOT EXISTS document_name text,
ADD COLUMN IF NOT EXISTS document_url text;
