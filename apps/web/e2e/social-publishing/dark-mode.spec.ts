/**
 * Dark mode spec — F40.
 *
 * Vérifie que les pages publish (create, plan, library) ne produisent
 * pas de texte invisible quand `prefers-color-scheme: dark`. Vérifie
 * aussi que les CSS tokens sont bien chargés (Portal background opaque).
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { registerPlanMocks } from './helpers';

test.use({
  storageState: ADMIN_STORAGE_PATH,
  colorScheme: 'dark',
});

test.describe('Dark mode — publish surfaces', () => {
  test('plan page renders in dark mode', async ({ page }) => {
    await registerPlanMocks(page);
    await page.goto('/admin/content-studio-v2/plan');
    await page.waitForSelector('[data-section], main, body', { timeout: 10_000 });

    // Read the resolved body background — should be a dark tone, not transparent.
    const bg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(bg).not.toBe('transparent');
  });

  test('create page renders in dark mode without invisible text', async ({ page }) => {
    await registerPlanMocks(page);
    await page.goto('/admin/content-studio-v2/create');
    await page.waitForLoadState('domcontentloaded');

    // Sample contrast: pick a heading element and verify its color != bg
    const sample = await page.evaluate(() => {
      const main = document.body;
      const bg = window.getComputedStyle(main).backgroundColor;
      const headings = Array.from(document.querySelectorAll('h1, h2, h3'));
      const headingColors = headings.slice(0, 5).map(
        (h) => window.getComputedStyle(h).color,
      );
      return { bg, headingColors };
    });
    expect(sample.bg).not.toBe('rgba(0, 0, 0, 0)');
    // No heading should have the exact same color as background (would be invisible).
    for (const c of sample.headingColors) {
      expect(c).not.toBe(sample.bg);
    }
  });
});
