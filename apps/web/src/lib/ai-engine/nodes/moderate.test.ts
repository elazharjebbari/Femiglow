import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/content-studio/brand-rules', () => ({
  reviewDraftContent: vi.fn((draft: { caption: string }) => {
    const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    const violations: Array<{ severity: string; rule: string; message: string }> = [];
    const text = draft.caption.toLowerCase();

    const BLOCKED_TERMS = ['miracle', 'incroyable', 'wow', 'offre flash'];
    for (const term of BLOCKED_TERMS) {
      if (text.includes(term)) {
        violations.push({ severity: 'blocked', rule: 'blocked_term', message: `Terme interdit: "${term}"` });
      }
    }
    if (draft.caption.includes('!')) {
      violations.push({ severity: 'blocked', rule: 'punctuation_exclamation', message: 'Exclamation interdite.' });
    }
    if (EMOJI_RE.test(draft.caption)) {
      violations.push({ severity: 'blocked', rule: 'emoji', message: 'Emoji interdit.' });
    }

    const blocked = violations.some((v) => v.severity === 'blocked');
    const scoreTotal = Math.max(0, 100 - violations.reduce((a, v) => a + (v.severity === 'blocked' ? 35 : 12), 0));
    return {
      status: blocked ? 'blocked' : 'pass',
      scoreTotal,
      score: { lexical: blocked ? 40 : 96, tone: 94, claims: 92, platform: 92 },
      violations,
    };
  }),
}));

vi.mock('../config', () => ({
  getEngineConfig: () => ({
    enabled: true,
    defaults: { tone: 'professional', language: 'fr', maxRetries: 3 },
    budget: { dailyCents: 1000, maxPerJobCents: 100 },
    quality: { threshold: 0.7, humanReviewRequired: false },
    providers: {
      text: { default: 'openai', model: 'gpt-4o-mini' },
      image: { default: 'mock', model: 'mock' },
      video: { default: 'mock' },
      tts: { default: 'mock' },
    },
    apiKeys: { openai: undefined, anthropic: undefined, google: undefined, elevenlabs: undefined },
  }),
}));

import { moderateNode } from './moderate';

describe('moderateNode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const cleanState = {
    jobId: 'job-mod-1',
    caption: 'Un geste lent pour des ongles soignes. Le rituel FemiGlow revele votre eclat naturel.',
    script: { hook: 'Un geste lent qui change tout dans votre rituel quotidien' },
  };

  it('returns safe for clean content', async () => {
    const result = await moderateNode(cleanState);
    const mod = result.moderationResult as Record<string, unknown>;
    expect(mod.safe).toBe(true);
    expect(mod.flags).toEqual([]);
  });

  it('returns flags for content with blocked terms', async () => {
    const state = {
      ...cleanState,
      caption: 'Ce produit miracle va transformer vos ongles.',
    };
    const result = await moderateNode(state);
    const mod = result.moderationResult as Record<string, unknown>;
    expect(mod.safe).toBe(false);
    expect((mod.flags as string[]).length).toBeGreaterThan(0);
  });

  it('sets currentStep to moderate', async () => {
    const result = await moderateNode(cleanState);
    expect(result.currentStep).toBe('moderate');
  });

  it('ModerationResult has safe, flags, canRetry, brandScore', async () => {
    const result = await moderateNode(cleanState);
    const mod = result.moderationResult as Record<string, unknown>;
    expect(typeof mod.safe).toBe('boolean');
    expect(Array.isArray(mod.flags)).toBe(true);
    expect(typeof mod.canRetry).toBe('boolean');
    expect(typeof mod.brandScore).toBe('number');
  });

  it('caption without emoji is safe', async () => {
    const result = await moderateNode(cleanState);
    const mod = result.moderationResult as Record<string, unknown>;
    expect(mod.safe).toBe(true);
  });

  it('caption with emoji is flagged', async () => {
    const state = {
      ...cleanState,
      caption: 'Le rituel FemiGlow \u{1F31F} revele votre eclat.',
    };
    const result = await moderateNode(state);
    const mod = result.moderationResult as Record<string, unknown>;
    expect(mod.safe).toBe(false);
    expect((mod.flags as string[]).some((f) => f.includes('emoji'))).toBe(true);
  });

  it('empty caption is safe', async () => {
    const state = { ...cleanState, caption: '', script: null };
    const result = await moderateNode(state);
    const mod = result.moderationResult as Record<string, unknown>;
    expect(mod.safe).toBe(true);
  });

  it('brand score is between 0 and 100', async () => {
    const result = await moderateNode(cleanState);
    const mod = result.moderationResult as Record<string, unknown>;
    expect(mod.brandScore as number).toBeGreaterThanOrEqual(0);
    expect(mod.brandScore as number).toBeLessThanOrEqual(100);
  });

  it('canRetry is boolean', async () => {
    const result = await moderateNode(cleanState);
    const mod = result.moderationResult as Record<string, unknown>;
    expect(typeof mod.canRetry).toBe('boolean');
  });

  it('works with null script', async () => {
    const state = { ...cleanState, script: null };
    const result = await moderateNode(state);
    const mod = result.moderationResult as Record<string, unknown>;
    expect(mod).toBeDefined();
    expect(typeof mod.safe).toBe('boolean');
  });
});
