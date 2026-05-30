# Phase 4 — Mock Video Assets + Service

## Objectif
Fournir le chemin code complet pour générer une vidéo mock (MP4 statique) liée au draft.

## Durée estimée
0.5 j-p (dev) + 0.5 j (tests)

## Dépendances
- Phase 1 (registry)
- Phase 3 (route generate-visual étendue)

## 1. Générer les assets MP4

### Pré-requis
- `ffmpeg` installé sur la machine de dev (ou Docker)

### Commandes
```bash
mkdir -p /var/www/femiglow-staging/apps/web/public/_media/content-studio/mock

# Reel 9:16 5s avec texte au centre
ffmpeg -y -f lavfi -i color=c=0x6B5BFF:size=1080x1920:duration=5 \
  -vf "drawtext=text='FemiGlow Mock Reel':fontcolor=white:fontsize=80:x=(w-text_w)/2:y=(h-text_h)/2:fontfile=/usr/share/fonts/truetype/dejavu/DejaVu-Bold.ttf" \
  -c:v libx264 -pix_fmt yuv420p -profile:v baseline -level 3.0 \
  -movflags +faststart -b:v 700k \
  /var/www/femiglow-staging/apps/web/public/_media/content-studio/mock/reel-9x16.mp4

# Story 9:16 3s
ffmpeg -y -f lavfi -i color=c=0xFFB58E:size=1080x1920:duration=3 \
  -vf "drawtext=text='FemiGlow Mock Story':fontcolor=white:fontsize=80:x=(w-text_w)/2:y=(h-text_h)/2:fontfile=/usr/share/fonts/truetype/dejavu/DejaVu-Bold.ttf" \
  -c:v libx264 -pix_fmt yuv420p -profile:v baseline -level 3.0 \
  -movflags +faststart -b:v 500k \
  /var/www/femiglow-staging/apps/web/public/_media/content-studio/mock/story-9x16.mp4

# Poster jpg
ffmpeg -y -f lavfi -i color=c=0x6B5BFF:size=1080x1920:duration=1 \
  -frames:v 1 \
  /var/www/femiglow-staging/apps/web/public/_media/content-studio/mock/poster-9x16.jpg

# Sample image (pour mock image)
ffmpeg -y -f lavfi -i color=c=0xFFB58E:size=1080x1080:duration=1 \
  -frames:v 1 \
  /var/www/femiglow-staging/apps/web/public/_media/content-studio/mock/sample-1080.png
```

### Vérification
```bash
ls -lh /var/www/femiglow-staging/apps/web/public/_media/content-studio/mock/
# reel-9x16.mp4 ~700 KB
# story-9x16.mp4 ~500 KB
# poster-9x16.jpg ~50 KB
# sample-1080.png ~30 KB
```

### Commit
Ces assets sont committés (taille raisonnable < 2 MB total). Si > 2 MB, considérer Git LFS.

## 2. Service `video-generation.ts`

```ts
// apps/web/src/lib/content-studio/services/video-generation.ts

import { env } from '@/lib/env';
import { db } from '@/lib/db/client';
import { media, contentAssetBindings, contentGenerationRuns } from '@/lib/db/schema-content-studio';
import { eq } from 'drizzle-orm';
import { suggestForFormat } from '@/lib/content-studio-v2/models/registry';
import type { StudioMediaItem } from '@/lib/content-studio/types';
import { nanoid } from 'nanoid';

interface VideoGenArgs {
  draftId: string;
  prompt: string;
  model?: string;
  actorId: string;
}

interface VideoGenResult {
  media: StudioMediaItem;
  run: { id: string; provider: string; model: string; costCents: number; status: string };
}

const MOCK_ASSETS: Record<string, { url: string; width: number; height: number; duration: number; poster: string }> = {
  reel: {
    url: '/_media/content-studio/mock/reel-9x16.mp4',
    width: 1080, height: 1920, duration: 5000,
    poster: '/_media/content-studio/mock/poster-9x16.jpg',
  },
  story: {
    url: '/_media/content-studio/mock/story-9x16.mp4',
    width: 1080, height: 1920, duration: 3000,
    poster: '/_media/content-studio/mock/poster-9x16.jpg',
  },
};

export async function generateStudioVideo(args: VideoGenArgs): Promise<VideoGenResult> {
  const draft = await fetchDraft(args.draftId);
  const fmt = draft.format;

  const mockAsset = MOCK_ASSETS[fmt];
  if (!mockAsset) {
    throw new Error(`Video not applicable for format '${fmt}'`);
  }

  const isMock =
    env.CONTENT_STUDIO_V2_MOCK_MODE === true ||
    env.CONTENT_STUDIO_VIDEO_PROVIDER === 'mock' ||
    args.model === 'mock-video-1.0';

  if (!isMock) {
    throw new Error('Real video provider not implemented yet — only mock available');
  }

  return generateMockVideo(args, draft, mockAsset);
}

async function generateMockVideo(
  args: VideoGenArgs,
  draft: { id: string; format: string },
  mockAsset: typeof MOCK_ASSETS[string],
): Promise<VideoGenResult> {
  const mediaId = nanoid();
  const runId = nanoid();

  await db.transaction(async (tx) => {
    await tx.insert(media).values({
      id: mediaId,
      kind: 'video',
      source: 'ai_generated',
      slug: `mock-${draft.format}-${mediaId.slice(0, 8)}`,
      originalUrl: mockAsset.url,
      originalMime: 'video/mp4',
      originalWidth: mockAsset.width,
      originalHeight: mockAsset.height,
      originalDurationMs: mockAsset.duration,
      alt: `Vidéo mock générée pour ${draft.format}`,
      status: 'ready',
      createdBy: args.actorId,
    });

    // Replace existing primary binding
    await tx
      .delete(contentAssetBindings)
      .where(eq(contentAssetBindings.draftId, draft.id));

    await tx.insert(contentAssetBindings).values({
      draftId: draft.id,
      mediaId,
      role: 'primary',
      crop: null,
    });

    await tx.insert(contentGenerationRuns).values({
      id: runId,
      ideaId: null,
      briefId: null,
      provider: 'mock',
      model: args.model ?? 'mock-video-1.0',
      promptVersion: 'mock-1',
      input: { prompt: args.prompt },
      output: { mediaId },
      status: 'succeeded',
      costCents: 0,
      createdBy: args.actorId,
    });
  });

  return {
    media: {
      id: mediaId,
      kind: 'video',
      compartment: 'ai_generated',
      slug: `mock-${draft.format}-${mediaId.slice(0, 8)}`,
      alt: `Vidéo mock générée pour ${draft.format}`,
      thumbnailUrl: mockAsset.poster,
      previewUrl: mockAsset.url,
      originalUrl: mockAsset.url,
      width: mockAsset.width,
      height: mockAsset.height,
      durationMs: mockAsset.duration,
      createdAt: new Date().toISOString(),
    },
    run: {
      id: runId,
      provider: 'mock',
      model: args.model ?? 'mock-video-1.0',
      costCents: 0,
      status: 'succeeded',
    },
  };
}
```

## 3. Tests

### Unit `video-generation.test.ts`
```ts
import { generateStudioVideo } from './video-generation';

describe('generateStudioVideo', () => {
  it('returns mock video for reel format', async () => {
    const result = await generateStudioVideo({ draftId: 'draft-1', prompt: '...', actorId: 'u1' });
    expect(result.media.kind).toBe('video');
    expect(result.media.previewUrl).toContain('reel-9x16.mp4');
    expect(result.media.width).toBe(1080);
    expect(result.media.height).toBe(1920);
    expect(result.run.costCents).toBe(0);
  });

  it('returns mock video for story format', async () => {
    // …
  });

  it('throws for post format', async () => {
    await expect(generateStudioVideo({ ... }, post)).rejects.toThrow();
  });
});
```

### E2E
- `create-mock-video.spec.ts` (S03)

## Acceptance
- [ ] 3 MP4 + 1 JPG + 1 PNG dans `public/_media/content-studio/mock/`
- [ ] GET de chacun retourne 200 avec content-type correct
- [ ] generateStudioVideo retourne MediaItem valide
- [ ] PreviewPane rend `<video controls>` lisible
- [ ] 0 fail tests Phase 4
