-- ===========================================================================
-- Migration 0013 — chat_runtime_setting
-- ---------------------------------------------------------------------------
-- Stockage clé/valeur pour les toggles pilotés depuis la console admin.
-- Aujourd'hui : `enabled` (bool) → permet de suspendre le chat sans
-- toucher à `CHAT_ENABLED` côté env (qui reste le kill switch ultime).
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "chat_runtime_setting" (
  "key" text PRIMARY KEY,
  "value_bool" boolean,
  "value_text" text,
  "updated_by" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Seed la valeur par défaut : chat actif si l'env l'autorise.
INSERT INTO "chat_runtime_setting" ("key", "value_bool", "updated_by")
VALUES ('enabled', true, 'system')
ON CONFLICT ("key") DO NOTHING;
