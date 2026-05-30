import { type Page } from '@playwright/test';

/**
 * CS v2 create-audit Phase 7 — Shared mock fixtures + helpers for the
 * Content Studio v2 `/create` E2E specs. Each spec registers `page.route`
 * handlers to intercept the API calls the create flow makes, so the suite
 * runs deterministically without a real LLM or DB.
 */

export const MOCK_IDEA = {
  id: 'idea_e2e_1',
  campaignId: null,
  pillar: 'rituel',
  objective: 'consideration',
  platform: 'instagram',
  format: 'reel',
  prompt: 'E2E prompt',
  status: 'idea',
  createdAt: new Date('2026-05-28T10:00:00Z').toISOString(),
} as const;

export const MOCK_BRIEF = {
  id: 'brief_e2e_1',
  ideaId: MOCK_IDEA.id,
  version: 1,
  angle: 'Slow ritual',
  proof: 'Tested',
  cta: 'Découvrir',
  mediaDirection: 'Slow shots',
};

export const MOCK_DRAFTS = [
  {
    id: 'draft_e2e_A',
    briefId: MOCK_BRIEF.id,
    platform: 'instagram',
    format: 'reel',
    variantLabel: 'A',
    caption: 'Variant A caption. Une caption assez longue pour passer la validation.',
    hook: 'Trois minutes pour toi.',
    cta: 'Découvrir',
    altText: 'Visuel',
    hashtags: ['#femiglow'],
    status: 'generated',
    rejectionReason: null,
    parentDraftId: null,
    scoreTotal: 85,
    editedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'draft_e2e_B',
    briefId: MOCK_BRIEF.id,
    platform: 'instagram',
    format: 'reel',
    variantLabel: 'B',
    caption: 'Variant B caption alternative.',
    hook: 'Ton rituel.',
    cta: 'En savoir plus',
    altText: 'Visuel B',
    hashtags: ['#femiglow', '#rituel'],
    status: 'generated',
    rejectionReason: null,
    parentDraftId: null,
    scoreTotal: 72,
    editedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'draft_e2e_C',
    briefId: MOCK_BRIEF.id,
    platform: 'instagram',
    format: 'reel',
    variantLabel: 'C',
    caption: 'Variant C caption alternative encore.',
    hook: 'Luxe lent.',
    cta: 'Découvrir',
    altText: 'Visuel C',
    hashtags: ['#femiglow', '#luxe'],
    status: 'generated',
    rejectionReason: null,
    parentDraftId: null,
    scoreTotal: 90,
    editedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export interface RegisterMocksOpts {
  /** Default text model returned by /generate. */
  textModel?: string;
  /** Default text provider. */
  textProvider?: 'openai' | 'fallback' | 'mock';
  /** Override the mock-mode flag exposed by /health. */
  mockMode?: boolean;
}

/**
 * Register all create-flow API mocks on a given Playwright page. Call this
 * once at the start of every spec — after `page.goto(...)`. Returns a
 * payload of last-known state so individual specs can assert against it.
 */
export async function registerCreateMocks(page: Page, opts: RegisterMocksOpts = {}) {
  const textModel = opts.textModel ?? 'gpt-4o-mini';
  const textProvider = opts.textProvider ?? 'openai';
  const mockMode = opts.mockMode ?? true;
  const state = {
    lastIdeasBody: undefined as Record<string, unknown> | undefined,
    lastGenerateBody: undefined as Record<string, unknown> | undefined,
    lastVisualBody: undefined as Record<string, unknown> | undefined,
    approveCalled: false,
    publishNowCalled: false,
    publishScheduleCalled: false,
  };

  await page.route('**/api/admin/content-studio/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, mode: 'memory', version: 'P3', mockMode }),
    }),
  );

  await page.route('**/api/admin/content-studio/models*', (route) => {
    const url = new URL(route.request().url());
    const role = url.searchParams.get('role') ?? 'chat';
    const models = role === 'chat'
      ? [
          { id: 'gpt-4o-mini', provider: 'openai', role: 'chat', label: 'GPT-4o mini', tier: 'fast', capabilities: [], pricing: { inputCentsPer1k: 0.015, outputCentsPer1k: 0.06 }, recommendedFor: ['post', 'story'], source: 'static', isDefault: true },
          { id: 'gpt-4o', provider: 'openai', role: 'chat', label: 'GPT-4o', tier: 'balanced', capabilities: [], pricing: { inputCentsPer1k: 0.25, outputCentsPer1k: 1.0 }, recommendedFor: ['reel', 'carousel'], source: 'static' },
        ]
      : role === 'image'
        ? [
            { id: 'gpt-image-1-mini', provider: 'openai', role: 'image', label: 'GPT-Image-1 mini', tier: 'fast', capabilities: [], pricing: { perCall: 0.4 }, recommendedFor: ['story'], source: 'static', isDefault: true },
            { id: 'dall-e-3', provider: 'openai', role: 'image', label: 'DALL·E 3', tier: 'balanced', capabilities: [], pricing: { perCall: 4 }, recommendedFor: ['post', 'carousel'], source: 'static' },
          ]
        : [
            { id: 'mock-video-1.0', provider: 'mock', role: 'video', label: 'Mock vidéo', tier: 'fast', capabilities: [], pricing: { perCall: 0 }, recommendedFor: ['reel', 'story'], source: 'static', isDefault: true },
          ];
    const suggested = models[0];
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        models,
        suggested,
        providers: [{ id: 'openai', label: 'OpenAI', status: 'healthy' }, { id: 'mock', label: 'Mock', status: 'mock' }],
      }),
    });
  });

  await page.route('**/api/admin/content-studio/ideas', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      state.lastIdeasBody = body;
      const idea = { ...MOCK_IDEA, ...body, id: MOCK_IDEA.id, status: 'idea' };
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ idea }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ideas: [], pagination: { limit: 50, offset: 0, hasMore: false, nextOffset: null } }),
    });
  });

  await page.route('**/api/admin/content-studio/ideas/*/generate', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    state.lastGenerateBody = body ?? undefined;
    // Sync the drafts' format with whatever format was set on the idea so
    // MediaStudio's defaults (image vs video) match the user's intent.
    const format = (state.lastIdeasBody?.format as string) ?? 'reel';
    const platform = (state.lastIdeasBody?.platform as string) ?? 'instagram';
    const drafts = MOCK_DRAFTS.map((d) => ({ ...d, format, platform }));
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        idea: { ...MOCK_IDEA, format, platform, status: 'generated' },
        brief: MOCK_BRIEF,
        drafts,
        runs: [{ provider: textProvider, model: textModel, costCents: textProvider === 'fallback' ? 0 : 2, status: 'succeeded' }],
      }),
    });
  });

  await page.route('**/api/admin/content-studio/drafts/*/review', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const url = route.request().url();
    const m = /\/drafts\/([^/]+)\/review/.exec(url);
    const draftId = m?.[1] ?? 'draft_e2e_A';
    // Preserve the format / platform that was set on the idea so downstream
    // components (MediaStudio kind toggle, PreviewPane) keep the right
    // aspect ratio.
    const format = (state.lastIdeasBody?.format as string) ?? MOCK_DRAFTS[0]!.format;
    const platform = (state.lastIdeasBody?.platform as string) ?? MOCK_DRAFTS[0]!.platform;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        review: { id: 'rev_1', draftId, status: 'pass', scoreTotal: 88, violations: [] },
        draft: { ...MOCK_DRAFTS[0], id: draftId, format, platform, status: 'needs_review' },
      }),
    });
  });

  await page.route('**/api/admin/content-studio/drafts/*/generate-visual', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    state.lastVisualBody = body;
    const kind = (body?.kind as string) ?? 'image';
    if (kind === 'video') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          media: {
            id: 'media_video_1',
            kind: 'video',
            compartment: 'ai_generated',
            slug: 'mock-vid',
            alt: 'Vidéo mock',
            originalUrl: '/_media/content-studio/mock/reel-9x16.mp4',
            previewUrl: '/_media/content-studio/mock/reel-9x16.mp4',
            thumbUrl: '/_media/content-studio/mock/poster-9x16.jpg',
            width: 1080,
            height: 1920,
            createdAt: new Date().toISOString(),
          },
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        media: {
          id: 'media_img_1',
          kind: 'image',
          compartment: 'ai_generated',
          slug: 'mock-img',
          alt: 'Image mock',
          originalUrl: '/_media/content-studio/mock/sample-1080.png',
          previewUrl: '/_media/content-studio/mock/sample-1080.png',
          thumbUrl: '/_media/content-studio/mock/sample-1080.png',
          width: 1080,
          height: 1080,
          createdAt: new Date().toISOString(),
        },
      }),
    });
  });

  await page.route('**/api/admin/content-studio/drafts/*/approve', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    state.approveCalled = true;
    // Extract draftId from the URL so the mock post references the actual
    // selected variant — whichever one the spec clicked. This matters when
    // the spec picks variant B (since variant A is already auto-selected
    // after generation, the "Choisir cette variante" button only exists on B/C).
    const url = route.request().url();
    const m = /\/drafts\/([^/]+)\/approve/.exec(url);
    const draftId = m?.[1] ?? 'draft_e2e_A';
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        post: {
          id: `post_e2e_${draftId.slice(-1)}`,
          draftId,
          status: 'approved',
          scheduledAt: null,
          publishedAt: null,
        },
      }),
    });
  });

  await page.route('**/api/admin/content-studio/posts/*/publish-now', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    state.publishNowCalled = true;
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'queued',
        jobs: [{ id: 'job_1', postId: 'post_e2e_1', provider: 'mock', status: 'published' }],
      }),
    });
  });

  await page.route('**/api/admin/content-studio/posts/*/schedule', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    state.publishScheduleCalled = true;
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'scheduled',
        jobs: [{ id: 'job_2', postId: 'post_e2e_1', provider: 'mock', status: 'queued' }],
      }),
    });
  });

  await page.route('**/api/admin/content-studio/drafts*', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          drafts: [],
          pagination: { limit: 50, offset: 0, hasMore: false, nextOffset: null },
        }),
      });
    }
    return route.fallback();
  });

  await page.route('**/api/admin/content-studio/posts*', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          posts: [],
          pagination: { limit: 50, offset: 0, hasMore: false, nextOffset: null },
        }),
      });
    }
    return route.fallback();
  });

  await page.route('**/api/admin/content-studio/generation-runs*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        runs: [],
        budget: { dailyBudgetCents: 100, dailySpentCents: 5, remainingCents: 95 },
      }),
    }),
  );

  await page.route('**/api/admin/content-studio/media*', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], pagination: { limit: 50, offset: 0, hasMore: false, nextOffset: null } }),
      });
    }
    return route.fallback();
  });

  return state;
}

/**
 * Convenience helper — Playwright sometimes returns "skip if not authed".
 * This guards on the page already showing the create heading.
 */
export async function ensureCreatePageLoaded(page: Page) {
  await page.waitForSelector('[data-section="frame"]', { timeout: 20_000 });
}
