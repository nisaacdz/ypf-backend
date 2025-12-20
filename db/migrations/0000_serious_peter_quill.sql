CREATE SCHEMA "app";
--> statement-breakpoint
CREATE SCHEMA "core";
--> statement-breakpoint
CREATE SCHEMA "activities";
--> statement-breakpoint
CREATE SCHEMA "finance";
--> statement-breakpoint
CREATE SCHEMA "shop";
--> statement-breakpoint
CREATE TYPE "core"."admin_roles" AS ENUM('SUPER_ADMIN', 'REGULAR_ADMIN');--> statement-breakpoint
CREATE TYPE "core"."application_status" AS ENUM('DRAFT', 'PENDING', 'REJECTED', 'ACCEPTED');--> statement-breakpoint
CREATE TYPE "core"."document_type" AS ENUM('PDF', 'DOC', 'SPREADSHEET', 'PRESENTATION', 'IMAGE', 'OTHER');--> statement-breakpoint
CREATE TYPE "core"."gender" AS ENUM('MALE', 'FEMALE', 'OTHER');--> statement-breakpoint
CREATE TYPE "core"."media_type" AS ENUM('PICTURE', 'VIDEO');--> statement-breakpoint
CREATE TYPE "core"."national_id_type" AS ENUM('ECOWASIDCARD');--> statement-breakpoint
CREATE TYPE "activities"."attendance_status" AS ENUM('INVITED', 'ACCEPTED', 'DECLINED', 'ATTENDED');--> statement-breakpoint
CREATE TYPE "activities"."event_status" AS ENUM('UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "activities"."event_type" AS ENUM('PROGRAM', 'WORKSHOP');--> statement-breakpoint
CREATE TYPE "activities"."project_status" AS ENUM('UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "finance"."external_provider" AS ENUM('PAYSTACK');--> statement-breakpoint
CREATE TYPE "finance"."partnership_type" AS ENUM('SPONSOR', 'IN_KIND', 'TECHNICAL', 'VENUE', 'OTHER');--> statement-breakpoint
CREATE TYPE "finance"."payment_method" AS ENUM('CREDIT_CARD', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CASH');--> statement-breakpoint
CREATE TYPE "finance"."transaction_status" AS ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "shop"."shop_order_status" AS ENUM('PENDING', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "app"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"message" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"code" text NOT NULL,
	"payload" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" text,
	"username" text,
	"avatar_url" text,
	"google_id" text,
	"apple_id" text,
	"facebook_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"constituent_id" uuid NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id"),
	CONSTRAINT "users_apple_id_unique" UNIQUE("apple_id"),
	CONSTRAINT "users_facebook_id_unique" UNIQUE("facebook_id"),
	CONSTRAINT "users_constituent_id_unique" UNIQUE("constituent_id")
);
--> statement-breakpoint
CREATE TABLE "core"."admin_roles_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"role" "core"."admin_roles" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"constituent_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"constituent_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"declined_reason" text,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"commitment_statement" text,
	"preferred_chapter_id" uuid,
	"preferred_committee_id" uuid,
	"preferred_profile" text DEFAULT 'Member',
	"cv_document_id" uuid,
	"referral_source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."auditors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"constituent_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."chapter_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid,
	"medium_id" uuid,
	"caption" text,
	"is_featured" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."chapter_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"chapter_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"country" text NOT NULL,
	"description" text,
	"founding_date" date NOT NULL,
	"archived_at" timestamp with time zone,
	"parent_id" uuid
);
--> statement-breakpoint
CREATE TABLE "core"."committee_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"committee_id" uuid,
	"medium_id" uuid,
	"caption" text,
	"is_featured" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."committee_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"committee_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."committees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"chapter_id" uuid,
	"archived_at" date,
	CONSTRAINT "committees_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "core"."constituents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"preferred_name" text,
	"email" text,
	"phone" text,
	"whatsapp" text,
	"org_email" text,
	"linkedin_profile" text,
	"twitter_handle" text,
	"profile_photo_id" uuid,
	"salutation" text,
	"date_of_birth" date,
	"gender" "core"."gender",
	"occupation" text,
	"country" text,
	"region" text,
	"city" text,
	"campus" text,
	"national_id_type" "core"."national_id_type",
	"national_id_document" uuid,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"skills" text[],
	"previous_volunteer_experience" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "constituents_email_unique" UNIQUE("email"),
	CONSTRAINT "constituents_phone_unique" UNIQUE("phone"),
	CONSTRAINT "constituents_whatsapp_unique" UNIQUE("whatsapp"),
	CONSTRAINT "constituents_org_email_unique" UNIQUE("org_email")
);
--> statement-breakpoint
CREATE TABLE "core"."directors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"constituent_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"type" "core"."document_type" NOT NULL,
	"size" integer NOT NULL,
	"uploaded_by" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "core"."media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"type" "core"."media_type" NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"size" integer NOT NULL,
	"uploaded_by" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "core"."member_titles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"alias" text NOT NULL,
	"description" text,
	"_level" integer NOT NULL,
	"chapter_id" uuid,
	"committee_id" uuid,
	CONSTRAINT "member_titles_title_chapter_id_committee_id_unique" UNIQUE("title","chapter_id","committee_id"),
	CONSTRAINT "at_most_one_scope" CHECK (num_nonnulls("core"."member_titles"."chapter_id", "core"."member_titles"."committee_id") <= 1)
);
--> statement-breakpoint
CREATE TABLE "core"."member_titles_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"title_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"constituent_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."organization_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"constituent_id" uuid NOT NULL,
	"title" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "organization_contacts_organization_id_constituent_id_unique" UNIQUE("organization_id","constituent_id")
);
--> statement-breakpoint
CREATE TABLE "core"."organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"description" text,
	"logo_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."volunteers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"constituent_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "activities"."announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"target_criteria" jsonb NOT NULL,
	"author_id" uuid,
	"status" text DEFAULT 'DRAFT',
	"published_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities"."constituent_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"announcement_id" uuid NOT NULL,
	"constituent_id" uuid NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"email_sent" boolean DEFAULT false NOT NULL,
	CONSTRAINT "constituent_announcements_announcement_id_constituent_id_unique" UNIQUE("announcement_id","constituent_id")
);
--> statement-breakpoint
CREATE TABLE "activities"."event_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid,
	"medium_id" uuid,
	"caption" text,
	"is_featured" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities"."events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"scheduled_start" timestamp with time zone NOT NULL,
	"type" "activities"."event_type" NOT NULL,
	"scheduled_end" timestamp with time zone NOT NULL,
	"location" text,
	"objective" text,
	"status" "activities"."event_status" DEFAULT 'UPCOMING' NOT NULL,
	"project_id" uuid
);
--> statement-breakpoint
CREATE TABLE "activities"."project_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"medium_id" uuid,
	"caption" text,
	"is_featured" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities"."projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"abstract" text,
	"description" text,
	"scheduled_start" timestamp with time zone NOT NULL,
	"scheduled_end" timestamp with time zone NOT NULL,
	"status" "activities"."project_status" DEFAULT 'UPCOMING' NOT NULL,
	"chapter_id" uuid
);
--> statement-breakpoint
CREATE TABLE "finance"."donations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"constituent_id" uuid,
	"project_id" uuid,
	"event_id" uuid,
	"guest_name" text,
	"guest_email" text,
	CONSTRAINT "donations_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "finance"."dues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."dues_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"dues_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	CONSTRAINT "dues_payments_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "finance"."expenditures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"description" text NOT NULL,
	"category" text,
	"project_id" uuid,
	"event_id" uuid,
	"vendor_id" uuid
);
--> statement-breakpoint
CREATE TABLE "finance"."financial_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payment_method" "finance"."payment_method",
	"status" "finance"."transaction_status" DEFAULT 'PENDING' NOT NULL,
	"external_provider" "finance"."external_provider" NOT NULL,
	"external_ref" text,
	CONSTRAINT "financial_transactions_external_ref_unique" UNIQUE("external_ref")
);
--> statement-breakpoint
CREATE TABLE "finance"."partnerships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"partnership_type" "finance"."partnership_type" NOT NULL,
	"project_id" uuid,
	"event_id" uuid,
	"started_at" date NOT NULL,
	"ended_at" date,
	"value" numeric(12, 2),
	"metadata" text
);
--> statement-breakpoint
CREATE TABLE "shop"."order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"price_at_purchase" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop"."order_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop"."orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"constituent_id" uuid NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"status" "shop"."shop_order_status" DEFAULT 'PENDING' NOT NULL,
	"delivery_address" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop"."product_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"medium_id" uuid NOT NULL,
	"caption" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop"."products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sku" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"stock_quantity" integer DEFAULT 1 NOT NULL,
	"image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
ALTER TABLE "app"."notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."users" ADD CONSTRAINT "users_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."admin_roles_assignments" ADD CONSTRAINT "admin_roles_assignments_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "core"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."admins" ADD CONSTRAINT "admins_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."applications" ADD CONSTRAINT "applications_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."applications" ADD CONSTRAINT "applications_approved_by_admins_id_fk" FOREIGN KEY ("approved_by") REFERENCES "core"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."applications" ADD CONSTRAINT "applications_preferred_chapter_id_chapters_id_fk" FOREIGN KEY ("preferred_chapter_id") REFERENCES "core"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."applications" ADD CONSTRAINT "applications_preferred_committee_id_committees_id_fk" FOREIGN KEY ("preferred_committee_id") REFERENCES "core"."committees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."applications" ADD CONSTRAINT "applications_cv_document_id_documents_id_fk" FOREIGN KEY ("cv_document_id") REFERENCES "core"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."auditors" ADD CONSTRAINT "auditors_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."chapter_media" ADD CONSTRAINT "chapter_media_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "core"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."chapter_media" ADD CONSTRAINT "chapter_media_medium_id_media_id_fk" FOREIGN KEY ("medium_id") REFERENCES "core"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."chapter_memberships" ADD CONSTRAINT "chapter_memberships_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "core"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."chapter_memberships" ADD CONSTRAINT "chapter_memberships_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "core"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."chapters" ADD CONSTRAINT "chapters_parent_id_chapters_id_fk" FOREIGN KEY ("parent_id") REFERENCES "core"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."committee_media" ADD CONSTRAINT "committee_media_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "core"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."committee_media" ADD CONSTRAINT "committee_media_medium_id_media_id_fk" FOREIGN KEY ("medium_id") REFERENCES "core"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."committee_memberships" ADD CONSTRAINT "committee_memberships_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "core"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."committee_memberships" ADD CONSTRAINT "committee_memberships_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "core"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."committees" ADD CONSTRAINT "committees_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "core"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."constituents" ADD CONSTRAINT "constituents_profile_photo_id_media_id_fk" FOREIGN KEY ("profile_photo_id") REFERENCES "core"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."constituents" ADD CONSTRAINT "constituents_national_id_document_documents_id_fk" FOREIGN KEY ("national_id_document") REFERENCES "core"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."directors" ADD CONSTRAINT "directors_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."documents" ADD CONSTRAINT "documents_uploaded_by_constituents_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "core"."constituents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."media" ADD CONSTRAINT "media_uploaded_by_constituents_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "core"."constituents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."member_titles" ADD CONSTRAINT "member_titles_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "core"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."member_titles" ADD CONSTRAINT "member_titles_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "core"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."member_titles_assignments" ADD CONSTRAINT "member_titles_assignments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "core"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."member_titles_assignments" ADD CONSTRAINT "member_titles_assignments_title_id_member_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "core"."member_titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."members" ADD CONSTRAINT "members_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."organization_contacts" ADD CONSTRAINT "organization_contacts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."organization_contacts" ADD CONSTRAINT "organization_contacts_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."volunteers" ADD CONSTRAINT "volunteers_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."announcements" ADD CONSTRAINT "announcements_author_id_constituents_id_fk" FOREIGN KEY ("author_id") REFERENCES "core"."constituents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."constituent_announcements" ADD CONSTRAINT "constituent_announcements_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "activities"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."constituent_announcements" ADD CONSTRAINT "constituent_announcements_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."event_media" ADD CONSTRAINT "event_media_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "activities"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."event_media" ADD CONSTRAINT "event_media_medium_id_media_id_fk" FOREIGN KEY ("medium_id") REFERENCES "core"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."events" ADD CONSTRAINT "events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "activities"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."project_media" ADD CONSTRAINT "project_media_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "activities"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."project_media" ADD CONSTRAINT "project_media_medium_id_media_id_fk" FOREIGN KEY ("medium_id") REFERENCES "core"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."projects" ADD CONSTRAINT "projects_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "core"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."donations" ADD CONSTRAINT "donations_transaction_id_financial_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "finance"."financial_transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."donations" ADD CONSTRAINT "donations_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."donations" ADD CONSTRAINT "donations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "activities"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."donations" ADD CONSTRAINT "donations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "activities"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."dues" ADD CONSTRAINT "dues_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "core"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."dues_payments" ADD CONSTRAINT "dues_payments_transaction_id_financial_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "finance"."financial_transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."dues_payments" ADD CONSTRAINT "dues_payments_dues_id_dues_id_fk" FOREIGN KEY ("dues_id") REFERENCES "finance"."dues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."dues_payments" ADD CONSTRAINT "dues_payments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "core"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."expenditures" ADD CONSTRAINT "expenditures_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "activities"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."expenditures" ADD CONSTRAINT "expenditures_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "activities"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."expenditures" ADD CONSTRAINT "expenditures_vendor_id_organizations_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "core"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."partnerships" ADD CONSTRAINT "partnerships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "core"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."partnerships" ADD CONSTRAINT "partnerships_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "activities"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."partnerships" ADD CONSTRAINT "partnerships_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "activities"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop"."order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "shop"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop"."order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "shop"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop"."order_payments" ADD CONSTRAINT "order_payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "shop"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop"."order_payments" ADD CONSTRAINT "order_payments_transaction_id_financial_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "finance"."financial_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop"."orders" ADD CONSTRAINT "orders_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop"."product_media" ADD CONSTRAINT "product_media_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "shop"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop"."product_media" ADD CONSTRAINT "product_media_medium_id_media_id_fk" FOREIGN KEY ("medium_id") REFERENCES "core"."media"("id") ON DELETE cascade ON UPDATE no action;