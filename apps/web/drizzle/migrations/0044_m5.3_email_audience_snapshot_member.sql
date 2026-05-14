-- ===========================================================================
-- Migration 0044 — M5.3 email_audience_snapshot_member
-- ---------------------------------------------------------------------------
-- Emails dans un snapshot. Composite PK (snapshot_id, email) pour
-- idempotency (ON CONFLICT DO NOTHING au push) et lookup rapide.
-- Email dupliqué intentionnellement (vs FK leads.email) : la snapshot
-- survit à un effacement RGPD du lead — purgée séparément à J+90.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS email_audience_snapshot_member (
  snapshot_id   uuid NOT NULL REFERENCES email_audience_snapshot(id) ON DELETE CASCADE,
  email         text NOT NULL,
  payload       jsonb,
  PRIMARY KEY (snapshot_id, email)
);

CREATE INDEX IF NOT EXISTS idx_member_email
  ON email_audience_snapshot_member (email);
