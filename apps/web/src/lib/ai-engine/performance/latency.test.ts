import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock config — prevent real API calls, use mock/fallback providers
// ---------------------------------------------------------------------------

vi.mock('../config', () => ({
  getEngineConfig: () => ({
    enabled: true,
    defaults: { tone: 'professional', language: 'fr', maxRetries: 3 },
    budget: { dailyCents: 1000, maxPerJobCents: 200 },
    quality: { threshold: 0.7, humanReviewRequired: false },
    providers: {
      text: { default: 'mock', model: 'mock' },
      image: { default: 'mock', model: 'mock' },
      video: { default: 'mock' },
      tts: { default: 'mock' },
    },
    apiKeys: {},
  }),
}));

// Mock knowledge retrieval to avoid DB/RAG calls
vi.mock('../knowledge', () => ({
  searchKnowledge: vi.fn().mockResolvedValue([]),
  searchByCollections: vi.fn().mockResolvedValue([]),
  listCollections: vi.fn().mockResolvedValue([]),
  getCollection: vi.fn().mockResolvedValue(null),
}));

// Mock brand rules for quality check
vi.mock('@/lib/content-studio/brand-rules', () => ({
  reviewDraftContent: vi.fn(() => ({
    passed: true,
    score: 0.9,
    issues: [],
    suggestions: [],
  })),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { parseBriefNode } from '../nodes/parse-brief';
import { enrichKnowledgeNode } from '../nodes/enrich-knowledge';
import { generateImagesNode } from '../nodes/generate-images';
import { qualityCheckNode } from '../nodes/quality-check';

// ---------------------------------------------------------------------------
// Shared test state
// ---------------------------------------------------------------------------

function makeBaseState(): Record<string, unknown> {
  return {
    jobId: 'perf-test-001',
    platform: 'instagram',
    format: 'post',
    contentType: 'awareness',
    briefInput: {
      objective: 'awareness',
      keyMessage: 'Discover the ritual of natural Japanese beauty.',
      tone: 'luxurious',
      language: 'fr',
    },
    brief: {
      objective: 'awareness',
      keyMessage: 'Discover the ritual of natural Japanese beauty.',
      tone: 'luxurious',
      language: 'fr',
      targetAudience: 'Femmes 25-45 ans',
      constraints: [],
      maxBudgetCents: 200,
    },
    script: {
      hook: 'Discover the secret',
      scenes: [{ sceneNumber: 1, description: 'Product shot' }],
      cta: 'Shop now',
      voiceoverRequired: false,
      musicRequired: false,
      visualDirection: [
        { element: 'product_hero', style: 'minimal_japanese', colors: ['cream', 'sage'], composition: 'centered' },
      ],
    },
    caption: 'A beautiful ritual of care and precision. #JBeauty #FemiGlow',
    hashtags: ['#JBeauty', '#FemiGlow', '#NailCare'],
    images: [{ url: 'https://example.com/img.jpg', provider: 'mock' }],
    videos: [],
    knowledgeContext: 'Brand guidelines context.',
    brandGuidelines: 'FemiGlow brand guidelines.',
    costTracking: { totalCents: 0, breakdown: {}, tokensUsed: {} },
    errors: [],
    currentStep: 'init',
  };
}

// ---------------------------------------------------------------------------
// Latency benchmark tests
// ---------------------------------------------------------------------------

describe('AI Engine — latency benchmarks (mock/deterministic providers)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parseBriefNode completes in < 50ms', async () => {
    const state = makeBaseState();
    const start = performance.now();
    await parseBriefNode(state);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('enrichKnowledgeNode (static fallback) completes in < 100ms', async () => {
    const state = makeBaseState();
    const start = performance.now();
    await enrichKnowledgeNode(state);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it('generateImagesNode (mock provider) completes in < 100ms', async () => {
    const state = makeBaseState();
    const start = performance.now();
    await generateImagesNode(state);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it('qualityCheckNode completes in < 100ms', async () => {
    const state = makeBaseState();
    const start = performance.now();
    await qualityCheckNode(state);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it('parseBrief + enrichKnowledge + generateImages + qualityCheck pipeline < 500ms', async () => {
    const state = makeBaseState();
    const start = performance.now();

    const briefResult = await parseBriefNode(state);
    const enrichResult = await enrichKnowledgeNode({ ...state, ...briefResult });
    const imageResult = await generateImagesNode({ ...state, ...briefResult, ...enrichResult });
    await qualityCheckNode({ ...state, ...briefResult, ...enrichResult, ...imageResult });

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it('each node returns an object (not null/undefined)', async () => {
    const state = makeBaseState();

    const briefResult = await parseBriefNode(state);
    expect(briefResult).toBeDefined();
    expect(typeof briefResult).toBe('object');

    const enrichResult = await enrichKnowledgeNode(state);
    expect(enrichResult).toBeDefined();
    expect(typeof enrichResult).toBe('object');

    const imageResult = await generateImagesNode(state);
    expect(imageResult).toBeDefined();
    expect(typeof imageResult).toBe('object');

    const qualityResult = await qualityCheckNode(state);
    expect(qualityResult).toBeDefined();
    expect(typeof qualityResult).toBe('object');
  });
});
