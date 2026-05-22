-- Records of every database backup, manual or scheduled. We never store
-- the dump itself in Postgres — that'd be a chicken-and-egg recovery
-- problem. Each row points at the actual dump file in Azure Blob via
-- `blob_path`, and a SAS download URL is minted on demand by the API.
CREATE TABLE IF NOT EXISTS "app"."system_backups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "trigger" text NOT NULL,                       -- 'MANUAL' | 'SCHEDULED'
  "status" text NOT NULL,                        -- 'RUNNING' | 'SUCCESS' | 'FAILED'
  "size_bytes" bigint,
  "blob_container" text,
  "blob_path" text,
  "checksum_sha256" text,
  "started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "finished_at" timestamp with time zone,
  "triggered_by" uuid REFERENCES "core"."constituents"("id") ON DELETE SET NULL,
  "error_message" text
);

CREATE INDEX IF NOT EXISTS "system_backups_started_idx"
  ON "app"."system_backups" ("started_at" DESC);
CREATE INDEX IF NOT EXISTS "system_backups_status_idx"
  ON "app"."system_backups" ("status", "started_at" DESC);
