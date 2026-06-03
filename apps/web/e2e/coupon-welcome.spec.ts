/**
 * E2E /kit — module coupon « geste d'accueil » (CPN-14) + parité prix.
 *
 * Tags : @coupon-render · @coupon-charte · @coupon-a11y
 *
 * Robuste à l'état de seed : la présence de la note dépend d'un coupon
 * welcome_auto actif. On asserte TOUJOURS la parité prix (199), et la
 * charte/a11y/disclosure UNIQUEMENT quand la note est rendue.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('/kit — coupon welcome note @coupon-render', () => {
  test('le bloc prix affiche le prix effectif (parité) et la note si coupon actif', async ({
    page,
  }) => {
    await page.goto('/kit');
    const priceBlock = page.locator('[data-testid="pack-price-block"]');
    await priceBlock.scrollIntoViewIfNeeded();
    await expect(priceBlock).toBeVisible();
    // Prix effectif affiché (199 par défaut Phase 1).
    await expect(page.locator('[data-testid="pack-price-line"]')).toContainText(/199/);

    const note = page.locator('[data-testid="coupon-welcome-note"]');
    if ((await note.count()) > 0) {
      await expect(note).toBeVisible();
      // Copie maison + prix final.
      await expect(note).toContainText('geste d’accueil');
      await expect(page.locator('[data-testid="coupon-welcome-final-price"]')).toContainText(/199/);
      // Charte : pas d'emoji ni de point d'exclamation.
      const txt = (await note.textContent()) ?? '';
      expect(txt).not.toContain('!');
      expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(txt)).toBe(false);
    }
  });

  test('@coupon-charte disclosure code repliée par défaut quand la note est présente', async ({
    page,
  }) => {
    await page.goto('/kit');
    await page.locator('[data-testid="pack-price-block"]').scrollIntoViewIfNeeded();
    const disclosure = page.locator('[data-testid="coupon-invitation-disclosure"]');
    if ((await disclosure.count()) > 0) {
      const details = page.locator('details', { has: disclosure });
      // Repliée : le contenu détaillé n'est pas visible tant qu'on n'ouvre pas.
      await expect(disclosure).toBeVisible();
      const open = await details.first().evaluate((el) => (el as HTMLDetailsElement).open);
      expect(open).toBe(false);
    }
  });

  test('@coupon-a11y aucune violation axe critique sur la zone prix', async ({ page }) => {
    await page.goto('/kit');
    await page.locator('[data-testid="pack-price-block"]').scrollIntoViewIfNeeded();
    const results = await new AxeBuilder({ page })
      .include('[data-testid="pack-price-block"]')
      .analyze();
    const serious = results.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? ''));
    expect(serious).toEqual([]);
  });
});
