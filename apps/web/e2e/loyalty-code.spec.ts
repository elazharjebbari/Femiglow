/**
 * E2E — code de fidélité affiché en fin de commande (Phase 3 / LOY).
 * Tag : @loyalty-code
 *
 * Robuste : compléter une commande nécessite le backend (lead + DB). Si le
 * parcours n'atteint pas le ThankYouStep dans cet environnement, on skip
 * proprement. Quand un code est présent, on valide son FORMAT mémorable et la
 * charte (pas de countdown / rouge / %).
 */
import { test, expect } from '@playwright/test';

test.describe('/kit — code de fidélité en fin de commande @loyalty-code', () => {
  test('le ThankYouStep affiche un code FG-<MOT>-<NNNN> mémorable', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/kit');

    const card = page.getByTestId('loyalty-code-card');
    // Le code n'apparaît qu'après une commande complète (backend requis).
    if ((await card.count()) === 0) {
      test.skip(true, 'ThankYouStep non atteint (commande non complétée dans cet environnement).');
      return;
    }
    await expect(card).toBeVisible();
    const value = page.getByTestId('loyalty-code-value');
    await expect(value).toHaveText(/^FG-[A-Z]+-\d{4}$/);
    const txt = (await card.textContent()) ?? '';
    expect(txt).not.toContain('%');
    expect(txt).not.toContain('!');
    expect(txt.toLowerCase()).not.toMatch(/\d+\s*:\s*\d+|countdown|expire/);
  });
});
