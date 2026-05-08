/**
 * E2E Playwright — page `/admin/analytics/insights`.
 *
 * Tolérant à l'absence de session admin (redirige vers /admin/login).
 */
import { test, expect } from '@playwright/test';

test.describe('admin analytics insights', () => {
  test('page protégée par auth', async ({ page }) => {
    await page.goto('/admin/analytics/insights');
    if (page.url().includes('/admin/login')) {
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      return;
    }
    await expect(page.getByRole('heading', { name: /analytics insights/i })).toBeVisible();
  });

  test('5 sous-onglets visibles', async ({ page }) => {
    await page.goto('/admin/analytics/insights');
    if (page.url().includes('/admin/login')) return;
    const tablist = page.getByRole('tablist', { name: /sous-onglets insights/i });
    await expect(tablist).toBeVisible();
    await expect(tablist.getByRole('tab')).toHaveCount(5);
  });

  test('navigation entre onglets met à jour le panneau', async ({ page }) => {
    await page.goto('/admin/analytics/insights');
    if (page.url().includes('/admin/login')) return;
    await page.getByRole('tab', { name: 'Pages' }).click();
    await expect(page.getByRole('tab', { name: 'Pages' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: 'Funnel' }).click();
    await expect(page.getByRole('tab', { name: 'Funnel' })).toHaveAttribute('aria-selected', 'true');
  });

  test('filtres globaux avec selects accessibles', async ({ page }) => {
    await page.goto('/admin/analytics/insights');
    if (page.url().includes('/admin/login')) return;
    await expect(page.getByLabel('Période')).toBeVisible();
    await expect(page.getByLabel('Env')).toBeVisible();
    await expect(page.getByLabel('Device')).toBeVisible();
  });

  test('changement de période → URL mise à jour', async ({ page }) => {
    await page.goto('/admin/analytics/insights');
    if (page.url().includes('/admin/login')) return;
    await page.getByLabel('Période').selectOption('30d');
    await expect(page).toHaveURL(/window=30d/);
  });

  test('refresh indicator présent + bouton refresh actionnable', async ({ page }) => {
    await page.goto('/admin/analytics/insights');
    if (page.url().includes('/admin/login')) return;
    const indicator = page.getByTestId('refresh-indicator');
    await expect(indicator).toBeVisible();
    const button = page.getByTestId('refresh-trigger');
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
  });

  test('onglet Pages affiche le bouton Exporter CSV', async ({ page }) => {
    await page.goto('/admin/analytics/insights');
    if (page.url().includes('/admin/login')) return;
    await page.getByRole('tab', { name: 'Pages' }).click();
    await expect(page.getByTestId('export-pages')).toBeVisible();
  });

  test('onglet Funnel rend les drop-offs', async ({ page }) => {
    await page.goto('/admin/analytics/insights');
    if (page.url().includes('/admin/login')) return;
    await page.getByRole('tab', { name: 'Funnel' }).click();
    await expect(page.getByText(/drop-offs/i).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('API insights protégées', () => {
  test('GET /api/admin/analytics/insights/overview sans session → 401', async ({ request }) => {
    const res = await request.get('/api/admin/analytics/insights/overview');
    expect(res.status()).toBe(401);
  });

  test('GET /api/admin/analytics/insights/refresh sans session → 401', async ({ request }) => {
    const res = await request.get('/api/admin/analytics/insights/refresh');
    expect(res.status()).toBe(401);
  });

  test('POST /api/admin/analytics/insights/refresh sans Bearer → 401', async ({ request }) => {
    const res = await request.post('/api/admin/analytics/insights/refresh');
    expect(res.status()).toBe(401);
  });

  test('GET /api/admin/analytics/insights/export sans session → 401', async ({ request }) => {
    const res = await request.get('/api/admin/analytics/insights/export?view=pages');
    expect(res.status()).toBe(401);
  });
});
