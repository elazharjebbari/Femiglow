# Architecture — current (as-is)

> All line numbers verified against the repo at the ground-truth baseline
> (merge `deecc53`). Paths relative to `apps/web/` unless prefixed.

---

## 1. The two pipelines

```
PIPELINE A — AI-Engine (LangGraph)          PIPELINE B — Content-Studio create-flow
src/lib/ai-engine/*                          src/lib/content-studio/*  +  v2 UI
─────────────────────────────────           ──────────────────────────────────────
graph/builder.ts (video flow ~L138-149):     /admin/content-studio-v2/create
 generateVideo → generateVoiceover           page.tsx → CreateWorkspace.tsx
 → generateMusic → generateSubtitles         Stepper: Cadrer→Générer→Visuel→Valider
 → generateCaption → compose                 service.ts: generateVisualForDraft
 → transcodeExport → qualityCheck            (image | video) ~L287
 → moderate → reviewGate → generateVariants  per-draft assets via upsertPrimaryAsset
        │                                            ▲
        │   GenerationResult DTO (orchestrator.ts)   │
        └────────────► bridgeToContentStudio ────────┘
            ONE-WAY, LOSSY  (A → B only)
            content-studio-bridge.ts ~L81
```

Pipeline A owns the **rich media nodes**; pipeline B owns the **operator UI** and
the **per-draft surface**. They share nothing but the bridge.

## 2. Where each artifact is produced (pipeline A)

The graph state (`src/lib/ai-engine/types/state.ts`) **does** carry every artifact:

| State channel (`state.ts`) | Type | Filled by node | Line |
|---|---|---|---|
| `videos` (L102–113) | `MediaAsset[]` (concat reducer) | `generateVideoNode` | `nodes/generate-video.ts` |
| `voiceover` (L120–123) | `MediaAsset \| null` | `generateVoiceoverNode` | `nodes/generate-voiceover.ts` L133 |
| `music` (L124–127) | `MediaAsset \| null` | `generateMusicNode` | `nodes/generate-music.ts` L50 |
| `subtitles` (L130–133) | `string \| null` (**SRT text**) | `generateSubtitlesNode` | `nodes/generate-subtitles.ts` L70 |
| `composition` (L134–137) | `MediaAsset \| null` | `composeNode` | `nodes/compose.ts` L259 |
| `images` (L102) | `MediaAsset[]` | `generateImageNode` | — |

`composeNode` (`nodes/compose.ts` L259–324) reads `state.videos[0]`,
`state.voiceover`, `state.music`, `state.subtitles` and ffmpeg-muxes them into one
mp4 `MediaAsset` with `generationParams: { hasVoiceover, hasMusic, hasSubtitles }`
(L133–137). `MediaAsset` shape: `src/lib/ai-engine/types/media.ts` L1–12
(`assetId`, `url`, `mimeType`, `width?`, `height?`, `durationMs?`, `fileSizeBytes`,
`provider`, `generationParams`, `costCents`).

**So the artifacts exist.** They die at the boundary.

## 3. The DTO leak (artifact death #1)

`src/lib/ai-engine/orchestrator.ts`, `interface GenerationResult` (L30–45):

```ts
export interface GenerationResult {
  jobId: string;
  status: 'completed' | 'review' | 'failed';
  script: Record<string, unknown> | null;
  caption: string;
  hashtags: string[];
  images: Array<Record<string, unknown>>;
  videos: Array<Record<string, unknown>>;   // ← raw clips only
  qualityScores: Record<string, number>;
  moderationResult: Record<string, unknown> | null;
  costTracking: Record<string, unknown>;
  errors: Array<Record<string, unknown>>;
  durationMs: number;
  reviewPayload?: Record<string, unknown> | null;
}
```

**No** `voiceover`, `music`, `subtitles`, `composedVideo`, `transcodedVideo`.

`buildResultFromState` (L109–131) is the only place the final graph state is read
into the DTO. It copies `script, caption, hashtags, images, videos, qualityScores,
moderationResult, costTracking, errors` — and **silently ignores**
`finalState.voiceover`, `finalState.music`, `finalState.subtitles`,
`finalState.composition`. The `failResult` literals (L252–265, L341–354) likewise
have no such fields. **This is artifact death #1.**

## 4. The lossy bridge (artifact death #2)

`src/lib/ai-engine/bridge/content-studio-bridge.ts`, `bridgeToContentStudio`
(L81–193). Direction **A → B only**. It maps a `GenerationResult` into Content-Studio
records:

- L89–103 — `createIdea` + `updateIdeaStatus('generated')`.
- L106–118 — `createBrief` from `script.hook` / `script.cta` / `script.visualDirection`.
- L126–145 — `createDrafts` from `caption`, `hook`, `cta`, `hashtags`, `scoreTotal`.
- L147–162 — **binds at most ONE image** as the primary asset:
  ```ts
  const images = (result.images ?? []) as Array<Record<string, unknown>>;
  const realImage = images.find((img) => {
    const provider = img.provider as string | undefined;
    return provider && !provider.startsWith('mock');
  });
  if (realImage) {
    const mediaId = realImage.assetId as string | undefined;
    if (mediaId) {
      try { await upsertPrimaryAsset({ draftId: draft.id, mediaId }); } catch { /* non-blocking */ }
    }
  }
  ```
- L164–186 — `insertGenerationRun`.

It reads **only** `script`, `caption`, `hashtags`, and `images`. It **never reads**
`videos`, `voiceover`, `music`, `subtitles`, `composition` — they aren't even on the
DTO (§3). Even the one image is dropped in mock mode (the `!provider.startsWith('mock')`
filter). **This is artifact death #2.**

## 5. The single-asset assumption (artifact death #3)

`upsertPrimaryAsset` (`src/lib/content-studio/repository.ts` L445–472):

```ts
export async function upsertPrimaryAsset(input: { draftId: string; mediaId: string; }) {
  const binding: ContentAssetBinding = {
    id: createId('cab'), draftId: input.draftId, mediaId: input.mediaId,
    role: 'primary', crop: {}, createdAt: new Date(),
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.delete(contentAssetBindings)                       // ← DELETES ALL
      .where(eq(contentAssetBindings.draftId, input.draftId));        //   bindings for draft
    await drizzle.insert(contentAssetBindings).values(binding);
  } else { /* in-memory store: same delete-all-then-insert */ }
  return binding;
}
```

A draft can hold **exactly one** binding, always `role: 'primary'`. Generating a
voice-over and then a video would **delete** the voice-over binding. The table
*schema* already supports multiple roles —
`content_asset_binding` (`schema-content-studio.ts` L112–132) has a `role` column
(default `'primary'`) and a **unique index on `(draftId, role)`**
(`content_asset_binding_draft_role_unique`, L127–130) — but the *repository*
collapses everything to one row. `listPrimaryAssetsForDrafts` (L500–524) hard-filters
`role === 'primary'`. **This is artifact death #3.**

## 6. Pipeline B has no media-production surface

`src/lib/content-studio/service.ts` exposes only:

- `generateVisualForDraft` (L287–397) — image, calls `generateStudioImage`,
  `createMedia(kind:'image')`, `upsertPrimaryAsset`.
- `generateVideoForDraft` (L404–508, internal) — mock video, `createMedia(kind:'video')`,
  `upsertPrimaryAsset`.

There is **no** `generateVoiceoverForDraft`, `generateSubtitlesForDraft`, or
`composeDraftVideo`, and **no** corresponding API route. The UI media model is
`StudioV2MediaKind = 'image' | 'video'` (`content-studio-v2/media/types.ts` L5) —
no `'audio'` or `'subtitles'`, even though the **DB enum** `media_kind`
(`schema.ts` L284) already lists `['image', 'video', 'audio']`.

`MediaStudio.tsx` toggles only `['image','video']` (~L418) and gates video to
`reel`/`story`. There is no tracks panel, no Composer, no voice-off/music/subtitles UI.

## 7. Summary of the three deaths

| # | Where | Symptom | Fixed by |
|---|---|---|---|
| 1 | `GenerationResult` / `buildResultFromState` | audio/subtitle/composed fields don't exist on the DTO | MP-AR-001 ([dto-bridge-changes.md](./dto-bridge-changes.md)) |
| 2 | `bridgeToContentStudio` | reads only script/caption/hashtags/images | MP-AR-002 |
| 3 | `upsertPrimaryAsset` | one binding per draft, role hardcoded `primary` | MP-AR-003 ([data-model.md](./data-model.md)) |

Target: [`architecture-target.md`](./architecture-target.md).
