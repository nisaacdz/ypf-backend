ALTER TABLE "core"."chapters" RENAME COLUMN "is_active" TO "archived_at";--> statement-breakpoint
ALTER TABLE "core"."committees" ADD COLUMN "archived_at" date;--> statement-breakpoint
ALTER TABLE "core"."chapter_memberships" DROP COLUMN "is_active";--> statement-breakpoint
ALTER TABLE "core"."committee_memberships" DROP COLUMN "is_active";