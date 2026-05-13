-- ===========================================================================
-- Migration 0034 — Event mappings : insert/upsert version __default__
-- ---------------------------------------------------------------------------
-- ATTENTION : cette migration insère un placeholder vide. Le seed RÉEL des
-- mappings est fait par `scripts/seed-event-mappings.ts` qui lit le fichier
-- `docs/event-mappings/20-data/default-mapping.json` (source de vérité,
-- versionnée git).
-- ===========================================================================

INSERT INTO "event_mapping_versions" (
  id, name, status, is_active, is_default, mappings, created_by
) VALUES (
  '__default__',
  'FemiGlow Factory Default',
  'archived',
  false,
  true,
  '{}'::jsonb,
  'system'
)
ON CONFLICT (id) DO NOTHING;
