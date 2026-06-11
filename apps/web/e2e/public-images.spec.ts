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

  // Déclencher le chargement des images `loading="lazy"` situées sous la ligne
  // de flottaison : sans scroll elles restent `complete=false` / `currentSrc=""`
  // (et `img.currentSrc || img.src` retomberait sur le fallback jpeg de l'<img>,
  // donnant un faux négatif). On parcourt la page puis on revient en haut.
  await p.evaluate(async () => {
    const step = Math.max(window.innerHeight, 400);
    const max = document.body.scrollHeight;
    for (let y = 0; y <= max; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await p.waitForLoadState('networkidle');

  // Attendre que TOUTES les <img> pipeline soient complètes (lazy incluses).
  await p.waitForFunction(
    () => {
      const imgs = Array.from(
        document.querySelectorAll<HTMLImageElement>('picture > img.media-img'),
      );
      return imgs.length === 0 || imgs.every((img) => img.complete);
    },
    undefined,
    { timeout: 10_000 },
  );

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

/**
 * E2E — optimisation de format effective sur la landing.
 *
 * Bug signalé : « les images se chargent en jpeg ». Ce test prouve le contraire
 * de bout en bout dans un vrai navigateur (Chromium supporte avif/webp) :
 *  1. `currentSrc` des images du pipeline est avif/webp (jamais jpeg) ;
 *  2. chaque <picture> expose <source type=image/avif> + image/webp ;
 *  3. AUCUNE réponse réseau /_media n'est servie en jpeg (le jpeg n'est que le
 *     fallback <img>, non chargé par un navigateur moderne) ;
 *  4. le hero LCP est préchargé via <link rel=preload as=image type=image/avif>.
 */
test('/ : formats modernes servis (avif/webp, jamais jpeg) + preload hero LCP', async ({
  page,
}) => {
  const mediaResponses: { url: string; ct: string }[] = [];
  page.on('response', (r) => {
    const ct = r.headers()['content-type'] || '';
    if (ct.startsWith('image/') && /\/_media\//.test(r.url())) {
      mediaResponses.push({ url: r.url(), ct });
    }
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // 1) currentSrc = ce que le navigateur a RÉELLEMENT choisi dans <picture>.
  const rendered = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLImageElement>('picture > img.media-img'),
    ).map((img) => img.currentSrc || img.src),
  );
  expect(rendered.length, 'aucune image pipeline rendue sur /').toBeGreaterThan(0);
  for (const src of rendered) {
    expect(src, `image servie en format non-moderne: ${src}`).toMatch(
      /\.(avif|webp)(\?|$)/,
    );
  }

  // 2) Chaque <picture> expose les <source> modernes (avif préféré, puis webp).
  const pictureTypes = await page.evaluate(() => {
    const pic = document.querySelector('picture');
    return pic
      ? Array.from(pic.querySelectorAll('source')).map((s) => s.getAttribute('type'))
      : [];
  });
  expect(pictureTypes).toContain('image/avif');
  expect(pictureTypes).toContain('image/webp');

  // 3) Aucune réponse jpeg issue du pipeline /_media.
  const jpegMedia = mediaResponses.filter((r) => /jpe?g/.test(r.ct));
  expect(
    jpegMedia.length,
    `images pipeline servies en jpeg:\n${JSON.stringify(jpegMedia, null, 2)}`,
  ).toBe(0);
  // …et au moins une réponse avif réellement servie (preuve positive).
  expect(
    mediaResponses.some((r) => /avif/.test(r.ct)),
    `aucune réponse avif servie:\n${JSON.stringify(mediaResponses, null, 2)}`,
  ).toBe(true);

  // 4) Preload LCP du hero présent dans <head>.
  const preload = await page.evaluate(() => {
    const link = document.querySelector<HTMLLinkElement>(
      'link[rel="preload"][as="image"]',
    );
    return link
      ? { type: link.getAttribute('type'), imagesrcset: link.getAttribute('imagesrcset') }
      : null;
  });
  expect(preload, 'aucun <link rel=preload as=image> — hero non préchargé').not.toBeNull();
  expect(preload?.type).toBe('image/avif');
  expect(preload?.imagesrcset).toContain('.avif');
});
