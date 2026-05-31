-- ===========================================================================
-- Migration 0045 — M5.4 email_campaign_link audience integration
-- ---------------------------------------------------------------------------
-- Ajout audience_id + snapshot_id (FK vers M5.3 tables) + colonne
-- snapshot_listmonk_list_id pour traquer la liste Listmonk éphémère
-- créée au finalize. Tous nullable (campagnes existantes restent valides).
-- ===========================================================================

ALTER TABLE email_campaign_link
  ADD COLUMN IF NOT EXISTS audience_id uuid REFERENCES email_audience(id),
  ADD COLUMN IF NOT EXISTS snapshot_id uuid REFERENCES email_audience_snapshot(id),
  ADD COLUMN IF NOT EXISTS snapshot_listmonk_list_id integer;

CREATE INDEX IF NOT EXISTS idx_campaign_audience
  ON email_campaign_link (audience_id);
