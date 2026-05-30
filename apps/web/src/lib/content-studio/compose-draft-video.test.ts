import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { resetMemoryStore } from '@/lib/db/client';
import { createMedia } from '@/lib/db/queries/media';
import { createContentIdea, composeDraftVideo, reviewContentDraft } from './service';
import { createBrief, createDrafts, getDraftBundle, upsertBundleAssets } from './repository';

/**
 * MP-CO-02 (BUG-004) — per-draft montage. Deterministic, no network
 * (onUnhandledRequest:'error' proves it).
 */
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => resetMemoryStore());

async function makeDraft(format: 'reel' | 'story' | 'post' = 'reel') {
  const idea = await createContentIdea({
    pillar: 'rituel',
    objective: 'conversion',
    platform: 'instagram',
    format,
    prompt: 'Compose test.',
    actorId: 'adm_test',
  });
  const brief = await createBrief({ ideaId: idea.id, angle: 'Angle', cta: 'CTA', actorId: 'adm_test' });
  const [draft] = await createDrafts([
    {
      briefId: brief.id,
      platform: 'instagram',
      format,
      variantLabel: 'A',
      caption: 'Compose test caption',
      altText: 'alt',
      hashtags: ['x'],
    },
  ]);
  if (!draft) throw new Error('Draft fixture missing');
  await reviewContentDraft({ draftId: draft.id });
  return draft;
}

async function bindPrimaryVideo(draftId: string) {
  const media = await createMedia({
    kind: 'video',
    source: 'upload',
    slug: `vid-${draftId}`,
    alt: 'clip',
    originalUrl: '/_media/content-studio/mock/reel-9x16.mp4',
    originalMime: 'video/mp4',
    originalWidth: 1080,
    originalHeight: 1920,
    originalDurationMs: 5000,
    status: 'passthrough',
  });
  await upsertBundleAssets({ draftId, assets: [{ mediaId: media.id, role: 'primary_video' }] });
  return media;
}

describe('composeDraftVideo (MP-CO-02)', () => {
  it('assembles a composed_video with the track manifest', async () => {
    const draft = await makeDraft('reel');
    await bindPrimaryVideo(draft.id);
    // attach a voice-over + subtitles to the bundle.
    await upsertBundleAssets({
      draftId: draft.id,
      assets: [
        { mediaId: 'me_vo', role: 'voiceover' },
        { mediaId: 'me_srt', role: 'subtitles', meta: { srt: '1\n00:00:00,000 --> 00:00:01,000\nHi\n' } },
      ],
    });

    const result = await composeDraftVideo({ draftId: draft.id, actorId: 'adm_test', mode: 'mock' });
    expect(result.role).toBe('composed_video');
    expect(result.kind).toBe('video');
    expect(result.hasVoiceover).toBe(true);
    expect(result.hasSubtitles).toBe(true);
    expect(result.hasMusic).toBe(false);
    expect(result.width).toBe(1080);
    expect(result.durationSec).toBe(5);

    const bundle = await getDraftBundle(draft.id);
    expect(bundle.composed_video?.mediaId).toBe(result.id);
    expect(bundle.composed_video?.meta.hasVoiceover).toBe(true);
    expect(bundle.primary_video).toBeTruthy(); // untouched
  });

  it('rejects compose without a primary video (409)', async () => {
    const draft = await makeDraft('reel');
    await expect(
      composeDraftVideo({ draftId: draft.id, actorId: 'adm_test', mode: 'mock' }),
    ).rejects.toMatchObject({ code: 'invalid_state', status: 409 });
  });

  it('rejects non-video formats (409)', async () => {
    const draft = await makeDraft('post');
    await expect(
      composeDraftVideo({ draftId: draft.id, actorId: 'adm_test', mode: 'mock' }),
    ).rejects.toMatchObject({ code: 'invalid_state', status: 409 });
  });
});
