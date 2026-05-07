/**
 * CHA-141 — Tests E2E console admin chat.
 *
 * Couvre :
 *  - /admin/chat redirection si non auth.
 *  - 8 sections accessibles via la sous-navigation.
 *  - création + activation d'une instruction de version.
 *  - Système : présence du graph SVG + connexion SSE qui ne crash pas.
 */
import { expect, test } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@femiglow.ma';
const ADMIN_PWD = process.env.ADMIN_TEST_PASSWORD ?? 'admin-test-pass';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/mot de passe/i).fill(ADMIN_PWD);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page.waitForURL(/\/admin(\/|$)/, { timeout: 15_000 });
}

test.describe('Console admin — chat', () => {
  test('redirige /admin/chat vers /admin/login si non authentifié', async ({ page }) => {
    await page.goto('/admin/chat');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('affiche les 10 sections de la sous-navigation', async ({ page }) => {
    await login(page);
    await page.goto('/admin/chat');
    const labels = [
      "Vue d'ensemble",
      'Conversations',
      'KPIs',
      'Instructions',
      'Sources',
      'Providers',
      'Themes',
      'Langues',
      'Audit',
      'Système',
    ];
    for (const label of labels) {
      await expect(page.getByRole('link', { name: label })).toBeVisible();
    }
  });

  test('système : graph SVG visible + export Mermaid OK', async ({ page }) => {
    await login(page);
    await page.goto('/admin/chat/system');
    await expect(page.getByRole('img', { name: /pipeline/i })).toBeVisible();

    // Export Mermaid renvoie un text/plain téléchargeable.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: /Mermaid/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.mmd$/);
  });

  test('création + activation d\'une instruction', async ({ page }) => {
    await login(page);
    await page.goto('/admin/chat/instructions/new');
    await page.getByLabel(/body/i).first().fill(
      'Tu es un assistant FemiGlow. Sobre, ouvert, sans médical affirmatif.',
    );
    await page.getByRole('button', { name: /créer|enregistrer/i }).click();
    await page.waitForURL(/\/admin\/chat\/instructions/);
    // Le nouveau brouillon doit apparaître ; activation visible.
    await expect(page.getByRole('button', { name: /activer/i }).first()).toBeVisible();
  });
});
