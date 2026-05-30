# Data model — per-draft media bundle (D1)

> Authority for the schema/migration consumed by all feature folders.
> Companion: [`data-model.puml`](./data-model.puml) · migration:
> [`db-migration.md`](./db-migration.md). Verified against
> `src/lib/db/schema-content-studio.ts` and `src/lib/db/schema.ts`.

---

## 1. What exists today (do NOT re-invent)

`content_asset_binding` (`schema-content-studio.ts` L112–132) already supports a
role-addressed bundle at the **schema** level:

```ts
export const contentAssetBindings = pgTable('content_asset_binding', {
  id: text('id').primaryKey(),
  draftId: text('draft_id').notNull().references(() => contentDrafts.id, { onDelete: 'cascade' }),
  mediaId: text('media_id').notNull().references(() => media.id, { onDelete: 'restrict' }),
  role: text('role').notNull().default('primary'),          // ← already present
  crop: jsonb('crop_json').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  draftRoleUnique: uniqueIndex('content_asset_binding_draft_role_unique')   // ← already unique per (draft, role)
    .on(t.draftId, t.role),
}));
```

`media` (`schema.ts` L349–391) has `kind: media_kind` where
`media_kind = pgEnum('media_kind', ['image', 'video', 'audio'])` (L284) —
`'audio'` is **already** a valid kind. `originalDurationMs`, `originalWidth/Height`,
`originalMime`, `overrides` (jsonb) are present.

The blocker is **not** the schema; it is the repository
(`upsertPrimaryAsset` collapses every draft to one `role:'primary'` row — see
[architecture-current.md](./architecture-current.md) §5) plus two small additive
deltas below.

## 2. The role discriminator

```ts
export type MediaRole =
  | 'primary_image'    // current image flow (was 'primary')
  | 'primary_video'    // current video flow (was 'primary')
  | 'voiceover'        // TTS narration  (kind='audio')
  | 'music'            // background bed  (kind='audio')
  | 'subtitles'        // SRT track       (kind='subtitles')
  | 'composed_video';  // ffmpeg montage  (kind='video')
```

One binding per `(draftId, role)`, enforced by the **existing** unique index. A
draft's full bundle = up to one binding per role.

## 3. Widened media kind

- UI type (`content-studio-v2/media/types.ts` L5):
  `StudioV2MediaKind = 'image' | 'video' | 'audio' | 'subtitles'`.
- DB enum (`schema.ts` L284): add `'subtitles'` →
  `pgEnum('media_kind', ['image', 'video', 'audio', 'subtitles'])`.
  (Postgres `ADD VALUE` is additive & irreversible-but-harmless — see migration.)

## 4. Drizzle additions (exact)

### 4.1 `media_kind` enum — add `'subtitles'`
`src/lib/db/schema.ts` L284:
```ts
// before
export const mediaKind = pgEnum('media_kind', ['image', 'video', 'audio']);
// after
export const mediaKind = pgEnum('media_kind', ['image', 'video', 'audio', 'subtitles']);
```

### 4.2 `content_asset_binding` — add `meta` jsonb (carries SRT text + compose flags)
`src/lib/db/schema-content-studio.ts`, inside `contentAssetBindings`:
```ts
  crop: jsonb('crop_json').notNull().default({}),
  // NEW (MP-AR-005): per-role metadata. For role='subtitles' holds { srt: string };
  // for role='composed_video' holds { hasVoiceover, hasMusic, hasSubtitles, sourceRoles[] }.
  meta: jsonb('meta_json').notNull().default({}),
```
`ContentAssetBinding` type (in `content-studio/types.ts`) gains
`meta: Record<string, unknown>` and `role: MediaRole`.

### 4.3 No other table changes
`content_draft`, `content_brief`, `content_idea`, `content_generation_run`,
`media`, `media_variants` are **unchanged** except the enum value. SRT *text* lives
in (a) the `subtitles` binding's `meta.srt` and (b) the `.srt` asset bytes in
storage; the composed-video flags live in the `composed_video` binding's `meta`
(mirroring `compose.ts` `generationParams: { hasVoiceover, hasMusic, hasSubtitles }`).

## 5. Asset records — how each artifact is stored

| Role | `media.kind` | `media.originalMime` | Bytes in storage | Binding `meta` |
|---|---|---|---|---|
| `primary_image` | `image` | `image/png\|jpeg` | optimized variants | `{}` (or crop) |
| `primary_video` | `video` | `video/mp4` | passthrough mp4 + poster | `{}` |
| `voiceover` | `audio` | `audio/mpeg` (live) / `audio/wav` (mock silent) | audio file | `{ durationMs, provider }` |
| `music` | `audio` | `audio/mpeg\|wav` | audio file | `{ durationMs, provider }` |
| `subtitles` | `subtitles` | `application/x-subrip` | `.srt` text bytes | `{ srt, cueCount }` |
| `composed_video` | `video` | `video/mp4` | composed mp4 | `{ hasVoiceover, hasMusic, hasSubtitles, sourceRoles }` |

Mock-mode assets mirror the pipeline-A node defaults: voice-over = silent WAV
(`generate-voiceover.ts` L177–191, `provider:'mock'`), music = silent track
(`generate-music.ts` L69–80), subtitles = deterministic SRT from scenes
(`generate-subtitles.ts` `generateSRT`), composed = byte-copy when no audio
(`compose.ts` L56–78) else ffmpeg mux.

## 6. Repository surface (new, in `repository.ts`)

```ts
export async function upsertBundleAssets(input: {
  draftId: string;
  assets: Array<{ mediaId: string; role: MediaRole; crop?: Record<string, unknown>; meta?: Record<string, unknown> }>;
}): Promise<ContentAssetBinding[]>;   // per-role delete-then-insert; other roles untouched

export async function getDraftBundle(
  draftId: string,
): Promise<Partial<Record<MediaRole, ContentAssetBinding>>>;

// shim — preserves the old single-image call site behavior (D6 non-regression)
export async function upsertPrimaryAsset(input: { draftId: string; mediaId: string; role?: MediaRole }):
  Promise<ContentAssetBinding>;   // defaults role='primary_image'
```

`listPrimaryAssetsForDrafts` (today filters `role==='primary'`, L500–524) widens to
`role IN ('primary_image','primary_video')` so library views keep showing the
"primary" asset after the role rename (covered by the backfill, see migration).

## 7. Invariants

- At most one binding per `(draftId, role)` (DB unique index).
- `composed_video` is **derived**: it requires an existing `primary_video` binding;
  compose reads `voiceover`/`music`/`subtitles` if present, else degrades (mirrors
  `compose.ts` no-audio byte-copy path).
- Deleting a draft cascades to its bindings (`onDelete: 'cascade'`); deleting a
  media row is `restrict`ed while bound.
- A `subtitles` binding's `meta.srt` and its `.srt` asset bytes must agree (same SRT).
