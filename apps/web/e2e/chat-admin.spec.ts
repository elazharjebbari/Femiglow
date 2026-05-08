/**
 * CHA-141 / CHA-225 — Tests E2E console admin chat.
 *
 * Couvre :
 *  - /admin/chat redirection si non auth.
 *  - 11 sections accessibles via la sous-navigation (incluant l'onglet
 *    « Leads chat » ajouté en CHA-225).
 *  - vue d'ensemble : KPIs « Sessions converties » et « Leads chat
 *    capturés » présents.
 *  - /admin/chat/leads : page rendue + filtres outcome / trigger.
 *  - /admin/chat/conversations : filtre converted=yes/no présent.
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

  test('affiche les 11 sections de la sous-navigation (CHA-225 ajoute Leads chat)', async ({ page }) => {
    await login(page);
    await page.goto('/admin/chat');
    const labels = [
      "Vue d'ensemble",
      'Conversations',
      'Leads chat',
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
      await expect(
        page.getByRole('navigation', { name: /sections chat/i }).getByRole('link', { name: label, exact: true }),
      ).toBeVisible();
    }
  });

  test('vue d\'ensemble : KPIs Conversions + Leads chat visibles (CHA-225)', async ({ page }) => {
    await login(page);
    await page.goto('/admin/chat');
    // « Sessions converties » + « Leads chat capturés » + « Leads convertis »
    // ont été ajoutés en CHA-225 pour l'union read-side.
    await expect(page.getByText('Sessions converties', { exact: true })).toBeVisible();
    await expect(page.getByText('Leads chat capturés', { exact: true })).toBeVisible();
    await expect(page.getByText('Leads convertis', { exact: true })).toBeVisible();
  });

  test('/admin/chat/leads : page rendue + filtres outcome/trigger (CHA-225)', async ({ page }) => {
    await login(page);
    await page.goto('/admin/chat/leads');
    await expect(page.getByRole('heading', { name: 'Leads chat', level: 1 })).toBeVisible();

    // Compteurs résumé.
    await expect(page.getByText('Total', { exact: true })).toBeVisible();
    await expect(page.getByText('Pending', { exact: true })).toBeVisible();
    await expect(page.getByText('Converted', { exact: true })).toBeVisible();

    // Filtres.
    const outcomeSelect = page.locator('select[name="outcome"]');
    await expect(outcomeSelect).toBeVisible();
    await expect(outcomeSelect.locator('option[value="converted"]')).toHaveCount(1);

    const triggerSelect = page.locator('select[name="trigger"]');
    await expect(triggerSelect).toBeVisible();
    await expect(triggerSelect.locator('option[value="inline-contact"]')).toHaveCount(1);

    // Lien Réinitialiser.
    await expect(page.getByRole('link', { name: 'Réinitialiser' })).toBeVisible();
  });

  test('/admin/chat/conversations : filtre converted yes/no présent (CHA-225)', async ({ page }) => {
    await login(page);
    await page.goto('/admin/chat/conversations');
    const convertedSelect = page.locator('select[name="converted"]');
    await expect(convertedSelect).toBeVisible();
    await expect(convertedSelect.locator('option[value="yes"]')).toHaveCount(1);
    await expect(convertedSelect.locator('option[value="no"]')).toHaveCount(1);

    // Le compteur live "converties : N" est aria-live.
    await expect(page.getByText(/converties\s*:\s*\d+/)).toBeVisible();

    // Application du filtre via URL : la page doit rester ouverte sans crash.
    await page.goto('/admin/chat/conversations?converted=yes');
    await expect(page.getByRole('heading', { name: 'Conversations' })).toBeVisible();
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
