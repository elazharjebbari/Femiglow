-- CHA-310 — Conversion-focused canned pairs.
--
-- Ajoute la capacité pour une SuggestionPill de déclencher le formulaire
-- de capture lead juste après sa scripted_reply :
--   * triggers_lead_form : flag boolean (default false → comportement legacy)
--   * lead_form_copy_key : choisit la variante de copy/CTA dans le widget
--     (cf. apps/web/src/components/chat/lead-form-copy.ts).
--
-- Reversible : DROP COLUMN sans risque (colonnes ajoutées avec DEFAULT, pas
-- d'index conditionnel). Pas de backfill : les anciennes pills restent à
-- `false` (= comportement actuel : la pill répond mais n'ouvre PAS de form).

ALTER TABLE chat_canned_pair
  ADD COLUMN IF NOT EXISTS triggers_lead_form boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lead_form_copy_key text;

-- Contrainte CHECK sur les valeurs valides (mirror de l'enum côté code).
-- Null autorisé pour les pills qui n'ouvrent pas de formulaire ; sinon
-- la valeur doit appartenir à l'enum lead-form-copy.
ALTER TABLE chat_canned_pair
  DROP CONSTRAINT IF EXISTS chat_canned_pair_lead_form_copy_key_check;

ALTER TABLE chat_canned_pair
  ADD CONSTRAINT chat_canned_pair_lead_form_copy_key_check
  CHECK (
    lead_form_copy_key IS NULL OR lead_form_copy_key IN (
      'explicit-request',
      'out-of-knowledge',
      'objection',
      'after-hours',
      'b2b',
      'purchase-intent',
      'inline-contact',
      'manual'
    )
  );
