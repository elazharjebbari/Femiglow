/**
 * CHA-243 — E2E du player vidéo YouTube sur /kit.
 *
 * Couvre :
 *   1. La page /kit rend une iframe YouTube (pas de <video> self-hosted)
 *   2. L'iframe pointe sur `www.youtube-nocookie.com` (privacy-enhanced)
 *   3. L'iframe contient l'ID de la vidéo configurée
 *   4. Les params privacy (`rel=0`, `modestbranding=1`) sont présents
 *   5. Le wrapper a un ratio 9:16 (Short détecté correctement)
 *   6. Aucune requête réseau ne part vers `youtube.com` au chargement (avant
 *      lecture) — vérifie que `youtube-nocookie.com` est bien isolé.
 *
 * On ne mocke pas YouTube — l'iframe charge bien depuis l'extérieur ; on
 * vérifie juste le contrat de notre rendu et qu'aucune fuite cookie n'est
 * faite vers `youtube.com` avant un play utilisateur.
 */
import { expect, test } from '@playwright/test';

test.describe('CHA-243 — Vidéo YouTube /kit', () => {
  test('rend une iframe `youtube-nocookie.com` avec ratio Short 9:16', async ({
    page,
  }) => {
    test.setTimeout(60_000);

    // 0) Tracker les requêtes pour vérifier qu'aucune ne part vers `youtube.com` direct.
    const youtubeCookieRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      // www.youtube.com / m.youtube.com (mais pas youtube-nocookie.com).
      if (/^https?:\/\/(www\.|m\.)?youtube\.com\b/.test(url)) {
        youtubeCookieRequests.push(url);
      }
    });

    // 1) Charger /kit.
    await page.goto('/kit');

    // 2) L'embed YouTube est rendu.
    const embed = page.getByTestId('youtube-embed');
    await expect(embed).toBeVisible();

    // 3) Pas de <video> self-hosted en parallèle.
    await expect(page.locator('video')).toHaveCount(0);

    // 4) Le data-is-short atteste la détection.
    await expect(embed).toHaveAttribute('data-is-short', 'true');
    await expect(embed).toHaveAttribute('data-video-id', 'N2pDuciP4uQ');

    // 5) Ratio Short 9:16 — la classe Tailwind injectée.
    const wrapClass = await embed.getAttribute('class');
    expect(wrapClass ?? '').toContain('aspect-[9/16]');

    // 6) L'iframe contient bien le bon domaine + l'ID.
    const iframe = embed.locator('iframe');
    await expect(iframe).toBeVisible();
    const src = await iframe.getAttribute('src');
    expect(src).toBeTruthy();
    expect(src!).toContain('https://www.youtube-nocookie.com/embed/N2pDuciP4uQ');

    // 7) Params privacy minimal présents dans la query.
    const u = new URL(src!);
    expect(u.searchParams.get('rel')).toBe('0');
    expect(u.searchParams.get('modestbranding')).toBe('1');
    expect(u.searchParams.get('iv_load_policy')).toBe('3');
    expect(u.searchParams.get('playsinline')).toBe('1');

    // 8) Le titre accessible est porté par l'iframe (WCAG 2.4.1).
    await expect(iframe).toHaveAttribute('title', /4 gestes|vidéo/i);

    // 9) loading=lazy + referrerPolicy strict-origin
    await expect(iframe).toHaveAttribute('loading', 'lazy');
    await expect(iframe).toHaveAttribute(
      'referrerpolicy',
      'strict-origin-when-cross-origin',
    );

    // 9bis) Permissions Policy : fullscreen ET picture-in-picture
    // (Chrome/Firefox modernes lisent `allow="fullscreen"`, Safari < 16.5 lit
    // l'attribut legacy `allowfullscreen` côté élément).
    const allowAttr = (await iframe.getAttribute('allow')) ?? '';
    expect(allowAttr).toContain('fullscreen');
    expect(allowAttr).toContain('picture-in-picture');
    expect(allowAttr).toContain('autoplay');
    await expect(iframe).toHaveAttribute('allowfullscreen', '');

    // 10) Avant interaction : aucune requête vers `youtube.com` (cookie domain).
    //    Note : l'iframe va appeler `youtube-nocookie.com` mais c'est OK.
    //    On laisse le réseau se stabiliser brièvement.
    await page.waitForTimeout(800);
    expect(youtubeCookieRequests, `Fuites vers youtube.com: ${youtubeCookieRequests.join(', ')}`)
      .toHaveLength(0);
  });
});
