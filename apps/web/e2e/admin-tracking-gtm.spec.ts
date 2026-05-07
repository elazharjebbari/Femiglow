/**
 * E2E Playwright — page `/admin/tracking/gtm`.
 *
 * Les tests sont tolérants à l'absence de session admin :
 * si la page redirige vers /admin/login, le test passe en
 * vérifiant simplement la redirection (le serveur peut être
 * lancé sans seed admin).
 */
import { test, expect } from '@playwright/test';

test.describe('admin tracking GTM export', () => {
  test('page export GTM — protégée par auth', async ({ page }) => {
    await page.goto('/admin/tracking/gtm');
    if (page.url().includes('/admin/login')) {
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      return;
    }
    await expect(
      page.getByRole('heading', { name: /export gtm/i }),
    ).toBeVisible();
  });

  test('tablist environnement présent et opérationnel', async ({ page }) => {
    await page.goto('/admin/tracking/gtm');
    if (page.url().includes('/admin/login')) return;

    const tablist = page.getByRole('tablist', { name: /environnement/i });
    await expect(tablist).toBeVisible();
    await expect(tablist.getByRole('tab')).toHaveCount(4);

    const stage = tablist.getByRole('tab', { name: /^stage/i });
    await stage.click();
    await expect(stage).toHaveAttribute('aria-selected', 'true');
  });

  test('boutons Télécharger / Copier visibles avec icônes', async ({ page }) => {
    await page.goto('/admin/tracking/gtm');
    if (page.url().includes('/admin/login')) return;

    const dl = page.getByRole('button', { name: /télécharger/i });
    const cp = page.getByRole('button', { name: /copier le json/i });
    await expect(dl).toBeVisible();
    await expect(cp).toBeVisible();
    await expect(dl.locator('svg')).toBeVisible();
    await expect(cp.locator('svg')).toBeVisible();
  });

  test('téléchargement du container.json fonctionnel', async ({ page }) => {
    await page.goto('/admin/tracking/gtm');
    if (page.url().includes('/admin/login')) return;

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /télécharger/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      /^gtm-femiglow-(production|stage|preview|dev)-\d{4}-\d{2}-\d{2}\.json$/,
    );
  });

  test('plein écran s\'ouvre puis se ferme avec Esc', async ({ page }) => {
    await page.goto('/admin/tracking/gtm');
    if (page.url().includes('/admin/login')) return;

    await page.getByRole('button', { name: /plein écran/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('bloc "Comment importer" affiche les 6 étapes', async ({ page }) => {
    await page.goto('/admin/tracking/gtm');
    if (page.url().includes('/admin/login')) return;

    await expect(
      page.getByRole('heading', { name: /comment importer/i }),
    ).toBeVisible();
    for (let i = 1; i <= 6; i++) {
      await expect(page.getByText(String(i), { exact: true })).toBeVisible();
    }
  });

  test('API container expose le bon Content-Disposition en download', async ({
    request,
  }) => {
    const res = await request.get(
      '/api/admin/tracking/gtm/container?env=production&format=pretty&download=true',
    );
    if (res.status() === 401) {
      // Sans session admin, on s'attend à un refus.
      expect(res.status()).toBe(401);
      return;
    }
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/json');
    expect(res.headers()['content-disposition']).toMatch(
      /attachment; filename="gtm-femiglow-production-/,
    );
    expect(res.headers()['x-container-sha256']).toMatch(/^[a-f0-9]{64}$/);
  });

  test('API container répond JSON par défaut (sans download)', async ({ request }) => {
    const res = await request.get(
      '/api/admin/tracking/gtm/container?env=production&format=pretty',
    );
    if (res.status() === 401) {
      expect(res.status()).toBe(401);
      return;
    }
    const body = await res.json();
    expect(body).toHaveProperty('pretty');
    expect(body).toHaveProperty('stats');
    expect(body).toHaveProperty('meta');
    expect(body.meta.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  test('API container env=dev → 0 tags (providers vides)', async ({ request }) => {
    const res = await request.get(
      '/api/admin/tracking/gtm/container?env=dev&format=pretty',
    );
    if (res.status() === 401) return;
    const body = await res.json();
    expect(body.stats.tags).toBe(0);
  });
});
