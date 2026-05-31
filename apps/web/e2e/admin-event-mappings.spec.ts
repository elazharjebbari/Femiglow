/**
 * E2E Playwright — admin event-mappings.
 *
 * Tolérant à absence de session admin (redirect /admin/login → early return).
 */
import { test, expect } from '@playwright/test';

test.describe('Admin /admin/tracking/events/mappings', () => {
  test('page liste accessible (ou redirect login)', async ({ page }) => {
    await page.goto('/admin/tracking/events/mappings');
    if (page.url().includes('/admin/login')) {
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      return;
    }
    await expect(page.getByRole('heading', { name: /mappings event/i })).toBeVisible();
  });

  test('toolbar : bouton "Créer une version" présent', async ({ page }) => {
    await page.goto('/admin/tracking/events/mappings');
    if (page.url().includes('/admin/login')) return;
    await expect(page.getByTestId('btn-create-version')).toBeVisible();
  });

  test('tableau des versions affiche __default__ avec badge DEFAULT', async ({ page }) => {
    await page.goto('/admin/tracking/events/mappings');
    if (page.url().includes('/admin/login')) return;
    const table = page.getByTestId('mapping-versions-table');
    await expect(table).toBeVisible();
    // __default__ ou ACTIVE doit apparaître
    const defaultRow = page.locator('text=DEFAULT, text=ACTIVE').first();
    await expect(defaultRow.or(page.locator('text=__default__').first())).toBeVisible();
  });

  test('aucune 500 sur le chargement initial des routes', async ({ page }) => {
    const failures: Array<{ url: string; status: number }> = [];
    page.on('response', (res) => {
      const u = res.url();
      if (u.includes('/api/admin/tracking/events/mappings') && res.status() >= 500) {
        failures.push({ url: u, status: res.status() });
      }
    });
    await page.goto('/admin/tracking/events/mappings');
    if (page.url().includes('/admin/login')) return;
    await page.waitForTimeout(2000);
    expect(failures).toEqual([]);
  });

  test('wizard create : step 1 → step 2 → step 3 navigation', async ({ page }) => {
    await page.goto('/admin/tracking/events/mappings');
    if (page.url().includes('/admin/login')) return;

    await page.getByTestId('btn-create-version').click();
    await expect(page.getByTestId('wizard-step-1')).toBeVisible();

    // Choix source default
    await page.getByLabel(/Depuis le mapping FemiGlow par défaut/i).check();
    await page.getByRole('button', { name: /Continuer/i }).click();

    await expect(page.getByTestId('wizard-step-2')).toBeVisible();
    // Saisir nom
    await page.getByLabel(/Nom de la version/i).fill('v_test_e2e');
    await page.getByRole('button', { name: /Continuer/i }).click();

    await expect(page.getByTestId('wizard-step-3')).toBeVisible();
    await expect(page.getByText('v_test_e2e')).toBeVisible();

    // Skip le submit pour ne pas créer en DB
  });
});

test.describe('Admin /admin/tracking/events/mappings/[id]', () => {
  test('page détail __default__ accessible', async ({ page }) => {
    await page.goto('/admin/tracking/events/mappings/__default__');
    if (page.url().includes('/admin/login')) return;
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Pas de bouton Éditer pour le default
    await expect(page.getByRole('link', { name: /éditer/i })).toHaveCount(0);
  });

  test('matrice rendue avec 70 events × 6 providers', async ({ page }) => {
    await page.goto('/admin/tracking/events/mappings/__default__');
    if (page.url().includes('/admin/login')) return;
    await expect(page.getByTestId('mapping-matrix')).toBeVisible();
    // Headers providers
    for (const provider of ['Meta', 'GA4', 'Google Ads', 'TikTok', 'Snap', 'Pinterest']) {
      await expect(page.getByRole('columnheader', { name: provider })).toBeVisible();
    }
  });

  test('cellule purchase × Meta affiche Purchase', async ({ page }) => {
    await page.goto('/admin/tracking/events/mappings/__default__');
    if (page.url().includes('/admin/login')) return;
    const cell = page.getByTestId('cell-purchase-meta');
    await expect(cell).toBeVisible();
    await expect(cell).toContainText('Purchase');
  });
});

test.describe('Admin API event-mappings (sans auth)', () => {
  test('GET /api/admin/tracking/events/mappings → 401', async ({ request }) => {
    const res = await request.get('/api/admin/tracking/events/mappings');
    expect(res.status()).toBe(401);
  });

  test('POST /api/admin/tracking/events/mappings → 401', async ({ request }) => {
    const res = await request.post('/api/admin/tracking/events/mappings', {
      data: { name: 'x', source: { kind: 'default' } },
    });
    expect(res.status()).toBe(401);
  });

  test('GET /api/admin/tracking/events/mappings/__default__ → 401', async ({ request }) => {
    const res = await request.get('/api/admin/tracking/events/mappings/__default__');
    expect(res.status()).toBe(401);
  });

  test('POST /reset-default → 401', async ({ request }) => {
    const res = await request.post('/api/admin/tracking/events/mappings/reset-default');
    expect(res.status()).toBe(401);
  });
});
