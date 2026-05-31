/**
 * E2E admin `/admin/kit/composition` — éditeurs par sous-produit.
 *
 * Tag `@composition-admin`. Skip gracieux sans session admin (redirect
 * vers /admin/login).
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('/admin/kit/composition — liste @composition-admin', () => {
  test('page protégée par auth (redirect /admin/login sans session)', async ({
    page,
  }) => {
    const res = await page.goto('/admin/kit/composition');
    expect(res).not.toBeNull();
    if (page.url().includes('/admin/login')) {
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      return;
    }
    await expect(
      page.getByRole('heading', { name: /composition/i, level: 1 }),
    ).toBeVisible();
  });

  test('liste affiche les 3 sous-produits avec statut', async ({ page }) => {
    await page.goto('/admin/kit/composition');
    if (page.url().includes('/admin/login')) return;

    await expect(page.getByTestId('kit-composition-list-1-paste')).toBeVisible();
    await expect(page.getByTestId('kit-composition-list-2-powder')).toBeVisible();
    await expect(
      page.getByTestId('kit-composition-list-polissoir-step-4'),
    ).toBeVisible();
  });
});

test.describe('/admin/kit/composition/[id] — éditeur @composition-admin', () => {
  test('charge avec statut Mock par défaut', async ({ page }) => {
    await page.goto('/admin/kit/composition/1-paste');
    if (page.url().includes('/admin/login')) return;

    await expect(page.getByTestId('kit-composition-editor')).toBeVisible();
    const status = page.getByTestId('kit-composition-status');
    const text = (await status.textContent()) ?? '';
    expect(text).toMatch(/Mock|Brouillon|Publié/);
  });

  test('narrative sans ponctuation bloque le Save', async ({ page }) => {
    await page.goto('/admin/kit/composition/1-paste');
    if (page.url().includes('/admin/login')) return;

    const textarea = page.getByPlaceholder(/12 % de cire/i);
    await textarea.fill('Sans ponctuation');
    await expect(page.getByTestId('error-narrative')).toBeVisible();
    await expect(page.getByTestId('kit-composition-save')).toBeDisabled();
  });

  test('parcours nominal : Save → success', async ({ page }) => {
    await page.goto('/admin/kit/composition/1-paste');
    if (page.url().includes('/admin/login')) return;

    await page
      .getByPlaceholder(/12 % de cire/i)
      .fill('Nouvelle intro test e2e.');
    await page.getByTestId('kit-composition-save').click();
    await expect(page.getByTestId('kit-composition-success')).toBeVisible({
      timeout: 5_000,
    });
  });

  test('Reset bloque tant que RESET-COMPOSITION-1-PASTE n\'est pas saisi', async ({
    page,
  }) => {
    await page.goto('/admin/kit/composition/1-paste');
    if (page.url().includes('/admin/login')) return;

    await page.getByTestId('kit-composition-reset-open').click();
    const confirm = page.getByTestId('kit-composition-reset-confirm');
    await expect(confirm).toBeDisabled();
    await page.getByTestId('kit-composition-reset-input').fill('mauvais');
    await expect(confirm).toBeDisabled();
    await page
      .getByTestId('kit-composition-reset-input')
      .fill('RESET-COMPOSITION-1-PASTE');
    await expect(confirm).toBeEnabled();
  });
});

test.describe('/admin/kit/composition — a11y @composition-a11y', () => {
  test('0 violation axe sérieuse/critique sur l\'éditeur', async ({ page }) => {
    const res = await page.goto('/admin/kit/composition/1-paste');
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
      console.log('AXE violations (admin composition):', JSON.stringify(serious, null, 2));
    }
    expect(serious).toHaveLength(0);
  });
});
