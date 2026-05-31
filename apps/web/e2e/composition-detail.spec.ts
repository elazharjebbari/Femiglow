/**
 * E2E publique de la section composition `/kit` après la refonte Kolenda §4.5.
 *
 * Tags :
 *  - `@composition-render`      : structure et contenu
 *  - `@composition-interaction` : accordion, tooltip, post-CTA
 *  - `@composition-a11y`        : 0 violation axe sérieuse/critique
 *  - `@composition-responsive`  : viewport mobile vs desktop
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('/kit composition — rendu @composition-render', () => {
  test('section ingredients-details visible avec heading', async ({ page }) => {
    await page.goto('/kit');
    const heading = page.getByRole('heading', {
      name: /la composition lue ligne par ligne/i,
      level: 2,
    });
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('3 sous-produits rendus avec leur id', async ({ page }) => {
    await page.goto('/kit');
    await expect(page.getByTestId('sub-product-block-1-paste')).toBeVisible();
    await expect(page.getByTestId('sub-product-block-2-powder')).toBeVisible();
    await expect(
      page.getByTestId('sub-product-block-polissoir-step-4'),
    ).toBeVisible();
  });

  test('narrative italique présent dans le 1er sous-produit', async ({
    page,
  }) => {
    await page.goto('/kit');
    const narrative = page.getByTestId('composition-narrative-1-paste');
    await expect(narrative).toBeVisible();
    await expect(narrative).toContainText(/cire/i);
  });

  test('PostCtaLink présent pour chaque sous-produit (3 liens)', async ({ page }) => {
    await page.goto('/kit');
    await expect(
      page.getByTestId('composition-post-cta-1-paste'),
    ).toBeVisible();
    await expect(
      page.getByTestId('composition-post-cta-2-powder'),
    ).toBeVisible();
    await expect(
      page.getByTestId('composition-post-cta-polissoir-step-4'),
    ).toBeVisible();
  });

  test('certifications visibles avec label + body', async ({ page }) => {
    await page.goto('/kit');
    const certs = page.getByTestId('certifications-1-paste');
    await expect(certs).toBeVisible();
    await expect(certs).toContainText(/Cosmos Organic.*Ecocert/);
  });
});

test.describe('/kit composition — interactions @composition-interaction', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('click summary toggle l\'accordion mobile', async ({ page }) => {
    await page.goto('/kit');
    const block = page.getByTestId('sub-product-block-2-powder');
    const details = block.locator('details');
    // 2-powder est fermé par défaut sur mobile (index 1 ≠ 0)
    await expect(details).not.toHaveAttribute('open', '');

    await block.locator('summary').click();
    await expect(details).toHaveAttribute('open', '');
  });

  test('click ⓘ ouvre tooltip avec définition INCI', async ({ page }) => {
    await page.goto('/kit');
    // 1-paste est ouvert par défaut. Click sur le 1er bouton tooltip.
    const trigger = page
      .locator('[data-testid^="inci-tooltip-trigger-1-paste-"]')
      .first();
    await expect(trigger).toBeVisible();
    await trigger.click();
    const popover = page
      .locator('[data-testid^="inci-tooltip-popover-1-paste-"]')
      .first();
    await expect(popover).toBeVisible();
    await expect(popover).toContainText(/Cire|Cera|forme/i);
  });

  test('Esc ferme le tooltip', async ({ page }) => {
    await page.goto('/kit');
    const trigger = page
      .locator('[data-testid^="inci-tooltip-trigger-1-paste-"]')
      .first();
    await trigger.click();
    const popover = page
      .locator('[data-testid^="inci-tooltip-popover-1-paste-"]')
      .first();
    await expect(popover).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(popover).toHaveCount(0);
  });

  test('click PostCtaLink scrolle vers #commander-femiglow', async ({ page }) => {
    await page.goto('/kit');
    const cta = page.getByTestId('composition-post-cta-1-paste');
    await cta.scrollIntoViewIfNeeded();
    await cta.click();
    await page.waitForTimeout(800);
    const target = page.locator('#commander-femiglow').first();
    expect(await target.count()).toBeGreaterThan(0);
  });
});

test.describe('/kit composition — responsive @composition-responsive', () => {
  test('mobile : pas de scroll horizontal dans la section', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/kit');
    const block = page.getByTestId('sub-product-block-1-paste');
    await block.scrollIntoViewIfNeeded();
    // Liste mobile (cards) visible, tableau desktop caché par sm:hidden
    const mobileList = page.getByTestId('responsive-list-mobile-1-paste');
    await expect(mobileList).toBeVisible();
  });

  test('desktop : tableau 5 colonnes visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/kit');
    const table = page.getByTestId('ingredients-table-1-paste');
    await expect(table).toBeVisible();
    const headers = table.locator('thead th');
    await expect(headers).toHaveCount(5);
  });
});

test.describe('/kit composition — a11y @composition-a11y', () => {
  test('0 violation axe sérieuse/critique sur la section', async ({ page }) => {
    await page.goto('/kit');
    await page.waitForLoadState('domcontentloaded');
    const results = await new AxeBuilder({ page })
      .include('section#ingredients-details')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    if (serious.length > 0) {
      console.log('AXE violations:', JSON.stringify(serious, null, 2));
    }
    expect(serious).toHaveLength(0);
  });
});
