# Robustness principles (MP-TB)

> Concrete principles that make the battery **robustness-first**. Each principle
> names the invariant, the failure it injects, and the **real** test rows (file +
> `describe > it`) that enforce it. Test names are taken verbatim from the feature
> folders' `test-plan-vitest.md` / `test-plan-msw.md`; see [`test-matrix.csv`](./test-matrix.csv)
> for the full id mapping. The user's rule stands: **count is irrelevant —
> robustness is the product.**

---

## P1 — Adversarial & property tests (don't test the happy path twice)

The pure cores are tested with **round-trip / property** assertions, not just
example outputs:

- SRT timecode round-trip: `srt.test.ts > formatTimecode/parseTimecode round-trip
  for random ms (fast-check or table)` — `parseTimecode(formatTimecode(ms))===ms`.
- SRT serialize/parse idempotence: `srt.test.ts > round-trip: serializeSrt(parseSrt(x)) === x for canonical x (idempotent)`
  and `> parseSrt(serializeSrt(cues)) preserves startMs/endMs/lines`.
- Separator tolerance: `srt.test.ts > parseTimecode tolerates "." as decimal
  separator`; `> parseSrt tolerates CRLF and extra blank lines`.
- Wrapping invariant: `srt.test.ts > parseScriptToCues wraps lines to <=42 chars
  into <=2 lines` and `> splits overflow beyond 2 lines into additional cues`.
- Cost formula parity (adversarial against drift): voice-over verification
  "Cost formulas match node (openai 1500/1M chars; eleven 3/1k chars; mock 0)".

Adversarial inputs are first-class: empty script, blank/whitespace lines,
shuffled cue indices, > 200 cues, > 42-char lines, malformed timecodes, unknown
JSON keys (`.strict()`), non-boolean flags, non-JSON bodies.

---

## P2 — Failure injection (provider 5xx / timeout / abort / missing source / codec)

Every external boundary is failed on purpose, and the assertion is **what the
system does NOT do** as much as what it does (no fake asset, no orphan temp file,
no silent success):

| Injected failure | Where | Expected | Test row |
|---|---|---|---|
| TTS provider **5xx** | service live+key | `upstream_failed` 502, **no** silent fake asset | `generate-voiceover-for-draft.test.ts > live + key + provider 5xx → upstream_failed` |
| TTS **5xx + silent_fallback** (graph) | node core | `degraded:true`, `provider:'fallback'` (non-fatal in graph) | `synthesize-voiceover.test.ts > openai 5xx + onProviderError=silent_fallback => degraded silent track` |
| TTS **401** | MSW handler available | surfaced, not swallowed | `ttsHandlers.openai401` (msw plan §2) |
| ffmpeg **error event** | compose live | `upstream_failed` 502, **`unlink` called**, no asset | `compose-draft-video.test.ts > ffmpeg error (live) → throws HttpError upstream_failed no asset persisted` |
| ffmpeg **hang → timeout** | compose live | `cmd.kill('SIGKILL')`, `unlink` called, 502 | `compose-media-bundle.test.ts > timeout => kills ffmpeg (SIGKILL) rejects compose_timeout unlinks output` |
| **missing source file** (readFile null) | compose live | `upstream_failed`, **no `writeFile`** | `compose-media-bundle.test.ts > missing source file (readFile null) => throws compose_source_missing, no writeFile` |
| **codec-copy mux failure** | compose core | retries once with `libx264`, then succeeds | `compose-media-bundle.test.ts > codec-copy mux failure => retries once with libx264 then succeeds` |
| LLM refine **5xx** | subtitles live+refine | `upstream_failed` 502, no fake asset | `generate-subtitles-for-draft.test.ts > mode=live + refine + key + 5xx => upstream_failed` |
| **oversized text** (> provider cap) | voice-over live | truncate to 4096, `truncated=true` recorded | `synthesize-voiceover.test.ts > truncates text to 4096 for openai and sets truncated=true` |
| **zero-length track** (empty SRT) | compose / subtitles | `hasSubtitles:false`, `degraded:true`, **not fatal** | `compose-media-bundle.test.ts > live + subtitles empty/blank => hasSubtitles false, degraded true, not fatal` |
| **abort / no-key** | all services live | `invalid_state` 409 **before** any I/O, zero network | `*-for-draft.test.ts > mode=live no key → throws HttpError invalid_state (409)` |

Abort discipline: the `live`-no-key path must reject **before** `createMedia` /
`fetch` / `ffmpeg` — proven by asserting those spies were **not** called and the
`request:start` spy is `[]`.

---

## P3 — Idempotence

- **Regenerate replaces by role** (no asset accumulation): one binding per role
  via per-role delete-then-insert.
  - `generate-voiceover-for-draft.test.ts > regenerate replaces the existing voiceover asset (upsert by role)`
  - `compose-draft-video.test.ts > recompose replaces the existing composed_video asset (upsert by role)`
  - `save-subtitles-for-draft.test.ts > upsert is scoped to role=subtitles; primary_video binding untouched`
- **Clear is idempotent**: `save-subtitles-for-draft.test.ts > cues:[] => clears
  the subtitles binding + .srt media (idempotent twice)`.
- **SRT canonical/idempotent**: re-saving shuffled indices yields contiguous
  `1..N` LF blocks; `serializeSrt(parseSrt(x)) === x`.
- **Migration idempotence**: enum `ADD VALUE` is guarded by `DO $$ … IF NOT
  EXISTS`; `meta_json` via `ADD COLUMN IF NOT EXISTS`; re-applying `0064` is safe
  (db-migration §5/§6). Verified by the post-apply `SELECT` queries.

---

## P4 — Concurrency & isolation

- **Per-role isolation**: writing one role never deletes another. Asserted by
  inspecting `upsertBundleAssets` args (scoped to `(draftId, role)`) and by
  "primary_video binding untouched" rows. This is the key fix vs. the old
  `upsertPrimaryAsset` which deleted **all** bindings for the draft.
- **MSW server idempotent listen**: the shared wrapper (ARC-004) lets ~35 files
  + the new suites coexist without double-listen throws; tests don't fight over
  the global server.
- **E2E concurrency posture**: the new specs run in the mock-mode project; mock
  compose is a deterministic byte-copy (no shared ffmpeg encode), so parallel
  workers don't contend on the encoder. (Mirrors the existing
  `ai-engine-concurrent.spec.ts` posture.)

---

## P5 — Resource cleanup (no orphan temp files)

Every compose failure branch asserts `fs.unlink` was called on the partial
output — error, timeout, and (where a partial was written) source-missing. CI
verification row: compose "No orphan temp files in tests — unlink called on every
reject path". The fake-timer timeout test additionally asserts `cmd.kill('SIGKILL')`
so a hung encoder is never leaked.

---

## P6 — i18n (French) & a11y assertions live in unit/component tests, not E2E only

A11y is **proven at the component tier** so regressions are caught fast and
deterministically; E2E only smoke-tests keyboard:

- Audio: `AudioTrackPlayer.test.tsx > group has role=group aria-label="Lecteur
  voix-off"`, `> renders play button with aria-label and toggles aria-pressed`,
  `> seek slider exposes aria-valuetext "N secondes sur M"`, `> Space on focused
  play button toggles playback`.
- Compose: `ComposePanel.test.tsx > present-track include switch toggles
  aria-checked and marks stale`, `> surfaces 409 no-primary-video message inline
  (role=alert)`.
- Subtitles editor: `CueEditor.test.tsx > table has accessible row labels
  "Sous-titre n, de X à Y"`, `> invalid timecode sets aria-invalid=true and shows
  the V1 message`, `> error summary item moves focus to the offending cue field`.
- Style/preview: `SubtitleStyleControls.test.tsx > position is a radiogroup,
  keyboard-operable with arrows`; `SubtitleOverlayPreview.test.tsx > root has
  role=img with a descriptive aria-label`.
- i18n: every verification-checklist `i18n` row greps the component strings for
  English; all user-facing copy is French (e.g. "Voix-off générée", "Vidéo
  composée", "Sous-titres enregistrés", "Aucune clé TTS configurée").

---

## P7 — No-network proofs (the silence is the assertion)

For every `mock` and `live-no-key` path the test registers **no** MSW handler and
asserts `seen` (a `request:start` spy) is `[]`. With `onUnhandledRequest:'error'`
a stray request throws first, so `[]` is a *belt-and-suspenders* proof. Compose
asserts `seen === []` on **every** path (it has no providers at all). Subtitles'
default/save paths assert the same. See [`msw-harness-plan.md`](./msw-harness-plan.md) §4.

```ts
const seen: string[] = [];
server.events.on('request:start', ({ request }) => seen.push(request.url));
// … run mock/no-key path …
expect(seen).toEqual([]);            // zero network
```

---

## P8 — Snapshot discipline (semantic asserts over brittle snapshots)

- **No DOM/HTML snapshots** for the new components — assert roles, labels, and
  state via queries (RTL) so refactors don't churn snapshots and a11y stays
  explicit.
- The one legitimate "byte-stable" claim — flag-off DOM unchanged — is asserted
  by **structural queries** ("no Voix-off/Montage/Sous-titres track present"),
  not a full snapshot, plus the existing `MediaStudio.test.tsx` staying green.
- SRT "canonical block layout" is asserted against an **explicit expected
  string** (LF blocks, 1-based indices), which doubles as a stable contract for
  compose ingestion (`serializeSrt > matches the legacy node block layout`).
- Contract tests use **schema validation** (`python3 -m json.tool
  data-contract.json`, OpenAPI lint) rather than golden snapshots.

---

## P9 — Determinism (fake timers + pinned clock)

Pin the clock for any output that embeds time and for any timeout race
(strategy §5). Output `url`/`assetId` are asserted deterministic
(`compose-media-bundle.test.ts > mock => output url/assetId deterministic under
fake system time`). No test sleeps on wall-clock; the timeout is driven by
`vi.advanceTimersByTimeAsync`.

---

## P10 — Non-regression as an adversary

Treat D6 as something to actively try to break:

- Run the **existing** node tests unedited and fail the suite if `git diff` is
  non-empty for `compose.test.ts` / `generate-voiceover.test.ts` /
  `generate-subtitles.test.ts` (the extraction must be behavior-preserving).
- Assert the bridge with **none** of the new DTO fields yields the identical
  outcome (one primary visual) — the backward-compat matrix in
  [`../00_global/dto-bridge-changes.md`](../00_global/dto-bridge-changes.md) §4.
- Assert `PublishActionGroup` **falls back to the primary** video when no
  composed video exists (`PublishActionGroup.compose.test.tsx > falls back to
  primary video when no composed video (non-regression)`).
- Keep the existing `create-golden-path.spec.ts` in the E2E gate.
