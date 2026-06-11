/**
 * E2E /kit — visibilité du coupon d'accueil dans le tunnel de paiement.
 * Tag : @coupon-checkout
 *
 * Robuste : si le coupon welcome_auto n'est pas actif dans l'env, la mention
 * est absente → test.skip propre (pas de faux négatif).
 */
import { test, expect } from '@playwright/test';

test.describe('/kit — coupon d’accueil au paiement @coupon-checkout', () => {
  test('le récap du wizard rappelle le geste d’accueil + l’économie absolue', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto('/kit');
    await page.locator('[data-testid="kit-commander-section"]').scrollIntoViewIfNeeded();

    const recap = page.locator('[data-testid="wizard-cart-recap"]');
    await expect(recap).toBeVisible();

    const welcome = page.locator('[data-testid="wizard-welcome-coupon"]');
    if ((await welcome.count()) === 0) {
      test.skip(true, 'Coupon welcome_auto non actif dans cet environnement.');
      return;
    }

    await expect(welcome).toBeVisible();
    // Économie absolue (pas de %), accent terracotta, voix maison.
    await expect(page.locator('[data-testid="wizard-welcome-economy"]')).toContainText(/Économie|توفير/);
    const txt = (await welcome.textContent()) ?? '';
    expect(txt).not.toContain('%');
    expect(txt).not.toContain('!');
    expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(txt)).toBe(false);
    // Pas de countdown / minuterie.
    expect(txt.toLowerCase()).not.toMatch(/\d+\s*:\s*\d+|countdown|expire/);
  });
});
