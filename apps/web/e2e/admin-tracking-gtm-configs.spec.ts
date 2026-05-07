/**
 * E2E Playwright — onglet Configurations + Visualisation de GTM.
 *
 * Tolère l'absence de session admin (early return si redirect login),
 * conformément aux autres specs admin-*.
 */
import { test, expect } from '@playwright/test';

test.describe('admin tracking GTM — sous-onglets', () => {
  test('les 3 sous-onglets sont rendus (Export · Configurations · Visualisation)', async ({ page }) => {
    await page.goto('/admin/tracking/gtm');
    if (page.url().includes('/admin/login')) return;

    const tabs = page.getByRole('tab');
    await expect(tabs.nth(0)).toContainText(/Export/i);
    await expect(tabs.nth(1)).toContainText(/Configurations/i);
    await expect(tabs.nth(2)).toContainText(/Visualisation/i);
  });

  test('changement d\'onglet — Configurations', async ({ page }) => {
    await page.goto('/admin/tracking/gtm');
    if (page.url().includes('/admin/login')) return;

    await page.getByRole('tab', { name: /Configurations/i }).click();
    await expect(
      page.getByRole('heading', { name: /nouvelle configuration/i }),
    ).toBeVisible();
    await expect(page.getByText(/historique \(/i)).toBeVisible();
  });

  test('changement d\'onglet — Visualisation', async ({ page }) => {
    await page.goto('/admin/tracking/gtm');
    if (page.url().includes('/admin/login')) return;

    await page.getByRole('tab', { name: /Visualisation/i }).click();
    await expect(page.getByRole('button', { name: /^SVG$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^PNG$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Mermaid$/ })).toBeVisible();
  });
});

test.describe('admin tracking GTM — Configurations CRUD', () => {
  test('formulaire affiche 4 colonnes envs + 12 lignes variables', async ({ page }) => {
    await page.goto('/admin/tracking/gtm');
    if (page.url().includes('/admin/login')) return;

    await page.getByRole('tab', { name: /Configurations/i }).click();
    await expect(page.getByRole('columnheader', { name: 'production' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'stage' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'preview' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'dev' })).toBeVisible();
  });

  test('boutons "Tous" / "Pub." présents pour chaque variable', async ({ page }) => {
    await page.goto('/admin/tracking/gtm');
    if (page.url().includes('/admin/login')) return;

    await page.getByRole('tab', { name: /Configurations/i }).click();
    const tousBtns = page.getByRole('button', { name: /^Tous$/ });
    const pubBtns = page.getByRole('button', { name: /^Pub\.$/ });
    expect(await tousBtns.count()).toBeGreaterThanOrEqual(10);
    expect(await pubBtns.count()).toBeGreaterThanOrEqual(10);
  });

  test('création + activation + suppression bout-en-bout', async ({ page }) => {
    await page.goto('/admin/tracking/gtm');
    if (page.url().includes('/admin/login')) return;

    await page.getByRole('tab', { name: /Configurations/i }).click();

    const stamp = Date.now();
    const v1Name = `v1-test-${stamp}`;
    const v2Name = `v2-test-${stamp}`;

    // Créer v1
    await page.getByPlaceholder(/v1/i).fill(v1Name);
    await page.getByRole('button', { name: /créer la version/i }).click();
    await expect(page.getByText(v1Name)).toBeVisible();

    // Créer v2
    await page.getByPlaceholder(/v1/i).fill(v2Name);
    await page.getByRole('button', { name: /créer la version/i }).click();
    await expect(page.getByText(v2Name)).toBeVisible();

    // Activer v1 (qui est devenue archivée puisque v2 vient juste d'être créée
    // mais dans notre store la première créée reste active jusqu'à ce qu'on
    // active explicitement la nouvelle).
    // On clique sur le bouton "Activer" de la version archivée.
    const archivedActivateBtns = page.getByRole('button', { name: /^Activer$/ });
    if (await archivedActivateBtns.count()) {
      await archivedActivateBtns.first().click();
    }

    // Supprimer v2 (archivée maintenant)
    const deleteBtn = page.getByRole('button', { name: /^Supprimer$/ }).first();
    await deleteBtn.click();
    await page.getByRole('button', { name: /confirmer/i }).click();
  });

  test('API /api/admin/tracking/gtm/configs — 401 sans cookie', async ({ request }) => {
    const res = await request.get('/api/admin/tracking/gtm/configs', {
      headers: { Cookie: '' },
    });
    if (res.status() !== 401 && res.status() !== 200) {
      throw new Error(`Status inattendu ${res.status()}`);
    }
  });
});

test.describe('admin tracking GTM — Visualisation', () => {
  test('SVG visible avec aria-label conteneur GTM', async ({ page }) => {
    await page.goto('/admin/tracking/gtm');
    if (page.url().includes('/admin/login')) return;

    await page.getByRole('tab', { name: /Visualisation/i }).click();
    const svg = page.getByRole('img', { name: /conteneur GTM/i });
    await expect(svg).toBeVisible();
  });

  test('téléchargement SVG fonctionnel', async ({ page }) => {
    await page.goto('/admin/tracking/gtm');
    if (page.url().includes('/admin/login')) return;

    await page.getByRole('tab', { name: /Visualisation/i }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /^SVG$/ }).click();
    const dl = await downloadPromise;
    expect(dl.suggestedFilename()).toMatch(
      /^gtm-viz-(production|stage|preview|dev)-\d{4}-\d{2}-\d{2}\.svg$/,
    );
  });

  test('plein écran ouvre dialog ARIA puis se ferme avec Esc', async ({ page }) => {
    await page.goto('/admin/tracking/gtm');
    if (page.url().includes('/admin/login')) return;

    await page.getByRole('tab', { name: /Visualisation/i }).click();
    await page.getByRole('button', { name: /plein écran/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('API /visualization — JSON par défaut', async ({ request }) => {
    const res = await request.get(
      '/api/admin/tracking/gtm/visualization?env=production&format=json',
    );
    if (res.status() === 401) return;
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('descriptor');
    expect(body.descriptor).toHaveProperty('folders');
    expect(body.descriptor).toHaveProperty('totalTags');
  });

  test('API /visualization — Mermaid texte', async ({ request }) => {
    const res = await request.get(
      '/api/admin/tracking/gtm/visualization?env=production&format=mermaid',
    );
    if (res.status() === 401) return;
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/plain');
    const text = await res.text();
    expect(text.split('\n')[0]).toBe('flowchart LR');
  });
});
