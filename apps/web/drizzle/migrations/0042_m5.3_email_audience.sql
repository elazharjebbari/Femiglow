-- ===========================================================================
-- Migration 0042 — M5.3 email_audience (définition d'audiences)
-- ---------------------------------------------------------------------------
-- Une audience = un nom + des règles (rules jsonb) + des exclusions
-- automatiques (hard bounces, unsubscribes...). Évaluable dynamiquement
-- au moment d'un envoi, ou snapshot-able pour figer la liste.
--
-- Cf. docs/emailing/admin-evolution/01-data/01-tables.md#email_audience
-- ===========================================================================

CREATE TABLE IF NOT EXISTS email_audience (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE,
  name            text NOT NULL,
  description     text,
  rules           jsonb NOT NULL,
  exclusion_flags jsonb NOT NULL DEFAULT '{
    "hard_bounce": true,
    "unsubscribe": true,
    "manual_suppression": true,
    "marketing_optout": false
  }'::jsonb,
  evaluation_mode text NOT NULL DEFAULT 'dynamic'
    CHECK (evaluation_mode IN ('static', 'dynamic')),
  created_by      text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_email_audience_slug
  ON email_audience (slug) WHERE deleted_at IS NULL;
