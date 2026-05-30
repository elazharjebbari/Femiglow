# Voice-over — Vitest plan (unit + integration)

> Quality bar §6: vitest does **not** typecheck — CI also runs `tsc --noEmit`.
> Provider HTTP via MSW only (`@/test/msw/server`), never `vi.stubGlobal('fetch')`.
> File names + `describe > it` titles below are the exact `test_ids` referenced by
> [`action-plan.csv`](action-plan.csv) and [`dev-plan.md`](dev-plan.md).

## 1. Node core — `apps/web/src/lib/ai-engine/nodes/synthesize-voiceover.test.ts` (MP-VO-01)

Mock `../config`, `fluent-ffmpeg`, `ffmpeg-static`, `node:fs/promises` exactly like
the existing `generate-voiceover.test.ts` (silent path, no real ffmpeg). MSW server
with `onUnhandledRequest:'error'` to prove the mock path makes **no** fetch.

```
describe('synthesizeVoiceover')
  it('mock => silent wav, provider=mock, cost 0, no fetch')
  it('truncates text to 4096 for openai and sets truncated=true')          // MSW openai 200
  it('openai 5xx + onProviderError=throw => throws')                        // MSW openai 500
  it('openai 5xx + onProviderError=silent_fallback => degraded silent track')// MSW openai 500
  it('elevenlabs path posts to xi-api-key host and returns mp3 asset')      // MSW elevenlabs 200
  it('estimateDuration >= 3s floor')
```

## 2. Node regression — `generate-voiceover.test.ts` (MP-VO-13, EXISTING, unchanged)

Must stay green after the extraction (no edits to the file):

```
generate-voiceover.test.ts > returns mock silent audio
generate-voiceover.test.ts > sets currentStep to generate_voiceover
generate-voiceover.test.ts > works with no script
generate-voiceover.test.ts > cost is 0 for mock
generate-voiceover.test.ts > mimeType is audio/wav for mock
generate-voiceover.test.ts > provider is mock
generate-voiceover.test.ts > works with empty hook
```

## 3. Schema — `apps/web/src/lib/content-studio/__tests__/voiceover-schema.test.ts` (MP-VO-04)

```
describe('voiceoverGenerationSchema')
  it('rejects empty script')                    // '' -> .min(1) fail
  it('accepts omitted script (derive server-side)')
  it('rejects unknown keys (.strict)')          // { foo: 1 } fails
  it('rejects script over 4000 chars')
  it('defaults voice to mock')
  it('rejects voice not in enum')               // 'bob' fails
```

## 4. Service — `apps/web/src/lib/content-studio/__tests__/generate-voiceover-for-draft.test.ts` (MP-VO-02)

Mock the DB/persistence seam (`requireDraft`, `createMedia`, `upsertBundleAsset`,
`insertGenerationRun`, `logAuditEvent`, `checkDailyBudget`) and
`resolveProviderCredential`. MSW `onUnhandledRequest:'error'` for the whole file.

```
describe('generateVoiceoverForDraft')
  it('mode=mock → silent track, no provider call')      // asserts no MSW handler hit; provider='mock'; costCents=0
  it('mode=mock → persists role=voiceover audio asset + generation_run (cost 0)')
  it('mode=live, no key → throws HttpError invalid_state (409)')  // resolveProviderCredential -> undefined; NO createMedia, NO fetch
  it('mode=live + key → calls TTS once and persists openai:tts-1 asset')  // MSW openai 200, assert exactly 1 request
  it('mode=live + key + provider 5xx → throws HttpError upstream_failed')  // MSW openai 500
  it('non-video draft (carousel) → throws HttpError invalid_state')
  it('regenerate replaces the existing voiceover asset (upsert by role)')  // upsertBundleAsset called with role:'voiceover'
  it('derives narration from draft when script omitted')         // text = buildVoiceoverTextFromDraft
  it('explicit empty script is rejected upstream (schema) — service trims and derives')  // guards blank
  it('over budget → throws budget_exceeded (429)')               // checkDailyBudget throws
  it('records intendedProvider + truncated in generation_run input/output')
```

Assertion helpers: count MSW requests with a `server.events.on('request:start', …)`
spy or a handler-hit counter; assert `0` for mock & no-key cases.

## 5. Route — `apps/web/src/app/api/admin/content-studio/drafts/[id]/__tests__/generate-voiceover.route.test.ts` (MP-VO-03)

Mock `requireAdminApi`, `requireContentStudioEnabled`, `cookies`, and
`generateVoiceoverForDraft`. Drive the exported `POST(request, { params })`.

```
describe('POST /drafts/[id]/generate-voiceover')
  it('200 { media } in mock mode')                       // cookie cs_generation_mode=mock
  it('400 invalid_input on empty script')                // schema fail -> formatErrorResponse
  it('400 invalid_input on non-JSON body')
  it('409 invalid_state when cookie=live and no key (no provider call)')  // service throws; MSW onUnhandledRequest:error
  it('reads cs_generation_mode cookie (defaults mock when absent/garbage)')
  it('passes session.adminId as actorId')
  it('401 when not admin')                               // requireAdminApi throws
  it('error envelope is { error: { code, message, details } }')
```

## 6. AudioTrackPlayer — `apps/web/src/components/admin/content-studio-v2/media/__tests__/AudioTrackPlayer.test.tsx` (MP-VO-06)

React Testing Library + jsdom. Stub `HTMLMediaElement.prototype.play/pause`.

```
describe('AudioTrackPlayer')
  it('renders play button with aria-label and toggles aria-pressed')
  it('seek slider exposes aria-valuetext "N secondes sur M"')
  it('mute toggles aria-pressed and label (Couper/Activer le son)')
  it('shows time readout via formatDuration (0:06 / 0:14)')
  it('Space on focused play button toggles playback')
  it('group has role=group aria-label="Lecteur voix-off"')
```

## 7. VoiceoverTrack — `apps/web/src/components/admin/content-studio-v2/create/tracks/__tests__/VoiceoverTrack.test.tsx` (MP-VO-05)

Mock `fetch` via MSW (route handler stub) — never `vi.stubGlobal`.

```
describe('VoiceoverTrack')
  it('pre-fills textarea from defaultScript')
  it('POSTs {script,voice} and renders AudioTrackPlayer on success')
  it('shows "modifié" badge when script edited after ready (stale)')
  it('guards empty draftId with a toast, no fetch')
  it('surfaces 409 no-key message inline (role=alert)')
  it('disables controls and shows estimator while generating')
  it('voice radiogroup is keyboard-operable (arrow keys)')
```

## 8. MediaStudio wiring / non-regression — `MediaStudio.voiceover.test.tsx` (MP-VO-07, MP-VO-10)

```
describe('MediaStudio + Voix-off track')
  it('flag off → no Voix-off track (DOM unchanged, non-regression)')
  it('flag on + reel → Voix-off track present')
  it('flag on + carousel(image) → no Voix-off track')
```
Plus the **existing** `MediaStudio.test.tsx` must stay green (generate-visual
untouched — D6).

## 9. Publish summary — `PublishActionGroup.voiceover.test.tsx` (MP-VO-08)

```
describe('PublishActionGroup track summary')
  it('shows voix-off in track summary when present')
  it('omits voix-off row when bundle has no voiceover')
```

## Coverage targets

- Service & route: 100% of branches in the error matrix (`backend-design.md` §5).
- Node core: mock + each provider success/failure branch.
- A11y assertions are part of the component suites (not deferred to E2E).
