import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';
import { createMedia } from '@/lib/db/queries/media';
import { HttpError } from '@/lib/errors/http-error';
import {
  approveContentDraft,
  createContentIdea,
  generateVisualForDraft,
  reviewContentDraft,
} from './service';
import {
  createBrief,
  createDrafts,
  getPrimaryAsset,
  upsertPrimaryAsset,
} from './repository';

beforeEach(() => {
  resetMemoryStore();
  vi.stubEnv('CONTENT_STUDIO_IMAGE_PROVIDER', 'mock');
  vi.stubEnv('CONTENT_STUDIO_IMAGE_MODEL', 'gpt-image-1-mini');
});

async function makeDraft() {
  const idea = await createContentIdea({
    pillar: 'rituel',
    objective: 'conversion',
    platform: 'instagram',
    format: 'post',
    prompt: 'Approval gate test.',
    actorId: 'adm_test',
  });
  const brief = await createBrief({
    ideaId: idea.id,
    angle: 'Test approval',
    cta: 'Découvrir',
    actorId: 'adm_test',
  });
  const [draft] = await createDrafts([
    {
      briefId: brief.id,
      platform: 'instagram',
      format: 'post',
      variantLabel: 'A',
      caption: 'Routine FemiGlow approbation',
      altText: 'Approval test',
      hashtags: ['routine'],
    },
  ]);
  if (!draft) throw new Error('Draft fixture missing');
  await reviewContentDraft({ draftId: draft.id });
  return draft;
}

describe('approveContentDraft — gate sur primary_asset', () => {
  it('refuse l\'approbation si aucun visuel n\'est associé', async () => {
    const draft = await makeDraft();
    await expect(approveContentDraft({ draftId: draft.id, actorId: 'adm_test' })).rejects.toMatchObject({
      code: 'invalid_state',
    });
  });

  it('accepte l\'approbation quand un visuel est associé', async () => {
    const draft = await makeDraft();
    const media = await createMedia({
      kind: 'image',
      source: 'upload',
      slug: `approval-${draft.id}`,
      alt: 'Approval ok',
      originalUrl: 'https://cdn.femiglow.test/approval.png',
      originalMime: 'image/png',
      originalWidth: 1024,
      originalHeight: 1024,
      status: 'ready',
    });
    await upsertPrimaryAsset({ draftId: draft.id, mediaId: media.id });
    const post = await approveContentDraft({ draftId: draft.id, actorId: 'adm_test' });
    expect(post.draftId).toBe(draft.id);
    expect(post.status).toBe('approved');
  });

  it('message d\'erreur cite « Sauvegarder + relire » pour guider l\'utilisateur', async () => {
    const draft = await makeDraft();
    try {
      await approveContentDraft({ draftId: draft.id, actorId: 'adm_test' });
      throw new Error('expected approval to fail');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).message).toMatch(/Sauvegarder \+ relire/);
    }
  });
});

describe('generateVisualForDraft — auto-bind du visuel au draft', () => {
  it('bind automatiquement le visuel généré au draft (primary_asset)', { timeout: 30000 }, async () => {
    const draft = await makeDraft();
    const generated = await generateVisualForDraft({
      draftId: draft.id,
      actorId: 'adm_test',
      prompt: 'Routine matin éclat, lumière douce, ambiance studio beauté.',
      size: '1024x1024',
      quality: 'low',
    });
    const asset = await getPrimaryAsset(draft.id);
    expect(asset).not.toBeNull();
    expect(asset?.mediaId).toBe(generated.id);
  });

  it('remplace le binding précédent quand on régénère un visuel', { timeout: 60000 }, async () => {
    const draft = await makeDraft();
    const first = await generateVisualForDraft({
      draftId: draft.id,
      actorId: 'adm_test',
      prompt: 'Première version visuelle FemiGlow.',
      size: '1024x1024',
      quality: 'low',
    });
    const second = await generateVisualForDraft({
      draftId: draft.id,
      actorId: 'adm_test',
      prompt: 'Deuxième version visuelle FemiGlow.',
      size: '1024x1024',
      quality: 'low',
    });
    const asset = await getPrimaryAsset(draft.id);
    expect(asset?.mediaId).toBe(second.id);
    expect(asset?.mediaId).not.toBe(first.id);
  });

  it('le draft devient approuvable directement après génération (chaîne complète)', { timeout: 30000 }, async () => {
    const draft = await makeDraft();
    await generateVisualForDraft({
      draftId: draft.id,
      actorId: 'adm_test',
      prompt: 'Routine éclat lumière naturelle FemiGlow.',
      size: '1024x1024',
      quality: 'low',
    });
    const post = await approveContentDraft({ draftId: draft.id, actorId: 'adm_test' });
    expect(post.status).toBe('approved');
  });
});
