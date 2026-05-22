CREATE TABLE IF NOT EXISTS "app"."user_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL UNIQUE REFERENCES "app"."users"("id") ON DELETE CASCADE,
  "two_factor_enabled" boolean NOT NULL DEFAULT false,
  "sensitive_change_alerts" boolean NOT NULL DEFAULT true,
  "notify_announcements" boolean NOT NULL DEFAULT true,
  "notify_events" boolean NOT NULL DEFAULT true,
  "notify_dues" boolean NOT NULL DEFAULT true,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
