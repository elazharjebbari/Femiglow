/**
 * Shared helpers for AI Engine E2E tests.
 *
 * Follows the same patterns as `shell.spec.ts`: clear chunk-reload flag,
 * wait for the v2 shell, skip if redirected to login.
 */
import { expect, test } from '@playwright/test';

/**
 * Navigate to an AI Engine sub-page and wait for the shell to render.
 *
 * @param page  Playwright page
 * @param path  Sub-path relative to `/admin/content-studio-v2/ai-engine/`
 *              (e.g. `''` for dashboard, `'create'`, `'trends'`, `'config'`,
 *              `'knowledge'`).
 */
export async function gotoAIEngine(
  page: import('@playwright/test').Page,
  path = '',
) {
  // Clear stale chunk-reload flag (see shell.spec.ts).
  await page.addInitScript(() => {
    try {
      window.sessionStorage.removeItem('femiglow:chunk-reload-attempted');
    } catch {}
  });

  const fullPath = `/admin/content-studio-v2/ai-engine${path ? `/${path}` : ''}`;
  await page.goto(fullPath);
  await page.waitForLoadState('domcontentloaded');

  // Wait for the v2 shell to be visible (proves the page loaded correctly).
  await expect(page.locator('.cs-v2-shell')).toBeVisible({ timeout: 15_000 });
}

/**
 * Skip the test gracefully if the admin session has expired and the
 * page redirected to /admin/login.
 */
export function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) {
    test.skip(true, 'Admin auth storage state is not valid in this environment.');
  }
}
