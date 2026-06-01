-- OWBS — Optimistic Wizard & Background Lead Sync.
-- Table `lead_event_outbox` : transactional outbox des effets de bord durables
-- d'un lead (tracking serveur CAPI/GA4, webhook). Drainée par le worker cron
-- `/api/cron/lead-outbox`. Calquée sur `email_outbox`.
-- Migration écrite à la main (idempotente) pour n'embarquer QUE ces objets
-- (le `drizzle-kit generate` agrégeait du drift de schéma préexistant).
-- cf. docs/checkout-leads-background-2026-06-01/02-data-flow/data-model.md §1.3
DO $$ BEGIN
 CREATE TYPE "public"."lead_event_outbox_status" AS ENUM('pending', 'processing', 'done', 'dead');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."lead_outbox_event_type" AS ENUM('purchase_capi', 'purchase_ga4', 'order_webhook', 'cart_abandoned_webhook', 'lead_capi');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_event_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "lead_outbox_event_type" NOT NULL,
	"lead_id" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "lead_event_outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 8 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lead_event_outbox_dedupe_unique" ON "lead_event_outbox" USING btree ("type","lead_id","dedupe_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_event_outbox_drain_idx" ON "lead_event_outbox" USING btree ("status","next_attempt_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_event_outbox_lead_idx" ON "lead_event_outbox" USING btree ("lead_id");
