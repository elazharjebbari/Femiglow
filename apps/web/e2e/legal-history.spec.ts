/**
 * E2E — historique d'une page légale.
 *
 * Pré-requis : au moins une page publiée avec ≥ 1 version historisée.
 * Skip propre si pas trouvé.
 *
 * Note routing : on ne teste PAS ici le clic sur le `<Link>` "Éditer"
 * (couvert par `legal-admin.spec.ts`). Le focus est l'HistoryDrawer.
 * On résout le slug depuis l'URL du premier link "Éditer" puis on
 * navigue directement via `page.goto()` — déterministe, pas de timing
 * sur la soft-nav Next.js.
 */
import { test, expect } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';

test.use({ storageState: ADMIN_STORAGE_PATH });

async function ensureAuthOrSkip(page: import('@playwright/test').Page) {
  if (page.url().includes('/admin/login')) test.skip();
}

async function gotoFirstEditPage(
  page: import('@playwright/test').Page,
): Promise<boolean> {
  await page.goto('/admin/legal');
  if (page.url().includes('/admin/login')) {
    test.skip();
    return false;
  }
  const firstEdit = page.getByRole('link', { name: /Éditer/ }).first();
  if (!(await firstEdit.isVisible().catch(() => false))) {
    return false;
  }
  const href = await firstEdit.getAttribute('href');
  if (!href) return false;
  await page.goto(href);
  await expect(page).toHaveURL(/\/admin\/legal\/[^/]+\/edit/, { timeout: 15_000 });
  return true;
}

test.describe('admin legal — history drawer', () => {
  test('bouton Historique ouvre un dialog avec aria-modal', async ({ page }) => {
    await ensureAuthOrSkip(page);
    const ok = await gotoFirstEditPage(page);
    if (!ok) {
      test.skip();
      return;
    }

    await page.getByRole('button', { name: /Historique/ }).click();
    const dialog = page.getByRole('dialog', { name: /Historique/i });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  test('fermer le drawer avec ✕', async ({ page }) => {
    await ensureAuthOrSkip(page);
    const ok = await gotoFirstEditPage(page);
    if (!ok) {
      test.skip();
      return;
    }

    await page.getByRole('button', { name: /Historique/ }).click();
    await page.getByLabel(/Fermer l'historique/).click();
    await expect(page.getByRole('dialog', { name: /Historique/i })).not.toBeVisible();
  });

  test('si page a des versions, on les voit listées', async ({ page }) => {
    await ensureAuthOrSkip(page);
    const ok = await gotoFirstEditPage(page);
    if (!ok) {
      test.skip();
      return;
    }

    await page.getByRole('button', { name: /Historique/ }).click();

    // Attend que le loader "Chargement…" disparaisse (API history peut
    // mettre 5-10 s en dev mode à la 1re requête → compile + query DB).
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/Chargement…/)).toBeHidden({ timeout: 15_000 });

    // Soit on a au moins 1 version (v1, v2...), soit on a le message
    // "Aucune version historisée". Les 2 cas sont valides.
    const hasVersions = await dialog
      .locator('text=/^v\\d+/')
      .first()
      .isVisible()
      .catch(() => false);
    const hasEmpty = await dialog
      .locator('text=Aucune version historisée')
      .isVisible()
      .catch(() => false);
    expect(hasVersions || hasEmpty).toBe(true);
  });
});
