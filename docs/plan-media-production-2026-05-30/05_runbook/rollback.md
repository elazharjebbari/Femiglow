# Rollback — per phase

> The work is **additive + feature-flag-gated** on local `master`/`feat/media-production-mp`,
> so the fastest mitigation is almost always the **flag kill-switch** (§Flag), not a
> code revert. DB rollback is reserved for migration problems. Companions:
> [`runbook.md`](runbook.md), [`db-migration.md`](../00_global/db-migration.md),
> [`commands.sh`](commands.sh). `[USER]` = run by the user via the `!` prefix
> (interactive/privileged).

## Decision order (fastest safe mitigation first)

1. **Feature flag OFF** (§Flag) — instant; restores today's behavior byte-for-byte
   (D6). Use for any UI/behavior regression once the flag is on staging.
2. **PM2 restart to previous build** (§PM2) — if a deploy/build is bad.
3. **Git revert** (§Git) — to drop code changes (work is additive, so reverting is clean).
4. **DB migration down** (§DB) — only for migration `0064` problems; **last resort**,
   and never drops the enum value.

Sacrosanct during any rollback: **publishing stays `dry_run`**; never enable live.

---

## §Flag — feature-flag kill-switch (P1–P5, primary mitigation)

Flag: `CONTENT_STUDIO_MEDIA_STUDIO_ENABLED` (default `false`). OFF ⇒ the entire
Studio-média surface is hidden and no new routes are reachable from the UI;
`generateVisualForDraft` + the 4-step flow are untouched.

```bash
# Inspect current value
grep -n 'CONTENT_STUDIO_MEDIA_STUDIO_ENABLED' apps/web/.env

# [USER] turn the flag OFF on staging and reload the running process
#   edit apps/web/.env → CONTENT_STUDIO_MEDIA_STUDIO_ENABLED=false  (or remove the line)
# ! pm2 restart web --update-env

# Verify health after restart
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8012/api/health   # expect 200
```

Effect: immediate; no code or DB change. This is the **first** thing to do for any
P4/P5 behavior regression.

---

## §PM2 — restart to the previous build (P4/P5)

Staging runs PM2 process `web` on :8012 (`pnpm start`, prod build). If a new build
is bad, rebuild from the previous good commit and restart.

```bash
# Roll the code back to the last good commit (see §Git), then rebuild + restart:
pnpm -C apps/web run build
# ! pm2 restart web --update-env
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8012/api/health   # expect 200
# ! pm2 logs web --lines 50   # inspect on failure
```

> There is no separate "previous artifact" store — the prod build is produced from the
> checked-out tree. So a PM2 rollback = `git` rollback (§Git) + `build` + `pm2 restart`.

---

## §Git — revert additive code (P0–P5)

All changes are additive; reverting cannot break existing flows.

```bash
# See what the plan added since branching
git -C /var/www/femiglow-staging log --oneline master..HEAD

# Revert a single task's commit (preferred — keeps history)
git -C /var/www/femiglow-staging revert <commit-sha>

# Or drop the whole feature branch and return to staging master
git -C /var/www/femiglow-staging switch master
# (optional) delete the work branch once abandoned:
# git -C /var/www/femiglow-staging branch -D feat/media-production-mp

# Discard uncommitted edits to a file
git -C /var/www/femiglow-staging restore apps/web/src/lib/content-studio/service.ts
```

After any git rollback that affects shipped code: `pnpm -C apps/web run typecheck &&
pnpm -C apps/web run build` then §PM2 restart.

---

## §DB — migration `0064` down (P0, last resort)

Source of truth: [`db-migration.md`](../00_global/db-migration.md) §3–§4. The down
migration is **additive-safe**: it reverts the role backfill, drops the
feature-introduced bindings, drops the `meta_json` column, and **intentionally leaves
the `media_kind='subtitles'` enum value** (Postgres has no `DROP VALUE`; removing it
is destructive — see db-migration §4).

> Only run the down migration if `0064`'s forward apply is broken AND the feature flag
> is OFF in prod (the down deletes audio/subtitles/composed bindings — safe only when
> nothing relies on them). Take a fresh DB backup first.

```bash
# Pre-check: confirm flag is OFF before any destructive binding cleanup
grep -n 'CONTENT_STUDIO_MEDIA_STUDIO_ENABLED' apps/web/.env

# [USER] fresh backup before rollback
# ! pg_dump "$DATABASE_URL" --schema-only -f /var/backups/femiglow-preRollback-$(date +%F).sql

# [USER] apply the down migration (DESTRUCTIVE to feature rows — review db-migration.md §3)
#   The down SQL lives at: apps/web/drizzle/migrations/0064_media_production_bundle.down.sql
# ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/web/drizzle/migrations/0064_media_production_bundle.down.sql

# Verify reversal
# ! psql "$DATABASE_URL" -c "SELECT count(*) FROM content_asset_binding WHERE role='primary';"   # expect legacy rows restored
# ! psql "$DATABASE_URL" -c "SELECT count(*) FROM content_asset_binding WHERE role IN ('voiceover','music','subtitles','composed_video');"  # expect 0
# ! psql "$DATABASE_URL" -c "\\d content_asset_binding"   # meta_json column gone
```

What the down SQL does (from db-migration.md §3):
1. `UPDATE … SET role='primary' WHERE role IN ('primary_image','primary_video')` — revert backfill.
2. `DELETE … WHERE role IN ('voiceover','music','subtitles','composed_video')` — drop feature bindings (DESTRUCTIVE; safe only flag-off).
3. `ALTER TABLE content_asset_binding DROP COLUMN IF EXISTS meta_json` — drop the added column.
4. `media_kind='subtitles'` left in place (harmless; no rows use it after step 2).

> Optional, only if a fully clean state is required: delete orphaned `media` rows of
> `kind IN ('audio','subtitles')` and the `composed_video` mp4s **through the media
> service** (storage cleanup), not raw SQL (db-migration §3 note).

---

## Per-phase quick reference

| Phase | Primary rollback | Command anchor |
|---|---|---|
| P0 (architecture/migration) | §Git for code; §DB for migration `0064` | `git revert` / `0064_*.down.sql` |
| P1 voice-over | §Flag (if flag on) else §Git | flag OFF / `git revert` |
| P2 subtitles | §Flag else §Git | flag OFF / `git revert` |
| P3 compose | §Flag else §Git | flag OFF / `git revert` |
| P4 flag rollout | **§Flag** (turn it back OFF) + §PM2 | flag OFF + `pm2 restart web` |
| P5 hardening | §Flag, then §Git, then §PM2 | flag OFF / `git revert` / rebuild+restart |

After **any** rollback: re-run preflight rows 8–12 (typecheck, build, health 200,
dry_run) before declaring the system stable.
