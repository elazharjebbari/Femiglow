-- Migration 0080 — Système de coupons (CPN-01).
-- Tables `coupons` + `coupon_events` avec enums, contraintes et index.
-- NB : le snapshot meta/0080_snapshot.json resynchronise l'état complet du
-- schéma (les snapshots meta/ étaient en retard sur les SQL 0074–0079) ; ce
-- fichier SQL ne contient QUE le DDL coupons pour rester modulaire et ne pas
-- re-créer des objets déjà migrés.

CREATE TYPE "public"."coupon_bucket" AS ENUM('treatment', 'holdout');--> statement-breakpoint
CREATE TYPE "public"."coupon_event_phase" AS ENUM('exposed', 'applied', 'converted');--> statement-breakpoint
CREATE TYPE "public"."coupon_mode" AS ENUM('auto', 'code');--> statement-breakpoint
CREATE TYPE "public"."coupon_status" AS ENUM('draft', 'active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."coupon_target" AS ENUM('product_price', 'shipping', 'future_credit');--> statement-breakpoint
CREATE TYPE "public"."coupon_type" AS ENUM('welcome_auto', 'rescue', 'email_unlock', 'manual_code', 'post_purchase');--> statement-breakpoint
CREATE TYPE "public"."coupon_usage_scope" AS ENUM('unlimited', 'once_per_visitor', 'global_cap');--> statement-breakpoint
CREATE TYPE "public"."coupon_value_kind" AS ENUM('fixed_amount', 'percent');--> statement-breakpoint
CREATE TABLE "coupon_events" (
	"id" text PRIMARY KEY NOT NULL,
	"coupon_id" text,
	"phase" "coupon_event_phase" NOT NULL,
	"bucket" "coupon_bucket" NOT NULL,
	"visitor_key" text,
	"order_id" text,
	"amount_cents" integer,
	"traffic_source" text,
	"device" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"code" text,
	"type" "coupon_type" NOT NULL,
	"mode" "coupon_mode" NOT NULL,
	"status" "coupon_status" DEFAULT 'draft' NOT NULL,
	"value_kind" "coupon_value_kind" NOT NULL,
	"value_amount" integer NOT NULL,
	"target" "coupon_target" DEFAULT 'product_price' NOT NULL,
	"currency" text DEFAULT 'MAD' NOT NULL,
	"eligibility" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"stackable" boolean DEFAULT false NOT NULL,
	"usage_scope" "coupon_usage_scope" DEFAULT 'unlimited' NOT NULL,
	"usage_cap" integer,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"holdout_pct" integer DEFAULT 0 NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
ALTER TABLE "coupon_events" ADD CONSTRAINT "coupon_events_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_events" ADD CONSTRAINT "coupon_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coupon_events_coupon_phase_idx" ON "coupon_events" USING btree ("coupon_id","phase","created_at");--> statement-breakpoint
CREATE INDEX "coupon_events_visitor_idx" ON "coupon_events" USING btree ("visitor_key");--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_events_order_converted_unique" ON "coupon_events" USING btree ("order_id","coupon_id") WHERE "coupon_events"."phase" = 'converted' AND "coupon_events"."order_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_code_unique" ON "coupons" USING btree ("code") WHERE "coupons"."code" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "coupons_status_type_idx" ON "coupons" USING btree ("status","type");
