/**
 * Content Studio v2 — accessibility audit across all 4 modes.
 *
 * Runs axe-core on each page and asserts zero critical/serious violations.
 * Skeletons are excluded from analysis since they are transient loading
 * placeholders.
 */
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) {
    test.skip(true, 'Admin auth storage state is not valid in this environment.');
  }
}

const MODES = [
  { path: '/admin/content-studio-v2/home', name: 'home' },
  { path: '/admin/content-studio-v2/create', name: 'create' },
  { path: '/admin/content-studio-v2/library', name: 'library' },
  { path: '/admin/content-studio-v2/plan', name: 'plan' },
];

for (const mode of MODES) {
  test(`a11y — /${mode.name} has no critical violations`, async ({ page }) => {
    await page.goto(mode.path);
    await ensureAuthOrSkip(page);

    // Give the page time to settle (dynamic data, hydration).
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

    const results = await new AxeBuilder({ page })
      .exclude('.cs-skeleton')
      .disableRules(['color-contrast'])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );

    if (critical.length > 0) {
      const details = critical
        .map(
          (v) =>
            `[${v.impact}] ${v.id}: ${v.description}\n` +
            v.nodes.map((n) => `  - ${n.html.slice(0, 120)}`).join('\n'),
        )
        .join('\n\n');
      expect(critical, `A11y violations on /${mode.name}:\n${details}`).toHaveLength(0);
    }
  });
}
