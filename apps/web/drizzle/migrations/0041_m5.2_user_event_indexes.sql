-- ===========================================================================
-- Migration 0041 — M5.2 user_event indexes (CONCURRENTLY)
-- ---------------------------------------------------------------------------
-- Indexes critiques pour les queries chaudes du builder d'audiences :
--   (email, ts DESC)  → "events de cet email récents"
--   (event_name, ts)  → "tous les cart.added des 7 derniers jours"
--   (session_id)      → analytics par session (rare, partiel)
--   GIN(properties)   → filtres sur propriétés event (cart total, productId, ...)
--
-- CONCURRENTLY pour ne pas bloquer la table le jour où elle aura du volume.
-- Drizzle migrator exécute chaque statement séparément.
-- ===========================================================================

CREATE INDEX IF NOT EXISTS idx_user_event_email_ts
  ON user_event (email, ts DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_user_event_name_ts
  ON user_event (event_name, ts DESC);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_user_event_session
  ON user_event (session_id)
  WHERE session_id IS NOT NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_user_event_properties_gin
  ON user_event USING gin (properties);
