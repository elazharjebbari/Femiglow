/**
 * AI Engine — Budget guard E2E tests.
 *
 * Tests budget enforcement by mocking the generate API to return
 * budget-exceeded errors, and the health API to show near-limit budget.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip, disableHumanReview } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

const MOCK_GENERATE_OK = {
  jobId: 'budget-job-ok',
  status: 'completed',
  script: {
    hook: 'Budget test hook',
    scenes: [{ sceneNumber: 1, description: 'Budget test scene' }],
    cta: 'Budget CTA',
    voiceoverRequired: false,
    musicRequired: false,
    visualDirection: [],
  },
  caption: 'Budget test caption',
  hashtags: ['femiglow', 'budget'],
  images: [
    { assetId: 'img-b-1', url: '/budget.png', mimeType: 'image/png', width: 1080, height: 1080, provider: 'mock', costCents: 0 },
  ],
  videos: [],
  qualityScores: { text_quality: 0.9, visual_quality: 0.8, brand_compliance: 0.95, average: 0.88 },
  moderationResult: { safe: true, flags: [], canRetry: false },
  costTracking: { totalCents: 0.10, breakdown: { generate_script: 0.05, generate_caption: 0.05 }, tokensUsed: {} },
  errors: [],
  durationMs: 3000,
  bridgeResult: { ideaId: 'ci_b', briefId: 'cb_b', draftId: 'cd_b' },
  contentStudioUrl: '/admin/content-studio-v2/library?highlight=cd_b',
};

/** Fill the brief form fields. */
async function fillBrief(page: import('@playwright/test').Page) {
  await page.locator('select').nth(0).selectOption('engagement');
  await page.locator('select').nth(1).selectOption('instagram');
  await page.locator('select').nth(2).selectOption('carousel');
  await page.locator('select').nth(3).selectOption('luxurious');
  await page.locator('textarea').first().fill('Le rituel FemiGlow budget test');
}

// ─────────────────────────────────────────────────────────────────
// 1. Budget exceeded error shown when API returns 429
// ─────────────────────────────────────────────────────────────────
test('budget-guard — error message shows "Budget quotidien dépassé"', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Budget quotidien dépassé. Limite: 10.00 MAD',
      }),
    });
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  // Error phase should show
  await expect(page.getByText('Erreur de génération')).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByText(/Budget quotidien dépassé/),
  ).toBeVisible({ timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────
// 2. Error with budget exceeded shows error text
// ─────────────────────────────────────────────────────────────────
test('budget-guard — budget error shows limit amount', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Budget quotidien dépassé. Limite: 10.00 MAD',
      }),
    });
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  await expect(page.getByText('Erreur de génération')).toBeVisible({ timeout: 15_000 });
  // The full error message should include the limit
  await expect(page.getByText('10.00 MAD')).toBeVisible({ timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────
// 3. Error phase is displayed (not generating phase)
// ─────────────────────────────────────────────────────────────────
test('budget-guard — error phase is displayed, not generating phase', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Budget quotidien dépassé. Limite: 10.00 MAD',
      }),
    });
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  // Error heading should show
  await expect(page.getByText('Erreur de génération')).toBeVisible({ timeout: 15_000 });

  // Pipeline progress should NOT be visible in error phase
  await expect(page.getByText('Pipeline de génération')).not.toBeVisible();
});

// ─────────────────────────────────────────────────────────────────
// 4. Retry button is available on budget error
// ─────────────────────────────────────────────────────────────────
test('budget-guard — retry button is available on budget error', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Budget quotidien dépassé. Limite: 10.00 MAD',
      }),
    });
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  await expect(page.getByText('Erreur de génération')).toBeVisible({ timeout: 15_000 });

  // Retry button should be present
  await expect(
    page.getByRole('button', { name: /Réessayer/i }),
  ).toBeVisible({ timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────
// 5. User can modify brief and try again after budget error
// ─────────────────────────────────────────────────────────────────
test('budget-guard — user can modify brief and try again', async ({ page }) => {
  let callCount = 0;

  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    callCount++;
    if (callCount === 1) {
      // First call: budget exceeded
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Budget quotidien dépassé. Limite: 10.00 MAD',
        }),
      });
    } else {
      // Second call: success
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_GENERATE_OK),
      });
    }
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  // HITL ON par défaut : on le désactive pour atteindre la phase « Contenu généré ».
  await disableHumanReview(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  // Error should show first
  await expect(page.getByText('Erreur de génération')).toBeVisible({ timeout: 15_000 });

  // Click "Modifier le brief"
  await page.getByRole('button', { name: /Modifier le brief/i }).click();

  // Should go back to brief phase
  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });

  // Modify the message and try again
  await page.locator('textarea').first().fill('Le rituel FemiGlow avec budget réduit');
  await page.getByRole('button', { name: /Générer/i }).click();

  // Now the second call succeeds
  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });
  expect(callCount).toBe(2);
});

// ─────────────────────────────────────────────────────────────────
// 6. Dashboard shows budget warning when near limit (90% budget used)
// ─────────────────────────────────────────────────────────────────
test('budget-guard — dashboard shows budget bars with high usage', async ({ page }) => {
  // Mock the health endpoint to show 90% budget used
  await page.route('**/api/admin/ai-engine/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        enabled: true,
        providers: {
          text: { name: 'Texte', provider: 'openai', model: 'gpt-4o-mini', status: 'active' },
          image: { name: 'Images', provider: 'openai', model: 'dall-e-3', status: 'active' },
          video: { name: 'Vidéo', provider: 'mock', model: 'mock', status: 'active' },
          tts: { name: 'TTS', provider: 'mock', model: 'mock', status: 'active' },
        },
        budget: {
          dailyUsedCents: 900,
          dailyLimitCents: 1000,
          monthlyUsedCents: 2700,
          monthlyLimitCents: 3000,
        },
      }),
    });
  });

  await gotoAIEngine(page);
  ensureAuthOrSkip(page);

  // Dashboard should load with budget section
  await expect(page.getByText('Consommation budget')).toBeVisible({ timeout: 15_000 });

  // Budget bars should show the values — daily: 9.00 / 10.00 MAD
  await expect(page.getByText('9.00 / 10.00 MAD')).toBeVisible({ timeout: 10_000 });
  // Monthly: 27.00 / 30.00 MAD
  await expect(page.getByText('27.00 / 30.00 MAD')).toBeVisible({ timeout: 10_000 });
});
