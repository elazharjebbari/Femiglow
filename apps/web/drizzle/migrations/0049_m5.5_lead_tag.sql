-- ===========================================================================
-- Migration 0049 — M5.5 lead_tag (tags manuels + automation)
-- ---------------------------------------------------------------------------
-- Tags attribuables à un lead manuellement (admin) ou via step automation
-- (kind='tag', action='add'). Utilisable en audience filter (has_tag).
-- ===========================================================================

CREATE TABLE IF NOT EXISTS lead_tag (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     text NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tag         text NOT NULL,
  source      text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'automation', 'import')),
  source_ref  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_tag_unique UNIQUE (lead_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_lead_tag_tag ON lead_tag (tag);
CREATE INDEX IF NOT EXISTS idx_lead_tag_lead ON lead_tag (lead_id);
