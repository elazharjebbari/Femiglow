/**
 * E2E Playwright — flow complet Poka-Yoke avec authentification.
 * Couvre les scénarios bout-en-bout :
 *  - login → sync-status accessible
 *  - login → wizard validate-pair étapes 1→3 + verdict
 *  - login → erreur sur JSON invalide
 *  - login → refresh manuel sur sync-status
 *  - login → navigation entre les 2 onglets Poka-Yoke
 *
 * Tolère l'absence de seed admin : si login échoue, le test se contente
 * de vérifier la redirection vers /admin/login (comme dans les autres specs).
 */
import { expect, test, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@femiglow.local';
const ADMIN_PWD = process.env.ADMIN_TEST_PASSWORD ?? 'TeXdExs2hdYVaB+dltbUnjmU';

async function tryLogin(page: Page): Promise<boolean> {
  await page.goto('/admin/login');
  const emailField = page.getByLabel(/email/i);
  if (!(await emailField.isVisible().catch(() => false))) return false;
  await emailField.fill(ADMIN_EMAIL);
  await page.getByLabel(/mot de passe/i).fill(ADMIN_PWD);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page
    .waitForURL(/\/admin(\/|$)/, { timeout: 15_000 })
    .catch(() => undefined);
  return !page.url().includes('/admin/login');
}

const validConfigJson = JSON.stringify({
  containerVersion: {
    container: { publicId: 'GTM-ABCD' },
    variable: [
      { name: 'FG Bundle Id', parameter: [{ key: 'value', value: 'a7c4f2e9b81d' }] },
      { name: 'FG Config Version', parameter: [{ key: 'value', value: 'v4' }] },
    ],
    trigger: [],
  },
});

const validMappingJson = JSON.stringify({
  manifest: {
    schemaVersion: 'fg-mapping/2.0',
    bundleId: 'a7c4f2e9b81d',
    mappingVersion: 'v17',
    requiredConfigVersion: 'v4',
    containerId: 'GTM-ABCD',
  },
  mappings: {},
});

const bundleMismatchMappingJson = JSON.stringify({
  manifest: {
    schemaVersion: 'fg-mapping/2.0',
    bundleId: 'bbbbbbbbbbbb',
    mappingVersion: 'v17',
    requiredConfigVersion: 'v4',
    containerId: 'GTM-ABCD',
  },
  mappings: {},
});

test.describe('GTM Poka-Yoke — flow complet authentifié', () => {
  test('redirection sync-status sans auth → /admin/login', async ({ page }) => {
    await page.goto('/admin/tracking/gtm/sync-status');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('redirection validate-pair sans auth → /admin/login', async ({ page }) => {
    await page.goto('/admin/tracking/gtm/validate-pair');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('sync-status affiche badge + cards après login', async ({ page }) => {
    if (!(await tryLogin(page))) test.skip(true, 'login admin indisponible');
    await page.goto('/admin/tracking/gtm/sync-status');
    await expect(page.getByTestId('global-status-badge')).toBeVisible();
    await expect(page.getByTestId('sync-card-mapping')).toBeVisible();
    await expect(page.getByTestId('sync-card-config')).toBeVisible();
    await expect(page.getByTestId('sync-card-bundle')).toBeVisible();
  });

  test('bouton refresh recharge l\'état', async ({ page }) => {
    if (!(await tryLogin(page))) test.skip(true, 'login admin indisponible');
    await page.goto('/admin/tracking/gtm/sync-status');
    await expect(page.getByTestId('btn-refresh')).toBeVisible();
    await page.getByTestId('btn-refresh').click();
    await expect(page.getByTestId('btn-refresh')).toBeEnabled({ timeout: 5000 });
  });

  test('wizard validate-pair : étapes 1 → 2 → 3 verdict OK', async ({ page }, testInfo) => {
    if (!(await tryLogin(page))) test.skip(true, 'login admin indisponible');
    await page.goto('/admin/tracking/gtm/validate-pair');
    await expect(page.getByTestId('validate-pair-wizard')).toBeVisible();

    // Étape 1
    const configFile = testInfo.outputPath('config-v4.json');
    require('fs').writeFileSync(configFile, validConfigJson);
    await page.getByTestId('config-dropzone').setInputFiles(configFile);
    await page.getByTestId('btn-next-step').click();

    // Étape 2
    const mappingFile = testInfo.outputPath('mapping-v17.json');
    require('fs').writeFileSync(mappingFile, validMappingJson);
    await page.getByTestId('mapping-dropzone').setInputFiles(mappingFile);
    await page.getByTestId('btn-validate').click();

    // Étape 3
    await expect(page.getByTestId('verdict')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-ok', 'true');
  });

  test('wizard validate-pair : verdict KO sur bundle mismatch', async ({ page }, testInfo) => {
    if (!(await tryLogin(page))) test.skip(true, 'login admin indisponible');
    await page.goto('/admin/tracking/gtm/validate-pair');

    const configFile = testInfo.outputPath('config-bad.json');
    require('fs').writeFileSync(configFile, validConfigJson);
    await page.getByTestId('config-dropzone').setInputFiles(configFile);
    await page.getByTestId('btn-next-step').click();

    const mappingFile = testInfo.outputPath('mapping-bad.json');
    require('fs').writeFileSync(mappingFile, bundleMismatchMappingJson);
    await page.getByTestId('mapping-dropzone').setInputFiles(mappingFile);
    await page.getByTestId('btn-validate').click();

    await expect(page.getByTestId('verdict')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-ok', 'false');
    await expect(page.getByTestId('issues-errors')).toBeVisible();
  });

  test('wizard rejette un JSON invalide à l\'étape 1', async ({ page }, testInfo) => {
    if (!(await tryLogin(page))) test.skip(true, 'login admin indisponible');
    await page.goto('/admin/tracking/gtm/validate-pair');
    const bad = testInfo.outputPath('bad.json');
    require('fs').writeFileSync(bad, 'not json {{{');
    await page.getByTestId('config-dropzone').setInputFiles(bad);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByTestId('btn-next-step')).toBeDisabled();
  });

  test('navigation entre les onglets GTM Sync ↔ Valider import', async ({ page }) => {
    if (!(await tryLogin(page))) test.skip(true, 'login admin indisponible');
    await page.goto('/admin/tracking/gtm/sync-status');
    await page.getByRole('link', { name: /valider import gtm/i }).click();
    await expect(page).toHaveURL(/validate-pair/);
    await page.getByRole('link', { name: /^gtm sync$/i }).click();
    await expect(page).toHaveURL(/sync-status/);
  });

  test('wizard "Recommencer" remet à l\'étape 1', async ({ page }, testInfo) => {
    if (!(await tryLogin(page))) test.skip(true, 'login admin indisponible');
    await page.goto('/admin/tracking/gtm/validate-pair');
    const c = testInfo.outputPath('cfg.json');
    const m = testInfo.outputPath('map.json');
    require('fs').writeFileSync(c, validConfigJson);
    require('fs').writeFileSync(m, validMappingJson);
    await page.getByTestId('config-dropzone').setInputFiles(c);
    await page.getByTestId('btn-next-step').click();
    await page.getByTestId('mapping-dropzone').setInputFiles(m);
    await page.getByTestId('btn-validate').click();
    await expect(page.getByTestId('verdict')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Recommencer/i }).click();
    await expect(page.getByText(/Étape 1 \/ 3/)).toBeVisible();
  });
});
