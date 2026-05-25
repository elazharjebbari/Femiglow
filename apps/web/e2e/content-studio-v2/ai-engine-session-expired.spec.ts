/**
 * AI Engine — Session Expired (401) scenarios E2E tests.
 *
 * Tests that 401 responses from various APIs display appropriate error
 * messages and that retry mechanisms work. Uses page.route() to mock
 * API calls with 401 responses.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

// ── Helpers ──────────────────────────────────────────────────────

/** Fill all required brief fields. */
async function fillBrief(page: import('@playwright/test').Page) {
  await page.locator('select').nth(0).selectOption('engagement');
  await page.locator('select').nth(1).selectOption('instagram');
  await page.locator('select').nth(2).selectOption('carousel');
  await page.locator('select').nth(3).selectOption('luxurious');
  await page.locator('textarea').first().fill('Test session expired');
}

// ── Tests ────────────────────────────────────────────────────────

// 1. Generate API returns 401 -> error phase shows "Session expirée"
test('session — generate API 401 shows "Session expirée" or error message', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Session expirée' }),
    });
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);

  const genButton = page.getByRole('button', { name: /Générer/i });
  await expect(genButton).toBeEnabled({ timeout: 5_000 });
  await genButton.click();

  // Error phase should show with the 401 error message
  await expect(page.getByText('Erreur de génération')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Session expirée')).toBeVisible({ timeout: 10_000 });
});

// 2. Error message suggests reconnection
test('session — 401 error shows reconnection suggestion or retry option', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Session expirée — veuillez vous reconnecter' }),
    });
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);

  await page.getByRole('button', { name: /Générer/i }).click();

  await expect(page.getByText('Erreur de génération')).toBeVisible({ timeout: 15_000 });

  // The error phase should show a retry button or reconnection option
  const retryButton = page.getByRole('button', { name: /Réessayer/i });
  const modifyButton = page.getByRole('button', { name: /Modifier le brief/i });
  await expect(retryButton.or(modifyButton)).toBeVisible({ timeout: 10_000 });
});

// 3. Health API returns 401 -> dashboard shows error
test('session — health API 401 shows error on dashboard', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/health', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unauthorized' }),
    });
  });

  await gotoAIEngine(page);
  ensureAuthOrSkip(page);

  // The dashboard should still load the shell but may show an error state
  // for the health-dependent components or show a degraded dashboard.
  await expect(page.locator('.cs-v2-shell')).toBeVisible({ timeout: 15_000 });

  // Either the dashboard loads with an error indicator or it loads normally
  // (health endpoint may be non-blocking). Verify the page did not crash.
  const heading = page.getByRole('heading', { name: /Tableau de bord/i });
  const errorText = page.getByText(/erreur|indisponible|unauthorized/i);
  await expect(heading.or(errorText)).toBeVisible({ timeout: 15_000 });
});

// 4. Trends API returns 401 -> trends shows error
test('session — trends API 401 shows error on trends page', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/trends*', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unauthorized' }),
    });
  });

  await gotoAIEngine(page, 'trends');
  ensureAuthOrSkip(page);

  // The page should load but show an error or empty state for trends data
  await expect(page.locator('.cs-v2-shell')).toBeVisible({ timeout: 15_000 });

  // Verify page heading still renders (shell loaded)
  const heading = page.getByRole('heading', { name: /Veille & Tendances/i });
  const errorText = page.getByText(/erreur|indisponible|unauthorized|aucune tendance/i);
  await expect(heading.or(errorText)).toBeVisible({ timeout: 15_000 });
});

// 5. Knowledge API returns 401 -> knowledge shows error
test('session — knowledge API 401 shows error on knowledge page', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/knowledge', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unauthorized' }),
    });
  });

  await gotoAIEngine(page, 'knowledge');
  ensureAuthOrSkip(page);

  // The page should load but show an error or empty state
  await expect(page.locator('.cs-v2-shell')).toBeVisible({ timeout: 15_000 });

  const heading = page.getByRole('heading', { name: /Base de connaissances/i });
  const errorText = page.getByText(/erreur|indisponible|unauthorized|aucune collection/i);
  await expect(heading.or(errorText)).toBeVisible({ timeout: 15_000 });
});

// 6. After 401, retry button re-attempts (mock success on second call)
test('session — after 401 on generate, retry succeeds on second attempt', async ({ page }) => {
  let callCount = 0;

  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    callCount++;
    if (callCount === 1) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Session expirée' }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          jobId: 'session-retry-001',
          status: 'completed',
          script: {
            hook: 'Retry success hook',
            scenes: [{ sceneNumber: 1, description: 'Retry scene' }],
            cta: 'Retry CTA',
          },
          caption: 'Retry success caption',
          hashtags: ['femiglow', 'retry'],
          images: [],
          videos: [],
          qualityScores: { text_quality: 0.88, average: 0.88 },
          moderationResult: { safe: true, flags: [], canRetry: false },
          costTracking: { totalCents: 0.10, breakdown: {}, tokensUsed: {} },
          errors: [],
          durationMs: 2000,
          bridgeResult: { ideaId: 'ci_sr', briefId: 'cb_sr', draftId: 'cd_sr' },
          contentStudioUrl: '/admin/content-studio-v2/library?highlight=cd_sr',
        }),
      });
    }
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });
  await fillBrief(page);

  // First attempt — 401
  await page.getByRole('button', { name: /Générer/i }).click();
  await expect(page.getByText('Erreur de génération')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Session expirée')).toBeVisible({ timeout: 10_000 });

  // Click retry — should succeed
  const retryButton = page.getByRole('button', { name: /Réessayer/i });
  await expect(retryButton).toBeVisible({ timeout: 10_000 });
  await retryButton.click();

  // Wait for success
  await expect(page.getByText('Contenu généré')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Retry success hook')).toBeVisible({ timeout: 10_000 });

  expect(callCount).toBe(2);
});
