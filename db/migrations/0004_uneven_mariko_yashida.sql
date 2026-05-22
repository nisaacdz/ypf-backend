ALTER TABLE "core"."committees" ADD COLUMN "alias" text NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."committees" ADD CONSTRAINT "committees_alias_unique" UNIQUE("alias");