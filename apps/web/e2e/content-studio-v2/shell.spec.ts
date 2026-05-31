/**
 * Content Studio v2 — shell E2E.
 *
 * Verifies that with CONTENT_STUDIO_V2_ENABLED=true and a valid admin
 * session, the sidebar navigation moves the user between the 4 modes,
 * the theme toggle flips light/dark and persists across reloads.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

const MODES = [
  { path: '/admin/content-studio-v2/home',    label: 'Accueil' },
  { path: '/admin/content-studio-v2/create',  label: 'Création' },
  { path: '/admin/content-studio-v2/library', label: 'Bibliothèque' },
  { path: '/admin/content-studio-v2/plan',    label: 'Planning' },
];

async function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) {
    test.skip(true, 'Admin auth storage state is not valid in this environment.');
  }
}

test('navigation sidebar — bascule entre les 4 modes', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/home');
  await ensureAuthOrSkip(page);

  // Start: Home active
  await expect(page).toHaveURL(/\/admin\/content-studio-v2\/home/);

  // Navigate via sidebar links (one per mode).
  for (const mode of MODES) {
    const link = page.getByRole('link', { name: mode.label }).first();
    await link.click();
    await expect(page).toHaveURL(new RegExp(mode.path.replace(/\//g, '\\/')));
    // The sidebar entry should now be the active one.
    await expect(link).toHaveAttribute('aria-current', 'page');
  }
});

test('theme toggle — bascule light/dark et persiste après reload', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/home');
  await ensureAuthOrSkip(page);

  const shell = page.locator('.cs-v2-shell');
  const initial = await shell.getAttribute('data-theme');
  expect(['light', 'dark']).toContain(initial);

  // The toggle button lives in the sidebar footer; find by aria-label.
  const toggle = page.getByRole('button', { name: /thème (clair|sombre)/i }).first();
  await toggle.click();

  // Wait for the theme attribute to switch.
  await expect(shell).toHaveAttribute('data-theme', initial === 'dark' ? 'light' : 'dark');

  // Reload and verify persistence.
  await page.reload();
  await ensureAuthOrSkip(page);
  await expect(page.locator('.cs-v2-shell')).toHaveAttribute(
    'data-theme',
    initial === 'dark' ? 'light' : 'dark',
  );
});

test('topbar — breadcrumb reflète la route active', async ({ page }) => {
  await page.goto('/admin/content-studio-v2/library');
  await ensureAuthOrSkip(page);

  const crumbs = page.locator('nav[aria-label="Fil d\'Ariane"]');
  await expect(crumbs).toContainText('Studio');
  await expect(crumbs).toContainText('Bibliothèque');
});

test("⌘K — ouvre la palette de commandes et liste les navigations", async ({ page }) => {
  await page.goto('/admin/content-studio-v2/home');
  await ensureAuthOrSkip(page);

  // ⌘K on macOS, Ctrl+K elsewhere — Playwright supports `Meta+K` semantics.
  await page.keyboard.press('Meta+k');
  await expect(page.getByRole('dialog', { name: /palette de commandes/i })).toBeVisible();

  // The palette should list the 4 navigation entries.
  for (const mode of MODES) {
    await expect(page.getByText(new RegExp(`Aller à (l['' ]+|la |le )?${mode.label}`, 'i'))).toBeVisible();
  }

  // Escape closes.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /palette de commandes/i })).not.toBeVisible();
});
