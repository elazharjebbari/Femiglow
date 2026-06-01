/**
 * E2E — dégraissage des polices (priorité 2, cf.
 * docs/image-optimization-audit-2026-06-01).
 *
 * Avant : le root layout initialisait 4 polices (Cormorant, Inter, Pinyon,
 * Cairo) → next/font préchargeait les 4 woff2 sur TOUTES les pages (via les
 * resource hints RSC `HL[…,"font"]`), y compris /fr/kit. Or Pinyon ne sert qu'à
 * la lettre éditoriale (page /merci) et Cairo qu'en arabe : ces deux fontes
 * étaient téléchargées pour rien en FR.
 *
 * Après :
 *  - Pinyon initialisée dans EditorialLetter → absente des routes qui ne le
 *    rendent pas (/kit) : ni preload, ni @font-face, ni téléchargement.
 *  - Cairo en `preload: false` → plus de preload ; en FR la police n'est pas
 *    téléchargée (html[lang='ar'] ne matche pas) ; en AR elle reste chargée
 *    (à la demande, display:swap).
 *
 * On mesure le signal le plus fiable et indépendant du mécanisme (HL vs <link>)
 * : le nombre de woff2 self-hébergées (`/_next/static/media/*.woff2`) que le
 * navigateur charge réellement.
 */
import { test, expect, type Page } from '@playwright/test';

function trackWoff2(page: Page): Set<string> {
  const woff2 = new Set<string>();
  page.on('request', (r) => {
    if (/\/_next\/static\/media\/.*\.woff2(\?|$)/.test(r.url())) {
      woff2.add(r.url().split('/').pop() ?? r.url());
    }
  });
  return woff2;
}

test('/fr/kit : seules 2 polices chargées (Cormorant + Inter ; Pinyon/Cairo écartées)', async ({
  page,
}) => {
  const woff2 = trackWoff2(page);
  await page.goto('/fr/kit');
  await page.waitForLoadState('networkidle');
  // 4 → 2 : seules les polices réellement utilisées en FR sont chargées.
  expect(woff2.size, `woff2 chargées sur /fr/kit: ${[...woff2].join(', ')}`).toBe(2);
});

test('/ar/kit : Cairo toujours câblée en arabe (non régressé par preload:false)', async ({
  page,
}) => {
  const res = await page.goto('/ar/kit');
  expect(res?.status() ?? 0).toBeLessThan(400);

  // html[lang='ar'] applique `font-family: var(--font-cairo), 'Cairo', …`. La
  // variable --font-cairo reste posée sur <html> (cairo.variable) → la
  // font-family calculée du <html> doit référencer Cairo : preuve que le
  // câblage AR n'est pas cassé par preload:false.
  const htmlFontFamily = await page.evaluate(() =>
    getComputedStyle(document.documentElement).fontFamily.toLowerCase(),
  );
  expect(htmlFontFamily).toContain('cairo');
});
