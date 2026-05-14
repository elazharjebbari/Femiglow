-- ===========================================================================
-- Migration 0029 — tracking_event_definitions: catégorie Google Ads par défaut
-- ---------------------------------------------------------------------------
-- Création de l'enum `google_ads_category` (Conversion Action Category Google
-- Ads) et ajout de la colonne `google_ads_category_default` côté définitions.
-- Seed des catégories par défaut alignées sur le catalog côté code.
-- cf. docs/tracking-improvement/20-data/ + 90-plan/dev-plan.csv (T03, T06).
-- ===========================================================================

DO $$ BEGIN
  CREATE TYPE "google_ads_category" AS ENUM (
    'purchase',
    'lead',
    'contact',
    'signup',
    'view_content',
    'none'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

ALTER TABLE "tracking_event_definitions"
  ADD COLUMN IF NOT EXISTS "google_ads_category_default"
  "google_ads_category" NOT NULL DEFAULT 'none';
--> statement-breakpoint

-- Seed des défauts. WHERE `= 'none'` rend l'UPDATE idempotent : on n'écrase
-- jamais une valeur déjà ajustée (par re-run ou par un seed antérieur).
UPDATE "tracking_event_definitions" SET "google_ads_category_default" = CASE "name"
  WHEN 'purchase' THEN 'purchase'::"google_ads_category"
  WHEN 'begin_checkout' THEN 'purchase'::"google_ads_category"
  WHEN 'lead_capture' THEN 'lead'::"google_ads_category"
  WHEN 'generate_lead' THEN 'lead'::"google_ads_category"
  WHEN 'sign_up' THEN 'signup'::"google_ads_category"
  WHEN 'contact_submit' THEN 'contact'::"google_ads_category"
  WHEN 'newsletter_submit' THEN 'contact'::"google_ads_category"
  WHEN 'chat_lead_form_submit' THEN 'lead'::"google_ads_category"
  WHEN 'view_item' THEN 'view_content'::"google_ads_category"
  WHEN 'view_item_list' THEN 'view_content'::"google_ads_category"
  ELSE 'none'::"google_ads_category"
END
WHERE "google_ads_category_default" = 'none';
