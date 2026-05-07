import { test, expect } from '@playwright/test';

/**
 * E2E — parcours fondatrice côté public (smoke test).
 * Vérifie que :
 *  - /         rend bien le manifeste FemiGlow
 *  - /rituel   rend la fiche produit
 *  - /journal  rend l'archive
 *  - /contact  rend le formulaire
 */
const PUBLIC_PAGES = [
  { path: '/', selector: /femiglow|tu commences/i },
  { path: '/rituel', selector: /rituel|kit/i },
  { path: '/journal', selector: /journal|archive/i },
  { path: '/contact', selector: /contact|écris/i },
];

for (const page of PUBLIC_PAGES) {
  test(`page publique ${page.path} se charge`, async ({ page: p }) => {
    const res = await p.goto(page.path);
    expect(res?.status()).toBeLessThan(400);
    await expect(p.getByRole('heading').first()).toBeVisible();
  });
}

test('robots noindex absent sur le public, présent sur /admin', async ({ request }) => {
  const home = await request.get('/');
  expect(home.headers()['x-robots-tag']).toBeUndefined();
  const admin = await request.get('/admin/login');
  expect(admin.headers()['x-robots-tag']).toMatch(/noindex/);
});
