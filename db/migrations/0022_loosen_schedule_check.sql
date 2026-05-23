-- The original `projects_schedule_valid` and `events_schedule_valid`
-- constraints (added in 0002_manual_constraints.sql) used strict `<`,
-- which rejects single-day projects / events where start == end.
--
-- Real-world example that just hit production:
--   POST /api/v1/projects {
--     scheduledStart: 2024-07-05T00:00:00.000Z,
--     scheduledEnd:   2024-07-05T00:00:00.000Z
--   }
-- → 500, "Failed query: insert into activities.projects (...)"
-- because the CHECK constraint fired before the row could be persisted.
--
-- Loosen to `<=` so same-day activities pass. The UI / Zod schema can
-- still apply a stricter validation if we ever want to require multi-day
-- ranges in a particular code path — but the DB level should not block
-- the common case.

-- Projects
ALTER TABLE activities.projects DROP CONSTRAINT IF EXISTS projects_schedule_valid;--> statement-breakpoint
ALTER TABLE activities.projects
  ADD CONSTRAINT projects_schedule_valid
  CHECK (scheduled_start <= scheduled_end);--> statement-breakpoint

-- Events
ALTER TABLE activities.events DROP CONSTRAINT IF EXISTS events_schedule_valid;--> statement-breakpoint
ALTER TABLE activities.events
  ADD CONSTRAINT events_schedule_valid
  CHECK (scheduled_start <= scheduled_end);
