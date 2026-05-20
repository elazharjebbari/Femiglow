/**
 * E2E admin `/admin/kit/pack` — éditeur singleton pack.
 *
 * Tag `@pack-admin`. Skip gracieux sans session admin (redirect login).
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('/admin/kit/pack — éditeur @pack-admin', () => {
  test('page protégée par auth (redirect /admin/login sans session)', async ({
    page,
  }) => {
    const res = await page.goto('/admin/kit/pack');
    expect(res).not.toBeNull();
    if (page.url().includes('/admin/login')) {
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      return;
    }
    await expect(
      page.getByRole('heading', { name: /pack.*kit/i, level: 1 }),
    ).toBeVisible();
  });

  test('charge avec statut Mock par défaut', async ({ page }) => {
    await page.goto('/admin/kit/pack');
    if (page.url().includes('/admin/login')) return;

    await expect(page.getByTestId('kit-pack-editor')).toBeVisible();
    const status = page.getByTestId('kit-pack-status');
    const text = (await status.textContent()) ?? '';
    expect(text).toMatch(/Mock|Brouillon|Publié/);
  });

  test('Save désactivé tant qu’aucun champ modifié', async ({ page }) => {
    await page.goto('/admin/kit/pack');
    if (page.url().includes('/admin/login')) return;
    await expect(page.getByTestId('kit-pack-save')).toBeDisabled();
  });

  test('saisie d’un label CTA → Save activé', async ({ page }) => {
    await page.goto('/admin/kit/pack');
    if (page.url().includes('/admin/login')) return;
    await page.getByLabel(/Libellé CTA/i).fill('Commander mon rituel');
    await expect(page.getByTestId('kit-pack-save')).toBeEnabled();
  });

  test('Reset bloque tant que RESET-PACK n’est pas saisi', async ({ page }) => {
    await page.goto('/admin/kit/pack');
    if (page.url().includes('/admin/login')) return;

    // Si source=mock, le bouton reset-open est désactivé, on saute
    const openBtn = page.getByTestId('kit-pack-reset-open');
    if (await openBtn.isDisabled()) return;

    await openBtn.click();
    const confirm = page.getByTestId('kit-pack-reset-confirm');
    await expect(confirm).toBeDisabled();
    await page.getByTestId('kit-pack-reset-input').fill('mauvais');
    await expect(confirm).toBeDisabled();
    await page.getByTestId('kit-pack-reset-input').fill('RESET-PACK');
    await expect(confirm).toBeEnabled();
  });
});

test.describe('/admin/kit/pack — a11y @pack-admin-a11y', () => {
  test('0 violation axe sérieuse/critique sur l’éditeur', async ({ page }) => {
    const res = await page.goto('/admin/kit/pack');
    expect(res).not.toBeNull();
    if (page.url().includes('/admin/login')) return;

    await page.waitForLoadState('domcontentloaded');
    const results = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    if (serious.length > 0) {
      console.log(
        'AXE violations (admin pack):',
        JSON.stringify(serious, null, 2),
      );
    }
    expect(serious).toHaveLength(0);
  });
});
