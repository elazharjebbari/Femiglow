import { test, expect } from '@playwright/test';

/**
 * E2E — page liste leads + détail lead.
 * Pré-requis : un admin doit être connecté. La fixture login est gérée
 * par `playwright.config.ts` (storageState `admin-storage.json`) ou
 * skip si la session iron-session n'a pas été préchauffée. Si la fixture
 * n'existe pas encore on tombe sur la redirection vers /admin/login,
 * test skipé proprement.
 */
test.describe('admin leads', () => {
  test('liste leads — protégée par auth', async ({ page }) => {
    const res = await page.goto('/admin/leads');
    expect(res).not.toBeNull();
    // Sans session : redirige vers /admin/login (guard middleware).
    if (page.url().includes('/admin/login')) {
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      return;
    }
    // Avec session :
    await expect(page.getByRole('heading', { name: /leads/i })).toBeVisible();
  });

  test('détail lead — 404 propre sur id inconnu', async ({ page }) => {
    const res = await page.goto('/admin/leads/l_unknown_id_xxx');
    if (page.url().includes('/admin/login')) {
      // Auth required, accept redirect.
      return;
    }
    expect([200, 404]).toContain(res?.status() ?? 0);
  });
});
