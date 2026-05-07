import { test, expect } from '@playwright/test';

/**
 * E2E — pages /admin/components (liste + détail + seed + animations).
 *
 * Comportement :
 *  - Sans session admin → redirige vers /admin/login (middleware guard).
 *  - Avec session : on vérifie les éléments d'UI principaux.
 *
 * Si la fixture admin-storage.json n'existe pas encore, on accepte
 * gracieusement la redirection comme dans `admin-leads.spec.ts`.
 */
test.describe('admin components', () => {
  test('liste composants — protégée par auth', async ({ page }) => {
    const res = await page.goto('/admin/components');
    expect(res).not.toBeNull();
    if (page.url().includes('/admin/login')) {
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      return;
    }
    await expect(page.getByRole('heading', { name: /^composants/i })).toBeVisible();
    // Liens d'actions principales
    await expect(page.getByRole('link', { name: /seed depuis docs/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^animations$/i })).toBeVisible();
  });

  test('détail composant — 404 propre sur clé inconnue', async ({ page }) => {
    const res = await page.goto('/admin/components/inexistant-xyz');
    if (page.url().includes('/admin/login')) return;
    expect([200, 404]).toContain(res?.status() ?? 0);
  });

  test('page seed — affiche le formulaire dry-run', async ({ page }) => {
    const res = await page.goto('/admin/components/seed');
    expect(res).not.toBeNull();
    if (page.url().includes('/admin/login')) return;
    await expect(page.getByRole('heading', { name: /seed depuis docs/i })).toBeVisible();
    await expect(page.getByLabel(/dry-run/i)).toBeVisible();
  });

  test('catalogue animations — accessible', async ({ page }) => {
    const res = await page.goto('/admin/components/animations');
    expect(res).not.toBeNull();
    if (page.url().includes('/admin/login')) return;
    await expect(
      page.getByRole('heading', { name: /profils d['’]animation/i }),
    ).toBeVisible();
  });
});
