import { expect, test, type Page } from '@playwright/test';

/**
 * Kit CRO v2 §3 — titre du hero /kit selon l'angle publicitaire.
 *
 * Résolution serveur : `?angle=` > `?utm_content=` > cookie `fg_angle`.
 * L'angle est exposé en `data-kit-angle` sur la section du hero (lu au clic
 * par les boutons « Commander » pour `add_to_cart.kit_angle`).
 *
 * Les textes par défaut du registre (`kit-hero-angles`) sont lus depuis la
 * base : les assertions de texte supposent `sync:components` lancé et aucun
 * texte FR publié qui les remplace. Les assertions sur l'attribut et le
 * cookie n'en dépendent pas.
 *
 * `?cta=scroll` : comportement de commande stable (cf. kit-commander-sheet).
 */

const hero = (page: Page) => page.locator('section[data-kit-angle]').first();

interface CapturedEvent {
  event: string;
  params: Record<string, unknown>;
}

/** Capture les lots envoyés à /api/track (cf. tracking-client-events.spec). */
function trackingCollector(page: Page): CapturedEvent[] {
  const events: CapturedEvent[] = [];
  void page.route('**/api/track', async (route) => {
    try {
      const body = JSON.parse(route.request().postData() || '{}') as { events?: CapturedEvent[] };
      if (body.events) events.push(...body.events);
    } catch {
      /* ignore */
    }
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, accepted: 1, rejected: 0, duplicates: 0 }),
    });
  });
  return events;
}

test.describe('/kit hero — angle publicitaire', () => {
  test('utm_content=E-darija → angle E (titre « salon ou 99 DH »)', async ({ page }) => {
    await page.goto('/kit?cta=scroll&utm_content=E-darija');

    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'e');
    const h1 = page.getByRole('heading', { level: 1 }).first();
    await expect(h1).toContainText(/manucure japonaise/i);
    await expect(h1).toContainText(/salon chez vous, pour 99 DH/i);
  });

  test('le nom d’annonce (E_salon-ou-99dh_darija) est aussi reconnu', async ({ page }) => {
    await page.goto('/kit?cta=scroll&utm_content=E_salon-ou-99dh_darija');
    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'e');
  });

  test('temoin-* → angle témoin', async ({ page }) => {
    await page.goto('/kit?cta=scroll&utm_content=temoin-manucure-chine');
    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'temoin');
  });

  test('?angle= (recette) prime sur utm_content', async ({ page }) => {
    await page.goto('/kit?cta=scroll&angle=d&utm_content=E-fr');
    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'd');
    await expect(page.getByRole('heading', { level: 1 }).first()).toContainText(/woudou/i);
  });

  test('sans angle : titre par défaut, aucun cookie posé', async ({ page, context }) => {
    await page.goto('/kit?cta=scroll&utm_content=retargeting');

    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'none');
    await expect(page.getByRole('heading', { level: 1 }).first()).toContainText(
      /manucure japonaise/i,
    );
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === 'fg_angle')).toBeUndefined();
  });

  test('cookie fg_angle : posé depuis l’URL, puis réutilisé sans UTM', async ({ page, context }) => {
    await page.goto('/kit?cta=scroll&utm_content=E-darija');
    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'e');

    // Le cookie est posé par le client après hydratation.
    await expect
      .poll(async () => (await context.cookies()).find((c) => c.name === 'fg_angle')?.value)
      .toBe('e');
    const cookie = (await context.cookies()).find((c) => c.name === 'fg_angle')!;
    expect(cookie.path).toBe('/');
    expect(cookie.sameSite).toBe('Lax');
    // ≈ 7 jours (tolérance d'une heure).
    const ttl = cookie.expires - Date.now() / 1000;
    expect(ttl).toBeGreaterThan(7 * 24 * 3600 - 3600);
    expect(ttl).toBeLessThanOrEqual(7 * 24 * 3600 + 60);

    // Retour sans UTM : l'angle est conservé.
    await page.goto('/kit?cta=scroll');
    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'e');
    await expect(page.getByRole('heading', { level: 1 }).first()).toContainText(/salon/i);

    // Une nouvelle publicité remplace l'angle mémorisé.
    await page.goto('/kit?cta=scroll&utm_content=A-darija');
    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'a');
    await expect
      .poll(async () => (await context.cookies()).find((c) => c.name === 'fg_angle')?.value)
      .toBe('a');
  });

  test('view_item et add_to_cart portent kit_angle (/api/track)', async ({ page }) => {
    const events = trackingCollector(page);
    await page.goto('/kit?cta=scroll&utm_content=E-fr');
    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'e');

    await hero(page).getByRole('button', { name: /je commande/i }).first().click();
    await expect
      .poll(() => events.find((e) => e.event === 'add_to_cart')?.params.kit_angle, {
        timeout: 10_000,
      })
      .toBe('e');
    expect(events.find((e) => e.event === 'view_item')?.params.kit_angle).toBe('e');
  });

  test('/ar/kit : angle sans texte AR publié → titre AR habituel (jamais de français)', async ({
    page,
  }) => {
    await page.goto('/ar/kit?cta=scroll&utm_content=E-darija');
    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'e');
    const h1 = page.getByRole('heading', { level: 1 }).first();
    await expect(h1).not.toContainText(/salon chez vous/i);
  });
});

/**
 * Images du hero par audience (angle × langue) — PR 4.
 *
 * Dépend du drapeau d'environnement `HERO_MEDIA_VARIANTS` (lu depuis `.env`
 * par playwright.config, comme par le serveur local) et du champ CMS
 * `kit-hero-produit.mediaVariantsEnabled` : chaque cas est ignoré quand
 * l'environnement ne s'y prête pas, sur le modèle des autres specs.
 *
 * Drapeau coupé : aucun `data-hero-media-variant`, aucun `<picture>` dans le
 * hero, aucun `hero_media_variant` envoyé (rendu identique à l'existant).
 */
const HERO_MEDIA_ENV_ON = ['on', 'true', '1'].includes(
  (process.env.HERO_MEDIA_VARIANTS ?? '').trim().toLowerCase(),
);
const HERO_MEDIA_VARIANT_RE = /^[a-z0-9:._*-]+$/;

test.describe('/kit hero — images par audience (HERO_MEDIA_VARIANTS)', () => {
  test('drapeau d’environnement coupé : galerie historique, aucun attribut', async ({ page }) => {
    test.skip(HERO_MEDIA_ENV_ON, 'HERO_MEDIA_VARIANTS=on dans cet environnement.');
    const events = trackingCollector(page);
    await page.goto('/fr/kit?cta=scroll&angle=e');
    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'e');
    await expect(hero(page)).not.toHaveAttribute('data-hero-media-variant');
    await expect(hero(page).locator('picture')).toHaveCount(0);
    await expect.poll(() => events.some((e) => e.event === 'view_item'), { timeout: 10_000 }).toBe(true);
    expect(events.find((e) => e.event === 'view_item')?.params).not.toHaveProperty('hero_media_variant');
  });

  test('drapeau actif : variante posée sur le hero et envoyée avec view_item / add_to_cart', async ({
    page,
  }) => {
    test.skip(!HERO_MEDIA_ENV_ON, 'HERO_MEDIA_VARIANTS non activé dans cet environnement.');
    const events = trackingCollector(page);
    await page.goto('/fr/kit?cta=scroll&angle=e');
    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'e');
    const variant = await hero(page).getAttribute('data-hero-media-variant');
    test.skip(variant === null, 'Champ CMS mediaVariantsEnabled=false dans cet environnement.');
    expect(variant).toMatch(HERO_MEDIA_VARIANT_RE);
    // Angle E en FR : ensemble E (fr ou toutes langues), sinon un repli documenté.
    expect(variant).toMatch(/^(angle-e\.(fr|any)\.v\d+|default\.(fr|any)\.v\d+|legacy|product)$/);
    const level = Number(await hero(page).getAttribute('data-hero-media-level'));
    expect(level).toBeGreaterThanOrEqual(1);
    expect(level).toBeLessThanOrEqual(8);

    await expect
      .poll(() => events.find((e) => e.event === 'view_item')?.params.hero_media_variant, {
        timeout: 10_000,
      })
      .toBe(variant);
    await hero(page).getByRole('button', { name: /je commande/i }).first().click();
    await expect
      .poll(() => events.find((e) => e.event === 'add_to_cart')?.params.hero_media_variant, {
        timeout: 10_000,
      })
      .toBe(variant);
  });

  test('drapeau actif : /ar/kit + utm A-darija → ensemble AR (jamais un ensemble FR)', async ({
    page,
  }) => {
    test.skip(!HERO_MEDIA_ENV_ON, 'HERO_MEDIA_VARIANTS non activé dans cet environnement.');
    await page.goto('/ar/kit?cta=scroll&utm_content=A-darija');
    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'a');
    const variant = await hero(page).getAttribute('data-hero-media-variant');
    test.skip(variant === null, 'Champ CMS mediaVariantsEnabled=false dans cet environnement.');
    // `.fr.` n'est possible que via un ensemble explicitement `crossLocale`.
    expect(variant).toMatch(/^(angle-a\.(ar|any|fr)\.v\d+|default\.(ar|any|fr)\.v\d+|legacy|product)$/);
  });

  test('drapeau actif : ?hmv=off coupe pour l’URL', async ({ page }) => {
    test.skip(!HERO_MEDIA_ENV_ON, 'HERO_MEDIA_VARIANTS non activé dans cet environnement.');
    await page.goto('/fr/kit?cta=scroll&angle=e&hmv=off');
    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'e');
    await expect(hero(page)).not.toHaveAttribute('data-hero-media-variant');
    await expect(hero(page).locator('picture')).toHaveCount(0);
  });

  test('drapeau actif : au plus 1 preload image par media dans <head>', async ({ page }) => {
    test.skip(!HERO_MEDIA_ENV_ON, 'HERO_MEDIA_VARIANTS non activé dans cet environnement.');
    await page.goto('/fr/kit?cta=scroll&angle=e');
    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'e');
    const preloads = await page.$$eval('head link[rel="preload"][as="image"]', (links) =>
      links.map((l) => ({ media: l.getAttribute('media') ?? '', srcset: l.getAttribute('imagesrcset') })),
    );
    const perMedia = new Map<string, number>();
    for (const p of preloads) perMedia.set(p.media, (perMedia.get(p.media) ?? 0) + 1);
    for (const [media, count] of perMedia) expect(count, `preloads pour media="${media}"`).toBe(1);
    // Image principale art-dirigée : preloads mobile ET desktop, chacun borné.
    if ((await hero(page).locator('picture').count()) > 0) {
      expect(perMedia.get('(max-width: 1023px)')).toBe(1);
      expect(perMedia.get('(min-width: 1024px)')).toBe(1);
      expect(perMedia.has('')).toBe(false);
    }
  });

  test.describe('viewport mobile', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('drapeau actif : une seule image principale téléchargée (source mobile)', async ({ page }) => {
      test.skip(!HERO_MEDIA_ENV_ON, 'HERO_MEDIA_VARIANTS non activé dans cet environnement.');
      const imageRequests: string[] = [];
      page.on('request', (req) => {
        if (req.resourceType() === 'image') imageRequests.push(req.url());
      });
      await page.goto('/fr/kit?cta=scroll&angle=e');
      await expect(hero(page)).toHaveAttribute('data-kit-angle', 'e');
      const picture = hero(page).locator('picture').first();
      test.skip((await picture.count()) === 0, 'Aucune image art-dirigée publiée pour cet angle.');
      await page.waitForLoadState('networkidle');

      /** Paramètre `url=` de `/_next/image` (= média d'origine). */
      const origin = (u: string | null) => {
        if (!u) return null;
        const first = u.split(',')[0]!.trim().split(/\s+/)[0]!;
        return new URL(first, page.url()).searchParams.get('url') ?? first;
      };
      const mobileOrigin = origin(await picture.locator('source').getAttribute('srcset'));
      const desktopOrigin = origin(await picture.locator('img').getAttribute('src'));
      expect(mobileOrigin).not.toBe(desktopOrigin);

      const fetched = (o: string | null) =>
        imageRequests.filter((u) => o !== null && new URL(u).searchParams.get('url') === o);
      // La source mobile : une seule largeur ; l'image desktop : jamais.
      expect(new Set(fetched(mobileOrigin)).size).toBe(1);
      expect(fetched(desktopOrigin)).toHaveLength(0);
    });
  });

  test('?hmv_preview=draft sans session admin : ignoré (même rendu que sans)', async ({ page }) => {
    await page.goto('/fr/kit?cta=scroll&angle=e');
    const publicVariant = await hero(page).getAttribute('data-hero-media-variant');
    await page.goto('/fr/kit?cta=scroll&angle=e&hmv_preview=draft');
    await expect(hero(page)).toHaveAttribute('data-kit-angle', 'e');
    expect(await hero(page).getAttribute('data-hero-media-variant')).toBe(publicVariant);
  });
});
