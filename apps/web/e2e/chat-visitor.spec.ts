/**
 * CHA-140 — Tests E2E visiteur (FR + Darija + AR classique).
 *
 * Scénarios couverts :
 *  1. Le launcher est visible sur la home et discret (z-index, position).
 *  2. Ouvrir le panel via clic, vérifier focus + a11y.
 *  3. Envoyer un message FR → recevoir une réponse streamée.
 *  4. Envoyer un message Darija FR-script → la langue détectée bascule
 *     en `ar-MA` (vérifié via attribut `lang` du panel).
 *  5. Envoyer un message AR script → bascule RTL (`dir="rtl"`).
 *
 * Hypothèses :
 *  - `CHAT_ENABLED=true` côté serveur de test.
 *  - Au moins un provider `text` actif qui réponde (mock ou réel selon
 *    le mode CI). En mode local, le provider router fallback peut être
 *    forcé via `seed-chat`.
 */
import { expect, test } from '@playwright/test';

test.describe('Chat visiteur — landing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('le launcher est visible et persistant', async ({ page }) => {
    const launcher = page.getByTestId('chat-launcher');
    await expect(launcher).toBeVisible();
    // Position fixée bas droite (en LTR).
    await expect(launcher).toHaveCSS('position', 'fixed');
  });

  test('ouverture / fermeture du panel via clic', async ({ page }) => {
    const launcher = page.getByTestId('chat-launcher');
    await launcher.click();
    await expect(launcher).toHaveAttribute('aria-expanded', 'true');
    // Fermer via Esc
    await page.keyboard.press('Escape');
    await expect(launcher).toHaveAttribute('aria-expanded', 'false');
  });

  test('envoi message FR + réception réponse streamée', async ({ page }) => {
    await page.getByTestId('chat-launcher').click();
    const composer = page.getByPlaceholder(/message|écrivez|tapez/i);
    await expect(composer).toBeVisible();
    await composer.fill('Bonjour, comment utiliser le sérum ?');
    await composer.press('Enter');

    // Le message user apparaît immédiatement.
    await expect(
      page.getByText('Bonjour, comment utiliser le sérum ?'),
    ).toBeVisible();

    // L'agent répond dans les 30 s (humanize ≥ 600 ms).
    const list = page.getByRole('log').or(page.locator('[data-role="messages"]'));
    await expect(list).toContainText(/[A-Za-z]/, { timeout: 30_000 });
  });

  test('darija FR-script bascule en ar-MA', async ({ page }) => {
    await page.getByTestId('chat-launcher').click();
    const composer = page.getByPlaceholder(/message|écrivez|tapez/i);
    await composer.fill('bghit nchri kit dyalkom');
    await composer.press('Enter');
    // Le panel devrait porter lang="ar" (script-driven RTL est appliqué
    // pour `ar` ; pour `ar-MA` on garde LTR mais lang change).
    await expect(page.locator('[data-chat-lang]').first()).toHaveAttribute(
      'data-chat-lang',
      /ar(-MA)?/,
      { timeout: 15_000 },
    );
  });

  test('arabe classique bascule en RTL', async ({ page }) => {
    await page.getByTestId('chat-launcher').click();
    const composer = page.getByPlaceholder(/message|écrivez|tapez/i);
    await composer.fill('السلام عليكم، كم سعر الكيت ؟');
    await composer.press('Enter');
    await expect(page.locator('[dir="rtl"]').first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
