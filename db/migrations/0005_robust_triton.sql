CREATE TABLE "shop"."order_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shop"."orders" RENAME COLUMN "customer_id" TO "constituent_id";--> statement-breakpoint
ALTER TABLE "shop"."orders" DROP CONSTRAINT "orders_customer_id_constituents_id_fk";
--> statement-breakpoint
ALTER TABLE "finance"."dues_payments" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "finance"."dues_payments" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "shop"."order_payments" ADD CONSTRAINT "order_payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "shop"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop"."order_payments" ADD CONSTRAINT "order_payments_transaction_id_financial_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "finance"."financial_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop"."orders" ADD CONSTRAINT "orders_constituent_id_constituents_id_fk" FOREIGN KEY ("constituent_id") REFERENCES "core"."constituents"("id") ON DELETE restrict ON UPDATE no action;