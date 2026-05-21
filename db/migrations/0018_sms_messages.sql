-- SMS delivery log. Every Arkesel send fans out to one row per recipient
-- so the /sms admin page can show per-message history, batch summaries,
-- and per-event usage analytics independent of the Arkesel dashboard.
CREATE TABLE IF NOT EXISTS "app"."sms_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "batch_id" uuid NOT NULL,
  "event" text NOT NULL,
  "recipient" text NOT NULL,
  "constituent_id" uuid REFERENCES "core"."constituents"("id") ON DELETE SET NULL,
  "message" text NOT NULL,
  "message_length" integer NOT NULL,
  "segment_count" integer NOT NULL,
  "status" text NOT NULL,
  "provider" text NOT NULL DEFAULT 'arkesel',
  "provider_response" jsonb,
  "triggered_by" uuid REFERENCES "core"."constituents"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "sms_messages_created_idx"
  ON "app"."sms_messages" ("created_at");

CREATE INDEX IF NOT EXISTS "sms_messages_event_created_idx"
  ON "app"."sms_messages" ("event", "created_at");

CREATE INDEX IF NOT EXISTS "sms_messages_status_created_idx"
  ON "app"."sms_messages" ("status", "created_at");

CREATE INDEX IF NOT EXISTS "sms_messages_batch_idx"
  ON "app"."sms_messages" ("batch_id");
