CREATE TABLE "core"."applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tracking_number" text DEFAULT generate_alphanumeric_combination(8) NOT NULL,
	"constituent_id" uuid NOT NULL,
	"status" "core"."application_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applications_tracking_number_unique" UNIQUE("tracking_number")
);
--> statement-breakpoint
ALTER TABLE "core"."membership_applications" DROP CONSTRAINT "membership_applications_tracking_number_unique";--> statement-breakpoint
ALTER TABLE "core"."volunteer_applications" DROP CONSTRAINT "volunteer_applications_tracking_number_unique";--> statement-breakpoint
ALTER TABLE "core"."membership_applications" DROP CONSTRAINT "membership_applications_constituent_id_constituents_id_fk";
--> statement-breakpoint
ALTER TABLE "core"."volunteer_applications" DROP CONSTRAINT "volunteer_applications_constituent_id_constituents_id_fk";
--> statement-breakpoint
ALTER TABLE "core"."constituents" ALTER COLUMN "public_id" SET DATA TYPE citext USING "public_id"::citext;--> statement-breakpoint
ALTER TABLE "core"."constituents" ALTER COLUMN "public_id" SET DEFAULT 'YPF-' || EXTRACT(YEAR FROM CURRENT_DATE)::text || '-' || generate_alphanumeric_combination(6);--> statement-breakpoint
ALTER TABLE "activities"."projects" ALTER COLUMN "public_id" SET DEFAULT 'YPFP-' || generate_alphanumeric_combination(8);--> statement-breakpoint
ALTER TABLE "core"."membership_applications" ADD COLUMN "application_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."volunteer_applications" ADD COLUMN "application_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."applications" ADD CONSTRAINT "applications_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."membership_applications" ADD CONSTRAINT "membership_applications_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "core"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."volunteer_applications" ADD CONSTRAINT "volunteer_applications_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "core"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."membership_applications" DROP COLUMN "constituent_id";--> statement-breakpoint
ALTER TABLE "core"."membership_applications" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "core"."membership_applications" DROP COLUMN "tracking_number";--> statement-breakpoint
ALTER TABLE "core"."membership_applications" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "core"."membership_applications" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "core"."volunteer_applications" DROP COLUMN "constituent_id";--> statement-breakpoint
ALTER TABLE "core"."volunteer_applications" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "core"."volunteer_applications" DROP COLUMN "tracking_number";--> statement-breakpoint
ALTER TABLE "core"."volunteer_applications" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "core"."volunteer_applications" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "core"."membership_applications" ADD CONSTRAINT "membership_applications_application_id_unique" UNIQUE("application_id");--> statement-breakpoint
ALTER TABLE "core"."volunteer_applications" ADD CONSTRAINT "volunteer_applications_application_id_unique" UNIQUE("application_id");--> statement-breakpoint
DROP TYPE "core"."volunteer_application_status";