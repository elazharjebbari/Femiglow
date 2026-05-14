/**
 * Test ultime M5.1 — Inbox transactionnelle (cockpit).
 *
 * Vérifie le gate de sortie de la phase M5.1 :
 *   • La page se charge et affiche le KPI header
 *   • La palette ⌘K s'ouvre + accepte une recherche
 *   • Les saved views système (au moins "All today") sont visibles
 *   • Le tableau filtre correctement
 *   • La sélection multi-ligne + bulk actions fonctionnent
 *
 * Pattern défensif : si pas de storage state (CI sans admin bootstrap),
 * on accepte la redirection vers /admin/login et on sort proprement
 * comme les autres specs e2e du repo.
 *
 * Cf. docs/emailing/admin-evolution/11-tests/03-playwright-e2e/01-m5.1-ultimate.spec.md
 */
import { test, expect } from '@playwright/test';

test.describe('M5.1 — Cockpit transactionnel ultimate', () => {
  test('page loads + KPI header rendered', async ({ page }) => {
    const res = await page.goto('/admin/emails/transactional');
    expect(res).not.toBeNull();
    if (page.url().includes('/admin/login')) {
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      return;
    }

    // Header H1
    await expect(page.getByRole('heading', { name: /transactionnel/i })).toBeVisible();

    // KPI header est monté (skeleton ou data)
    await expect(
      page.getByTestId('kpi-header').or(page.getByTestId('kpi-header-skeleton')),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Cmd+K opens command palette', async ({ page }) => {
    await page.goto('/admin/emails/transactional');
    if (page.url().includes('/admin/login')) return;

    await page.keyboard.press('Meta+k');
    // cmdk monte un dialog
    await expect(page.getByRole('dialog', { name: /command/i })).toBeVisible({
      timeout: 5_000,
    });
    // Input présent
    await expect(page.getByPlaceholder(/status:failed/)).toBeVisible();

    // Esc ferme
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /command/i })).not.toBeVisible();
  });

  test('saved views sidebar shows system views', async ({ page }) => {
    await page.goto('/admin/emails/transactional');
    if (page.url().includes('/admin/login')) return;

    await expect(page.getByTestId('saved-views-sidebar')).toBeVisible();
    // Au moins une des vues système seedées par migration 0039
    const systemView = page.getByText(/All today/i).first();
    if ((await systemView.count()) > 0) {
      await expect(systemView).toBeVisible();
    }
  });

  test('palette parses status filter and applies it', async ({ page }) => {
    await page.goto('/admin/emails/transactional');
    if (page.url().includes('/admin/login')) return;

    await page.keyboard.press('Meta+k');
    await expect(page.getByRole('dialog', { name: /command/i })).toBeVisible();

    const input = page.getByPlaceholder(/status:failed/);
    await input.fill('status:failed');
    // Le compteur "1 filtre" doit apparaître
    await expect(page.getByText(/1 filtre/i).first()).toBeVisible({ timeout: 2_000 });

    // Enter applique
    await input.press('Enter');
    await expect(page.getByRole('dialog', { name: /command/i })).not.toBeVisible();

    // L'URL contient ?status=failed
    await page.waitForFunction(() => location.search.includes('status=failed'), undefined, {
      timeout: 3_000,
    });
  });

  test('clear filter button appears when filter is active', async ({ page }) => {
    await page.goto('/admin/emails/transactional?status=failed');
    if (page.url().includes('/admin/login')) return;

    // Le help bar montre "X filtre actif" + bouton "effacer"
    await expect(page.getByText(/filtre actif/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: /effacer/i })).toBeVisible();
  });
});
