# Compose (montage vidéo) — functional specification

> Source of truth: [`../00_global/ground-truth-codebase.md`](../00_global/ground-truth-codebase.md)
> (decisions D1–D6, §1 pipelines, §2 UI, §6 quality bar). Task prefix `MP-CO-*`.
> Grounded in `src/lib/ai-engine/nodes/compose.ts` (`composeVideo`,
> `createEmptyAsset`, the no-audio byte-copy path, the `amix` filter graph) and
> `src/lib/ai-engine/nodes/transcode-export.ts`.

## 1. Goal & optimal functioning

The operator, on **step 3 (Visuel)** of `/admin/content-studio-v2/create`, for a
draft whose primary media is a **video** (`reel`/`story`), can **assemble the
draft's tracks into one composed mp4**:

1. The **Montage** panel appears in the MediaStudio *tracks panel* (only when the
   draft is video-capable and the Media-Studio flag is on — D4/D6).
2. The panel shows **track-presence toggles**, each reflecting whether the bundle
   currently has that asset:
   `🎬 Vidéo (primary_video) · 🎙️ Voix-off (voiceover) · 🎵 Musique (music) · 💬 Sous-titres (subtitles)`.
3. **Composer** calls `POST /api/admin/content-studio/drafts/{id}/compose`. The
   service reads the draft bundle (`getDraftBundle`), passes the present tracks to
   the reused `composeDraftVideo` core, and persists the result as a
   `role='composed_video'` asset.
4. On success the **composed video** plays via the reused `VideoPlayer.tsx`, with a
   summary chip of which tracks were folded in
   (`{ hasVoiceover, hasMusic, hasSubtitles }` mirrored from
   `compose.ts` `generationParams`).
5. **Recomposer** re-runs after a track changes; the previous `composed_video`
   asset is replaced (upsert by role).
6. The `role='composed_video'` asset is surfaced in the **publish confirm**
   (`PublishActionGroup`) — the operator publishes the **composed** video, not the
   raw primary clip (D4). Publishing stays **dry-run** (`SOCIAL_PUBLISHING_MODE`).

Optimal = in **mock** mode the operator always gets a correct, previewable
composed mp4 **deterministically, at zero cost, with no network call and no
provider call** (a byte-copy of the primary video, mirroring the
`compose.ts` no-audio path); and the **same code path** muxes real audio/subtitles
into the video when the tracks exist (`live`), with robust ffmpeg handling.

## 2. Actors & permissions

- **Operator/admin** — the only actor. Route is guarded by `requireAdminApi()` +
  `requireContentStudioEnabled()` exactly like `generate-visual/route.ts`. No new
  role. The Media-Studio sub-flag (`CONTENT_STUDIO_MEDIA_STUDIO_ENABLED`, D6) is
  re-checked in the service.

## 3. User stories

- **US-CO-1** — *As an operator I assemble my draft's tracks into one video* so I
  can preview and publish the finished reel. (Given a video draft with at least a
  primary video, when I click "Composer", then a `role='composed_video'` mp4 is
  created and previewable.)
- **US-CO-2** — *As an operator I see at a glance which tracks are present* (🎬 / 🎙️ /
  🎵 / 💬) so I know what the montage will fold in before composing.
- **US-CO-3** — *As an operator I recompose* after generating/regenerating a
  voice-over or subtitles; the previous composed video is replaced (one
  `composed_video` per draft, unique by role).
- **US-CO-4** — *As an operator in mock mode I never hit a provider/network and pay
  nothing* so staging stays safe (deterministic byte-copy mp4, `costCents=0`, no
  HTTP, no provider call).
- **US-CO-5** — *As an operator I publish the composed video* (the publish confirm
  shows the composed mp4 + a track summary), in dry-run.
- **US-CO-6** — *As an operator, if compose fails (ffmpeg error / missing source),
  I get a clear error* instead of a silently-degraded asset passed off as success.

## 4. Track lifecycle states

See [`state-machine.puml`](state-machine.puml). Panel-level UI states:

| State | Meaning | UI |
|---|---|---|
| `empty` | no `composed_video` asset yet | track toggles + "Composer" (enabled iff `hasPrimaryVideo`) |
| `composing` | request in flight | spinner / estimator bar, controls disabled |
| `ready` | `composed_video` exists, previewable | `VideoPlayer` + track summary + "Recomposer" |
| `stale` | a source track changed after a `ready` compose | "Recomposer" emphasized, badge "à recomposer" |
| `error` | last attempt failed | toast + inline error, "Composer" re-enabled |
| `blocked` | no primary video in the bundle | "Composer" disabled + hint "Générez d'abord une vidéo" |

`stale` is a UI hint driven by comparing the `composed_video` `meta.sourceAssetIds`
(or `createdAt`) against the current bundle; the composed asset is still
playable until recomposed.

## 5. Inputs

The route body is intentionally thin — Compose reads the bundle server-side, not
from the client. Optional toggles let the operator **exclude** a present track.

| Field | Type | Constraints | Default |
|---|---|---|---|
| `includeVoiceover` | boolean | — | `true` (include if present) |
| `includeMusic` | boolean | — | `true` (include if present) |
| `includeSubtitles` | boolean | — | `true` (include if present) |
| `export` | boolean | — | `false` (chain `transcodeExportNode`) |
| `mode` | `mock`\|`live` | from `cs_generation_mode` cookie, route-resolved | `mock` |

The set of tracks actually folded in = `(bundle ∩ include* flags)`. Excluding a
track the bundle does not have is a no-op. The **primary video** is always required
(it cannot be excluded).

## 6. Outputs

A `ComposeResult` (see [`backend-design.md`](backend-design.md) §2): the created
media item (`kind:'video'`, `role:'composed_video'`, `previewUrl`, `durationSec`,
`width`/`height`, `provider`) plus the **track-presence report**
`tracks: { hasVoiceover, hasMusic, hasSubtitles }` and, when `export:true`, an
optional `export: { url, width, height, degraded }`. Adapted to a
`StudioV2MediaItem`-compatible shape for `VideoPlayer.tsx`.

## 7. Edge cases & required handling (ffmpeg robustness is first-class)

| # | Edge case | Required behavior |
|---|---|---|
| E-CO-1 | No `draftId` (URL `/drafts//compose`) | UI guards with a toast (mirror `MediaStudio.generateVisual`); never fire the request. |
| E-CO-2 | Draft not video-capable (not `reel`/`story`) | Panel hidden; service returns 409 `invalid_state` "Montage réservé aux formats vidéo (Reel/Story)" if forced. |
| E-CO-3 | **No primary video** in the bundle | 409 `invalid_state` "Aucune vidéo primaire à monter." — **before** any ffmpeg call. In `live`, **no extra track** (vo/music/subs) present is also 409 "Aucune piste à monter (voix-off, musique ou sous-titres)." (a live mux with nothing to add is wasteful; mock still byte-copies for preview). |
| E-CO-4 | `mode='mock'` | **Byte-copy** the primary video to a new `composed-*.mp4` (mirrors `compose.ts` L56–78), `provider:'compose:mock'`, `costCents:0`, **no provider call, no network, no real ffmpeg mux**. The track report still reflects present tracks. |
| E-CO-5 | **Missing source file** on disk (bundle row points at a file that's gone) | `readFile` returns null (as in `compose.ts`) → 502 `upstream_failed` "Fichier vidéo source introuvable."; **no empty asset persisted** (the per-draft service does NOT mirror the node's silent `createEmptyAsset` — the operator must know). |
| E-CO-6 | **Zero-length / corrupt** track file | ffmpeg emits `error` → core rejects → 502 `upstream_failed` "Échec du montage ffmpeg."; temp output cleaned up. |
| E-CO-7 | **Codec / dimension mismatch** (audio that won't `-c:v copy`-mux, mismatched sample rate) | The core uses the existing `complexFilter` `amix` + `-c:a aac` re-encode (audio is always re-encoded; video is `-c:v copy`). If `-c:v copy` fails on the mux (incompatible container), the core **retries once** with `-c:v libx264` fallback, then surfaces 502 on a second failure. (See backend-design §1.4.) |
| E-CO-8 | **Timeout** (ffmpeg hangs on a large/garbled file) | The core wraps the ffmpeg promise in a `withTimeout(ms)` (default 90s, mirrors route `maxDuration`); on timeout it kills the ffmpeg process (`cmd.kill('SIGKILL')`), cleans the temp output, and rejects → 502 "Montage interrompu (délai dépassé)." |
| E-CO-9 | **Large files** | Streaming via fluent-ffmpeg `.save()` (no full-buffer read of the mux output); only the byte-copy path reads the primary into a buffer (already how `compose.ts` does it). Output size is `stat`-ed, not buffered. |
| E-CO-10 | **Temp-file cleanup** | On any failure (reject/throw/timeout) the partially-written `outputPath` is `unlink`ed in a `finally`. On success the temp output IS the final asset file (moved into the media store via `createMedia`). No orphan temp files. |
| E-CO-11 | Recompose | Replaces the existing `role='composed_video'` asset for the draft (upsert by role); a regeneration never touches `primary_video`/`voiceover`/`music`/`subtitles`. |
| E-CO-12 | Subtitles present | SRT comes from the `role='subtitles'` binding's `meta.srt` (text) and/or its `.srt` asset bytes (data-model §5). When included, the core burns/attaches them per the node's `hasSubtitles` flag; if SRT is empty/malformed it is **skipped** (logged, `hasSubtitles:false`), not fatal. |
| E-CO-13 | Voice-over + music both present | Mirrors `compose.ts` L97–101: `amix=inputs=2:duration=longest` with voice-over at `volume=1.0` and music ducked to `volume=0.3`. |
| E-CO-14 | `export:true` then transcode fails | The composed asset is still returned (success); the optional `export` field is `{ degraded:true, reason }` (mirrors `transcode-export.ts` ACT-BE-032 degraded fallback) — compose itself does not fail because export failed. |
| E-CO-15 | Budget | `checkDailyBudget(0)` (compose is local ffmpeg, cost 0 in both modes). Kept for parity. Over budget → 429 (unreachable at cost 0, but the guard stays). |
| E-CO-16 | Concurrent double-click | UI disables "Composer" while `composing`; route is idempotent enough (last write wins, upsert by role). |

## 8. Non-regression (D6)

- `composeNode` (graph) keeps its exact behavior: the extracted `composeMediaBundle`
  core is called by a thin adapter; **`compose.test.ts` stays 100% green
  unchanged** (`composeNode > returns composed asset for video content`,
  `> video composition combines video + audio`, `> cost is 0 for composition`,
  `> handles missing videos gracefully`, …).
- `generateVisualForDraft` and the existing 4-step flow are **untouched**;
  image-only / no-track drafts behave exactly as before.
- The Montage panel renders **only** when `CONTENT_STUDIO_MEDIA_STUDIO_ENABLED` is
  on **and** the draft is video-capable. Flag off ⇒ DOM identical to today.
- `transcode-export.ts` and `media.ts` are not modified by Compose (the core is
  re-exported from `compose.ts` only).

## 9. Determinism (mock mode)

- Mock compose = a **byte-copy** of the primary video → output bytes are a function
  only of the input file (deterministic). The file **name** uses `Date.now()`
  (as the node does); tests pin it with fake timers (`vi.setSystemTime`) so the
  asserted `url`/`assetId` are stable (see [`test-plan-vitest.md`](test-plan-vitest.md) §1).
- The track-presence report is a pure function of the bundle + include flags →
  deterministic for a given bundle.

## 10. Acceptance

See [`acceptance-criteria.csv`](acceptance-criteria.csv) and
[`verification-checklist.csv`](verification-checklist.csv).
