ALTER TABLE "core"."media" RENAME COLUMN "media_type" TO "type";--> statement-breakpoint
ALTER TABLE "core"."media" RENAME COLUMN "created_by" TO "uploaded_by";--> statement-breakpoint
ALTER TABLE "core"."media" ADD COLUMN "width" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."media" ADD COLUMN "height" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."media" ADD COLUMN "sizeInBytes" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."media" ADD CONSTRAINT "media_uploaded_by_constituents_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "core"."constituents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."media" DROP COLUMN "updated_at";