-- ============================================================================
-- YPF Africa migration: schema additions for public-site cutover
-- (Plan §7 — schema migration applied as part of the ypf-africa Supabase removal)
-- ============================================================================

-- ---- Constituents / membership --------------------------------------------
ALTER TABLE core.constituents
  ADD COLUMN IF NOT EXISTS mission_pillars text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE core.membership_applications
  ADD COLUMN IF NOT EXISTS consents jsonb;

-- ---- Volunteer applications -----------------------------------------------
ALTER TABLE core.volunteer_applications
  ADD COLUMN IF NOT EXISTS experience   text,
  ADD COLUMN IF NOT EXISTS availability text,
  ADD COLUMN IF NOT EXISTS consents     jsonb;

-- ---- Donations ------------------------------------------------------------
ALTER TABLE finance.donations
  ADD COLUMN IF NOT EXISTS guest_phone text,
  ADD COLUMN IF NOT EXISTS note        text;

-- ---- Orders ---------------------------------------------------------------
ALTER TABLE shop.orders
  ADD COLUMN IF NOT EXISTS note text;
-- shop.orders.delivery_address (jsonb) already exists — start populating it.

-- ---- Products -------------------------------------------------------------
ALTER TABLE shop.products
  ADD COLUMN IF NOT EXISTS category          text,
  ADD COLUMN IF NOT EXISTS long_description  text,
  ADD COLUMN IF NOT EXISTS attributes        jsonb;

-- ---- Projects -------------------------------------------------------------
ALTER TABLE activities.projects
  ADD COLUMN IF NOT EXISTS location   text,
  ADD COLUMN IF NOT EXISTS objectives jsonb,
  ADD COLUMN IF NOT EXISTS impact     text;

-- ---- Events ---------------------------------------------------------------
ALTER TABLE activities.events
  ADD COLUMN IF NOT EXISTS description text;

-- ---- Project enrollments: dual-mode (guest + authenticated) ---------------
ALTER TABLE activities.project_enrollments
  ALTER COLUMN constituent_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS guest_name    text,
  ADD COLUMN IF NOT EXISTS guest_email   citext,
  ADD COLUMN IF NOT EXISTS guest_phone   text,
  ADD COLUMN IF NOT EXISTS guest_profile jsonb;

CREATE INDEX IF NOT EXISTS project_enrollments_guest_email_idx
  ON activities.project_enrollments (guest_email);

-- Handler enforces: coalesce(constituent_id, guest_email) IS NOT NULL

-- ---- Event attendees: dual-mode (guest + authenticated) -------------------
ALTER TABLE activities.event_attendees
  ALTER COLUMN constituent_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS guest_name  text,
  ADD COLUMN IF NOT EXISTS guest_email citext,
  ADD COLUMN IF NOT EXISTS guest_phone text;

CREATE INDEX IF NOT EXISTS event_attendees_guest_email_idx
  ON activities.event_attendees (guest_email);

-- ---- Contact submissions --------------------------------------------------
CREATE TABLE IF NOT EXISTS app.contact_submissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  email       citext NOT NULL,
  subject     text NOT NULL,
  message     text NOT NULL,
  status      text NOT NULL DEFAULT 'NEW',  -- NEW | READ | REPLIED | SPAM
  source_ip   inet,
  created_at  timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES core.constituents(id) ON DELETE SET NULL,
  reviewed_at timestamptz
);

CREATE INDEX IF NOT EXISTS contact_submissions_status_created_idx
  ON app.contact_submissions (status, created_at DESC);
