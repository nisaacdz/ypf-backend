CREATE TABLE "core"."registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"whatsapp_number" text,
	"date_of_birth" date,
	"gender" text,
	"occupation" text,
	"country" text NOT NULL,
	"region" text,
	"city" text,
	"chapter_id" uuid,
	"campus" text,
	"national_id_number" text,
	"passport_photo_id" uuid,
	"ghana_card_front_id" uuid,
	"ghana_card_back_id" uuid,
	"membership_status" text NOT NULL,
	"mission_pillars" text[],
	"referral_source" text,
	"referral_other" text,
	"commitment_statement" text,
	"willing_to_serve" text,
	"preferred_role" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"emergency_contact_relationship" text,
	"skills" text[],
	"previous_volunteer_experience" text,
	"linkedin_profile" text,
	"twitter_handle" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"declined_reason" text,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"assigned_role" text,
	"generated_member_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "registrations_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "core"."registrations" ADD CONSTRAINT "registrations_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "core"."chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."registrations" ADD CONSTRAINT "registrations_passport_photo_id_media_id_fk" FOREIGN KEY ("passport_photo_id") REFERENCES "core"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."registrations" ADD CONSTRAINT "registrations_ghana_card_front_id_media_id_fk" FOREIGN KEY ("ghana_card_front_id") REFERENCES "core"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."registrations" ADD CONSTRAINT "registrations_ghana_card_back_id_media_id_fk" FOREIGN KEY ("ghana_card_back_id") REFERENCES "core"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."registrations" ADD CONSTRAINT "registrations_approved_by_admins_id_fk" FOREIGN KEY ("approved_by") REFERENCES "core"."admins"("id") ON DELETE no action ON UPDATE no action;