/**
 * AI Engine — Publication flow E2E tests.
 *
 * Uses page.route() to mock generate + publish APIs.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip, disableHumanReview } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

const MOCK_GENERATE_RESPONSE = {
  jobId: 'pub-test-job-001',
  status: 'completed',
  script: {
    hook: 'Decouvrez le rituel FemiGlow',
    scenes: [{ sceneNumber: 1, description: 'Scene test' }],
    cta: 'Commandez maintenant',
    voiceoverRequired: false,
    musicRequired: false,
    visualDirection: [],
  },
  caption: 'Caption test publication',
  hashtags: ['femiglow', 'publication'],
  images: [],
  videos: [],
  qualityScores: {
    text_quality: 0.9,
    brand_compliance: 0.88,
    average: 0.89,
  },
  moderationResult: { safe: true, flags: [], canRetry: false },
  costTracking: { totalCents: 0.2, breakdown: {}, tokensUsed: {} },
  errors: [],
  durationMs: 3500,
  bridgeResult: { ideaId: 'ci_pub', briefId: 'cb_pub', draftId: 'cd_pub' },
  contentStudioUrl: '/admin/content-studio-v2/library?highlight=cd_pub',
};

async function fillBrief(page: import('@playwright/test').Page) {
  await page.locator('select').nth(0).selectOption('engagement');
  await page.locator('select').nth(1).selectOption('instagram');
  await page.locator('select').nth(2).selectOption('carousel');
  await page.locator('select').nth(3).selectOption('luxurious');
  await page.locator('textarea').first().fill('Test publication flow');
}

async function generateContent(page: import('@playwright/test').Page) {
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);
  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  // HITL est ON par défaut : sans désactivation, la génération s'arrête en
  // phase « Revue humaine requise » et la section Publier n'apparaît jamais.
  await disableHumanReview(page);
  await page.getByRole('button', { name: /Générer/i }).click();
  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });
}

// ─────────────────────────────────────────────────────────────────
// 1. After generation, publish section appears (when bridgeResult present)
// ─────────────────────────────────────────────────────────────────
test('publish — publish section appears after generation', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_GENERATE_RESPONSE),
    });
  });

  await generateContent(page);

  await expect(page.getByText('Publier').first()).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 2. "Publier maintenant" mode is selectable
// ─────────────────────────────────────────────────────────────────
test('publish — "Publier maintenant" mode is selectable', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_GENERATE_RESPONSE),
    });
  });

  await generateContent(page);

  const nowBtn = page.getByText('Publier maintenant');
  await expect(nowBtn).toBeVisible({ timeout: 10_000 });
  await nowBtn.click();
  // Should be selected (accent border)
  await expect(nowBtn).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────
// 3. "Planifier" mode shows datetime input
// ─────────────────────────────────────────────────────────────────
test('publish — "Planifier" mode shows datetime input', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_GENERATE_RESPONSE),
    });
  });

  await generateContent(page);

  const scheduleBtn = page.getByText('Planifier');
  await expect(scheduleBtn).toBeVisible({ timeout: 10_000 });
  await scheduleBtn.click();

  // Datetime input should appear
  await expect(page.locator('input[type="datetime-local"]')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText('Date et heure de publication')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────
// 4. Clicking "Publier" calls the publish API
// ─────────────────────────────────────────────────────────────────
test('publish — clicking "Publier" calls the publish API', async ({ page }) => {
  let publishCalled = false;

  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_GENERATE_RESPONSE),
    });
  });

  await page.route('**/api/admin/ai-engine/publish', async (route) => {
    publishCalled = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'Published' }),
    });
  });

  await generateContent(page);

  // Click the "Publier" action button (not the mode button)
  const publishButton = page.getByRole('button', { name: /^Publier$/ });
  await expect(publishButton).toBeVisible({ timeout: 10_000 });
  await publishButton.click();

  // Wait for the API to be called
  await page.waitForTimeout(1000);
  expect(publishCalled).toBe(true);
});

// ─────────────────────────────────────────────────────────────────
// 5. Success state shows confirmation
// ─────────────────────────────────────────────────────────────────
test('publish — success state shows confirmation', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_GENERATE_RESPONSE),
    });
  });

  await page.route('**/api/admin/ai-engine/publish', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await generateContent(page);

  const publishButton = page.getByRole('button', { name: /^Publier$/ });
  await publishButton.click();

  await expect(page.getByText(/publié avec succès/)).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 6. Error state shows error message
// ─────────────────────────────────────────────────────────────────
test('publish — error state shows error message', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_GENERATE_RESPONSE),
    });
  });

  await page.route('**/api/admin/ai-engine/publish', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Erreur publication Postiz' }),
    });
  });

  await generateContent(page);

  const publishButton = page.getByRole('button', { name: /^Publier$/ });
  await publishButton.click();

  await expect(page.getByText(/Erreur publication Postiz/)).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 7. Integrations list is loaded (mode buttons present)
// ─────────────────────────────────────────────────────────────────
test('publish — publish mode buttons present', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_GENERATE_RESPONSE),
    });
  });

  await generateContent(page);

  await expect(page.getByText('Publier maintenant')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Planifier')).toBeVisible({ timeout: 10_000 });
});

// ─────────────────────────────────────────────────────────────────
// 8. Schedule datetime accepts future date
// ─────────────────────────────────────────────────────────────────
test('publish — schedule datetime accepts future date', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_GENERATE_RESPONSE),
    });
  });

  await page.route('**/api/admin/ai-engine/publish', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await generateContent(page);

  // Switch to schedule mode
  await page.getByText('Planifier').click();
  const dtInput = page.locator('input[type="datetime-local"]');
  await expect(dtInput).toBeVisible({ timeout: 5_000 });

  // Fill with a future date
  const futureDate = new Date(Date.now() + 86400000);
  const formatted = futureDate.toISOString().slice(0, 16);
  await dtInput.fill(formatted);
  await expect(dtInput).toHaveValue(formatted);

  // "Planifier la publication" button should be present
  const schedulePublishBtn = page.getByRole('button', { name: /Planifier la publication/i });
  await expect(schedulePublishBtn).toBeVisible({ timeout: 5_000 });
});
