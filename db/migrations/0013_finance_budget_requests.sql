CREATE TYPE finance.budget_request_status AS ENUM (
  'SUBMITTED',
  'APPROVED',
  'REJECTED'
);

CREATE TABLE IF NOT EXISTS finance.budget_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id uuid NOT NULL REFERENCES core.committees(id) ON DELETE CASCADE,
  title text NOT NULL,
  month date NOT NULL,
  currency varchar(3) NOT NULL,
  total_amount numeric(12, 2) NOT NULL,
  rationale text NOT NULL,
  lines jsonb NOT NULL,
  status finance.budget_request_status NOT NULL DEFAULT 'SUBMITTED',
  submitted_by uuid NOT NULL REFERENCES core.constituents(id) ON DELETE RESTRICT,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES core.constituents(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS budget_requests_committee_month_idx
  ON finance.budget_requests (committee_id, month);

CREATE INDEX IF NOT EXISTS budget_requests_status_idx
  ON finance.budget_requests (status);
