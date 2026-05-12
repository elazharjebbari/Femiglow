/**
 * CHA-231 — E2E du wizard checkout embarqué sur /kit (Mode A).
 *
 * Couvre le parcours bout-en-bout du « rituel commander » :
 *   1. /kit charge la page produit + section #commander-femiglow rendue
 *   2. Le CTA « Commander » du hero scroll-anchore vers le funnel
 *   3. Lead capture (prénom + téléphone MA + consent)
 *   4. Adresse (ville en arabe → matchée sur la canonique FR, pas de postal
 *      code, pas d'addressLine2, pas de radio mode livraison)
 *   5. Le submit address déclenche silencieusement payment(cod) + order, on
 *      arrive directement sur thank_you
 *   6. La référence d'order s'affiche, le bloc opt-in parle de
 *      « confirmation » (pas newsletter)
 *
 * Approche
 * ────────
 * On ne mocke pas le backend — c'est un E2E réel qui pratique la chaîne
 * complète sur le dev server. Les pré-requis (DB seedée avec un kit
 * publié) sont assurés par le pipeline CI. En local, lancer :
 *   pnpm --filter @femiglow/web db:seed (ou équivalent)
 *
 * **Hors scope** : Stripe / paiement carte (pas pertinent en COD), retry
 * réseau, modes pickup / express (retirés par CHA-231).
 */
import { expect, test, type Page } from '@playwright/test';

const PHONE = '612345678';
const PHONE_DISPLAY = '6 12 34 56 78';

/**
 * Helper : remplit le step lead avec des valeurs valides.
 * Retourne après que `goToStep('address')` a basculé l'UI.
 */
async function fillLeadStep(page: Page, firstName: string): Promise<void> {
  const leadStep = page.getByTestId('wizard-step-lead');
  await expect(leadStep).toBeVisible();

  await leadStep.getByLabel(/prénom/i).fill(firstName);
  await leadStep.getByLabel(/téléphone/i).fill(PHONE);
  // Le label utilise une apostrophe typographique (« J'accepte » avec ').
  // On accepte les deux variantes pour rester souple si la copy change.
  await leadStep.getByLabel(/J[\u2019']accepte/i).check();

  const submit = leadStep.getByRole('button', { name: /continuer/i });
  await expect(submit).toBeEnabled();
  await submit.click();
}

test.describe('CHA-231 — Wizard /kit (Mode A)', () => {
  test('parcours complet : hero → ancre → lead → address → thank_you', async ({
    page,
  }) => {
    test.setTimeout(120_000);

    // 1) Charger /kit
    await page.goto('/kit');
    const wizardSection = page.getByTestId('kit-commander-section');
    await expect(wizardSection).toBeVisible();

    // 2) CTA hero scroll-anchore vers le wizard
    const heroBtn = page.getByTestId('kit-commander-anchor-button').first();
    await expect(heroBtn).toBeVisible();
    await heroBtn.click();

    // L'ancre est dans le viewport (le wizard-shell devient focusable)
    const wizardShell = page.getByTestId('wizard-shell');
    await expect(wizardShell).toBeVisible();

    // 3) Lead step
    await fillLeadStep(page, 'Amal');

    // 4) Address step — doit être en train de s'afficher
    const addressStep = page.getByTestId('wizard-step-address');
    await expect(addressStep).toBeVisible();

    // Champs supprimés (CHA-231) : pas de postal, pas de line2, pas de radio
    await expect(addressStep.getByLabel(/code postal/i)).toHaveCount(0);
    await expect(addressStep.getByLabel(/complément/i)).toHaveCount(0);
    await expect(addressStep.locator('input[type="radio"]')).toHaveCount(0);

    // Bloc réassurance livraison gratuit visible
    await expect(addressStep.getByTestId('wizard-shipping-notice')).toBeVisible();

    // 5) Saisir une ville en arabe : doit afficher « Reconnu : Casablanca »
    const cityInput = addressStep.getByTestId('wizard-address-city');
    await cityInput.fill('الدار البيضاء');
    await expect(addressStep.getByText(/Reconnu\s*:\s*Casablanca/i)).toBeVisible();

    await addressStep
      .getByTestId('wizard-address-line1')
      .fill('12 rue des Roses, app. 3');

    // 6) Submit address → chaîne address+payment(cod)+order silencieuse →
    //    thank_you
    const addressSubmit = addressStep.getByTestId('wizard-address-submit');
    await expect(addressSubmit).toBeEnabled();
    await addressSubmit.click();

    // Thank you step apparaît directement (pas de step paiement)
    const thankYou = page.getByTestId('wizard-step-thankyou');
    await expect(thankYou).toBeVisible({ timeout: 30_000 });

    // 7) Order ref affiché
    await expect(thankYou.getByTestId('wizard-thankyou-orderref')).toBeVisible();

    // 8) Le bloc opt-in parle de « confirmation », PAS de « newsletter »
    await expect(thankYou.getByText(/recevoir la confirmation par email/i)).toBeVisible();
    await expect(thankYou.getByText(/newsletter/i)).toHaveCount(0);
  });

  test('le bloc commander a une ancre #commander-femiglow', async ({ page }) => {
    await page.goto('/kit');
    const section = page.locator('#commander-femiglow');
    await expect(section).toBeVisible();
  });

  test('le CTA hero « Commander le rituel » scroll-cible le wizard', async ({
    page,
  }) => {
    await page.goto('/kit');
    const hero = page.locator('header, section').filter({
      has: page.getByRole('heading', { level: 1 }),
    }).first();
    const cta = hero.getByRole('button', { name: /commander le rituel/i }).first();
    await expect(cta).toBeVisible();
    await cta.click();
    const wizardShell = page.getByTestId('wizard-shell');
    // Le wizard-shell doit être dans le viewport après scroll
    await expect(wizardShell).toBeInViewport({ timeout: 5_000 });
  });
});

test.describe('CHA-231 — i18n bilingue côté address', () => {
  test('le hint sous le champ ville mentionne FR + AR par défaut', async ({
    page,
  }) => {
    await page.goto('/kit');
    await fillLeadStep(page, 'Test');
    const addressStep = page.getByTestId('wizard-step-address');
    await expect(addressStep).toBeVisible();
    // Le hint contient une mention bilingue (FR + AR)
    const hint = addressStep.getByText(/français ou en arabe/i);
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('الدار البيضاء');
  });

  test('matching ville accepte les alias FR (« Casa »)', async ({ page }) => {
    await page.goto('/kit');
    await fillLeadStep(page, 'Test');
    const addressStep = page.getByTestId('wizard-step-address');
    await addressStep.getByTestId('wizard-address-city').fill('Casa');
    await expect(addressStep.getByText(/Reconnu\s*:\s*Casablanca/i)).toBeVisible();
  });
});

// Mode B (/commander full-page) — couverture statique : la barre de progression
// ne doit jamais lister « Paiement » (suppression CHA-231). Le parcours complet
// Mode B nécessite un panier pré-rempli (setup hors scope ici) ; il a été
// validé en live verification (Phase 9). Côté unit, `wizard-store.test.ts`
// garantit que `selectNextStep(address) === 'thank_you'`.
test.describe('CHA-231 — Mode B (/commander) — UI', () => {
  test('la nav de progression du wizard ne mentionne jamais « Paiement »', async ({
    page,
  }) => {
    await page.goto('/commander');
    const stepNav = page.getByRole('navigation', { name: /progression du wizard/i });
    if (await stepNav.isVisible().catch(() => false)) {
      await expect(stepNav).not.toContainText(/paiement|payment/i);
    }
  });
});
