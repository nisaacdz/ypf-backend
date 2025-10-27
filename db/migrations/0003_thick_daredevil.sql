CREATE TYPE "public"."external_payment_provider" AS ENUM('FLUTTERWAVE');--> statement-breakpoint
ALTER TABLE "finance"."financial_transactions" ADD COLUMN "external_provider" "external_payment_provider";--> statement-breakpoint
ALTER TABLE "finance"."financial_transactions" ADD COLUMN "external_id" text;