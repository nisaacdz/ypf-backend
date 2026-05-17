CREATE TABLE "finance"."dues_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"constituent_id" uuid NOT NULL,
	"dues_id" uuid NOT NULL,
	"dismissed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance"."dues_reminders" ADD CONSTRAINT "dues_reminders_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."dues_reminders" ADD CONSTRAINT "dues_reminders_dues_id_dues_id_fk" FOREIGN KEY ("dues_id") REFERENCES "finance"."dues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_dues_reminders_constituent" ON "finance"."dues_reminders" USING btree ("constituent_id");--> statement-breakpoint
CREATE INDEX "idx_dues_reminders_dues" ON "finance"."dues_reminders" USING btree ("dues_id");