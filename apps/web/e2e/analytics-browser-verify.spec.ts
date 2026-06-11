/**
 * Vérification navigateur (Chromium) des corrections analytics : AF-01 (réactivité
 * réelle des filtres) et refresh manuel. Utilise le pattern e2e standard du repo
 * (storageState admin produit par `global.setup.ts`) — comme `admin-analytics-
 * insights.spec.ts`. Requiert donc l'environnement e2e complet (serveur + DB).
 *
 * NB : la vérification du pipeline d'export PNG (F-INS-05), elle, est autonome
 * (sans auth) dans `png-export-browser.spec.ts`.
 * cf. docs/analytics-audit-qa-2026-05-30.
 */
import { test, expect } from '@playwright/test';

import { ADMIN_STORAGE_PATH } from './helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

test.describe('Analytics — vérification navigateur (UI admin)', () => {
  test('AF-01 — changer la période refetch réellement le dashboard CTA', async ({ page }) => {
    await page.goto('/admin/analytics/cta?period=7d&device=all&traffic=all');
    await expect(page.getByTestId('cta-dashboard')).toBeVisible({ timeout: 30_000 });

    const [req] = await Promise.all([
      page.waitForRequest(
        (r) => r.url().includes('/api/admin/analytics/cta') && r.url().includes('period=30d'),
        { timeout: 15_000 },
      ),
      page.getByTestId('filter-period').selectOption('30d'),
    ]);
    expect(req.url()).toContain('period=30d');
    await expect(page).toHaveURL(/period=30d/);
  });

  test('Refresh manuel — POST /api/admin/analytics/refresh (200, cacheCleared)', async ({ page }) => {
    await page.goto('/admin/analytics/funnel');
    await expect(page.getByTestId('analytics-refresh')).toBeVisible({ timeout: 30_000 });

    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/api/admin/analytics/refresh') && r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      page.getByTestId('analytics-refresh').click(),
    ]);
    expect(resp.status()).toBe(200);
    const body = (await resp.json()) as { ok: boolean; cacheCleared: boolean };
    expect(body.ok).toBe(true);
    expect(body.cacheCleared).toBe(true);
  });
});
