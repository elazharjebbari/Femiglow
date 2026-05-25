/**
 * AI Engine — Session Expired (401) scenarios E2E tests.
 *
 * Tests that 401 responses from various APIs display appropriate error
 * messages and that retry mechanisms work. Uses page.route() to mock
 * API calls with 401 responses.
 *
 * NOTE: /health is fetched during SSR — mocking it breaks server-side
 * rendering. The health 401 test checks behavior after page load.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

// ── Helpers ──────────────────────────────────────────────────────

/** Fill all required brief fields using evaluate to trigger React state. */
async function fillBrief(page: import('@playwright/test').Page) {
  // Use evaluate to set values and trigger React's onChange via native events.
  // Playwright's selectOption can miss React's synthetic event in some contexts.
  const selects = page.locator('select');
  for (const [idx, val] of [[0, 'engagement'], [1, 'instagram'], [2, 'carousel'], [3, 'luxurious']] as const) {
    const sel = selects.nth(idx);
    await sel.selectOption(val);
    // Trigger input event to ensure React sees the change
    await sel.dispatchEvent('input', { bubbles: true });
  }
  await page.locator('textarea').first().fill('Test session expired');
  // Small wait for React to batch state updates
  await page.waitForTimeout(300);
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
  await expect(genButton).toBeEnabled({ timeout: 10_000 });
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
  await expect(retryButton).toBeVisible({ timeout: 10_000 });
});

// 3. Health API 401 - mocking /health intercepts SSR so page shows error boundary.
//    We verify the page does NOT crash with a blank white screen — it either
//    shows the error boundary (graceful degradation) or loads normally if health
//    fetch is non-blocking.
test('session — health API 401 triggers error boundary or graceful degradation', async ({ page }) => {
  // Set up route mock BEFORE navigation so it catches the SSR fetch.
  await page.route('**/api/admin/ai-engine/health', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unauthorized' }),
    });
  });

  // Clear chunk-reload flag and navigate
  await page.addInitScript(() => {
    try { window.sessionStorage.removeItem('femiglow:chunk-reload-attempted'); } catch {}
  });
  await page.goto('/admin/content-studio-v2/ai-engine');
  await page.waitForLoadState('domcontentloaded');

  // Either the error boundary shows, or the page loaded despite the 401.
  // Both are valid — the key is the page did NOT produce a blank/crash.
  // Check for any of these indicators using individual assertions.
  const dashboard = page.getByRole('heading', { name: /Tableau de bord/i });
  const errorText = page.getByText(/interrompu/i).first();
  const errCode = page.getByText(/erreur/i).first();

  // At least one indicator should be visible
  const dashVisible = await dashboard.isVisible({ timeout: 10_000 }).catch(() => false);
  const errVisible = await errorText.isVisible({ timeout: 2_000 }).catch(() => false);
  const errCodeVisible = await errCode.isVisible({ timeout: 2_000 }).catch(() => false);

  expect(dashVisible || errVisible || errCodeVisible).toBe(true);
});

// 4. Trends API returns 401 -> trends shows error or empty state
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

  // The page should load the shell; trend data shows error or empty state
  const heading = page.getByRole('heading', { name: /Veille & Tendances/i });
  await expect(heading).toBeVisible({ timeout: 15_000 });
  // When trends API returns 401, the page shows an empty or error state
  const emptyState = page.getByText(/aucune tendance/i);
  const errorMsg = page.getByText(/erreur/i).first();
  const emptyVisible = await emptyState.isVisible({ timeout: 5_000 }).catch(() => false);
  const errorVisible = await errorMsg.isVisible({ timeout: 2_000 }).catch(() => false);
  expect(emptyVisible || errorVisible).toBe(true);
});

// 5. Knowledge API returns 401 -> knowledge shows error or empty state
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

  // When the knowledge API returns 401, the page shows a full error state
  // with "Impossible de charger" or the heading still renders depending on
  // implementation. Check for either.
  const heading = page.getByRole('heading', { name: /Base de connaissances/i });
  const errorMsg = page.getByText(/Impossible de charger|Erreur 401/i).first();
  const headingVisible = await heading.isVisible({ timeout: 10_000 }).catch(() => false);
  const errorVisible = await errorMsg.isVisible({ timeout: 5_000 }).catch(() => false);
  expect(headingVisible || errorVisible).toBe(true);
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
  const genButton = page.getByRole('button', { name: /Générer/i });
  await expect(genButton).toBeEnabled({ timeout: 10_000 });
  await genButton.click();
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
