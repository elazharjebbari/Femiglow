#!/usr/bin/env bash
# =============================================================================
# commands.sh — Media Production runbook command reference (copy-paste friendly)
# =============================================================================
# Plan: docs/plan-media-production-2026-05-30/  (see 05_runbook/runbook.md)
#
# SAFETY:
#   * NON-destructive commands run as-is.
#   * DESTRUCTIVE / state-changing commands are COMMENTED OUT with a warning.
#     Uncomment deliberately. Privileged/interactive ones are marked [USER] and
#     must be run by the user via the `!` prefix in this harness.
#   * SACROSANCT: publishing stays SOCIAL_PUBLISHING_MODE=dry_run — NEVER set live.
#   * `tsc --noEmit` is a HARD gate (vitest does NOT typecheck).
#
# This file is a reference, not an orchestrator. Run blocks intentionally.
# Repo root is fixed; all pnpm calls use `-C apps/web`.
# =============================================================================

set -euo pipefail
REPO=/var/www/femiglow-staging
APP="$REPO/apps/web"
HEALTH=http://127.0.0.1:8012/api/health
cd "$REPO"

# -----------------------------------------------------------------------------
# 0. Environment sanity (read-only)
# -----------------------------------------------------------------------------
pnpm -C apps/web -v                                   # pnpm present
ls apps/web/node_modules/ffmpeg-static/               # ffmpeg-static present (compose dep)
pm2 list                                              # PM2 process `web` online on :8012
grep -n '^SOCIAL_PUBLISHING_MODE=' apps/web/.env apps/web/.env.example  # MUST be dry_run
grep -n 'CONTENT_STUDIO_MEDIA_STUDIO_ENABLED' apps/web/.env apps/web/.env.example || true  # flag (default false)

# -----------------------------------------------------------------------------
# 1. Health
# -----------------------------------------------------------------------------
curl -fsS -o /dev/null -w 'health=%{http_code}\n' "$HEALTH"   # expect 200

# -----------------------------------------------------------------------------
# 2. Build / typecheck (the gates)
# -----------------------------------------------------------------------------
pnpm -C apps/web run typecheck      # tsc --noEmit  — HARD GATE, must exit 0
pnpm -C apps/web run build          # next build (the deployed prod artifact)

# -----------------------------------------------------------------------------
# 3. Tests (see runbook-test-battery.md for the full sequence & globs)
# -----------------------------------------------------------------------------
pnpm -C apps/web exec vitest run                                  # full unit/integration battery
pnpm -C apps/web exec vitest run src/lib/ai-engine src/lib/content-studio   # backbone (P0)
pnpm -C apps/web exec vitest run -t "mode=mock"                   # single named test while debugging
pnpm -C apps/web exec playwright test e2e/content-studio-v2      # E2E (mock mode) on :8012
pnpm -C apps/web exec playwright test e2e/content-studio-v2/create-golden-path.spec.ts  # non-regression golden path
# Subtitles JSON contract validity:
python3 -m json.tool docs/plan-media-production-2026-05-30/03_subtitles/data-contract.json >/dev/null && echo "subtitles data-contract: valid JSON"

# -----------------------------------------------------------------------------
# 4. Git (work is additive; branch off staging master)
# -----------------------------------------------------------------------------
git -C "$REPO" status --porcelain                # clean tree check
git -C "$REPO" branch --show-current             # expect master, then branch off:
# git -C "$REPO" switch -c feat/media-production-mp
git -C "$REPO" log --oneline master..HEAD || true   # what the plan added
# Revert a single task commit (non-destructive history):
# git -C "$REPO" revert <commit-sha>
# Discard uncommitted edits to one file:
# git -C "$REPO" restore apps/web/src/lib/content-studio/service.ts

# -----------------------------------------------------------------------------
# 5. DB migration 0064 (additive; custom hash runner supports ALTER TYPE ADD VALUE)
#    Authoring note: prefix the .sql with `-- @no-transaction:true` so the
#    enum ADD VALUE runs unwrapped (db-migration.md §2).
# -----------------------------------------------------------------------------
pnpm -C apps/web run db:validate:strict          # migration journal/hash integrity
pnpm -C apps/web run db:migrate-safe -- --plan   # DRY: show pending migrations, writes nothing
# ---- [USER] APPLY (state-changing). Run via `!`. Take a DB backup first (§8). ----
# ! pnpm -C apps/web run db:migrate-safe          # applies 0064 (additive: +enum, +meta_json, role backfill)

# Post-apply verification (read-only). Run via [USER]/`!` since DB auth is interactive:
# ! psql "$DATABASE_URL" -c "SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='media_kind';"   # expect image,video,audio,subtitles
# ! psql "$DATABASE_URL" -c "SELECT count(*) FROM content_asset_binding WHERE role='primary';"                                    # expect 0
# ! psql "$DATABASE_URL" -c "SELECT count(*) FROM content_asset_binding WHERE meta_json = '{}'::jsonb;"                           # = total rows

# ---- DOWN migration (DESTRUCTIVE: deletes feature bindings; flag MUST be OFF) ----
# ---- See rollback.md §DB. Take a fresh backup first. Run via [USER]/`!`. ----
# ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/web/drizzle/migrations/0064_media_production_bundle.down.sql

# -----------------------------------------------------------------------------
# 6. Feature flag toggle (kill-switch). Edit apps/web/.env then reload PM2.
# -----------------------------------------------------------------------------
grep -n 'CONTENT_STUDIO_MEDIA_STUDIO_ENABLED' apps/web/.env || true   # inspect current value
# ---- Turn flag ON (staging only, gate G-P4). [USER]: edit .env then: ----
#   apps/web/.env →  CONTENT_STUDIO_MEDIA_STUDIO_ENABLED=true
# ! pm2 restart web --update-env
# ---- Kill-switch: turn flag OFF (instant rollback to today's behavior). [USER]: ----
#   apps/web/.env →  CONTENT_STUDIO_MEDIA_STUDIO_ENABLED=false   (or delete the line)
# ! pm2 restart web --update-env
curl -fsS -o /dev/null -w 'health=%{http_code}\n' "$HEALTH"   # expect 200 after any restart

# -----------------------------------------------------------------------------
# 7. PM2 process control (staging runtime)
# -----------------------------------------------------------------------------
pm2 list                              # status of `web`
# ! pm2 restart web --update-env       # [USER] reload with current .env (after build or flag change)
# ! pm2 logs web --lines 50            # [USER] inspect logs on failure

# -----------------------------------------------------------------------------
# 8. DB backup (read-only dump; run before any migration apply/rollback)
# -----------------------------------------------------------------------------
# ! pg_dump "$DATABASE_URL" --schema-only -f /var/backups/femiglow-preMP-$(date +%F).sql   # [USER]
#   (and/or take a Neon branch/snapshot — see preflight.md row 18)

# -----------------------------------------------------------------------------
# 9. Dry-run publishing guard (assert before/after any publish-path work)
# -----------------------------------------------------------------------------
grep -q '^SOCIAL_PUBLISHING_MODE=dry_run' apps/web/.env \
  && echo "OK: publishing is dry_run" \
  || echo "STOP: SOCIAL_PUBLISHING_MODE is not dry_run — DO NOT PROCEED"

echo "commands.sh: reference loaded. Run blocks intentionally; destructive ones are commented."
