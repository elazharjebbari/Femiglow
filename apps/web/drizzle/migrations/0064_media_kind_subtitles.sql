-- @no-transaction:true
-- 0064 — Media production (BUG-004, MP-AR-005): widen media_kind with 'subtitles'.
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction; IF NOT EXISTS makes
-- re-runs safe. The enum value is permanent (Postgres has no DROP VALUE) and is
-- harmless when unused — see docs/plan-media-production-2026-05-30/00_global/db-migration.md §4.
ALTER TYPE media_kind ADD VALUE IF NOT EXISTS 'subtitles' AFTER 'audio';
