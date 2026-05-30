# Subtitles / script-on-video — functional specification

> Source of truth: [`../00_global/ground-truth-codebase.md`](../00_global/ground-truth-codebase.md)
> (decisions D1–D6, §1 pipelines, §2 UI, §6 quality bar). Data-model authority:
> [`../00_global/data-model.md`](../00_global/data-model.md). Task prefix `MP-SU-*`.

## 1. Goal & optimal functioning

The operator, on **step 3 (Visuel)** of `/admin/content-studio-v2/create`, for a
draft whose primary media is a **video** (`reel`/`story`), can attach **timed
subtitles** (the script-on-video) to that video:

1. The **Sous-titres** track appears in the MediaStudio *tracks panel* (only when
   the draft is video-capable and the Media-Studio flag is on — D4/D6), to the right
   of **🎵 Musique** and before **🎞️ Composer**.
2. **Générer les sous-titres** calls
   `POST /api/admin/content-studio/drafts/{id}/generate-subtitles`. The server builds
   a deterministic **SRT** from the draft script (`hook` + scene
   `narration`/`onScreenText`/`textOverlay`/`description`), reusing the node core
   `generateSubtitlesForDraftCore` (D5). On success the track moves to `ready` and a
   **timed-lines editor** (`CueEditor`) is populated with the parsed cues.
3. The operator **edits the cues** in the timed-text editor: per-cue `start`/`end`
   timecode (`hh:mm:ss,mmm`) and `text` (1–2 lines). Live validation enforces
   monotonic, non-overlapping ordering, max chars/line, max lines/cue, and surfaces
   reading-speed (CPS) warnings. Add / delete / split / merge cues are supported.
4. The operator picks a **burn-in style** (font family, size, position
   top/middle/bottom, text colour, background box on/off) in `SubtitleStyleControls`.
   A live **preview overlay** (`SubtitleOverlayPreview`) renders the styled subtitle
   over the current video frame.
5. **Enregistrer** calls `PUT /api/admin/content-studio/drafts/{id}/subtitles` with
   the edited cues (serialized back to SRT) + style. The server validates, re-serializes
   canonical SRT, and persists the `role='subtitles'` bundle asset (SRT text in
   `meta.srt`, style in `meta.style`, `.srt` asset bytes).
6. The `role='subtitles'` asset (SRT + style) is now part of the draft bundle (D1)
   and is read by **Compose** (`../02_compose`, `MP-CO-*`) which burns the subtitles
   onto the video (`compose.ts` consumes `state.subtitles`), and is surfaced in the
   **publish confirm** track-summary (D4). Subtitles are never published alone; they
   are an input to the composed video.

Optimal = the operator gets correct, editable, **timecode-accurate** subtitles in
**mock** mode **without any network call and at zero cost**, deterministically, every
time; SRT round-trips losslessly (`parseSrt(serializeSrt(cues)) ≡ cues`); the burn-in
style chosen in the UI is exactly what Compose applies.

## 2. Actors & permissions

- **Operator/admin** — the only actor. Both routes are guarded by
  `requireAdminApi()` + `requireContentStudioEnabled()` exactly like
  `generate-visual/route.ts`. No new role.

## 3. User stories

- **US-SU-1** — *As an operator I generate subtitles from the draft script* so my
  reel carries the spoken/on-screen text as timed captions. (Given a video draft,
  when I click "Générer les sous-titres", then a `role='subtitles'` asset is created
  and its cues appear in the editor.)
- **US-SU-2** — *As an operator I edit the timed lines* (timecodes + text) so the
  subtitles match the final cut. (The edited cues are serialized to SRT and saved.)
- **US-SU-3** — *As an operator I am stopped from saving invalid subtitles*
  (overlapping/out-of-order cues, over-long lines) so the burned-in result is always
  legible and valid SRT.
- **US-SU-4** — *As an operator I choose a burn-in style* (position/size/box) and
  **see a live preview** so I know exactly how the script appears on the video.
- **US-SU-5** — *As an operator in mock mode I never spend money / hit a provider* so
  staging stays safe (deterministic SRT, `costCents=0`, **no HTTP at all** by
  default).
- **US-SU-6** — *As an operator the subtitles flow into Compose & the publish summary*
  so the final video has the script burned in with my chosen style.

## 4. Track lifecycle states

See [`state-machine.puml`](state-machine.puml). Track-level UI states:

| State | Meaning | UI |
|---|---|---|
| `empty` | no subtitles asset yet | "Générer les sous-titres" CTA + style defaults |
| `generating` | generate request in flight | spinner / estimator bar, controls disabled |
| `editing` | cues loaded, operator reviewing/editing (may be dirty/invalid) | `CueEditor` + `SubtitleStyleControls` + `SubtitleOverlayPreview` |
| `saving` | save (`PUT`) request in flight | controls disabled, estimator bar |
| `ready` | persisted asset matches the editor (clean) | editor + "Régénérer" / "Enregistrer" (disabled while clean) |
| `invalid` | editor has validation errors | save disabled, inline errors, error summary |
| `error` | last request failed | toast + inline error, controls re-enabled |

`editing`, `ready`, `invalid` differ only by the editor's `dirty`/`valid` flags; they
share the same mounted UI (no layout shift).

## 5. Inputs

### 5.1 Generate (`POST …/generate-subtitles`)

| Field | Type | Constraints | Default |
|---|---|---|---|
| `script` | string | 1..8000 chars; optional override of the draft script text | derived from draft script |
| `refine` | boolean | when `true`, optional LLM tidy of cue text (live+key only) | `false` |
| `mode` | `mock`\|`live` | from `cs_generation_mode` cookie, route-resolved | `mock` |

By default generation is **pure**: the script (draft or override) is segmented into
cues by `parseScriptToCues` and serialized by `serializeSrt`. `refine` is the **only**
path that may touch an LLM, and only in `live` mode with a key.

### 5.2 Save (`PUT …/subtitles`)

| Field | Type | Constraints |
|---|---|---|
| `cues` | `Cue[]` | 0..200 cues; each `{ index, startMs, endMs, lines: string[] }` (1..2 lines) |
| `style` | `BurnInStyle` | `{ font, sizePx, position, textColor, boxColor?, boxOpacity? }` |

The server **revalidates** `cues` (never trusts the client) with `validateCues`,
re-serializes canonical SRT (re-indexing 1..N), and rejects on any structural error
(see §6). `cues:[]` (empty) clears the subtitles for the draft (deletes the binding).

## 6. Edit-validation rules (the heart of this feature)

Applied client-side (live, for UX) **and** server-side (authoritative, in
`validateCues`). All rules are pure functions over the cue list. Units are integer
**milliseconds** internally; SRT timecodes serialize to `hh:mm:ss,mmm`.

| # | Rule | Constraint | Severity | Message (FR) |
|---|---|---|---|---|
| V1 | **Timecode format** | each `start`/`end` parses as `hh:mm:ss,mmm`, 0 ≤ value | error | "Horodatage invalide (attendu hh:mm:ss,mmm)." |
| V2 | **Positive duration** | `endMs > startMs` for every cue | error | "La fin doit être après le début." |
| V3 | **Monotonic ordering** | `cue[i].startMs ≥ cue[i-1].startMs` (after sort by start) | error | "Les sous-titres doivent être ordonnés dans le temps." |
| V4 | **Non-overlapping** | `cue[i].startMs ≥ cue[i-1].endMs` | error | "Chevauchement : un sous-titre commence avant la fin du précédent." |
| V5 | **Max lines/cue** | `lines.length ∈ {1,2}` | error | "Maximum 2 lignes par sous-titre." |
| V6 | **Max chars/line** | each line ≤ `MAX_CHARS_PER_LINE` (default **42**) | error | "Ligne trop longue ({n}/42 caractères)." |
| V7 | **Non-empty text** | at least one non-blank line per cue | error | "Le texte du sous-titre est vide." |
| V8 | **Min duration** | `endMs - startMs ≥ MIN_CUE_MS` (default **700 ms**) | warning | "Sous-titre très court (< 0,7 s)." |
| V9 | **Reading speed (CPS)** | `chars / durationSec ≤ MAX_CPS` (default **17 CPS**) | warning | "Lecture rapide ({cps} c/s, max conseillé 17)." |
| V10 | **Min gap** | gap to next cue `≥ MIN_GAP_MS` (default **80 ms**) when not contiguous | warning | "Écart minimal entre sous-titres non respecté." |
| V11 | **Within video duration** | `endMs ≤ videoDurationMs` (if known) | warning | "Le sous-titre dépasse la durée de la vidéo." |

- **Errors block save** (server returns 400 `invalid_input` with the failing cue
  indices in `details`); **warnings do not block** (surfaced inline + in a summary).
- Constants live in `src/lib/ai-engine/subtitles/srt.ts` (`SUBTITLE_LIMITS`) so client
  and server share one source of truth.

## 7. SRT correctness requirements

- `formatTimecode(ms)` / `parseTimecode(s)` are exact inverses for all ms ≥ 0:
  `parseTimecode(formatTimecode(ms)) === ms`. Format is `HH:MM:SS,mmm` (comma decimal,
  3-digit millis, zero-padded), matching the existing `formatTimestamp` in
  `generate-subtitles.ts` (which this lib supersedes; the node delegates to it).
- `serializeSrt(cues)` emits canonical blocks: `index\n start --> end\n line1\n[ line2]\n\n`,
  1-based contiguous indices, `\n` separators (LF), trailing blank line per block,
  matching the node's current `entries.join('\n')` shape so `compose.ts` ingestion is
  unchanged.
- `parseSrt(srt)` is tolerant of CRLF and extra blank lines on input but
  `serializeSrt` always emits canonical LF; the round-trip
  `serializeSrt(parseSrt(x))` is **idempotent** for any canonical `x`.
- The `meta.srt` string and the `.srt` asset bytes must be byte-identical (data-model
  §7 invariant).

## 8. Outputs

A `SubtitlesResult` (see [`backend-design.md`](backend-design.md) §3): the created
media item (`kind:'subtitles'`, `role:'subtitles'`) plus the parsed `cues`, the canonical
`srt`, the `style`, `cueCount`, `provider`, `costCents`, adapted to a
`StudioV2SubtitlesItem` shape for the UI.

## 9. Edge cases & required handling

| # | Edge case | Required behavior |
|---|---|---|
| E1 | No `draftId` (URL `/drafts//generate-subtitles`) | UI guards with a toast (mirror `MediaStudio.generateVisual`); never fire the request. |
| E2 | Draft is not video-capable (not `reel`/`story`) | Track hidden; service still validates draft exists and returns 409 `invalid_state` "Sous-titres réservés aux formats vidéo (Reel/Story)." if forced. |
| E3 | Empty script (no hook, no scenes) | Generation returns `cues:[]`, `srt:''` — mirrors the node's "empty scenes returns empty subtitles" behavior. Track stays in `editing` with an empty editor + a hint "Aucun texte à sous-titrer." **No asset is written until Enregistrer** with ≥1 cue. |
| E4 | `mode='mock'` or `live` (refine=false) | Pure SRT build, `provider:'mock'` / `'rule-based'`, `costCents:0`, **no fetch**. |
| E5 | `mode='live'` + `refine=true` + no LLM key | `HttpError('invalid_state','Aucune clé IA configurée pour l’affinage. Désactivez l’affinage ou repassez en mock.')` → 409; **no asset written**, **no fetch with a key**. |
| E6 | `mode='live'` + key + refine + provider 5xx | Service surfaces `HttpError('upstream_failed', …)` → 502. The node's empty-fallback is **not** used in the per-draft service (the operator must know it failed). |
| E7 | Overlapping / out-of-order cues on **save** | `validateCues` fails → 400 `invalid_input`, `details.cueErrors` lists the offending indices + rules. No partial write. |
| E8 | Over-long line on save | V6 fails → 400 with the cue index + char count. |
| E9 | `cues:[]` on save | Clears subtitles: deletes the `role='subtitles'` binding + `.srt` asset for the draft (idempotent). |
| E10 | Regenerate after editing | Confirm-guard in UI ("Cela remplacera vos sous-titres édités"). On confirm, generate replaces the editor content; nothing is persisted until Enregistrer. |
| E11 | Very long script (> caps) | Cues are still produced; lines over `MAX_CHARS_PER_LINE` are **soft-wrapped** by `parseScriptToCues` into ≤2 lines, and excess is split into additional cues. Mirrors the node's 120-char truncation but improves it to wrapping. |
| E12 | Concurrent double-click | UI disables the button while `generating`/`saving`; routes are idempotent (upsert by role; last write wins). |
| E13 | Compose runs with no subtitles | Compose degrades gracefully (existing `compose.ts` `Boolean(subtitles)` path). Subtitles are optional. |

## 10. Non-regression (D6)

- `generateSubtitlesNode` keeps its exact graph contract (returns `{ subtitles,
  currentStep:'generate_subtitles' }`); the existing
  `generate-subtitles.test.ts` (6 cases) stays **green unchanged** after the core
  extraction (MP-SU-13).
- `generateVisualForDraft` and the existing 4-step flow are **untouched**; image-only
  / no-subtitle drafts behave exactly as before.
- The Sous-titres track renders **only** when `CONTENT_STUDIO_MEDIA_STUDIO_ENABLED`
  is on **and** the draft is video-capable. Flag off ⇒ DOM identical to today.
- `compose.ts` consumption of `state.subtitles` (the SRT string) is **unchanged**;
  this feature only changes *who supplies* the string (per-draft service vs graph).
- Proven by regression tests in [`test-plan-vitest.md`](test-plan-vitest.md)
  (`non-regression` block) and [`test-plan-playwright.md`](test-plan-playwright.md).

## 11. Acceptance

See [`acceptance-criteria.csv`](acceptance-criteria.csv) and
[`verification-checklist.csv`](verification-checklist.csv).
