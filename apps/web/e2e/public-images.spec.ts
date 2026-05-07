/**
 * E2E — vérifie que les images seedées s'affichent CORRECTEMENT sur chaque
 * page publique (pas bloquées en blurhash, opacity > 0, naturalWidth > 0).
 *
 * Bug historique (cf. MediaImageClient.test) : si une image était déjà cachée
 * par le navigateur au moment de l'hydratation, l'event `onLoad` ne déclenchait
 * pas, l'opacity restait à 0, l'utilisateur voyait uniquement le blurhash en
 * background. Ce test agit comme garde-fou.
 *
 * Stratégie :
 *  1. Charger la page,
 *  2. Attendre que les <img> dans <picture.media-img> aient `complete=true`,
 *  3. Vérifier opacity computed > 0 et naturalWidth > 0,
 *  4. Vérifier qu'au moins UNE image décorative dépasse opacity 0.5
 *     (sinon on est dans le scénario « page floutée à jamais »).
 */
import { test, expect, type Page } from '@playwright/test';

const PUBLIC_PAGES = [
  { path: '/' },
  { path: '/rituel' },
  { path: '/journal' },
  { path: '/kit' },
  { path: '/maison' },
];

async function expectAllImagesVisible(p: Page) {
  // Attendre que la page soit prête.
  await p.waitForLoadState('networkidle');

  // Récupérer toutes les <img> dans des <picture> (filière media pipeline).
  const stats = await p.evaluate(() => {
    const imgs = Array.from(
      document.querySelectorAll<HTMLImageElement>('picture > img.media-img'),
    );
    return imgs.map((img) => {
      const cs = window.getComputedStyle(img);
      return {
        src: img.currentSrc || img.src,
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        opacity: parseFloat(cs.opacity),
      };
    });
  });

  // Si aucune image pipeline rendue, on accepte (pages sans binding).
  if (stats.length === 0) return;

  // Toutes les images doivent être complètes et avoir une largeur > 0.
  for (const s of stats) {
    expect(s.complete, `not complete: ${s.src}`).toBe(true);
    expect(s.naturalWidth, `naturalWidth==0: ${s.src}`).toBeGreaterThan(0);
  }

  // Au moins une image doit avoir opacity ≥ 0.99 (la transition met 200ms).
  const opaque = stats.filter((s) => s.opacity >= 0.99);
  expect(
    opaque.length,
    `Aucune image opaque sur la page — toutes les images sont restées floutées (blurhash visible).\n${JSON.stringify(stats, null, 2)}`,
  ).toBeGreaterThan(0);
}

for (const { path } of PUBLIC_PAGES) {
  test(`page ${path} : images seedées visibles (pas floutées)`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status() ?? 0).toBeLessThan(400);
    await expectAllImagesVisible(page);
  });
}

test('article journal : cover et inline rendent correctement', async ({ page }) => {
  await page.goto('/journal/cinq-minutes-le-soir');
  await expectAllImagesVisible(page);
});
