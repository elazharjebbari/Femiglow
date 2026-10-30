/**
 * Kit CRO v2 §2 — formulaire « Commander » ouvert dans un panneau (`?cta=sheet`).
 *
 * Couvre, en mobile 375 px :
 *   1. ouverture depuis le CTA du hero et depuis la barre sticky ;
 *   2. `role="dialog"` nommé, focus dans le panneau, page non défilée ;
 *   3. fermeture par Échap et par le bouton retour du navigateur (URL inchangée) ;
 *   4. saisie conservée après fermeture / réouverture (store persistant) ;
 *   5. étape lead complète DANS le panneau → étape adresse, titre focalisé ;
 *   6. arrivée avec `#commander-femiglow` → panneau ouvert ;
 *   7. `?cta=scroll` → parcours historique (défilement, aucun panneau).
 *
 * E2E réel (dev server + base seedée, comme `checkout-wizard-kit.spec.ts`) :
 * l'étape lead crée un vrai lead.
 */
import { expect, test, type Page } from '@playwright/test';

const SHEET_URL = '/kit?cta=sheet';
const PHONE = '612345678';

test.use({ viewport: { width: 375, height: 812 } });

const sheet = (page: Page) => page.getByRole('dialog', { name: /commander le rituel/i });
const heroCta = (page: Page) =>
  page.locator('[data-testid="kit-commander-anchor-button"]:not([data-cta-source])').first();
const stickyCta = (page: Page) =>
  page.getByTestId('sticky-cart-cta').getByTestId('kit-commander-anchor-button');

/** Le mode est résolu après hydratation : on attend que la section l'affiche. */
async function gotoSheetMode(page: Page, url = SHEET_URL): Promise<void> {
  await page.goto(url);
  await expect(page.getByTestId('kit-commander-section')).toHaveAttribute(
    'data-commander-mode',
    'sheet',
  );
}

async function focusIsInsideDialog(page: Page): Promise<boolean> {
  return page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
}

test.describe('Kit CRO v2 — panneau de commande (?cta=sheet)', () => {
  test('CTA du hero : panneau ouvert, nommé, focus dedans, page non défilée', async ({ page }) => {
    await gotoSheetMode(page);
    const cta = heroCta(page);
    await expect(cta).toBeVisible();
    const scrollBefore = await page.evaluate(() => window.scrollY);

    await cta.click();
    const dialog = sheet(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect.poll(() => focusIsInsideDialog(page)).toBe(true);
    await expect(dialog.getByTestId('wizard-step-lead')).toBeVisible();
    // Le formulaire en ligne a cédé la place à l'emplacement réservé.
    await expect(page.getByTestId('wizard-shell')).toHaveCount(1);
    await expect(page.getByTestId('kit-commander-sheet-placeholder')).toBeAttached();
    // Pas de défilement vers la section (≈ 8 700 px plus bas).
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore)).toBeLessThan(50);
  });

  test('barre sticky : ouvre le panneau et se masque pendant l’ouverture', async ({ page }) => {
    await gotoSheetMode(page);
    await page.evaluate(() => window.scrollTo(0, 2500));
    const bar = page.getByTestId('sticky-cart-cta');
    await expect(bar).toHaveAttribute('data-visible', 'true');

    await stickyCta(page).click();
    await expect(sheet(page)).toBeVisible();
    await expect(bar).toHaveAttribute('data-commander-sheet-open', 'true');
    await expect(bar).toHaveAttribute('data-visible', 'false');

    await page.keyboard.press('Escape');
    await expect(sheet(page)).toBeHidden();
    await expect(bar).toHaveAttribute('data-commander-sheet-open', 'false');
  });

  test('Échap ferme et rend le focus au bouton du hero', async ({ page }) => {
    await gotoSheetMode(page);
    const cta = heroCta(page);
    await cta.click();
    await expect(sheet(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toBeHidden();
    await expect(cta).toBeFocused();
  });

  test('bouton retour du navigateur : ferme le panneau sans quitter la page', async ({ page }) => {
    await gotoSheetMode(page);
    const urlBefore = page.url();
    await heroCta(page).click();
    await expect(sheet(page)).toBeVisible();

    await page.goBack();
    await expect(sheet(page)).toBeHidden();
    expect(page.url()).toBe(urlBefore);
    await expect(page.getByTestId('kit-commander-section')).toBeAttached();

    // Fermer par la croix ne doit pas faire reculer d'une page de plus.
    await heroCta(page).click();
    await expect(sheet(page)).toBeVisible();
    await sheet(page)
      .getByRole('button', { name: /fermer le formulaire de commande/i })
      .click();
    await expect(sheet(page)).toBeHidden();
    expect(page.url()).toBe(urlBefore);
  });

  test('saisie conservée après fermeture puis réouverture', async ({ page }) => {
    await gotoSheetMode(page);
    await heroCta(page).click();
    const lead = sheet(page).getByTestId('wizard-step-lead');
    await lead.locator('input[name="firstName"]').fill('Salma');
    await lead.locator('input[name="phone"]').pressSequentially(PHONE, { delay: 20 });

    await page.keyboard.press('Escape');
    await expect(sheet(page)).toBeHidden();
    // De retour en ligne, la saisie est là…
    await expect(
      page.getByTestId('kit-commander-section').locator('input[name="firstName"]'),
    ).toHaveValue('Salma');

    // …et dans le panneau rouvert.
    await heroCta(page).click();
    const reopened = sheet(page).getByTestId('wizard-step-lead');
    await expect(reopened.locator('input[name="firstName"]')).toHaveValue('Salma');
    await expect(reopened.locator('input[name="phone"]')).not.toHaveValue('');
  });

  test('étape lead complète dans le panneau (375 px) → étape adresse', async ({ page }) => {
    test.setTimeout(60_000);
    await gotoSheetMode(page);
    await heroCta(page).click();
    const dialog = sheet(page);
    const lead = dialog.getByTestId('wizard-step-lead');
    await expect(lead).toBeVisible();

    // Le panneau tient dans l'écran (marge haute visible, pas de débordement).
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThan(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(812 + 1);
    expect(box!.width).toBeLessThanOrEqual(375);

    await lead.locator('input[name="firstName"]').fill('Amal');
    await lead.locator('input[name="phone"]').pressSequentially(PHONE, { delay: 20 });
    await lead.locator('input[name="consent"]').check();
    const submit = dialog.getByTestId('wizard-lead-submit');
    await expect(submit).toBeEnabled();
    await submit.click();

    const address = dialog.getByTestId('wizard-step-address');
    await expect(address).toBeVisible({ timeout: 15_000 });
    // Changement d'étape : focus sur le titre du step, en haut du panneau.
    await expect(address.getByRole('heading', { level: 2 })).toBeFocused();
    await expect(address.getByRole('heading', { level: 2 })).toBeInViewport();
    expect(
      await dialog.getByTestId('kit-commander-sheet-body').evaluate((el) => el.scrollTop),
    ).toBeLessThan(5);
    // Le récap panier reste collé en haut du panneau.
    await expect(dialog.getByTestId('wizard-cart-recap')).toBeInViewport();
    await expect(dialog.getByTestId('wizard-address-city')).toBeVisible();
  });

  test('arrivée avec #commander-femiglow : le panneau s’ouvre', async ({ page }) => {
    await page.goto(`${SHEET_URL}#commander-femiglow`);
    await expect(sheet(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toBeHidden();
  });
});

test.describe('Kit CRO v2 — parcours historique (?cta=scroll)', () => {
  test('le CTA du hero défile jusqu’au formulaire, aucun panneau', async ({ page }) => {
    await page.goto('/kit?cta=scroll');
    await expect(page.getByTestId('kit-commander-section')).toHaveAttribute(
      'data-commander-mode',
      'scroll',
    );
    await heroCta(page).click();
    await expect(page.getByTestId('wizard-shell')).toBeInViewport({ timeout: 5_000 });
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
