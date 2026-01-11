CREATE INDEX "donations_constituent_id_idx" ON "finance"."donations" USING btree ("constituent_id");--> statement-breakpoint
CREATE INDEX "donations_project_id_idx" ON "finance"."donations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "donations_event_id_idx" ON "finance"."donations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "shop"."order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_id_idx" ON "shop"."order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "orders_constituent_id_idx" ON "shop"."orders" USING btree ("constituent_id");