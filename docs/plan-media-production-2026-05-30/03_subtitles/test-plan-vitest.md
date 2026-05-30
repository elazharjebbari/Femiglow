# Subtitles — Vitest plan (unit + integration)

> Quality bar §6: vitest does **not** typecheck — CI also runs `tsc --noEmit`.
> Provider HTTP via MSW only (`@/test/msw/server`), never `vi.stubGlobal('fetch')`.
> The **default** subtitle path makes ZERO network calls (proven via
> `onUnhandledRequest:'error'`). File names + `describe > it` titles below are the
> exact `test_ids` referenced by [`action-plan.csv`](action-plan.csv) and
> [`dev-plan.md`](dev-plan.md).

## 1. SRT library — `apps/web/src/lib/ai-engine/subtitles/__tests__/srt.test.ts` (MP-SU-01)

Pure unit tests, no MSW needed (no I/O). This is the correctness core.

```
describe('formatTimecode / parseTimecode')
  it('formatTimecode(0) === "00:00:00,000"')
  it('formatTimecode(3661001) === "01:01:01,001"')
  it('formatTimecode/parseTimecode round-trip for random ms (fast-check or table)')
  it('parseTimecode tolerates "." as decimal separator')
  it('parseTimecode throws on malformed input')

describe('serializeSrt')
  it('serializeSrt emits canonical 1-based LF blocks with blank line per cue')
  it('re-indexes cues 1..N regardless of input index')
  it('serializeSrt([]) === ""')
  it('matches the legacy node block layout (compose ingestion stable)')

describe('parseSrt')
  it('parses canonical SRT into ms-based cues')
  it('parseSrt tolerates CRLF and extra blank lines')
  it('round-trip: serializeSrt(parseSrt(x)) === x for canonical x (idempotent)')
  it('round-trip: parseSrt(serializeSrt(cues)) preserves startMs/endMs/lines')

describe('parseScriptToCues')
  it('hook becomes the first cue (<=3s), scenes follow with cumulative timing')
  it('wraps lines to <=42 chars into <=2 lines')
  it('splits overflow beyond 2 lines into additional cues')
  it('empty input => []')                                  // mirrors node "empty scenes" behavior
  it('uses narration ?? onScreenText ?? textOverlay ?? description per scene')

describe('validateCues — errors')
  it('flags V1 timecode (negative/NaN)')
  it('flags V2 duration (endMs <= startMs)')
  it('flags V3 order (start before previous start)')
  it('flags V4 overlap (start before previous end)')
  it('flags V5 lines (>2 lines)')
  it('flags V6 line_length (>42 chars)')
  it('flags V7 empty (all-blank lines)')

describe('validateCues — warnings (non-blocking)')
  it('flags V8 min_duration (<700ms)')
  it('flags V9 cps (>17 chars/sec)')
  it('flags V10 min_gap (<80ms gap)')
  it('flags V11 beyond_video (endMs > videoDurationMs) when provided')
  it('returns [] for a clean, well-spaced cue list')
```

## 2. Core — `apps/web/src/lib/ai-engine/subtitles/__tests__/generate-subtitles-core.test.ts` (MP-SU-02)

MSW server with `onUnhandledRequest:'error'` for the whole file.

```
describe('generateSubtitlesForDraftCore')
  it('refine=false => rule-based, costCents 0, no fetch')   // request:start spy === []
  it('refine=false => srt === serializeSrt(cues)')
  it('refine=true + key => one LLM call, timecodes unchanged, text tidied')  // MSW openai 200, count===1
  it('refine=true + 5xx + onProviderError=throw => throws')  // MSW openai 500
```

## 3. Node regression — `generate-subtitles.test.ts` (MP-SU-13, EXISTING, unchanged)

Must stay green after the extraction (no edits to the file):

```
generate-subtitles.test.ts > returns SRT formatted subtitles
generate-subtitles.test.ts > each scene gets a subtitle entry
generate-subtitles.test.ts > timing is cumulative
generate-subtitles.test.ts > hook gets first entry
generate-subtitles.test.ts > empty scenes returns empty subtitles
generate-subtitles.test.ts > sets currentStep
```

## 4. Schema — `apps/web/src/lib/content-studio/__tests__/subtitles-schema.test.ts` (MP-SU-06)

```
describe('subtitlesGenerationSchema')
  it('defaults refine to false')
  it('rejects unknown keys (.strict)')
  it('accepts omitted script (derive server-side)')
  it('rejects script over 8000 chars')

describe('subtitlesSaveSchema')
  it('accepts a valid cues+style payload')
  it('accepts empty cues array (clear)')
  it('rejects > 200 cues')
  it('rejects a cue with > 2 lines')
  it('rejects a cue with endMs <= 0')
  it('rejects style with a bad hex color')
  it('rejects unknown keys (.strict)')
```

## 5. Service — `apps/web/src/lib/content-studio/__tests__/generate-subtitles-for-draft.test.ts` (MP-SU-03)

Mock the DB/persistence seam (`requireDraft`, `createMedia`, `getStorage`,
`upsertBundleAssets`, `getDraftBundle`, `insertGenerationRun`, `logAuditEvent`,
`checkDailyBudget`) and `resolveProviderCredential`. MSW `onUnhandledRequest:'error'`
for the whole file.

```
describe('generateSubtitlesForDraft')
  it('mode=mock => rule-based SRT, no provider call (request:start spy [])')
  it('mode=mock => costCents 0, provider "rule-based"')
  it('empty script (no hook/scenes) => transient { id:"", cueCount:0 }, no createMedia')
  it('non-empty => persists role=subtitles asset; meta.srt === .srt bytes (utf-8)')
  it('mode=live + refine + no key => throws HttpError invalid_state (409); no createMedia; no fetch')
  it('mode=live + refine + key + 5xx => throws HttpError upstream_failed (502)')  // MSW openai 500
  it('mode=mock + refine=true => refine ignored, no provider call')
  it('non-video draft (carousel) => throws HttpError invalid_state')
  it('keeps existing style when a subtitles binding already exists')  // reads getDraftBundle().subtitles.meta.style
```

## 6. Service (save) — `apps/web/src/lib/content-studio/__tests__/save-subtitles-for-draft.test.ts` (MP-SU-03)

```
describe('saveSubtitlesForDraft')
  it('valid cues => sorts + re-indexes 1..N + serializes canonical SRT')
  it('persists meta.srt byte-identical to the .srt asset bytes')
  it('rejects overlapping cues => HttpError invalid_input + details.cueErrors[code=overlap]')
  it('rejects out-of-order cues => cueErrors[code=order]')
  it('rejects > 42 char line => cueErrors[code=line_length] with the char count')
  it('rejects empty-text cue => cueErrors[code=empty]')
  it('warnings (cps/min_duration) do NOT block save; returned but persisted')
  it('cues:[] => clears the subtitles binding + .srt media (idempotent twice)')
  it('upsert is scoped to role=subtitles; primary_video binding untouched')  // assert upsertBundleAssets args
  it('records generation_run + audit content_studio.subtitles.saved')
```

## 7. Routes (MP-SU-04 / MP-SU-05)

`apps/web/src/app/api/admin/content-studio/drafts/[id]/__tests__/generate-subtitles.route.test.ts`
and `.../subtitles.route.test.ts`. Mock `requireAdminApi`,
`requireContentStudioEnabled`, `cookies`, and the service fns. Drive exported
`POST` / `PUT`.

```
describe('POST /drafts/[id]/generate-subtitles')
  it('200 { media } in mock mode')
  it('400 invalid_input on malformed body')
  it('400 invalid_input on non-JSON body')
  it('409 invalid_state when cookie=live, refine=true, no key (no provider call)')  // MSW onUnhandledRequest:error
  it('reads cs_generation_mode cookie (defaults mock when absent/garbage)')
  it('passes session.adminId as actorId')
  it('401 when not admin')
  it('error envelope is { error: { code, message, details } }')

describe('PUT /drafts/[id]/subtitles')
  it('200 { media } on a valid save')
  it('400 invalid_input with details.cueErrors on overlapping cues')
  it('200 cleared result when cues:[]')
  it('401 when not admin')
```

## 8. CueEditor — `apps/web/src/components/admin/content-studio-v2/create/tracks/__tests__/CueEditor.test.tsx` (MP-SU-08)

React Testing Library + jsdom.

```
describe('CueEditor')
  it('renders one row per cue with start/end/text fields (role=row)')
  it('TimecodeInput round-trips hh:mm:ss,mmm <-> ms on edit/blur')
  it('invalid timecode sets aria-invalid=true and shows the V1 message')
  it('line over 42 chars shows counter "n/42" and flags line_length')
  it('add cue inserts a default 2s cue after the current')
  it('delete cue removes the row')
  it('split at caret produces two cues sharing the range proportionally')
  it('merge with next yields one cue spanning the union (<=2 lines)')
  it('Alt+ArrowUp nudges start/end by -100ms')
  it('error summary item moves focus to the offending cue field')
  it('table has accessible row labels "Sous-titre n, de X à Y"')
```

## 9. Style + preview — `SubtitleStyleControls.test.tsx` / `SubtitleOverlayPreview.test.tsx` (MP-SU-10/11)

```
describe('SubtitleStyleControls')
  it('emits a BurnInStyle on each control change (font/size/position/color/box)')
  it('position is a radiogroup, keyboard-operable with arrows')
  it('size + opacity sliders expose aria-valuetext')
  it('low text/box contrast shows a non-blocking warning')

describe('SubtitleOverlayPreview')
  it('renders the first cue text positioned per style.position')
  it('applies font/size/color/box from BurnInStyle')
  it('root has role=img with a descriptive aria-label')
```

## 10. SubtitlesTrack — `SubtitlesTrack.test.tsx` (MP-SU-07)

Mock `fetch` via MSW (route handler stubs) — never `vi.stubGlobal`.

```
describe('SubtitlesTrack')
  it('empty state shows "Générer les sous-titres"')
  it('POSTs generate and populates CueEditor on success')
  it('guards empty draftId with a toast, no fetch')
  it('Enregistrer disabled while invalid; enabled when dirty & valid')
  it('PUT save success calls onSaved and toasts "Sous-titres enregistrés"')
  it('maps server details.cueErrors onto the editor rows')
  it('surfaces 409 refine-no-key message inline (role=alert)')
  it('Régénérer asks for confirmation when cues are edited')
  it('disables controls and shows estimator while generating/saving')
```

## 11. MediaStudio wiring / non-regression — `MediaStudio.subtitles.test.tsx` (MP-SU-12, MP-SU-13)

```
describe('MediaStudio + Sous-titres track')
  it('flag off => no Sous-titres track (DOM unchanged, non-regression)')
  it('flag on + reel => Sous-titres track present')
  it('flag on + carousel(image) => no Sous-titres track')
```
Plus the **existing** `MediaStudio.test.tsx` must stay green (generate-visual
untouched — D6).

## 12. Publish summary + compose contract — (MP-SU-09)

```
describe('PublishActionGroup track summary')
  it('shows sous-titres in track summary when present (💬 Sous-titres ✓)')
  it('omits sous-titres row when the bundle has none')

describe('compose subtitles contract')   // compose-subtitles-contract.test.ts
  it('meta.srt equals serializeSrt(cues)')
  it('meta.style is a valid BurnInStyle passed to compose')
```

## Coverage targets

- SRT lib: 100% of `formatTimecode`/`parseTimecode`/`serializeSrt`/`parseSrt`/
  `parseScriptToCues` branches and every `validateCues` rule (V1–V11).
- Service & routes: 100% of branches in the error matrix (`backend-design.md` §7),
  including the empty-script and cues-clear paths.
- A11y assertions (table semantics, aria-invalid, error-summary focus management) are
  part of the component suites (not deferred to E2E).
