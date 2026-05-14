-- ===========================================================================
-- Migration 0046 — M5.7 email_template_custom (templates HTML personnalisés)
-- ---------------------------------------------------------------------------
-- Templates HTML éditables par l'admin. Coexistent avec les templates
-- React-Email codés en dur (lib/mail/templates/*.tsx) — slug différent.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS email_template_custom (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL UNIQUE,
  name                text NOT NULL,
  description         text,
  subject_tmpl        text NOT NULL,
  preheader_tmpl      text,
  html_source         text NOT NULL,
  custom_vars         jsonb NOT NULL DEFAULT '{}'::jsonb,
  active_version_id   uuid,
  created_by          text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX IF NOT EXISTS idx_email_template_custom_slug
  ON email_template_custom (slug) WHERE deleted_at IS NULL;
