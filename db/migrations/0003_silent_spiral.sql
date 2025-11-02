ALTER TABLE "shop"."product_photos" ADD COLUMN "medium_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "shop"."product_photos" ADD CONSTRAINT "product_photos_medium_id_media_id_fk" FOREIGN KEY ("medium_id") REFERENCES "core"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop"."product_photos" DROP COLUMN "photo_url";