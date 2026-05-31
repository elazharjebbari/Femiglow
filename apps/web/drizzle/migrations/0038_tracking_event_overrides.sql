-- ===========================================================================
-- Migration 0030 — table tracking_event_overrides
-- ---------------------------------------------------------------------------
-- Permet à l'admin d'override la catégorie Google Ads d'un event sans toucher
-- le catalog code. Décision D-005 (hybride : default code + override DB).
-- Idempotent : CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
-- cf. docs/tracking-improvement/20-data/ + 90-plan/dev-plan.csv (T04).
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "tracking_event_overrides" (
  "id" text PRIMARY KEY,
  "event_name" text NOT NULL,
  "google_ads_category" "google_ads_category" NOT NULL,
  "updated_by" text,
  "updated_at" timestamp WITH TIME ZONE NOT NULL DEFAULT now(),
  "note" text,
  CONSTRAINT "tracking_event_overrides_event_name_unique" UNIQUE ("event_name"),
  CONSTRAINT "tracking_event_overrides_event_name_fk"
    FOREIGN KEY ("event_name") REFERENCES "tracking_event_definitions" ("name")
    ON DELETE CASCADE
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tracking_event_overrides_event_name_idx"
  ON "tracking_event_overrides" ("event_name");
