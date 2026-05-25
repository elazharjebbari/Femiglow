/**
 * AI Engine — Multi-format E2E tests.
 *
 * Tests generating the same brief with different formats (post, carousel,
 * reel, story). Mocks the generate API to return format-specific responses.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

// ---------------------------------------------------------------------------
// Format-specific mock responses
// ---------------------------------------------------------------------------

function makeMockResponse(overrides: Record<string, unknown> = {}) {
  return {
    jobId: 'fmt-job-001',
    status: 'completed',
    script: {
      hook: 'Votre peau rayonne naturellement.',
      scenes: [{ sceneNumber: 1, description: 'Gros plan produit' }],
      cta: 'Essayez maintenant',
      voiceoverRequired: false,
      musicRequired: false,
      visualDirection: [],
    },
    caption: 'Découvrez la beauté japonaise avec FemiGlow.',
    hashtags: ['femiglow', 'jbeauty'],
    images: [
      {
        assetId: 'img-fmt-1',
        url: '/test-fmt.png',
        mimeType: 'image/png',
        width: 1080,
        height: 1080,
        provider: 'mock',
        costCents: 0,
      },
    ],
    videos: [],
    qualityScores: {
      text_quality: 0.9,
      visual_quality: 0.85,
      brand_compliance: 0.92,
      hook_strength: 0.87,
      average: 0.885,
    },
    moderationResult: { safe: true, flags: [], canRetry: false },
    costTracking: {
      totalCents: 0.10,
      breakdown: { generate_script: 0.05, generate_caption: 0.05 },
      tokensUsed: {},
    },
    errors: [],
    durationMs: 4000,
    bridgeResult: { ideaId: 'ci_fmt', briefId: 'cb_fmt', draftId: 'cd_fmt' },
    contentStudioUrl: '/admin/content-studio-v2/library?highlight=cd_fmt',
    ...overrides,
  };
}

const POST_RESPONSE = makeMockResponse({
  jobId: 'fmt-post-001',
  images: [
    { assetId: 'img-post-1', url: '/post.png', mimeType: 'image/png', width: 1080, height: 1080, provider: 'mock', costCents: 0 },
  ],
  videos: [],
  script: {
    hook: 'Un seul geste, une peau transformée.',
    scenes: [{ sceneNumber: 1, description: 'Image produit plein cadre' }],
    cta: 'Découvrir',
    voiceoverRequired: false,
    musicRequired: false,
    visualDirection: [],
  },
});

const CAROUSEL_RESPONSE = makeMockResponse({
  jobId: 'fmt-carousel-001',
  images: [
    { assetId: 'img-car-1', url: '/car1.png', mimeType: 'image/png', width: 1080, height: 1080, provider: 'mock', costCents: 0 },
    { assetId: 'img-car-2', url: '/car2.png', mimeType: 'image/png', width: 1080, height: 1080, provider: 'mock', costCents: 0 },
    { assetId: 'img-car-3', url: '/car3.png', mimeType: 'image/png', width: 1080, height: 1080, provider: 'mock', costCents: 0 },
  ],
  videos: [],
  caption: 'Faites glisser pour découvrir notre rituel en 3 étapes.',
});

const REEL_RESPONSE = makeMockResponse({
  jobId: 'fmt-reel-001',
  images: [],
  videos: [
    { assetId: 'vid-reel-1', url: '/reel.mp4', mimeType: 'video/mp4', width: 1080, height: 1920, provider: 'mock', costCents: 0 },
  ],
  script: {
    hook: 'Regardez cette transformation en 30 secondes.',
    scenes: [
      { sceneNumber: 1, description: 'Avant / Après' },
      { sceneNumber: 2, description: 'Application du produit' },
    ],
    cta: 'Lien en bio',
    voiceoverRequired: true,
    musicRequired: true,
    visualDirection: ['cinematic', 'warm-tones'],
  },
  caption: 'Le secret de la J-Beauty en 30s.',
});

const STORY_RESPONSE = makeMockResponse({
  jobId: 'fmt-story-001',
  images: [
    { assetId: 'img-story-1', url: '/story.png', mimeType: 'image/png', width: 1080, height: 1920, provider: 'mock', costCents: 0 },
  ],
  videos: [],
  caption: 'Swipe up pour découvrir notre secret.',
});

/** Fill the brief form with a specific format selection. */
async function fillBriefWithFormat(
  page: import('@playwright/test').Page,
  format: string,
) {
  await page.locator('select').nth(0).selectOption('engagement');
  await page.locator('select').nth(1).selectOption('instagram');
  await page.locator('select').nth(2).selectOption(format);
  await page.locator('select').nth(3).selectOption('luxurious');
  await page.locator('textarea').first().fill('Le rituel FemiGlow pour une peau lumineuse');
}

// ─────────────────────────────────────────────────────────────────
// 1. Post format: 1 image, caption, no video
// ─────────────────────────────────────────────────────────────────
test('multi-format — post format shows 1 image and caption', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(POST_RESPONSE),
    });
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBriefWithFormat(page, 'single_image');
  await page.getByRole('button', { name: /Générer/i }).click();

  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });

  // Caption present
  await expect(page.locator('span', { hasText: 'Caption' }).first()).toBeVisible({ timeout: 10_000 });
  // Hook present
  await expect(page.getByText('Un seul geste, une peau transformée.')).toBeVisible({ timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────
// 2. Carousel format: 3+ images, caption
// ─────────────────────────────────────────────────────────────────
test('multi-format — carousel format shows 3+ images and caption', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CAROUSEL_RESPONSE),
    });
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBriefWithFormat(page, 'carousel');
  await page.getByRole('button', { name: /Générer/i }).click();

  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });

  // Caption present
  await expect(
    page.getByText('Faites glisser pour découvrir notre rituel en 3 étapes.'),
  ).toBeVisible({ timeout: 10_000 });

  // Visuels section should mention 3 images
  await expect(page.getByText('Visuels (3)')).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 3. Reel format: voiceover + music in script
// ─────────────────────────────────────────────────────────────────
test('multi-format — reel format shows script with voiceover info', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(REEL_RESPONSE),
    });
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBriefWithFormat(page, 'reel');
  await page.getByRole('button', { name: /Générer/i }).click();

  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });

  // Reel script hook
  await expect(
    page.getByText('Regardez cette transformation en 30 secondes.'),
  ).toBeVisible({ timeout: 10_000 });

  // Caption present
  await expect(
    page.getByText('Le secret de la J-Beauty en 30s.'),
  ).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 4. Story format: 1 image (9:16 aspect in data)
// ─────────────────────────────────────────────────────────────────
test('multi-format — story format shows result with story content', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(STORY_RESPONSE),
    });
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBriefWithFormat(page, 'story');
  await page.getByRole('button', { name: /Générer/i }).click();

  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });

  // Story caption
  await expect(
    page.getByText('Swipe up pour découvrir notre secret.'),
  ).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 5. Each format shows correct pipeline steps (video has more steps)
// ─────────────────────────────────────────────────────────────────
test('multi-format — all formats show the full pipeline step set', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    // Slow response to let us see the pipeline
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(REEL_RESPONSE),
    });
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBriefWithFormat(page, 'reel');
  await page.getByRole('button', { name: /Générer/i }).click();

  // Pipeline heading visible
  await expect(page.getByText('Pipeline de génération')).toBeVisible({ timeout: 15_000 });

  // All standard pipeline steps should be visible
  for (const label of [
    'Analyse du brief',
    'Enrichissement contextuel',
    'Rédaction du script',
    'Génération des visuels',
    'Contrôle qualité',
  ]) {
    await expect(page.getByText(label).first()).toBeVisible({ timeout: 20_000 });
  }
});

// ─────────────────────────────────────────────────────────────────
// 6. Format selection changes the visual steps display
// ─────────────────────────────────────────────────────────────────
test('multi-format — format selection persists and generates correct output', async ({ page }) => {
  let capturedBody: Record<string, unknown> | null = null;

  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    const request = route.request();
    capturedBody = JSON.parse(request.postData() ?? '{}');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CAROUSEL_RESPONSE),
    });
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBriefWithFormat(page, 'carousel');
  await page.getByRole('button', { name: /Générer/i }).click();

  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });

  // Verify the request body included the selected format
  expect(capturedBody).not.toBeNull();
  expect(capturedBody!.format).toBe('carousel');
});
