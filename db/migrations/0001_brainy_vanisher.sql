CREATE TYPE "public"."notification_type" AS ENUM('OTHER', 'MEETING_INVITE', 'DONATION_RECEIPT', 'ANNOUNCEMENT');--> statement-breakpoint
CREATE TABLE "core"."chapter_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"chapter_id" uuid,
	"media_id" uuid,
	"is_featured" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."committee_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"committee_id" uuid,
	"media_id" uuid,
	"is_featured" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities"."event_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" uuid,
	"media_id" uuid,
	"is_featured" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities"."project_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" uuid,
	"media_id" uuid,
	"is_featured" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop"."product_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"photo_url" text NOT NULL,
	"caption" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shop"."customers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "shop"."customers" CASCADE;--> statement-breakpoint
ALTER TABLE "activities"."projects" RENAME COLUMN "project_name" TO "title";--> statement-breakpoint
ALTER TABLE "activities"."projects" RENAME COLUMN "project_objective" TO "objective";--> statement-breakpoint
ALTER TABLE "shop"."orders" DROP CONSTRAINT "orders_customer_id_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "activities"."projects" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "activities"."projects" ALTER COLUMN "status" SET DEFAULT 'UPCOMING'::text;--> statement-breakpoint
DROP TYPE "public"."project_status";--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
ALTER TABLE "activities"."projects" ALTER COLUMN "status" SET DEFAULT 'UPCOMING'::"public"."project_status";--> statement-breakpoint
ALTER TABLE "activities"."projects" ALTER COLUMN "status" SET DATA TYPE "public"."project_status" USING "status"::"public"."project_status";--> statement-breakpoint
ALTER TABLE "app"."notifications" ADD COLUMN "type" "notification_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."otps" ADD COLUMN "used_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "core"."media" ADD COLUMN "external_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "activities"."projects" ADD COLUMN "abstract" text NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."chapter_media" ADD CONSTRAINT "chapter_media_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "core"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."chapter_media" ADD CONSTRAINT "chapter_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "core"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."committee_media" ADD CONSTRAINT "committee_media_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "core"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."committee_media" ADD CONSTRAINT "committee_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "core"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."event_media" ADD CONSTRAINT "event_media_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "activities"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."event_media" ADD CONSTRAINT "event_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "core"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."project_media" ADD CONSTRAINT "project_media_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "activities"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."project_media" ADD CONSTRAINT "project_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "core"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop"."product_photos" ADD CONSTRAINT "product_photos_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "shop"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop"."orders" ADD CONSTRAINT "orders_customer_id_constituents_id_fk" FOREIGN KEY ("customer_id") REFERENCES "core"."constituents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."otps" DROP COLUMN "is_used";--> statement-breakpoint
ALTER TABLE "core"."media" DROP COLUMN "url";--> statement-breakpoint
ALTER TABLE "app"."notifications" ADD CONSTRAINT "notifications_user_id_broadcast_id_unique" UNIQUE("user_id","broadcast_id");--> statement-breakpoint
ALTER TABLE "core"."media" ADD CONSTRAINT "media_external_id_unique" UNIQUE("external_id");