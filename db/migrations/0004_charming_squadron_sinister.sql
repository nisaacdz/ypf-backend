ALTER TABLE "shop"."product_photos" RENAME TO "product_media";--> statement-breakpoint
ALTER TABLE "shop"."product_media" DROP CONSTRAINT "product_photos_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "shop"."product_media" DROP CONSTRAINT "product_photos_medium_id_media_id_fk";
--> statement-breakpoint
ALTER TABLE "shop"."product_media" ADD CONSTRAINT "product_media_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "shop"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop"."product_media" ADD CONSTRAINT "product_media_medium_id_media_id_fk" FOREIGN KEY ("medium_id") REFERENCES "core"."media"("id") ON DELETE cascade ON UPDATE no action;