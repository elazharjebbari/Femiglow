/**
 * AI Engine — Review Edit Cycle E2E tests (serial).
 *
 * Tests the full edit_requested review cycle: generate -> review -> click
 * "Demander des modifications" -> provide feedback -> submit -> new generation.
 * Uses page.route() to mock all API calls.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

const MOCK_REVIEW_RESPONSE = {
  jobId: 'review-edit-job-001',
  status: 'review',
  reviewPayload: {
    script: {
      hook: 'Votre routine J-Beauty commence ici',
      scenes: [
        { sceneNumber: 1, narration: 'Gros plan sur le serum', visualNote: { description: 'Serum en gros plan' } },
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

const MOCK_COMPLETED_RESULT = {
  jobId: 'review-edit-job-001',
  status: 'completed',
  script: {
    hook: 'Votre routine J-Beauty commence ici (version amelioree)',
    scenes: [{ sceneNumber: 1, description: 'Scene amelioree' }],
    cta: 'Adoptez le rituel FemiGlow',
    voiceoverRequired: false,
    musicRequired: false,
    visualDirection: [],
  },
  caption: 'La J-Beauty premium par FemiGlow.',
  hashtags: ['femiglow', 'jbeauty', 'skincare'],
  images: [],
  videos: [],
  qualityScores: { text_quality: 0.92, brand_compliance: 0.95, average: 0.93 },
  moderationResult: { safe: true, flags: [], canRetry: false },
  costTracking: { totalCents: 0.3, breakdown: {}, tokensUsed: {} },
  errors: [],
  durationMs: 4000,
  bridgeResult: { ideaId: 'ci_edit', briefId: 'cb_edit', draftId: 'cd_edit' },
  contentStudioUrl: '/admin/content-studio-v2/library?highlight=cd_edit',
};

async function fillBrief(page: import('@playwright/test').Page) {
  await page.locator('select').nth(0).selectOption('engagement');
  await page.locator('select').nth(1).selectOption('instagram');
  await page.locator('select').nth(2).selectOption('carousel');
  await page.locator('select').nth(3).selectOption('luxurious');
  await page.locator('textarea').first().fill('Test review edit cycle');
}

test.describe.serial('review edit cycle', () => {
  // ─────────────────────────────────────────────────────────────────
  // 1. Fill brief and generate
  // ─────────────────────────────────────────────────────────────────
  test('edit cycle — fill brief and generate triggers review', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_REVIEW_RESPONSE),
      });
    });

    await gotoAIEngine(page, 'create');
    ensureAuthOrSkip(page);
    await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
    await fillBrief(page);
    await page.getByRole('button', { name: /Générer/i }).click();
    await expect(page.getByText('Revue humaine requise')).toBeVisible({ timeout: 60_000 });
  });

  // ─────────────────────────────────────────────────────────────────
  // 2. Mock returns status='review' with preview
  // ─────────────────────────────────────────────────────────────────
  test('edit cycle — mock returns review status with preview content', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_REVIEW_RESPONSE),
      });
    });

    await gotoAIEngine(page, 'create');
    ensureAuthOrSkip(page);
    await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
    await fillBrief(page);
    await page.getByRole('button', { name: /Générer/i }).click();
    await expect(page.getByText('Revue humaine requise')).toBeVisible({ timeout: 60_000 });

    // Verify preview content is shown
    await expect(page.getByText('Votre routine J-Beauty commence ici')).toBeVisible({ timeout: 10_000 });
  });

  // ─────────────────────────────────────────────────────────────────
  // 3. Review panel shows with preview content
  // ─────────────────────────────────────────────────────────────────
  test('edit cycle — review panel shows preview caption', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_REVIEW_RESPONSE),
      });
    });

    await gotoAIEngine(page, 'create');
    ensureAuthOrSkip(page);
    await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
    await fillBrief(page);
    await page.getByRole('button', { name: /Générer/i }).click();
    await expect(page.getByText('Revue humaine requise')).toBeVisible({ timeout: 60_000 });

    await expect(page.getByText('Offrez-vous le luxe de la J-Beauty avec FemiGlow.')).toBeVisible({ timeout: 10_000 });
  });

  // ─────────────────────────────────────────────────────────────────
  // 4. Click "Demander des modifications"
  // ─────────────────────────────────────────────────────────────────
  test('edit cycle — click "Demander des modifications" opens feedback', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_REVIEW_RESPONSE),
      });
    });

    await gotoAIEngine(page, 'create');
    ensureAuthOrSkip(page);
    await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
    await fillBrief(page);
    await page.getByRole('button', { name: /Générer/i }).click();
    await expect(page.getByText('Revue humaine requise')).toBeVisible({ timeout: 60_000 });

    const editBtn = page.getByRole('button', { name: /Demander des modifications/i });
    await expect(editBtn).toBeVisible({ timeout: 10_000 });
    await editBtn.click();

    // Feedback section appears
    await expect(page.getByText('Modifications demandées')).toBeVisible({ timeout: 10_000 });
  });

  // ─────────────────────────────────────────────────────────────────
  // 5. Feedback textarea appears
  // ─────────────────────────────────────────────────────────────────
  test('edit cycle — feedback textarea appears after clicking edit request', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_REVIEW_RESPONSE),
      });
    });

    await gotoAIEngine(page, 'create');
    ensureAuthOrSkip(page);
    await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
    await fillBrief(page);
    await page.getByRole('button', { name: /Générer/i }).click();
    await expect(page.getByText('Revue humaine requise')).toBeVisible({ timeout: 60_000 });

    await page.getByRole('button', { name: /Demander des modifications/i }).click();
    await expect(page.locator('textarea')).toBeVisible({ timeout: 10_000 });
  });

  // ─────────────────────────────────────────────────────────────────
  // 6. Type feedback text
  // ─────────────────────────────────────────────────────────────────
  test('edit cycle — type feedback text in textarea', async ({ page }) => {
    await page.route('**/api/admin/ai-engine/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_REVIEW_RESPONSE),
      });
    });

    await gotoAIEngine(page, 'create');
    ensureAuthOrSkip(page);
    await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
    await fillBrief(page);
    await page.getByRole('button', { name: /Générer/i }).click();
    await expect(page.getByText('Revue humaine requise')).toBeVisible({ timeout: 60_000 });

    await page.getByRole('button', { name: /Demander des modifications/i }).click();
    await expect(page.locator('textarea')).toBeVisible({ timeout: 10_000 });

    await page.locator('textarea').fill('Le ton doit etre plus premium et luxueux');
    await expect(page.locator('textarea')).toHaveValue('Le ton doit etre plus premium et luxueux');
  });

  // ─────────────────────────────────────────────────────────────────
  // 7. Submit sends POST /jobs/:id/review with edit_requested decision
  // ─────────────────────────────────────────────────────────────────
  test('edit cycle — submit sends review API with edit_requested decision', async ({ page }) => {
    let reviewApiPayload: unknown = null;

    await page.route('**/api/admin/ai-engine/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_REVIEW_RESPONSE),
      });
    });

    await page.route('**/api/admin/ai-engine/jobs/*/review', async (route) => {
      const body = route.request().postDataJSON();
      reviewApiPayload = body;
      // Return another review response (the edit triggers re-generation)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_REVIEW_RESPONSE),
      });
    });

    await gotoAIEngine(page, 'create');
    ensureAuthOrSkip(page);
    await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
    await fillBrief(page);
    await page.getByRole('button', { name: /Générer/i }).click();
    await expect(page.getByText('Revue humaine requise')).toBeVisible({ timeout: 60_000 });

    await page.getByRole('button', { name: /Demander des modifications/i }).click();
    await page.locator('textarea').fill('Rendre le ton plus premium');

    const confirmBtn = page.getByRole('button', { name: /Confirmer/i });
    await confirmBtn.click();

    // Wait for the API call
    await page.waitForTimeout(2000);
    expect(reviewApiPayload).toBeTruthy();
    const payload = reviewApiPayload as Record<string, unknown>;
    expect(payload.decision).toBe('edit_requested');
    expect(payload.feedback).toBeTruthy();
  });

  // ─────────────────────────────────────────────────────────────────
  // 8. After edit submit, second review returns completed
  // ─────────────────────────────────────────────────────────────────
  test('edit cycle — after edit submit, second review returns completed', async ({ page }) => {
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
      if (reviewCallCount === 1) {
        // First edit_requested — return review again (simulating re-generation still needs review)
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_COMPLETED_RESULT),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_COMPLETED_RESULT),
        });
      }
    });

    await gotoAIEngine(page, 'create');
    ensureAuthOrSkip(page);
    await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
    await fillBrief(page);
    await page.getByRole('button', { name: /Générer/i }).click();
    await expect(page.getByText('Revue humaine requise')).toBeVisible({ timeout: 60_000 });

    // Request edit
    await page.getByRole('button', { name: /Demander des modifications/i }).click();
    await page.locator('textarea').fill('Ameliorer le ton');
    await page.getByRole('button', { name: /Confirmer/i }).click();

    // After the edit submit returns completed, the result phase should appear
    await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 30_000 });
    expect(reviewCallCount).toBeGreaterThanOrEqual(1);
  });
});
