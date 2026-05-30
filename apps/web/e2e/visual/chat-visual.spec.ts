/**
 * Phase 6 — Visual regression — chat widget + key admin pages.
 *
 * Référence : `docs/chat-test-strategy-2026-05/04-execution-plan/06-phase-6-a11y-audit.md` §J45
 *
 * Stratégie :
 *  - Snapshots pixel-diff Playwright (maxDiffPixels = 100, tolérance légère)
 *  - Animations désactivées (CSS `prefers-reduced-motion`)
 *  - Dates frozen, humanize désactivé en test
 *
 * Run :
 *   pnpm test:visual
 *   # Update baselines après changement intentionnel :
 *   pnpm exec playwright test --update-snapshots e2e/visual/
 */
import { test, expect } from '@playwright/test';
import { ChatWidgetPOM } from '../pom/chat-widget.pom';

test.describe('@visual Chat widget — visual regression', () => {
  test('panel default theme FR (desktop)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/kit');
    const widget = new ChatWidgetPOM(page);
    await widget.open();

    await expect(widget.panel()).toHaveScreenshot('panel-default-fr-desktop.png', {
      maxDiffPixels: 100,
    });
  });

  test('panel dark mode (desktop)', async ({ page, context }) => {
    await context.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.goto('/kit');
    const widget = new ChatWidgetPOM(page);
    await widget.open();

    await expect(widget.panel()).toHaveScreenshot('panel-dark-fr-desktop.png', {
      maxDiffPixels: 100,
    });
  });

  test.skip('panel RTL ar-MA (nécessite locale switcher)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/kit?lang=ar-MA');
    const widget = new ChatWidgetPOM(page);
    await widget.open();

    await expect(widget.panel()).toHaveScreenshot('panel-rtl-ar-ma.png', {
      maxDiffPixels: 150, // tolérance plus haute pour RTL
    });
  });

  test('launcher mobile (iPhone 13)', async ({ page, browserName }) => {
    test.skip(test.info().project.name !== 'chromium-mobile', 'Mobile only');

    await page.goto('/kit');
    const widget = new ChatWidgetPOM(page);
    await expect(widget.launcher()).toHaveScreenshot('launcher-mobile.png');
  });
});
