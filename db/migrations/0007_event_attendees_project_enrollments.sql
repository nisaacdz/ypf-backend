-- Event attendance / registration
CREATE TABLE IF NOT EXISTS activities.event_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES activities.events(id) ON DELETE CASCADE,
  constituent_id UUID NOT NULL REFERENCES core.constituents(id) ON DELETE CASCADE,
  status activities.attendance_status NOT NULL DEFAULT 'ACCEPTED',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, constituent_id)
);

-- Project enrollment (volunteer participation)
CREATE TABLE IF NOT EXISTS activities.project_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES activities.projects(id) ON DELETE CASCADE,
  constituent_id UUID NOT NULL REFERENCES core.constituents(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unenrolled_at TIMESTAMPTZ,
  UNIQUE(project_id, constituent_id)
);

-- Indexes for fast lookup by constituent
CREATE INDEX IF NOT EXISTS idx_event_attendees_constituent ON activities.event_attendees(constituent_id);
CREATE INDEX IF NOT EXISTS idx_project_enrollments_constituent ON activities.project_enrollments(constituent_id);
