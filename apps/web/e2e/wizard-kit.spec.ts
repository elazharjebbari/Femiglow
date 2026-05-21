/**
 * E2E /kit — wizard checkout embarqué (Kolenda §5).
 *
 * Tags : @wizard-render · @wizard-interaction · @wizard-responsive ·
 *        @wizard-a11y · @wizard-resume · @wizard-tracking
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('/kit — wizard render @wizard-render', () => {
  test('KitCommanderSection + WizardShell + indicator visibles', async ({
    page,
  }) => {
    await page.goto('/kit');
    const section = page.locator('[data-testid="kit-commander-section"]');
    await section.scrollIntoViewIfNeeded();
    await expect(section).toBeVisible();
    await expect(page.locator('[data-testid="wizard-shell"]')).toBeVisible();
    // Indicator 01 visible (current step lead)
    await expect(page.getByText(/01/)).toBeVisible();
  });

  test('WizardCartRecap affiche pack + total + barré', async ({ page }) => {
    await page.goto('/kit');
    await page
      .locator('[data-testid="kit-commander-section"]')
      .scrollIntoViewIfNeeded();
    const recap = page.locator('[data-testid="wizard-cart-recap"]');
    await expect(recap).toBeVisible();
    await expect(recap).toContainText(/Pack FemiGlow/);
    await expect(
      page.locator('[data-testid="wizard-cart-recap-total"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="wizard-cart-recap-compare-at"]'),
    ).toBeVisible();
  });

  test('TimeEstimateBadge ≈ 90 secondes affiché', async ({ page }) => {
    await page.goto('/kit');
    await page
      .locator('[data-testid="kit-commander-section"]')
      .scrollIntoViewIfNeeded();
    await expect(
      page.locator('[data-testid="wizard-time-estimate"]'),
    ).toContainText(/90 secondes/);
  });

  test('Step Indicator affiche durées per step', async ({ page }) => {
    await page.goto('/kit');
    await page
      .locator('[data-testid="kit-commander-section"]')
      .scrollIntoViewIfNeeded();
    await expect(
      page.locator('[data-testid="wizard-step-time-lead"]'),
    ).toContainText('60 s');
    await expect(
      page.locator('[data-testid="wizard-step-time-address"]'),
    ).toContainText('30 s');
  });

  test('CTA Step 1 label = « Continuer · paiement à la livraison »', async ({
    page,
  }) => {
    await page.goto('/kit');
    await page
      .locator('[data-testid="kit-commander-section"]')
      .scrollIntoViewIfNeeded();
    await expect(
      page.locator('[data-testid="wizard-lead-submit"]'),
    ).toContainText(/paiement à la livraison/i);
  });

  test('Consent reformulé en « Je veux être rappelée »', async ({ page }) => {
    await page.goto('/kit');
    await page
      .locator('[data-testid="kit-commander-section"]')
      .scrollIntoViewIfNeeded();
    await expect(
      page.locator('[data-testid="wizard-step-lead"]'),
    ).toContainText(/Je veux être rappelée/);
    await expect(
      page.locator('[data-testid="wizard-step-lead"]'),
    ).toContainText(/Pas de revente/);
  });
});

test.describe('/kit — wizard responsive @wizard-responsive', () => {
  test('Mobile 375 : cart-recap sticky + thumb pack visible', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/kit');
    await page
      .locator('[data-testid="kit-commander-section"]')
      .scrollIntoViewIfNeeded();
    await expect(
      page.locator('[data-testid="wizard-cart-recap"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="wizard-mobile-pack-thumb"]'),
    ).toBeVisible();
    // Pas de scroll horizontal
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    const innerWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 1);
  });

  test('Desktop 1280 : cart-recap visible mais pas de thumb pack', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/kit');
    await page
      .locator('[data-testid="kit-commander-section"]')
      .scrollIntoViewIfNeeded();
    await expect(
      page.locator('[data-testid="wizard-cart-recap"]'),
    ).toBeVisible();
    // Le thumb pack mobile est masqué (display:none via lg:hidden)
    const thumbHidden = await page
      .locator('[data-testid="wizard-mobile-pack-thumb"]')
      .evaluate((el) => window.getComputedStyle(el).display === 'none');
    expect(thumbHidden).toBe(true);
  });
});

test.describe('/kit — wizard a11y @wizard-a11y', () => {
  test('0 violation axe sérieuse/critique sur le wizard', async ({ page }) => {
    await page.goto('/kit');
    await page
      .locator('[data-testid="kit-commander-section"]')
      .scrollIntoViewIfNeeded();
    const results = await new AxeBuilder({ page })
      .include('[data-testid="kit-commander-section"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    if (serious.length > 0) {
      console.log(
        'AXE violations (wizard-kit):',
        JSON.stringify(serious, null, 2),
      );
    }
    expect(serious).toHaveLength(0);
  });
});
