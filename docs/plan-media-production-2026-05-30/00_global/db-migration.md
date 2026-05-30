# DB migration (MP-AR-005) — additive only

> Migration dir: `apps/web/drizzle/migrations/` (hand-numbered SQL, next free
> number is **`0064`**; last is `0063_ai_engine_tables.sql`). Config:
> `drizzle.config.ts` (schemas include `schema.ts` + `schema-content-studio.ts`,
> `out: ./drizzle/migrations`, `dialect: postgresql`, `strict: true`).
> Principle: **no destructive change** — add an enum value, add one column,
> backfill a renamed role. Reversible except the enum `ADD VALUE` (harmless, see §4).

---

## 1. Schema source edits (Drizzle)

1. `schema.ts` L284 — add `'subtitles'` to `media_kind` (see
   [data-model.md](./data-model.md) §4.1).
2. `schema-content-studio.ts` `contentAssetBindings` — add
   `meta: jsonb('meta_json').notNull().default({})` (§4.2).

These are the only model edits. After editing, the SQL below is what
`drizzle-kit generate` would produce (review by hand to keep it additive).

## 2. Forward migration — `0064_media_production_bundle.sql`

```sql
-- 0064 — Media production: per-draft media bundle (BUG-004, MP-AR-005)
-- Additive only: +enum value, +meta column, +role backfill. No drop.

-- 1) Widen media_kind with 'subtitles' (idempotent guard).
--    Postgres requires ADD VALUE outside a transaction block; run standalone.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'media_kind' AND e.enumlabel = 'subtitles'
  ) THEN
    ALTER TYPE media_kind ADD VALUE 'subtitles';
  END IF;
END$$;

-- 2) Per-role metadata on bindings (SRT text, compose flags).
ALTER TABLE content_asset_binding
  ADD COLUMN IF NOT EXISTS meta_json JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3) Backfill the legacy single role 'primary' to the typed visual roles.
--    A binding is a video iff its media row is kind='video', else image.
UPDATE content_asset_binding b
SET role = CASE
    WHEN m.kind = 'video' THEN 'primary_video'
    ELSE 'primary_image'
  END
FROM media m
WHERE b.media_id = m.id
  AND b.role = 'primary';

-- 3b) Safety net: any 'primary' bindings whose media is missing → primary_image.
UPDATE content_asset_binding
SET role = 'primary_image'
WHERE role = 'primary';

-- Note: the UNIQUE(draft_id, role) index 'content_asset_binding_draft_role_unique'
-- already exists and is unaffected (each draft still had at most one 'primary' row,
-- which maps to exactly one primary_image/primary_video → no collision).
```

> **Why the enum `DO $$` guard + standalone run:** `ALTER TYPE … ADD VALUE` cannot
> run inside a transaction that later uses the new value, and errors if the label
> exists. The guard makes re-runs safe. If the migration runner wraps everything in
> one transaction, split step 1 into its own file/run (e.g.
> `0064a_media_kind_subtitles.sql`).

## 3. Rollback — `0064_media_production_bundle.down.sql`

```sql
-- Rollback 0064. Reverses the additive column + role backfill.
-- The enum value 'subtitles' is intentionally NOT removed (see §4).

-- 1) Revert typed visual roles back to the legacy 'primary'.
UPDATE content_asset_binding
SET role = 'primary'
WHERE role IN ('primary_image', 'primary_video');

-- 2) Drop the audio/subtitles/composed bindings introduced by this feature
--    (only safe because the feature is flag-gated and off in prod on rollback).
DELETE FROM content_asset_binding
WHERE role IN ('voiceover', 'music', 'subtitles', 'composed_video');

-- 3) Drop the meta column.
ALTER TABLE content_asset_binding DROP COLUMN IF EXISTS meta_json;

-- media_kind 'subtitles' is left in place (harmless: no rows use it after step 2's
-- media cleanup; removing an enum value requires a type swap and risks data loss).
```

> Before running the rollback, also delete the orphaned `media` rows of
> `kind IN ('audio','subtitles')` and the `composed_video` mp4s if a clean state is
> required (optional; left out of the SQL because `media` deletion goes through the
> media service to clean storage).

## 4. Why the enum value is not reverted

Postgres has no `DROP VALUE` for enums. Removing `'subtitles'` means: create a new
type without it, rewrite the `media.kind` column, drop the old type — a destructive,
lock-heavy operation. Since (a) the feature is flag-gated off by default and (b) an
unused enum label costs nothing, we **leave `'subtitles'` permanently**. This keeps
rollback fast and non-destructive (ground-truth §6: "no destructive change").

## 5. Data-backfill note

- **Existing prod data**: every current `content_asset_binding` has `role='primary'`
  (the only value `upsertPrimaryAsset` ever wrote — see
  [architecture-current.md](./architecture-current.md) §5). Step 3 deterministically
  maps each to `primary_image`/`primary_video` by joining `media.kind`. Because each
  draft had at most one `primary` row, no `(draft_id, role)` unique collision is
  possible.
- **`meta_json`**: defaults to `'{}'` for all existing rows; no read path requires it
  to be populated.
- **`listPrimaryAssetsForDrafts`** (repository.ts L500) must widen its filter to
  `role IN ('primary_image','primary_video')` in the **same PR** as this migration,
  or library/primary-asset views will appear empty post-backfill. (Tracked under
  MP-AR-003.)
- **Idempotency**: all steps use `IF NOT EXISTS` / guarded `DO $$` / filtered
  `UPDATE`, so re-applying is safe.

## 6. Verification (post-apply)

```sql
-- enum has the new value
SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
WHERE t.typname='media_kind';                  -- expect image,video,audio,subtitles

-- no legacy 'primary' role remains
SELECT count(*) FROM content_asset_binding WHERE role='primary';   -- expect 0

-- column exists, defaulted
SELECT count(*) FROM content_asset_binding WHERE meta_json = '{}'::jsonb; -- = total rows
```

Acceptance ref: program **PA-09** in [scope-and-outcomes.md](./scope-and-outcomes.md).
