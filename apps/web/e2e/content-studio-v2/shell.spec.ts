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

/**
 * Navigate to a content-studio-v2 page and wait for the shell to render.
 * Retries with a hard reload if a ChunkLoadError ("Mise à jour détectée")
 * is caught, which can happen when the build changes between the auth setup
 * and the test run.
 */
async function gotoV2(page: import('@playwright/test').Page, path: string) {
  // Clear stale chunk-reload flag that prevents the error page from
  // auto-reloading (set by error.tsx to avoid infinite loops).
  await page.addInitScript(() => {
    try { window.sessionStorage.removeItem('femiglow:chunk-reload-attempted'); } catch {}
  });
  await page.goto(path);
  // Use domcontentloaded instead of networkidle to avoid waiting for
  // prefetches and API calls that can take a long time.
  await page.waitForLoadState('domcontentloaded');

  // Wait for the v2 shell to be visible (proves the page loaded correctly
  // and isn't showing the chunk-error page).
  await expect(page.locator('.cs-v2-shell')).toBeVisible({ timeout: 15000 });
}

test('navigation sidebar — bascule entre les 4 modes', async ({ page }) => {
  await gotoV2(page, '/admin/content-studio-v2/home');
  await ensureAuthOrSkip(page);

  // Start: Home active
  await expect(page).toHaveURL(/\/admin\/content-studio-v2\/home/);

  // Scope navigation links to the sidebar to avoid matching breadcrumb or
  // other page links that share the same label.
  const sidebar = page.locator('.cs-sidebar');

  // Navigate via sidebar links (one per mode).
  for (const mode of MODES) {
    const link = sidebar.getByRole('link', { name: mode.label });
    await link.click();
    await expect(page).toHaveURL(new RegExp(mode.path.replace(/\//g, '\\/')), { timeout: 10000 });
    // The sidebar entry should now be the active one.
    await expect(link).toHaveAttribute('aria-current', 'page', { timeout: 10000 });
  }
});

test('theme toggle — bascule light/dark et persiste après reload', async ({ page }) => {
  await gotoV2(page, '/admin/content-studio-v2/home');
  await ensureAuthOrSkip(page);

  // The toggle button lives in the sidebar footer; find by aria-label.
  const toggle = page.locator('.cs-theme-toggle');
  await expect(toggle).toBeVisible({ timeout: 10000 });

  // Read the initial label to determine current theme.
  const initialLabel = await toggle.getAttribute('aria-label') ?? '';
  const isDark = /clair/i.test(initialLabel);
  const initial: 'light' | 'dark' = isDark ? 'dark' : 'light';

  // Click the toggle.
  await toggle.scrollIntoViewIfNeeded();
  await toggle.click();

  // After click, the label should flip. If it was "sombre" (light mode)
  // it should now say "clair" (dark mode) and vice versa.
  const expectedLabel = initial === 'light' ? /clair/i : /sombre/i;
  await expect(toggle).toHaveAttribute('aria-label', expectedLabel, { timeout: 10000 });

  // Reload and verify persistence.
  await page.reload();
  await page.waitForLoadState('networkidle').catch(() => {});
  await ensureAuthOrSkip(page);

  // After reload, the toggled theme should persist.
  const toggleAfter = page.locator('.cs-theme-toggle');
  await expect(toggleAfter).toHaveAttribute('aria-label', expectedLabel, { timeout: 10000 });
});

test('topbar — breadcrumb reflète la route active', async ({ page }) => {
  await gotoV2(page, '/admin/content-studio-v2/library');
  await ensureAuthOrSkip(page);

  const crumbs = page.locator('nav[aria-label="Fil d\'Ariane"]');
  await expect(crumbs).toContainText('Studio', { timeout: 10000 });
  await expect(crumbs).toContainText('Bibliothèque');
});

test("⌘K — ouvre la palette de commandes et liste les navigations", async ({ page }) => {
  await gotoV2(page, '/admin/content-studio-v2/home');
  await ensureAuthOrSkip(page);

  // Wait for the shell to be fully hydrated before sending hotkeys.
  await expect(page.locator('.cs-v2-shell')).toBeVisible({ timeout: 10000 });
  // Give hydration a moment to complete so hotkey listeners are attached.
  await page.waitForTimeout(1000);

  // Try both Playwright keyboard API and JavaScript dispatch.
  // Headless Chromium may intercept Ctrl+K at browser level.
  await page.keyboard.press('Control+k');
  let opened = await page.getByRole('dialog', { name: /palette de commandes/i })
    .isVisible({ timeout: 2000 }).catch(() => false);

  if (!opened) {
    // Fallback: dispatch KeyboardEvent on document (react-hotkeys-hook
    // attaches listeners on the document/window).
    await page.evaluate(() => {
      const ev = new KeyboardEvent('keydown', {
        key: 'k',
        code: 'KeyK',
        keyCode: 75,
        which: 75,
        ctrlKey: true,
        metaKey: false,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(ev);
    });
  }
  await expect(page.getByRole('dialog', { name: /palette de commandes/i })).toBeVisible({ timeout: 10000 });

  // The palette should list the 4 navigation entries. Commands say
  // "Aller à l'Accueil / à la Création / à la Bibliothèque / au Planning"
  // — we match the trailing label since the article varies.
  for (const mode of MODES) {
    await expect(page.getByText(new RegExp(`Aller (à|au) .*${mode.label}`, 'i'))).toBeVisible();
  }

  // Escape closes.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /palette de commandes/i })).not.toBeVisible();
});
