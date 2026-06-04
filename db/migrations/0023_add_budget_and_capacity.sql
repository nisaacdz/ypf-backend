-- Adds columns that had drifted into the Drizzle schema (and onto prod/dev via
-- `drizzle-kit push`) but were never captured in a migration file. The original
-- auto-generated version of this migration re-emitted the entire schema because
-- the meta snapshot was stale; every CREATE TYPE/TABLE/INDEX in it duplicated
-- objects already created by migrations 0000–0022 (e.g. certificate_status in
-- 0008), which made a fresh DB fail with "type ... already exists".
--
-- This trimmed version keeps only the genuinely-new columns and uses
-- IF NOT EXISTS so it is safe on databases that already have some of them.
ALTER TABLE "core"."constituents" ADD COLUMN IF NOT EXISTS "mission_pillars" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."membership_applications" ADD COLUMN IF NOT EXISTS "consents" jsonb;--> statement-breakpoint
ALTER TABLE "core"."volunteer_applications" ADD COLUMN IF NOT EXISTS "experience" text;--> statement-breakpoint
ALTER TABLE "core"."volunteer_applications" ADD COLUMN IF NOT EXISTS "availability" text;--> statement-breakpoint
ALTER TABLE "core"."volunteer_applications" ADD COLUMN IF NOT EXISTS "consents" jsonb;--> statement-breakpoint
ALTER TABLE "activities"."events" ADD COLUMN IF NOT EXISTS "description" text;--> statement-breakpoint
ALTER TABLE "activities"."events" ADD COLUMN IF NOT EXISTS "max_capacity" integer;--> statement-breakpoint
ALTER TABLE "activities"."projects" ADD COLUMN IF NOT EXISTS "location" text;--> statement-breakpoint
ALTER TABLE "activities"."projects" ADD COLUMN IF NOT EXISTS "objectives" jsonb;--> statement-breakpoint
ALTER TABLE "activities"."projects" ADD COLUMN IF NOT EXISTS "impact" text;--> statement-breakpoint
ALTER TABLE "activities"."projects" ADD COLUMN IF NOT EXISTS "budget" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "activities"."projects" ADD COLUMN IF NOT EXISTS "target_volunteers" integer;--> statement-breakpoint
ALTER TABLE "finance"."donations" ADD COLUMN IF NOT EXISTS "guest_phone" text;--> statement-breakpoint
ALTER TABLE "finance"."donations" ADD COLUMN IF NOT EXISTS "note" text;--> statement-breakpoint
ALTER TABLE "shop"."orders" ADD COLUMN IF NOT EXISTS "note" text;--> statement-breakpoint
ALTER TABLE "shop"."products" ADD COLUMN IF NOT EXISTS "long_description" text;--> statement-breakpoint
ALTER TABLE "shop"."products" ADD COLUMN IF NOT EXISTS "category" text;--> statement-breakpoint
ALTER TABLE "shop"."products" ADD COLUMN IF NOT EXISTS "attributes" jsonb;
