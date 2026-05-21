-- Public-website "Meet the team" entries. Curated, orderable, editable from
-- the UMS admin Team Members page. Independent from the Members directory so
-- the website presentation can include external advisors / phased shows
-- without polluting the internal org-chart.
CREATE TABLE IF NOT EXISTS "core"."public_team_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "role" text NOT NULL,
  "bio" text,
  "photo_id" uuid REFERENCES "core"."media"("id") ON DELETE SET NULL,
  "constituent_id" uuid REFERENCES "core"."constituents"("id") ON DELETE SET NULL,
  "position" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "public_team_members_position_idx"
  ON "core"."public_team_members" ("position", "is_active");
