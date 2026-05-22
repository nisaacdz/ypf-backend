-- Per-committee maintenance notices. Notice-only (no enforcement). Presence
-- of a row = maintenance ON; absence = OFF. To pause + preserve the message
-- you'd need to add an `enabled` column, but we keep this minimal until the
-- workflow proves out.
CREATE TABLE IF NOT EXISTS "app"."committee_maintenance" (
  "committee_id" uuid PRIMARY KEY REFERENCES "core"."committees"("id") ON DELETE CASCADE,
  "message" text,
  "since" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_by" uuid REFERENCES "core"."constituents"("id") ON DELETE SET NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
