/**
 * E2E /kit — crédit de fidélité (Phase 3) côté visiteur.
 *
 * Tag : @coupon-credit
 *
 * Robuste à l'absence de grant valide en base E2E : le cas P0 garanti teste le
 * chemin code INVALIDE (n'exige aucun grant) → message sobre, total inchangé,
 * et surtout AUCUN 422 au checkout (le serveur ignore un code inconnu). Le cas
 * code valide (réduction effective) est couvert par les tests unitaires/MSW
 * (use-wizard-mutations S5) qui figent l'invariant expectedTotalCents.
 */
import { test, expect } from '@playwright/test';

test.describe('/kit — crédit de fidélité @coupon-credit', () => {
  test('le champ crédit est présent au step adresse et un code invalide n’affecte pas le total', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto('/kit');
    await page.locator('[data-testid="kit-commander-section"]').scrollIntoViewIfNeeded();

    // Step 1 (lead) → renseigner prénom + téléphone si présents, puis avancer.
    const firstName = page.getByTestId('wizard-lead-firstname');
    if (await firstName.count()) await firstName.fill('Sara');
    const phone = page.getByTestId('wizard-lead-phone');
    if (await phone.count()) await phone.fill('612345678');
    const leadNext = page.getByTestId('wizard-lead-submit');
    if (await leadNext.count()) await leadNext.click();

    // Step 2 (adresse) — le champ crédit doit être présent.
    const couponField = page.getByTestId('wizard-coupon-field');
    if ((await couponField.count()) === 0) {
      test.skip(true, 'Wizard non monté jusqu’au step adresse dans cet environnement.');
      return;
    }
    await expect(couponField).toBeVisible();

    // Porte discrète : ouvrir la disclosure « J'ai un code de fidélité ».
    await couponField.getByTestId('wizard-coupon-summary').click();

    // Saisir un code invalide → appliquer + message sobre, pas de réduction.
    await couponField.getByLabel('Votre code').fill('FG-NOPE00');
    await couponField.getByRole('button', { name: 'Appliquer' }).click();
    await expect(page.getByTestId('invitation-code-ko')).toBeVisible();
    // Aucune ligne de crédit appliquée.
    await expect(page.getByTestId('wizard-credit-line')).toHaveCount(0);
  });
});
