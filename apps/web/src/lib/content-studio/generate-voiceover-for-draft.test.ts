import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { resetMemoryStore } from '@/lib/db/client';
import { HttpError } from '@/lib/errors/http-error';
import { resetEngineConfig } from '@/lib/ai-engine/config';
import {
  createContentIdea,
  generateVoiceoverForDraft,
  suggestVoiceoverScript,
  reviewContentDraft,
} from './service';
import { createBrief, createDrafts, getDraftBundle } from './repository';

/**
 * MP-VO-02 (BUG-004) — per-draft voice-over. The MSW server with
 * onUnhandledRequest:'error' proves the mock + no-key paths make ZERO network
 * calls (a fetch would throw and fail the test).
 */
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  resetMemoryStore();
  resetEngineConfig();
});

async function makeDraft(format: 'reel' | 'story' | 'post' = 'reel') {
  const idea = await createContentIdea({
    pillar: 'rituel',
    objective: 'conversion',
    platform: 'instagram',
    format,
    prompt: 'Voiceover test.',
    actorId: 'adm_test',
  });
  const brief = await createBrief({
    ideaId: idea.id,
    angle: 'Un geste lent, une main qui retrouve sa lumière',
    cta: 'Découvrir',
    actorId: 'adm_test',
  });
  const [draft] = await createDrafts([
    {
      briefId: brief.id,
      platform: 'instagram',
      format,
      variantLabel: 'A',
      caption: 'Routine FemiGlow voix-off',
      altText: 'Voiceover test',
      hashtags: ['routine'],
    },
  ]);
  if (!draft) throw new Error('Draft fixture missing');
  await reviewContentDraft({ draftId: draft.id });
  return draft;
}

describe('generateVoiceoverForDraft (MP-VO-02)', () => {
  it('mode=mock → silent audio track, cost 0, NO provider call', async () => {
    const draft = await makeDraft('reel');
    const result = await generateVoiceoverForDraft({
      draftId: draft.id,
      actorId: 'adm_test',
      mode: 'mock',
    });
    expect(result.role).toBe('voiceover');
    expect(result.kind).toBe('audio');
    expect(result.provider).toBe('mock');
    expect(result.costCents).toBe(0);
    // stored via getStorage() under the served content-studio path (NOT the
    // AI-engine MEDIA_DIR, which the prod server can't write to).
    expect(result.originalUrl).toMatch(/\/content-studio\/voiceover\/.*\.wav$/);
    expect(result.durationSec).toBeGreaterThan(0);
  });

  it('binds the voice-over under role=voiceover WITHOUT touching the primary video', async () => {
    const draft = await makeDraft('reel');
    // seed a primary video binding first (simulating an already-generated clip).
    const { upsertBundleAssets } = await import('./repository');
    await upsertBundleAssets({
      draftId: draft.id,
      assets: [{ mediaId: 'me_existing_video', role: 'primary_video' }],
    });
    await generateVoiceoverForDraft({ draftId: draft.id, actorId: 'adm_test', mode: 'mock' });
    const bundle = await getDraftBundle(draft.id);
    expect(bundle.primary_video?.mediaId).toBe('me_existing_video'); // untouched
    expect(bundle.voiceover).toBeTruthy();
    expect(bundle.voiceover?.meta.provider).toBe('mock');
  });

  it('rejects non-video formats with HttpError invalid_state (409)', async () => {
    const draft = await makeDraft('post');
    await expect(
      generateVoiceoverForDraft({ draftId: draft.id, actorId: 'adm_test', mode: 'mock' }),
    ).rejects.toMatchObject({ code: 'invalid_state', status: 409 });
  });

  it('mode=live without a resolved TTS key → HttpError invalid_state (409), no network', async () => {
    vi.stubEnv('AI_ENGINE_DEFAULT_TTS_PROVIDER', 'openai');
    vi.stubEnv('AI_ENGINE_OPENAI_API_KEY', '');
    vi.stubEnv('CONTENT_STUDIO_OPENAI_API_KEY', '');
    vi.stubEnv('CHAT_OPENAI_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', '');
    resetEngineConfig();
    const draft = await makeDraft('story');
    await expect(
      generateVoiceoverForDraft({ draftId: draft.id, actorId: 'adm_test', mode: 'live' }),
    ).rejects.toMatchObject({ code: 'invalid_state', status: 409 });
    vi.unstubAllEnvs();
  });

  it('uses the operator-provided script when given', async () => {
    const draft = await makeDraft('reel');
    const result = await generateVoiceoverForDraft({
      draftId: draft.id,
      actorId: 'adm_test',
      script: 'Bonjour, voici le rituel FemiGlow en trois gestes.',
      mode: 'mock',
    });
    expect(result.id).toBeTruthy();
    // longer script → longer estimated duration than the default caption.
    expect(result.durationSec).toBeGreaterThanOrEqual(3);
  });

  it('throws not_found for a missing draft', async () => {
    await expect(
      generateVoiceoverForDraft({ draftId: 'cd_missing', actorId: 'adm_test', mode: 'mock' }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('returns the script actually used in the result', async () => {
    const draft = await makeDraft('reel');
    const result = await generateVoiceoverForDraft({
      draftId: draft.id,
      actorId: 'adm_test',
      script: 'Mon texte de voix-off sur-mesure.',
      mode: 'mock',
    });
    expect(result.script).toBe('Mon texte de voix-off sur-mesure.');
  });
});

describe('suggestVoiceoverScript (MP-VO ergonomics)', () => {
  it('suggests a draft-derived narration without producing audio', async () => {
    const draft = await makeDraft('reel');
    const { script } = await suggestVoiceoverScript(draft.id);
    expect(typeof script).toBe('string');
    expect(script.length).toBeGreaterThan(0);
    // no voice-over asset was created by suggesting.
    const { getDraftBundle } = await import('./repository');
    expect((await getDraftBundle(draft.id)).voiceover).toBeUndefined();
  });

  it('round-trips the operator-edited script: after generating with a custom text, the suggestion returns it', async () => {
    const draft = await makeDraft('reel');
    await generateVoiceoverForDraft({
      draftId: draft.id,
      actorId: 'adm_test',
      script: 'Texte édité par l’opérateur.',
      mode: 'mock',
    });
    const { script } = await suggestVoiceoverScript(draft.id);
    expect(script).toBe('Texte édité par l’opérateur.');
  });

  it('rejects non-video formats (409)', async () => {
    const draft = await makeDraft('post');
    await expect(suggestVoiceoverScript(draft.id)).rejects.toMatchObject({
      code: 'invalid_state',
      status: 409,
    });
  });
});
