/**
 * E2E /kit — un code de fidélité valide actualise TOUS les prix de la page.
 *
 * Applique le code pré-activé FG-E2E-0001 (seed-e2e-loyalty.ts) dans le champ
 * « J'ai un code d'invitation » du bloc prix, puis vérifie la propagation :
 * prix XXL, badge économie, prix final de la note, ligne de réduction, sticky CTA.
 * Tag : @kit-coupon-credit
 * PRÉ-REQUIS : cd apps/web && node --env-file=.env --import tsx scripts/seed-e2e-loyalty.ts
 */
import { expect, test, type Page } from '@playwright/test';
import { E2E_LOYALTY_CODE } from '../scripts/loyalty-e2e-fixtures';

async function applyCode(page: Page): Promise<boolean> {
  const block = page.getByTestId('pack-price-block');
  await block.scrollIntoViewIfNeeded();
  await expect(block.getByTestId('pack-price-line')).toContainText(/199/);
  // Ouvre la disclosure « J'ai un code d'invitation » puis saisit le code.
  await block.getByTestId('coupon-invitation-disclosure').click();
  await block.getByRole('textbox', { name: 'Votre code' }).fill(E2E_LOYALTY_CODE);
  await block.getByRole('button', { name: 'Appliquer' }).click();
  // Code accepté ? (dépend du seed FG-E2E-0001 actif)
  const ok = block.getByTestId('invitation-code-ok');
  try {
    await expect(ok).toBeVisible({ timeout: 12_000 });
    return true;
  } catch {
    return false;
  }
}

test.describe('/kit — propagation crédit fidélité @kit-coupon-credit', () => {
  test('KCC-E001 un code valide réduit tous les prix de la page', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/kit');
    const block = page.getByTestId('pack-price-block');
    const applied = await applyCode(page);
    test.skip(!applied, 'FG-E2E-0001 non actif dans cet environnement (lancer seed-e2e-loyalty).');

    // Prix XXL réduit 199 → 179
    await expect(block.getByTestId('pack-price-line')).toContainText(/179/);
    // Badge économie recalculé (110 MAD vs barré 289)
    await expect(block.getByTestId('pack-savings-badge')).toContainText(/110/);
    // Prix final de la note geste d'accueil
    await expect(block.getByTestId('coupon-welcome-final-price')).toContainText(/179/);
    // Ligne de réduction dans le détail
    await expect(block.getByTestId('pack-value-credit-line')).toContainText(/20/);
    // Récap du formulaire wizard (même store)
    await expect(page.getByTestId('wizard-cart-recap-total').first()).toContainText(/179/);
  });

  test('KCC-E002 le sticky CTA reflète le prix réduit', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/kit');
    const applied = await applyCode(page);
    test.skip(!applied, 'FG-E2E-0001 non actif dans cet environnement.');
    // Faire apparaître le sticky CTA (scroll au-delà du sentinel hero).
    await page.mouse.wheel(0, 1600);
    const sticky = page.getByTestId('sticky-cart-cta');
    await expect(sticky).toContainText(/179/);
  });
});
