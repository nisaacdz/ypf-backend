ALTER TABLE "activities"."announcement_broadcasts" DROP CONSTRAINT "announcement_broadcasts_chapter_id_chapters_id_fk";
--> statement-breakpoint
ALTER TABLE "activities"."announcement_broadcasts" DROP CONSTRAINT "announcement_broadcasts_committee_id_committees_id_fk";
--> statement-breakpoint
ALTER TABLE "activities"."projects" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "activities"."projects" ALTER COLUMN "status" SET DEFAULT 'UPCOMING'::text;--> statement-breakpoint
DROP TYPE "activities"."project_status";--> statement-breakpoint
CREATE TYPE "activities"."project_status" AS ENUM('UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
ALTER TABLE "activities"."projects" ALTER COLUMN "status" SET DEFAULT 'UPCOMING'::"activities"."project_status";--> statement-breakpoint
ALTER TABLE "activities"."projects" ALTER COLUMN "status" SET DATA TYPE "activities"."project_status" USING "status"::"activities"."project_status";--> statement-breakpoint
ALTER TABLE "core"."chapters" ALTER COLUMN "archived_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "activities"."announcement_broadcasts" ALTER COLUMN "announcement_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."contact_informations" ADD COLUMN "unsubscribed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "activities"."announcement_broadcasts" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "activities"."announcement_broadcasts" ADD COLUMN "subject" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "activities"."announcement_broadcasts" DROP COLUMN "chapter_id";--> statement-breakpoint
ALTER TABLE "activities"."announcement_broadcasts" DROP COLUMN "committee_id";--> statement-breakpoint
ALTER TABLE "activities"."announcement_broadcasts" DROP COLUMN "is_archived";