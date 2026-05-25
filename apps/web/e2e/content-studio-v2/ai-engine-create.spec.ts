/**
 * AI Engine — Create (generation wizard) E2E tests.
 *
 * Uses page.route() to mock the generate API so tests never hit the
 * real LLM, avoiding cost and flakiness.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

const MOCK_GENERATE_RESPONSE = {
  jobId: 'test-job-123',
  status: 'completed',
  script: {
    hook: 'Test hook',
    scenes: [{ sceneNumber: 1, description: 'Test scene' }],
    cta: 'Test CTA',
    voiceoverRequired: false,
    musicRequired: false,
    visualDirection: [],
  },
  caption: 'Test caption for FemiGlow',
  hashtags: ['femiglow', 'jbeauty', 'test'],
  images: [
    {
      assetId: 'img-1',
      url: '/test.png',
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
    visual_quality: 0.8,
    brand_compliance: 0.95,
    hook_strength: 0.85,
    average: 0.88,
  },
  moderationResult: { safe: true, flags: [], canRetry: false },
  costTracking: {
    totalCents: 0.15,
    breakdown: { generate_script: 0.08, generate_caption: 0.07 },
    tokensUsed: {},
  },
  errors: [],
  durationMs: 5000,
  bridgeResult: { ideaId: 'ci_test', briefId: 'cb_test', draftId: 'cd_test' },
  contentStudioUrl: '/admin/content-studio-v2/library?highlight=cd_test',
};

/** Set up the mock route for generate API. */
async function mockGenerateAPI(page: import('@playwright/test').Page, response = MOCK_GENERATE_RESPONSE) {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/** Fill all required brief fields. */
async function fillBrief(page: import('@playwright/test').Page) {
  await page.locator('select').nth(0).selectOption('engagement');   // Objectif
  await page.locator('select').nth(1).selectOption('instagram');    // Plateforme
  await page.locator('select').nth(2).selectOption('carousel');     // Format
  await page.locator('select').nth(3).selectOption('luxurious');    // Ton
  await page.locator('textarea').first().fill('Le rituel FemiGlow');
}

// ─────────────────────────────────────────────────────────────────
// 1. Form loads with all 7 fields
// ─────────────────────────────────────────────────────────────────
test('create — form loads with all 7 fields', async ({ page }) => {
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });

  // 5 required fields
  for (const label of ['Objectif', 'Plateforme', 'Format', 'Ton', 'Message clé']) {
    await expect(
      page.locator('.cs-input-field label', { hasText: label }).first(),
    ).toBeVisible();
  }

  // 2 optional fields
  for (const label of ['Focus produit', 'Référence tendance']) {
    await expect(
      page.locator('.cs-input-field label', { hasText: label }).first(),
    ).toBeVisible();
  }
});

// ─────────────────────────────────────────────────────────────────
// 2. Required field validation
// ─────────────────────────────────────────────────────────────────
test('create — "Générer" button is disabled when required fields are empty', async ({ page }) => {
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });

  const genButton = page.getByRole('button', { name: /Générer/i });
  await expect(genButton).toBeVisible();
  await expect(genButton).toBeDisabled();
});

// ─────────────────────────────────────────────────────────────────
// 3. Optional fields accept input
// ─────────────────────────────────────────────────────────────────
test('create — optional fields (productFocus, trendReference) accept input', async ({ page }) => {
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });

  // Focus produit input
  const productInput = page.locator('input[type="text"]').first();
  await productInput.fill('Tsubaki Oil Serum');
  await expect(productInput).toHaveValue('Tsubaki Oil Serum');

  // Référence tendance input
  const trendInput = page.locator('input[type="text"]').nth(1);
  await trendInput.fill('#JBeautyRoutine');
  await expect(trendInput).toHaveValue('#JBeautyRoutine');
});

// ─────────────────────────────────────────────────────────────────
// 4. Clicking "Générer" with mock shows pipeline progress steps
// ─────────────────────────────────────────────────────────────────
test('create — clicking "Générer" with mock shows pipeline progress', async ({ page }) => {
  await mockGenerateAPI(page);
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);

  const genButton = page.getByRole('button', { name: /Générer/i });
  await expect(genButton).toBeEnabled({ timeout: 5_000 });
  await genButton.click();

  // Pipeline progress should appear.
  await expect(page.getByText('Pipeline de génération')).toBeVisible({ timeout: 15_000 });
});

// ─────────────────────────────────────────────────────────────────
// 5. Pipeline steps transition from pending to done
// ─────────────────────────────────────────────────────────────────
test('create — pipeline steps transition from pending to done', async ({ page }) => {
  await mockGenerateAPI(page);
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);

  await page.getByRole('button', { name: /Générer/i }).click();

  // Wait for the pipeline to show step labels.
  await expect(page.getByText('Analyse du brief')).toBeVisible({ timeout: 15_000 });

  // Eventually all steps should complete and the result should show.
  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });
});

// ─────────────────────────────────────────────────────────────────
// 6. Result phase shows hook text
// ─────────────────────────────────────────────────────────────────
test('create — result phase shows hook text', async ({ page }) => {
  await mockGenerateAPI(page);
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });

  // Hook text from mock
  await expect(page.getByText('Hook')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Test hook')).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 7. Result phase shows caption
// ─────────────────────────────────────────────────────────────────
test('create — result phase shows caption', async ({ page }) => {
  await mockGenerateAPI(page);
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Caption')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Test caption for FemiGlow')).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 8. Result phase shows hashtag badges
// ─────────────────────────────────────────────────────────────────
test('create — result phase shows hashtag badges', async ({ page }) => {
  await mockGenerateAPI(page);
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });

  // Hashtag badges
  await expect(page.getByText('#femiglow')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('#jbeauty')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('#test')).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 9. Result phase shows quality scores
// ─────────────────────────────────────────────────────────────────
test('create — result phase shows quality scores', async ({ page }) => {
  await mockGenerateAPI(page);
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Scores qualité')).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 10. Result phase shows "Voir dans la Bibliothèque" link
// ─────────────────────────────────────────────────────────────────
test('create — result phase shows "Voir dans la Bibliothèque" link', async ({ page }) => {
  await mockGenerateAPI(page);
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });
  await expect(
    page.getByRole('link', { name: /Voir dans la Bibliothèque/i }),
  ).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 11. "Régénérer" button resets to brief phase
// ─────────────────────────────────────────────────────────────────
test('create — "Régénérer" button triggers new generation', async ({ page }) => {
  let callCount = 0;
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    callCount++;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_GENERATE_RESPONSE),
    });
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });

  // Click Régénérer
  const regenButton = page.getByRole('button', { name: /Régénérer/i });
  await expect(regenButton).toBeVisible({ timeout: 10_000 });
  await regenButton.click();

  // Should trigger a second generation (pipeline shows again).
  await expect(page.getByText('Pipeline de génération')).toBeVisible({ timeout: 15_000 });

  // Eventually show result again.
  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });

  // Verify the API was called twice.
  expect(callCount).toBe(2);
});

// ─────────────────────────────────────────────────────────────────
// 12. Error phase shows error message and retry button
// ─────────────────────────────────────────────────────────────────
test('create — error phase shows error message and retry button', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Service LLM indisponible' }),
    });
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  // Error phase
  await expect(page.getByText('Erreur de génération')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Service LLM indisponible')).toBeVisible({ timeout: 5_000 });

  // Retry and "Modifier le brief" buttons present
  await expect(
    page.getByRole('button', { name: /Réessayer/i }),
  ).toBeVisible({ timeout: 5_000 });
  await expect(
    page.getByRole('button', { name: /Modifier le brief/i }),
  ).toBeVisible({ timeout: 5_000 });
});
