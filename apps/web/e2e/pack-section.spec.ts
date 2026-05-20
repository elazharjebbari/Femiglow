/**
 * E2E /kit — section « Le Pack » (Kolenda §4.6).
 *
 * Tags : @pack-render · @pack-interaction · @pack-a11y · @pack-responsive
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('/kit — section pack @pack-render', () => {
  test('rend la section #product-feed avec prix, savings et CTA', async ({ page }) => {
    await page.goto('/kit');

    const section = page.locator('[data-testid="product-feed-section"]');
    await expect(section).toBeVisible();

    const block = page.locator('[data-testid="pack-price-block"]');
    await expect(block).toBeVisible();
    await expect(block).toHaveAttribute('data-cta-accent', /sauge-dark|champagne|terracotta/);

    // Bandeau économie présent (mock produit le savings ~29 %)
    const badge = page.locator('[data-testid="pack-savings-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText(/économisez/i);

    // ValueBreakdownList visible
    await expect(page.locator('[data-testid="pack-value-breakdown"]')).toBeVisible();

    // CTA labelé "Commander le rituel"
    await expect(
      page.locator('[data-testid="kit-commander-anchor-button"]'),
    ).toContainText('Commander le rituel');

    // Social proof condensé sous le CTA
    const socialProof = page.locator('[data-testid="pack-social-proof"]');
    await expect(socialProof).toBeVisible();
    await expect(socialProof).toContainText('4,8/5');
  });

  test('packshot visible (PackVisual)', async ({ page }) => {
    await page.goto('/kit');
    const visual = page.locator('[data-testid="pack-visual"]');
    await expect(visual).toBeVisible();
    await expect(visual).toHaveAttribute('data-src', /kit-principale\.svg/);
  });
});

test.describe('/kit — interaction @pack-interaction', () => {
  test('click CTA → scroll vers #commander-femiglow', async ({ page }) => {
    await page.goto('/kit');
    const cta = page.locator('[data-testid="pack-price-block"] [data-testid="kit-commander-anchor-button"]');
    await cta.scrollIntoViewIfNeeded();
    await cta.click();
    // Attendre que la zone wizard soit visible
    await expect(page.locator('#commander-femiglow')).toBeInViewport({ timeout: 3000 });
  });
});

test.describe('/kit — responsive @pack-responsive', () => {
  test('mobile 375×812 : layout 1 colonne, pas de scroll horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/kit');
    await expect(page.locator('[data-testid="pack-price-block"]')).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const innerWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 1);
  });

  test('desktop 1280×800 : prix et packshot tous deux visibles', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/kit');
    await expect(page.locator('[data-testid="pack-price-block"]')).toBeVisible();
    await expect(page.locator('[data-testid="pack-visual"]')).toBeVisible();
  });
});

test.describe('/kit — a11y @pack-a11y', () => {
  test('0 violation axe sérieuse/critique sur la section pack', async ({ page }) => {
    await page.goto('/kit');
    await page.locator('[data-testid="product-feed-section"]').scrollIntoViewIfNeeded();
    const results = await new AxeBuilder({ page })
      .include('[data-testid="product-feed-section"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    if (serious.length > 0) {
      console.log(
        'AXE violations (pack):',
        JSON.stringify(serious, null, 2),
      );
    }
    expect(serious).toHaveLength(0);
  });
});
