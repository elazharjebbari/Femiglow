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

// Mock LangChain LLM classes to prevent real API calls
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockRejectedValue(new Error('No API key')),
  })),
}));

vi.mock('@langchain/anthropic', () => ({
  ChatAnthropic: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockRejectedValue(new Error('No API key')),
  })),
}));

vi.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockRejectedValue(new Error('No API key')),
  })),
}));

import { generateScriptNode } from './generate-script';

describe('generateScriptNode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const baseState = {
    jobId: 'job-gs-1',
    brief: {
      objective: 'awareness',
      keyMessage: 'Discover the FemiGlow ritual.',
      tone: 'professional',
      productFocus: 'Serum Eclat Naturel',
      targetAudience: 'Femmes 25-45 ans',
      constraints: [],
    },
    platform: 'instagram',
    format: 'reel',
    knowledgeContext: 'Some knowledge.',
    trendContext: 'Some trends.',
    brandGuidelines: 'FemiGlow brand.',
  };

  it('returns fallback script when no API key', async () => {
    const result = await generateScriptNode(baseState);
    expect(result.script).toBeDefined();
    const script = result.script as Record<string, unknown>;
    expect(script.hook).toBeDefined();
    expect(script.scenes).toBeDefined();
    expect(script.cta).toBeDefined();
  });

  it('fallback script has hook, scenes (3), cta', async () => {
    const result = await generateScriptNode(baseState);
    const script = result.script as Record<string, unknown>;
    expect(typeof script.hook).toBe('string');
    expect(Array.isArray(script.scenes)).toBe(true);
    expect((script.scenes as unknown[]).length).toBe(3);
    expect(typeof script.cta).toBe('string');
  });

  it('fallback for reel format has voiceoverRequired=true, musicRequired=true', async () => {
    const result = await generateScriptNode({ ...baseState, format: 'reel' });
    const script = result.script as Record<string, unknown>;
    expect(script.voiceoverRequired).toBe(true);
    expect(script.musicRequired).toBe(true);
  });

  it('fallback for post format has voiceoverRequired=false', async () => {
    const result = await generateScriptNode({ ...baseState, format: 'post' });
    const script = result.script as Record<string, unknown>;
    expect(script.voiceoverRequired).toBe(false);
  });

  it('fallback cta depends on objective — conversion gives "Decouvrir le rituel"', async () => {
    const state = {
      ...baseState,
      brief: { ...baseState.brief, objective: 'conversion' },
    };
    const result = await generateScriptNode(state);
    const script = result.script as Record<string, unknown>;
    expect(script.cta).toBe('Découvrir le rituel');
  });

  it('fallback cta for non-conversion gives "En savoir plus"', async () => {
    const state = {
      ...baseState,
      brief: { ...baseState.brief, objective: 'engagement' },
    };
    const result = await generateScriptNode(state);
    const script = result.script as Record<string, unknown>;
    expect(script.cta).toBe('En savoir plus');
  });

  it('sets currentStep to generate_script', async () => {
    const result = await generateScriptNode(baseState);
    expect(result.currentStep).toBe('generate_script');
  });

  it('tracks cost in costTracking', async () => {
    const result = await generateScriptNode(baseState);
    const cost = result.costTracking as Record<string, unknown>;
    expect(cost).toBeDefined();
    expect(typeof cost.totalCents).toBe('number');
    expect(cost.breakdown).toBeDefined();
    expect((cost.breakdown as Record<string, number>).generate_script).toBeDefined();
  });

  it('script scenes have sceneNumber and description', async () => {
    const result = await generateScriptNode(baseState);
    const script = result.script as Record<string, unknown>;
    const scenes = script.scenes as Array<Record<string, unknown>>;
    for (const scene of scenes) {
      expect(typeof scene.sceneNumber).toBe('number');
      expect(typeof scene.description).toBe('string');
    }
  });

  it('visual direction has element, style, colors, composition', async () => {
    const result = await generateScriptNode(baseState);
    const script = result.script as Record<string, unknown>;
    const vd = script.visualDirection as Array<Record<string, unknown>>;
    expect(Array.isArray(vd)).toBe(true);
    expect(vd.length).toBeGreaterThan(0);
    for (const note of vd) {
      expect(typeof note.element).toBe('string');
      expect(typeof note.style).toBe('string');
      expect(Array.isArray(note.colors)).toBe(true);
      expect(typeof note.composition).toBe('string');
    }
  });

  it('estimated duration for video formats', async () => {
    const result = await generateScriptNode({ ...baseState, format: 'reel' });
    const script = result.script as Record<string, unknown>;
    expect(script.estimatedDurationSeconds).toBeDefined();
    expect(typeof script.estimatedDurationSeconds).toBe('number');
  });

  it('no estimated duration for image formats', async () => {
    const result = await generateScriptNode({ ...baseState, format: 'post' });
    const script = result.script as Record<string, unknown>;
    expect(script.estimatedDurationSeconds).toBeUndefined();
  });

  it('script hook is a string', async () => {
    const result = await generateScriptNode(baseState);
    const script = result.script as Record<string, unknown>;
    expect(typeof script.hook).toBe('string');
    expect((script.hook as string).length).toBeGreaterThan(0);
  });

  it('script cta is a string', async () => {
    const result = await generateScriptNode(baseState);
    const script = result.script as Record<string, unknown>;
    expect(typeof script.cta).toBe('string');
    expect((script.cta as string).length).toBeGreaterThan(0);
  });

  it('uses brief.keyMessage in fallback', async () => {
    const state = {
      ...baseState,
      brief: { ...baseState.brief, keyMessage: 'Custom key message here' },
    };
    const result = await generateScriptNode(state);
    const script = result.script as Record<string, unknown>;
    const scenes = script.scenes as Array<Record<string, unknown>>;
    const textOverlays = scenes.map((s) => s.textOverlay).filter(Boolean);
    expect(textOverlays.some((t) => (t as string).includes('Custom key message here'))).toBe(true);
  });

  it('uses brief.productFocus in fallback', async () => {
    const state = {
      ...baseState,
      brief: { ...baseState.brief, productFocus: 'Huile Rituel Precieux' },
    };
    const result = await generateScriptNode(state);
    const script = result.script as Record<string, unknown>;
    const scenes = script.scenes as Array<Record<string, unknown>>;
    const textOverlays = scenes.map((s) => s.textOverlay).filter(Boolean);
    expect(textOverlays.some((t) => (t as string).includes('Huile Rituel Precieux'))).toBe(true);
  });
});
