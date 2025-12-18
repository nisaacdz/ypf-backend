CREATE TYPE "activities"."certificate_type" AS ENUM('EVENT_PARTICIPATION', 'PROGRAM_COMPLETION', 'HONORARY', 'MEMBERSHIP', 'VOLUNTEER_APPRECIATION');--> statement-breakpoint
CREATE TABLE "activities"."certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"type" "activities"."certificate_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"issue_date" timestamp with time zone DEFAULT now() NOT NULL,
	"expiry_date" timestamp with time zone,
	"file_url" text,
	"metadata" jsonb,
	"event_id" uuid,
	"program_id" uuid,
	"issued_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities"."certificates" ADD CONSTRAINT "certificates_recipient_id_members_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "core"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."certificates" ADD CONSTRAINT "certificates_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "activities"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."certificates" ADD CONSTRAINT "certificates_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "activities"."programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."certificates" ADD CONSTRAINT "certificates_issued_by_members_id_fk" FOREIGN KEY ("issued_by") REFERENCES "core"."members"("id") ON DELETE set null ON UPDATE no action;