-- System settings (key/value, JSONB) — maintenance mode, feature flags, vendor
-- toggles. Read-mostly; super admin writes via /api/v1/system.
CREATE TABLE IF NOT EXISTS "app"."system_settings" (
  "key" text PRIMARY KEY,
  "value" jsonb NOT NULL,
  "description" text,
  "updated_by" uuid REFERENCES "core"."constituents"("id") ON DELETE SET NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Audit trail for sensitive admin actions. Append-only — never UPDATE / DELETE
-- rows here; rotate via the application layer instead.
CREATE TABLE IF NOT EXISTS "app"."audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_id" uuid REFERENCES "core"."constituents"("id") ON DELETE SET NULL,
  "actor_email" text,
  "action" text NOT NULL,
  "target" text,
  "metadata" jsonb,
  "source_ip" inet,
  "user_agent" text,
  "status_code" integer,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "audit_logs_actor_created_idx"
  ON "app"."audit_logs" ("actor_id", "created_at");

CREATE INDEX IF NOT EXISTS "audit_logs_action_created_idx"
  ON "app"."audit_logs" ("action", "created_at");

-- Seed maintenance mode off. Idempotent so re-runs don't overwrite operator
-- changes.
INSERT INTO "app"."system_settings" ("key", "value", "description")
VALUES (
  'maintenance_mode',
  '{"enabled": false, "message": null, "since": null}'::jsonb,
  'When enabled, write routes return 503 and public site shows a banner.'
)
ON CONFLICT ("key") DO NOTHING;
