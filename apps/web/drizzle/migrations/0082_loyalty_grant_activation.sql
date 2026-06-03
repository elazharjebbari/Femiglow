ALTER TABLE "coupon_grants" ADD COLUMN "phone_e164" text;--> statement-breakpoint
ALTER TABLE "coupon_grants" ADD COLUMN "activates_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "coupon_grants_phone_idx" ON "coupon_grants" USING btree ("phone_e164");--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_grants_phone_active_unique" ON "coupon_grants" USING btree ("phone_e164") WHERE "coupon_grants"."status" = 'issued' AND "coupon_grants"."phone_e164" IS NOT NULL;