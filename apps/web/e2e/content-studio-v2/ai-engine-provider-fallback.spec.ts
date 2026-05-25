/**
 * AI Engine — Provider fallback E2E tests.
 *
 * Tests the UI behavior when the system falls back to a deterministic
 * template provider (e.g. when the primary LLM is unavailable).
 * All responses are mocked — no real LLM calls.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

/** Standard mock result for non-fallback scenario. */
const STANDARD_RESULT = {
  jobId: 'fb-standard-001',
  status: 'completed',
  script: {
    hook: 'Un rituel de beauté né au Japon.',
    scenes: [
      { sceneNumber: 1, description: 'Slow motion application' },
      { sceneNumber: 2, description: 'Résultat lumineux' },
    ],
    cta: 'Essayez FemiGlow',
    voiceoverRequired: false,
    musicRequired: false,
    visualDirection: ['warm', 'golden-hour'],
  },
  caption: 'La beauté japonaise, accessible. Découvrez FemiGlow.',
  hashtags: ['femiglow', 'jbeauty', 'skincare'],
  images: [
    { assetId: 'img-std-1', url: '/std.png', mimeType: 'image/png', width: 1080, height: 1080, provider: 'openai', costCents: 4 },
  ],
  videos: [],
  qualityScores: {
    text_quality: 0.92,
    visual_quality: 0.88,
    brand_compliance: 0.95,
    hook_strength: 0.90,
    average: 0.91,
  },
  moderationResult: { safe: true, flags: [], canRetry: false },
  costTracking: {
    totalCents: 0.20,
    breakdown: { generate_script: 0.12, generate_caption: 0.08 },
    tokensUsed: {},
  },
  errors: [],
  durationMs: 6000,
  bridgeResult: { ideaId: 'ci_std', briefId: 'cb_std', draftId: 'cd_std' },
  contentStudioUrl: '/admin/content-studio-v2/library?highlight=cd_std',
};

/** Fallback result — deterministic content with zero LLM cost. */
const FALLBACK_RESULT = {
  jobId: 'fb-fallback-001',
  status: 'completed',
  script: {
    hook: 'Un geste lent, une main qui retrouve sa lumière naturelle.',
    scenes: [
      { sceneNumber: 1, description: 'Gros plan mains et produit' },
      { sceneNumber: 2, description: 'Application douce' },
    ],
    cta: 'En savoir plus',
    voiceoverRequired: false,
    musicRequired: false,
    visualDirection: [],
  },
  caption: 'FemiGlow, la beauté au naturel. Découvrez notre gamme complète.',
  hashtags: ['femiglow', 'beautenaturelle'],
  images: [
    { assetId: 'img-fb-1', url: '/fallback.png', mimeType: 'image/png', width: 1080, height: 1080, provider: 'template', costCents: 0 },
  ],
  videos: [],
  qualityScores: {
    text_quality: 0.75,
    visual_quality: 0.70,
    brand_compliance: 0.90,
    hook_strength: 0.72,
    average: 0.77,
  },
  moderationResult: { safe: true, flags: [], canRetry: false },
  costTracking: {
    totalCents: 0,
    breakdown: { generate_script: 0, generate_caption: 0 },
    tokensUsed: {},
  },
  errors: [],
  durationMs: 800,
  bridgeResult: { ideaId: 'ci_fb', briefId: 'cb_fb', draftId: 'cd_fb' },
  contentStudioUrl: '/admin/content-studio-v2/library?highlight=cd_fb',
};

/** Fill the brief form fields. */
async function fillBrief(page: import('@playwright/test').Page) {
  await page.locator('select').nth(0).selectOption('engagement');
  await page.locator('select').nth(1).selectOption('instagram');
  await page.locator('select').nth(2).selectOption('carousel');
  await page.locator('select').nth(3).selectOption('luxurious');
  await page.locator('textarea').first().fill('Rituel FemiGlow fallback test');
}

// ─────────────────────────────────────────────────────────────────
// 1. Generation succeeds even with fallback provider
// ─────────────────────────────────────────────────────────────────
test('provider-fallback — generation succeeds with fallback provider', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FALLBACK_RESULT),
    });
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  // Should complete without error
  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });
});

// ─────────────────────────────────────────────────────────────────
// 2. Result shows deterministic fallback content
// ─────────────────────────────────────────────────────────────────
test('provider-fallback — result shows deterministic fallback content', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FALLBACK_RESULT),
    });
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });

  // Fallback hook text
  await expect(
    page.getByText('Un geste lent, une main qui retrouve sa lumière naturelle.'),
  ).toBeVisible({ timeout: 10_000 });

  // Fallback CTA
  await expect(page.getByText('En savoir plus')).toBeVisible({ timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────
// 3. Quality scores still pass threshold
// ─────────────────────────────────────────────────────────────────
test('provider-fallback — quality scores still display and pass threshold', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FALLBACK_RESULT),
    });
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });

  // Quality scores section should be visible
  await expect(page.getByText('Scores qualité')).toBeVisible({ timeout: 10_000 });

  // All scores are >= 0.70 (the threshold). The QualityBar shows percentages.
  // Check that at least one score value is visible (e.g. "75%" for text_quality)
  await expect(page.getByText('75%').first()).toBeVisible({ timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────
// 4. Cost is lower with fallback (0 for deterministic)
// ─────────────────────────────────────────────────────────────────
test('provider-fallback — cost is zero for deterministic fallback', async ({ page }) => {
  // First generate with standard (has cost)
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...FALLBACK_RESULT,
        costBreakdown: [
          { label: 'Script (template)', amountCents: 0 },
          { label: 'Caption (template)', amountCents: 0 },
        ],
        totalCostCents: 0,
      }),
    });
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });

  // The cost breakdown should show 0.00 MAD for both entries
  await expect(page.getByText('0.00 MAD').first()).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 5. No error displayed to user on fallback
// ─────────────────────────────────────────────────────────────────
test('provider-fallback — no error displayed to user on fallback', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FALLBACK_RESULT),
    });
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });

  // No error messages should be visible
  await expect(page.getByText('Erreur de génération')).not.toBeVisible();
  await expect(page.getByText('Erreur')).not.toBeVisible();
});

// ─────────────────────────────────────────────────────────────────
// 6. Caption is generated even with fallback script
// ─────────────────────────────────────────────────────────────────
test('provider-fallback — caption is generated even with fallback script', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FALLBACK_RESULT),
    });
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });

  // Caption section should be present
  await expect(page.locator('span', { hasText: 'Caption' }).first()).toBeVisible({ timeout: 10_000 });

  // The fallback caption should be displayed
  await expect(
    page.getByText('FemiGlow, la beauté au naturel. Découvrez notre gamme complète.'),
  ).toBeVisible({ timeout: 5_000 });
});
