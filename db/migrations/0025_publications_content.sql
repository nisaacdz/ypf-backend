-- Public editorial content for the website: Annual Report, Our Research, and
-- Stories of Transformation.
--
-- Its own `content` schema rather than a table in `activities` — these are
-- things the org *publishes*, not things it does — and distinct from
-- `activities.announcements`, which is an authenticated per-recipient feed.
--
-- `slug` is citext so /stories/Her-First-Term and /stories/her-first-term
-- resolve to the same post instead of 404-ing.
CREATE SCHEMA "content";
--> statement-breakpoint
CREATE TYPE "content"."post_section" AS ENUM('ANNUAL_REPORT', 'RESEARCH', 'STORY');--> statement-breakpoint
CREATE TYPE "content"."post_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "content"."post_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid,
	"medium_id" uuid,
	"caption" text
);
--> statement-breakpoint
CREATE TABLE "content"."posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" text DEFAULT 'YPFB-' || generate_alphanumeric_combination(8) NOT NULL,
	"section" "content"."post_section" NOT NULL,
	"slug" "citext" NOT NULL,
	"title" text NOT NULL,
	"dek" text,
	"excerpt" text,
	"body" text,
	"status" "content"."post_status" DEFAULT 'DRAFT' NOT NULL,
	"published_at" timestamp with time zone,
	"reading_minutes" integer,
	"tags" jsonb,
	"report_year" integer,
	"cover_media_id" uuid,
	"document_id" uuid,
	"author_id" uuid,
	"is_featured" boolean DEFAULT false NOT NULL,
	"consent_on_file" boolean DEFAULT false NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "content"."post_media" ADD CONSTRAINT "post_media_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "content"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."post_media" ADD CONSTRAINT "post_media_medium_id_media_id_fk" FOREIGN KEY ("medium_id") REFERENCES "core"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."posts" ADD CONSTRAINT "posts_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "core"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."posts" ADD CONSTRAINT "posts_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "core"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."posts" ADD CONSTRAINT "posts_author_id_constituents_id_fk" FOREIGN KEY ("author_id") REFERENCES "core"."constituents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_posts_section_status_published" ON "content"."posts" USING btree ("section","status","published_at");