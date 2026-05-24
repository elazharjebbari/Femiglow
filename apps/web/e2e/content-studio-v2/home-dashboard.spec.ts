/**
 * Content Studio v2 — /home dashboard smoke tests.
 *
 * The home page can render in two states depending on the server's
 * CONTENT_STUDIO_V2_ENABLED env var:
 *  - Enabled:  full dashboard with KPI cards, activity feed, snapshot
 *  - Disabled: EmptyState with "Module desactive" and navigation links
 *
 * Tests handle both states gracefully.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) {
    test.skip(true, 'Admin auth storage state is not valid in this environment.');
  }
}

test.describe('home dashboard', () => {
  test('renders either dashboard or module-disabled state', async ({ page }) => {
    await page.goto('/admin/content-studio-v2/home');
    await ensureAuthOrSkip(page);

    // Wait for the page to stabilise
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    // The page should render either the full dashboard heading
    // or the "Module desactive" empty state — both are valid.
    const hasDashboard = await page.getByRole('heading', { name: /tableau de bord/i }).isVisible().catch(() => false);
    const hasDisabled = await page.getByText(/module désactivé/i).isVisible().catch(() => false);

    expect(
      hasDashboard || hasDisabled,
      'Expected either "Tableau de bord" heading or "Module desactive" state',
    ).toBe(true);
  });

  test('navigation links are present in sidebar', async ({ page }) => {
    await page.goto('/admin/content-studio-v2/home');
    await ensureAuthOrSkip(page);

    // Regardless of enabled/disabled, the shell sidebar should have nav links.
    for (const label of ['Accueil', 'Création', 'Bibliothèque', 'Planning']) {
      await expect(page.getByRole('link', { name: label }).first()).toBeVisible();
    }
  });

  test('home page renders the shell wrapper', async ({ page }) => {
    await page.goto('/admin/content-studio-v2/home');
    await ensureAuthOrSkip(page);

    // The AppShell wraps content in a .cs-v2-shell
    await expect(page.locator('.cs-v2-shell')).toBeVisible();
  });

  test('breadcrumb shows Studio > Accueil', async ({ page }) => {
    await page.goto('/admin/content-studio-v2/home');
    await ensureAuthOrSkip(page);

    const crumbs = page.locator('nav[aria-label="Fil d\'Ariane"]');
    await expect(crumbs).toContainText('Studio');
    await expect(crumbs).toContainText('Accueil');
  });
});
