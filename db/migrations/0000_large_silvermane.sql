CREATE TYPE "public"."attendance_status" AS ENUM('INVITED', 'ACCEPTED', 'DECLINED', 'ATTENDED');--> statement-breakpoint
CREATE TYPE "public"."contact_type" AS ENUM('EMAIL', 'PHONE', 'WHATSAPP');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('MALE', 'FEMALE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('PICTURE', 'VIDEO');--> statement-breakpoint
CREATE TYPE "public"."membership_type" AS ENUM('DONOR', 'MEMBER', 'VOLUNTEER', 'AUDITOR');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('CREDIT_CARD', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CASH');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('PLANNING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');--> statement-breakpoint
CREATE TABLE "activities"."event_participations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"constituent_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"volunteer_hours" numeric(5, 2),
	"role_during_event" text,
	CONSTRAINT "event_participations_constituent_id_event_id_unique" UNIQUE("constituent_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "activities"."events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"event_name" text NOT NULL,
	"event_date" timestamp with time zone NOT NULL,
	"event_location" text,
	"event_objectives" text,
	"status" "event_status" DEFAULT 'UPCOMING' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities"."projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid,
	"project_name" text NOT NULL,
	"project_objective" text,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"budget" numeric(12, 2),
	"status" "project_status" DEFAULT 'PLANNING' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"message" text,
	"announcement_id" uuid,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."otps" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"code" text NOT NULL,
	"payload" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"is_used" boolean DEFAULT false NOT NULL
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
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id"),
	CONSTRAINT "users_apple_id_unique" UNIQUE("apple_id"),
	CONSTRAINT "users_facebook_id_unique" UNIQUE("facebook_id")
);
--> statement-breakpoint
CREATE TABLE "communications"."announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_global" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communications"."announcements_chapters" (
	"announcement_id" uuid NOT NULL,
	"chapter_id" uuid NOT NULL,
	CONSTRAINT "announcements_chapters_announcement_id_chapter_id_pk" PRIMARY KEY("announcement_id","chapter_id")
);
--> statement-breakpoint
CREATE TABLE "communications"."announcements_committees" (
	"announcement_id" uuid NOT NULL,
	"committee_id" uuid NOT NULL,
	CONSTRAINT "announcements_committees_announcement_id_committee_id_pk" PRIMARY KEY("announcement_id","committee_id")
);
--> statement-breakpoint
CREATE TABLE "communications"."meeting_attendees" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_id" uuid NOT NULL,
	"constituent_id" uuid NOT NULL,
	"status" "attendance_status" DEFAULT 'INVITED' NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	CONSTRAINT "meeting_attendees_meeting_id_constituent_id_unique" UNIQUE("meeting_id","constituent_id")
);
--> statement-breakpoint
CREATE TABLE "communications"."meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"agenda" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"location_url" text,
	"chapter_id" uuid,
	"committee_id" uuid,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."chapter_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"constituent_id" uuid NOT NULL,
	"chapter_id" uuid NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "chapter_memberships_constituent_id_chapter_id_unique" UNIQUE("constituent_id","chapter_id")
);
--> statement-breakpoint
CREATE TABLE "core"."chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"country" text NOT NULL,
	"description" text,
	"founding_date" date NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"parent_id" uuid
);
--> statement-breakpoint
CREATE TABLE "core"."committee_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"constituent_id" uuid NOT NULL,
	"committee_id" uuid NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "committee_memberships_constituent_id_committee_id_unique" UNIQUE("constituent_id","committee_id")
);
--> statement-breakpoint
CREATE TABLE "core"."committees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "committees_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "core"."constituents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"preferred_name" text,
	"selfie_id" uuid,
	"salutation" text,
	"date_of_birth" date,
	"gender" "gender",
	"join_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "constituents_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "core"."contact_informations" (
	"id" serial PRIMARY KEY NOT NULL,
	"constituent_id" uuid NOT NULL,
	"contact_type" "contact_type" NOT NULL,
	"value" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "contact_informations_constituent_id_contact_type_value_unique" UNIQUE("constituent_id","contact_type","value")
);
--> statement-breakpoint
CREATE TABLE "core"."media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"media_type" "media_type" NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"constituent_id" uuid NOT NULL,
	"type" "membership_type" NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"assigner_id" uuid
);
--> statement-breakpoint
CREATE TABLE "core"."role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"constituent_id" uuid NOT NULL,
	"role_id" integer NOT NULL,
	"chapter_id" uuid,
	"committee_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "core"."roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "finance"."designations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_restricted" boolean DEFAULT false NOT NULL,
	"description" text,
	CONSTRAINT "designations_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "finance"."donations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"donor_id" uuid NOT NULL,
	"project_id" uuid,
	"event_id" uuid,
	"designation_id" uuid,
	"receipt_sent" boolean DEFAULT false NOT NULL,
	CONSTRAINT "donations_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "finance"."dues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_type" "membership_type" NOT NULL,
	"chapter_id" uuid,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."dues_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" uuid NOT NULL,
	"dues_id" uuid NOT NULL,
	"constituent_id" uuid NOT NULL,
	CONSTRAINT "dues_payments_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "finance"."expenditures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expenditure_date" timestamp with time zone NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"description" text NOT NULL,
	"category" text,
	"project_id" uuid,
	"event_id" uuid,
	"vendor_id" uuid,
	"approved_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "finance"."financial_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"transaction_date" timestamp with time zone DEFAULT now() NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"status" "transaction_status" DEFAULT 'PENDING' NOT NULL,
	"external_ref" text
);
--> statement-breakpoint
CREATE TABLE "finance"."vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "vendors_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "impact"."impact_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"area_name" text NOT NULL,
	"description" text,
	CONSTRAINT "impact_areas_area_name_unique" UNIQUE("area_name")
);
--> statement-breakpoint
CREATE TABLE "impact"."impact_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"report_title" text NOT NULL,
	"narrative" text NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impact"."metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outcome_id" uuid NOT NULL,
	"measurement_date" date NOT NULL,
	"value" numeric(12, 2) NOT NULL,
	"notes" text,
	"data_source" text
);
--> statement-breakpoint
CREATE TABLE "impact"."outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"impact_area_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"outcome_name" text NOT NULL,
	"target_value" numeric(12, 2),
	"is_quantitative" boolean NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities"."event_participations" ADD CONSTRAINT "event_participations_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."event_participations" ADD CONSTRAINT "event_participations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "activities"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."events" ADD CONSTRAINT "events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "activities"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."projects" ADD CONSTRAINT "projects_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "core"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notifications" ADD CONSTRAINT "notifications_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "communications"."announcements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications"."announcements" ADD CONSTRAINT "announcements_created_by_id_constituents_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "core"."constituents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications"."announcements_chapters" ADD CONSTRAINT "announcements_chapters_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "communications"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications"."announcements_chapters" ADD CONSTRAINT "announcements_chapters_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "core"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications"."announcements_committees" ADD CONSTRAINT "announcements_committees_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "communications"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications"."announcements_committees" ADD CONSTRAINT "announcements_committees_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "core"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications"."meeting_attendees" ADD CONSTRAINT "meeting_attendees_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "communications"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications"."meeting_attendees" ADD CONSTRAINT "meeting_attendees_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications"."meetings" ADD CONSTRAINT "meetings_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "core"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications"."meetings" ADD CONSTRAINT "meetings_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "core"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications"."meetings" ADD CONSTRAINT "meetings_created_by_id_constituents_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "core"."constituents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."chapter_memberships" ADD CONSTRAINT "chapter_memberships_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."chapter_memberships" ADD CONSTRAINT "chapter_memberships_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "core"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."chapters" ADD CONSTRAINT "chapters_parent_id_chapters_id_fk" FOREIGN KEY ("parent_id") REFERENCES "core"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."committee_memberships" ADD CONSTRAINT "committee_memberships_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."committee_memberships" ADD CONSTRAINT "committee_memberships_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "core"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."constituents" ADD CONSTRAINT "constituents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."constituents" ADD CONSTRAINT "constituents_selfie_id_media_id_fk" FOREIGN KEY ("selfie_id") REFERENCES "core"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."contact_informations" ADD CONSTRAINT "contact_informations_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."memberships" ADD CONSTRAINT "memberships_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."memberships" ADD CONSTRAINT "memberships_assigner_id_constituents_id_fk" FOREIGN KEY ("assigner_id") REFERENCES "core"."constituents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."role_assignments" ADD CONSTRAINT "role_assignments_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."role_assignments" ADD CONSTRAINT "role_assignments_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "core"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."role_assignments" ADD CONSTRAINT "role_assignments_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "core"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."role_assignments" ADD CONSTRAINT "role_assignments_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "core"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."donations" ADD CONSTRAINT "donations_transaction_id_financial_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "finance"."financial_transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."donations" ADD CONSTRAINT "donations_donor_id_constituents_id_fk" FOREIGN KEY ("donor_id") REFERENCES "core"."constituents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."donations" ADD CONSTRAINT "donations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "activities"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."donations" ADD CONSTRAINT "donations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "activities"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."donations" ADD CONSTRAINT "donations_designation_id_designations_id_fk" FOREIGN KEY ("designation_id") REFERENCES "finance"."designations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."dues" ADD CONSTRAINT "dues_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "core"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."dues_payments" ADD CONSTRAINT "dues_payments_transaction_id_financial_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "finance"."financial_transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."dues_payments" ADD CONSTRAINT "dues_payments_dues_id_dues_id_fk" FOREIGN KEY ("dues_id") REFERENCES "finance"."dues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."dues_payments" ADD CONSTRAINT "dues_payments_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."expenditures" ADD CONSTRAINT "expenditures_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "activities"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."expenditures" ADD CONSTRAINT "expenditures_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "activities"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."expenditures" ADD CONSTRAINT "expenditures_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "finance"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."expenditures" ADD CONSTRAINT "expenditures_approved_by_id_constituents_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "core"."constituents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact"."impact_reports" ADD CONSTRAINT "impact_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "activities"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact"."impact_reports" ADD CONSTRAINT "impact_reports_created_by_id_constituents_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "core"."constituents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact"."metrics" ADD CONSTRAINT "metrics_outcome_id_outcomes_id_fk" FOREIGN KEY ("outcome_id") REFERENCES "impact"."outcomes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact"."outcomes" ADD CONSTRAINT "outcomes_impact_area_id_impact_areas_id_fk" FOREIGN KEY ("impact_area_id") REFERENCES "impact"."impact_areas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact"."outcomes" ADD CONSTRAINT "outcomes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "activities"."projects"("id") ON DELETE cascade ON UPDATE no action;