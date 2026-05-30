/**
 * AI Engine — Error Recovery scenario (serial).
 *
 * Tests the flow: Fill form -> Error -> Retry -> Success.
 * Uses page.route() to mock the generate API with controlled failures
 * then success.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

const MOCK_SUCCESS_RESPONSE = {
  jobId: 'recovery-job-002',
  status: 'completed',
  script: {
    hook: 'Recovered content hook',
    scenes: [{ sceneNumber: 1, description: 'Recovery scene' }],
    cta: 'Recovery CTA',
  },
  caption: 'Recovered caption for FemiGlow',
  hashtags: ['femiglow', 'recovered'],
  images: [],
  videos: [],
  qualityScores: { text_quality: 0.85, average: 0.85 },
  moderationResult: { safe: true, flags: [], canRetry: false },
  costTracking: { totalCents: 0.10, breakdown: {}, tokensUsed: {} },
  errors: [],
  durationMs: 3000,
  bridgeResult: { ideaId: 'ci_rec', briefId: 'cb_rec', draftId: 'cd_rec' },
  contentStudioUrl: '/admin/content-studio-v2/library?highlight=cd_rec',
};

test.describe.serial('Error Recovery: Fail -> Retry -> Success', () => {
  let sharedPage: import('@playwright/test').Page;
  let callCount = 0;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: ADMIN_STORAGE_PATH });
    sharedPage = await context.newPage();

    // Mock: first call returns 500, second call returns success.
    await sharedPage.route('**/api/admin/ai-engine/generate', async (route) => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Le service LLM est temporairement indisponible' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_SUCCESS_RESPONSE),
        });
      }
    });
  });

  test.afterAll(async () => {
    await sharedPage.context().close();
  });

  // 1. Navigate to create page
  test('navigate to create page', async () => {
    await gotoAIEngine(sharedPage, 'create');
    ensureAuthOrSkip(sharedPage);

    await expect(
      sharedPage.getByRole('heading', { name: /Nouvelle génération/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  // 2. Fill brief form
  test('fill brief form', async () => {
    await expect(sharedPage.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });

    await sharedPage.locator('select').nth(0).selectOption('awareness');
    await sharedPage.locator('select').nth(1).selectOption('tiktok');
    await sharedPage.locator('select').nth(2).selectOption('reel');
    await sharedPage.locator('select').nth(3).selectOption('empowering');
    await sharedPage.locator('textarea').first().fill('Routine J-Beauty en 3 etapes');

    const genButton = sharedPage.getByRole('button', { name: /Générer/i });
    await expect(genButton).toBeEnabled({ timeout: 5_000 });
  });

  // 3. Mock generate API returns 500 (implicit via callCount)
  test('mock generate API is configured to fail first', async () => {
    // This verifies our mock is set up — callCount should be 0 before any call.
    expect(callCount).toBe(0);
  });

  // 4. Click "Générer"
  test('click "Générer" — triggers first (failing) call', async () => {
    const genButton = sharedPage.getByRole('button', { name: /Générer/i });
    await genButton.click();

    // Wait for error to appear (the fetch returns 500).
    await expect(sharedPage.getByText('Erreur de génération')).toBeVisible({ timeout: 15_000 });
  });

  // 5. Verify error phase shows
  test('error phase is visible', async () => {
    await expect(sharedPage.getByText('Erreur de génération')).toBeVisible({ timeout: 5_000 });
  });

  // 6. Verify error message is displayed
  test('error message is displayed', async () => {
    await expect(
      sharedPage.getByText('Le service LLM est temporairement indisponible'),
    ).toBeVisible({ timeout: 5_000 });
  });

  // 7. Click "Réessayer"
  test('click "Réessayer"', async () => {
    const retryButton = sharedPage.getByRole('button', { name: /Réessayer/i });
    await expect(retryButton).toBeVisible({ timeout: 5_000 });
    await retryButton.click();
  });

  // 8. Mock generate API returns success (implicit — second call)
  test('second call to generate succeeds', async () => {
    // After clicking retry, the second call should succeed.
    // Wait for the pipeline to appear (proves the fetch was re-triggered).
    await expect(
      sharedPage.getByText('Pipeline de génération').or(sharedPage.getByText('Contenu généré')),
    ).toBeVisible({ timeout: 15_000 });
  });

  // 9. Verify generating phase starts
  test('generating phase starts after retry', async () => {
    // Either pipeline is still visible or it already transitioned to result.
    const pipeline = sharedPage.getByText('Pipeline de génération');
    const result = sharedPage.getByText('Contenu généré');
    await expect(pipeline.or(result)).toBeVisible({ timeout: 15_000 });
  });

  // 10. Verify result phase shows after retry
  test('result phase shows after retry', async () => {
    await expect(sharedPage.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });
    await expect(sharedPage.getByText('Recovered content hook')).toBeVisible({ timeout: 10_000 });
    expect(callCount).toBe(2);
  });
});
