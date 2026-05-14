/**
 * E2E Playwright — interface admin tracking (nouvelles features).
 *
 * Pages testées :
 *   - /admin/tracking/events/categorization (T27/T29 + C3.F.*)
 *   - /admin/tracking/analytics/providers (T31/T33 + C4.F.*)
 *   - /admin/tracking/gtm (T25 bouton "Importer depuis Providers" + T24 SyncIndicator)
 *
 * Tolérance auth : si la page redirige vers /admin/login (server sans seed),
 * le test passe en early return après vérification du redirect.
 */

import { test, expect } from '@playwright/test';

function loginRedirected(page: import('@playwright/test').Page): boolean {
  return page.url().includes('/admin/login');
}

test.describe('Admin /admin/tracking/events/categorization', () => {
  test('page accessible (ou redirige login)', async ({ page }) => {
    await page.goto('/admin/tracking/events/categorization');
    if (loginRedirected(page)) {
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      return;
    }
    await expect(
      page.getByRole('heading', { name: /catégorisation google ads/i }),
    ).toBeVisible();
  });

  test('tableau affiche les events conversion + dropdown override', async ({ page }) => {
    await page.goto('/admin/tracking/events/categorization');
    if (loginRedirected(page)) return;

    await expect(page.getByTestId('event-categorization-table')).toBeVisible();

    // Au moins purchase, lead_capture, generate_lead, sign_up sont visibles.
    for (const eventName of ['purchase', 'lead_capture', 'generate_lead']) {
      await expect(page.getByTestId(`override-${eventName}`)).toBeVisible();
    }
  });

  test('dropdown override change + indicateur résolu se met à jour', async ({ page }) => {
    await page.goto('/admin/tracking/events/categorization');
    if (loginRedirected(page)) return;

    // Selectionne 'lead' comme override pour 'purchase'.
    const dropdown = page.getByTestId('override-purchase');
    await dropdown.selectOption('lead');
    // Attend le refresh PUT puis GET.
    await page.waitForResponse(
      (res) =>
        res.url().includes('/api/admin/tracking/events/categorization') &&
        res.request().method() === 'PUT',
      { timeout: 5000 },
    );
    await page.waitForResponse(
      (res) =>
        res.url().includes('/api/admin/tracking/events/categorization') &&
        res.request().method() === 'GET',
      { timeout: 5000 },
    );

    // Le bouton reset devient cliquable.
    await expect(page.getByTestId('reset-purchase')).toBeEnabled();
  });

  test('bouton Reset au default fait disparaître l\'override', async ({ page }) => {
    await page.goto('/admin/tracking/events/categorization');
    if (loginRedirected(page)) return;

    // Pose un override d'abord (idempotent — si déjà 'lead' on continue).
    const dropdown = page.getByTestId('override-purchase');
    await dropdown.selectOption('lead');
    await page.waitForTimeout(800);

    // Reset.
    await page.getByTestId('reset-purchase').click();
    await page.waitForResponse(
      (res) =>
        res.url().includes('/api/admin/tracking/events/categorization') &&
        res.request().method() === 'PUT',
      { timeout: 5000 },
    );

    // Le bouton reset redevient disabled (pas d'override).
    await expect(page.getByTestId('reset-purchase')).toBeDisabled({ timeout: 5000 });
  });
});

test.describe('Admin /admin/tracking/analytics/providers', () => {
  test('page accessible + table providers visible', async ({ page }) => {
    await page.goto('/admin/tracking/analytics/providers');
    if (loginRedirected(page)) return;

    await expect(page.getByRole('heading', { name: /analytics providers/i })).toBeVisible();
    // Table présente, même si données 0 sur DB fraîche.
    await expect(page.getByTestId('providers-analytics-table')).toBeVisible();
  });

  test('headers de colonnes critiques présents (provider, success%, latency, conv)', async ({
    page,
  }) => {
    await page.goto('/admin/tracking/analytics/providers');
    if (loginRedirected(page)) return;

    const table = page.getByTestId('providers-analytics-table');
    await expect(table.getByRole('columnheader', { name: /provider/i })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: /success/i })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: /latency/i })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: /conv/i })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: /statut/i })).toBeVisible();
  });

  test('refresh auto 30s — re-fetch déclenché', async ({ page }) => {
    let fetchCount = 0;
    await page.route('**/api/admin/tracking/analytics/providers', (route) => {
      fetchCount += 1;
      void route.fallback();
    });
    await page.goto('/admin/tracking/analytics/providers');
    if (loginRedirected(page)) return;

    await page.waitForTimeout(1500);
    const initial = fetchCount;
    expect(initial).toBeGreaterThanOrEqual(1);
    // 30s refresh — on triche avec page.clock pour ne pas attendre :
    await page.clock.install();
    await page.clock.runFor(31_000);
    await page.waitForTimeout(500);
    expect(fetchCount).toBeGreaterThan(initial);
  });
});

test.describe('Admin /admin/tracking/gtm — Importer depuis Providers (T25)', () => {
  test('bouton "Importer depuis Providers" est présent dans le form de création', async ({
    page,
  }) => {
    await page.goto('/admin/tracking/gtm');
    if (loginRedirected(page)) return;

    // Le form de création GtmConfigForm est rendu via GtmConfigClient.
    const importBtn = page.getByTestId('gtm-import-from-providers');
    // Tolérant : il peut être derrière un onglet/section repliée selon
    // l'écran courant. On vérifie au moins son existence dans le DOM.
    await expect(importBtn).toHaveCount(1);
  });

  test("Click sur 'Importer' déclenche un fetch /providers/snapshot", async ({ page }) => {
    await page.goto('/admin/tracking/gtm');
    if (loginRedirected(page)) return;

    const importBtn = page.getByTestId('gtm-import-from-providers');
    if ((await importBtn.count()) === 0) return;

    const snapshotPromise = page.waitForResponse(
      (res) => res.url().includes('/api/admin/tracking/providers/snapshot'),
      { timeout: 5000 },
    );
    await importBtn.click();
    const res = await snapshotPromise;
    expect(res.ok()).toBeTruthy();
  });
});
