/**
 * Smoke tests admin pour la modération des rituels.
 * Cf. docs/reviews-wall/execution/10-tests-playwright.md § 7
 *
 * Suppose l'admin est seedé via ADMIN_BOOTSTRAP_EMAIL / _PASSWORD
 * (chargés par playwright.config.ts).
 */
import { test, expect } from '@playwright/test';
import { loginAdmin } from './helpers/auth';

test.describe('Admin — Rituels partagés', () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
  });

  test('Queue accessible et affiche le compteur', async ({ page }) => {
    await page.goto('/admin/rituals/queue');
    await expect(page.getByRole('heading', { name: /Queue de modération/i })).toBeVisible();
    // Compteur visible (peut être 0)
    await expect(page.getByText(/en attente · \d+ total/i)).toBeVisible();
  });

  test('Navigation tabs queue / published / archived / insights / import', async ({ page }) => {
    await page.goto('/admin/rituals/queue');
    for (const target of [
      { name: 'Publiés', url: /\/admin\/rituals\/published/ },
      { name: 'Archivés', url: /\/admin\/rituals\/archived/ },
      { name: 'Insights', url: /\/admin\/rituals\/insights/ },
      { name: 'Importer', url: /\/admin\/rituals\/import/ },
    ]) {
      await page.getByRole('link', { name: target.name }).first().click();
      await expect(page).toHaveURL(target.url);
    }
  });

  test('Page Import : choix format + boutons templates visibles', async ({ page }) => {
    await page.goto('/admin/rituals/import');
    await expect(page.getByRole('heading', { name: /Importer des rituels/i })).toBeVisible();
    // Étape 1 : tuiles format
    await expect(page.getByTestId('import-format-csv')).toBeVisible();
    await expect(page.getByTestId('import-format-json')).toBeVisible();
    // Boutons téléchargement
    await expect(page.getByTestId('download-template-csv')).toBeVisible();
    await expect(page.getByTestId('download-template-json')).toBeVisible();
  });

  test('Téléchargement template CSV retourne un fichier', async ({ page, request }) => {
    // Récupération du cookie de session via la page d'admin authentifiée
    const cookies = await page.context().cookies();
    const cookieHeader = cookies
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
    const res = await request.get('/api/admin/rituals/import/template?format=csv', {
      headers: { cookie: cookieHeader },
    });
    expect(res.ok()).toBe(true);
    expect(res.headers()['content-type']).toContain('text/csv');
    expect(res.headers()['content-disposition']).toContain('attachment');
    const text = await res.text();
    expect(text).toContain('body;wouldRecommend');
  });

  test('Wizard import : flow étape 1 → étape 2', async ({ page }) => {
    await page.goto('/admin/rituals/import');
    await page.getByTestId('import-format-csv').click();
    await page.getByRole('button', { name: /Continuer/ }).first().click();
    await expect(page.getByTestId('import-step-2')).toBeVisible();
    await expect(page.getByTestId('import-content-textarea')).toBeVisible();
  });

  test('Wizard import : preview minimaliste', async ({ page }) => {
    await page.goto('/admin/rituals/import');
    await page.getByTestId('import-format-csv').click();
    await page.getByRole('button', { name: /Continuer/ }).first().click();
    await page
      .getByTestId('import-content-textarea')
      .fill(`body;wouldRecommend\n"${'a'.repeat(60)}";oui\n`);
    await page.getByTestId('import-run-preview').click();
    await expect(page.getByTestId('import-step-3')).toBeVisible({ timeout: 10_000 });
    // Au moins une ligne valide
    await expect(page.getByText(/1.+valide/i)).toBeVisible();
  });

  test('Page Aide import : titre + sections', async ({ page }) => {
    await page.goto('/admin/rituals/import/help');
    await expect(page.getByRole('heading', { name: /Aide.*Import/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Champs canoniques/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Formats supportés/i })).toBeVisible();
  });

  test('Page Insights accessible', async ({ page }) => {
    await page.goto('/admin/rituals/insights');
    await expect(page.getByRole('heading', { name: /Insights/i })).toBeVisible();
    // KPI tile visible (au moins un compteur)
    await expect(page.getByText(/Témoignages publiés/i)).toBeVisible();
  });
});
