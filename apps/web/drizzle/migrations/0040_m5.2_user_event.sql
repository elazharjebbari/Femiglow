-- ===========================================================================
-- Migration 0040 — M5.2 user_event (events utilisateur unifiés)
-- ---------------------------------------------------------------------------
-- Table centrale qui agrège tous les events utilisateur depuis 4 sources :
--   web    : tracking GTM / page views / cart actions
--   email  : webhooks Stalwart + Listmonk (delivered, opened, clicked, ...)
--   server : actions back-end (order.placed, lead.created, ...)
--   admin  : actions admin (lead.status_changed, ...)
--   import : backfill one-shot ou import externe
--
-- Sera la source de vérité pour :
--  - audience builder (M5.3) : "users avec ≥ 3 cart.added in last 7d"
--  - automation conditions (M5.5) : "user.opened email X in last 30d"
--  - dashboard insights admin
--
-- Cf. docs/emailing/admin-evolution/01-data/01-tables.md#user_event
-- ===========================================================================

CREATE TABLE IF NOT EXISTS user_event (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email       text NOT NULL,
  event_name  text NOT NULL,
  ts          timestamptz NOT NULL DEFAULT now(),
  properties  jsonb NOT NULL DEFAULT '{}'::jsonb,
  session_id  text,
  source      text NOT NULL CHECK (source IN ('web', 'server', 'email', 'admin', 'import')),
  lead_id     text REFERENCES leads(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Note : les indexes lourds (GIN, composite avec DESC) sont posés dans
-- 0041 en CONCURRENTLY pour ne pas bloquer la prod le jour du déploiement.
-- Index simple (lead_id) ici pour les FK constraint checks.
CREATE INDEX IF NOT EXISTS idx_user_event_lead_id ON user_event (lead_id);
