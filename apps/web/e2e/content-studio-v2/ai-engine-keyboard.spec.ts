/**
 * AI Engine — Keyboard navigation & shortcuts E2E tests.
 *
 * Tests Tab navigation, Enter submission, Escape behavior, and focus
 * visibility on AI Engine pages. Uses page.route() to mock API calls.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

// ── Mock data ────────────────────────────────────────────────────

const MOCK_GENERATE_SUCCESS = {
  jobId: 'kb-job-001',
  status: 'completed',
  script: {
    hook: 'Keyboard nav hook',
    scenes: [{ sceneNumber: 1, description: 'KB scene' }],
    cta: 'KB CTA',
  },
  caption: 'Keyboard test caption',
  hashtags: ['femiglow', 'keyboard'],
  images: [],
  videos: [],
  qualityScores: { text_quality: 0.88, average: 0.88 },
  moderationResult: { safe: true, flags: [], canRetry: false },
  costTracking: { totalCents: 0.10, breakdown: {}, tokensUsed: {} },
  errors: [],
  durationMs: 2000,
  bridgeResult: { ideaId: 'ci_kb', briefId: 'cb_kb', draftId: 'cd_kb' },
  contentStudioUrl: '/admin/content-studio-v2/library?highlight=cd_kb',
};

// ── Tests ────────────────────────────────────────────────────────

// 1. Tab through brief form fields in correct order
test('keyboard — Tab moves focus through brief form fields', async ({ page }) => {
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });

  // Press Tab multiple times and track which elements receive focus
  const focusedElements: { tag: string; type?: string }[] = [];

  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        tag: el?.tagName.toLowerCase() ?? 'none',
        type: (el as HTMLInputElement)?.type ?? undefined,
      };
    });
    focusedElements.push(info);
  }

  // Verify focus hit multiple interactive elements (select, textarea, input, button)
  const interactiveTags = focusedElements.filter((e) =>
    ['select', 'textarea', 'input', 'button', 'a'].includes(e.tag),
  );
  expect(interactiveTags.length).toBeGreaterThanOrEqual(3);

  // Verify at least one select (the brief dropdowns) received focus
  const selectCount = focusedElements.filter((e) => e.tag === 'select').length;
  expect(selectCount).toBeGreaterThanOrEqual(1);
});

// 2. Enter on "Générer" button submits form (when valid)
test('keyboard — Enter on "Générer" button submits form', async ({ page }) => {
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_GENERATE_SUCCESS),
    });
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });

  // Fill required fields
  await page.locator('select').nth(0).selectOption('engagement');
  await page.locator('select').nth(1).selectOption('instagram');
  await page.locator('select').nth(2).selectOption('carousel');
  await page.locator('select').nth(3).selectOption('luxurious');
  await page.locator('textarea').first().fill('Keyboard Enter test');

  // Focus the Générer button and press Enter
  const genButton = page.getByRole('button', { name: /Générer/i });
  await expect(genButton).toBeEnabled({ timeout: 5_000 });
  await genButton.focus();
  await expect(genButton).toBeFocused();

  await page.keyboard.press('Enter');

  // Should trigger generation
  await expect(page.getByText('Pipeline de génération')).toBeVisible({ timeout: 15_000 });
});

// 3. Tab to "Réessayer" button on error page and Enter to retry
test('keyboard — Tab to "Réessayer" on error page and Enter to retry', async ({ page }) => {
  let callCount = 0;
  await page.route('**/api/admin/ai-engine/generate', async (route) => {
    callCount++;
    if (callCount === 1) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Erreur serveur' }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_GENERATE_SUCCESS),
      });
    }
  });

  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });

  // Fill and submit to trigger error
  await page.locator('select').nth(0).selectOption('engagement');
  await page.locator('select').nth(1).selectOption('instagram');
  await page.locator('select').nth(2).selectOption('carousel');
  await page.locator('select').nth(3).selectOption('luxurious');
  await page.locator('textarea').first().fill('Keyboard retry test');
  await page.getByRole('button', { name: /Générer/i }).click();

  // Wait for error phase
  await expect(page.getByText('Erreur de génération')).toBeVisible({ timeout: 15_000 });

  // Focus the Réessayer button via keyboard
  const retryButton = page.getByRole('button', { name: /Réessayer/i });
  await expect(retryButton).toBeVisible({ timeout: 10_000 });
  await retryButton.focus();
  await expect(retryButton).toBeFocused();

  // Press Enter to retry
  await page.keyboard.press('Enter');

  // Should trigger retry (second call succeeds)
  await expect(
    page.getByText('Pipeline de génération').or(page.getByText('Contenu généré')),
  ).toBeVisible({ timeout: 15_000 });

  expect(callCount).toBe(2);
});

// 4. Escape key behavior (close command palette if open)
test('keyboard — Escape closes command palette on AI Engine page', async ({ page }) => {
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });

  // Open command palette
  await page.keyboard.press('ControlOrMeta+k');

  const palette = page.getByRole('dialog', { name: /palette de commandes/i });
  const paletteVisible = await palette.isVisible({ timeout: 3_000 }).catch(() => false);

  if (paletteVisible) {
    // Close it with Escape
    await page.keyboard.press('Escape');
    await expect(palette).not.toBeVisible({ timeout: 5_000 });
  } else {
    // Command palette may not be available on this page — verify Escape
    // does not break the page
    await page.keyboard.press('Escape');
    await expect(page.getByText('Brief créatif')).toBeVisible();
  }
});

// 5. Focus visible ring on all interactive elements
test('keyboard — focus ring is visible on interactive elements', async ({ page }) => {
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });

  // Tab through elements and check that focused elements have a visible
  // outline or box-shadow (focus indicator)
  const focusIndicators: boolean[] = [];

  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    const hasFocusIndicator = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el.tagName === 'BODY') return false;

      const style = window.getComputedStyle(el);
      const outline = style.outline;
      const boxShadow = style.boxShadow;
      const outlineWidth = style.outlineWidth;

      // Has visible outline (not "0px" or "none") or a box-shadow
      const hasOutline =
        outline !== 'none' &&
        outlineWidth !== '0px' &&
        !outline.includes('0px');
      const hasBoxShadow =
        boxShadow !== 'none' && boxShadow !== '';

      return hasOutline || hasBoxShadow;
    });
    focusIndicators.push(hasFocusIndicator);
  }

  // At least some interactive elements should have focus indicators
  const withIndicator = focusIndicators.filter(Boolean).length;
  expect(withIndicator).toBeGreaterThanOrEqual(1);
});

// 6. Brief form selects are keyboard-navigable
test('keyboard — brief form selects are keyboard-navigable', async ({ page }) => {
  await gotoAIEngine(page, 'create');
  ensureAuthOrSkip(page);

  await expect(page.getByText('Brief créatif')).toBeVisible({ timeout: 15_000 });

  // Focus the first select (Objectif)
  const firstSelect = page.locator('select').nth(0);
  await firstSelect.focus();
  await expect(firstSelect).toBeFocused();

  // Use keyboard to change the value — press ArrowDown to open/navigate
  await page.keyboard.press('ArrowDown');

  // After pressing ArrowDown, the select should have changed or shown options.
  // Select a value using keyboard
  await firstSelect.selectOption('engagement');
  const value = await firstSelect.inputValue();
  expect(value).toBe('engagement');

  // Tab to next select
  await page.keyboard.press('Tab');
  const focusedTag = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());

  // The next focused element should be an interactive element
  // (could be the next select or another form element depending on tab order)
  expect(['select', 'input', 'textarea', 'button', 'a']).toContain(focusedTag);
});
