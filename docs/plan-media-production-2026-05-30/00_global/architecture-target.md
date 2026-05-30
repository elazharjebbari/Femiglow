# Architecture — target (to-be)

> Companion diagram: [`architecture-target.puml`](./architecture-target.puml).
> Implements ground-truth §3 decisions D1–D6. Every change is **additive** and
> **feature-flagged** (`CONTENT_STUDIO_MEDIA_STUDIO_ENABLED`, default off).

---

## 1. Target in one picture

```
PIPELINE A (LangGraph)                    PIPELINE B (operator create-flow)
─────────────────────                     ─────────────────────────────────
nodes/ (REUSED, unchanged):               service.ts (NEW per-draft fns, D3):
 generate-voiceover.ts ──┐                 generateVoiceoverForDraft   ─┐
 generate-music.ts       │  extract        generateSubtitlesForDraft    │ reuse
 generate-subtitles.ts   ├─ shared ───────►composeDraftVideo            ├─►core
 compose.ts              │  core fns        (existing generateVisual/   │
 transcode-export.ts ────┘  (lib/.../core)  VideoForDraft unchanged)   ─┘
        │                                          │
        │ EXTENDED DTO (D2)                        │ routes (NEW, D3):
        ▼                                          │  POST …/[id]/generate-voiceover
 GenerationResult{ +voiceover +music              │  POST …/[id]/generate-subtitles
   +subtitles +composedVideo +transcodedVideo }   │  POST …/[id]/compose
        │                                          ▼
        ▼  bridgeToContentStudio (D2)        upsertBundleAssets (D1) →
   maps ALL artifacts ─────► upsertBundleAssets ──► content_asset_binding
                                              (role-addressed bundle)
                                                    │
                                              getDraftBundle(draftId) → tracks panel UI (D4)
                                              MediaStudio "Studio média": 🎬🎙️🎵💬→🎞️
```

## 2. D1 — Per-draft media bundle by role

A draft owns a **bundle** of assets addressed by `role`, not one primary visual.

```ts
export type MediaRole =
  | 'primary_video' | 'primary_image'
  | 'voiceover' | 'music' | 'subtitles' | 'composed_video';
```

- The `content_asset_binding` table **already has** `role` + a unique
  `(draftId, role)` index — we stop collapsing to one row.
- New repository fns (replace the single-asset assumption, keep the old name as a
  thin shim for non-regression):
  - `upsertBundleAssets({ draftId, assets: Array<{ mediaId; role; crop? }> })` —
    upserts **per role** (delete-then-insert scoped to `(draftId, role)`), leaving
    other roles intact.
  - `getDraftBundle(draftId): Promise<Record<MediaRole, ContentAssetBinding | null>>`.
  - `upsertPrimaryAsset` becomes `upsertBundleAssets` with a single
    `{ role: 'primary_image' | 'primary_video' }` entry — **backward-compatible
    default `primary_image`** preserves today's behavior for image flows.
- Widen the UI media kind: `StudioV2MediaKind = 'image' | 'video' | 'audio' |
  'subtitles'` (`content-studio-v2/media/types.ts`). The DB `media_kind` enum
  already has `'audio'`; we add `'subtitles'` (see [data-model.md](./data-model.md)).
- **Subtitles**: stored as **SRT text** on the binding/media metadata **and** as a
  `.srt` asset (`createMedia(kind:'subtitles')`) so it can be previewed and shipped.

Authority on exact schema/migration: [`data-model.md`](./data-model.md) +
[`db-migration.md`](./db-migration.md).

## 3. D2 — Extended DTO + bidirectional-enough bridge

### Extended `GenerationResult` (orchestrator.ts)
Additive optional fields so existing callers compile unchanged:

```ts
export interface GenerationResult {
  /* …existing… */
  voiceover?: Record<string, unknown> | null;
  music?: Record<string, unknown> | null;
  subtitles?: string | null;            // SRT text
  composedVideo?: Record<string, unknown> | null;
  transcodedVideo?: Record<string, unknown> | null;
}
```

`buildResultFromState` reads `finalState.voiceover/music/subtitles/composition`
(note: state channel is `composition`, DTO field is `composedVideo`) and
`finalState.exports['final']` → `transcodedVideo`.

### Extended `bridgeToContentStudio`
Replaces the single `upsertPrimaryAsset` call (current L147–162) with one
`upsertBundleAssets` call that maps **all** present artifacts to roles. See exact
before/after in [`dto-bridge-changes.md`](./dto-bridge-changes.md).

### "Bidirectional-enough"
The graph→state direction is unchanged (A still produces). The bridge stays A → B
**plus** pipeline B gains its **own** write path (`upsertBundleAssets` from the new
per-draft services). "Bidirectional-enough" = **both pipelines can populate the same
role-addressed bundle**; it does *not* feed the LangGraph state back (out of scope).

## 4. D3 — Per-draft services + routes in pipeline B

Mirror `generateVisualForDraft`. Each service fn is mode-aware and reuses a shared
core extracted from the pipeline-A node (D5):

| Service fn (`service.ts`) | Route | Reuses |
|---|---|---|
| `generateVoiceoverForDraft` | `POST /api/admin/content-studio/drafts/[id]/generate-voiceover` | core of `generate-voiceover.ts` |
| `generateSubtitlesForDraft` | `POST /api/admin/content-studio/drafts/[id]/generate-subtitles` | core of `generate-subtitles.ts` (`generateSRT`) |
| `composeDraftVideo` | `POST /api/admin/content-studio/drafts/[id]/compose` | core of `compose.ts` (`composeVideo`) |

Each:
1. `requireContentStudioEnabled()` + `requireMediaStudioEnabled()` (new flag guard).
2. `requireAdminApi()`; read `cs_generation_mode` cookie (mock|live, default mock).
3. Validate body with a new zod schema (`schemas.ts`).
4. Resolve the draft's existing bundle (`getDraftBundle`) to find inputs (e.g.
   compose needs `primary_video` + optional `voiceover`/`music`/`subtitles`).
5. Run the reused core (mock = deterministic silent/sample artifact, **no provider
   call**; `live`-no-key → `HttpError invalid_state` 409 via `resolveApiKey`).
6. `createMedia` (kind audio/video/subtitles) → `upsertBundleAssets` with the right role.
7. `insertGenerationRun` + `logAuditEvent`; return a `StudioMediaItem`.

## 5. D4 — UI: "Studio média" tracks panel (step 3)

When the primary media is video (`reel`/`story`), `MediaStudio.tsx` renders a
tracks panel: `🎬 Vidéo · 🎙️ Voix-off · 🎵 Musique · 💬 Sous-titres → 🎞️ Composer`.
Each track has generate/regenerate + preview; **Composer** calls the compose route;
the composed video plays via `VideoPlayer.tsx`. `PublishActionGroup` shows the
**composed** video + a track summary. Detailed in the feature folders' `*frontend*`
and `*ui-ux*` files.

## 6. D5 — Reuse, don't reinvent

The pipeline-A nodes today take a graph `state` record and return a partial state.
To reuse them per-draft without LangGraph, extract a **pure core** alongside each
node (graph node becomes a thin wrapper):

```
nodes/compose.ts            ──exports──► composeVideo(state) (already a fn, L33)
                                          → expose composeMediaBundle({ videoUrl,
                                            voiceoverUrl?, musicUrl?, subtitles? })
nodes/generate-voiceover.ts ──exports──► generateVoiceoverAsset({ text, mode, apiKey? })
nodes/generate-subtitles.ts ──exports──► generateSRT(scenes, hook) (already a fn, L32)
```

The graph node and the per-draft service both call the same core. **No duplicate
ffmpeg/TTS code.** `MEDIA_DIR` / `MEDIA_URL_PREFIX` constants stay in `compose.ts`
and are the shared media root.

## 7. D6 — Non-regression + feature flag

- New flag `CONTENT_STUDIO_MEDIA_STUDIO_ENABLED` (`z.enum(['true','false']).default('false')`)
  in `env.ts`; guards every new route and the tracks panel. **Off ⇒ today's flow,
  unchanged.**
- `upsertPrimaryAsset` keeps working (shim over `upsertBundleAssets` with role
  `primary_image`); `generateVisualForDraft`/`generateVideoForDraft` untouched.
- Migration is additive only (no column dropped). Existing `role: 'primary'` rows
  are backfilled to `primary_image`/`primary_video` (see [db-migration.md](./db-migration.md)).
- Publishing stays `dry_run` — no code path enables live.

## 8. Touch-point summary (files)

| Concern | File | Change |
|---|---|---|
| DTO | `src/lib/ai-engine/orchestrator.ts` | +5 optional fields; read in `buildResultFromState` |
| Bridge | `src/lib/ai-engine/bridge/content-studio-bridge.ts` | map artifacts → `upsertBundleAssets` |
| Repository | `src/lib/content-studio/repository.ts` | `upsertBundleAssets`, `getDraftBundle`; `upsertPrimaryAsset` shim |
| Schema | `src/lib/db/schema-content-studio.ts`, `schema.ts` | `media_kind += 'subtitles'`; binding metadata col |
| Service | `src/lib/content-studio/service.ts` | +3 per-draft fns |
| Routes | `src/app/api/admin/content-studio/drafts/[id]/{generate-voiceover,generate-subtitles,compose}/route.ts` | new |
| Node cores | `src/lib/ai-engine/nodes/{compose,generate-voiceover,generate-subtitles}.ts` | export reusable core |
| UI kind | `src/lib/content-studio-v2/media/types.ts` | widen `StudioV2MediaKind` |
| UI | `src/components/admin/content-studio-v2/create/MediaStudio.tsx` (+ new track components) | tracks panel |
| Flag | `src/lib/env.ts`, `apps/web/.env.example` | `CONTENT_STUDIO_MEDIA_STUDIO_ENABLED` |
