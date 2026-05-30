# Runbook — Media Production execution (master)

> THE master runbook piloting the full media-production plan. Tasks `MP-RB-*`.
> Read first: [`00_global/ground-truth-codebase.md`](../00_global/ground-truth-codebase.md)
> (§3 decisions, §4 IDs, §6 quality bar), [`decision-log.md`](../00_global/decision-log.md),
> [`db-migration.md`](../00_global/db-migration.md),
> [`dependency-graph.puml`](../00_global/dependency-graph.puml).
> Sibling runbook files: [`preflight.md`](preflight.md), [`go-no-go.md`](go-no-go.md),
> [`rollback.md`](rollback.md), [`commands.sh`](commands.sh),
> [`execution-checklist.csv`](execution-checklist.csv), [`pilot.md`](pilot.md),
> [`runbook-test-battery.md`](runbook-test-battery.md).

## Sacrosanct invariants (never violate)

1. **Publishing stays `SOCIAL_PUBLISHING_MODE=dry_run`.** Never set `live`. Every
   publish step in this plan is a dry-run simulation. This guard is verified in
   preflight and at every go/no-go gate.
2. **`tsc --noEmit` is a hard gate.** Vitest does NOT typecheck — two build-breakers
   shipped this week. No phase exits green until `pnpm -C apps/web run typecheck`
   passes. (`pnpm -C apps/web exec tsc --noEmit` is the same gate.)
3. **Additive + flag-gated.** Every change is additive and behind
   `CONTENT_STUDIO_MEDIA_STUDIO_ENABLED` (default `false`). Flag off ⇒ today's
   behavior byte-for-byte (D6). The flag is NOT flipped on staging until gate **G-P4**.
4. **No destructive DB change.** Migration `0064` is additive (enum value + column +
   role backfill). Rollback never drops the enum value (Postgres has no `DROP VALUE`).
5. **No secrets committed.** Live provider keys live only in the PM2 process env.

## Environment facts (real — used by every command)

| Fact | Value |
|---|---|
| Repo root | `/var/www/femiglow-staging` |
| App root | `apps/web` |
| Staging process | PM2 process **`web`** on **:8012** (`pnpm start`, prod build) |
| Build | `pnpm -C apps/web run build` (`next build`) |
| Typecheck gate | `pnpm -C apps/web run typecheck` (`tsc --noEmit`) |
| Unit/integration tests | `pnpm -C apps/web exec vitest run` |
| E2E | Playwright on :8012 — `pnpm -C apps/web exec playwright test` |
| Health | `curl -fsS http://127.0.0.1:8012/api/health` → 200 |
| Public URL | `https://staging.femiglow-maroc.com` |
| Migration runner | `pnpm -C apps/web run db:migrate-safe` (custom hash runner; `--plan` previews; supports `-- @no-transaction:true` for `ALTER TYPE ADD VALUE`) |
| Next free migration | `0064` (last is `0063_ai_engine_tables.sql`) |
| Branch | `master` (local staging branch, not pushed to origin) |
| Feature flag | `CONTENT_STUDIO_MEDIA_STUDIO_ENABLED` (`z.enum(['true','false']).default('false')`, env.ts + .env.example) |
| ffmpeg | `ffmpeg-static` + `fluent-ffmpeg` (already installed under `apps/web/node_modules`) |

> Interactive logins (psql with prompts, `gh auth`, etc.) must be run by the **user**
> via the `!` prefix. The runbook marks those steps `[USER]`.

## Phase map and gates

| Phase | Scope | Task ids | Exit gate |
|---|---|---|---|
| **P0** Prerequisites + architecture backbone | DTO, bridge, repo bundle, kinds, migration `0064`, flag | `MP-AR-001..006` | **G-P0** |
| **P1** Voice-over | node core, schema, service, route, UI track | `MP-VO-*` | **G-P1** |
| **P2** Subtitles | SRT lib, core, schemas, service, routes, editor UI | `MP-SU-*` | **G-P2** |
| **P3** Compose (montage) | compose core, schema, service, route, panel UI, export | `MP-CO-*` | **G-P3** |
| **P4** UI integration + flag rollout | tracks panel wiring, publish summary, flag-on smoke | `MP-VO-07/08`, `MP-SU-09/12`, `MP-CO-07/08`, `MP-RB-flag` | **G-P4** |
| **P5** E2E + hardening | full test battery, Playwright golden paths, non-regression | `MP-*-09/10/14`, `MP-TB-*` | **G-P5** |

Ordering rationale (from [`dependency-graph.puml`](../00_global/dependency-graph.puml)):
`MP-AR-*` blocks all feature work. Within features the backbone order is
`AR4→AR3`, `AR5→AR3/AR4`, `AR1+AR3→AR2`. Compose consumes voice-over + subtitles,
so **P3 runs after P1/P2** (Compose still degrades gracefully if a track is absent).

**Between every phase, run the correction loop** (green-twice-consecutively) —
see [`runbook-test-battery.md`](runbook-test-battery.md) and
[`04_test-battery/correction-loop.md`](../04_test-battery/correction-loop.md). A phase
is not "done" until its go/no-go in [`go-no-go.md`](go-no-go.md) is **GO**.

---

## P0 — Prerequisites + architecture backbone

Builds the shared backbone (D1, D2) all features consume. Touches
`orchestrator.ts`, `content-studio-bridge.ts`, `repository.ts`,
`content-studio-v2/media/types.ts`, `schema.ts`, `schema-content-studio.ts`,
`drizzle/migrations/0064_*.sql`, `env.ts`, `.env.example`.

| # | action | command | expected | on_failure | rollback_ref | gate |
|---|---|---|---|---|---|---|
| 0.1 | Run preflight checklist | see [`preflight.md`](preflight.md) | all rows ✅ (clean tree, build green, health 200, dry_run, ffmpeg-static present, DB backup) | stop; fix the failing row before any code | — | preflight |
| 0.2 | Branch off staging master (work stays additive/local) | `git -C /var/www/femiglow-staging switch -c feat/media-production-mp` | new branch from `master` | resolve git state | [`rollback.md`](rollback.md) §Git | — |
| 0.3 | Implement `MP-AR-001` extend `GenerationResult` DTO | edit `apps/web/src/lib/ai-engine/orchestrator.ts` (per [`dto-bridge-changes.md`](../00_global/dto-bridge-changes.md)) | optional `voiceover/music/subtitles/composedVideo/transcodedVideo` fields added | revert file | [`rollback.md`](rollback.md) §Git | — |
| 0.4 | Implement `MP-AR-004` widen kinds + `schema.ts` `media_kind` | edit `apps/web/src/lib/content-studio-v2/media/types.ts` + `apps/web/src/lib/db/schema.ts` (L284 add `'subtitles'`) | `StudioV2MediaKind = image\|video\|audio\|subtitles` | revert files | [`rollback.md`](rollback.md) §Git | — |
| 0.5 | Implement `MP-AR-003` `upsertBundleAssets`/`getDraftBundle` (+ keep `upsertPrimaryAsset` shim) | edit `apps/web/src/lib/content-studio/repository.ts` + `content-studio/types.ts` | per-role upsert; legacy shim preserved | revert files | [`rollback.md`](rollback.md) §Git | — |
| 0.6 | Implement `MP-AR-002` extend bridge mapping | edit `apps/web/src/lib/ai-engine/bridge/content-studio-bridge.ts` | every present artifact mapped to its role via `upsertBundleAssets` | revert file | [`rollback.md`](rollback.md) §Git | — |
| 0.7 | Implement `MP-AR-006` feature flag | edit `apps/web/src/env.ts` + `apps/web/.env.example` | `CONTENT_STUDIO_MEDIA_STUDIO_ENABLED` default `false` | revert files | [`rollback.md`](rollback.md) §Flag | — |
| 0.8 | Author migration `MP-AR-005` `0064` (additive) | create `apps/web/drizzle/migrations/0064_media_production_bundle.sql` per [`db-migration.md`](../00_global/db-migration.md) §2; prefix `-- @no-transaction:true` so `ALTER TYPE … ADD VALUE` runs unwrapped | file present, validator clean | fix SQL | [`rollback.md`](rollback.md) §DB | — |
| 0.9 | Validate migration journal | `pnpm -C apps/web run db:validate:strict` | no journal/hash errors | fix migration meta | [`rollback.md`](rollback.md) §DB | — |
| 0.10 | Preview migration (dry, no writes) | `pnpm -C apps/web run db:migrate-safe -- --plan` | shows `0064` as the only pending migration | investigate journal | — | — |
| 0.11 | **[USER]** Apply migration `0064` | `!pnpm -C apps/web run db:migrate-safe` | `0064` applied; enum has `subtitles`; `meta_json` added; no `role='primary'` rows remain | run `0064_*.down.sql` ([`rollback.md`](rollback.md) §DB) | [`rollback.md`](rollback.md) §DB | — |
| 0.12 | Verify migration (post-apply queries) | run [`db-migration.md`](../00_global/db-migration.md) §6 queries (commented in [`commands.sh`](commands.sh)) | enum=`image,video,audio,subtitles`; `count(role='primary')=0`; `meta_json` defaulted | rollback `0064`, re-author | [`rollback.md`](rollback.md) §DB | — |
| 0.13 | Typecheck gate | `pnpm -C apps/web run typecheck` | `tsc --noEmit` exits 0 | fix types; do not proceed | — | **tsc** |
| 0.14 | Run `MP-AR-*` targeted tests | `pnpm -C apps/web exec vitest run src/lib/ai-engine src/lib/content-studio` | backbone tests green; existing CS v2 regression green | triage via correction loop | — | — |
| 0.15 | Build | `pnpm -C apps/web run build` | `next build` succeeds | fix; re-run 0.13–0.15 | — | build |
| 0.16 | Correction loop to green×2 | see [`runbook-test-battery.md`](runbook-test-battery.md) | two consecutive clean runs | iterate | — | loop |
| 0.17 | **Go/No-Go G-P0** | [`go-no-go.md`](go-no-go.md) row G-P0 | GO (backbone merged, migration verified, flag off, dry_run intact) | NO-GO → loop back | — | **G-P0** |

---

## P1 — Voice-over (`MP-VO-*`)

Ordered per [`01_voiceover/dev-plan.md`](../01_voiceover/dev-plan.md). Reuses
`generate-voiceover.ts` node core (D5). Flag stays **off** through P1.

| # | action | command | expected | on_failure | rollback_ref | gate |
|---|---|---|---|---|---|---|
| 1.1 | Confirm P0 backbone present (`MP-VO-00`) | `pnpm -C apps/web run typecheck` | clean across content-studio + ai-engine | go back to P0 | [`rollback.md`](rollback.md) | tsc |
| 1.2 | `MP-VO-01` extract `synthesizeVoiceover` core (node → thin adapter) | edit `apps/web/src/lib/ai-engine/nodes/generate-voiceover.ts` | core extracted; node unchanged behavior | revert | [`rollback.md`](rollback.md) §Git | — |
| 1.3 | Node regression (`MP-VO-13`) | `pnpm -C apps/web exec vitest run src/lib/ai-engine/nodes/generate-voiceover.test.ts` | existing tests 100% green unchanged | fix core extraction | — | — |
| 1.4 | `MP-VO-04` add `voiceoverGenerationSchema` (zod strict) | edit `apps/web/src/lib/content-studio/schemas.ts` | schema rejects empty/unknown keys | revert | — | — |
| 1.5 | `MP-VO-02` implement `generateVoiceoverForDraft` service | edit `apps/web/src/lib/content-studio/service.ts` | mock=silent no provider call; live-no-key=409 | revert | [`rollback.md`](rollback.md) §Git | — |
| 1.6 | `MP-VO-03` create POST route | create `apps/web/src/app/api/admin/content-studio/drafts/[id]/generate-voiceover/route.ts` | mirrors generate-visual; auth + cookie mode | revert | — | — |
| 1.7 | `MP-VO-12` MSW TTS handlers + no-network proof | add `apps/web/src/test/msw/handlers/tts.ts` | `onUnhandledRequest:'error'` proves no network on mock/no-key | fix handlers | — | — |
| 1.8 | `MP-VO-06/05` UI: `AudioTrackPlayer` + `VoiceoverTrack` | add components under `.../create/tracks/` + `.../media/` | a11y player; track states empty/generating/ready/stale/error | revert | — | — |
| 1.9 | `MP-VO-07` wire `VoiceoverTrack` into MediaStudio (flag-gated) | edit `apps/web/src/components/admin/content-studio-v2/create/MediaStudio.tsx` | flag off ⇒ DOM unchanged; flag on + reel ⇒ track present | revert | [`rollback.md`](rollback.md) §Flag | — |
| 1.10 | `MP-VO-08` surface in publish summary | edit `apps/web/src/components/admin/content-studio-v2/create/PublishActionGroup.tsx` | 🎙️ Voix-off ✓ shown when present | revert | — | — |
| 1.11 | Typecheck gate | `pnpm -C apps/web run typecheck` | exit 0 | fix types | — | **tsc** |
| 1.12 | Voice-over vitest suite (`MP-VO-11`) | `pnpm -C apps/web exec vitest run` (or targeted globs in [`runbook-test-battery.md`](runbook-test-battery.md)) | all VO tests + non-regression (`MediaStudio.test.tsx`) green | correction loop | — | — |
| 1.13 | `MP-VO-09` Playwright golden path (mock) | `pnpm -C apps/web exec playwright test e2e/content-studio-v2/voiceover.spec.ts` | operator generates+previews voice-over (mock) | triage | — | — |
| 1.14 | Build | `pnpm -C apps/web run build` | succeeds | fix | — | build |
| 1.15 | Correction loop to green×2 | [`runbook-test-battery.md`](runbook-test-battery.md) | two consecutive clean runs | iterate | — | loop |
| 1.16 | **Go/No-Go G-P1** | [`go-no-go.md`](go-no-go.md) G-P1 | GO | NO-GO → loop | — | **G-P1** |

---

## P2 — Subtitles (`MP-SU-*`)

Ordered per [`03_subtitles/dev-plan.md`](../03_subtitles/dev-plan.md). New SRT lib +
node thin wrapper (D5). Default path makes **zero** network calls. Flag stays off.

| # | action | command | expected | on_failure | rollback_ref | gate |
|---|---|---|---|---|---|---|
| 2.1 | Confirm P0 (`MP-SU-00`) incl. migration `0064` verified | `pnpm -C apps/web run typecheck` + [`db-migration.md`](../00_global/db-migration.md) §6 | clean; `media_kind` has `subtitles` | back to P0 | [`rollback.md`](rollback.md) §DB | tsc |
| 2.2 | `MP-SU-01` create `subtitles/srt.ts` + refactor node to wrapper | add `apps/web/src/lib/ai-engine/subtitles/srt.ts`; edit `generate-subtitles.ts` | SRT round-trip; node unchanged | revert | — | — |
| 2.3 | Node regression (`MP-SU-13`) | `pnpm -C apps/web exec vitest run src/lib/ai-engine/nodes/generate-subtitles.test.ts` | existing tests green unchanged | fix wrapper | — | — |
| 2.4 | `MP-SU-02` add `generateSubtitlesForDraftCore` (pure; optional refine) | add `apps/web/src/lib/ai-engine/subtitles/generate-subtitles-core.ts` | refine=false ⇒ no fetch | revert | — | — |
| 2.5 | `MP-SU-06` schemas (`subtitlesGenerationSchema` + `subtitlesSaveSchema`) | edit `apps/web/src/lib/content-studio/schemas.ts` | strict; defaults; cue limits | revert | — | — |
| 2.6 | `MP-SU-03` service `generateSubtitlesForDraft` + `saveSubtitlesForDraft` | edit `apps/web/src/lib/content-studio/service.ts` | server-authoritative validateCues; `meta.srt == .srt` bytes | revert | — | — |
| 2.7 | `MP-SU-04/05` routes: POST generate-subtitles + PUT subtitles | create the two route files under `.../drafts/[id]/` | mock 200; cueErrors envelope on overlap | revert | — | — |
| 2.8 | `MP-SU-16` MSW refine handler + no-network proof | add `apps/web/src/test/msw/handlers/subtitles-refine.ts` | default path zero calls | fix | — | — |
| 2.9 | `MP-SU-08/10/11/07` UI: CueEditor, StyleControls, OverlayPreview, SubtitlesTrack | add components under `.../create/tracks/` | a11y editor; states empty/editing/invalid/saving/ready | revert | — | — |
| 2.10 | `MP-SU-12` wire `SubtitlesTrack` into MediaStudio (flag-gated) | edit `MediaStudio.tsx` | flag off ⇒ DOM unchanged | revert | [`rollback.md`](rollback.md) §Flag | — |
| 2.11 | `MP-SU-09` pin compose-consumer contract + publish summary | edit `PublishActionGroup.tsx`; assert `compose-subtitles-contract.test.ts` | 💬 Sous-titres ✓; `meta.srt == serializeSrt(cues)` | revert | — | — |
| 2.12 | Typecheck gate + JSON contract valid | `pnpm -C apps/web run typecheck` ; `python3 -m json.tool docs/plan-media-production-2026-05-30/03_subtitles/data-contract.json >/dev/null` | both clean | fix | — | **tsc** |
| 2.13 | Subtitles vitest suite (`MP-SU-15`) | `pnpm -C apps/web exec vitest run` (targeted globs) | all SU tests + non-regression green | correction loop | — | — |
| 2.14 | `MP-SU-14` Playwright golden path (mock) | `pnpm -C apps/web exec playwright test e2e/content-studio-v2/subtitles.spec.ts` | generate→edit→save (mock) | triage | — | — |
| 2.15 | Build + correction loop to green×2 | `pnpm -C apps/web run build` ; [`runbook-test-battery.md`](runbook-test-battery.md) | succeeds; two clean runs | iterate | — | loop |
| 2.16 | **Go/No-Go G-P2** | [`go-no-go.md`](go-no-go.md) G-P2 | GO | NO-GO → loop | — | **G-P2** |

---

## P3 — Compose / montage (`MP-CO-*`)

Ordered per [`02_compose/dev-plan.md`](../02_compose/dev-plan.md). Consumes the
voice-over + subtitles tracks from P1/P2 (degrades gracefully if absent). ffmpeg is
mocked in CI — no real encode; compose makes **zero** HTTP. Flag stays off.

| # | action | command | expected | on_failure | rollback_ref | gate |
|---|---|---|---|---|---|---|
| 3.1 | Confirm P0 + soft-deps P1/P2 (`MP-CO-00`) | `pnpm -C apps/web run typecheck` | clean; `composition→composedVideo` mapping present | back to P0 | [`rollback.md`](rollback.md) | tsc |
| 3.2 | `MP-CO-01` extract `composeMediaBundle` core (mode switch, timeout+SIGKILL, temp cleanup, source-missing throw, codec fallback) | edit `apps/web/src/lib/ai-engine/nodes/compose.ts` | node unchanged; core reusable | revert | — | — |
| 3.3 | Node regression (`MP-CO-11`) | `pnpm -C apps/web exec vitest run src/lib/ai-engine/nodes/compose.test.ts` | existing 8 tests green unchanged | fix extraction | — | — |
| 3.4 | `MP-CO-04` `composeGenerationSchema` (booleans, defaults, strict) | edit `apps/web/src/lib/content-studio/schemas.ts` | empty body ok; rejects unknown keys | revert | — | — |
| 3.5 | `MP-CO-02` service `composeDraftVideo` (bundle-aware, mode-aware) | edit `apps/web/src/lib/content-studio/service.ts` | mock byte-copy no provider; no-primary-video⇒409; tracks report | revert | — | — |
| 3.6 | `MP-CO-03` POST compose route (empty body allowed) | create `.../drafts/[id]/compose/route.ts` | 200 mock; 409 no primary video; error envelope | revert | — | — |
| 3.7 | `MP-CO-09` optional export chain (degraded never fatal) | edit `service.ts` + reuse `transcode-export.ts` | `export.degraded=true` never fails compose | revert | — | — |
| 3.8 | `MP-CO-14` MSW + ffmpeg boundary no-network proof | tests assert `request:start` spy = `[]` | compose makes zero HTTP | fix | — | — |
| 3.9 | `MP-CO-06/05` UI: `TracksPanel` shell + `ComposePanel` (reuse `VideoPlayer`) | add components under `.../create/tracks/` | blocked/empty/composing/ready/stale/error states | revert | — | — |
| 3.10 | `MP-CO-07` wire `ComposePanel` via `TracksPanel` into MediaStudio (flag-gated) | edit `MediaStudio.tsx` | flag off ⇒ DOM unchanged | revert | [`rollback.md`](rollback.md) §Flag | — |
| 3.11 | `MP-CO-08` surface composed video in publish confirm (dry-run) | edit `PublishActionGroup.tsx` | composed preview + track summary; **publish stays dry_run** | revert | — | — |
| 3.12 | Typecheck gate | `pnpm -C apps/web run typecheck` | exit 0 | fix | — | **tsc** |
| 3.13 | Compose vitest suite (`MP-CO-13`) | `pnpm -C apps/web exec vitest run` (targeted globs) | all CO tests + non-regression green | correction loop | — | — |
| 3.14 | `MP-CO-10` Playwright golden path (mock) | `pnpm -C apps/web exec playwright test e2e/content-studio-v2/compose.spec.ts` | compose→preview→publish summary (mock) | triage | — | — |
| 3.15 | Build + correction loop to green×2 | `pnpm -C apps/web run build` ; [`runbook-test-battery.md`](runbook-test-battery.md) | succeeds; two clean runs | iterate | — | loop |
| 3.16 | **Go/No-Go G-P3** | [`go-no-go.md`](go-no-go.md) G-P3 | GO | NO-GO → loop | — | **G-P3** |

---

## P4 — UI integration + feature-flag rollout

End-to-end wiring of the three tracks into the step-3 "Studio média" panel and the
publish confirm (D4), then the **controlled flag flip on staging only**.

| # | action | command | expected | on_failure | rollback_ref | gate |
|---|---|---|---|---|---|---|
| 4.1 | Confirm tracks panel hosts VO + Subtitles + Compose | `pnpm -C apps/web exec vitest run -t "TracksPanel"` | panel mounts only when `videoCapable && flag on` | fix wiring | — | — |
| 4.2 | Full flag-off regression (DOM unchanged, byte-for-byte) | `pnpm -C apps/web exec vitest run -t "flag off"` + `create-golden-path.spec.ts` | flag-off DOM unchanged; golden path green | NO-GO; do not flip flag | [`rollback.md`](rollback.md) §Flag | — |
| 4.3 | Typecheck + build green | `pnpm -C apps/web run typecheck && pnpm -C apps/web run build` | both succeed | fix | — | **tsc**/build |
| 4.4 | **[USER]** Set staging flag ON in PM2 env | add `CONTENT_STUDIO_MEDIA_STUDIO_ENABLED=true` to `apps/web/.env`; `!pm2 restart web --update-env` | process `web` online; env updated | unset flag, restart | [`rollback.md`](rollback.md) §Flag | — |
| 4.5 | Health after restart | `curl -fsS http://127.0.0.1:8012/api/health` | HTTP 200 | restart to previous build ([`rollback.md`](rollback.md) §PM2) | [`rollback.md`](rollback.md) §PM2 | health |
| 4.6 | Confirm dry_run still in force | `grep -n '^SOCIAL_PUBLISHING_MODE=' apps/web/.env` | `dry_run` | **STOP** — never publish live | [`rollback.md`](rollback.md) | **dry_run** |
| 4.7 | Flag-on smoke on :8012 (tracks panel visible for reel/story) | manual + `pnpm -C apps/web exec playwright test e2e/content-studio-v2-t "@flag-on"` | Studio média panel renders; tracks generate in mock | flag OFF, restart | [`rollback.md`](rollback.md) §Flag | — |
| 4.8 | **Go/No-Go G-P4** | [`go-no-go.md`](go-no-go.md) G-P4 | GO (flag on staging, regression clean, dry_run intact) | NO-GO → flag OFF + restart | [`rollback.md`](rollback.md) §Flag/§PM2 | **G-P4** |

---

## P5 — E2E + hardening (test battery)

Runs the dense test battery + correction loop to the **green-twice-consecutively**
exit, plus all Playwright golden paths and the cross-feature non-regression.

| # | action | command | expected | on_failure | rollback_ref | gate |
|---|---|---|---|---|---|---|
| 5.1 | Full typecheck gate | `pnpm -C apps/web run typecheck` | exit 0 | fix; re-loop | — | **tsc** |
| 5.2 | Full vitest battery | `pnpm -C apps/web exec vitest run` | green except the **EditorialCalendar pre-existing exception** (see [`runbook-test-battery.md`](runbook-test-battery.md)) | triage via [`04_test-battery/correction-loop.md`](../04_test-battery/correction-loop.md) | — | — |
| 5.3 | Full Playwright (mock, :8012) | `pnpm -C apps/web exec playwright test e2e/content-studio-v2` | voiceover + subtitles + compose + golden-path specs green | triage | — | — |
| 5.4 | Production build | `pnpm -C apps/web run build` | `next build` succeeds | fix | — | build |
| 5.5 | Correction loop to **green×2 consecutive** | [`runbook-test-battery.md`](runbook-test-battery.md) | two consecutive fully-green runs (tsc+vitest+playwright) | iterate | — | loop |
| 5.6 | Non-regression sign-off (`generate-visual` + 4-step flow + dry_run) | `pnpm -C apps/web exec vitest run -t "non-regression"` + dry_run grep | all green; dry_run intact | NO-GO | [`rollback.md`](rollback.md) | dry_run |
| 5.7 | Capture evidence per verification-checklists | record per [`pilot.md`](pilot.md) §Evidence | every feature `verification-checklist.csv` row has evidence | fill gaps | — | — |
| 5.8 | **Go/No-Go G-P5 (final)** | [`go-no-go.md`](go-no-go.md) G-P5 | GO — plan complete, BUG-004 closed | NO-GO → loop | — | **G-P5** |

---

## Interlock with the correction loop & go/no-go

- **After every phase's last build**, enter the correction loop
  ([`runbook-test-battery.md`](runbook-test-battery.md)): run `tsc → vitest →
  playwright`, triage failures, fix, re-run, until **green twice in a row**.
- **Only then** consult [`go-no-go.md`](go-no-go.md) for that phase's gate. A NO-GO
  loops back into the same phase; a GO unlocks the next phase.
- If execution stops mid-phase, resume per [`pilot.md`](pilot.md) §Resume — re-run
  preflight, re-establish typecheck/build green, continue from the first `status≠done`
  row in [`execution-checklist.csv`](execution-checklist.csv).
- The quality bar ([`ground-truth-codebase.md`](../00_global/ground-truth-codebase.md)
  §6) is the acceptance backbone: TS strict, `tsc --noEmit` gate, MSW-only provider
  HTTP with `onUnhandledRequest:'error'`, additive + flag-gated, no secrets, dry-run
  publishing only.
