/**
 * F18 — E2E redemption client : saisir un code actif → crédit → commande.
 *
 * Cliente Yasmine saisit le code PRÉ-ACTIVÉ FG-E2E-0001 (seed-e2e-loyalty.ts)
 * dans le champ du wizard : la ligne crédit apparaît, le total passe de 199 à
 * 179, la commande aboutit (INV-422 respecté côté serveur).
 * Tag : @coupon-redemption
 * PRÉ-REQUIS : cd apps/web && node --env-file=.env --import tsx scripts/seed-e2e-loyalty.ts
 */
import { expect, test, type Page } from '@playwright/test';
import { E2E_LOYALTY_CODE } from '../scripts/loyalty-e2e-fixtures';

const uniquePhone = () => `06${String(Date.now()).slice(-8)}`;

async function reachAddress(page: Page) {
  await page.goto('/kit');
  const lead = page.getByTestId('wizard-step-lead');
  await expect(lead).toBeVisible({ timeout: 30_000 });
  await lead.locator('input[name="firstName"]').fill('Yasmine');
  await lead.locator('input[name="phone"]').fill(uniquePhone());
  const consent = lead.locator('input[name="consent"]');
  if (!(await consent.isChecked())) await consent.check();
  await page.getByTestId('wizard-lead-submit').click();
  await expect(page.getByTestId('wizard-step-address')).toBeVisible({ timeout: 25_000 });
  const city = page.getByTestId('wizard-address-city');
  await city.fill('Casablanca');
  const option = page.locator('[data-testid^="wizard-address-city-option-"]').first();
  await option.waitFor({ state: 'visible', timeout: 15_000 });
  await option.click();
  await page.getByTestId('wizard-address-line1').fill('12 rue des Lilas');
}

test.describe('parcours fidélité — redemption @coupon-redemption', () => {
  test('F18-E001 code actif → crédit appliqué (199 → 179) puis commande', async ({ page }) => {
    test.setTimeout(90_000);
    await reachAddress(page);

    // Ouvre la disclosure code de fidélité et saisit le code pré-activé.
    // NB: /kit contient AUSSI un InvitationCodeField dans CouponWelcomeNote →
    // on scope STRICTEMENT au champ du wizard (data-testid wizard-coupon-field).
    const couponField = page.getByTestId('wizard-coupon-field');
    const summary = page.getByTestId('wizard-coupon-summary');
    if ((await summary.count()) > 0) await summary.click();
    await couponField.getByRole('textbox', { name: 'Votre code' }).fill(E2E_LOYALTY_CODE);
    await couponField.getByRole('button', { name: 'Appliquer' }).click();

    // Crédit validé → message OK + ligne crédit + total réduit.
    await expect(couponField.getByTestId('invitation-code-ok')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('wizard-credit-line')).toBeVisible();
    await expect(page.getByTestId('wizard-cart-recap-total').first()).toContainText(/179/);

    // La commande aboutit (INV-422 : expectedTotalCents aligné côté serveur).
    // Plus lourd que F17 (émission + redemption de grant) → marge élargie.
    await page.getByTestId('wizard-address-submit').click();
    await expect(page.getByTestId('wizard-step-thankyou')).toBeVisible({ timeout: 45_000 });
  });

  test('F18-E002 code inconnu → message d’erreur, total inchangé', async ({ page }) => {
    test.setTimeout(90_000);
    await reachAddress(page);
    const couponField = page.getByTestId('wizard-coupon-field');
    const summary = page.getByTestId('wizard-coupon-summary');
    if ((await summary.count()) > 0) await summary.click();
    await couponField.getByRole('textbox', { name: 'Votre code' }).fill('FG-NOPE-0000');
    await couponField.getByRole('button', { name: 'Appliquer' }).click();
    await expect(couponField.getByTestId('invitation-code-ko')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('wizard-cart-recap-total').first()).toContainText(/199/);
  });
});
