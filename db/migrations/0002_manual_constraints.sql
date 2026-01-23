-- Custom migration: Manual constraints and triggers

-- 1. Ensure extensions
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Exclusion Constraints

-- core.members
ALTER TABLE core.members DROP CONSTRAINT IF EXISTS no_overlapping_membership_periods;
ALTER TABLE core.members
  ADD CONSTRAINT no_overlapping_membership_periods
  EXCLUDE USING gist (
    constituent_id WITH =,
    tstzrange(started_at, COALESCE(ended_at, 'infinity'::timestamp with time zone)) WITH &&
  );

-- core.volunteers
ALTER TABLE core.volunteers DROP CONSTRAINT IF EXISTS no_overlapping_volunteer_periods;
ALTER TABLE core.volunteers
  ADD CONSTRAINT no_overlapping_volunteer_periods
  EXCLUDE USING gist (
    constituent_id WITH =,
    tstzrange(started_at, COALESCE(ended_at, 'infinity'::timestamp with time zone)) WITH &&
  );

-- core.auditors
ALTER TABLE core.auditors DROP CONSTRAINT IF EXISTS no_overlapping_auditor_periods;
ALTER TABLE core.auditors
  ADD CONSTRAINT no_overlapping_auditor_periods
  EXCLUDE USING gist (
    constituent_id WITH =,
    tstzrange(started_at, COALESCE(ended_at, 'infinity'::timestamp with time zone)) WITH &&
  );

-- core.admins
ALTER TABLE core.admins DROP CONSTRAINT IF EXISTS no_overlapping_admin_periods;
ALTER TABLE core.admins
  ADD CONSTRAINT no_overlapping_admin_periods
  EXCLUDE USING gist (
    constituent_id WITH =,
    tstzrange(started_at, COALESCE(ended_at, 'infinity'::timestamp with time zone)) WITH &&
  );

-- core.directors
ALTER TABLE core.directors DROP CONSTRAINT IF EXISTS no_overlapping_director_periods;
ALTER TABLE core.directors
  ADD CONSTRAINT no_overlapping_director_periods
  EXCLUDE USING gist (
    constituent_id WITH =,
    tstzrange(started_at, COALESCE(ended_at, 'infinity'::timestamp with time zone)) WITH &&
  );

-- core.chapter_memberships
ALTER TABLE core.chapter_memberships DROP CONSTRAINT IF EXISTS no_overlapping_chapter_memberships;
ALTER TABLE core.chapter_memberships
  ADD CONSTRAINT no_overlapping_chapter_memberships
  EXCLUDE USING gist (
    member_id WITH =,
    chapter_id WITH =,
    tstzrange(started_at, COALESCE(ended_at, 'infinity'::timestamp with time zone)) WITH &&
  );

-- core.committee_memberships
ALTER TABLE core.committee_memberships DROP CONSTRAINT IF EXISTS no_overlapping_committee_memberships;
ALTER TABLE core.committee_memberships
  ADD CONSTRAINT no_overlapping_committee_memberships
  EXCLUDE USING gist (
    member_id WITH =,
    committee_id WITH =,
    tstzrange(started_at, COALESCE(ended_at, 'infinity'::timestamp with time zone)) WITH &&
  );

-- core.member_titles_assignments
ALTER TABLE core.member_titles_assignments DROP CONSTRAINT IF EXISTS no_overlapping_title_assignments;
ALTER TABLE core.member_titles_assignments
  ADD CONSTRAINT no_overlapping_title_assignments
  EXCLUDE USING gist (
    member_id WITH =,
    title_id WITH =,
    tstzrange(started_at, COALESCE(ended_at, 'infinity'::timestamp with time zone)) WITH &&
  );

-- core.admin_roles_assignments
ALTER TABLE core.admin_roles_assignments DROP CONSTRAINT IF EXISTS no_overlapping_admin_role_assignments;
ALTER TABLE core.admin_roles_assignments
  ADD CONSTRAINT no_overlapping_admin_role_assignments
  EXCLUDE USING gist (
    admin_id WITH =,
    role WITH =,
    tstzrange(started_at, COALESCE(ended_at, 'infinity'::timestamp with time zone)) WITH &&
  );

-- 3. Check Constraints

-- activities.events scope check
ALTER TABLE activities.events DROP CONSTRAINT IF EXISTS events_scope_check;
ALTER TABLE activities.events
  ADD CONSTRAINT events_scope_check
  CHECK (num_nonnulls(project_id, chapter_id) <= 1);

-- finance.dues period valid
ALTER TABLE finance.dues DROP CONSTRAINT IF EXISTS dues_period_valid;
ALTER TABLE finance.dues
  ADD CONSTRAINT dues_period_valid
  CHECK (period_start < period_end);

-- activities.events schedule valid
ALTER TABLE activities.events DROP CONSTRAINT IF EXISTS events_schedule_valid;
ALTER TABLE activities.events
  ADD CONSTRAINT events_schedule_valid
  CHECK (scheduled_start < scheduled_end);

-- activities.projects schedule valid
ALTER TABLE activities.projects DROP CONSTRAINT IF EXISTS projects_schedule_valid;
ALTER TABLE activities.projects
  ADD CONSTRAINT projects_schedule_valid
  CHECK (scheduled_start < scheduled_end);

-- 4. Unique Indexes (with COALESCE)

-- core.member_titles_alias_scope_unique
DROP INDEX IF EXISTS core.member_titles_alias_scope_unique;
CREATE UNIQUE INDEX member_titles_alias_scope_unique
ON core.member_titles (
  alias,
  COALESCE(chapter_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(committee_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- 5. Functions and Triggers

-- Function: check_featured_media_limit
CREATE OR REPLACE FUNCTION check_featured_media_limit()
RETURNS TRIGGER AS $$
DECLARE
  featured_count INTEGER;
  table_name TEXT;
  parent_col TEXT;
  parent_id UUID;
BEGIN
  -- Only check if is_featured is being set to true
  IF NEW.is_featured = true THEN
    table_name := TG_TABLE_NAME;
    
    -- Determine the parent column based on the table name
    IF table_name = 'project_media' THEN
      parent_col := 'project_id';
      parent_id := NEW.project_id;
    ELSIF table_name = 'event_media' THEN
      parent_col := 'event_id';
      parent_id := NEW.event_id;

    ELSIF table_name = 'chapter_media' THEN
      parent_col := 'chapter_id';
      parent_id := NEW.chapter_id;
    ELSIF table_name = 'committee_media' THEN
      parent_col := 'committee_id';
      parent_id := NEW.committee_id;
    ELSIF table_name = 'product_media' THEN
      parent_col := 'product_id';
      parent_id := NEW.product_id;
    ELSE
      RAISE EXCEPTION 'Unknown table for featured media limit: %', table_name;
    END IF;

    -- Execute dynamic query to count existing featured items for this parent
    EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I = $1 AND is_featured = true', TG_TABLE_SCHEMA, table_name, parent_col)
    INTO featured_count
    USING parent_id;

    IF featured_count >= 10 THEN
       RAISE EXCEPTION 'Cannot have more than 10 featured media items for this collection.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers

-- activities.project_media
DROP TRIGGER IF EXISTS check_featured_limit ON activities.project_media;
CREATE TRIGGER check_featured_limit
BEFORE INSERT OR UPDATE ON activities.project_media
FOR EACH ROW
EXECUTE FUNCTION check_featured_media_limit();

-- activities.event_media
DROP TRIGGER IF EXISTS check_featured_limit ON activities.event_media;
CREATE TRIGGER check_featured_limit
BEFORE INSERT OR UPDATE ON activities.event_media
FOR EACH ROW
EXECUTE FUNCTION check_featured_media_limit();

-- core.chapter_media
DROP TRIGGER IF EXISTS check_featured_limit ON core.chapter_media;
CREATE TRIGGER check_featured_limit
BEFORE INSERT OR UPDATE ON core.chapter_media
FOR EACH ROW
EXECUTE FUNCTION check_featured_media_limit();

-- core.committee_media
DROP TRIGGER IF EXISTS check_featured_limit ON core.committee_media;
CREATE TRIGGER check_featured_limit
BEFORE INSERT OR UPDATE ON core.committee_media
FOR EACH ROW
EXECUTE FUNCTION check_featured_media_limit();

-- shop.product_media
DROP TRIGGER IF EXISTS check_featured_limit ON shop.product_media;
CREATE TRIGGER check_featured_limit
BEFORE INSERT OR UPDATE ON shop.product_media
FOR EACH ROW
EXECUTE FUNCTION check_featured_media_limit();
