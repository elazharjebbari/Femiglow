/**
 * AI Engine — Brief Edit & Regeneration flow (serial).
 *
 * Tests the workflow: Fill brief -> Generate -> Regenerate -> Edit brief
 * -> Re-generate with different result. Uses page.route() to mock the
 * generate API with different responses per call.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip, disableHumanReview } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

const FIRST_RESPONSE = {
  jobId: 'regen-job-001',
  status: 'completed',
  script: {
    hook: 'Premier hook FemiGlow',
    scenes: [{ sceneNumber: 1, description: 'Premiere scene' }],
    cta: 'Premier CTA',
  },
  caption: 'Premiere caption FemiGlow',
  hashtags: ['femiglow', 'premier'],
  images: [],
  videos: [],
  qualityScores: { text_quality: 0.85, average: 0.85 },
  moderationResult: { safe: true, flags: [], canRetry: false },
  costTracking: { totalCents: 0.10, breakdown: {}, tokensUsed: {} },
  errors: [],
  durationMs: 3000,
  bridgeResult: { ideaId: 'ci_r1', briefId: 'cb_r1', draftId: 'cd_r1' },
  contentStudioUrl: '/admin/content-studio-v2/library?highlight=cd_r1',
};

const SECOND_RESPONSE = {
  jobId: 'regen-job-002',
  status: 'completed',
  script: {
    hook: 'Deuxieme hook modifie',
    scenes: [{ sceneNumber: 1, description: 'Deuxieme scene' }],
    cta: 'Deuxieme CTA',
  },
  caption: 'Deuxieme caption modifiee',
  hashtags: ['femiglow', 'modifie'],
  images: [],
  videos: [],
  qualityScores: { text_quality: 0.92, average: 0.92 },
  moderationResult: { safe: true, flags: [], canRetry: false },
  costTracking: { totalCents: 0.12, breakdown: {}, tokensUsed: {} },
  errors: [],
  durationMs: 2500,
  bridgeResult: { ideaId: 'ci_r2', briefId: 'cb_r2', draftId: 'cd_r2' },
  contentStudioUrl: '/admin/content-studio-v2/library?highlight=cd_r2',
};

test.describe.serial('Brief Edit & Regeneration flow', () => {
  let sharedPage: import('@playwright/test').Page;
  let callCount = 0;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: ADMIN_STORAGE_PATH });
    sharedPage = await context.newPage();

    // Mock: first call returns FIRST_RESPONSE, second call returns SECOND_RESPONSE.
    await sharedPage.route('**/api/admin/ai-engine/generate', async (route) => {
      callCount++;
      const response = callCount === 1 ? FIRST_RESPONSE : SECOND_RESPONSE;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });
  });

  test.afterAll(async () => {
    await sharedPage.context().close();
  });

  // 1. Fill brief and generate -> result appears
  test('fill brief and generate — first result appears', async () => {
    await gotoAIEngine(sharedPage, 'create');
    ensureAuthOrSkip(sharedPage);

    await expect(sharedPage.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });

    // Fill all required fields
    await sharedPage.locator('select').nth(0).selectOption('engagement');
    await sharedPage.locator('select').nth(1).selectOption('instagram');
    await sharedPage.locator('select').nth(2).selectOption('carousel');
    await sharedPage.locator('select').nth(3).selectOption('luxurious');
    await sharedPage.locator('textarea').first().fill('Rituel beaute japonaise FemiGlow');

    // HITL ON par défaut : on le désactive AVANT le premier « Générer » pour
    // que tout le flux serial (résultat + régénération) atteigne « Contenu généré ».
    await disableHumanReview(sharedPage);

    const genButton = sharedPage.getByRole('button', { name: /Générer/i });
    await expect(genButton).toBeEnabled({ timeout: 5_000 });
    await genButton.click();

    // Wait for the result to appear
    await expect(sharedPage.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });
    await expect(sharedPage.getByText('Premier hook FemiGlow')).toBeVisible({ timeout: 10_000 });
    expect(callCount).toBe(1);
  });

  // 2. Click "Régénérer" -> goes back to brief form
  test('click "Régénérer" — triggers regeneration', async () => {
    const regenButton = sharedPage.getByRole('button', { name: /Régénérer/i });
    await expect(regenButton).toBeVisible({ timeout: 10_000 });
    await regenButton.click();

    // The regeneration should trigger a second call to the API.
    // Wait for either the pipeline or the brief form to appear.
    await expect(
      sharedPage.getByText('Pipeline de génération')
        .or(sharedPage.getByText('Contenu généré'))
        .or(sharedPage.getByText('Brief créatif')),
    ).toBeVisible({ timeout: 15_000 });
  });

  // 3. Brief form still has the previous values filled (or regeneration completed)
  test('previous brief values are preserved or regeneration completes', async () => {
    // After clicking Régénérer, the implementation may either:
    // (a) go back to the brief form with previous values, or
    // (b) directly trigger a new generation with same values.
    // Both are valid. Verify accordingly.
    const briefVisible = await sharedPage.getByText('Brief créatif').isVisible({ timeout: 3_000 }).catch(() => false);

    if (briefVisible) {
      // Verify form values are preserved
      const textareaValue = await sharedPage.locator('textarea').first().inputValue();
      expect(textareaValue).toContain('Rituel beaute japonaise FemiGlow');
    } else {
      // Regeneration was triggered directly — wait for result
      await expect(sharedPage.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });
    }
  });

  // 4. Modify the key message (if brief form is visible) or verify second result
  test('modify key message or verify regeneration result', async () => {
    const briefVisible = await sharedPage.getByText('Brief créatif').isVisible({ timeout: 3_000 }).catch(() => false);

    if (briefVisible) {
      // Modify the key message
      const textarea = sharedPage.locator('textarea').first();
      await textarea.clear();
      await textarea.fill('Nouveau message cle modifie');
      await expect(textarea).toHaveValue('Nouveau message cle modifie');
    } else {
      // The regeneration already completed — verify second result appears
      await expect(sharedPage.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });
    }
  });

  // 5. Click "Générer" again (if brief is visible) or verify call count
  test('submit modified brief or verify API was called twice', async () => {
    const briefVisible = await sharedPage.getByText('Brief créatif').isVisible({ timeout: 3_000 }).catch(() => false);

    if (briefVisible) {
      const genButton = sharedPage.getByRole('button', { name: /Générer/i });
      await expect(genButton).toBeEnabled({ timeout: 5_000 });
      await genButton.click();

      await expect(
        sharedPage.getByText('Pipeline de génération').or(sharedPage.getByText('Contenu généré')),
      ).toBeVisible({ timeout: 15_000 });
    }

    // Verify API was called at least twice
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  // 6. New result appears (different from first)
  test('new result appears — different from the first', async () => {
    await expect(sharedPage.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });
    await expect(sharedPage.getByText('Deuxieme hook modifie')).toBeVisible({ timeout: 10_000 });

    // Verify the first result is no longer shown
    await expect(sharedPage.getByText('Premier hook FemiGlow')).not.toBeVisible();
  });
});
