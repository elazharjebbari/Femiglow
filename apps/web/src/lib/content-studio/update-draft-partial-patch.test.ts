import { beforeEach, describe, expect, it } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';
import { createMedia } from '@/lib/db/queries/media';
import { createContentIdea, updateContentDraft } from './service';
import { createBrief, createDrafts, getDraft } from './repository';

// Régression (e2e video-publish-end-to-end rouge, 2026-06-10) : un PATCH
// {mediaId} seul faisait transiter caption/hook/cta/altText/hashtags en
// `undefined` explicite jusqu'au spread de updateDraft, qui écrasait alors la
// valeur existante. La DB drizzle survivait (set() ignore undefined) mais le
// draft RETOURNÉ — upserté tel quel dans le StudioContext — perdait sa
// caption, et `draft.caption.trim()` (Stepper) crashait la page /create.
// En memory-store la perte était même persistée.

beforeEach(() => {
  resetMemoryStore();
});

async function draftFixture() {
  const idea = await createContentIdea({
    pillar: 'rituel',
    objective: 'conversion',
    platform: 'instagram',
    format: 'reel',
    prompt: 'Patch partiel ne doit rien effacer.',
    actorId: 'adm_partial_patch',
  });
  const brief = await createBrief({
    ideaId: idea.id,
    angle: 'Angle test',
    cta: 'CTA test',
    actorId: 'adm_partial_patch',
  });
  const [draft] = await createDrafts([
    {
      briefId: brief.id,
      platform: 'instagram',
      format: 'reel',
      variantLabel: 'A',
      caption: 'Caption à préserver #soin',
      altText: 'Alt à préserver',
      hashtags: ['soin'],
      hook: 'Hook à préserver',
      cta: 'CTA à préserver',
    },
  ]);
  if (!draft) throw new Error('fixture draft manquant');
  return draft;
}

describe('updateContentDraft — patch partiel (mediaId seul)', () => {
  it('préserve caption/hook/cta/altText/hashtags dans le draft retourné ET persisté', async () => {
    const draft = await draftFixture();
    const media = await createMedia({
      kind: 'video',
      source: 'upload',
      slug: `vid-${draft.id}`,
      alt: 'clip',
      originalUrl: '/_media/content-studio/mock/reel-9x16.mp4',
      originalMime: 'video/mp4',
      originalWidth: 1080,
      originalHeight: 1920,
      originalDurationMs: 5000,
      status: 'passthrough',
    });

    const updated = await updateContentDraft({
      draftId: draft.id,
      actorId: 'adm_partial_patch',
      patch: { mediaId: media.id },
    });

    expect(updated.caption).toBe('Caption à préserver #soin');
    expect(updated.hook).toBe('Hook à préserver');
    expect(updated.cta).toBe('CTA à préserver');
    expect(updated.altText).toBe('Alt à préserver');
    expect(updated.hashtags).toEqual(['soin']);

    const persisted = await getDraft(draft.id);
    expect(persisted?.caption).toBe('Caption à préserver #soin');
  });

  it('null reste un effacement volontaire (hook: null efface le hook)', async () => {
    const draft = await draftFixture();
    const updated = await updateContentDraft({
      draftId: draft.id,
      actorId: 'adm_partial_patch',
      patch: { hook: null, caption: 'Nouvelle caption' },
    });
    expect(updated.hook).toBeNull();
    expect(updated.caption).toBe('Nouvelle caption');
    expect(updated.altText).toBe('Alt à préserver');
  });
});
