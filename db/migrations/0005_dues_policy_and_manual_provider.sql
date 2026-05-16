ALTER TYPE "finance"."external_provider" ADD VALUE 'MANUAL';--> statement-breakpoint
CREATE TABLE "finance"."dues_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "finance"."dues_policies" ADD CONSTRAINT "dues_policies_created_by_constituents_id_fk" FOREIGN KEY ("created_by") REFERENCES "core"."constituents"("id") ON DELETE set null ON UPDATE no action;