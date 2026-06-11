/**
 * AI Engine — Dashboard E2E tests.
 *
 * Verifies that the dashboard page loads correctly, shows provider
 * status cards, the "Nouvelle generation IA" CTA, and the sidebar
 * sub-navigation.
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from '../helpers/auth';
import { gotoAIEngine, ensureAuthOrSkip } from './ai-engine-helpers';

test.use({ storageState: ADMIN_STORAGE_PATH });

test('dashboard — page loads and shows "AI Engine" header', async ({ page }) => {
  await gotoAIEngine(page);
  ensureAuthOrSkip(page);

  // The eyebrow text says "AI Engine" and the h1 says "Tableau de bord".
  // « AI Engine » apparaît 4 fois (sidebar, label, breadcrumb, eyebrow) : on cible l'eyebrow.
  await expect(page.locator('.cs-eyebrow', { hasText: 'AI Engine' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /Tableau de bord/i })).toBeVisible({ timeout: 15_000 });
});

test('dashboard — provider status cards are visible', async ({ page }) => {
  await gotoAIEngine(page);
  ensureAuthOrSkip(page);

  // At minimum the "Texte / LLM" provider card should appear (active or
  // loading state both show the label). The dashboard renders 4 cards for
  // text, image, video, tts.
  await expect(page.getByText('Texte / LLM')).toBeVisible({ timeout: 15_000 });
});

test('dashboard — "Nouvelle generation IA" button is visible and links to /create', async ({ page }) => {
  await gotoAIEngine(page);
  ensureAuthOrSkip(page);

  const ctaLink = page.getByRole('link', { name: /Nouvelle génération IA/i });
  await expect(ctaLink).toBeVisible({ timeout: 15_000 });
  await expect(ctaLink).toHaveAttribute('href', /\/ai-engine\/create/);
});

test('dashboard — internal navigation links to sub-pages exist', async ({ page }) => {
  // The AI Engine pages are standalone (no AppShell sidebar). Instead of
  // testing sidebar sub-nav, verify the dashboard provides navigation links
  // to the key sub-pages: create (/create) and configuration.
  await gotoAIEngine(page);
  ensureAuthOrSkip(page);

  // "Nouvelle generation IA" links to /create.
  await expect(
    page.getByRole('link', { name: /Nouvelle génération IA/i }),
  ).toBeVisible({ timeout: 15_000 });

  // "Configuration" links to settings.
  await expect(
    page.getByRole('link', { name: /Configuration/i }),
  ).toBeVisible({ timeout: 10_000 });

  // The sidebar in the shell (AppShell) has an "AI Engine" entry
  // linking to this page. Verify from the shell side.
  await page.addInitScript(() => {
    try { window.sessionStorage.removeItem('femiglow:chunk-reload-attempted'); } catch {}
  });
  await page.goto('/admin/content-studio-v2/home');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.cs-v2-shell')).toBeVisible({ timeout: 15_000 });

  const sidebar = page.locator('.cs-sidebar');
  const aiLink = sidebar.getByRole('link', { name: 'AI Engine' });
  await expect(aiLink).toBeVisible({ timeout: 10_000 });
  await expect(aiLink).toHaveAttribute('href', /\/ai-engine/);
});
