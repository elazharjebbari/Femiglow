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
  videos: [
    { assetId: 'mock-vid-001', url: '/_media/ai-engine/mock/test-reel.mp4', mimeType: 'video/mp4', width: 1080, height: 1920, durationSeconds: 15, provider: 'mock', costCents: 0 },
  ],
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
  {
    id: 'prov-higgsfield',
    providerType: 'higgsfield',
    name: 'Higgsfield AI',
    apiKeyEnvVar: 'AI_ENGINE_HIGGSFIELD_API_KEY',
    baseUrl: 'https://api.higgsfield.ai',
    capabilities: ['image', 'video'],
    models: [
      { name: 'higgsfield-diffusion-v2', capability: 'image', costPerUnit: 500 },
      { name: 'higgsfield-video-v1', capability: 'video', costPerUnit: 2000 },
    ],
    rateLimitRpm: 60,
    dailyBudgetCents: 150,
    circuitBreakerConfig: null,
    priority: 15,
    isFallback: false,
    isEnabled: true,
    healthStatus: 'healthy',
    lastHealthCheck: null,
    configured: true,
  },
];

const MOCK_INTEGRATIONS = {
  integrations: [
    { id: 'int-001', platform: 'instagram', name: 'FemiGlow Official', disabled: false },
    { id: 'int-002', platform: 'facebook', name: 'FemiGlow Page', disabled: false },
  ],
};

export const aiEngineHandlers = [
  http.post(`${BASE}/generate`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    if (body.humanReviewRequired) {
      return HttpResponse.json({
        ...MOCK_GENERATION_RESULT,
        status: 'review',
        jobId: 'mock-review-job-001',
        reviewPayload: {
          script: MOCK_GENERATION_RESULT.script,
          caption: MOCK_GENERATION_RESULT.caption,
          hashtags: MOCK_GENERATION_RESULT.hashtags,
          images: MOCK_GENERATION_RESULT.images,
          videos: MOCK_GENERATION_RESULT.videos,
          qualityScores: MOCK_GENERATION_RESULT.qualityScores,
          moderationResult: MOCK_GENERATION_RESULT.moderationResult,
        },
      });
    }
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

  http.post(`${BASE}/publish`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const mode = (body.mode as string) ?? 'now';
    return HttpResponse.json({
      success: true,
      status: mode === 'now' ? 'published' : 'scheduled',
      postId: `mock-post-${Date.now()}`,
      draftId: body.draftId,
      message: mode === 'now'
        ? 'Contenu publié avec succès (mock)'
        : 'Contenu planifié (mock)',
    });
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

  /* --- New error handler variants --- */

  generate401: http.post(`${BASE}/generate`, () => {
    return HttpResponse.json({ error: { code: 'unauthorized', message: 'Session expired' } }, { status: 401 });
  }),

  generate422: http.post(`${BASE}/generate`, () => {
    return HttpResponse.json({ error: { code: 'validation_error', message: 'Missing required field: platform' } }, { status: 422 });
  }),

  health503: http.get(`${BASE}/health`, () => {
    return HttpResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }),

  providerUpdate500: http.post(`${BASE}/config/providers`, () => {
    return HttpResponse.json({ error: 'Internal server error updating provider' }, { status: 500 });
  }),

  workflowValidation400: http.post(`${BASE}/config/workflows`, () => {
    return HttpResponse.json({
      error: 'Validation error',
      details: [
        { code: 'too_small', minimum: 1, type: 'string', inclusive: true, exact: false, message: 'String must contain at least 1 character(s)', path: ['name'] },
        { code: 'invalid_type', expected: 'object', received: 'undefined', message: 'Required', path: ['graphConfig'] },
      ],
    }, { status: 400 });
  }),

  promptValidation400: http.post(`${BASE}/config/prompts`, () => {
    return HttpResponse.json({
      error: 'Validation error',
      details: [
        { code: 'too_small', minimum: 1, type: 'string', inclusive: true, exact: false, message: 'String must contain at least 1 character(s)', path: ['nodeName'] },
        { code: 'too_small', minimum: 1, type: 'string', inclusive: true, exact: false, message: 'String must contain at least 1 character(s)', path: ['systemPrompt'] },
      ],
    }, { status: 400 });
  }),

  knowledgeNotFound404: http.get(`${BASE}/knowledge/:slug`, () => {
    return HttpResponse.json({ error: 'Collection not found' }, { status: 404 });
  }),

  embedPartialError: http.post(`${BASE}/knowledge/embed`, () => {
    return HttpResponse.json({
      documentsProcessed: 3,
      chunksCreated: 8,
      errors: [
        { documentId: 'doc-003', error: 'Embedding generation failed: token limit exceeded' },
        { documentId: 'doc-005', error: 'Embedding generation failed: empty content' },
      ],
    }, { status: 207 });
  }),

  modelDiscoveryTimeout: http.get(`${BASE}/config/providers/models`, async () => {
    await new Promise((r) => setTimeout(r, 10000));
    return HttpResponse.json({ models: [], source: 'live' as const });
  }),

  modelDiscoveryFallback: http.get(`${BASE}/config/providers/models`, () => {
    return HttpResponse.json({
      models: [
        { id: 'gpt-4o', role: 'chat' },
        { id: 'gpt-4o-mini', role: 'chat' },
      ],
      source: 'fallback' as const,
    });
  }),
};

/* ---------- Knowledge Edit mock data ---------- */

const MOCK_DOCUMENT_DETAIL = {
  id: 'doc-001',
  collectionId: 'kc_001',
  title: 'Brand Guidelines Document',
  sourceType: 'text',
  sourceUrl: null,
  contentText: 'FemiGlow is a J-Beauty brand focused on natural nail care...',
  metadata: null,
  chunkCount: 3,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/* ---------- API Keys mock data ---------- */

const MOCK_API_KEYS = [
  { id: 'ak-001', providerType: 'openai', providerName: 'OpenAI', label: 'Production key', source: 'database' as const, masked: 'sk-proj-****abc1', keyPrefix: 'sk-proj-', keyLastFour: 'abc1', isActive: true, baseUrl: null, lastTestedAt: new Date().toISOString(), lastTestResult: 'valid', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: null, providerType: 'anthropic', providerName: 'Anthropic', label: "Variable d'environnement", source: 'env' as const, masked: 'sk-ant-****ef23', keyPrefix: 'sk-ant-', keyLastFour: 'ef23', isActive: true, baseUrl: null, lastTestedAt: null, lastTestResult: null, createdAt: null, updatedAt: null },
  { id: null, providerType: 'google', providerName: 'Google AI (Gemini)', label: 'Non configuré', source: 'none' as const, masked: '', keyPrefix: '', keyLastFour: '', isActive: false, baseUrl: null, lastTestedAt: null, lastTestResult: null, createdAt: null, updatedAt: null },
  { id: null, providerType: 'elevenlabs', providerName: 'ElevenLabs', label: 'Non configuré', source: 'none' as const, masked: '', keyPrefix: '', keyLastFour: '', isActive: false, baseUrl: null, lastTestedAt: null, lastTestResult: null, createdAt: null, updatedAt: null },
  { id: null, providerType: 'ollama', providerName: 'Ollama (local)', label: 'Non configuré', source: 'none' as const, masked: '', keyPrefix: '', keyLastFour: '', isActive: false, baseUrl: null, lastTestedAt: null, lastTestResult: null, createdAt: null, updatedAt: null },
  { id: null, providerType: 'higgsfield', providerName: 'Higgsfield AI', label: 'Non configuré', source: 'none' as const, masked: '', keyPrefix: '', keyLastFour: '', isActive: false, baseUrl: null, lastTestedAt: null, lastTestResult: null, createdAt: null, updatedAt: null },
];

/* ---------- Workflow mock data ---------- */

const MOCK_WORKFLOW = {
  id: 'wf-001',
  name: 'Reel Instagram',
  description: 'Pipeline complet pour la creation de reels Instagram',
  platform: 'instagram',
  format: 'reel',
  graphConfig: {
    nodes: ['brief_analysis', 'script_writer', 'image_gen', 'caption_gen', 'quality_gate'],
    edges: [
      ['brief_analysis', 'script_writer'],
      ['script_writer', 'image_gen'],
      ['image_gen', 'caption_gen'],
      ['caption_gen', 'quality_gate'],
    ],
  },
  defaultTone: 'professional',
  defaultLanguage: 'fr',
  qualityThreshold: '0.70',
  maxRetries: 3,
  maxBudgetCents: 100,
  humanReviewRequired: true,
  autoPublish: false,
  providerOverrides: null,
  version: 1,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/* ---------- Prompt mock data ---------- */

const MOCK_PROMPT = {
  id: 'pt-001',
  nodeName: 'brief_analysis',
  name: 'Analyse de brief',
  systemPrompt: 'Tu es un directeur de creation specialise dans le contenu de beaute et cosmetique pour les reseaux sociaux. Analyse le brief fourni et produis un plan de contenu structure.',
  userPromptTemplate: 'Analyse ce brief et produis un plan de contenu:\n\nObjectif: {{objective}}\nPlateforme: {{platform}}\nFormat: {{format}}\nTon: {{tone}}\nMessage cle: {{keyMessage}}',
  variables: ['objective', 'platform', 'format', 'tone', 'keyMessage'],
  version: 1,
  isActive: true,
  parentId: null,
  avgQualityScore: null,
  usageCount: 0,
  createdAt: new Date().toISOString(),
};

/* ---------- Model Discovery mock data ---------- */

const MOCK_MODEL_DISCOVERY: Record<string, { models: Array<{ id: string; role: string }>; source: 'live' | 'fallback' }> = {
  openai: {
    models: [
      { id: 'gpt-4o', role: 'chat' },
      { id: 'gpt-4o-mini', role: 'chat' },
      { id: 'gpt-4.1', role: 'chat' },
      { id: 'gpt-4.1-mini', role: 'chat' },
      { id: 'o3-mini', role: 'chat' },
      { id: 'dall-e-3', role: 'image' },
      { id: 'text-embedding-3-small', role: 'embedding' },
      { id: 'tts-1', role: 'tts' },
    ],
    source: 'live',
  },
  anthropic: {
    models: [
      { id: 'claude-sonnet-4-20250514', role: 'chat' },
      { id: 'claude-haiku-4-20250514', role: 'chat' },
      { id: 'claude-opus-4-20250514', role: 'chat' },
      { id: 'claude-3-5-sonnet-20241022', role: 'chat' },
    ],
    source: 'live',
  },
  google: {
    models: [
      { id: 'gemini-2.5-flash', role: 'chat' },
      { id: 'gemini-2.5-pro', role: 'chat' },
      { id: 'gemini-2.0-flash', role: 'chat' },
      { id: 'gemini-1.5-pro', role: 'chat' },
      { id: 'text-embedding-004', role: 'embedding' },
    ],
    source: 'live',
  },
  ollama: {
    models: [
      { id: 'glm-5.1:cloud', role: 'chat' },
      { id: 'llama3.1:8b', role: 'chat' },
      { id: 'qwen2.5', role: 'chat' },
      { id: 'mistral', role: 'chat' },
      { id: 'nomic-embed-text', role: 'embedding' },
      { id: 'codellama:7b', role: 'code' },
    ],
    source: 'live',
  },
  elevenlabs: {
    models: [
      { id: 'eleven_multilingual_v2', role: 'tts' },
      { id: 'eleven_turbo_v2_5', role: 'tts' },
      { id: 'eleven_monolingual_v1', role: 'tts' },
    ],
    source: 'fallback',
  },
  higgsfield: {
    models: [
      { id: 'higgsfield-diffusion-v2', role: 'image' },
      { id: 'higgsfield-video-v1', role: 'video' },
      { id: 'higgsfield-xl', role: 'image' },
    ],
    source: 'fallback',
  },
};

/* ---------- Generation stream SSE events mock data ---------- */

const MOCK_GENERATION_STREAM_EVENTS = [
  { step: 'parse_brief', status: 'running', progress: 0 },
  { step: 'parse_brief', status: 'done', progress: 20, durationMs: 450 },
  { step: 'enrich_knowledge', status: 'running', progress: 20 },
  { step: 'enrich_knowledge', status: 'done', progress: 40, durationMs: 800 },
  { step: 'generate_script', status: 'running', progress: 40 },
  { step: 'generate_script', status: 'done', progress: 60, durationMs: 1200 },
  { step: 'generate_caption', status: 'running', progress: 60 },
  { step: 'generate_caption', status: 'done', progress: 80, durationMs: 600 },
  { step: 'quality_check', status: 'running', progress: 80 },
  { step: 'quality_check', status: 'done', progress: 100, durationMs: 500 },
  { step: 'complete', status: 'done', result: MOCK_GENERATION_RESULT },
];

/* ---------- Knowledge Edit handlers ---------- */

export const knowledgeEditHandlers = [
  http.patch(`${BASE}/knowledge/:slug`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const updated = { ...MOCK_COLLECTIONS[0], ...body, updatedAt: new Date().toISOString() };
    return HttpResponse.json({ collection: updated });
  }),

  http.get(`${BASE}/knowledge/:slug/documents/:docId`, () => {
    return HttpResponse.json({ document: MOCK_DOCUMENT_DETAIL });
  }),

  http.patch(`${BASE}/knowledge/:slug/documents/:docId`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const hasContent = 'content' in body;
    return HttpResponse.json({
      document: { id: 'doc-001' },
      reChunked: hasContent,
      chunkCount: hasContent ? 5 : 3,
    });
  }),
];

/* ---------- Knowledge Edit error handlers ---------- */

export const knowledgeEditErrorHandlers = {
  slug404: http.patch(`${BASE}/knowledge/:slug`, () => {
    return HttpResponse.json({ error: 'Collection not found' }, { status: 404 });
  }),

  validation: http.patch(`${BASE}/knowledge/:slug`, () => {
    return HttpResponse.json({ error: 'Invalid field: name cannot be empty' }, { status: 422 });
  }),

  doc404: http.get(`${BASE}/knowledge/:slug/documents/:docId`, () => {
    return HttpResponse.json({ error: 'Document not found' }, { status: 404 });
  }),

  docPatch404: http.patch(`${BASE}/knowledge/:slug/documents/:docId`, () => {
    return HttpResponse.json({ error: 'Document not found' }, { status: 404 });
  }),

  docPatchValidation: http.patch(`${BASE}/knowledge/:slug/documents/:docId`, () => {
    return HttpResponse.json({ error: 'Content must be a non-empty string' }, { status: 422 });
  }),
};

/* ---------- API Keys handlers ---------- */

export const apiKeysHandlers = [
  http.get(`${BASE}/config/api-keys`, () => {
    return HttpResponse.json({ apiKeys: MOCK_API_KEYS });
  }),

  http.post(`${BASE}/config/api-keys`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const newKey = {
      id: 'ak-new',
      providerType: body.providerType,
      providerName: 'OpenAI',
      label: (body.label as string) ?? 'New key',
      source: 'database',
      masked: 'sk-****new1',
      keyPrefix: 'sk-',
      keyLastFour: 'new1',
      isActive: true,
      baseUrl: null,
      lastTestedAt: null,
      lastTestResult: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json({ apiKey: newKey }, { status: 201 });
  }),

  http.delete(`${BASE}/config/api-keys/:id`, () => {
    return HttpResponse.json({ success: true, fallbackToEnv: false });
  }),

  http.post(`${BASE}/config/api-keys/test`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      result: { valid: true, provider: body.providerType, latencyMs: 150 },
    });
  }),
];

export const apiKeysErrorHandlers = {
  encryptionUnavailable: http.post(`${BASE}/config/api-keys`, () => {
    return HttpResponse.json(
      { error: "Le chiffrement n'est pas configuré." },
      { status: 503 },
    );
  }),

  rateLimited: http.post(`${BASE}/config/api-keys/test`, () => {
    return HttpResponse.json(
      { error: 'Trop de tentatives.' },
      { status: 429 },
    );
  }),

  keyNotFound: http.delete(`${BASE}/config/api-keys/:id`, () => {
    return HttpResponse.json({ error: 'Clé API introuvable' }, { status: 404 });
  }),

  testInvalid: http.post(`${BASE}/config/api-keys/test`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      result: { valid: false, provider: body.providerType, latencyMs: 200, error: 'Invalid API key' },
    });
  }),

  saveValidation: http.post(`${BASE}/config/api-keys`, () => {
    return HttpResponse.json({ error: 'API key is required' }, { status: 422 });
  }),

  unauthorized: http.get(`${BASE}/config/api-keys`, () => {
    return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }),
};

/* ================================================================
   MODEL DISCOVERY HANDLERS
   ================================================================ */

export const modelDiscoveryHandlers = [
  http.get(`${BASE}/config/providers/models`, ({ request }) => {
    const url = new URL(request.url);
    const provider = url.searchParams.get('provider');

    if (!provider) {
      return HttpResponse.json(
        { error: { code: 'invalid_input', message: 'Missing required query parameter: provider' } },
        { status: 400 },
      );
    }

    const discovery = MOCK_MODEL_DISCOVERY[provider];
    if (!discovery) {
      return HttpResponse.json(
        { error: { code: 'invalid_input', message: `Invalid provider: "${provider}"` } },
        { status: 400 },
      );
    }

    const capability = url.searchParams.get('capability');
    let models = discovery.models;

    if (capability) {
      const roleMap: Record<string, string> = { text: 'chat', chat: 'chat', embedding: 'embedding', image: 'image', video: 'video', tts: 'tts', vision: 'vision', code: 'code' };
      const roleFilter = roleMap[capability];
      if (roleFilter) {
        models = models.filter((m) => m.role === roleFilter);
      }
    }

    return HttpResponse.json({ models, source: discovery.source });
  }),
];

export const modelDiscoveryErrorHandlers = {
  timeout: http.get(`${BASE}/config/providers/models`, async () => {
    await new Promise((r) => setTimeout(r, 10000));
    return HttpResponse.json({ models: [], source: 'live' as const });
  }),

  fallback: http.get(`${BASE}/config/providers/models`, () => {
    return HttpResponse.json({
      models: [
        { id: 'gpt-4o', role: 'chat' },
        { id: 'gpt-4o-mini', role: 'chat' },
      ],
      source: 'fallback' as const,
    });
  }),

  error500: http.get(`${BASE}/config/providers/models`, () => {
    return HttpResponse.json({ error: 'Model discovery failed' }, { status: 500 });
  }),
};

/* ================================================================
   PROVIDER UPDATE HANDLER
   ================================================================ */

export const providerHandlers = [
  http.post(`${BASE}/config/providers`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const now = new Date().toISOString();
    const updated = {
      id: (body.id as string) ?? 'prov-new',
      providerType: body.providerType ?? 'openai',
      name: body.name ?? 'Updated Provider',
      apiKeyEnvVar: body.apiKeyEnvVar ?? 'OPENAI_API_KEY',
      baseUrl: body.baseUrl ?? null,
      capabilities: body.capabilities ?? ['text'],
      models: body.models ?? [{ name: 'gpt-4o-mini', costPer1MInput: 0.15 }],
      isEnabled: body.isEnabled ?? true,
      healthStatus: 'healthy',
      priority: body.priority ?? 10,
      rateLimitRpm: body.rateLimitRpm ?? null,
      dailyBudgetCents: body.dailyBudgetCents ?? null,
      updatedAt: now,
    };
    return HttpResponse.json({ provider: updated });
  }),
];

/* ================================================================
   WORKFLOW CRUD HANDLERS
   ================================================================ */

export const workflowHandlers = [
  /* GET list: already in aiEngineHandlers — this array adds mutating handlers */

  http.post(`${BASE}/config/workflows`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const now = new Date().toISOString();
    const created = {
      ...MOCK_WORKFLOW,
      id: 'wf-new-' + Date.now(),
      name: (body.name as string) ?? 'New Workflow',
      description: (body.description as string) ?? null,
      platform: (body.platform as string) ?? null,
      format: (body.format as string) ?? null,
      graphConfig: body.graphConfig ?? MOCK_WORKFLOW.graphConfig,
      defaultTone: (body.defaultTone as string) ?? 'professional',
      defaultLanguage: (body.defaultLanguage as string) ?? 'fr',
      qualityThreshold: (body.qualityThreshold as string) ?? '0.70',
      maxRetries: (body.maxRetries as number) ?? 3,
      maxBudgetCents: (body.maxBudgetCents as number) ?? 100,
      humanReviewRequired: (body.humanReviewRequired as boolean) ?? true,
      autoPublish: (body.autoPublish as boolean) ?? false,
      providerOverrides: body.providerOverrides ?? null,
      version: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    return HttpResponse.json({ workflow: created }, { status: 201 });
  }),

  http.get(`${BASE}/config/workflows/:id`, () => {
    return HttpResponse.json({ workflow: MOCK_WORKFLOW });
  }),

  http.put(`${BASE}/config/workflows/:id`, async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>;
    const now = new Date().toISOString();
    const updated = {
      ...MOCK_WORKFLOW,
      ...body,
      id: params.id as string,
      updatedAt: now,
    };
    return HttpResponse.json({ workflow: updated });
  }),

  http.delete(`${BASE}/config/workflows/:id`, () => {
    return HttpResponse.json({ success: true });
  }),
];

export const workflowErrorHandlers = {
  create422: http.post(`${BASE}/config/workflows`, () => {
    return HttpResponse.json({
      error: 'Validation error',
      details: [
        { code: 'too_small', minimum: 1, type: 'string', inclusive: true, exact: false, message: 'String must contain at least 1 character(s)', path: ['name'] },
        { code: 'invalid_type', expected: 'object', received: 'undefined', message: 'Required', path: ['graphConfig'] },
      ],
    }, { status: 400 });
  }),

  get404: http.get(`${BASE}/config/workflows/:id`, () => {
    return HttpResponse.json({ error: 'Workflow not found' }, { status: 404 });
  }),

  update404: http.put(`${BASE}/config/workflows/:id`, () => {
    return HttpResponse.json({ error: 'Workflow not found' }, { status: 404 });
  }),

  delete404: http.delete(`${BASE}/config/workflows/:id`, () => {
    return HttpResponse.json({ error: 'Workflow not found' }, { status: 404 });
  }),

  list500: http.get(`${BASE}/config/workflows`, () => {
    return HttpResponse.json({ error: 'Failed to load workflows' }, { status: 500 });
  }),
};

/* ================================================================
   PROMPT CRUD HANDLERS
   ================================================================ */

export const promptHandlers = [
  /* GET list: already in aiEngineHandlers — this array adds mutating handlers */

  http.post(`${BASE}/config/prompts`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const now = new Date().toISOString();

    /* If body.id is present, treat as an update (new version) */
    const isUpdate = Boolean(body.id);
    const created = {
      ...MOCK_PROMPT,
      id: isUpdate ? 'pt-v2-' + Date.now() : 'pt-new-' + Date.now(),
      nodeName: (body.nodeName as string) ?? MOCK_PROMPT.nodeName,
      name: (body.name as string) ?? MOCK_PROMPT.name,
      systemPrompt: (body.systemPrompt as string) ?? MOCK_PROMPT.systemPrompt,
      userPromptTemplate: (body.userPromptTemplate as string) ?? MOCK_PROMPT.userPromptTemplate,
      variables: (body.variables as string[]) ?? MOCK_PROMPT.variables,
      version: isUpdate ? MOCK_PROMPT.version + 1 : 1,
      isActive: (body.isActive as boolean) ?? true,
      parentId: isUpdate ? (body.id as string) : null,
      createdAt: now,
    };
    return HttpResponse.json({ prompt: created }, { status: isUpdate ? 200 : 201 });
  }),

  http.get(`${BASE}/config/prompts/:id`, () => {
    return HttpResponse.json({ prompt: MOCK_PROMPT });
  }),

  http.put(`${BASE}/config/prompts/:id`, async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>;
    const now = new Date().toISOString();
    const updated = {
      ...MOCK_PROMPT,
      ...body,
      id: 'pt-v2-' + Date.now(),
      parentId: params.id as string,
      version: MOCK_PROMPT.version + 1,
      createdAt: now,
    };
    return HttpResponse.json({ prompt: updated });
  }),

  http.delete(`${BASE}/config/prompts/:id`, () => {
    return HttpResponse.json({ success: true });
  }),
];

export const promptErrorHandlers = {
  create422: http.post(`${BASE}/config/prompts`, () => {
    return HttpResponse.json({
      error: 'Validation error',
      details: [
        { code: 'too_small', minimum: 1, type: 'string', inclusive: true, exact: false, message: 'String must contain at least 1 character(s)', path: ['nodeName'] },
        { code: 'too_small', minimum: 1, type: 'string', inclusive: true, exact: false, message: 'String must contain at least 1 character(s)', path: ['systemPrompt'] },
      ],
    }, { status: 400 });
  }),

  get404: http.get(`${BASE}/config/prompts/:id`, () => {
    return HttpResponse.json({ error: 'Prompt not found' }, { status: 404 });
  }),

  update404: http.put(`${BASE}/config/prompts/:id`, () => {
    return HttpResponse.json({ error: 'Prompt not found' }, { status: 404 });
  }),

  update422: http.put(`${BASE}/config/prompts/:id`, () => {
    return HttpResponse.json({ error: 'Prompt content cannot be empty' }, { status: 422 });
  }),

  delete404: http.delete(`${BASE}/config/prompts/:id`, () => {
    return HttpResponse.json({ error: 'Prompt not found' }, { status: 404 });
  }),

  list500: http.get(`${BASE}/config/prompts`, () => {
    return HttpResponse.json({ error: 'Failed to load prompts' }, { status: 500 });
  }),
};

/* ================================================================
   KNOWLEDGE EXTENDED HANDLERS
   ================================================================ */

export const knowledgeHandlers = [
  http.get(`${BASE}/knowledge/:slug`, () => {
    return HttpResponse.json({ collection: MOCK_COLLECTIONS[0] });
  }),

  http.get(`${BASE}/knowledge/:slug/documents`, () => {
    return HttpResponse.json({ documents: [MOCK_DOCUMENT_DETAIL] });
  }),

  http.post(`${BASE}/knowledge/seed`, () => {
    return HttpResponse.json({ seeded: true, collections: 5 });
  }),
];

export const knowledgeErrorHandlers = {
  empty: http.get(`${BASE}/knowledge`, () => {
    return HttpResponse.json([]);
  }),

  unauthorized: http.get(`${BASE}/knowledge`, () => {
    return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }),

  error500: http.get(`${BASE}/knowledge`, () => {
    return HttpResponse.json({ error: 'Database error' }, { status: 500 });
  }),

  getBySlug404: http.get(`${BASE}/knowledge/:slug`, () => {
    return HttpResponse.json({ error: 'Collection not found' }, { status: 404 });
  }),

  listDocumentsEmpty: http.get(`${BASE}/knowledge/:slug/documents`, () => {
    return HttpResponse.json({ documents: [] });
  }),

  listDocuments404: http.get(`${BASE}/knowledge/:slug/documents`, () => {
    return HttpResponse.json({ error: 'Collection not found' }, { status: 404 });
  }),

  seedError500: http.post(`${BASE}/knowledge/seed`, () => {
    return HttpResponse.json({ error: 'Seed failed: database error' }, { status: 500 });
  }),

  embedError500: http.post(`${BASE}/knowledge/embed`, () => {
    return HttpResponse.json({ error: 'Embedding provider unavailable' }, { status: 500 });
  }),
};

/* ================================================================
   SSE STREAMING HANDLER
   ================================================================ */

export const streamHandlers = [
  http.post(`${BASE}/generate-stream`, () => {
    const encoder = new TextEncoder();
    const steps = [
      { step: 'parse_brief', status: 'running', progress: 0 },
      { step: 'parse_brief', status: 'done', progress: 20, durationMs: 450 },
      { step: 'enrich_knowledge', status: 'running', progress: 20 },
      { step: 'enrich_knowledge', status: 'done', progress: 40, durationMs: 800 },
      { step: 'generate_script', status: 'running', progress: 40 },
      { step: 'generate_script', status: 'done', progress: 60, durationMs: 1200 },
      { step: 'generate_caption', status: 'running', progress: 60 },
      { step: 'generate_caption', status: 'done', progress: 80, durationMs: 600 },
      { step: 'quality_check', status: 'running', progress: 80 },
      { step: 'quality_check', status: 'done', progress: 100, durationMs: 500 },
      { step: 'complete', status: 'done', result: MOCK_GENERATION_RESULT },
    ];

    const stream = new ReadableStream({
      start(controller) {
        for (const event of steps) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
        controller.close();
      },
    });

    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  }),
];

export const streamErrorHandlers = {
  streamError: http.post(`${BASE}/generate-stream`, () => {
    const encoder = new TextEncoder();
    const events = [
      { step: 'parse_brief', status: 'running', progress: 0 },
      { step: 'parse_brief', status: 'done', progress: 20, durationMs: 450 },
      { step: 'error', status: 'error', error: 'Provider timeout: OpenAI did not respond within 30s', durationMs: 30000 },
    ];

    const stream = new ReadableStream({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
        controller.close();
      },
    });

    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  }),

  serverError500: http.post(`${BASE}/generate-stream`, () => {
    return HttpResponse.json({ error: 'Internal server error' }, { status: 500 });
  }),
};

/* ================================================================
   JOBS EXTENDED ERROR HANDLERS
   ================================================================ */

export const jobsErrorHandlers = {
  empty: http.get(`${BASE}/jobs`, () => {
    return HttpResponse.json({
      jobs: [],
      stats: {
        daily: { totalJobs: 0, successfulJobs: 0, failedJobs: 0, totalCostCents: 0, avgQualityScore: 0, avgDurationMs: 0 },
        weekly: { totalJobs: 0, successfulJobs: 0, failedJobs: 0, totalCostCents: 0, avgQualityScore: 0, avgDurationMs: 0 },
        monthly: { totalJobs: 0, successfulJobs: 0, failedJobs: 0, totalCostCents: 0, avgQualityScore: 0, avgDurationMs: 0 },
      },
    });
  }),

  unauthorized: http.get(`${BASE}/jobs`, () => {
    return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }),

  error500: http.get(`${BASE}/jobs`, () => {
    return HttpResponse.json({ error: 'Database connection failed' }, { status: 500 });
  }),

  reviewNotFound: http.post(`${BASE}/jobs/:id/review`, () => {
    return HttpResponse.json({ error: 'Job not found' }, { status: 404 });
  }),

  reviewInvalidAction: http.post(`${BASE}/jobs/:id/review`, () => {
    return HttpResponse.json({ error: 'Invalid review action. Must be approve, reject, or edit' }, { status: 422 });
  }),
};

/* ================================================================
   TRENDS EXTENDED HANDLERS
   ================================================================ */

export const trendsErrorHandlers = {
  empty: http.get(`${BASE}/trends`, () => {
    return HttpResponse.json({ trends: [], meta: { count: 0, minScore: 0.4, timestamp: new Date().toISOString() } });
  }),

  error500: http.get(`${BASE}/trends`, () => {
    return HttpResponse.json({ error: 'Trends service unavailable' }, { status: 500 });
  }),
};

/* ================================================================
   ANALYTICS EXTENDED ERROR HANDLERS
   ================================================================ */

export const analyticsErrorHandlers = {
  error500: http.get(`${BASE}/analytics`, () => {
    return HttpResponse.json({ error: 'Analytics aggregation failed' }, { status: 500 });
  }),

  unauthorized: http.get(`${BASE}/analytics`, () => {
    return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }),
};

/* ================================================================
   INTEGRATIONS EXTENDED HANDLERS
   ================================================================ */

export const integrationsErrorHandlers = {
  empty: http.get(`${BASE}/integrations`, () => {
    return HttpResponse.json({ integrations: [] });
  }),

  error500: http.get(`${BASE}/integrations`, () => {
    return HttpResponse.json({ error: 'Integration service unavailable' }, { status: 500 });
  }),
};

/* ================================================================
   PUBLISH EXTENDED ERROR HANDLERS
   ================================================================ */

export const publishErrorHandlers = {
  unauthorized: http.post(`${BASE}/publish`, () => {
    return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }),

  conflict: http.post(`${BASE}/publish`, () => {
    return HttpResponse.json({ error: 'Content already published' }, { status: 409 });
  }),

  error500: http.post(`${BASE}/publish`, () => {
    return HttpResponse.json({ error: 'Platform API error' }, { status: 500 });
  }),
};

/* ================================================================
   EXPORTS
   ================================================================ */

export {
  MOCK_GENERATION_RESULT,
  MOCK_HEALTH,
  MOCK_TRENDS,
  MOCK_COLLECTIONS,
  MOCK_JOBS,
  MOCK_PROVIDERS,
  MOCK_INTEGRATIONS,
  MOCK_DOCUMENT_DETAIL,
  MOCK_API_KEYS,
  MOCK_WORKFLOW,
  MOCK_PROMPT,
  MOCK_MODEL_DISCOVERY,
  MOCK_GENERATION_STREAM_EVENTS,
};
