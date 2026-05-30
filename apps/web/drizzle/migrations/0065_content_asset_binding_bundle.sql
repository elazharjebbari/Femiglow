-- 0065 — Media production (BUG-004, MP-AR-005): per-draft media bundle.
-- Additive + non-destructive: +meta_json column, backfill the legacy single
-- role 'primary' to the typed visual roles. Transactional (no enum/concurrent op).
-- Rollback is documented in docs/plan-media-production-2026-05-30/05_runbook/rollback.md.

-- 1) Per-role metadata on bindings (SRT text, compose flags, crop, etc.).
ALTER TABLE content_asset_binding
  ADD COLUMN IF NOT EXISTS meta_json JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2) Backfill the legacy single role 'primary' to typed visual roles.
--    A binding is a video iff its media row is kind='video', else image.
--    Each draft had at most one 'primary' row → no (draft_id, role) collision.
UPDATE content_asset_binding b
SET role = CASE
    WHEN m.kind = 'video' THEN 'primary_video'
    ELSE 'primary_image'
  END
FROM media m
WHERE b.media_id = m.id
  AND b.role = 'primary';

-- 2b) Safety net: any remaining 'primary' (orphaned media) → primary_image.
UPDATE content_asset_binding
SET role = 'primary_image'
WHERE role = 'primary';

-- The UNIQUE(draft_id, role) index 'content_asset_binding_draft_role_unique'
-- already exists and is unaffected.
