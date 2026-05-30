# Voice-over — functional specification

> Source of truth: [`../00_global/ground-truth-codebase.md`](../00_global/ground-truth-codebase.md)
> (decisions D1–D6, §1 pipelines, §2 UI, §6 quality bar). Task prefix `MP-VO-*`.

## 1. Goal & optimal functioning

The operator, on **step 3 (Visuel)** of `/admin/content-studio-v2/create`, for a
draft whose primary media is a **video** (`reel`/`story`), can attach a **TTS
voice-over** to that video:

1. The **Voix-off** track appears in the MediaStudio *tracks panel* (only when
   the draft is video-capable and the Media-Studio flag is on — D4/D6).
2. A **script textarea** is pre-filled from the draft narration (script `hook` +
   scene `narration`/`description`, the exact text `buildVoiceoverText` builds in
   `generate-voiceover.ts`). The operator may edit it.
3. A **voice selector** picks the synthetic voice (mock: a single deterministic
   voice; live: `nova`/`alloy`/`bella`…).
4. **Générer la voix-off** calls
   `POST /api/admin/content-studio/drafts/{id}/generate-voiceover`. On success an
   **audio player** appears with the generated track (duration badge, play/pause,
   seek, mute). The track state becomes `ready`.
5. **Régénérer** re-runs with the current script/voice, replacing the asset.
6. The `role='voiceover'` asset is now part of the draft bundle (D1) and is read
   by **Compose** (`../02_compose`) and surfaced in the **publish confirm**
   track-summary (D4). Voice-over alone is never published; it is an input to the
   composed video.

Optimal = the operator gets a correct, previewable voice-over in **mock** mode
**without any network call and at zero cost**, deterministically, every time; and
the same code path produces a real TTS track when a live key is configured.

## 2. Actors & permissions

- **Operator/admin** — the only actor. Route is guarded by
  `requireAdminApi()` + `requireContentStudioEnabled()` exactly like
  `generate-visual/route.ts`. No new role.

## 3. User stories

- **US-VO-1** — *As an operator I generate a voice-over from the draft narration
  so my reel has spoken audio.* (Given a video draft, when I click "Générer la
  voix-off", then a `role='voiceover'` audio asset is created and previewable.)
- **US-VO-2** — *As an operator I edit the script before generating* so the
  narration matches my intent. (The textarea value is sent as `script`.)
- **US-VO-3** — *As an operator I regenerate the voice-over* after tweaking the
  script/voice; the previous voice-over asset is replaced (one voice-over per
  draft, `role='voiceover'` is unique per draft).
- **US-VO-4** — *As an operator in mock mode I never spend money / hit a provider*
  so staging stays safe (deterministic silent track, `costCents=0`, no HTTP).
- **US-VO-5** — *As an operator without a live key, switching to live and
  generating shows a clear 409 error* ("Aucune clé TTS configurée…") instead of a
  silent fake.
- **US-VO-6** — *As an operator the voice-over flows into Compose & the publish
  summary* so the final video carries my narration.

## 4. Track lifecycle states

See [`state-machine.puml`](state-machine.puml). Track-level UI states:

| State | Meaning | UI |
|---|---|---|
| `empty` | no voice-over asset, script editable | textarea + voice + "Générer" |
| `generating` | request in flight | spinner / estimator bar, controls disabled |
| `ready` | asset exists, previewable | `AudioTrackPlayer` + "Régénérer" |
| `error` | last attempt failed | toast + inline error, "Générer" re-enabled |
| `stale` | script edited after a `ready` asset | "Régénérer" highlighted, badge "modifié" |

`stale` is purely a UI hint (the asset is still valid/playable); it nudges the
operator to regenerate after editing the script.

## 5. Inputs

| Field | Type | Constraints | Default |
|---|---|---|---|
| `script` | string | 1..4000 chars (OpenAI caps at 4096; ElevenLabs at 5000) | derived from draft narration |
| `voice` | enum | `nova`\|`alloy`\|`shimmer`\|`bella` (live) / `mock` | first allowed |
| `mode` | `mock`\|`live` | from `cs_generation_mode` cookie, route-resolved | `mock` |

`script` is trimmed; empty-after-trim → 400 `invalid_input`. The service mirrors
the node fallback: a null/blank script falls back to `'Le rituel FemiGlow.'`
**only** when derived server-side; an explicit empty body field is rejected.

## 6. Outputs

A `VoiceoverResult` (see [`backend-design.md`](backend-design.md) §2):
the created media item (`kind:'audio'`, `role:'voiceover'`, `previewUrl`,
`durationSec`, `provider`, `costCents`) adapted to `StudioV2MediaItem`-compatible
shape for the UI.

## 7. Edge cases & required handling

| # | Edge case | Required behavior |
|---|---|---|
| E1 | No `draftId` (URL `/drafts//generate-voiceover`) | UI guards with a toast (mirror `MediaStudio.generateVisual`); never fire the request. |
| E2 | Draft is not video-capable (not `reel`/`story`) | Track hidden; service still validates draft exists and returns 409 `invalid_state` "voix-off réservée aux formats vidéo" if forced. |
| E3 | `mode='mock'` | ffmpeg `anullsrc` silent WAV, `provider:'mock'`, `costCents:0`, **no fetch**. |
| E4 | `mode='live'` + no TTS key | `HttpError('invalid_state','Aucune clé TTS configurée…')` → 409; **no asset written**, **no fetch** to provider host with a key. |
| E5 | `mode='live'` + key, provider 5xx | Service surfaces `HttpError('upstream_failed', …)` → 502. The node's silent fallback is **not** used in the per-draft service (the operator must know it failed, unlike the autonomous graph). |
| E6 | ffmpeg unavailable (mock path) | `HttpError('upstream_failed','Génération audio indisponible (ffmpeg).')` → 502. |
| E7 | Regenerate | Replaces the existing `role='voiceover'` asset for the draft (upsert by role); old asset row marked superseded per `00_global` data-model. |
| E8 | Script > cap | Truncate to provider cap (4096/5000) exactly as the node does; record `truncated:true` in `generationParams`. |
| E9 | Budget | `checkDailyBudget(estimate)` before a live call (mock estimate = 0). Over budget → 429 `budget_exceeded`. |
| E10 | Concurrent double-click | UI disables the button while `generating`; route is idempotent enough (last write wins, upsert by role). |

## 8. Non-regression (D6)

- `generateVisualForDraft` and the existing 4-step flow are **untouched**; image-
  only / no-audio drafts behave exactly as before.
- The Voix-off track renders **only** when `CONTENT_STUDIO_MEDIA_STUDIO_ENABLED`
  is on **and** the draft is video-capable. Flag off ⇒ DOM identical to today.
- Proven by regression tests in [`test-plan-vitest.md`](test-plan-vitest.md)
  (`non-regression` block) and [`test-plan-playwright.md`](test-plan-playwright.md).

## 9. Acceptance

See [`acceptance-criteria.csv`](acceptance-criteria.csv) and
[`verification-checklist.csv`](verification-checklist.csv).
