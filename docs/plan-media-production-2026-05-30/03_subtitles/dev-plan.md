# Subtitles / script-on-video — development plan

> Ordered, each step names the test that proves it. Tasks `MP-SU-*`. Prereq:
> `MP-AR-*` (DTO/bridge/data-model + `upsertBundleAssets` + `media_kind='subtitles'`
> enum value + `meta_json` column, migration `0064`) must be merged first. Quality
> bar §6: `tsc --noEmit` gates every step; provider HTTP via MSW only; the default
> generation path makes **zero** network calls. See
> [`action-plan.csv`](action-plan.csv) for the matrix.

## Phase 0 — depends on architecture (blocked by MP-AR-*)

- **MP-SU-00** Confirm `00_global` shipped: `role='subtitles'` on bundle assets,
  `StudioV2MediaKind` widened to include `'subtitles'`, `media_kind` enum value
  `'subtitles'` (migration `0064`, MP-AR-005), `content_asset_binding.meta_json`
  column, `upsertBundleAssets(role, meta)`, `getDraftBundle`, and
  `GenerationResult.subtitles` (string) mapped by the bridge. *Proof:* `MP-AR-*`
  tests green + `tsc --noEmit` clean across `src/lib/content-studio` and `ai-engine`;
  migration `0064` verification queries (db-migration.md §6) pass.

## Phase 1 — SRT library + node core extraction (no graph behavior change)

- **MP-SU-01** Create `src/lib/ai-engine/subtitles/srt.ts` (`formatTimecode`,
  `parseTimecode`, `serializeSrt`, `parseSrt`, `parseScriptToCues`, `validateCues`,
  `SUBTITLE_LIMITS`, `DEFAULT_BURN_IN_STYLE`, types `Cue`/`BurnInStyle`/`CueIssue`).
  Refactor `generate-subtitles.ts` to delegate to `parseScriptToCues` + `serializeSrt`
  (node stays a thin wrapper; side-effects/logging unchanged). No ffmpeg/network.
  *Proof:*
  - new `srt.test.ts`:
    - `> formatTimecode/parseTimecode round-trip for random ms`
    - `> serializeSrt emits canonical 1-based LF blocks`
    - `> parseSrt tolerates CRLF and extra blanks; round-trips canonical SRT`
    - `> parseScriptToCues wraps lines to <=42 chars / <=2 lines`
    - `> parseScriptToCues empty input => []`
    - `> validateCues flags overlap/order/duration/line_length/lines/empty (errors)`
    - `> validateCues flags cps/min_duration/min_gap/beyond_video (warnings)`
  - existing `generate-subtitles.test.ts` stays **100% green unchanged** (MP-SU-13):
    `> returns SRT formatted subtitles`, `> each scene gets a subtitle entry`,
    `> timing is cumulative`, `> hook gets first entry`,
    `> empty scenes returns empty subtitles`, `> sets currentStep`.

- **MP-SU-02** Add `generateSubtitlesForDraftCore` (pure; `refine:false` => rule-based
  no network; `refine:true` => 1 LLM call via the reused text client).
  *Proof:* `generate-subtitles-core.test.ts`:
  - `> refine=false => rule-based, costCents 0, no fetch` (MSW onUnhandledRequest:error)
  - `> refine=true + key => one LLM call tidies text, timecodes unchanged` (MSW 200)
  - `> refine=true + 5xx + onProviderError=throw => throws` (MSW 500)

## Phase 2 — schemas + service

- **MP-SU-06** Add `subtitlesGenerationSchema` + `subtitlesSaveSchema` (+ `cueSchema`,
  `burnInStyleSchema`) to `src/lib/content-studio/schemas.ts`.
  *Proof:* `subtitles-schema.test.ts`:
  - `> generation rejects unknown keys (.strict)` / `> defaults refine to false`
  - `> save rejects > 2 lines per cue` / `> save rejects bad hex color`
  - `> save accepts empty cues array (clear)` / `> save rejects > 200 cues`
- **MP-SU-03** Implement `generateSubtitlesForDraft` + `saveSubtitlesForDraft` in
  `src/lib/content-studio/service.ts` (algorithm in
  [`backend-design.md`](backend-design.md) §3): format gate, mode-aware refine
  credential, budget, core call, server-authoritative `validateCues`, canonical
  serialize, `createMedia(kind:'subtitles', mime:application/x-subrip)` + storage put,
  `upsertBundleAssets(role:'subtitles', meta:{srt,cueCount,style})`,
  `insertGenerationRun`, `logAuditEvent`.
  *Proof:* `generate-subtitles-for-draft.test.ts`:
  - `> mode=mock => rule-based SRT, no provider call, cost 0`
  - `> empty script => transient { id:'', cueCount:0 }, nothing persisted`
  - `> persists role='subtitles' asset with meta.srt == .srt bytes`
  - `> live + refine + no key => HttpError invalid_state (409)` (no fetch)
  - `> non-video draft => HttpError invalid_state`
  `save-subtitles-for-draft.test.ts`:
  - `> rejects overlapping cues with HttpError invalid_input + cueErrors`
  - `> rejects over-long line (>42) with cueErrors`
  - `> valid cues => re-indexed canonical SRT persisted (meta.srt == bytes)`
  - `> cues:[] clears the subtitles binding (idempotent)`
  - `> save replaces by role, never touches the primary video binding`

## Phase 3 — routes

- **MP-SU-04** Create
  `src/app/api/admin/content-studio/drafts/[id]/generate-subtitles/route.ts`
  (mirror `generate-visual/route.ts`).
  *Proof:* `generate-subtitles.route.test.ts`:
  - `> 200 { media } in mock mode`
  - `> 400 invalid_input on malformed body`
  - `> 409 invalid_state when cookie=live, refine=true, no key (no provider call)` (MSW onUnhandledRequest:error)
  - `> reads cs_generation_mode cookie (defaults mock)`
  - `> 401 when not admin`
- **MP-SU-05** Create
  `src/app/api/admin/content-studio/drafts/[id]/subtitles/route.ts` (`PUT`).
  *Proof:* `save-subtitles.route.test.ts`:
  - `> 200 { media } on valid save`
  - `> 400 invalid_input with details.cueErrors on overlap`
  - `> 200 cleared result when cues:[]`
  - `> 401 when not admin`

## Phase 4 — UI

- **MP-SU-08** `CueEditor.tsx` (+ `TimecodeInput`): timed-lines table, add/del/split/
  merge, masked timecode I/O, per-cue inline issues, a11y table semantics.
  *Proof:* `CueEditor.test.tsx`:
  - `> renders one row per cue with start/end/text fields`
  - `> TimecodeInput round-trips hh:mm:ss,mmm <-> ms`
  - `> invalid timecode sets aria-invalid and shows V1 message`
  - `> over-42 line shows counter n/42 and flags line_length`
  - `> add/delete/split/merge produce expected Cue[]`
  - `> Alt+ArrowUp nudges start/end by -100ms`
  - `> error summary item focuses the offending cue field`
- **MP-SU-10** `SubtitleStyleControls.tsx` (font/size/position/color/box) +
  **MP-SU-11** `SubtitleOverlayPreview.tsx` (styled cue over a video frame).
  *Proof:* `SubtitleStyleControls.test.tsx`:
  - `> emits BurnInStyle on each control change`
  - `> position radiogroup keyboard-operable (arrows)`
  - `> low text/box contrast shows a non-blocking warning`
  `SubtitleOverlayPreview.test.tsx`:
  - `> renders the first cue text positioned per style`
  - `> role=img with descriptive aria-label`
- **MP-SU-07** `SubtitlesTrack.tsx` (state machine root; generate/regenerate + save;
  states empty/generating/editing/invalid/saving/ready/error; shares the mode cookie).
  *Proof:* `SubtitlesTrack.test.tsx`:
  - `> empty state shows "Générer les sous-titres"`
  - `> POSTs generate and populates CueEditor on success`
  - `> guards empty draftId with a toast, no fetch`
  - `> Enregistrer disabled while invalid; enabled when dirty & valid`
  - `> PUT save success calls onSaved and toasts`
  - `> server cueErrors are mapped onto editor rows`
  - `> surfaces 409 refine-no-key message inline (role=alert)`
- **MP-SU-12** Wire `SubtitlesTrack` into the MediaStudio tracks panel behind
  `CONTENT_STUDIO_MEDIA_STUDIO_ENABLED` + video-capable gate; pass bundle `subtitles`,
  `videoPosterUrl`, `videoDurationMs`, `onSaved`.
  *Proof:* `MediaStudio.subtitles.test.tsx`:
  - `> flag off => no Sous-titres track (DOM unchanged, non-regression)`
  - `> flag on + reel => Sous-titres track present`
  - `> flag on + carousel(image) => no Sous-titres track`

## Phase 5 — flow into compose & publish (surface only here; burn-in in siblings)

- **MP-SU-09** Pin the **Compose consumer contract**: `composeDraftVideo`
  (`../02_compose`, MP-CO-*) reads `getDraftBundle(draftId).subtitles?.meta.srt` into
  `state.subtitles` and `meta.style` for the burn-in filter. Expose the bundle
  `subtitles` asset to `PublishActionGroup` track summary (💬 Sous-titres ✓).
  *Proof:* `PublishActionGroup.subtitles.test.tsx > shows sous-titres in track summary when present`;
  contract assertion `compose-subtitles-contract.test.ts > meta.srt equals serializeSrt(cues)`.

## Phase 6 — E2E + regression gate

- **MP-SU-14** Playwright golden path (mock mode) — see
  [`test-plan-playwright.md`](test-plan-playwright.md).
  *Proof:* `e2e/content-studio-v2/subtitles.spec.ts > operator generates, edits and saves subtitles (mock)`.
- **MP-SU-13** Regression: `generate-subtitles.test.ts` (node) untouched green;
  `generateVisualForDraft` + 4-step flow untouched; flag-off DOM unchanged.
  *Proof:* existing `generate-subtitles.test.ts` + `MediaStudio.test.tsx` green + new
  `MediaStudio.subtitles.test.tsx > flag off => DOM unchanged`.
- **MP-SU-15** CI gate: `pnpm -C apps/web exec tsc --noEmit` + targeted vitest + MSW
  `onUnhandledRequest:'error'` across the suite; `python3 -m json.tool data-contract.json`.

## Definition of done

All `MP-SU-*` action-plan rows `status=done`; `tsc --noEmit` clean; vitest +
Playwright green; SRT round-trip + validation proven; default path proven network-free;
`meta.srt` == `.srt` bytes asserted; verification-checklist evidence captured; no
secrets; dry-run publishing only.
