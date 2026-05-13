-- ===========================================================================
-- Migration 0028 — tracking_events_log: capture du gclid
-- ---------------------------------------------------------------------------
-- Ajoute une colonne `gclid` (Google click ID) à `tracking_events_log` pour
-- préparer les Enhanced Conversions Google Ads et l'attribution multi-pages.
-- `event_id` existe depuis la migration 0002 ; on ne le touche pas.
-- Additif, idempotent.
-- cf. docs/tracking-improvement/20-data/ + 90-plan/dev-plan.csv (T02).
-- ===========================================================================

ALTER TABLE "tracking_events_log"
  ADD COLUMN IF NOT EXISTS "gclid" text;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tracking_events_log_gclid_idx"
  ON "tracking_events_log" ("gclid")
  WHERE "gclid" IS NOT NULL;
