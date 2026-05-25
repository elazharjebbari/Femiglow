import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../knowledge', () => ({
  searchByCollections: vi.fn().mockResolvedValue([]),
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

import { enrichKnowledgeNode } from './enrich-knowledge';
import { searchByCollections } from '../knowledge';

describe('enrichKnowledgeNode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (searchByCollections as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  const baseState = {
    jobId: 'job-ek-1',
    brief: {
      objective: 'awareness',
      keyMessage: 'Discover FemiGlow ritual.',
      tone: 'professional',
    },
    platform: 'instagram',
    format: 'post',
    contentType: 'produit',
  };

  it('returns knowledgeContext string (non-empty)', async () => {
    const result = await enrichKnowledgeNode(baseState);
    expect(typeof result.knowledgeContext).toBe('string');
    expect((result.knowledgeContext as string).length).toBeGreaterThan(0);
  });

  it('returns brandGuidelines containing "FemiGlow"', async () => {
    const result = await enrichKnowledgeNode(baseState);
    expect(typeof result.brandGuidelines).toBe('string');
    expect(result.brandGuidelines as string).toContain('FemiGlow');
  });

  it('sets currentStep to enrich_knowledge', async () => {
    const result = await enrichKnowledgeNode(baseState);
    expect(result.currentStep).toBe('enrich_knowledge');
  });

  it('platform-specific context for Instagram includes "saves et partages"', async () => {
    const result = await enrichKnowledgeNode({ ...baseState, platform: 'instagram' });
    expect(result.knowledgeContext as string).toContain('saves et partages');
  });

  it('platform-specific context for Facebook includes "Reels"', async () => {
    const result = await enrichKnowledgeNode({ ...baseState, platform: 'facebook' });
    expect(result.knowledgeContext as string).toContain('Reels');
  });

  it('objective conversion includes psychology terms', async () => {
    const state = {
      ...baseState,
      brief: { ...baseState.brief, objective: 'conversion' },
    };
    const result = await enrichKnowledgeNode(state);
    const ctx = result.knowledgeContext as string;
    expect(ctx).toContain('Psychologie de conversion');
  });

  it('objective engagement includes engagement terms', async () => {
    const state = {
      ...baseState,
      brief: { ...baseState.brief, objective: 'engagement' },
    };
    const result = await enrichKnowledgeNode(state);
    const ctx = result.knowledgeContext as string;
    expect(ctx).toContain('Engagement maximal');
  });

  it('contentType produit includes product terms', async () => {
    const state = { ...baseState, contentType: 'produit' };
    const result = await enrichKnowledgeNode(state);
    const ctx = result.knowledgeContext as string;
    expect(ctx).toContain('Pilier Produit');
  });

  it('falls back to static context when RAG fails', async () => {
    (searchByCollections as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB down'));
    const result = await enrichKnowledgeNode(baseState);
    expect(typeof result.knowledgeContext).toBe('string');
    expect((result.knowledgeContext as string).length).toBeGreaterThan(0);
  });

  it('empty brief still produces knowledge context', async () => {
    const state = {
      jobId: 'job-ek-empty',
      brief: { objective: 'awareness', keyMessage: '' },
      platform: 'instagram',
      format: 'post',
      contentType: undefined,
    };
    const result = await enrichKnowledgeNode(state);
    expect(typeof result.knowledgeContext).toBe('string');
    expect((result.knowledgeContext as string).length).toBeGreaterThan(0);
  });
});
