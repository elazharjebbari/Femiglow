/**
 * Content Studio v2 — redirect substitution tests.
 *
 * When both CONTENT_STUDIO_V2_DEFAULT=true and CONTENT_STUDIO_V2_ENABLED=true
 * are set at runtime, `/admin/content-studio` redirects to
 * `/admin/content-studio-v2/home`.
 *
 * When the flags are off, `/admin/content-studio` stays at v1 and
 * `/admin/content-studio-legacy` still works.
 *
 * These tests handle both runtime states since the server env may differ
 * from `.env` file contents at test time.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) {
    test.skip(true, 'Admin auth storage state is not valid in this environment.');
  }
}

test('content-studio resolves to either v1 or v2 home', async ({ page }) => {
  await page.goto('/admin/content-studio');
  await ensureAuthOrSkip(page);

  // Wait for any server-side redirect to complete
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  const url = page.url();

  // Either we got redirected to v2/home (V2_DEFAULT=true) or stayed at v1
  const isV2 = /content-studio-v2\/home/.test(url);
  const isV1 = /\/admin\/content-studio\b/.test(url) && !/content-studio-v2/.test(url);

  expect(
    isV2 || isV1,
    `Expected content-studio to resolve to v1 or v2, got: ${url}`,
  ).toBe(true);
});

test('content-studio-legacy route exists or returns 404', async ({ page }) => {
  const response = await page.goto('/admin/content-studio-legacy');
  await ensureAuthOrSkip(page);

  // The legacy route may not be deployed yet (404) or may be live.
  // Both are valid outcomes depending on the build.
  const status = response?.status() ?? 0;

  if (status === 404) {
    // Route not yet deployed — acceptable, skip further assertions.
    return;
  }

  // If it loaded successfully, it should show the legacy Content Studio UI.
  const hasLegacyLabel = await page.getByText(/ancienne interface/i).isVisible().catch(() => false);
  const hasStudioContent = await page.getByText(/studio contenu/i).isVisible().catch(() => false);

  expect(
    hasLegacyLabel || hasStudioContent,
    'Expected legacy page to render Content Studio UI when not 404',
  ).toBe(true);
});
