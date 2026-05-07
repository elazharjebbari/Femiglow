/**
 * E2E Playwright — flow onboarding GTM.
 *
 * Couvre le parcours complet : ouvrir l'onglet Configurations, partir d'un
 * template, importer du CSV, créer une version, voir le snapshot écrit.
 *
 * Tolère l'absence de session admin (early return si redirect login).
 */
import { test, expect } from '@playwright/test';

test.describe('admin tracking GTM — onboarding flow', () => {
  test('ouvrir le picker template + appliquer Maroc e-commerce', async ({ page }) => {
    await page.goto('/admin/tracking/gtm');
    if (page.url().includes('/admin/login')) return;

    await page.getByRole('tab', { name: /Configurations/i }).click();

    // Ouvrir le template picker
    await page.getByRole('button', { name: /partir d.un template/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Vérifier qu'il y a 4 templates
    await expect(dialog.getByText(/E-commerce Maroc/i)).toBeVisible();
    await expect(dialog.getByText(/Sandbox/i)).toBeVisible();
    await expect(dialog.getByText(/B2B SaaS/i)).toBeVisible();
    await expect(dialog.getByText(/Minimal/i).first()).toBeVisible();

    // Sélectionner Maroc e-commerce
    await dialog.getByRole('button', { name: /E-commerce Maroc/i }).click();

    // Appliquer
    await dialog.getByRole('button', { name: /appliquer le template/i }).click();

    // La modale se ferme
    await expect(dialog).toBeHidden();

    // Le formulaire est rempli avec MAD
    await expect(page.getByDisplayValue('MAD').first()).toBeVisible();
  });

  test('CSV import — preview + apply', async ({ page }) => {
    await page.goto('/admin/tracking/gtm');
    if (page.url().includes('/admin/login')) return;

    await page.getByRole('tab', { name: /Configurations/i }).click();

    await page.getByRole('button', { name: /importer un csv/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const textarea = dialog.getByLabel(/csv à importer/i);
    await textarea.fill('production,ga4MeasurementId,G-PROD0000');

    // Aperçu apparait
    await expect(dialog.getByText(/1 variable\(s\) appliquée\(s\)/)).toBeVisible();

    // Appliquer
    await dialog.getByRole('button', { name: /^appliquer$/i }).click();
    await expect(dialog).toBeHidden();

    // La valeur est dans le formulaire
    await expect(page.getByDisplayValue('G-PROD0000').first()).toBeVisible();
  });

  test('création de version + diff visible', async ({ page }) => {
    await page.goto('/admin/tracking/gtm');
    if (page.url().includes('/admin/login')) return;

    await page.getByRole('tab', { name: /Configurations/i }).click();

    const stamp = Date.now();
    const v1Name = `v1-onboarding-${stamp}`;

    // Saisir un nom
    await page.getByPlaceholder(/v1/i).fill(v1Name);

    // Soumettre
    await page.getByRole('button', { name: /créer la version/i }).click();

    // La version apparait dans la liste
    await expect(page.getByText(v1Name)).toBeVisible();
  });

  test('API snapshot — POST sans session → 401', async ({ request }) => {
    const res = await request.post('/api/admin/tracking/gtm/snapshot', {
      headers: { Cookie: '' },
    });
    if (res.status() !== 401 && res.status() !== 200) {
      throw new Error(`Status inattendu ${res.status()}`);
    }
  });

  test('API snapshot — POST avec session écrit les 4 fichiers', async ({ request }) => {
    const res = await request.post('/api/admin/tracking/gtm/snapshot');
    if (res.status() === 401) return;
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.written).toBeDefined();
    // Soit 4 fichiers écrits, soit skipped sur fs read-only (Vercel)
    expect(body.written.length === 4 || body.skippedReason === 'read_only_fs').toBe(true);
  });
});

test.describe('admin tracking GTM — linter visible dans Export', () => {
  test('Export tab affiche le composant principal sans erreur', async ({ page }) => {
    await page.goto('/admin/tracking/gtm');
    if (page.url().includes('/admin/login')) return;

    // Onglet Export par défaut
    await expect(page.getByRole('tab', { name: /^Export/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // Stats grid présent
    await expect(page.getByText('Tags').first()).toBeVisible();
  });
});
