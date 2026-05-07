-- Migration 0009 : analytics — colonnes additives sur tracking_events_log + funnel_stage
-- cf. docs/analytics/02-data-model.md §1
-- Toutes les altérations sont additives et idempotentes (IF NOT EXISTS).

-- Colonnes attribution & A/B sur tracking_events_log
ALTER TABLE "tracking_events_log"
  ADD COLUMN IF NOT EXISTS "traffic_source" text,
  ADD COLUMN IF NOT EXISTS "traffic_medium" text,
  ADD COLUMN IF NOT EXISTS "experiment_id" text,
  ADD COLUMN IF NOT EXISTS "experiment_variant" text;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tracking_events_log_traffic_source_idx"
  ON "tracking_events_log" ("traffic_source");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tracking_events_log_experiment_idx"
  ON "tracking_events_log" ("experiment_id")
  WHERE "experiment_id" IS NOT NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tracking_events_log_received_session_idx"
  ON "tracking_events_log" ("received_at" DESC, "session_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tracking_events_log_name_received_idx"
  ON "tracking_events_log" ("event_name", "received_at" DESC);
--> statement-breakpoint

-- Colonne funnel_stage sur tracking_event_definitions (TOF/MOF/BOF/CONVERSION)
DO $$ BEGIN
  CREATE TYPE "tracking_funnel_stage" AS ENUM ('tof', 'mof', 'bof', 'conversion', 'none');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "tracking_event_definitions"
  ADD COLUMN IF NOT EXISTS "funnel_stage" "tracking_funnel_stage" NOT NULL DEFAULT 'none';
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tracking_event_def_funnel_stage_idx"
  ON "tracking_event_definitions" ("funnel_stage");
--> statement-breakpoint

-- Mapping seed (idempotent : UPDATE WHERE name match) ; le seed:tracking refera
-- l'upsert mais cette migration garantit que les données présentes en DB sont
-- correctes immédiatement.
UPDATE "tracking_event_definitions" SET "funnel_stage" = 'tof'
  WHERE "name" IN ('page_view','view_item','scroll_depth','select_content','click');
--> statement-breakpoint

UPDATE "tracking_event_definitions" SET "funnel_stage" = 'mof'
  WHERE "name" IN ('add_to_cart','view_cart','remove_from_cart');
--> statement-breakpoint

UPDATE "tracking_event_definitions" SET "funnel_stage" = 'bof'
  WHERE "name" IN ('begin_checkout','add_shipping_info','add_payment_info');
--> statement-breakpoint

UPDATE "tracking_event_definitions" SET "funnel_stage" = 'conversion'
  WHERE "name" IN ('purchase','generate_lead','sign_up');
