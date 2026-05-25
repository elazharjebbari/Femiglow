/**
 * AI Engine — Concurrent UI behavior E2E tests.
 *
 * Tests that the UI correctly handles double-clicks, sequential
 * generations, and button state management during generation.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

const MOCK_GENERATE_RESPONSE = {
  jobId: 'conc-job-001',
  status: 'completed',
  script: {
    hook: 'Concurrent test hook',
    scenes: [{ sceneNumber: 1, description: 'Concurrent test scene' }],
    cta: 'Concurrent CTA',
    voiceoverRequired: false,
    musicRequired: false,
    visualDirection: [],
  },
  caption: 'Concurrent test caption for FemiGlow',
  hashtags: ['femiglow', 'concurrent'],
  images: [
    { assetId: 'img-c-1', url: '/conc.png', mimeType: 'image/png', width: 1080, height: 1080, provider: 'mock', costCents: 0 },
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
  bridgeResult: { ideaId: 'ci_c', briefId: 'cb_c', draftId: 'cd_c' },
  contentStudioUrl: '/admin/content-studio-v2/library?highlight=cd_c',
};

/** Fill the brief form fields. */
async function fillBrief(page: import('@playwright/test').Page) {
  await page.locator('select').nth(0).selectOption('engagement');
  await page.locator('select').nth(1).selectOption('instagram');
  await page.locator('select').nth(2).selectOption('carousel');
  await page.locator('select').nth(3).selectOption('luxurious');
  await page.locator('textarea').first().fill('Le rituel FemiGlow concurrent test');
}

// ─────────────────────────────────────────────────────────────────
// 1. Clicking Générer transitions away from brief phase (button gone)
// ─────────────────────────────────────────────────────────────────
test('concurrent — clicking Générer removes the brief form during generation', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    // Delay to keep the generating phase visible
    await new Promise((resolve) => setTimeout(resolve, 2000));
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

  const genButton = page.getByRole('button', { name: /Générer/i });
  await expect(genButton).toBeEnabled({ timeout: 5_000 });
  await genButton.click();

  // Pipeline progress should appear — the brief form is now hidden
  await expect(page.getByText('Pipeline de génération')).toBeVisible({ timeout: 15_000 });

  // The "Générer" button should no longer be on the page (brief phase is gone)
  await expect(genButton).not.toBeVisible();

  // The "Brief créatif" heading should also be hidden
  await expect(page.getByText('Brief créatif')).not.toBeVisible();
});

// ─────────────────────────────────────────────────────────────────
// 2. User cannot submit the form twice (brief phase is replaced)
// ─────────────────────────────────────────────────────────────────
test('concurrent — user cannot submit form twice (phase transitions prevent it)', async ({ page }) => {
  let callCount = 0;

  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    callCount++;
    // Delay to keep the generating phase visible
    await new Promise((resolve) => setTimeout(resolve, 3000));
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

  const genButton = page.getByRole('button', { name: /Générer/i });
  await expect(genButton).toBeEnabled({ timeout: 5_000 });

  // Click generate
  await genButton.click();

  // Pipeline phase replaces the brief — button is gone
  await expect(page.getByText('Pipeline de génération')).toBeVisible({ timeout: 15_000 });

  // Wait for the result to appear
  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });

  // Only one API call should have been made
  expect(callCount).toBe(1);
});

// ─────────────────────────────────────────────────────────────────
// 3. After result, user can generate again (Régénérer re-enables)
// ─────────────────────────────────────────────────────────────────
test('concurrent — after result, Régénérer triggers new generation', async ({ page }) => {
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

  // Wait for result
  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });

  // Régénérer button should be visible and clickable
  const regenButton = page.getByRole('button', { name: /Régénérer/i });
  await expect(regenButton).toBeVisible({ timeout: 10_000 });
  await expect(regenButton).toBeEnabled();

  // Click Régénérer
  await regenButton.click();

  // Pipeline should show again
  await expect(page.getByText('Pipeline de génération')).toBeVisible({ timeout: 15_000 });

  // And eventually the result again
  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });

  // Two API calls total
  expect(callCount).toBe(2);
});

// ─────────────────────────────────────────────────────────────────
// 4. Two sequential generations both succeed
// ─────────────────────────────────────────────────────────────────
test('concurrent — two sequential generations both succeed', async ({ page }) => {
  let callCount = 0;
  const responses = [
    {
      ...MOCK_GENERATE_RESPONSE,
      jobId: 'seq-job-001',
      script: { ...MOCK_GENERATE_RESPONSE.script, hook: 'First generation hook' },
      caption: 'First generation caption',
    },
    {
      ...MOCK_GENERATE_RESPONSE,
      jobId: 'seq-job-002',
      script: { ...MOCK_GENERATE_RESPONSE.script, hook: 'Second generation hook' },
      caption: 'Second generation caption',
    },
  ];

  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    const response = responses[callCount] ?? responses[0];
    callCount++;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  // --- First generation ---
  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);
  await page.getByRole('button', { name: /Générer/i }).click();

  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('First generation hook')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('First generation caption')).toBeVisible({ timeout: 5_000 });

  // --- Second generation via Régénérer ---
  await page.getByRole('button', { name: /Régénérer/i }).click();
  await expect(page.getByText('Pipeline de génération')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });

  await expect(page.getByText('Second generation hook')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Second generation caption')).toBeVisible({ timeout: 5_000 });

  expect(callCount).toBe(2);
});
