CREATE TYPE "activities"."certificate_status" AS ENUM('ACTIVE', 'REVOKED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "activities"."certificate_type" AS ENUM('COMPLETION', 'PARTICIPATION', 'ACHIEVEMENT', 'LEADERSHIP');--> statement-breakpoint
CREATE TYPE "finance"."budget_request_status" AS ENUM('SUBMITTED', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "logs"."workspace_note_entity_type" AS ENUM('program', 'event', 'workspace');--> statement-breakpoint
CREATE TYPE "logs"."workspace_submission_kind" AS ENUM('PLAN', 'REPORT');--> statement-breakpoint
CREATE TABLE "app"."audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_email" text,
	"action" text NOT NULL,
	"target" text,
	"metadata" jsonb,
	"source_ip" "inet",
	"user_agent" text,
	"status_code" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."committee_maintenance" (
	"committee_id" uuid PRIMARY KEY NOT NULL,
	"message" text,
	"since" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."contact_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" "citext" NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'NEW' NOT NULL,
	"source_ip" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."sms_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"event" text NOT NULL,
	"recipient" text NOT NULL,
	"constituent_id" uuid,
	"message" text NOT NULL,
	"message_length" integer NOT NULL,
	"segment_count" integer NOT NULL,
	"status" text NOT NULL,
	"provider" text DEFAULT 'arkesel' NOT NULL,
	"provider_response" jsonb,
	"triggered_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."system_backups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"size_bytes" integer,
	"blob_container" text,
	"blob_path" text,
	"checksum_sha256" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"triggered_by" uuid,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "app"."system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"sensitive_change_alerts" boolean DEFAULT true NOT NULL,
	"notify_announcements" boolean DEFAULT true NOT NULL,
	"notify_events" boolean DEFAULT true NOT NULL,
	"notify_dues" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "core"."public_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"bio" text,
	"photo_id" uuid,
	"constituent_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities"."certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certificate_number" text DEFAULT 'YPFC-' || generate_alphanumeric_combination(8) NOT NULL,
	"constituent_id" uuid NOT NULL,
	"title" text NOT NULL,
	"program_name" text NOT NULL,
	"project_id" uuid,
	"type" "activities"."certificate_type" DEFAULT 'COMPLETION' NOT NULL,
	"status" "activities"."certificate_status" DEFAULT 'ACTIVE' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"issued_by" uuid,
	"description" text,
	CONSTRAINT "certificates_certificate_number_unique" UNIQUE("certificate_number")
);
--> statement-breakpoint
CREATE TABLE "activities"."event_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"constituent_id" uuid,
	"guest_name" text,
	"guest_email" "citext",
	"guest_phone" text,
	"status" "activities"."attendance_status" DEFAULT 'ACCEPTED' NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_attendees_event_id_constituent_id_unique" UNIQUE("event_id","constituent_id")
);
--> statement-breakpoint
CREATE TABLE "activities"."project_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"constituent_id" uuid,
	"guest_name" text,
	"guest_email" "citext",
	"guest_phone" text,
	"guest_profile" jsonb,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unenrolled_at" timestamp with time zone,
	CONSTRAINT "project_enrollments_project_id_constituent_id_unique" UNIQUE("project_id","constituent_id")
);
--> statement-breakpoint
CREATE TABLE "finance"."budget_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"committee_id" uuid NOT NULL,
	"title" text NOT NULL,
	"month" date NOT NULL,
	"currency" varchar(3) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"rationale" text NOT NULL,
	"lines" jsonb NOT NULL,
	"status" "finance"."budget_request_status" DEFAULT 'SUBMITTED' NOT NULL,
	"submitted_by" uuid NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logs"."workspace_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"committee_id" uuid NOT NULL,
	"note_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"label" text,
	"original_file_name" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "logs"."workspace_monthly_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"committee_id" uuid NOT NULL,
	"month" timestamp with time zone NOT NULL,
	"kind" "logs"."workspace_submission_kind" NOT NULL,
	"body" text NOT NULL,
	"document_name" text,
	"document_url" text,
	"submitted_by" uuid NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_monthly_submissions_committee_id_month_kind_unique" UNIQUE("committee_id","month","kind")
);
--> statement-breakpoint
CREATE TABLE "logs"."workspace_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"committee_id" uuid NOT NULL,
	"entity_type" "logs"."workspace_note_entity_type" NOT NULL,
	"entity_id" uuid,
	"body" text NOT NULL,
	"author_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "core"."constituents" ADD COLUMN "mission_pillars" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."membership_applications" ADD COLUMN "consents" jsonb;--> statement-breakpoint
ALTER TABLE "core"."volunteer_applications" ADD COLUMN "experience" text;--> statement-breakpoint
ALTER TABLE "core"."volunteer_applications" ADD COLUMN "availability" text;--> statement-breakpoint
ALTER TABLE "core"."volunteer_applications" ADD COLUMN "consents" jsonb;--> statement-breakpoint
ALTER TABLE "activities"."events" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "activities"."events" ADD COLUMN "max_capacity" integer;--> statement-breakpoint
ALTER TABLE "activities"."projects" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "activities"."projects" ADD COLUMN "objectives" jsonb;--> statement-breakpoint
ALTER TABLE "activities"."projects" ADD COLUMN "impact" text;--> statement-breakpoint
ALTER TABLE "activities"."projects" ADD COLUMN "budget" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "finance"."donations" ADD COLUMN "guest_phone" text;--> statement-breakpoint
ALTER TABLE "finance"."donations" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "shop"."orders" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "shop"."products" ADD COLUMN "long_description" text;--> statement-breakpoint
ALTER TABLE "shop"."products" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "shop"."products" ADD COLUMN "attributes" jsonb;--> statement-breakpoint
ALTER TABLE "app"."audit_logs" ADD CONSTRAINT "audit_logs_actor_id_constituents_id_fk" FOREIGN KEY ("actor_id") REFERENCES "core"."constituents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."committee_maintenance" ADD CONSTRAINT "committee_maintenance_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "core"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."committee_maintenance" ADD CONSTRAINT "committee_maintenance_updated_by_constituents_id_fk" FOREIGN KEY ("updated_by") REFERENCES "core"."constituents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."contact_submissions" ADD CONSTRAINT "contact_submissions_reviewed_by_constituents_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "core"."constituents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."sms_messages" ADD CONSTRAINT "sms_messages_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."sms_messages" ADD CONSTRAINT "sms_messages_triggered_by_constituents_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "core"."constituents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."system_backups" ADD CONSTRAINT "system_backups_triggered_by_constituents_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "core"."constituents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."system_settings" ADD CONSTRAINT "system_settings_updated_by_constituents_id_fk" FOREIGN KEY ("updated_by") REFERENCES "core"."constituents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."public_team_members" ADD CONSTRAINT "public_team_members_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "core"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."public_team_members" ADD CONSTRAINT "public_team_members_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."certificates" ADD CONSTRAINT "certificates_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."certificates" ADD CONSTRAINT "certificates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "activities"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."certificates" ADD CONSTRAINT "certificates_issued_by_constituents_id_fk" FOREIGN KEY ("issued_by") REFERENCES "core"."constituents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."event_attendees" ADD CONSTRAINT "event_attendees_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "activities"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."event_attendees" ADD CONSTRAINT "event_attendees_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."project_enrollments" ADD CONSTRAINT "project_enrollments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "activities"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."project_enrollments" ADD CONSTRAINT "project_enrollments_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."budget_requests" ADD CONSTRAINT "budget_requests_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "core"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."budget_requests" ADD CONSTRAINT "budget_requests_submitted_by_constituents_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "core"."constituents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."budget_requests" ADD CONSTRAINT "budget_requests_reviewed_by_constituents_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "core"."constituents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs"."workspace_attachments" ADD CONSTRAINT "workspace_attachments_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "core"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs"."workspace_attachments" ADD CONSTRAINT "workspace_attachments_note_id_workspace_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "logs"."workspace_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs"."workspace_attachments" ADD CONSTRAINT "workspace_attachments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "core"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs"."workspace_attachments" ADD CONSTRAINT "workspace_attachments_uploaded_by_constituents_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "core"."constituents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs"."workspace_monthly_submissions" ADD CONSTRAINT "workspace_monthly_submissions_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "core"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs"."workspace_monthly_submissions" ADD CONSTRAINT "workspace_monthly_submissions_submitted_by_constituents_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "core"."constituents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs"."workspace_notes" ADD CONSTRAINT "workspace_notes_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "core"."committees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs"."workspace_notes" ADD CONSTRAINT "workspace_notes_author_id_constituents_id_fk" FOREIGN KEY ("author_id") REFERENCES "core"."constituents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_actor_created_idx" ON "app"."audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_action_created_idx" ON "app"."audit_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "contact_submissions_status_created_idx" ON "app"."contact_submissions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "sms_messages_created_idx" ON "app"."sms_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sms_messages_event_created_idx" ON "app"."sms_messages" USING btree ("event","created_at");--> statement-breakpoint
CREATE INDEX "sms_messages_status_created_idx" ON "app"."sms_messages" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "sms_messages_batch_idx" ON "app"."sms_messages" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "system_backups_started_idx" ON "app"."system_backups" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "system_backups_status_idx" ON "app"."system_backups" USING btree ("status","started_at");--> statement-breakpoint
CREATE INDEX "public_team_members_position_idx" ON "core"."public_team_members" USING btree ("position","is_active");--> statement-breakpoint
CREATE INDEX "idx_certificates_constituent" ON "activities"."certificates" USING btree ("constituent_id");--> statement-breakpoint
CREATE INDEX "event_attendees_guest_email_idx" ON "activities"."event_attendees" USING btree ("guest_email");--> statement-breakpoint
CREATE INDEX "project_enrollments_guest_email_idx" ON "activities"."project_enrollments" USING btree ("guest_email");--> statement-breakpoint
CREATE INDEX "budget_requests_committee_month_idx" ON "finance"."budget_requests" USING btree ("committee_id","month");--> statement-breakpoint
CREATE INDEX "budget_requests_status_idx" ON "finance"."budget_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workspace_attachments_note" ON "logs"."workspace_attachments" USING btree ("committee_id","note_id");--> statement-breakpoint
CREATE INDEX "idx_workspace_submissions_committee_month" ON "logs"."workspace_monthly_submissions" USING btree ("committee_id","month");--> statement-breakpoint
CREATE INDEX "idx_workspace_notes_entity" ON "logs"."workspace_notes" USING btree ("committee_id","entity_type","entity_id");