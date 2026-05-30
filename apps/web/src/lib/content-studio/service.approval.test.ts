import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';
import { createMedia } from '@/lib/db/queries/media';
import { HttpError } from '@/lib/errors/http-error';
import {
  approveContentDraft,
  createContentIdea,
  createVariation,
  generateVisualForDraft,
  reviewContentDraft,
} from './service';
import {
  createBrief,
  createDrafts,
  getPrimaryAsset,
  upsertPrimaryAsset,
  listGenerationRuns,
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

  it('trace le modèle INTENTIONNEL distinct de l\'exécuté en mock (ACT-DA-005)', { timeout: 30000 }, async () => {
    const draft = await makeDraft();
    await generateVisualForDraft({
      draftId: draft.id,
      actorId: 'adm_test',
      prompt: 'Trace du modèle choisi par l\'opérateur.',
      size: '1024x1024',
      quality: 'low',
      model: 'gpt-image-1-mini', // choix opérateur
      mode: 'mock', // exécution mock
    });
    const runs = await listGenerationRuns();
    const run = runs[0]!; // le plus récent
    // exécuté = mock ; intentionnel = le modèle choisi → traçabilité préservée
    expect(run.model).toMatch(/^mock-/);
    expect((run.input as Record<string, unknown>).intendedModel).toBe('gpt-image-1-mini');
  });

  it('createVariation RÉGÉNÈRE un texte différent du parent (ACT-BE-014)', async () => {
    const draft = await makeDraft();
    const variation = await createVariation({
      draftId: draft.id,
      promptOverride: 'Mets l’accent sur la patience et la lenteur du geste.',
      mode: 'mock',
    });
    expect(variation).not.toBeNull();
    expect(variation!.parentDraftId).toBe(draft.id);
    // régénéré (fallback varié + prompt+override) ≠ clone identique du parent
    expect(variation!.caption).not.toBe(draft.caption);
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
