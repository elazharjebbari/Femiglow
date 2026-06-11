CREATE TYPE "public"."coupon_grant_status" AS ENUM('issued', 'redeemed', 'expired');--> statement-breakpoint
CREATE TABLE "coupon_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"template_coupon_id" text,
	"code" text NOT NULL,
	"lead_id" text,
	"source_order_id" text,
	"status" "coupon_grant_status" DEFAULT 'issued' NOT NULL,
	"value_cents" integer NOT NULL,
	"currency" text DEFAULT 'MAD' NOT NULL,
	"redeemed_order_id" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"redeemed_at" timestamp with time zone
);
--> statement-breakpoint
DROP INDEX "coupon_events_order_converted_unique";--> statement-breakpoint
ALTER TABLE "coupon_grants" ADD CONSTRAINT "coupon_grants_template_coupon_id_coupons_id_fk" FOREIGN KEY ("template_coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_grants" ADD CONSTRAINT "coupon_grants_source_order_id_orders_id_fk" FOREIGN KEY ("source_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_grants" ADD CONSTRAINT "coupon_grants_redeemed_order_id_orders_id_fk" FOREIGN KEY ("redeemed_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_grants_code_unique" ON "coupon_grants" USING btree ("code");--> statement-breakpoint
CREATE INDEX "coupon_grants_status_idx" ON "coupon_grants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "coupon_grants_lead_idx" ON "coupon_grants" USING btree ("lead_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_grants_source_order_unique" ON "coupon_grants" USING btree ("source_order_id") WHERE "coupon_grants"."source_order_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_events_order_converted_unique" ON "coupon_events" USING btree ("order_id","coupon_id") WHERE "coupon_events"."phase" = 'converted' AND "coupon_events"."order_id" IS NOT NULL;