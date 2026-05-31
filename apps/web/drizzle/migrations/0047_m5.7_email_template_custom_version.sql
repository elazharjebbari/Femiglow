-- ===========================================================================
-- Migration 0047 — M5.7 email_template_custom_version (historique versioning)
-- ---------------------------------------------------------------------------
-- Chaque save crée une version. active_version_id sur le template parent
-- pointe vers la version active. Rollback = créer une nouvelle version
-- copiant l'ancienne (audit trail préservé).
-- ===========================================================================

CREATE TABLE IF NOT EXISTS email_template_custom_version (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     uuid NOT NULL REFERENCES email_template_custom(id) ON DELETE CASCADE,
  version_number  integer NOT NULL,
  subject_tmpl    text NOT NULL,
  preheader_tmpl  text,
  html_source     text NOT NULL,
  custom_vars     jsonb NOT NULL DEFAULT '{}'::jsonb,
  commit_message  text,
  created_by      text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_template_custom_version_unique UNIQUE (template_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_template_version_template
  ON email_template_custom_version (template_id, version_number DESC);
