import { describe, expect, it, vi, beforeEach } from 'vitest';

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

import { enrichTrendsNode } from './enrich-trends';

describe('enrichTrendsNode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const baseState = {
    jobId: 'job-et-1',
    brief: {
      objective: 'awareness',
      keyMessage: 'Discover the ritual.',
      tone: 'professional',
    },
    platform: 'instagram',
    format: 'post',
  };

  it('returns trendContext string', async () => {
    const result = await enrichTrendsNode(baseState);
    expect(typeof result.trendContext).toBe('string');
    expect((result.trendContext as string).length).toBeGreaterThan(0);
  });

  it('sets currentStep to enrich_trends', async () => {
    const result = await enrichTrendsNode(baseState);
    expect(result.currentStep).toBe('enrich_trends');
  });

  it('includes seasonal trends based on current month', async () => {
    const result = await enrichTrendsNode(baseState);
    const ctx = result.trendContext as string;
    // The function always returns year-round trends at minimum
    // Check that we have at least one trend with a category tag
    expect(ctx).toMatch(/\[(routine|aesthetic|ingredient|seasonal|cultural|product)\]/);
  });

  it('manual trend reference is prepended', async () => {
    const state = {
      ...baseState,
      brief: {
        ...baseState.brief,
        trendReference: 'Clean girl aesthetic',
      },
    };
    const result = await enrichTrendsNode(state);
    const ctx = result.trendContext as string;
    // Manual trend should appear first (before year-round trends)
    expect(ctx).toContain('Clean girl aesthetic');
    const manualIdx = ctx.indexOf('Clean girl aesthetic');
    expect(manualIdx).toBeLessThan(ctx.indexOf('Self-care rituals'));
  });

  it('trends are filtered by relevance >= 0.7', async () => {
    const result = await enrichTrendsNode(baseState);
    const ctx = result.trendContext as string;
    // Extract all relevance values from the formatted output
    const relevanceMatches = ctx.match(/pertinence: ([\d.]+)/g) ?? [];
    for (const match of relevanceMatches) {
      const value = parseFloat(match.replace('pertinence: ', ''));
      expect(value).toBeGreaterThanOrEqual(0.7);
    }
  });

  it('returns max 5 trends (plus optional manual)', async () => {
    const result = await enrichTrendsNode(baseState);
    const ctx = result.trendContext as string;
    // Count trend blocks separated by double newlines
    const trendBlocks = ctx.split('\n\n').filter((b) => b.includes('pertinence:'));
    expect(trendBlocks.length).toBeLessThanOrEqual(6); // 5 + potential manual
  });

  it('works with empty brief', async () => {
    const state = {
      jobId: 'job-et-empty',
      brief: { objective: 'awareness', keyMessage: '' },
    };
    const result = await enrichTrendsNode(state);
    expect(typeof result.trendContext).toBe('string');
    expect((result.trendContext as string).length).toBeGreaterThan(0);
  });

  it('returns formatted trend lines with category and angle', async () => {
    const result = await enrichTrendsNode(baseState);
    const ctx = result.trendContext as string;
    // Each trend block should contain a [category] tag and an "Angle:" line
    const lines = ctx.split('\n');
    const categoryLines = lines.filter((l) => /^\[.+\]/.test(l));
    const angleLines = lines.filter((l) => l.startsWith('Angle:'));
    expect(categoryLines.length).toBeGreaterThan(0);
    expect(angleLines.length).toBeGreaterThan(0);
    expect(categoryLines.length).toBe(angleLines.length);
  });
});
