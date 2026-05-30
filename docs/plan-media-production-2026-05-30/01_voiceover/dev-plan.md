# Voice-over — development plan

> Ordered, each step names the test that proves it. Tasks `MP-VO-*`. Prereq:
> `MP-AR-*` (DTO/bridge/data-model + `upsertBundleAsset` + audio kind/role) must
> be merged first. Quality bar §6: `tsc --noEmit` gates every step; provider HTTP
> via MSW only. See [`action-plan.csv`](action-plan.csv) for the matrix.

## Phase 0 — depends on architecture (blocked by MP-AR-*)

- **MP-VO-00** Confirm `00_global` shipped: `role` discriminator on bundle assets,
  `StudioV2MediaKind` widened to include `'audio'`, `upsertBundleAsset(role)`,
  `GenerationResult.voiceover` field, bridge maps it. *Proof:* `MP-AR-*` tests
  green + `tsc --noEmit` clean across `src/lib/content-studio` and `ai-engine`.

## Phase 1 — node core extraction (no behavior change)

- **MP-VO-01** Extract `synthesizeVoiceover(input)` from `generateVoiceoverNode`
  in `src/lib/ai-engine/nodes/generate-voiceover.ts`; node becomes a thin adapter
  (`onProviderError:'silent_fallback'`). Lift the existing helpers (no ffmpeg/TTS
  rewrite — D5).
  *Proof:* existing `generate-voiceover.test.ts` stays **100% green unchanged**
  (`generate-voiceover.test.ts > returns mock silent audio`,
  `> cost is 0 for mock`, `> mimeType is audio/wav for mock`) **plus** new unit
  `synthesize-voiceover.test.ts > mock => silent wav, provider=mock, cost 0, no fetch`.

## Phase 2 — schema + service

- **MP-VO-04** Add `voiceoverGenerationSchema` to `src/lib/content-studio/schemas.ts`.
  *Proof:* `voiceover-schema.test.ts > rejects empty script` /
  `> rejects unknown keys (.strict)` / `> defaults voice to mock`.
- **MP-VO-02** Implement `generateVoiceoverForDraft` in
  `src/lib/content-studio/service.ts` (algorithm in
  [`backend-design.md`](backend-design.md) §2): format gate, mode-aware credential
  resolution, budget, `synthesizeVoiceover`, `createMedia(kind:'audio')`,
  `upsertBundleAsset(role:'voiceover')`, `insertGenerationRun`, `logAuditEvent`.
  *Proof:*
  - `generate-voiceover-for-draft.test.ts > mode=mock → silent track, no provider call`
  - `> mode=live, no key → throws HttpError invalid_state (409)`
  - `> persists role='voiceover' audio asset + generation_run (cost 0 mock)`
  - `> regenerate replaces the existing voiceover asset (upsert by role)`
  - `> non-video draft → HttpError invalid_state`
  - `> live + key + provider 5xx → HttpError upstream_failed` (MSW)

## Phase 3 — route

- **MP-VO-03** Create
  `src/app/api/admin/content-studio/drafts/[id]/generate-voiceover/route.ts`
  (mirror `generate-visual/route.ts`).
  *Proof:* `generate-voiceover.route.test.ts`:
  - `> 200 { media } in mock mode`
  - `> 400 invalid_input on empty script`
  - `> 409 invalid_state when cookie=live and no key (no provider call)` (MSW `onUnhandledRequest:'error'`)
  - `> reads cs_generation_mode cookie (defaults mock)`
  - `> 401 when not admin`

## Phase 4 — UI

- **MP-VO-06** `AudioTrackPlayer.tsx` (a11y audio player; reuse `formatDuration`).
  *Proof:* `AudioTrackPlayer.test.tsx`:
  - `> renders play button with aria-label and toggles aria-pressed`
  - `> seek slider exposes aria-valuetext "N secondes sur M"`
  - `> mute toggles aria-pressed and label`
- **MP-VO-05** `VoiceoverTrack.tsx` (textarea + VoiceSelector + generate/regenerate
  + AudioTrackPlayer; states empty/generating/ready/stale/error).
  *Proof:* `VoiceoverTrack.test.tsx`:
  - `> pre-fills textarea from defaultScript`
  - `> POSTs {script,voice} and renders player on success`
  - `> shows "modifié" badge when script edited after ready (stale)`
  - `> guards empty draftId with a toast, no fetch`
  - `> surfaces 409 no-key message inline`
- **MP-VO-07** Wire `VoiceoverTrack` into the MediaStudio tracks panel behind
  `CONTENT_STUDIO_MEDIA_STUDIO_ENABLED` + video-capable gate; pass bundle
  `voiceover` + `onGenerated`.
  *Proof:* `MediaStudio.voiceover.test.tsx`:
  - `> flag off → no Voix-off track (DOM unchanged, non-regression)`
  - `> flag on + reel → Voix-off track present`
  - `> flag on + carousel(image) → no Voix-off track`

## Phase 5 — flow into compose & publish (surface only here; logic in siblings)

- **MP-VO-08** Expose the bundle `voiceover` asset to `PublishActionGroup` track
  summary (🎙️ Voix-off ✓) and to Compose input. (Compose logic = `../02_compose`.)
  *Proof:* `PublishActionGroup.voiceover.test.tsx > shows voix-off in track summary when present`.

## Phase 6 — E2E + regression gate

- **MP-VO-09** Playwright golden path (mock mode) — see
  [`test-plan-playwright.md`](test-plan-playwright.md).
  *Proof:* `e2e/content-studio-v2/voiceover.spec.ts > operator generates and previews a voice-over (mock)`.
- **MP-VO-10** Regression: `generate-visual` + 4-step flow untouched.
  *Proof:* existing `MediaStudio.test.tsx` green + new
  `MediaStudio.voiceover.test.tsx > flag off → DOM unchanged`.
- **MP-VO-11** CI gate: `pnpm -C apps/web exec tsc --noEmit` + targeted vitest +
  MSW `onUnhandledRequest:'error'` across the suite.

## Definition of done

All `MP-VO-*` action-plan rows `status=done`; `tsc --noEmit` clean; vitest +
Playwright green; verification-checklist evidence captured; no secrets; dry-run
publishing only.
