CREATE TYPE "activities"."welfare_case_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT');--> statement-breakpoint
CREATE TYPE "activities"."welfare_case_status" AS ENUM('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESOLVED');--> statement-breakpoint
CREATE TYPE "activities"."welfare_case_type" AS ENUM('FINANCIAL_SUPPORT', 'MEDICAL', 'EDUCATIONAL', 'EMERGENCY', 'COUNSELING', 'OTHER');--> statement-breakpoint
CREATE TABLE "activities"."welfare_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"type" "activities"."welfare_case_type" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" "activities"."welfare_case_status" DEFAULT 'PENDING' NOT NULL,
	"priority" "activities"."welfare_case_priority" DEFAULT 'MEDIUM' NOT NULL,
	"requested_amount" numeric(10, 2),
	"approved_amount" numeric(10, 2),
	"assigned_to" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"chapter_id" uuid
);
--> statement-breakpoint
ALTER TABLE "activities"."welfare_cases" ADD CONSTRAINT "welfare_cases_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "core"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."welfare_cases" ADD CONSTRAINT "welfare_cases_assigned_to_members_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "core"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities"."welfare_cases" ADD CONSTRAINT "welfare_cases_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "core"."chapters"("id") ON DELETE set null ON UPDATE no action;