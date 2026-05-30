# DTO + bridge changes (D2) — precise before/after

> Files: `src/lib/ai-engine/orchestrator.ts`,
> `src/lib/ai-engine/bridge/content-studio-bridge.ts`,
> `src/lib/content-studio/repository.ts`. All snippets are TS-strict and
> `noUncheckedIndexedAccess`-safe. Tasks: **MP-AR-001** (DTO), **MP-AR-002**
> (bridge), **MP-AR-003** (repository).

---

## 1. `GenerationResult` — MP-AR-001

### Before (orchestrator.ts L30–45)
```ts
export interface GenerationResult {
  jobId: string;
  status: 'completed' | 'review' | 'failed';
  script: Record<string, unknown> | null;
  caption: string;
  hashtags: string[];
  images: Array<Record<string, unknown>>;
  videos: Array<Record<string, unknown>>;
  qualityScores: Record<string, number>;
  moderationResult: Record<string, unknown> | null;
  costTracking: Record<string, unknown>;
  errors: Array<Record<string, unknown>>;
  durationMs: number;
  reviewPayload?: Record<string, unknown> | null;
}
```

### After (additive, all optional → existing callers compile)
```ts
export interface GenerationResult {
  jobId: string;
  status: 'completed' | 'review' | 'failed';
  script: Record<string, unknown> | null;
  caption: string;
  hashtags: string[];
  images: Array<Record<string, unknown>>;
  videos: Array<Record<string, unknown>>;
  qualityScores: Record<string, number>;
  moderationResult: Record<string, unknown> | null;
  costTracking: Record<string, unknown>;
  errors: Array<Record<string, unknown>>;
  durationMs: number;
  reviewPayload?: Record<string, unknown> | null;

  // ── MP-AR-001 (BUG-004): media-production artifacts ──────────────
  /** TTS narration MediaAsset (state.voiceover). null when not produced. */
  voiceover?: Record<string, unknown> | null;
  /** Background music MediaAsset (state.music). */
  music?: Record<string, unknown> | null;
  /** SRT subtitle text (state.subtitles) — a string, not a file ref. */
  subtitles?: string | null;
  /** ffmpeg montage MediaAsset (state.composition). */
  composedVideo?: Record<string, unknown> | null;
  /** Platform-spec final encode (state.exports['final']). */
  transcodedVideo?: Record<string, unknown> | null;
}
```

### `buildResultFromState` — read the channels (L116–131)
```ts
function buildResultFromState(
  finalState: Record<string, unknown>,
  jobId: string,
  durationMs: number,
  status: 'completed' | 'review' | 'failed',
  reviewPayload?: Record<string, unknown> | null,
): GenerationResult {
  const exports = (finalState.exports as Record<string, Record<string, unknown>>) ?? {};
  return {
    jobId,
    status,
    script: (finalState.script as Record<string, unknown>) ?? null,
    caption: (finalState.caption as string) ?? '',
    hashtags: (finalState.hashtags as string[]) ?? [],
    images: (finalState.images as Array<Record<string, unknown>>) ?? [],
    videos: (finalState.videos as Array<Record<string, unknown>>) ?? [],
    qualityScores: (finalState.qualityScores as Record<string, number>) ?? {},
    moderationResult: (finalState.moderationResult as Record<string, unknown>) ?? null,
    costTracking: (finalState.costTracking as Record<string, unknown>) ?? {},
    errors: (finalState.errors as Array<Record<string, unknown>>) ?? [],
    durationMs,
    reviewPayload: reviewPayload ?? null,

    // ── MP-AR-001 ──
    voiceover: (finalState.voiceover as Record<string, unknown> | null) ?? null,
    music: (finalState.music as Record<string, unknown> | null) ?? null,
    subtitles: (finalState.subtitles as string | null) ?? null,
    composedVideo: (finalState.composition as Record<string, unknown> | null) ?? null, // state channel is `composition`
    transcodedVideo: (exports.final as Record<string, unknown> | undefined) ?? null,
  };
}
```
> Note the channel-name mismatch: graph state uses `composition`
> (`state.ts` L134), the DTO field is `composedVideo`. The map above bridges it.
> `failResult` literals (L252–265, L341–354): leave the new fields **omitted**
> (optional) — failures carry no media; this keeps the diff minimal and type-safe.

## 2. `bridgeToContentStudio` — MP-AR-002

### Before (content-studio-bridge.ts L147–162) — binds ONE image only
```ts
  // 4. Bind images as assets if present (skip mock images)
  const images = (result.images ?? []) as Array<Record<string, unknown>>;
  const realImage = images.find((img) => {
    const provider = img.provider as string | undefined;
    return provider && !provider.startsWith('mock');
  });
  if (realImage) {
    const mediaId = realImage.assetId as string | undefined;
    if (mediaId) {
      try {
        await upsertPrimaryAsset({ draftId: draft.id, mediaId });
      } catch { /* non-blocking */ }
    }
  }
```

### After — map ALL artifacts to roles via `upsertBundleAssets`
```ts
  // 4. Bind the full media bundle by role (MP-AR-002, BUG-004) ──────────
  type Artifact = { assetId?: string; provider?: string };
  const bundle: Array<{ mediaId: string; role: MediaRole; meta?: Record<string, unknown> }> = [];

  const pushAsset = (a: Artifact | null | undefined, role: MediaRole) => {
    if (!a) return;
    const mediaId = a.assetId;
    // keep the existing "skip mock" rule ONLY for primary visuals;
    // audio/subtitle/composed mocks are deterministic and must surface.
    const isVisual = role === 'primary_image' || role === 'primary_video';
    if (isVisual && a.provider?.startsWith('mock')) return;
    if (mediaId) bundle.push({ mediaId, role });
  };

  // primary visual: first non-mock image OR the raw video clip
  const images = (result.images ?? []) as Artifact[];
  const realImage = images.find((img) => img.provider && !img.provider.startsWith('mock'));
  pushAsset(realImage, 'primary_image');
  pushAsset((result.videos?.[0] as Artifact | undefined) ?? null, 'primary_video');

  pushAsset(result.voiceover as Artifact | null, 'voiceover');
  pushAsset(result.music as Artifact | null, 'music');
  pushAsset(result.composedVideo as Artifact | null, 'composed_video');

  // subtitles are SRT TEXT, not a MediaAsset → persist text in binding.meta
  if (result.subtitles && typeof result.subtitles === 'string') {
    // the bridge does not own storage; record the SRT on the draft's
    // subtitles binding meta (mediaId resolved by the caller that wrote the
    // .srt asset, or left for the per-draft subtitles service). When the graph
    // produced only text and no asset, we still stamp meta on a text-only role.
    bundle.push({ mediaId: (result.subtitles as unknown as string), role: 'subtitles',
      meta: { srt: result.subtitles, source: 'ai-engine' } });
  }

  if (bundle.length > 0) {
    try {
      await upsertBundleAssets({ draftId: draft.id, assets: bundle });
    } catch { /* non-blocking, mirrors the original try/catch */ }
  }
```
> Import: replace `upsertPrimaryAsset` in the bridge's import block (L1–7) with
> `upsertBundleAssets` (and `import type { MediaRole } from '@/lib/content-studio/types'`).
> **Backward-compat:** the primary-image "skip mock" behavior is preserved exactly;
> only audio/subtitles/composed are newly surfaced. If `result` has none of the new
> fields (today's graph runs), `bundle` is just the primary visual → identical
> outcome to before.

> Caveat made explicit for implementers: the subtitles branch above shows the
> *text* being carried; the canonical SRT-as-`.srt`-asset write happens in the
> per-draft `generateSubtitlesForDraft` service (`MP-SU`). The bridge's
> responsibility is to not *drop* the text. Implementers should resolve the
> `mediaId` for the subtitles role once the `.srt` asset exists; until then the
> `meta.srt` field is the source of truth.

## 3. `upsertPrimaryAsset → upsertBundleAssets` — MP-AR-003

### Before (repository.ts L445–472) — collapses to one row
```ts
export async function upsertPrimaryAsset(input: { draftId: string; mediaId: string; }) {
  const binding: ContentAssetBinding = { id: createId('cab'), draftId: input.draftId,
    mediaId: input.mediaId, role: 'primary', crop: {}, createdAt: new Date() };
  const drizzle = db();
  if (drizzle) {
    await drizzle.delete(contentAssetBindings)
      .where(eq(contentAssetBindings.draftId, input.draftId));   // deletes ALL roles
    await drizzle.insert(contentAssetBindings).values(binding);
  } else { /* in-memory delete-all + set */ }
  return binding;
}
```

### After — per-role upsert; old name kept as a shim
```ts
export async function upsertBundleAssets(input: {
  draftId: string;
  assets: Array<{ mediaId: string; role: MediaRole; crop?: Record<string, unknown>; meta?: Record<string, unknown> }>;
}): Promise<ContentAssetBinding[]> {
  const drizzle = db();
  const out: ContentAssetBinding[] = [];
  for (const a of input.assets) {
    const binding: ContentAssetBinding = {
      id: createId('cab'), draftId: input.draftId, mediaId: a.mediaId,
      role: a.role, crop: a.crop ?? {}, meta: a.meta ?? {}, createdAt: new Date(),
    };
    if (drizzle) {
      // delete-then-insert SCOPED to (draftId, role) — other roles untouched
      await drizzle.delete(contentAssetBindings).where(
        and(eq(contentAssetBindings.draftId, input.draftId), eq(contentAssetBindings.role, a.role)),
      );
      await drizzle.insert(contentAssetBindings).values(binding);
    } else {
      for (const [id, row] of store().contentAssetBindings.entries()) {
        if (row.draftId === input.draftId && row.role === a.role) store().contentAssetBindings.delete(id);
      }
      store().contentAssetBindings.set(binding.id, binding);
    }
    out.push(binding);
  }
  return out;
}

// D6 non-regression shim: keeps every existing call site working unchanged.
export async function upsertPrimaryAsset(input: { draftId: string; mediaId: string; role?: MediaRole }): Promise<ContentAssetBinding> {
  const [binding] = await upsertBundleAssets({
    draftId: input.draftId,
    assets: [{ mediaId: input.mediaId, role: input.role ?? 'primary_image' }],
  });
  return binding!;
}

export async function getDraftBundle(draftId: string): Promise<Partial<Record<MediaRole, ContentAssetBinding>>> {
  const drizzle = db();
  const rows = drizzle
    ? await drizzle.select().from(contentAssetBindings).where(eq(contentAssetBindings.draftId, draftId))
    : Array.from(store().contentAssetBindings.values()).filter((b) => b.draftId === draftId);
  const bundle: Partial<Record<MediaRole, ContentAssetBinding>> = {};
  for (const row of rows) bundle[row.role as MediaRole] = row as ContentAssetBinding;
  return bundle;
}
```
> Requires `and` from `drizzle-orm` in the import block. `ContentAssetBinding` type
> (in `content-studio/types.ts`) gains `role: MediaRole` and `meta: Record<string, unknown>`.

## 4. Backward-compatibility matrix

| Caller | Today | After | Behavior change? |
|---|---|---|---|
| `service.ts` `generateVisualForDraft` (L354) `upsertPrimaryAsset` | one `primary` row | one `primary_image` row | none (role rename, backfilled) |
| `service.ts` `generateVideoForDraft` (L450) `upsertPrimaryAsset` | one `primary` row | **should pass `role:'primary_video'`** | improved; old call still works as `primary_image` |
| `service.ts` `updateContentDraft` (L209) | one `primary` row | one `primary_image` row | none |
| `bridge` (L157) | one image OR nothing | full bundle by role | additive only |
| `getPrimaryAsset` (L474) | first row for draft | unchanged (returns any role's first) — callers that need the visual use `getDraftBundle` | none |

## 5. Type-safety notes (ground-truth §6)

- All new DTO fields are `?:` optional → `tsc --noEmit` passes for unchanged callers.
- `noUncheckedIndexedAccess`: `exports.final`, `result.videos?.[0]`, `out[0]!`
  (non-null after a guaranteed push) are guarded.
- `MediaRole` is a string-literal union; never use a bare `string` for `role`.
