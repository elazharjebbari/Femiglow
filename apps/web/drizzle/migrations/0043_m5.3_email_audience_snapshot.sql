-- ===========================================================================
-- Migration 0043 — M5.3 email_audience_snapshot (matérialisations figées)
-- ---------------------------------------------------------------------------
-- Snapshot d'une audience à un instant T. Membres dans
-- email_audience_snapshot_member. Push Listmonk éphémère au send.
-- Purge automatique à `purgeable_after` (default created_at + 90j).
-- ===========================================================================

CREATE TABLE IF NOT EXISTS email_audience_snapshot (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_id         uuid NOT NULL REFERENCES email_audience(id) ON DELETE CASCADE,
  snapshot_key        text,
  status              text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'done', 'errored')),
  size                integer NOT NULL DEFAULT 0,
  rules_snapshot      jsonb NOT NULL,
  exclusion_snapshot  jsonb NOT NULL,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  listmonk_list_id    integer,
  listmonk_list_name  text,
  errored_at          timestamptz,
  errored_reason      text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  purgeable_after     timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  CONSTRAINT email_audience_snapshot_key_unique UNIQUE (audience_id, snapshot_key)
);

CREATE INDEX IF NOT EXISTS idx_snapshot_audience
  ON email_audience_snapshot (audience_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_snapshot_purge
  ON email_audience_snapshot (purgeable_after)
  WHERE listmonk_list_id IS NOT NULL;
