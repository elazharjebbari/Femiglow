import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { resetMemoryStore } from '@/lib/db/client';
import { resetEngineConfig } from '@/lib/ai-engine/config';
import { DEFAULT_BURN_IN_STYLE, type Cue } from '@/lib/ai-engine/subtitles/srt';
import {
  createContentIdea,
  generateSubtitlesForDraft,
  saveSubtitlesForDraft,
  reviewContentDraft,
} from './service';
import { createBrief, createDrafts, getDraftBundle } from './repository';

/**
 * MP-SU-03 (BUG-004) — per-draft subtitles. onUnhandledRequest:'error' proves
 * the mock/rule-based path makes ZERO network calls.
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
    prompt: 'Subtitles test.',
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
      caption: 'Le rituel FemiGlow en trois gestes pour des ongles éclatants au quotidien.',
      altText: 'Subtitles test',
      hashtags: ['routine'],
    },
  ]);
  if (!draft) throw new Error('Draft fixture missing');
  await reviewContentDraft({ draftId: draft.id });
  return draft;
}

describe('generateSubtitlesForDraft (MP-SU-03)', () => {
  it('mode=mock → rule-based SRT persisted as role=subtitles, NO network', async () => {
    const draft = await makeDraft('reel');
    const result = await generateSubtitlesForDraft({
      draftId: draft.id,
      actorId: 'adm_test',
      mode: 'mock',
    });
    expect(result.role).toBe('subtitles');
    expect(result.kind).toBe('subtitles');
    expect(result.provider).toBe('rule-based');
    expect(result.cueCount).toBeGreaterThan(0);
    expect(result.srt).toContain('-->');
    const bundle = await getDraftBundle(draft.id);
    expect(bundle.subtitles?.meta.srt).toBe(result.srt);
  });

  it('rejects non-video formats with invalid_state (409)', async () => {
    const draft = await makeDraft('post');
    await expect(
      generateSubtitlesForDraft({ draftId: draft.id, actorId: 'adm_test', mode: 'mock' }),
    ).rejects.toMatchObject({ code: 'invalid_state', status: 409 });
  });

  it('mode=live + refine without an IA key → invalid_state (409), no network', async () => {
    vi.stubEnv('AI_ENGINE_OPENAI_API_KEY', '');
    vi.stubEnv('CONTENT_STUDIO_OPENAI_API_KEY', '');
    vi.stubEnv('CHAT_OPENAI_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', '');
    resetEngineConfig();
    const draft = await makeDraft('story');
    await expect(
      generateSubtitlesForDraft({ draftId: draft.id, actorId: 'adm_test', refine: true, mode: 'live' }),
    ).rejects.toMatchObject({ code: 'invalid_state', status: 409 });
    vi.unstubAllEnvs();
  });
});

describe('saveSubtitlesForDraft (MP-SU-03)', () => {
  it('rejects overlapping cues with invalid_input (400) + cueErrors', async () => {
    const draft = await makeDraft('reel');
    const cues: Cue[] = [
      { index: 1, startMs: 0, endMs: 2000, lines: ['A'] },
      { index: 2, startMs: 1000, endMs: 3000, lines: ['B'] }, // overlap
    ];
    await expect(
      saveSubtitlesForDraft({ draftId: draft.id, actorId: 'adm_test', cues, style: DEFAULT_BURN_IN_STYLE }),
    ).rejects.toMatchObject({ code: 'invalid_input', status: 400 });
  });

  it('saves valid cues, re-indexes, and binds role=subtitles without touching the primary video', async () => {
    const draft = await makeDraft('reel');
    const { upsertBundleAssets } = await import('./repository');
    await upsertBundleAssets({
      draftId: draft.id,
      assets: [{ mediaId: 'me_existing_video', role: 'primary_video' }],
    });
    const cues: Cue[] = [
      { index: 9, startMs: 1600, endMs: 3100, lines: ['Deuxième'] },
      { index: 1, startMs: 0, endMs: 1500, lines: ['Premier'] },
    ];
    const result = await saveSubtitlesForDraft({
      draftId: draft.id,
      actorId: 'adm_test',
      cues,
      style: DEFAULT_BURN_IN_STYLE,
    });
    expect(result.cueCount).toBe(2);
    expect(result.cues[0]!.lines).toEqual(['Premier']); // sorted by startMs + reindexed
    expect(result.cues[0]!.index).toBe(1);
    const bundle = await getDraftBundle(draft.id);
    expect(bundle.primary_video?.mediaId).toBe('me_existing_video');
    expect(bundle.subtitles?.meta.cueCount).toBe(2);
  });

  it('empty cues clear the subtitles binding', async () => {
    const draft = await makeDraft('reel');
    await saveSubtitlesForDraft({
      draftId: draft.id,
      actorId: 'adm_test',
      cues: [{ index: 1, startMs: 0, endMs: 1500, lines: ['X'] }],
      style: DEFAULT_BURN_IN_STYLE,
    });
    const cleared = await saveSubtitlesForDraft({
      draftId: draft.id,
      actorId: 'adm_test',
      cues: [],
      style: DEFAULT_BURN_IN_STYLE,
    });
    expect(cleared.cueCount).toBe(0);
    expect(cleared.srt).toBe('');
  });
});
