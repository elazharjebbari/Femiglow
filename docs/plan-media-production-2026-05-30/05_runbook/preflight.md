# Preflight — pre-execution checklist

> Run this BEFORE touching any code or applying migration `0064`. Every row must be
> ✅ or have a recorded, accepted exception. Commands are non-destructive (read-only)
> except the explicit DB backup, which only reads. Companion:
> [`runbook.md`](runbook.md), [`commands.sh`](commands.sh), [`rollback.md`](rollback.md).

## Checklist

| # | item | command | expected | blocking? |
|---|---|---|---|---|
| 1 | Working tree clean (no stray changes) | `git -C /var/www/femiglow-staging status --porcelain` | empty output (or only intended plan docs) | yes |
| 2 | On the right branch | `git -C /var/www/femiglow-staging branch --show-current` | `master` (then branch off to `feat/media-production-mp`) | yes |
| 3 | Latest local commit known | `git -C /var/www/femiglow-staging log --oneline -1` | the staging HEAD you expect | yes |
| 4 | Node/pnpm available | `pnpm -C apps/web -v` | prints a version | yes |
| 5 | Dependencies installed | `pnpm -C apps/web install --frozen-lockfile` | up to date, no lockfile drift | yes |
| 6 | **ffmpeg-static present** | `ls apps/web/node_modules/ffmpeg-static/` | dir exists (LICENSE/README/example.js + binary) | yes |
| 7 | fluent-ffmpeg present | `ls apps/web/node_modules/fluent-ffmpeg/package.json` | file exists | yes |
| 8 | Typecheck baseline green | `pnpm -C apps/web run typecheck` | `tsc --noEmit` exits 0 | yes |
| 9 | Build baseline green | `pnpm -C apps/web run build` | `next build` succeeds | yes |
| 10 | Staging process up | `pm2 list` | process `web` `online` on :8012 | yes |
| 11 | **Health 200** | `curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8012/api/health` | `200` | yes |
| 12 | **Publishing is dry_run** | `grep -n '^SOCIAL_PUBLISHING_MODE=' apps/web/.env apps/web/.env.example` | `dry_run` (never `live`) | yes (sacrosanct) |
| 13 | Feature flag default OFF | `grep -n 'CONTENT_STUDIO_MEDIA_STUDIO_ENABLED' apps/web/.env apps/web/.env.example 2>/dev/null` | absent or `false` (added by MP-AR-006) | yes |
| 14 | No secrets staged for commit | `git -C /var/www/femiglow-staging diff --cached -- apps/web/.env` | empty (.env is gitignored; never commit keys) | yes |
| 15 | Migration journal valid | `pnpm -C apps/web run db:validate:strict` | no errors | yes |
| 16 | Next migration number free | `ls apps/web/drizzle/migrations/ \| sort \| tail -3` | last is `0063_*`; `0064` is free | yes |
| 17 | Migration plan shows nothing unexpected | `pnpm -C apps/web run db:migrate-safe -- --plan` | no surprise pending migrations before `0064` is authored | yes |
| 18 | **DB backup taken** (read-only dump) | **[USER]** `!pg_dump "$DATABASE_URL" --schema-only -f /var/backups/femiglow-preMP-$(date +%F).sql` (and/or a full Neon branch/snapshot) | dump file written; restore path known | yes |
| 19 | EditorialCalendar baseline captured | `pnpm -C apps/web exec vitest run src/components/admin/content-studio/EditorialCalendar.test.tsx` | record the pre-existing failure signature (sanctioned exception) | yes |
| 20 | Disk headroom for media/temp | `df -h /var/www/femiglow-staging` | enough free space for compose temp files | no (warn) |

## Sign-off

- [ ] All blocking rows ✅
- [ ] DB backup location recorded in the evidence log
- [ ] EditorialCalendar baseline signature recorded
- [ ] `dry_run` confirmed; flag OFF confirmed
- [ ] Operator/agent piloting per [`pilot.md`](pilot.md)

Only after sign-off proceed to **P0 step 0.2** in [`runbook.md`](runbook.md).

> Notes:
> - The DB dump (row 18) and any psql with interactive auth must be run by the
>   **user** via the `!` prefix; the agent cannot enter interactive credentials.
> - `.env` is gitignored — confirm before assuming row 14 is trivially green.
> - If health (row 11) is not 200, do not start: fix staging first (PM2 restart,
>   see [`commands.sh`](commands.sh)).
