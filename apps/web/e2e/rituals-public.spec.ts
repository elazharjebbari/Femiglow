/**
 * Smoke tests publiques pour le composant « Rituels partagés ».
 * Cf. docs/reviews-wall/execution/10-tests-playwright.md § 3-4
 *
 * Note : ces tests sont des smoke tests qui acceptent un module vide
 * (cas test DB sans seed). Pour les parcours complets, il faut seed
 * 3 rituels via `scripts/seed-rituals.ts` avant exécution.
 */
import { test, expect } from '@playwright/test';

test.describe('Rituels — module et drawer sur /kit', () => {
  test('Page /kit charge sans erreur', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/kit');
    await expect(page).toHaveURL(/\/kit$/);
    expect(errors).toEqual([]);
  });

  test('Module compact / empty state affiché', async ({ page }) => {
    await page.goto('/kit');
    // Soit le module rendu (cartes), soit l'empty state. Au moins l'un visible.
    const moduleHeading = page.getByRole('heading', {
      name: /Les voix de la maison|initiée(s)? ont? partagé/i,
    });
    const emptyState = page.getByRole('heading', {
      name: /La maison écoute/i,
    });
    await expect(moduleHeading.or(emptyState)).toBeVisible({ timeout: 10_000 });
  });

  test('Drawer ouvert via URL ?wall=open', async ({ page }) => {
    await page.goto('/kit?wall=open');
    const dialog = page.getByRole('dialog', { name: /Rituels partagés|Les voix/i });
    await expect(dialog).toBeVisible({ timeout: 5_000 });
  });

  test('ESC ferme le drawer', async ({ page }) => {
    await page.goto('/kit?wall=open');
    const dialog = page.getByRole('dialog', { name: /Les voix/i });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('Filtres chips présents dans le drawer', async ({ page }) => {
    await page.goto('/kit?wall=open');
    await expect(page.getByTestId('rituals-filter-all')).toBeVisible();
    await expect(page.getByTestId('rituals-filter-with_photos')).toBeVisible();
    await expect(page.getByTestId('rituals-filter-halal')).toBeVisible();
    await expect(page.getByTestId('rituals-filter-recent')).toBeVisible();
  });

  test('Wizard ouvert via URL ?wall=share', async ({ page }) => {
    await page.goto('/kit?wall=share');
    await expect(page.getByTestId('rituals-wizard')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('wizard-step-1')).toBeVisible();
  });

  test('Wizard body invalide → CTA Continuer désabilité', async ({ page }) => {
    await page.goto('/kit?wall=share');
    const body = page.getByTestId('wizard-body');
    await body.fill('court');
    await expect(page.getByTestId('wizard-continue-1')).toBeDisabled();
  });

  test('API /api/rituals/summary répond 200', async ({ request }) => {
    const res = await request.get('/api/rituals/summary?product_key=pack-femiglow');
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.data).toHaveProperty('totalCount');
    expect(json.data).toHaveProperty('topTags');
  });

  test('API /api/rituals/list répond 200', async ({ request }) => {
    const res = await request.get('/api/rituals/list?product_key=pack-femiglow&limit=12');
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.meta).toHaveProperty('hasMore');
  });

  test('API /api/rituals/policy répond avec texte de politique', async ({ request }) => {
    const res = await request.get('/api/rituals/policy');
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.data.text).toMatch(/initiée|maison/i);
  });

  test('POST /api/rituals/submit refuse body trop court', async ({ request }) => {
    const res = await request.post('/api/rituals/submit', {
      data: {
        productKey: 'pack-femiglow',
        body: 'trop court',
        wouldRecommend: 'oui',
      },
    });
    expect([400, 429]).toContain(res.status());
  });
});
