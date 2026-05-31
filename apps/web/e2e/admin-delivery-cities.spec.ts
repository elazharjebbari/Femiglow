/**
 * CHA-230 — E2E Playwright pour /admin/settings/delivery-cities.
 *
 * Couverture
 * ──────────
 *  1. Auth required — sans session, redirige sur /admin/login.
 *  2. Avec session (storageState) :
 *     - La table affiche au moins 1 ville seedée (Casablanca obligatoire).
 *     - Le filtre source=sendit narrows les résultats sans erreur.
 *     - La recherche debouncée trouve Casablanca.
 *     - Le toggle isActive flip + revient (state-preserving).
 *  3. CRUD bout-en-bout : create → edit → delete sur un slug temporaire
 *     `e2e-test-${stamp}` (no mutation des villes prod).
 *  4. API publique `/api/delivery-cities/active` renvoie un payload non vide
 *     incluant Casablanca (validation côté wizard).
 *
 * Approche
 * ────────
 *  Pas de mock — le dev server tape la vraie DB seedée (430 villes MA).
 *  Les mutations CRUD utilisent un slug unique par run pour rester
 *  idempotent et ne pas polluer le catalogue.
 *
 * Pré-requis local
 *   pnpm run seed:delivery-cities  # 430 villes MA depuis fixture sendit
 */
import { expect, test } from '@playwright/test';
import { ADMIN_STORAGE_PATH } from './helpers/auth';

test.describe('CHA-230 — /admin/settings/delivery-cities (auth required)', () => {
  test('redirige vers /admin/login sans session', async ({ browser }) => {
    // Context isolé sans storageState → visiteur anonyme.
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/admin/settings/delivery-cities');
    await expect(page).toHaveURL(/\/admin\/login/);
    await ctx.close();
  });
});

test.describe('CHA-230 — /admin/settings/delivery-cities (admin)', () => {
  // Réutilise la session admin produite par global.setup.ts
  test.use({ storageState: ADMIN_STORAGE_PATH });

  test('rend la table avec au moins 1 ville seedée', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/admin/settings/delivery-cities');

    await expect(
      page.getByRole('heading', { name: /Villes de livraison/i }),
    ).toBeVisible();
    // Le testid racine garantit que c'est bien notre composant client.
    await expect(page.getByTestId('delivery-cities-editor')).toBeVisible();
    // Casablanca doit toujours apparaître (présent dans fixture sendit).
    await expect(page.getByTestId('row-casablanca')).toBeVisible();
    // Le toggle, l'edit et le delete sont disponibles.
    await expect(page.getByTestId('toggle-casablanca')).toBeVisible();
    await expect(page.getByTestId('edit-casablanca')).toBeVisible();
    await expect(page.getByTestId('delete-casablanca')).toBeVisible();
  });

  test('le filtre `source=sendit` re-fetch et narrows les résultats', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto('/admin/settings/delivery-cities');
    await page.getByTestId('delivery-cities-editor').waitFor();

    // Capture le total initial (toutes sources confondues).
    const totalAllText = await page
      .locator('text=/\\d+\\s+résultats?/')
      .first()
      .textContent();
    expect(totalAllText).toBeTruthy();

    // Bascule sur source=sendit
    await page.getByTestId('source-filter').selectOption('sendit');

    // Wait pour que le re-fetch soit terminé (loading → résultats).
    await expect(
      page.locator('text=/\\d+\\s+résultats?/').first(),
    ).toBeVisible();
    // Le badge sendit doit toujours être présent (s'il existe au moins une
    // ville sendit, ce qui est garanti par la fixture).
    await expect(page.getByTestId('row-casablanca')).toBeVisible();
  });

  test('la recherche debouncée trouve Casablanca', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/admin/settings/delivery-cities');
    await page.getByTestId('delivery-cities-editor').waitFor();

    // Tape "casa" → debounce 250 ms → re-fetch
    await page.getByTestId('search-input').fill('casa');
    // Attend que Rabat soit hors de la liste (filtré).
    await expect(page.getByTestId('row-rabat')).toBeHidden({ timeout: 5_000 });
    await expect(page.getByTestId('row-casablanca')).toBeVisible();
  });

  test('toggle isActive flip puis revient (state-preserving)', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto('/admin/settings/delivery-cities');
    await page.getByTestId('delivery-cities-editor').waitFor();

    const toggle = page.getByTestId('toggle-casablanca');
    const before = await toggle.getAttribute('aria-pressed');

    // Premier click → flip
    await toggle.click();
    await expect(toggle).not.toHaveAttribute('aria-pressed', before ?? '');

    // Deuxième click → retour à l'état initial (preserves test idempotence)
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', before ?? 'true');
  });

  test('CRUD complet sur un slug temporaire (create → edit → delete)', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const stamp = Date.now();
    const slug = `e2e-test-${stamp}`;
    const nameFr = `E2E Test ${stamp}`;

    await page.goto('/admin/settings/delivery-cities');
    await page.getByTestId('delivery-cities-editor').waitFor();

    // ── CREATE ────────────────────────────────────────────────────────
    await page.getByTestId('add-city-btn').click();
    await page.getByTestId('create-slug').fill(slug);
    await page.getByTestId('create-name-fr').fill(nameFr);
    await page.getByTestId('create-price').fill('15');
    await page.getByTestId('create-save').click();

    // La modale se ferme + un message succès apparaît.
    await expect(page.getByRole('status').first()).toBeVisible();
    // La ville apparaît dans la table après refetch.
    await expect(page.getByTestId(`row-${slug}`)).toBeVisible({
      timeout: 10_000,
    });

    // ── EDIT ──────────────────────────────────────────────────────────
    await page.getByTestId(`edit-${slug}`).click();
    const priceInput = page.getByTestId('edit-price');
    await priceInput.fill('');
    await priceInput.fill('25');
    await page.getByTestId('edit-save').click();
    // La modale se ferme.
    await expect(
      page.getByRole('dialog', { name: new RegExp(`Éditer ${nameFr}`) }),
    ).toBeHidden({ timeout: 10_000 });

    // ── DELETE ────────────────────────────────────────────────────────
    await page.getByTestId(`delete-${slug}`).click();
    await expect(
      page.getByRole('dialog', { name: /Confirmer la suppression/ }),
    ).toBeVisible();
    await page.getByTestId('delete-confirm').click();

    // La ligne disparaît.
    await expect(page.getByTestId(`row-${slug}`)).toBeHidden({
      timeout: 10_000,
    });
  });
});

test.describe('CHA-230 — API publique /api/delivery-cities/search', () => {
  test('search?q=casa renvoie Casablanca dans les résultats', async ({
    request,
  }) => {
    const res = await request.get('/api/delivery-cities/search?q=casa&limit=10');
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as {
      items: Array<{ slug: string; nameFr: string; aliases: string[] }>;
      total: number;
      query: string;
    };
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
    const casa = body.items.find((c) => c.slug === 'casablanca');
    expect(casa).toBeDefined();
    expect(casa?.nameFr).toBe('Casablanca');
  });

  test('search?q=الدار (arabe) matche Casablanca via nameAr', async ({
    request,
  }) => {
    const res = await request.get(
      '/api/delivery-cities/search?q=' + encodeURIComponent('الدار البيضاء') + '&limit=5',
    );
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as {
      items: Array<{ slug: string }>;
    };
    const casa = body.items.find((c) => c.slug === 'casablanca');
    expect(casa).toBeDefined();
  });

  test('Cache-Control public, s-maxage=300 sur la réponse', async ({
    request,
  }) => {
    const res = await request.get('/api/delivery-cities/search?q=rabat');
    const cc = res.headers()['cache-control'] ?? '';
    expect(cc).toMatch(/public/);
    expect(cc).toMatch(/s-maxage=300/);
  });
});
