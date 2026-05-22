-- Add indexes on FK columns that are joined on hot read paths but currently
-- have no supporting index. At small row counts these are silent wins; at
-- production scale they prevent seq-scans on every gallery/event/project
-- query. CREATE INDEX IF NOT EXISTS keeps the migration idempotent so
-- running it twice (e.g. across replicas) is safe.

-- Events ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "events_chapter_id_idx"
  ON "activities"."events" ("chapter_id");
CREATE INDEX IF NOT EXISTS "events_project_id_idx"
  ON "activities"."events" ("project_id");

-- ProjectMedia / EventMedia ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "project_media_project_id_idx"
  ON "activities"."project_media" ("project_id");
CREATE INDEX IF NOT EXISTS "project_media_medium_id_idx"
  ON "activities"."project_media" ("medium_id");

CREATE INDEX IF NOT EXISTS "event_media_event_id_idx"
  ON "activities"."event_media" ("event_id");
CREATE INDEX IF NOT EXISTS "event_media_medium_id_idx"
  ON "activities"."event_media" ("medium_id");

-- EventDocuments ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "event_documents_event_id_idx"
  ON "activities"."event_documents" ("event_id");
CREATE INDEX IF NOT EXISTS "event_documents_document_id_idx"
  ON "activities"."event_documents" ("document_id");

-- Announcements + ConstituentAnnouncements ────────────────────────────────
CREATE INDEX IF NOT EXISTS "announcements_author_id_idx"
  ON "activities"."announcements" ("author_id");

-- Certificates ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "certificates_project_id_idx"
  ON "activities"."certificates" ("project_id");

-- Chapter / Committee media (legacy internal galleries) ───────────────────
CREATE INDEX IF NOT EXISTS "chapter_media_chapter_id_idx"
  ON "core"."chapter_media" ("chapter_id");
CREATE INDEX IF NOT EXISTS "chapter_media_medium_id_idx"
  ON "core"."chapter_media" ("medium_id");

CREATE INDEX IF NOT EXISTS "committee_media_committee_id_idx"
  ON "core"."committee_media" ("committee_id");
CREATE INDEX IF NOT EXISTS "committee_media_medium_id_idx"
  ON "core"."committee_media" ("medium_id");
