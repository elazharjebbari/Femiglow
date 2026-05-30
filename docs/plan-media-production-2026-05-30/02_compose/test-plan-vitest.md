# Compose (montage vidéo) — Vitest plan (unit + integration)

> Quality bar §6: vitest does **not** typecheck — CI also runs `tsc --noEmit`.
> Compose has **no provider HTTP**; the only external boundary is the **ffmpeg
> binary**, mocked exactly like the existing `compose.test.ts`
> (`vi.mock('fluent-ffmpeg')`, `vi.mock('ffmpeg-static')`,
> `vi.mock('node:fs/promises')`, `vi.mock('sharp')`). MSW runs with
> `onUnhandledRequest:'error'` to prove **zero** network in every path. File names +
> `describe > it` titles below are the exact `test_ids` in
> [`action-plan.csv`](action-plan.csv) and [`dev-plan.md`](dev-plan.md).

## 0. ffmpeg + fs mock harness (shared)

Reuse the `compose.test.ts` mock shape. Key points for the core's new branches:

- `fluent-ffmpeg` mock: `input/complexFilter/outputOptions/save` return `this`;
  `on('end', cb)` → `setTimeout(cb, 0)` (success). Add an **error variant**: a
  handler-table flag flips `on('error', cb)` → `setTimeout(() => cb(new Error('ffmpeg boom')), 0)`.
  Add a `kill: vi.fn()` to assert the timeout path SIGKILLs.
- `node:fs/promises` mock: `readFile` returns a Buffer by default; a variant
  returns `null`/throws to simulate a **missing source** (E-CO-5). `unlink: vi.fn()`
  is added to assert **temp cleanup** (E-CO-10). `writeFile`, `mkdir`, `stat`
  resolve as in `compose.test.ts` (`stat → { size: 1024 }`).
- **Fake timers:** `vi.useFakeTimers(); vi.setSystemTime(new Date('2026-05-30T10:00:00Z'))`
  so `Date.now()` in the output file name is pinned (deterministic `url`/`assetId`)
  and the timeout race is driven with `vi.advanceTimersByTimeAsync(...)`. Restore
  with `vi.useRealTimers()` in `afterEach`. The ffmpeg-mock `setTimeout(cb,0)` is
  flushed with `await vi.advanceTimersByTimeAsync(0)` / `runAllTimersAsync`.

## 1. Node core — `apps/web/src/lib/ai-engine/nodes/compose-media-bundle.test.ts` (MP-CO-01)

```
describe('composeMediaBundle')
  it('mock => byte-copy mp4, provider=compose:mock, cost 0, no ffmpeg mux, no fetch')   // ffmpeg().save NOT called; writeFile called with primary buffer
  it('mock => output url/assetId deterministic under fake system time')                 // pinned Date.now()
  it('live + no tracks => byte-copy branch (mirrors compose.ts L56-78)')
  it('live + voiceover only => amix volume=1.0 single audio map')
  it('live + voiceover + music => amix inputs=2 duration=longest, music ducked 0.3')    // assert complexFilter arg
  it('live + subtitles non-empty => hasSubtitles true (srt attached)')
  it('live + subtitles empty/blank => hasSubtitles false, degraded true, not fatal')
  it('ffmpeg error event => rejects compose_ffmpeg_failed and unlinks partial output')  // unlink called
  it('timeout => kills ffmpeg (SIGKILL), rejects compose_timeout, unlinks output')      // cmd.kill('SIGKILL') called
  it('missing source file (readFile null) => throws compose_source_missing, no writeFile')
  it('codec-copy mux failure => retries once with libx264 then succeeds')               // first save errors, second ends
  it('tracks report mirrors generationParams {hasVoiceover,hasMusic,hasSubtitles}')
```

## 2. Node regression — `compose.test.ts` (MP-CO-11, EXISTING, unchanged)

Must stay green after the extraction (the file is **not** edited; only the module
gains the additive `composeMediaBundle` export):

```
compose.test.ts > returns composed asset for image content
compose.test.ts > returns composed asset for video content
compose.test.ts > sets currentStep to compose
compose.test.ts > handles missing images gracefully
compose.test.ts > handles missing videos gracefully
compose.test.ts > image composition uses platform specs for resize
compose.test.ts > video composition combines video + audio
compose.test.ts > cost is 0 for composition
```

## 3. Schema — `apps/web/src/lib/content-studio/__tests__/compose-schema.test.ts` (MP-CO-04)

```
describe('composeGenerationSchema')
  it('accepts empty body (all defaults: include* true, export false)')
  it('accepts {} (parses to defaults)')
  it('rejects unknown keys (.strict)')                  // { foo: 1 } fails
  it('rejects non-boolean include flag')                // { includeMusic: 'yes' } fails
  it('respects explicit includeMusic=false')
  it('defaults export to false')
```

## 4. Service — `apps/web/src/lib/content-studio/__tests__/compose-draft-video.test.ts` (MP-CO-02, MP-CO-09)

Mock the DB/persistence seam (`requireDraft`, `getDraftBundle`, `createMedia`,
`upsertBundleAssets`, `insertGenerationRun`, `logAuditEvent`, `checkDailyBudget`)
and `composeMediaBundle` (spy on its input) **and/or** drive the real core with the
ffmpeg mock. MSW `onUnhandledRequest:'error'` for the whole file (proves no HTTP).

```
describe('composeDraftVideo')
  it('mode=mock → byte-copy composed video, no provider call')        // provider='compose:mock'; costCents=0; request:start spy = []
  it('mode=mock → persists role=composed_video asset + generation_run (cost 0)')
  it('no primary video in bundle → throws HttpError invalid_state (409)')          // getDraftBundle has no primary_video; NO createMedia, NO ffmpeg
  it('mode=live + only primary video (no extra track) → throws invalid_state (409)')
  it('mode=mock + voiceover + subtitles → tracks {hasVoiceover:true,hasSubtitles:true,hasMusic:false}')
  it('includeMusic=false drops the music track from the mux')          // composeMediaBundle called with music: null
  it('recompose replaces the existing composed_video asset (upsert by role)')      // upsertBundleAssets role:'composed_video'
  it('non-video draft (carousel) → throws HttpError invalid_state')
  it('ffmpeg error (live) → throws HttpError upstream_failed, no asset persisted')  // core rejects; createMedia NOT called
  it('source file missing → throws HttpError upstream_failed (Fichier vidéo source introuvable)')
  it('timeout → throws HttpError upstream_failed (Montage interrompu)')
  it('export=true ok → ComposeResult.export.url set')
  it('export=true degraded transcode → composed succeeds, export.degraded=true')   // transcode degraded never fatal
  it('writes generation_run input{mode,include*,export} and output{tracks,degraded}')
  it('budget guard called with 0 (parity)')
```

Assertion helpers: count MSW requests with a `server.events.on('request:start', …)`
spy and assert `[]` (compose makes **no** HTTP); assert `createMedia`/`unlink`
spies for persistence vs cleanup; pin `Date.now()` with fake timers.

## 5. Route — `apps/web/src/app/api/admin/content-studio/drafts/[id]/__tests__/compose.route.test.ts` (MP-CO-03)

Mock `requireAdminApi`, `requireContentStudioEnabled`, `cookies`, and
`composeDraftVideo`. Drive the exported `POST(request, { params })`.

```
describe('POST /drafts/[id]/compose')
  it('200 { media } in mock mode (empty body)')          // body '{}' → service called with defaults
  it('200 with explicit include flags forwarded to service')
  it('400 invalid_input on unknown key')                 // .strict() fail → formatErrorResponse
  it('400 invalid_input on non-boolean flag')
  it('409 invalid_state when no primary video (service throws)')
  it('reads cs_generation_mode cookie (defaults mock when absent/garbage)')
  it('passes session.adminId as actorId')
  it('401 when not admin')                               // requireAdminApi throws
  it('error envelope is { error: { code, message, details } }')
```

## 6. ComposePanel — `apps/web/src/components/admin/content-studio-v2/create/tracks/__tests__/ComposePanel.test.tsx` (MP-CO-05)

React Testing Library + jsdom. Mock `fetch` via MSW route stub (never
`vi.stubGlobal`). Stub `HTMLMediaElement.prototype.play/pause` for the reused
`VideoPlayer`.

```
describe('ComposePanel')
  it('Composer disabled with hint when no primary video (blocked)')
  it('renders track-presence rows reflecting the bundle (present/absent)')
  it('POSTs {include*} and renders VideoPlayer on success')
  it('shows track summary from response tracks report')
  it('shows "à recomposer" badge when a source track changes (stale)')
  it('guards empty draftId with a toast, no fetch')
  it('surfaces 409 no-primary-video message inline (role=alert)')
  it('present-track include switch toggles aria-checked and marks stale')
  it('disables controls and shows estimator while composing')
```

## 7. TracksPanel / MediaStudio wiring / non-regression — `TracksPanel.test.tsx` + `MediaStudio.compose.test.tsx` (MP-CO-06, MP-CO-07, MP-CO-12)

```
describe('TracksPanel')
  it('mounts ComposePanel when video-capable + flag on')
  it('not mounted when flag off (DOM unchanged, non-regression)')

describe('MediaStudio + Montage panel')
  it('flag off → no Montage panel (DOM unchanged, non-regression)')
  it('flag on + reel → Montage panel present')
  it('flag on + carousel(image) → no Montage panel')
```
Plus the **existing** `MediaStudio.test.tsx` must stay green (generate-visual
untouched — D6).

## 8. Publish summary — `PublishActionGroup.compose.test.tsx` (MP-CO-08)

```
describe('PublishActionGroup + composed video')
  it('shows composed video in confirm when present (VideoPlayer)')
  it('falls back to primary video when no composed video (non-regression)')
  it('renders track summary from composed meta {hasVoiceover,hasMusic,hasSubtitles}')
  it('publish proceeds in dry-run')
```

## Coverage targets

- Service & route: 100% of branches in the error matrix (`backend-design.md` §5),
  including all three 409 reasons and the 502 ffmpeg/source/timeout reasons.
- Node core: mock byte-copy + each live mux branch (vo-only, music-only, vo+music,
  subtitles) + error + timeout + missing-source + codec-fallback. Assert **temp
  cleanup** (`unlink`) on every failure branch.
- A11y assertions (switch `aria-checked`, blocked `aria-disabled`, `role=alert`)
  are part of the component suites (not deferred to E2E).
- Every integration file asserts **zero** network (`request:start` spy = `[]`).
