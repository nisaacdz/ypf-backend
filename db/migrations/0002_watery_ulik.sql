CREATE TABLE "activities"."program_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now(),
	"status" text DEFAULT 'enrolled' NOT NULL,
	"progress" integer DEFAULT 0,
	"completed_at" timestamp with time zone,
	"certificate_id" uuid,
	CONSTRAINT "program_enrollments_program_id_member_id_unique" UNIQUE("program_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "activities"."programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"budget" numeric(12, 2),
	"max_participants" integer,
	"committee_id" uuid,
	"chapter_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "activities"."program_enrollments" ADD CONSTRAINT "program_enrollments_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "activities"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."program_enrollments" ADD CONSTRAINT "program_enrollments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "core"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."programs" ADD CONSTRAINT "programs_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "core"."committees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."programs" ADD CONSTRAINT "programs_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "core"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."programs" ADD CONSTRAINT "programs_created_by_constituents_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."constituents"("id") ON DELETE no action ON UPDATE no action;