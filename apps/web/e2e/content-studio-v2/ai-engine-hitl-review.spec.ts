/**
 * AI Engine — HITL (Human-In-The-Loop) Review cycle E2E tests.
 *
 * Uses page.route() to mock the generate API returning status='review'
 * with a reviewPayload, and the review decision API.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

const MOCK_REVIEW_RESPONSE = {
  jobId: 'review-job-001',
  status: 'review',
  reviewPayload: {
    script: {
      hook: 'Votre routine J-Beauty commence ici',
      scenes: [
        { sceneNumber: 1, narration: 'Gros plan sur le serum', visualNote: { description: 'Serum en gros plan' } },
        { sceneNumber: 2, narration: 'Application sur le visage' },
      ],
      cta: 'Adoptez le rituel FemiGlow',
    },
    caption: 'Offrez-vous le luxe de la J-Beauty avec FemiGlow.',
    hashtags: ['femiglow', 'jbeauty', 'skincare'],
    images: [],
    videos: [],
    qualityScores: {
      text_quality: 0.85,
      brand_compliance: 0.9,
      hook_strength: 0.82,
      average: 0.86,
    },
    moderationResult: { safe: true, flags: [] },
  },
  totalCostCents: 0.15,
};

const MOCK_APPROVED_RESULT = {
  jobId: 'review-job-001',
  status: 'completed',
  script: {
    hook: 'Votre routine J-Beauty commence ici',
    scenes: [{ sceneNumber: 1, description: 'Scene approved' }],
    cta: 'Adoptez le rituel FemiGlow',
    voiceoverRequired: false,
    musicRequired: false,
    visualDirection: [],
  },
  caption: 'Offrez-vous le luxe de la J-Beauty avec FemiGlow.',
  hashtags: ['femiglow', 'jbeauty', 'skincare'],
  images: [],
  videos: [],
  qualityScores: { text_quality: 0.85, brand_compliance: 0.9, average: 0.86 },
  moderationResult: { safe: true, flags: [], canRetry: false },
  costTracking: { totalCents: 0.2, breakdown: {}, tokensUsed: {} },
  errors: [],
  durationMs: 4000,
  bridgeResult: { ideaId: 'ci_review', briefId: 'cb_review', draftId: 'cd_review' },
  contentStudioUrl: '/admin/content-studio-v2/library?highlight=cd_review',
};

async function fillBrief(page: import('@playwright/test').Page) {
  await page.locator('select').nth(0).selectOption('engagement');
  await page.locator('select').nth(1).selectOption('instagram');
  await page.locator('select').nth(2).selectOption('carousel');
  await page.locator('select').nth(3).selectOption('luxurious');
  await page.locator('textarea').first().fill('Test review cycle');
}

async function triggerReviewGeneration(page: import('@playwright/test').Page) {
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);
  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  await page.getByRole('button', { name: /Générer/i }).click();
  // Wait for review panel to appear
  await expect(page.getByText('Revue humaine requise')).toBeVisible({ timeout: 60_000 });
}

// ─────────────────────────────────────────────────────────────────
// 1. Generation with review status shows review panel
// ─────────────────────────────────────────────────────────────────
test('hitl — generation with review status shows review panel', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_REVIEW_RESPONSE),
    });
  });

  await triggerReviewGeneration(page);
  await expect(page.getByText('Revue humaine requise')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────
// 2. Review panel shows script preview
// ─────────────────────────────────────────────────────────────────
test('hitl — review panel shows script preview', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_REVIEW_RESPONSE),
    });
  });

  await triggerReviewGeneration(page);
  await expect(page.getByText('Votre routine J-Beauty commence ici')).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 3. Review panel shows caption preview
// ─────────────────────────────────────────────────────────────────
test('hitl — review panel shows caption preview', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_REVIEW_RESPONSE),
    });
  });

  await triggerReviewGeneration(page);
  await expect(page.getByText('Offrez-vous le luxe de la J-Beauty avec FemiGlow.')).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 4. Review panel shows quality scores
// ─────────────────────────────────────────────────────────────────
test('hitl — review panel shows quality scores', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_REVIEW_RESPONSE),
    });
  });

  await triggerReviewGeneration(page);
  await expect(page.getByText('Scores qualité')).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 5. "Approuver" button is visible
// ─────────────────────────────────────────────────────────────────
test('hitl — "Approuver" button is visible', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_REVIEW_RESPONSE),
    });
  });

  await triggerReviewGeneration(page);
  await expect(page.getByRole('button', { name: /Approuver/i })).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 6. "Rejeter" button shows feedback textarea
// ─────────────────────────────────────────────────────────────────
test('hitl — "Rejeter" button shows feedback textarea', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_REVIEW_RESPONSE),
    });
  });

  await triggerReviewGeneration(page);

  const rejectBtn = page.getByRole('button', { name: /Rejeter/i });
  await expect(rejectBtn).toBeVisible({ timeout: 10_000 });
  await rejectBtn.click();

  await expect(page.getByText('Raison du rejet')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('textarea')).toBeVisible({ timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────
// 7. "Demander des modifications" shows feedback textarea
// ─────────────────────────────────────────────────────────────────
test('hitl — "Demander des modifications" shows feedback textarea', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_REVIEW_RESPONSE),
    });
  });

  await triggerReviewGeneration(page);

  const editBtn = page.getByRole('button', { name: /Demander des modifications/i });
  await expect(editBtn).toBeVisible({ timeout: 10_000 });
  await editBtn.click();

  await expect(page.getByText('Modifications demandées')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('textarea')).toBeVisible({ timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────
// 8. Submitting approval calls review API
// ─────────────────────────────────────────────────────────────────
test('hitl — submitting approval calls review API', async ({ page }) => {
  let reviewApiCalled = false;

  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_REVIEW_RESPONSE),
    });
  });

  await page.route('**/api/admin/ai-engine/jobs/*/review', async (route) => {
    reviewApiCalled = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_APPROVED_RESULT),
    });
  });

  await triggerReviewGeneration(page);

  const approveBtn = page.getByRole('button', { name: /Approuver/i });
  await approveBtn.click();

  // Wait for API call
  await page.waitForTimeout(1500);
  expect(reviewApiCalled).toBe(true);
});

// ─────────────────────────────────────────────────────────────────
// 9. After approval, result phase appears
// ─────────────────────────────────────────────────────────────────
test('hitl — after approval, result phase appears', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_REVIEW_RESPONSE),
    });
  });

  await page.route('**/api/admin/ai-engine/jobs/*/review', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_APPROVED_RESULT),
    });
  });

  await triggerReviewGeneration(page);

  await page.getByRole('button', { name: /Approuver/i }).click();
  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 30_000 });
});

// ─────────────────────────────────────────────────────────────────
// 10. Rejection triggers regeneration (second API call)
// ─────────────────────────────────────────────────────────────────
test('hitl — rejection with feedback calls review API', async ({ page }) => {
  let reviewCallCount = 0;

  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_REVIEW_RESPONSE),
    });
  });

  await page.route('**/api/admin/ai-engine/jobs/*/review', async (route) => {
    reviewCallCount++;
    // On first rejection, return another review cycle
    if (reviewCallCount === 1) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...MOCK_REVIEW_RESPONSE,
          jobId: 'review-job-002',
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_APPROVED_RESULT),
      });
    }
  });

  await triggerReviewGeneration(page);

  // Click reject
  const rejectBtn = page.getByRole('button', { name: /Rejeter/i });
  await rejectBtn.click();

  // Fill in feedback
  await page.locator('textarea').fill('Le ton n\'est pas assez premium');

  // Confirm rejection
  const confirmBtn = page.getByRole('button', { name: /Confirmer/i });
  await confirmBtn.click();

  // Wait for API call
  await page.waitForTimeout(1500);
  expect(reviewCallCount).toBeGreaterThanOrEqual(1);
});
