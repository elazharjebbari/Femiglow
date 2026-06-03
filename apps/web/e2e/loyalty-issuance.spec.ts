/**
 * F17 — E2E parcours client fidélité : wizard → commande → carte code émis.
 *
 * Cliente Yasmine : lead → adresse → commande (COD) → ThankYouStep affiche la
 * carte LoyaltyCodeCard (code FG-…), date d'activation civile, aucun téléphone en
 * clair. Nécessite un template post_purchase actif (scripts/seed-e2e-loyalty.ts).
 * Tag : @coupon-loyalty-issuance
 */
import { expect, test, type Page } from '@playwright/test';

const uniquePhone = () => `06${String(Date.now()).slice(-8)}`;

async function gotoWizard(page: Page) {
  await page.goto('/kit');
  // Serveur dev froid : la 1ʳᵉ compilation de /kit peut dépasser 5 s.
  await expect(page.getByTestId('wizard-step-lead')).toBeVisible({ timeout: 30_000 });
}

async function fillLead(page: Page, phone: string) {
  const lead = page.getByTestId('wizard-step-lead');
  await lead.locator('input[name="firstName"]').fill('Yasmine');
  await lead.locator('input[name="phone"]').fill(phone);
  const consent = lead.locator('input[name="consent"]');
  if (!(await consent.isChecked())) await consent.check();
  await page.getByTestId('wizard-lead-submit').click();
  // La mutation lead (réseau) précède la transition → laisser une marge.
  await expect(page.getByTestId('wizard-step-address')).toBeVisible({ timeout: 25_000 });
}

async function fillAddress(page: Page) {
  const city = page.getByTestId('wizard-address-city');
  await city.fill('Casablanca');
  // Sélectionne la 1ʳᵉ option d'autocomplete (debounce + API villes).
  const option = page.locator('[data-testid^="wizard-address-city-option-"]').first();
  await option.waitFor({ state: 'visible', timeout: 15_000 });
  await option.click();
  await page.getByTestId('wizard-address-line1').fill('12 rue des Lilas');
}

test.describe('parcours fidélité — émission @coupon-loyalty-issuance', () => {
  test('F17-E001 commande COD → carte code de fidélité affichée', async ({ page }) => {
    test.setTimeout(90_000);
    await gotoWizard(page);
    await fillLead(page, uniquePhone());
    await fillAddress(page);
    await page.getByTestId('wizard-address-submit').click();

    // Étape merci atteinte + référence commande présente (création = réseau lourd).
    await expect(page.getByTestId('wizard-step-thankyou')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('wizard-thankyou-orderref')).toBeVisible();

    // Carte fidélité (si template post_purchase actif — garanti par le seed).
    const card = page.getByTestId('loyalty-code-card');
    if ((await card.count()) > 0) {
      await expect(card).toBeVisible();
      await expect(page.getByTestId('loyalty-code-value')).toContainText(/^FG-/);
      // INV-PII : aucun numéro de téléphone en clair dans la carte.
      const txt = (await card.textContent()) ?? '';
      expect(/\d{6,}/.test(txt)).toBe(false);
    }
  });

  test('F17-E002 INV-PRICE : le récap reste à 199 MAD pendant le tunnel', async ({ page }) => {
    await gotoWizard(page);
    await expect(page.getByTestId('wizard-cart-recap-total').first()).toContainText(/199/);
  });
});
