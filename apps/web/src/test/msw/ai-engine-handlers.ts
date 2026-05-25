import { http, HttpResponse } from 'msw';

const BASE = '/api/admin/ai-engine';

const MOCK_GENERATION_RESULT = {
  jobId: 'test-job-001',
  status: 'completed',
  script: {
    hook: 'Un geste lent, une main qui retrouve sa lumière naturelle.',
    scenes: [
      { sceneNumber: 1, description: 'Gros plan mains, lumière naturelle', textOverlay: 'Le rituel FemiGlow', durationSeconds: 4, transition: 'fade' },
      { sceneNumber: 2, description: 'Application du produit', durationSeconds: 4, transition: 'fade' },
      { sceneNumber: 3, description: 'Résultat : ongles lumineux', textOverlay: 'FemiGlow', durationSeconds: 4, transition: 'fade' },
    ],
    cta: 'Découvrir le rituel',
    voiceoverRequired: false,
    musicRequired: false,
    musicMood: 'calm',
    visualDirection: [
      { element: 'product_hero', style: 'minimal_japanese', colors: ['cream', 'sage'], composition: 'centered' },
    ],
    estimatedDurationSeconds: 15,
  },
  caption: 'Un geste lent, une main qui retrouve sa lumière naturelle.\n\nChez FemiGlow, le soin commence par un geste précis et patient. Sans vernis, sans abrasion, le rituel accompagne l\'éclat naturel de l\'ongle.\n\nDécouvrir le rituel.',
  hashtags: ['femiglow', 'jbeauty', 'rituelbeaute', 'soinnaturel', 'beautejaponaise', 'onglesnaturels'],
  images: [
    { assetId: 'mock-img-001', url: '/_media/ai-engine/mock/test.png', mimeType: 'image/png', width: 1080, height: 1080, provider: 'mock', costCents: 0 },
  ],
  videos: [],
  qualityScores: { text_quality: 0.9, visual_quality: 0.7, brand_compliance: 0.95, hook_strength: 0.85, average: 0.88 },
  moderationResult: { safe: true, flags: [], canRetry: false, brandScore: 85 },
  costTracking: { totalCents: 0.15, breakdown: { generate_script: 0.08, generate_caption: 0.07 }, tokensUsed: { 'openai:gpt-4o-mini': 1500 } },
  errors: [],
  durationMs: 5000,
  bridgeResult: { ideaId: 'ci_test001', briefId: 'cb_test001', draftId: 'cd_test001' },
  contentStudioUrl: '/admin/content-studio-v2/library?highlight=cd_test001',
};

const MOCK_HEALTH = {
  enabled: true,
  providers: {
    text: { configured: true, provider: 'openai' },
    image: { configured: true, provider: 'mock' },
    video: { configured: true, provider: 'mock' },
    tts: { configured: true, provider: 'mock' },
  },
  budget: { dailyCents: 1000, maxPerJobCents: 100 },
  quality: { threshold: 0.7, humanReviewRequired: false },
  version: '1.0.0-mvp',
  timestamp: new Date().toISOString(),
};

const MOCK_TRENDS = {
  trends: [
    {
      id: 'trend-001',
      source: 'seasonal',
      category: 'routine',
      title: 'J-Beauty Minimalisme',
      description: 'Tendance durable : le minimalisme japonais en beauté.',
      compositeScore: 0.85,
      brandRelevance: 0.9,
      viralPotential: 0.7,
      timeSensitivity: 0.5,
      contentFeasibility: 0.9,
      suggestedFormats: ['reel', 'carousel'],
      suggestedHooks: ['Le secret que personne ne vous dit'],
      opportunityWindow: 'evergreen',
      riskAssessment: 'low',
      detectedAt: new Date().toISOString(),
      status: 'new',
    },
  ],
  meta: { count: 1, minScore: 0.4, timestamp: new Date().toISOString() },
};

const MOCK_COLLECTIONS = [
  { id: 'kc_001', name: 'Brand guidelines FemiGlow', slug: 'brand-femiglow', description: 'Identité, ton, produits', category: 'brand', documentCount: 2, chunkCount: 4, lastIndexedAt: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
  { id: 'kc_002', name: 'Neuromarketing', slug: 'neuromarketing', description: 'Biais cognitifs', category: 'psychology', documentCount: 1, chunkCount: 3, lastIndexedAt: new Date().toISOString(), isActive: true, createdAt: new Date().toISOString() },
];

const MOCK_JOBS = {
  jobs: [
    { id: 'job-001', status: 'completed', platform: 'instagram', format: 'post', contentType: 'produit', totalCostCents: 0.15, durationMs: 5000, createdAt: new Date().toISOString(), completedAt: new Date().toISOString() },
    { id: 'job-002', status: 'completed', platform: 'instagram', format: 'carousel', contentType: 'rituel', totalCostCents: 0.22, durationMs: 8000, createdAt: new Date().toISOString(), completedAt: new Date().toISOString() },
  ],
  stats: {
    daily: { totalJobs: 2, successfulJobs: 2, failedJobs: 0, totalCostCents: 0.37, avgQualityScore: 0.88, avgDurationMs: 6500 },
    weekly: { totalJobs: 5, successfulJobs: 4, failedJobs: 1, totalCostCents: 1.2, avgQualityScore: 0.85, avgDurationMs: 7000 },
    monthly: { totalJobs: 12, successfulJobs: 11, failedJobs: 1, totalCostCents: 3.5, avgQualityScore: 0.87, avgDurationMs: 6800 },
  },
};

const MOCK_PROVIDERS = [
  { id: 'prov-001', providerType: 'openai', name: 'OpenAI', apiKeyEnvVar: 'OPENAI_API_KEY', capabilities: ['text', 'image', 'tts', 'embedding'], models: [{ name: 'gpt-4o-mini', costPer1MInput: 0.15 }], isEnabled: true, healthStatus: 'healthy', priority: 10 },
  { id: 'prov-002', providerType: 'anthropic', name: 'Anthropic', apiKeyEnvVar: 'AI_ENGINE_ANTHROPIC_API_KEY', capabilities: ['text', 'vision'], models: [{ name: 'claude-sonnet-4', costPer1MInput: 3 }], isEnabled: false, healthStatus: 'inactive', priority: 20 },
];

const MOCK_INTEGRATIONS = {
  integrations: [
    { id: 'int-001', platform: 'instagram', name: 'FemiGlow Official', disabled: false },
    { id: 'int-002', platform: 'facebook', name: 'FemiGlow Page', disabled: false },
  ],
};

export const aiEngineHandlers = [
  http.post(`${BASE}/generate`, () => {
    return HttpResponse.json(MOCK_GENERATION_RESULT);
  }),

  http.get(`${BASE}/health`, () => {
    return HttpResponse.json(MOCK_HEALTH);
  }),

  http.get(`${BASE}/trends`, () => {
    return HttpResponse.json(MOCK_TRENDS);
  }),

  http.get(`${BASE}/knowledge`, () => {
    return HttpResponse.json(MOCK_COLLECTIONS);
  }),

  http.get(`${BASE}/jobs`, () => {
    return HttpResponse.json(MOCK_JOBS);
  }),

  http.get(`${BASE}/config/providers`, () => {
    return HttpResponse.json(MOCK_PROVIDERS);
  }),

  http.get(`${BASE}/config/workflows`, () => {
    return HttpResponse.json([]);
  }),

  http.get(`${BASE}/config/prompts`, () => {
    return HttpResponse.json([]);
  }),

  http.get(`${BASE}/analytics`, () => {
    return HttpResponse.json({
      overview: { generationsToday: 2, generationsWeek: 5, generationsMonth: 12, costToday: 0.15, costWeek: 1.2, costMonth: 3.5, avgQualityScore: 0.88, successRate: 0.92, errorRate: 0.08 },
      costByProvider: [{ provider: 'openai', costCents: 3.2, count: 10 }],
      costByNode: [{ nodeName: 'generate_script', costCents: 1.5, count: 12 }],
      recentJobs: MOCK_JOBS.jobs,
    });
  }),

  http.get(`${BASE}/integrations`, () => {
    return HttpResponse.json(MOCK_INTEGRATIONS);
  }),

  http.post(`${BASE}/publish`, () => {
    return HttpResponse.json({ success: true, postId: 'post-001' });
  }),

  http.post(`${BASE}/knowledge/embed`, () => {
    return HttpResponse.json({ documentsProcessed: 2, chunksCreated: 10 });
  }),

  http.post(`${BASE}/jobs/:id/review`, () => {
    return HttpResponse.json({ ...MOCK_GENERATION_RESULT, status: 'completed' });
  }),
];

export const aiEngineErrorHandlers = {
  generate500: http.post(`${BASE}/generate`, () => {
    return HttpResponse.json({ error: { code: 'internal_error', message: 'Provider timeout' } }, { status: 500 });
  }),

  generate429: http.post(`${BASE}/generate`, () => {
    return HttpResponse.json({ error: { code: 'rate_limited', message: 'Budget quotidien dépassé' } }, { status: 429 });
  }),

  healthTimeout: http.get(`${BASE}/health`, async () => {
    await new Promise((r) => setTimeout(r, 10000));
    return HttpResponse.json(MOCK_HEALTH);
  }),

  healthDisabled: http.get(`${BASE}/health`, () => {
    return HttpResponse.json({ ...MOCK_HEALTH, enabled: false });
  }),
};

export {
  MOCK_GENERATION_RESULT,
  MOCK_HEALTH,
  MOCK_TRENDS,
  MOCK_COLLECTIONS,
  MOCK_JOBS,
  MOCK_PROVIDERS,
  MOCK_INTEGRATIONS,
};
