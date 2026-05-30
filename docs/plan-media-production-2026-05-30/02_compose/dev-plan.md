# Compose (montage vidéo) — development plan

> Ordered, each step names the test that proves it. Tasks `MP-CO-*`. Prereq:
> `MP-AR-*` (DTO/bridge/data-model + `upsertBundleAssets`/`getDraftBundle` +
> `meta_json` column + `subtitles` enum) must be merged first. Soft-deps:
> `MP-VO-*` / `MP-SU-*` produce the tracks Compose reads. Quality bar §6:
> `tsc --noEmit` gates every step; the ffmpeg binary is mocked (no real encode in
> CI); compose makes **no** HTTP, proven via MSW `onUnhandledRequest:'error'`. See
> [`action-plan.csv`](action-plan.csv) for the matrix.

## Phase 0 — depends on architecture (blocked by MP-AR-*)

- **MP-CO-00** Confirm `00_global` shipped: `role='composed_video'` + `meta_json`
  on bundle bindings, `getDraftBundle`/`upsertBundleAssets`, the DTO/state-channel
  mapping (`composition` → `composedVideo`), `media_kind` enum has `subtitles`.
  Soft-check: `MP-VO`/`MP-SU` produce `role='voiceover'`/`role='subtitles'` assets
  (Compose degrades if absent). *Proof:* `MP-AR-*` tests green + `tsc --noEmit`
  clean across `src/lib/content-studio` and `src/lib/ai-engine`.

## Phase 1 — node core extraction (no behavior change)

- **MP-CO-01** Extract `composeMediaBundle(input)` from `composeNode`'s
  `composeVideo` (`src/lib/ai-engine/nodes/compose.ts`); node becomes a thin
  adapter (`mode:'live'`, still swallows into `createEmptyAsset` for graph
  autonomy). Lift the no-audio byte-copy branch (L56–78) and the `amix` mux branch
  (L80–142) verbatim; add `mode` switch, timeout+SIGKILL, temp-file cleanup,
  source-missing throw, codec-copy→libx264 fallback (backend-design §1).
  *Proof:* existing `compose.test.ts` stays **100% green unchanged** (8 tests:
  `composeNode > returns composed asset for video content`,
  `> video composition combines video + audio`, `> cost is 0 for composition`,
  `> handles missing videos gracefully`, …) **plus** new unit
  `compose-media-bundle.test.ts > mock => byte-copy mp4, provider=compose:mock, cost 0, no ffmpeg mux, no fetch`.

## Phase 2 — schema + service

- **MP-CO-04** Add `composeGenerationSchema` to
  `src/lib/content-studio/schemas.ts` (booleans w/ defaults, `.strict()`).
  *Proof:* `compose-schema.test.ts > accepts empty body (all defaults)` /
  `> rejects unknown keys (.strict)` / `> coerces missing flags to true/false defaults` /
  `> rejects non-boolean include flag`.
- **MP-CO-02** Implement `composeDraftVideo` in
  `src/lib/content-studio/service.ts` (algorithm in
  [`backend-design.md`](backend-design.md) §2): format gate, `getDraftBundle`,
  primary-video gate, include-flag resolution, live no-track gate, budget,
  `composeMediaBundle`, optional export chain, `createMedia(kind:'video')`,
  `upsertBundleAssets(role:'composed_video', meta:{…})`, `insertGenerationRun`,
  `logAuditEvent`.
  *Proof:*
  - `compose-draft-video.test.ts > mode=mock → byte-copy composed video, no provider call`
  - `> no primary video in bundle → throws HttpError invalid_state (409)`
  - `> mode=live + only primary video (no extra track) → throws invalid_state (409)`
  - `> mode=mock + voiceover + subtitles → tracks report {hasVoiceover:true,hasSubtitles:true}`
  - `> persists role='composed_video' asset + generation_run (cost 0)`
  - `> recompose replaces the existing composed_video asset (upsert by role)`
  - `> non-video draft → HttpError invalid_state`
  - `> ffmpeg error (live) → HttpError upstream_failed, no asset persisted`
  - `> source file missing → HttpError upstream_failed`
  - `> export=true degraded transcode → composed succeeds, export.degraded=true`

## Phase 3 — route

- **MP-CO-03** Create
  `src/app/api/admin/content-studio/drafts/[id]/compose/route.ts`
  (mirror `generate-visual/route.ts`; empty body allowed).
  *Proof:* `compose.route.test.ts`:
  - `> 200 { media } in mock mode (empty body)`
  - `> 400 invalid_input on unknown key`
  - `> 409 invalid_state when no primary video`
  - `> reads cs_generation_mode cookie (defaults mock when absent/garbage)`
  - `> passes session.adminId as actorId`
  - `> 401 when not admin`
  - `> error envelope is { error: { code, message, details } }`

## Phase 4 — UI

- **MP-CO-06** `TracksPanel.tsx` shell (hosts VO/music/subtitles + Compose;
  mounted only when `videoCapable && mediaStudioEnabled`).
  *Proof:* `TracksPanel.test.tsx > mounts compose panel when video-capable + flag on` /
  `> not mounted when flag off (non-regression)`.
- **MP-CO-05** `ComposePanel.tsx` (track-presence rows + include switches + export
  checkbox + Composer/Recomposer + EstimatorBar + reused `VideoPlayer`; states
  blocked/empty/composing/ready/stale/error).
  *Proof:* `ComposePanel.test.tsx`:
  - `> Composer disabled with hint when no primary video (blocked)`
  - `> POSTs include flags and renders VideoPlayer on success`
  - `> shows track summary from response tracks report`
  - `> shows "à recomposer" badge when a source track changes (stale)`
  - `> guards empty draftId with a toast, no fetch`
  - `> surfaces 409 no-primary-video message inline (role=alert)`
  - `> present-track include switch toggles aria-checked`
- **MP-CO-07** Wire `ComposePanel` (via `TracksPanel`) into `MediaStudio.tsx`
  behind `CONTENT_STUDIO_MEDIA_STUDIO_ENABLED` + video-capable gate; pass the
  role-addressed bundle + `onComposed`.
  *Proof:* `MediaStudio.compose.test.tsx`:
  - `> flag off → no Montage panel (DOM unchanged, non-regression)`
  - `> flag on + reel → Montage panel present`
  - `> flag on + carousel(image) → no Montage panel`

## Phase 5 — flow into publish

- **MP-CO-08** Surface the bundle `composed_video` in `PublishActionGroup` confirm
  (preview the composed video in `VideoPlayer`, show track summary, dry-run).
  *Proof:* `PublishActionGroup.compose.test.tsx`:
  - `> shows composed video in confirm when present`
  - `> falls back to primary video when no composed video (non-regression)`
  - `> renders track summary from composed meta`

## Phase 6 — optional export chain

- **MP-CO-09** Wire the optional `export:true` path to `transcodeExportNode`
  (or its extracted core); degraded export never fails compose (ACT-BE-032).
  *Proof:* `compose-draft-video.test.ts > export=true ok → export.url set` /
  `> export=true degraded → composed succeeds, export.degraded=true`.

## Phase 7 — E2E + regression gate

- **MP-CO-10** Playwright golden path (mock mode) — see
  [`test-plan-playwright.md`](test-plan-playwright.md).
  *Proof:* `e2e/content-studio-v2/compose.spec.ts > operator composes and previews a montage (mock)`.
- **MP-CO-11** Node regression: `compose.test.ts` unchanged + green
  (adapter preserves graph shape).
  *Proof:* `compose.test.ts` (existing green, file not edited beyond the export).
- **MP-CO-12** Non-regression: `generate-visual` + 4-step flow untouched; flag-off
  DOM unchanged.
  *Proof:* existing `MediaStudio.test.tsx` green + new
  `MediaStudio.compose.test.tsx > flag off → DOM unchanged`.
- **MP-CO-13** CI gate: `pnpm -C apps/web exec tsc --noEmit` + targeted vitest +
  MSW `onUnhandledRequest:'error'` across the compose suite (proves compose makes
  no HTTP at all).

## Definition of done

All `MP-CO-*` action-plan rows `status=done`; `tsc --noEmit` clean; vitest +
Playwright green; verification-checklist evidence captured; no orphan temp files
in tests; no secrets; dry-run publishing only.
