import { beforeEach, describe, expect, it, vi } from 'vitest';

// Échec provider simulé : le service doit enregistrer un run `failed` et
// relever une 502 explicite — avant, l'échec live était un trou noir
// (500 « Erreur interne », rien dans /generation-runs — audit 2026-06-10 §05).
vi.mock('./image-generation', () => ({
  generateStudioImage: vi.fn().mockRejectedValue(new Error('OpenAI HTTP 500: boom')),
}));
vi.mock('./video-generation', () => ({
  generateStudioVideo: vi.fn().mockRejectedValue(new Error('Higgsfield timeout')),
}));

import { resetMemoryStore } from '@/lib/db/client';
import { createContentIdea, generateVisualForDraft } from './service';
import { createBrief, createDrafts, listGenerationRuns } from './repository';

beforeEach(() => {
  resetMemoryStore();
});

async function draftFixture(format: 'post' | 'reel' = 'post') {
  const idea = await createContentIdea({
    pillar: 'rituel',
    objective: 'conversion',
    platform: 'instagram',
    format,
    prompt: 'Visuel de test échec provider.',
    actorId: 'adm_visual_failure',
  });
  const brief = await createBrief({
    ideaId: idea.id,
    angle: 'Angle test',
    cta: 'CTA test',
    actorId: 'adm_visual_failure',
  });
  const [draft] = await createDrafts([
    {
      briefId: brief.id,
      platform: 'instagram',
      format,
      variantLabel: 'A',
      caption: 'Caption #test',
      altText: 'Alt',
      hashtags: ['test'],
    },
  ]);
  if (!draft) throw new Error('fixture draft manquant');
  return draft;
}

describe('generateVisualForDraft — échec provider (P3-1)', () => {
  it('image : run failed enregistré + HttpError upstream_failed', async () => {
    const draft = await draftFixture('post');
    await expect(
      generateVisualForDraft({
        draftId: draft.id,
        actorId: 'adm_visual_failure',
        prompt: 'un visuel',
        size: '1024x1024',
        quality: 'low',
      }),
    ).rejects.toMatchObject({ code: 'upstream_failed' });

    const failed = (await listGenerationRuns(20)).find((r) => r.status === 'failed');
    expect(failed).toBeDefined();
    expect(failed!.briefId).toBe(draft.briefId);
    expect(failed!.errorMessage).toContain('boom');
    expect(failed!.costCents).toBe(0);
  });

  it('vidéo : run failed enregistré + HttpError upstream_failed', async () => {
    const draft = await draftFixture('reel');
    await expect(
      generateVisualForDraft({
        draftId: draft.id,
        actorId: 'adm_visual_failure',
        prompt: 'une vidéo',
        size: '1024x1024',
        quality: 'low',
        kind: 'video',
      }),
    ).rejects.toMatchObject({ code: 'upstream_failed' });

    const failed = (await listGenerationRuns(20)).find((r) => r.status === 'failed');
    expect(failed).toBeDefined();
    expect(failed!.errorMessage).toContain('Higgsfield timeout');
    expect((failed!.input as { kind?: string }).kind).toBe('video');
  });

  it('une HttpError du provider (ex. 409 clé manquante) est propagée telle quelle, avec run failed', async () => {
    const { generateStudioImage } = await import('./image-generation');
    const { HttpError } = await import('@/lib/errors/http-error');
    (generateStudioImage as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new HttpError('invalid_state', 'CONTENT_STUDIO_OPENAI_API_KEY manquant.'),
    );
    const draft = await draftFixture('post');
    await expect(
      generateVisualForDraft({
        draftId: draft.id,
        actorId: null,
        prompt: 'un visuel',
        size: '1024x1024',
        quality: 'low',
      }),
    ).rejects.toMatchObject({ code: 'invalid_state' });
    const failed = (await listGenerationRuns(20)).find((r) => r.status === 'failed');
    expect(failed?.errorMessage).toContain('manquant');
  });
});
