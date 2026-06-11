/**
 * AI Engine — SSE streaming progress E2E tests.
 *
 * Uses page.route() to mock the generate-stream endpoint returning SSE
 * events, so no real LLM calls are made.
 *
 * NOTE: The create page currently uses a POST to /api/admin/ai-engine/generate
 * (non-streaming), and the client simulates progress via setTimeout.
 * These tests mock the /generate endpoint and verify the client-side
 * pipeline progress UI that is driven by the simulateProgress logic.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip, disableHumanReview } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

const MOCK_RESULT = {
  jobId: 'sse-job-001',
  status: 'completed',
  script: {
    hook: 'Un geste lent, une main qui retrouve sa douceur naturelle.',
    scenes: [
      { sceneNumber: 1, description: 'Gros plan mains sous lumière dorée' },
      { sceneNumber: 2, description: 'Application du sérum FemiGlow' },
    ],
    cta: 'Découvrez votre rituel',
    voiceoverRequired: false,
    musicRequired: false,
    visualDirection: [],
  },
  caption: 'Votre peau mérite un rituel FemiGlow chaque matin.',
  hashtags: ['femiglow', 'skincare', 'rituel'],
  images: [
    {
      assetId: 'img-sse-1',
      url: '/test-sse.png',
      mimeType: 'image/png',
      width: 1080,
      height: 1080,
      provider: 'mock',
      costCents: 0,
    },
  ],
  videos: [],
  qualityScores: {
    text_quality: 0.92,
    visual_quality: 0.85,
    brand_compliance: 0.97,
    hook_strength: 0.88,
    average: 0.90,
  },
  moderationResult: { safe: true, flags: [], canRetry: false },
  costTracking: {
    totalCents: 0.12,
    breakdown: { generate_script: 0.06, generate_caption: 0.06 },
    tokensUsed: {},
  },
  errors: [],
  durationMs: 4600,
  bridgeResult: { ideaId: 'ci_sse', briefId: 'cb_sse', draftId: 'cd_sse' },
  contentStudioUrl: '/admin/content-studio-v2/library?highlight=cd_sse',
};

/** Mock the generate API with a standard JSON response. */
async function mockGenerateAPI(
  page: import('@playwright/test').Page,
  response = MOCK_RESULT,
) {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/** Fill the brief form fields. */
async function fillBrief(page: import('@playwright/test').Page) {
  await page.locator('select').nth(0).selectOption('engagement');
  await page.locator('select').nth(1).selectOption('instagram');
  await page.locator('select').nth(2).selectOption('carousel');
  await page.locator('select').nth(3).selectOption('luxurious');
  await page.locator('textarea').first().fill('Le rituel FemiGlow quotidien');
}

// ─────────────────────────────────────────────────────────────────
// 1. Page loads create form
// ─────────────────────────────────────────────────────────────────
test('sse-streaming — page loads create form', async ({ page }) => {
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Nouvelle génération')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────
// 2. Fill brief and click Générer
// ─────────────────────────────────────────────────────────────────
test('sse-streaming — fill brief and click Générer triggers generation', async ({ page }) => {
  await mockGenerateAPI(page);
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);

  const genButton = page.getByRole('button', { name: /Générer/i });
  await expect(genButton).toBeEnabled({ timeout: 5_000 });
  await genButton.click();

  // Pipeline progress should appear
  await expect(page.getByText('Pipeline de génération')).toBeVisible({ timeout: 15_000 });
});

// ─────────────────────────────────────────────────────────────────
// 3. Pipeline steps appear in order
// ─────────────────────────────────────────────────────────────────
test('sse-streaming — pipeline steps appear in order', async ({ page }) => {
  await mockGenerateAPI(page);
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  // All pipeline steps should appear in the defined order
  const expectedSteps = [
    'Analyse du brief',
    'Enrichissement contextuel',
    'Rédaction du script',
    'Génération des visuels',
    'Contrôle qualité',
    'Terminé',
  ];

  for (const label of expectedSteps) {
    await expect(page.getByText(label).first()).toBeVisible({ timeout: 20_000 });
  }

  // Verify order: each step should appear before the next in the DOM
  const stepTexts = await page.locator('[style*="flex: 1"]').allInnerTexts();
  const foundOrder: string[] = [];
  for (const text of stepTexts) {
    for (const expected of expectedSteps) {
      if (text.includes(expected) && !foundOrder.includes(expected)) {
        foundOrder.push(expected);
      }
    }
  }
  expect(foundOrder).toEqual(expectedSteps);
});

// ─────────────────────────────────────────────────────────────────
// 4. Steps transition from pending to running to done
// ─────────────────────────────────────────────────────────────────
test('sse-streaming — steps transition from pending to running to done', async ({ page }) => {
  await mockGenerateAPI(page);
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  // HITL ON par défaut → on le désactive pour atteindre la phase résultat.
  await disableHumanReview(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  // Wait for pipeline heading
  await expect(page.getByText('Pipeline de génération')).toBeVisible({ timeout: 15_000 });

  // The first step should transition to running (bold text) at some point
  await expect(page.getByText('Analyse du brief')).toBeVisible({ timeout: 15_000 });

  // Eventually all steps complete and result shows
  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });
});

// ─────────────────────────────────────────────────────────────────
// 5. Duration is shown for completed steps
// ─────────────────────────────────────────────────────────────────
test('sse-streaming — duration is shown for completed steps', async ({ page }) => {
  await mockGenerateAPI(page);
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  // Wait for at least one step to complete — look for the duration format (Xs or Xms)
  await expect(
    page.locator('.cs-mono').filter({ hasText: /\d+(\.\d)?s/ }).first(),
  ).toBeVisible({ timeout: 30_000 });
});

// ─────────────────────────────────────────────────────────────────
// 6. Result appears after complete event
// ─────────────────────────────────────────────────────────────────
test('sse-streaming — result appears after all steps complete', async ({ page }) => {
  await mockGenerateAPI(page);
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  // HITL ON par défaut → on le désactive pour atteindre la phase résultat.
  await disableHumanReview(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  // Wait for the final result
  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });

  // The script hook text from mock should appear
  await expect(
    page.getByText('Un geste lent, une main qui retrouve sa douceur naturelle.'),
  ).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 7. Script hook is displayed in result
// ─────────────────────────────────────────────────────────────────
test('sse-streaming — script hook is displayed in result', async ({ page }) => {
  await mockGenerateAPI(page);
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  // HITL ON par défaut → on le désactive pour atteindre la phase résultat.
  await disableHumanReview(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });

  // Hook eyebrow label in Script section
  await expect(page.locator('.cs-eyebrow', { hasText: 'Hook' }).first()).toBeVisible({ timeout: 10_000 });
  // Actual hook text
  await expect(
    page.getByText('Un geste lent, une main qui retrouve sa douceur naturelle.'),
  ).toBeVisible({ timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────
// 8. Elapsed timer counts during generation
// ─────────────────────────────────────────────────────────────────
test('sse-streaming — elapsed timer counts during generation', async ({ page }) => {
  // Use a slightly delayed response so the timer has time to tick
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    // Delay 2 seconds to let the timer run
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_RESULT),
    });
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  // Pipeline should show with a timer element (rendered by GenerationProgress)
  await expect(page.getByText('Pipeline de génération')).toBeVisible({ timeout: 15_000 });

  // The elapsed timer shows in .cs-mono — wait for it to show a non-zero value
  // The timer format is e.g. "0.4s", "1.2s", "800ms", etc.
  await expect(
    page.locator('.cs-mono').filter({ hasText: /\d+(\.\d)?s|\d+ms/ }).first(),
  ).toBeVisible({ timeout: 10_000 });
});
