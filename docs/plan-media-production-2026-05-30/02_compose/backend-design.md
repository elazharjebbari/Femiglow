# Compose (montage vidéo) — backend design

> Grounded in: `src/lib/ai-engine/nodes/compose.ts` (`composeVideo`, the no-audio
> byte-copy path L56–78, the `complexFilter`/`amix` graph L88–142,
> `createEmptyAsset`, `MEDIA_DIR`/`MEDIA_URL_PREFIX` L15–16),
> `src/lib/ai-engine/nodes/transcode-export.ts` (`transcodeExportNode`),
> `src/lib/content-studio/service.ts` (`generateVisualForDraft` ~L287,
> `generateVideoForDraft` ~L404, `requireDraft` ~L814),
> `src/app/api/admin/content-studio/drafts/[id]/generate-visual/route.ts`,
> `src/lib/errors/http-error.ts`. Decisions D2/D3/D5. Prefix `MP-CO-*`.

## 1. Node reuse — extract `composeMediaBundle` (MP-CO-01, D5)

`composeNode(state)` is graph-coupled: it reads `state.videos/voiceover/music/
subtitles/format/jobId`, branches video vs image vs text, swallows failures into
`createEmptyAsset`, and emits graph channels (`composition`, `currentStep`,
`errors`). We extract the **pure video-compose core** (`composeVideo`, L33–143)
into a reusable function and make `composeNode` a thin adapter that still returns
the same graph shape (zero behavior change → `compose.test.ts` stays green,
MP-CO-13).

```ts
// src/lib/ai-engine/nodes/compose.ts  (additive exports — no ffmpeg rewrite, D5)
import type { MediaAsset } from '../types/media';

export interface ComposeMediaBundleInput {
  /** Correlation id for the output file name (draftId in pipeline B, jobId in graph). */
  jobId: string;
  /** Required. The raw clip to montage onto. */
  primaryVideo: MediaAsset;
  /** Optional tracks. Absent ⇒ degrade (no-audio byte-copy when none present). */
  voiceover?: MediaAsset | null;
  music?: MediaAsset | null;
  /** SRT TEXT (state.subtitles is a string, not a file ref — ground-truth §1). */
  subtitles?: string | null;
  /**
   * mock  => deterministic byte-copy of primaryVideo, NO ffmpeg mux, NO network.
   * live  => real ffmpeg mux of the present tracks.
   */
  mode: 'mock' | 'live';
  /** Hard cap; on expiry the ffmpeg process is killed + temp cleaned. Default 90_000. */
  timeoutMs?: number;
}

export interface ComposeMediaBundleOutput {
  composed: MediaAsset;                 // role='composed_video', kind=video, mp4
  tracks: { hasVoiceover: boolean; hasMusic: boolean; hasSubtitles: boolean };
  degraded: boolean;                    // true when a track was dropped (empty/missing)
}

export async function composeMediaBundle(
  input: ComposeMediaBundleInput,
): Promise<ComposeMediaBundleOutput>;
```

### 1.1 What is lifted, verbatim (no reimplementation — D5)

- `MEDIA_DIR`, `MEDIA_URL_PREFIX` (L15–16) — shared media root, unchanged.
- The **no-audio byte-copy** branch (L56–78): when no track is present (or in
  `mock`), `readFile(videoPath)` → `writeFile(outputPath)` → `stat`. **This is the
  deterministic mock path.**
- The **mux** branch (L80–142): `inputs[]`, `complexFilter` with `amix`/`volume`
  (voice-over `1.0`, music `0.3`, vo-only `1.0`, music-only `0.5`), `-map 0:v -map
  [aout]`, `-c:v copy -c:a aac -b:a 128k -movflags +faststart -shortest`,
  resolve-on-`end` / reject-on-`error`.
- `generationParams: { hasVoiceover, hasMusic, hasSubtitles }` — the track report.

### 1.2 What the core adds (robustness — functional-spec §7)

- **mode switch:** `mode==='mock'` ⇒ always take the byte-copy branch (even if
  tracks exist) so mock is deterministic + provider-free.
- **timeout + kill:** the mux `Promise` is wrapped by `withTimeout(timeoutMs, cmd)`;
  on expiry it calls `cmd.kill('SIGKILL')`, rejects with a `compose_timeout` error,
  and the `finally` unlinks `outputPath` (E-CO-8/E-CO-10).
- **temp cleanup:** a `try/finally` around the mux unlinks a partial `outputPath`
  on any reject/throw; on success the file is the asset (E-CO-10).
- **missing source:** `readFile`/path resolution failure throws
  `compose_source_missing` (NOT swallowed into `createEmptyAsset` — that swallow
  stays only in the graph adapter for autonomy) (E-CO-5).
- **subtitles:** when `subtitles` is a non-empty SRT, it is written to a temp `.srt`
  and attached/burned; empty/malformed SRT ⇒ skipped, `hasSubtitles:false`,
  logged (E-CO-12).

### 1.3 `composeNode` becomes a thin adapter (behavior preserved)

```ts
async function composeVideo(state, jobId): Promise<MediaAsset> {
  const videos = (state.videos as MediaAsset[]) ?? [];
  const primaryVideo = videos[0];
  if (!primaryVideo?.url) return createEmptyAsset(jobId, 'video/mp4', 'No video source available');
  try {
    const { composed } = await composeMediaBundle({
      jobId,
      primaryVideo,
      voiceover: (state.voiceover as MediaAsset | null) ?? null,
      music: (state.music as MediaAsset | null) ?? null,
      subtitles: (state.subtitles as string | null) ?? null,
      mode: 'live',          // graph keeps muxing when tracks exist (autonomous)
    });
    return composed;
  } catch (err) {
    return createEmptyAsset(jobId, 'video/mp4', String(err)); // graph keeps swallowing → errors channel
  }
}
```

The graph's `composeNode` wrapper (L259–324) is **otherwise unchanged**: it still
pushes `composeDegraded` into `state.errors`. `compose.test.ts` is unedited and
must stay green (MP-CO-13).

### 1.4 Codec/dimension-mismatch fallback (E-CO-7)

The node uses `-c:v copy` (stream-copy the video, only the audio is re-encoded).
If the container mux rejects with a copy-incompatibility error, the core **retries
once** with `-c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p` (the same encode
`transcode-export.ts` uses). A second failure ⇒ reject `compose_ffmpeg_failed`.
This is opt-in inside the core and does not change the node's happy path.

## 2. Service — `composeDraftVideo` (MP-CO-02, D3)

New export in `src/lib/content-studio/service.ts`, mirroring
`generateVideoForDraft`'s passthrough shape (audio/video bypass the image worker).

```ts
export interface ComposeForDraftInput {
  draftId: string;
  actorId: string | null;
  includeVoiceover?: boolean;   // default true
  includeMusic?: boolean;       // default true
  includeSubtitles?: boolean;   // default true
  export?: boolean;             // default false — chain transcodeExportNode
  mode?: 'mock' | 'live';
}

export interface ComposeResult {
  id: string;                 // composed media id
  draftId: string;
  role: 'composed_video';     // D1 bundle role
  kind: 'video';
  alt: string;
  slug: string;
  previewUrl: string;         // playable mp4 URL (VideoPlayer)
  originalUrl: string;
  thumbnailUrl: string | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  provider: string;           // 'compose:mock' | 'compose'
  tracks: { hasVoiceover: boolean; hasMusic: boolean; hasSubtitles: boolean };
  export?: { url: string; width: number | null; height: number | null; degraded: boolean } | null;
  costCents: number;          // 0
  createdAt: string;
}

export async function composeDraftVideo(input: ComposeForDraftInput): Promise<ComposeResult>;
```

### Algorithm

1. `const draft = await requireDraft(input.draftId);` (404 `not_found` if absent).
2. **Format gate** (E-CO-2): `draft.format ∉ {'reel','story'}` →
   `throw new HttpError('invalid_state','Montage réservé aux formats vidéo (Reel/Story).')`.
3. `const mode = input.mode ?? 'mock';`
4. **Load the bundle** (D1): `const bundle = await getDraftBundle(draft.id);`
   (the role-addressed read from `MP-AR-003`). Resolve each binding's `media` row
   into a `MediaAsset`-shaped value (`assetId`, `url`, `width`, `height`,
   `durationMs`, `mimeType`) via a small `bindingToMediaAsset(binding, media)`
   adapter (`media.originalUrl`→`url`, etc.).
5. **Primary-video gate** (E-CO-3): if no `bundle.primary_video` → 409
   `invalid_state` "Aucune vidéo primaire à monter." — **before** any ffmpeg call.
6. **Resolve tracks** honoring include flags (default true):
   - `voiceover = includeVoiceover!==false ? bundle.voiceover : null`
   - `music = includeMusic!==false ? bundle.music : null`
   - `subtitles = includeSubtitles!==false ? bundle.subtitles?.meta.srt ?? null : null`
   - In `live`, if **no** track resolves (vo+music+subs all null) → 409
     `invalid_state` "Aucune piste à monter (voix-off, musique ou sous-titres)."
     (mock still proceeds to byte-copy for preview — functional-spec E-CO-3).
7. `await checkDailyBudget(0);` (cost 0; parity).
8. `const out = await composeMediaBundle({ jobId: draft.id, primaryVideo, voiceover, music, subtitles, mode, timeoutMs: 90_000 });`
   - A reject (ffmpeg error / missing source / timeout) is wrapped:
     `throw new HttpError('upstream_failed','Échec du montage ffmpeg.', { cause })`
     (E-CO-5/6/8). The service does **not** persist a degraded/empty asset.
9. **Optional export** (E-CO-14): if `input.export`, call the **extracted transcode
   core** (or `transcodeExportNode` with a minimal state
   `{ jobId: draft.id, platform: draft.platform, format: draft.format, composition: out.composed }`)
   → read `exports[`${platform}_${format}`]`. If it is `degraded` (ACT-BE-032), set
   `export.degraded=true` but **do not fail** compose.
10. **Persist as a bundle asset (role='composed_video'):**
    - `createMedia({ kind:'video', source:'upload', slug:`content-studio-compose-${draft.id}-${createId().slice(0,8)}`, alt: draft.altText ?? draft.hook ?? 'Vidéo montée pour FemiGlow', originalMime:'video/mp4', originalSizeBytes: out.composed.fileSizeBytes, originalWidth: out.composed.width, originalHeight: out.composed.height, originalDurationMs: out.composed.durationMs, originalUrl: out.composed.url, status:'passthrough', qualityProfile:'inline', loadingStrategy:'viewport', overrides:{ contentStudio:{ origin:'ai_generated', role:'composed_video', provider: out.composed.provider, sourceDraftId: draft.id, tracks: out.tracks, promptVersion:'content-studio-compose-v0-2026-05-30' } }, createdBy: input.actorId })`
    - `await upsertBundleAssets({ draftId: draft.id, assets: [{ mediaId: media.id, role:'composed_video', meta:{ hasVoiceover: out.tracks.hasVoiceover, hasMusic: out.tracks.hasMusic, hasSubtitles: out.tracks.hasSubtitles, sourceRoles: presentRoles } }] });`
      (the role-aware upsert from `MP-AR-003`; replaces the prior composed video —
      E-CO-11. **Never** overwrites the primary video or any source track.)
11. `await insertGenerationRun({ ideaId: null, briefId: draft.briefId, provider: out.composed.provider, model: mode==='mock'?'compose:mock':'compose', promptVersion:'content-studio-compose-v0-2026-05-30', input:{ draftId: draft.id, mode, includeVoiceover, includeMusic, includeSubtitles, export: Boolean(input.export) }, output:{ mediaId: media.id, durationMs: out.composed.durationMs, tracks: out.tracks, degraded: out.degraded }, status:'succeeded', costCents: 0, errorMessage: null, createdBy: input.actorId });`
12. `await logAuditEvent({ action:'content_studio.compose.generated', actorId: input.actorId, resourceType:'media', resourceId: media.id, meta:{ draftId: draft.id, provider: out.composed.provider, tracks: out.tracks, mode } });`
13. Return the `ComposeResult` built from `media` + `out` (passthrough; no
    dependency on `listContentStudioMedia` — like `generateVideoForDraft`).

**Cost:** `0` in both modes (compose is local ffmpeg — `compose.ts` returns
`costCents:0` everywhere). Budget guard kept for parity with the other services.

## 3. Route — `POST /api/admin/content-studio/drafts/[id]/compose` (MP-CO-03)

Exact file: `apps/web/src/app/api/admin/content-studio/drafts/[id]/compose/route.ts`.
Mirrors `generate-visual/route.ts` 1:1.

```ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { composeGenerationSchema } from '@/lib/content-studio/schemas';
import { composeDraftVideo } from '@/lib/content-studio/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;          // ffmpeg mux headroom (core caps at 90s)

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    requireContentStudioEnabled();
    const session = await requireAdminApi();
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = composeGenerationSchema.safeParse(json ?? {});   // empty body allowed
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Payload de montage invalide.', parsed.error.flatten());
    }
    const modeCookie = cookies().get('cs_generation_mode')?.value;
    const mode: 'mock' | 'live' =
      modeCookie === 'live' || modeCookie === 'mock' ? modeCookie : 'mock';
    const media = await composeDraftVideo({
      draftId: params.id,
      actorId: session.adminId,
      includeVoiceover: parsed.data.includeVoiceover,
      includeMusic: parsed.data.includeMusic,
      includeSubtitles: parsed.data.includeSubtitles,
      export: parsed.data.export,
      mode,
    });
    return NextResponse.json({ media });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
```

- `requireContentStudioEnabled()` short-circuits when Content-Studio is disabled;
  the Media-Studio sub-flag (`CONTENT_STUDIO_MEDIA_STUDIO_ENABLED`, D6) gates UI
  rendering and is re-checked in the service (cheap guard) so a direct POST while
  the flag is off returns `403 forbidden` / `409 invalid_state` per `00_global`.
- Error envelope is `formatErrorResponse` → `{ error: { code, message, details } }`.

## 4. Schema — `composeGenerationSchema` (MP-CO-04)

Add to `src/lib/content-studio/schemas.ts`:

```ts
export const composeGenerationSchema = z
  .object({
    includeVoiceover: z.boolean().default(true),
    includeMusic: z.boolean().default(true),
    includeSubtitles: z.boolean().default(true),
    export: z.boolean().default(false),
  })
  .strict();
```

An **empty body** (`{}`) is valid → all defaults apply (compose everything
present, no export). `.strict()` rejects unknown keys. No `script`/`prompt` field —
Compose derives all inputs from the persisted bundle, not the client.

## 5. Error matrix

| Condition | `HttpError` code | HTTP | Message (FR) |
|---|---|---|---|
| Bad payload (unknown key / wrong type) | `invalid_input` | 400 | "Payload de montage invalide." |
| Draft missing | `not_found` | 404 | (from `requireDraft`) — "Brouillon introuvable." |
| Non-video format | `invalid_state` | 409 | "Montage réservé aux formats vidéo (Reel/Story)." |
| No primary video in bundle | `invalid_state` | 409 | "Aucune vidéo primaire à monter." |
| live + no extra track to mux | `invalid_state` | 409 | "Aucune piste à monter (voix-off, musique ou sous-titres)." |
| source video file missing on disk | `upstream_failed` | 502 | "Fichier vidéo source introuvable." |
| ffmpeg mux error / corrupt track | `upstream_failed` | 502 | "Échec du montage ffmpeg." |
| ffmpeg timeout | `upstream_failed` | 502 | "Montage interrompu (délai dépassé)." |
| over budget | `budget_exceeded` | 429 | (from `checkDailyBudget`; unreachable at cost 0) |
| not admin | `unauthorized`/`forbidden` | 401/403 | (from `requireAdminApi`) |

> Note: `export` failure is **not** in this matrix — it degrades the optional
> `export` field (E-CO-14), it never fails the compose response.

## 6. Concurrency / idempotency

`upsertBundleAssets` keyed by `(draftId, role='composed_video')` ⇒ last write wins;
recompose replaces. No locking needed (single-operator admin tool). The UI button
is disabled while `composing` (E-CO-16).

## 7. ffmpeg-boundary determinism & safety (quality bar §6)

- **mock** ⇒ byte-copy only ⇒ **no `fetch`, no provider, no real ffmpeg mux**. This
  is the network/provider-silence guarantee MSW asserts
  (`onUnhandledRequest:'error'` — there is no HTTP at all in compose, so any
  request is a regression). The ffmpeg binary boundary is mocked via
  `vi.mock('fluent-ffmpeg')`/`vi.mock('ffmpeg-static')` (same shape as
  `compose.test.ts`), and `node:fs/promises` is mocked for the byte-copy.
- **fake timers:** `Date.now()` (file name) and the timeout race are driven with
  `vi.useFakeTimers()` + `vi.setSystemTime(...)` so the asserted `url`/`assetId`
  are deterministic and the timeout test is instant
  (see [`test-plan-vitest.md`](test-plan-vitest.md) §1).

## 8. Cross-refs

Data model / migration / `upsertBundleAssets`/`getDraftBundle` / `role`+`meta`:
`MP-AR-*` (`../00_global`). Tracks consumed: `../01_voiceover` (`role='voiceover'`),
`../03_subtitles` (`role='subtitles'`). Sequence: [`sequence.puml`](sequence.puml).
Contract: [`api-contract.yaml`](api-contract.yaml),
[`data-contract.json`](data-contract.json).
