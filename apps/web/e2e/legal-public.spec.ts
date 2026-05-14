/**
 * E2E — pages légales publiques.
 *
 * Pré-requis : pour les assertions "page rendue", il faut qu'au moins une
 * page (cgv ou mentions-legales) soit publiée. Si la DB est vide, on tombe
 * en 404 / not_found : test skipé proprement (pas de faux négatif).
 *
 * Stratégie : on visite d'abord la home pour vérifier que le footer expose
 * les liens légaux (zone footer-main), puis on suit le premier lien si
 * disponible et on valide le rendu (titre, robots noindex, last-updated).
 */
import { test, expect } from '@playwright/test';

test.describe('pages légales publiques', () => {
  test('footer expose la colonne légale', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    await expect(footer).toBeVisible();
    // Le footer doit afficher au moins une nav "Légal" (peut être vide si DB
    // pas seedée, mais l'aria-label doit exister).
    const legalNav = footer.locator('nav[aria-label="Légal"]');
    await expect(legalNav).toBeVisible();
  });

  test('GET /legal/<slug> renvoie une page ou 404 propre', async ({ page }) => {
    const res = await page.goto('/legal/cgv');
    if (!res || res.status() === 404) {
      // Page pas publiée (DB vide ou status=draft) : skip propre
      test.skip();
      return;
    }
    expect(res.status()).toBe(200);
    // Le markdown rendu peut ré-introduire un `<h1>` ou un `<em>Dernière
    // mise à jour : …</em>` en plus du header SSR. On vise donc le 1er
    // match (le header SSR `<p>` au-dessus du contenu).
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page.getByText(/Dernière mise à jour/i).first()).toBeVisible();
  });

  test('meta robots = noindex par défaut sur pages légales', async ({ page }) => {
    const res = await page.goto('/legal/cgv');
    if (!res || res.status() === 404) {
      test.skip();
      return;
    }
    // include_in_search=false par défaut → robots noindex
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots).toMatch(/noindex/i);
  });

  test('GET /legal/inconnue renvoie 404', async ({ page }) => {
    const res = await page.goto('/legal/cette-page-nexiste-vraiment-pas-zzz');
    expect(res?.status()).toBe(404);
  });

  test('/api/legal/placements/<zone> renvoie JSON avec links[]', async ({ request }) => {
    const res = await request.get('/api/legal/placements/footer-main');
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { zone: string; links: unknown[] };
    expect(body.zone).toBe('footer-main');
    expect(Array.isArray(body.links)).toBe(true);
  });

  test('/api/legal/placements/INVALID-zone renvoie 400', async ({ request }) => {
    const res = await request.get('/api/legal/placements/NOT-a-zone');
    expect(res.status()).toBe(400);
  });

  test('/api/health/legal répond 200 ou 503 (selon état)', async ({ request }) => {
    const res = await request.get('/api/health/legal');
    expect([200, 503]).toContain(res.status());
    const body = (await res.json()) as { status: string };
    expect(['ok', 'degraded', 'error']).toContain(body.status);
  });

  test('sitemap.xml ne contient pas les slugs noindex', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const xml = await res.text();
    // CGV est noindex par défaut → ne doit PAS apparaître dans le sitemap.
    expect(xml).not.toContain('/legal/cgv');
    expect(xml).not.toContain('/legal/mentions-legales');
  });
});
